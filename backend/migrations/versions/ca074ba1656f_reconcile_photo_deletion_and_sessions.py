"""reconcile photo deletion and sessions

Revision ID: ca074ba1656f
Revises: fab6d11fe74d, 0f40e3d7e94d
Create Date: 2026-11-10 21:46:18.524438
"""

from collections.abc import Sequence

revision: str = "ca074ba1656f"
down_revision: str | None = ("fab6d11fe74d", "0f40e3d7e94d")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
