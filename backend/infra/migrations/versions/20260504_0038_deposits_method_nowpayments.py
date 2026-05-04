"""Allow `nowpayments` as a deposits/withdrawals method.

The NowPayments crypto-deposit service shipped without a matching DB
migration to extend the deposits_method_check / withdrawals_method_check
CHECK constraints, so every attempt to insert a `method='nowpayments'`
row fails with CheckViolationError. This revision drops and re-adds
both constraints with `nowpayments` included.

Withdrawals don't currently use NowPayments, but the original 0003
migration kept the two method lists in sync, so we keep them in sync
here too — it costs nothing and avoids a divergence the next time
someone adds a payout integration.
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "0038"
down_revision = "0037"
branch_labels = None
depends_on = None


_METHODS = (
    "bank_transfer",
    "upi",
    "qr",
    "crypto_btc",
    "crypto_eth",
    "crypto_usdt",
    "metamask",
    "oxapay",
    "nowpayments",
    "manual",
)


def upgrade() -> None:
    methods_sql = ", ".join(f"'{m}'" for m in _METHODS)
    op.execute("ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_method_check;")
    op.execute(
        f"ALTER TABLE deposits ADD CONSTRAINT deposits_method_check "
        f"CHECK (method IN ({methods_sql}));"
    )
    op.execute("ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_method_check;")
    op.execute(
        f"ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_method_check "
        f"CHECK (method IN ({methods_sql}));"
    )


def downgrade() -> None:
    legacy = (
        "bank_transfer",
        "upi",
        "qr",
        "crypto_btc",
        "crypto_eth",
        "crypto_usdt",
        "metamask",
        "oxapay",
        "manual",
    )
    methods_sql = ", ".join(f"'{m}'" for m in legacy)
    op.execute("ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_method_check;")
    op.execute(
        f"ALTER TABLE deposits ADD CONSTRAINT deposits_method_check "
        f"CHECK (method IN ({methods_sql}));"
    )
    op.execute("ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_method_check;")
    op.execute(
        f"ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_method_check "
        f"CHECK (method IN ({methods_sql}));"
    )
