# FXArtha — Architecture, Scalability, Security

This is a single source of truth for the platform's design. Every
feature, where its code lives, when it breaks under load, and what
attacks it's exposed to. Updated 2026-05-12.

> If you only have 5 minutes, read sections 1, 2, 8, and 9.

---

## 1. System overview

FXArtha is a regulated-style forex/crypto B-book brokerage:

- Customers trade off-chain (b-book matching, broker is the counterparty)
- Deposits/withdrawals settle on-chain (USDT BSC vault) or via NOWPayments / OxaPay
- Postgres is the canonical ledger; the chain is escrow

```
                       ┌──────────────────────────┐
   trader.fxartha.com ▶│  Next.js trader frontend │
   admin.fxartha.com  ▶│  Next.js admin frontend  │
   fxartha.com        ▶│  same trader image,       │
                       │  middleware splits hosts  │
                       └────────────┬──────────────┘
                                    │  /api/v1, /admin-api, /ws/*
                                    │  HttpOnly cookie auth
                                    ▼
       ┌─────────────────────────────────────────────────────────────┐
       │                                                              │
   ┌────────────┐    Redis pub/sub   ┌──────────────┐                 │
   │ market-    │ ──tick:{symbol}──▶ │  gateway     │                 │
   │ data       │                    │ (FastAPI +   │                 │
   │ Infoway +  │ ──Timescale──▶     │  9 engines)  │                 │
   │ Corecen +  │   ticks/OHLCV      └──────┬───────┘                 │
   │ Binance    │                            │                         │
   └────────────┘                            ▼                         │
        │                              ┌──────────────┐                │
        └──── tick:{symbol} ─────────▶ │ b-book-      │  positions    │
                                       │ engine       │  orders       │
                                       └──────┬───────┘  trades       │
                                              │                       │
                                       ┌──────────────┐               │
                                       │ risk-engine  │  stop-outs    │
                                       │ (poll 5s)    │  margin calls │
                                       └──────────────┘               │
                                       ┌──────────────┐               │
                                       │ admin-api    │               │
                                       │ (config,     │               │
                                       │  KYC, book)  │               │
                                       └──────┬───────┘               │
                                              │                       │
                                              ▼                       │
                                       ┌──────────────┐               │
                                       │  Postgres    │               │
                                       │  +Timescale  │               │
                                       │  +Redis      │               │
                                       └──────────────┘               │
                                                                       │
                                       ┌──────────────┐               │
                                       │ BSC Vault    │  on-chain     │
                                       │ FXArthaVault │  USDT deposits│
                                       │ V1.sol       │  + withdrawals│
                                       └──────────────┘               │
       └─────────────────────────────────────────────────────────────┘
```

**Intentional design:** all inter-service communication is through
Postgres state and Redis pub/sub — no HTTP RPC between services. One
service dying doesn't cascade. Trade-off: no compile-time wire contracts.

---

## 2. Folder structure

