# TrustEdge Algo Trading API

Connect any algo bot / EA / script to a TrustEdge trading account over a simple HTTPS JSON API.

Two endpoints:

| Method | URL                                        | Purpose                              |
|--------|--------------------------------------------|--------------------------------------|
| POST   | `https://trustedgefx.com/api/algo/trade`   | Place a BUY / SELL / CLOSE order     |
| GET    | `https://trustedgefx.com/api/algo/account` | Read balance, equity, margin         |

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
GET https://trustedgefx.com/api/algo/account
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
| 400    | No live price for symbol        | `"No price data for XAUUSD"`            |
| 400    | Not enough free margin          | `"Insufficient margin"`                 |
| 401    | Missing headers                 | `"Missing X-Api-Key or X-Api-Secret"`   |
| 401    | Wrong key/secret                | `"Invalid API credentials"`             |
| 403    | Account disabled                | `"Trading account is inactive"`         |
| 404    | Unknown symbol                  | `"Instrument XAUUSD not found"`         |

Error body format:

```json
{ "detail": "Invalid API credentials" }
```

---

## 6. Example — cURL

### BUY

```bash
curl -X POST https://trustedgefx.com/api/algo/trade \
  -H "X-Api-Key: YOUR_KEY" \
  -H "X-Api-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"BUY","symbol":"XAUUSD","volume":0.1,"sl":4750,"tp":4850}'
```

### CLOSE

```bash
curl -X POST https://trustedgefx.com/api/algo/trade \
  -H "X-Api-Key: YOUR_KEY" \
  -H "X-Api-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"CLOSE","symbol":"XAUUSD"}'
```

### Account info

```bash
curl https://trustedgefx.com/api/algo/account \
  -H "X-Api-Key: YOUR_KEY" \
  -H "X-Api-Secret: YOUR_SECRET"
```

---

## 7. Example — Python

```python
import requests

BASE = "https://trustedgefx.com/api/algo"
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

## 8. Rules & notes

- **Execution** is market-only — orders fill at the current ask (BUY) / bid (SELL).
- **Symbol** is case-insensitive (`xauusd` = `XAUUSD`).
- **Minimum lot**: `0.01`.
- **Margin check**: a BUY/SELL is rejected if free margin is not enough — check `/account` first if you want to size trades dynamically.
- **CLOSE** closes every open position for that symbol on the account — partial close is not supported on this endpoint.
- **SL / TP** are optional; you can add/modify them from the dashboard later.
- **`/account`** is read-only and safe to poll, but don't hammer it — once every few seconds is more than enough.
- Keep the secret out of git, logs, and client-side code. If leaked, rotate it immediately from the dashboard.
