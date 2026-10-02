"""Swap-free is offered per tier, not to any Islamic-flagged trader anywhere.

The overnight fee engine used to exempt every trader with `users.is_islamic`,
whatever account they held. The account specification says otherwise: Standard
and ECN offer swap-free on request, Pro and Prime do not. The engine now reads
that off `account_groups.swap_free_available`, which 0068 set for those four.

Every OTHER tier (Micro, Cent, Elite, Islamic, Demo) was never part of that
specification and is left behaving exactly as before — an Islamic-flagged
trader there stays exempt — by switching the flag on for them here.

Revision ID: 0069
Revises: 0068
"""
from alembic import op

revision = "0069"
down_revision = "0068"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE account_groups
        SET swap_free_available = TRUE
        WHERE name NOT IN ('Pro', 'Prime')
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE account_groups
        SET swap_free_available = FALSE
        WHERE name NOT IN ('Standard', 'ECN')
        """
    )
