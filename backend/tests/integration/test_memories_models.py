from collections.abc import Iterator
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.memories.models import EntitiesStatus, Memory, MemoryEntity, MemoryType

pytestmark = pytest.mark.integration


@pytest.fixture
def session(caregiver_account: SimpleNamespace) -> Iterator[Session]:
    with Session(engine) as instance:
        yield instance


def test_anecdote_song_and_entities_are_persisted(
    session: Session, caregiver_account: SimpleNamespace, memory_profile_id: UUID
) -> None:
    anecdote = Memory(
        elder_profile_id=memory_profile_id,
        created_by=caregiver_account.user_id,
        type=MemoryType.ANECDOTE,
        title="Un paseo",
        text="Paseamos por Lima.",
        is_positive=True,
        is_sensitive=True,
        entities=[MemoryEntity(kind="place", text="Lima")],
    )
    song = Memory(
        elder_profile_id=memory_profile_id,
        created_by=caregiver_account.user_id,
        type=MemoryType.SONG,
        title="Una canción",
        url="https://youtu.be/abcdefghijk",
        entities_status=EntitiesStatus.NOT_APPLICABLE,
    )
    session.add_all([anecdote, song])
    session.flush()
    session.expire_all()
    assert anecdote.type is MemoryType.ANECDOTE
    assert anecdote.entities_status is EntitiesStatus.PENDING
    assert anecdote.is_positive and anecdote.is_sensitive
    assert anecdote.entities[0].text == "Lima"
    assert song.entities_status is EntitiesStatus.NOT_APPLICABLE
    assert not song.is_positive and not song.is_sensitive
    assert song.text is None
    assert anecdote.created_at.utcoffset() is not None


@pytest.mark.parametrize(
    "fields",
    [
        {"type": "anecdote", "text": None},
        {
            "type": "song",
            "text": "Texto",
            "url": "https://youtu.be/abcdefghijk",
            "entities_status": "not_applicable",
        },
        {"type": "song", "url": "https://youtu.be/abcdefghijk", "entities_status": "pending"},
    ],
)
def test_database_rejects_content_that_does_not_match_type(
    session: Session,
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
    fields: dict[str, object],
) -> None:
    session.add(
        Memory(
            elder_profile_id=memory_profile_id,
            created_by=caregiver_account.user_id,
            title="Recuerdo",
            **fields,
        )
    )
    with pytest.raises(IntegrityError, match="ck_memories_content_for_type"):
        session.flush()


def test_deleting_memory_removes_its_entities(
    session: Session, caregiver_account: SimpleNamespace, memory_profile_id: UUID
) -> None:
    memory = Memory(
        elder_profile_id=memory_profile_id,
        created_by=caregiver_account.user_id,
        type="anecdote",
        title="Un paseo",
        text="Paseamos por Lima.",
        entities=[MemoryEntity(kind="place", text="Lima")],
    )
    session.add(memory)
    session.flush()
    entity_id = memory.entities[0].id
    session.execute(delete(Memory).where(Memory.id == memory.id))
    assert session.scalar(select(MemoryEntity.id).where(MemoryEntity.id == entity_id)) is None


def test_database_rejects_memory_without_existing_profile(
    session: Session, caregiver_account: SimpleNamespace
) -> None:
    session.add(
        Memory(
            elder_profile_id=uuid4(),
            created_by=caregiver_account.user_id,
            type="anecdote",
            title="Un paseo",
            text="Paseamos en familia.",
        )
    )
    with pytest.raises(IntegrityError, match="memories_elder_profile_id_fkey"):
        session.flush()
