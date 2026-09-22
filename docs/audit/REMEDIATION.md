# Security Audit Remediation — branch `fix/audit-2026-09`

Remediation of the findings in `docs/audit/2026-09-22-security-audit.md`.
Work is on branch `fix/audit-2026-09` (off `main`); not pushed, not deployed.
One commit per finding. Every money/auth fix has a pure-unit pytest under
`backend/tests/` (DB-free: fake-session / SimpleNamespace mocks + `asyncio.run`,
matching the existing test style — no live Postgres fixture exists).

**Status:** Phase 1 (Critical) complete. Phase 2 (High) in progress. Phase 3
(Medium) not yet started. **100 backend tests pass.**

## How to run the tests

From `backend/`:

```
env PYTHONPATH=. DATABASE_URL=postgresql+asyncpg://u:p@localhost/db \
  JWT_SECRET=ci-stub-secret-1234567890123456789012 ENVIRONMENT=development \
  REDIS_URL=redis://localhost:6379/0 \
  ADMIN_JWT_SECRET=admin-stub-secret-12345678901234567890 \
  python -m pytest tests/ -q
```

Admin-service modules use bare `from dependencies import ...`; the tests that
touch them load the module by file path via `importlib` (see
`test_upload_path_safety.py`).

## Phase 1 — Critical (all done)

| Finding | Commit | What changed | Test / verification |
|---|---|---|---|
| C-INF-1 / H-INF-7 | 7c8a8528 | `docker-compose.prod.yml`: `ports: !override` on admin-api/gateway/both frontends so only `127.0.0.1` host bindings survive the merge; `--proxy-headers --forwarded-allow-ips "*"` on both uvicorn commands. | `docker compose … config` shows only loopback host bindings (OPS: run on host). |
| C-ADMIN-2 | b7f65120 | `admin/dependencies.py` `require_permission`: removed the legacy "role=admin ⇒ full admin" fallthrough; an admin with no ACTIVE employees row now gets 403. | `test_admin_permission.py` |
| C-TRADE-2 | e7b4a41f | `schemas/trading.py`: close/modify `lots` → `Field(None, gt=0, le=100)`; `trading_service.close_position` rejects closing more than the open size. | `test_close_lots_bound.py` |
| C-AUTH-1 | f98ed443 | Reset request carries the email; token lookup scoped to that user; per-user (10/15 min) + per-token (5) Redis attempt caps; all refresh tokens + sessions revoked on reset; FE reset form collects email. | `test_password_reset.py` |
| C-TRADE-5 | 767f7322 | `close_position` bails on `is_tick_stale` (aligned with `get_current_price`/`modify_position`) instead of settling at a frozen price. | `test_close_stale_tick.py` |
| C-MONEY-3 / H-MONEY-1 | b941ea59 | New `withdrawal_limits.available_to_withdraw` ((balance − margin_used) capped by free_margin); routed main-wallet, manual-UPI and on-chain withdrawal paths through it. | `test_withdrawal_limits.py` |
| C-MONEY-2 | 3ec7acd9 | `onchain_deposit_service.normalize_tx_hash` (EVM 0x-lowercase / Tron bare hex); store canonical; migration **0068** lowercases existing rows + partial unique index on `(network, lower(crypto_tx_hash))`; IntegrityError → 409. | `test_tx_hash_normalize.py`; migration up/down (OPS). |
| C-MONEY-1 | a237a9d6, 3a3aa506 | `delete_trading_account`: writes a `credit_removed` Transaction instead of silently zeroing bonus credit; refuses close while open positions **or** pending orders exist (409). | `test_delete_account_credit_removed.py` |
| C-TRADE-1 | 878487b6 | `stop_copy` realises P&L onto the CF account, refunds its **real** balance, and zeroes + deactivates it (was crediting `allocation_amount + pnl` and leaving the account funded → double refund on later delete). | `test_stop_copy_real_balance.py` |
| C-TRADE-4 / H-TRADE-1 | 04daa0a0 | New `row_locks.lock_user`/`lock_account` (SELECT … FOR UPDATE, canonical order user→account); applied to copy-subscribe, stop_copy, open_live_account. | `test_row_locks.py`, `test_stop_copy_real_balance.py` |
| C-TRADE-3 | fba5c9b5 | `copy_engine._open_copy(catch_up=…)`: catch-up seeding opens follower copies at the current tick, not the master's historical open_price. | `test_copy_catchup_price.py` |
| C-ADMIN-1 | babc7560 | Admin download endpoints route through `path_safety.safe_join_under_base`, restrict to an image/PDF allow-list, serve the real media type; gateway drops a client-supplied `screenshot_url` it can't confine (write-time). | `test_upload_path_safety.py` |
| H-FE-1 | d5dccbdc | Chart pages read the bearer token from the URL **hash** (never sent to the server), still accept a legacy `?token=`, and strip it from the URL immediately. | `tsc --noEmit` clean. (Full one-time-code exchange is an open item — see below.) |

