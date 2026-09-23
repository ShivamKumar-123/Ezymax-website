"""C-MONEY-2: normalize on-chain tx hashes and enforce per-network uniqueness.

confirm_tx_hash() deduped a submitted transaction hash in application code only,
so two deposits racing the same hash (or the same hash re-submitted in a
different case) could both be recorded and credited. This adds a partial unique
functional index on (network, lower(crypto_tx_hash)) so the database refuses a
duplicate regardless of case or races, and normalizes existing rows to the
canonical form the app now writes (EVM: 0x-prefixed lowercase; Tron: bare
lowercase hex).

Additive only: normalizes (does not delete) existing data and adds an index.
downgrade() drops the index; the lowercasing is non-destructive and left as-is.

Revision ID: 0068
Revises: 0067
"""
from alembic import op


revision = "0068"
down_revision = "0067"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Canonicalise existing hashes so the unique index groups the same tx.
    op.execute(
        "UPDATE deposits SET crypto_tx_hash = lower(crypto_tx_hash) "
        "WHERE crypto_tx_hash IS NOT NULL"
    )
    # EVM chains need the 0x prefix for chain lookups.
    op.execute(
        "UPDATE deposits SET crypto_tx_hash = '0x' || crypto_tx_hash "
        "WHERE crypto_tx_hash IS NOT NULL AND network IN ('eth','bsc') "
        "AND crypto_tx_hash NOT LIKE '0x%'"
    )
    # Tron stores the bare 64-hex form.
    op.execute(
        "UPDATE deposits SET crypto_tx_hash = substring(crypto_tx_hash from 3) "
        "WHERE crypto_tx_hash IS NOT NULL AND network = 'tron' "
        "AND crypto_tx_hash LIKE '0x%'"
    )
    # Partial unique index: one (network, tx hash) may be recorded once. NULLs
    # (deposits without a hash yet) are excluded so they don't collide.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_deposits_network_tx_hash "
        "ON deposits (network, lower(crypto_tx_hash)) "
        "WHERE crypto_tx_hash IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_deposits_network_tx_hash")
