import os
import secrets
from collections.abc import Iterator
from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import SecretStr
from sqlalchemy import delete
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.families.models import Family
from app.modules.families.service import FamiliesService


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


@pytest.fixture
def caregiver_account() -> Iterator[SimpleNamespace]:
    password_value = SecretStr(secrets.token_urlsafe(24))
    with Session(engine, autoflush=False) as session:
        response = FamiliesService(session).register_caregiver(
            email=f"cuidador-{uuid4().hex}@example.com",
            name="Persona de prueba",
            password=password_value,
            family_name="Familia de prueba",
            accepted=True,
            text_version="1.0",
        )
    try:
        yield SimpleNamespace(
            user_id=response.user.id,
            family_id=response.family.id,
            email=response.user.email,
            password=password_value,
        )
    finally:
        with engine.begin() as connection:
            connection.execute(delete(Family).where(Family.id == response.family.id))
