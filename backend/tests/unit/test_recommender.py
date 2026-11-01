from collections.abc import Sequence

import pytest
from pydantic import ValidationError

from app.modules.recommender import service
from app.modules.recommender.service import MemoryCandidate, SessionFeedback, rank_memories


def memory(key: str, kind: str = "photo", **fields: object) -> MemoryCandidate:
    return MemoryCandidate(
        memory_id=key, kind=kind, **{"is_positive": True, "is_sensitive": False, **fields}
    )


def history(key: str, reaction: str, count: int = 3) -> list[SessionFeedback]:
    return [SessionFeedback(memory_ids=(key,), reaction=reaction) for _ in range(count)]


def ids(memories: Sequence[MemoryCandidate]) -> list[str]:
    return [item.memory_id for item in memories]


@pytest.mark.parametrize("count", [0, 1, 2])
def test_insufficient_history_preserves_order(count: int) -> None:
    candidates = [memory("song", "song"), memory("photo")]
    assert rank_memories(candidates, history("photo", "receptivo", count)) == candidates


@pytest.mark.parametrize("reaction", ["receptivo", "emocionado"])
def test_three_positive_sessions_promote_similar_content(reaction: str) -> None:
    candidates = [memory("song", "song"), memory("new"), memory("old")]
    result = rank_memories(candidates, history("old", reaction))
    assert ids(result) == ["new", "old", "song"]
    assert ids(candidates) == ["song", "new", "old"]


def test_tags_help_rank_memories_of_the_same_kind() -> None:
    candidates = [
        memory("other", tags=("cocina",)),
        memory("related", tags=(" FÚTBOL ", "fútbol", "")),
        memory("known", tags=("fútbol",)),
    ]
    assert ids(rank_memories(candidates, history("known", "emocionado"))) == [
        "related",
        "known",
        "other",
    ]


def test_agitation_demotes_related_content() -> None:
    candidates = [memory("photo"), memory("song", "song")]
    assert ids(rank_memories(candidates, history("photo", "agitado"))) == ["song", "photo"]


def test_accumulated_reactions_outweigh_one_opposite_response() -> None:
    candidates = [memory("photo"), memory("song", "song")]
    feedback = history("song", "receptivo", 2) + history("song", "agitado", 1)
    assert ids(rank_memories(candidates, feedback)) == ["song", "photo"]


def test_indifference_is_neutral_and_does_not_unlock_ranking() -> None:
    candidates = [memory("photo"), memory("song", "song")]
    feedback = history("song", "receptivo", 2) + history("photo", "indiferente", 10)
    assert rank_memories(candidates, feedback) == candidates


def test_unknown_and_unsafe_history_does_not_count() -> None:
    candidates = [memory("photo"), memory("song", "song"), memory("unsafe", is_sensitive=True)]
    feedback = history("song", "receptivo", 2)
    feedback += history("deleted", "emocionado") + history("unsafe", "emocionado")
    assert ids(rank_memories(candidates, feedback)) == ["photo", "song"]


@pytest.mark.parametrize("enabled", [True, False])
def test_unsafe_memories_are_always_excluded(enabled: bool) -> None:
    candidates = [
        memory("sensitive", is_sensitive=True),
        memory("negative", is_positive=False),
        memory("unmarked", is_positive=False, is_sensitive=True),
        memory("safe"),
    ]
    assert ids(rank_memories(candidates, [], enabled=enabled)) == ["safe"]
    assert rank_memories(candidates[:3], [], enabled=enabled) == []


def test_disabling_ranking_preserves_safe_order() -> None:
    candidates = [memory("photo"), memory("song", "song")]
    assert rank_memories(candidates, history("song", "receptivo"), enabled=False) == candidates


def test_a_multi_item_session_counts_once() -> None:
    candidates = [memory("photo"), memory("song", "song")]
    feedback = [SessionFeedback(memory_ids=("song", "song", "photo"), reaction="receptivo")]
    assert rank_memories(candidates, feedback) == candidates


def test_duplicate_items_do_not_amplify_a_session_signal() -> None:
    candidates = [memory("photo"), memory("song", "song")]
    feedback = [
        SessionFeedback(memory_ids=("song", "song", "photo"), reaction="receptivo")
        for _ in range(3)
    ]
    assert rank_memories(candidates, feedback) == candidates


@pytest.mark.parametrize("error", [RuntimeError, ImportError])
def test_ranking_failure_preserves_only_safe_memories(
    monkeypatch: pytest.MonkeyPatch, error: type[Exception]
) -> None:
    def fail(*args: object) -> list[float]:
        raise error("synthetic failure")

    monkeypatch.setattr(service, "_score_memories", fail)
    candidates = [memory("photo"), memory("unsafe", is_sensitive=True), memory("song", "song")]
    assert ids(rank_memories(candidates, history("song", "receptivo"))) == ["photo", "song"]


def test_no_candidates() -> None:
    assert rank_memories([], []) == []


@pytest.mark.parametrize("reaction", ["unknown", "", "calmado"])
def test_unknown_reactions_are_rejected(reaction: str) -> None:
    with pytest.raises(ValidationError):
        SessionFeedback(memory_ids=("one",), reaction=reaction)


def test_eligibility_flags_are_required() -> None:
    with pytest.raises(ValidationError):
        MemoryCandidate(memory_id="one", kind="photo")
