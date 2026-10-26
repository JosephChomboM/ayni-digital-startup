from collections.abc import Iterator
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.core.db import get_db
from app.main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health_db_returns_503_when_database_is_down() -> None:
    def broken_db() -> Iterator[MagicMock]:
        session = MagicMock()
        session.execute.side_effect = OperationalError("SELECT 1", {}, Exception("down"))
        yield session

    app.dependency_overrides[get_db] = broken_db
    try:
        response = client.get("/health/db")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
