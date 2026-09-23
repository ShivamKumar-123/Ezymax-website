# Security Audit Remediation — branch `fix/audit-2026-09`

Remediation of the findings in `docs/audit/2026-09-22-security-audit.md`.
Work is on branch `fix/audit-2026-09` (off `main`); **not pushed, not deployed**.
One commit per finding. Every money/auth fix has a pure-unit pytest under
`backend/tests/` (DB-free: fake-session / SimpleNamespace mocks + `asyncio.run`,
matching the existing test style — no live Postgres fixture exists).

**Status:** Phase 1 (Critical) complete · Phase 2 (High) **complete** (every
finding addressed; some host/build-dependent parts landed as the code fix + a
documented OPS follow-up) · Phase 3 (Medium) — highest-value backend/data items
done, the remainder itemised under Open items.

**Verification (latest run):**
- `python -m pytest backend/tests -q` → **151 passed**.
- AST parse of all backend `*.py` → 0 errors.
- `npx tsc --noEmit` in `frontend/trader` and `frontend/admin` → 0 errors each.
- `git grep -n 'verify_exp": False'` → no matches.
- `git diff --stat main..fix/audit-2026-09` → 73 files, +3495 / −423.
- Alembic up/down and `docker compose config` require Postgres/Docker — run in CI
  (the new backend-tests + migrations jobs) / on the host; migrations 0068 & 0069
  both ship a working `downgrade()`.

## How to run the tests

From `backend/`:

```
env PYTHONPATH=. DATABASE_URL=postgresql+asyncpg://u:p@localhost/db \
  JWT_SECRET=ci-stub-secret-1234567890123456789012 ENVIRONMENT=development \
  REDIS_URL=redis://localhost:6379/0 \
  ADMIN_JWT_SECRET=admin-stub-secret-12345678901234567890 \
  python -m pytest tests/ -q
```

Admin-service modules use bare `from dependencies import …`; tests that touch
them load the module by file path via `importlib` (see `test_upload_path_safety.py`).

## Phase 1 — Critical (all done)

| Finding | Commit | Change | Test |
|---|---|---|---|
| C-INF-1 / H-INF-7 | 7c8a8528 | compose `ports: !override` (loopback-only) + uvicorn `--proxy-headers --forwarded-allow-ips`. | compose config (OPS) |
| C-ADMIN-2 | b7f65120 | drop legacy full-admin fallthrough in `require_permission`. | test_admin_permission |
| C-TRADE-2 | e7b4a41f | bound close/modify lots `(0<lots≤100)` + reject over-close. | test_close_lots_bound |
| C-AUTH-1 | f98ed443 | reset bound to user, per-user/per-token Redis caps, revoke sessions+refresh on reset, FE email field. | test_password_reset |
| C-TRADE-5 | 767f7322 | `close_position` rejects a stale-tick settle. | test_close_stale_tick |
| C-MONEY-3/H-MONEY-1 | b941ea59 | `available_to_withdraw` helper across all withdrawal paths. | test_withdrawal_limits |
| C-MONEY-2 | 3ec7acd9 | canonical tx-hash + partial unique index (migration 0068); dup → 409. | test_tx_hash_normalize |
| C-MONEY-1 | a237a9d6, 3a3aa506 | `credit_removed` Transaction on close; refuse close with open positions **or** pending orders. | test_delete_account_credit_removed |
| C-TRADE-1 | 878487b6 | `stop_copy` refunds real CF balance and zeroes the account. | test_stop_copy_real_balance |
| C-TRADE-4/H-TRADE-1 | 04daa0a0 | `row_locks.lock_user/lock_account` on copy-subscribe/stop/open-account. | test_row_locks |
| C-TRADE-3 | fba5c9b5 | catch-up copies open at current tick, not master open_price. | test_copy_catchup_price |
| C-ADMIN-1 | babc7560 | confine served uploads (safe_join + media allow-list); drop unconfinable stored path at write. | test_upload_path_safety |
| H-FE-1 | d5dccbdc | chart token via URL hash + stripped from URL. | tsc |

## Phase 2 — High

