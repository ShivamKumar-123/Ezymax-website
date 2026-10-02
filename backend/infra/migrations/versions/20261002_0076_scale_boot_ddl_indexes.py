"""Section F (horizontal scale): boot DDL → migration, engine-correctness
schema, and the missing hot-path indexes.

1. Boot work moved out of process start-up
   * gateway ``_backfill_close_reasons`` — a table-wide UPDATE on trade_history
     that ran on EVERY gateway boot (and a per-user copy on every history page
     load). Run once here; the trader history now derives the SL/TP label at
     read time without writing.
   * gateway ``_ensure_pamm_units_column`` seed (units = allocation_amount for
     legacy active PAMM rows still at 0). Column itself already in 0058.
   * admin ``_apply_startup_ddl`` — every statement already lives in a
     migration (0055/0056 algo keys, 0062 broker tenancy, 0063 users_role_check,
     0070 employees.extra_permissions, baseline system_settings). Its
     ``DROP/ADD CONSTRAINT users_role_check`` re-validated the whole users
     table under an ACCESS EXCLUSIVE lock on every admin boot; it is removed
     from the code, nothing to add here.
2. ``users.last_statement_month`` — durable per-user claim for the monthly
   statement engine (one email per user per month across all replicas).
3. UNIQUE (copy_trades.master_position_id, investor_allocation_id) — the copy
   engine dedupes against a CopyTrade in ANY status. Duplicates are reported
   with RAISE WARNING and the index is skipped (never deletes data).
   NOTE: deliberately NO unique index on trade_history(position_id) — partial
   closes legitimately write several rows per position.
4. Missing indexes, all ``CREATE INDEX CONCURRENTLY IF NOT EXISTS`` in
   autocommit blocks (no long table locks on a live database).
5. ``pg_trgm`` + trigram GIN indexes for the admin ILIKE '%term%' searches
   (skipped with a warning if the role may not create the extension).

Revision ID: 0076
Revises: 0072
"""
from alembic import op


revision = "0076"
down_revision = "0072"
branch_labels = None
depends_on = None


# (name, table, definition) — definition is everything after "ON <table>".
_INDEXES: list[tuple[str, str, str]] = [
    # copy_trades: engine dedupe / orphan sweep / history "is copy" lookups
    ("ix_copy_trades_master_pos", "copy_trades", "(master_position_id)"),
    ("ix_copy_trades_alloc_status", "copy_trades", "(investor_allocation_id, status)"),
    ("ix_copy_trades_investor_pos", "copy_trades", "(investor_position_id)"),
    ("ix_copy_trades_open", "copy_trades", "(master_position_id) WHERE status = 'open'"),
    # investor_allocations: copy engine EXISTS + pool sums, investor screens
    ("ix_investor_alloc_master_status", "investor_allocations", "(master_id, status)"),
    ("ix_investor_alloc_user_status", "investor_allocations", "(investor_user_id, status)"),
    ("ix_investor_alloc_account", "investor_allocations", "(investor_account_id)"),
    # positions: SL/TP engine scan, spread-override overlay, overnight fee
    ("ix_positions_open_sltp", "positions",
     "(account_id) WHERE status = 'open' AND (stop_loss IS NOT NULL OR take_profit IS NOT NULL)"),
    ("ix_positions_open_spread_override", "positions",
     "(account_id) WHERE status = 'open' AND spread_override IS NOT NULL"),
    ("ix_positions_open_instrument", "positions", "(instrument_id) WHERE status = 'open'"),
    ("ix_positions_closed_at", "positions", "(account_id, closed_at DESC) WHERE status = 'closed'"),
    # trade_history: healer NOT EXISTS + history joins (NON-unique on purpose)
    ("ix_trade_history_position", "trade_history", "(position_id)"),
    # transactions: per-account ledgers, reference lookups
    ("ix_transactions_account_created", "transactions", "(account_id, created_at DESC)"),
    ("ix_transactions_reference", "transactions", "(reference_id)"),
    ("ix_transactions_type_created", "transactions", "(type, created_at DESC)"),
    # notifications: list + unread badge
    ("ix_notifications_user_created", "notifications", "(user_id, created_at DESC)"),
    ("ix_notifications_user_unread", "notifications", "(user_id) WHERE is_read = false"),
    # users: case-insensitive email lookups, status scans, reminder cohort
    ("ix_users_lower_email", "users", "(lower(email))"),
    ("ix_users_status_id", "users", "(status, id)"),
    ("ix_users_created_at", "users", "(created_at)"),
    ("ix_users_kyc_reminder", "users",
     "(created_at) WHERE kyc_status IN ('pending', 'rejected') AND kyc_reminder_stage < 2"),
    # deposits / withdrawals: admin queues
    ("ix_deposits_status_created", "deposits", "(status, created_at DESC)"),
    ("ix_withdrawals_status_created", "withdrawals", "(status, created_at DESC)"),
]

