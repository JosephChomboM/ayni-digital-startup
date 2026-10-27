from fastapi import FastAPI
from pydantic import AnyHttpUrl, ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from starlette.datastructures import Headers
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import Response

from app.core.error_handlers import error_response


class CorsSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", hide_input_in_errors=True)

    cors_origins: str = ""

    @field_validator("cors_origins")
    @classmethod
    def require_explicit_origins(cls, value: str) -> str:
        origins: list[str] = []
        for entry in value.split(","):
            origin = entry.strip()
            if not origin:
                continue
            if "*" in origin or any(character.isspace() for character in origin):
                raise ValueError("Usa orígenes http o https explícitos, separados por comas.")
            parsed = AnyHttpUrl(origin)
            if (
                parsed.username is not None
                or parsed.password is not None
                or parsed.path not in (None, "/")
                or parsed.query is not None
                or parsed.fragment is not None
            ):
                raise ValueError("Un origen solo puede incluir protocolo, dominio y puerto.")
            origins.append(str(parsed).rstrip("/"))
        return ",".join(dict.fromkeys(origins))

    @property
    def allowed_origins(self) -> list[str]:
        return self.cors_origins.split(",") if self.cors_origins else []


class JsonCORSMiddleware(CORSMiddleware):
    def preflight_response(self, request_headers: Headers) -> Response:
        response = super().preflight_response(request_headers)
        if response.status_code < 400:
            return response
        headers = {
            key: value
            for key, value in response.headers.items()
            if key.lower() not in {"content-type", "content-length"}
        }
        return error_response(
            response.status_code, "http_error", "Esta solicitud no está permitida.", headers=headers
        )


def configure_cors(app: FastAPI) -> None:
    try:
        origins = CorsSettings().allowed_origins
    except ValidationError:
        raise RuntimeError(
            "CORS_ORIGINS debe contener orígenes http o https explícitos separados por comas."
        ) from None
    app.add_middleware(
        JsonCORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )
