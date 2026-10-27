import os
import secrets
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.security_settings import SecuritySettings, get_security_settings
from app.main import app

pytestmark = pytest.mark.usefixtures("isolated_security_environment")


@pytest.mark.parametrize("value", [None, "", " \t "])
def test_app_startup_fails_when_jwt_secret_is_missing_or_blank(
    monkeypatch: pytest.MonkeyPatch, value: str | None
) -> None:
    if value is None:
        monkeypatch.delenv("JWT_SECRET")
    else:
        monkeypatch.setenv("JWT_SECRET", value)

    with (
        pytest.raises(RuntimeError, match="^JWT_SECRET es obligatorio y no puede estar vacío\\.$"),
        TestClient(app),
    ):
        pass


@pytest.mark.parametrize(
    ("value", "expected"), [(None, 30), ("", 30), (" \t ", 30), ("15", 15), ("60", 60)]
)
def test_expiration_defaults_to_thirty_or_uses_configured_value(
    monkeypatch: pytest.MonkeyPatch, value: str | None, expected: int
) -> None:
    if value is not None:
        monkeypatch.setenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", value)

    assert SecuritySettings().jwt_access_token_expire_minutes == expected


@pytest.mark.parametrize("value", ["0", "-1", "invalid", "1.5"])
def test_app_startup_rejects_invalid_duration(monkeypatch: pytest.MonkeyPatch, value: str) -> None:
    monkeypatch.setenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", value)

    with (
        pytest.raises(RuntimeError, match="JWT_ACCESS_TOKEN_EXPIRE_MINUTES debe ser un entero"),
        TestClient(app),
    ):
        pass


def test_app_startup_succeeds_with_test_secret_and_empty_duration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "")

    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert get_security_settings().jwt_access_token_expire_minutes == 30


def test_test_secret_overrides_dotenv_and_is_not_exposed(tmp_path: Path) -> None:
    file_value = secrets.token_hex(32)
    (tmp_path / ".env").write_text(f"JWT_SECRET={file_value}\n", encoding="utf-8")

    settings = get_security_settings()

    assert settings.jwt_secret.get_secret_value() == os.environ["JWT_SECRET"]
    assert settings.jwt_secret.get_secret_value() != file_value
    assert os.environ["JWT_SECRET"] not in repr(settings)
    assert os.environ["JWT_SECRET"] not in settings.model_dump_json()


def test_nonblank_secret_is_preserved_without_trimming(monkeypatch: pytest.MonkeyPatch) -> None:
    key_value = f" {secrets.token_hex(32)} "
    monkeypatch.setenv("JWT_SECRET", key_value)

    assert get_security_settings().jwt_secret.get_secret_value() == key_value


@pytest.mark.parametrize(("value", "expected"), [(None, 72), ("", 72), (" \t ", 72), ("24", 24)])
def test_invitation_expiration_uses_seventy_two_hours_by_default(
    monkeypatch: pytest.MonkeyPatch, value: str | None, expected: int
) -> None:
    if value is not None:
        monkeypatch.setenv("INVITATION_EXPIRE_HOURS", value)
    assert get_security_settings().invitation_expire_hours == expected


@pytest.mark.parametrize("value", ["0", "-1", "invalid", "1.5"])
def test_app_startup_rejects_invalid_invitation_duration(
    monkeypatch: pytest.MonkeyPatch, value: str
) -> None:
    monkeypatch.setenv("INVITATION_EXPIRE_HOURS", value)
    with (
        pytest.raises(RuntimeError, match="INVITATION_EXPIRE_HOURS debe ser un entero"),
        TestClient(app),
    ):
        pass
