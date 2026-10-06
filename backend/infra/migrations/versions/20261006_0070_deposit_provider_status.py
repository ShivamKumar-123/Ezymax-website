"""Record what the payment provider last said about a gateway deposit.

A NOWPayments deposit is created `initiated` and moves to `pending` on the
provider's first `waiting` signal — which means "invoice open, not paid".
The admin panel treated every `pending` deposit as something to approve, so
unpaid crypto invoices sat in the queue with an Approve button next to them,
and approving one would credit money that never arrived.

`provider_status` lets the admin side tell "awaiting payment" from "paid
short, needs a decision" (partially_paid), and `provider_note` carries the
detail (how much actually came in). The columns are added IF NOT EXISTS so
the same DDL can be applied by hand ahead of this file landing on a server
where the model is bind-mounted and goes live on pull.

Revision ID: 0070
Revises: 0069
"""
from alembic import op

revision = "0070"
down_revision = "0069"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE deposits
            ADD COLUMN IF NOT EXISTS provider_status VARCHAR(30),
            ADD COLUMN IF NOT EXISTS provider_note TEXT
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE deposits
            DROP COLUMN IF EXISTS provider_status,
            DROP COLUMN IF EXISTS provider_note
        """
    )
