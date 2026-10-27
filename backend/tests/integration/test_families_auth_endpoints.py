import secrets
from collections.abc import Iterator
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.core.db import engine
from app.core.security import create_access_token, decode_access_token
from app.main import app
from app.modules.families.consent import CONSENT_TEXT, ONBOARDING_NOTICE
from app.modules.families.models import Family

pytestmark = [pytest.mark.integration, pytest.mark.usefixtures("isolated_security_environment")]


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as instance:
        yield instance


@pytest.fixture
def registration_payload() -> Iterator[dict[str, object]]:
    suffix = uuid4().hex
    name = f"Familia HTTP {suffix}"
    yield {
        "email": f" CUIDADOR-{suffix}@EXAMPLE.COM ",
        "name": "Persona de prueba",
        "password": secrets.token_urlsafe(24),
        "family_name": name,
        "consent": {"accepted": True, "text_version": "1.0"},
    }
    with engine.begin() as connection:
        connection.execute(delete(Family).where(Family.name == name))


def test_get_consent_is_public_and_returns_approved_texts(client: TestClient) -> None:
    response = client.get("/auth/consent")

    assert response.status_code == 200
    assert response.json() == {
        "text_version": "1.0",
        "text": CONSENT_TEXT,
        "onboarding_notice": ONBOARDING_NOTICE,
    }


def test_get_consent_rejects_wrong_http_method(client: TestClient) -> None:
    response = client.post("/auth/consent")

    assert response.status_code == 405
    assert response.json()["detail"]["code"] == "method_not_allowed"
    assert set(response.json()["detail"]) == {"code", "message"}


def test_register_supports_caregiver_and_invited_family_member_without_returning_token(
    client: TestClient,
    registration_payload: dict[str, object],
    pending_invitation: SimpleNamespace,
) -> None:
    caregiver = client.post("/auth/register", json=registration_payload)
    assert caregiver.status_code == 201
    assert caregiver.json()["user"]["role"] == "cuidador_principal"
    assert caregiver.json()["user"]["email"] == str(registration_payload["email"]).strip().lower()
    assert caregiver.json()["user"]["family_id"] == caregiver.json()["family"]["id"]
    assert caregiver.json()["consent"]["text_version"] == "1.0"
    assert caregiver.json()["consent"]["accepted_at"].endswith("Z")
    assert set(caregiver.json()) == {"user", "family", "consent"}

    invited_payload = dict(registration_payload)
    invited_payload.pop("family_name")
    invited_payload.update(
        email=pending_invitation.email.upper(),
        invitation_token=pending_invitation.token.get_secret_value(),
    )
    invited = client.post("/auth/register", json=invited_payload)
    assert invited.status_code == 201
    assert invited.json()["user"]["role"] == "familiar"
    assert invited.json()["family"]["id"] == str(pending_invitation.family_id)
    assert set(invited.json()) == {"user", "family", "consent"}
    assert "password_hash" not in invited.text
    assert str(registration_payload["password"]) not in caregiver.text


def test_register_requires_consent_and_returns_uniform_validation_error(
    client: TestClient,
    registration_payload: dict[str, object],
) -> None:
    registration_payload["consent"] = {"accepted": False, "text_version": "1.0"}
    response = client.post("/auth/register", json=registration_payload)

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "consent_required"
    assert set(response.json()["detail"]) == {"code", "message"}
    assert str(registration_payload["password"]) not in response.text


def test_login_returns_valid_token_and_expiration(
    client: TestClient,
    caregiver_account: SimpleNamespace,
) -> None:
    response = client.post(
        "/auth/login",
        json={
            "email": f" {caregiver_account.email.upper()} ",
            "password": caregiver_account.password.get_secret_value(),
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"  # noqa: S105 -- Fixed protocol label.
    assert data["expires_in"] == 1800
    assert decode_access_token(data["access_token"]) == caregiver_account.user_id
    assert data["user"]["id"] == str(caregiver_account.user_id)


def test_login_returns_invalid_credentials_for_wrong_password(
    client: TestClient,
    caregiver_account: SimpleNamespace,
) -> None:
    response = client.post(
        "/auth/login",
        json={
            "email": caregiver_account.email,
            "password": caregiver_account.password.get_secret_value() + "x",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "invalid_credentials"
    assert set(response.json()["detail"]) == {"code", "message"}


def test_get_users_me_uses_bearer_token(client: TestClient, family_member: SimpleNamespace) -> None:
    response = client.get(
        "/users/me",
        headers={
            "Authorization": f"Bearer {create_access_token(family_member.user_id)}",
        },
    )

    assert response.status_code == 200
    assert response.json()["user"]["id"] == str(family_member.user_id)
    assert response.json()["user"]["role"] == "familiar"
    assert response.json()["consent"]["text_version"] == "1.0"
    assert "password_hash" not in response.text


def test_get_users_me_requires_token(client: TestClient) -> None:
    response = client.get("/users/me")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert response.json()["detail"]["code"] == "unauthorized"


def test_get_users_me_cannot_select_user_from_another_family(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    other_caregiver_account: SimpleNamespace,
) -> None:
    response = client.get(
        "/users/me",
        params={
            "user_id": str(other_caregiver_account.user_id),
            "family_id": str(other_caregiver_account.family_id),
        },
        headers={"Authorization": f"Bearer {create_access_token(caregiver_account.user_id)}"},
    )

    assert response.status_code == 200
    assert response.json()["user"]["id"] == str(caregiver_account.user_id)
    assert response.json()["user"]["family_id"] == str(caregiver_account.family_id)
    assert other_caregiver_account.email not in response.text
