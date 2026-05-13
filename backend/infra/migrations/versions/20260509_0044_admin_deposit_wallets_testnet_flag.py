"""Add is_testnet flag and approval_id idempotency key for vault integration.

Two additive changes preparing the gateway for the BSC-testnet vault
(commit `feat(contracts): FXArthaVaultV1 + Foundry repo`):

1. `admin_deposit_wallets.is_testnet` BOOLEAN — distinguishes a
   testnet deposit wallet from a mainnet one. Same `network` slug
   ('bsc' / 'eth' / 'tron') stays canonical; the boolean disambiguates
   environment. Default false so existing rows are unchanged.

2. `withdrawals.approval_id` VARCHAR(66) UNIQUE — stores the
   bytes32 idempotency key the backend generates per approved
   withdrawal. The vault contract refuses any `withdraw()` call
   carrying an approvalId already seen on-chain; the DB column lets
   the verifier match the `Withdraw` event back to a local row.

Both columns nullable / defaulted so:
  • the migration does not require any data backfill,
  • existing flows (plain USDT transfers to admin wallet) keep
    working unchanged when contract_address IS NULL,
  • the new vault path activates only on rows where
    contract_address IS NOT NULL.

Revision ID: 0044
Revises: 0043
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "0044"
down_revision = "0043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE admin_deposit_wallets "
        "ADD COLUMN IF NOT EXISTS is_testnet BOOLEAN NOT NULL DEFAULT FALSE;"
    )
    # Partial unique index so the same address can simultaneously have a
    # mainnet row AND a testnet row (chain_id differs even though
    # `network` slug doesn't). Without this, the existing UNIQUE on
    # `(network, asset)` would block testnet/mainnet coexistence.
    op.execute("DROP INDEX IF EXISTS ux_admin_deposit_wallets_active_per_chain;")
    op.execute(
        """
        CREATE UNIQUE INDEX ux_admin_deposit_wallets_active_per_chain
            ON admin_deposit_wallets (network, asset, is_testnet)
            WHERE is_active = TRUE
        """
    )

    # On-chain idempotency key for vault withdrawals. NULL for legacy
    # plain-transfer withdrawals; populated for vault-routed ones.
    op.execute(
        "ALTER TABLE withdrawals "
        "ADD COLUMN IF NOT EXISTS approval_id VARCHAR(66);"
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ux_withdrawals_approval_id
            ON withdrawals (approval_id)
            WHERE approval_id IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ux_withdrawals_approval_id;")
    op.execute("ALTER TABLE withdrawals DROP COLUMN IF EXISTS approval_id;")
    op.execute("DROP INDEX IF EXISTS ux_admin_deposit_wallets_active_per_chain;")
    op.execute("ALTER TABLE admin_deposit_wallets DROP COLUMN IF EXISTS is_testnet;")
