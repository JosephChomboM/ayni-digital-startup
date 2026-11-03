from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.db import engine
from app.core.security import create_access_token
from app.main import app
from app.modules.families.service import FamiliesService
from app.modules.memories import extraction, router
from app.modules.memories.models import MemoryEntityKind
from app.modules.memories.repository import MemoriesRepository
from app.modules.memories.schemas import AnecdoteCreateRequest, MemoryResponse, SongCreateRequest
from app.modules.memories.service import MemoriesService
from app.modules.nlp.service import Entity, ExtractionResult

pytestmark = [pytest.mark.integration, pytest.mark.usefixtures("isolated_security_environment")]


def headers(actor: SimpleNamespace) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(actor.user_id)}"}


def retry_url(memory: MemoryResponse) -> str:
    return f"/memories/{memory.id}/entities/retry"


@pytest.fixture
def failed(caregiver_account: SimpleNamespace, memory_profile_id: UUID) -> MemoryResponse:
    with Session(engine) as session:
        memory = MemoriesService(session).create_memory(
            caregiver_account.user_id,
            AnecdoteCreateRequest(type="anecdote", title="Paseo", text="Ana paseó por Lima."),
        )
        with session.begin():
            MemoriesRepository(session).mark_entities_failed(
                memory.id, elder_profile_id=memory_profile_id, content_version=1
            )
        return MemoriesService(session).get_memory(caregiver_account.user_id, memory.id)


@pytest.mark.parametrize("succeeded", [True, False])
def test_retry_commits_before_processing_and_keeps_the_original_memory(
    monkeypatch: pytest.MonkeyPatch,
    failed: MemoryResponse,
    caregiver_account: SimpleNamespace,
    succeeded: bool,
) -> None:
    def extract(text: str) -> ExtractionResult:
        with Session(engine) as session:
            saved = MemoriesRepository(session).get_memory(
                failed.id, elder_profile_id=failed.elder_profile_id
            )
            assert saved.entities_status == "pending"
            assert saved.content_version == 2
        assert text == failed.text
        return ExtractionResult(
            succeeded=succeeded,
            entities=[Entity(kind="place", text="Lima"), Entity(kind="place", text="Lima")]
            if succeeded
            else [],
        )

    monkeypatch.setattr(extraction, "extract_entities_with_status", extract)
    with TestClient(app) as client:
        response = client.post(retry_url(failed), headers=headers(caregiver_account))
        assert response.status_code == 202
        assert response.json()["entities_status"] == "pending"
        assert response.json()["id"] == str(failed.id)
        assert "content_version" not in response.json()
        saved = client.get(f"/memories/{failed.id}", headers=headers(caregiver_account)).json()
        assert saved["text"] == failed.text
        assert saved["entities_status"] == ("completed" if succeeded else "failed")
        assert saved["entities"] == ([{"kind": "place", "text": "Lima"}] if succeeded else [])
        assert client.get("/memories", headers=headers(caregiver_account)).json()["total"] == 1


def test_repeat_retry_does_not_schedule_twice_and_discards_old_results(
    monkeypatch: pytest.MonkeyPatch,
    failed: MemoryResponse,
    caregiver_account: SimpleNamespace,
) -> None:
    calls = []
    monkeypatch.setattr(router, "extract_anecdote_entities", lambda *args: calls.append(args))
    with TestClient(app) as client:
        assert client.post(retry_url(failed), headers=headers(caregiver_account)).status_code == 202
        repeated = client.post(retry_url(failed), headers=headers(caregiver_account))
        assert repeated.status_code == 409
        assert repeated.json()["detail"]["code"] == "extraction_not_failed"
        assert calls == [(failed.id, failed.elder_profile_id)]
    with Session(engine) as session, session.begin():
        repository = MemoriesRepository(session)
        assert not repository.replace_entities(
            failed.id,
            elder_profile_id=failed.elder_profile_id,
            content_version=1,
            entities=[(MemoryEntityKind.PLACE, "Obsoleto")],
        )
        assert not repository.mark_entities_failed(
            failed.id, elder_profile_id=failed.elder_profile_id, content_version=1
        )
        saved = repository.get_memory(failed.id, elder_profile_id=failed.elder_profile_id)
        assert saved.entities_status == "pending" and saved.entities == []


