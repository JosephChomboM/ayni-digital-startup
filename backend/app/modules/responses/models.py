from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class SessionResponse(Base):
    __tablename__ = "session_responses"
    __table_args__ = (
        UniqueConstraint("session_id", name="uq_session_responses_session"),
        CheckConstraint(
            "reaction IN ('receptivo', 'emocionado', 'indiferente', 'agitado')",
            name="ck_session_responses_reaction",
        ),
        Index(
            "ix_responses_profile_occurred_session", "elder_profile_id", "occurred_at", "session_id"
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    session_id: Mapped[UUID] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    elder_profile_id: Mapped[UUID] = mapped_column(
        ForeignKey("elder_profiles.id", ondelete="CASCADE")
    )
    created_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reaction: Mapped[str] = mapped_column(String(20))
    # Session chronology, supplied by sessions.service rather than by the browser.
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
