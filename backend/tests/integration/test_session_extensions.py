from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.db import engine
from app.core.security import create_access_token
from app.main import app
from app.modules.billing.models import Subscription
from app.modules.families.service import FamiliesService
from app.modules.memories import song_metadata
from app.modules.memories.models import Memory
from app.modules.memories.schemas import AnecdoteCreateRequest, SongCreateRequest
from app.modules.memories.service import MemoriesService
from app.modules.recommender import service as recommender
from app.modules.sessions import service as sessions_service
from app.modules.sessions.assistant import GeneratedReply
from app.modules.sessions.models import FamilySession

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


@pytest.fixture(autouse=True)
def offline_recommendations(monkeypatch):
    monkeypatch.setattr(recommender, "get_settings", lambda: Settings(groq_api_key=""))


@pytest.fixture
def assistant_provider(monkeypatch):
    calls = []

    def fake(data, *, context, history):
        calls.append((data, context, history))
        return GeneratedReply(
            message="¿Qué detalle te gustaría compartir?",
            suggestion="continue",
            observations=["Árboles verdes"] if data.image else [],
        )

    monkeypatch.setattr(sessions_service, "generate_reply", fake)
    return calls


def generate(client, actor, memory_id):
    return client.post(
        "/sessions/generate", headers=auth(actor), json={"memory_id": str(memory_id)}
    )


def test_manual_choice_can_select_a_memory_outside_the_default_three(
    client, caregiver_account, memory_profile_id
):
    ids = [seed(caregiver_account) for _ in range(4)]
    chosen = max(ids, key=str)
    response = generate(client, caregiver_account, chosen)
    assert response.status_code == 201, response.json()
    assert [s["memory_id"] for s in response.json()["steps"] if s["memory_available"]] == [
        str(chosen)
    ]


def test_manual_choice_rejects_other_families_without_consuming_quota(
    client, caregiver_account, memory_profile_id, other_caregiver_account
):
    own = seed(caregiver_account)
    with Session(engine) as session:
        FamiliesService(session).save_elder_profile(
            other_caregiver_account.user_id, name="Otro perfil", birth_decade=1950, interests=[]
        )
    foreign = seed(other_caregiver_account)
    assert generate(client, caregiver_account, foreign).status_code == 404
    assert generate(client, caregiver_account, own).status_code == 201


def test_recommendation_uses_recorded_reactions_and_excludes_sensitive_content(
    client, caregiver_account, memory_profile_id
):
    good, uneasy, sensitive = (
        seed(caregiver_account),
        seed(caregiver_account),
        seed(caregiver_account),
    )
    with Session(engine) as session, session.begin():
        session.add(
            Subscription(
                family_id=caregiver_account.family_id,
                status="active",
                paid_until=datetime.now(UTC) + timedelta(days=1),
            )
        )
        session.get(Memory, sensitive).is_sensitive = True
    for memory_id, reaction in [(good, "emocionado"), (uneasy, "agitado")]:
        guide = generate(client, caregiver_account, memory_id).json()
        response = client.post(
            f"/sessions/{guide['id']}/response",
            headers=auth(caregiver_account),
            json={"reaction": reaction},
        )
        assert response.status_code == 201, response.json()
    recommendation = client.get("/sessions/recommendation", headers=auth(caregiver_account))
    assert recommendation.status_code == 200, recommendation.json()
    result = recommendation.json()
    assert result["memory_id"] == str(good)
    assert result["positive_reactions"] == 1 and result["source"] == "history"


def test_recommendation_admits_insufficient_history(client, caregiver_account, memory_profile_id):
    memory = seed(caregiver_account)
    result = client.get("/sessions/recommendation", headers=auth(caregiver_account)).json()
    assert result["memory_id"] == str(memory)
    assert result["positive_reactions"] == 0 and "historial suficiente" in result["reason"]
    assert client.get("/sessions/recommendation").status_code == 401


