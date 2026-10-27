import json

import httpx
import pytest

from app.core.config import Settings
from app.modules.nlp import service
from app.modules.nlp.extractors import SpacyExtractor
from app.modules.nlp.llm import LlmExtractor
from app.modules.nlp.service import Entity, EntityKind, build_extractors, extract_entities

ANECDOTE = "Mi papá bailaba marinera en Trujillo en los años 60."


def groq_reply(entities: list[dict[str, str]]) -> httpx.Response:
    content = json.dumps({"entities": entities})
    return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})


def make_extractor(handler: httpx.MockTransport) -> LlmExtractor:
    # MockTransport: the tests never call the real API.
    return LlmExtractor(
        api_key="test-key",
        model="test-model",
        timeout_seconds=1,
        client=httpx.Client(transport=handler),
    )


def test_llm_extractor_parses_entities() -> None:
    extractor = make_extractor(
        httpx.MockTransport(
            lambda request: groq_reply(
                [
                    {"kind": "person", "text": "Mi papá"},
                    {"kind": "activity", "text": "bailaba marinera"},
                    {"kind": "place", "text": "Trujillo"},
                    {"kind": "period", "text": "los años 60"},
                ]
            )
        )
    )

    assert extractor.extract(ANECDOTE) == [
        Entity(kind=EntityKind.PERSON, text="Mi papá"),
        Entity(kind=EntityKind.ACTIVITY, text="bailaba marinera"),
        Entity(kind=EntityKind.PLACE, text="Trujillo"),
        Entity(kind=EntityKind.PERIOD, text="los años 60"),
    ]


def test_llm_receives_only_the_anecdote() -> None:
    sent: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        sent.append(json.loads(request.content))
        return groq_reply([])

    make_extractor(httpx.MockTransport(handler)).extract(ANECDOTE)

    user_messages = [m for m in sent[0]["messages"] if m["role"] == "user"]
    assert user_messages == [{"role": "user", "content": ANECDOTE}]


def test_llm_entities_not_in_the_anecdote_are_dropped() -> None:
    extractor = make_extractor(
        httpx.MockTransport(
            lambda request: groq_reply(
                [
                    {"kind": "place", "text": "Trujillo"},
                    {"kind": "place", "text": "Cusco"},
                ]
            )
        )
    )

    assert extractor.extract(ANECDOTE) == [Entity(kind=EntityKind.PLACE, text="Trujillo")]


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(429, json={"error": "rate limit"}),
        httpx.Response(500),
        httpx.Response(200, json={"choices": [{"message": {"content": "no es json"}}]}),
        groq_reply([{"kind": "diagnosis", "text": "Trujillo"}]),
    ],
    ids=["quota", "server-error", "invalid-json", "unknown-kind"],
)
def test_falls_back_to_spacy_when_llm_fails(
    monkeypatch: pytest.MonkeyPatch, response: httpx.Response
) -> None:
    llm = make_extractor(httpx.MockTransport(lambda request: response))
    monkeypatch.setattr(service, "EXTRACTORS", [llm, SpacyExtractor()])

    entities = extract_entities(ANECDOTE)

    assert Entity(kind=EntityKind.PLACE, text="Trujillo") in entities


def test_falls_back_to_spacy_on_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timeout", request=request)

    monkeypatch.setattr(
        service, "EXTRACTORS", [make_extractor(httpx.MockTransport(handler)), SpacyExtractor()]
    )

    assert Entity(kind=EntityKind.PLACE, text="Trujillo") in extract_entities(ANECDOTE)


def test_without_api_key_only_spacy_is_used() -> None:
    extractors = build_extractors(Settings(groq_api_key=""))

    assert [e.name for e in extractors] == ["spacy"]


def test_with_api_key_llm_goes_first() -> None:
    extractors = build_extractors(Settings(groq_api_key="test-key"))

    assert [e.name for e in extractors] == ["groq", "spacy"]
