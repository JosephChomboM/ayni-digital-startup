from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import UUID

import pytest
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.billing.errors import BillingError
from app.modules.billing.models import Subscription
from app.modules.memories.schemas import AnecdoteCreateRequest, MemoryPatchRequest
from app.modules.memories.service import MemoriesService
from app.modules.sessions.models import FamilySession
from app.modules.sessions.service import SessionsService

pytestmark = pytest.mark.integration


def seed(actor: UUID) -> UUID:
    with Session(engine) as session:
        return (
            MemoriesService(session)
            .create_memory(
                actor,
                AnecdoteCreateRequest(
                    type="anecdote",
                    title="Un paseo",
                    text="Un paseo familiar.",
                    is_positive=True,
                ),
            )
            .id
        )


def test_generation_is_persisted_and_shared_with_family_members(
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
    family_member: SimpleNamespace,
) -> None:
    memory_id = seed(caregiver_account.user_id)
    with Session(engine) as session:
        created = SessionsService(session).generate_session(family_member.user_id)
    assert created.created_by == family_member.user_id
    assert created.elder_profile_id == memory_profile_id
    assert sum(step.duration_minutes for step in created.steps) == 15
    assert [step.memory_id for step in created.steps if step.memory_available] == [memory_id]
    with Session(engine) as session:
        service = SessionsService(session)
        assert service.get_session(caregiver_account.user_id, created.id) == created
        history = service.list_sessions(caregiver_account.user_id)
        assert history.total == 1 and history.items[0].id == created.id


def test_free_generation_limit_resets_after_seven_days(
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
) -> None:
    seed(caregiver_account.user_id)
    with Session(engine) as session:
        service = SessionsService(session)
        first = service.generate_session(caregiver_account.user_id)
        with pytest.raises(BillingError) as error:
            service.generate_session(caregiver_account.user_id)
        assert error.value.code == "session_limit_reached"
        with session.begin():
            stored = session.get(FamilySession, first.id)
            assert stored is not None
            stored.created_at = datetime.now(UTC) - timedelta(days=8)
        second = service.generate_session(caregiver_account.user_id)
        assert second.id != first.id


def test_paid_generation_and_history_preserve_steps_without_exposing_changed_or_deleted_content(
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
) -> None:
    memory_id = seed(caregiver_account.user_id)
    with Session(engine) as session:
        with session.begin():
            session.add(
                Subscription(
                    family_id=caregiver_account.family_id,
                    status="active",
                    paid_until=datetime.now(UTC) + timedelta(days=1),
                )
            )
        service = SessionsService(session)
        first = service.generate_session(caregiver_account.user_id)
        second = service.generate_session(caregiver_account.user_id)
        assert first.id != second.id
        memories = MemoriesService(session)
        memories.update_memory(
            caregiver_account.user_id, memory_id, MemoryPatchRequest(is_sensitive=True)
        )
        changed = service.get_session(caregiver_account.user_id, first.id)
        assert [item.instruction for item in changed.steps] == [
            item.instruction for item in first.steps
        ]
        content = next(item for item in changed.steps if item.source_memory_id)
        assert content.memory_id is None and not content.memory_available
        memories.delete_memory(caregiver_account.user_id, memory_id)
        deleted = service.get_session(caregiver_account.user_id, first.id)
        assert (
            next(item for item in deleted.steps if item.source_memory_id).source_memory_id
            == memory_id
        )
        assert service.list_sessions(caregiver_account.user_id).total == 2
