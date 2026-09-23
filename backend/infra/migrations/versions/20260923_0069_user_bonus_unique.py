"""H-MONEY-2: one bonus per offer per user.

Deposit/welcome bonuses were applied on every qualifying deposit with no
per-(user, offer) record, so a user could claim the same offer repeatedly. The
application code now writes a UserBonus row and skips an offer already granted;
this partial unique index is the database backstop.

Additive: adds an index only. downgrade() drops it.

Revision ID: 0069
Revises: 0068
"""
from alembic import op


revision = "0069"
down_revision = "0068"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Partial: only rows that actually reference an offer are constrained, so
    # legacy rows with a NULL offer_id are unaffected.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_bonuses_user_offer "
        "ON user_bonuses (user_id, offer_id) "
        "WHERE offer_id IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_user_bonuses_user_offer")
