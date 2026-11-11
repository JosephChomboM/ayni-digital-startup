from collections.abc import Iterator
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.db import engine
from app.core.security import create_access_token
from app.main import app
from app.modules.families.service import FamiliesService
from app.modules.memories.models import Memory
from app.modules.memories.schemas import AnecdoteCreateRequest
from app.modules.memories.service import MemoriesService

pytestmark = [pytest.mark.integration, pytest.mark.usefixtures("isolated_security_environment")]


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as instance:
        yield instance


def auth(account: SimpleNamespace) -> dict[str, str]:
    return {"Authorization": "Bearer " + create_access_token(account.user_id)}


def seed(account: SimpleNamespace) -> UUID:
    with Session(engine) as session:
        return (
            MemoriesService(session)
            .create_memory(
                account.user_id,
                AnecdoteCreateRequest(
                    type="anecdote",
                    title="Paseo",
                    text="Un paseo familiar.",
                    is_positive=True,
                ),
            )
            .id
        )


def other_profile(account: SimpleNamespace) -> None:
    with Session(engine) as session:
        FamiliesService(session).save_elder_profile(
            account.user_id, name="Otro perfil", birth_decade=1940, interests=[]
        )


@pytest.mark.parametrize("role", ["caregiver", "member"])
def test_post_generates_and_persists_for_both_family_roles(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
    family_member: SimpleNamespace,
    role: str,
) -> None:
    memory_id = seed(caregiver_account)
    actor = caregiver_account if role == "caregiver" else family_member
    response = client.post("/sessions/generate", json={}, headers=auth(actor))
    assert response.status_code == 201, response.json()
    result = response.json()
    assert result["elder_profile_id"] == str(memory_profile_id)
    assert result["created_by"] == str(actor.user_id)
    assert sum(step["duration_minutes"] for step in result["steps"]) == 15
    assert [step["memory_id"] for step in result["steps"] if step["memory_available"]] == [
        str(memory_id)
    ]
    # Another request (fresh DB session) recovers the persisted guide verbatim.
    detail = client.get(f"/sessions/{result['id']}", headers=auth(caregiver_account))
    assert detail.status_code == 200 and detail.json() == result


def test_post_without_eligible_content_has_clear_error_and_no_empty_session(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
) -> None:
    response = client.post("/sessions/generate", headers=auth(caregiver_account))
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "no_eligible_memories"
    history = client.get("/sessions", headers=auth(caregiver_account))
    assert history.status_code == 200 and history.json()["total"] == 0


def test_post_rejects_client_selected_ownership_and_preserves_quota(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
) -> None:
    seed(caregiver_account)
    injected = client.post(
        "/sessions/generate",
        headers=auth(caregiver_account),
        json={"elder_profile_id": str(uuid4()), "created_by": str(uuid4())},
    )
    assert injected.status_code == 422
    assert injected.json()["detail"]["code"] == "validation_error"
    assert (
        client.post("/sessions/generate", json={}, headers=auth(caregiver_account)).status_code
        == 201
    )
    limited = client.post("/sessions/generate", json={}, headers=auth(caregiver_account))
    assert limited.status_code == 409
    assert limited.json()["detail"]["code"] == "session_limit_reached"


def test_get_history_is_paginated_and_isolated_between_real_families(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
    other_caregiver_account: SimpleNamespace,
) -> None:
    seed(caregiver_account)
    own = client.post("/sessions/generate", headers=auth(caregiver_account)).json()
    other_profile(other_caregiver_account)
    seed(other_caregiver_account)
    foreign = client.post("/sessions/generate", headers=auth(other_caregiver_account)).json()
    response = client.get("/sessions?limit=1&offset=0", headers=auth(caregiver_account))
    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert [item["id"] for item in response.json()["items"]] == [own["id"]]
    assert foreign["id"] != own["id"]
    page = client.get("/sessions?limit=1&offset=1", headers=auth(caregiver_account)).json()
    assert page["items"] == [] and page["total"] == 1


def test_get_history_rejects_invalid_pagination_with_uniform_error(
    client: TestClient,
    caregiver_account: SimpleNamespace,
) -> None:
    response = client.get("/sessions?limit=0", headers=auth(caregiver_account))
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation_error"


def test_get_detail_hides_foreign_and_unknown_session_identically(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
    other_caregiver_account: SimpleNamespace,
) -> None:
    seed(caregiver_account)
    own = client.post("/sessions/generate", headers=auth(caregiver_account)).json()
    other_profile(other_caregiver_account)
    denied = client.get(f"/sessions/{own['id']}", headers=auth(other_caregiver_account))
    missing = client.get(f"/sessions/{uuid4()}", headers=auth(other_caregiver_account))
    assert denied.status_code == missing.status_code == 404
    assert denied.json() == missing.json()
    assert denied.json()["detail"]["code"] == "session_not_found"


@pytest.mark.parametrize(
    "method,path",
    [
        ("POST", "/sessions/generate"),
        ("GET", "/sessions"),
        ("GET", "/sessions/00000000-0000-0000-0000-000000000001"),
    ],
)
def test_session_endpoints_require_bearer_token(client: TestClient, method: str, path: str) -> None:
    response = client.request(method, path)
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "unauthorized"


def test_generation_http_excludes_sensitive_non_positive_foreign_and_deleting_content(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
    other_caregiver_account: SimpleNamespace,
) -> None:
    safe = seed(caregiver_account)
    other_profile(other_caregiver_account)
    seed(other_caregiver_account)
    with Session(engine) as session:
        service = MemoriesService(session)
        for positive, sensitive in [(False, False), (True, True)]:
            service.create_memory(
                caregiver_account.user_id,
                AnecdoteCreateRequest(
                    type="anecdote",
                    title="Otro recuerdo",
                    text="Otro momento familiar.",
                    is_positive=positive,
                    is_sensitive=sensitive,
                ),
            )
        pending_id = service.create_memory(
            caregiver_account.user_id,
            AnecdoteCreateRequest(
                type="anecdote",
                title="Pendiente",
                text="Un momento familiar.",
                is_positive=True,
            ),
        ).id
        with session.begin():
            pending = session.get(Memory, pending_id)
            assert pending is not None
            pending.deletion_pending = True
    response = client.post("/sessions/generate", json={}, headers=auth(caregiver_account))
    assert response.status_code == 201
    assert [
        step["source_memory_id"] for step in response.json()["steps"] if step["source_memory_id"]
    ] == [str(safe)]
