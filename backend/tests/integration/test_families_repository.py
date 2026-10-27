import secrets
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.families.models import Family, Invitation, User, UserRole
from app.modules.families.repository import FamiliesRepository

pytestmark = pytest.mark.integration


@pytest.fixture
def repository() -> Iterator[FamiliesRepository]:
    with Session(engine, autoflush=False) as session:
        yield FamiliesRepository(session)
        session.rollback()


@pytest.fixture
def family(repository: FamiliesRepository) -> Family:
    return repository.create_family(name="Familia de prueba")


def create_user(
    repository: FamiliesRepository,
    family: Family,
    *,
    email: str | None = None,
    role: UserRole = UserRole.PRIMARY_CAREGIVER,
) -> User:
    return repository.create_user(
        family_id=family.id,
        email=email if email is not None else f"{uuid4().hex}@example.com",
        name="Persona de prueba",
        password_hash=secrets.token_hex(32),
        role=role,
    )


def create_invitation(
    repository: FamiliesRepository, family: Family, *, email: str = "invitado@example.com"
) -> Invitation:
    now = datetime.now(UTC)
    return repository.create_invitation(
        family_id=family.id,
        email=email,
        token_hash=secrets.token_hex(32),
        created_at=now - timedelta(hours=1),
        expires_at=now + timedelta(hours=71),
    )


def test_create_and_read_user_with_consent(repository: FamiliesRepository, family: Family) -> None:
    user = create_user(repository, family)
    consent = repository.create_consent(
        user_id=user.id, text_version="1.0", text="Texto de consentimiento de prueba"
    )
    repository.session.expire_all()

    assert repository.get_family(family.id, for_update=True).name == "Familia de prueba"
    assert repository.get_user(user.id).family_id == family.id
    assert repository.get_user_by_email(user.email).id == user.id
    saved_consent = repository.get_consent(user.id)
    assert saved_consent.id == consent.id
    assert saved_consent.text == "Texto de consentimiento de prueba"
    assert saved_consent.text_version == "1.0"
    assert saved_consent.accepted_at.tzinfo is not None


def test_missing_records_return_none_or_empty_lists(repository: FamiliesRepository) -> None:
    missing_id = uuid4()

    assert repository.get_family(missing_id) is None
    assert repository.get_user(missing_id) is None
    assert repository.get_user_by_email(f"{missing_id.hex}@example.com") is None
    assert repository.get_consent(missing_id) is None
    assert repository.get_elder_profile(missing_id) is None
    assert repository.get_invitation(family_id=missing_id, invitation_id=uuid4()) is None
    assert repository.get_invitation_by_token_hash(secrets.token_hex(32)) is None
    assert repository.list_members(missing_id) == []
    assert repository.list_invitations(missing_id) == []


def test_members_are_scoped_to_family(repository: FamiliesRepository, family: Family) -> None:
    first = create_user(repository, family)
    second = create_user(repository, family, role=UserRole.FAMILY_MEMBER)
    other_family = repository.create_family(name="Otra familia")
    outsider = create_user(repository, other_family)

    members = repository.list_members(family.id)

    assert [member.id for member in members] == sorted([first.id, second.id])
    assert outsider.id not in {member.id for member in members}


def test_duplicate_email_error_is_available_to_caller(
    repository: FamiliesRepository, family: Family
) -> None:
    existing = create_user(repository, family, email="registrado@example.com")
    other_family = repository.create_family(name="Otra familia")

    with pytest.raises(IntegrityError), repository.session.begin_nested():
        create_user(repository, other_family, email=existing.email)

    assert repository.get_user_by_email(existing.email).id == existing.id


def test_profile_replacement_preserves_identity_and_other_family_data(
    repository: FamiliesRepository, family: Family
) -> None:
    first = repository.save_elder_profile(
        family_id=family.id, name="Perfil de prueba", birth_decade=1940, interests=["Música"]
    )
    original_id, original_created_at = first.id, first.created_at
    other_family = repository.create_family(name="Otra familia")
    other = repository.save_elder_profile(
        family_id=other_family.id, name="Otro perfil", birth_decade=1950, interests=["Cocina"]
    )

    replaced = repository.save_elder_profile(
        family_id=family.id, name="Perfil actualizado", birth_decade=1930, interests=[]
    )

    assert replaced.id == original_id
    assert replaced.created_at == original_created_at
    assert first.name == "Perfil actualizado"
    assert first.birth_decade == 1930
    assert first.interests == []
    repository.session.expire_all()
    assert repository.get_elder_profile(family.id).id == original_id
    assert repository.get_elder_profile(other_family.id).id == other.id
    assert other.name == "Otro perfil"
    assert other.interests == ["Cocina"]


