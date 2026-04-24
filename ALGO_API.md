# TrustEdge Algo Trading API

Connect any algo bot / EA / script / trading dashboard to a TrustEdge trading account over a simple HTTPS JSON API.

### Endpoints at a glance

| Method | URL                                        | Purpose                                      |
|--------|--------------------------------------------|----------------------------------------------|
| POST   | `https://api.trustedgefx.com/api/algo/trade`   | Place a BUY / SELL / CLOSE order             |
| GET    | `https://api.trustedgefx.com/api/algo/account` | Read balance, equity, margin                 |
| GET    | `https://api.trustedgefx.com/api/algo/symbols` | List every supported instrument              |
| GET    | `https://api.trustedgefx.com/api/algo/price`   | Live bid/ask snapshot for one symbol         |
| GET    | `https://api.trustedgefx.com/api/algo/prices`  | Live bid/ask snapshot for many symbols       |
| GET    | `https://api.trustedgefx.com/api/algo/bars`    | Historical OHLC bars (1m–1d)                 |
| WS     | `wss://api.trustedgefx.com/ws/algo/prices`     | Live tick stream (all symbols, push)         |

**Market data = same feed as the TrustEdge web platform.** Whatever the internal charts show, your bot sees — same LP source, same spread, same timestamps.

> **Host note:** all algo endpoints live on the `api.` subdomain (`api.trustedgefx.com`). The main `trustedgefx.com` host serves the web frontend and proxies REST requests to the gateway, but it **cannot** handle WebSocket connections — the `wss://` stream must use `api.trustedgefx.com` directly.

---

## 1. Authentication

Every request must include these headers:

| Header          | Value                          |
|-----------------|--------------------------------|
| `X-Api-Key`     | Your API key (public part)     |
| `X-Api-Secret`  | Your API secret (private part) |
| `Content-Type`  | `application/json` (for POST)  |

Each key is linked to **one trading account**. Keep the secret private — anyone with it can place trades on that account.

Generate / rotate keys from your TrustEdge dashboard.

---

## 2. Place a Trade (BUY / SELL)

Opens a market order instantly at the current price.

### Request body

```json
{
  "action": "BUY",
  "symbol": "XAUUSD",
  "volume": 0.1,
  "sl": 4750,
  "tp": 4850,
  "comment": "My EA v1"
}
```

### Fields

| Field     | Type   | Required | Description                                    |
|-----------|--------|----------|------------------------------------------------|
| `action`  | string | yes      | `"BUY"` or `"SELL"`                            |
| `symbol`  | string | yes      | Instrument symbol, e.g. `"XAUUSD"`, `"EURUSD"` |
| `volume`  | number | yes      | Lot size (min `0.01`)                          |
| `sl`      | number | no       | Stop Loss price                                |
| `tp`      | number | no       | Take Profit price                              |
| `comment` | string | no       | Free-text tag on the trade                     |

### Success response (200)

```json
{
  "status": "filled",
  "action": "BUY",
  "symbol": "XAUUSD",
  "lots": 0.1,
  "price": 4812.45,
  "position_id": "c0a8...",
  "order_id": "7b1f...",
  "account": "100245"
}
```

---

## 3. Close Positions (CLOSE)

Closes **all open positions** for the given symbol on the linked account.

### Request body

```json
{
  "action": "CLOSE",
  "symbol": "XAUUSD"
}
```

### Success response (200) — positions closed

```json
{
  "status": "closed",
  "symbol": "XAUUSD",
  "account": "100245",
  "closed_count": 2,
  "total_profit": 37.80
}
```

### Success response (200) — nothing to close

```json
{
  "status": "no_positions",
  "symbol": "XAUUSD",
  "account": "100245",
  "message": "No open XAUUSD positions to close"
}
```

---

## 4. Account Info (balance, equity, margin)

```
GET https://api.trustedgefx.com/api/algo/account
```

No request body. Just send the auth headers. Returns the current state of the trading account linked to your API key.

### Success response (200)

