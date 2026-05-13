"""Decentralized wallet-connect deposit flow: admin deposit wallets per chain.

Adds:
  - admin_deposit_wallets table (one active row per network, per asset)
  - partial unique index so only one active row per (network, asset) at a time
  - unique index on (deposits.network, deposits.crypto_tx_hash) so the same
    on-chain transaction cannot be claimed by two different deposit rows
  - Three seed rows (eth, bsc, tron) with placeholder addresses; admin must
    replace these via the Settings → Deposit Wallets UI before the new flow
    is usable. Placeholders satisfy NOT NULL without enabling fake deposits.

Revision ID: 0039
Revises: 0038
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "0039"
down_revision = "0038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS admin_deposit_wallets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            network VARCHAR(20) NOT NULL,
            asset VARCHAR(20) NOT NULL DEFAULT 'USDT',
            address VARCHAR(64) NOT NULL,
            min_confirmations INTEGER NOT NULL DEFAULT 12,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT admin_deposit_wallets_network_check
                CHECK (network IN ('eth', 'bsc', 'tron'))
        );
    """)
    # Only one active row per (network, asset) at a time.
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_admin_deposit_wallets_active
            ON admin_deposit_wallets (network, asset)
         WHERE is_active = TRUE;
    """)
    # Prevent the same tx-hash from being claimed by two deposits on the
    # same chain. Partial — only enforce when the hash is non-null.
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_deposits_network_tx_hash
            ON deposits (network, crypto_tx_hash)
         WHERE crypto_tx_hash IS NOT NULL AND network IS NOT NULL;
    """)
    # Seed rows with placeholders so the partial unique index has at most
    # one active per (network, asset). Admin must replace the addresses
    # before the flow is usable.
    op.execute("""
        INSERT INTO admin_deposit_wallets (network, asset, address, min_confirmations, is_active)
        VALUES
            ('eth',  'USDT', '0x0000000000000000000000000000000000000000', 12, TRUE),
            ('bsc',  'USDT', '0x0000000000000000000000000000000000000000', 15, TRUE),
            ('tron', 'USDT', 'T0000000000000000000000000000000000',         19, TRUE)
        ON CONFLICT DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_deposits_network_tx_hash;")
    op.execute("DROP INDEX IF EXISTS ix_admin_deposit_wallets_active;")
    op.execute("DROP TABLE IF EXISTS admin_deposit_wallets;")
