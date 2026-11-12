from collections.abc import Iterator
from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.db import engine
from app.core.errors import ApplicationError
from app.core.security import create_access_token
from app.main import app
from app.modules.memories.models import Memory
from app.modules.memories.schemas import AnecdoteCreateRequest
from app.modules.memories.service import MemoriesService
from app.modules.sessions.models import FamilySession, SessionItem
from app.modules.sessions.service import SessionsService

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


def test_failed_generation_rolls_back_items_and_does_not_consume_quota(
    client, caregiver_account, memory_profile_id, monkeypatch
):
    """Un fallo después de guardar los pasos permite generar de nuevo."""
    seed(caregiver_account)

    created_ids = []
    item_ids = []

    def fail(self, record):
        created_ids.append(record.id)
        item_ids.extend(item.id for item in record.items)
        raise ApplicationError(
            code="qa_simulated_failure", message="Fallo de prueba", status_code=503
        )

    with monkeypatch.context() as patch:
        patch.setattr(SessionsService, "_detail", fail)
        failed = client.post("/sessions/generate", headers=auth(caregiver_account))
    assert failed.status_code == 503
    assert len(created_ids) == 1 and len(item_ids) == 3
    with Session(engine) as session:
        assert session.get(FamilySession, created_ids[0]) is None
        assert all(session.get(SessionItem, item_id) is None for item_id in item_ids)
    assert client.get("/sessions", headers=auth(caregiver_account)).json()["total"] == 0
    generated = client.post("/sessions/generate", headers=auth(caregiver_account))
    assert generated.status_code == 201
    detail = generated.json()
    assert len(detail["steps"]) == 3
    assert client.get(f"/sessions/{detail['id']}", headers=auth(caregiver_account)).json() == detail
    assert client.get("/sessions", headers=auth(caregiver_account)).json()["total"] == 1


@pytest.mark.parametrize(
    "field,value", [("is_positive", False), ("is_sensitive", True), ("deletion_pending", True)]
)
def test_history_keeps_original_steps_without_linking_ineligible_memories(
    client, caregiver_account, memory_profile_id, family_member, field, value
):
    """Cambiar la elegibilidad oculta el acceso sin reescribir la guía."""
    memory_id = seed(caregiver_account)
    response = client.post("/sessions/generate", headers=auth(caregiver_account))
    assert response.status_code == 201
    original = response.json()
    with Session(engine) as session, session.begin():
        memory = session.get(Memory, memory_id)
        setattr(memory, field, value)
    seed(caregiver_account)
    for actor in [caregiver_account, family_member]:
        response = client.get(f"/sessions/{original['id']}", headers=auth(actor))
        assert response.status_code == 200
        actual = response.json()
        assert [
            (s["position"], s["instruction"], s["duration_minutes"]) for s in actual["steps"]
        ] == [(s["position"], s["instruction"], s["duration_minutes"]) for s in original["steps"]]
        linked = [s for s in actual["steps"] if s["source_memory_id"]]
        assert len(linked) == 1
        assert linked[0]["source_memory_id"] == str(memory_id)
        assert linked[0]["memory_id"] is None
        assert linked[0]["memory_available"] is False
        assert client.get("/sessions", headers=auth(actor)).json()["total"] == 1
    limited = client.post("/sessions/generate", headers=auth(family_member))
    assert limited.status_code == 409
    assert limited.json()["detail"]["code"] == "session_limit_reached"


def test_only_pending_deletion_content_does_not_create_empty_guide(
    client, caregiver_account, memory_profile_id
):
    """Un borrado pendiente no puede convertirse en una guía utilizable."""
    memory_id = seed(caregiver_account)
    with Session(engine) as session, session.begin():
        session.get(Memory, memory_id).deletion_pending = True
    response = client.post("/sessions/generate", headers=auth(caregiver_account))
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "no_eligible_memories"
    assert client.get("/sessions", headers=auth(caregiver_account)).json()["total"] == 0
    with Session(engine) as session, session.begin():
        session.get(Memory, memory_id).deletion_pending = False
    assert client.post("/sessions/generate", headers=auth(caregiver_account)).status_code == 201