```json
{
  "account": "100245",
  "currency": "USD",
  "leverage": 100,
  "balance": 10000.00,
  "credit": 0.00,
  "equity": 10037.80,
  "margin_used": 120.50,
  "free_margin": 9917.30,
  "margin_level": 8335.26,
  "is_demo": false,
  "open_positions": 2
}
```

### Fields

| Field            | Type    | Description                                                   |
|------------------|---------|---------------------------------------------------------------|
| `account`        | string  | Trading account number                                        |
| `currency`       | string  | Account currency (e.g. `"USD"`)                               |
| `leverage`       | number  | Account leverage (e.g. `100` = 1:100)                         |
| `balance`        | number  | Closed P/L balance                                            |
| `credit`         | number  | Bonus / credit added to the account                           |
| `equity`         | number  | `balance + credit + floating P/L`                             |
| `margin_used`    | number  | Margin currently locked by open positions                     |
| `free_margin`    | number  | Margin available for new trades (`equity - margin_used`)      |
| `margin_level`   | number  | `(equity / margin_used) * 100` — `0` when no positions open   |
| `is_demo`        | boolean | `true` for demo accounts                                      |
| `open_positions` | number  | Count of currently open positions on the account              |

---

## 5. Error responses

| Status | Meaning                         | Example `detail`                        |
|--------|---------------------------------|-----------------------------------------|
| 400    | Bad input                       | `"volume required for BUY/SELL"`        |
| 400    | Below minimum lot               | `"Minimum lot size is 0.01"`            |
| 400    | Bad timeframe                   | `"timeframe must be one of: 1m, 5m, 15m, 30m, 1h, 4h, 1d"` |
| 400    | Bad limit                       | `"limit must be between 1 and 1000"`    |
| 400    | Too many symbols                | `"symbols list cannot exceed 50 items"` |
| 400    | Not enough free margin          | `"Insufficient margin"`                 |
| 401    | Missing headers                 | `"Missing X-Api-Key or X-Api-Secret"`   |
| 401    | Wrong key/secret                | `"Invalid API credentials"`             |
| 403    | Account disabled                | `"Trading account is inactive"`         |
| 404    | Unknown symbol                  | `"Instrument XAUUSD not found"`         |
| 503    | No live price yet (fresh feed)  | `"No price data for XAUUSD"`            |

Error body format:

```json
{ "detail": "Invalid API credentials" }
```

---

## 6. Example — cURL

### BUY

```bash
curl -X POST https://api.trustedgefx.com/api/algo/trade \
  -H "X-Api-Key: YOUR_KEY" \
  -H "X-Api-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"BUY","symbol":"XAUUSD","volume":0.1,"sl":4750,"tp":4850}'
```

### CLOSE

```bash
curl -X POST https://api.trustedgefx.com/api/algo/trade \
  -H "X-Api-Key: YOUR_KEY" \
  -H "X-Api-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"CLOSE","symbol":"XAUUSD"}'
```

### Account info

```bash
curl https://api.trustedgefx.com/api/algo/account \
  -H "X-Api-Key: YOUR_KEY" \
  -H "X-Api-Secret: YOUR_SECRET"
```

---

## 7. Example — Python

```python
import requests

BASE = "https://api.trustedgefx.com/api/algo"
HEADERS = {
    "X-Api-Key": "YOUR_KEY",
    "X-Api-Secret": "YOUR_SECRET",
    "Content-Type": "application/json",
}

# Account info
r = requests.get(f"{BASE}/account", headers=HEADERS)
print(r.status_code, r.json())

# BUY
r = requests.post(f"{BASE}/trade", headers=HEADERS, json={
    "action": "BUY",
    "symbol": "XAUUSD",
    "volume": 0.1,
    "sl": 4750,
    "tp": 4850,
})
print(r.status_code, r.json())

# CLOSE
r = requests.post(f"{BASE}/trade", headers=HEADERS, json={
    "action": "CLOSE",
    "symbol": "XAUUSD",
})
print(r.status_code, r.json())
```

---

## 8. Market Data — Symbol List

```
GET https://api.trustedgefx.com/api/algo/symbols
```

