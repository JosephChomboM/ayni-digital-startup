import logging

import pytest

from app.modules.nlp import service
from app.modules.nlp.extractors import NullExtractor, SpacyExtractor
from app.modules.nlp.service import Entity, EntityKind, extract_entities

ANECDOTE = "En 1965 mi papá Juan Pérez viajó a Arequipa con mi mamá en los años 60."


class BrokenExtractor:
    name = "broken"

    def extract(self, text: str) -> list[Entity]:
        raise RuntimeError(f"model crashed on: {text}")


class FixedExtractor:
    name = "fixed"

    def __init__(self, entities: list[Entity]) -> None:
        self.entities = entities

    def extract(self, text: str) -> list[Entity]:
        return self.entities


def test_spacy_extractor_finds_people_places_and_periods() -> None:
    entities = SpacyExtractor().extract(ANECDOTE)

    assert Entity(kind=EntityKind.PERSON, text="Juan Pérez") in entities
    assert Entity(kind=EntityKind.PLACE, text="Arequipa") in entities
    assert Entity(kind=EntityKind.PERIOD, text="1965") in entities
    assert Entity(kind=EntityKind.PERIOD, text="los años 60") in entities


@pytest.mark.parametrize("text", ["", "   ", "\n"])
def test_blank_text_returns_no_entities(text: str) -> None:
    assert extract_entities(text) == []


def test_null_extractor_returns_no_entities() -> None:
    assert NullExtractor().extract(ANECDOTE) == []


def test_falls_back_to_next_extractor_when_one_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    lima = Entity(kind=EntityKind.PLACE, text="Lima")
    monkeypatch.setattr(service, "EXTRACTORS", [BrokenExtractor(), FixedExtractor([lima])])

    assert extract_entities("Vivimos en Lima") == [lima]


def test_returns_empty_list_when_every_extractor_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(service, "EXTRACTORS", [BrokenExtractor(), BrokenExtractor()])

    assert extract_entities(ANECDOTE) == []


def test_failure_logs_never_include_the_anecdote(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(service, "EXTRACTORS", [BrokenExtractor()])

    with caplog.at_level(logging.DEBUG):
        extract_entities(ANECDOTE)

    for record in caplog.records:
        assert "Juan" not in record.getMessage()
        assert "Juan" not in str(record.__dict__)


def test_duplicates_are_removed_ignoring_case(monkeypatch: pytest.MonkeyPatch) -> None:
    entities = [
        Entity(kind=EntityKind.PLACE, text="Lima"),
        Entity(kind=EntityKind.PLACE, text="lima"),
        Entity(kind=EntityKind.PERSON, text="Lima"),
    ]
    monkeypatch.setattr(service, "EXTRACTORS", [FixedExtractor(entities)])

    assert extract_entities("Lima") == [entities[0], entities[2]]


@pytest.mark.parametrize("succeeded", [True, False])
def test_status_distinguishes_empty_success_from_total_failure(
    monkeypatch: pytest.MonkeyPatch, succeeded: bool
) -> None:
    extractor = FixedExtractor([]) if succeeded else BrokenExtractor()
    monkeypatch.setattr(service, "EXTRACTORS", [extractor])
    result = service.extract_entities_with_status(ANECDOTE)
    assert result.entities == []
    assert result.succeeded is succeeded


def test_status_reports_success_when_fallback_works(monkeypatch: pytest.MonkeyPatch) -> None:
    entity = Entity(kind=EntityKind.PLACE, text="Lima")
    monkeypatch.setattr(service, "EXTRACTORS", [BrokenExtractor(), FixedExtractor([entity])])
    result = service.extract_entities_with_status("Paseamos por Lima.")
    assert result.succeeded
    assert result.entities == [entity]
