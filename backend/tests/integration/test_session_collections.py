from collections.abc import Iterator
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.db import engine
from app.core.security import create_access_token
from app.main import app
from app.modules.memories.models import Memory
from app.modules.sessions import service as sessions_service
from app.modules.sessions.assistant import GeneratedReply
from app.modules.sessions.models import FamilySession, SessionItem

pytestmark = [pytest.mark.integration, pytest.mark.usefixtures("isolated_security_environment")]


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as instance:
        yield instance


def auth(account) -> dict[str, str]:
    return {"Authorization": "Bearer " + create_access_token(account.user_id)}


@pytest.fixture
def collection(caregiver_account, memory_profile_id):
    with Session(engine) as session, session.begin():
        items = [
            Memory(
                id=uuid4(),
                elder_profile_id=memory_profile_id,
                created_by=caregiver_account.user_id,
                type="anecdote",
                title=f"Paseo {index}",
                text=f"Un paseo familiar número {index}.",
                is_positive=index != 25,
                is_sensitive=index == 26,
                deletion_pending=index == 27,
            )
            for index in range(28)
        ]
        session.add_all(items)
        session.flush()
        return [str(item.id) for item in items]


def selected_ids(response: dict) -> set[str]:
    return {item["memory_id"] for item in response["selected_memories"]}


def test_generate_selected_collection_includes_more_than_three_and_is_recovered(
    client, caregiver_account, family_member, collection
):
    chosen = collection[:6]
    response = client.post(
        "/sessions/generate",
        headers=auth(family_member),
        json={
            "selection_mode": "selected",
            "memory_ids": chosen,
        },
    )
    assert response.status_code == 201, response.json()
    guide = response.json()
    assert selected_ids(guide) == set(chosen)
    assert guide["selection_mode"] == "selected"
    assert sum(item["duration_minutes"] for item in guide["steps"]) == 15
    assert client.get(f"/sessions/{guide['id']}", headers=auth(caregiver_account)).json() == guide


def test_generate_all_is_a_snapshot_and_excludes_unavailable_memories(
    client, caregiver_account, collection, memory_profile_id
):
    response = client.post(
        "/sessions/generate", headers=auth(caregiver_account), json={"selection_mode": "all"}
    )
    assert response.status_code == 201
    assert selected_ids(response.json()) == set(collection[:25])
    with Session(engine) as session, session.begin():
        session.add(
            Memory(
                elder_profile_id=memory_profile_id,
                created_by=caregiver_account.user_id,
                type="anecdote",
                title="Después",
                text="Otro paseo.",
                is_positive=True,
            )
        )
    saved = client.get(f"/sessions/{response.json()['id']}", headers=auth(caregiver_account))
    assert selected_ids(saved.json()) == set(collection[:25])


