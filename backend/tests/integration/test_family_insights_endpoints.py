from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.db import engine
from app.core.security import create_access_token
from app.main import app
from app.modules.families.service import FamiliesService
from app.modules.sessions.models import FamilySession

pytestmark = [pytest.mark.integration, pytest.mark.usefixtures("isolated_security_environment")]


def auth(account):
    return {"Authorization": "Bearer " + create_access_token(account.user_id)}


def record(client, account, profile, reaction, days_ago=0):
    with Session(engine) as db, db.begin():
        guide = FamilySession(
            id=uuid4(),
            elder_profile_id=profile,
            created_by=account.user_id,
            template_version="1.0",
            duration_minutes=15,
            created_at=datetime.now(UTC) - timedelta(days=days_ago, seconds=1),
        )
        db.add(guide)
        sid = guide.id
    response = client.post(
        f"/sessions/{sid}/response", headers=auth(account), json={"reaction": reaction}
    )
    assert response.status_code == 201
    assert client.get(f"/sessions/{sid}/response", headers=auth(account)).json() == response.json()
    return str(sid)


@pytest.mark.parametrize(
    "reactions,alert",
    [
        (["agitado", "agitado"], False),
        (["agitado"] * 3, True),
        (["agitado", "receptivo", "agitado", "emocionado", "agitado"], True),
        (["agitado", "receptivo", "agitado", "indiferente", "emocionado"], False),
        (["indiferente"] * 5, False),
    ],
)
def test_persisted_history_drives_summary_and_pause_boundaries(
    caregiver_account, memory_profile_id, reactions, alert
):
    with TestClient(app) as client:
        ids = [
            record(client, caregiver_account, memory_profile_id, reaction, len(reactions) - index)
            for index, reaction in enumerate(reactions)
        ]
        data = client.get("/insights/reactions", headers=auth(caregiver_account)).json()
    assert [item["session_id"] for item in data["history"]] == ids
    assert data["summary"]["total"] == len(reactions)
    assert data["summary"]["counts"] == {
        name: reactions.count(name)
        for name in ["receptivo", "emocionado", "indiferente", "agitado"]
    }
    assert data["pause"]["should_pause"] is alert
    assert bool(data["pause"]["message"]) is alert
    assert (
        data["summary"]["disclaimer"]
        == "Esto no es un diagnóstico. Es un registro de actividades familiares."
    )


def test_empty_summary_and_family_isolation(
    caregiver_account, memory_profile_id, other_caregiver_account
):
    with Session(engine) as db:
        other = FamiliesService(db).save_elder_profile(
            other_caregiver_account.user_id, name="Perfil ficticio", birth_decade=1950, interests=[]
        )
    with TestClient(app) as client:
        record(client, other_caregiver_account, other.id, "agitado")
        result = client.get("/insights/reactions", headers=auth(caregiver_account))
        assert result.status_code == 200
        data = result.json()
        assert data["history"] == [] and data["summary"]["total"] == 0
        assert set(data["summary"]["counts"].values()) == {0}
        assert data["pause"]["should_pause"] is False
        assert client.get("/insights/reactions").status_code == 401


def test_summary_window_does_not_remove_old_history_from_pause(
    caregiver_account, memory_profile_id
):
    with TestClient(app) as client:
        for day in [40, 39, 38]:
            record(client, caregiver_account, memory_profile_id, "agitado", day)
        data = client.get("/insights/reactions", headers=auth(caregiver_account)).json()
        assert data["summary"]["total"] == 0
        assert len(data["history"]) == 3
        assert data["pause"]["should_pause"] is True
