# Ezymex staking (Earn)

Rust service on `127.0.0.1:8105`, database `ezymex_staking` (created and migrated on start). Clients lock wallet funds
in a plan for its term; the admin sets each month's return per plan; a monthly settlement is created from those rates
and approved by a second staff member; returns are credited to the wallets. The principal goes back to the wallet
automatically at maturity. There is **no early withdrawal**, and rates are **never promised in advance**.

Module switch: `staking` in the gateway catalogue (off by default; the broker switches it on under Brokers → Modules).

## Rules

- **Plans** have a currency the wallet holds (`STAKING_CURRENCIES`, USDT), a minimum, optional maximum per
  subscription, per-client maximum and total capacity, a term in months, a status (`draft` · `active` · `paused` ·
  `closed`; only `active` is sold), the admin's ceiling for a month's rate (never shown to clients), a description and
  a risk disclosure (required to go active). Edits apply to new subscriptions: a position keeps the plan as accepted
  (`plan_snapshot`). A plan with positions can't change currency or go back to draft.
- **Subscribe** needs an active plan, the limits and capacity (checked under a per-plan lock), KYC `verified`, an
  active account without `deposits` / `withdrawals` / `transfers` restrictions (gateway `GET /v1/internal/users/{id}`,
  fail closed), and the client's acceptance of the terms and the risk acknowledgement.
- **Wallet debit** `staking_subscribe`, key `staking:subscribe:<position>`, recorded in `wallet_ops` before the call. A
  refusal ends in `payment_failed`; an unknown outcome stays `pending_payment` and the reconciler retries with the same
  key. Paid → `active`: earns from that server day (counted) to the maturity day (not counted), maturing at 00:00
  server time on the same calendar day `term_months` later.
- **Server time**: GMT+3 while US daylight saving is active, GMT+2 otherwise (`markethours`). Periods are server-time
  calendar months, `YYYY-MM`.
- **Monthly rates** (`monthly_rates`, one per plan and month): set from the month's start onwards (never for a future
  month), 0 % to the plan's ceiling, 4 decimals, with a reason. Locked while a settlement of the month exists.
- **Return** of one position for one month = `principal × rate % × days active in the month ÷ days in the month`,
  rounded to cents (half away from zero). Positions that matured during the month are paid their last days by that
  month's settlement. 0 % months create no lines.
- **Settlement**: once the month is over in server time and every plan with earning positions has a rate, a staff
  member creates it (`pending_approval`); a **different** staff member approves it (also a database CHECK) or rejects it.
  One live settlement per month; one live line per `(tenant, period, position)`. Approved lines are credited
  (`staking_reward`, key `staking:reward:<tenant>:<period>:<position>`), retried with backoff while the wallet is
  unreachable, `failed` when it refuses (retry from the Back Office). The settlement ends `paid` or `partially_paid`.
- **Maturity**: the worker credits the principal (`staking_redeem`, key `staking:principal:<position>`) and marks the
  position `matured`; retried with backoff until the wallet confirms.
- **Notifications** (support `POST /v1/notify`, category `staking`): subscription confirmed, monthly return credited,
  position matured.
- **Audit**: every staff write carries a reason (3–500 characters); plans, rates, settlements, exports and the money
  flows are written to the append-only `audit_log`.

## API

Every route except `GET /health` needs `X-Ezymex-Internal: $STAKING_INTERNAL_TOKEN` and takes the tenant slug in
`X-Ezymex-Tenant` (default `ezymex`). Errors: `{"error": {"code", "message", "field"?}}`; rule refusals are `422` with a
code (`below_minimum`, `above_maximum`, `user_limit`, `capacity_reached`, `kyc_required`, `wallet_restricted`,
`terms_required`, `risk_ack_required`, `insufficient_funds`, `payment_failed`, `plan_unavailable`, …);
`503 payment_pending` when the wallet hasn't confirmed yet (safe to retry with the same key).

### Client (`X-Ezymex-User-Id`, optional `X-Ezymex-Name`)

| Route | |
|---|---|
| `GET /v1/staking/me/plans` | plans on sale or paused: limits, `capacityLeft`, `maxNow`, own `invested`, `recentRates` (settled months only) |
| `GET /v1/staking/me/portfolio` | `summary` (invested, pending, returnsPaid, returnsThisYear, nextPayout, nextMaturity), `positions`, `monthly` |
| `GET /v1/staking/me/history?page&limit` | subscriptions, monthly returns, principal returns, failed payments |
| `GET /v1/staking/me/positions` · `/{id}` | positions; one position with its monthly returns and accepted terms |
| `POST /v1/staking/me/positions` | `{planId, amount, idempotencyKey, acceptTerms, acceptRisk}` → `{position, terms, returns}` |

### Back Office (`X-Ezymex-Staff-Id`, `-Name`, `-Role`, `-Perms`)

`staking.read` for reads; `staking.write` for plans, rates and creating a settlement; `staking.approve` for approve /
reject / retry; `staking.export` for the full positions export. Writes take `reason`.

| Route | |
|---|---|
| `GET overview` | liability (outstanding principal), investors, returns paid, maturities in 30 days, plans, last month's state, attention counts |
| `GET plans` · `POST plans` · `PATCH plans/{id}` | plan editor |
| `GET rates?period=` · `POST rates` | every plan's month with the previous month, `basePerPct` (returns per 1 %) and the estimate; `{planId, period, ratePct, note?, reason}` |
| `GET settlements/preview?period=` | lines, per-plan totals, blockers (`period_open`, `rates_missing`, `settlement_exists`, `nothing_to_settle`) |
| `GET settlements` · `POST settlements` · `GET settlements/{id}` | list; `{period, reason}`; detail with lines |
| `POST settlements/{id}/approve` · `reject` · `retry` | `{reason}`; approve by someone other than the creator |
| `GET positions?status&plan&user&q&page&limit` · `GET positions/{id}` · `GET positions/export` | positions |
| `GET audit?action&page&limit` | audit log |

All paths are under `/v1/staking/admin/`.

## Configuration

| Variable | Default |
|---|---|
| `STAKING_BIND` | `127.0.0.1:8105` |
| `STAKING_DATABASE_URL` | `postgres://postgres@127.0.0.1:5433/ezymex_staking` |
| `STAKING_INTERNAL_TOKEN` | required when `STAKING_ENV=production` |
| `STAKING_CURRENCIES` | `USDT` |
| `STAKING_WORKERS` | `true` (reconciler, settlement transfers, maturities) |
| `STAKING_TICK_SECS` | `20` |
| `GATEWAY_URL` / `GATEWAY_INTERNAL_TOKEN` | KYC and restrictions |
| `WALLET_URL` / `WALLET_INTERNAL_TOKEN` | debits and credits |
| `NOTIFY_URL` / `SUPPORT_INTERNAL_TOKEN` | client notifications |

Tests: `cargo test -p staking` (database tests use `STAKING_TEST_DATABASE_URL`, default the local PostgreSQL on
:5433, and are skipped without it).
