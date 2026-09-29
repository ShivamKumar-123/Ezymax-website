# market-data

Rust service that owns Kalks price data: live Infoway feed → broker-standard candles in our own Postgres → charts and quotes for every app.

## How candles are kept identical to the market

- **Raw price only.** Candles are built from the raw provider price. Group spreads are applied to outgoing quotes only, never to stored bars. This matches every broker's charts.
- **M1–H1** open on exact UTC boundaries.
- **H4, D1, W1, MN** are cut at New York close: server time is GMT+3 while US DST is active, GMT+2 otherwise, and weeks start Sunday 00:00 server time. This is the MT4/MT5 broker standard. They are aggregated from our H1 bars (W1/MN from D1).
- **Reconciler.** Each closed M1/M5/M15/M30/H1 bar is replaced by the provider's final OHLC, 4s and again 40s after it closes (source = 3, final). Late or missed ticks can therefore never leave a candle different from the market. Closed H4/D1/W1/MN buckets are then rebuilt from the corrected bars.
- **Backfill.** Any provider bar that has already closed is stored as final, so restarts and gaps heal themselves.
- **Stocks** only count ticks during the regular session (09:30–16:00 New York), like the exchange candles. Extended-hours prints are ignored.

Verified 2026-09-25 against Infoway klines for all 27 symbols:
- M1: 518/518 identical
- M15: 194/194 identical
- H1: 140/140 identical
- H4/D1/W1: 637/637 equal to the aggregate of their source bars

## Run locally

```bash
# Postgres: any PostgreSQL 16 listening on port 5433, e.g. a dedicated local cluster
pg_ctl -D <datadir> -o "-p 5433" -l <datadir>/pg.log start
# service (reads INFOWAY_* from the repo-root .env.local); creates the DB + runs migrations on first start
cargo run -p market-data            # http://127.0.0.1:8081
cargo test -p market-data
```

Config env vars (with defaults) are listed in `src/config.rs`. The instrument list is in `config/instruments.json`. USDINR is not carried by Infoway.

## API

| Endpoint | |
|---|---|
| `GET /health` | provider streams, ticking symbols, stale symbols |
| `GET /v1/instruments` | instrument catalogue |
| `GET /v1/quotes?symbols=EURUSD,XAUUSD&group=standard` | latest bid/ask with the group's spread markup |
| `GET /v1/candles?symbol=EURUSD&tf=H1&limit=500&to=<unix>` | ascending bars `{t,o,h,l,c,v}` (t = unix secs); the latest page includes the forming bar |
| `GET /v1/history/status` | stored bars per symbol/timeframe |
| `GET/PUT /v1/admin/spreads` | spread markups per group/symbol (`Authorization: Bearer $MARKET_DATA_ADMIN_TOKEN`); body `{group_code, symbol ("*" = all), markup_points, min_spread_points}` |
| `GET /v1/depth?symbol=XAUUSD&group=standard&levels=10` | depth of market `{src, t, bids, asks}` (levels best first, `[price, lots]`) |
| `WS /v1/stream?group=pro` | send `{"op":"subscribe","symbols":[..]}` → `{"type":"quote","s","b","a","l","t"}`; `{"op":"bars","symbol","tf"}` → `{"type":"bar","s","tf","t","o","h","l","c","v"}`; `{"op":"depth","symbols":[..],"levels"?:10}` → `{"type":"depth","s","src","t","b":[[p,lots]..],"a":[..]}` on every quote change (`unsubscribe` / `unbars` / `undepth` to stop) |

Timeframes: `M1 M5 M15 M30 H1 H4 D1 W1 MN`.

## History depth (free plan, 1 req/s)

| Timeframe | Default depth | Setting |
|---|---|---|
| M1 | 14 days | `BACKFILL_DAYS_M1` |
| M5 | 60 days | `BACKFILL_DAYS_M5` |
| M15 | 180 days | `BACKFILL_DAYS_M15` |
| M30 | 1 year | `BACKFILL_DAYS_M30` |
| H1 | 3 years | `BACKFILL_DAYS_H1` |
| D1 | back to 2012 | `BACKFILL_DAILY_FROM` |

- **Phase 1:** the latest 500 bars per timeframe for all symbols (about 3 minutes).
- **Phase 2:** deep history, resumable, in the background.
- **After that:** the live feed and reconciler keep every timeframe growing permanently.

## Depth of market (D97)

Kalks Trader's ladder is served here (`src/depth.rs`), with the account group's spread markup applied like quotes:

- **Feed** (`src: "feed"`): when the provider's depth stream carries several priced levels (and they are under 5 s old), those levels are shown, moved outwards by the group markup.
- **Indicative** (`src: "indicative"`): otherwise (Infoway sends only the top of book for FX and metals) levels step out from the live bid/ask by half the instrument's typical spread; sizes follow a fixed per-asset-class liquidity profile, scaled down when the raw spread is wider than typical. Deterministic: the same quote gives the same ladder. The terminal labels it Indicative.
- Relay mode (local development) asks the upstream for provider depth only (`"src":"feed"`) and never opens a provider connection.

