"""contexto musical y escena actual de la sesion

Revision ID: 89f58aba2f76
Revises: 7f4e20261112
Create Date: 2026-11-12 10:07:42.664649
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "89f58aba2f76"
down_revision: str | None = "7f4e20261112"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("memories", sa.Column("song_context", sa.JSON(), nullable=True))
    op.add_column("sessions", sa.Column("scene_context", sa.JSON(), nullable=True))
    op.add_column(
        "sessions", sa.Column("scene_updated_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("sessions", "scene_updated_at")
    op.drop_column("sessions", "scene_context")
    op.drop_column("memories", "song_context")