@pytest.mark.parametrize("status", ["pending", "completed", "song"])
def test_rejects_nonfailed_anecdotes_and_songs_without_calling_nlp(
    monkeypatch: pytest.MonkeyPatch,
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
    status: str,
) -> None:
    calls = []
    monkeypatch.setattr(router, "extract_anecdote_entities", lambda *args: calls.append(args))
    with Session(engine) as session:
        service = MemoriesService(session)
        memory = service.create_memory(
            caregiver_account.user_id,
            SongCreateRequest(type="song", title="Canción", url="https://youtu.be/abcdefghijk")
            if status == "song"
            else AnecdoteCreateRequest(type="anecdote", title="Paseo", text="Lima"),
        )
        if status == "completed":
            with session.begin():
                MemoriesRepository(session).replace_entities(
                    memory.id,
                    elder_profile_id=memory_profile_id,
                    content_version=1,
                    entities=[(MemoryEntityKind.PLACE, "Lima")],
                )
    with TestClient(app) as client:
        response = client.post(retry_url(memory), headers=headers(caregiver_account))
        assert response.status_code == (422 if status == "song" else 409)
        assert calls == []
        saved = client.get(f"/memories/{memory.id}", headers=headers(caregiver_account)).json()
        assert saved["entities_status"] == ("not_applicable" if status == "song" else status)
        if status == "completed":
            assert saved["entities"] == [{"kind": "place", "text": "Lima"}]


def test_retry_enforces_authentication_editor_and_family_boundaries(
    monkeypatch: pytest.MonkeyPatch,
    failed: MemoryResponse,
    caregiver_account: SimpleNamespace,
    family_member: SimpleNamespace,
    other_caregiver_account: SimpleNamespace,
) -> None:
    calls = []
    monkeypatch.setattr(router, "extract_anecdote_entities", lambda *args: calls.append(args))
    with Session(engine) as session:
        FamiliesService(session).save_elder_profile(
            other_caregiver_account.user_id, name="Otro perfil", birth_decade=1950, interests=[]
        )
    with TestClient(app) as client:
        assert client.post(retry_url(failed)).status_code == 401
        assert client.post(retry_url(failed), headers=headers(family_member)).status_code == 403
        foreign = client.post(retry_url(failed), headers=headers(other_caregiver_account))
        assert foreign.status_code == 404
        assert failed.text not in foreign.text
        assert (
            client.post(
                f"/memories/{uuid4()}/entities/retry", headers=headers(caregiver_account)
            ).status_code
            == 404
        )
        assert calls == []


@pytest.mark.parametrize("actor_role", ["author", "caregiver"])
def test_author_and_primary_caregiver_can_retry_a_members_anecdote(
    monkeypatch: pytest.MonkeyPatch,
    caregiver_account: SimpleNamespace,
    family_member: SimpleNamespace,
    memory_profile_id: UUID,
    actor_role: str,
) -> None:
    monkeypatch.setattr(router, "extract_anecdote_entities", lambda *args: None)
    with Session(engine) as session:
        memory = MemoriesService(session).create_memory(
            family_member.user_id,
            AnecdoteCreateRequest(type="anecdote", title="Paseo", text="Lima"),
        )
        with session.begin():
            MemoriesRepository(session).mark_entities_failed(
                memory.id, elder_profile_id=memory_profile_id, content_version=1
            )
    actor = family_member if actor_role == "author" else caregiver_account
    with TestClient(app) as client:
        assert client.post(retry_url(memory), headers=headers(actor)).status_code == 202