```
fxartha/
├── backend/
│   ├── contracts/                         # Foundry — FXArthaVaultV1.sol on BSC
│   │   ├── src/FXArthaVaultV1.sol         # Non-upgradeable USDT custody + multi-sig
│   │   ├── script/                        # Deploy + admin scripts
│   │   └── test/                          # Foundry tests
│   ├── packages/common/src/               # Shared library — every service imports it
│   │   ├── auth.py                        # JWT encode/decode, require_onboarded
│   │   ├── chain_clients/                 # ETH/BSC/Tron USDT clients + vault verify
│   │   ├── config.py                      # Pydantic settings, env-driven
│   │   ├── corecen_trade_client.py        # External LP REST client (HMAC)
│   │   ├── database.py                    # Async SQLAlchemy engine + sessions
│   │   ├── email_templates/               # Jinja2 templates for transactional email
│   │   ├── engine_lock.py                 # NEW today — distributed leader lock
│   │   ├── insurance/                     # Per-trade micro-insurance pricing + claims
│   │   ├── instrument_pricing.py          # Spread/commission resolver
│   │   ├── instrumentation.py             # Sentry + middleware stack
│   │   ├── kafka_client.py                # No-op shim (Kafka removed)
│   │   ├── models/                        # SQLAlchemy ORM — every domain
│   │   ├── notify.py                      # In-app notifications
│   │   ├── redis_client.py                # Async Redis connection pool
│   │   └── schemas/                       # Pydantic request/response DTOs
│   ├── services/
│   │   ├── gateway/                       # FastAPI :8000 — trader-facing REST + WS
│   │   │   └── src/
│   │   │       ├── api/                   # FastAPI routers (~30 files)
│   │   │       ├── engines/               # Background tasks (9 in-process engines)
│   │   │       ├── services/              # Domain services (trading, wallet, etc.)
│   │   │       └── main.py                # FastAPI app + lifespan
│   │   ├── admin/                         # FastAPI :8001 — admin REST
│   │   │   ├── routes/                    # Admin routers (~25 files)
│   │   │   ├── services/                  # Admin-specific business logic
│   │   │   └── main.py
│   │   ├── b-book-engine/                 # Standalone matching engine
│   │   │   └── src/matching_engine.py     # 100ms pending-order + SL/TP loop
│   │   ├── risk-engine/                   # Standalone risk monitoring
│   │   │   └── src/main.py                # 5s margin + stop-out loop
│   │   └── market-data/                   # Standalone price feed ingestion
│   │       └── src/
│   │           ├── feed_handler.py        # Orchestrates feeds
│   │           ├── alltick_feed.py        # AllTick / Infoway adapter
│   │           ├── bar_aggregator.py      # Ticks → OHLCV
│   │           └── tick_store.py          # TimescaleDB writer
│   ├── infra/
│   │   ├── docker/                        # Dockerfiles + init-db.sql, init-timescale.sql
│   │   ├── migrations/versions/           # Alembic — 45 migrations
│   │   └── uploads/                       # Local filesystem upload root (mounted volume)
│   └── uploads/                           # Runtime upload directory
│
├── frontend/
│   ├── trader/                            # Next.js 15 — trader.fxartha.com + apex
│   │   └── src/
│   │       ├── app/                       # App Router pages
│   │       │   ├── dashboard/             # Home + 2s polling
│   │       │   ├── trading/terminal/      # Order panel + chart + positions
│   │       │   ├── accounts/              # Trading account list + transfer
│   │       │   ├── wallet/                # Deposit / Withdraw / Transaction history
│   │       │   ├── transactions/          # Ledger view (merged 3 endpoints)
│   │       │   ├── portfolio/             # PnL + balance trend
│   │       │   ├── social/, /pamm/        # Copy trading + PAMM
│   │       │   ├── kyc/                   # KYC upload form
│   │       │   ├── rewards/, /earn/       # Gamification (missions, XP, AC)
│   │       │   └── auth/                  # Login, signup, OAuth, SIWE
│   │       ├── components/                # UI components
│   │       │   ├── trading/               # OrderPanel, PositionsPanel, Chart
│   │       │   ├── wallet/                # WalletDepositModal, ConnectAndSend
│   │       │   ├── layout/                # AppSidebar, TopBar, MobileBottomNav
│   │       │   └── providers/             # Auth, Theme, Web3 providers
│   │       ├── stores/                    # Zustand stores (auth, trading, ui, etc.)
│   │       ├── lib/                       # API client, web3 config, formatters
│   │       └── middleware.ts              # Host-based marketing/app split
│   └── admin/                             # Next.js 15 — admin.fxartha.com
│       └── src/app/(admin)/               # Pages: users, KYC, finance, instruments
│
├── deploy/
│   ├── nginx/fxartha.conf                 # Reverse proxy + Cloudflare origin SSL
│   └── nginx/snippets/                    # Reusable security headers + rate limits
│
├── docs/
│   ├── architecture.md                    # THIS FILE
│   ├── disaster-recovery.md               # Backup + restore runbook
│   ├── fxartha-inventory.md               # Asset inventory
│   └── vault-phase1-spec.md               # On-chain vault spec
│
├── scripts/
│   ├── backup.sh                          # Daily Postgres + uploads snapshot
│   ├── install-backup-cron.sh             # Cron installer
│   └── restore.sh                         # Restore from snapshot
│
├── docker-compose.yml                     # Dev compose
├── docker-compose.prod.yml                # Prod overlay (workers=2, restart=always, 127.0.0.1 binds)
├── .env.example                           # All env vars documented
└── README.md
```

