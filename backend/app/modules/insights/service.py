from collections.abc import Sequence, Set
from decimal import Decimal

from app.core.config import Settings, get_settings
from app.modules.insights.schemas import (
    NegativeReaction,
    PauseAlert,
    PauseInput,
    PauseReason,
    Reaction,
)

__all__ = ["NegativeReaction", "PauseAlert", "PauseReason", "Reaction", "evaluate_pause_alert"]

DEFAULT_NEGATIVE_REACTIONS: frozenset[NegativeReaction] = frozenset({"agitado"})

PAUSE_MESSAGE = (
    "Te sugerimos pausar las actividades y consultar con un profesional de salud "
    "antes de continuar."
)


def evaluate_pause_alert(
    reactions: Sequence[Reaction | str],
    *,
    negative_reactions: Set[NegativeReaction] = DEFAULT_NEGATIVE_REACTIONS,
    settings: Settings | None = None,
) -> PauseAlert:
    """Evaluate one elder's history, oldest first. No database access or side effects.

    The ratio rule requires a full window. The streak rule applies immediately.
    Only agitation counts as negative by default (pending adviser validation).
    """
    history = PauseInput(reactions=tuple(reactions), negative_reactions=negative_reactions)
    config = settings if settings is not None else get_settings()

    streak = 0
    for reaction in reversed(history.reactions):
        if reaction != Reaction.AGITATED:
            break
        streak += 1

    window = history.reactions[-config.pause_negative_window :]
    complete = len(window) == config.pause_negative_window
    negative_count = sum(reaction in history.negative_reactions for reaction in window)
    reasons: list[PauseReason] = []
    if streak >= config.pause_agitated_streak:
        reasons.append(PauseReason.AGITATED_STREAK)
    if complete and Decimal(negative_count) >= config.pause_negative_ratio * len(window):
        reasons.append(PauseReason.NEGATIVE_RATIO)

    return PauseAlert(
        should_pause=bool(reasons),
        reasons=tuple(reasons),
        consecutive_agitated=streak,
        window_size=len(window),
        window_complete=complete,
        negative_count=negative_count,
        message=PAUSE_MESSAGE if reasons else None,
    )
