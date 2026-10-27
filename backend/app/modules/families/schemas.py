from datetime import UTC, datetime
from enum import StrEnum
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    EmailStr,
    Field,
    SecretStr,
    StrictBool,
    StringConstraints,
    field_validator,
    model_validator,
)
from pydantic_core import PydanticCustomError

from app.modules.families.models import UserRole


def _normalize_email(value: object) -> object:
    return value.strip().lower() if isinstance(value, str) else value


def _to_utc(value: datetime) -> datetime:
    return value.astimezone(UTC)


type NormalizedEmail = Annotated[EmailStr, BeforeValidator(_normalize_email), Field(max_length=254)]
type ShortText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]
type UTCDateTime = Annotated[AwareDatetime, AfterValidator(_to_utc)]


class RequestSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class ResponseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ConsentAcceptance(RequestSchema):
    accepted: StrictBool
    text_version: str = Field(min_length=1, max_length=20)

    @field_validator("accepted")
    @classmethod
    def require_acceptance(cls, value: bool) -> bool:
        if not value:
            raise PydanticCustomError(
                "consent_required", "Acepta el consentimiento para continuar."
            )
        return value


class RegisterRequest(RequestSchema):
    email: NormalizedEmail
    name: ShortText
    password: SecretStr = Field(min_length=10, repr=False)
    consent: ConsentAcceptance
    family_name: ShortText | None = None
    invitation_token: SecretStr | None = Field(default=None, min_length=1, repr=False)

    @model_validator(mode="after")
    def require_one_registration_mode(self) -> Self:
        if (self.family_name is None) == (self.invitation_token is None):
            raise PydanticCustomError(
                "validation_error", "Indica el nombre de tu familia o usa una invitación."
            )
        return self


class LoginRequest(RequestSchema):
    email: NormalizedEmail
    password: SecretStr = Field(min_length=10, repr=False)


class ElderProfileRequest(RequestSchema):
    name: ShortText
    birth_decade: int = Field(strict=True, ge=0)
    interests: list[ShortText] = Field(max_length=20)

    @field_validator("birth_decade")
    @classmethod
    def require_valid_decade(cls, value: int) -> int:
        if value % 10 != 0 or value > datetime.now(UTC).year:
            raise PydanticCustomError(
                "validation_error", "Elige una década válida que no esté en el futuro."
            )
        return value


class InvitationCreateRequest(RequestSchema):
    email: NormalizedEmail


class ConsentTextResponse(ResponseSchema):
    text_version: str
    text: str
    onboarding_notice: str


class ConsentResponse(ResponseSchema):
    text_version: str
    accepted_at: UTCDateTime


class UserResponse(ResponseSchema):
    id: UUID
    email: NormalizedEmail
    name: str
    family_id: UUID
    role: UserRole
    created_at: UTCDateTime


class FamilyResponse(ResponseSchema):
    id: UUID
    name: str
    created_at: UTCDateTime


class MemberResponse(ResponseSchema):
    id: UUID
    name: str
    role: UserRole


class MemberListResponse(ResponseSchema):
    items: list[MemberResponse]


class ElderProfileResponse(ResponseSchema):
    id: UUID
    family_id: UUID
    name: str
    birth_decade: int
    interests: list[str]
    created_at: UTCDateTime
    updated_at: UTCDateTime


class InvitationStatus(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REVOKED = "revoked"
    EXPIRED = "expired"


class InvitationResponse(ResponseSchema):
    id: UUID
    email: NormalizedEmail
    role: Literal["familiar"]
    status: InvitationStatus
    created_at: UTCDateTime
    expires_at: UTCDateTime
    accepted_at: UTCDateTime | None
    revoked_at: UTCDateTime | None


class InvitationCreatedResponse(ResponseSchema):
    invitation: InvitationResponse
    invitation_token: str = Field(repr=False)


class InvitationListResponse(ResponseSchema):
    items: list[InvitationResponse]


class RegisterResponse(ResponseSchema):
    user: UserResponse
    family: FamilyResponse
    consent: ConsentResponse


class CurrentUserResponse(ResponseSchema):
    user: UserResponse
    consent: ConsentResponse


class AuthenticationResponse(ResponseSchema):
    access_token: str = Field(repr=False)
    token_type: Literal["bearer"] = Field(default="bearer")
    expires_in: int = Field(gt=0)
    user: UserResponse
