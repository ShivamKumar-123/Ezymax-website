"""Phase 10: NOWPayments wallet-connect deposit fields.

Reuses existing Deposit columns where possible:
  crypto_address → NOWPayments pay_address (no change)
  crypto_tx_hash → user-submitted tx hash (no change)
  transaction_id → NOWPayments payment_id (no change)
  amount         → USD amount (no change)

Adds 4 columns specific to the on-site wallet-connect flow:
  pay_amount     NUMERIC(36,18) — exact crypto amount NOWPayments expects
                 (e.g. 0.000423 ETH for $1.50). High precision for ETH/wei.
  pay_currency   VARCHAR(20)    — NOWPayments currency code (usdterc20, etc.)
  network        VARCHAR(20)    — chain id we surface to the wallet-connect
                 layer (eth, bsc, polygon, arbitrum). Lets the frontend
                 pre-switch the user's MetaMask to the right chain.
  expires_at     TIMESTAMPTZ    — invoice expiry from NOWPayments. UI
                 countdown + a guard against late tx hashes.

All four are nullable so historical OxaPay + manual + hosted-invoice rows
stay valid. Index on (status, expires_at) for the cleanup query that
sweeps expired 'initiated' rows.

Revision ID: 0032
Revises: 0031
"""
from alembic import op


revision = "0032"
down_revision = "0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE deposits ADD COLUMN IF NOT EXISTS pay_amount NUMERIC(36,18);")
    op.execute("ALTER TABLE deposits ADD COLUMN IF NOT EXISTS pay_currency VARCHAR(20);")
    op.execute("ALTER TABLE deposits ADD COLUMN IF NOT EXISTS network VARCHAR(20);")
    op.execute("ALTER TABLE deposits ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;")
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_deposits_status_expires
            ON deposits (status, expires_at)
         WHERE status IN ('initiated', 'pending');
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_deposits_status_expires;")
    op.execute("ALTER TABLE deposits DROP COLUMN IF EXISTS expires_at;")
    op.execute("ALTER TABLE deposits DROP COLUMN IF EXISTS network;")
    op.execute("ALTER TABLE deposits DROP COLUMN IF EXISTS pay_currency;")
    op.execute("ALTER TABLE deposits DROP COLUMN IF EXISTS pay_amount;")
