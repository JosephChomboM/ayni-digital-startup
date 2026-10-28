from collections.abc import Iterator
from types import SimpleNamespace
from uuid import UUID

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.families.service import FamiliesService
from app.modules.memories.models import EntitiesStatus, MemoryEntity, MemoryEntityKind, MemoryType
from app.modules.memories.repository import MemoriesRepository

pytestmark = pytest.mark.integration


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


@pytest.fixture
def repository(memory_profile_id: UUID, other_profile_id: UUID) -> Iterator[MemoriesRepository]:
    with Session(engine) as session:
        yield MemoriesRepository(session)


def test_create_and_get_anecdote_and_song(
    repository: MemoriesRepository, memory_profile_id: UUID, caregiver_account: SimpleNamespace
) -> None:
    anecdote = repository.create_memory(
        elder_profile_id=memory_profile_id,
        created_by=caregiver_account.user_id,
        type=MemoryType.ANECDOTE,
        title="Paseo",
        text="Un paseo en familia.",
    )
    song = repository.create_memory(
        elder_profile_id=memory_profile_id,
        created_by=caregiver_account.user_id,
        type=MemoryType.SONG,
        title="Canción",
        url="https://youtu.be/abcdefghijk",
    )
    assert repository.get_memory(anecdote.id, elder_profile_id=memory_profile_id) is anecdote
    assert anecdote.entities == []
    assert anecdote.entities_status is EntitiesStatus.PENDING
    assert song.entities_status is EntitiesStatus.NOT_APPLICABLE
    assert not anecdote.is_positive and not anecdote.is_sensitive


def test_list_and_count_apply_profile_sensitive_type_and_pagination_filters(
    repository: MemoriesRepository,
    memory_profile_id: UUID,
    other_profile_id: UUID,
    caregiver_account: SimpleNamespace,
    other_caregiver_account: SimpleNamespace,
) -> None:
    ordinary = repository.create_memory(
        elder_profile_id=memory_profile_id,
        created_by=caregiver_account.user_id,
        type=MemoryType.ANECDOTE,
        title="Paseo",
        text="Un paseo en familia.",
    )
    sensitive = repository.create_memory(
        elder_profile_id=memory_profile_id,
        created_by=caregiver_account.user_id,
        type=MemoryType.ANECDOTE,
        title="Privado",
        text="Un recuerdo.",
        is_positive=True,
        is_sensitive=True,
    )
    song = repository.create_memory(
        elder_profile_id=memory_profile_id,
        created_by=caregiver_account.user_id,
        type=MemoryType.SONG,
        title="Canción",
        url="https://youtu.be/abcdefghijk",
    )
    repository.create_memory(
        elder_profile_id=other_profile_id,
        created_by=other_caregiver_account.user_id,
        type=MemoryType.ANECDOTE,
        title="Otro recuerdo",
        text="Otro paseo.",
    )
    assert {item.id for item in repository.list_memories(elder_profile_id=memory_profile_id)} == {
        ordinary.id,
        song.id,
    }
    assert repository.count_memories(elder_profile_id=memory_profile_id) == 2
    assert (
        repository.count_memories(elder_profile_id=memory_profile_id, include_sensitive=True) == 3
    )
    assert repository.count_memories(elder_profile_id=memory_profile_id, type=MemoryType.SONG) == 1
    assert repository.list_memories(elder_profile_id=memory_profile_id, type=MemoryType.SONG) == [
        song
    ]
    all_items = repository.list_memories(elder_profile_id=memory_profile_id, include_sensitive=True)
    assert sensitive in all_items
    assert [item.id for item in all_items] == sorted(
        [ordinary.id, sensitive.id, song.id], reverse=True
    )
    assert (
        repository.list_memories(
            elder_profile_id=memory_profile_id, include_sensitive=True, limit=1, offset=1
        )
        == all_items[1:2]
    )


