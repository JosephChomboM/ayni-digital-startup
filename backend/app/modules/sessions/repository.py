from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.modules.sessions.models import FamilySession, SessionItem
from app.modules.sessions.schemas import SessionGuide


class SessionsRepository:
    """Profile-scoped persistence; application service owns authorization and commits."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def create_session(
        self, *, elder_profile_id: UUID, created_by: UUID, guide: SessionGuide
    ) -> FamilySession:
        if sum(step.duration_minutes for step in guide.steps) != guide.duration_minutes:
            raise ValueError("La duración de los pasos debe coincidir con la guía.")
        if tuple(step.memory_id for step in guide.steps if step.memory_id) != guide.memory_ids:
            raise ValueError("Los recuerdos deben coincidir con los pasos de la guía.")
        record = FamilySession(
            elder_profile_id=elder_profile_id,
            created_by=created_by,
            template_version=guide.template_version,
            duration_minutes=guide.duration_minutes,
            items=[
                SessionItem(
                    position=step.position,
                    duration_minutes=step.duration_minutes,
                    instruction=step.instruction,
                    source_memory_id=step.memory_id,
                    memory_id=step.memory_id,
                )
                for step in guide.steps
            ],
        )
        self.session.add(record)
        self.session.flush()
        return record

    def get_session(self, session_id: UUID, *, elder_profile_id: UUID) -> FamilySession | None:
        return self.session.scalar(
            select(FamilySession)
            .where(
                FamilySession.id == session_id, FamilySession.elder_profile_id == elder_profile_id
            )
            .options(selectinload(FamilySession.items))
        )

    def list_sessions(
        self, *, elder_profile_id: UUID, limit: int = 20, offset: int = 0
    ) -> list[FamilySession]:
        if not 1 <= limit <= 100 or offset < 0:
            raise ValueError("La paginación no es válida.")
        return list(
            self.session.scalars(
                select(FamilySession)
                .where(FamilySession.elder_profile_id == elder_profile_id)
                .options(selectinload(FamilySession.items))
                .order_by(FamilySession.created_at.desc(), FamilySession.id.desc())
                .limit(limit)
                .offset(offset)
            )
        )

    def count_sessions(self, *, elder_profile_id: UUID) -> int:
        return (
            self.session.scalar(
                select(func.count())
                .select_from(FamilySession)
                .where(FamilySession.elder_profile_id == elder_profile_id)
            )
            or 0
        )
