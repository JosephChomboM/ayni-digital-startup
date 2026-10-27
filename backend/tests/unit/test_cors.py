from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.cors import configure_cors
from app.core.error_handlers import register_error_handlers
from app.modules.families.router import router


@pytest.fixture
def cors_environment(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("CORS_ORIGINS", raising=False)


def create_client() -> TestClient:
    app = FastAPI()
    register_error_handlers(app)
    app.include_router(router)
    configure_cors(app)
    return TestClient(app)


@pytest.mark.usefixtures("cors_environment")
def test_allowed_origins_support_bearer_preflight_and_json_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CORS_ORIGINS", " https://ayni.example/, http://localhost:5173 ")
    client = create_client()
    for origin in ("https://ayni.example", "http://localhost:5173"):
        response = client.get("/auth/consent", headers={"Origin": origin})
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin
    preflight = client.options(
        "/auth/login",
        headers={
            "Origin": "https://ayni.example",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == "https://ayni.example"
    error = client.get("/missing", headers={"Origin": "https://ayni.example"})
    assert error.status_code == 404
    assert error.headers["access-control-allow-origin"] == "https://ayni.example"
    assert error.json()["detail"]["code"] == "not_found"


@pytest.mark.usefixtures("cors_environment")
@pytest.mark.parametrize("origins", ["", "https://ayni.example"])
def test_empty_or_unlisted_origins_do_not_authorize_preflight(
    monkeypatch: pytest.MonkeyPatch,
    origins: str,
) -> None:
    monkeypatch.setenv("CORS_ORIGINS", origins)
    response = create_client().options(
        "/auth/login",
        headers={
            "Origin": "https://otro.example",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
    assert set(response.json()["detail"]) == {"code", "message"}
    assert response.json()["detail"]["code"] == "http_error"


@pytest.mark.usefixtures("cors_environment")
def test_wildcard_configuration_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "*")

    with pytest.raises(RuntimeError, match="CORS_ORIGINS debe contener orígenes"):
        create_client()