def test_editing_text_invalidates_entities_and_discards_results_for_old_version(
    repository: MemoriesRepository, memory_profile_id: UUID, caregiver_account: SimpleNamespace
) -> None:
    memory = repository.create_memory(
        elder_profile_id=memory_profile_id,
        created_by=caregiver_account.user_id,
        type=MemoryType.ANECDOTE,
        title="Paseo",
        text="Paseamos por Lima.",
    )
    assert repository.replace_entities(
        memory.id,
        elder_profile_id=memory_profile_id,
        content_version=1,
        entities=[(MemoryEntityKind.PLACE, "Lima"), (MemoryEntityKind.PLACE, "lima")],
    )
    assert len(memory.entities) == 1
    assert memory.entities_status is EntitiesStatus.COMPLETED
    repository.update_memory(
        memory.id, elder_profile_id=memory_profile_id, changes={"is_positive": True}
    )
    assert memory.entities_status is EntitiesStatus.COMPLETED
    repository.update_memory(
        memory.id, elder_profile_id=memory_profile_id, changes={"text": "Paseamos por Cusco."}
    )
    assert memory.content_version == 2
    assert memory.entities == []
    assert memory.entities_status is EntitiesStatus.PENDING
    assert not repository.replace_entities(
        memory.id,
        elder_profile_id=memory_profile_id,
        content_version=1,
        entities=[(MemoryEntityKind.PLACE, "Lima")],
    )
    assert repository.replace_entities(
        memory.id, elder_profile_id=memory_profile_id, content_version=2, entities=[]
    )
    assert memory.entities_status is EntitiesStatus.COMPLETED


def test_mark_entities_failed_is_persisted_for_matching_pending_version(
    repository: MemoriesRepository, memory_profile_id: UUID, caregiver_account: SimpleNamespace
) -> None:
    memory = repository.create_memory(
        elder_profile_id=memory_profile_id,
        created_by=caregiver_account.user_id,
        type=MemoryType.ANECDOTE,
        title="Paseo",
        text="Un paseo en familia.",
    )
    assert repository.mark_entities_failed(
        memory.id, elder_profile_id=memory_profile_id, content_version=1
    )
    repository.session.expire_all()
    assert memory.entities_status is EntitiesStatus.FAILED
    assert memory.entities == []


def test_profile_scope_protects_reads_updates_deletes_and_extraction_results(
    repository: MemoriesRepository,
    memory_profile_id: UUID,
    other_profile_id: UUID,
    caregiver_account: SimpleNamespace,
) -> None:
    memory = repository.create_memory(
        elder_profile_id=memory_profile_id,
        created_by=caregiver_account.user_id,
        type=MemoryType.ANECDOTE,
        title="Paseo",
        text="Un paseo en familia.",
    )
    assert repository.get_memory(memory.id, elder_profile_id=other_profile_id) is None
    assert (
        repository.update_memory(
            memory.id, elder_profile_id=other_profile_id, changes={"title": "Cambio"}
        )
        is None
    )
    assert not repository.delete_memory(memory.id, elder_profile_id=other_profile_id)
    assert not repository.replace_entities(
        memory.id, elder_profile_id=other_profile_id, content_version=1, entities=[]
    )
    assert not repository.mark_entities_failed(
        memory.id, elder_profile_id=other_profile_id, content_version=1
    )
    assert memory.title == "Paseo"
    assert memory.entities_status is EntitiesStatus.PENDING


def test_delete_memory_removes_entities_and_returns_false_when_already_deleted(
    repository: MemoriesRepository, memory_profile_id: UUID, caregiver_account: SimpleNamespace
) -> None:
    memory = repository.create_memory(
        elder_profile_id=memory_profile_id,
        created_by=caregiver_account.user_id,
        type=MemoryType.ANECDOTE,
        title="Paseo",
        text="Paseamos por Lima.",
    )
    repository.replace_entities(
        memory.id,
        elder_profile_id=memory_profile_id,
        content_version=1,
        entities=[(MemoryEntityKind.PLACE, "Lima")],
    )
    assert repository.delete_memory(memory.id, elder_profile_id=memory_profile_id)
    assert (
        repository.session.scalar(
            select(MemoryEntity.id).where(MemoryEntity.memory_id == memory.id)
        )
        is None
    )
    assert not repository.delete_memory(memory.id, elder_profile_id=memory_profile_id)
