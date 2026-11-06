import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.billing.service import BillingService
from app.modules.families.service import FamiliesService
from app.modules.memories.models import EntitiesStatus, Memory, MemoryPhoto, MemoryType
from app.modules.memories.photo_images import validate_photo
from app.modules.memories.photo_settings import PHOTO_URL_SECONDS
from app.modules.memories.photo_storage import PhotoStorage, SupabasePhotoStorage
from app.modules.memories.repository import MemoriesRepository
from app.modules.memories.schemas import (
    AnecdoteCreateRequest,
    MemoryListRequest,
    MemoryListResponse,
    MemoryPatchRequest,
    MemoryResponse,
    PhotoListResponse,
    PhotoResponse,
    SongCreateRequest,
)

logger = logging.getLogger(__name__)


class MemoriesError(ApplicationError):
    """A public error raised by the memories module."""


class MemoriesService:
    """Use a dedicated session and own the transaction for every operation."""

    def __init__(self, session: Session, *, photo_storage: PhotoStorage | None = None) -> None:
        self.photo_storage = photo_storage or SupabasePhotoStorage()
        self.session = session
        self.repository = MemoriesRepository(session)
        self.families = FamiliesService(session)

    def _context(self, actor_id: UUID) -> tuple[UUID, bool]:
        account = self.families.get_current_user(actor_id)
        profile = self.families.get_elder_profile(actor_id)
        return profile.id, account.user.role == "cuidador_principal"

    @staticmethod
    def _not_found() -> MemoriesError:
        return MemoriesError(
            code="memory_not_found", message="No encontramos este recuerdo.", status_code=404
        )

    def _require_memory(
        self, memory_id: UUID, profile_id: UUID, *, for_update: bool = False
    ) -> Memory:
        memory = self.repository.get_memory(
            memory_id, elder_profile_id=profile_id, for_update=for_update
        )
        if memory is None:
            raise self._not_found()
        return memory

    @staticmethod
    def _require_editor(memory: Memory, actor_id: UUID, is_caregiver: bool) -> None:
        if memory.created_by != actor_id and not is_caregiver:
            raise MemoriesError(
                code="forbidden",
                message=(
                    "Solo quien compartió el recuerdo o quien cuida principalmente puede cambiarlo."
                ),
                status_code=403,
            )

    def create_memory(
        self, actor_id: UUID, data: AnecdoteCreateRequest | SongCreateRequest
    ) -> MemoryResponse:
        profile_id, _ = self._context(actor_id)
        with self.session.begin():
            memory = self.repository.create_memory(
                elder_profile_id=profile_id, created_by=actor_id, **data.model_dump()
            )
            return MemoryResponse.model_validate(memory)

    def list_memories(
        self, actor_id: UUID, query: MemoryListRequest | None = None
    ) -> MemoryListResponse:
        query = query or MemoryListRequest()
        profile_id, _ = self._context(actor_id)
        filters = {
            "elder_profile_id": profile_id,
            "q": query.q,
            "type": query.type,
            "include_sensitive": query.include_sensitive,
        }
        with self.session.begin():
            return MemoryListResponse.model_validate(
                {
                    "items": self.repository.list_memories(
                        **filters, limit=query.limit, offset=query.offset
                    ),
                    "total": self.repository.count_memories(**filters),
                    "limit": query.limit,
                    "offset": query.offset,
                }
            )

    def get_memory(self, actor_id: UUID, memory_id: UUID) -> MemoryResponse:
        profile_id, _ = self._context(actor_id)
        with self.session.begin():
            return MemoryResponse.model_validate(self._require_memory(memory_id, profile_id))

    def update_memory(
        self, actor_id: UUID, memory_id: UUID, data: MemoryPatchRequest
    ) -> MemoryResponse:
        profile_id, is_caregiver = self._context(actor_id)
        changes = data.model_dump(exclude_unset=True)
        with self.session.begin():
            memory = self._require_memory(memory_id, profile_id, for_update=True)
            self._require_editor(memory, actor_id, is_caregiver)
            incompatible = "url" if memory.type == MemoryType.ANECDOTE else "text"
            if incompatible in changes:
                raise MemoriesError(
                    code="validation_error",
                    message="Envía texto para una anécdota o un enlace para una canción.",
                    status_code=422,
                )
            updated = self.repository.update_memory(
                memory_id, elder_profile_id=profile_id, changes=changes
            )
            return MemoryResponse.model_validate(updated)

    def delete_memory(self, actor_id: UUID, memory_id: UUID) -> None:
        profile_id, is_caregiver = self._context(actor_id)
        with self.session.begin():
            memory = self._require_memory(memory_id, profile_id, for_update=True)
            self._require_editor(memory, actor_id, is_caregiver)
            self._remove_photo_objects(
                self.repository.list_photos(memory_id, elder_profile_id=profile_id)
            )
            self.repository.delete_memory(memory_id, elder_profile_id=profile_id)

    def retry_entities(self, actor_id: UUID, memory_id: UUID) -> MemoryResponse:
        profile_id, is_caregiver = self._context(actor_id)
        with self.session.begin():
            memory = self._require_memory(memory_id, profile_id, for_update=True)
            self._require_editor(memory, actor_id, is_caregiver)
            if memory.type != MemoryType.ANECDOTE:
                raise MemoriesError(
                    code="validation_error",
                    status_code=422,
                    message="Solo puedes volver a analizar una anécdota.",
                )
            if memory.entities_status != EntitiesStatus.FAILED:
                raise MemoriesError(
                    code="extraction_not_failed",
                    status_code=409,
                    message="Solo puedes reintentar un análisis que haya fallado.",
                )
            retried = self.repository.retry_failed_entities(memory_id, elder_profile_id=profile_id)
            return MemoryResponse.model_validate(retried)

    def _photo_context(self, actor_id: UUID) -> tuple[UUID, UUID, bool]:
        user = self.families.get_current_user(actor_id).user
        profile = self.families.get_elder_profile(actor_id)
        return profile.id, user.family_id, user.role == "cuidador_principal"

    def _photo_responses(self, photos: list[MemoryPhoto]) -> list[PhotoResponse]:
        expires = datetime.now(UTC) + timedelta(seconds=PHOTO_URL_SECONDS)
        grouped: dict[str, list[str]] = {}
        for photo in photos:
            grouped.setdefault(photo.bucket, []).append(photo.object_key)
        urls = {}
        for bucket, keys in grouped.items():
            urls.update(self.photo_storage.signed_urls(bucket, keys))
        return [
            PhotoResponse(
                id=photo.id,
                memory_id=photo.memory_id,
                created_by=photo.created_by,
                content_type=photo.content_type,
                size_bytes=photo.size_bytes,
                width=photo.width,
                height=photo.height,
                created_at=photo.created_at,
                url=urls[photo.object_key],
                url_expires_at=expires,
            )
            for photo in photos
        ]

    def upload_photo(
        self,
        actor_id: UUID,
        memory_id: UUID,
        *,
        data: bytes,
        content_type: str,
        filename: str,
    ) -> PhotoResponse:
        profile_id, family_id, caregiver = self._photo_context(actor_id)
        quota = BillingService(self.session).get_photo_quota(actor_id)
        attempted_upload = False
        photo = None
        try:
            with self.session.begin():
                self.repository.lock_photo_capacity(profile_id)
                memory = self._require_memory(memory_id, profile_id, for_update=True)
                self._require_editor(memory, actor_id, caregiver)
                quota.require_capacity(self.repository.count_photos(profile_id))
                image = validate_photo(data, content_type, filename)
                photo_id = uuid4()
                photo = self.repository.add_photo(
                    MemoryPhoto(
                        id=photo_id,
                        memory_id=memory_id,
                        created_by=actor_id,
                        bucket=self.photo_storage.bucket,
                        object_key=f"{family_id}/{memory_id}/{photo_id}{image.extension}",
                        content_type=image.content_type,
                        size_bytes=len(image.data),
                        width=image.width,
                        height=image.height,
                    )
                )
                attempted_upload = True
                self.photo_storage.upload(
                    photo.bucket, photo.object_key, image.data, image.content_type
                )
                return self._photo_responses([photo])[0]
        except Exception:
            if attempted_upload and photo is not None:
                try:
                    self.photo_storage.remove(photo.bucket, [photo.object_key])
                except ApplicationError:
                    # Identifiers only; never include names, file contents or signed URLs.
                    logger.warning("Photo upload cleanup failed: %s", photo.object_key)
            raise

    def list_photos(
        self,
        actor_id: UUID,
        memory_id: UUID,
        *,
        limit: int = 20,
        offset: int = 0,
    ) -> PhotoListResponse:
        profile_id, _, _ = self._photo_context(actor_id)
        with self.session.begin():
            self._require_memory(memory_id, profile_id)
            photos = self.repository.list_photos(
                memory_id, elder_profile_id=profile_id, limit=limit, offset=offset
            )
            return PhotoListResponse(
                items=self._photo_responses(photos),
                total=self.repository.count_photos(profile_id, memory_id),
                limit=limit,
                offset=offset,
            )

    def _remove_photo_objects(self, photos: list[MemoryPhoto]) -> None:
        grouped: dict[str, list[str]] = {}
        for photo in photos:
            grouped.setdefault(photo.bucket, []).append(photo.object_key)
        for bucket, keys in grouped.items():
            for start in range(0, len(keys), 100):
                self.photo_storage.remove(bucket, keys[start : start + 100])

    def delete_photo(self, actor_id: UUID, memory_id: UUID, photo_id: UUID) -> None:
        profile_id, _, caregiver = self._photo_context(actor_id)
        with self.session.begin():
            memory = self._require_memory(memory_id, profile_id, for_update=True)
            self._require_editor(memory, actor_id, caregiver)
            photos = self.repository.list_photos(memory_id, elder_profile_id=profile_id)
            photo = next((item for item in photos if item.id == photo_id), None)
            if photo is None:
                raise MemoriesError(
                    code="photo_not_found", message="No encontramos esta foto.", status_code=404
                )
            self._remove_photo_objects([photo])
            self.repository.delete_photo(photo)
