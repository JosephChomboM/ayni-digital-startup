from datetime import UTC
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AfterValidator, AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from app.modules.sessions.assistant import Action


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
    memory_id: UUID | None = None
    selection_mode: Literal["auto", "selected", "all"] = "auto"
    memory_ids: list[UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_selection(self) -> "GenerateSessionRequest":
        if self.memory_id is not None:
            if self.selection_mode != "auto" or self.memory_ids:
                raise ValueError("Elige una sola forma de seleccionar los recuerdos.")
        elif self.selection_mode == "selected":
            if not self.memory_ids or len(set(self.memory_ids)) != len(self.memory_ids):
                raise ValueError("Elige al menos un recuerdo, sin repetirlo.")
        elif self.memory_ids:
            raise ValueError("Los recuerdos elegidos requieren el modo selected.")
        return self


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


class SessionMemoryResponse(BaseModel):
    source_memory_id: UUID
    memory_id: UUID | None
    memory_available: bool


class SessionDetail(SessionSummary):
    steps: list[SessionStepResponse]
    selection_mode: Literal["auto", "selected", "all"] = "auto"
    selected_memories: list[SessionMemoryResponse] = Field(default_factory=list)


class SessionListResponse(BaseModel):
    items: list[SessionSummary]
    total: int
    limit: int
    offset: int


class SessionMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: Literal["user", "assistant"]
    text: str
    suggestion: Literal["continue", "slow_down", "pause", "change_activity"]
    observations: list[str]
    created_at: UTCDateTime
    # Acción que Ayni pide hacer en pantalla en este turno; no se guarda en el historial.
    action: Action = "none"


class SceneResponse(BaseModel):
    observations: list[str]
    updated_at: UTCDateTime
    cached: bool = False
