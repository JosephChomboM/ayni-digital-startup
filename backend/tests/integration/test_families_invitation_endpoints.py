import hashlib
from collections.abc import Iterator
from datetime import datetime, timedelta
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.db import engine
from app.core.security import create_access_token
from app.main import app
from app.modules.families.models import Invitation
from app.modules.families.service import FamiliesService

pytestmark = [pytest.mark.integration, pytest.mark.usefixtures("isolated_security_environment")]


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as instance:
        yield instance


def _headers(account: SimpleNamespace) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(account.user_id)}"}


def test_create_invitation_normalizes_email_expires_in_72_hours_and_stores_only_hash(
    client: TestClient, caregiver_account: SimpleNamespace
) -> None:
    email = f"invitado-{uuid4().hex}@example.com"
    response = client.post(
        "/families/me/invitations",
        json={"email": f" {email.upper()} "},
        headers=_headers(caregiver_account),
    )
    assert response.status_code == 201
    data = response.json()
    invitation = data["invitation"]
    assert invitation["email"] == email
    assert invitation["status"] == "pending"
    assert invitation["role"] == "familiar"
    assert datetime.fromisoformat(invitation["expires_at"]) - datetime.fromisoformat(
        invitation["created_at"]
    ) == timedelta(hours=72)
    assert invitation["created_at"].endswith("Z")
    assert "token_hash" not in response.text
    with Session(engine) as session:
        saved = session.get(Invitation, UUID(invitation["id"]))
        assert saved is not None
        assert saved.family_id == caregiver_account.family_id
        assert saved.token_hash == hashlib.sha256(data["invitation_token"].encode()).hexdigest()
        assert saved.token_hash != data["invitation_token"]


def test_create_invitation_rejects_registered_email(
    client: TestClient, caregiver_account: SimpleNamespace
) -> None:
    response = client.post(
        "/families/me/invitations",
        json={"email": caregiver_account.email.upper()},
        headers=_headers(caregiver_account),
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "email_already_registered"


def test_create_invitation_forbids_family_member(
    client: TestClient, family_member: SimpleNamespace
) -> None:
    response = client.post(
        "/families/me/invitations",
        json={"email": f"invitado-{uuid4().hex}@example.com"},
        headers=_headers(family_member),
    )
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "forbidden"


def test_list_invitations_is_scoped_to_own_family_and_hides_tokens(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    pending_invitation: SimpleNamespace,
    other_caregiver_account: SimpleNamespace,
) -> None:
    with Session(engine) as session:
        other = FamiliesService(session).create_invitation(
            other_caregiver_account.user_id, email=f"otro-{uuid4().hex}@example.com"
        )
    response = client.get(
        "/families/me/invitations",
        params={"family_id": str(other_caregiver_account.family_id)},
        headers=_headers(caregiver_account),
    )
    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [str(pending_invitation.id)]
    assert response.json()["items"][0]["status"] == "pending"
    assert set(response.json()["items"][0]) == {
        "id",
        "email",
        "role",
        "status",
        "created_at",
        "expires_at",
        "accepted_at",
        "revoked_at",
    }
    assert "token" not in response.text
    assert pending_invitation.token.get_secret_value() not in response.text
    assert other.invitation.email not in response.text
    assert other.invitation_token not in response.text


def test_list_invitations_requires_token(client: TestClient) -> None:
    response = client.get("/families/me/invitations")
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "unauthorized"


def test_list_invitations_forbids_family_member(
    client: TestClient, family_member: SimpleNamespace
) -> None:
    response = client.get("/families/me/invitations", headers=_headers(family_member))
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "forbidden"


def test_delete_invitation_revokes_it_and_returns_empty_response(
    client: TestClient, caregiver_account: SimpleNamespace, pending_invitation: SimpleNamespace
) -> None:
    response = client.delete(
        f"/families/me/invitations/{pending_invitation.id}", headers=_headers(caregiver_account)
    )
    assert response.status_code == 204
    assert response.content == b""
    listed = client.get("/families/me/invitations", headers=_headers(caregiver_account))
    assert listed.status_code == 200
    invitation = listed.json()["items"][0]
    assert invitation["id"] == str(pending_invitation.id)
    assert invitation["status"] == "revoked"
    assert invitation["revoked_at"].endswith("Z")


def test_delete_invitation_returns_not_found_for_unknown_id(
    client: TestClient, caregiver_account: SimpleNamespace
) -> None:
    response = client.delete(
        f"/families/me/invitations/{uuid4()}", headers=_headers(caregiver_account)
    )
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "invitation_not_found"


def test_delete_invitation_cannot_revoke_another_family_invitation(
    client: TestClient,
    pending_invitation: SimpleNamespace,
    other_caregiver_account: SimpleNamespace,
) -> None:
    response = client.delete(
        f"/families/me/invitations/{pending_invitation.id}",
        headers=_headers(other_caregiver_account),
    )
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "invitation_not_found"
    with Session(engine) as session:
        invitation = session.get(Invitation, pending_invitation.id)
        assert invitation is not None
        assert invitation.revoked_at is None


def test_delete_invitation_forbids_family_member(
    client: TestClient, family_member: SimpleNamespace, pending_invitation: SimpleNamespace
) -> None:
    response = client.delete(
        f"/families/me/invitations/{pending_invitation.id}", headers=_headers(family_member)
    )
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "forbidden"
