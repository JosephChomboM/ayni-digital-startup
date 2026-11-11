from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class GuideMemory(BaseModel):
    """Internal candidate from the memories public service, never client ownership data."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    id: UUID
    elder_profile_id: UUID
    type: Literal["anecdote", "song"]
    title: str = Field(min_length=1, max_length=100)
    is_positive: bool
    is_sensitive: bool
    deletion_pending: bool = False


class GuideStep(BaseModel):
    model_config = ConfigDict(frozen=True)

    position: int = Field(ge=1)
    duration_minutes: int = Field(ge=1)
    instruction: str
    memory_id: UUID | None = None


class SessionGuide(BaseModel):
    model_config = ConfigDict(frozen=True)

    template_version: str = "1.0"
    duration_minutes: int = 15
    memory_ids: tuple[UUID, ...]
    steps: tuple[GuideStep, ...]
