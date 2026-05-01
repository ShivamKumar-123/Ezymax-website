"""Phase 7: User.is_islamic flag — opts the trader into swap-free accounts
and skips overnight leverage fees automatically.

Revision ID: 0027
Revises: 0026
"""
from alembic import op


revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS is_islamic BOOLEAN NOT NULL DEFAULT FALSE;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS is_islamic;")
