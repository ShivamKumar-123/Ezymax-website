"""Add positions.is_fully_funded for Smart Trade Mode.

Pitch deck slide 4 promises a per-trade "Fully Funded vs Leveraged"
choice. The position carries the flag so the overnight-fee engine
charges $0 swap regardless of the account's default leverage, and
the trade open path locks margin to the full notional.

Default false → all existing positions behave as before.

Revision ID: 0045
Revises: 0044
"""
from alembic import op


revision = "0045"
down_revision = "0044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE positions "
        "ADD COLUMN IF NOT EXISTS is_fully_funded BOOLEAN NOT NULL DEFAULT FALSE;"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE positions DROP COLUMN IF EXISTS is_fully_funded;")
