"""AI Strategy Maker chat upgrade: explanation column.

The tradezini-style chat maker stores the AI's plain-English explanation of
how the strategy works ("How this strategy works" card on the detail page).

Revision ID: 0060
Revises: 0059
"""
from alembic import op


revision = "0060"
down_revision = "0059"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE ai_strategies ADD COLUMN IF NOT EXISTS explanation TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE ai_strategies DROP COLUMN IF EXISTS explanation")