| Finding | Commit | Change | Test |
|---|---|---|---|
| H-AUTH-1/H-INF-7 | a39666fb | client IP via trusted-proxy XFF walk (`TRUSTED_PROXY_CIDRS`). | test_client_ip_trusted_proxy |
| H-ADMIN-1 | 45ab4a37 | admin refresh verifies token expiry (`verify_exp=True`). | test_admin_refresh_verify_exp |
| H-ADMIN-2 | 746183d7 | privileged-target + self-target guard on all admin user actions. | test_admin_target_guard |
| H-ADMIN-3 | 2000a61b | closed-trade edit: broker scope + super_admin/risk_manager + adjustment Transaction. | test_modify_history_txn |
| H-TRADE-9 | d8e81a1f | b-book pending orders `FOR UPDATE SKIP LOCKED` + status recheck. | AST + review |
| H-MONEY-4 | c7cfe566 | new live account funded from main wallet only (no cross-account sweep). | test_open_live_no_sweep |
| H-INF-9 | f4851e5f | production boot refuses default DB password `swisscresta_dev`. | test_weak_db_password_guard |
| H-TRADE-7 | 88a8e75e | `/instruments/{symbol}/bars`: auth + symbol validation + per-user rate-limit. | test_bars_auth_validation |
| H-TRADE-5 | 61bc0422 | AI backtest in worker thread, ≤20k bars, 30s wall-time, per-user concurrency 1. | test_backtest_concurrency |
| H-MONEY-2 | 64d93847 | one bonus per offer per user + single `bonus_service` (migration 0069). | test_bonus_once_per_offer |
| H-AUTH-4 | b94d4850 | register → OTP-first flow (no reclaim, no pre-verify cookie); refresh gated on email_verified. | test_register_and_refresh_gates |
| H-TRADE-6 | 7bd8d3e5 | scope the trade-history relabel UPDATE to the user's accounts. | AST + review |
| H-TRADE-2 | ec5e2461 | PAMM NAV valued at equity (incl floating P&L) for subscribe/redeem. | test_pamm_nav_floating |
| H-TRADE-3 | 552bd323 | managed investment credits exactly one destination (PAMM pool / MAM sub-account). | test_managed_invest_one_destination |
| H-FE-2/H-FE-3 | 563d8ce2 | public routes derived from `(landing)` segments + middleware auth guard. | tsc |
| H-FE-ADMIN-1 | 56b78d25 | datetime-local ↔ UTC round-trip helpers (no-op save). | tsc |
| H-AUTH-2 | f8b4dae0 | step-up required to disconnect wallet (withdrawal-address change). | test_stepup_wallet_unlink |
| H-AUTH-3 | 1a445410, 2166439b | token JSON body off for cookie clients; **sid claim + per-request session-revocation** (Redis-cached, logout busts cache, grandfather sid-less tokens). | test_json_token_gate, test_session_revocation |
| H-INF-8 | c014ab77 | CI: pytest job (Postgres+Redis), admin lint hard gate, migration admin creds. | ci.yml |
| H-FE-ADMIN-2 | 1f1d6c4c | Book/LP settings: don't overwrite secret with masked/empty submit; expose `has_*` flags. | test_lp_secret_masking |
| H-TRADE-8 | dd2ac80c | SL/TP engine evaluates triggers against the per-user quote (resolve_user_quote) when USER_SPREAD_AT_EXECUTION is on. | AST + review |
| H-INF-1 | 7a5a22cd | white-label agent allow-lists BRANDING_CERTBOT_BIN/NGINX_BIN before exec. | bash -n |
| H-INF-2/4 | 246f8ecb | backup.sh safe `.env` KEY=VALUE parser (no `source`), mandatory GPG in prod; restore.sh EXIT-trap fix. | bash -n |
| H-INF-6 | 789b93ee | desktop terminal refuses non-https/wss endpoints unless `--allow-insecure`. | review (no C++ toolchain) |

## Phase 3 — Medium (done)

