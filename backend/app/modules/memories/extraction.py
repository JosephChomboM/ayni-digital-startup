from dataclasses import dataclass, field
from uuid import UUID

from app.core.db import SessionLocal
from app.modules.memories.models import EntitiesStatus, MemoryEntityKind, MemoryType
from app.modules.memories.repository import MemoriesRepository
from app.modules.nlp.service import extract_entities_with_status


@dataclass(frozen=True)
class _Snapshot:
    content_version: int
    text: str = field(repr=False)


def _record_failure(memory_id: UUID, profile_id: UUID, version: int) -> None:
    try:
        with SessionLocal() as session, session.begin():
            MemoriesRepository(session).mark_entities_failed(
                memory_id, elder_profile_id=profile_id, content_version=version
            )
    except Exception:
        # A database outage may also prevent recording the failure. Never log SQL parameters.
        return


def extract_anecdote_entities(memory_id: UUID, elder_profile_id: UUID) -> None:
    """Run after commit/response, using private sessions and no request-owned objects."""
    snapshot: _Snapshot | None = None
    try:
        with SessionLocal() as session, session.begin():
            memory = MemoriesRepository(session).get_memory(
                memory_id, elder_profile_id=elder_profile_id
            )
            if (
                memory is None
                or memory.type != MemoryType.ANECDOTE
                or memory.entities_status != EntitiesStatus.PENDING
            ):
                return
            snapshot = _Snapshot(content_version=memory.content_version, text=memory.text)

        # No database transaction stays open while the optional extractor runs.
        result = extract_entities_with_status(snapshot.text)
        if not result.succeeded:
            _record_failure(memory_id, elder_profile_id, snapshot.content_version)
            return
        records: list[tuple[MemoryEntityKind, str]] = []
        for entity in result.entities:
            if (
                not entity.text.strip()
                or len(entity.text) > 5000
                or entity.text.casefold() not in snapshot.text.casefold()
            ):
                raise ValueError("La extracción devolvió contenido inválido.")
            records.append((MemoryEntityKind(entity.kind), entity.text))
        with SessionLocal() as session, session.begin():
            MemoriesRepository(session).replace_entities(
                memory_id,
                elder_profile_id=elder_profile_id,
                content_version=snapshot.content_version,
                entities=records,
            )
    except Exception:
        # Exception messages can contain anecdote text or SQL values; do not log them.
        if snapshot is not None:
            _record_failure(memory_id, elder_profile_id, snapshot.content_version)
