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
from app.modules.memories import extraction
from app.modules.memories.schemas import AnecdoteCreateRequest, MemoryResponse
from app.modules.memories.service import MemoriesService
from app.modules.nlp.service import ExtractionResult

pytestmark = [pytest.mark.integration, pytest.mark.usefixtures("isolated_security_environment")]


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setattr(
        extraction,
        "extract_entities_with_status",
        lambda text: ExtractionResult(entities=[], succeeded=True),
    )
    with TestClient(app) as instance:
        yield instance


@pytest.fixture
def anecdote(caregiver_account: SimpleNamespace, memory_profile_id: UUID) -> MemoryResponse:
    with Session(engine) as session:
        return MemoriesService(session).create_memory(
            caregiver_account.user_id,
            AnecdoteCreateRequest(
                type="anecdote",
                title="Paseo",
                text="Paseamos en familia.",
            ),
        )


@pytest.fixture
def other_profile_id(other_caregiver_account: SimpleNamespace) -> UUID:
    with Session(engine) as session:
        return (
            FamiliesService(session)
            .save_elder_profile(
                other_caregiver_account.user_id, name="Otro perfil", birth_decade=1950, interests=[]
            )
            .id
        )


def _headers(account: SimpleNamespace) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(account.user_id)}"}


def test_post_creates_anecdote_and_song_for_both_roles_and_schedules_extraction(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    family_member: SimpleNamespace,
    memory_profile_id: UUID,
) -> None:
    response = client.post(
        "/memories",
        headers=_headers(caregiver_account),
        json={
            "type": "anecdote",
            "title": "Paseo",
            "text": "Paseamos en familia.",
            "is_positive": True,
            "is_sensitive": False,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["created_by"] == str(caregiver_account.user_id)
    assert data["elder_profile_id"] == str(memory_profile_id)
    assert data["entities_status"] == "pending"
    assert data["created_at"].endswith("Z")
    read = client.get(f"/memories/{data['id']}", headers=_headers(caregiver_account))
    assert read.status_code == 200
    assert read.json()["entities_status"] == "completed"
    song = client.post(
        "/memories",
        headers=_headers(family_member),
        json={
            "type": "song",
            "title": "Canción",
            "url": "https://youtu.be/abcdefghijk",
        },
    )
    assert song.status_code == 201
    assert song.json()["created_by"] == str(family_member.user_id)
    assert song.json()["entities_status"] == "not_applicable"
    assert song.json()["url"] == "https://www.youtube.com/watch?v=abcdefghijk"


def test_post_rejects_invalid_song_url_with_uniform_error(
    client: TestClient, caregiver_account: SimpleNamespace
) -> None:
    response = client.post(
        "/memories",
        headers=_headers(caregiver_account),
        json={
            "type": "song",
            "title": "Canción",
            "url": "https://example.com/audio.mp3",
        },
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "song_url_invalid"
    assert set(response.json()["detail"]) == {"code", "message"}
    assert "example.com" not in response.text


def test_post_cannot_choose_another_family_or_author(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
    other_caregiver_account: SimpleNamespace,
    other_profile_id: UUID,
) -> None:
    response = client.post(
        "/memories",
        headers=_headers(caregiver_account),
        json={
            "type": "anecdote",
            "title": "Paseo",
            "text": "Paseamos en familia.",
            "elder_profile_id": str(other_profile_id),
            "created_by": str(other_caregiver_account.user_id),
        },
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation_error"
    assert client.get("/memories", headers=_headers(other_caregiver_account)).json()["total"] == 0


def test_get_list_hides_sensitive_by_default_and_supports_filters(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    family_member: SimpleNamespace,
    anecdote: MemoryResponse,
) -> None:
    with Session(engine) as session:
        MemoriesService(session).create_memory(
            caregiver_account.user_id,
            AnecdoteCreateRequest(
                type="anecdote",
                title="Privado",
                text="Un recuerdo.",
                is_sensitive=True,
            ),
        )
    response = client.get("/memories", headers=_headers(family_member))
    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [str(anecdote.id)]
    assert response.json()["total"] == 1
    included = client.get(
        "/memories",
        headers=_headers(family_member),
        params={
            "include_sensitive": "true",
            "type": "anecdote",
            "limit": 1,
            "offset": 0,
        },
    )
    assert included.status_code == 200
    assert included.json()["total"] == 2
    assert len(included.json()["items"]) == 1


def test_get_list_requires_bearer_token(client: TestClient) -> None:
    response = client.get("/memories")
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "unauthorized"


def test_get_list_excludes_another_family(
    client: TestClient,
    anecdote: MemoryResponse,
    other_caregiver_account: SimpleNamespace,
    other_profile_id: UUID,
) -> None:
    response = client.get("/memories", headers=_headers(other_caregiver_account))
    assert response.status_code == 200
    assert response.json()["items"] == []
    assert response.json()["total"] == 0
    assert str(anecdote.id) not in response.text


def test_get_memory_allows_family_member_and_explicit_sensitive_access(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    family_member: SimpleNamespace,
    anecdote: MemoryResponse,
) -> None:
    client.patch(
        f"/memories/{anecdote.id}",
        headers=_headers(caregiver_account),
        json={
            "is_sensitive": True,
        },
    )
    response = client.get(f"/memories/{anecdote.id}", headers=_headers(family_member))
    assert response.status_code == 200
    assert response.json()["id"] == str(anecdote.id)
    assert response.json()["is_sensitive"]


def test_get_unknown_memory_returns_not_found(
    client: TestClient, caregiver_account: SimpleNamespace, memory_profile_id: UUID
) -> None:
    response = client.get(f"/memories/{uuid4()}", headers=_headers(caregiver_account))
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "memory_not_found"


def test_get_memory_does_not_expose_another_familys_record(
    client: TestClient,
    anecdote: MemoryResponse,
    other_caregiver_account: SimpleNamespace,
    other_profile_id: UUID,
) -> None:
    response = client.get(f"/memories/{anecdote.id}", headers=_headers(other_caregiver_account))
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "memory_not_found"
    assert anecdote.text not in response.text


def test_patch_allows_author_and_primary_caregiver_and_reextracts_changed_text(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    family_member: SimpleNamespace,
    memory_profile_id: UUID,
) -> None:
    with Session(engine) as session:
        memory = MemoriesService(session).create_memory(
            family_member.user_id,
            AnecdoteCreateRequest(
                type="anecdote",
                title="Paseo",
                text="Un paseo.",
            ),
        )
    for actor, text in [(family_member, "Otro paseo."), (caregiver_account, "Paseamos juntos.")]:
        response = client.patch(
            f"/memories/{memory.id}",
            headers=_headers(actor),
            json={
                "text": text,
                "is_positive": False,
            },
        )
        assert response.status_code == 200
        assert response.json()["text"] == text
        assert response.json()["entities_status"] == "pending"
        assert not response.json()["is_positive"]
        read = client.get(f"/memories/{memory.id}", headers=_headers(actor))
        assert read.json()["entities_status"] == "completed"


def test_patch_rejects_content_for_the_other_memory_type(
    client: TestClient, caregiver_account: SimpleNamespace, anecdote: MemoryResponse
) -> None:
    response = client.patch(
        f"/memories/{anecdote.id}",
        headers=_headers(caregiver_account),
        json={
            "url": "https://youtu.be/abcdefghijk",
        },
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "validation_error"


def test_patch_forbids_family_member_who_is_not_author(
    client: TestClient, family_member: SimpleNamespace, anecdote: MemoryResponse
) -> None:
    response = client.patch(
        f"/memories/{anecdote.id}",
        headers=_headers(family_member),
        json={
            "title": "Cambio",
        },
    )
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "forbidden"


def test_delete_allows_author_and_primary_caregiver_and_returns_empty_body(
    client: TestClient,
    caregiver_account: SimpleNamespace,
    family_member: SimpleNamespace,
    memory_profile_id: UUID,
) -> None:
    for actor in (family_member, caregiver_account):
        with Session(engine) as session:
            memory = MemoriesService(session).create_memory(
                family_member.user_id,
                AnecdoteCreateRequest(
                    type="anecdote",
                    title="Paseo",
                    text="Un paseo.",
                ),
            )
        response = client.delete(f"/memories/{memory.id}", headers=_headers(actor))
        assert response.status_code == 204
        assert response.content == b""
        assert client.get(f"/memories/{memory.id}", headers=_headers(actor)).status_code == 404


def test_delete_unknown_memory_returns_not_found(
    client: TestClient, caregiver_account: SimpleNamespace, memory_profile_id: UUID
) -> None:
    response = client.delete(f"/memories/{uuid4()}", headers=_headers(caregiver_account))
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "memory_not_found"


def test_delete_forbids_family_member_who_is_not_author(
    client: TestClient, family_member: SimpleNamespace, anecdote: MemoryResponse
) -> None:
    response = client.delete(f"/memories/{anecdote.id}", headers=_headers(family_member))
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "forbidden"
