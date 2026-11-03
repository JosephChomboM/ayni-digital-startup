from datetime import UTC, datetime, timedelta, timezone
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.modules.insights.service import ReactionRecord, summarize_reactions

START = datetime(2026, 11, 1, tzinfo=UTC)
END = START + timedelta(days=1)
PROFILE = uuid4()


def record(**changes: object) -> ReactionRecord:
    return ReactionRecord.model_validate(
        {
            "session_id": uuid4(),
            "elder_profile_id": PROFILE,
            "occurred_at": START,
            "reaction": "receptivo",
            **changes,
        }
    )


def test_counts_each_reaction_once_and_returns_zeros_without_activity() -> None:
    records = [
        record(reaction=reaction)
        for reaction in ["receptivo", "emocionado", "indiferente", "agitado"]
    ]
    summary = summarize_reactions(PROFILE, records + [records[0]], start=START, end=END)
    assert summary.total == 4
    assert summary.model_dump(mode="json")["counts"] == {
        "receptivo": 1,
        "emocionado": 1,
        "indiferente": 1,
        "agitado": 1,
    }
    assert (
        summary.disclaimer == "Esto no es un diagnóstico. Es un registro de actividades familiares."
    )
    empty = summarize_reactions(PROFILE, [], start=START, end=END)
    assert empty.total == 0
    assert len(empty.counts) == 4
    assert all(value == 0 for value in empty.counts.values())


def test_time_window_is_start_inclusive_end_exclusive_with_timezone_conversion() -> None:
    lima = timezone(timedelta(hours=-5))
    at_start = record(occurred_at=START.astimezone(lima))
    same_in_utc = at_start.model_copy(update={"occurred_at": START})
    records = [
        record(occurred_at=START - timedelta(microseconds=1)),
        at_start,
        same_in_utc,
        record(occurred_at=END - timedelta(microseconds=1)),
        record(occurred_at=END),
    ]
    summary = summarize_reactions(
        PROFILE, list(reversed(records)), start=START.astimezone(lima), end=END.astimezone(lima)
    )
    assert summary.total == 2
    assert summary.start == START and summary.end == END
    assert len(records) == 5


def test_rejects_other_profile_even_if_outside_period() -> None:
    with pytest.raises(ValueError, match="perfil autorizado"):
        summarize_reactions(
            PROFILE, [record(elder_profile_id=uuid4(), occurred_at=END)], start=START, end=END
        )


@pytest.mark.parametrize("changes", [{"reaction": "agitado"}, {"occurred_at": END}])
def test_rejects_conflicting_duplicate_sessions(changes: dict[str, object]) -> None:
    original = record()
    conflict = ReactionRecord.model_validate({**original.model_dump(), **changes})
    with pytest.raises(ValueError, match="contradictorios"):
        summarize_reactions(PROFILE, [original, conflict], start=START, end=END)


@pytest.mark.parametrize(
    "start,end",
    [
        (END, START),
        (START, START),
        (START.replace(tzinfo=None), END),
        (START, END.replace(tzinfo=None)),
    ],
)
def test_rejects_invalid_time_windows(start: datetime, end: datetime) -> None:
    with pytest.raises(ValueError):
        summarize_reactions(PROFILE, [], start=start, end=end)


@pytest.mark.parametrize(
    "changes",
    [
        {"reaction": "desconocido"},
        {"occurred_at": START.replace(tzinfo=None)},
        {"family_id": str(uuid4())},
    ],
)
def test_rejects_invalid_records(changes: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        record(**changes)
