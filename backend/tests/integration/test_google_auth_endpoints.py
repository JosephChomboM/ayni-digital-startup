import hashlib
import secrets
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, update
from sqlalchemy.orm import Session

from app.core.db import engine
from app.core.security import create_access_token
from app.main import app
from app.modules.families import google_identity
from app.modules.families.models import Family, GoogleAuthChallenge

pytestmark = [pytest.mark.integration, pytest.mark.usefixtures("isolated_security_environment")]


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as instance:
        yield instance


@pytest.fixture
def google(monkeypatch: pytest.MonkeyPatch) -> Iterator[SimpleNamespace]:
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "ayni-test.apps.googleusercontent.com")
    google_identity.get_google_settings.cache_clear()
    state = SimpleNamespace(
        subject=uuid4().hex, email=f"google-{uuid4().hex}@example.com", nonce=""
    )
    monkeypatch.setattr(
        google_identity.GoogleIdentityVerifier,
        "verify",
        lambda self, credential: google_identity.VerifiedGoogleIdentity(
            state.subject, state.email, state.nonce
        ),
    )
    yield state
    google_identity.get_google_settings.cache_clear()


def credential(client: TestClient, google: SimpleNamespace) -> dict[str, str]:
    result = client.post("/auth/google/challenge")
    assert result.status_code == 201, result.json()
    google.nonce = result.json()["nonce"]
    return {"credential": secrets.token_urlsafe(24), "challenge_id": result.json()["challenge_id"]}


def auth(account: SimpleNamespace) -> dict[str, str]:
    return {"Authorization": "Bearer " + create_access_token(account.user_id)}


def test_google_config_exposes_only_public_client_id(
    client: TestClient, google: SimpleNamespace
) -> None:
    assert client.get("/auth/google/config").json() == {
        "enabled": True,
        "client_id": "ayni-test.apps.googleusercontent.com",
    }


def test_unconfigured_google_is_disabled_and_challenge_has_clear_error(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "")
    google_identity.get_google_settings.cache_clear()
    try:
        assert client.get("/auth/google/config").json() == {"enabled": False, "client_id": None}
        result = client.post("/auth/google/challenge")
        assert (
            result.status_code == 503 and result.json()["detail"]["code"] == "google_not_configured"
        )
    finally:
        google_identity.get_google_settings.cache_clear()


def test_challenge_stores_only_nonce_hash_with_five_minute_expiry(
    client: TestClient, google: SimpleNamespace
) -> None:
    from uuid import UUID

    before = datetime.now(UTC)
    data = credential(client, google)
    with Session(engine) as db:
        record = db.get(GoogleAuthChallenge, UUID(data["challenge_id"]))
        assert record is not None and record.consumed_at is None
        assert record.nonce_hash == hashlib.sha256(google.nonce.encode()).hexdigest()
        assert (
            before + timedelta(minutes=5)
            <= record.expires_at
            <= datetime.now(UTC) + timedelta(minutes=5)
        )


def test_google_registration_preserves_consent_family_and_returns_no_token(
    client: TestClient, google: SimpleNamespace
) -> None:
    password = secrets.token_urlsafe(24)
    data = {
        **credential(client, google),
        "name": "Persona de prueba",
        "password": password,
        "family_name": "Familia de prueba",
        "consent": {"accepted": True, "text_version": "1.0"},
    }
    family_id = None
    try:
        result = client.post("/auth/google/register", json=data)
        assert result.status_code == 201, result.json()
        from uuid import UUID

        family_id = UUID(result.json()["family"]["id"])
        assert result.json()["user"]["email"] == google.email
        assert "access_token" not in result.json()
        assert result.json()["consent"]["text_version"] == "1.0"
        login = client.post("/auth/google/login", json=credential(client, google))
        assert login.status_code == 200 and login.json()["token_type"] == "bearer"  # noqa: S105
        assert (
            client.get(
                "/users/me", headers={"Authorization": "Bearer " + login.json()["access_token"]}
            ).status_code
            == 200
        )
        normal_login = client.post(
            "/auth/login", json={"email": google.email, "password": password}
        )
        assert normal_login.status_code == 200
    finally:
        if family_id:
            with engine.begin() as connection:
                connection.execute(delete(Family).where(Family.id == family_id))


@pytest.mark.parametrize(
    "change,code",
    [
        ({"consent": {"accepted": False, "text_version": "1.0"}}, "consent_required"),
        ({"consent": {"accepted": True, "text_version": "2.0"}}, "consent_version_invalid"),
        ({"password": "short"}, "validation_error"),
    ],
)
def test_google_registration_requires_consent_version_and_password_contract(
    client: TestClient, google: SimpleNamespace, change: dict, code: str
) -> None:
    data = {
        **credential(client, google),
        "name": "Persona de prueba",
        "password": secrets.token_urlsafe(24),
        "family_name": "Familia de prueba",
        "consent": {"accepted": True, "text_version": "1.0"},
        **change,
    }
    result = client.post("/auth/google/register", json=data)
    assert result.status_code == 422 and result.json()["detail"]["code"] == code


