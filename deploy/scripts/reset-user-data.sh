#!/usr/bin/env bash
#
# DESTRUCTIVE — Wipes user activity (deposits, withdrawals, transactions,
# trades, IB profiles, masters, followers, KYC docs, notifications,
# tickets, sessions) and either:
#   (default)  keeps admin / super_admin users so you can still log in
#   --full     wipes EVERY user including admins (you'll need to re-seed)
#
# Always preserves platform CONFIG: account_groups, instruments + configs,
# charge/spread/swap rules, IB commission plans, banners, bonus offers,
# employees, system_settings, admin deposit wallets, reward catalogs,
# staking plans, spin prizes.
#
# Safety: takes a fresh backup first via deploy/scripts/backup-db.sh,
# refuses to run unless you type RESET, stops the app services before
# touching the DB, and uses ON_ERROR_STOP so a single bad statement
# aborts the whole script instead of marching past the rollback.
#
# Usage:
#   /opt/swisscresta/deploy/scripts/reset-user-data.sh          # keep admins
#   /opt/swisscresta/deploy/scripts/reset-user-data.sh --full   # wipe admins too
#
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/swisscresta}"
COMPOSE="docker compose -f $REPO_DIR/docker-compose.yml -f $REPO_DIR/docker-compose.prod.yml"

MODE="keep-admins"
if [ "${1:-}" = "--full" ]; then
  MODE="full"
fi

# Services to stop / restart. We probe what's defined in compose and
# only act on what's actually there — the trader install at the time
# of writing doesn't ship marketing-frontend, so hard-coding it caused
# "no such service" at restart.
ALL_SERVICES=(gateway admin-api market-data b-book-engine risk-engine trader-frontend admin-frontend marketing-frontend)
APP_SERVICES=()
DEFINED_SERVICES="$($COMPOSE config --services 2>/dev/null || true)"
for s in "${ALL_SERVICES[@]}"; do
  if echo "$DEFINED_SERVICES" | grep -qx "$s"; then
    APP_SERVICES+=("$s")
  fi
done

echo
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  DESTRUCTIVE OPERATION — user-data reset                       ║"
echo "║  Wipes every deposit, withdrawal, trade, IB, copy trade,       ║"
echo "║  allocation, KYC doc, notification, ticket and session.        ║"
if [ "$MODE" = "full" ]; then
  echo "║  --full: ALSO wipes admin + super_admin users.                 ║"
  echo "║          You will need to re-seed via migration 0002.          ║"
else
  echo "║  Admin / super_admin users will be PRESERVED so you can still  ║"
  echo "║  log in afterwards. Use --full to wipe admins as well.         ║"
fi
echo "║  Config (account groups, instruments, fees, banners) is kept.  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo
read -r -p 'Type "RESET" (uppercase) to confirm: ' CONFIRM
if [ "$CONFIRM" != "RESET" ]; then
  echo "Aborted."
  exit 1
fi

echo
echo "[1/4] Taking a fresh backup before the wipe..."
"$REPO_DIR/deploy/scripts/backup-db.sh"

echo
echo "[2/4] Stopping app services so nothing writes mid-reset..."
if [ "${#APP_SERVICES[@]}" -gt 0 ]; then
  $COMPOSE stop "${APP_SERVICES[@]}" 2>/dev/null || true
fi

# Build the table list. Wrapping the TRUNCATE in a PL/pgSQL DO block
# lets us filter out tables that don't exist on this install — the
# schema has drifted from migrations on some prod boxes (e.g.
# algo_api_keys was dropped before some installs got it).
if [ "$MODE" = "full" ]; then
  TABLE_LIST_SQL="
    -- Sessions / auth ephemera
    'user_sessions',
    'user_refresh_tokens',
    'password_reset_tokens',
    'email_otp_codes',
    'sensitive_action_challenges',
    'wallet_auth_nonces',
    'user_2fa_backup_codes',
    'idempotency_keys',
    'webhook_events',
    'wallet_cooldowns',
    -- Trading
    'positions', 'orders', 'trade_history', 'shared_trades', 'trading_accounts',
    -- Money movement
    'deposits', 'withdrawals', 'transactions', 'bank_accounts', 'fund_move_approvals',
    -- Copy / managed
    'copy_trades', 'investor_allocations', 'master_accounts',
    -- IB / referrals
    'ib_commissions', 'ib_applications', 'ib_profiles', 'referrals',
    -- KYC
    'kyc_documents',
    -- Tickets / audit / notifications
    'ticket_messages', 'support_tickets', 'notifications',
    'audit_logs', 'user_audit_logs', 'ip_logs',
    -- Rewards / bonuses / lottery / insurance / staking / vip / bidding
    'user_bonuses', 'rewards_transactions', 'rewards_user_mission_progress',
    'rewards_user_state', 'spin_results', 'lottery_tickets', 'lottery_rounds',
    'insurance_claims', 'insurance_policies',
    'staking_reward_accruals', 'staking_positions',
    'vip_passes', 'bids', 'bidding_rounds', 'lifestyle_fulfillments', 'algo_api_keys',
    -- Users last
    'users'
  "
  DELETE_NON_ADMIN_USERS=""
