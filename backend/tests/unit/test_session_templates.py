from uuid import UUID, uuid4

import pytest

from app.core.errors import ApplicationError
from app.modules.sessions.schemas import GuideMemory
from app.modules.sessions.service import build_session_guide


def candidate(profile_id: UUID, number: int, **changes: object) -> GuideMemory:
    return GuideMemory.model_validate(
        {
            "id": UUID(int=number),
            "elder_profile_id": profile_id,
            "type": "anecdote",
            "title": "Un paseo",
            "is_positive": True,
            "is_sensitive": False,
            **changes,
        }
    )


@pytest.mark.parametrize("count", [1, 2, 3, 5])
def test_guide_has_fifteen_minutes_and_at_most_three_unique_memories(count: int) -> None:
    profile = uuid4()
    memories = [candidate(profile, number) for number in range(1, count + 1)]
    guide = build_session_guide(profile, [*memories, memories[0]])
    assert guide.duration_minutes == sum(step.duration_minutes for step in guide.steps) == 15
    assert guide.memory_ids == tuple(item.id for item in memories[:3])
    assert [step.memory_id for step in guide.steps if step.memory_id] == list(guide.memory_ids)
    assert [step.position for step in guide.steps] == list(range(1, len(guide.steps) + 1))
    assert guide == build_session_guide(profile, list(reversed(memories)))


def test_guide_excludes_sensitive_non_positive_foreign_and_deleting_memories() -> None:
    profile = uuid4()
    allowed = candidate(profile, 1)
    guide = build_session_guide(
        profile,
        [
            allowed,
            candidate(profile, 2, is_sensitive=True),
            candidate(profile, 3, is_positive=False),
            candidate(uuid4(), 4),
            candidate(profile, 5, deletion_pending=True),
        ],
    )
    assert guide.memory_ids == (allowed.id,)


def test_no_allowed_memories_returns_clear_error_instead_of_empty_success() -> None:
    profile = uuid4()
    with pytest.raises(ApplicationError) as raised:
        build_session_guide(profile, [candidate(profile, 1, is_sensitive=True)])
    assert raised.value.code == "no_eligible_memories"
    assert raised.value.status_code == 409
    with pytest.raises(ApplicationError):
        build_session_guide(profile, [])


def test_song_and_anecdote_have_distinct_optional_family_prompts() -> None:
    profile = uuid4()
    guide = build_session_guide(
        profile, [candidate(profile, 1), candidate(profile, 2, type="song")]
    )
    assert "anécdota" in guide.steps[1].instruction
    assert "canción" in guide.steps[2].instruction
    assert "parar" in guide.steps[0].instruction
    assert "descansar" in guide.steps[-1].instruction
