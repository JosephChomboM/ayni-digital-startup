import logging
import secrets
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from threading import Barrier
from types import SimpleNamespace
from typing import Never

import pytest
from pydantic import SecretStr
from sqlalchemy import event, func, select
from sqlalchemy.orm import Session

from app.core.db import engine
from app.core.security import verify_password
from app.modules.families import service as service_module
from app.modules.families.consent import CONSENT_TEXT
from app.modules.families.models import Invitation, User, UserConsent, UserRole
from app.modules.families.schemas import RegisterResponse
from app.modules.families.service import FamiliesError, FamiliesService

pytestmark = pytest.mark.integration


@pytest.fixture
def service(pending_invitation: SimpleNamespace) -> Iterator[FamiliesService]:
    with Session(engine, autoflush=False) as session:
        yield FamiliesService(session)


@pytest.fixture
def registration(pending_invitation: SimpleNamespace) -> dict[str, object]:
    return {
        "email": f" {pending_invitation.email.upper()} ",
        "name": "Familiar de prueba",
        "password": SecretStr(secrets.token_urlsafe(24)),
        "invitation_token": pending_invitation.token,
        "accepted": True,
        "text_version": "1.0",
    }


def assert_not_registered(invitation: SimpleNamespace) -> None:
    with Session(engine) as observer:
        assert observer.scalar(select(User.id).where(User.email == invitation.email)) is None
        assert observer.get(Invitation, invitation.id).accepted_at is None
        assert (
            observer.scalar(
                select(func.count()).select_from(User).where(User.family_id == invitation.family_id)
            )
            == 1
        )


def test_invitation_registration_joins_existing_family_with_consent_and_no_access_token(
    service: FamiliesService,
    registration: dict[str, object],
    pending_invitation: SimpleNamespace,
    caplog: pytest.LogCaptureFixture,
) -> None:
    with caplog.at_level(logging.DEBUG, logger="app.modules.families"):
        response = service.register_invited(**registration)

    assert response.family.id == pending_invitation.family_id
    assert response.user.email == pending_invitation.email
    assert response.user.role is UserRole.FAMILY_MEMBER
    assert set(response.model_dump()) == {"user", "family", "consent"}
    with Session(engine) as observer:
        user = observer.get(User, response.user.id)
        consent = observer.scalar(select(UserConsent).where(UserConsent.user_id == user.id))
        invitation = observer.get(Invitation, pending_invitation.id)
        assert consent.text_version == "1.0"
        assert consent.text == CONSENT_TEXT
        assert verify_password(registration["password"].get_secret_value(), user.password_hash)
        assert invitation.accepted_at is not None
        assert invitation.token_hash != pending_invitation.token.get_secret_value()
    for record in caplog.records:
        for value in (
            response.user.name,
            response.user.email,
            pending_invitation.token.get_secret_value(),
            registration["password"].get_secret_value(),
        ):
            assert value not in str(record.__dict__)


@pytest.mark.parametrize(
    ("state", "code", "status"),
    [
        ("missing", "invitation_not_found", 404),
        ("expired", "invitation_expired", 410),
        ("revoked", "invitation_revoked", 410),
        ("accepted", "invitation_used", 409),
        ("email", "invitation_email_mismatch", 403),
    ],
)
def test_invitation_registration_rejects_invalid_invitation(
    service: FamiliesService,
    registration: dict[str, object],
    pending_invitation: SimpleNamespace,
    state: str,
    code: str,
    status: int,
) -> None:
    if state == "missing":
        registration["invitation_token"] = SecretStr(secrets.token_urlsafe(32))
    elif state == "email":
        registration["email"] = "otro@example.com"
    else:
        with Session(engine) as session, session.begin():
            invitation = session.get(Invitation, pending_invitation.id)
            at = datetime.now(UTC)
            if state == "expired":
                invitation.expires_at = at
            elif state == "revoked":
                invitation.revoked_at = at
            else:
                invitation.accepted_at = at
    with pytest.raises(FamiliesError) as error:
        service.register_invited(**registration)

    assert (error.value.code, error.value.status_code) == (code, status)
    with Session(engine) as observer:
        assert (
            observer.scalar(select(User.id).where(User.email == pending_invitation.email)) is None
        )


@pytest.mark.parametrize(
    ("field", "value", "code"),
    [("accepted", False, "consent_required"), ("text_version", "2.0", "consent_version_invalid")],
)
def test_invitation_registration_requires_consent(
    service: FamiliesService,
    registration: dict[str, object],
    pending_invitation: SimpleNamespace,
    field: str,
    value: object,
    code: str,
) -> None:
    registration[field] = value
    with pytest.raises(FamiliesError) as error:
        service.register_invited(**registration)

    assert error.value.code == code
    assert_not_registered(pending_invitation)


@pytest.mark.parametrize("race", [False, True])
def test_invitation_registration_rejects_existing_email_and_preserves_invitation(
    service: FamiliesService,
    registration: dict[str, object],
    pending_invitation: SimpleNamespace,
    caregiver_account: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
    race: bool,
) -> None:
    with Session(engine) as session, session.begin():
        session.get(Invitation, pending_invitation.id).email = caregiver_account.email
    registration["email"] = caregiver_account.email.upper()
    if race:
        monkeypatch.setattr(service.repository, "get_user_by_email", lambda email: None)
    with pytest.raises(FamiliesError) as error:
        service.register_invited(**registration)

    assert error.value.code == "email_already_registered"
    with Session(engine) as observer:
        assert observer.get(Invitation, pending_invitation.id).accepted_at is None


@pytest.mark.parametrize(
    "stage", ["create_user", "create_consent", "accept_invitation", "response", "commit"]
)
def test_invitation_registration_failure_restores_user_consent_and_invitation(
    service: FamiliesService,
    registration: dict[str, object],
    pending_invitation: SimpleNamespace,
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
        service.register_invited(**registration)

    assert_not_registered(pending_invitation)


def test_invitation_that_expires_during_registration_is_not_consumed(
    service: FamiliesService,
    registration: dict[str, object],
    pending_invitation: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = [pending_invitation.created_at]
    monkeypatch.setattr(service_module, "_utc_now", lambda: now[0])
    original = service_module.hash_password

    def expire_during_hash(raw: str) -> str:
        encoded = original(raw)
        now[0] = pending_invitation.expires_at
        return encoded

    monkeypatch.setattr(service_module, "hash_password", expire_during_hash)
    with pytest.raises(FamiliesError) as error:
        service.register_invited(**registration)

    assert error.value.code == "invitation_expired"
    assert_not_registered(pending_invitation)


def test_simultaneous_registration_can_consume_invitation_only_once(
    registration: dict[str, object],
    pending_invitation: SimpleNamespace,
) -> None:
    barrier = Barrier(2)

    def register() -> str:
        with Session(engine) as session:
            barrier.wait(timeout=5)
            try:
                FamiliesService(session).register_invited(**registration)
            except FamiliesError as exc:
                return exc.code
        return "registered"

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(register) for _ in range(2)]
        results = [future.result(timeout=15) for future in futures]

    assert sorted(results) == ["invitation_used", "registered"]
    with Session(engine) as observer:
        assert (
            observer.scalar(
                select(func.count()).select_from(User).where(User.email == pending_invitation.email)
            )
            == 1
        )
