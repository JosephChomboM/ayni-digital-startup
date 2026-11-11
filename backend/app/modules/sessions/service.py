from collections.abc import Sequence
from uuid import UUID

from app.core.errors import ApplicationError
from app.modules.sessions.schemas import GuideMemory, GuideStep, SessionGuide


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
