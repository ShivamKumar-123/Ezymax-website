"""Retire manual (bank/UPI/QR) money flows + add smart-contract placeholder columns.

Tightens the deposits/withdrawals method CHECK constraints so no new manual
rows can be inserted. Existing rows with old method values stay valid — the
constraint is INSERT/UPDATE-time, not row-time, so admins can still finish
processing pending bank/UPI deposits already in the system.

Also adds three nullable columns to admin_deposit_wallets that the future
smart-contract deposit pipeline will use. Adding them now keeps the
follow-up plan a code-only change with no schema work.

Allowed methods after this migration:
  deposits:    wallet_connect, nowpayments, oxapay, manual
  withdrawals: wallet_connect, oxapay, manual

Dropped from the allow-list:
  deposits:    bank_transfer, upi, qr
  withdrawals: bank_transfer, upi, qr, crypto_btc, crypto_eth, crypto_usdt,
               metamask, nowpayments

`manual` stays on both sides because the admin "Add Funds" / "Deduct Funds"
feature inserts a deposit/withdrawal-shaped row with that method for the
audit trail.

Revision ID: 0040
Revises: 0039
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "0040"
down_revision = "0039"
branch_labels = None
depends_on = None


_DEPOSIT_METHODS = (
    "wallet_connect",
    "nowpayments",
    "oxapay",
    "manual",
)

_WITHDRAWAL_METHODS = (
    "wallet_connect",
    "oxapay",
    "manual",
)

# Legacy lists for downgrade — restore everything 0038 used to allow.
_LEGACY_METHODS = (
    "bank_transfer", "upi", "qr",
    "crypto_btc", "crypto_eth", "crypto_usdt",
    "metamask", "oxapay", "nowpayments", "manual",
    "wallet_connect",  # 0039 added this implicitly via app code; keep on downgrade
)


def upgrade() -> None:
    dep_sql = ", ".join(f"'{m}'" for m in _DEPOSIT_METHODS)
    wd_sql = ", ".join(f"'{m}'" for m in _WITHDRAWAL_METHODS)

    op.execute("ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_method_check;")
    op.execute(
        f"ALTER TABLE deposits ADD CONSTRAINT deposits_method_check "
        f"CHECK (method IN ({dep_sql}));"
    )
    op.execute("ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_method_check;")
    op.execute(
        f"ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_method_check "
        f"CHECK (method IN ({wd_sql}));"
    )

    # Phase 2 (smart contract) placeholder columns. Nullable so they're a
    # no-op until the verifier branches on contract_address being set.
    op.execute(
        "ALTER TABLE admin_deposit_wallets "
        "ADD COLUMN IF NOT EXISTS contract_address VARCHAR(64);"
    )
    op.execute(
        "ALTER TABLE admin_deposit_wallets "
        "ADD COLUMN IF NOT EXISTS contract_event_abi JSONB;"
    )
    op.execute(
        "ALTER TABLE admin_deposit_wallets "
        "ADD COLUMN IF NOT EXISTS contract_owner_address VARCHAR(64);"
    )


def downgrade() -> None:
    legacy_sql = ", ".join(f"'{m}'" for m in _LEGACY_METHODS)

    op.execute("ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_method_check;")
    op.execute(
        f"ALTER TABLE deposits ADD CONSTRAINT deposits_method_check "
        f"CHECK (method IN ({legacy_sql}));"
    )
    op.execute("ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_method_check;")
    op.execute(
        f"ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_method_check "
        f"CHECK (method IN ({legacy_sql}));"
    )

    op.execute("ALTER TABLE admin_deposit_wallets DROP COLUMN IF EXISTS contract_owner_address;")
    op.execute("ALTER TABLE admin_deposit_wallets DROP COLUMN IF EXISTS contract_event_abi;")
    op.execute("ALTER TABLE admin_deposit_wallets DROP COLUMN IF EXISTS contract_address;")
