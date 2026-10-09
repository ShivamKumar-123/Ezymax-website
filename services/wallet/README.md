# wallet

The Ezymex central client wallet (D3): per-user multi-currency balances on a double-entry ledger, USDT deposits on BNB Chain (BEP20) and TRON (TRC20) verified on-chain, withdrawals with admin approval, and transfers between the wallet and the client's own trading accounts. It is a Rust service (axum 0.8, sqlx 0.9, PostgreSQL) on `127.0.0.1:8095`.

Other services (IB, copy/PAMM, prop) move money in and out of client wallets **only** through [`POST /v1/wallets/transfers`](#wallet-api-contract-for-other-services).

- [Run locally](#run-locally)
- [Wallet API contract (for other services)](#wallet-api-contract-for-other-services)
- [Conventions](#conventions)
- [Ledger](#ledger)
- [Client API (CRM BFF)](#client-api-crm-bff)
- [Deposits](#deposits)
- [Withdrawals](#withdrawals)
- [Wallet and trading accounts](#wallet-and-trading-accounts)
- [Back Office API](#back-office-api)
- [Balance & credit (manual adjustments)](#balance--credit-manual-adjustments)
- [Manual payments (bank / UPI / crypto)](#manual-payments-bank--upi--crypto)
- [Environment](#environment)
- [Tests](#tests)
- [Production checklist](#production-checklist)

## Run locally

You need PostgreSQL on `127.0.0.1:5433` (user `postgres`, trust auth), the gateway on `:8080` (KYC status) and the trading engine on `:8090` (wallet ↔ trading transfers). The database `ezymex_wallet` is created and migrated on first start.

```bash
cargo run -p wallet          # reads the repo-root .env.local (WALLET_*) and .env.tron (TRONGRID_API_KEY)
cargo test -p wallet         # unit + PostgreSQL integration tests (skipped when Postgres is not reachable)
curl -s localhost:8095/health
```

## Wallet API contract (for other services)

Every call sends `X-Ezymex-Internal: $WALLET_INTERNAL_TOKEN`, optionally `X-Ezymex-Tenant: <slug>` (default `ezymex`) and `X-Ezymex-Service: <ib|prop|pamm|copy|...>` (recorded as the actor). `user_id` is the gateway user id.

### `GET /v1/wallets/{user_id}`

```json
{ "user_id": 42, "balances": [ { "currency": "USDT", "available": "125.500000", "locked": "0" } ] }
```

USDT is always listed, with zeros when the user has never had funds. `available` can be spent or withdrawn. `locked` is held by a pending withdrawal or an in-flight transfer to a trading account.

### `POST /v1/wallets/transfers`

| Field | Type | Notes |
|---|---|---|
| `idempotency_key` | string, 1–128 | Unique per tenant. Use something stable from your side, e.g. `ib:payout:2026-09:42` |
| `user_id` | integer | |
| `currency` | `"USDT"` | |
| `amount` | decimal string (a JSON number is accepted) | > 0, at most 6 decimals |
| `direction` | `"credit"` \| `"debit"` | credit adds to the user's available balance, debit takes from it |
| `kind` | `commission` \| `ib_payout` \| `prop_purchase` \| `prop_payout` \| `pamm_invest` \| `pamm_redeem` \| `copy_fee` \| `mam_fee` \| `staking_subscribe` \| `staking_reward` \| `staking_redeem` \| `adjustment` \| `refund` | `staking_*`: services/staking (principal debit, monthly return, principal back at maturity) |
| `ref` | string ≤ 128, optional | Your own reference (payout id, challenge id, fund id) |
| `note` | string ≤ 500, optional | Shown on the client's wallet history |

Response `200`:

```json
{ "status": "completed", "txn_id": 381, "user_id": 42, "currency": "USDT", "amount": "25", "direction": "credit",
  "kind": "ib_payout", "ref": "payout-2026-09", "note": null, "balance": { "available": "150.5", "locked": "0" },
  "created_at": "2026-09-28T10:00:00Z", "replayed": false }
```

- **Idempotent.** Repeating the same `idempotency_key` with the same body returns the original result with `"replayed": true` and books nothing. The same key with a different body (`user_id`, `currency`, `amount`, `direction`, `kind`, `ref`, `note`) returns `409 idempotency_conflict`. Concurrent duplicates are resolved by a unique index, so retries after a timeout are always safe.
- **Debit.** A debit beyond `available` returns `422 insufficient_funds` and books nothing. Locked funds can't be debited.
- Each kind has its own counter-account (`sys:USDT:<kind>`), so the IB/prop/PAMM books can be reconciled against the wallet.

`GET /v1/wallets/transfers/{idempotency_key}` returns the stored result for a key (`404` if unknown), so a caller that lost the response can look it up.

### `GET /v1/wallets/{user_id}/ledger?page=1&limit=50`

```json
{ "items": [ { "txn_id": 381, "kind": "ib_payout", "currency": "USDT", "amount": "25", "available_delta": "25", "locked_delta": "0",
               "ref": "payout-2026-09", "note": null, "created_at": "2026-09-28T10:00:00Z" } ],
  "page": 1, "limit": 50, "total": 1 }
```

Newest first. `amount` is the signed change to the client's total (available + locked). A withdrawal request shows `available_delta -100, locked_delta +100, amount 0`.

## Conventions

- **Base URL** `http://127.0.0.1:8095`. JSON in and out, snake_case keys. Every route except `GET /health` needs `X-Ezymex-Internal`.
- **Money.** Amounts are decimal **strings** in responses. Requests accept a string or a JSON number. The service never uses floats. USDT is USD 1:1 (D35).
- **Staff.** Back Office routes need the staff identity that the admin BFF verified with the gateway: `X-Ezymex-Staff-Id`, `X-Ezymex-Staff-Name` (percent-encoded), `X-Ezymex-Staff-Role`. The service checks the role again (see [Back Office API](#back-office-api)).
- **Client context.** Forward the client IP as `X-Forwarded-For` and the user agent as `User-Agent`. Withdrawals record both.
- **Errors.** `{"error": {"code", "message", "field"?}}`

| HTTP | code |
|---|---|
| 400 | `bad_request` |
| 403 | `forbidden`, `kyc_required` |
| 404 | `not_found` |
| 409 | `idempotency_conflict`, `tx_already_used`, `invalid_state`, `in_progress` |
| 422 | `validation` (+`field`), `insufficient_funds`, `below_minimum`, `above_maximum`, `daily_limit`, `deposit_cooldown`, `chain_disabled`, `intent_expired`, `not_own_account` |
| 502 / 503 | `engine_error`, `unavailable` |

## Ledger

Double-entry and append-only. Each change is one `ledger_txns` row with a unique `(tenant_id, idempotency_key)` and two or more `ledger_postings` whose amounts sum to zero per currency. A trigger rejects UPDATE and DELETE on both tables.

| Account code | Meaning |
|---|---|
| `user:<id>:<ccy>:available` | spendable client balance |
| `user:<id>:<ccy>:locked` | pending withdrawals and in-flight transfers to trading |
| `sys:<ccy>:deposit:<chain>` | on-chain money received (negative = received) |
| `sys:<ccy>:withdrawal:<chain>` | on-chain money paid out |
| `sys:<ccy>:fees` | withdrawal fees earned |
| `sys:<ccy>:trading` | net money moved into trading accounts |
| `sys:<ccy>:<kind>` | counter-account per transfer kind (IB, prop, PAMM, copy, adjustments, refunds, approved bank / crypto deposit requests: `bank_deposit`, `crypto_deposit`) |

`wallet_balances` is a projection updated in the same transaction as the postings, with `CHECK (available >= 0 AND locked >= 0)`. On start the service recomputes every balance from the postings and refuses to start on any mismatch. `GET /v1/admin/reconciliation` runs the same checks on demand.

## Client API (CRM BFF)

The CRM BFF resolves the user from the session cookie and passes `user_id`. For withdrawals it redeems the step-up token (`withdrawal`) with the gateway **before** calling the service.

| Method & path | Body | Response |
|---|---|---|
| `GET /v1/config` | – | `{chains:[{chain, network, token, token_contract, decimals, confirmations, deposits_enabled, withdrawals_enabled, min_deposit, withdraw_fee}], limits:{withdraw_min, withdraw_max, withdraw_daily_max, withdraw_fee_flat, withdraw_fee_pct, deposit_cooldown_hours, intent_ttl_minutes}}` |
| `GET /v1/wallets/{user_id}/overview` | – | `{balances, pending_deposits[], open_withdrawals[], limits:{used_today, remaining_today, cooldown_until}, notifications_unread}` |
| `GET /v1/wallets/{user_id}/activity?page&limit&type=deposit\|withdrawal\|transfer\|all` | – | `{items:[{type, id, status, amount, currency, chain?, tx_hash?, login?, direction?, created_at, ...}], total}` |
| `POST /v1/deposits/intents` | `{user_id, chain:"bsc"\|"tron", amount}` | `{intent}`: `{id, chain, currency, amount, address, token_contract, decimals, chain_id?, expires_at, status}` |
| `GET /v1/deposits/intents/{id}?user_id=` | – | `{intent, deposit?}` |
| `POST /v1/deposits/submit` | `{user_id, intent_id, tx_hash, from_address?}` | `{deposit}` (409 `tx_already_used`) |
| `GET /v1/deposits/{id}?user_id=` | – | `{deposit}` with `confirmations`, `required_confirmations`, `status` |
| `POST /v1/withdrawals/quote` | `{user_id, amount, chain, to_address}` | `{quote:{amount, fee, net_amount, used_today, daily_max, available}}`: every check of a request, nothing locked (call it before the step-up code) |
| `POST /v1/withdrawals` | `{user_id, amount, chain, to_address, idempotency_key?}` | `{withdrawal}` |
| `GET /v1/withdrawals?user_id=` | – | `{items}` |
| `POST /v1/withdrawals/{id}/cancel` | `{user_id}` | `{withdrawal}` (only while `requested`) |
| `POST /v1/wallets/{user_id}/to-trading` | `{login, amount, idempotency_key}` | `{transfer}` |
| `POST /v1/wallets/{user_id}/from-trading` | `{login, amount, idempotency_key}` | `{transfer}` |
| `GET /v1/wallets/{user_id}/notifications` / `POST .../notifications/read` | – / `{ids?}` | `{items, unread}` |

## Deposits

1. **Intent.** `POST /v1/deposits/intents` returns the company receiving address for the chain (an audited admin setting), the USDT contract, the amount and an expiry (`intent_ttl_minutes`, default 60).
2. **Payment.** The CRM pays with MetaMask (`eth_sendTransaction` of `transfer(address,uint256)` on chain 56) or TronLink (`triggerSmartContract`), and gets the tx hash straight away. The manual fallback shows address, QR and amount, and the client pastes the hash.
3. **Submit.** `POST /v1/deposits/submit {intent_id, tx_hash}` stores the deposit as `pending`. A tx hash is unique per chain, so a second claim gets `409 tx_already_used`.
4. **Watcher** (every `WALLET_POLL_SECS`):
   - BSC: `eth_getTransactionReceipt`, `eth_blockNumber` and `eth_getBlockByNumber` through the configured RPC list, with fallbacks.
   - TRON: TronGrid `gettransactioninfobyid` and `getnowblock`.

   It then checks the following:
   - The transaction succeeded.
   - A `Transfer` log of the configured USDT contract pays one of the tenant's receiving addresses for that chain. The sender (the log's `from`) is recorded.
   - Confirmations reach the per-chain setting (defaults: BSC 15, TRON 20).
5. **Auto-credit rules.** The deposit is credited automatically (`kind deposit`, notification recorded) only when all of these hold:
   - the on-chain amount equals the intent amount;
   - the block time is between intent creation − 10 min and expiry + 24 h;
   - the sender address was never used by another client.

   Otherwise it goes to `review` in the Back Office unmatched queue, and staff credit it or reject it. The rule stops one client claiming another client's transfer by pasting its hash.
6. **Scanner** (every `WALLET_SCAN_SECS`). It reads incoming USDT transfers to the receiving addresses: BSC `eth_getLogs` filtered by `to`, TRON TronGrid `/v1/accounts/{addr}/transactions/trc20?only_to=true`.
   - Transfers nobody has claimed become `unmatched` deposits.
   - The unmatched queue suggests the client whose earlier deposits came from the same sender address.
   - Staff assign a deposit to a client (audited, then credited after confirmations) or reject it.

Deposit statuses: `pending` (submitted, not yet found on chain) → `confirming` (found, `confirmations`/`required_confirmations`) → `credited`. The other end states are `failed` (reverted, wrong token or recipient, not found after 24 h), `review`, `unmatched` and `rejected`.

## Withdrawals

`requested` → `approved` / `rejected` (staff, reason) → `paid` (staff enter the payout tx hash) → `completed`. The client can `cancel` while the withdrawal is `requested`.

- **Request.** `POST /v1/withdrawals` locks `amount` (available → locked).
  - Fee = `withdraw_fee_flat + amount × withdraw_fee_pct / 100` plus the chain's `withdraw_fee`. The client receives `amount − fee`.
  - Checks, in order:
    - `to_address` format (BSC `0x` + 40 hex, TRON base58check `T…`);
    - the chain is enabled;
    - `withdraw_min` / `withdraw_max`;
    - the daily total (server day, GMT+3) against `withdraw_daily_max`;
    - no credited deposit within `deposit_cooldown_hours`;
    - the available balance.
  - **KYC gate (D6).** The service asks the gateway (`GET /v1/internal/users/{id}`). `kyc_status` other than `verified` returns `403 kyc_required`.
- **Reject or cancel.** The funds are unlocked.
- **Paid.** Staff enter the payout tx hash. The watcher checks the transaction on chain:
  - a USDT `Transfer` from a company address (a receiving or payout address of that chain) to `to_address` of exactly `amount − fee`;
  - it succeeded;
  - it has the required confirmations.

  Then it completes the withdrawal. Ledger: locked → `sys:withdrawal:<chain>` (net) and `sys:fees` (fee). A failed check returns the withdrawal to `approved` with `payout_error`. A payout hash can be used once.
- **Risk checklist** (`GET /v1/admin/withdrawals/{id}`):
  - KYC status;
  - last deposit time against the cooldown;
  - deposits, withdrawals and trading P&L proxy (money back from trading − money into trading);
  - request IP against the client's earlier IPs, and other clients using the same IP;
  - whether the destination address is new for this client or used by another client.

## Wallet and trading accounts

`to-trading` / `from-trading` call the engine's `POST /v1/ledger/transfers` (`services/trading/README.md`), only for live accounts of this user (engine `GET /v1/accounts?user_id=`, D24). Amounts use at most 2 decimals, the engine's precision.

- **to-trading.**
  1. Reserve: available → locked, and the transfer is recorded as `pending`.
  2. The engine `direction:"in"` with idempotency key `wallet-<tenant>-<transfer id>`.
  3. On success, commit (locked → `sys:trading`). On a definite engine rejection (4xx), roll back (locked → available).
- **from-trading.** The transfer is recorded `pending`, the engine is called with `direction:"out"` (free-margin check in the engine), and on success the wallet is credited.
- **Unknown outcome** (timeout, 5xx). The transfer stays `pending`. A recovery loop asks the engine `GET /v1/ledger/transfers/{key}` and commits, or re-sends the same idempotent request. Money is never booked twice and never lost.
- The client's `idempotency_key` makes the request itself idempotent: the same key returns the same transfer.

## Client restrictions

The Back Office can restrict a client (gateway `client_controls.rs`); the wallet reads the client's effective restrictions from `GET /v1/internal/users/{id}` (`restrictions`, with `freeze` expanded) on every operation it enforces and answers 403 `restricted` with a readable message:

| Restriction | Refused |
|---|---|
| `deposits` | `POST /v1/deposits/intents`, `POST /v1/deposits/submit`, `POST /v1/manual/deposits` |
| `withdrawals` | `POST /v1/withdrawals`, `POST /v1/withdrawals/quote` |
| `transfers` | `POST /v1/wallets/{user_id}/to-trading`, `from-trading` (also the copy-trading allocations that use them) |
| `ib` | `POST /v1/wallets/transfers` credits of kind `commission` / `ib_payout` |

An unreachable gateway refuses these operations (503 `unavailable`); a replayed idempotent request still returns its stored result.

## Back Office API

The service checks the role on every staff route. The admin app maps them to `finance.*` permissions (`apps/admin/lib/wallet-perms.ts`).

| Permission | Roles | Routes |
|---|---|---|
| `finance.read` | platform_owner, super_admin, admin, finance, compliance, risk_manager | all `GET /v1/admin/*` |
| `finance.write` | platform_owner, super_admin, admin, finance | assign / reject / recheck deposits, mark paid |
| `finance.adjust`, `finance.credit`, `finance.adjust_approve`, `finance.adjust_force` | see [Balance & credit](#balance--credit-manual-adjustments) | manual adjustments |
| `finance.approve` | platform_owner, super_admin, admin, finance | approve / reject withdrawals and [manual deposit requests](#manual-payments-bank--upi--crypto) |
| `finance.settings` | platform_owner, super_admin, admin | receiving addresses, confirmations, limits, fees, manual payment methods and their QR codes |
| `finance.export` | platform_owner, super_admin, admin, finance | the manual deposit CSV export |

| Method & path | Body |
|---|---|
| `GET /v1/admin/summary` | – (queue counts, today's deposits and withdrawals, liabilities) |
| `GET /v1/admin/deposits?status&chain&user_id&q&page&limit` | – |
| `GET /v1/admin/deposits/{id}` | – (with suggested client for unmatched) |
| `POST /v1/admin/deposits/{id}/assign` | `{user_id, reason}` |
| `POST /v1/admin/deposits/{id}/reject` | `{reason}` |
| `POST /v1/admin/deposits/{id}/recheck` | `{}` |
| `GET /v1/admin/withdrawals?status&chain&user_id&page&limit` | – |
| `GET /v1/admin/withdrawals/{id}` | – (with `risk`) |
| `POST /v1/admin/withdrawals/{id}/approve` | `{note?}` |
| `POST /v1/admin/withdrawals/{id}/reject` | `{reason}` |
| `POST /v1/admin/withdrawals/{id}/paid` | `{tx_hash}` |
| `GET /v1/admin/wallets?user_ids=1,2&min_balance&page&limit` | – |
| `GET /v1/admin/wallets/{user_id}` | – (balances, ledger, deposits, withdrawals, transfers) |
| `POST /v1/admin/adjustments` | see [Balance & credit](#balance--credit-manual-adjustments) (the older `{idempotency_key, user_id, currency, amount, direction, reason}` body still works: wallet add / deduct, reason "correction") |
| `GET /v1/admin/settings` / `PUT /v1/admin/settings` | `{limits?, chains?: [{chain, receiving_address, payout_address?, confirmations, deposits_enabled, withdrawals_enabled, min_deposit, withdraw_fee}]}` |
| `GET /v1/admin/reconciliation` | – |
| `GET /v1/admin/audit?page&limit` | – |

The service writes every staff action to its append-only `audit_log`, with the actor, before and after values, reason, IP and user agent. Receiving-address changes are validated and audited, and are also visible as a settings history.

## Balance & credit (manual adjustments)

Back Office "Balance & credit" (client 360, Trading → Accounts, Finance → Wallets and Finance → Adjustments): add or deduct funds on the client's wallet or a trading account (live or demo), give or take credit on a trading account. Code: `src/ops/adjustments.rs`, routes `src/api/adjust.rs`, table `adjustments` (`migrations/0003_adjustments.sql`).

| Permission | Allows |
|---|---|
| `finance.adjust` | add / deduct funds |
| `finance.credit` | give / take credit (trading accounts only) |
| `finance.adjust_approve` | approve / reject requests above the four-eyes threshold |
| `finance.adjust_force` | force a trading-account deduction or credit take-back past the free margin (Super Admin) |
| `finance.settings` | the four-eyes threshold |

The admin BFF forwards the staff member's `finance.*` keys as `X-Ezymex-Staff-Perms`; the service enforces the exact key (without the header it falls back to the role: finance roles for adjust / credit / approve, `super_admin` / `platform_owner` for force).

**Request** (`POST /v1/admin/adjustments`, and `POST /v1/admin/adjustments/preview` without `idempotency_key`):

```json
{ "idempotency_key": "<one per submit>", "user_id": 42, "target": "wallet | trading", "login": 10000001, "currency": "USDT",
  "op": "add | deduct | credit_in | credit_out", "category": "deposit | withdrawal | correction | compensation | bonus | fee | chargeback | other",
  "amount": "100", "comment": "internal, audit only (required)", "client_note": "shown on the client's statement (optional)",
  "notify": true, "force": false }
```

- **Preview** returns `{preview: {ok, before, after, limits, error?, amount_usd, threshold_usd, needs_approval, marginCall?, stopOut?}}`: the dialog's before → after step. Nothing is booked.
- **Create** validates, runs the same preview (a refused request is audited as `adjustment.refused` and returns `422` with the reason), then records the row. At or below the threshold it is booked at once (`applied`); above it the row is `pending`. Returns `{adjustment}`. The same `idempotency_key` returns the original adjustment with `replayed: true` (a double click books once); the same key with another request is `409 idempotency_conflict`.
- **Wallet target** (USDT, up to 6 decimals). Booked here in one transaction with the row, the audit entry and the client notification: `manual_deposit` (reason "Deposit (external payment received)", counter-account `sys:USDT:manual_deposit`), `manual_withdrawal` ("Withdrawal (paid externally)", `sys:USDT:manual_withdrawal`), otherwise `adjustment_in` / `adjustment_out` (`sys:USDT:adjustment`). A wallet never goes below 0 (the balance CHECK): a deduction above `available` is refused and `force` does not apply. Credit exists on trading accounts only.
- **Trading target** (account currency: USD, or USC for cent accounts; up to 2 decimals). The account must belong to the client. The engine books it (`POST /v1/admin/accounts/{login}/adjust`, key `wallet-adj-<tenant>-<id>`; ledger kinds `deposit` / `withdrawal` / `adjustment` / `credit`, limits and the force / negative-balance-protection rules in `services/trading/README.md#balance--credit`). The row is `processing` while the call is in flight; when the answer is lost the recovery loop (every `WALLET_POLL_SECS`, rows older than 30 s) re-sends the same key and the engine replays the booking, so nothing is booked twice.
- **Real money.** Only the two external reasons are deposits / withdrawals: the reports service counts `manual_deposit` / `manual_withdrawal` rows (wallet) and engine `deposit` / `withdrawal` (accounts) as money in / out and FTDs; every other reason is an adjustment.
- **Four-eyes.** `tenant_settings.adjust_approval_usd` (USD value: USDT 1:1, USC ÷ 100). `null` = off. `GET/PUT /v1/admin/adjustments/settings {approval_threshold_usd}` (PUT needs `finance.settings`, audited as `wallet.settings.adjust_threshold`). A pending request is booked by `POST /v1/admin/adjustments/{id}/approve {note?}` from another staff member with `finance.adjust_approve` (the requester gets 403). The booking re-checks the limits at that moment; if it can no longer be booked the row becomes `failed` with the reason. `POST .../{id}/reject {reason}` (approver, reason required) and `POST .../{id}/cancel` (the requester) book nothing.
- **Client.** The ledger note (wallet) / statement note (engine) is `client_note`, or a neutral label ("Balance adjustment", "Deposit", "Credit"). With `notify`, a notification row `adjustment.<wallet|account|credit>_<in|out>` is written in the booking transaction and pushed to support (bell + email per the client's `wallet` preference; link `/wallet/history` or `/accounts`).
- **Audit.** `adjustment.requested`, `adjustment.approved`, `adjustment.rejected`, `adjustment.cancelled`, `adjustment.applied` (before / after balances, ledger txn and kind, requester and approver), `adjustment.failed`, `adjustment.refused`. The engine writes its own `account.balance` / `account.credit` audit for trading targets.

| Method & path | |
|---|---|
| `GET /v1/admin/adjustments?user_id&login&staff&category&op&target&status&from&to&page&limit` | `{items, total, totals:{added_usd, deducted_usd, credit_in_usd, credit_out_usd, net_balance_usd, net_credit_usd, external_deposits_usd, external_withdrawals_usd, applied, pending, pending_usd, declined, failed}, staff[], threshold_usd, categories[]}`; `staff` matches the requester or the approver; `from` inclusive, `to` exclusive; `limit` up to 2000 (CSV export) |
| `GET /v1/admin/adjustments/{id}` | `{adjustment}` |
| `GET /v1/admin/adjustments/targets/{user_id}` | `{wallet, accounts (engine views, live and demo), engine_available, open[], recent[], threshold_usd, can:{adjust, credit, approve, force}}` |

## Manual payments (bank / UPI / crypto)

Besides the automatic BEP20 / TRC20 deposits, a broker can list **payment methods** clients pay outside the platform: bank accounts and UPI IDs, and crypto addresses on any network (TRC20, BEP20, ERC20, Polygon, Solana, BTC or a free-text network), each with an optional QR code. The client pays, then sends a **deposit request** with the UTR / transaction id / tx hash (and optionally a payment screenshot); staff check the payment and approve or reject it. Code: `src/ops/manual.rs`, `src/media.rs`, routes `src/api/manual.rs`, tables `payment_methods`, `payment_media`, `manual_deposits` (`migrations/0004_manual_payments.sql`).

- **Methods.** `kind` `bank` (details `account_name`, `bank_name`, `account_number`, `ifsc`, `swift`, `iban`, `branch`, `upi_id`; `account_name` or `upi_id` required; IFSC / SWIFT / IBAN / UPI formats checked) or `crypto` (`network`, `token` (default USDT), `address` (checked for the preset networks), `memo`). `currency` is what the client pays in (INR, USD, AED, USDT …) and `rate` the units of it per 1 USDT (1 for USDT); `min_amount` / `max_amount` (optional) in that currency; `status` `active` | `hidden`; `sort_order`; `instructions`; `qr_media_id`. A crypto method on an EVM network may carry `evm {chain_id, token_contract (null = the native coin), token_decimals}`: the Client Area then offers **Pay with MetaMask** (an ERC-20 `transfer` or a native transfer to the address; the tx hash becomes the reference; the request still waits for approval). Edits are full updates with the loaded `version` (409 `stale` when someone else saved in between); the kind never changes; delete hides the method for good (requests keep a snapshot of it).
- **Images.** QR codes (staff, `finance.settings`) and payment screenshots (clients): PNG / JPEG / WEBP sniffed from the bytes, at most 5 MB (413 `too_large`, 415 `unsupported_type`), stored under `WALLET_STORAGE_DIR` (directory 0700, files 0600) with a random 24-hex id. A QR is readable by every signed-in client of the tenant and by staff (cached as immutable); a screenshot only by staff and the client who uploaded it (`no-store`).
- **Requests.** The method must be active; the amount above 0 (6 decimals at most), within the method's limits; `expected_credit = amount / rate` floored to 6 decimals. At most 5 pending requests per client (429 `too_many_pending`); the client's `deposits` restriction applies. The reference is normalised (bank: spaces removed; crypto: a 64-hex hash lower-cased, with `0x` on EVM networks) and can't be pending or approved twice in a tenant (unique index on `(tenant_id, kind, reference_key)`, 409 `reference_used`); a crypto hash the automatic deposits already know is refused too. `idempotency_key` (one per submit, unique per client) makes a double submit return the same request (`replayed: true`). A client can cancel their own pending request.
- **Review.** Approve credits `expected_credit` USDT, or `credit_amount` with a `note` (required when it differs). One database transaction books the ledger credit (kind `bank_deposit` or `crypto_deposit`, key `manual:deposit:<tenant>:<id>`, counter-account `sys:USDT:<kind>`), the status, the audit entry and the client notification (`deposit.credited` → `wallet.deposit_credited`); approving again returns the request unchanged (`replayed: true`), so a retry never credits twice. Reject needs a reason the client sees (`deposit.rejected`). Approved credits show in the wallet history (labels "Bank deposit" / "Crypto deposit", also under the Deposits filter). Pending requests are counted in `GET /v1/admin/summary` (`manual_deposits`), which feeds the Back Office nav badge.
- **Audit.** `wallet.manual.method.created` / `updated` / `hidden` / `shown` / `deleted`, `wallet.manual.qr.uploaded`, `wallet.manual.deposit.approved` / `rejected` (before / after), `wallet.manual.deposit.cancelled` (the client), `wallet.manual.export`.

| Method & path | Who | Body / response |
|---|---|---|
| `GET /v1/manual/methods` | client | `{methods:[{id, kind, name, currency, rate, min_amount, max_amount, details, evm, qr_url, instructions}], max_pending}` |
| `POST /v1/manual/proofs?user_id=` | client | the raw image → `{media:{id, url, mime, size}}` |
| `POST /v1/manual/deposits` | client | `{user_id, method_id, amount, reference, proof_media_id?, note?, idempotency_key}` → `{deposit}` |
| `GET /v1/manual/deposits?user_id=&status&page&limit` · `GET /v1/manual/deposits/{id}?user_id=` | client | `{items, total, pending, max_pending}` · `{deposit}` (`reason` when rejected, `credit_amount` when approved) |
| `POST /v1/manual/deposits/{id}/cancel` | client | `{user_id}` → `{deposit}` (only while pending) |
| `GET /v1/manual/media/{id}?user_id=` | client | the image (a QR, or the client's own screenshot) |
| `GET /v1/admin/manual/methods` | `finance.read` | `{methods (with pending, version, created_by, updated_by), networks, counts}` |
| `POST /v1/admin/manual/methods` · `PUT /v1/admin/manual/methods/{id}` (`version`) · `POST …/{id}/delete {reason?}` | `finance.settings` | `{method}` |
| `POST /v1/admin/manual/media` · `GET /v1/admin/manual/media/{id}` | `finance.settings` · `finance.read` | QR upload (raw image) · any image of the tenant |
| `GET /v1/admin/manual/deposits?status&kind&method_id&user_id&q&page&limit` | `finance.read` | `{items, total, counts:{pending, pending_bank, pending_crypto, pending_usdt, approved, rejected, cancelled, all}}` (pending first, oldest first) |
| `GET /v1/admin/manual/deposits/{id}` | `finance.read` | `{deposit}` with `explorer_url` (crypto: tronscan, bscscan, etherscan, polygonscan, solscan, mempool.space), `proof_url`, `client_history`, `same_reference`, `history` |
| `POST /v1/admin/manual/deposits/{id}/approve` | `finance.approve` | `{credit_amount?, note?}` |
| `POST /v1/admin/manual/deposits/{id}/reject` | `finance.approve` | `{reason}` |
| `GET /v1/admin/manual/deposits/export?<filters>` | `finance.export` | CSV (at most 10,000 rows; audited) |

## Environment

| Variable | Default | |
|---|---|---|
| `WALLET_BIND` | `127.0.0.1:8095` | |
| `WALLET_DATABASE_URL` | `postgres://postgres@127.0.0.1:5433/ezymex_wallet` | created on first start |
| `WALLET_INTERNAL_TOKEN` | – | required in production |
| `WALLET_ENV` | `development` | `production` enforces the token |
| `WALLET_LOG_FORMAT` | `json` | `text` for local |
| `WALLET_WORKERS` | `true` | watcher, scanner, recovery (run on one instance only) |
| `WALLET_POLL_SECS` / `WALLET_SCAN_SECS` | `10` / `60` | |
| `WALLET_BSC_RPC_URLS` | `https://bsc-rpc.publicnode.com,https://bsc-dataseed.binance.org,https://bsc-dataseed1.defibit.io` | tried in order. The Binance dataseeds refuse `eth_getLogs`, so keep a getLogs-capable node first |
| `WALLET_TRONGRID_URL` | `https://api.trongrid.io` | |
| `TRONGRID_API_KEY` | – | read from the env or repo-root `.env.tron` |
| `WALLET_BSC_ADDRESS` / `WALLET_TRON_ADDRESS` | – | seed the receiving addresses on first start only. After that, the admin setting wins |
| `WALLET_BSC_CONFIRMATIONS` / `WALLET_TRON_CONFIRMATIONS` | `15` / `20` | seed values |
| `TRADING_URL` / `TRADING_INTERNAL_TOKEN` | `http://127.0.0.1:8090` | engine |
| `GATEWAY_URL` / `GATEWAY_INTERNAL_TOKEN` | `http://127.0.0.1:8080` | KYC status |
| `SUPPORT_URL` / `SUPPORT_INTERNAL_TOKEN` | `http://127.0.0.1:8100` / – | notification push (bell, realtime, email); empty URL = in-app only |
| `WALLET_STORAGE_DIR` | `~/.ezymex-data/wallet` | manual-payment QR codes and payment screenshots (created 0700 on start; files 0600). Back it up with the database |

The apps need `WALLET_URL` (default `http://127.0.0.1:8095`) and `WALLET_INTERNAL_TOKEN` (server-only) in `apps/crm` and `apps/admin`.

## Tests

`cargo test -p wallet` runs:

- **Unit tests:** money parsing and scale, base58check TRON addresses, ABI log decoding, fee maths, address validation, config redaction.
- **PostgreSQL integration tests** (`tests/flows.rs`, throw-away database) with a mock chain and a mock engine:
  - transfer idempotency (replay, conflict, concurrent duplicates);
  - insufficient funds;
  - deposit intent → submit → confirmations → credit;
  - auto-credit rules sending deposits to review;
  - unmatched scan and assign;
  - withdrawal limits, cooldown, KYC gate, approve → paid → verify → completed, reject and cancel unlock;
  - to-trading / from-trading with engine success, rejection and timeout recovery;
  - the ledger invariants after every flow (Σ postings = 0 per txn, balances = Σ postings, append-only).
- **Balance & credit** (`tests/adjustments.rs`): wallet add / deduct with the balance and ledger after each step, the notification and history note, a double submit booking once and a key conflict, over-deduction refused and audited, the external kinds; four-eyes (threshold set by `finance.settings` only, pending books nothing, the requester can't approve, a second staff member approves, double approval, reject / cancel, an approval that can no longer be booked fails); permissions (403 without `finance.adjust` / `finance.credit` / `finance.adjust_force`, role fallback without the header); trading accounts through the mock engine (free-margin refusal, force, credit take-back limits, another client's account refused, a lost engine answer settled by recovery with one booking, four-eyes on credit).

- **Manual payments** (`tests/manual.rs`, images in a temp directory): methods (validation of bank / crypto details, rates, limits and the MetaMask config; `finance.settings` only; stale versions refused; hide / delete; before / after in the audit log); images (PNG accepted, GIF / HTML / PDF / empty refused, 5 MB limit in the store and on the body, 0600 files, a QR readable by any client, a screenshot only by its uploader and staff, a QR id required for methods); requests (min / max, a hidden or unknown method, a duplicate UTR or hash in any spelling, a hash known as an on-chain deposit, a double submit, the pending cap, the deposits restriction, cancel only own pending); review (approve credits once under concurrent retries, a changed amount needs a note, reject needs a reason, decided requests can't be decided again, notifications, history, CSV export with `finance.export`, ledger invariants).

## Production checklist

- Addresses:
  - Set the receiving and payout addresses for each tenant in Back Office → Finance → Settings, and check them against the hardware wallet.
  - Payouts are manual for now: staff send from the company wallet and enter the hash. Hot-wallet signing, HD deposit addresses per client, and sweeps with TRX gas (D39) are a later phase.
- Paid RPC:
  - Use a paid BSC RPC (or a self-hosted node) with an `eth_getLogs` allowance; public endpoints rate-limit.
  - Use a TronGrid key per environment.
- Notifications: every row of `notifications` (deposit credited / rejected, withdrawal requested / approved / rejected / completed, transfers, credits) is written in the same transaction as the money change and then pushed by `src/notifier.rs` to the support service (`POST $SUPPORT_URL/v1/notify`, type `wallet.<kind>`, link `/wallet/history`, `dedupeKey wallet:n:<id>`). Support shows it in the Client Area and Ezymex Trader bells, on the realtime stream, and emails it per the client's `wallet` preference. The push runs after the commit (woken at once, else every 5 s), retries with backoff (15 s doubling to 1 h, 12 attempts, `push_attempts` / `push_error`), never blocks or rolls back the money transaction, and support's wallet polling adapter uses the same dedupe key, so nothing is shown or emailed twice.
- RLS: every table carries `tenant_id` and queries are tenant-scoped, but Row-Level Security policies are not enabled yet (same as the trading engine).
- Workers: run `WALLET_WORKERS=true` on exactly one instance.
