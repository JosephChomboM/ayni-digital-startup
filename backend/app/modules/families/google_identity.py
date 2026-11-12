from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import requests
from google.auth import exceptions as google_errors
from google.auth.transport.requests import Request
from google.oauth2 import id_token
from pydantic import BaseModel, EmailStr, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.errors import ApplicationError


class GoogleSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    google_client_id: str = ""

    @property
    def enabled(self) -> bool:
        value = self.google_client_id
        return bool(
            value
            and value.endswith(".apps.googleusercontent.com")
            and not any(c.isspace() for c in value)
        )

    def require(self) -> str:
        if not self.enabled:
            raise ApplicationError(
                code="google_not_configured",
                status_code=503,
                message="El acceso con Google todavía no está disponible.",
            )
        return self.google_client_id


@lru_cache
def get_google_settings() -> GoogleSettings:
    return GoogleSettings()


@dataclass(frozen=True)
class VerifiedGoogleIdentity:
    subject: str
    email: str
    nonce: str


class Claims(BaseModel):
    sub: str = Field(min_length=1, max_length=255)
    email: EmailStr
    nonce: str = Field(min_length=1, max_length=256)


def invalid_google_credential() -> ApplicationError:
    return ApplicationError(
        code="invalid_google_credential",
        status_code=401,
        message="No pudimos verificar el acceso con Google. Inténtalo de nuevo.",
    )


class GoogleIdentityVerifier:
    def verify(self, credential: SecretStr) -> VerifiedGoogleIdentity:
        client_id = get_google_settings().require()
        try:
            with requests.Session() as session:
                transport = Request(session=session)

                def fetch_certs(url: str, **kwargs: Any) -> Any:
                    return transport(url=url, **{**kwargs, "timeout": 5})

                payload = id_token.verify_oauth2_token(
                    credential.get_secret_value(),
                    fetch_certs,
                    audience=client_id,
                )
            if (
                payload.get("aud") != client_id
                or payload.get("email_verified") is not True
                or payload.get("azp", client_id) != client_id
            ):
                raise invalid_google_credential()
            claims = Claims.model_validate(payload)
            return VerifiedGoogleIdentity(claims.sub, str(claims.email).lower(), claims.nonce)
        except (google_errors.TransportError, requests.RequestException):
            raise ApplicationError(
                code="google_unavailable",
                status_code=503,
                message="No pudimos conectar con Google. Inténtalo de nuevo.",
            ) from None
        except (google_errors.GoogleAuthError, ValueError, TypeError):
            raise invalid_google_credential() from None
