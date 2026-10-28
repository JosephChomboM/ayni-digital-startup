import hashlib
import secrets
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier
from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.families.models import Invitation
from app.modules.families.service import FamiliesError, FamiliesService

pytestmark = [pytest.mark.integration, pytest.mark.usefixtures("isolated_security_environment")]


@pytest.fixture
def service(caregiver_account: SimpleNamespace) -> Iterator[FamiliesService]:
    with Session(engine) as session:
        yield FamiliesService(session)


def test_create_invitation_normalizes_email_stores_only_hash_and_expires_in_72_hours(
    service: FamiliesService,
    caregiver_account: SimpleNamespace,
) -> None:
    email = f"invitado-{uuid4().hex}@example.com"
    created = service.create_invitation(caregiver_account.user_id, email=f" {email.upper()} ")

    assert created.invitation.email == email
    assert created.invitation.role == "familiar"
    assert created.invitation.status == "pending"
    assert created.invitation.expires_at - created.invitation.created_at == timedelta(hours=72)
    with Session(engine) as observer:
        stored = observer.get(Invitation, created.invitation.id)
        assert stored.token_hash == hashlib.sha256(created.invitation_token.encode()).hexdigest()
        assert stored.token_hash != created.invitation_token
    listing = service.list_invitations(caregiver_account.user_id)
    assert len(listing.items) == 1
    assert created.invitation_token not in listing.model_dump_json()
    assert "token_hash" not in listing.model_dump_json()
    assert created.invitation_token not in repr(created)


@pytest.mark.parametrize("operation", ["create", "list", "revoke"])
@pytest.mark.parametrize("missing", [False, True])
def test_invitation_management_requires_existing_primary_caregiver(
    service: FamiliesService,
    family_member: SimpleNamespace,
    pending_invitation: SimpleNamespace,
    operation: str,
    missing: bool,
) -> None:
    actor_id = uuid4() if missing else family_member.user_id
    with pytest.raises(FamiliesError) as error:
        if operation == "create":
            service.create_invitation(actor_id, email="nuevo@example.com")
        elif operation == "list":
            service.list_invitations(actor_id)
        else:
            service.revoke_invitation(actor_id, pending_invitation.id)

    assert (error.value.code, error.value.status_code) == (
        ("unauthorized", 401) if missing else ("forbidden", 403)
    )
    with Session(engine) as observer:
        assert observer.get(Invitation, pending_invitation.id).revoked_at is None


def test_create_invitation_rejects_pending_duplicate_after_email_normalization(
    service: FamiliesService,
    caregiver_account: SimpleNamespace,
) -> None:
    email = f"invitado-{uuid4().hex}@example.com"
    service.create_invitation(caregiver_account.user_id, email=email)
    with pytest.raises(FamiliesError) as error:
        service.create_invitation(caregiver_account.user_id, email=f" {email.upper()} ")

    assert error.value.code == "invitation_already_pending"
    assert error.value.status_code == 409
    assert len(service.list_invitations(caregiver_account.user_id).items) == 1


def test_create_invitation_rejects_email_registered_in_another_family(
    service: FamiliesService,
    caregiver_account: SimpleNamespace,
    other_caregiver_account: SimpleNamespace,
) -> None:
    with pytest.raises(FamiliesError) as error:
        service.create_invitation(
            caregiver_account.user_id, email=other_caregiver_account.email.upper()
        )

    assert (error.value.code, error.value.status_code) == ("email_already_registered", 409)
    assert service.list_invitations(caregiver_account.user_id).items == []


@pytest.mark.parametrize("state", ["accepted", "revoked", "expired"])
def test_finished_or_expired_invitation_does_not_prevent_a_new_invitation(
    service: FamiliesService,
    caregiver_account: SimpleNamespace,
    pending_invitation: SimpleNamespace,
    state: str,
) -> None:
    with Session(engine) as session, session.begin():
        old = session.get(Invitation, pending_invitation.id)
        if state == "accepted":
            old.accepted_at = datetime.now(UTC)
        elif state == "revoked":
            old.revoked_at = datetime.now(UTC)
        else:
            expired_at = datetime.now(UTC) - timedelta(hours=1)
            old.created_at = expired_at - timedelta(hours=72)
            old.expires_at = expired_at
    created = service.create_invitation(caregiver_account.user_id, email=pending_invitation.email)

    assert created.invitation.id != pending_invitation.id
    assert created.invitation_token != pending_invitation.token.get_secret_value()
    assert {item.status for item in service.list_invitations(caregiver_account.user_id).items} == {
        state,
        "pending",
    }


def test_revoke_invitation_prevents_future_registration(
    service: FamiliesService,
    caregiver_account: SimpleNamespace,
    pending_invitation: SimpleNamespace,
) -> None:
    assert service.revoke_invitation(caregiver_account.user_id, pending_invitation.id) is None
    with pytest.raises(FamiliesError) as error:
        service.register_invited(
            email=pending_invitation.email,
            name="Familiar de prueba",
            password=secrets.token_urlsafe(24),
            invitation_token=pending_invitation.token,
            accepted=True,
            text_version="1.0",
        )

    assert (error.value.code, error.value.status_code) == ("invitation_revoked", 410)


