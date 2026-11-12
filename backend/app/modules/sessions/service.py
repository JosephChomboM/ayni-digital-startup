from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.errors import ApplicationError
from app.modules.billing.service import BillingService
from app.modules.families.service import FamiliesService
from app.modules.memories.service import MemoriesService
from app.modules.sessions.assistant import (
    ChatRequest,
    asks_about_previous_image,
    generate_reply,
    redact_contacts,
)
from app.modules.sessions.conversation import (
    ConversationRequest,
    ConversationTurn,
    select_conversation_turn,
)
from app.modules.sessions.models import FamilySession
from app.modules.sessions.repository import SessionsRepository
from app.modules.sessions.schemas import (
    GuideMemory,
    GuideStep,
    SceneResponse,
    SessionDetail,
    SessionGuide,
    SessionListRequest,
    SessionListResponse,
    SessionMessageResponse,
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

    def _chat_context(self, actor_id: UUID, session_id: UUID) -> list[str]:
        guide = self.get_session(actor_id, session_id)
        context = []
        for step in guide.steps:
            if not step.source_memory_id:
                continue
            if not step.memory_available or not step.memory_id:
                raise ApplicationError(
                    code="conversation_context_changed",
                    status_code=409,
                    message=(
                        "Un recuerdo de esta guía dejó de estar disponible. "
                        "La conversación se oculta para respetar ese cambio."
                    ),
                )
            memory = self.memories.get_memory(actor_id, step.memory_id)
            if not memory.is_positive or memory.is_sensitive or memory.deletion_pending:
                raise ApplicationError(
                    code="conversation_context_changed",
                    status_code=409,
                    message="Ese recuerdo ya no está disponible para conversar.",
                )
            context.append((memory.title + ": " + (memory.text or "Canción familiar"))[:1800])
            if memory.type == "song":
                music = self.memories.get_song_context(actor_id, memory.id)
                if music.get("status") == "confirmed":
                    context.append(
                        "Datos de la grabación confirmada por la familia, fuente MusicBrainz: "
                        + str(music)
                    )
                else:
                    context.append(
                        "No se han confirmado artista, año ni género de esta canción. "
                        "No los inventes; ofrece consultarlos."
                    )
        return context

    def list_messages(self, actor_id: UUID, session_id: UUID) -> list[SessionMessageResponse]:
        self._chat_context(actor_id, session_id)
        with self.session.begin():
            return [
                SessionMessageResponse.model_validate(item)
                for item in self.repository.messages(session_id)
            ]

    def chat(self, actor_id: UUID, session_id: UUID, data: ChatRequest) -> SessionMessageResponse:
        context = self._chat_context(actor_id, session_id)
        if data.active_memory_id:
            # get_memory ya limita el recuerdo al perfil de la familia autenticada; además
            # puede venir de una foto fuera de la guía, siempre que sea positivo y no sensible.
            try:
                active = self.memories.get_memory(actor_id, data.active_memory_id)
            except ApplicationError:
                active = None
            if (
                active is None
                or not active.is_positive
                or active.is_sensitive
                or active.deletion_pending
            ):
                raise ApplicationError(
                    code="conversation_memory_unavailable",
                    status_code=409,
                    message="Ese recuerdo ya no está disponible para conversar.",
                )
            context.append(
                (
                    "La actividad que están viendo ahora es: "
                    + active.title
                    + (": " + active.text if active.text else "")
                )[:1800]
            )
        with self.session.begin():
            # Serializa turnos de la misma guía y evita duplicados al reintentar.
            self.repository.lock_generation(session_id)
            messages = self.repository.messages(session_id)
            record = self.session.get(FamilySession, session_id)
            if (
                data.use_scene
                and record
                and record.scene_updated_at
                and (datetime.now(UTC) - record.scene_updated_at).total_seconds() < 45
            ):
                context.append(
                    "Observación visual reciente (puede ser imprecisa, no identifica personas): "
                    + str(record.scene_context or {})
                )
            previous = next(
                (
                    item
                    for item in messages
                    if item.request_id == data.request_id and item.role == "assistant"
                ),
                None,
            )
            if previous:
                return SessionMessageResponse.model_validate(previous)
            if len(messages) >= 80:
                raise ApplicationError(
                    code="conversation_turn_limit",
                    status_code=409,
                    message=(
                        "Ya compartieron una conversación larga. "
                        "Pueden descansar o volver a sus recuerdos."
                    ),
                )
            # A past image is relevant only when asked about explicitly.
            past_image_requested = asks_about_previous_image(data.text)
            visual_turn_ids = {
                item.request_id
                for item in messages
                if item.observations
                or (item.role == "user" and asks_about_previous_image(item.text))
            }
            history = []
            for item in messages:
                if item.request_id in visual_turn_ids and not past_image_requested:
                    continue
                content = item.text
                if item.observations:
                    content += "\nDetalles observados en una captura anterior: " + str(
                        item.observations
                    )
                history.append({"role": item.role, "content": content})
            prompt = (data.previous_prompt or "").strip()
            if prompt and (not history or history[-1]["content"] != prompt):
                # Ayni dijo esto en pantalla (cambio de actividad, pausa) sin pasar por el servidor.
                history.append({"role": "assistant", "content": prompt})
            reply = generate_reply(data, context=context, history=history)
            position = len(messages)
            text = redact_contacts(data.text.strip())
            if text:
                self.repository.add_message(
                    session_id, data.request_id, position=position, role="user", text=text
                )
                position += 1
            record = self.repository.add_message(
                session_id,
                data.request_id,
                position=position,
                role="assistant",
                text=reply.message,
                suggestion=reply.suggestion,
                observations=reply.observations,
            )
            response = SessionMessageResponse.model_validate(record)
            response.action = reply.action
            return response

    def observe_scene(self, actor_id: UUID, session_id: UUID, data: ChatRequest) -> SceneResponse:
        guide = self.get_session(actor_id, session_id)
        if not data.image or not data.image_consent:
            raise ApplicationError(
                code="conversation_image_consent_required",
                status_code=422,
                message="Activa el contexto visual para compartir capturas periódicas con Groq.",
            )
        with self.session.begin():
            self.repository.lock_generation(session_id)
            record = self.repository.get_session(
                session_id, elder_profile_id=guide.elder_profile_id
            )
            if record is None:
                raise ApplicationError(
                    code="session_not_found", status_code=404, message="No encontramos esta guía."
                )
            now = datetime.now(UTC)
            if record.scene_updated_at and (now - record.scene_updated_at).total_seconds() < 15:
                return SceneResponse(
                    observations=(record.scene_context or {}).get("observations", []),
                    updated_at=record.scene_updated_at,
                    cached=True,
                )
            reply = generate_reply(
                data.model_copy(
                    update={
                        "cue": None,
                        "text": (
                            "Describe objetos, colores y entorno visibles de la captura. "
                            "No identifiques ni infieras emociones."
                        ),
                    }
                ),
                context=[],
                history=[],
            )
            record.scene_context = {"observations": reply.observations}
            record.scene_updated_at = now
            return SceneResponse(observations=reply.observations, updated_at=now)

    def clear_scene(self, actor_id: UUID, session_id: UUID) -> None:
        guide = self.get_session(actor_id, session_id)
        with self.session.begin():
            self.repository.lock_generation(session_id)
            record = self.repository.get_session(
                session_id, elder_profile_id=guide.elder_profile_id
            )
            if record:
                record.scene_context = None
                record.scene_updated_at = None

    def converse_about_memory(
        self, actor_id: UUID, memory_id: UUID, data: ConversationRequest
    ) -> ConversationTurn:
        memory = self.memories.get_memory(actor_id, memory_id)
        if (
            memory.type != "anecdote"
            or not memory.text
            or not memory.is_positive
            or memory.is_sensitive
            or memory.deletion_pending
        ):
            raise ApplicationError(
                code="conversation_memory_unavailable",
                status_code=409,
                message="Elige una anécdota marcada como bonita y que no sea un tema delicado.",
            )
        return select_conversation_turn(memory.text, data)

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

    def generate_session(self, actor_id: UUID, memory_id: UUID | None = None) -> SessionDetail:
        if memory_id:
            chosen = self.memories.get_memory(actor_id, memory_id)
            if not chosen.is_positive or chosen.is_sensitive or chosen.deletion_pending:
                raise ApplicationError(
                    code="no_eligible_memories",
                    status_code=409,
                    message="Elige un recuerdo positivo que no esté marcado como delicado.",
                )
        profile_id = self._profile(actor_id)
        policy = BillingService(self.session).get_session_quota(actor_id)
        with self.session.begin():
            self.repository.lock_generation(profile_id)
            now = datetime.now(UTC)
            policy.require_capacity(
                self.repository.count_since(profile_id, now - timedelta(days=policy.window_days))
            )
            candidates = self.memories.select_session_memories(profile_id, memory_id)
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
