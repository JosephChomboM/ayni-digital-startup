from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.modules.families.models import (
    ElderProfile,
    Family,
    Invitation,
    User,
    UserConsent,
    UserRole,
)


class FamiliesRepository:
    """Flush writes; the service owns the complete transaction and its commit or rollback."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def create_family(self, *, name: str) -> Family:
        family = Family(name=name)
        self.session.add(family)
        self.session.flush()
        return family

    def get_family(self, family_id: UUID, *, for_update: bool = False) -> Family | None:
        statement = select(Family).where(Family.id == family_id)
        if for_update:
            statement = statement.with_for_update().execution_options(populate_existing=True)
        return self.session.scalar(statement)

    def create_user(
        self, *, family_id: UUID, email: str, name: str, password_hash: str, role: UserRole
    ) -> User:
        user = User(
            family_id=family_id, email=email, name=name, password_hash=password_hash, role=role
        )
        self.session.add(user)
        self.session.flush()
        return user

    def get_user(self, user_id: UUID) -> User | None:
        return self.session.get(User, user_id)

    def get_user_by_email(self, email: str) -> User | None:
        return self.session.scalar(select(User).where(User.email == email))

    def list_members(self, family_id: UUID) -> list[User]:
        return list(
            self.session.scalars(
                select(User).where(User.family_id == family_id).order_by(User.created_at, User.id)
            )
        )

    def create_consent(self, *, user_id: UUID, text_version: str, text: str) -> UserConsent:
        consent = UserConsent(user_id=user_id, text_version=text_version, text=text)
        self.session.add(consent)
        self.session.flush()
        return consent

    def get_consent(self, user_id: UUID) -> UserConsent | None:
        return self.session.scalar(select(UserConsent).where(UserConsent.user_id == user_id))

    def get_elder_profile(self, family_id: UUID) -> ElderProfile | None:
        return self.session.scalar(select(ElderProfile).where(ElderProfile.family_id == family_id))

    def save_elder_profile(
        self, *, family_id: UUID, name: str, birth_decade: int, interests: list[str]
    ) -> ElderProfile:
        statement = insert(ElderProfile).values(
            family_id=family_id, name=name, birth_decade=birth_decade, interests=list(interests)
        )
        statement = statement.on_conflict_do_update(
            constraint="uq_elder_profiles_family_id",
            set_={
                "name": statement.excluded.name,
                "birth_decade": statement.excluded.birth_decade,
                "interests": statement.excluded.interests,
                "updated_at": func.now(),
            },
        ).returning(ElderProfile)
        return self.session.scalars(statement, execution_options={"populate_existing": True}).one()

    def create_invitation(
        self,
        *,
        family_id: UUID,
        email: str,
        token_hash: str,
        created_at: datetime,
        expires_at: datetime,
    ) -> Invitation:
        invitation = Invitation(
            family_id=family_id,
            email=email,
            token_hash=token_hash,
            created_at=created_at,
            expires_at=expires_at,
        )
        self.session.add(invitation)
        self.session.flush()
        return invitation

    def get_invitation(
        self, *, family_id: UUID, invitation_id: UUID, for_update: bool = False
    ) -> Invitation | None:
        statement = select(Invitation).where(
            Invitation.family_id == family_id, Invitation.id == invitation_id
        )
        if for_update:
            statement = statement.with_for_update().execution_options(populate_existing=True)
        return self.session.scalar(statement)

    def get_invitation_by_token_hash(
        self, token_hash: str, *, for_update: bool = False
    ) -> Invitation | None:
        statement = select(Invitation).where(Invitation.token_hash == token_hash)
        if for_update:
            statement = statement.with_for_update().execution_options(populate_existing=True)
        return self.session.scalar(statement)

    def list_invitations(self, family_id: UUID) -> list[Invitation]:
        return list(
            self.session.scalars(
                select(Invitation)
                .where(Invitation.family_id == family_id)
                .order_by(Invitation.created_at.desc(), Invitation.id)
            )
        )

    def get_pending_invitation(
        self, *, family_id: UUID, email: str, at: datetime
    ) -> Invitation | None:
        return self.session.scalar(
            select(Invitation)
            .where(
                Invitation.family_id == family_id,
                Invitation.email == email,
                Invitation.accepted_at.is_(None),
                Invitation.revoked_at.is_(None),
                Invitation.created_at <= at,
                Invitation.expires_at > at,
            )
            .order_by(Invitation.created_at.desc(), Invitation.id)
            .limit(1)
        )

    def accept_invitation(
        self, *, family_id: UUID, invitation_id: UUID, at: datetime
    ) -> Invitation | None:
        return self._finish_invitation(
            family_id=family_id, invitation_id=invitation_id, at=at, accept=True
        )

    def revoke_invitation(
        self, *, family_id: UUID, invitation_id: UUID, at: datetime
    ) -> Invitation | None:
        return self._finish_invitation(
            family_id=family_id, invitation_id=invitation_id, at=at, accept=False
        )

    def _finish_invitation(
        self, *, family_id: UUID, invitation_id: UUID, at: datetime, accept: bool
    ) -> Invitation | None:
        values = {"accepted_at" if accept else "revoked_at": at}
        statement = (
            update(Invitation)
            .where(
                Invitation.family_id == family_id,
                Invitation.id == invitation_id,
                Invitation.accepted_at.is_(None),
                Invitation.revoked_at.is_(None),
                Invitation.created_at <= at,
                Invitation.expires_at > at,
            )
            .values(**values)
            .returning(Invitation)
        )
        return self.session.scalars(
            statement, execution_options={"populate_existing": True}
        ).one_or_none()