@pytest.mark.parametrize("invalid_index", [25, 26, 27])
def test_generate_rejects_unavailable_explicit_memories(
    client, caregiver_account, collection, invalid_index
):
    response = client.post(
        "/sessions/generate",
        headers=auth(caregiver_account),
        json={
            "selection_mode": "selected",
            "memory_ids": [collection[invalid_index]],
        },
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "memory_selection_unavailable"


@pytest.mark.parametrize(
    "body",
    [
        {"selection_mode": "selected", "memory_ids": []},
        {"selection_mode": "all", "memory_ids": [str(uuid4())]},
        {"selection_mode": "all", "memory_id": str(uuid4())},
    ],
)
def test_generate_rejects_ambiguous_or_empty_selections(client, caregiver_account, body):
    response = client.post("/sessions/generate", headers=auth(caregiver_account), json=body)
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation_error"


def test_update_collection_keeps_messages_and_timed_steps_and_supports_both_roles(
    client, caregiver_account, family_member, collection, monkeypatch
):
    monkeypatch.setattr(
        sessions_service,
        "generate_reply",
        lambda *a, **kw: GeneratedReply(message="¿Qué te gustó del paseo?", suggestion="continue"),
    )
    headers = auth(caregiver_account)
    guide = client.post(
        "/sessions/generate", headers=headers, json={"memory_id": collection[0]}
    ).json()
    path = f"/sessions/{guide['id']}"
    assert (
        client.post(path + "/chat", headers=headers, json={"text": "Caminamos"}).status_code == 200
    )
    history = client.get(path + "/messages", headers=headers).json()
    response = client.put(
        path + "/memories",
        headers=auth(family_member),
        json={
            "selection_mode": "all",
        },
    )
    assert response.status_code == 200, response.json()
    assert len(response.json()["selected_memories"]) == 25
    assert response.json()["steps"] == guide["steps"]
    assert client.get(path + "/messages", headers=headers).json() == history


def test_update_collection_requires_auth_and_cannot_target_another_family(
    client, caregiver_account, other_caregiver_account, collection
):
    guide = client.post("/sessions/generate", headers=auth(caregiver_account), json={}).json()
    path = f"/sessions/{guide['id']}/memories"
    assert client.put(path, json={"selection_mode": "all"}).status_code == 401
    from app.modules.families.service import FamiliesService

    with Session(engine) as session:
        FamiliesService(session).save_elder_profile(
            other_caregiver_account.user_id, name="Otro perfil", birth_decade=1940, interests=[]
        )
    response = client.put(
        path,
        headers=auth(other_caregiver_account),
        json={
            "selection_mode": "selected",
            "memory_ids": [collection[0]],
        },
    )
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "session_not_found"
    foreign = client.post(
        "/sessions/generate",
        headers=auth(other_caregiver_account),
        json={
            "selection_mode": "selected",
            "memory_ids": [collection[0]],
        },
    )
    assert foreign.status_code == 409
    assert foreign.json()["detail"]["code"] == "memory_selection_unavailable"


def test_old_session_without_collection_uses_its_existing_steps(
    client, caregiver_account, memory_profile_id, collection
):
    with Session(engine) as session, session.begin():
        record = FamilySession(
            elder_profile_id=memory_profile_id,
            created_by=caregiver_account.user_id,
            template_version="1.0",
            duration_minutes=15,
            items=[
                SessionItem(
                    position=1,
                    duration_minutes=15,
                    instruction="Conversemos.",
                    memory_id=UUID(collection[0]),
                    source_memory_id=UUID(collection[0]),
                )
            ],
        )
        session.add(record)
        session.flush()
        session_id = record.id
    response = client.get(f"/sessions/{session_id}", headers=auth(caregiver_account))
    assert response.status_code == 200
    assert selected_ids(response.json()) == {collection[0]}


def test_chat_reads_the_whole_selection_and_rejects_an_unselected_active_memory(
    client, caregiver_account, collection, monkeypatch
):
    captured = []

    def reply(*args, context, history):
        captured.append(context)
        return GeneratedReply(message="¿Qué te gustó del paseo?", suggestion="continue")

    monkeypatch.setattr(sessions_service, "generate_reply", reply)
    headers = auth(caregiver_account)
    guide = client.post(
        "/sessions/generate",
        headers=headers,
        json={
            "selection_mode": "selected",
            "memory_ids": collection[:6],
        },
    ).json()
    path = f"/sessions/{guide['id']}/chat"
    assert client.post(path, headers=headers, json={"text": "Quiero conversar"}).status_code == 200
    assert len(captured[0]) == 6
    rejected = client.post(path, headers=headers, json={"active_memory_id": collection[6]})
    assert rejected.status_code == 409
    assert len(captured) == 1
    with Session(engine) as session, session.begin():
        session.get(Memory, UUID(collection[5])).is_sensitive = True
    changed = client.post(path, headers=headers, json={"text": "Otro paseo"})
    assert changed.status_code == 409
    assert changed.json()["detail"]["code"] == "conversation_context_changed"
