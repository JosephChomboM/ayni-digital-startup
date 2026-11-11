from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class FamilySession(Base):
    __tablename__ = "sessions"
    __table_args__ = (
        CheckConstraint("duration_minutes BETWEEN 15 AND 20", name="ck_sessions_duration"),
        CheckConstraint("btrim(template_version) <> ''", name="ck_sessions_template_version"),
        Index("ix_sessions_profile_created_id", "elder_profile_id", "created_at", "id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    elder_profile_id: Mapped[UUID] = mapped_column(
        ForeignKey("elder_profiles.id", ondelete="CASCADE")
    )
    created_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    template_version: Mapped[str] = mapped_column(String(30))
    duration_minutes: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    items: Mapped[list["SessionItem"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by=lambda: SessionItem.position,
    )


class SessionItem(Base):
    __tablename__ = "session_items"
    __table_args__ = (
        UniqueConstraint("session_id", "position", name="uq_session_items_position"),
        CheckConstraint("position >= 1", name="ck_session_items_position"),
        CheckConstraint("duration_minutes >= 1", name="ck_session_items_duration"),
        CheckConstraint("btrim(instruction) <> ''", name="ck_session_items_instruction"),
        CheckConstraint(
            "memory_id IS NULL OR (source_memory_id IS NOT NULL AND memory_id = source_memory_id)",
            name="ck_session_items_memory_reference",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer)
    duration_minutes: Mapped[int] = mapped_column(Integer)
    instruction: Mapped[str] = mapped_column(Text)
    # Retain original provenance even after the live memory link is cleared.
    source_memory_id: Mapped[UUID | None]
    memory_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("memories.id", ondelete="SET NULL"), index=True
    )
    session: Mapped[FamilySession] = relationship(back_populates="items")