def test_visual_context_is_throttled_opt_in_and_expires(
    client, caregiver_account, memory_profile_id, assistant_provider
):
    guide = generate(client, caregiver_account, seed(caregiver_account)).json()
    path = f"/sessions/{guide['id']}"
    body = {"image": "data:image/jpeg;base64,test", "image_consent": True}
    first = client.post(path + "/scene", headers=auth(caregiver_account), json=body)
    second = client.post(path + "/scene", headers=auth(caregiver_account), json=body)
    assert first.status_code == second.status_code == 200
    assert second.json()["cached"] is True and len(assistant_provider) == 1
    assert (
        client.post(
            path + "/chat",
            headers=auth(caregiver_account),
            json={"text": "Hola", "use_scene": True},
        ).status_code
        == 200
    )
    assert "Árboles verdes" in str(assistant_provider[-1][1])
    client.post(
        path + "/chat",
        headers=auth(caregiver_account),
        json={"text": "Seguimos", "use_scene": False},
    )
    assert "Árboles verdes" not in str(assistant_provider[-1][1])
    with Session(engine) as session, session.begin():
        session.get(FamilySession, UUID(guide["id"])).scene_updated_at = datetime.now(
            UTC
        ) - timedelta(seconds=46)
    client.post(
        path + "/chat",
        headers=auth(caregiver_account),
        json={"text": "Seguimos", "use_scene": True},
    )
    assert "Árboles verdes" not in str(assistant_provider[-1][1])
    assert client.delete(path + "/scene", headers=auth(caregiver_account)).status_code == 204
    with Session(engine) as session:
        assert session.get(FamilySession, UUID(guide["id"])).scene_context is None


def test_chat_keeps_visual_details_with_their_original_turn(
    client, caregiver_account, memory_profile_id, assistant_provider
):
    guide = generate(client, caregiver_account, seed(caregiver_account)).json()
    path = f"/sessions/{guide['id']}/chat"
    first = client.post(
        path,
        headers=auth(caregiver_account),
        json={
            "text": "Mira acá, paseábamos entre esos árboles",
            "image": "data:image/jpeg;base64,test",
            "image_consent": True,
        },
    )
    assert first.status_code == 200
    second = client.post(
        path,
        headers=auth(caregiver_account),
        json={
            "text": "¿Qué te mostré antes?",
        },
    )
    assert second.status_code == 200
    history = assistant_provider[-1][2]
    assert history[0]["content"] == "Mira acá, paseábamos entre esos árboles"
    assert "Árboles verdes" in history[1]["content"]
    assert "captura anterior" in history[1]["content"]
    assert assistant_provider[-1][0].text == "¿Qué te mostré antes?"


def test_visual_context_requires_consent_and_cannot_use_a_foreign_session(
    client, caregiver_account, memory_profile_id, other_caregiver_account, assistant_provider
):
    guide = generate(client, caregiver_account, seed(caregiver_account)).json()
    path = f"/sessions/{guide['id']}/scene"
    assert (
        client.post(path, headers=auth(caregiver_account), json={"image": "invalid"}).status_code
        == 422
    )
    with Session(engine) as session:
        FamiliesService(session).save_elder_profile(
            other_caregiver_account.user_id, name="Otro perfil", birth_decade=1950, interests=[]
        )
    assert (
        client.post(
            path, headers=auth(other_caregiver_account), json={"image": "x", "image_consent": True}
        ).status_code
        == 404
    )
    assert not assistant_provider


def test_song_metadata_is_confirmed_by_editor_and_invalidated_when_url_changes(
    client, caregiver_account, memory_profile_id, other_caregiver_account, monkeypatch
):
    with Session(engine) as session:
        memory = MemoriesService(session).create_memory(
            caregiver_account.user_id,
            SongCreateRequest(
                type="song",
                title="Canción de prueba",
                url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                is_positive=True,
            ),
        )
    recording = str(uuid4())
    context = {
        "status": "confirmed",
        "recording_id": recording,
        "title": "Canción de prueba",
        "artist": "Artista de prueba",
        "year": 1987,
        "genres": ["pop"],
        "source_url": "https://musicbrainz.org/recording/" + recording,
    }
    monkeypatch.setattr(song_metadata, "recording_context", lambda _id: context)
    path = f"/memories/{memory.id}/song-context"
    assert client.get(path, headers=auth(caregiver_account)).json()["status"] == "unavailable"
    assert (
        client.post(path, headers=auth(caregiver_account), json={"recording_id": recording}).json()
        == context
    )
    assert client.get(path, headers=auth(caregiver_account)).json() == context
    with Session(engine) as session:
        FamiliesService(session).save_elder_profile(
            other_caregiver_account.user_id, name="Otro perfil", birth_decade=1950, interests=[]
        )
    assert client.get(path, headers=auth(other_caregiver_account)).status_code == 404
    assert (
        client.post(
            path, headers=auth(other_caregiver_account), json={"recording_id": recording}
        ).status_code
        == 404
    )
    changed = client.patch(
        f"/memories/{memory.id}",
        headers=auth(caregiver_account),
        json={"url": "https://www.youtube.com/watch?v=abcdefghijk"},
    )
    assert changed.status_code == 200
    assert client.get(path, headers=auth(caregiver_account)).json()["status"] == "unavailable"
