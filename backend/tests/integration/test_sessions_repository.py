from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.families.service import FamiliesService
from app.modules.memories.schemas import AnecdoteCreateRequest
from app.modules.memories.service import MemoriesService
from app.modules.sessions.repository import SessionsRepository
from app.modules.sessions.schemas import GuideMemory, SessionGuide
from app.modules.sessions.service import build_session_guide

pytestmark = pytest.mark.integration


def guide_for(account: SimpleNamespace, profile_id: UUID) -> SessionGuide:
    with Session(engine) as session:
        memory = MemoriesService(session).create_memory(
            account.user_id,
            AnecdoteCreateRequest(
                type="anecdote",
                title="Paseo",
                text="Un paseo familiar.",
                is_positive=True,
            ),
        )
    return build_session_guide(
        profile_id,
        [
            GuideMemory(
                id=memory.id,
                elder_profile_id=profile_id,
                type="anecdote",
                title=memory.title,
                is_positive=True,
                is_sensitive=False,
            )
        ],
    )


def test_repository_persists_generated_steps_and_returns_stable_paginated_history(
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
) -> None:
    guide = guide_for(caregiver_account, memory_profile_id)
    with Session(engine) as session, session.begin():
        repository = SessionsRepository(session)
        saved_ids = [
            repository.create_session(
                elder_profile_id=memory_profile_id,
                created_by=caregiver_account.user_id,
                guide=guide,
            ).id
            for _ in range(3)
        ]
    with Session(engine) as session:
        repository = SessionsRepository(session)
        first = repository.list_sessions(elder_profile_id=memory_profile_id, limit=2)
        second = repository.list_sessions(elder_profile_id=memory_profile_id, limit=2, offset=2)
        all_ids = [item.id for item in first + second]
        assert set(all_ids) == set(saved_ids) and len(set(all_ids)) == 3
        assert all_ids == [
            item.id for item in repository.list_sessions(elder_profile_id=memory_profile_id)
        ]
        assert repository.count_sessions(elder_profile_id=memory_profile_id) == 3
        detail = repository.get_session(saved_ids[0], elder_profile_id=memory_profile_id)
        assert detail is not None
        assert [item.instruction for item in detail.items] == [
            step.instruction for step in guide.steps
        ]
        assert [item.source_memory_id for item in detail.items if item.source_memory_id] == list(
            guide.memory_ids
        )


def test_repository_hides_another_family_session_and_returns_empty_history(
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
    other_caregiver_account: SimpleNamespace,
) -> None:
    guide = guide_for(caregiver_account, memory_profile_id)
    with Session(engine) as session:
        other_profile = (
            FamiliesService(session)
            .save_elder_profile(
                other_caregiver_account.user_id,
                name="Otro perfil",
                birth_decade=1940,
                interests=[],
            )
            .id
        )
        with session.begin():
            session_id = (
                SessionsRepository(session)
                .create_session(
                    elder_profile_id=memory_profile_id,
                    created_by=caregiver_account.user_id,
                    guide=guide,
                )
                .id
            )
    with Session(engine) as session:
        repository = SessionsRepository(session)
        assert repository.get_session(session_id, elder_profile_id=other_profile) is None
        assert repository.get_session(uuid4(), elder_profile_id=memory_profile_id) is None
        assert repository.list_sessions(elder_profile_id=other_profile) == []
        assert repository.count_sessions(elder_profile_id=other_profile) == 0
