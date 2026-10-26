import os

import pytest
from sqlalchemy.exc import OperationalError

from app.core.db import engine


@pytest.fixture(scope="session", autouse=True)
def require_database() -> None:
    """Skip locally when Postgres is not running; in CI a missing database is a failure."""
    try:
        with engine.connect():
            pass
    except OperationalError:
        if os.getenv("CI"):
            raise
        pytest.skip("PostgreSQL no disponible: corre `docker compose up -d db`")