---

## 3. Feature inventory

Every major feature, in dependency order. Format:
**Feature — what it is — where it lives — how it talks to the system**.

### 3.1 Authentication & sessions
Email/password, Google OAuth, Sign-in-with-Ethereum (SIWE). HttpOnly
cookie-based JWT, 60-second `/auth/me` heartbeat refreshes presence.

- Code: [backend/services/gateway/src/api/auth.py](backend/services/gateway/src/api/auth.py), [services/wallet_auth_service.py](backend/services/gateway/src/services/wallet_auth_service.py)
- Frontend: [frontend/trader/src/app/auth/](frontend/trader/src/app/auth/), [components/providers/AuthProvider.tsx](frontend/trader/src/components/providers/AuthProvider.tsx)
- Stores in: Postgres (`users`, `user_sessions`)
- Touches: Google OIDC, SIWE nonce table

### 3.2 KYC
Document upload → admin queue → approve/reject email + status flip.

- Code: [backend/services/admin/services/kyc_service.py](backend/services/admin/services/kyc_service.py), [services/gateway/src/api/kyc.py](backend/services/gateway/src/api/kyc.py)
- Frontend: [frontend/trader/src/app/kyc/](frontend/trader/src/app/kyc/), [frontend/admin/src/app/(admin)/kyc/](frontend/admin/src/app/(admin)/kyc/)
- Stores in: Postgres (`kyc_documents`, `users.kyc_status`), filesystem `/uploads/kyc/`
- Touches: SMTP for status notifications

### 3.3 Trading accounts
Per-user multi-account (live + demo), each with leverage / balance /
equity / margin tracked separately. Internal transfers between
accounts (or main wallet ↔ account) are first-class transactions.

- Code: [services/gateway/src/services/account_service.py](backend/services/gateway/src/services/account_service.py)
- Frontend: [frontend/trader/src/app/accounts/page.tsx](frontend/trader/src/app/accounts/page.tsx) (live 2s poll)
- Stores in: Postgres (`trading_accounts`, `account_groups`)

### 3.4 Order placement + position lifecycle
Market + limit/stop orders. Margin/lot validation at submit. Position
P&L recomputed live from Redis ticks. SL/TP set at open or modified.

- Code: [services/gateway/src/services/trading_service.py](backend/services/gateway/src/services/trading_service.py), [services/b-book-engine/src/matching_engine.py](backend/services/b-book-engine/src/matching_engine.py)
- Frontend: [components/trading/OrderPanel.tsx](frontend/trader/src/components/trading/OrderPanel.tsx), [components/trading/PositionsPanel.tsx](frontend/trader/src/components/trading/PositionsPanel.tsx)
- Stores in: Postgres (`orders`, `positions`, `trade_history`, `transactions`)
- Touches: Redis (tick:{symbol}), Corecen LP (A-book forwarding)

### 3.5 SL/TP enforcement
Auto-close at SL or TP price (not market price — matches MT5 semantics).

