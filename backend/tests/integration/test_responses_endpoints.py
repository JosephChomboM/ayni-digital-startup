from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.db import engine
from app.core.security import create_access_token
from app.main import app
from app.modules.families.service import FamiliesService
from app.modules.responses.service import ResponsesService
from app.modules.sessions.models import FamilySession

pytestmark = [pytest.mark.integration, pytest.mark.usefixtures("isolated_security_environment")]


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as instance:
        yield instance


def auth(account: SimpleNamespace) -> dict[str, str]:
    return {"Authorization": "Bearer " + create_access_token(account.user_id)}


def seed(account: SimpleNamespace, profile_id: UUID, days_ago: int = 0) -> UUID:
    with Session(engine) as db, db.begin():
        record = FamilySession(
            elder_profile_id=profile_id,
            created_by=account.user_id,
            template_version="1.0",
            duration_minutes=15,
            created_at=datetime.now(UTC) - timedelta(days=days_ago),
        )
        db.add(record)
        db.flush()
        return record.id


@pytest.mark.parametrize("role", ["caregiver", "member"])
def test_post_saves_response_and_get_recovers_it_for_both_roles(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
    family_member: SimpleNamespace,
    role: str,
) -> None:
    guide = seed(caregiver_account, memory_profile_id)
    actor = caregiver_account if role == "caregiver" else family_member
    result = client.post(
        f"/sessions/{guide}/response",
        json={"reaction": "emocionado"},
        headers=auth(actor),
    )
    assert result.status_code == 201, result.json()
    assert result.json()["created_by"] == str(actor.user_id)
    assert result.json()["reaction"] == "emocionado"
    recovered = client.get(f"/sessions/{guide}/response", headers=auth(caregiver_account))
    assert recovered.status_code == 200 and recovered.json() == result.json()


def test_post_is_idempotent_but_does_not_replace_an_existing_reaction(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
) -> None:
    path = f"/sessions/{seed(caregiver_account, memory_profile_id)}/response"
    first = client.post(path, json={"reaction": "receptivo"}, headers=auth(caregiver_account))
    repeated = client.post(path, json={"reaction": "receptivo"}, headers=auth(caregiver_account))
    assert first.status_code == 201 and repeated.status_code == 200
    assert first.json() == repeated.json()
    conflict = client.post(path, json={"reaction": "agitado"}, headers=auth(caregiver_account))
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["code"] == "response_already_recorded"
    assert client.get(path, headers=auth(caregiver_account)).json() == first.json()


@pytest.mark.parametrize(
    "body", [{"reaction": "feliz"}, {"reaction": "agitado", "elder_profile_id": "x"}]
)
def test_post_rejects_invalid_reactions_and_client_ownership(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
    body: dict,
) -> None:
    path = f"/sessions/{seed(caregiver_account, memory_profile_id)}/response"
    result = client.post(path, json=body, headers=auth(caregiver_account))
    assert result.status_code == 422 and result.json()["detail"]["code"] == "validation_error"


def test_get_unrecorded_session_returns_clear_error(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
) -> None:
    path = f"/sessions/{seed(caregiver_account, memory_profile_id)}/response"
    result = client.get(path, headers=auth(caregiver_account))
    assert result.status_code == 404
    assert result.json()["detail"]["code"] == "response_not_found"


@pytest.mark.parametrize("method", ["POST", "GET"])
def test_response_endpoints_hide_foreign_and_unknown_sessions(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
    other_caregiver_account: SimpleNamespace,
    method: str,
) -> None:
    guide = seed(caregiver_account, memory_profile_id)
    with Session(engine) as db:
        FamiliesService(db).save_elder_profile(
            other_caregiver_account.user_id,
            name="Otro perfil",
            birth_decade=1940,
            interests=[],
        )
    kwargs = {"json": {"reaction": "agitado"}} if method == "POST" else {}
    denied = client.request(
        method, f"/sessions/{guide}/response", headers=auth(other_caregiver_account), **kwargs
    )
    missing = client.request(
        method, f"/sessions/{uuid4()}/response", headers=auth(other_caregiver_account), **kwargs
    )
    assert denied.status_code == missing.status_code == 404
    assert denied.json() == missing.json()
    assert denied.json()["detail"]["code"] == "session_not_found"


@pytest.mark.parametrize("method", ["POST", "GET"])
def test_response_endpoints_require_token(client: TestClient, method: str) -> None:
    result = client.request(method, f"/sessions/{uuid4()}/response", json={"reaction": "agitado"})
    assert result.status_code == 401 and result.json()["detail"]["code"] == "unauthorized"


def test_public_history_uses_session_chronology_and_excludes_other_families(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
    other_caregiver_account: SimpleNamespace,
) -> None:
    recent = seed(caregiver_account, memory_profile_id)
    oldest = seed(caregiver_account, memory_profile_id, days_ago=3)
    for guide in [recent, oldest]:
        assert (
            client.post(
                f"/sessions/{guide}/response",
                json={"reaction": "agitado"},
                headers=auth(caregiver_account),
            ).status_code
            == 201
        )
    with Session(engine) as db:
        foreign_profile = (
            FamiliesService(db)
            .save_elder_profile(
                other_caregiver_account.user_id,
                name="Otro perfil",
                birth_decade=1940,
                interests=[],
            )
            .id
        )
    foreign = seed(other_caregiver_account, foreign_profile)
    assert (
        client.post(
            f"/sessions/{foreign}/response",
            json={"reaction": "receptivo"},
            headers=auth(other_caregiver_account),
        ).status_code
        == 201
    )
    with Session(engine) as db:
        history = ResponsesService(db).get_history(caregiver_account.user_id)
    assert [item.session_id for item in history] == [oldest, recent]
    assert all(item.elder_profile_id == memory_profile_id for item in history)
    assert all(item.occurred_at.tzinfo == UTC for item in history)
