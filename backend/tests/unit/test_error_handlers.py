import secrets
from typing import Annotated

import pytest
from fastapi import Body, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.core.error_handlers import register_error_handlers
from app.core.security import InvalidAccessTokenError
from app.modules.families.schemas import RegisterRequest
from app.modules.families.service import FamiliesError


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    register_error_handlers(app)

    @app.post("/validate")
    def validate(data: Annotated[RegisterRequest, Body()]) -> dict[str, bool]:
        return {"ok": True}

    @app.get("/domain")
    def domain() -> None:
        raise FamiliesError(
            code="email_already_registered",
            message="Este correo ya está registrado.",
            status_code=409,
        )

    @app.get("/token")
    def token() -> None:
        raise InvalidAccessTokenError("internal details")

    @app.get("/database")
    def database() -> None:
        raise OperationalError("SELECT 1", {}, Exception("internal details"))

    @app.get("/unexpected")
    def unexpected() -> None:
        raise RuntimeError("private request content")

    return TestClient(app)


@pytest.mark.parametrize(
    ("path", "status", "code"),
    [
        ("/missing", 404, "not_found"),
        ("/validate", 405, "method_not_allowed"),
        ("/domain", 409, "email_already_registered"),
        ("/token", 401, "unauthorized"),
        ("/database", 503, "service_unavailable"),
        ("/unexpected", 500, "internal_error"),
    ],
)
def test_global_handlers_return_uniform_errors(
    client: TestClient, path: str, status: int, code: str
) -> None:
    response = client.get(path)

    assert response.status_code == status
    assert set(response.json()) == {"detail"}
    assert set(response.json()["detail"]) == {"code", "message"}
    assert response.json()["detail"]["code"] == code
    assert "internal details" not in response.text
    assert "private request content" not in response.text
    if status == 405:
        assert response.headers["allow"] == "POST"
    if status == 401:
        assert response.headers["www-authenticate"] == "Bearer"


def test_validation_error_does_not_echo_password_or_input(client: TestClient) -> None:
    private_value = secrets.token_urlsafe(24)
    response = client.post("/validate", json={"password": private_value})

    assert response.status_code == 422
    assert set(response.json()["detail"]) == {"code", "message"}
    assert private_value not in response.text


@pytest.mark.parametrize(
    ("consent", "code"),
    [
        ({"accepted": False, "text_version": "1.0"}, "consent_required"),
        ({"accepted": True, "text_version": ""}, "consent_version_invalid"),
    ],
)
def test_consent_validation_errors_preserve_contract_codes(
    client: TestClient, consent: dict[str, object], code: str
) -> None:
    response = client.post(
        "/validate",
        json={
            "email": "persona@example.com",
            "name": "Persona de prueba",
            "password": secrets.token_urlsafe(24),
            "family_name": "Familia de prueba",
            "consent": consent,
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == code
