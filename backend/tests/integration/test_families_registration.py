import logging
import secrets
from collections.abc import Iterator
from typing import Never
from uuid import uuid4

import pytest
from pydantic import SecretStr, ValidationError
from sqlalchemy import delete, event, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import engine
from app.core.security import verify_password
from app.modules.families.models import Family, User, UserConsent, UserRole
from app.modules.families.schemas import RegisterResponse
from app.modules.families.service import FamiliesError, FamiliesService

pytestmark = pytest.mark.integration


@pytest.fixture
def registration_data() -> Iterator[dict[str, object]]:
    suffix = uuid4().hex
    family_name = f"Familia de prueba {suffix}"
    yield {
        "email": f"  CUIDADOR-{suffix}@EXAMPLE.COM  ",
        "name": "  Persona de prueba  ",
        "password": SecretStr(secrets.token_urlsafe(24)),
        "family_name": f"  {family_name}  ",
        "accepted": True,
        "text_version": "1.0",
    }
    with engine.begin() as connection:
        connection.execute(delete(Family).where(Family.name == family_name))


@pytest.fixture
def service(registration_data: dict[str, object]) -> Iterator[FamiliesService]:
    with Session(engine, autoflush=False) as session:
        yield FamiliesService(session)


def registration_counts(data: dict[str, object]) -> tuple[int, int, int]:
    email = str(data["email"]).strip().lower()
    family_name = str(data["family_name"]).strip()
    with Session(engine) as observer:
        return (
            observer.execute(
                select(func.count()).select_from(Family).where(Family.name == family_name)
            ).scalar_one(),
            observer.execute(
                select(func.count()).select_from(User).where(User.email == email)
            ).scalar_one(),
            observer.execute(
                select(func.count())
                .select_from(UserConsent)
                .join(User, User.id == UserConsent.user_id)
                .where(User.email == email)
            ).scalar_one(),
        )


def test_caregiver_registration_commits_family_user_and_exact_consent(
    service: FamiliesService, registration_data: dict[str, object]
) -> None:
    response = service.register_caregiver(**registration_data)

    assert registration_counts(registration_data) == (1, 1, 1)
    with Session(engine) as observer:
        user = observer.get(User, response.user.id)
        family = observer.get(Family, response.family.id)
        consent = observer.scalar(select(UserConsent).where(UserConsent.user_id == user.id))
        assert user.family_id == family.id
        assert user.email == str(registration_data["email"]).strip().lower()
        assert user.name == "Persona de prueba"
        assert family.name == str(registration_data["family_name"]).strip()
        assert user.role is UserRole.PRIMARY_CAREGIVER
        assert verify_password(registration_data["password"].get_secret_value(), user.password_hash)
        assert consent.text_version == "1.0"
        assert consent.text == (
            "Acepto que Ayni guarde y use los datos que comparto para organizar "
            "actividades familiares. Entiendo que estos datos se almacenan fuera del "
            "Perú, en Estados Unidos, mediante Supabase y Render."
        )
        assert response.consent.accepted_at == consent.accepted_at
        assert user.password_hash not in response.model_dump_json()
    assert set(response.model_dump()) == {"user", "family", "consent"}
    assert response.user.role is UserRole.PRIMARY_CAREGIVER
    assert response.consent.accepted_at.tzinfo is not None


@pytest.mark.parametrize("accepted", [False, None, "true", 1])
def test_registration_requires_explicit_consent(
    service: FamiliesService, registration_data: dict[str, object], accepted: object
) -> None:
    registration_data["accepted"] = accepted

    with pytest.raises(FamiliesError) as error:
        service.register_caregiver(**registration_data)

    assert error.value.code == "consent_required"
    assert error.value.status_code == 422
    assert registration_counts(registration_data) == (0, 0, 0)


def test_registration_requires_consent_when_acceptance_is_omitted(
    service: FamiliesService, registration_data: dict[str, object]
) -> None:
    registration_data.pop("accepted")

    with pytest.raises(FamiliesError) as error:
        service.register_caregiver(**registration_data)

    assert error.value.code == "consent_required"
    assert registration_counts(registration_data) == (0, 0, 0)