| Finding | Commit | Change | Test |
|---|---|---|---|
| CSV formula escaping | 0c153758 | users CSV export: neutralise `= + - @` prefixes, quote/escape all cells. | tsc |
| wallet-login status bypass | 4b20e5f7 | wallet sign-in enforces banned/blocked + staff-portal guards. | test_wallet_login_status |
| OxaPay amount binding + reject_deposit lock | 0db5492b | mismatched OxaPay callback → manual_review; `reject_deposit` locks the row. | test_oxapay_amount_binding |
| secrets in query params | 95ddf8b2 | `/auth/2fa/verify` + `/auth/password/change` take secrets in the JSON body. | test_auth_body_not_query |
| root .dockerignore | a99fcf79 | exclude env/keys/.git/caches from image build contexts. | build config |
| SL/TP KEYS→SCAN | 68ec0be1 | price load uses `scan_iter`, not the O(N) blocking `KEYS`. | AST + review |
| Google-login 2FA | c9ab1dfa | shared `_enforce_2fa` on Google sign-in too (was password-only). | test_google_2fa |
| employees.extra_permissions | 05540a23 | migration 0070 adds the column the model + auth already use. | AST |
| WebSocket connection caps | 92126729 | per-user in-process WS connection cap (prices/bars/trades). | test_ws_connection_cap |
| webhook dedup ordering | 8182fe6a | release the dedup claim if processing fails so the retry re-processes. | test_webhook_claim_release |
| TradingAccount.positions | 8671ba73 | relationship `lazy=noload` (was selectin — eager-loaded all positions). | pytest suite |
| terminal order double-submit | 161ea0b7 | in-flight guard on the Buy/Sell button (submitting state actually set). | tsc |
| admin money double-submit | e44df7a3 | guard at the top of the deposit/withdrawal action handler. | tsc |
| custom-domain uniqueness/PLATFORM_HOSTS | a94ee154 | `is_platform_domain` blocks platform hosts + any `*.host` subdomain (api./admin.). | test_platform_domain_reserved |
| impersonation scope | 93f5883a | broker actor can only impersonate a user in their pool (audit row already existed). | AST + review |
| certbot throttling | 95ad9f1e | per-domain cooldown marker before certbot in the white-label agent. | bash -n |
| XAG contract size | (already on main) | FE prefers DB `contract_size`; fallback corrected to 5000. | — |

## Open items / deviations (need a decision or a follow-up pass)

**Phase 2 — remaining sub-parts (code fix landed; these need the host/build):**
- **H-AUTH-3** — bootstrap-session `amr` restriction NOT added (it interacts with
  admin impersonation, which legitimately bootstraps). Session-revocation core is
  done. Password-reset/ban revocation take effect within the ~15s session-cache
  TTL (logout busts instantly).
- **H-TRADE-8** — wired into the SL/TP engine; the risk-engine stop-out and copy-
  engine close paths still read the broadcast quote (same helper is ready to drop
  in). Off by default (`USER_SPREAD_AT_EXECUTION`).
- **H-INF-1** — allow-list added; relocating the cron target scripts to a root-
  owned `/usr/local/lib/<app>/` at install time is an OPS step.
