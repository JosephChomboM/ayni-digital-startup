import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.db import engine
from app.main import app

pytestmark = pytest.mark.integration


def test_health_db_with_real_database() -> None:
    response = TestClient(app).get("/health/db")

    assert response.status_code == 200


def test_migrations_are_applied() -> None:
    with engine.connect() as conn:
        exists = conn.execute(text("SELECT to_regclass('alembic_version') IS NOT NULL")).scalar()

    assert exists, "Corre `alembic upgrade head` antes de los tests de integración"
