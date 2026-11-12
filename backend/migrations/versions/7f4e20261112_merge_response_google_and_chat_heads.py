"""merge response and session conversation migration heads

Revision ID: 7f4e20261112
Revises: 66c1b3c9b29d, 6c7497ecaaed
Create Date: 2026-11-12
"""

from collections.abc import Sequence

revision: str = "7f4e20261112"
down_revision: str | Sequence[str] | None = ("66c1b3c9b29d", "6c7497ecaaed")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
