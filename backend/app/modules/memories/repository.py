from collections.abc import Mapping, Sequence
from uuid import UUID

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.sql.elements import ColumnElement

from app.modules.memories.models import (
    EntitiesStatus,
    Memory,
    MemoryEntity,
    MemoryEntityKind,
    MemoryPhoto,
    MemoryType,
)


class MemoriesRepository:
    """Scope queries by profile and flush writes; callers own sessions and transactions."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def account_photos(
        self, profile_id: UUID, actor_id: UUID, *, whole_family: bool
    ) -> list[MemoryPhoto]:
        statement = select(MemoryPhoto).join(Memory).where(Memory.elder_profile_id == profile_id)
        if not whole_family:
            statement = statement.where(
                or_(Memory.created_by == actor_id, MemoryPhoto.created_by == actor_id)
            )
        return list(self.session.scalars(statement))

    def mark_account_memories_for_deletion(
        self, profile_id: UUID, actor_id: UUID, *, whole_family: bool
    ) -> None:
        statement = update(Memory).where(Memory.elder_profile_id == profile_id)
        if not whole_family:
            statement = statement.where(Memory.created_by == actor_id)
        self.session.execute(statement.values(deletion_pending=True))

    def create_memory(
        self,
        *,
        elder_profile_id: UUID,
        created_by: UUID,
        type: MemoryType,
        title: str,
        text: str | None = None,
        url: str | None = None,
        is_positive: bool = False,
        is_sensitive: bool = False,
    ) -> Memory:
        memory = Memory(
            elder_profile_id=elder_profile_id,
            created_by=created_by,
            type=type,
            title=title,
            text=text,
            url=url,
            is_positive=is_positive,
            is_sensitive=is_sensitive,
            entities_status=(
                EntitiesStatus.PENDING
                if type == MemoryType.ANECDOTE
                else EntitiesStatus.NOT_APPLICABLE
            ),
            entities=[],
        )
        self.session.add(memory)
        self.session.flush()
        return memory

    def get_memory(
        self, memory_id: UUID, *, elder_profile_id: UUID, for_update: bool = False
    ) -> Memory | None:
        statement = (
            select(Memory)
            .where(Memory.id == memory_id, Memory.elder_profile_id == elder_profile_id)
            .options(selectinload(Memory.entities))
        )
        if for_update:
            statement = statement.with_for_update().execution_options(populate_existing=True)
        return self.session.scalar(statement)

    @staticmethod
    def _filters(
        elder_profile_id: UUID,
        type: MemoryType | None,
        include_sensitive: bool,
        q: str | None = None,
    ) -> list[ColumnElement[bool]]:
        filters = [Memory.elder_profile_id == elder_profile_id]
        if type is not None:
            filters.append(Memory.type == type)
        if not include_sensitive:
            filters.append(Memory.is_sensitive.is_(False))
        if q is not None:
            filters.append(
                or_(
                    Memory.title.icontains(q, autoescape=True),
                    Memory.text.icontains(q, autoescape=True),
                    Memory.entities.any(MemoryEntity.text.icontains(q, autoescape=True)),
                )
            )
        return filters

    def list_memories(
        self,
        *,
        elder_profile_id: UUID,
        type: MemoryType | None = None,
        include_sensitive: bool = False,
        q: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Memory]:
        return list(
            self.session.scalars(
                select(Memory)
                .where(*self._filters(elder_profile_id, type, include_sensitive, q))
                .options(selectinload(Memory.entities))
                .order_by(Memory.created_at.desc(), Memory.id.desc())
                .limit(limit)
                .offset(offset)
            )
        )

    def count_memories(
        self,
        *,
        elder_profile_id: UUID,
        type: MemoryType | None = None,
        include_sensitive: bool = False,
        q: str | None = None,
    ) -> int:
        return (
            self.session.scalar(
                select(func.count())
                .select_from(Memory)
                .where(*self._filters(elder_profile_id, type, include_sensitive, q))
            )
            or 0
        )

    def update_memory(
        self, memory_id: UUID, *, elder_profile_id: UUID, changes: Mapping[str, object]
    ) -> Memory | None:
        if changes.keys() - {"title", "text", "url", "is_positive", "is_sensitive"}:
            raise ValueError("Solo puedes cambiar el contenido y las marcas del recuerdo.")
        memory = self.get_memory(memory_id, elder_profile_id=elder_profile_id, for_update=True)
        if memory is None:
            return None
        if "text" in changes and changes["text"] != memory.text:
            memory.content_version += 1
            memory.entities.clear()
            memory.entities_status = EntitiesStatus.PENDING
        for name, value in changes.items():
            setattr(memory, name, value)
        self.session.flush()
        return memory

    def delete_memory(self, memory_id: UUID, *, elder_profile_id: UUID) -> bool:
        removed = self.session.scalar(
            delete(Memory)
            .where(Memory.id == memory_id, Memory.elder_profile_id == elder_profile_id)
            .returning(Memory.id)
        )
        self.session.flush()
        return removed is not None

    def _pending_memory(
        self, memory_id: UUID, elder_profile_id: UUID, content_version: int
    ) -> Memory | None:
        memory = self.get_memory(memory_id, elder_profile_id=elder_profile_id, for_update=True)
        if (
            memory is None
            or memory.type != MemoryType.ANECDOTE
            or memory.content_version != content_version
            or memory.entities_status != EntitiesStatus.PENDING
        ):
            return None
        return memory

    def retry_failed_entities(self, memory_id: UUID, *, elder_profile_id: UUID) -> Memory | None:
        memory = self.get_memory(memory_id, elder_profile_id=elder_profile_id, for_update=True)
        if (
            memory is None
            or memory.type != MemoryType.ANECDOTE
            or memory.entities_status != EntitiesStatus.FAILED
        ):
            return None
        # Fence off late results from the previous attempt, even when text is unchanged.
        memory.content_version += 1
        memory.entities.clear()
        memory.entities_status = EntitiesStatus.PENDING
        self.session.flush()
        return memory

    def replace_entities(
        self,
        memory_id: UUID,
        *,
        elder_profile_id: UUID,
        content_version: int,
        entities: Sequence[tuple[MemoryEntityKind, str]],
    ) -> bool:
        memory = self._pending_memory(memory_id, elder_profile_id, content_version)
        if memory is None:
            return False
        seen: set[tuple[MemoryEntityKind, str]] = set()
        records = []
        for kind, value in entities:
            key = (kind, value.casefold())
            if key not in seen:
                seen.add(key)
                records.append(MemoryEntity(kind=kind, text=value))
        memory.entities = records
        memory.entities_status = EntitiesStatus.COMPLETED
        self.session.flush()
        return True

    def mark_entities_failed(
        self, memory_id: UUID, *, elder_profile_id: UUID, content_version: int
    ) -> bool:
        memory = self._pending_memory(memory_id, elder_profile_id, content_version)
        if memory is None:
            return False
        memory.entities.clear()
        memory.entities_status = EntitiesStatus.FAILED
        self.session.flush()
        return True

    def lock_photo_capacity(self, profile_id: UUID) -> None:
        # One family profile shares a single capacity across all its memories.
        self.session.execute(
            select(
                func.pg_advisory_xact_lock(
                    func.hashtextextended("ayni-photos:" + str(profile_id), 0)
                )
            )
        )

    def add_photo(self, photo: MemoryPhoto) -> MemoryPhoto:
        self.session.add(photo)
        self.session.flush()
        return photo

    def list_photos(
        self,
        memory_id: UUID,
        *,
        elder_profile_id: UUID,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[MemoryPhoto]:
        query = (
            select(MemoryPhoto)
            .join(Memory)
            .where(Memory.id == memory_id, Memory.elder_profile_id == elder_profile_id)
            .order_by(MemoryPhoto.created_at.desc(), MemoryPhoto.id.desc())
            .offset(offset)
        )
        if limit is not None:
            query = query.limit(limit)
        return list(self.session.scalars(query))

    def count_photos(self, profile_id: UUID, memory_id: UUID | None = None) -> int:
        query = (
            select(func.count())
            .select_from(MemoryPhoto)
            .join(Memory)
            .where(Memory.elder_profile_id == profile_id)
        )
        if memory_id is not None:
            query = query.where(Memory.id == memory_id)
        return self.session.scalar(query) or 0

    def delete_photo(self, photo: MemoryPhoto) -> None:
        self.session.delete(photo)
        self.session.flush()

    @staticmethod
    def _session_eligible(profile_id: UUID) -> list[ColumnElement[bool]]:
        return [
            Memory.elder_profile_id == profile_id,
            Memory.is_positive.is_(True),
            Memory.is_sensitive.is_(False),
            Memory.deletion_pending.is_(False),
        ]

    def select_session_memories(self, profile_id: UUID) -> list[Memory]:
        return list(
            self.session.scalars(
                select(Memory)
                .where(*self._session_eligible(profile_id))
                .order_by(Memory.id)
                .limit(3)
                .with_for_update()
            )
        )

    def available_session_memory_ids(
        self, profile_id: UUID, memory_ids: Sequence[UUID]
    ) -> set[UUID]:
        if not memory_ids:
            return set()
        return set(
            self.session.scalars(
                select(Memory.id).where(
                    *self._session_eligible(profile_id), Memory.id.in_(memory_ids)
                )
            )
        )
