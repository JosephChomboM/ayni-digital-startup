from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

DISCLAIMER = "Esto no es un diagnóstico. Es un registro de actividades familiares."


class Reaction(StrEnum):
    RECEPTIVE = "receptivo"
    EXCITED = "emocionado"
    INDIFFERENT = "indiferente"
    AGITATED = "agitado"


NegativeReaction = Literal["agitado", "indiferente"]


class PauseInput(BaseModel):
    reactions: tuple[Reaction, ...]
    # Validated classification supplied by the service; never inferred from input text.
    negative_reactions: frozenset[NegativeReaction] = Field(min_length=1)


class PauseReason(StrEnum):
    AGITATED_STREAK = "agitated_streak"
    NEGATIVE_RATIO = "negative_ratio"


class PauseAlert(BaseModel):
    model_config = ConfigDict(frozen=True)

    should_pause: bool
    reasons: tuple[PauseReason, ...]
    consecutive_agitated: int
    window_size: int
    window_complete: bool
    negative_count: int
    message: str | None
    disclaimer: str = DISCLAIMER
