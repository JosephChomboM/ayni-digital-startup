import hashlib
import os
import secrets
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from pydantic import SecretStr
from sqlalchemy import create_engine, delete, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.families.models import Family
from app.modules.families.repository import FamiliesRepository
from app.modules.families.service import FamiliesService


def _prepare_local_test_database() -> None:
    """Create/migrate only the dedicated local test DB, never the dev DB."""
    database_url = engine.url
    if database_url.database != "ayni_test" or database_url.host not in {"localhost", "127.0.0.1"}:
        return

    maintenance_engine = create_engine(database_url.set(database="postgres"))
    try:
        with maintenance_engine.connect().execution_options(
            isolation_level="AUTOCOMMIT"
        ) as connection:
            exists = connection.scalar(
                text("SELECT 1 FROM pg_database WHERE datname = 'ayni_test'")
            )
            if not exists:
                connection.exec_driver_sql("CREATE DATABASE ayni_test")
    finally:
        maintenance_engine.dispose()

    from alembic import command
    from alembic.config import Config

    backend_dir = Path(__file__).resolve().parents[2]
    command.upgrade(Config(str(backend_dir / "alembic.ini")), "head")


@pytest.fixture(scope="session", autouse=True)
def require_database() -> None:
    """Skip locally when Postgres is not running; in CI a missing database is a failure."""
    try:
        _prepare_local_test_database()
        with engine.connect():
            pass
    except OperationalError as exc:
        error = str(exc.orig).lower()
        database_unavailable = any(
            message in error
            for message in (
                "connection refused",
                "connection timed out",
                "network is unreachable",
                "no route to host",
            )
        )
        if os.getenv("CI") or not database_unavailable:
            raise
        pytest.skip("PostgreSQL no disponible: corre `docker compose up -d db`")


def _registered_caregiver() -> Iterator[SimpleNamespace]:
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


@pytest.fixture
def caregiver_account() -> Iterator[SimpleNamespace]:
    yield from _registered_caregiver()


@pytest.fixture
def other_caregiver_account() -> Iterator[SimpleNamespace]:
    yield from _registered_caregiver()


@pytest.fixture
def memory_profile_id(caregiver_account: SimpleNamespace) -> UUID:
    with Session(engine) as session:
        return (
            FamiliesService(session)
            .save_elder_profile(
                caregiver_account.user_id, name="Perfil de prueba", birth_decade=1940, interests=[]
            )
            .id
        )


@pytest.fixture
def family_member(caregiver_account: SimpleNamespace) -> SimpleNamespace:
    password_value = SecretStr(secrets.token_urlsafe(24))
    email = f"familiar-{uuid4().hex}@example.com"
    with Session(engine) as session:
        service = FamiliesService(session)
        created = service.create_invitation(caregiver_account.user_id, email=email)
        response = service.register_invited(
            email=email,
            name="Familiar de prueba",
            password=password_value,
            invitation_token=SecretStr(created.invitation_token),
            accepted=True,
            text_version="1.0",
        )
    return SimpleNamespace(
        user_id=response.user.id,
        family_id=response.family.id,
        email=email,
        password=password_value,
    )


@pytest.fixture
def pending_invitation(caregiver_account: SimpleNamespace) -> SimpleNamespace:
    value = secrets.token_urlsafe(32)
    now = datetime.now(UTC)
    with Session(engine) as session, session.begin():
        invitation = FamiliesRepository(session).create_invitation(
            family_id=caregiver_account.family_id,
            email=f"invitado-{uuid4().hex}@example.com",
            token_hash=hashlib.sha256(value.encode()).hexdigest(),
            created_at=now,
            expires_at=now + timedelta(hours=72),
        )
        return SimpleNamespace(
            id=invitation.id,
            family_id=invitation.family_id,
            email=invitation.email,
            token=SecretStr(value),
            created_at=now,
            expires_at=invitation.expires_at,
        )