@pytest.mark.parametrize("version", [None, "0.9", "2.0", " 1.0 "])
def test_registration_requires_current_consent_version(
    service: FamiliesService, registration_data: dict[str, object], version: str | None
) -> None:
    registration_data["text_version"] = version

    with pytest.raises(FamiliesError) as error:
        service.register_caregiver(**registration_data)

    assert error.value.code == "consent_version_invalid"
    assert error.value.status_code == 422
    assert registration_counts(registration_data) == (0, 0, 0)


@pytest.mark.parametrize("concurrent", [False, True])
def test_registration_rejects_duplicate_normalized_email_without_orphan_family(
    service: FamiliesService,
    registration_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
    concurrent: bool,
) -> None:
    existing = service.register_caregiver(**registration_data)
    registration_data["email"] = str(registration_data["email"]).strip().swapcase()
    if concurrent:
        # Simulate another registration winning after the initial availability check.
        monkeypatch.setattr(service.repository, "get_user_by_email", lambda email: None)

    with pytest.raises(FamiliesError) as error:
        service.register_caregiver(**registration_data)

    assert error.value.code == "email_already_registered"
    assert error.value.status_code == 409
    assert registration_counts(registration_data) == (1, 1, 1)
    with Session(engine) as observer:
        assert observer.get(User, existing.user.id) is not None


@pytest.mark.parametrize("field", ["email", "password"])
def test_registration_validates_account_data_before_writing(
    service: FamiliesService, registration_data: dict[str, object], field: str
) -> None:
    registration_data[field] = "invalid" if field == "email" else SecretStr(secrets.token_hex(4))

    with pytest.raises(ValidationError):
        service.register_caregiver(**registration_data)

    assert registration_counts(registration_data) == (0, 0, 0)


@pytest.mark.parametrize(
    "stage", ["create_family", "create_user", "create_consent", "response", "commit"]
)
def test_registration_rolls_back_everything_if_any_stage_fails(
    service: FamiliesService,
    registration_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
    stage: str,
) -> None:
    def fail(*args: object, **kwargs: object) -> Never:
        raise RuntimeError("Fallo simulado")

    if stage == "commit":
        event.listen(service.session, "before_commit", fail, once=True)
    elif stage == "response":
        monkeypatch.setattr(RegisterResponse, "model_validate", fail)
    else:
        original = getattr(service.repository, stage)

        def write_then_fail(**kwargs: object) -> Never:
            original(**kwargs)
            raise RuntimeError("Fallo simulado")

        monkeypatch.setattr(service.repository, stage, write_then_fail)

    with pytest.raises(RuntimeError, match="Fallo simulado"):
        service.register_caregiver(**registration_data)

    assert not service.session.in_transaction()
    assert registration_counts(registration_data) == (0, 0, 0)


def test_database_failure_during_consent_rolls_back_and_is_not_mislabeled_as_duplicate_email(
    service: FamiliesService,
    registration_data: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original = service.repository.create_consent

    def invalid_consent(**kwargs: object) -> UserConsent:
        kwargs["text"] = ""
        return original(**kwargs)

    monkeypatch.setattr(service.repository, "create_consent", invalid_consent)

    with pytest.raises(IntegrityError):
        service.register_caregiver(**registration_data)

    assert registration_counts(registration_data) == (0, 0, 0)


def test_registration_does_not_log_names_or_credentials(
    service: FamiliesService,
    registration_data: dict[str, object],
    caplog: pytest.LogCaptureFixture,
) -> None:
    with caplog.at_level(logging.DEBUG, logger="app.modules.families"):
        response = service.register_caregiver(**registration_data)

    for record in caplog.records:
        for value in (
            response.user.name,
            response.family.name,
            response.user.email,
            registration_data["password"].get_secret_value(),
        ):
            assert value not in str(record.__dict__)
