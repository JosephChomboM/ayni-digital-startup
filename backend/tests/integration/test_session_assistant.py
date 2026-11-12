from collections.abc import Iterator
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.db import engine
from app.core.errors import ApplicationError
from app.core.security import create_access_token
from app.main import app
from app.modules.families.service import FamiliesService
from app.modules.memories.models import Memory
from app.modules.memories.schemas import AnecdoteCreateRequest
from app.modules.memories.service import MemoriesService
from app.modules.sessions import service as sessions_service
from app.modules.sessions.assistant import GeneratedReply

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


@pytest.fixture
def guide(client, caregiver_account, memory_profile_id):
    seed(caregiver_account)
    response = client.post("/sessions/generate", headers=auth(caregiver_account))
    assert response.status_code == 201
    return response.json()


@pytest.fixture
def provider(monkeypatch):
    calls = []

    def generate(request, *, context, history):
        calls.append((request, context, history))
        return GeneratedReply(
            message="Mencionaste el parque. ¿Qué disfrutaban hacer juntos allí?",
            suggestion="continue",
            observations=["Árboles"] if request.image else [],
        )

    monkeypatch.setattr(sessions_service, "generate_reply", generate)
    return calls


def test_chat_persists_context_and_recovers_for_another_family_member(
    client, caregiver_account, family_member, guide, provider
):
    path = f"/sessions/{guide['id']}"
    first = client.post(
        path + "/chat",
        headers=auth(caregiver_account),
        json={"text": "Fuimos al parque", "request_id": str(uuid4())},
    )
    assert first.status_code == 200, first.json()
    second = client.post(
        path + "/chat",
        headers=auth(family_member),
        json={"text": "Allí cantábamos", "request_id": str(uuid4())},
    )
    assert second.status_code == 200
    assert provider[0][0].text == "Fuimos al parque"
    assert "Un paseo familiar." in provider[0][1][0]
    assert provider[1][2][0] == {"role": "user", "content": "Fuimos al parque"}
    history = client.get(path + "/messages", headers=auth(family_member))
    assert history.status_code == 200
    assert [m["role"] for m in history.json()] == ["user", "assistant", "user", "assistant"]
    assert history.json()[1]["id"] == first.json()["id"]


def test_retry_is_idempotent_and_does_not_charge_provider_twice(
    client, caregiver_account, guide, provider
):
    path = f"/sessions/{guide['id']}/chat"
    body = {"text": "Una tarde en familia", "request_id": str(uuid4())}
    first = client.post(path, headers=auth(caregiver_account), json=body)
    retry = client.post(path, headers=auth(caregiver_account), json=body)
    assert first.status_code == retry.status_code == 200
    assert first.json() == retry.json()
    assert len(provider) == 1


def test_provider_failure_does_not_save_half_a_turn_and_can_be_retried(
    client, caregiver_account, guide, provider, monkeypatch
):
    path = f"/sessions/{guide['id']}"

    def fail(*args, **kwargs):
        raise ApplicationError(
            code="conversation_ai_unavailable", status_code=503, message="IA no disponible"
        )

    body = {"text": "Fuimos al parque", "request_id": str(uuid4())}
    with monkeypatch.context() as patch:
        patch.setattr(sessions_service, "generate_reply", fail)
        assert (
            client.post(path + "/chat", headers=auth(caregiver_account), json=body).status_code
            == 503
        )
    assert client.get(path + "/messages", headers=auth(caregiver_account)).json() == []
    assert (
        client.post(path + "/chat", headers=auth(caregiver_account), json=body).status_code == 200
    )


def test_foreign_family_and_anonymous_cannot_access_chat(
    client, caregiver_account, other_caregiver_account, guide, provider
):
    path = f"/sessions/{guide['id']}"
    with Session(engine) as session:
        FamiliesService(session).save_elder_profile(
            other_caregiver_account.user_id, name="Perfil ajeno", birth_decade=1950, interests=[]
        )
    for suffix in ["/messages", "/chat"]:
        method = "GET" if suffix == "/messages" else "POST"
        assert client.request(method, path + suffix).status_code == 401
        response = client.request(
            method,
            path + suffix,
            headers=auth(other_caregiver_account),
            **({"json": {}} if method == "POST" else {}),
        )
        assert response.status_code == 404
    assert not provider


@pytest.mark.parametrize(
    "field,value", [("is_sensitive", True), ("is_positive", False), ("deletion_pending", True)]
)
def test_chat_history_is_hidden_when_a_source_becomes_ineligible(
    client, caregiver_account, guide, provider, field, value
):
    path = f"/sessions/{guide['id']}"
    assert (
        client.post(
            path + "/chat", headers=auth(caregiver_account), json={"text": "Recuerdo familiar"}
        ).status_code
        == 200
    )
    source = next(s["memory_id"] for s in guide["steps"] if s["memory_id"])
    with Session(engine) as session, session.begin():
        setattr(session.get(Memory, UUID(source)), field, value)
    assert client.get(path + "/messages", headers=auth(caregiver_account)).status_code == 409
    assert (
        client.post(
            path + "/chat", headers=auth(caregiver_account), json={"text": "Más"}
        ).status_code
        == 409
    )
    assert len(provider) == 1


def test_contacts_are_redacted_in_saved_messages(client, caregiver_account, guide, provider):
    path = f"/sessions/{guide['id']}"
    response = client.post(
        path + "/chat",
        headers=auth(caregiver_account),
        json={"text": "Correo prueba@example.com, teléfono 987654321"},
    )
    assert response.status_code == 200
    history = client.get(path + "/messages", headers=auth(caregiver_account)).json()
    assert "prueba@example.com" not in history[0]["text"]
    assert "987654321" not in history[0]["text"]
