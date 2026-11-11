from types import SimpleNamespace
from uuid import UUID

import pytest
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.families.service import FamiliesService
from app.modules.memories.models import Memory
from app.modules.memories.schemas import AnecdoteCreateRequest
from app.modules.memories.service import MemoriesService

pytestmark = pytest.mark.integration


def test_session_candidates_and_availability_exclude_unsafe_and_foreign_memories(
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
    other_caregiver_account: SimpleNamespace,
) -> None:
    with Session(engine) as session:
        service = MemoriesService(session)
        ids = []
        for positive, sensitive in [(True, False), (False, False), (True, True), (True, False)]:
            ids.append(
                service.create_memory(
                    caregiver_account.user_id,
                    AnecdoteCreateRequest(
                        type="anecdote",
                        title="Paseo",
                        text="Un paseo familiar.",
                        is_positive=positive,
                        is_sensitive=sensitive,
                    ),
                ).id
            )
        FamiliesService(session).save_elder_profile(
            other_caregiver_account.user_id, name="Otro perfil", birth_decade=1940, interests=[]
        )
        foreign = service.create_memory(
            other_caregiver_account.user_id,
            AnecdoteCreateRequest(
                type="anecdote",
                title="Otro paseo",
                text="Otro paseo familiar.",
                is_positive=True,
            ),
        )
        with session.begin():
            pending = session.get(Memory, ids[-1])
            assert pending is not None
            pending.deletion_pending = True
        with session.begin():
            selected = service.select_session_memories(memory_profile_id)
            assert [memory.id for memory in selected] == ids[:1]
            assert service.available_session_memory_ids(memory_profile_id, [*ids, foreign.id]) == {
                ids[0]
            }
        with pytest.raises(RuntimeError, match="transaction"):
            service.select_session_memories(memory_profile_id)
