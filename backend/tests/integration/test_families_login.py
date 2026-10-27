import logging
import secrets
from types import SimpleNamespace

import pytest
from sqlalchemy.orm import Session

from app.core.db import engine
from app.core.security import decode_access_token
from app.modules.families import service as service_module
from app.modules.families.models import User
from app.modules.families.service import FamiliesError, FamiliesService

pytestmark = [pytest.mark.integration, pytest.mark.usefixtures("isolated_security_environment")]


def test_login_normalizes_email_and_returns_valid_bearer_token(
    caregiver_account: SimpleNamespace,
) -> None:
    with Session(engine) as session:
        response = FamiliesService(session).login(
            email=f"  {caregiver_account.email.upper()}  ", password=caregiver_account.password
        )

    assert response.user.id == caregiver_account.user_id
    assert response.user.family_id == caregiver_account.family_id
    assert response.user.email == caregiver_account.email
    assert response.expires_in == 1800
    assert response.token_type == "bearer"  # noqa: S105 -- Fixed protocol label.
    assert decode_access_token(response.access_token) == caregiver_account.user_id
    assert "password_hash" not in response.model_dump_json()
    assert caregiver_account.password.get_secret_value() not in response.model_dump_json()


@pytest.mark.parametrize("minutes", ["", "15"])
def test_login_returns_expiration_from_security_settings(
    caregiver_account: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, minutes: str
) -> None:
    monkeypatch.setenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", minutes)
    with Session(engine) as session:
        response = FamiliesService(session).login(
            email=caregiver_account.email, password=caregiver_account.password
        )

    assert response.expires_in == (900 if minutes == "15" else 1800)


@pytest.mark.parametrize("missing_user", [False, True])
def test_login_uses_same_error_and_checks_a_hash_for_invalid_credentials(
    caregiver_account: SimpleNamespace, monkeypatch: pytest.MonkeyPatch, missing_user: bool
) -> None:
    checked: list[bool] = []
    original = service_module.verify_password

    def verify(raw: str, encoded: str) -> bool:
        checked.append(True)
        return original(raw, encoded)

    monkeypatch.setattr(service_module, "verify_password", verify)
    with Session(engine) as session, pytest.raises(FamiliesError) as error:
        FamiliesService(session).login(
            email=("missing-" if missing_user else "") + caregiver_account.email,
            password=caregiver_account.password.get_secret_value() + "x",
        )

    assert error.value.code == "invalid_credentials"
    assert error.value.status_code == 401
    assert error.value.message == "El correo o la contraseña no son correctos."
    assert checked == [True]


def test_login_rejects_malformed_stored_hash(caregiver_account: SimpleNamespace) -> None:
    with Session(engine) as session, session.begin():
        session.get(User, caregiver_account.user_id).password_hash = secrets.token_hex(32)
    with Session(engine) as session, pytest.raises(FamiliesError) as error:
        FamiliesService(session).login(
            email=caregiver_account.email, password=caregiver_account.password
        )

    assert error.value.code == "invalid_credentials"


def test_login_does_not_log_credentials_names_or_token(
    caregiver_account: SimpleNamespace, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.DEBUG, logger="app.modules.families"), Session(engine) as session:
        response = FamiliesService(session).login(
            email=caregiver_account.email, password=caregiver_account.password
        )

    for record in caplog.records:
        for value in (
            caregiver_account.email,
            caregiver_account.password.get_secret_value(),
            response.user.name,
            response.access_token,
        ):
            assert value not in str(record.__dict__)
