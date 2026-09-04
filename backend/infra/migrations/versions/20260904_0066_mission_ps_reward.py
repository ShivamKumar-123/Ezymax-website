"""Per-task PS reward on reward missions.

Claiming a mission used to bump Power Score by a hard-coded +100 regardless of
which task it was, so PS could not be tuned per task the way FXA and XP can.
This adds `rewards_missions.ps_reward`, defaulted to 100 so every existing task
keeps paying exactly what it paid before this migration.

Revision ID: 0066
Revises: 0065
"""
from alembic import op

revision = "0066"
down_revision = "0065"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # DEFAULT 100 backfills existing rows with the old hard-coded amount, so the
    # change is invisible to users until an admin edits a task.
    op.execute(
        "ALTER TABLE rewards_missions "
        "ADD COLUMN IF NOT EXISTS ps_reward INTEGER NOT NULL DEFAULT 100"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE rewards_missions DROP COLUMN IF EXISTS ps_reward")