## Phase 2 — High (in progress)

| Finding | Commit | What changed | Test |
|---|---|---|---|
| H-AUTH-1 / H-INF-7 | a39666fb | `rate_limit.client_ip_for_inet` walks X-Forwarded-For right→left skipping `TRUSTED_PROXY_CIDRS` (new config) and returns the first non-trusted hop; CF-Connecting-IP still wins; returns a single INET-safe IP. | `test_client_ip_trusted_proxy.py` |
| H-ADMIN-1 | 45ab4a37 | `admin_refresh` decodes with `verify_exp=True` (was False → an expired token could be refreshed forever). | `test_admin_refresh_verify_exp.py` |
| H-ADMIN-2 | 746183d7 | `_assert_can_target` on ban/unban/block/kill-switch/login-as/delete/add_fund/deduct_fund/give_credit/take_credit: no self-target; only super_admin may act on admin/broker/super_admin accounts. | `test_admin_target_guard.py` |
| H-ADMIN-3 | 2000a61b | `PUT /trades/history/{id}/modify`: broker tenant-scope guard, super_admin/risk_manager only (DECISION), and an `adjustment` Transaction for any balance delta. | `test_modify_history_txn.py` |
| H-TRADE-9 | d8e81a1f | b-book pending-order monitor selects with `FOR UPDATE SKIP LOCKED` and re-checks `status == PENDING` before filling (multi-worker double-fill). | AST + review (engine-locking change). |
| H-MONEY-4 | c7cfe566 | `open_live_account` funds a new live account only by an explicit main-wallet transfer; no cross-account sweep; refuses when the wallet is short. | `test_open_live_no_sweep.py` |

## Open items / deviations from spec (need a decision or a follow-up pass)

- **C-MONEY-3**: `available_to_withdraw` uses `(balance − margin_used)` capped by
  `free_margin` rather than a live-equity helper, and is applied to the three
  user-facing withdrawal paths. Admin `approve_withdrawal` and
  `transfer_trading_to_main` already lock and check `balance − margin_used`; they
  were left as-is. Consider routing them through the helper too for one source of truth.
- **C-MONEY-2**: the on-chain `from`/`to` address verification the spec mentions
  already lives on `main` (added in earlier ad-hoc work) — the sender check is in
  the chain verifiers; this pass added only hash normalisation + the unique index.
- **H-ADMIN-1**: implemented as `verify_exp=True` (sliding refresh within the 8h
  token window). A full **admin refresh-token table with rotation** is the fuller
  fix and is **not** done — deferred.
- **H-FE-1**: token moved to the URL hash + stripped, which removes the
  server-log/Referer/history leak. The spec's **one-time `POST /auth/chart-session`
  code exchange for a cookie** is **not** implemented — deferred.

## Not yet started

- **Phase 2 remaining**: H-AUTH-2 (sensitive-action step-up), H-AUTH-3 (revocable
  sessions / `sid` claim), H-AUTH-4 (register reclaim + email_verified gating),
  H-MONEY-2 (one-bonus-per-offer + single `bonus_service`), H-TRADE-2/3/5/6/7/8,
  H-FE-2/3 (public allow-list + middleware), H-FE-ADMIN-1/2, H-INF-1/2–5/6/8/9
  (cron/backups/desktop-terminal/CI/weak-secret — several are OPS + non-Python).
- **Phase 3 (Medium)**: full list in the audit report §4.

## OPS steps for an operator (host-side, apply by hand)

1. **C-ADMIN-2** — find admins with no active employees row (they now get 403):
   `SELECT id,email FROM users WHERE role='admin' AND id NOT IN (SELECT user_id FROM employees WHERE is_active);`
   Create an employees row (with the intended role) for each legitimate admin.
2. **C-MONEY-2** — run migrations to head so the tx-hash unique index is created:
   `alembic -c backend/infra/migrations/alembic.ini upgrade head`. If it fails on a
   duplicate, reconcile the duplicate deposit rows first (they indicate a prior double-submit).
3. **C-INF-1** — verify on the host:
   `docker compose -f docker-compose.yml -f docker-compose.prod.yml config | grep -A3 ports:` — only `127.0.0.1` bindings should appear.
4. **H-AUTH-1** — set `TRUSTED_PROXY_CIDRS` to the exact nginx / load-balancer
   addresses in production (the default covers loopback + RFC1918).
