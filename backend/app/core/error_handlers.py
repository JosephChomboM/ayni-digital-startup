from collections.abc import Awaitable, Callable, Mapping

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DisconnectionError, OperationalError, SQLAlchemyError
from sqlalchemy.exc import TimeoutError as SQLAlchemyTimeoutError
from starlette.exceptions import HTTPException

from app.core.errors import ApplicationError
from app.core.security import InvalidAccessTokenError

HTTP_ERRORS = {
    400: ("http_error", "Revisa la solicitud enviada."),
    401: ("unauthorized", "Vuelve a iniciar sesión para continuar."),
    403: ("forbidden", "No tienes permiso para hacer esto."),
    404: ("not_found", "No encontramos lo que buscas."),
    405: ("method_not_allowed", "Esta acción no está disponible en esta dirección."),
    422: ("validation_error", "Revisa los datos enviados."),
    500: ("internal_error", "No pudimos completar la solicitud. Inténtalo de nuevo."),
    503: ("service_unavailable", "El servicio no está disponible. Inténtalo de nuevo."),
}


def error_response(
    status_code: int, code: str, message: str, *, headers: Mapping[str, str] | None = None
) -> JSONResponse:
    response_headers = dict(headers or {})
    if status_code == 401:
        response_headers.setdefault("WWW-Authenticate", "Bearer")
    return JSONResponse(
        status_code=status_code,
        content={"detail": {"code": code, "message": message}},
        headers=response_headers,
    )


async def application_error_handler(request: Request, exc: ApplicationError) -> JSONResponse:
    return error_response(exc.status_code, exc.code, exc.message)


async def http_error_handler(request: Request, exc: HTTPException) -> JSONResponse:
    code, message = HTTP_ERRORS.get(
        exc.status_code, ("http_error", "No pudimos completar la solicitud.")
    )
    return error_response(exc.status_code, code, message, headers=exc.headers)


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    for error in exc.errors():
        location = error["loc"]
        if location in (("body", "consent"), ("body", "consent", "accepted")):
            return error_response(
                422, "consent_required", "Acepta el consentimiento para continuar."
            )
        if location == ("body", "consent", "text_version"):
            return error_response(
                422,
                "consent_version_invalid",
                "Revisa y acepta la versión actual del consentimiento.",
            )
    return error_response(422, *HTTP_ERRORS[422])


async def invalid_token_handler(request: Request, exc: InvalidAccessTokenError) -> JSONResponse:
    return error_response(
        401, "unauthorized", "Tu sesión no es válida o ya venció. Vuelve a iniciar sesión."
    )


async def database_error_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    status = (
        503
        if isinstance(exc, (OperationalError, DisconnectionError, SQLAlchemyTimeoutError))
        else 500
    )
    return error_response(status, *HTTP_ERRORS[status])


async def unexpected_error_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    try:
        return await call_next(request)
    except Exception:
        # Do not let raw exceptions (including SQL parameters or request values) reach server logs.
        return error_response(500, *HTTP_ERRORS[500])


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApplicationError, application_error_handler)
    app.add_exception_handler(HTTPException, http_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(InvalidAccessTokenError, invalid_token_handler)
    app.add_exception_handler(SQLAlchemyError, database_error_handler)
    app.middleware("http")(unexpected_error_middleware)
