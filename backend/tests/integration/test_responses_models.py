from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import UUID

import pytest
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.responses.models import SessionResponse
from app.modules.sessions.models import FamilySession

pytestmark = pytest.mark.integration


def test_response_persists_reaction_and_session_chronology(
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
) -> None:
    occurred_at = datetime(2026, 11, 1, 15, tzinfo=UTC)
    with Session(engine) as db, db.begin():
        guide = FamilySession(
            elder_profile_id=memory_profile_id,
            created_by=caregiver_account.user_id,
            template_version="1.0",
            duration_minutes=15,
        )
        db.add(guide)
        db.flush()
        record = SessionResponse(
            session_id=guide.id,
            elder_profile_id=memory_profile_id,
            created_by=caregiver_account.user_id,
            reaction="receptivo",
            occurred_at=occurred_at,
        )
        db.add(record)
        db.flush()
        response_id, guide_id = record.id, guide.id
    with Session(engine) as db:
        saved = db.get(SessionResponse, response_id)
        assert saved is not None
        assert saved.reaction == "receptivo" and saved.session_id == guide_id
        assert saved.occurred_at == occurred_at
        assert saved.created_at.tzinfo is not None


def test_deleting_session_removes_its_response(
    caregiver_account: SimpleNamespace,
    memory_profile_id: UUID,
) -> None:
    with Session(engine) as db, db.begin():
        guide = FamilySession(
            elder_profile_id=memory_profile_id,
            created_by=caregiver_account.user_id,
            template_version="1.0",
            duration_minutes=15,
        )
        db.add(guide)
        db.flush()
        record = SessionResponse(
            session_id=guide.id,
            elder_profile_id=memory_profile_id,
            created_by=caregiver_account.user_id,
            reaction="agitado",
            occurred_at=datetime.now(UTC),
        )
        db.add(record)
        db.flush()
        response_id, guide_id = record.id, guide.id
    with engine.begin() as connection:
        connection.execute(delete(FamilySession).where(FamilySession.id == guide_id))
    with Session(engine) as db:
        assert db.get(SessionResponse, response_id) is None
