# Ezymex — Cloud Scale Blueprint (target: 10M registered users)

Status: design + the code-level prerequisites shipped in the Section F
hardening (wave 1). Object storage (S3) is wave 2.

## 1. Sizing assumptions

| Metric | Planning number | Notes |
|---|---|---|
| Registered users | 10,000,000 | |
| Daily active | 5% → 500k | |
| Peak concurrent sessions | 1% → 100k | each trader tab opens up to 3 WebSockets (prices, bars, trades) |
| Peak WebSockets | ~250k | per-user cap `WS_MAX_PER_USER` (cluster-wide, Redis leases) |
| Price ticks published | 500–3,000 / s | fan-out cost is per **process**, not per socket (pub/sub hub) |
| Orders + closes | 500 / s peak | money paths are row-locked; write volume dominated by `positions`, `trade_history`, `transactions` |
| REST API | 20–50k req/s peak | `/instruments/prices/all` polling dominates; served from one HGETALL |

## 2. Topology

```
                 Cloudflare (WAF, bot mgmt, CF-Connecting-IP)
                                │
                     L7 load balancer (TLS, sticky-less)
          ┌─────────────────────┼──────────────────────────┐
          │                     │                          │
   api tier (stateless)   ws tier (stateless)       admin tier
   gateway, RUN_ENGINES   gateway, RUN_ENGINES      admin-api
   =false, HPA on CPU/p95 =false, HPA on sockets    (private network /
          │                     │                    VPN / IP allow-list)
          └──────────┬──────────┴─────────┬───────────────┘
                     │                    │
              PgBouncer (txn pool)   Redis "core"   Redis "pubsub"
                     │               (cache, locks,  (ticks, account
            Managed Postgres         rate limits,    events, config
            primary + read replica   leases)         busts)
                     │                    ▲               ▲
             engine tier (RUN_ENGINES=true, 2 replicas,   │
             every engine leader-locked) ─────────────────┤
                                                          │
             market-data (1 active + 1 standby, publish_price pipelined)
                     │
             S3 (KYC, deposit proofs, banners)  ← wave 2
             Outbox queue (SQS / Redis Streams) ← emails, push, LP forwarding
```

### 2.1 Tiers

* **api** — `uvicorn services.gateway.src.main:app` with `RUN_ENGINES=false`.
  Pure request/response; any replica serves any user (no in-process session
  state; auth is JWT + server-side session check).
* **ws** — same image, `RUN_ENGINES=false`, behind a WebSocket-aware LB route
  (`/ws/*`). Each process holds **one** Redis pub/sub connection
  (`packages/common/src/pubsub_hub.py`), fans messages into per-socket buffers,
  coalesces ticks to ~20 fps and closes slow consumers with **1013**. Scale on
  open sockets (≈ 10–20k sockets per 2-vCPU pod).
* **engine** — same image, `RUN_ENGINES=true`, 2 replicas for availability.
  Every engine (SL/TP, copy, overnight fee, statements, KYC reminders, bars
  persist, reconcile, AI strategies, trade-history healer, stats, chain
  verifier) takes a renewing, sticky, fenced lease (`engine_lock` v2) — only
  one replica runs each engine; failover happens within the lease TTL (or
  immediately on graceful shutdown via `release_all()`).
* **market-data** — one active feed process; `publish_price` writes tick +
  last price + `ticks:latest` hash + two PUBLISHes in one pipelined round trip.
* **admin** — separate deployment, not internet-exposed (VPN / IdP proxy).
* **risk-engine / b-book-engine** — separate services; keep them single-active
  (leader lock) until they are partitioned by account range.

Single-host today: the defaults (`RUN_ENGINES=true`, 2 uvicorn workers)
reproduce the current behaviour; the leader locks make the 2 workers safe.

## 3. Data layer

### 3.1 Postgres (managed: RDS / Cloud SQL / Azure Flexible Server)

* Primary + 1 synchronous-ish standby (HA) + 1 async **read replica** for
  admin analytics / exports / statements (route via a second DSN when added).
* **PgBouncer** in transaction mode in front of the primary. Set
  `DB_PGBOUNCER=true` → asyncpg statement cache off + unique prepared
  statement names; statement / idle-in-transaction timeouts must then be set
  on the DB role (`ALTER ROLE app SET statement_timeout = '30s'`), not as
  startup parameters.
