"""Add users.tour_completed for the first-time product tour (react-joyride).

Intentionally separate from the email/profile `onboarding_complete` flow so
the UI walkthrough state can evolve independently.

Idempotent (ADD COLUMN IF NOT EXISTS).

Revision ID: 0056
Revises: 0055
"""
from alembic import op


revision = "0056"
down_revision = "0055"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS tour_completed BOOLEAN NOT NULL DEFAULT false"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS tour_completed")