_TRGM_INDEXES: list[tuple[str, str, str]] = [
    ("ix_users_email_trgm", "users", "USING gin (email gin_trgm_ops)"),
    ("ix_users_first_name_trgm", "users", "USING gin (first_name gin_trgm_ops)"),
    ("ix_users_last_name_trgm", "users", "USING gin (last_name gin_trgm_ops)"),
    ("ix_trading_accounts_number_trgm", "trading_accounts", "USING gin (account_number gin_trgm_ops)"),
]

_COPY_UNIQUE = "uq_copy_trades_master_pos_alloc"


def upgrade() -> None:
    # ── 1 + 2: transactional part ──────────────────────────────────────
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_statement_month VARCHAR(7)")

    # PAMM units seed (was gateway _ensure_pamm_units_column). Idempotent:
    # only rows still at 0.
    op.execute(
        "UPDATE investor_allocations SET units = allocation_amount "
        "WHERE copy_type = 'pamm' AND status = 'active' AND COALESCE(units, 0) = 0"
    )

    # SL/TP close-reason relabel (was gateway _backfill_close_reasons on every
    # boot + a scoped copy on every history read). Idempotent.
    op.execute(
        """
        UPDATE trade_history th
        SET close_reason = CASE
            WHEN p.stop_loss IS NOT NULL AND (
                (LOWER(CAST(p.side AS TEXT)) = 'buy'  AND th.close_price <= p.stop_loss)
             OR (LOWER(CAST(p.side AS TEXT)) = 'sell' AND th.close_price >= p.stop_loss)
            ) THEN 'sl'
            WHEN p.take_profit IS NOT NULL AND (
                (LOWER(CAST(p.side AS TEXT)) = 'buy'  AND th.close_price >= p.take_profit)
             OR (LOWER(CAST(p.side AS TEXT)) = 'sell' AND th.close_price <= p.take_profit)
            ) THEN 'tp'
            ELSE th.close_reason
        END
        FROM positions p
        WHERE th.position_id = p.id
          AND COALESCE(th.close_reason, 'manual') IN ('manual', 'copy_close', 'copy')
          AND (p.stop_loss IS NOT NULL OR p.take_profit IS NOT NULL)
        """
    )

    # ── 3 + 4 + 5: CONCURRENTLY, outside the migration transaction ─────
    with op.get_context().autocommit_block():
        # 3. copy_trades unique — duplicate check first, never delete data.
        op.execute(
            f"""
            DO $$
            DECLARE dup_count integer;
            BEGIN
                SELECT count(*) INTO dup_count FROM (
                    SELECT 1 FROM copy_trades
                    WHERE master_position_id IS NOT NULL AND investor_allocation_id IS NOT NULL
                    GROUP BY master_position_id, investor_allocation_id
                    HAVING count(*) > 1
                ) d;
                IF dup_count > 0 THEN
                    RAISE WARNING '0076: % duplicate (master_position_id, investor_allocation_id) group(s) in copy_trades — {_COPY_UNIQUE} NOT created; resolve manually and re-run the CREATE UNIQUE INDEX', dup_count;
                ELSE
                    RAISE NOTICE '0076: copy_trades has no duplicates — creating {_COPY_UNIQUE}';
                END IF;
            END $$;
            """
        )
        bind = op.get_bind()
        dup = bind.exec_driver_sql(
            "SELECT 1 FROM copy_trades "
            "WHERE master_position_id IS NOT NULL AND investor_allocation_id IS NOT NULL "
            "GROUP BY master_position_id, investor_allocation_id HAVING count(*) > 1 LIMIT 1"
        ).first()
        if dup is None:
            op.execute(
                f"CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS {_COPY_UNIQUE} "
                "ON copy_trades (master_position_id, investor_allocation_id)"
            )

        # 4. plain indexes
        for name, table, definition in _INDEXES:
            op.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {name} ON {table} {definition}")

        # 5. pg_trgm (needs CREATE privilege on the database; warn + skip otherwise)
        op.execute(
            """
            DO $$
            BEGIN
                CREATE EXTENSION IF NOT EXISTS pg_trgm;
            EXCEPTION WHEN insufficient_privilege OR feature_not_supported THEN
                RAISE WARNING '0076: could not create extension pg_trgm (%); trigram search indexes skipped', SQLERRM;
            END $$;
            """
        )
        has_trgm = bind.exec_driver_sql(
            "SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'"
        ).first()
        if has_trgm is not None:
            for name, table, definition in _TRGM_INDEXES:
                op.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {name} ON {table} {definition}")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name, _table, _definition in reversed(_TRGM_INDEXES):
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {name}")
        for name, _table, _definition in reversed(_INDEXES):
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {name}")
        op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {_COPY_UNIQUE}")
    # pg_trgm is left installed (other objects may depend on it). The data
    # backfills (close_reason relabel, PAMM units seed) are not reversible and
    # were idempotent corrections of existing data.
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS last_statement_month")