* Pool sizing per process: `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` /
  `DB_POOL_TIMEOUT` / `DB_POOL_RECYCLE`. Rule of thumb with PgBouncer:
  `sum(pods × workers × (pool+overflow)) ≤ pgbouncer max_client_conn`,
  and PgBouncer `default_pool_size` ≈ 2–4 × primary vCPUs.
* API sessions: `DB_STATEMENT_TIMEOUT_MS=30000`,
  `DB_IDLE_IN_TX_TIMEOUT_MS=60000` (0 = off, today's default). Engines use
  `WorkerSessionLocal`, which never carries the statement cap.
* Timescale (market-data history) engine is created lazily — API pods that
  never touch it hold no second pool.
* Migrations are the only DDL path (no DDL at process boot; 0076 moved the
  last boot-time ALTER/UPDATEs). Indexes are created `CONCURRENTLY` in
  autocommit blocks; UNIQUE indexes check for duplicates first and warn.
* Growth: partition `trade_history`, `transactions`, `notifications`,
  `user_audit_logs` by month (native range partitioning) before ~500M rows;
  archive closed months to S3/Parquet. `ohlc_bars` → Timescale hypertable.

### 3.2 Redis (split by role)

| Instance | Holds | Eviction | Notes |
|---|---|---|---|
| core | `tick:*`, `last_price:*`, `ticks:latest`, `bars:*`, settings cache, rate-limit windows, engine leases, WS leases, idempotency helpers | `volatile-lru` | Multi-AZ, AOF on; locks + leases must not be evicted → give them no TTL-less pressure |
| pubsub | `prices`, `prices:{sym}`, `account:{id}`, `admin:*`, `bars:updates`, `config:*` | none (no data) | `REDIS_PUBSUB_URL`; isolates fan-out bandwidth from cache latency |

* Command pool: bounded `BlockingConnectionPool` (`REDIS_MAX_CONNECTIONS`,
  `REDIS_POOL_TIMEOUT`); pub/sub uses its own pool so long-lived subscriptions
  never starve commands.
* No keyspace `SCAN` on request paths: prices come from `ticks:latest`, bar
  lists from the `bars:index` set.
* Rate limits are Redis-authoritative (one Lua sliding window, wall-clock);
  the local bucket is only a Redis-outage fallback.

### 3.3 Object storage (wave 2)

S3 (or GCS / Azure Blob) for KYC documents, deposit proofs, payout QRs and
banners: private bucket, SSE-KMS, keys (not absolute paths) stored in the DB,
served through the API with the existing authorization (owner-scoped keys,
short-lived signed URLs), magic-byte validation on upload, lifecycle rules for
retention. Until then the `uploads` volume must be shared (EFS/Filestore) if
more than one api replica handles uploads.

### 3.4 Outbox queue

Side effects that must not be lost or duplicated — emails, push
notifications, A-book trade forwarding to the LP, webhooks to partners — are
written to an `outbox` table **in the same transaction** as the business
change, then relayed by an engine-tier worker to SQS / Redis Streams with an
idempotency key. Replaces today's fire-and-forget tasks (which die with the
pod) and gives retries + DLQ.

## 4. Correctness at N replicas (implemented in wave 1)

* **Leader leases** (`engine_lock` v2): renewing, sticky, fencing counter,
  fail-closed on Redis loss, in-process double-run guard.
* **Copy engine**: no in-memory snapshot; reconciles open master positions
  against `copy_trades` in ANY status (unique
  `(master_position_id, investor_allocation_id)`); skipped pairs recorded in
  Redis; lock order position → users (asc) → accounts (asc) on fee closes.
* **Overnight fee**: keyset batches, account lock → positions
  `FOR UPDATE SKIP LOCKED`, `last_swap_at` re-checked on the locked row.
* **Monthly statements**: keyset batches of 1000, one session per batch,
  durable `users.last_statement_month` claim committed before sending.
* **KYC reminders**: cohort/stage filter in SQL, `SKIP LOCKED`.
* **Idempotency-Key**: claim-first INSERT … ON CONFLICT; concurrent duplicate
  → 409; finished duplicate → replay.
* **Trade-history healer**: leader-locked, `FOR UPDATE SKIP LOCKED`,
  `ON CONFLICT DO NOTHING`; deliberately no unique index on
  `trade_history(position_id)` (partial closes).
