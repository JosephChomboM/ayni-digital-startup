from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy import text as sql_text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class MemoryType(StrEnum):
    ANECDOTE = "anecdote"
    SONG = "song"


class EntitiesStatus(StrEnum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    NOT_APPLICABLE = "not_applicable"


class MemoryEntityKind(StrEnum):
    PERSON = "person"
    PLACE = "place"
    PERIOD = "period"
    ACTIVITY = "activity"


class Memory(Base):
    __tablename__ = "memories"
    __table_args__ = (
        CheckConstraint("btrim(title) <> ''", name="ck_memories_title_not_blank"),
        CheckConstraint("content_version >= 1", name="ck_memories_content_version"),
        CheckConstraint(
            "(type = 'anecdote' AND text IS NOT NULL AND btrim(text) <> '' "
            "AND length(text) <= 5000 AND url IS NULL AND entities_status <> 'not_applicable') "
            "OR (type = 'song' AND text IS NULL AND url IS NOT NULL AND btrim(url) <> '' "
            "AND left(url, 8) = 'https://' AND entities_status = 'not_applicable')",
            name="ck_memories_content_for_type",
        ),
        Index("ix_memories_profile_created_id", "elder_profile_id", "created_at", "id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    elder_profile_id: Mapped[UUID] = mapped_column(
        ForeignKey("elder_profiles.id", ondelete="CASCADE")
    )
    created_by: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[MemoryType] = mapped_column(
        SQLAlchemyEnum(
            MemoryType,
            values_callable=lambda values: [value.value for value in values],
            native_enum=False,
            create_constraint=True,
            name="memory_type",
        )
    )
    title: Mapped[str] = mapped_column(String(100))
    text: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(String(2048))
    is_positive: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=sql_text("false")
    )
    is_sensitive: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=sql_text("false")
    )
    entities_status: Mapped[EntitiesStatus] = mapped_column(
        SQLAlchemyEnum(
            EntitiesStatus,
            values_callable=lambda values: [value.value for value in values],
            native_enum=False,
            create_constraint=True,
            name="memory_entities_status",
        ),
        default=EntitiesStatus.PENDING,
        server_default=sql_text("'pending'"),
    )
    content_version: Mapped[int] = mapped_column(Integer, default=1, server_default=sql_text("1"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    entities: Mapped[list["MemoryEntity"]] = relationship(
        back_populates="memory",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by=lambda: (MemoryEntity.kind, MemoryEntity.text),
    )


class MemoryEntity(Base):
    __tablename__ = "memory_entities"
    __table_args__ = (
        CheckConstraint(
            "btrim(text) <> '' AND length(text) <= 5000", name="ck_memory_entities_text"
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    memory_id: Mapped[UUID] = mapped_column(
        ForeignKey("memories.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[MemoryEntityKind] = mapped_column(
        SQLAlchemyEnum(
            MemoryEntityKind,
            values_callable=lambda values: [value.value for value in values],
            native_enum=False,
            create_constraint=True,
            name="memory_entity_kind",
        )
    )
    text: Mapped[str] = mapped_column(Text)
    memory: Mapped[Memory] = relationship(back_populates="entities")
