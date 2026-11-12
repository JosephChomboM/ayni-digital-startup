from datetime import UTC
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AfterValidator, AwareDatetime, BaseModel, ConfigDict, Field


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


UTCDateTime = Annotated[AwareDatetime, AfterValidator(lambda value: value.astimezone(UTC))]


class GenerateSessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SessionListRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class SessionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    elder_profile_id: UUID
    created_by: UUID | None
    created_at: UTCDateTime
    template_version: str
    duration_minutes: int


class SessionStepResponse(BaseModel):
    position: int
    duration_minutes: int
    instruction: str
    source_memory_id: UUID | None
    memory_id: UUID | None
    memory_available: bool


class SessionDetail(SessionSummary):
    steps: list[SessionStepResponse]


class SessionListResponse(BaseModel):
    items: list[SessionSummary]
    total: int
    limit: int
    offset: int
