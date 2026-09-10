"""IB commissions wait for an admin to release them.

Commissions used to be written status='paid' and credited into the IB's
trading account inside the same transaction as the trade fill — money left
the platform with nobody approving it, and IBProfile.pending_payout existed
on the model but was never written to.

They now accrue as 'pending' and an admin releases them, which is when
paid_at is stamped and the balance actually moves.

Existing rows are left exactly as they are: they were genuinely paid under
the old behaviour, and re-opening them would ask admins to approve payouts
that already reached the IB's balance. paid_at stays NULL for those — it
was never recorded, and inventing a timestamp would be worse than an
honest gap.

Revision ID: 0065
Revises: 0064
"""
from alembic import op


revision = "0065"
down_revision = "0064"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE ib_commissions ADD COLUMN IF NOT EXISTS "
        "paid_at TIMESTAMPTZ"
    )
    # The payout screen reads "everything still pending for this IB" on every
    # open and on every approve/reject.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_ib_commissions_ib_status "
        "ON ib_commissions (ib_id, status)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_ib_commissions_ib_status")
    op.execute("ALTER TABLE ib_commissions DROP COLUMN IF EXISTS paid_at")
