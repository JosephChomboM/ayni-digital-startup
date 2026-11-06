from functools import lru_cache
from urllib.parse import urlsplit

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.errors import ApplicationError

PHOTO_MAX_BYTES = 8 * 1024 * 1024
PHOTO_MAX_PIXELS = 20_000_000
PHOTO_URL_SECONDS = 300


def photo_storage_error() -> ApplicationError:
    return ApplicationError(
        code="photo_storage_unavailable",
        message="No pudimos acceder a las fotos. Inténtalo de nuevo en unos momentos.",
        status_code=503,
    )


class PhotoStorageSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str = ""
    supabase_service_role_key: SecretStr = SecretStr("")
    supabase_storage_bucket: str = "fotos"

    def require(self) -> None:
        url = urlsplit(self.supabase_url)
        if (
            url.scheme != "https"
            or not url.hostname
            or url.username
            or url.password
            or url.query
            or url.fragment
            or url.path not in {"", "/"}
            or not self.supabase_service_role_key.get_secret_value()
            or not self.supabase_storage_bucket
        ):
            raise ApplicationError(
                code="photo_storage_not_configured",
                message="Las fotos compartidas todavía no están disponibles.",
                status_code=503,
            )


@lru_cache
def get_photo_storage_settings() -> PhotoStorageSettings:
    return PhotoStorageSettings()
