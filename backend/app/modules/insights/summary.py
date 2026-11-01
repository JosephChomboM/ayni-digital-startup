"""Descriptive aggregation over records already authorized by the caller."""

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict

from app.modules.insights.schemas import DISCLAIMER, Reaction


class ReactionRecord(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", hide_input_in_errors=True)

    session_id: UUID
    elder_profile_id: UUID
    occurred_at: AwareDatetime
    reaction: Reaction


class ReactionSummary(BaseModel):
    model_config = ConfigDict(frozen=True)

    start: AwareDatetime
    end: AwareDatetime
    total: int
    counts: dict[Reaction, int]
    disclaimer: str = DISCLAIMER


def summarize_reactions(
    elder_profile_id: UUID,
    records: Sequence[ReactionRecord],
    *,
    start: datetime,
    end: datetime,
) -> ReactionSummary:
    """Count unique sessions in [start, end); never infer health or fetch data.

    The adapter must first authorize the actor and fetch this profile's persisted
    records through responses.service. A matching profile ID alone is not auth.
    Exact duplicates are ignored; conflicting sessions or mixed profiles fail.
    """
    if start.utcoffset() is None or end.utcoffset() is None:
        raise ValueError("El periodo debe incluir una zona horaria.")
    start, end = start.astimezone(UTC), end.astimezone(UTC)
    if start >= end:
        raise ValueError("El inicio debe ser anterior al final del periodo.")
    sessions: dict[UUID, ReactionRecord] = {}
    for record in records:
        if record.elder_profile_id != elder_profile_id:
            raise ValueError("El historial debe pertenecer a un solo perfil autorizado.")
        previous = sessions.get(record.session_id)
        if previous is not None and previous != record:
            raise ValueError("Hay registros contradictorios para una misma sesión.")
        sessions[record.session_id] = record
    counts = dict.fromkeys(Reaction, 0)
    for record in sessions.values():
        if start <= record.occurred_at < end:
            counts[record.reaction] += 1
    return ReactionSummary(start=start, end=end, total=sum(counts.values()), counts=counts)
