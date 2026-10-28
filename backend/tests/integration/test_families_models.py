from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import engine
from app.modules.families.models import (
    ElderProfile,
    Family,
    Invitation,
    User,
    UserConsent,
    UserRole,
)

pytestmark = pytest.mark.integration


@pytest.fixture
def db_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
        session.rollback()


@pytest.fixture
def family(db_session: Session) -> Family:
    record = Family(name="Familia de prueba")
    db_session.add(record)
    db_session.flush()
    return record


def add_user(
    db_session: Session,
    family: Family,
    *,
    email: str | None = None,
    role: UserRole = UserRole.PRIMARY_CAREGIVER,
) -> User:
    hash_value = "opaque persistence fixture"
    user = User(
        family_id=family.id,
        email=email if email is not None else f"{uuid4().hex}@example.com",
        name="Persona de prueba",
        password_hash=hash_value,
        role=role,
    )
    db_session.add(user)
    db_session.flush()
    return user


def make_invitation(family: Family, **changes: object) -> Invitation:
    now = datetime.now(UTC)
    fields: dict[str, object] = {
        "family_id": family.id,
        "email": "invitado@example.com",
        "token_hash": uuid4().hex + uuid4().hex,
        "created_at": now,
        "expires_at": now + timedelta(hours=72),
    }
    fields.update(changes)
    return Invitation(**fields)


def test_family_data_and_consent_snapshot_are_persisted(
    db_session: Session, family: Family
) -> None:
    user = add_user(db_session, family)
    expected_accepted_at = db_session.scalar(select(func.now()))
    consent_text = (
        "Acepto que Ayni guarde y use los datos que comparto para organizar "
        "actividades familiares. Entiendo que estos datos se almacenan fuera del "
        "Perú, en Estados Unidos, mediante Supabase y Render."
    )
    db_session.add_all(
        [
            UserConsent(user_id=user.id, text_version="1.0", text=consent_text),
            ElderProfile(family_id=family.id, name="Familiar de prueba", birth_decade=1940),
            make_invitation(family),
        ]
    )
    db_session.flush()
    db_session.expire_all()

    assert user.role is UserRole.PRIMARY_CAREGIVER
    assert user.consent is not None
    assert user.consent.text == consent_text
    assert user.consent.text_version == "1.0"
    assert user.consent.accepted_at.utcoffset() is not None
    assert user.consent.accepted_at.astimezone(UTC) == expected_accepted_at.astimezone(UTC)
    assert family.elder_profile is not None
    assert family.elder_profile.interests == []
    assert family.invitations[0].role == UserRole.FAMILY_MEMBER.value
    assert family.invitations[0].accepted_at is None
    assert family.invitations[0].revoked_at is None


def test_email_is_unique_across_families(db_session: Session, family: Family) -> None:
    add_user(db_session, family, email="miembro@example.com")
    other_family = Family(name="Otra familia de prueba")
    db_session.add(other_family)
    db_session.flush()

    with pytest.raises(IntegrityError, match="uq_users_email"):
        add_user(db_session, other_family, email="miembro@example.com")


@pytest.mark.parametrize("email", ["Miembro@example.com", " miembro@example.com ", ""])
def test_database_rejects_non_normalized_or_empty_email(
    db_session: Session, family: Family, email: str
) -> None:
    with pytest.raises(IntegrityError, match="ck_users_email_"):
        add_user(db_session, family, email=email)


def test_family_can_have_only_one_primary_caregiver(db_session: Session, family: Family) -> None:
    add_user(db_session, family)

    with pytest.raises(IntegrityError, match="uq_users_family_primary_caregiver"):
        add_user(db_session, family)


def test_family_can_have_multiple_family_members(db_session: Session, family: Family) -> None:
    add_user(db_session, family)
    first = add_user(db_session, family, role=UserRole.FAMILY_MEMBER)
    second = add_user(db_session, family, role=UserRole.FAMILY_MEMBER)

    assert first.id != second.id
    assert len(family.users) == 3


def test_database_rejects_unknown_user_role(db_session: Session, family: Family) -> None:
    user = add_user(db_session, family)
    user.role = "administrator"  # type: ignore[assignment]

    with pytest.raises(IntegrityError, match="user_role"):
        db_session.flush()