def test_invitation_lookups_and_mutations_are_scoped_to_family(
    repository: FamiliesRepository, family: Family
) -> None:
    invitation = create_invitation(repository, family)
    other_family = repository.create_family(name="Otra familia")
    other = create_invitation(repository, other_family)
    now = datetime.now(UTC)

    assert (
        repository.get_invitation(
            family_id=family.id, invitation_id=invitation.id, for_update=True
        ).id
        == invitation.id
    )
    assert repository.get_invitation_by_token_hash(invitation.token_hash, for_update=True).id == (
        invitation.id
    )
    assert repository.get_invitation(family_id=family.id, invitation_id=other.id) is None
    assert [item.id for item in repository.list_invitations(family.id)] == [invitation.id]
    assert repository.accept_invitation(family_id=family.id, invitation_id=other.id, at=now) is None
    assert repository.revoke_invitation(family_id=family.id, invitation_id=other.id, at=now) is None
    assert other.accepted_at is None
    assert other.revoked_at is None


@pytest.mark.parametrize("state", ["pending", "accepted", "revoked", "expired", "not_created"])
def test_pending_lookup_excludes_inactive_invitations(
    repository: FamiliesRepository, family: Family, state: str
) -> None:
    invitation = create_invitation(repository, family)
    now = datetime.now(UTC)
    if state == "accepted":
        invitation.accepted_at = now - timedelta(minutes=30)
    elif state == "revoked":
        invitation.revoked_at = now - timedelta(minutes=30)
    elif state == "expired":
        invitation.expires_at = now
    elif state == "not_created":
        invitation.created_at = now + timedelta(hours=1)
    repository.session.flush()

    found = repository.get_pending_invitation(family_id=family.id, email=invitation.email, at=now)

    if state == "pending":
        assert found.id == invitation.id
        assert (
            repository.get_pending_invitation(family_id=uuid4(), email=invitation.email, at=now)
            is None
        )
        assert (
            repository.get_pending_invitation(family_id=family.id, email="otro@example.com", at=now)
            is None
        )
    else:
        assert found is None


@pytest.mark.parametrize("accept", [True, False])
def test_invitation_outcome_is_written_only_once(
    repository: FamiliesRepository, family: Family, accept: bool
) -> None:
    invitation = create_invitation(repository, family)
    now = datetime.now(UTC)
    first_action = repository.accept_invitation if accept else repository.revoke_invitation
    other_action = repository.revoke_invitation if accept else repository.accept_invitation

    updated = first_action(family_id=family.id, invitation_id=invitation.id, at=now)

    assert updated.id == invitation.id
    assert invitation.accepted_at == (now if accept else None)
    assert invitation.revoked_at == (None if accept else now)
    assert first_action(family_id=family.id, invitation_id=invitation.id, at=now) is None
    assert other_action(family_id=family.id, invitation_id=invitation.id, at=now) is None


@pytest.mark.parametrize("accept", [True, False])
@pytest.mark.parametrize("boundary", ["before_creation", "at_expiry", "after_expiry"])
def test_invitation_cannot_be_changed_outside_valid_period(
    repository: FamiliesRepository, family: Family, accept: bool, boundary: str
) -> None:
    invitation = create_invitation(repository, family)
    if boundary == "before_creation":
        at = invitation.created_at - timedelta(microseconds=1)
    elif boundary == "at_expiry":
        at = invitation.expires_at
    else:
        at = invitation.expires_at + timedelta(microseconds=1)
    action = repository.accept_invitation if accept else repository.revoke_invitation

    assert action(family_id=family.id, invitation_id=invitation.id, at=at) is None
    repository.session.refresh(invitation)
    assert invitation.accepted_at is None
    assert invitation.revoked_at is None


def test_caller_can_roll_back_all_registration_writes(
    repository: FamiliesRepository, family: Family
) -> None:
    family_id = family.id
    user = create_user(repository, family)
    user_id = user.id
    repository.create_consent(user_id=user_id, text_version="1.0", text="Texto de prueba")
    repository.save_elder_profile(
        family_id=family_id, name="Perfil de prueba", birth_decade=1940, interests=[]
    )
    invitation = create_invitation(repository, family)
    hash_value = invitation.token_hash

    repository.session.rollback()

    assert repository.get_family(family_id) is None
    assert repository.get_user(user_id) is None
    assert repository.get_consent(user_id) is None
    assert repository.get_elder_profile(family_id) is None
    assert repository.get_invitation_by_token_hash(hash_value) is None
