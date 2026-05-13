"""Hot-path composite indexes + webhook-event idempotency table.

Two unrelated but small additions, batched into one revision to keep the
chain short:

1. Composite indexes — the baseline migration only created indexes on
   users.email and instruments.symbol. Every account-scoped list query
   (open positions, recent orders, deposit history, trade journal) is a
   sequential scan otherwise. Add the obvious composite indexes — all
   CONCURRENTLY-friendly partial indexes where it cuts size further.

2. webhook_events table — a (provider, external_id) unique row per
   processed payment-provider webhook so a network retry can't double-
   credit a deposit. Both NOWPayments and OxaPay verify HMAC signatures
   correctly but had no consumed-marker — a replay would settle twice.

Revision ID: 0036
Revises: 0035
"""
from alembic import op


revision = "0036"
down_revision = "0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Composite + partial indexes for hot account-scoped queries ──────
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_orders_account_created
            ON orders (account_id, created_at DESC);
    """)
    # Partial index targeted at the "still actionable" rows so the b-book
    # engine's pending-orders poll stays cheap. The original draft used
    # `WHERE status IN ('pending', 'partial')` but this codebase's
    # order_status enum doesn't include 'partial' — keep it to the
    # status that's actually defined.
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_orders_account_status
            ON orders (account_id, status)
            WHERE status = 'pending';
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_positions_account_status
            ON positions (account_id, status);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_positions_open
            ON positions (account_id)
            WHERE status = 'open';
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_deposits_user_status
            ON deposits (user_id, status);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_deposits_user_created
            ON deposits (user_id, created_at DESC);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_withdrawals_user_status
            ON withdrawals (user_id, status);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_withdrawals_user_created
            ON withdrawals (user_id, created_at DESC);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_trade_history_account_closed
            ON trade_history (account_id, closed_at DESC);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_transactions_user_created
            ON transactions (user_id, created_at DESC);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_user_audit_logs_user_created
            ON user_audit_logs (user_id, created_at DESC);
    """)

    # ── Webhook event de-dup ────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS webhook_events (
            id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider      VARCHAR(40) NOT NULL,    -- 'nowpayments' | 'oxapay'
            external_id   VARCHAR(120) NOT NULL,   -- provider's payment_id / order_id
            status        VARCHAR(40) NOT NULL,    -- last status seen
            received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            payload_hash  CHAR(64),                -- sha256 of raw body, for diffing
            UNIQUE (provider, external_id, status)
        );
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_webhook_events_received
            ON webhook_events (received_at DESC);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_webhook_events_received;")
    op.execute("DROP TABLE IF EXISTS webhook_events;")
    for ix in (
        "ix_user_audit_logs_user_created",
        "ix_transactions_user_created",
        "ix_trade_history_account_closed",
        "ix_withdrawals_user_created",
        "ix_withdrawals_user_status",
        "ix_deposits_user_created",
        "ix_deposits_user_status",
        "ix_positions_open",
        "ix_positions_account_status",
        "ix_orders_account_status",
        "ix_orders_account_created",
    ):
        op.execute(f"DROP INDEX IF EXISTS {ix};")
