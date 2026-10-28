import logging
from types import SimpleNamespace
from uuid import UUID

import pytest
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.memories import extraction
from app.modules.memories.schemas import (
    AnecdoteCreateRequest,
    MemoryPatchRequest,
    MemoryResponse,
    SongCreateRequest,
)
from app.modules.memories.service import MemoriesError, MemoriesService
from app.modules.nlp.service import Entity, ExtractionResult

pytestmark = pytest.mark.integration


@pytest.fixture
def anecdote(caregiver_account: SimpleNamespace, memory_profile_id: UUID) -> MemoryResponse:
    with Session(engine) as session:
        return MemoriesService(session).create_memory(
            caregiver_account.user_id,
            AnecdoteCreateRequest(
                type="anecdote",
                title="Paseo",
                text="Paseamos por Lima.",
            ),
        )


def test_extraction_uses_own_sessions_and_sends_only_text(
    monkeypatch: pytest.MonkeyPatch, anecdote: MemoryResponse, caregiver_account: SimpleNamespace
) -> None:
    sessions: list[Session] = []
    calls: list[str] = []
    original_factory = extraction.SessionLocal

    def new_session() -> Session:
        session = original_factory()
        sessions.append(session)
        return session

    def extract(text: str) -> ExtractionResult:
        calls.append(text)
        assert all(not session.in_transaction() for session in sessions)
        return ExtractionResult(entities=[Entity(kind="place", text="Lima")], succeeded=True)

    monkeypatch.setattr(extraction, "SessionLocal", new_session)
    monkeypatch.setattr(extraction, "extract_entities_with_status", extract)
    extraction.extract_anecdote_entities(anecdote.id, anecdote.elder_profile_id)
    assert calls == [anecdote.text]
    assert len(sessions) == 2
    assert sessions[0] is not sessions[1]
    with Session(engine) as session:
        saved = MemoriesService(session).get_memory(caregiver_account.user_id, anecdote.id)
    assert saved.entities_status == "completed"
    assert [(entity.kind, entity.text) for entity in saved.entities] == [("place", "Lima")]


@pytest.mark.parametrize("succeeded,expected", [(True, "completed"), (False, "failed")])
def test_empty_extraction_records_success_or_failure(
    monkeypatch: pytest.MonkeyPatch,
    anecdote: MemoryResponse,
    caregiver_account: SimpleNamespace,
    succeeded: bool,
    expected: str,
) -> None:
    monkeypatch.setattr(
        extraction,
        "extract_entities_with_status",
        lambda text: ExtractionResult(entities=[], succeeded=succeeded),
    )
    extraction.extract_anecdote_entities(anecdote.id, anecdote.elder_profile_id)
    with Session(engine) as session:
        saved = MemoriesService(session).get_memory(caregiver_account.user_id, anecdote.id)
    assert saved.entities_status == expected
    assert saved.entities == []
    assert saved.text == anecdote.text


def test_unexpected_failure_is_persisted_without_logging_text(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    anecdote: MemoryResponse,
    caregiver_account: SimpleNamespace,
) -> None:
    def broken(text: str) -> ExtractionResult:
        raise RuntimeError(text)

    monkeypatch.setattr(extraction, "extract_entities_with_status", broken)
    with caplog.at_level(logging.DEBUG, logger="app.modules.memories"):
        extraction.extract_anecdote_entities(anecdote.id, anecdote.elder_profile_id)
    with Session(engine) as session:
        saved = MemoriesService(session).get_memory(caregiver_account.user_id, anecdote.id)
    assert saved.entities_status == "failed"
    assert all(anecdote.text not in str(record.__dict__) for record in caplog.records)


@pytest.mark.parametrize("change", ["edit", "delete"])
def test_results_for_replaced_or_deleted_content_are_discarded(
    monkeypatch: pytest.MonkeyPatch,
    anecdote: MemoryResponse,
    caregiver_account: SimpleNamespace,
    change: str,
) -> None:
    def extract(text: str) -> ExtractionResult:
        # Sequential change before the result is saved; no parallel workers or threads.
        with Session(engine) as session:
            service = MemoriesService(session)
            if change == "edit":
                service.update_memory(
                    caregiver_account.user_id,
                    anecdote.id,
                    MemoryPatchRequest(text="Paseamos por Cusco."),
                )
            else:
                service.delete_memory(caregiver_account.user_id, anecdote.id)
        return ExtractionResult(entities=[Entity(kind="place", text="Lima")], succeeded=True)

    monkeypatch.setattr(extraction, "extract_entities_with_status", extract)
    extraction.extract_anecdote_entities(anecdote.id, anecdote.elder_profile_id)
    with Session(engine) as session:
        service = MemoriesService(session)
        if change == "delete":
            with pytest.raises(MemoriesError) as error:
                service.get_memory(caregiver_account.user_id, anecdote.id)
            assert error.value.code == "memory_not_found"
        else:
            saved = service.get_memory(caregiver_account.user_id, anecdote.id)
            assert saved.text == "Paseamos por Cusco."
            assert saved.entities_status == "pending"
            assert saved.entities == []


def test_songs_do_not_call_nlp(
    monkeypatch: pytest.MonkeyPatch, caregiver_account: SimpleNamespace, memory_profile_id: UUID
) -> None:
    with Session(engine) as session:
        song = MemoriesService(session).create_memory(
            caregiver_account.user_id,
            SongCreateRequest(
                type="song",
                title="Canción",
                url="https://youtu.be/abcdefghijk",
            ),
        )

    def unexpected(text: str) -> ExtractionResult:
        pytest.fail("Una canción no debe enviarse al extractor.")

    monkeypatch.setattr(extraction, "extract_entities_with_status", unexpected)
    extraction.extract_anecdote_entities(song.id, song.elder_profile_id)
    with Session(engine) as session:
        assert (
            MemoriesService(session).get_memory(caregiver_account.user_id, song.id).entities_status
            == "not_applicable"
        )
