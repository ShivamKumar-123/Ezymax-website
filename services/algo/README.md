# algo

The Kalks ALGO service: strategies (visual builder spec and a safe Python-like DSL), an AI assistant (natural language to strategy, D87), a server-side backtester (D80, D86), a 24/7 strategy runtime on demo and live accounts (D81), webhook signals with fan-out (D85), the public REST API with API keys (D77, D78), kill switches and source tags (D84), and the strategy marketplace (D83).

It is a Rust service (axum 0.8, sqlx 0.9, PostgreSQL) on `127.0.0.1:8099`.

- [Run locally](#run-locally)
- [Architecture](#architecture)
- [Strategy language (DSL)](#strategy-language-dsl)
- [Backtester](#backtester)
- [Runtime](#runtime)
- [Webhooks](#webhooks)
- [Public API](#public-api)
- [Marketplace](#marketplace)
- [House accounts](#house-accounts)
- [Internal API](#internal-api)
- [Environment](#environment)
- [Tests](#tests)
- [Known gaps](#known-gaps)

## Run locally

Before you start, you need:

- PostgreSQL on `127.0.0.1:5433` (user `postgres`, trust auth);
- market-data on `:8081`;
- the trading engine on `:8090`.

```bash
cargo build -p algo
(cd services/algo && nohup ../../target/debug/algo > ~/.kalks-local/algo.log 2>&1 &)
curl -s localhost:8099/health
cargo test -p algo
```

On first start the service creates the `kalks_algo` database and runs `migrations/`.

It reads `ALGO_*`, `TRADING_*`, `WALLET_*` and `MARKET_DATA_URL` from the repo-root `.env.local`, and `ANTHROPIC_API_KEY` from the repo-root `.env.claude`. None of these files are committed.

The CRM and Back Office BFFs need two variables in their `.env.local`: `ALGO_URL` (default `http://127.0.0.1:8099`) and `ALGO_INTERNAL_TOKEN`.

## Architecture

```
 CRM BFF (/api/algo/*) ─┐  X-Kalks-Internal + X-Kalks-User-Id
 Admin BFF (/api/algo/*)┤  X-Kalks-Internal + X-Kalks-Staff-*          ┌── market-data :8081 (candles, quotes)
                        ▼                                               │
                  algo :8099 ── strategies / versions (immutable)      ├── trading engine :8090
                        │       backtest queue (N workers, SKIP LOCKED) │     Client Area routes (X-Kalks-User-Id)
 TradingView ──► /hooks/{token}  runtime (bar scheduler + manage tick) │     terminal API via one-time SSO sessions
 API clients ──► /public/v1/*    webhooks, API keys, marketplace       └── wallet :8095 (subscription payments)
                        │
                  PostgreSQL kalks_algo
```

- **One evaluator.** Visual specs compile to the same expression tree as DSL code (`dsl::from_spec`). The backtester and the runtime run the same vectorised evaluator (`dsl::eval`) on closed bars, so a deployed strategy fires where its backtest did.
- **Indicators.** `src/indicators.rs` ports the terminal's TypeScript maths (`apps/terminal/lib/indicators.ts`, `lib/ai-trader/series.ts`). `tests/indicator_parity.rs` checks all 32 series against values the TypeScript code produced for the same bars (`tools/gen-parity.mjs` regenerates the fixture).
- **Orders.** Orders go through the engine's documented terminal API, on a session from the one-time SSO flow (`POST /v1/accounts/{login}/sso`, then `POST /v1/terminal/sso`). Every normal check applies: margin, sessions, dealer controls, max lot. Each order carries a source tag: `strategy` (with `S<deployment id> <name>` in the comment), `webhook` (`WH<webhook id>`) or `api`. It also carries an idempotent `clientOrderId`.
- **No trading engine changes.** The service uses only the APIs in `services/trading/README.md`.

Source layout:

| Path | |
|---|---|
| `src/spec.rs` | visual strategy spec (the AI Trader schema, extended) and its validation |
| `src/dsl/` | lexer/parser (`parse.rs`), compiler to `Node` trees (`mod.rs`), evaluator with deadline (`eval.rs`) |
| `src/indicators.rs`, `src/specs.rs` | indicator maths; contract specs, sessions, server time |
| `src/backtest/` | simulation (`sim.rs`), metrics and report (`metrics.rs`, `mod.rs`), job queue and data loading (`jobs.rs`) |
| `src/runtime.rs` | 24/7 runtime: bar scheduler, order placement, closes booking, breakeven, session close-out |
| `src/ai.rs` | Claude NL → spec / code |
| `src/api/` | internal API (strategies, backtests, deployments, webhooks, keys, market, admin) and public API |
| `src/clients.rs` | market-data, engine and wallet clients |

## Strategy language (DSL)

The language is Python-like but contains expressions only. It is interpreted in the service; it is not compiled to native code and has no access to anything outside the bars it is given (D82).

```python
# settings (calls)
name("EMA trend H1")
symbol("EURUSD")
timeframe("H1")
lots(0.10)                        # or risk(1.0) = % of balance, needs a stop loss
stop_loss(atr=2, period=14)       # pips= points= price= percent= atr= level=
take_profit(rr=2)                 # same, or rr= multiple of the stop
trailing(pips=15)                 # points= pips= atr=, period=
breakeven(trigger=150, offset=10) # points
session("08:00", "17:00")         # server time (GMT+2 / GMT+3)
days(1, 2, 3, 4, 5)               # 0 = Sunday
max_trades_per_day(3); max_daily_loss(200); one_at_a_time(true); close_outside_session(true)

# signals (assignments), evaluated on each closed bar
fast = ema(close, 20)
slow = ema(close, 50)
buy = crosses_above(fast, slow) and rsi(close, 14) < 70 and htf("H4", close > ema(close, 50))
sell = crosses_below(fast, slow)
exit_buy = close < slow
exit_sell = close > slow
```

**Functions.**

- Moving averages: `sma` `ema` `wma` `rma`.
- Oscillators: `rsi` `cci` `willr` `momentum` `roc` `stoch_k` `stoch_d`.
- MACD: `macd` `macd_signal` `macd_hist`.
- Bollinger: `bb_upper` `bb_middle` `bb_lower` `stddev`.
- Volatility and trend: `atr` `adx` `plus_di` `minus_di`.
- Extremes: `highest` `lowest` (of the N previous bars).
- Maths: `change` `crosses_above` `crosses_below` `crosses` `abs` `min` `max` `sqrt` `round` `nz`.
- Higher timeframe: `htf(tf, expr)`.
- Candle patterns: `bullish()` `bearish()` `bullish_engulfing()` `bearish_engulfing()` `hammer()` `shooting_star()` `doji()` `inside_bar()`.

**Fields.** `open high low close volume hl2 hlc3 ohlc4`, plus `hour minute weekday` in server time. `x[n]` is the value n bars ago.

**Logic.** `and or not`, `a if c else b`, comparisons, `+ - * / %`.

**Semantics.**

- Every expression is a series.
- NaN means "not ready" and propagates through every operator, so nothing fires during warm-up.
- A signal fires when its value on the closed bar is non-zero.
- `htf` uses the last higher-timeframe bar that had closed when the strategy bar closed, so there is no look-ahead.
- If `buy` and `sell` are both true on the same bar, the signal is skipped.

**Sandbox limits.** Every limit is enforced and tested (`dsl/parse.rs`, `dsl/mod.rs`, `dsl/eval.rs` tests):

| Limit | Value |
|---|---|
| source | 20 000 characters, 200 statements |
| nesting depth | 48 |
| expression size after inlining names | 4 000 nodes (an exponential `a = b + b` chain is rejected) |
| periods / history index | 1–1000 / 0–1000, constants only |
| `htf` | 8 timeframes, at or above the strategy timeframe, not nested |
| names | defined once, before use (no recursion); built-ins can't be reassigned |
| not in the grammar | loops, `def`, `lambda`, `import`, attribute access, dunder names, I/O |
| time | the evaluator checks a deadline: 3 s per bar in the runtime, `ALGO_BACKTEST_SECS` for a whole backtest |

## Backtester

Jobs are rows in `backtests`. `ALGO_BACKTEST_WORKERS` workers claim them with `FOR UPDATE SKIP LOCKED`; after a restart, running jobs are re-queued. Progress is written to the row while the simulation runs on a blocking thread.

**Data.**

- Bars come from market-data `GET /v1/candles`, paged back through the range with a warm-up before it.
- If the strategy timeframe's history starts after the requested start, the older part is built from lower timeframes where they exist: M1–H1 on UTC boundaries, H4 and D1 at New York close. The report's `coverage.segments` shows which source was used and where.
- Higher timeframes used through `htf` are loaded the same way.
- M1 bars, where they exist, drive the intrabar model.

**Model** (see the header of `src/backtest/sim.rs`):

- Signals come from closed bars. Orders fill at the next bar's open, exits before entries.
- Bars are the raw mid price. The bid is bar − spread/2 and the ask is bar + spread/2.
- The spread is the account group's current quote (group from `login` or `group`). If no quote is available, the catalogue base spread is used. A fixed `spreadPoints` can override both.
- SL, TP, trailing stop and breakeven are simulated on an OHLC path: bullish bars go O→L→H→C, bearish bars O→H→L→C. The path runs through every M1 bar when M1 history exists, like MT5's 1-minute OHLC model. A level gapped through fills at the gap price.
- Commission uses the group's round-turn rate or the symbol override, charged at entry.
- Swaps are charged at every rollover, using `config/trading-specs.json` with the triple day and weekend rules. They are skipped for swap-free groups.
- P&L is converted to USD at the exit price for USD-base pairs, and at the current rate for crosses.

**Report.** The report contains:

- metrics: net profit, return, CAGR, profit factor, win rate overall and long/short, average and largest win/loss, expectancy, payoff, max consecutive wins/losses, max drawdown (absolute and %), recovery factor, Sharpe and Sortino (daily, √252), exposure, commission, swap and spread cost;
- the equity, balance and drawdown curve (≤ 1500 points, keeping lows);
- monthly returns per year;
- the trade list (≤ 5000), with MAE / MFE;
- signal counts, skipped signals with their reasons, the model used, coverage, costs and notes.

**Limits.**

- Range per timeframe: M1 60 days, M5 1 year, M15 2 years, M30 3 years, H1 5 years, H4 10 years, D1+ 20 years.
- At most 400 000 bars per job.
- 3 queued or running jobs per user; `backtestsPerDay` per user.
- CPU budget per job: `ALGO_BACKTEST_SECS`.

## Runtime

**Deploying.** `POST /v1/deployments {strategyId, versionId?, login, risk?}` runs an exact, immutable version on one of the user's accounts. The optional `risk` object takes `lotMultiplier`, `maxLots`, `maxOpenPositions` and `maxDailyLoss`.

**Bar scheduler.**

- Running deployments are grouped by (symbol, timeframe).
- For each group, the candles are fetched 3 s after the bar closes.
- Every deployment in the group is evaluated once per closed bar (`last_bar_t`). The first evaluation after a deploy is a warm-up that logs only.

**Order path.**

- Kill switches and pause are checked first, then rule exits.
- Entry filters: trading window, market session, daily trade limit, daily loss (realized + floating), one at a time / max open, netting conflicts.
- Stop distances use the account group's quote and ATR on the closed bars.
- Volume: risk sizing, then the lot multiplier, then the caps, then a floor to the lot step.
- The market order is sent with `source: "strategy"` and `clientOrderId = algo-<deployment>-<bar>-<side>`.
- The engine runs SL, TP and trailing server-side (`trailingPoints`).

**Management tick (3 s).**

- Books closes from the engine's deals, net of swap and commission, into `deployment_positions` and `deployment_daily`.
- Moves stops to breakeven.
- Closes positions outside the trading window when `close_outside_session` is set.

**Kill switches (D84).**

| Switch | Effect |
|---|---|
| Deployment | `POST /v1/deployments/{id}/kill`, or `stop {closePositions}` |
| User | `POST /v1/controls/kill {killed, closePositions}`. Stops every deployment and blocks webhooks and API trading. With `closePositions` it also closes all `strategy`, `webhook` and `api` positions on the user's accounts |
| Platform | Admin setting `globalKill`, optionally closing every deployment's positions |

Logs are stored per deployment with a level and a kind: `eval`, `signal`, `order`, `close`, `manage`, `error` and `info`.

## Webhooks

**URLs.** `POST /hooks/wh_…` is exposed publicly as `https://api.kalkstrade.com/algo/hooks/wh_…`. Only a SHA-256 of the token is stored. An optional passphrase is also stored hashed.

**Body.** A JSON body of at most 16 KB, TradingView style:

```json
{"passphrase":"…","action":"buy|sell|close|close_buy|close_sell","symbol":"OANDA:EUR/USD","volume":0.1,
 "sl":1.08,"tp":1.1,"sl_pips":20,"tp_pips":40,"sl_points":…,"tp_points":…,"comment":"…","id":"{{timenow}}-1","timestamp":"{{timenow}}"}
```

- `market_position: "flat"` also closes.
- Symbols are normalised: exchange prefixes and separators are removed. Each route can also map symbols with `symbolMap`.

**Fan-out (D85).** Each webhook has up to 10 routes, one per account the user owns. Each route has its own sizing:

- `fixed` (lots);
- `alert` (the alert's volume);
- `multiplier` (the alert's volume × value);
- `risk` (% of balance; needs a stop loss in the alert);

plus an optional `maxLots`. Close actions close only the positions this webhook opened, found by source `webhook` and a `WH<id>` comment.

**Replay protection.**

- An `id` or `nonce` is accepted once per webhook.
- A body with a `timestamp` must be within 5 minutes of the server clock, and the same body is accepted once.
- A body with neither is accepted once per minute.

**Rate limits.** `webhookRatePerMin` per URL (default 30) and 120 per minute per IP. Every alert is logged in `webhook_events` with its per-route results.

## Public API

The base URL is `https://api.kalkstrade.com/algo/public/v1` (locally `http://127.0.0.1:8099/public/v1`). `GET /public/v1/openapi.json` returns the OpenAPI document.

| Method & path | Scope | |
|---|---|---|
| `GET /account` | read | balance, equity, margin |
| `GET /positions`, `GET /orders` | read | open positions / pending orders |
| `GET /history?from&to&page&limit` | read | closed deals |
| `GET /quotes?symbols=EURUSD,XAUUSD` | read | bid/ask with the account's spread |
| `POST /orders` | trade | `{symbol, side, type?, volume, price?, stopLimit?, sl?, tp?, trailingPoints?, expiry?, clientOrderId?}` → `source: "api"` (cannot be overridden) |
| `PATCH /positions/{ticket}` | trade | `{sl?, tp?, trailingPoints?}` |
| `POST /positions/{ticket}/close` | trade | `{volume?}` |
| `DELETE /orders/{ticket}` | trade | |

**Keys (D78).** Each key belongs to one trading account and has:

- scopes `read` and/or `trade` (`trade` implies read; withdrawals are never possible);
- an IP whitelist of exact addresses or IPv4 CIDR ranges (required for trading keys on live accounts);
- an optional expiry and a per-key rate limit (default: tenant `apiRatePerMin`);
- a request log.

The secret is `HMAC(ALGO_KEY_SECRET, key_id:salt)`. It is shown once and never stored, so a database leak alone does not reveal or forge keys.

**Authentication.**

```bash
# bearer
curl -H "Authorization: Bearer $KEY_ID:$SECRET" https://api.kalkstrade.com/algo/public/v1/account
# HMAC (each signature accepted once, timestamp ±30 s)
TS=$(date +%s000); BODY='{"symbol":"EURUSD","side":"buy","volume":0.1}'
SIG=$(printf '%s' "${TS}POST/public/v1/orders${BODY}" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')
curl -X POST -H "X-Kalks-Key: $KEY_ID" -H "X-Kalks-Timestamp: $TS" -H "X-Kalks-Signature: $SIG" -H 'content-type: application/json' -d "$BODY" http://127.0.0.1:8099/public/v1/orders
```

The HMAC signs the path as the service sees it, `/public/v1/…`, without the `/algo` edge prefix.

## Marketplace

**Publishing.** An author publishes an exact version with `POST /v1/market/listings`. The track record must come from their own deployment of that strategy, with at least `minTrackTrades` closed trades. It is computed only from the engine's closed deals.

**Listings.** A listing is free, or has a monthly price in USDT. It starts `pending` until a moderator sets it to approved, rejected or suspended in the Back Office.

**Subscribing.** A subscriber either:

- copies the listing: the version runs on their own account as a deployment tied to the subscription, and the rules stay hidden unless the author allows cloning; or
- clones it, when the author allows that: the spec becomes one of the subscriber's own strategies.

**Payments.** The service calls the wallet's `POST /v1/wallets/transfers` with kind `adjustment` (refunds use kind `refund`):

- it debits the subscriber the price, with key `algo:sub:<id>:<period>:debit`;
- it credits the author the price minus `platformCutPct`, with key `…:credit`.

If the copy can't start, the first period is refunded. A renewal loop runs every 5 minutes and charges each new 30-day period. A failed charge sets `past_due` and stops the copy. A cancelled paid subscription runs until the end of its period.

**Reviews.** Only subscribers can post reviews: one per user, rated 1–5.

## House accounts

House accounts are platform-owned accounts that give copy trading and the marketplace real content at launch. The founder can switch them on and off from the Back Office (**Social & Algo → House accounts**, permission `social.read` to view and `social.write` to change).

**The honesty rule.** Each house account is a real live trading account on the real engine running a real strategy through this runtime on live market data. Its leaderboard statistics, profile and marketplace track record are computed only from what it actually trades, from the moment it is provisioned. Nothing is backfilled: no trades, equity, followers, AUM or history are written by this feature. The backtest is stored and shown, but only ever labelled as a backtest.

**Disclosure.** Clients see every house account labelled **"House strategy · Operated by Kalks"**: on the leaderboard, the master profile (with an explanation box), the copy dialog, their subscription cards and the marketplace listing card and detail. The engine exposes the flag as `house: true` on the master view and on the subscription's master; this service exposes it as `house: true` on listings.

**What provisioning creates** (`src/house.rs`, one step at a time, resumable after a failure):

| Step | Service | Result |
|---|---|---|
| 1. House user | gateway `POST /v1/internal/house-users {key, nickname}` | a `users` row with `is_house = true`, e-mail `house-<key>@<tenant>.house.invalid`, an unusable password hash. It cannot sign in (also refused explicitly), and is left out of client lists, client counts and the referral / reports sync |
| 2. Account, capital, master | engine `POST /v1/social/admin/house` | a live account in the `standard` group; the capital booked as ledger kind `house_capital` (`house:house_capital` ↔ balance), not a deposit; an **approved** master with `is_house = true`, program `copy`, 0 % performance fee |
| 3. Strategy | here | the preset's DSL stored as the house user's strategy (origin `template`) |
| 4. Backtest | here | a backtest job over the preset's range (capped by the timeframe limit and the history available), at the account's group costs |
| 5. Deployment | here, `deployments::start` | the normal runtime deployment on the live account: same order path and checks as any client |
| 6. Listing | here | a free marketplace listing, `is_house = true`, `allow_clone = true`, track record = the deployment's closed deals; auto-approved because the broker is the author |

House masters skip the client application checks (KYC, 30-day track, own capital): the broker operates them, and the profile shows their real age from day 0.

**Presets** (`PRESETS` in `src/house.rs`). Every preset sizes by risk % of balance with a stop loss on every trade, trades one position at a time, caps entries per day and stops for the day at a loss of 2 % of the starting capital (`max_daily_loss`).

| Preset | Market | Idea | Risk / trade |
|---|---|---|---|
| Gold Trend H1 | XAUUSD H1 | 21/55 EMA cross with ADX > 20, 2 ATR stop, 2R target | 0.5 % |
| EURUSD Reversion M15 | EURUSD M15 | RSI(14) back through 30/70 with the 200 EMA, 1.5 ATR stop, 1.5R | 0.4 % |
| BTC Breakout H4 | BTCUSD H4 | 20-bar Donchian breakout, 10-bar exit, 3 ATR trailing | 0.5 % |
| NAS100 Momentum H1 | NAS100 H1 | MACD signal cross with trend filter, US session | 0.5 % |
| GBPUSD Band Reversion | GBPUSD M30 | Bollinger (20, 2) re-entry with RSI confirmation while ADX < 22, exit at the middle band | 0.4 % |
| USDJPY ATR Trend | USDJPY H1 | 10/30 EMA cross with the 50/200 trend, 2.5 ATR trailing, no target | 0.5 % |
| London Breakout | EURUSD M15 | break of the 6-hour pre-London range, 10:00–13:00 server time, one trade a day | 0.4 % |
| ETH Trend Pullback | ETHUSD H1 | pullback to the 20 EMA in a 20/50/200 EMA trend, candle confirmation | 0.5 % |
| AUDUSD Range Stoch | AUDUSD M15 | Stochastic (14, 3) cross beyond 20 / 80 while ADX < 20 | 0.3 % |
| US30 Dual Trend | US30 H1 | H4 20/50 EMA trend, H1 20 EMA re-cross with RSI, US session | 0.5 % |

**Switches.** Each account has `enabled` (on/off) and `visible` (leaderboard and marketplace), and the tenant has a master switch. `on = master switch && enabled`.

- Off: the deployment is paused (no new entries; open positions keep their SL/TP), the master is hidden from the leaderboard and the listing is unlisted. Optionally the open positions are closed at market; followers' copies close with them through normal mirroring. Existing followers are not stopped.
- On: the deployment runs; the master and the listing are shown when `visible`.
- Capital: top-up or withdrawal (negative) as `house_capital` through the engine.
- Delete: stops the deployment and closes its positions, unlists the listing, and in the engine stops every follower, closes the master profile (status `rejected`, note "Retired house account") and by default withdraws the remaining balance and disables the account. The ledger history stays.
- Retry: resumes a failed provisioning, or redeploys an active account whose deployment was stopped or killed (the listing's track then starts from the new deployment).

A kill switch (deployment, user or platform) applies to house accounts like to anyone else.

**Audit.** Every action is written to this service's `audit_log` (`house.*`, target `house:<id>`); the engine writes `social.house.provision|capital_topup|capital_withdraw|retire` and `social.master.hide|unhide` entries to its own audit log with the staff member and the note.

**Production seeding.** One click: Back Office → Social & Algo → House accounts → **Provision all 10** (asks for the capital per account and a note). The same as `POST /v1/admin/house/seed {capital, note}` with staff headers. It only creates presets that are missing, so it is safe to press again.

**Reports.** House capital is ledger kind `house_capital`. The reports service counts only `deposit` / `withdrawal` ledger rows and wallet deposits as money in / out, so house capital never appears in deposit, withdrawal or FTD reports. House users are not synced as clients. House accounts do appear in trading-account and book reports (they are real accounts trading on the `standard` group).

**Routes** (admin, staff headers; writes need a note and `platform_owner | super_admin | admin | risk_manager`):

| Method & path | Body | |
|---|---|---|
| `GET /v1/admin/house` | – | `{settings, items, presets, totals}` |
| `GET /v1/admin/house/{id}` | – | the account, its backtest report, runtime log, strategy positions, source and audit |
| `POST /v1/admin/house` | `{preset, capital?, note}` | provision one preset |
| `POST /v1/admin/house/seed` | `{capital?, note}` | provision every missing preset |
| `PUT /v1/admin/house/settings` | `{enabled, closePositions?, note}` | master switch |
| `POST /v1/admin/house/{id}/switch` | `{enabled, closePositions?, note}` | on / off |
| `POST /v1/admin/house/{id}/visibility` | `{visible, note}` | leaderboard and marketplace |
| `POST /v1/admin/house/{id}/capital` | `{amount, note}` | top-up (negative = withdraw) |
| `POST /v1/admin/house/{id}/retry` | `{note}` | resume / redeploy |
| `POST /v1/admin/house/{id}/delete` | `{note, withdrawCapital?}` | retire |

The service reads `GATEWAY_URL` (default `http://127.0.0.1:8080`) and `GATEWAY_INTERNAL_TOKEN` from the repo-root `.env.local` to create house users.

## Internal API

Every `/v1/*` route needs `X-Kalks-Internal: $ALGO_INTERNAL_TOKEN`. JSON uses camelCase keys, and errors are `{"error": {"code", "message", ...}}`.

- **Client routes** need `X-Kalks-User-Id` (the gateway user id) and optionally `X-Kalks-User-Name` (percent-encoded).
- **Admin routes** need `X-Kalks-Staff-Id`, `X-Kalks-Staff-Name` and `X-Kalks-Staff-Role`. Admin writes need a `note` for the audit log.

| Area | Routes |
|---|---|
| builder | `GET /v1/meta` (symbols, indicators, DSL reference) · `POST /v1/validate {kind, spec | source, symbol?, timeframe?}` → `{valid, errors[{line?, col?, message}], warnings, spec, code, summary}` · `POST /v1/ai/strategy {prompt, symbol, timeframe, target: visual|code, current?}` |
| strategies | `GET/POST /v1/strategies` · `GET/PATCH /v1/strategies/{id}` · `POST /v1/strategies/{id}/versions` · `GET /v1/strategies/{id}/versions/{vid}` |
| backtests | `GET/POST /v1/backtests` `{strategyId, versionId?, from, to, initialBalance, login? | group?, spreadPoints?, commissionPerLot?, swaps?}` · `GET /v1/backtests/{id}` (report) · `POST /v1/backtests/{id}/cancel` |
| runtime | `GET /v1/accounts` · `GET/POST /v1/deployments` · `GET /v1/deployments/{id}` (logs, positions, daily) · `POST /v1/deployments/{id}/{pause|resume|stop|kill|close-positions}` · `GET /v1/controls` · `POST /v1/controls/kill` |
| webhooks | `GET/POST /v1/webhooks` · `GET/PATCH/DELETE /v1/webhooks/{id}` · `POST /v1/webhooks/{id}/rotate` · `PUT /v1/webhooks/{id}/routes` · `POST /v1/webhooks/{id}/test {payload}` |
| API keys | `GET/POST /v1/keys` · `PATCH /v1/keys/{id}` · `POST /v1/keys/{id}/revoke` · `GET /v1/keys/{id}/activity` |
| marketplace | `GET/POST /v1/market/listings` · `GET/PATCH /v1/market/listings/{id}` · `POST /v1/market/listings/{id}/subscribe {mode, login?, risk?}` · `POST /v1/market/listings/{id}/reviews` · `GET /v1/market/mine` · `GET /v1/market/subscriptions` · `POST /v1/market/subscriptions/{id}/cancel` |
| admin | `GET /v1/admin/overview` · `GET /v1/admin/strategies` · `GET /v1/admin/deployments` · `POST /v1/admin/deployments/{id}/kill` · `POST /v1/admin/users/{id}/kill` · `GET/PUT /v1/admin/settings` (`globalKill`, `platformCutPct`, `apiRatePerMin`, `webhookRatePerMin`, `maxDeploymentsPerUser`, `minTrackTrades`, `aiPerHour`, `backtestsPerDay`) · `GET /v1/admin/listings` · `POST /v1/admin/listings/{id}/moderate` · `GET /v1/admin/keys` · `POST /v1/admin/keys/{id}/revoke` · `GET /v1/admin/webhooks` · `GET /v1/admin/subscriptions` · `GET /v1/admin/audit` |

## Environment

| Variable | Default | |
|---|---|---|
| `ALGO_BIND` | `127.0.0.1:8099` | |
| `ALGO_DATABASE_URL` | `postgres://postgres@127.0.0.1:5433/kalks_algo` | created and migrated on first start |
| `ALGO_INTERNAL_TOKEN` | – | required when `ALGO_ENV=production` |
| `ALGO_KEY_SECRET` | dev placeholder | ≥ 32 chars in production; HMAC master for API key secrets (rotating it invalidates every key) |
| `ALGO_ENV` | `development` | |
| `ALGO_PUBLIC_URL` | `http://127.0.0.1:8099` | shown for webhook URLs and the API base (production: `https://api.kalkstrade.com/algo`) |
| `ALGO_WORKERS` | `true` | run the runtime, backtest workers and renewals (exactly one instance) |
| `ALGO_BACKTEST_WORKERS` / `ALGO_BACKTEST_SECS` | `2` / `120` | |
| `ALGO_AI_MODEL` | `claude-opus-5-5` | |
| `ANTHROPIC_API_KEY` | – | from `.env.claude`; without it the AI endpoint answers 503 |
| `TRADING_URL`, `TRADING_INTERNAL_TOKEN` | `http://127.0.0.1:8090` | |
| `MARKET_DATA_URL` | `http://127.0.0.1:8081` | |
| `WALLET_URL`, `WALLET_INTERNAL_TOKEN` | `http://127.0.0.1:8095` | paid subscriptions |
| `GATEWAY_URL`, `GATEWAY_INTERNAL_TOKEN` | `http://127.0.0.1:8080` | house users (house accounts) |
| `ALGO_LOG_FORMAT` | `json` | or `pretty` |

Production runs `deploy/systemd/kalks-algo.service`. `deploy/deploy.sh` does the following:

- builds and restarts the service;
- generates `ALGO_INTERNAL_TOKEN` and `ALGO_KEY_SECRET` once;
- derives `ALGO_DATABASE_URL` from `GATEWAY_DATABASE_URL` (database `kalks_algo`);
- copies the Claude key from the terminal's production env into `.env.claude` if it is missing;
- writes `ALGO_URL` / `ALGO_INTERNAL_TOKEN` into the CRM and admin production env.

Caddy exposes only `/algo/hooks/*` and `/algo/public/v1/*` on `api.kalkstrade.com`.

## Tests

```bash
cargo test -p algo
```

| Area | What is tested |
|---|---|
| Indicator parity (`tests/indicator_parity.rs`) | 32 series (SMA, EMA, RSI, MACD ×3, Bollinger ×3, ATR, Stochastic ×2, highest/lowest, WMA, CCI, Williams %R, momentum, ROC, std dev, ADX ×3, 8 candle patterns) match the TypeScript values to 1e-9 relative |
| DSL | Parsing; rejecting unsafe syntax (import/def/lambda/loops/attributes/dunders); depth, size, statement and exponential-inlining limits; semantic errors with line numbers; visual spec ↔ code round trip; NaN propagation; `htf` without look-ahead; the evaluation deadline |
| Backtest | A take-profit trade with exact P&L / commission / spread cost; the M1 path deciding SL before TP where the H1 bar alone would give TP; a gap fill at the open; triple-Wednesday swaps; trailing stop; daily trade limit; drawdown; monthly returns; H1 / D1 aggregation at NY close |
| Service (`tests/service.rs`) | Throw-away database plus mock engine, market-data and wallet; skipped without Postgres. Covers webhook auth (unknown URL, passphrase, id and timestamp replay, rate limit, disabled, kill switch, fan-out sizing, source tags), API keys (bearer, wrong secret, HMAC + replay + stale timestamp, scopes, IP whitelist, revoke, expiry, dealing fields stripped, source not overridable), and paid marketplace subscriptions (insufficient funds, debit / credit with the 20 % platform cut, own listing, pending listing, reviews) |

## Known gaps

- **Sandbox.** The DSL is an interpreted expression language. It is not WASM (D82 said "compiled to WASM"); the grammar, the limits and the deadline make it safe. User-defined functions, loops and state across bars are intentionally absent.
- **Data.** Tick data is not available (D80 "tick-level later"). The intrabar model uses M1 bars where market-data has them (14 days locally by default) and bar OHLC elsewhere. Margin and stop-out are not modelled in backtests.
- **Runtime.** Evaluation runs on closed bars only; the terminal's `exitIntrabar` option is not supported server-side. The runtime polls candles, not the WebSocket. One instance must run the workers (no leader election).
- **Positions.** Breakeven is applied by the management tick (every 3 s), not on every tick. Positions on netting accounts opened by other sources block new strategy entries on that symbol.
- **Conversion.** Cross-currency conversion in backtests uses the current rate for non-USD quote currencies.
- **Wallet.** The wallet has no dedicated transfer kind for subscriptions yet, so `adjustment` is used with an `algo-sub-<id>` reference; a `strategy_subscription` kind would make wallet reports clearer. If the author's credit fails, it is logged but not retried automatically.
- **House accounts.** They offer copy trading and the marketplace, not PAMM: a house PAMM fund would need the strategy to trade the fund account and a seed from a house wallet. The daily loss limit is sized to the starting capital and does not follow later top-ups. Provisioning is synchronous (the Back Office waits for up to ten presets).
- **Protocols.** FIX 4.4 and a WebSocket API (D77) are not part of this service yet. The REST API covers the account, orders, positions, history and quotes.
