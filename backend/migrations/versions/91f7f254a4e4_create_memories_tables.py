"""create memories tables

Revision ID: 91f7f254a4e4
Revises: dc9bbbc9f360
Create Date: 2026-10-27 19:05:52.193107
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "91f7f254a4e4"
down_revision: str | None = "dc9bbbc9f360"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "memories",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("elder_profile_id", sa.Uuid(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "anecdote", "song", name="memory_type", native_enum=False, create_constraint=True
            ),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("url", sa.String(length=2048), nullable=True),
        sa.Column("is_positive", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_sensitive", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "entities_status",
            sa.Enum(
                "pending",
                "completed",
                "failed",
                "not_applicable",
                name="memory_entities_status",
                native_enum=False,
                create_constraint=True,
            ),
            server_default=sa.text("'pending'"),
            nullable=False,
        ),
        sa.Column("content_version", sa.Integer(), server_default=sa.text("1"), nullable=False),
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
        sa.CheckConstraint(
            "(type = 'anecdote' AND text IS NOT NULL AND btrim(text) <> '' "
            "AND length(text) <= 5000 AND url IS NULL AND entities_status <> 'not_applicable') "
            "OR (type = 'song' AND text IS NULL AND url IS NOT NULL AND btrim(url) <> '' "
            "AND left(url, 8) = 'https://' AND entities_status = 'not_applicable')",
            name="ck_memories_content_for_type",
        ),
        sa.CheckConstraint("btrim(title) <> ''", name="ck_memories_title_not_blank"),
        sa.CheckConstraint("content_version >= 1", name="ck_memories_content_version"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["elder_profile_id"], ["elder_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_memories_created_by"), "memories", ["created_by"], unique=False)
    op.create_index(
        "ix_memories_profile_created_id",
        "memories",
        ["elder_profile_id", "created_at", "id"],
        unique=False,
    )
    op.create_table(
        "memory_entities",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("memory_id", sa.Uuid(), nullable=False),
        sa.Column(
            "kind",
            sa.Enum(
                "person",
                "place",
                "period",
                "activity",
                name="memory_entity_kind",
                native_enum=False,
                create_constraint=True,
            ),
            nullable=False,
        ),
        sa.Column("text", sa.Text(), nullable=False),
        sa.CheckConstraint(
            "btrim(text) <> '' AND length(text) <= 5000", name="ck_memory_entities_text"
        ),
        sa.ForeignKeyConstraint(["memory_id"], ["memories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_memory_entities_memory_id"), "memory_entities", ["memory_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_memory_entities_memory_id"), table_name="memory_entities")
    op.drop_table("memory_entities")
    op.drop_index("ix_memories_profile_created_id", table_name="memories")
    op.drop_index(op.f("ix_memories_created_by"), table_name="memories")
    op.drop_table("memories")
