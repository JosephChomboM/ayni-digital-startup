from types import SimpleNamespace
from uuid import UUID

import pytest
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.families.models import ElderProfile
from app.modules.memories.models import Memory
from app.modules.memories.schemas import AnecdoteCreateRequest
from app.modules.memories.service import MemoriesService
from app.modules.sessions.models import FamilySession, SessionItem

pytestmark = pytest.mark.integration


def test_session_and_ordered_steps_survive_a_new_database_session(
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
) -> None:
    with Session(engine) as session, session.begin():
        record = FamilySession(
            elder_profile_id=memory_profile_id,
            created_by=caregiver_account.user_id,
            template_version="1.0",
            duration_minutes=15,
            items=[
                SessionItem(position=2, duration_minutes=13, instruction="Conversemos."),
                SessionItem(position=1, duration_minutes=2, instruction="Bienvenida."),
            ],
        )
        session.add(record)
        session.flush()
        session_id = record.id
    with Session(engine) as session:
        saved = session.get(FamilySession, session_id)
        assert saved is not None
        assert saved.elder_profile_id == memory_profile_id
        assert saved.created_at.utcoffset() is not None
        assert [item.position for item in saved.items] == [1, 2]
        assert sum(item.duration_minutes for item in saved.items) == 15


def test_deleting_memory_clears_live_link_and_profile_deletion_removes_guide(
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
) -> None:
    with Session(engine) as session:
        memory = MemoriesService(session).create_memory(
            caregiver_account.user_id,
            AnecdoteCreateRequest(type="anecdote", title="Paseo", text="Un paseo familiar."),
        )
        with session.begin():
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
                        memory_id=memory.id,
                        source_memory_id=memory.id,
                    )
                ],
            )
            session.add(record)
            session.flush()
            session_id, item_id = record.id, record.items[0].id
        with session.begin():
            session.execute(delete(Memory).where(Memory.id == memory.id))
    with Session(engine) as session, session.begin():
        item = session.get(SessionItem, item_id)
        assert item is not None and item.memory_id is None
        assert item.source_memory_id == memory.id
        session.execute(delete(ElderProfile).where(ElderProfile.id == memory_profile_id))
    with Session(engine) as session:
        assert session.get(FamilySession, session_id) is None
        assert session.scalar(select(SessionItem.id).where(SessionItem.id == item_id)) is None
