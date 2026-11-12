"""guardar conversacion familiar de la sesion

Revision ID: 6c7497ecaaed
Revises: ca074ba1656f
Create Date: 2026-11-11 23:08:40.272998
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "6c7497ecaaed"
down_revision: str | None = "ca074ba1656f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "session_messages",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "session_id",
            sa.Uuid(),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("request_id", sa.Uuid(), nullable=False),
        sa.Column("suggestion", sa.String(20), nullable=False),
        sa.Column("observations", sa.JSON(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("role IN ('user', 'assistant')", name="ck_session_messages_role"),
        sa.UniqueConstraint("session_id", "position", name="uq_session_messages_position"),
        sa.UniqueConstraint("session_id", "request_id", "role", name="uq_session_messages_request"),
    )
    op.create_index("ix_session_messages_session_id", "session_messages", ["session_id"])
    # Solo el backend accede a esta tabla; no se publica por la API de Supabase.
    op.execute("ALTER TABLE session_messages ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_table("session_messages")
