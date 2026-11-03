"""Offline quality measurements; never import the configured LLM service."""

import argparse
import hashlib
import json
import unicodedata
from collections import Counter
from collections.abc import Sequence
from importlib.metadata import version
from pathlib import Path
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, model_validator

from app.modules.nlp.extractors import EntityExtractor, NullExtractor, SpacyExtractor
from app.modules.nlp.schemas import Entity, EntityKind


def _normalize(text: str) -> str:
    return unicodedata.normalize("NFC", text).strip().casefold()


def _key(entity: Entity) -> tuple[EntityKind, str]:
    return entity.kind, _normalize(entity.text)


class EvaluationCase(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)

    id: str = Field(min_length=1, max_length=100)
    text: str = Field(max_length=5000, repr=False)
    expected: list[Entity] = Field(repr=False)

    @model_validator(mode="after")
    def validate_annotations(self) -> Self:
        if not self.id.strip():
            raise ValueError("Cada caso necesita un identificador no vacío.")
        keys = [_key(entity) for entity in self.expected]
        if len(keys) != len(set(keys)):
            raise ValueError("Las anotaciones esperadas deben ser únicas.")
        if any(not text or text not in _normalize(self.text) for _, text in keys):
            raise ValueError("Cada anotación debe ser un fragmento literal no vacío.")
        return self


def _scores(tp: int, fp: int, fn: int) -> dict[str, int | float | None]:
    return {
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "precision": tp / (tp + fp) if tp + fp else None,
        "recall": tp / (tp + fn) if tp + fn else None,
        "f1": 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else None,
    }


def evaluate_cases(
    cases: Sequence[EvaluationCase], extractor: EntityExtractor
) -> dict[str, object]:
    if not cases or len({case.id for case in cases}) != len(cases):
        raise ValueError("Usa casos con identificadores únicos y al menos un caso.")
    counts: Counter[tuple[EntityKind, str]] = Counter()
    failed = exact = 0
    for case in cases:
        expected = {_key(entity) for entity in case.expected}
        succeeded = True
        try:
            predicted = {_key(entity) for entity in extractor.extract(case.text)}
        except Exception:
            # No exception strings: an extractor could include the anecdote in them.
            failed += 1
            succeeded = False
            predicted = set()
        exact += int(succeeded and predicted == expected)
        for metric, keys in [
            ("tp", expected & predicted),
            ("fp", predicted - expected),
            ("fn", expected - predicted),
        ]:
            counts.update((kind, metric) for kind, _ in keys)
    per_kind = {
        kind.value: _scores(*(counts[kind, metric] for metric in ("tp", "fp", "fn")))
        for kind in EntityKind
    }
    micro = _scores(
        *(sum(counts[kind, metric] for kind in EntityKind) for metric in ("tp", "fp", "fn"))
    )
    return {
        "cases": len(cases),
        "failed_cases": failed,
        "exact_cases": exact,
        "micro": micro,
        "by_kind": per_kind,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Evalúa entidades usando datos sintéticos locales."
    )
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--extractor", choices=("null", "spacy"), default="null")
    args = parser.parse_args()
    try:
        raw = args.dataset.read_bytes()
        cases = TypeAdapter(list[EvaluationCase]).validate_json(raw)
        extractor = SpacyExtractor() if args.extractor == "spacy" else NullExtractor()
        report = evaluate_cases(cases, extractor)
        report.update(
            {
                "extractor": args.extractor,
                "dataset_sha256": hashlib.sha256(raw).hexdigest(),
                "matching": "unique kind + NFC/strip/casefold text",
                "dataset_scope": "synthetic smoke set, not representative",
            }
        )
        if args.extractor == "spacy":
            report["spacy_version"] = version("spacy")
            report["model_version"] = version("es-core-news-sm")
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1 if report["failed_cases"] else 0
    except Exception:
        print("No se pudo evaluar: revisa el dataset y el extractor local.")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