@pytest.mark.parametrize(
    ("state", "code", "status"),
    [
        ("accepted", "invitation_used", 409),
        ("revoked", "invitation_revoked", 410),
        ("expired", "invitation_expired", 410),
    ],
)
def test_revoke_rejects_inactive_invitation(
    service: FamiliesService,
    caregiver_account: SimpleNamespace,
    pending_invitation: SimpleNamespace,
    state: str,
    code: str,
    status: int,
) -> None:
    with Session(engine) as session, session.begin():
        invitation = session.get(Invitation, pending_invitation.id)
        if state == "accepted":
            invitation.accepted_at = datetime.now(UTC)
        elif state == "revoked":
            invitation.revoked_at = datetime.now(UTC)
        else:
            expired_at = datetime.now(UTC) - timedelta(hours=1)
            invitation.created_at = expired_at - timedelta(hours=72)
            invitation.expires_at = expired_at
    with pytest.raises(FamiliesError) as error:
        service.revoke_invitation(caregiver_account.user_id, pending_invitation.id)

    assert (error.value.code, error.value.status_code) == (code, status)


@pytest.mark.parametrize("foreign", [False, True])
def test_revoke_does_not_expose_or_change_another_familys_invitation(
    service: FamiliesService,
    caregiver_account: SimpleNamespace,
    other_caregiver_account: SimpleNamespace,
    foreign: bool,
) -> None:
    with Session(engine) as session:
        created = FamiliesService(session).create_invitation(
            other_caregiver_account.user_id, email=f"invitado-{uuid4().hex}@example.com"
        )
    with pytest.raises(FamiliesError) as error:
        service.revoke_invitation(
            caregiver_account.user_id, created.invitation.id if foreign else uuid4()
        )

    assert (error.value.code, error.value.status_code) == ("invitation_not_found", 404)
    assert service.list_invitations(caregiver_account.user_id).items == []
    with Session(engine) as observer:
        assert observer.get(Invitation, created.invitation.id).revoked_at is None


@pytest.mark.parametrize("operation", ["create", "revoke"])
def test_failed_commit_rolls_back_invitation_management(
    service: FamiliesService,
    caregiver_account: SimpleNamespace,
    pending_invitation: SimpleNamespace,
    operation: str,
) -> None:
    def fail(session: Session) -> None:
        raise RuntimeError("Fallo simulado")

    event.listen(service.session, "before_commit", fail, once=True)
    with pytest.raises(RuntimeError, match="Fallo simulado"):
        if operation == "create":
            service.create_invitation(caregiver_account.user_id, email="nuevo@example.com")
        else:
            service.revoke_invitation(caregiver_account.user_id, pending_invitation.id)

    listing = service.list_invitations(caregiver_account.user_id)
    assert len(listing.items) == 1
    assert listing.items[0].status == "pending"


def test_simultaneous_invitation_creation_creates_one_pending_invitation(
    caregiver_account: SimpleNamespace,
) -> None:
    email = f"invitado-{uuid4().hex}@example.com"
    barrier = Barrier(2)

    def create() -> str:
        with Session(engine) as session:
            barrier.wait(timeout=5)
            try:
                FamiliesService(session).create_invitation(caregiver_account.user_id, email=email)
            except FamiliesError as exc:
                return exc.code
        return "created"

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(create) for _ in range(2)]
        results = [future.result(timeout=15) for future in futures]
    assert sorted(results) == ["created", "invitation_already_pending"]


def test_registration_and_revocation_cannot_both_succeed(
    caregiver_account: SimpleNamespace,
    pending_invitation: SimpleNamespace,
) -> None:
    barrier = Barrier(2)

    def run(register: bool) -> str:
        with Session(engine) as session:
            service = FamiliesService(session)
            barrier.wait(timeout=5)
            try:
                if register:
                    service.register_invited(
                        email=pending_invitation.email,
                        name="Familiar de prueba",
                        password=secrets.token_urlsafe(24),
                        invitation_token=pending_invitation.token,
                        accepted=True,
                        text_version="1.0",
                    )
                    return "registered"
                service.revoke_invitation(caregiver_account.user_id, pending_invitation.id)
                return "revoked"
            except FamiliesError as exc:
                return exc.code

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(run, True), executor.submit(run, False)]
        results = tuple(future.result(timeout=15) for future in futures)
    assert results in {("registered", "invitation_used"), ("invitation_revoked", "revoked")}


@pytest.mark.usefixtures("isolated_security_environment")
@pytest.mark.parametrize(("value", "hours"), [("", 72), ("24", 24)])
def test_invitation_duration_uses_configuration_with_empty_value_falling_back_to_72(
    service: FamiliesService,
    caregiver_account: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
    value: str,
    hours: int,
) -> None:
    monkeypatch.setenv("INVITATION_EXPIRE_HOURS", value)
    created = service.create_invitation(
        caregiver_account.user_id, email=f"invitado-{uuid4().hex}@example.com"
    )
    assert created.invitation.expires_at - created.invitation.created_at == timedelta(hours=hours)