def test_existing_email_needs_explicit_password_link_and_nonce_cannot_be_replayed(
    client: TestClient, google: SimpleNamespace, caregiver_account: SimpleNamespace
) -> None:
    google.email = caregiver_account.email
    proof = credential(client, google)
    rejected = client.post("/auth/google/login", json=proof)
    assert (
        rejected.status_code == 409 and rejected.json()["detail"]["code"] == "google_link_required"
    )
    linked = client.post(
        "/auth/google/link",
        json={**proof, "password": caregiver_account.password.get_secret_value()},
        headers=auth(caregiver_account),
    )
    assert linked.status_code == 204
    login_proof = credential(client, google)
    login = client.post("/auth/google/login", json=login_proof)
    assert login.status_code == 200 and login.json()["user"]["id"] == str(caregiver_account.user_id)
    replay = client.post("/auth/google/login", json=login_proof)
    assert (
        replay.status_code == 401 and replay.json()["detail"]["code"] == "invalid_google_challenge"
    )


def test_google_link_rejects_wrong_password_and_different_email(
    client: TestClient, google: SimpleNamespace, caregiver_account: SimpleNamespace
) -> None:
    google.email = caregiver_account.email
    proof = credential(client, google)
    result = client.post(
        "/auth/google/link",
        json={**proof, "password": secrets.token_urlsafe(24)},
        headers=auth(caregiver_account),
    )
    assert result.status_code == 403 and result.json()["detail"]["code"] == "invalid_password"
    google.email = f"another-{uuid4().hex}@example.com"
    other = client.post(
        "/auth/google/link",
        json={**proof, "password": caregiver_account.password.get_secret_value()},
        headers=auth(caregiver_account),
    )
    assert other.status_code == 403 and other.json()["detail"]["code"] == "google_email_mismatch"


def test_google_login_requires_registered_identity(
    client: TestClient, google: SimpleNamespace
) -> None:
    result = client.post("/auth/google/login", json=credential(client, google))
    assert (
        result.status_code == 404
        and result.json()["detail"]["code"] == "google_account_not_registered"
    )


def test_google_registration_accepts_valid_family_invitation(
    client: TestClient,
    google: SimpleNamespace,
    pending_invitation: SimpleNamespace,
) -> None:
    google.email = pending_invitation.email
    result = client.post(
        "/auth/google/register",
        json={
            **credential(client, google),
            "name": "Familiar de prueba",
            "password": secrets.token_urlsafe(24),
            "invitation_token": pending_invitation.token.get_secret_value(),
            "consent": {"accepted": True, "text_version": "1.0"},
        },
    )
    assert result.status_code == 201, result.json()
    assert result.json()["user"]["role"] == "familiar"
    assert result.json()["family"]["id"] == str(pending_invitation.family_id)


def test_expired_nonce_cannot_start_session(
    client: TestClient,
    google: SimpleNamespace,
    caregiver_account: SimpleNamespace,
) -> None:
    from uuid import UUID

    google.email = caregiver_account.email
    linked = client.post(
        "/auth/google/link",
        json={
            **credential(client, google),
            "password": caregiver_account.password.get_secret_value(),
        },
        headers=auth(caregiver_account),
    )
    assert linked.status_code == 204
    proof = credential(client, google)
    with engine.begin() as connection:
        connection.execute(
            update(GoogleAuthChallenge)
            .where(GoogleAuthChallenge.id == UUID(proof["challenge_id"]))
            .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
    result = client.post("/auth/google/login", json=proof)
    assert (
        result.status_code == 401 and result.json()["detail"]["code"] == "invalid_google_challenge"
    )


def test_patch_own_profile_persists_without_exposing_it_to_another_account(
    client: TestClient, caregiver_account: SimpleNamespace, other_caregiver_account: SimpleNamespace
) -> None:
    result = client.patch(
        "/users/me",
        json={"phone": "+51 900 000 000", "city": "Lima", "district": "Surco"},
        headers=auth(caregiver_account),
    )
    assert result.status_code == 200 and result.json()["user"]["city"] == "Lima"
    own = client.get("/users/me", headers=auth(caregiver_account))
    assert own.json() == result.json()
    other = client.get("/users/me", headers=auth(other_caregiver_account)).json()
    assert other["user"]["phone"] is None and other["user"]["city"] is None
    cleared = client.patch("/users/me", json={"phone": None}, headers=auth(caregiver_account))
    assert cleared.status_code == 200 and cleared.json()["user"]["phone"] is None


def test_patch_profile_rejects_ownership_and_invalid_phone(
    client: TestClient, caregiver_account: SimpleNamespace
) -> None:
    result = client.patch(
        "/users/me",
        json={"family_id": str(uuid4()), "phone": "no es un teléfono"},
        headers=auth(caregiver_account),
    )
    assert result.status_code == 422 and result.json()["detail"]["code"] == "validation_error"


@pytest.mark.parametrize("path", ["/users/me", "/auth/google/link"])
def test_profile_and_link_require_real_session(client: TestClient, path: str) -> None:
    if path == "/users/me":
        result = client.patch(path, json={"city": "Lima"})
    else:
        result = client.post(
            path,
            json={
                "credential": secrets.token_urlsafe(24),
                "challenge_id": str(uuid4()),
                "password": secrets.token_urlsafe(24),
            },
        )
    assert result.status_code == 401 and result.json()["detail"]["code"] == "unauthorized"