No body. Send the standard auth headers. Returns every instrument the platform supports along with its trading spec. Call this once at bot startup and cache the result — it doesn't change often.

### Success response (200)

```json
{
  "symbols": [
    {
      "symbol": "XAUUSD",
      "display_name": "Gold / US Dollar",
      "category": "commodity",
      "digits": 2,
      "min_lot": 0.01,
      "max_lot": 100,
      "lot_step": 0.01,
      "contract_size": 100
    },
    {
      "symbol": "EURUSD",
      "display_name": "Euro / US Dollar",
      "category": "forex_major",
      "digits": 5,
      "min_lot": 0.01,
      "max_lot": 100,
      "lot_step": 0.01,
      "contract_size": 100000
    }
    // ...
  ],
  "count": 29
}
```

---

## 9. Market Data — Single-symbol snapshot

```
GET https://api.trustedgefx.com/api/algo/price?symbol=XAUUSD
```

Current bid/ask for one symbol, served from Redis (sub-millisecond). Safe to poll at up to a few per second.

### Success response (200)

```json
{
  "symbol": "XAUUSD",
  "bid": 2650.45,
  "ask": 2650.60,
  "spread": 0.15,
  "timestamp": "2026-04-24T14:35:22.123Z"
}
```

### Errors

| Status | Meaning                                |
|--------|----------------------------------------|
| 404    | `Instrument XYZABC not found`          |
| 503    | `No price data for XAUUSD` (fresh — wait for next tick) |

---

## 10. Market Data — Multi-symbol snapshot

```
GET https://api.trustedgefx.com/api/algo/prices?symbols=XAUUSD,EURUSD,BTCUSD
```

One call for many symbols. `symbols` is optional — omit it to receive every supported instrument.

- Max 50 symbols per request.
- Symbols with no current tick are silently **omitted** (not an error). Cross-check against `/symbols` if you need a full list.

### Success response (200)

```json
{
  "prices": [
    { "symbol": "XAUUSD", "bid": 2650.45, "ask": 2650.60, "spread": 0.15,   "timestamp": "2026-04-24T14:35:22.123Z" },
    { "symbol": "EURUSD", "bid": 1.0823,  "ask": 1.0824,  "spread": 0.0001, "timestamp": "2026-04-24T14:35:22.119Z" },
    { "symbol": "BTCUSD", "bid": 67234.5, "ask": 67241.2, "spread": 6.7,    "timestamp": "2026-04-24T14:35:22.130Z" }
  ],
  "count": 3
}
```

### Errors

| Status | Meaning                                          |
|--------|--------------------------------------------------|
| 400    | `symbols list cannot exceed 50 items`            |
| 404    | `Unknown instrument(s): FAKE1,FAKE2`             |

---

## 11. Market Data — Historical OHLC bars

```
GET https://api.trustedgefx.com/api/algo/bars?symbol=XAUUSD&timeframe=1m&limit=500
```

### Query params

| Param       | Required | Description                                                 |
|-------------|----------|-------------------------------------------------------------|
| `symbol`    | yes      | Instrument symbol                                           |
| `timeframe` | yes      | One of `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`           |
| `limit`     | no       | Number of bars (default `100`, max `1000`)                  |

Bars are returned **newest first**. Up to 1000 most-recent bars are kept per (symbol, timeframe) — older history is rolled off.

### Success response (200)

```json
{
  "symbol": "XAUUSD",
  "timeframe": "1m",
  "bars": [
    { "time": "2026-04-24T14:35:00Z", "open": 2650.45, "high": 2650.80, "low": 2650.30, "close": 2650.60, "volume": 1247 },
    { "time": "2026-04-24T14:34:00Z", "open": 2650.10, "high": 2650.50, "low": 2649.95, "close": 2650.45, "volume":  982 }
  ],
  "count": 500
}
```

### Errors

| Status | Meaning                                          |
|--------|--------------------------------------------------|
| 400    | `timeframe must be one of: 1m, 5m, 15m, 30m, 1h, 4h, 1d` |
| 400    | `limit must be between 1 and 1000`               |
| 404    | `Instrument XYZABC not found`                    |

