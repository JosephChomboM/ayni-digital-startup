"""create families tables

Revision ID: dc9bbbc9f360
Revises: 0001
Create Date: 2026-10-26 22:21:39.087817
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "dc9bbbc9f360"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "families",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("btrim(name) <> ''", name="ck_families_name_not_blank"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "elder_profiles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("birth_decade", sa.SmallInteger(), nullable=False),
        sa.Column(
            "interests",
            sa.ARRAY(sa.String(length=100)),
            server_default=sa.text("'{}'"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("btrim(name) <> ''", name="ck_elder_profiles_name_not_blank"),
        sa.CheckConstraint(
            "array_position(interests, NULL) IS NULL", name="ck_elder_profiles_interests_not_null"
        ),
        sa.CheckConstraint(
            "birth_decade <= EXTRACT(YEAR FROM CURRENT_DATE)",
            name="ck_elder_profiles_birth_decade_not_future",
        ),
        sa.CheckConstraint(
            "birth_decade >= 0 AND mod(birth_decade, 10) = 0", name="ck_elder_profiles_birth_decade"
        ),
        sa.CheckConstraint(
            "cardinality(interests) <= 20", name="ck_elder_profiles_interests_limit"
        ),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("family_id", name="uq_elder_profiles_family_id"),
    )
    op.create_table(
        "family_invitations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("btrim(email) <> ''", name="ck_family_invitations_email_not_blank"),
        sa.CheckConstraint("role = 'familiar'", name="ck_family_invitations_role"),
        sa.CheckConstraint(
            "accepted_at IS NULL OR (accepted_at >= created_at AND accepted_at < expires_at)",
            name="ck_family_invitations_acceptance_time",
        ),
        sa.CheckConstraint(
            "accepted_at IS NULL OR revoked_at IS NULL", name="ck_family_invitations_single_outcome"
        ),
        sa.CheckConstraint(
            "email = lower(btrim(email))", name="ck_family_invitations_email_normalized"
        ),
        sa.CheckConstraint("expires_at > created_at", name="ck_family_invitations_expiry"),
        sa.CheckConstraint(
            "length(token_hash) = 64", name="ck_family_invitations_token_hash_length"
        ),
        sa.CheckConstraint(
            "revoked_at IS NULL OR revoked_at >= created_at",
            name="ck_family_invitations_revocation_time",
        ),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash", name="uq_family_invitations_token_hash"),
    )
    op.create_index(
        op.f("ix_family_invitations_family_id"), "family_invitations", ["family_id"], unique=False
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "cuidador_principal",
                "familiar",
                name="user_role",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("btrim(email) <> ''", name="ck_users_email_not_blank"),
        sa.CheckConstraint("btrim(name) <> ''", name="ck_users_name_not_blank"),
        sa.CheckConstraint("email = lower(btrim(email))", name="ck_users_email_normalized"),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index(op.f("ix_users_family_id"), "users", ["family_id"], unique=False)
    op.create_index(
        "uq_users_family_primary_caregiver",
        "users",
        ["family_id"],
        unique=True,
        postgresql_where=sa.text("role = 'cuidador_principal'"),
    )
    op.create_table(
        "user_consents",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("text_version", sa.String(length=20), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column(
            "accepted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("btrim(text) <> ''", name="ck_user_consents_text_not_blank"),
        sa.CheckConstraint("btrim(text_version) <> ''", name="ck_user_consents_version_not_blank"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_consents_user_id"),
    )


def downgrade() -> None:
    op.drop_table("user_consents")
    op.drop_index(
        "uq_users_family_primary_caregiver",
        table_name="users",
        postgresql_where=sa.text("role = 'cuidador_principal'"),
    )
    op.drop_index(op.f("ix_users_family_id"), table_name="users")
    op.drop_table("users")
    op.drop_index(op.f("ix_family_invitations_family_id"), table_name="family_invitations")
    op.drop_table("family_invitations")
    op.drop_table("elder_profiles")
    op.drop_table("families")