def test_family_can_have_only_one_elder_profile(db_session: Session, family: Family) -> None:
    db_session.add(ElderProfile(family_id=family.id, name="Perfil de prueba", birth_decade=1940))
    db_session.flush()
    db_session.add(ElderProfile(family_id=family.id, name="Otro perfil", birth_decade=1950))

    with pytest.raises(IntegrityError, match="uq_elder_profiles_family_id"):
        db_session.flush()


@pytest.mark.parametrize("birth_decade", [1945, -10, 9990])
def test_database_rejects_invalid_birth_decade(
    db_session: Session, family: Family, birth_decade: int
) -> None:
    db_session.add(
        ElderProfile(family_id=family.id, name="Perfil de prueba", birth_decade=birth_decade)
    )

    with pytest.raises(IntegrityError, match="ck_elder_profiles_birth_decade"):
        db_session.flush()


def test_database_limits_profile_interests(db_session: Session, family: Family) -> None:
    db_session.add(
        ElderProfile(
            family_id=family.id,
            name="Perfil de prueba",
            birth_decade=1940,
            interests=["Música"] * 21,
        )
    )

    with pytest.raises(IntegrityError, match="ck_elder_profiles_interests_limit"):
        db_session.flush()


@pytest.mark.parametrize("outcome", ["accepted_at", "revoked_at"])
def test_invitation_records_a_single_outcome(
    db_session: Session, family: Family, outcome: str
) -> None:
    invitation = make_invitation(family)
    setattr(invitation, outcome, invitation.created_at + timedelta(minutes=1))
    db_session.add(invitation)
    db_session.flush()

    assert getattr(invitation, outcome) is not None


def test_invitation_cannot_be_accepted_and_revoked(db_session: Session, family: Family) -> None:
    invitation = make_invitation(family)
    invitation.accepted_at = invitation.created_at + timedelta(minutes=1)
    invitation.revoked_at = invitation.created_at + timedelta(minutes=2)
    db_session.add(invitation)

    with pytest.raises(IntegrityError, match="ck_family_invitations_single_outcome"):
        db_session.flush()


def test_invitation_cannot_be_accepted_at_expiration(db_session: Session, family: Family) -> None:
    invitation = make_invitation(family)
    invitation.accepted_at = invitation.expires_at
    db_session.add(invitation)

    with pytest.raises(IntegrityError, match="ck_family_invitations_acceptance_time"):
        db_session.flush()


def test_invitation_expiration_must_follow_creation(db_session: Session, family: Family) -> None:
    invitation = make_invitation(family)
    invitation.expires_at = invitation.created_at
    db_session.add(invitation)

    with pytest.raises(IntegrityError, match="ck_family_invitations_expiry"):
        db_session.flush()


def test_invitation_cannot_assign_primary_caregiver(db_session: Session, family: Family) -> None:
    db_session.add(make_invitation(family, role=UserRole.PRIMARY_CAREGIVER.value))

    with pytest.raises(IntegrityError, match="ck_family_invitations_role"):
        db_session.flush()


def test_invitation_token_hash_is_unique(db_session: Session, family: Family) -> None:
    first = make_invitation(family)
    db_session.add(first)
    db_session.flush()
    db_session.add(make_invitation(family, token_hash=first.token_hash))

    with pytest.raises(IntegrityError, match="uq_family_invitations_token_hash"):
        db_session.flush()


def test_deleting_family_removes_all_its_module_data(db_session: Session, family: Family) -> None:
    user = add_user(db_session, family)
    consent = UserConsent(user_id=user.id, text_version="1.0", text="Texto de prueba")
    profile = ElderProfile(family_id=family.id, name="Perfil de prueba", birth_decade=1940)
    invitation = make_invitation(family)
    db_session.add_all([consent, profile, invitation])
    other_family = Family(name="Familia que se conserva")
    db_session.add(other_family)
    db_session.flush()

    db_session.execute(delete(Family).where(Family.id == family.id))

    for model, record_id in (
        (Family, family.id),
        (User, user.id),
        (UserConsent, consent.id),
        (ElderProfile, profile.id),
        (Invitation, invitation.id),
    ):
        assert db_session.scalar(select(model.id).where(model.id == record_id)) is None
    assert db_session.scalar(select(Family.id).where(Family.id == other_family.id)) is not None
