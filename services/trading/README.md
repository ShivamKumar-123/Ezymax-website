# trading

The Kalks trading engine: trading accounts, orders and positions (netting and hedging, cent), margin, margin call and stop-out, swaps, the double-entry ledger for balance / credit / bonus, wallet transfers, and the Back Office dealing desk. It is a Rust service (axum 0.8, sqlx 0.9, PostgreSQL) on `127.0.0.1:8090`.

The engine executes B-book only. A/B routing is decided and recorded on every ticket. A-book trades are passed to an LP adapter, which is a stub until an LP is signed (D2, D25).

- [Run locally](#run-locally)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Trading rules](#trading-rules)
- [API conventions](#api-conventions)
- [Terminal API](#terminal-api)
- [Client Area API](#client-area-api)
- [Wallet transfers](#wallet-transfers)
- [Dealing desk API](#dealing-desk-api)
- [Admin account API](#admin-account-api)
- [Copy trading and PAMM](#copy-trading-and-pamm)
- [MAM (multi-account manager)](#mam-multi-account-manager)
- [Streams](#streams)
- [How the apps integrate](#how-the-apps-integrate)
- [Environment](#environment)
- [Tests](#tests)
- [Known gaps](#known-gaps)

## Run locally

Before you start, you need PostgreSQL 16 on `127.0.0.1:5433` (user `postgres`, trust auth) and market-data on `:8081`. The repo-root README shows how to start both.

```bash
export PATH="$HOME/.cargo/bin:$PATH"
cargo build -p trading
# background, logs as JSON lines
(cd services/trading && nohup ../../target/debug/trading > ~/.kalks-local/trading.log 2>&1 &)
curl -s localhost:8090/health
cargo test -p trading
```

On first start the engine creates the `kalks_trading` database and runs `migrations/`. It reads `TRADING_*` from the repo-root `.env.local`. `TRADING_SESSION_SECRET` and `TRADING_INTERNAL_TOKEN` are generated there and are never committed.

## Architecture

```
            market-data :8081 ──WS /v1/stream?group=standard|pro|ecn|cent (group spread applied)
                     │
               feed (1 socket per spread group) ── QuoteBook (spread group, symbol) → bid/ask
                     │ tick
   ┌─────────────────┼──────────────────────────┐
 shard 0          shard 1   …               shard N-1      (TRADING_SHARDS, default 8; login % N)
 single writer    single writer             single writer
 accounts in memory (AccountState)
   │  command = closure over (Tx, Env)  →  events
   │  commit: events + projections + ledger + audit rows in ONE Postgres transaction
   │  then swap the new state in, publish stream frames, call the LP hook for A-book fills
   ▼
 PostgreSQL kalks_trading: events (source of truth) + projections
```

- **Single writer per account.** Every request for an account is sent to that account's shard task as a closure. The shard runs it against a copy of the state (`engine::Tx`). It commits the resulting events in one database transaction and only then replaces the in-memory state. If the commit fails, memory stays unchanged. Commands are served before price ticks.
- **Event sourced.** `events` holds one ordered stream per trading account. `AccountState::apply` is the only code that changes state, and it runs both live and during replay. Events carry every computed value (fill prices, P&L, ledger legs, ids), so replay needs no market data. On start, every stream is replayed. The engine then compares the rebuilt balances with the ledger projection (`ledger_accounts`) and checks that every ledger transaction balances. It refuses to start on any mismatch.
- **Pure engine core.** `src/engine/` (trade, risk, funds, dealing) does no IO. It reads an `Env` (specs, tenant config, group, quotes, clock, id allocator) and emits events.
- **Price feed (decision).** The engine opens one WebSocket per spread group to market-data (`/v1/stream?group=<spread_group>`), subscribed to every symbol. market-data already applies each group's markup (`/v1/admin/spreads`). The engine therefore fills at exactly the bid/ask the client sees in the terminal and on charts. There is one source of truth for markups, edited in the Back Office, and markup logic is never duplicated in two services. The alternative was one raw feed plus a copy of the markups read with `MARKET_DATA_ADMIN_TOKEN`. That would have needed a second copy of the spread maths and could drift from what clients see. A new spread group gets its socket within 5 s. Each tick goes to the shards, and a shard evaluates only accounts that have a position or pending order on that (spread group, symbol).
- **Dealer markup.** The per-account dealer markup (`markupPips`) is added by the engine on top of the group quote. Split half on the bid, half on the ask.

Source layout:

| Path | |
|---|---|
| `src/specs.rs` | contract specs from `config/instruments.json` + `config/trading-specs.json`, sessions, server time (GMT+2/+3), rollover instants |
| `src/model.rs`, `src/state.rs` | domain types, events, `AccountState::apply` / replay |
| `src/engine/` | pure decision logic (`trade`, `risk`, `funds`, `dealing`), P&L / margin / metrics |
| `src/rules.rs` | groups, tenant policy, symbol controls, A/B routing rules |
| `src/persist.rs` | migrations, replay, one-transaction commit of events + projections + ledger + audit |
| `src/shard.rs` | shard tasks, `Hub` handle, stream fan-out, LP adapter trait (`NullLp`) |
| `src/feed.rs` | market-data sockets, `QuoteBook` |
| `src/api/` | HTTP handlers (`terminal`, `accounts`, `ledger`, `dealing`, `admin`, `stream`) |
| `src/views.rs` | JSON views (terminal and Back Office shapes) |
| `src/social/` | copy trading and PAMM: `math` (sizing, HWM fees, NAV, statistics), `mirror` (follower side of a master event), `copier` (event tap, catch-up, guard, scheduler), `pamm`, `stats`, `wallet` (client + outbox) |
| `src/api/social.rs`, `src/api/social_admin.rs` | Client Area and Back Office social routes |

## Data model

Database `kalks_trading` (`migrations/0001_trading.sql`). Every table has `tenant_id` and an RLS policy on `current_setting('kalks.tenant_id')`. The engine connects as the table owner and filters by tenant itself. The policies protect every other database role.

| Table | Kind | Contents |
|---|---|---|
| `events` | source of truth, append-only | `(login, version)` unique; `kind`, `actor` (`client`, `user:<id>`, `staff:<id>`, `wallet`, `system`), `payload` (the event JSON) |
| `accounts` | projection | login, tenant, user_id, kind, group, mode, cent, currency (USD/USC), leverage, status, dealer controls, demo config, balance/credit/bonus, version, `last_activity_at` |
| `account_credentials` | auth | argon2id trading + investor hashes, lockout counters (not in the event stream) |
| `orders` | projection | every pending order and its outcome (`pending`, `filled`, `cancelled`, `expired`, `rejected`) |
| `positions` | projection | open / closed / voided positions, full JSON in `data` (route history, book carry, trailing) |
| `deals` | projection | entry (`in`) and exit (`out`, `out_by`) deals with profit, swap, commission, reason, book, ledger txn, and the position snapshot for "reopen" |
| `ledger_txns` / `ledger_postings` | projection, append-only | double entry. `UNIQUE (tenant_id, idempotency_key)`. A deferred constraint trigger rejects any transaction whose postings do not sum to 0 per currency |
| `ledger_accounts` | projection | running balance per ledger account (`acct:<login>:balance|credit|bonus`, `house:<name>:<ccy>`) |
| `audit_log` | append-only | dealing and account-ops audit (staff, action, tickets, before/after, reason code, note, flags) |
| `groups`, `tenant_policies`, `symbol_controls`, `routing_rules` | config | edited through the dealing/admin API, every change audited |
| `rollovers` | ops | swap rollovers done per day (catch-up after downtime) |
| `terminal_sessions`, `sso_tokens` | auth | HMAC-SHA256 hashes of opaque tokens only |

Ledger accounts and legs (amounts in the account currency; cent accounts use USC = USD × 100):

| Transaction | Legs |
|---|---|
| wallet → account (`transfer_in`) | `acct:L:balance +X` · `house:wallet_clearing:USD −X` (cent: `+100X USC` on the account, `house:fx:USC −100X`, `house:fx:USD +X`, `house:wallet_clearing:USD −X`) |
| account → wallet (`transfer_out`) | the reverse |
| close (`trade_pnl`) | `acct:L:balance +(profit+swap)` · `house:trading_pnl −profit` · `house:swap −swap` |
| commission | `acct:L:balance −c` · `house:commission +c` |
| staff deposit / withdrawal / adjustment | `acct:L:balance ±x` · `house:external` / `house:adjustments` |
| credit / bonus | `acct:L:credit|bonus ±x` · `house:credit_issued|bonus_issued` |
| negative balance protection (`nbp`) | `acct:L:balance +|neg|` · `house:nbp −|neg|` |
| demo funding / refill | `acct:L:balance +x` · `house:demo_funding −x` |
| reopen deal / void (`reversal`) | exact negation of the original legs |

Balance = Σ postings on `acct:L:balance`. Every transaction sums to 0 per currency; this is enforced by the engine, the tests, and the database trigger.

Ids: logins are 8 digits (live 10 000 001+, demo 50 000 001+). Order and position tickets share one sequence from 1 000 001. A position takes the ticket of the order that opened it (MT5 convention). Deals count from 2 000 001.

## Trading rules

| Area | Rule |
|---|---|
| Money | `rust_decimal` everywhere. Balances are rounded to 0.01 of the account currency, half away from zero. JSON floats are converted through their shortest decimal text |
| Fills | Buy at ask, sell at bid, from the account's spread-group quote (+ dealer markup). Limit orders fill at the market once reached (never worse than the limit). Stops fill at the market |
| Order types | market, limit, stop, stop-limit (stop triggers → limit at `stopLimit`). Expiry `GTC`, `Today` (next 00:00 server time) or a date. Server-side trailing stop. OCO pairs (`ocoWith`: when one fills, the other is cancelled). One-cancels-other applies to fills only |
| Deviation | `requestedPrice` + `deviationPoints` on market orders and closes: if the fill is further away than that, the request is rejected with code `requote` and the current bid/ask (D106) |
| Netting | One position per symbol. The same side adds to it (volume-weighted price). The opposite side reduces or closes it. A larger opposite order reverses it: long 1, sell 3 gives short 2 (D18). The new position records `reversedFrom` |
| Hedging | Every fill is a new position. Close By closes the overlap of two opposite positions at the open price of the second, with no spread paid |
| Partial close | Volume on the lot step, and the remainder must stay ≥ the minimum lot. Swap and commission are split pro rata |
| Commission | Round turn per lot (group `commissionPerLot`, a symbol can override it). Charged when exposure is opened, and shown per deal |
| Margin | notional (contract × price, converted to USD) × `margin_pct` / min(account leverage, symbol max leverage). Hedged volume is charged at the group's `hedgedMarginPct` for both legs (D14). Recomputed on every tick at mid price |
| Free-margin check | An order that increases margin is rejected (`no_money`) when equity − commission − new margin < 0 |
| Margin call / stop-out | Margin level = equity / margin × 100. At or below the group's margin call % the engine emits a notification. It clears at 5 points above the level. At or below stop-out % it closes the largest losing position first, repeating until the level is above stop-out (D16) |
| NBP | A negative balance with no open positions is reset to 0 with a ledger posting (D16) |
| Swaps | Charged at 00:00 server time (GMT+3 during US DST, GMT+2 otherwise, same rule as market-data). The day that just ended decides: FX, metals, indices, energies and stocks Mon–Fri nights, crypto every night. The triple day comes from the spec (FX/metals Wednesday, indices/energies/stocks Friday). Swap-free groups are skipped. Swaps accrue on the position and are realised on close |
| Sessions | Orders and closes are rejected with `market_closed` outside the session: crypto 24/7; FX, metals, indices and energies closed Saturday and Sunday server time; US stocks 09:30–16:00 New York. Same rules as market-data |
| Stale feed | Quotes older than `TRADING_MAX_QUOTE_AGE_SECS` are not tradable (`stale_price`) |
| Controls | Account status `active` / `close_only` / `read_only` / `disabled` / `expired`. Dealer controls: trading disabled, close-only, max lot, execution delay (≤ 500 ms, only if the tenant allows it), markup pips. Symbol controls: `halt` / `close-only` per group or all (D115, D140). SL/TP, stop-out and expiry still run on halted symbols |
| Routing | Dealer override → first matching enabled rule (fields Login, Group, Symbol, Lot size; others do not match yet) → account default → group route. Book transfer moves a whole ticket or splits the moved volume into a child ticket with `parentTicket` |
| Demo | Initial balance (group default or chosen, 100–1 000 000). A refill tops the balance back to the initial amount, at most N per server day. The account expires after `expiry_days` with no terminal login (D8) |
| Leverage | From the group list. Clients can change it only when no positions are open (D15); staff can change it any time |

## API conventions

- **Base URL.** Base `http://127.0.0.1:8090`. JSON in and out, camelCase keys.
- **Internal token.** Every route except `GET /health`, `GET /v1/terminal/stream` and `GET /v1/dealing/stream` needs the header `X-Kalks-Internal: $TRADING_INTERNAL_TOKEN`. Only the apps' BFFs and internal services hold it.
- **Tenant.** Set it with `X-Kalks-Tenant: <slug>`; the default is `kalks`. Forward the client IP as `X-Forwarded-For` and the user agent as `User-Agent`.
- **Numbers.**
  - Money, prices and volumes are JSON numbers, and requests also accept numeric strings.
  - Terminal and client tickets are numbers. Dealing tickets are strings, because the Back Office contract uses strings.
  - Times are RFC 3339 UTC.
  - Date filters (`from`/`to`) accept `YYYY-MM-DD` or RFC 3339. `from` is inclusive and `to` exclusive.
- **Errors.** Errors return `{"error": {"code", "message", ...}}`:

| HTTP | code | when |
|---|---|---|
| 400 | `bad_request` | malformed JSON / ids |
| 401 | `unauthorized` | no / expired terminal session, bad stream ticket |
| 403 | `forbidden`, `read_only` | missing internal token, staff role not allowed; investor session writing |
| 404 | `not_found` | unknown account / ticket / deal |
| 409 | `requote` (+`bid`,`ask`), `invalid_credentials`, `locked`, `account_limit`, `idempotency_conflict`, `duplicate_idempotency_key`, `exists` | |
| 422 | `validation` (+`field`) or an engine code: `market_closed`, `no_price`, `stale_price`, `no_money`, `invalid_volume`, `invalid_price`, `invalid_sl`, `invalid_tp`, `invalid_expiry`, `invalid_oco`, `max_lot`, `close_only`, `trading_disabled`, `account_status`, `symbol_halted`, `symbol_close_only`, `not_hedging`, `invalid_close_by`, `positions_open`, `invalid_leverage`, `insufficient_funds`, `refill_limit`, `refill_not_needed`, `demo_account`, `off_market`, `same_book`, `already_reversed`, `no_change`, … | |
| 429 | `rate_limited` (+`retryAfter`) | terminal login / SSO throttling |

Write responses can carry `notifications: [{kind, message, data}]` (fill, close, sl, tp, nbp, margin_call, stop_out, order_filled, …). The same notifications also go out on the stream.

The examples below use `H='-H x-kalks-internal:$TOK -H content-type:application/json'`.

## Terminal API

Terminal requests use `Authorization: Bearer <session token>` (from login or SSO). An investor session has `readOnly: true`; every write returns `403 read_only` (D107).

| Method & path | Body / query | Response |
|---|---|---|
| `POST /v1/terminal/login` | `{login, password}` (trading or investor password) | `{token, expiresAt, readOnly, account}`. Wrong password: 409 `invalid_credentials`; 10 failures lock the login for 15 min (409 `locked`); expired demo: 403 |
| `POST /v1/terminal/sso` | `{token}` from `POST /v1/accounts/{login}/sso` (one-time, 60 s) | same as login (`readOnly: false`) |
| `POST /v1/terminal/logout` | – | `{status:"ok"}` |
| `GET /v1/terminal/state?historyLimit=50` | – | `{account, positions[], orders[], history:{deals[]}, readOnly, serverTime}` |
| `GET /v1/terminal/history?from&to&page&limit` | – | same shape as `GET /v1/accounts/{login}/history` |
| `POST /v1/terminal/orders` | order body (below) | filled: `{status:"filled", orderTicket, positionTicket, price, book, deals[], delayMs?, notifications}`; pending: `{status:"placed", ticket, price, book}`; repeated `clientOrderId`: `{status:"duplicate", ticket}` |
| `PATCH /v1/terminal/orders/{ticket}` | `{price?, stopLimit?, volume?, sl?, tp?, trailingPoints?, expiry?, expiryAt?}` (`null` clears sl/tp/trailing) | `{order}` |
| `DELETE /v1/terminal/orders/{ticket}` | – | `{status:"cancelled", ticket}` |
| `POST /v1/terminal/positions/{ticket}/close` | `{volume?, deviationPoints?, requestedPrice?}` (no body = full close) | `{status:"closed", dealId, profit}`; `profit` = price P&L + swap share booked |
| `PATCH /v1/terminal/positions/{ticket}` | `{sl?, tp?, trailingPoints?}` (`null` clears) | `{position}` |
| `POST /v1/terminal/positions/close-by` | `{ticket, by}` | `{status:"closed", deals:[id,id]}` |
| `POST /v1/terminal/bulk-close` | `{filter: "all"|"profitable"|"losing"|"pending"|"buys"|"sells", symbol?}` | `{done[], failed[{ticket,error}], profit}` |
| `POST /v1/terminal/stream-ticket` | – | `{ticket, expiresIn:30}`, see [Streams](#streams) |

Order body:

```json
{
  "symbol": "EURUSD", "side": "buy", "type": "market | limit | stop | stop_limit", "volume": 0.10,
  "price": 1.1300,          // limit / stop price (stop trigger for stop_limit)
  "stopLimit": 1.1310,      // stop_limit only
  "sl": 1.1250, "tp": 1.1400, "trailingPoints": 150,
  "expiry": "GTC | Today | Date | 2026-10-02 | <RFC 3339>", "expiryAt": "<RFC 3339 when expiry=Date>",
  "requestedPrice": 1.13672, "deviationPoints": 20,   // market: requote if the fill moves further
  "ocoWith": 1000003,       // pending: link with an existing pending order
  "source": "manual | api | fix | webhook | strategy | copy | pamm | ai",   // D84, default manual
  "platform": "Web | iOS | Android | API", "comment": "…", "clientOrderId": "uuid-1"
}
```

Position view (terminal / client):

```json
{"ticket":1000001,"login":50000001,"symbol":"BTCUSD","side":"buy","volume":0.1,"openPrice":83370.08,"openTime":"…",
 "sl":82000.0,"tp":86000.0,"trailingPoints":null,"swap":0.0,"commission":0.0,"currentPrice":83419.95,"profit":4.99,
 "source":"manual","platform":"Web","comment":"","book":"B","parentTicket":null,"childTickets":[],"priceCorrected":false,"reversedFrom":null}
```

The order view has `ticket, login, symbol, side, type, volume, price, stopLimit, triggered, sl, tp, trailingPoints, expiry, expiryAt, oco, source, platform, comment, book, placedAt, clientOrderId`.

The deal view has `id, login, positionTicket, orderTicket, symbol, side, positionSide, entry (in|out|out_by), volume, price, profit, swap, commission, reason (client|dealer|sl|tp|stop_out|close_by|pending_fill|force|price_correction), book, time, openPrice, openTime, source, comment, priceCorrection, ledgerTxn, reversed`.

The account view (terminal, CRM, admin) has:

```json
{"login":50000001,"userId":42,"type":"demo","group":"standard","groupName":"Standard","mode":"hedging","cent":false,
 "currency":"USD","baseCurrency":"USD","leverage":500,"leverages":[50,100,200,500,1000],"status":"active","name":"…",
 "route":"B","marginCall":false,"marginCallLevel":100.0,"stopOutLevel":50.0,"positions":1,"orders":2,
 "controls":{"tradingDisabled":false,"closeOnly":false,"maxLot":null,"execDelayMs":0,"markupPips":0.0},
 "balance":10000.0,"credit":0.0,"bonus":0.0,"profit":-0.02,"swap":0.0,"equity":9999.98,"margin":834.14,
 "freeMargin":9165.84,"marginLevel":1198.84,"withdrawable":9165.84,
 "demo":{"initialBalance":10000.0,"refillsPerDay":3,"refillsUsedToday":0,"expiryDays":10},
 "createdAt":"…","version":18}
```

Cent accounts report `currency: "USC"`: every amount is USD × 100 and lot sizes are unchanged (D30).

## Client Area API

The CRM BFF calls these after its own session check. It passes the gateway user id in `X-Kalks-User-Id: <id>` (or `?user_id=`). Every `/v1/accounts/{login}/*` route returns 404 unless the account belongs to that user and tenant.

| Method & path | Body | Response |
|---|---|---|
| `GET /v1/groups` | – | `{groups[]}`: enabled groups (code, name, mode, cent, accountTypes, leverages, defaultLeverage, marginCallPct, stopOutPct, hedgedMarginPct, minDeposit, swapFree, commissionPerLot, route, spreadGroup, maxAccountsPerUser, demo*) |
| `GET /v1/symbols` | – | `{symbols[]}`: contract specs (digits, point, pipSize, contractSize, profitCurrency, lot min/max/step, marginPct, maxLeverage, swapLong/Short in points, tripleSwapDay, session, open now) |
| `POST /v1/accounts` | `{userId?, type:"live"|"demo", group, leverage?, name?, password?, investorPassword?, initialBalance? (demo)}` | `{account, credentials:{login, password?, investorPassword?}}`. Missing passwords are generated and returned once. Passwords are 8–64 chars with letters and digits, and the two must differ. The per-group `maxAccountsPerUser` is enforced per type (409 `account_limit`) |
| `GET /v1/accounts?user_id=` | – | `{accounts:[account view…]}` |
| `GET /v1/accounts/{login}` | – | `{account, positions[], orders[]}` |
| `POST /v1/accounts/{login}/demo-refill` | – | `{status, amount, balance}` |
| `POST /v1/accounts/{login}/passwords` | `{kind:"trading"|"investor", password}` | `{status, sessionsRevoked}`; the CRM does the email OTP first (D20) |
| `POST /v1/accounts/{login}/leverage` | `{leverage}` | `{status, from, leverage}` (only when flat) |
| `GET /v1/accounts/{login}/history?from&to&page&limit` | – | `{deals[], orders[] (done pending orders), page, limit, total, totals:{profit, swap, commission}}` |
| `GET /v1/accounts/{login}/ledger?from&to&page&limit` | – | `{items:[{txn, kind, subLedger, amount, currency, reference, reasonCode, note, at}], page, limit, total}` |
| `POST /v1/accounts/{login}/sso` | – | `{token, expiresAt, login}`: one-time, 60 s; the terminal BFF redeems it with `POST /v1/terminal/sso` |

```bash
curl -s -X POST localhost:8090/v1/accounts $H -d '{"userId":42,"type":"demo","group":"standard","leverage":100,"password":"Trade2026x","investorPassword":"Watch2026x"}'
curl -s -X POST localhost:8090/v1/terminal/login $H -d '{"login":50000001,"password":"Trade2026x"}'
curl -s -X POST localhost:8090/v1/terminal/orders $H -H "authorization: Bearer $TOKEN" -d '{"symbol":"BTCUSD","side":"buy","type":"market","volume":0.1}'
```

## Wallet transfers

This API is for the wallet service (D3, D36). Amounts are in USD; a cent account is credited × 100 in USC.

| Method & path | Body | Response |
|---|---|---|
| `POST /v1/ledger/transfers` | `{idempotencyKey, login, amount, direction:"in"|"out", ref?}` | `{status:"completed", txn, amount, currency, balance, login, userId, direction, replayed:false}` |
| `GET /v1/ledger/transfers/{idempotencyKey}` | – | `{txn, kind, login, reference, amount, currency, at, request}` |

- Resending the same key with the same `login`, `amount` and `direction` returns the original result with `replayed: true`, and nothing is booked twice.
- The same key with a different request returns `409 idempotency_conflict`. A concurrent duplicate is caught by the database's unique key.
- `out` is limited to the withdrawable amount: min(balance, free margin − credit − bonus). Anything more returns `422 insufficient_funds`.
- Demo accounts return `422 demo_account`.

## Dealing desk API

This implements the contract at the top of `apps/admin/lib/trading-desk/store.ts`. The Back Office BFF verifies the staff session with the gateway and then forwards the staff identity:

```
X-Kalks-Staff-Id: 12
X-Kalks-Staff-Name: Julia%20Novak      (percent-encoded UTF-8)
X-Kalks-Staff-Role: dealer             (gateway staff role)
```

- **Roles.**
  - Dealing writes: `platform_owner`, `super_admin`, `admin`, `dealer`, `risk_manager`.
  - Balance, credit and bonus: `platform_owner`, `super_admin`, `admin`, `finance`.
  - Groups and tenant policy: `platform_owner`, `super_admin`, `admin`.
  - Reads: any staff role.
- **Reason codes.** Every write body includes `reasonCode` and `note`:
  - `reasonCode` is required.
  - `DLR-99 …` needs a note.
  - A price correction and a close at a given price need `DLR-02 …` and a note.
  - A void needs `DLR-02` or `DLR-06` and a note.
  - A manual market fill price needs a note.
- **Responses.**
  - A successful write returns `{ "data": …, "audit": [AuditEntry…] }`.
  - A failure returns `{ "error": {code, message}, "audit": [...] }`. When the engine refuses an attempt, the refusal is itself audited as `trade.rejected`.

| Method & path | Body | `data` |
|---|---|---|
| `GET /v1/dealing/state` | – | `{positions: DeskPosition[], orders: DeskOrder[], deals: DeskDeal[], symbolControls, accountControls, routingRules, tenant, groups}` |
| `GET /v1/dealing/positions?book=&group=&symbol=&source=&login=` | – | `DeskPosition[]` (plain array) |
| `GET /v1/dealing/orders?group=&symbol=&source=&login=` | – | `DeskOrder[]` |
| `GET /v1/dealing/deals?login=&symbol=&from=&to=&limit=` | – | `DeskDeal[]` (closing deals, newest first) |
| `POST /v1/dealing/trades` | `CreateTradeInput` (`{login, symbol, side, type:"market"|"limit"|"stop"|"stop-limit", volume, price?, stopLimit?, sl?, tp?, book?, comment?, expiry?}`) | `{ticket, kind:"position"|"order", price, book, delayMs}` |
| `PATCH /v1/dealing/positions/{ticket}` | `{sl?, tp?}` (`null` clears) | `null` |
| `POST /v1/dealing/positions/{ticket}/close` | `{volume?, price?, force?, stopOut?}` | `{dealId, profit}`. `volume` < position = partial; `price` = price correction (DLR-02); `force` overrides a symbol halt |
| `POST /v1/dealing/positions/{ticket}/add` | `{volume}` | `null` |
| `POST /v1/dealing/positions/{ticket}/price-correction` | `{openPrice}` | `null` (the position is flagged `priceCorrected`, "price correction" on the statement) |
| `POST /v1/dealing/positions/{ticket}/charges` | `{swap?, commission?}` | `null` (commission differences are booked on the ledger) |
| `POST /v1/dealing/positions/{ticket}/void` | – | `null` (no P&L; the entry commission is refunded) |
| `POST /v1/dealing/deals/{id}/reopen` | – | `{ticket}` (the booked P&L + swap is reversed on the ledger; the volume reopens or merges back) |
| `POST /v1/dealing/book-transfers` | `{tickets[], to:"A"|"B", volume? | pct?}` | `{done[], failed[{ticket,error}], created[]}` (partial = child ticket) |
| `POST /v1/dealing/positions/bulk` | `{tickets[], op:"close"|"modify", force?, slPct?, tpPct?, clear?:"sl"|"tp"|"both"}` | `{done[], failed[], profit?}` |
| `PATCH /v1/dealing/orders/{ticket}` | `OrderPatch` (`{price?, stopLimit?, volume?, sl?, tp?, expiry?}`) | `null` |
| `POST /v1/dealing/orders/cancel` | `{tickets[]}` | `{done[], failed[]}` |
| `POST /v1/dealing/orders/{ticket}/fill` | – | `{ticket}` (the new position) |
| `GET /v1/dealing/controls` | – | `{symbolControls, accountControls, tenant}` |
| `PUT /v1/dealing/controls/symbols/{symbol}` | `{group:"all"|<group code>, mode:"halt"|"close-only"|null}` | `null` |
| `PUT /v1/dealing/controls/accounts/{login}` | `{tradingDisabled?, closeOnly?, maxLot?, execDelayMs? (0–cap), markupPips?}` | `null` |
| `PUT /v1/dealing/controls/tenant` | `{execDelayEnabled?, execDelayCapMs? (≤500), marginCallPct?, stopOutPct?}` | `null` |
| `GET /v1/dealing/routing/rules` | – | `RoutingRule[]` |
| `PUT /v1/dealing/routing/rules` | `{rules: RoutingRule[], summary}` | `null` |
| `PUT /v1/dealing/routing/quick` | `{login | group, book:"A"|"B"|null}` | `null` (adds or removes `RQ-L<login>` / `RQ-G<group>` rules ahead of the rule set) |
| `GET /v1/dealing/audit?staff=&action=&ticket=&login=&from=&to=&limit=&before=` | – | `AuditEntry[]`, newest first; `before` = id cursor |
| `POST /v1/dealing/stream-ticket` | – | `{ticket, expiresIn:30}` |

Shapes follow `apps/admin/lib/trading-desk/types.ts`:

- **DeskPosition.** `ticket, login, clientId (gateway user id), symbol, side, volume, openPrice, sl, tp, swap, commission, openTime, source, platform, group (code), groupName, route, parentTicket, comment, bookSince, bookPrice, bookCarry{A,B}, routeHistory[{at, kind, from, to, volume, price, staff, reason, relatedTicket}], childTickets, priceCorrected`, plus `currentPrice, profit, trailingPoints, currency`.
- **DeskOrder.** `ticket, login, clientId, symbol, type ("Buy Limit" …), volume, price, stopLimit, sl, tp, placed, expiry ("GTC"|"Today"|ISO), group, source, comment, book, triggered, oco`.
- **DeskDeal.** `id, ticket, login, clientId, symbol, side, volume, openPrice, closePrice, openTime, closeTime, profit (price P&L + swap − commission share), priceProfit, swap, commission, book, kind (close|partial|force|stop-out|price-correction), reason, priceCorrection, reversed, staff, reasonCode`.
- **AuditEntry.** `{id:"AUD-000001", at, staff:{id,name,role}, action, tickets[], login, symbol, before, after, reasonCode, note, flags}`.
- **Audit actions.**
  - Contract actions: `position.open|modify|partial_close|close|force_close|stop_out|add_volume|price_correction|adjust_charges|void`, `deal.reopen`, `book.transfer|split`, `order.place|modify|cancel|fill`, `control.symbol|account|tenant`, `routing.rule`, `trade.rejected`.
  - Account ops add `account.balance|credit|status|group|leverage|rejected` and `group.create|update`.

```bash
S='-H x-kalks-staff-id:1 -H x-kalks-staff-name:Julia%20Novak -H x-kalks-staff-role:dealer'
curl -s -X POST localhost:8090/v1/dealing/trades $H $S -d '{"login":"10000001","symbol":"EURUSD","side":"buy","type":"market","volume":1,"reasonCode":"DLR-01 · Client request","note":"client called desk"}'
curl -s -X POST localhost:8090/v1/dealing/book-transfers $H $S -d '{"tickets":["1000006"],"to":"A","volume":0.4,"reasonCode":"DLR-03 · Risk management","note":"hedge"}'
```

## Admin account API

These use the same staff headers, reason rules and response shape as the dealing API.

| Method & path | Body | Response |
|---|---|---|
| `GET /v1/admin/accounts?q=&group=&type=&status=&user_id=&page=&limit=` | – | `{items:[account view], page, limit, total}` (`q` matches login, name or user id) |
| `GET /v1/admin/accounts/{login}` | – | `{account, positions: DeskPosition[], orders: DeskOrder[], lastActivityAt}` |
| `POST /v1/admin/accounts/{login}/balance` | `{type:"deposit"|"withdrawal"|"adjustment"|"credit"|"bonus", amount (signed, account currency), idempotencyKey?, reasonCode, note}` | `{data:{balance, credit, bonus, txn, type, amount}, audit}`. A note is required; withdrawals are limited to the withdrawable amount; credit/bonus cannot go below 0 |
| `POST /v1/admin/accounts/{login}/status` | `{status:"active"|"disabled"|"close_only"|"read_only"|"expired", reasonCode, note}` | `{data:{status}, audit}` |
| `POST /v1/admin/accounts/{login}/group` | `{group, reasonCode, note}` | `{data:{group}, audit}`. Netting ↔ hedging only while flat; cent ↔ standard never |
| `POST /v1/admin/accounts/{login}/leverage` | `{leverage, reasonCode, note}` | `{data:{leverage}, audit}` (allowed with open positions; margin is re-checked at once) |
| `GET /v1/admin/groups` | – | `{groups:[Group + accounts count]}` |
| `POST /v1/admin/groups` | `Group` (all fields, camelCase) + `reasonCode, note` | `{data: Group, audit}` |
| `PUT /v1/admin/groups/{code}` | `Group` + reason | `{data: Group, audit}`. Mode and cent are fixed once the group has accounts |
| `GET /v1/admin/ledger/accounts` | – | `{house:[{code, currency, balance}], netByCurrency:[{currency, net}]}` (net is always 0) |

The Group object has `code, name, mode, cent, accountTypes ("live"|"demo"|"both"), leverages[], defaultLeverage, marginCallPct, stopOutPct, hedgedMarginPct, minDeposit, swapFree, commissionPerLot, route, spreadGroup, maxAccountsPerUser, demoInitialBalance, demoRefillsPerDay, demoExpiryDays, enabled`.

These groups are seeded: `standard`, `pro`, `pro-netting`, `ecn` (7 USD/lot), `cent`, `vip`, `prop`.

## Copy trading and PAMM

Social trading (D65–D76, D125) lives in `src/social/`. A **master** is a client whose live account was approved as a strategy provider. Followers **copy** the master into a dedicated copy account per subscription (D71). Investors buy units of a master's **PAMM fund**, a pooled trading account valued by NAV per unit (D65). Masters can run both (D75).

### How mirroring works

```
master account shard ── commit (events) ──► event tap (only logins with active followers)
                                              │  unbounded, in commit order, + master equity at commit
                                              ▼
                                      copier task (one, sequential)
                                              │  for every active subscription of that master:
                                              │  plan → op on the follower's shard (single writer)
                                              ▼
                        follower copy account: open / add / partial close / close / SL-TP / pending
```

- **Tap.** After an account's events are committed, the shard hands them to the copier when the login is a watched master. The copier gets them in commit order, with the master's equity at that moment.
- **Ordering.** One copier task processes masters' commits one at a time and awaits every follower op, so each follower sees the master's actions in the master's order.
- **Idempotency and links.** Every mirrored action carries a key derived from the master stream:
  - opens use `clientOrderId = cp<sub>:<master position ticket>`;
  - pending orders use `co<sub>:<master order ticket>`;
  - the (at most one) exit a master event causes stamps `cx<sub>:<master event version>` on the follower's exit deal.

  The follower state remembers these keys (the same duplicate guard as the terminal's `clientOrderId`). The master → follower ticket links are derived from them, so they are part of the follower's own event stream and replay with it: there is no separate link table. A repeated or replayed master event never executes twice.
- **Catch-up.** A cursor per watched login (`copy_cursors`) records the last event version processed. After a restart the copier catches up from the `events` table. During catch-up it still applies closes, SL/TP changes and cancels, but skips opens older than 60 s.
- **Stops win.** A stop sets an in-memory flag before it closes anything. A mirrored action that is already queued on the follower's shard checks the flag first, so it can never reopen a stopped copy.
- **What is mirrored (D73).**

| Master event | Follower action |
|---|---|
| market fill / pending fill (`position_opened` with a deal) | market order, same side, sized volume, same SL/TP, source `copy`, comment `copy #<master ticket>` |
| volume added (netting add, dealer add) | market order for the sized extra volume (netting) or a dealer-style add on the linked position (hedging) |
| partial close | closes the same **fraction** of the linked follower position (rounded down to the lot step; the whole position if the remainder would fall below the minimum lot) |
| full close (client, SL, TP, stop-out, Close By, dealer, void) | closes the linked follower position at market |
| SL / TP / trailing change | same levels on the linked follower position |
| pending placed / modified / cancelled / expired | same order type, prices, SL/TP, expiry and sized volume on the follower; when the master's order fills, a still-pending follower order is replaced by a market fill |
| netting reversal | close + open, like the master |

- **Sizing (D69).** `v = master volume × factor`, then clamped to the follower's max lot and the symbol's max lot, rounded **down** to the lot step. A result below the minimum lot is skipped and logged (`skipped: below min lot`).

| mode | factor |
|---|---|
| `equity` | follower equity ÷ master equity (both in USD, at the moment of the master's trade) |
| `allocation` | fixed allocation (USD) ÷ master equity |
| `multiplier` | `value` (for example 0.5 or 2) |
| `fixed_lot` | every open is `value` lots; adds and partial closes stay proportional |

- **Follower controls (D70).**
  - Symbols in `excludedSymbols` are never copied.
  - `maxLot` caps each copied trade.
  - `equityStop` (USD) and `maxDdPct` (from the subscription's peak equity) are checked every 2 s by the guard. A breach stops the subscription and closes every copied position and order.
  - `stopReason` is `client` (the follower stopped), `equity_stop`, `max_dd` or `admin`.
  - Copied positions and orders cannot be closed, modified or cancelled one by one in the terminal. The terminal API returns `422 copy_managed` with the message "This position is copied from <master>. It closes when the master closes it. To exit, stop copying in the Client Area (Social → My subscriptions)." Manual orders on an actively copying account return `422 copy_account`. Stopping the subscription (`POST …/stop`) closes everything and, when `returnFunds` is set, moves the balance back to the wallet.
- **Copy account (D71).** The copy account is a live account owned by the follower in group `copy` (hedging masters) or `copy-netting` (netting masters). Both groups are seeded disabled, so they never appear in the open-account wizard. Money arrives through the wallet (`to-trading`). Every deposit and withdrawal on the account adjusts the high-water mark.
- **Performance fee, copy (D66).**
  - It is settled at the master's fee period end (`daily`, `weekly` or `monthly`, at the server-day rollover) by `settle_copy`: `hwm' = hwm + net deposits since the last settlement`, and `fee = pct × max(0, equity − hwm')`.
  - The fee is debited from the copy account (`perf_fee` ledger txn: `acct:L:balance −fee` · `house:perf_fees:USD +fee`) and `hwm = equity − fee`.
  - The fee is recorded in `social_fees` as `pending`. After admin approval (D76), the wallet pays the master `fee − platform cut` (`kind: copy_fee`, direction `credit`). The platform cut stays in `house:perf_fees`.
  - The fee % is locked on the subscription when it starts. A later change by the master applies to new subscriptions only.

### PAMM (D65–D67, D74)

- **Fund.**
  - A fund is a live account in group `pamm` owned by the master, who trades it in Kalks Trader with the credentials returned at creation. Orders on it are tagged source `pamm`.
  - Wallet ↔ account transfers on a fund login are refused (`422 pamm_account`): money moves only through invest/redeem.
  - `NAV = fund equity ÷ total units`. The first NAV is 1.00: the master's seed capital buys the first units.
- **Requests.**
  - An invest request debits the investor's wallet at once (`kind: pamm_invest`, direction `debit`) and waits for the next rollover.
  - A redeem request waits for the rollover (lock-in: `lockInDays` from the investor's first investment).
  - A pending request can be cancelled; a cancelled invest is refunded to the wallet (`pamm_redeem`, `credit`).
- **Rollover.** At the end of the fund's period (daily / weekly / monthly, at 00:00 server time; weekly = the rollover into Monday; monthly = into the 1st), or on demand from the Back Office:
  1. `nav = equity ÷ units`.
  2. **Fees.** For each investor (the master pays none) with `nav > hwm`: `fee = pct × (nav − hwm) × units`. The fee is taken as units at NAV (`units −= fee ÷ nav`, so NAV is unchanged) and `hwm = nav`. The total fee is debited from the fund account (`perf_fee` txn) and recorded as a pending `social_fees` row per investor.
  3. **Redemptions** at `nav`: `amount = units × nav`, debited from the fund (`transfer_out`, ref `pamm:redeem:<id>`), then credited to the wallet (`pamm_redeem`). A redemption the fund's free margin cannot cover stays pending (`insufficient_free_margin`). The master cannot redeem below `minOwnPct` of units (D68).
  4. **Investments** at `nav`: `units = amount ÷ nav`. The fund is credited (`transfer_in`, ref `pamm:invest:<id>`). The investor's HWM becomes the unit-weighted blend of the old HWM and `nav`. An investment that would push the master's share below `minOwnPct` is rejected and refunded.
  5. A `pamm_rollovers` row records NAV, equity, units, fees, inflows and outflows.
- **Unit ledger.** `pamm_unit_ledger` is append-only: `seed | invest | redeem | fee | stop_loss` with ±units and NAV. The holdings in `pamm_investors` always equal Σ of the ledger (checked by the tests).
- **Protection (D74).**
  - **Investor stop-loss.** If `value ≤ net invested × (1 − stopLossPct)`, the guard redeems that investor at once at the current NAV (fee rules applied; free margin permitting).
  - **Fund max drawdown.** If NAV falls `maxDdPct` below its peak, the fund is frozen. All positions and orders are closed, the account becomes `close_only`, and invests are refused. Redemptions still run at rollover. The Back Office unfreezes it.
- **Money precision.** NAV and units have 8 decimals. Amounts are rounded to 0.01 USD.
- **Consistency.** Rollovers, freezes and stop-loss redemptions hold one PAMM lock. The guard skips a fund while a rollover holds it, so it never reads a NAV between the ledger move and the unit update.
- **IB lots (D64).** Every closed deal on a fund account is split across the holders by units and pushed to the IB service (`POST {IB_URL}/v1/ib/events/lots`, `source: "pamm"`, idempotent on deal + user, best effort with retries). The IB poller also sees the fund account's own deal (owner = the master). Add the `pamm` group to the IB programme's excluded groups so fund volume is not counted twice. Copy trades need no push: they are ordinary deals with source `copy` on the follower's own account.

### Statistics, leaderboard and risk score (D72)

- `social_snapshots (login, day)` holds the end-of-day equity (USD) and the day's net external flow (transfers, deposits, withdrawals, demo funding) for every master account and fund account.
- Snapshots are written:
  - at every server-day rollover;
  - on `POST /v1/social/admin/snapshots`;
  - on approval, which also backfills the account's history from the ledger (end-of-day balance; past floating P&L is not known).
- **Return index** (time-weighted, flows removed): `I₀ = 1`, `I_t = I_{t−1} × (E_t − F_t) ÷ E_{t−1}`. Today's live equity is the last point.
- **Returns.**
  - Period return = `I_now ÷ I_(period start) − 1`.
  - Monthly returns chain the index at month ends.
  - Max drawdown = max of `1 − I_t ÷ max_{s≤t} I_s`.
  - Volatility = stdev of daily index returns × √252.
- **Risk score 1–10.** `raw = 0.6 × min(maxDD ÷ 50%, 1) + 0.4 × min(volatility ÷ 100%, 1)`; `score = clamp(1 + round(9 × raw), 1, 10)`. Maximum drawdown weighs more than day-to-day volatility. A 10% drawdown with 20% volatility scores 3; a 40% drawdown with 80% volatility scores 8; 50% / 100% scores 10.
- **Delayed trade history.** The master profile shows closed deals older than `tradeDelayMinutes` (tenant setting, default 30).

### Social API

Same conventions as the rest of the engine: the internal token, `X-Kalks-Tenant`, camelCase JSON, money in USD, percentages as numbers (`12.5` = 12.5 %). Client routes need `X-Kalks-User-Id` (the signed-in gateway user). The CRM BFF also sends `X-Kalks-Kyc: unverified|pending|verified|rejected` from the gateway profile (D68). Staff routes need the staff headers.

**Shapes**

```jsonc
// MasterView (public card; private fields only on /master/me and admin)
{"id":3,"nickname":"Gold Swing","strategy":"Gold swing","description":"…","program":"copy|pamm|both",
 "perfFeePct":20,"feePeriod":"daily|weekly|monthly","minAllocation":100,
 "status":"pending|approved|rejected|suspended","hidden":false,"frozen":false,"since":"<approvedAt>","ageDays":412,
 "stats":{"return1m":2.1,"return3m":8.4,"return1y":31.0,"returnAll":44.2,"maxDd":7.9,"currentDd":1.2,"volatility":14.1,
          "riskScore":3,"equity":25310.5,"aum":120400.0,"followers":14,"investors":6,"trades":212,"winRate":58.4,"spark":[1,1.01,…]},
 "fund":{"id":2,"name":"…","nav":1.0842,"period":"weekly","perfFeePct":20,"lockInDays":30,"minInvestment":100,"status":"active"} | null,
 // private: "login","kycVerified","reviewNote","reviewedBy","createdAt","userId"
}
// SubscriptionView
{"id":7,"masterId":3,"master":{"id":3,"nickname":"…","strategy":"…","riskScore":3,"frozen":false,"status":"approved"},"login":10000042,
 "status":"active|paused|stopped","stopReason":null,"sizing":{"mode":"equity|allocation|multiplier|fixed_lot","value":1},
 "maxLot":null,"equityStop":null,"maxDdPct":30,"excludedSymbols":["BTCUSD"],"perfFeePct":20,"feePeriod":"weekly",
 "allocation":1000,"netDeposits":1000,"hwm":1000,"peakEquity":1043.2,"feesPaid":0,"feesPending":0,
 "balance":1012.3,"equity":1043.2,"profit":43.2,"returnPct":4.32,"positions":2,"orders":0,
 "createdAt":"…","stoppedAt":null,"nextFeeAt":"…"}
// FundView
{"id":2,"masterId":3,"master":{"id":3,"nickname":"…"},"name":"…","status":"active|frozen|closed","period":"weekly",
 "perfFeePct":20,"lockInDays":30,"minInvestment":100,"maxDdPct":35,"minOwnPct":5,
 "nav":1.0842,"units":10234.5,"equity":11096.3,"aum":9500.1,"investors":6,"masterSharePct":14.2,"navPeak":1.1,"drawdownPct":1.4,
 "returnAll":8.42,"return1m":1.2,"lastRolloverAt":"…","nextRolloverAt":"…","createdAt":"…", "login": 10000050 /* owner/admin only */}
// InvestmentView
{"fundId":2,"fund":FundView,"units":920.4,"nav":1.0842,"value":997.9,"netInvested":950,"pnl":47.9,"pnlPct":5.04,"hwmNav":1.07,
 "stopLossPct":20,"lockedUntil":"…","feesPaid":3.1,"pending":[RequestView]}
// RequestView
{"id":11,"fundId":2,"kind":"invest|redeem","amount":500,"units":null,"all":false,"status":"pending|done|rejected|cancelled",
 "reason":null,"createdAt":"…","executedAt":null,"nav":null,"unitsDelta":null,"amountOut":null,"fee":null}
// FeeView
{"id":5,"source":"copy|pamm","masterId":3,"master":"Gold Swing","subscriptionId":7,"fundId":null,"payerUserId":42,"login":10000042,
 "amount":8.64,"platformCut":1.73,"masterAmount":6.91,"periodStart":"…","periodEnd":"…","hwmBefore":1000,"hwmAfter":1034.56,
 "equity":1043.2,"status":"pending|approved|paid|rejected|failed","reviewedBy":null,"note":null,"createdAt":"…","paidAt":null}
```

**Public and client routes** (`X-Kalks-User-Id`)

| Method & path | Body / query | Response |
|---|---|---|
| `GET /v1/social/leaderboard` | `?period=1m\|3m\|1y\|all&program=all\|copy\|pamm&sort=return\|dd\|aum\|followers\|age&risk=all\|low\|med\|high&minDays=` | `{items: MasterView[], totals:{masters, aum, followers, investors}}`: approved, not hidden |
| `GET /v1/social/masters/{id}` | – | `{master: MasterView, equity:[{day, equity, index}], monthly:[{month:"2026-09", returnPct}], trades:[{id, symbol, side, volume, openPrice, closePrice, openTime, closeTime, profit}], symbols:[{symbol, trades, share}], tradeDelayMinutes, terms:{perfFeePct, feePeriod, hwm:true, minAllocation, platformCutPct}}` |
| `GET /v1/social/master/me` | – | `{master: MasterView+private \| null, settings:{feeMinPct, feeMaxPct, minTrackDays, minOwnCapitalPct, minMasterEquity, platformCutPct, minAllocation}, candidates:[{login, group, equity, ageDays, eligible, checks:[{key:"kyc"\|"live"\|"track"\|"equity"\|"free", ok, label, detail}]}]}` |
| `POST /v1/social/master/apply` | `{login, nickname, strategy, description, program, perfFeePct, feePeriod, minAllocation?}` | `{master}` (status `pending`); 422 `requirements` when a check fails (`checks` in the error) |
| `PATCH /v1/social/master/me` | `{nickname?, strategy?, description?, perfFeePct?, feePeriod?, minAllocation?}` | `{master}` |
| `GET /v1/social/master/dashboard` | – | `{master, followers:[{subscriptionId, since, status, sizing, equity, profit}], funds:[FundView + {investors:[{investorId, units, value, since}], pending}], fees: FeeView[], totals:{followers, aum, feesPending, feesPaid}}` |
| `POST /v1/social/subscriptions` | `{masterId, sizing:{mode, value}, allocation, maxLot?, equityStop?, maxDdPct?, excludedSymbols?[]}` | `{subscription, account, funding:{status:"done"\|"failed", message?}}`. Opens the copy account and pulls `allocation` from the wallet (`to-trading`) |
| `GET /v1/social/subscriptions` | – | `{items: SubscriptionView[]}` |
| `GET /v1/social/subscriptions/{id}` | – | `{subscription, positions[], orders[], log:[{at, action, masterTicket, followerTicket, volume, status, message}], fees: FeeView[]}` |
| `PATCH /v1/social/subscriptions/{id}` | `{sizing?, maxLot?, equityStop?, maxDdPct?, excludedSymbols?, paused?}` (`null` clears a limit) | `{subscription}` |
| `POST /v1/social/subscriptions/{id}/stop` | `{returnFunds?: true}` | `{subscription, closed:[tickets], failed:[{ticket, error}], returned: amount \| null}` |
| `GET /v1/social/funds` | – | `{items: FundView[]}` (active and frozen) |
| `GET /v1/social/funds/{id}` | – | `{fund, master, navHistory:[{at, nav}], rollovers:[{at, nav, invested, redeemed, fees}]}` |
| `POST /v1/social/funds` | master only: `{name, period, perfFeePct, lockInDays, minInvestment, maxDdPct, seed}` | `{fund, credentials:{login, password, investorPassword}}`. `seed` comes from the master's wallet at NAV 1 |
| `PATCH /v1/social/funds/{id}` | owner: `{name?, period?, perfFeePct?, lockInDays?, minInvestment?, maxDdPct?}` | `{fund}` |
| `POST /v1/social/funds/{id}/invest` | `{amount, stopLossPct?}` | `{request}` (the wallet is debited now; units at the next rollover) |
| `POST /v1/social/funds/{id}/redeem` | `{units?} \| {amount?} \| {all:true}` | `{request}` |
| `POST /v1/social/requests/{id}/cancel` | – | `{request}` |
| `GET /v1/social/investments` | – | `{items: InvestmentView[], requests: RequestView[]}` |
| `PATCH /v1/social/investments/{fundId}` | `{stopLossPct: number\|null}` | `{investment}` |
| `GET /v1/social/funds/{id}/statement` | – | `{items:[{at, kind, units, nav, amount}], requests: RequestView[]}` (the caller's own) |

**Back Office routes** (staff headers). Reads are open to every staff role. Writes (`suspend`, `hide`, `emergency`, `freeze`, `rollover`, `snapshots`, `settings`) need `platform_owner`, `super_admin`, `admin` or `risk_manager`. Approvals (masters, fee payouts) need `platform_owner`, `super_admin`, `admin` or `compliance`. Every write needs a `note` and is written to `audit_log` as `social.*`.

| Method & path | Body | Response |
|---|---|---|
| `GET /v1/social/admin/overview` | – | `{masters:{pending, approved, suspended}, subscriptions:{active, stopped}, funds:{active, frozen}, aum, feesPending:{count, amount}, settings}` |
| `GET /v1/social/admin/masters?status=` | – | `{items: MasterView+private[]}` |
| `POST /v1/social/admin/masters/{id}/review` | `{decision:"approve"\|"reject", note}` | `{master}` |
| `POST /v1/social/admin/masters/{id}/status` | `{action:"suspend"\|"reinstate"\|"hide"\|"unhide", note}` | `{master}` |
| `POST /v1/social/admin/masters/{id}/emergency` | `{freeze: bool, closePositions?: bool, note}` | `{master, closed, failed}`: stops mirroring for every follower (D125) |
| `GET /v1/social/admin/subscriptions?masterId=&status=` | – | `{items: SubscriptionView[] + userId}` |
| `POST /v1/social/admin/subscriptions/{id}/stop` | `{note}` | `{subscription}` |
| `GET /v1/social/admin/funds` | – | `{items: FundView[] + {login, pending}}` |
| `POST /v1/social/admin/funds/{id}/freeze` | `{freeze: bool, closePositions?: bool, note}` | `{fund}` |
| `POST /v1/social/admin/funds/{id}/rollover` | `{note}` | `{rollover}`: runs the fund's rollover now |
| `POST /v1/social/admin/rollover` | `{note, force?: bool}` | `{funds, subscriptions, fees}`: everything due (or all with `force`) |
| `POST /v1/social/admin/snapshots` | `{note}` | `{written}` |
| `GET /v1/social/admin/settings` / `PUT` | `{feeMinPct, feeMaxPct, platformCutPct, minTrackDays, minOwnCapitalPct, minMasterEquity, minAllocation, tradeDelayMinutes, note}` | `{settings}` |
| `GET /v1/social/admin/fees?status=` | – | `{items: FeeView[], totals:{pending, approved, paid}}` |
| `POST /v1/social/admin/fees/{id}/review` | `{decision:"approve"\|"reject", note}` | `{fee}`: approve pays the master through the wallet (`copy_fee`) |
| `GET /v1/social/admin/audit?limit=&before=` | – | `AuditEntry[]` (`social.*` actions) |

**House accounts** (driven by the ALGO service, services/algo README "House accounts"). A house master is a platform-owned live account running an automated strategy; `social_masters.is_house` marks it and every master view (and a subscription's `master`) carries `"house": true` so the apps show the "House strategy · Operated by Kalks" label. A hidden house master takes no new followers (`master_status`). Staff headers, `ROLES_SOCIAL_WRITE`, a note on every write, audited as `social.house.*`:

| Method & path | Body | Response |
|---|---|---|
| `POST /v1/social/admin/house` | `{userId, nickname, strategy?, description?, group? ("standard"), capital, perfFeePct? (0), feePeriod? ("monthly"), minAllocation?, key?, note}` | `{master, login, created}`: opens a live account for the house user, books `capital` as ledger kind `house_capital` (`house:house_capital` ↔ balance, never a deposit) and inserts an approved master with `is_house`. Idempotent per `userId` |
| `POST /v1/social/admin/house/{id}/capital` | `{amount (signed), key?, note}` | `{balance, txn}`: top-up or withdrawal (limited to the withdrawable amount) of house capital |
| `POST /v1/social/admin/house/{id}/retire` | `{note, withdrawCapital?}` | stops every follower (copied positions closed), hides the master and closes it (status `rejected`, "Retired house account"); with `withdrawCapital` the free balance goes back to house capital and the account is disabled |

House capital counts as an external flow in the return index (like a deposit), so it never shows as performance.

Errors use the standard shape. Social codes: `not_master`, `master_status`, `requirements`, `fee_out_of_range`, `own_subscription`, `min_allocation`, `wallet_unavailable`, `wallet_rejected`, `fund_frozen`, `min_investment`, `locked`, `insufficient_units`, `request_done`, `copy_managed`, `copy_account`, `pamm_account`.

## MAM (multi-account manager)

A MAM manager is an approved social master (same application, KYC and review as copy / PAMM) who runs a **MAM programme**: one dedicated **MAM master account** and any number of **linked client accounts**. Code: `src/social/mam.rs` (lifecycle, allocation, fees, guard, views), `src/social/allocation.rs` (pure maths), `src/api/mam.rs` (routes), `migrations/20260929190000_mam.sql`.

- **Master account.** Opening a programme opens a live account for the manager in the system group `mam` (hedging, not offered in the open-account wizard), optionally funded from the manager's wallet. The manager trades it in Kalks Trader like any account. Every **opening** trade on it is a **block**: a market fill, a pending order, or volume added. The master account needs its own margin for the block (decision: it is a real, funded account, so the manager has capital at risk and the whole existing execution path is reused; a virtual block account would need a second execution model).
- **Linking (consent).** A client links one of their **own live hedging accounts** in the Client Area. They must send the SHA-256 `termsHash` of the programme's current terms and `accept: true`; the engine refuses a stale hash (`terms_changed`). The link stores the full consent text (terms + account + user + time), the hash, IP and user agent, and the fee terms the client accepted (later programme changes apply to new links only). Netting accounts, demo accounts, system accounts (`copy`, `copy-netting`, `pamm`, `mam`), copy-trading master accounts and accounts already managed cannot be linked. The programme's `minEquity` applies. A manager cannot link to their own programme.
- **Authority.** The manager has trading authority only. No MAM route moves money, and the engine's free-margin rule keeps every withdrawal above the margin of open positions. The client keeps trading their own positions next to the MAM trades.
- **Allocation.** The copier taps the master account's committed events (the same tap as copy trading). For each block it reads every active link's equity and balance, computes the split with `allocation::allocate`, then mirrors the whole master transaction into each linked account's shard (`mirror::mirror` with `MirrorCfg::mam`: key prefixes `mp`/`mo`/`mx`, source `mam`, platform `MAM`). The methods are:

  | Method | Lots for account *i* |
  |---|---|
  | `equity` | block × equity*ᵢ* ÷ Σ equity (accounts with equity ≤ 0 get nothing and are left out of the sum) |
  | `balance` | block × balance*ᵢ* ÷ Σ balance |
  | `multiplier` | block × the link's multiplier (0.01–100, set by the manager per account) |
  | `percent` | block × the link's percent ÷ 100 (0.01–1000, set by the manager per account) |

  Every result is capped at the link's max lot and the symbol's max lot and rounded **down** to the lot step. Below the symbol's minimum lot the account is skipped for that block. For `equity` / `balance` the rounding remainder is reported as `unallocated` and not redistributed (no account ever gets more than its share). Closes, partial closes (same fraction of each account's own position, `math::close_volume`), SL/TP / trailing changes, pending-order price / expiry changes and cancels follow exactly as in copy trading. The volume of an allocated pending order is not changed when the manager changes the master order's volume. A link created after a master event gets nothing from it.
- **Audit.** Each block writes one `mam_allocations` row: action, master ticket, symbol, side, block, method, executed volume, and per account `{linkId, login, equity, balance, value, maxLot, basis, raw, volume, reason, status, ticket, message}`. Every step on every linked account is in `mam_log`. Both tables are append-only.
- **Terminal guard.** On a linked account, a terminal close / modify / cancel of a MAM position or order, a Close By involving one, an OCO with one, and a bulk close while MAM trades are open are refused with 422 `mam_managed` and a readable message naming the programme. Once the link has ended, the leftover MAM trades are ordinary trades again.
- **Risk.** Each link has a max lot per trade and an equity stop. The guard loop (every 2 s) closes the link's MAM trades and stops the link (`stopped`, `equity_stop`) when equity ≤ the stop. Client trades are never touched. **Emergency stop** (Back Office) freezes a programme: no new blocks are allocated (closes on the master still close the MAM trades), optionally closing every MAM trade on every linked account now.
- **Revoke.** The client revokes at any time. The per-link flag is cleared first, so an allocation already queued behind it does nothing. The client chooses to close the MAM trades at market or keep them, and the fees due up to that moment are settled.
- **Fees** (per link, on the terms the client accepted, settled by the scheduler at the period end at 00:00 server time, and on revoke / stop):
  - performance fee = pct × max(0, R − HWM), where R is the cumulative **MAM result** of the account since the link: closed MAM deals (price P&L + swap − commission) plus floating P&L of open MAM positions (USD). Then HWM = max(HWM, R). The fee is not a MAM trade, so it does not lower R: the next period pays only on new gains. The client's own trades never count.
  - management fee = pct a year × equity × elapsed seconds ÷ (365 days), from the last settlement.
  - The total is capped at the account's free margin (withdrawable). The cap is applied to the performance fee first; the HWM still moves to R.
  - Both are debited from the client account (`perf_fee` ledger kind, `house:perf_fees` / `house:mgmt_fees`) and recorded in `social_fees` with `source='mam'`, `link_id`, `perf_amount`, `mgmt_amount`. They go through the same approval as copy / PAMM fees: approve pays the manager's wallet (wallet kind `mam_fee`) minus the platform cut; reject refunds the client's wallet.
- **IB.** The IB service never pays commission on group `mam` (reason `mam_master`, hard-coded in `services/ib/src/calc.rs`). The block traded on the master account is traded again on the linked client accounts, and those deals are what IBs are paid on. Counting both would pay the same volume twice.

**Client Area routes** (`X-Kalks-User-Id` from the BFF):

| Method & path | Body | Response |
|---|---|---|
| `GET /v1/social/mam/managers` | – | `{items: ManagerView[]}` (active, visible programmes; `track` = the master's own track record) |
| `GET /v1/social/mam/managers/{id}` | – | `{manager, terms:{text, hash}, accounts: Candidate[], own}` |
| `GET /v1/social/mam/links` | – | `{items: LinkView[], accounts: Candidate[]}` (the caller's links) |
| `POST /v1/social/mam/links` | `{managerId, login, termsHash, accept:true, maxLot?, equityStop?}` | `{link}`; `terms_changed`, `not_eligible`, `own_programme`, `manager_status` |
| `GET /v1/social/mam/links/{id}` | – | `{link, positions, orders, deals, log, fees, terms}` (MAM trades only; `terms` = the consent text) |
| `PATCH /v1/social/mam/links/{id}` | `{maxLot?, equityStop?}` (`null` clears) | `{link}` |
| `POST /v1/social/mam/links/{id}/revoke` | `{closePositions?}` | `{closed, failed, fee, link}` |
| `GET /v1/social/mam/manager` | – | `{master, settings, manager, totals, links (logins masked), allocations, fees, terms}` |
| `POST /v1/social/mam/manager` | `{name, description?, method, perfFeePct, mgmtFeePct?, feePeriod, minEquity?, seed?}` | `{manager, credentials:{login, password, investorPassword, funding}}` |
| `PATCH /v1/social/mam/manager` | `{name?, description?, method?, perfFeePct?, mgmtFeePct?, feePeriod?, minEquity?}` | `{manager}` (method only while no account is linked) |
| `PATCH /v1/social/mam/manager/links/{id}` | `{value}` | `{link}` (multiplier / percent programmes; audited `social.mam.value`) |
| `GET /v1/social/mam/manager/preview?symbol&volume` | – | `{symbol, block, method, lotStep, lotMin, allocated, unallocated, rows[]}` |
| `GET /v1/social/mam/manager/allocations?limit` | – | `{items: Allocation[]}` |
| `GET /v1/terminal/mam?symbol&volume` (terminal session) | – | `{role:"manager", manager, accounts, equity, preview, recent}` \| `{role:"client", link, manager}` \| `{role:null}` |

**Back Office routes** (staff headers; writes need `ROLES_SOCIAL_WRITE` and a `note`, audited as `social.mam.*`):

| Method & path | Body | Response |
|---|---|---|
| `GET /v1/social/admin/mam/managers` | – | `{items: ManagerView + {login, userId, totals}[], feesPending}` |
| `GET /v1/social/admin/mam/links?managerId&status&limit` | – | `{items: LinkView + {userId, consent:{ip, userAgent, hash, at}}[]}` |
| `GET /v1/social/admin/mam/allocations?managerId&limit` | – | `{items: Allocation[]}` (full logins) |
| `POST /v1/social/admin/mam/managers/{id}/emergency` | `{freeze, closePositions?, note}` | `{manager, result:{closed, failed}}` |
| `POST /v1/social/admin/mam/links/{id}/stop` | `{closePositions?, note}` | `{link, result}` |

MAM fees appear in `GET /v1/social/admin/fees` (`source:"mam"`, `linkId`, `perfAmount`, `mgmtAmount`) and are approved with `POST /v1/social/admin/fees/{id}/review`. Client consent and revocation are also written to `audit_log` (`social.mam.link`, `social.mam.revoke`, actor `user:<id>`).

## Streams

Browsers connect directly with a one-time ticket, so the internal token never reaches the browser. The flow is:

1. The BFF calls `POST /v1/terminal/stream-ticket` (with the session bearer) or `POST /v1/dealing/stream-ticket` (with the staff headers) and gets back `{ticket, expiresIn:30}`.
2. The browser opens `wss://trade.<domain>/engine/stream?ticket=…` or `wss://admin.<domain>/engine/stream?ticket=…`. Caddy maps these to `/v1/terminal/stream` and `/v1/dealing/stream`. Locally, use `ws://127.0.0.1:8090/v1/terminal/stream?ticket=…`.

The terminal stream sends these frames:

| Frame | When / contents |
|---|---|
| `{type:"snapshot", readOnly, account, positions[], orders[]}` | first frame |
| `{type:"position", op:"upsert", position}` / `{type:"position", op:"remove", ticket}` | open, modify, partial close, swap, trailing move / close |
| `{type:"order", op:"upsert", order}` / `{type:"order", op:"remove", ticket, status, reason}` | placed, modified, triggered / filled, cancelled, expired, rejected |
| `{type:"deal", deal}` | every entry or exit deal |
| `{type:"ledger", txn:{id, kind, amount, at}}` | every balance / credit / bonus change |
| `{type:"account", account}` | after every change |
| `{type:"notification", kind, message, data}` | `fill`, `close`, `sl`, `tp`, `order_triggered`, `order_filled`, `order_cancelled`, `order_rejected`, `order_expired`, `margin_call`, `stop_out`, `nbp`, `swap`, `balance`, `close_by` |
| `{type:"equity", login, balance, credit, bonus, profit, swap, equity, margin, freeMargin, marginLevel, withdrawable, positions:[{ticket, price, profit, swap}]}` | at most every 250 ms while prices move |
| `{type:"hb", t}` | every 5 s |
| `{type:"resync", skipped}` | the client fell behind; reload `GET /v1/terminal/state` |

The dealing stream sends `snapshot` (`positions` as DeskPosition[], `orders` as DeskOrder[]), `position` / `order` deltas in desk shapes, `deal` (DeskDeal), `audit` (AuditEntry), and `{type:"pnl", items:[{ticket, price, profit}]}` every second.

## How the apps integrate

| App | Integration |
|---|---|
| **Kalks Trader (terminal)** | `/login` posts `{login, password}` through its BFF to `POST /v1/terminal/login` and keeps the token in an HttpOnly cookie. The `sso?token=` route calls `POST /v1/terminal/sso`. It loads `GET /v1/terminal/state`, then opens the stream with a ticket. Trading actions map 1:1 to `/v1/terminal/*`. When `readOnly` is set, the UI hides trade actions; the server rejects them anyway. Prices for charts still come from market-data with the account's `groupName`/spread group. |
| **Client Area (CRM)** | Open account wizard: `GET /v1/groups`, `POST /v1/accounts`. Accounts page: `GET /v1/accounts?user_id=`. Portfolio pages: `/history`, `/ledger`. Demo refill, password change (after email OTP), leverage. The Trade button calls `POST /v1/accounts/{login}/sso` and redirects to `trade.<domain>/sso?token=`. Always send the signed-in gateway user id. |
| **Back Office** | A `RestTradingDesk` implementing `TradingDeskApi` maps each method to the dealing routes above, forwarding the staff headers from the gateway session. Hydrate with `GET /v1/dealing/state` + the dealing stream. The audit page uses `GET /v1/dealing/audit`. Accounts pages use `/v1/admin/accounts*`. The group builder uses `/v1/admin/groups`. Spread markups stay in market-data (`/v1/admin/spreads`); a group's `spreadGroup` is the market-data group code. |
| **Wallet service (future)** | `POST /v1/ledger/transfers` with its own idempotency keys (for example the wallet ledger entry id). Treat `409 idempotency_conflict` as a bug and `422 insufficient_funds` as a user error. Look up `GET /v1/ledger/transfers/{key}` when the outcome is unknown after a timeout. |

## Environment

| Variable | Default | |
|---|---|---|
| `TRADING_BIND` | `127.0.0.1:8090` | |
| `TRADING_DATABASE_URL` | `postgres://postgres@127.0.0.1:5433/kalks_trading` | created and migrated on first start |
| `TRADING_INTERNAL_TOKEN` | – | required when `TRADING_ENV=production` |
| `TRADING_SESSION_SECRET` | – | ≥ 32 chars; HMAC key for session / SSO / stream-ticket hashes |
| `TRADING_ENV` | `development` | `production` requires the internal token |
| `MARKET_DATA_WS_URL` | `ws://127.0.0.1:8081/v1/stream` | `?group=` is appended per spread group |
| `INSTRUMENTS_FILE` / `TRADING_SPECS_FILE` | `config/instruments.json` / `config/trading-specs.json` | |
| `TRADING_SHARDS` | `8` | account shards (single-writer tasks) |
| `TRADING_MAX_QUOTE_AGE_SECS` | `300` | 0 disables the stale-price check |
| `TRADING_SESSION_TTL_HOURS` | `12` | terminal sessions |
| `TRADING_LOG_FORMAT` | `json` | `json` (structured) or `pretty` |
| `TRADING_ROLLOVER` | `true` | only one engine instance may run rollovers |
| `WALLET_URL` | `http://127.0.0.1:8095` | wallet service (copy allocations, PAMM invest / redeem, fee payouts) |
| `WALLET_INTERNAL_TOKEN` | – | sent as `X-Kalks-Internal` to the wallet |
| `IB_URL` / `IB_INTERNAL_TOKEN` | `http://127.0.0.1:8096` / – | IB service (PAMM lots allocated to investors) |
| `RUST_LOG` | `info,sqlx=warn` | |

The config is logged at start with every secret and the DB password redacted.

Production runs `deploy/systemd/kalks-trading.service`, which reads the root `.env.local` and binds to 127.0.0.1:8090. `deploy/deploy.sh` builds and restarts it. On first deploy it generates the missing `TRADING_*` secrets on the server and derives `TRADING_DATABASE_URL` from `GATEWAY_DATABASE_URL`, using the database `kalks_trading`.

## Tests

```bash
cargo test -p trading
```

- **Unit tests.** Specs and sessions (the same weekend and US-equity cut-offs as market-data), DST rollover instants, and swap nights including the triple day.
- **Engine tests.**
  - P&L and hedging: hedging P&L and margin, hedged margin %, USDJPY / cross conversion, cent USC maths.
  - Netting: add, reduce and reversal; close-only reduction.
  - Closing: partial close (swap and commission split), Close By, SL/TP, trailing stop.
  - Orders: limit / stop / stop-limit, OCO, Today expiry, weekend `market_closed` while BTC trades, requote, free-margin check.
  - Risk: margin call, stop-out closing the largest loser first, then NBP. Swaps: triple Wednesday, weekend, crypto daily, swap-free, and a position opened after the rollover.
  - Dealing and accounts: book transfer (full + split), reopen / void / price correction, halt / close-only / max-lot / disabled gates, duplicate `clientOrderId`, demo refill cap, leverage only when flat, withdrawable with credit.
- **Property tests (proptest).** Random operation sequences run on hedging, netting and cent accounts. After every step they check:
  - every ledger transaction balances, and Σ of all postings is 0 per currency;
  - balance = Σ postings;
  - no flat account has a negative balance;
  - netting accounts hold one position per symbol;
  - replaying the event log gives exactly the live state.
  They also check that a close done in two parts matches a close done at once, within 0.01.
- **API tests.** Investor sessions are read-only, order body parsing (clients cannot claim the `dealer` source), and PATCH null semantics.
- **Social tests.**
  - `social::math`: sizing modes, proportional adds and partial closes, HWM copy fee with deposits and withdrawals, NAV / units, the rollover plan (fee as units, NAV unchanged, blended HWM, master share, deferred redemptions), return index, drawdown, monthly returns, risk score anchors.
  - `social::tests`: a master and a follower through the real engine: opens with SL/TP, SL change, partial close, full close, pending place / modify / cancel / fill both ways, netting add and reversal, exclusions, pause, fixed-lot and multiplier with max lot, idempotency (the same master event twice executes once), equity stop / drawdown and close-all, and follower replay + ledger.
  - `social::allocation`: equity / balance share, rounding down to the lot step with the remainder reported, the minimum lot, accounts without equity, account and symbol max lot, multiplier and percent, the MAM performance fee above the HWM and the pro-rata management fee.
  - `tests/mam.rs` (PostgreSQL): a MAM programme through the real shards, tap and copier. Stale consent refused; a 0.50 block split 0.30 / 0.20 by equity with the allocation audit row; the terminal guard refuses MAM tickets and a bulk close but allows the client's own trade; partial and full close follow; exact performance fee (20 % of +300 = 60) with the balance after the debit; revoke settles the other link's fee and the next block goes only to the remaining account; the equity stop closes the MAM trade and stops the link; replay of every account and balanced ledger.
  - `tests/social.rs` (PostgreSQL): shards + tap + copier + a mock wallet. It covers mirroring with the right size, partial close, the fee above HWM, stop and return of funds, a PAMM seed → invest → rollover → profit → fee + redemption with exact figures, units = Σ unit ledger, and replay of every account from `events`.
- **Integration test** (`tests/replay.rs`). This runs against a throw-away database `kalks_trading_test_<pid>` on the local Postgres; it is skipped when Postgres is unreachable. It runs trades, reversal, pending fills, a partial close, a book split, swaps, a demo refill and credit through the shards. It then checks that `replay_all` from the `events` table equals the live state. It also checks the database guarantees: a reused ledger idempotency key is refused, an unbalanced transaction cannot commit, and `events` / `ledger_postings` are append-only.

## Known gaps

- **Social.**
  - The copier is one task that mirrors followers one after another. That is fine for hundreds of followers per master; fan-out per follower shard is the next step.
  - A hedging master's dealer "add volume" is mirrored as a dealer-style add, so that deal carries source `dealer`, not `copy`.
  - Book splits of a master position (A/B transfer of part of a ticket) are not mirrored.
  - A PAMM rollover posts its ledger in the fund's shard, then writes the unit ledger in a second database transaction. If the engine stops between the two, that rollover must be reconciled by hand. The error is logged with the plan.
  - Master KYC comes from the CRM BFF (`X-Kalks-Kyc`), not from a call to the gateway.
- **MAM.**
  - Linked accounts must be hedging accounts. A netting account would net the manager's trades with the client's own on the same symbol.
  - Allocation reads each linked account's equity once per block, one account after another, and executes the accounts one after another (like copy trading). The shares therefore come from a snapshot taken a few milliseconds before execution.
  - The rounding remainder of `equity` / `balance` allocations is not redistributed (reported as `unallocated`).
  - The MAM result counts MAM positions opened after the link started. MAM trades left open after an earlier link to another manager are not part of the new link's result.
  - Changing the volume of a master pending order does not resize the allocated pending orders.

- **A-book.** A-book routing is recorded and the LP adapter is called, but the only adapter is `NullLp` (not connected), so every trade is executed internally.
- **Routing conditions.** Rules on risk score, hold time, win rate, news window, country or equity never match yet.
- **Swaps.** Swaps are in points only (no percentage or money mode). There is no admin fee for swap-free groups (D19 optional fee). There is no holiday calendar, and sessions do not cover NSE/MCX.
- **Snapshots.** Replay reads the whole event table on start; periodic snapshots are the next step for large books.
- **Tick cost.** A tick clones the account state for every account holding that symbol. That is fine at current scale; a read-only pre-check would avoid the clone.
- **Bonus rules.** Bonus is a separate sub-ledger that counts toward equity. Lot-based bonus release (D29) is not implemented, and credit is not removed on stop-out.
- **Excluded features.** Prop-firm rules, the public API key auth (the source tag is recorded), FIX, dynamic margin schedules (weekend or news), exposure limits, and price-freeze / spike filter hooks (D116) are not included.
- **Demo expiry.** A demo account expires by inactivity (last terminal login). The admin can also set `expired` or `active` directly.
- **Scaling.** Commands are served before ticks. This is correct for a single engine instance, but there is no multi-instance leader election yet: run exactly one engine per database.
