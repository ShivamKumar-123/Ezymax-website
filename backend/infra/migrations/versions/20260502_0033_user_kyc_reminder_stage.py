"""Add users.kyc_reminder_stage for verification reminder cadence.

  0 = no reminder sent yet
  1 = 3-day reminder fired
  2 = 7-day reminder fired (terminal — no more reminders)

Used by the verification_reminder_engine to ensure a user only ever
receives at most two KYC nudge emails.

Revision ID: 0033
Revises: 0032
"""
from alembic import op


revision = "0033"
down_revision = "0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS kyc_reminder_stage INTEGER NOT NULL DEFAULT 0;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS kyc_reminder_stage;")
