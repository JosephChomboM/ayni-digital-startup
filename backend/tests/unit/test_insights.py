from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.modules.insights.service import PauseAlert, PauseReason, evaluate_pause_alert


def evaluate(reactions: list[str], **settings: object) -> PauseAlert:
    return evaluate_pause_alert(
        reactions,
        settings=Settings(_env_file=None, **settings),
    )


@pytest.mark.parametrize("count,expected", [(0, False), (1, False), (2, False), (3, True)])
def test_streak_rule_without_a_full_window(count: int, expected: bool) -> None:
    alert = evaluate(["agitado"] * count)

    assert alert.should_pause is expected
    assert alert.consecutive_agitated == count
    assert alert.window_complete is False
    assert alert.reasons == ((PauseReason.AGITATED_STREAK,) if expected else ())


def test_only_the_current_streak_counts() -> None:
    alert = evaluate(["agitado"] * 3 + ["receptivo", "emocionado"])

    assert alert.consecutive_agitated == 0
    assert PauseReason.AGITATED_STREAK not in alert.reasons
    # Historical agitation still triggers the separate full-window rule.
    assert alert.reasons == (PauseReason.NEGATIVE_RATIO,)


def test_non_agitated_reaction_breaks_the_streak() -> None:
    assert evaluate(["agitado", "indiferente", "agitado", "agitado"]).should_pause is False


@pytest.mark.parametrize("count,expected", [(2, False), (3, True)])
def test_default_ratio_with_five_sessions(count: int, expected: bool) -> None:
    # Agitated reactions are separated to isolate the ratio rule.
    reactions = ["agitado", "receptivo", "agitado", "emocionado"]
    reactions.append("agitado" if count == 3 else "receptivo")
    alert = evaluate(reactions)

    assert alert.should_pause is expected
    assert alert.window_complete is True
    assert alert.negative_count == count
    assert PauseReason.AGITATED_STREAK not in alert.reasons


def test_both_rules_can_trigger_together() -> None:
    assert evaluate(["receptivo"] * 2 + ["agitado"] * 3).reasons == (
        PauseReason.AGITATED_STREAK,
        PauseReason.NEGATIVE_RATIO,
    )


def test_ratio_ignores_sessions_outside_the_latest_window() -> None:
    alert = evaluate(["agitado"] * 10 + ["receptivo"] * 5)

    assert alert.should_pause is False
    assert alert.window_size == 5
    assert alert.negative_count == 0


@pytest.mark.parametrize("count,expected", [(49, False), (50, True)])
def test_exact_fifty_percent_boundary(count: int, expected: bool) -> None:
    # A window of 100 permits 49% vs 50%; five sessions only permit 20% steps.
    alert = evaluate(
        ["agitado", "receptivo"] * count + ["receptivo"] * (100 - count * 2),
        pause_negative_window=100,
    )

    assert alert.should_pause is expected
    assert alert.negative_count == count


def test_configurable_streak_and_ratio() -> None:
    assert evaluate(["agitado"] * 2, pause_agitated_streak=2).should_pause is True
    assert evaluate(["agitado"] * 3, pause_agitated_streak=4).should_pause is False
    assert (
        evaluate(
            ["agitado", "receptivo", "agitado", "receptivo"],
            pause_negative_window=4,
            pause_negative_ratio=Decimal("0.5"),
        ).should_pause
        is True
    )
    assert (
        evaluate(
            ["agitado", "receptivo", "agitado", "receptivo"],
            pause_negative_window=4,
            pause_negative_ratio=Decimal("0.51"),
        ).should_pause
        is False
    )


def test_negative_classification_can_be_overridden() -> None:
    reactions = ["indiferente"] * 5
    assert evaluate(reactions).should_pause is False
    alert = evaluate_pause_alert(
        reactions,
        negative_reactions={"agitado", "indiferente"},
        settings=Settings(_env_file=None),
    )
    assert alert.reasons == (PauseReason.NEGATIVE_RATIO,)


@pytest.mark.parametrize(
    "reaction,expected", [("receptivo", 0), ("emocionado", 0), ("indiferente", 0), ("agitado", 5)]
)
def test_only_agitated_counts_as_negative_by_default(reaction: str, expected: int) -> None:
    alert = evaluate([reaction] * 5)

    assert alert.negative_count == expected
    assert alert.should_pause is (expected > 0)


@pytest.mark.parametrize("reactions", [[], ["receptivo"] * 5, ["agitado"] * 3])
def test_every_result_has_the_disclaimer_and_conditional_message(reactions: list[str]) -> None:
    alert = evaluate(reactions)
    payload = alert.model_dump(mode="json")

    assert payload["disclaimer"] == (
        "Esto no es un diagnóstico. Es un registro de actividades familiares."
    )
    assert (payload["message"] is not None) is alert.should_pause
    if alert.should_pause:
        assert "pausar" in payload["message"]
        assert "profesional de salud" in payload["message"]


def test_unknown_reactions_are_rejected() -> None:
    with pytest.raises(ValidationError):
        evaluate(["unknown"])


@pytest.mark.parametrize("classification", [set(), {"receptivo"}, {"unknown"}])
def test_invalid_classification_is_rejected(classification: set[str]) -> None:
    with pytest.raises(ValidationError):
        evaluate_pause_alert([], negative_reactions=classification)


@pytest.mark.parametrize(
    "field,value",
    [
        ("pause_agitated_streak", 0),
        ("pause_negative_window", 0),
        ("pause_negative_ratio", 0),
        ("pause_negative_ratio", 1.01),
        ("pause_negative_ratio", "NaN"),
    ],
)
def test_invalid_thresholds_are_rejected(field: str, value: object) -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **{field: value})


def test_thresholds_load_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PAUSE_AGITATED_STREAK", "4")
    monkeypatch.setenv("PAUSE_NEGATIVE_WINDOW", "6")
    monkeypatch.setenv("PAUSE_NEGATIVE_RATIO", "0.75")
    settings = Settings(_env_file=None)

    assert settings.pause_agitated_streak == 4
    assert settings.pause_negative_window == 6
    assert settings.pause_negative_ratio == Decimal("0.75")
