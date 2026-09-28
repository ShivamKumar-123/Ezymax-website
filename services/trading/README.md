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
- **Integration test** (`tests/replay.rs`). This runs against a throw-away database `kalks_trading_test_<pid>` on the local Postgres; it is skipped when Postgres is unreachable. It runs trades, reversal, pending fills, a partial close, a book split, swaps, a demo refill and credit through the shards. It then checks that `replay_all` from the `events` table equals the live state. It also checks the database guarantees: a reused ledger idempotency key is refused, an unbalanced transaction cannot commit, and `events` / `ledger_postings` are append-only.

## Known gaps

- **A-book.** A-book routing is recorded and the LP adapter is called, but the only adapter is `NullLp` (not connected), so every trade is executed internally.
- **Routing conditions.** Rules on risk score, hold time, win rate, news window, country or equity never match yet.
- **Swaps.** Swaps are in points only (no percentage or money mode). There is no admin fee for swap-free groups (D19 optional fee). There is no holiday calendar, and sessions do not cover NSE/MCX.
- **Snapshots.** Replay reads the whole event table on start; periodic snapshots are the next step for large books.
- **Tick cost.** A tick clones the account state for every account holding that symbol. That is fine at current scale; a read-only pre-check would avoid the clone.
- **Bonus rules.** Bonus is a separate sub-ledger that counts toward equity. Lot-based bonus release (D29) is not implemented, and credit is not removed on stop-out.
- **Excluded features.** Prop-firm rules, copy/PAMM mirroring, the public API key auth (the source tag is recorded), FIX, dynamic margin schedules (weekend or news), exposure limits, and price-freeze / spike filter hooks (D116) are not included.
- **Demo expiry.** A demo account expires by inactivity (last terminal login). The admin can also set `expired` or `active` directly.
- **Scaling.** Commands are served before ticks. This is correct for a single engine instance, but there is no multi-instance leader election yet: run exactly one engine per database.
