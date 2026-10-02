"""Money integrity (hardening spec A1/A2/A3/A11).

* A1 — ``transactions.idempotency_key`` + UNIQUE index: gateway credits, daily
  fees and other exactly-once movements claim a deterministic key with
  ``INSERT … ON CONFLICT DO NOTHING`` (packages.common.src.money_tx).
* A2 — ``CHECK (main_wallet_balance >= 0)`` on users. Added NOT VALID, then
  VALIDATEd only when no existing row violates it (a WARNING is raised and the
  constraint is left NOT VALID otherwise — it still guards every new write).
* A3 — ``deposits.razorpay_order_id`` / ``razorpay_payment_id`` (UNIQUE, server
  written, never overwritten) + ``razorpay_amount_paise``. Backfilled from the
  legacy ``transaction_id`` (order_… while pending, pay_… once credited).
* A11 — withdrawals: payout tx hashes normalised (trim + lowercase) and made
  unique (partial functional index).

Every UNIQUE index is preceded by a duplicate check: when duplicates exist a
WARNING is raised and that index is skipped (no data is ever deleted).
Indexes are built CONCURRENTLY inside autocommit blocks.

Revision ID: 0072
Revises: 0071
"""
from alembic import op


revision = "0072"
down_revision = "0071"
branch_labels = None
depends_on = None


def _create_unique_index_if_no_dups(
    *, index: str, table: str, expr: str, dup_sql: str, where: str | None = None,
) -> None:
    """CREATE UNIQUE INDEX CONCURRENTLY unless ``dup_sql`` finds duplicates."""
    bind = op.get_bind()
    dups = bind.exec_driver_sql(dup_sql).scalar() or 0
    if dups:
        op.execute(
            "DO $$ BEGIN RAISE WARNING "
            f"'0072: % duplicate groups in {table} — skipping unique index {index}; "
            "resolve manually and re-run', " + str(int(dups)) + "; END $$;"
        )
        return
    where_sql = f" WHERE {where}" if where else ""
    with op.get_context().autocommit_block():
        op.execute(
            f"CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS {index} "
            f"ON {table} ({expr}){where_sql}"
        )


def upgrade() -> None:
    # ── A1: ledger idempotency key ───────────────────────────────────────
    op.execute(
        "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(160)"
    )

    # ── A3: Razorpay identifiers ─────────────────────────────────────────
    op.execute("ALTER TABLE deposits ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(64)")
    op.execute("ALTER TABLE deposits ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(64)")
    op.execute("ALTER TABLE deposits ADD COLUMN IF NOT EXISTS razorpay_amount_paise BIGINT")
    # Backfill: the legacy flow stamped the order id into transaction_id at
    # order creation and overwrote it with the payment id on credit.
    op.execute(
        "UPDATE deposits SET razorpay_order_id = transaction_id "
        "WHERE method = 'razorpay' AND razorpay_order_id IS NULL "
        "AND transaction_id LIKE 'order\\_%'"
    )
    op.execute(
        "UPDATE deposits SET razorpay_payment_id = transaction_id "
        "WHERE method = 'razorpay' AND razorpay_payment_id IS NULL "
        "AND transaction_id LIKE 'pay\\_%'"
    )

    # ── A11: canonical withdrawal payout hashes ──────────────────────────
    op.execute(
        "UPDATE withdrawals SET crypto_tx_hash = lower(btrim(crypto_tx_hash)) "
        "WHERE crypto_tx_hash IS NOT NULL AND crypto_tx_hash <> lower(btrim(crypto_tx_hash))"
    )

    # ── A2: non-negative main wallet ─────────────────────────────────────
    op.execute(
        """
        DO $$
        DECLARE bad integer;
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'ck_users_main_wallet_non_negative'
            ) THEN
                ALTER TABLE users ADD CONSTRAINT ck_users_main_wallet_non_negative
                    CHECK (main_wallet_balance >= 0) NOT VALID;
            END IF;
            SELECT count(*) INTO bad FROM users WHERE main_wallet_balance < 0;
            IF bad = 0 THEN
                ALTER TABLE users VALIDATE CONSTRAINT ck_users_main_wallet_non_negative;
            ELSE
                RAISE WARNING '0072: % users have a negative main_wallet_balance — '
                    'ck_users_main_wallet_non_negative left NOT VALID (still enforced '
                    'for new writes); fix the rows then VALIDATE it', bad;
            END IF;
        END $$;
        """
    )

    # ── UNIQUE indexes (duplicate-checked, concurrent) ──────────────────
    _create_unique_index_if_no_dups(
        index="ux_transactions_idempotency_key",
        table="transactions",
        expr="idempotency_key",
        dup_sql=(
            "SELECT count(*) FROM (SELECT idempotency_key FROM transactions "
            "WHERE idempotency_key IS NOT NULL GROUP BY idempotency_key "
            "HAVING count(*) > 1) d"
        ),
    )
    _create_unique_index_if_no_dups(
        index="ux_deposits_razorpay_order_id",
        table="deposits",
        expr="razorpay_order_id",
        dup_sql=(
            "SELECT count(*) FROM (SELECT razorpay_order_id FROM deposits "
            "WHERE razorpay_order_id IS NOT NULL GROUP BY razorpay_order_id "
            "HAVING count(*) > 1) d"
        ),
    )
    _create_unique_index_if_no_dups(
        index="ux_deposits_razorpay_payment_id",
        table="deposits",
        expr="razorpay_payment_id",
        dup_sql=(
            "SELECT count(*) FROM (SELECT razorpay_payment_id FROM deposits "
            "WHERE razorpay_payment_id IS NOT NULL GROUP BY razorpay_payment_id "
            "HAVING count(*) > 1) d"
        ),
    )
    _create_unique_index_if_no_dups(
        index="uq_withdrawals_tx_hash",
        table="withdrawals",
        expr="lower(crypto_tx_hash)",
        where="crypto_tx_hash IS NOT NULL",
        dup_sql=(
            "SELECT count(*) FROM (SELECT lower(crypto_tx_hash) FROM withdrawals "
            "WHERE crypto_tx_hash IS NOT NULL GROUP BY lower(crypto_tx_hash) "
            "HAVING count(*) > 1) d"
        ),
    )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS uq_withdrawals_tx_hash")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ux_deposits_razorpay_payment_id")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ux_deposits_razorpay_order_id")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ux_transactions_idempotency_key")
    op.execute(
        "ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_main_wallet_non_negative"
    )
    op.execute("ALTER TABLE deposits DROP COLUMN IF EXISTS razorpay_amount_paise")
    op.execute("ALTER TABLE deposits DROP COLUMN IF EXISTS razorpay_payment_id")
    op.execute("ALTER TABLE deposits DROP COLUMN IF EXISTS razorpay_order_id")
    op.execute("ALTER TABLE transactions DROP COLUMN IF EXISTS idempotency_key")