else
  TABLE_LIST_SQL="
    'user_sessions',
    'user_refresh_tokens',
    'password_reset_tokens',
    'email_otp_codes',
    'sensitive_action_challenges',
    'wallet_auth_nonces',
    'user_2fa_backup_codes',
    'idempotency_keys',
    'webhook_events',
    'wallet_cooldowns',
    'positions', 'orders', 'trade_history', 'shared_trades', 'trading_accounts',
    'deposits', 'withdrawals', 'transactions', 'bank_accounts', 'fund_move_approvals',
    'copy_trades', 'investor_allocations', 'master_accounts',
    'ib_commissions', 'ib_applications', 'ib_profiles', 'referrals',
    'kyc_documents',
    'ticket_messages', 'support_tickets', 'notifications',
    'audit_logs', 'user_audit_logs', 'ip_logs',
    'user_bonuses', 'rewards_transactions', 'rewards_user_mission_progress',
    'rewards_user_state', 'spin_results', 'lottery_tickets', 'lottery_rounds',
    'insurance_claims', 'insurance_policies',
    'staking_reward_accruals', 'staking_positions',
    'vip_passes', 'bids', 'bidding_rounds', 'lifestyle_fulfillments', 'algo_api_keys'
  "
  DELETE_NON_ADMIN_USERS="DELETE FROM users WHERE role NOT IN ('admin', 'super_admin');"
fi

echo
echo "[3/4] Wiping user data ($MODE)..."
$COMPOSE exec -T postgres psql -v ON_ERROR_STOP=1 -U swisscresta -d swisscresta <<SQL
BEGIN;

DO \$\$
DECLARE
  candidate text;
  candidates text[] := ARRAY[
$TABLE_LIST_SQL
  ];
  existing text[] := ARRAY[]::text[];
BEGIN
  FOREACH candidate IN ARRAY candidates LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = candidate
    ) THEN
      existing := array_append(existing, candidate);
    END IF;
  END LOOP;

  IF cardinality(existing) > 0 THEN
    RAISE NOTICE 'Truncating % tables', cardinality(existing);
    EXECUTE 'TRUNCATE TABLE '
         || array_to_string(ARRAY(SELECT quote_ident(t) FROM unnest(existing) t), ', ')
         || ' RESTART IDENTITY CASCADE';
  END IF;
END
\$\$;

$DELETE_NON_ADMIN_USERS

COMMIT;

-- Sanity check after the wipe.
SELECT
  (SELECT count(*) FROM users)             AS users_left,
  (SELECT count(*) FROM users WHERE role IN ('admin','super_admin')) AS admins_left,
  (SELECT count(*) FROM trading_accounts)  AS accounts_left,
  (SELECT count(*) FROM deposits)          AS deposits_left,
  (SELECT count(*) FROM withdrawals)       AS withdrawals_left,
  (SELECT count(*) FROM transactions)      AS transactions_left,
  (SELECT count(*) FROM positions)         AS positions_left,
  (SELECT count(*) FROM master_accounts)   AS masters_left,
  (SELECT count(*) FROM ib_profiles)       AS ibs_left,
  (SELECT count(*) FROM account_groups)    AS groups_kept,
  (SELECT count(*) FROM instruments)       AS instruments_kept,
  (SELECT count(*) FROM system_settings)   AS settings_kept;
SQL

echo
echo "[4/4] Restarting app services..."
if [ "${#APP_SERVICES[@]}" -gt 0 ]; then
  $COMPOSE up -d "${APP_SERVICES[@]}"
fi

echo
echo "✓ Reset complete."
if [ "$MODE" = "full" ]; then
  echo "  Re-seed the super admin by running migration 0002 (reads"
  echo "  ADMIN_EMAIL + ADMIN_PASSWORD from .env):"
  echo "    $COMPOSE exec gateway alembic downgrade 0001 && $COMPOSE exec gateway alembic upgrade head"
else
  echo "  Admins kept — log in with your existing super_admin credentials."
fi
echo "  Backup of the prior state lives under $REPO_DIR/backups/db/daily/"