* **WebSocket caps**: cluster-wide per-user leases (sorted set, renewed by the
  ping loop, auto-expire on crash).
* **Caches**: `settings_store` (2 s in-process + negative caching + pub/sub
  bust), instrument list / market status / trading catalog (`cache.TTLCache`,
  busted on `config:instruments:reload`), price cache re-reads Redis when an
  entry is stale.

## 5. Security controls

* Edge: Cloudflare WAF + bot management + rate rules on `/auth/*`,
  `/wallet/*`; `TRUSTED_PROXY_CIDRS` limited to the LB/ingress ranges so
  `X-Forwarded-For` can't be spoofed; HSTS, TLS 1.2+.
* Network: private subnets for all data stores; admin tier reachable only via
  VPN / IdP-aware proxy; security groups per tier (api/ws → PgBouncer + Redis;
  engine → also outbound LP/SMTP/chain RPC; nothing inbound to engines).
* Secrets: cloud secret manager (no `.env` on disk); separate JWT secrets for
  trader / admin (boot refuses equal secrets in production); KMS-encrypted
  RDS, Redis AUTH + TLS, S3 SSE-KMS; key rotation runbooks.
* AuthN/Z: short-lived access JWT + server-side session check on REST **and**
  WebSocket handshakes (revoked / sid-less / hand-off tokens refused);
  step-up for withdrawals; RBAC with per-section allow-lists for white-label
  brokers; impersonation sessions read-only for money/credentials.
* Money integrity: Decimal everywhere, canonical lock order (user → accounts
  ascending), ledger idempotency keys, `CHECK (main_wallet_balance >= 0)`.
* Observability: Sentry with PII/secret scrubbing; structured logs to a central
  store; metrics (Prometheus/OpenTelemetry): request p95/p99, pool wait time,
  Redis pool wait, engine lease holder + fence, WS sockets per pod, slow-
  consumer closes (1013), hub messages/s, outbox lag.
* Backups: managed PITR (≥ 14 days) + encrypted logical dumps off-account;
  quarterly restore drills. Redis is a cache/lock store — no backup needed
  beyond AOF for faster warm-up.
* DDoS / abuse: per-user WS cap, per-IP + per-user REST limits, request size
  limit, Idempotency-Key on money POSTs.

## 6. Configuration reference (Section F)

| Variable | Default (today's behaviour) | Recommended at scale |
|---|---|---|
| `RUN_ENGINES` | `true` | `false` on api/ws, `true` on engine tier |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | 20 / 10 | 5 / 5 per worker behind PgBouncer |
| `DB_POOL_TIMEOUT` / `DB_POOL_RECYCLE` | 30 / 1800 | 10 / 1800 |
| `DB_STATEMENT_TIMEOUT_MS` | 0 (off) | 30000 |
| `DB_IDLE_IN_TX_TIMEOUT_MS` | 0 (off) | 60000 |
| `DB_PGBOUNCER` | `false` | `true` |
| `TIMESCALE_POOL_SIZE` / `_MAX_OVERFLOW` | 10 / 5 | 5 / 5 |
| `REDIS_MAX_CONNECTIONS` / `REDIS_POOL_TIMEOUT` | 50 / 5 s | 100 / 2 s |
| `REDIS_PUBSUB_URL` | same as `REDIS_URL` | dedicated pub/sub Redis |
| `REDIS_PUBSUB_MAX_CONNECTIONS` | 50 | 20 |
| `WS_MAX_PER_USER` | 20 (≈ old 10 per worker × 2) | 10–20 |
| `WS_LEASE_TTL_SEC` | 90 | 90 |
| `WS_SEND_QUEUE_MAX` | 1000 | 1000 |
| `PRICE_CACHE_STALE_SEC` | 5 | 5 |

## 7. Rollout order

1. Deploy wave 1 on the current host (defaults = current behaviour); run
   migration 0076 (indexes build `CONCURRENTLY`; watch for the copy_trades
   duplicate WARNING).
2. Move Postgres to the managed service + PgBouncer (`DB_PGBOUNCER=true`,
   role-level timeouts).
3. Split Redis (core / pubsub).
4. Split tiers: api (`RUN_ENGINES=false`) + ws + engine (2 replicas).
5. Wave 2: S3 storage + outbox relay; then read replica routing for admin
   analytics and statements.
6. Partition the append-only tables before they reach ~500M rows.
