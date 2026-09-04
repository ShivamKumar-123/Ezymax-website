"""High-water mark for copy-trading performance fees.

Fees were charged on every profitable close with no memory of prior
losses, so a choppy master overcharged followers (see
packages/common/src/copy_fees.py for the worked example). These two
columns carry the mark:

  gross_pnl_cum — cumulative GROSS realised P&L per allocation
  hwm_profit    — highest gross_pnl_cum ever charged against

Both default to 0: the mark applies from activation forward. Existing
followers are never retro-charged and past fees are never refunded.

Revision ID: 0064
Revises: 0063
"""
from alembic import op


revision = "0064"
down_revision = "0063"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE investor_allocations ADD COLUMN IF NOT EXISTS "
        "gross_pnl_cum NUMERIC(18,8) NOT NULL DEFAULT 0"
    )
    op.execute(
        "ALTER TABLE investor_allocations ADD COLUMN IF NOT EXISTS "
        "hwm_profit NUMERIC(18,8) NOT NULL DEFAULT 0"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE investor_allocations DROP COLUMN IF EXISTS hwm_profit")
    op.execute("ALTER TABLE investor_allocations DROP COLUMN IF EXISTS gross_pnl_cum")
