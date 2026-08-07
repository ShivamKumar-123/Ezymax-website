"""Non-withdrawable bonus wallet balance on users.

Bonuses land in users.bonus_balance; the user transfers them into a trading
account as `credit`, which is consumed before real balance on losses and is
never withdrawable.

Idempotent (ADD COLUMN IF NOT EXISTS).

Revision ID: 0062
Revises: 0061
"""
from alembic import op


revision = "0062"
down_revision = "0061"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_balance NUMERIC(18,8) NOT NULL DEFAULT 0"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS bonus_balance")