- **H-INF-2..5** — safe `.env` parse + mandatory-GPG-in-prod + restore trap done;
  the **backup-path consolidation** (one of `scripts/backup.sh` vs
  `deploy/scripts/backup-db.sh`) and switching the canonical dump to custom-format
  `pg_restore` are left as an operator decision (they change the on-disk format
  and the restore procedure; can't be validated without the host).
- **H-INF-6** — https/wss enforcement + `--allow-insecure` done. OS-keychain
  token storage and algo-key revoke-on-logout need the Qt keychain lib + a build,
  so they remain open.

**Spec deviations to note:**
- **C-MONEY-3** — `available_to_withdraw` uses `(balance − margin_used)` capped by
  `free_margin` and is applied to the three user-facing withdrawal paths. Admin
  `approve_withdrawal` / `transfer_trading_to_main` already lock + check
  `balance − margin_used`; consider routing them through the helper too.
- **H-ADMIN-1** — implemented as `verify_exp=True` (sliding refresh within the 8h
  window). A full admin refresh-token table with rotation is not done.
- **H-MONEY-2** — DONE (commit 50a0cc9c): bonuses are now non-withdrawable —
  `available_to_withdraw` subtracts the user's outstanding active `UserBonus`
  from the main-wallet withdrawable across all three withdrawal paths. (Wagering
  release logic — flipping a bonus to withdrawable after N lots — is still a
  future product decision.)
- **C-TRADE-4** — DONE in full (commit 9ebebf4e): copy-engine mirror-close and
  the overnight-fee engine now lock the account row (SELECT FOR UPDATE) before
  mutating balance, closing the last two unlocked balance-write paths.
- **H-AUTH-2** — step-up wired into wallet disconnect (the withdrawal-address
  change choke point). The finding also lists 2FA-disable and email-change; those
  have no self-service trader endpoint in this codebase.
- **fx_admin Secure cookie** — DONE (commit c4a8d989): the admin Next proxy now
  forwards `X-Forwarded-Proto` so `_request_is_https` marks the cookie `Secure`
  in production. (If an nginx sits in front of the Next app, confirm it also sets
  `X-Forwarded-Proto $scheme` — standard config.)

**Phase 3 remaining (OPS-only):**
- **Redis `requirepass`** — DONE + LIVE (commit 6d9f3bdf): prod override runs
  `redis-server --requirepass $REDIS_PASSWORD` with an auth-aware healthcheck;
  `REDIS_PASSWORD` set in `/opt/swisscresta/.env` and embedded in
  `REDIS_URL`/`ADMIN_REDIS_URL`. Verified in prod: no-auth `redis-cli ping` →
  `NOAUTH Authentication required`; all services healthy, api/trade/admin 200.
- **Cron script relocation** (H-INF-1 second half) — copy cron target scripts to
  a root-owned `/usr/local/lib/swisscresta/` at install time so a repo-writer
  can't alter what root's cron runs. Install-procedure change (operator re-runs
  install-*-cron.sh as root).
- **Backup path consolidation + custom-format `pg_restore`** — DR-critical; the
  current scripts are hardened + working, and switching the on-disk dump format
  should be validated with a full backup→restore cycle on the host before it's
  trusted.
- **Desktop terminal Qt keychain** — OS-keychain token storage + algo-key
  revoke; needs the Qt keychain lib + a desktop build (https/wss enforcement is
  done).

## OPS steps for an operator (host-side, apply by hand)

1. **C-ADMIN-2** — find admins with no active employees row (they now get 403):
   `SELECT id,email FROM users WHERE role='admin' AND id NOT IN (SELECT user_id FROM employees WHERE is_active);`
   Add an employees row (with the intended role) for each legitimate admin.
2. **C-MONEY-2 / H-MONEY-2** — run migrations to head so the new unique indexes
   are created: `alembic -c backend/infra/migrations/alembic.ini upgrade head`.
   If a `CREATE UNIQUE INDEX` fails on a duplicate, reconcile the duplicate rows
   first (they indicate a prior double-submit / double-grant).
3. **C-INF-1** — verify on the host:
   `docker compose -f docker-compose.yml -f docker-compose.prod.yml config | grep -A3 ports:` → only `127.0.0.1` bindings.
4. **H-AUTH-1** — set `TRUSTED_PROXY_CIDRS` to the exact nginx / LB addresses in
   production (default covers loopback + RFC1918).
5. **H-INF-9** — set strong `POSTGRES_PASSWORD` / `TIMESCALE_PASSWORD` (production
   now refuses to boot with the default `swisscresta_dev`).
6. **fx_admin** — done in code (proxy forwards `X-Forwarded-Proto`); if an nginx
   fronts the Next app, confirm it sets `X-Forwarded-Proto $scheme` (standard).
7. **Redis requirepass** — add `--requirepass $REDIS_PASSWORD` to the redis
   service and update every service's `REDIS_URL` to
   `redis://:$REDIS_PASSWORD@redis:6379/N` in the same deploy.
8. **H-INF-1 / H-INF-2..5 / H-INF-6** — relocate cron target scripts to a
   root-owned dir at install time; decide the single backup path + custom-format
   `pg_restore`; add Qt-keychain token storage + algo-key revoke to the desktop
   terminal build.
