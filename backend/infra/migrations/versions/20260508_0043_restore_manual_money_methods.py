"""Restore manual deposit/withdrawal methods per client request.

Migration 0040 retired the manual bank/UPI/QR money flows in favour of
USDT wallet-connect only. The client has now reversed that decision and
asked for manual flows to be re-enabled (alongside the existing on-chain
flows — the platform is now hybrid again).

This migration widens the CHECK constraints back so users can submit
deposits and withdrawals with the legacy methods. No data migration is
needed — existing rows with `wallet_connect`, `nowpayments`, `oxapay`,
`manual` keep their values; new rows can also be `bank_transfer`,
`upi`, `qr`, `crypto_btc`, `crypto_eth`, `crypto_usdt`, `metamask`.

Allowed methods AFTER this migration:
  deposits:    wallet_connect, nowpayments, oxapay, manual,
               bank_transfer, upi, qr, crypto_btc, crypto_eth,
               crypto_usdt, metamask
  withdrawals: wallet_connect, oxapay, manual,
               bank_transfer, upi, qr, crypto_btc, crypto_eth,
               crypto_usdt, metamask, nowpayments

Revision ID: 0043
Revises: 0042
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "0043"
down_revision = "0042"
branch_labels = None
depends_on = None


_DEPOSIT_METHODS = (
    "wallet_connect",
    "nowpayments",
    "oxapay",
    "manual",
    "bank_transfer",
    "upi",
    "qr",
    "crypto_btc",
    "crypto_eth",
    "crypto_usdt",
    "metamask",
)

_WITHDRAWAL_METHODS = (
    "wallet_connect",
    "oxapay",
    "manual",
    "bank_transfer",
    "upi",
    "qr",
    "crypto_btc",
    "crypto_eth",
    "crypto_usdt",
    "metamask",
    "nowpayments",
)

# Migration 0040 narrowed lists — used for downgrade.
_NARROW_DEPOSIT_METHODS = ("wallet_connect", "nowpayments", "oxapay", "manual")
_NARROW_WITHDRAWAL_METHODS = ("wallet_connect", "oxapay", "manual")


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


def downgrade() -> None:
    dep_sql = ", ".join(f"'{m}'" for m in _NARROW_DEPOSIT_METHODS)
    wd_sql = ", ".join(f"'{m}'" for m in _NARROW_WITHDRAWAL_METHODS)

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
