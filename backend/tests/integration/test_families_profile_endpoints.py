from collections.abc import Iterator
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.db import engine
from app.core.security import create_access_token
from app.main import app
from app.modules.families.service import FamiliesService

pytestmark = [pytest.mark.integration, pytest.mark.usefixtures("isolated_security_environment")]


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as instance:
        yield instance


def _headers(account: SimpleNamespace) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(account.user_id)}"}


def test_get_family_allows_both_roles(
    client: TestClient, caregiver_account: SimpleNamespace, family_member: SimpleNamespace
) -> None:
    for account in (caregiver_account, family_member):
        response = client.get("/families/me", headers=_headers(account))
        assert response.status_code == 200
        assert response.json()["id"] == str(caregiver_account.family_id)
        assert set(response.json()) == {"id", "name", "created_at"}


def test_get_family_requires_token(client: TestClient) -> None:
    response = client.get("/families/me")
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "unauthorized"


def test_get_family_cannot_select_another_family(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    other_caregiver_account: SimpleNamespace,
) -> None:
    response = client.get(
        "/families/me",
        params={"family_id": str(other_caregiver_account.family_id)},
        headers=_headers(caregiver_account),
    )
    assert response.status_code == 200
    assert response.json()["id"] == str(caregiver_account.family_id)


def test_list_members_allows_both_roles_without_exposing_emails(
    client: TestClient, caregiver_account: SimpleNamespace, family_member: SimpleNamespace
) -> None:
    for account in (caregiver_account, family_member):
        response = client.get("/families/me/members", headers=_headers(account))
        assert response.status_code == 200
        members = response.json()["items"]
        assert {member["id"] for member in members} == {
            str(caregiver_account.user_id),
            str(family_member.user_id),
        }
        assert all(set(member) == {"id", "name", "role"} for member in members)


def test_list_members_requires_token(client: TestClient) -> None:
    response = client.get("/families/me/members")
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "unauthorized"


def test_list_members_excludes_other_family(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    other_caregiver_account: SimpleNamespace,
) -> None:
    response = client.get(
        "/families/me/members",
        params={"family_id": str(other_caregiver_account.family_id)},
        headers=_headers(caregiver_account),
    )
    assert response.status_code == 200
    assert {member["id"] for member in response.json()["items"]} == {str(caregiver_account.user_id)}
    assert other_caregiver_account.email not in response.text


def test_get_elder_profile_allows_both_roles(
    client: TestClient, caregiver_account: SimpleNamespace, family_member: SimpleNamespace
) -> None:
    with Session(engine) as session:
        profile = FamiliesService(session).save_elder_profile(
            caregiver_account.user_id,
            name="Perfil de prueba",
            birth_decade=1940,
            interests=["Música"],
        )
    for account in (caregiver_account, family_member):
        response = client.get("/families/me/elder-profile", headers=_headers(account))
        assert response.status_code == 200
        assert response.json() == profile.model_dump(mode="json")


def test_get_elder_profile_returns_not_found_when_missing(
    client: TestClient, caregiver_account: SimpleNamespace
) -> None:
    response = client.get("/families/me/elder-profile", headers=_headers(caregiver_account))
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "elder_profile_not_found"


def test_get_elder_profile_cannot_read_other_family_profile(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    other_caregiver_account: SimpleNamespace,
) -> None:
    with Session(engine) as session:
        FamiliesService(session).save_elder_profile(
            other_caregiver_account.user_id,
            name="Otro perfil",
            birth_decade=1950,
            interests=[],
        )
    response = client.get(
        "/families/me/elder-profile",
        params={"family_id": str(other_caregiver_account.family_id)},
        headers=_headers(caregiver_account),
    )
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "elder_profile_not_found"
    assert "Otro perfil" not in response.text


def test_put_elder_profile_creates_and_replaces_profile(
    client: TestClient, caregiver_account: SimpleNamespace
) -> None:
    payload = {"name": " Perfil de prueba ", "birth_decade": 1940, "interests": [" Música "]}
    created = client.put(
        "/families/me/elder-profile", json=payload, headers=_headers(caregiver_account)
    )
    assert created.status_code == 200
    assert created.json()["name"] == "Perfil de prueba"
    assert created.json()["interests"] == ["Música"]
    assert created.json()["family_id"] == str(caregiver_account.family_id)
    payload.update(name="Perfil actualizado", interests=[])
    replaced = client.put(
        "/families/me/elder-profile", json=payload, headers=_headers(caregiver_account)
    )
    assert replaced.status_code == 200
    assert replaced.json()["id"] == created.json()["id"]
    assert replaced.json()["created_at"] == created.json()["created_at"]
    assert replaced.json()["name"] == "Perfil actualizado"
    assert replaced.json()["interests"] == []


def test_put_elder_profile_rejects_invalid_decade(
    client: TestClient, caregiver_account: SimpleNamespace
) -> None:
    response = client.put(
        "/families/me/elder-profile",
        json={"name": "Perfil", "birth_decade": 1945, "interests": []},
        headers=_headers(caregiver_account),
    )
    assert response.status_code == 422
    assert set(response.json()["detail"]) == {"code", "message"}
    assert response.json()["detail"]["code"] == "validation_error"


def test_put_elder_profile_forbids_family_member(
    client: TestClient, family_member: SimpleNamespace
) -> None:
    response = client.put(
        "/families/me/elder-profile",
        json={"name": "Perfil", "birth_decade": 1940, "interests": []},
        headers=_headers(family_member),
    )
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "forbidden"
