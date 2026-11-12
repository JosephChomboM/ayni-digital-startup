from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.billing.service import BillingService
from app.modules.families.service import FamiliesService
from app.modules.memories.service import MemoriesService
from app.modules.sessions.models import FamilySession
from app.modules.sessions.repository import SessionsRepository
from app.modules.sessions.schemas import (
    GuideMemory,
    GuideStep,
    SessionDetail,
    SessionGuide,
    SessionListRequest,
    SessionListResponse,
    SessionStepResponse,
    SessionSummary,
)


def build_session_guide(elder_profile_id: UUID, memories: Sequence[GuideMemory]) -> SessionGuide:
    """Build a deterministic guide; no I/O, persistence, quotas or HTTP authorization.

    The future application service must derive the profile from families.service
    and obtain candidates through memories.service, never accept them from HTTP.
    """
    allowed = {
        memory.id: memory
        for memory in memories
        if memory.elder_profile_id == elder_profile_id
        and memory.is_positive
        and not memory.is_sensitive
        and not memory.deletion_pending
    }
    selected = [allowed[key] for key in sorted(allowed, key=str)[:3]]
    if not selected:
        raise ApplicationError(
            code="no_eligible_memories",
            message=(
                "Primero comparte un recuerdo bonito y sin marcar como tema delicado "
                "para preparar una guía familiar."
            ),
            status_code=409,
        )
    steps = [
        GuideStep(
            position=1,
            duration_minutes=2,
            instruction=(
                "Busca un lugar tranquilo y pregunta si le gustaría compartir "
                "un momento en familia. Pueden parar cuando quieran."
            ),
        )
    ]
    minutes, remainder = divmod(10, len(selected))
    for index, memory in enumerate(selected):
        instruction = (
            "Lean la anécdota juntos. Pregunta si le gustaría contar algo más. "
            "Escucha sin exigir respuestas ni corregir lo que cuenta."
            if memory.type == "anecdote"
            else "Escuchen la canción si le apetece. Pueden cantar o conversar "
            "sobre lo que les gusta. No es necesario recordar nombres ni fechas."
        )
        steps.append(
            GuideStep(
                position=index + 2,
                duration_minutes=minutes + (index < remainder),
                instruction=instruction,
                memory_id=memory.id,
            )
        )
    steps.append(
        GuideStep(
            position=len(steps) + 1,
            duration_minutes=3,
            instruction=(
                "Agradece el momento compartido y pregunta si desea descansar. "
                "No hace falta terminar todos los pasos ni responder preguntas."
            ),
        )
    )
    return SessionGuide(memory_ids=tuple(memory.id for memory in selected), steps=tuple(steps))


class SessionsService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repository = SessionsRepository(session)
        self.families = FamiliesService(session)
        self.memories = MemoriesService(session)

    def _profile(self, actor_id: UUID) -> UUID:
        return self.families.get_elder_profile(actor_id).id

    def _detail(self, record: FamilySession) -> SessionDetail:
        available = self.memories.available_session_memory_ids(
            record.elder_profile_id, [item.memory_id for item in record.items if item.memory_id]
        )
        summary = SessionSummary.model_validate(record)
        return SessionDetail(
            **summary.model_dump(),
            steps=[
                SessionStepResponse(
                    position=item.position,
                    duration_minutes=item.duration_minutes,
                    instruction=item.instruction,
                    source_memory_id=item.source_memory_id,
                    memory_id=item.memory_id if item.memory_id in available else None,
                    memory_available=item.memory_id in available,
                )
                for item in record.items
            ],
        )

    def generate_session(self, actor_id: UUID) -> SessionDetail:
        profile_id = self._profile(actor_id)
        policy = BillingService(self.session).get_session_quota(actor_id)
        with self.session.begin():
            self.repository.lock_generation(profile_id)
            now = datetime.now(UTC)
            policy.require_capacity(
                self.repository.count_since(profile_id, now - timedelta(days=policy.window_days))
            )
            candidates = self.memories.select_session_memories(profile_id)
            guide = build_session_guide(
                profile_id,
                [
                    GuideMemory(
                        id=memory.id,
                        elder_profile_id=memory.elder_profile_id,
                        type=memory.type,
                        title=memory.title,
                        is_positive=memory.is_positive,
                        is_sensitive=memory.is_sensitive,
                        deletion_pending=memory.deletion_pending,
                    )
                    for memory in candidates
                ],
            )
            record = self.repository.create_session(
                elder_profile_id=profile_id, created_by=actor_id, guide=guide
            )
            return self._detail(record)

    def list_sessions(
        self, actor_id: UUID, query: SessionListRequest | None = None
    ) -> SessionListResponse:
        profile_id = self._profile(actor_id)
        query = query or SessionListRequest()
        with self.session.begin():
            return SessionListResponse(
                items=[
                    SessionSummary.model_validate(record)
                    for record in self.repository.list_sessions(
                        elder_profile_id=profile_id, limit=query.limit, offset=query.offset
                    )
                ],
                total=self.repository.count_sessions(elder_profile_id=profile_id),
                limit=query.limit,
                offset=query.offset,
            )

    def get_session(self, actor_id: UUID, session_id: UUID) -> SessionDetail:
        profile_id = self._profile(actor_id)
        with self.session.begin():
            record = self.repository.get_session(session_id, elder_profile_id=profile_id)
            if record is None:
                raise ApplicationError(
                    code="session_not_found",
                    status_code=404,
                    message="No encontramos esta guía familiar.",
                )
            return self._detail(record)