---

## 12. Market Data — Live tick stream (WebSocket)

```
wss://api.trustedgefx.com/ws/algo/prices
```

The easiest way to keep a bot's internal state in sync with the market — the server pushes every tick as soon as the LP delivers it. Same data the internal TrustEdge charts use.

### Authentication (first-message)

Auth is **not** in the URL (so secrets never hit server logs). Connect first, then send an auth message within 5 seconds:

```json
{ "action": "auth", "api_key": "YOUR_KEY", "api_secret": "YOUR_SECRET" }
```

On success, the server replies once:

```json
{ "status": "authenticated", "account": "100245" }
```

…and then ticks start flowing.

### Tick shape

```json
{ "type": "tick", "symbol": "XAUUSD", "bid": 2650.45, "ask": 2650.60, "spread": 0.15, "timestamp": "2026-04-24T14:35:22.123Z" }
```

All 29 supported symbols stream on the same connection — filter client-side for the ones you care about. Typical throughput: ~30–100 ticks/second across all symbols.

### Heartbeat

Every 30 seconds the server sends `{"type": "ping"}`. Client pongs are optional (the connection survives without them), but sending `{"type": "pong"}` back is the standard courtesy.

### Close codes

| Code | Meaning                                                     |
|------|-------------------------------------------------------------|
| 4001 | `auth_timeout` — no first message within 5 seconds          |
| 4002 | `bad_auth_message` — malformed JSON or missing fields       |
| 4003 | `invalid_credentials` — key/secret don't match              |
| 4004 | `account_inactive` — key valid, but trading account disabled |

### Example — Python

```python
import asyncio, json, websockets

async def stream():
    async with websockets.connect("wss://api.trustedgefx.com/ws/algo/prices") as ws:
        await ws.send(json.dumps({
            "action": "auth",
            "api_key":    "YOUR_KEY",
            "api_secret": "YOUR_SECRET",
        }))
        auth = json.loads(await ws.recv())
        if auth.get("status") != "authenticated":
            raise SystemExit(auth)
        print("connected; account:", auth["account"])

        async for raw in ws:
            msg = json.loads(raw)
            if msg.get("type") == "tick":
                print(msg["symbol"], msg["bid"], msg["ask"])
            elif msg.get("type") == "ping":
                await ws.send(json.dumps({"type": "pong"}))

asyncio.run(stream())
```

### Testing in Postman

1. **New → WebSocket Request** (not HTTP).
2. URL: `wss://api.trustedgefx.com/ws/algo/prices` → **Connect**.
3. In the Message box paste and send:
   ```json
   {"action":"auth","api_key":"YOUR_KEY","api_secret":"YOUR_SECRET"}
   ```
4. First message back will be `{"status":"authenticated","account":"..."}`; after that, live ticks stream in.

---

## 13. Rules & notes

- **Execution** is market-only — orders fill at the current ask (BUY) / bid (SELL).
- **Symbol** is case-insensitive (`xauusd` = `XAUUSD`).
- **Minimum lot**: `0.01`.
- **Margin check**: a BUY/SELL is rejected if free margin is not enough — check `/account` first if you want to size trades dynamically.
- **CLOSE** closes every open position for that symbol on the account — partial close is not supported on this endpoint.
- **SL / TP** are optional; you can add/modify them from the dashboard later.
- **`/account`** is read-only and safe to poll, but don't hammer it — once every few seconds is more than enough.
- **Market data endpoints** (`/symbols`, `/price`, `/prices`, `/bars`) share the same auth headers as the trading endpoints — one key, everything.
- **Prefer the WebSocket stream** over polling `/price` or `/prices` — pushes are free, polling is wasted CPU.
- **Bar history** is capped at the most-recent 1000 bars per (symbol, timeframe). Older history is rolled off automatically.
- **Market data matches the TrustEdge web platform** — same LP feed, same spread widening, same timestamps. If your bot shows a different price than the web chart, check your clock sync and timezone handling before blaming the feed.
- Keep the secret out of git, logs, and client-side code. If leaked, rotate it immediately from the dashboard.
