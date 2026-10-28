from collections.abc import Iterator
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.families.service import FamiliesError, FamiliesService
from app.modules.memories.schemas import (
    AnecdoteCreateRequest,
    MemoryListRequest,
    MemoryPatchRequest,
    SongCreateRequest,
)
from app.modules.memories.service import MemoriesError, MemoriesService

pytestmark = pytest.mark.integration


@pytest.fixture
def service() -> Iterator[MemoriesService]:
    with Session(engine) as session:
        yield MemoriesService(session)


def test_both_roles_can_create_anecdotes_and_songs(
    service: MemoriesService,
    caregiver_account: SimpleNamespace,
    family_member: SimpleNamespace,
    memory_profile_id: UUID,
) -> None:
    anecdote = service.create_memory(
        caregiver_account.user_id,
        AnecdoteCreateRequest(
            type="anecdote",
            title="Paseo",
            text="Paseamos en familia.",
            is_positive=True,
            is_sensitive=True,
        ),
    )
    song = service.create_memory(
        family_member.user_id,
        SongCreateRequest(
            type="song",
            title="Canción",
            url="https://youtu.be/abcdefghijk",
        ),
    )
    assert anecdote.elder_profile_id == song.elder_profile_id == memory_profile_id
    assert anecdote.created_by == caregiver_account.user_id
    assert anecdote.is_positive and anecdote.is_sensitive
    assert anecdote.entities_status == "pending"
    assert song.created_by == family_member.user_id
    assert song.entities_status == "not_applicable"
    assert service.get_memory(family_member.user_id, anecdote.id) == anecdote


def test_creating_memory_requires_an_elder_profile(
    service: MemoriesService, caregiver_account: SimpleNamespace
) -> None:
    with pytest.raises(FamiliesError) as error:
        service.create_memory(
            caregiver_account.user_id,
            AnecdoteCreateRequest(
                type="anecdote",
                title="Paseo",
                text="Paseamos en familia.",
            ),
        )
    assert (error.value.code, error.value.status_code) == ("elder_profile_not_found", 404)


def test_list_hides_sensitive_filters_types_and_isolates_families(
    service: MemoriesService,
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
    other_caregiver_account: SimpleNamespace,
) -> None:
    normal = service.create_memory(
        caregiver_account.user_id,
        AnecdoteCreateRequest(
            type="anecdote",
            title="Paseo",
            text="Paseamos en familia.",
        ),
    )
    service.create_memory(
        caregiver_account.user_id,
        AnecdoteCreateRequest(
            type="anecdote",
            title="Privado",
            text="Un recuerdo.",
            is_sensitive=True,
        ),
    )
    with Session(engine) as session:
        FamiliesService(session).save_elder_profile(
            other_caregiver_account.user_id, name="Otro perfil", birth_decade=1950, interests=[]
        )
    service.create_memory(
        other_caregiver_account.user_id,
        SongCreateRequest(
            type="song",
            title="Canción",
            url="https://youtu.be/abcdefghijk",
        ),
    )
    default = service.list_memories(caregiver_account.user_id)
    assert [item.id for item in default.items] == [normal.id]
    assert default.total == 1
    assert (
        service.list_memories(
            caregiver_account.user_id, MemoryListRequest(include_sensitive=True, limit=1)
        ).total
        == 2
    )
    assert (
        service.list_memories(caregiver_account.user_id, MemoryListRequest(type="song")).total == 0
    )


def test_get_unknown_memory_returns_not_found(
    service: MemoriesService, caregiver_account: SimpleNamespace, memory_profile_id: UUID
) -> None:
    with pytest.raises(MemoriesError) as error:
        service.get_memory(caregiver_account.user_id, uuid4())
    assert (error.value.code, error.value.status_code) == ("memory_not_found", 404)


def test_author_and_primary_caregiver_can_edit_and_delete(
    service: MemoriesService,
    caregiver_account: SimpleNamespace,
    family_member: SimpleNamespace,
    memory_profile_id: UUID,
) -> None:
    for editor in (family_member, caregiver_account):
        memory = service.create_memory(
            family_member.user_id,
            AnecdoteCreateRequest(
                type="anecdote",
                title="Paseo",
                text="Paseamos en familia.",
            ),
        )
        updated = service.update_memory(
            editor.user_id,
            memory.id,
            MemoryPatchRequest(
                title="Paseo actualizado",
                is_positive=True,
            ),
        )
        assert updated.title == "Paseo actualizado"
        assert updated.is_positive
        service.delete_memory(editor.user_id, memory.id)
        with pytest.raises(MemoriesError) as error:
            service.get_memory(editor.user_id, memory.id)
        assert error.value.code == "memory_not_found"


@pytest.mark.parametrize("operation", ["update", "delete"])
def test_member_cannot_modify_another_authors_memory(
    service: MemoriesService,
    caregiver_account: SimpleNamespace,
    family_member: SimpleNamespace,
    memory_profile_id: UUID,
    operation: str,
) -> None:
    memory = service.create_memory(
        caregiver_account.user_id,
        AnecdoteCreateRequest(
            type="anecdote",
            title="Paseo",
            text="Paseamos en familia.",
        ),
    )
    with pytest.raises(MemoriesError) as error:
        if operation == "update":
            service.update_memory(
                family_member.user_id, memory.id, MemoryPatchRequest(title="Cambio")
            )
        else:
            service.delete_memory(family_member.user_id, memory.id)
    assert (error.value.code, error.value.status_code) == ("forbidden", 403)


@pytest.mark.parametrize("operation", ["get", "update", "delete"])
def test_another_familys_caregiver_cannot_access_memory(
    service: MemoriesService,
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
    other_caregiver_account: SimpleNamespace,
    operation: str,
) -> None:
    with Session(engine) as session:
        FamiliesService(session).save_elder_profile(
            other_caregiver_account.user_id, name="Otro perfil", birth_decade=1950, interests=[]
        )
    memory = service.create_memory(
        caregiver_account.user_id,
        AnecdoteCreateRequest(
            type="anecdote",
            title="Paseo",
            text="Paseamos en familia.",
        ),
    )
    with pytest.raises(MemoriesError) as error:
        if operation == "get":
            service.get_memory(other_caregiver_account.user_id, memory.id)
        elif operation == "update":
            service.update_memory(
                other_caregiver_account.user_id, memory.id, MemoryPatchRequest(title="Cambio")
            )
        else:
            service.delete_memory(other_caregiver_account.user_id, memory.id)
    assert (error.value.code, error.value.status_code) == ("memory_not_found", 404)


def test_patch_rejects_content_for_the_other_type(
    service: MemoriesService, caregiver_account: SimpleNamespace, memory_profile_id: UUID
) -> None:
    memory = service.create_memory(
        caregiver_account.user_id,
        AnecdoteCreateRequest(
            type="anecdote",
            title="Paseo",
            text="Paseamos en familia.",
        ),
    )
    with pytest.raises(MemoriesError) as error:
        service.update_memory(
            caregiver_account.user_id,
            memory.id,
            MemoryPatchRequest(
                url="https://youtu.be/abcdefghijk",
            ),
        )
    assert (error.value.code, error.value.status_code) == ("validation_error", 422)


def test_service_rejects_unknown_account(service: MemoriesService) -> None:
    with pytest.raises(FamiliesError) as error:
        service.list_memories(uuid4())
    assert (error.value.code, error.value.status_code) == ("unauthorized", 401)
