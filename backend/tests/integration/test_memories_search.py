from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.db import engine
from app.core.security import create_access_token
from app.main import app
from app.modules.memories.models import MemoryEntityKind
from app.modules.memories.repository import MemoriesRepository
from app.modules.memories.schemas import AnecdoteCreateRequest
from app.modules.memories.service import MemoriesService

pytestmark = [pytest.mark.integration, pytest.mark.usefixtures("isolated_security_environment")]


def test_search_matches_text_and_entities_before_pagination_without_duplicates(
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
) -> None:
    with Session(engine) as session:
        service = MemoriesService(session)
        ids = []
        for title, text in [
            ("LIMA de paseo", "Un viaje."),
            ("Vacaciones", "Visitamos Lima."),
            ("Destino", "Un viaje."),
            ("Otro", "Sin coincidencias."),
        ]:
            ids.append(
                service.create_memory(
                    caregiver_account.user_id,
                    AnecdoteCreateRequest(type="anecdote", title=title, text=text),
                ).id
            )
        with session.begin():
            MemoriesRepository(session).replace_entities(
                ids[2],
                elder_profile_id=memory_profile_id,
                content_version=1,
                entities=[
                    (MemoryEntityKind.PLACE, "Lima"),
                    (MemoryEntityKind.PERSON, "Lima familiar"),
                ],
            )
    headers = {"Authorization": f"Bearer {create_access_token(caregiver_account.user_id)}"}
    with TestClient(app) as client:
        pages = [
            client.get(
                "/memories", headers=headers, params={"q": "  lima  ", "limit": 1, "offset": offset}
            )
            for offset in range(3)
        ]
        assert all(page.status_code == 200 for page in pages)
        assert all(page.json()["total"] == 3 for page in pages)
        assert {page.json()["items"][0]["id"] for page in pages} == set(map(str, ids[:3]))
        assert (
            client.get("/memories", headers=headers, params={"q": "ausente"}).json()["total"] == 0
        )


def test_search_preserves_family_and_sensitive_filters_and_escapes_wildcards(
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
    other_caregiver_account: SimpleNamespace,
) -> None:
    from app.modules.families.service import FamiliesService

    with Session(engine) as session:
        FamiliesService(session).save_elder_profile(
            other_caregiver_account.user_id, name="Otro perfil", birth_decade=1950, interests=[]
        )
        service = MemoriesService(session)
        for actor, sensitive in [
            (caregiver_account, False),
            (caregiver_account, True),
            (other_caregiver_account, False),
        ]:
            service.create_memory(
                actor.user_id,
                AnecdoteCreateRequest(
                    type="anecdote",
                    title="100%_familiar",
                    text="Un recuerdo.",
                    is_sensitive=sensitive,
                ),
            )
        service.create_memory(
            caregiver_account.user_id,
            AnecdoteCreateRequest(type="anecdote", title="100xxfamiliar", text="Otro recuerdo."),
        )
    headers = {"Authorization": f"Bearer {create_access_token(caregiver_account.user_id)}"}
    with TestClient(app) as client:
        response = client.get("/memories", headers=headers, params={"q": "%_"})
        assert response.status_code == 200
        assert response.json()["total"] == 1
        assert response.json()["items"][0]["title"] == "100%_familiar"
        assert (
            client.get(
                "/memories", headers=headers, params={"q": "%_", "include_sensitive": True}
            ).json()["total"]
            == 2
        )
        assert (
            client.get("/memories", headers=headers, params={"q": "%_", "type": "song"}).json()[
                "total"
            ]
            == 0
        )
        assert client.get("/memories", params={"q": "%_"}).status_code == 401
        for query in [" ", "x" * 101]:
            rejected = client.get("/memories", headers=headers, params={"q": query})
            assert rejected.status_code == 422
            assert rejected.json()["detail"]["code"] == "validation_error"
