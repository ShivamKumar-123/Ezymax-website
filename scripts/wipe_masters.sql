-- ============================================================
-- WIPE ALL MASTER ACCOUNTS (PAMM + MAM + Signal Provider) from production.
--
-- What this deletes:
--   1. copy_trades                 — all follower→master links
--   2. investor_allocations        — all invest/subscribe records
--   3. master_accounts             — all provider/manager records
--   4. positions + trade_history   — only the ones on master pool accounts
--                                    and on investor sub-accounts
--   5. orders                      — orders on those accounts
--      (ib_commissions.source_trade_id is NULL'd first so IB earning
--      records survive the wipe with the order link removed)
--   6. transactions                — transactions on those accounts
--   7. trading_accounts            — prefixed PM/MM/CT (master pools)
--                                    and CF/IF (investor sub-accounts)
--
-- What this KEEPS:
--   • users, their KYC, their regular live/demo trading accounts (PT*, DM*, etc.)
--   • deposits, withdrawals, main_wallet_balance (funds are NOT returned —
--     if you want to refund sub-account balances to main_wallet first,
--     uncomment the REFUND block below BEFORE the DELETE block)
--   • ib_commissions records themselves (just unlinked from orders)
--
-- Usage (run inside the `postgres` container in production):
--   docker compose exec -T postgres psql -U trustedge -d trustedge < scripts/wipe_masters.sql
--
-- The whole thing runs in a single transaction — if any statement fails,
-- everything rolls back. Review the counts printed by the DRY RUN block
-- before you commit.
-- ============================================================

BEGIN;

-- ─── DRY RUN: counts of what will be affected ───────────────────────
\echo '==== BEFORE ===='
SELECT 'master_accounts' AS table, COUNT(*) FROM master_accounts
UNION ALL SELECT 'investor_allocations', COUNT(*) FROM investor_allocations
UNION ALL SELECT 'copy_trades', COUNT(*) FROM copy_trades
UNION ALL SELECT 'master/investor trading_accounts', COUNT(*)
  FROM trading_accounts
  WHERE account_number ~ '^(PM|MM|CT|CF|IF)'
UNION ALL SELECT 'positions on those accounts', COUNT(*)
  FROM positions p
  JOIN trading_accounts ta ON ta.id = p.account_id
  WHERE ta.account_number ~ '^(PM|MM|CT|CF|IF)';

-- ─── (OPTIONAL) REFUND sub-account balances to main wallet ──────────
-- Uncomment this block if you want each investor to get their sub-account
-- cash back in their main wallet before the sub-account is deleted.
--
-- UPDATE users u
-- SET main_wallet_balance = COALESCE(u.main_wallet_balance, 0) + COALESCE(ta.balance, 0)
-- FROM trading_accounts ta
-- WHERE ta.user_id = u.id
--   AND ta.account_number ~ '^(CF|IF|PM|MM|CT)'
--   AND COALESCE(ta.balance, 0) > 0;
--
-- INSERT INTO transactions (id, user_id, account_id, type, amount, balance_after,
--                           description, created_at)
-- SELECT gen_random_uuid(), ta.user_id, NULL, 'deposit',
--        COALESCE(ta.balance, 0),
--        COALESCE(u.main_wallet_balance, 0),
--        'Refund from ' || ta.account_number || ' (master/sub-account wipe)',
--        NOW()
-- FROM trading_accounts ta
-- JOIN users u ON u.id = ta.user_id
-- WHERE ta.account_number ~ '^(CF|IF|PM|MM|CT)'
--   AND COALESCE(ta.balance, 0) > 0;

-- ─── DELETE ───────────────────────────────────────────────────────────

-- Cache the doomed trading_accounts IDs so we don't re-scan for each step.
CREATE TEMP TABLE _doomed_accounts AS
SELECT id FROM trading_accounts WHERE account_number ~ '^(PM|MM|CT|CF|IF)';

-- 1. copy_trades first (FK → positions, investor_allocations)
DELETE FROM copy_trades;

-- 2. investor_allocations (FK → master_accounts, trading_accounts)
DELETE FROM investor_allocations;

-- 3. trade_history on doomed accounts
DELETE FROM trade_history WHERE account_id IN (SELECT id FROM _doomed_accounts);

-- 4. positions on doomed accounts
DELETE FROM positions WHERE account_id IN (SELECT id FROM _doomed_accounts);

-- 5. Unlink ib_commissions from orders we're about to delete so the FK
--    constraint (ib_commissions.source_trade_id → orders.id) doesn't block
--    the order delete. The commission row itself is kept — that's real
--    money the IB earned, just loses its trade-id trace.
UPDATE ib_commissions
SET source_trade_id = NULL
WHERE source_trade_id IN (
    SELECT id FROM orders WHERE account_id IN (SELECT id FROM _doomed_accounts)
);

-- 6. orders on doomed accounts
DELETE FROM orders WHERE account_id IN (SELECT id FROM _doomed_accounts);

-- 7. transactions on doomed accounts
DELETE FROM transactions WHERE account_id IN (SELECT id FROM _doomed_accounts);

-- 8. master_accounts (account_id FK → trading_accounts, must go before the
--    trading_accounts delete below)
DELETE FROM master_accounts;

-- 9. trading_accounts (the actual pool and sub-account rows)
DELETE FROM trading_accounts WHERE id IN (SELECT id FROM _doomed_accounts);

DROP TABLE _doomed_accounts;

-- ─── AFTER counts ────────────────────────────────────────────────────
\echo '==== AFTER ===='
SELECT 'master_accounts' AS table, COUNT(*) FROM master_accounts
UNION ALL SELECT 'investor_allocations', COUNT(*) FROM investor_allocations
UNION ALL SELECT 'copy_trades', COUNT(*) FROM copy_trades
UNION ALL SELECT 'master/investor trading_accounts', COUNT(*)
  FROM trading_accounts
  WHERE account_number ~ '^(PM|MM|CT|CF|IF)';

-- If all zero above, COMMIT. If anything looks wrong, change this to ROLLBACK.
COMMIT;
