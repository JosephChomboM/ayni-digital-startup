from uuid import UUID

from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.families.service import FamiliesService
from app.modules.memories.models import Memory, MemoryType
from app.modules.memories.repository import MemoriesRepository
from app.modules.memories.schemas import (
    AnecdoteCreateRequest,
    MemoryListRequest,
    MemoryListResponse,
    MemoryPatchRequest,
    MemoryResponse,
    SongCreateRequest,
)


class MemoriesError(ApplicationError):
    """A public error raised by the memories module."""


class MemoriesService:
    """Use a dedicated session and own the transaction for every operation."""

    def __init__(self, session: Session) -> None:
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
            self.repository.delete_memory(memory_id, elder_profile_id=profile_id)
