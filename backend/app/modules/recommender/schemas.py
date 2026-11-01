from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class MemoryCandidate(BaseModel):
    model_config = ConfigDict(frozen=True)

    memory_id: str = Field(min_length=1)
    kind: Literal["photo", "anecdote", "song"]
    is_positive: bool
    is_sensitive: bool
    tags: tuple[str, ...] = ()


class SessionFeedback(BaseModel):
    model_config = ConfigDict(frozen=True)

    # One record per completed session, not one copy per item in that session.
    memory_ids: tuple[str, ...] = Field(min_length=1)
    reaction: Literal["receptivo", "emocionado", "indiferente", "agitado"]
