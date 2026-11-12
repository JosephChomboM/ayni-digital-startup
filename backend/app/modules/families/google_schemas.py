from typing import Annotated, Self
from uuid import UUID

from pydantic import BaseModel, Field, SecretStr, StringConstraints, model_validator
from pydantic_core import PydanticCustomError

from app.modules.families.schemas import ConsentAcceptance, RequestSchema, ShortText, UTCDateTime


class GoogleConfigResponse(BaseModel):
    enabled: bool
    client_id: str | None


class GoogleChallengeResponse(BaseModel):
    challenge_id: UUID
    nonce: str
    expires_at: UTCDateTime


class GoogleCredentialRequest(RequestSchema):
    credential: SecretStr = Field(min_length=1, max_length=16384, repr=False)
    challenge_id: UUID


class GoogleRegisterRequest(GoogleCredentialRequest):
    name: ShortText
    password: SecretStr = Field(min_length=10, repr=False)
    consent: ConsentAcceptance
    family_name: ShortText | None = None
    invitation_token: SecretStr | None = Field(default=None, min_length=1, repr=False)

    @model_validator(mode="after")
    def validate_registration_mode(self) -> Self:
        if (self.family_name is None) == (self.invitation_token is None):
            raise PydanticCustomError("validation_error", "Indica tu familia o usa una invitación.")
        if (
            self.family_name is not None
            and self.family_name == self.password.get_secret_value().strip()
        ):
            raise PydanticCustomError(
                "validation_error", "Elige un nombre de familia distinto de tu contraseña."
            )
        return self


class GoogleLinkRequest(GoogleCredentialRequest):
    password: SecretStr = Field(min_length=10, repr=False)


class UserProfilePatchRequest(RequestSchema):
    name: ShortText | None = None
    phone: (
        Annotated[
            str, StringConstraints(strip_whitespace=True, pattern=r"^\+?[0-9][0-9 ()-]{5,29}$")
        ]
        | None
    ) = None
    city: ShortText | None = None
    district: ShortText | None = None
