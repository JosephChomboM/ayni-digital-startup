from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from functools import lru_cache
from typing import TYPE_CHECKING

from pydantic import Field, SecretStr, ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

if TYPE_CHECKING:
    from fastapi import FastAPI


class SecuritySettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", hide_input_in_errors=True)

    jwt_secret: SecretStr = Field(repr=False)
    jwt_access_token_expire_minutes: int = Field(default=30, gt=0)

    @field_validator("jwt_secret")
    @classmethod
    def require_secret(cls, value: SecretStr) -> SecretStr:
        if not value.get_secret_value().strip():
            raise ValueError("JWT_SECRET es obligatorio y no puede estar vacío.")
        return value

    @field_validator("jwt_access_token_expire_minutes", mode="before")
    @classmethod
    def use_default_expiration(cls, value: object) -> object:
        return 30 if isinstance(value, str) and not value.strip() else value


@lru_cache
def get_security_settings() -> SecuritySettings:
    try:
        return SecuritySettings()
    except ValidationError as exc:
        if any(error["loc"] == ("jwt_secret",) for error in exc.errors(include_input=False)):
            raise RuntimeError("JWT_SECRET es obligatorio y no puede estar vacío.") from None
        raise RuntimeError(
            "JWT_ACCESS_TOKEN_EXPIRE_MINUTES debe ser un entero mayor que cero."
        ) from None


@asynccontextmanager
async def lifespan(app: "FastAPI") -> AsyncIterator[None]:
    get_security_settings()
    yield
