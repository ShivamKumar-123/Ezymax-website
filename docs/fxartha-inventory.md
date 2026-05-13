# FXArtha Platform — Feature Inventory

**Generated:** 2026-05-09
**Method:** Three parallel codebase explorations (frontend, backend, integrations) + direct repo inspection. Several agent reports were cross-checked against each other; conflicts noted inline.
**Scope:** Everything in this monorepo as of HEAD `0b94f45`.

> **Key:** ✅ Complete · 🟡 Partial (% noted) · ❌ Not started · ⚠️ **Needs verification** (couldn't confirm from static read)

---

## 1. FRONTEND (Trader UI)

`frontend/trader/` — Next.js 15 app served at `trade.fxartha.com`.

### Auth & Onboarding

| Feature | Status | Files | Backend |
|---|---|---|---|
| Email + password login | ✅ | `app/auth/login/page.tsx` | `POST /auth/login` |
| Registration (email/pwd, name, phone, country, referral) | ✅ | `app/auth/register/page.tsx` | `POST /auth/register` |
| Google OAuth | ✅ | `components/auth/GoogleAuthButton.tsx` | `POST /auth/google` (id_token) |
| SIWE wallet sign-in (login + link) | ✅ | `components/auth/ConnectWalletFlow.tsx`, `WalletLinkStep.tsx` | `/auth/wallet/nonce` + `/auth/wallet/verify`; for link: `/profile/wallet/link/nonce` + `/profile/wallet/link` |
| 2FA / TOTP | ✅ | login flow + `app/profile/page.tsx` | `/auth/login` accepts `totp_code`; setup via `/auth/2fa/setup` + `/auth/2fa/verify` |
| Forgot / reset password | ✅ | `app/auth/login/page.tsx` (modal) | `/auth/forgot-password` + `/auth/reset-password` |
| Demo account login | ✅ | `app/auth/login/page.tsx` | `/auth/demo-login` |
| Session mgmt (HttpOnly cookies, `/auth/me` heartbeat) | ✅ | `stores/authStore.ts` | `/auth/me`, `/auth/refresh`, `/auth/logout` |
| Email OTP verification (post-signup) | ✅ | `components/auth/EmailOtpStep.tsx` | `/auth/email/start-verification`, `/auth/email/verify-otp` |
| **Onboarding gate** (profile + email + wallet) | ✅ | `components/auth/OnboardingGate.tsx`, `ProfileCompleteGate.tsx` | `/auth/me` returns `onboarding_complete` flag; pre-2026-05-08 users grandfathered |

### KYC

| Feature | Status | Files | Backend |
|---|---|---|---|
| Document upload (passport, ID front/back, proof of address, selfie, etc.) | ✅ | `app/kyc/page.tsx` | `POST /profile/kyc/submit` (multipart) |
| KYC status display + rejection reasons + resubmit | ✅ | same | `GET /profile` returns `kyc_status` + per-doc reasons |
| KYC reminder cadence (3-day / 7-day emails) | ✅ | (server-driven; no UI) | `verification_reminder_engine` ticks hourly |

### Dashboard / Portfolio

| Feature | Status | Files | Notes |
|---|---|---|---|
| Account balance overview (live accounts) | ✅ | `app/dashboard/page.tsx` | Pulls `/accounts`, `/wallet/summary` |
| Top daily movers | 🟡 **needs verification** | `app/dashboard/page.tsx` | Hard-coded symbol list (XAUUSD, NAS100, BTCUSD, EURUSD); chart rendering needs eyeball check |
| Portfolio analytics (equity curve, win-rate, monthly P&L by symbol) | ✅ | `app/portfolio/page.tsx` | `GET /portfolio/trade-history`, `/portfolio/equity-curve` |

### Trading Terminal

| Feature | Status | Files | Notes |
|---|---|---|---|
| Trading terminal layout | ✅ | `app/trading/terminal/page.tsx` | Drag-resizable panes, mobile responsive |
| TradingView Advanced Chart | ✅ | `components/charts/AdvancedChart.tsx` | Custom datafeed (`lib/charting/datafeed.ts`) feeding from gateway |
| Custom broker adapter (TV order panel) | ✅ | `lib/charting/broker.ts` | Wired to `/orders/*`, `/positions/*` |
| Market order placement | ✅ | `components/trading/OrderPanel.tsx` | `POST /orders` with `order_type='market'` |
| Limit + stop + stop-limit orders | ✅ | `OrderPanel.tsx`, `MobileOrderSheet.tsx` | `OrderType` enum exposes `market`/`limit`/`stop`/`stop_limit` |
| SL / TP on order + post-fill | ✅ | `OrderPanel.tsx`, `PositionsPanel.tsx` | Edit via `PUT /positions/{id}` |
| Position management (close single, partial close, bulk close) | ✅ | `PositionsPanel.tsx` | `POST /positions/{id}/close`, `BulkCloseModal` |
| Order cloning | ✅ | `OrderPanel.tsx` | Pre-fills from `orderFormCloneDraft` store |
| Watchlist | ✅ | `components/trading/Watchlist.tsx` | Session-persisted |
| Instruments table | ✅ | `components/trading/InstrumentsTable.tsx` | Bid/ask spreads, segmented |
| Live tick stream | ✅ | `useTickFeed` hook | WebSocket `/ws/prices` |
| Closed Positions tab w/ SL/TP columns | ✅ | `PositionsPanel.tsx` (recent — commit `fa1b20b`) | Joins `Position.stop_loss/take_profit` for closed rows |

### Wallet — Deposits

| Feature | Status | Files | Notes |
|---|---|---|---|
| **Deposit card UI** | ✅ | `app/wallet/page.tsx` | Tabs: USDT (Wallet Connect) / Crypto (NowPayments) / Manual (Bank/UPI) |
| Decentralised USDT deposit (TRC-20 / BEP-20 / ERC-20) | ✅ | `components/wallet/OnchainDepositFlow.tsx` | Wagmi `useWriteContract` for plain `usdt.transfer(adminWallet, amount)`; verifier credits |
| **BSC testnet vault path** | 🟡 **scaffolded, awaiting deploy** | same — gated on `NEXT_PUBLIC_VAULT_TESTNET_ENABLED` | 4th radio card hidden behind feature flag (commit `0b94f45`) |
| NowPayments hosted invoice flow | ✅ | `WalletDepositModal.tsx` | `POST /wallet/deposit/wallet`, status polling |
| Manual bank / UPI deposit | ✅ | `app/wallet/page.tsx` (manual tab) | `POST /wallet/deposit/manual` (multipart with screenshot); auto-selects bank from rotation pool via `/wallet/deposit/bank-details` |

### Wallet — Withdrawals

| Feature | Status | Files | Notes |
|---|---|---|---|
| On-chain USDT withdrawal | ✅ | `app/wallet/page.tsx` (crypto tab) | `POST /wallet/withdraw/onchain` for vault path; or `POST /wallet/withdraw` with `crypto_address`. **Server hard-locks destination to `user.wallet_address` regardless of client input.** |
| Manual UPI / bank payout | ✅ | `app/wallet/page.tsx` (bank tab) | `POST /wallet/withdraw/manual` (multipart with QR / UPI ID / notes) |
| Withdrawal status polling | ✅ | same | `GET /wallet/withdraw/{id}/onchain-status` |

### History & Notifications

| Feature | Status | Files | Notes |
|---|---|---|---|
| Transactions page (deposits/withdrawals/transfers/trades) | ✅ | `app/transactions/page.tsx` + `TradesSection.tsx` | Date + type filters, pagination |
| Trade history with **SL/TP columns** | ✅ | `TradesSection.tsx`, `PositionsPanel.tsx` (terminal) | Joins SL/TP from Position; close-reason badge maps `tp/sl/admin/manual/copy_close` (commit `b68ff43`) |
| Toast notifications | ✅ | `react-hot-toast` everywhere | n/a |
| In-app notifications drawer | ✅ | top nav bell; dedicated page may be partial — **needs verification** | `/notifications` endpoint |
| Maintenance banner | ✅ | `platformStatusStore` | `/auth/platform-status` polled every 15s |

### Profile / Settings

| Feature | Status | Files | Notes |
|---|---|---|---|
| Profile editing (name, phone, country, address, DOB, language, theme, Islamic flag) | ✅ | `app/profile/page.tsx` | `PUT /profile` |
| Email change w/ OTP verification | ✅ | `components/profile/EmailVerificationCard.tsx` + `EmailOtpStep.tsx` | OTP flow |
| Wallet linking + unlinking | ✅ | `LinkedWalletCard.tsx` | SIWE link, then `DELETE /profile/wallet/link` to unlink (with safeguard if wallet is only sign-in method) |
| 2FA setup + backup codes | ✅ | profile page | Backend creates QR + codes |
| Active session list + kill | ✅ | profile page | `/profile/sessions`, `DELETE /profile/sessions/{id}` |
| Theme toggle (light/dark) | ✅ | `useUIStore` | localStorage |
| Notification preferences | 🟡 **needs verification** | profile page | UI tab exists; backend wiring unclear |

### Advanced / Earn

| Feature | Status | Files | Notes |
|---|---|---|---|
| Copy trading browse + subscribe | ✅ | `app/social/page.tsx` (leaderboard + my-copies tabs) | `/social/copy/{id}/subscribe` |
| PAMM / MAM (invest + apply as manager + my-dashboard) | ✅ | `app/pamm/page.tsx`, `app/social/page.tsx` (my-dashboard) | `/social/mamm-pamm/{id}/invest` etc. |
| Trade Insurance (browse + claim) | ✅ | `app/insurance/page.tsx` | `/insurance/policies`, `/insurance/claims` |
| Staking | ✅ | `app/earn/staking/page.tsx` | `/staking/plans`, `/staking/positions` |
| Play Zone (spin / lottery / bidding) | ✅ | `app/earn/play-zone/*` | `/play/spin`, `/play/lottery/*`, `/play/bid/*` |
| Rewards (XP, AC, missions, store) | 🟡 ~70% — page exists, depth unclear | `app/rewards/page.tsx` | `/rewards/*` endpoints |
| IB / Referral program | 🟡 ~50% — landing page exists, dashboard unclear | `app/business/page.tsx` | `/business/ib-apply` etc. |
| Academy (phases → modules → quizzes) | ✅ | `app/academy/[phaseId]/page.tsx` | Content is admin-managed |
| News | 🟡 **needs verification** — source unclear | `app/news/page.tsx` | TBD |

### Mobile

Tailwind-based responsive layouts throughout; bottom nav for trader; `MobileOrderSheet` is a separate small-screen order entry component. All major flows confirmed mobile-functional in code.

---

## 2. ADMIN PANEL

`frontend/admin/` — Next.js 15 app served at `admin.fxartha.com`. Backend at `backend/services/admin/` (separate FastAPI service from gateway).

### Admin Auth

| Feature | Status | Files |
|---|---|---|
| Email + password login | ✅ | `app/login/page.tsx` |
| HttpOnly cookie session | ✅ | `stores/authStore.ts` |
| Logout | ✅ | menu; `/auth/logout` |
| Role-based gating (admin / super_admin / employee) | ✅ | `auth.py` dependencies |

### Core Operations

| Feature | Status | Files | Backend |
|---|---|---|---|
| User list (search, filter, online indicator) | ✅ | `app/(admin)/users/page.tsx` | `/admin/users` |
| User detail (KYC docs, accounts, txns, wallet) | ✅ | `app/(admin)/users/[id]/page.tsx` | `/admin/users/{id}` |
| Suspend / unsuspend | ✅ | users page | `/admin/users/{id}/ban` |
| **Add Funds / Deduct Funds** | ✅ | users page | `/admin/users/{id}/fund-move` (2-admin gate removed in commit `503f519`) |
| Force-logout user sessions | ✅ | users page | n/a |
| Delete user | ⚠️ **needs verification** — UI button visible, backend route unclear | users page | n/a |

### KYC Review

| Feature | Status | Files |
|---|---|---|
| KYC queue (pending/approved/rejected tabs) | ✅ | `app/(admin)/kyc/page.tsx` |
| Document image viewer | ✅ | `/profile/kyc/file/{doc_id}` (gateway) |
| Approve / reject with reason | ✅ | `/admin/kyc/approve`, `/admin/kyc/reject` |

### Trades

| Feature | Status | Files |
|---|---|---|
| Open positions list | ✅ | `app/(admin)/trades/page.tsx` |
| Pending orders | ✅ | same (orders tab) |
| **Trade History (with SL/TP columns + reason badge: TP/SL/Admin/Manual)** | ✅ | same (history tab) |
| Admin-create trade (any user, any account) | ✅ | `app/(admin)/trades/create/page.tsx` |
| Edit position (price, SL, TP, lots) | ✅ | trades page modal |
| Force-close position (race-detection: stamps `tp/sl` if at trigger price, else `admin`) | ✅ | trades page |

### Money Operations

| Feature | Status | Notes |
|---|---|---|
| Deposit review queue (manual + crypto) | ✅ | `app/(admin)/deposits/page.tsx` |
| Withdrawal review queue (approve/reject) | ✅ | same (withdrawals tab) |
| Bank account pool CRUD | ✅ | `app/(admin)/banks/page.tsx` |
| Admin deposit wallets (per network/asset) | ✅ | `app/(admin)/settings/deposit-wallets/page.tsx` |
| Manual screenshot review | ✅ | deposits page modal |

### System Config

| Feature | Status | Files |
|---|---|---|
| Feature flags (maintenance_mode, allow_deposits, allow_withdrawals, allow_new_registrations) | ✅ | `app/(admin)/config/page.tsx` |
| Spreads config (per-symbol, per-account-group) | ✅ | `app/(admin)/config/spreads/page.tsx` |
| Charges config (commission per lot, deposit/withdrawal fees) | ✅ | `app/(admin)/config/charges/page.tsx` |
| Swaps config (rollover rates, triple-swap day) | ✅ | `app/(admin)/config/swaps/page.tsx` |
| Banners (promotional) | ✅ | `app/(admin)/banners/page.tsx` |
| Account types / groups | ✅ | `app/(admin)/account-types/page.tsx` |
| Instruments / Book mgmt | ✅ | `app/(admin)/book/page.tsx` |
| Audit logs viewer | ✅ | `app/(admin)/audit-logs/page.tsx` |

### Business

| Feature | Status | Notes |
|---|---|---|
| IB management | 🟡 ~50% | `app/(admin)/business/ib/page.tsx` — list/edit exists, full payout pipeline TBC |
| Sub-broker | 🟡 ~50% | `app/(admin)/business/sub-broker/page.tsx` |
| MLM config (multi-level commission tree) | 🟡 ~50% | `app/(admin)/business/mlm/page.tsx` |
| Copy masters approval | 🟡 ~60% | `app/(admin)/social/page.tsx` |

### Reports / Analytics

| Feature | Status | Files |
|---|---|---|
| Dashboard KPIs (users, balance, equity, daily volume) | 🟡 ~60% — basic widgets, depth TBC | `app/(admin)/dashboard/page.tsx` |
| Detailed reports (cohort, P&L per symbol, etc.) | ❌ Not built |  |

### Other admin areas

| Feature | Status | Notes |
|---|---|---|
| Bonus offers + UserBonus | 🟡 | `app/(admin)/bonus/page.tsx` |
| Insurance issuance / claim review | 🟡 | `app/(admin)/insurance` (if present — verify) |
| Play zone admin (spin odds, lottery rounds, bidding prizes) | 🟡 | `app/(admin)/play-zone/page.tsx` |
| Lifestyle rewards admin | 🟡 | `app/(admin)/lifestyle/page.tsx` |
| Support tickets | 🟡 | `app/(admin)/support/page.tsx` |
| Employees / role mgmt | 🟡 | `app/(admin)/employees/page.tsx` — recently fixed for cookie-only auth |

---

## 3. BACKEND SERVICES

`backend/services/` runs **5 services** under `docker compose`. Plus `backend/packages/common/` shared library.

### Service overview

| Service | Path | Purpose | Status |
|---|---|---|---|
| **gateway** | `backend/services/gateway/` | Main public API + WebSocket. ~25 routers under `src/api/`. 9 background engines under `src/engines/`. | ✅ Mature |
| **admin** (admin-api) | `backend/services/admin/` | Admin panel API. Separate FastAPI app, separate JWT realm. ~25 routes. | ✅ Mature |
| **market-data** | `backend/services/market-data/` | Price feed aggregator: Corecen LP push receiver + Infoway WebSocket + simulator fallback. Writes ticks to Redis + TimescaleDB OHLC. | ✅ Functional |
| **risk-engine** | `backend/services/risk-engine/` | Margin monitoring + stop-out + exposure monitoring + swap calculation. Async loops. | 🟡 ~80% — running but needs eyes-on for stop-out edge cases |
| **b-book-engine** | `backend/services/b-book-engine/` | Internal order matching for B-book trades. `MatchingEngine` class. | 🟡 ⚠️ **Implementation depth needs verification** — has Dockerfile + class shape but actual matching loop unclear |

### Gateway routers (`src/api/`)

`auth`, `accounts`, `instruments`, `trading_catalog`, `orders`, `positions`, `deposits` (also handles withdrawals + transfers), `social`, `business`, `portfolio`, `profile`, `support`, `notifications`, `banners` (+ `banners.media_router`), `followers`, `webhooks`, `lp_receiver` (HMAC-secured price push from Corecen), `share` + `share.public_router`, `insurance`, `rewards`, `play_zone`, `staking`. WebSockets: `/ws/prices`, `/ws/trades/{account_id}`, `/ws/admin`.

### Gateway engines (`src/engines/`)

| Engine | Tick | What it does | Tables touched |
|---|---|---|---|
| `chain_verifier_engine` | 30s | Polls Etherscan/BscScan/TronGrid; credits user wallet on successful USDT deposit. **Branches to vault-event decoder when `admin_deposit_wallet.contract_address` is set.** | `deposits`, `transactions`, `users`, `bonus_offers`, `admin_deposit_wallets` |
| `sltp_engine` | 1s | SL/TP trigger checks. Closes positions at the SL/TP level (not market price). | `positions`, `trade_history`, `transactions`, `trading_accounts`, `users` |
| `copy_engine` | ~2s | Mirrors master positions to investor sub-accounts (Signal / PAMM / MAM allocation types). | `master_accounts`, `investor_allocations`, `copy_trades`, `positions`, `trade_history`, `transactions` |
| `overnight_fee_engine` | hourly | 0.01%/day leverage fee on borrowed portion. Skips swap-free + Islamic accounts + positions held < 24h. | `positions`, `trading_accounts`, `transactions`, `account_groups`, `instrument_configs` |
| `stats_engine` | 60s | Master account performance metrics (return, drawdown, Sharpe). Daily PAMM/MAM management fee collection. | `master_accounts`, `trading_accounts`, `trade_history`, `investor_allocations`, `transactions` |
| `staking_engine` | hourly | Daily staking reward accrual (principal × APY / 365). | `staking_positions`, `staking_reward_accruals` |
| `play_zone_engine` | 60s | Closes lottery / bidding rounds at scheduled time. Idempotent. | `lottery_rounds`, `bidding_rounds` |
| `monthly_statement_engine` | hourly | Sends monthly statement emails on the 1st. Redis lock per (user, month). | `users`, `notifications` |
| `verification_reminder_engine` | hourly | KYC reminder emails at 3 + 7 days post-signup. Uses `users.kyc_reminder_stage` flag. | `users` |

### Trade-history self-heal (commit `70f9d1d`)

Background coroutine on the gateway lifespan: every 60s, INSERTs `trade_history` rows for any `Position` with `status='closed' AND close_price IS NOT NULL` that has no matching history row. Idempotent. Mitigation for an unidentified close-path that occasionally drops the history write.

### Admin API (`backend/services/admin/`)

Full route surface (~25 routes): `auth`, `dashboard`, `users`, `trades`, `book` (B-book settings), `deposits`, `banks`, `deposit_wallets`, `config`, `instruments_admin`, `business`, `social`, `analytics`, `bonus`, `banners`, `support`, `employees`, `settings`, `transactions`, `kyc`, `account_types`, `user_audit_logs`, `insurance`, `play_zone_admin`, `lifestyle_admin`. All under `/api/v1/admin`.

### Common package (`backend/packages/common/src/`)

- **`auth.py`** — JWT, `decode_token`, `require_onboarded` dep, `WalletAuthNonce` SIWE challenges.
- **`models/`** — split per domain: `users.py`, `trading.py`, `wallet.py`, `business.py`, `instruments.py`, `support.py`, `system.py`, `insurance.py`, `rewards.py`, `play_zone.py`, `staking.py`, `share.py`, `vip.py`. Plus `_enums.py`.
- **`chain_clients/`** — `etherscan.py`, `bscscan.py` (+ `verify_bsc_vault_deposit` for vault path), `trongrid.py`. USDT contracts + decimals tables. `chain_id_for(network)`.
- **`corecen_trade_client.py`** — HTTP client for Corecen LP A-Book trade open/close/modify.
- **`smtp_mail.py`** — async SMTP via `aiosmtplib`. Optional (no-op if SMTP_HOST blank).
- **`redis_client.py`**, **`kafka_client.py`** (Kafka largely retired per repo notes), **`config.py`** Pydantic settings, **`notify.py`** in-app notifications, **`instrumentation.py`** Sentry + middleware.

### Cron / scheduled work

All scheduled work is in-process async loops inside the gateway (the 9 engines above). No external cron / Celery / RQ. Two host-level cron jobs (per `crontab -l` from earlier):
- `0 4 1 * * /usr/local/bin/refresh-cloudflare-ufw.sh` — monthly CF IP refresh for UFW rules.
- `30 2 * * * /usr/local/bin/fxartha-backup.sh` — nightly DB backup.

### NOT present (worth flagging)

- **No real MT5 / FIX bridge.** Corecen is the LP, accessed via HTTP — not FIX.
- **No standalone liquidation engine.** Liquidation logic lives inside `risk-engine` (margin-monitor loop).
- **No protocol-token, staking-contract, or on-chain settlement engine.** Vault Phase 1 is custody-only by design.

---

## 4. DATABASE

PostgreSQL via SQLAlchemy 2.0 async. **45 Alembic migrations.** Tables grouped by domain: users, trading, wallet, business, support, system, insurance, rewards, play_zone, staking, vip, share, security.

### Major tables (top 30 by importance)

| Table | Purpose | Key columns |
|---|---|---|
| `users` | User accounts | `email`, `wallet_address`, `kyc_status`, `email_verified`, `email_verified_at`, `kyc_reminder_stage`, `is_demo`, `is_islamic`, `is_vip`, `wallet_chain`, `wallet_connected_at`, `wallet_disconnected_at` |
| `trading_accounts` | Per-user trading sub-accounts | `account_number`, `balance`, `equity`, `margin_used`, `free_margin`, `margin_level`, `leverage`, `is_demo`, `is_active` |
| `account_groups` | Tier templates | `name`, `leverage_default`, `max_leverage`, `spread_markup_default`, `commission_default`, `swap_free`, `is_demo` |
| `positions` | Open + closed positions | `side`, `lots`, `open_price`, `close_price`, `profit`, `status`, `stop_loss`, `take_profit`, `last_swap_at`, `is_admin_modified` |
| `orders` | Pending / filled orders | `order_type`, `status`, `side`, `lots`, `price`, `filled_price`, `stop_loss`, `take_profit` |
| `trade_history` | Closed-trade ledger | `position_id`, `side`, `lots`, `open_price`, `close_price`, `profit`, `commission`, `swap`, `closed_at`, `close_reason` (`tp`/`sl`/`manual`/`admin`/`copy_close`) |
| `instruments` | Tradable symbols | `symbol`, `description`, `segment_id`, `min_lot`, `max_lot`, `lot_step`, `pip_value`, `contract_size` |
| `instrument_configs` | Per-group spread / commission / swap | `instrument_id`, `account_group_id`, `spread_markup`, `commission`, `swap_long`, `swap_short` |
| `deposits` | Inflows | `method` (bank/upi/qr/wallet_connect/nowpayments/oxapay/manual/crypto_*), `status`, `network`, `pay_amount`, `pay_currency`, `screenshot_url`, `crypto_tx_hash`, `bank_account_id`, `expires_at` |
| `withdrawals` | Outflows | `method`, `status`, `crypto_address`, `bank_details`, `wallet_chain_snapshot`, `verification_method`, `approval_id` (vault) |
| `transactions` | Money ledger | `type`, `amount`, `balance_after`, `reference_id`, `description`, `created_by` |
| `bank_accounts` | Admin bank rotation pool | `bank_name`, `account_number`, `ifsc_code`, `upi_id`, `tier`, `min_amount`, `max_amount`, `rotation_order`, `last_used_at` |
| `admin_deposit_wallets` | Per-chain admin USDT addresses + vault contract | `network`, `asset`, `address`, `contract_address`, `contract_event_abi` (JSONB), `contract_owner_address`, `is_testnet`, `min_confirmations`, `is_active` |
| `kyc_documents` | KYC submissions | `document_type`, `file_url`, `status`, `rejection_reason` |
| `master_accounts` | Copy-trade providers | `master_type` (signal_provider/pamm/mam), `performance_fee_pct`, `total_return_pct`, `max_drawdown_pct`, `status` |
| `investor_allocations` | Copy-trade subscribers | `master_id`, `investor_id`, `copy_type`, `allocated_amount`, `lots_multiplier`, `status` |
| `copy_trades` | Mirrored trade rows | `allocation_id`, `master_position_id`, `investor_position_id`, `performance_fee_credited` |
| `ib_profiles` | Affiliate accounts | `referral_code`, `parent_ib_id`, `custom_commission_per_lot`, `total_earned` |
| `referrals` | referrer→referred mapping | `referrer_id`, `referred_id`, `ib_profile_id`, `utm_*` |
| `ib_commissions` | IB commission ledger | `ib_id`, `source_user_id`, `source_trade_id`, `amount`, `mlm_level`, `status` |
| `notifications` | In-app alerts | `type`, `title`, `body`, `read_at`, `action_url` |
| `banners` | Promotional content | `title`, `content`, `image_url`, `target_audience`, `is_active`, `scheduled_at` |
| `support_tickets` + `ticket_messages` | Support inbox | standard fields |
| `bonus_offers`, `user_bonuses` | Promo campaigns | `bonus_amount`, `wagering_requirement`, `expires_at` |
| `insurance_policies`, `insurance_claims` | Trade insurance | `coverage_pct`, `premium`, `claim_amount` |
| `staking_plans`, `staking_positions`, `staking_reward_accruals` | Yield product | standard fields |
| `lottery_rounds`, `lottery_tickets`, `bidding_rounds`, `bids`, `spin_results` | Play zone | game state |
| `rewards_user_state`, `rewards_missions`, `rewards_user_mission_progress`, `reward_store_items`, `rewards_transactions` | Gamification | XP / Artha Coin balances + missions |
| `audit_logs` (admin) + `user_audit_logs` (trader) | Action trails | `action_type`, `ip_address`, `device_info`, `old_values`, `new_values` |
| `wallet_cooldowns` | 24h re-link lock per disconnected wallet | `wallet_address`, `prior_user_id`, `reusable_after`, `reason` |
| `sensitive_action_challenges` | Step-up auth challenges | `action`, `method`, `challenge_data`, `metadata`, `verified_at`, `consumed_at` |
| `wallet_auth_nonces` | SIWE single-use nonces | `address`, `nonce`, `chain_id`, `issued_for`, `consumed_at`, `expires_at` |
| `email_otp_codes` | Email OTP store | `target_email`, `code_hash`, `attempts`, `expires_at`, `consumed_at` |

### Last 20 migrations (newest first)

| Rev | File | What it did |
|---|---|---|
| **0044** | `20260509_0044_admin_deposit_wallets_testnet_flag.py` | `is_testnet BOOLEAN` on admin_deposit_wallets + `approval_id VARCHAR(66)` UNIQUE on withdrawals (vault idempotency key) |
| **0043** | `20260508_0043_restore_manual_money_methods.py` | Re-allow `bank_transfer`/`upi`/`qr`/`crypto_*`/`metamask` methods (reverses 0040 retirement) |
| **0042** | `20260508_0042_security_hardening.py` | `wallet_cooldowns` + `sensitive_action_challenges` tables; wallet metadata cols on users; withdrawal snapshot cols |
| **0041** | `20260508_0041_email_verification_and_wallet_uniqueness.py` | `users.email_verified` + `email_verified_at`; `email_otp_codes` table; partial UNIQUE index on `LOWER(wallet_address)` |
| **0040** | `20260505_0040_retire_manual_money_flows.py` | Tightened CHECK constraints (later reverted by 0043). Added `contract_address`, `contract_event_abi`, `contract_owner_address` placeholder columns |
| **0039** | `20260504_0039_admin_deposit_wallets.py` | Created `admin_deposit_wallets` table |
| **0038** | `20260504_0038_deposits_method_nowpayments.py` | Added `nowpayments` method + `pay_amount` / `pay_currency` / `network` / `expires_at` to deposits |
| **0037** | `20260502_0037_security_hardening.py` | Earlier hardening pass — constraints, indexes, nonce cleanup |
| **0036** | `20260502_0036_indexes_and_webhook_dedup.py` | Performance indexes + webhook event dedup unique constraint |
| **0035** | `20260502_0035_user_address_fields.py` | `users.city`, `state`, `postal_code` for KYC |
| **0034** | `20260502_0034_add_user_wallet_auth.py` | `users.wallet_address` VARCHAR(42); SIWE `wallet_auth_nonces` table; partial unique index |
| **0033** | `20260502_0033_user_kyc_reminder_stage.py` | `users.kyc_reminder_stage` for reminder cadence |
| **0032** | `20260501_0032_deposit_wallet_connect_fields.py` | NowPayments wallet-connect fields on deposits |
| **0031** | `20260501_0031_lifestyle_fulfillments.py` | `lifestyle_fulfillments` table |
| **0030** | `20260501_0030_vip_pass_stub.py` | `vip_passes` placeholder (gated by `system_settings.vip_pass_enabled`) |
| **0029** | `20260501_0029_event_flash_missions.py` | Time-limited reward missions |
| **0028** | `20260501_0028_streak_day_missions.py` | Daily / streak missions |
| **0027** | `20260501_0027_user_islamic.py` | `users.is_islamic` (swap-free routing + overnight-fee exemption) |
| **0026** | `20260501_0026_overnight_fee.py` | `overnight_fees` history ledger |
| **0025** | `20260501_0025_bidding.py` | Play-zone bidding tables |

### Tables added but lightly used / placeholder

| Table | Reality |
|---|---|
| `vip_passes` | 🟡 Stub. Gated by `system_settings.vip_pass_enabled`; not enabled. |
| `event_flash_missions` | ⚠️ Schema exists; live query usage needs verification |
| `lifestyle_fulfillments` | ⚠️ Schema exists; live query usage needs verification |
| `wallet_cooldowns`, `sensitive_action_challenges` | ✅ Tables created; **enforcement code is currently STASHED** in `wip-pr2-step-up-modal-and-enforcement` (not merged) — they're additive infra waiting on PR 2 |
| `fund_move_approvals` | ⚠️ Dead schema. Table + ORM class still present, but the 2-admin gate that used them was removed in commit `503f519` (no admin UI ever shipped). Future migration can drop. |

---

## 5. SMART CONTRACTS

`backend/contracts/` — Foundry workspace, added in commit `0b94f45` (2026-05-09).

| Item | Path | Status |
|---|---|---|
| `FXArthaVaultV1.sol` | `backend/contracts/src/FXArthaVaultV1.sol` | ✅ Written. ~200 SLOC. OpenZeppelin v5 (`AccessControl`, `Pausable`, `SafeERC20`). Functions: `deposit`, `withdraw(to, amount, approvalId)`, `pause`, `unpause`, `recoverToken`. Events: `Deposit`, `Withdraw`, `TokenRecovered`. Roles: `DEFAULT_ADMIN_ROLE`, `WITHDRAWER_ROLE`, `PAUSER_ROLE`. |
| Test suite | `backend/contracts/test/FXArthaVaultV1.t.sol` | ✅ 25+ tests: happy path, every revert path, fuzz (`testFuzz_*`), invariant (`invariant_AccountingMatchesBalance`). **`forge test` not yet run** — coverage % unverified pending user run. |
| Deploy script | `backend/contracts/script/Deploy.s.sol` | ✅ Reads env (`USDT_ADDRESS`, `ADMIN_ADDRESS`, optional `PAUSER_OPS_EOA`). Logs verification command + post-deploy checklist. |
| Foundry config | `backend/contracts/foundry.toml` | ✅ solc 0.8.24, optimizer on, fuzz=1024, invariant runs=256 depth=32, BscScan API config |
| `.env.example`, `README.md`, `.gitignore`, `remappings.txt` | `backend/contracts/` | ✅ Full setup |
| **Deployment** | testnet | ❌ **Not yet deployed.** Awaiting user to run `forge install` + `forge test` + `forge script Deploy.s.sol --broadcast --verify` from a funded BSC-testnet EOA. |
| Audit | — | ❌ Not started. Spec §6 lists 13-item checklist. |
| Other contracts | — | ❌ `SettlementMath`, `FloatingVault`, `FixedVault`, `DAGChainBridge` mentioned by client earlier — **explicitly de-scoped from Phase 1.** |

Phase 1 spec: `docs/vault-phase1-spec.md` (447 lines, audit-ready).

---

## 6. INFRASTRUCTURE

### Hosting

- **Single VPS** (Contabo or similar, IP `187.127.158.50`, hostname `srv1625972`). Ubuntu 24.04. Docker compose stack.
- **Cloudflare** in front for: TLS termination at edge (origin certs in `/etc/ssl/cloudflare/`), WAF, DDoS, "Always Use HTTPS" toggle.
- **Nginx** on origin (`/etc/nginx/sites-enabled/fxartha.conf`) reverse-proxies to docker containers.
- DNS: apex `fxartha.com` → Cloudflare → origin; subdomains `trade.`, `admin.`, `api.` likewise.

### Containers (`docker-compose.yml`)

| Container | Image | Notes |
|---|---|---|
| `postgres` | `postgres:16-alpine` | Healthcheck on `pg_isready`; init SQL at `backend/infra/docker/init-db.sql` |
| `redis` | redis-alpine | Used for tick fanout, locks, rate-limit counters, idempotency, presence |
| `gateway` | `fxartha-gateway` (built) | Bind-mounted source — no rebuild for backend code change. Port 8000 + 8002 (loopback for nginx) |
| `admin-api` | `fxartha-admin-api` (built) | Same bind-mount pattern. Port 8001 + 8003 |
| `trader-frontend` | `fxartha-trader-frontend` (built) | Next.js standalone bundle. Port 3010 + 3012 (loopback) — **must rebuild on code change** |
| `admin-frontend` | `fxartha-admin-frontend` (built) | Same. Port 3011 + 3013 |
| `market-data` | built | Tick aggregator |
| `risk-engine` | built | Margin / stop-out loops |
| `b-book-engine` | built | Internal matching |
| `migrate` | run via profile | `docker compose --profile migrate run --rm migrate` runs Alembic |

The loopback-port mappings (`127.0.0.1:8002`, `127.0.0.1:3012`, etc.) were added manually outside `docker-compose.yml` historically — caused recurring drift bugs that bit production today. Earlier today nginx was repointed to the public-facing host ports (3010/3011/8000) which ARE in compose, fixing the drift permanently.

### CI/CD

- **GitHub Actions**: `.github/workflows/ci.yml` runs on push/PR to `main`.
  - Backend job: AST-parses every `.py` under `backend/` to catch syntax errors. **No actual unit tests run.**
  - No frontend job, no Solidity job in CI.
- **Deploy = manual**: `git pull && docker compose build <service> && docker compose up -d <service>` on the VPS.
- No staging environment confirmed. Effectively dev (local docker) + prod (single VPS).

### Monitoring / alerting

- **Sentry** wired via `instrumentation.py` (gateway + admin-api). Init only fires when `SENTRY_DSN` is set; logs `SENTRY_DSN not set — Sentry disabled` otherwise — currently disabled on this VPS.
- **Prometheus client** lib included (`prometheus-client>=0.20.0`) but no scrape endpoint visible in code — ⚠️ **needs verification** whether `/metrics` is exposed.
- No external alerting (PagerDuty / OpsGenie / etc.) detected.

### Secrets management

- **`.env` files** in repo root (gitignored) loaded by docker-compose via `env_file:`.
- All secrets stored in plain `.env` on the VPS. No Vault, no AWS Secrets Manager, no Doppler.

### Backup

- **Nightly backup**: `/usr/local/bin/fxartha-backup.sh` at `30 2 * * *` (cron). Script in repo at `scripts/backup.sh`. Companion `restore.sh` exists.
- Where backups land was not verified from the script content here — ⚠️ **needs verification** (off-VPS storage strongly recommended).

### Other ops

- **UFW firewall** with explicit allows for port 443 from Cloudflare IP ranges only (IPv4 + IPv6); SSH on 22; **no port 80** allowed from outside.
- **Cloudflare IP refresh cron**: `0 4 1 * * /usr/local/bin/refresh-cloudflare-ufw.sh` — monthly UFW rule refresh for CF IP changes.

---

## 7. THIRD-PARTY INTEGRATIONS

### Block explorers (chain verification)

| Service | What | File | Env |
|---|---|---|---|
| **Etherscan** | ERC-20 USDT transfer verify on Ethereum | `backend/packages/common/src/chain_clients/etherscan.py` | `ETHERSCAN_API_KEY`, `ALCHEMY_API_URL` (fallback RPC) |
| **BscScan** | BEP-20 USDT verify on BSC mainnet + testnet; **also event-decoded vault deposit verifier** (`verify_bsc_vault_deposit`) | `backend/packages/common/src/chain_clients/bscscan.py` | `BSCSCAN_API_KEY`, `BSC_RPC_URL`, `BSC_TESTNET_RPC_URL` |
| **TronGrid** | TRC-20 USDT verify; base58 address handling | `backend/packages/common/src/chain_clients/trongrid.py` | `TRONGRID_API_KEY`, `TRON_API_URL` |

All three driven by `chain_verifier_engine`. Public/free endpoints used as fallback.

### Payment processors

| Service | What | File | Status |
|---|---|---|---|
| **NowPayments** | Hosted crypto invoice + IPN webhook | `backend/services/gateway/src/services/nowpayments_service.py` | ✅ In use (primary) |
| **OxaPay** | Same shape, kept mounted for in-flight + historical rows | `backend/services/gateway/src/services/oxapay_service.py` | 🟡 Configured, legacy fallback |

Both verify HMAC on webhook delivery. Disabled gracefully if API key missing.

### LP / market data

| Service | What | Files | Status |
|---|---|---|---|
| **Infoway.io** | Forex tick WebSocket feed | `backend/services/market-data/src/infoway_feed.py` | ✅ In use |
| **Corecen LP** | Dual purpose: A-Book trade routing API + LP price push (HMAC-secured push to `/api/lp/prices/batch`) | `backend/packages/common/src/corecen_trade_client.py`, `backend/services/market-data/src/corecen_lp_feed.py`, `backend/services/gateway/src/api/lp_receiver.py` | ✅ In use |
| Feed simulator | Synthetic forex + Binance-derived crypto fallback | `backend/services/market-data/src/feed_handler.py` | ✅ Fallback |
| **TradingView Charting Library** | Trader-side chart UI | `frontend/trader/public/charting_library/` (license required) | ✅ In use |

### Email + SMS

| Service | What | Status |
|---|---|---|
| **SMTP** (`aiosmtplib`) | Transactional email — OTP, KYC, deposit confirmation, withdrawal request, monthly statement, KYC reminders, bonus credit, master onboarding, etc. | ✅ Configured (optional). Failure mode: log warning, never block hot path. |
| **SMS** | None detected | ❌ Not integrated |

### Auth & wallet

| Service | What | Files | Env |
|---|---|---|---|
| **Google OAuth 2.0** | "Continue with Google" button | trader auth pages | `GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` |
| **WalletConnect** (via Reown AppKit) | Mobile wallet deeplink + QR | `frontend/trader/src/lib/web3/config.ts` (wagmi + RainbowKit) | `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` |
| **wagmi + viem + RainbowKit** | Wallet connection, tx signing, contract calls | same | n/a |

### KYC

| Service | Status |
|---|---|
| Internal manual review only | ✅ — no Veriff / Sumsub / Jumio etc. integrated. Documents stored in `KYC_UPLOAD_ROOT` filesystem. Admin reviews via admin panel. |

---

## 8. KNOWN GAPS / TECH DEBT

### Stashed PRs (`git stash list`)

```
stash@{0}: On main: wip-pr2-step-up-modal-and-enforcement
stash@{1}: On main: wip-security-hardening-0042
```

| Stash | Severity | Content |
|---|---|---|
| `stash@{0}` | 🟡 Medium | **PR 2 — step-up auth UI + enforcement.** Withdraw / disconnect / email-change all gated on password-or-SIWE proof. Modal `SensitiveActionModal.tsx` written. ~85% complete. PR 1 already shipped (commit `63c37b5`) with the additive infrastructure; tables `wallet_cooldowns` + `sensitive_action_challenges` are sitting empty until this stash ships. |
| `stash@{1}` | 🟢 Low | Earlier WiP, likely superseded by stash@{0}. Discard candidate after a diff check. |

### Tests

| Issue | Severity |
|---|---|
| Backend: no unit tests, no `tests/` directory. CI runs only AST syntax check. | 🔴 High — every change to `trading_service.close_position`, `wallet_service.create_withdrawal`, `chain_verifier_engine`, etc. is tested by humans only. |
| Frontend: no Jest / Vitest. | 🟡 Medium |
| Solidity: Foundry suite exists (`FXArthaVaultV1.t.sol`) — pass criteria documented but **not yet run**. | 🟡 Medium — gated by user running `forge test` from deploy machine. |

### Half-built / awaiting verification

| Area | Severity |
|---|---|
| BSC vault testnet **deploy not yet executed** — contract code ready; awaiting funded EOA + `forge script --broadcast` | 🟡 Medium |
| BSC vault frontend radio card — gated behind `NEXT_PUBLIC_VAULT_TESTNET_ENABLED` flag, off by default | 🟢 Low (intentional) |
| Trade-history self-heal task (commit `70f9d1d`) — deployed as a backstop for an unidentified close-path that occasionally drops the `TradeHistory` insert. **Root cause not yet found.** Worth digging when prod is calm. | 🟡 Medium |
| Admin business sub-pages (IB / sub-broker / MLM) — UI scaffolds exist, depth of admin tooling for commissions / payouts unclear | 🟡 Medium |
| Trader notifications preferences tab | 🟡 Low |
| Admin reports (cohort, P&L by symbol, etc.) | 🟢 Low — feature gap, not bug |
| `b-book-engine` matching loop — Dockerfile + `MatchingEngine` class shape exists but actual matching depth needs eyeball | 🟡 ⚠️ |
| Risk-engine stop-out edge cases — works, but limited test coverage | 🟡 |

### Schema instability

6 migrations in 10 days (`0039`–`0044`). Suggests rapid spec churn. Consider a moratorium on schema changes for 1–2 weeks once Phase 1 vault ships and adding integration-test scaffolding to catch ORM-mapper regressions (we hit one today: the `PasswordResetToken.user` back-populates bug).

### Recurring port-drift problem (resolved today)

Manual `127.0.0.1:30XX` host port mappings on gateway / trader-frontend / admin-frontend disappeared every container recreate because they weren't in `docker-compose.yml`. Caused intermittent 502s today. Fixed by repointing nginx to the public-facing ports (3010/3011/8000) which ARE in compose. Optional follow-up: re-add loopback ports to compose YAML for security-in-depth.

### Trade-side / data integrity

`trade_history` rows occasionally not written despite Position.status=closed. Self-heal task papers over it but root cause unknown. Likely an exception in the post-close path (insurance payout / notification / Redis publish) silently rolling back the `db.add(history)` write on the same session. Worth investigating with structured logging.

### Removed today: 2-admin fund-move gate (commit `503f519`)

The `add_fund` / `deduct_fund` 409 above $500 has been stripped. The `fund_move_approvals` table + `FundMoveApproval` ORM class remain (harmless dead schema). If the workflow is ever wanted back, it'd need a UI for approver/requester (the missing piece that broke this) plus restoring the threshold/consume code.

---

## 9. ARCHITECTURE-DOC vs CODE GAPS

### Readable spec (`docs/vault-phase1-spec.md`) vs implementation

| Spec item | Code | Gap? |
|---|---|---|
| §3 Contract surface | `FXArthaVaultV1.sol` exists with all 5 functions + 3 events + 3 roles | ✅ done |
| §5.1 `admin_deposit_wallets` placeholder columns | Migration 0040 added them; 0044 added `is_testnet` | ✅ done |
| §5.2 `chain_verifier_engine` event-decode branch | Wired (commit `0b94f45`) — dispatches to `_verify_via_vault_event` when `contract_address` set | ✅ done |
| §5.3 New chain client | `verify_bsc_vault_deposit` in `bscscan.py`. (Per-DAGChain `dagchain.py` not yet — DAGChain explicitly deferred per latest client direction.) | ✅ for BSC |
| §5.4 Frontend radio card | Added behind feature flag in `OnchainDepositFlow.tsx` | ✅ done (gated) |
| §5.5 Withdrawal `approval_id` column | Migration 0044 added `withdrawals.approval_id VARCHAR(66) UNIQUE` | ✅ done |
| §6 Audit checklist | 13 items documented in spec | ❌ audit not engaged yet |
| §9 Multi-sig owner setup | Documented; **not yet provisioned** | ❌ Gnosis Safe not deployed |
| §9 Mainnet deploy | Blocked on audit sign-off | ❌ deferred |

### `.docx` architecture documents — cannot be read as plain text

12 binary Word documents in repo root:

```
CONTENT FOR EARN PAGE.docx
COPY TRADING PAGE.docx
DETAILED CONTENT HOW IT WORKS PAGE.docx
FINAL TRADE INSURANCE PAGE.docx
HOME PAGE CONTENT LAYOUT DESIGN.docx
Repeatable task.docx
STAKING PAGE.docx
Trade Insurance.docx
Trading Mechanism.docx
TRADING PAGE.docx
UI trade insurance.docx
XP Reward mechanism.docx
```

I cannot parse `.docx` files. **However, the corresponding code DOES exist for most of these:**

| Doc | Code present? |
|---|---|
| Earn / Staking | ✅ `app/earn/staking/`, `staking_engine.py`, `staking_*` tables |
| Copy Trading | ✅ `app/social/`, `copy_engine.py`, `master_accounts` / `investor_allocations` / `copy_trades` |
| Trade Insurance | ✅ `app/insurance/`, `insurance_policies` / `insurance_claims`, `insurance_maybe_pay` integration in `trading_service.close_position` |
| XP Reward | ✅ `rewards/`, `rewards_*` tables, `app/rewards/` page |
| Trading Mechanism / Trading Page | ✅ Full terminal + order routing |
| How It Works / Home Page | ⚠️ — these are marketing-page content docs; whether the corresponding apex marketing pages match the doc's copy is **out of scope here** (apex domain is a separate Next.js app per earlier conversation, or has been merged with trader app — unclear) |
| Repeatable task.docx | Unclear what this is — possibly QA / SRE runbook content |

**Recommended follow-up:** open each `.docx` in Word/Docs, take 30 minutes to skim against the code, and add specific gaps to the backlog. The agent doing this scan can't do it without a `.docx` parser. If you paste the contents back in chat, I'll diff them against the code.

---

## Summary

**What's solid**: Auth, KYC, trading terminal (chart + order placement + position management), deposits (3 chains + 2 processors + manual), withdrawals (on-chain + manual), trade history with SL/TP labels, copy trading + PAMM/MAM, staking + play zone + insurance + rewards (gamification), admin operations (user mgmt, KYC review, trade mgmt, money review, config, audit logs). Production-stable as of today after multiple firefights.

**What's in flight**: BSC vault contract (deployed-by-user pending), step-up auth modal (PR 2 stashed), root-cause hunt for trade-history insert drops (self-heal task as backstop).

**Biggest risk areas**: Zero backend unit tests, schema churn, recurring nginx-port drift (resolved today but worth permanenizing in compose), unidentified `trade_history` insert-drop bug.

**Quickest wins** (each <1 day):
1. Add `tests/` scaffolding and write tests for `trading_service.close_position` + `wallet_service.create_withdrawal` (prevent today's class of bug).
2. Move loopback ports into `docker-compose.yml` permanently.
3. Investigate and fix the `trade_history` insert-drop root cause (the self-heal job's warning logs will tell us when it kicks in).
4. Open the 12 `.docx` files and triage promised-vs-built.
5. Run `forge test` on the vault contract → deploy to BSC testnet → verify on BscScan.

**End of report.**
