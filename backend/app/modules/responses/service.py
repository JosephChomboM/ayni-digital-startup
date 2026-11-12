from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.families.service import FamiliesService
from app.modules.responses.repository import ResponsesRepository
from app.modules.responses.schemas import Reaction, ReactionRequest, ResponseDetail
from app.modules.sessions.service import SessionsService


@dataclass(frozen=True)
class ResponseHistoryRecord:
    session_id: UUID
    elder_profile_id: UUID
    occurred_at: datetime
    reaction: Reaction


class ResponsesService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = ResponsesRepository(session)

    def record_response(
        self,
        actor_id: UUID,
        session_id: UUID,
        request: ReactionRequest,
    ) -> tuple[ResponseDetail, bool]:
        guide = SessionsService(self.session).get_session(actor_id, session_id)
        with self.session.begin():
            record, created = self.repository.record_response(
                session_id=guide.id,
                profile_id=guide.elder_profile_id,
                actor_id=actor_id,
                reaction=request.reaction,
                occurred_at=guide.created_at,
            )
            if record.reaction != request.reaction:
                raise ApplicationError(
                    code="response_already_recorded",
                    status_code=409,
                    message="Esta guía ya tiene una reacción registrada. Puedes consultarla.",
                )
            return ResponseDetail.model_validate(record), created

    def get_response(self, actor_id: UUID, session_id: UUID) -> ResponseDetail:
        guide = SessionsService(self.session).get_session(actor_id, session_id)
        with self.session.begin():
            record = self.repository.get_response(guide.id, guide.elder_profile_id)
            if record is None:
                raise ApplicationError(
                    code="response_not_found",
                    status_code=404,
                    message="Esta guía todavía no tiene una reacción registrada.",
                )
            return ResponseDetail.model_validate(record)

    def get_history(self, actor_id: UUID) -> list[ResponseHistoryRecord]:
        profile = FamiliesService(self.session).get_elder_profile(actor_id)
        with self.session.begin():
            return [
                ResponseHistoryRecord(
                    session_id=record.session_id,
                    elder_profile_id=record.elder_profile_id,
                    occurred_at=ResponseDetail.model_validate(record).occurred_at,
                    reaction=ResponseDetail.model_validate(record).reaction,
                )
                for record in self.repository.history(profile.id)
            ]