- Code: [services/gateway/src/engines/sltp_engine.py](backend/services/gateway/src/engines/sltp_engine.py)
- Now leader-elected + row-locked (today's fix)

### 3.6 Risk monitoring
80% margin call (email), 50% stop-out (force-close all positions),
exposure aggregation per instrument.

- Code: [services/risk-engine/src/main.py](backend/services/risk-engine/src/main.py)
- Single-replica container (no dual-fire issue)

### 3.7 Price feed
AllTick / Infoway WebSocket primary, Binance crypto fallback, Corecen
push for A-book. Spread widening, stale-tick refresh every 90s,
TimescaleDB persistence + Redis pub/sub.

- Code: [services/market-data/src/](backend/services/market-data/src/)
- Stores in: Redis (`tick:{symbol}`), TimescaleDB (`ticks`, `ohlcv_*`)

### 3.8 Deposits
- **Manual bank/UPI** — removed (commit 8909a42)
- **NOWPayments hosted invoice** — Mode B, redirects to nowpayments.io
- **NOWPayments direct (wallet-connect)** — Mode A, on-site QR + address
- **On-chain USDT vault** — direct to FXArthaVaultV1 on BSC, no processor

All settle via IPN webhook → `/api/v1/webhooks/nowpayments|oxapay|onchain`
→ HMAC verify → idempotency dedup → credit `users.main_wallet_balance`.

- Code: [services/gateway/src/services/wallet_service.py](backend/services/gateway/src/services/wallet_service.py), [services/nowpayments_service.py](backend/services/gateway/src/services/nowpayments_service.py), [engines/chain_verifier_engine.py](backend/services/gateway/src/engines/chain_verifier_engine.py)
- Frontend: [components/wallet/WalletDepositModal.tsx](frontend/trader/src/components/wallet/WalletDepositModal.tsx)

### 3.9 Withdrawals
Manual flow only. User submits → balance frozen → admin reviews →
approve → admin sends funds off-platform → click "Mark Paid" with tx
hash → status="paid" + audit email to user.

- Code: [services/admin/services/deposit_service.py](backend/services/admin/services/deposit_service.py), [services/gateway/src/services/onchain_withdraw_service.py](backend/services/gateway/src/services/onchain_withdraw_service.py)
- Frontend: [frontend/admin/src/app/(admin)/deposits/page.tsx](frontend/admin/src/app/(admin)/deposits/page.tsx)

### 3.10 Internal transfers
Main wallet ↔ trading account, account ↔ account. Two Transaction
rows per transfer (debit + credit).

- Code: `wallet_service.transfer_*` family in [services/gateway/src/services/wallet_service.py](backend/services/gateway/src/services/wallet_service.py)

### 3.11 Copy trading + PAMM + MAM
Master accounts publish trades; followers mirror at configured copy
ratio. PAMM/MAM pools split P&L pro-rata; daily management fee debit
+ master credit.

- Code: [services/gateway/src/engines/copy_engine.py](backend/services/gateway/src/engines/copy_engine.py), [services/social_service.py](backend/services/gateway/src/services/social_service.py)
- Stores in: Postgres (`master_accounts`, `investor_allocations`, `copy_trades`)

### 3.12 IB / MLM commission
Trade volume → walk referral chain → distribute % per MLM level.

- Code: [services/gateway/src/engines/ib_engine.py](backend/services/gateway/src/engines/ib_engine.py) — called inline from trade close

### 3.13 Gamification — XP, AC, missions, daily login
Trade volume + missions + daily login + Spin & Win. XP is progression;
AC (Artha Coin) is redeemable.

- Code: [services/gateway/src/services/rewards_service.py](backend/services/gateway/src/services/rewards_service.py), [play_zone_service.py](backend/services/gateway/src/services/play_zone_service.py)

### 3.14 Staking
Lock funds for fixed-term APY. Daily accrual writes
`staking_reward_accruals` with unique constraint for idempotency.
Weekly digest email.

- Code: [services/gateway/src/services/staking_service.py](backend/services/gateway/src/services/staking_service.py), [engines/staking_engine.py](backend/services/gateway/src/engines/staking_engine.py)

### 3.15 Trade insurance
Per-trade micro-insurance — user opts in at order placement, pool
pays out on loss subject to per-policy cap.

- Code: [packages/common/src/insurance/](backend/packages/common/src/insurance/)

### 3.16 Bonus offers
Admin creates offers (% or fixed). Auto-applied on deposit. Locked
until trade volume meets wagering requirement, then released to
main wallet with `bonus_release` Transaction (today's fix).

- Code: [services/wallet_service.create_*_deposit](backend/services/gateway/src/services/wallet_service.py), [services/wallet_service.release_bonuses_after_trade](backend/services/gateway/src/services/wallet_service.py)
- Admin: [services/admin/services/bonus_service.py](backend/services/admin/services/bonus_service.py)

### 3.17 Notifications + email
In-app via Postgres `notifications` + WebSocket fan-out. Email via
fire-and-forget SMTP (transactional via Jinja2 templates).

- Code: [packages/common/src/notify.py](backend/packages/common/src/notify.py), [smtp_mail.py](backend/packages/common/src/smtp_mail.py), [email_templates/](backend/packages/common/src/email_templates/)

### 3.18 Admin panel
30+ pages: users, KYC, finance (deposits/withdrawals), instruments,
spread/commission config, bonus offers, banners, employees / RBAC,
audit logs, analytics.

- Code: [backend/services/admin/](backend/services/admin/), [frontend/admin/](frontend/admin/)

### 3.19 Marketing site
Apex (fxartha.com) hero, products, education, company pages. Hosted
from the same Next.js app as the trader (middleware splits by Host).

- Code: [frontend/trader/src/app/(landing)/](frontend/trader/src/app/\(landing\)/)

---

## 4. Scalability — when does each thing break

Three tiers:

### OK for now (good up to 1k+ concurrent users)

| Component | Design | First bottleneck | Scale at breakage |
|---|---|---|---|
| Gateway HTTP | FastAPI + uvicorn --workers 2, pool_size=20 | Worker saturation under polling | 2-3k concurrent users |
| WebSocket | In-memory dict, direct send per conn | Memory bloat per connection | 10k concurrent WS |
| Background engines | 9 in-process, now leader-locked | Crash of one worker pauses engines briefly | 1k users |
| B-book matching | 100ms polling | Loop time grows with order count | 50k pending orders |
| Risk engine | 5s polling all open positions | Full scan + N+1 per account | 20k active accounts |
| Market data | Tick → Redis + Timescale write | Write throughput | 10k ticks/s or 200 symbols |
| Trader frontend | 2s polling /accounts, /prices | Request stampede on dashboard | 5k concurrent users |
| Admin frontend | Paginated lists | Large result-set scans | 1M+ rows in admin queries |

### Watch this (will need attention at 10k-50k users)

| Component | Design | First bottleneck | Scale at breakage |
|---|---|---|---|
| Postgres | Single instance, pool 20+10 | Connection pool exhaustion + lock contention | 50k users / 500k positions |
| TimescaleDB | Single, hypertables compressed | Write throughput on hypertable inserts | 10k ticks/s |
| Redis | Single, 256MB max-memory | LRU evicts active price ticks | 100k concurrent users (memory) |
| Migrations | Alembic, runs on startup | Long DDL locks tables | 50M+ row tables |

### Already a problem (act now)

| Component | Design | First bottleneck | Why act now |
|---|---|---|---|
| **File uploads** | Local FS, no GC | Unbounded disk growth | 10k users × 5 KYC docs = 50GB+ |
| **NOWPayments deposits** | Synchronous, no queue | API rate limits | 100+ deposits/day |
| **Chain verifier** | Etherscan polling every 30s | Etherscan free-tier rate limit | 3k+ pending deposits |
| **Email delivery** | fire_and_forget SMTP | Thread pool saturation, no retry | 100+ concurrent signups |
| **Marketing/trading shared deploy** | One Next.js for both | Outage hits both at once | Now |

---

## 5. Security — vulnerabilities and mitigations

### High severity (fix soon)

| # | Issue | Where | What to do |
|---|---|---|---|
| 1 | `JWT_SECRET` has a default value `"dev-secret-change-in-production"` | [config.py:18](backend/packages/common/src/config.py#L18) | Remove default; force env-loaded secret; fail-fast at boot |
| 2 | SIWE nonce race window between consume and signature verify | [wallet_auth_service.py:270-294](backend/services/gateway/src/services/wallet_auth_service.py#L270) | Verify signature before atomic UPDATE; or add Redis lock |
| 3 | Rate-limit config is sky-high (`1000000/minute`), effectively disabled | [config.py:106-111](backend/packages/common/src/config.py#L106) | Set realistic per-endpoint limits; document custom `rate_limit_http()` |
| 4 | OxaPay HMAC verifier doesn't fail if `MERCHANT_KEY` empty | [oxapay_service.py:105-110](backend/services/gateway/src/services/oxapay_service.py#L105) | Guard `if not key: raise` like nowpayments_service does |
| 5 | On-chain withdrawal `destination_address` not server-locked to user.wallet_address | [onchain_withdraw_service.py](backend/services/gateway/src/services/onchain_withdraw_service.py) | Ignore client-supplied address; always use linked wallet |
| 6 | Plaintext admin password in committed `.env` | `.env:104-105` | Remove from repo; rotate; use secret manager |
| 7 | Balance reads don't use `SELECT … FOR UPDATE` in all paths | [wallet_service.py:1026-1034](backend/services/gateway/src/services/wallet_service.py#L1026) | Use `with_for_update()` on every balance write path |
| 8 | Withdrawal endpoint lacks idempotency key handling | [api/deposits.py:221-229](backend/services/gateway/src/api/deposits.py#L221) | Mirror the deposit endpoint pattern |

### Medium severity (address in next sprint)

- JWT `type` claim not enforced across trader/admin tokens — possible scope crossover if a secret leaks
- Negative `lots` allowed in order placement schema (Pydantic Decimal accepts negatives)
- Kafka `produce_event` is a no-op — silently drops audit-trail signals
- Admin `write_audit_log` only flushes, not commits — possible audit-row loss
- CORS origins include localhost in committed `.env`
- Sentry DSN handling needs explicit rotation policy

### Low severity (good hygiene)

- WebSocket falls back to `?token=` query param (legacy) — query strings appear in logs
- File-upload magic-byte check is only first 32 bytes (polyglot-vulnerable)
- Password-reset tokens may lack explicit TTL
- 500-error responses return `f"{type(e).__name__}: {e}"` to clients — info leak

### What's already in place (defenses)

- bcrypt for passwords; `hmac.compare_digest` for webhook verification
- HttpOnly + Secure + SameSite cookies on auth
- Per-deposit Redis SETNX for chain verifier (no double-credit)
- Per-user-per-month SETNX for monthly statements
- HMAC-signed Corecen requests
- Cloudflare Origin SSL + HSTS + strict CSP at nginx layer
- Containers run as unprivileged user (UID 1001)
- Postgres/Redis bound to 127.0.0.1, not 0.0.0.0, in prod compose
- Multi-sig admin on FXArthaVaultV1 (non-upgradeable)
- IPN dedup via `(provider, external_id, status)` UNIQUE constraint
- 2-fold defense for SL/TP closes (leader lock + SKIP LOCKED row lock)

---

## 6. Safety nets

Beyond per-feature defenses, system-wide:

- **Daily backups** — Postgres + TimescaleDB + uploads to `/opt/fxartha/backups`, optional rclone offsite (B2/R2/S3/DO). [scripts/backup.sh](scripts/backup.sh)
- **Disaster recovery** — rebuild from blank VPS in ~30 min. [docs/disaster-recovery.md](docs/disaster-recovery.md)
- **Idempotency cache** — `(scope, user_id, Idempotency-Key)` table prevents network-retry duplicate orders/deposits
- **WebhookEvent dedup** — `(provider, external_id, status)` unique constraint on `webhook_events`
- **Distributed engine locks** — Redis-based leader election, fail-closed
- **Row-level locks** — `SELECT … FOR UPDATE` + `SKIP LOCKED` on hot tables
- **Maintenance mode** — global flag pauses deposits/withdrawals/trades
- **Audit log** — `user_audit_logs` + `admin_audit_logs` row per privileged action
- **Demo accounts** — guarded against funding crossover from live accounts

---

## 7. Data model summary

The Postgres `models/` package mirrors the domain:

```
users/         User, UserSession, UserAuditLog, KYCDocument, Employee
trading/       TradingAccount, Order, Position, TradeHistory, AccountGroup
instruments/   Instrument, InstrumentConfig, InstrumentSegment, ChargeConfig, SpreadConfig, SwapConfig
wallet/        Deposit, Withdrawal, Transaction, BankAccount, WebhookEvent, AdminDepositWallet
social/        MasterAccount, InvestorAllocation, CopyTrade, MasterStrategy, SharedTrade
business/      IBProfile, Referral, IBCommission, IBCommissionPlan
gamification/  RewardsUserState, Mission, MissionProgress, StakingPool, StakingPosition,
               PlayZoneContest, LotteryRound, BiddingRound, SpinWheelEvent
system/        BonusOffer, UserBonus, Banner, Notification, SystemSetting
insurance/     InsurancePolicy, InsuranceClaim, InsurancePool
vip/           VipPass (stub — feature-flagged off)
share/         ShareCard
support/       SupportTicket
```

TimescaleDB:
```
ticks           hypertable (symbol, time DESC) — bid/ask per tick
ohlcv_1m..1w    hypertables — bucketed candles
```

---

## 8. What was fixed in the last 48 hours

Recent commits worth knowing about (`git log --oneline -20`):

```
884340b  fix(engines): dedup all gateway background engines under --workers N
1ab7ca1  fix(sltp): dedup TP/SL closes (SKIP LOCKED + status guard)
6581943  perf(trader): kill the RSC prefetch flood + duplicate /unread-count
6931bd6  feat(deposit): show fee preview before submitting NowPayments invoice
084e385  feat(withdrawals): manual payout workflow — wallet address + network + Mark Paid
2e804f2  fix(dashboard): live Total Balance / Open P/L / account card / movers (2s poll)
47e94f6  fix(accounts): live P&L on /accounts page (2s background poll)
c52719f  feat(bonuses): wire bonus release pipeline + audit row on trade close
e0af593  chore(wallet): hide VIP card + duplicate Withdrawable Balance card
887cce9  feat(deposits): NOWPayments hosted-invoice fallback (Mode B)
f6d2499  fix(trading): /trading auto-redirects when user has 0 live accounts
ea0912b  fix(dashboard): Trade Now button bypasses the empty /trading picker
3d8471e  feat(ui): trade Buy button + side pills to blue (#2962FF)
```

Database cleanup also done: 3 duplicate `trade_history` rows from the
pre-fix SL/TP race were deleted manually after verification.

---

## 9. Priority roadmap

If you have one week and want to make the platform genuinely
production-ready, in order:

### Week 1 — critical security & data integrity
1. Force `JWT_SECRET` to env-only (remove default) — security #1
2. Fix on-chain withdrawal destination lock — security #5
3. Backfill missing `Transaction` rows for past trade closes (data integrity gap noted earlier)
4. Migrate file uploads to S3-compatible storage — scalability #13
5. Rotate admin password; remove from committed `.env`

### Week 2 — operational hardening
6. Add idempotency-key handling to `/withdraw` — security #8
7. Real per-endpoint rate limits (auth, withdraw, deposit-create) — security #3
8. SIWE nonce race fix — security #2
9. Email delivery → transactional provider (Resend/Postmark/SES) with queue — scalability #16
10. Add proper schema for negative-amount rejection on order placement

### Week 3 — architecture cleanup
11. Split marketing site from trader app (separate Next.js apps) — scalability #17
12. Move 9 in-process engines into a dedicated single-replica container
13. Either fully remove Kafka shim or wire Redis Streams behind it
14. Cleanup the trade_history vs transactions audit-trail gap (backfill or eliminate)

### Later — performance scaling
15. Postgres read replica + index audit
16. Migrate hot endpoints (`/accounts`, `/instruments/prices/all`) to Redis-cached responses
17. Event-driven trading engines (Postgres LISTEN/NOTIFY or Redis Streams) replace polling
18. Increase Redis max-memory to 1-2GB

---

## 10. Operational runbook

### Deploy
```bash
cd /opt/fxartha
git pull --ff-only
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build <service>
```

`<service>` = `gateway`, `admin-api`, `trader-frontend`, `admin-frontend`,
`market-data`, `b-book-engine`, `risk-engine`, or omit to rebuild all.

### Health check
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
curl -sf http://127.0.0.1:8002/health  # gateway
curl -sf http://127.0.0.1:8003/health  # admin-api
```

### Logs
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f --tail=100 gateway
```

### Database access
```bash
docker exec -it fxartha-postgres-1 psql -U fxartha -d fxartha
docker exec -it fxartha-timescaledb-1 psql -U fxartha -d fxartha_timeseries
```

### Backups
```bash
./scripts/backup.sh             # manual snapshot
./scripts/restore.sh <pg.gz> <uploads.tar.gz>
```

---

*Document version 1.0 — 2026-05-12. Update whenever a feature lands.*
