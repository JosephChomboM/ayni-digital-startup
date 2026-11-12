from datetime import UTC
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AfterValidator, AwareDatetime, BaseModel, ConfigDict

Reaction = Literal["receptivo", "emocionado", "indiferente", "agitado"]
UTCDateTime = Annotated[AwareDatetime, AfterValidator(lambda value: value.astimezone(UTC))]


class ReactionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reaction: Reaction


class ResponseDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    session_id: UUID
    elder_profile_id: UUID
    created_by: UUID | None
    reaction: Reaction
    occurred_at: UTCDateTime
    created_at: UTCDateTime
