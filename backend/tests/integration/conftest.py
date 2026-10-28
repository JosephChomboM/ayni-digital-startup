import hashlib
import os
import secrets
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from pydantic import SecretStr
from sqlalchemy import delete
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.families.models import Family
from app.modules.families.repository import FamiliesRepository
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
