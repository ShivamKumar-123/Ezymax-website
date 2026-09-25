"""Add positions.spread_override + spread_override_type — a TEMPORARY per-trade
spread an admin can set on a RUNNING trade. While the position is open it drives
the owner's live quote for that instrument (price + chart + P&L) and its own
close fill; once closed it stops applying and config spreads resume. It never
permanently overrides the account-group / instrument / user spread config.

Additive: two nullable columns. downgrade() drops them.

Revision ID: 0071
Revises: 0070
"""
from alembic import op


revision = "0071"
down_revision = "0070"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE positions ADD COLUMN IF NOT EXISTS spread_override NUMERIC(18, 8)"
    )
    op.execute(
        "ALTER TABLE positions ADD COLUMN IF NOT EXISTS spread_override_type VARCHAR(20)"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE positions DROP COLUMN IF EXISTS spread_override_type")
    op.execute("ALTER TABLE positions DROP COLUMN IF EXISTS spread_override")
