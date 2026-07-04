"""Backfill historical admin Add-Fund credits so they show as Deposits.

Admin "Add Fund" credits a user's MAIN WALLET by writing a Transaction (it
never creates a `deposits` row). Before commit ba8280b these were booked as
`type='adjustment'`, so they were invisible in the trader's Deposits tab
(which only renders `type='deposit'`). Commit ba8280b switched Add-Fund to
`type='deposit'` going forward; this migration relabels the historical rows
so the trader sees their full deposit history.

Targeting is precise and safe:
  - type = 'adjustment'      → only deduct_fund and the old add_fund write this
  - amount > 0               → excludes deduct_fund (always negative)
  - account_id IS NULL       → main wallet only (add_fund never touches an account)
  - reference_id IS NULL     → not linked to a real gateway deposit row
  - created_by IS NOT NULL   → an admin action, not a system adjustment

Positive main-wallet 'adjustment' rows are ONLY ever produced by the old
Add-Fund path, so no bonus/credit/deduction/correction row can match.

Idempotent (re-running matches nothing after the first pass).

Revision ID: 0057
Revises: 0056
"""
from alembic import op


revision = "0057"
down_revision = "0056"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE transactions
           SET type = 'deposit'
         WHERE type = 'adjustment'
           AND amount > 0
           AND account_id IS NULL
           AND reference_id IS NULL
           AND created_by IS NOT NULL
        """
    )


def downgrade() -> None:
    # No-op: once relabelled, a backfilled 'deposit' row is indistinguishable
    # from a natively-created admin Add-Fund deposit (same type/account/
    # reference/created_by shape), so it cannot be reversed without data loss.
    pass
