import json
import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.modules.nlp import evaluate
from app.modules.nlp.evaluate import EvaluationCase, evaluate_cases
from app.modules.nlp.extractors import NullExtractor
from app.modules.nlp.schemas import Entity


def case() -> EvaluationCase:
    return EvaluationCase(
        id="synthetic",
        text="Ana visitó Lima.",
        expected=[Entity(kind="person", text="Ana"), Entity(kind="place", text="Lima")],
    )


class PartialExtractor:
    name = "synthetic"

    def extract(self, text: str) -> list[Entity]:
        return [
            Entity(kind="person", text="ANA"),
            Entity(kind="person", text="Ana"),
            Entity(kind="place", text="Cusco"),
        ]


def test_micro_and_per_kind_scores_count_unique_exact_entities() -> None:
    report = evaluate_cases([case()], PartialExtractor())
    assert report["micro"] == {
        "true_positives": 1,
        "false_positives": 1,
        "false_negatives": 1,
        "precision": 0.5,
        "recall": 0.5,
        "f1": 0.5,
    }
    assert report["by_kind"]["person"]["f1"] == 1
    assert report["by_kind"]["place"]["f1"] == 0
    assert report["exact_cases"] == 0


def test_undefined_metrics_are_null_not_perfect_scores() -> None:
    report = evaluate_cases([EvaluationCase(id="empty", text="", expected=[])], NullExtractor())
    assert report["micro"]["precision"] is None
    assert report["micro"]["recall"] is None
    assert report["micro"]["f1"] is None
    assert report["exact_cases"] == 1


def test_unicode_normalization_keeps_accents_and_entity_kind_significant() -> None:
    annotated = EvaluationCase(
        id="unicode", text="José", expected=[Entity(kind="person", text="José")]
    )

    class Extractor:
        name = "synthetic"

        def extract(self, text: str) -> list[Entity]:
            return [Entity(kind="person", text="  JOSE\u0301  "), Entity(kind="place", text="Jose")]

    report = evaluate_cases([annotated], Extractor())
    assert report["micro"]["true_positives"] == 1
    assert report["micro"]["false_positives"] == 1


def test_failures_remain_in_the_denominator_and_do_not_leak_text(
    capsys: pytest.CaptureFixture[str],
) -> None:
    class Broken:
        name = "synthetic"

        def extract(self, text: str) -> list[Entity]:
            raise RuntimeError(text)

    report = evaluate_cases([case(), EvaluationCase(id="empty", text="", expected=[])], Broken())
    assert report["failed_cases"] == 2 and report["exact_cases"] == 0
    assert report["micro"]["false_negatives"] == 2
    assert report["micro"]["recall"] == 0
    assert "Ana" not in json.dumps(report) + capsys.readouterr().out


@pytest.mark.parametrize(
    "entities",
    [
        [{"kind": "person", "text": ""}],
        [{"kind": "person", "text": "Ausente"}],
        [{"kind": "person", "text": "Ana"}, {"kind": "person", "text": "ANA"}],
    ],
)
def test_rejects_invalid_or_duplicate_gold_annotations(entities: list[dict[str, str]]) -> None:
    with pytest.raises(ValidationError):
        EvaluationCase(id="bad", text="Ana", expected=entities)


@pytest.mark.parametrize("cases", [[], [case(), case()]])
def test_rejects_empty_sets_and_duplicate_case_ids(cases: list[EvaluationCase]) -> None:
    with pytest.raises(ValueError):
        evaluate_cases(cases, NullExtractor())


def test_cli_outputs_aggregate_fingerprint_without_using_llm(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    dataset = Path(__file__).parents[1] / "fixtures/nlp_synthetic_es.json"
    monkeypatch.setattr(sys, "argv", ["evaluate", str(dataset)])
    assert evaluate.main() == 0
    report = json.loads(capsys.readouterr().out)
    assert report["cases"] == 10 and report["extractor"] == "null"
    assert len(report["dataset_sha256"]) == 64
    assert report["micro"]["recall"] == 0
    assert "Ana" not in json.dumps(report)


def test_cli_rejects_invalid_dataset_without_echoing_contents(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    tmp_path: Path,
) -> None:
    dataset = tmp_path / "invalid.json"
    dataset.write_text('[{"text":"Private invalid content"}]')
    monkeypatch.setattr(sys, "argv", ["evaluate", str(dataset)])
    assert evaluate.main() == 2
    assert "Private" not in capsys.readouterr().out


def test_cli_returns_failure_status_when_extractor_fails(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    class Broken:
        name = "synthetic"

        def extract(self, text: str) -> list[Entity]:
            raise RuntimeError(text)

    monkeypatch.setattr(evaluate, "SpacyExtractor", Broken)
    monkeypatch.setattr(evaluate, "version", lambda _: "test")
    dataset = Path(__file__).parents[1] / "fixtures/nlp_synthetic_es.json"
    monkeypatch.setattr(sys, "argv", ["evaluate", str(dataset), "--extractor", "spacy"])
    assert evaluate.main() == 1
    report = json.loads(capsys.readouterr().out)
    assert report["failed_cases"] == 10 and report["micro"]["recall"] == 0
