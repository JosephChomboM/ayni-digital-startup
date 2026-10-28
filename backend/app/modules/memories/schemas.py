import re
from datetime import UTC
from typing import Annotated, Literal, Self
from urllib.parse import parse_qs, urlsplit
from uuid import UUID

from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StringConstraints,
    model_validator,
)
from pydantic_core import PydanticCustomError

from app.modules.memories.models import EntitiesStatus, MemoryEntityKind, MemoryType


def _normalize_song_url(value: str) -> str:
    try:
        parsed = urlsplit(value)
        if (
            parsed.scheme != "https"
            or parsed.username is not None
            or parsed.password is not None
            or parsed.port not in (None, 443)
            or any(char.isspace() for char in value)
        ):
            raise ValueError
        host = parsed.hostname
        video_id = None
        if host == "youtu.be":
            video_id = parsed.path.strip("/")
        elif host in {"youtube.com", "www.youtube.com", "m.youtube.com"}:
            if parsed.path == "/watch":
                values = parse_qs(parsed.query).get("v", [])
                video_id = values[0] if len(values) == 1 else None
            else:
                match = re.fullmatch(r"/(?:shorts|embed|live)/([\w-]{11})/?", parsed.path)
                video_id = match[1] if match else None
        if video_id and re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
            return f"https://www.youtube.com/watch?v={video_id}"
        if host == "open.spotify.com":
            match = re.fullmatch(
                r"/(?:intl-[a-z]{2}/|embed/)?track/([A-Za-z0-9]{22})/?", parsed.path
            )
            if match:
                return f"https://open.spotify.com/track/{match[1]}"
    except ValueError:
        pass
    raise PydanticCustomError(
        "song_url_invalid", "Pega un enlace de video de YouTube o de una canción de Spotify."
    )


type ShortText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]
type AnecdoteText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)
]
type SongURL = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=2048),
    AfterValidator(_normalize_song_url),
]
type UTCDateTime = Annotated[AwareDatetime, AfterValidator(lambda value: value.astimezone(UTC))]


class RequestSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class MemoryCreateBase(RequestSchema):
    title: ShortText
    is_positive: StrictBool = False
    is_sensitive: StrictBool = False


class AnecdoteCreateRequest(MemoryCreateBase):
    type: Literal["anecdote"]
    text: AnecdoteText = Field(repr=False)


class SongCreateRequest(MemoryCreateBase):
    type: Literal["song"]
    url: SongURL


type MemoryCreateRequest = Annotated[
    AnecdoteCreateRequest | SongCreateRequest, Field(discriminator="type")
]


class MemoryPatchRequest(RequestSchema):
    title: ShortText | None = None
    text: AnecdoteText | None = Field(default=None, repr=False)
    url: SongURL | None = None
    is_positive: StrictBool | None = None
    is_sensitive: StrictBool | None = None

    @model_validator(mode="after")
    def require_valid_changes(self) -> Self:
        if (
            not self.model_fields_set
            or any(getattr(self, name) is None for name in self.model_fields_set)
            or {"text", "url"}.issubset(self.model_fields_set)
        ):
            raise PydanticCustomError(
                "validation_error", "Envía los campos que quieres cambiar, sin valores vacíos."
            )
        return self


class MemoryListRequest(RequestSchema):
    type: MemoryType | None = None
    include_sensitive: bool = False
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class ResponseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class MemoryEntityResponse(ResponseSchema):
    kind: MemoryEntityKind
    text: str = Field(repr=False)


class MemoryResponse(ResponseSchema):
    id: UUID
    elder_profile_id: UUID
    created_by: UUID
    type: MemoryType
    title: str
    text: str | None = Field(repr=False)
    url: str | None
    is_positive: bool
    is_sensitive: bool
    entities: list[MemoryEntityResponse]
    entities_status: EntitiesStatus
    created_at: UTCDateTime
    updated_at: UTCDateTime


class MemoryListResponse(ResponseSchema):
    items: list[MemoryResponse]
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)
