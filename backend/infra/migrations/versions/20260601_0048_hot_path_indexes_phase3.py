"""Phase-3 hot-path indexes: notifications, positions.last_swap_at,
transactions.type, cleanup-job support indexes.

Migration 0036 covered the obvious account/user composites. Phase 3 audit
found the dashboard's notifications-unread-count poll (2s per user)
still does a Seq Scan because no index covers (user_id, is_read), and
the overnight_fee_engine's hourly scan re-reads every open position
because there's no index on (status, last_swap_at).

Also adding small indexes for the new cleanup_engine — DELETE … WHERE
created_at < cutoff queries need them or the cleanup itself becomes the
hot query.

All additions are `CREATE INDEX IF NOT EXISTS` so a partial re-run of the
migration chain is safe.

Revision ID: 0048
Revises: 0047
"""
from alembic import op


revision = "0048"
down_revision = "0047"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # /notifications/unread-count is polled every 2s per logged-in user.
    # A partial index on the unread rows keeps it tiny (most notifications
    # are eventually read) while making the count() an Index Only Scan.
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_notifications_user_unread
            ON notifications (user_id)
            WHERE is_read = FALSE;
        """
    )
    # The full notification list pages by (user_id, created_at DESC).
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_notifications_user_created
            ON notifications (user_id, created_at DESC);
        """
    )

    # overnight_fee_engine: WHERE status='open' AND (last_swap_at IS NULL
    # OR last_swap_at < now()-24h). Partial covers the only set of rows
    # the engine touches; status='open' positions are a small slice of
    # the total table over time.
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_positions_open_last_swap
            ON positions (last_swap_at NULLS FIRST)
            WHERE status = 'open';
        """
    )

    # /wallet/summary aggregates transactions by (user_id, type). 0036
    # added (user_id, created_at) but not (user_id, type) — wallet_summary
    # filters by type so this is the better-targeted index for that path.
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_transactions_user_type
            ON transactions (user_id, type);
        """
    )

    # ── Cleanup-engine support indexes ──────────────────────────────────
    # Each of these is the predicate for a DELETE the new cleanup_engine
    # runs hourly. Without them the cleanup itself becomes a Seq Scan.

    # email_otp_codes: drop rows that are consumed OR expired.
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_email_otp_codes_cleanup
            ON email_otp_codes (expires_at);
        """
    )

    # wallet_auth_nonces: drop rows older than 1 day (consumed or expired).
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_wallet_auth_nonces_cleanup
            ON wallet_auth_nonces (expires_at);
        """
    )

    # idempotency_keys: drop rows older than the 7-day idempotency window.
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_idempotency_keys_created_at
            ON idempotency_keys (created_at);
        """
    )

    # webhook_events: 0036 added (received_at DESC). Reused for cleanup
    # — same direction works for `< cutoff`. No new index needed.


def downgrade() -> None:
    for ix in (
        "ix_idempotency_keys_created_at",
        "ix_wallet_auth_nonces_cleanup",
        "ix_email_otp_codes_cleanup",
        "ix_transactions_user_type",
        "ix_positions_open_last_swap",
        "ix_notifications_user_created",
        "ix_notifications_user_unread",
    ):
        op.execute(f"DROP INDEX IF EXISTS {ix};")
