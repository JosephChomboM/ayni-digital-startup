from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.modules.responses.models import SessionResponse


class ResponsesRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_response(self, session_id: UUID, profile_id: UUID) -> SessionResponse | None:
        return self.session.scalar(
            select(SessionResponse).where(
                SessionResponse.session_id == session_id,
                SessionResponse.elder_profile_id == profile_id,
            )
        )

    def record_response(
        self,
        *,
        session_id: UUID,
        profile_id: UUID,
        actor_id: UUID,
        reaction: str,
        occurred_at: datetime,
    ) -> tuple[SessionResponse, bool]:
        statement = (
            insert(SessionResponse)
            .values(
                session_id=session_id,
                elder_profile_id=profile_id,
                created_by=actor_id,
                reaction=reaction,
                occurred_at=occurred_at,
            )
            .on_conflict_do_nothing(constraint="uq_session_responses_session")
            .returning(SessionResponse)
        )
        created = self.session.scalar(statement)
        if created is not None:
            return created, True
        existing = self.get_response(session_id, profile_id)
        if existing is None:
            raise RuntimeError("No se pudo recuperar el registro de la sesión.")
        return existing, False

    def history(self, profile_id: UUID) -> list[SessionResponse]:
        return list(
            self.session.scalars(
                select(SessionResponse)
                .where(SessionResponse.elder_profile_id == profile_id)
                .order_by(SessionResponse.occurred_at, SessionResponse.session_id)
            )
        )
