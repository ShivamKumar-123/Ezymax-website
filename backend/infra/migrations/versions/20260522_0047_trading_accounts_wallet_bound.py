"""Add trading_accounts.is_wallet_account for the wallet-bound account model.

When a user links a wallet, we provision a single dedicated TradingAccount
flagged as `is_wallet_account=TRUE`. This account becomes the destination
for all on-chain deposits and the source for all withdrawals — collapsing
the two-step (deposit → main_wallet → transfer → trading account) UX into
one mental model.

DB-side enforcement of "max one wallet-bound account per user" via a
partial unique index on `is_wallet_account=TRUE AND is_active=TRUE`. The
`is_active` predicate lets a closed/archived wallet account coexist with
a fresh one (e.g., user unlinks then relinks).

Idempotent — safe to re-run.

Revision ID: 0047
Revises: 0046
"""
from alembic import op


revision = "0047"
down_revision = "0046"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE trading_accounts "
        "ADD COLUMN IF NOT EXISTS is_wallet_account BOOLEAN NOT NULL DEFAULT FALSE;"
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ux_one_wallet_account_per_user
            ON trading_accounts (user_id)
            WHERE is_wallet_account = TRUE AND is_active = TRUE
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ux_one_wallet_account_per_user;")
    op.execute("ALTER TABLE trading_accounts DROP COLUMN IF EXISTS is_wallet_account;")
