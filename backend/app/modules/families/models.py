from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import (
    ARRAY,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class UserRole(StrEnum):
    PRIMARY_CAREGIVER = "cuidador_principal"
    FAMILY_MEMBER = "familiar"


class Family(Base):
    __tablename__ = "families"
    __table_args__ = (CheckConstraint("btrim(name) <> ''", name="ck_families_name_not_blank"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    users: Mapped[list["User"]] = relationship(
        back_populates="family", cascade="all, delete-orphan", passive_deletes=True
    )
    elder_profile: Mapped["ElderProfile | None"] = relationship(
        back_populates="family", cascade="all, delete-orphan", passive_deletes=True
    )
    invitations: Mapped[list["Invitation"]] = relationship(
        back_populates="family", cascade="all, delete-orphan", passive_deletes=True
    )


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        CheckConstraint("email = lower(btrim(email))", name="ck_users_email_normalized"),
        CheckConstraint("btrim(email) <> ''", name="ck_users_email_not_blank"),
        CheckConstraint("btrim(name) <> ''", name="ck_users_name_not_blank"),
        Index(
            "uq_users_family_primary_caregiver",
            "family_id",
            unique=True,
            postgresql_where=text("role = 'cuidador_principal'"),
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    family_id: Mapped[UUID] = mapped_column(
        ForeignKey("families.id", ondelete="CASCADE"), index=True
    )
    email: Mapped[str] = mapped_column(String(254))
    name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(
        SQLAlchemyEnum(
            UserRole,
            values_callable=lambda roles: [role.value for role in roles],
            native_enum=False,
            create_constraint=True,
            name="user_role",
        )
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    family: Mapped[Family] = relationship(back_populates="users")
    consent: Mapped["UserConsent | None"] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )


class ElderProfile(Base):
    __tablename__ = "elder_profiles"
    __table_args__ = (
        UniqueConstraint("family_id", name="uq_elder_profiles_family_id"),
        CheckConstraint("btrim(name) <> ''", name="ck_elder_profiles_name_not_blank"),
        CheckConstraint(
            "birth_decade >= 0 AND mod(birth_decade, 10) = 0",
            name="ck_elder_profiles_birth_decade",
        ),
        CheckConstraint(
            "birth_decade <= EXTRACT(YEAR FROM CURRENT_DATE)",
            name="ck_elder_profiles_birth_decade_not_future",
        ),
        CheckConstraint("cardinality(interests) <= 20", name="ck_elder_profiles_interests_limit"),
        CheckConstraint(
            "array_position(interests, NULL) IS NULL", name="ck_elder_profiles_interests_not_null"
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    family_id: Mapped[UUID] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))
    birth_decade: Mapped[int] = mapped_column(SmallInteger)
    interests: Mapped[list[str]] = mapped_column(
        ARRAY(String(100)), default=list, server_default=text("'{}'")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    family: Mapped[Family] = relationship(back_populates="elder_profile")


class UserConsent(Base):
    __tablename__ = "user_consents"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_consents_user_id"),
        CheckConstraint("btrim(text_version) <> ''", name="ck_user_consents_version_not_blank"),
        CheckConstraint("btrim(text) <> ''", name="ck_user_consents_text_not_blank"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    text_version: Mapped[str] = mapped_column(String(20))
    text: Mapped[str] = mapped_column(Text)
    accepted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User] = relationship(back_populates="consent")


class Invitation(Base):
    __tablename__ = "family_invitations"
    __table_args__ = (
        UniqueConstraint("token_hash", name="uq_family_invitations_token_hash"),
        CheckConstraint(
            "email = lower(btrim(email))", name="ck_family_invitations_email_normalized"
        ),
        CheckConstraint("btrim(email) <> ''", name="ck_family_invitations_email_not_blank"),
        CheckConstraint("role = 'familiar'", name="ck_family_invitations_role"),
        CheckConstraint("length(token_hash) = 64", name="ck_family_invitations_token_hash_length"),
        CheckConstraint("expires_at > created_at", name="ck_family_invitations_expiry"),
        CheckConstraint(
            "accepted_at IS NULL OR (accepted_at >= created_at AND accepted_at < expires_at)",
            name="ck_family_invitations_acceptance_time",
        ),
        CheckConstraint(
            "revoked_at IS NULL OR revoked_at >= created_at",
            name="ck_family_invitations_revocation_time",
        ),
        CheckConstraint(
            "accepted_at IS NULL OR revoked_at IS NULL", name="ck_family_invitations_single_outcome"
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    family_id: Mapped[UUID] = mapped_column(
        ForeignKey("families.id", ondelete="CASCADE"), index=True
    )
    email: Mapped[str] = mapped_column(String(254))
    role: Mapped[str] = mapped_column(String(20), default=UserRole.FAMILY_MEMBER.value)
    token_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    family: Mapped[Family] = relationship(back_populates="invitations")
