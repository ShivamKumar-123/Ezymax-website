"""Allow method = 'admin' on deposits AND withdrawals.

Funds credited by an admin are real money entering the platform and belong
in the deposits table — every deposit figure the platform reports reads
that table, and admin credits were writing only a Transaction, so a day of
nothing but admin credits showed "Deposits Today: 0".

They get their own method rather than being filed as 'manual'. 'manual'
means a client sent money and uploaded proof; an admin adjustment is a
different thing, and collapsing the two would make it impossible to tell
client inflow from internal credit in any report afterwards.

The same applies to admin deductions: money leaving on admin action belongs
in withdrawals, or every net figure inflates — deposits would rise while
admin debits stayed invisible.

Revision ID: 0067
Revises: 0066
"""
from alembic import op


revision = "0067"
down_revision = "0066"
branch_labels = None
depends_on = None

_METHODS = [
    "wallet_connect", "nowpayments", "oxapay", "manual", "bank_transfer",
    "upi", "qr", "crypto_btc", "crypto_eth", "crypto_usdt", "metamask",
    "razorpay", "local_banking",
    "admin",  # ← added
]


def _values(methods) -> str:
    return ", ".join(f"'{m}'" for m in methods)


_W_METHODS = [
    "wallet_connect", "oxapay", "manual", "bank_transfer", "upi", "qr",
    "crypto_btc", "crypto_eth", "crypto_usdt", "metamask", "nowpayments",
    "admin",  # ← added
]


def upgrade() -> None:
    op.execute("ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_method_check")
    op.execute(
        "ALTER TABLE deposits ADD CONSTRAINT deposits_method_check "
        f"CHECK (method IN ({_values(_METHODS)}))"
    )
    op.execute("ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_method_check")
    op.execute(
        "ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_method_check "
        f"CHECK (method IN ({_values(_W_METHODS)}))"
    )


def downgrade() -> None:
    # Anything already filed as 'admin' would violate the narrower constraint,
    # so fold those into 'manual' before restoring it.
    op.execute("UPDATE deposits SET method = 'manual' WHERE method = 'admin'")
    op.execute("UPDATE withdrawals SET method = 'manual' WHERE method = 'admin'")
    op.execute("ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_method_check")
    op.execute(
        "ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_method_check "
        f"CHECK (method IN ({_values([m for m in _W_METHODS if m != 'admin'])}))"
    )
    op.execute("ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_method_check")
    op.execute(
        "ALTER TABLE deposits ADD CONSTRAINT deposits_method_check "
        f"CHECK (method IN ({_values([m for m in _METHODS if m != 'admin'])}))"
    )
