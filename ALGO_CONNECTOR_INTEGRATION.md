# Algo Connector — Full Implementation & Porting Guide

> **Purpose:** everything needed to add the **Algo Connector** feature (same UI + same backend flow) to another white-label project. This is the *implementation* map. For the bot-developer–facing API reference (the doc you hand to whoever writes the trading bot), see **`ALGO_API.md`** — that stays as-is and does not need to change per white-label.

The feature has two halves that share one database table:

| Half | Who calls it | Auth | Purpose |
|------|--------------|------|---------|
| **Key management** (`/api/v1/algo/*`) | The logged-in trader, from the web UI | JWT / session cookie | Generate, list, revoke API keys per trading account |
| **Public algo API** (`/api/algo/*` + `/ws/algo/prices`) | The external bot / EA / script | `X-Api-Key` + `X-Api-Secret` headers | Place trades, read account, stream & fetch market data |

A user generates a key/secret in the UI → pastes it into their bot → the bot hits the public API. One `AlgoApiKey` row links a key pair to exactly one trading account.

---

## 0. File map — what to copy

```
backend/
  packages/common/src/models.py                         → add AlgoApiKey model + algo_api_keys table
  services/gateway/src/api/algo_keys.py                 → user-facing key mgmt (JWT)         [COPY WHOLE FILE]
  services/gateway/src/api/algo_connector.py            → bot trade/account (X-Api-Key)      [COPY WHOLE FILE]
  services/gateway/src/api/algo_market_data.py          → bot market data + WS               [COPY WHOLE FILE]
  services/gateway/src/main.py                          → register the 3 routers + WS route

frontend/trader/src/
  app/algo-connector/page.tsx                           → the UI page                        [COPY WHOLE FILE]
  app/api/algo/[...path]/route.ts                       → proxy /api/algo/* → gateway        [COPY WHOLE FILE]
  app/api/v1/[...path]/route.ts                         → proxy /api/v1/*   → gateway        (already exists in most WLs)
  components/layout/AppSidebar.tsx                      → add the nav link
```

`algo_connector.py` and `algo_market_data.py` depend on the platform's existing pricing/trading internals (Redis tick feed, `Instrument`/`Position`/`Order` models, `trading_service`, `instrument_pricing`, A-book LP forwarding). **If the white-label is a fork of this same codebase, those already exist and the files drop in unchanged.** If it's a different codebase, see §7 for the required primitives.

---

## 1. Database model

`backend/packages/common/src/models.py` — add:

```python
class AlgoApiKey(Base):
    __tablename__ = "algo_api_keys"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id      = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    account_id   = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id", ondelete="CASCADE"))
    api_key      = Column(String(64), unique=True, nullable=False, index=True)
    secret_hash  = Column(String(128), nullable=False)        # SHA-256 of the secret — used for auth
    label        = Column(String(100), default="")
    is_active    = Column(Boolean, default=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    trades_count = Column(Integer, default=0)
    created_at   = Column(DateTime(timezone=True), default=datetime.utcnow)

    user    = relationship("User", lazy="selectin")
    account = relationship("TradingAccount", lazy="selectin")   # eager-load — auth hot path reads account in one query
```

Notes:
- `api_key` is `ak_` + 24 hex bytes; `api_secret` is `as_` + 32 hex bytes (see `algo_keys.py` generators).
- **Auth compares `secret_hash`** (SHA-256), never a stored plaintext. The plaintext secret is returned exactly once, in the `/generate` response body, and is never persisted (alembic 0056 dropped the old `api_secret` column) — a DB dump must not contain working trading credentials. A lost secret means regenerating the key pair.
- `account.lazy="selectin"` is important — the trade hot path (`key_row.account`) must not trigger a second round-trip.

Then create the table (Alembic migration, or `Base.metadata.create_all` on boot — match how the WL manages schema).

---

## 2. Backend — router registration

`backend/services/gateway/src/main.py`:

```python
from .api import (
    # ...existing...
    algo_connector, algo_keys, algo_market_data,
)

# Key management — JWT-authenticated, lives under /api/v1
app.include_router(algo_keys.router,        prefix="/api/v1/algo", tags=["Algo Keys"])

# Public bot API — X-Api-Key authenticated, lives under /api/algo (NOT /api/v1)
app.include_router(algo_connector.router,   prefix="/api/algo",    tags=["Algo Connector"])
app.include_router(algo_market_data.router, prefix="/api/algo",    tags=["Algo Market Data"])

# Live tick WebSocket — registered directly (not via a router prefix)
@app.websocket("/ws/algo/prices")
async def algo_prices_ws_endpoint(websocket: WebSocket):
    await algo_market_data.algo_prices_ws(websocket)
```

**Prefix discipline matters** and is the #1 thing to get right:
- Key management → **`/api/v1/algo`** (so it sits behind the same JWT/cookie auth + proxy as the rest of the app UI).
- Bot API → **`/api/algo`** (no `v1`) — a separate namespace with its own header auth. Bots never send a JWT.

---

## 3. Backend — the three API files

Copy these whole; they're self-contained except for the shared imports noted in §7.

### 3a. `algo_keys.py` — user-facing key management (JWT)

Endpoints (all `Depends(get_current_user)`):

| Method | Path (with prefix) | Purpose |
|--------|--------------------|---------|
| GET  | `/api/v1/algo/keys`     | List the user's keys (no secret) |
| GET  | `/api/v1/algo/accounts` | **UI's main call** — every trading account + its key status/secret |
| POST | `/api/v1/algo/generate` | Create key+secret for an account (returns secret once); revokes any prior active key for that account |
| POST | `/api/v1/algo/revoke`   | Deactivate a key (`is_active=False`) |

Key behaviours:
- **One active key per account** — `generate` flips every prior active key for that account to `is_active=False` before inserting the new one. "Regenerate" in the UI is just calling `generate` again.
- `/accounts` also resolves an `account_type` label (PAMM/MAM/Copy master vs investor vs plain trading account) by cross-checking `MasterAccount` and `InvestorAllocation`. **If the WL has no PAMM/MAM/copy system, delete that block** and hardcode `account_type = "Trading Account"`.
- Generation:
  ```python
  def _gen_api_key():    return "ak_" + secrets.token_hex(24)
  def _gen_api_secret(): return "as_" + secrets.token_hex(32)
  def _hash_secret(raw): return hashlib.sha256(raw.encode()).hexdigest()
  ```

### 3b. `algo_connector.py` — bot trading (X-Api-Key)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/algo/trade`   | `BUY` / `SELL` / `CLOSE` |
| GET  | `/api/algo/account` | balance, equity, margin, leverage, open-position count |

Auth pattern (repeated in every bot endpoint):
```python
secret_hash = _hash_secret(x_api_secret)
key_row = (await db.execute(
    select(AlgoApiKey).where(AlgoApiKey.api_key == x_api_key, AlgoApiKey.is_active == True)
)).scalar_one_or_none()
if not key_row or key_row.secret_hash != secret_hash:
    raise HTTPException(401, "Invalid API credentials")
account = key_row.account                      # eager-loaded
if not account or not account.is_active:
    raise HTTPException(403, "Trading account is inactive")
key_row.last_used_at = datetime.now(timezone.utc)
```

Trade flow highlights (these are the parts a WL must not lose):
- **Fill-price policy:** if the bot passes `price`, fill at that price (mirrors the bot 1:1) **but reject if it deviates >5% from the live tick** (`MAX_ALGO_PRICE_DEVIATION_PCT`) — stops stale/abusive signals opening off-market. No `price` → live tick (`get_open_fill_price`, SPREAD_TIMING-aware).
- **Margin check** against `account.free_margin` before opening.
- **Commission + spread revenue** resolved via `resolve_commission` / `compute_spread_revenue` (same admin ChargeConfig as manual orders) and commission is debited from balance — do not hardcode these to 0 or you silently lose revenue on every algo trade.
- **CLOSE precedence:** `position_id` → `order_id` → `trade_id` (stored as `Order.magic_number`) → else close *all* open positions on the symbol. The `trade_id` = MT5-style magic number so multiple strategies can share one key without wiping each other.
- **A-book LP forwarding:** OPEN/CLOSE forwards to the Corecen LP are *queued during* execution and *fired after commit* (fire-and-forget, own session, demo & B-book skipped). Mirrors `trading_service`. Drop the `_forward_*` helpers if the WL is pure B-book.
- **P&L routing** on close goes through `apply_position_pnl` (master-aware) and writes a `TradeHistory` row with `close_reason="algo_close"`.

### 3c. `algo_market_data.py` — bot market data + WS

| Method | Path | Source |
|--------|------|--------|
| GET | `/api/algo/symbols` | Instruments table (active) |
| GET | `/api/algo/price`   | Redis `tick:SYMBOL` |
| GET | `/api/algo/prices`  | Redis MGET of many `tick:*` (max 50) |
| GET | `/api/algo/bars`    | Redis LIST `bars:SYMBOL:TF` (wrapped object, newest-first) |
| GET | `/api/algo/klines`  | Same LIST, Binance array format `[ts_ms,o,h,l,c,v]`, oldest-first, appends live in-progress bar |
| WS  | `/ws/algo/prices`   | Redis pub/sub `prices` channel, fanned out |

- Shares one auth helper `validate_api_credentials(api_key, api_secret) -> (key_id, account_number)` — reused by both REST and WS.
- **WS handshake:** connect → within 5 s send `{"action":"auth","api_key":...,"api_secret":...}` → server replies `{"status":"authenticated","account":...}` → ticks stream. `{"type":"ping"}` every 30 s. Close codes 4001 timeout / 4002 bad msg / 4003 bad creds / 4004 inactive.
- **The market-data feed is identical to the platform's own charts** (same Redis keys). Nothing WL-specific here as long as the WL already publishes ticks/bars to Redis the same way.

---

## 4. Frontend — the UI page

`frontend/trader/src/app/algo-connector/page.tsx` — copy whole. It's a client component in `DashboardShell` with three sections:

1. **Account selector + Generate/Regenerate/Revoke** — dropdown of accounts; if the selected account `has_key`, shows a "Connected" card with copyable key, masked/reveal secret, trade count & last-used, plus Regenerate + Revoke. Otherwise a single "Generate API Key" button.
2. **Connected Accounts summary** — collapsible list of every account that has a key.
3. **Generated-secret modal** — one-time "Save your credentials" dialog after generate (secret shown once, Copy Both).

It talks to the backend through the shared API client only:
```ts
api.get<{ items: AccountWithKey[] }>('/algo/accounts')     // list
api.post('/algo/generate', { account_id })                 // create/regenerate
api.post('/algo/revoke',  { key_id })                      // revoke
```
The client (`@/lib/api/client`) prepends `/api/v1`, so `/algo/accounts` → `/api/v1/algo/accounts`. **No hardcoded hosts in the page** — keep it that way so it works on any WL domain.

Styling uses the design-token classes (`bg-card`, `text-text-primary`, `border-border-primary`, `bg-accent`, …). If the WL's Tailwind theme uses different token names, swap them; the structure stays.

---

## 5. Frontend — proxies & nav

### 5a. Two proxy routes (Next.js App Router)
- **`app/api/v1/[...path]/route.ts`** — forwards JWT/cookie to the gateway. Most white-labels already have this; the UI's key-management calls ride it. Nothing algo-specific.
- **`app/api/algo/[...path]/route.ts`** — forwards `/api/algo/*` (bot API) to the gateway, passing through `x-api-key` / `x-api-secret`. Copy this file. It exists so a bot can hit `https://<wl-domain>/api/algo/trade` and be proxied to the gateway — though production bots should hit the `api.` subdomain directly (see §6).

Both resolve the gateway origin from env in this priority:
```
TRADER_API_PROXY_TARGET | GATEWAY_URL | INTERNAL_API_URL (strip /api/v1) | NEXT_PUBLIC_GATEWAY_ORIGIN | http://127.0.0.1:8000
```

### 5b. Sidebar nav
`components/layout/AppSidebar.tsx` — add to the nav array:
```ts
{ label: 'Algo Connector', href: '/algo-connector', icon: Plug },   // Plug from lucide-react
```

---

## 6. Hosting / DNS (production)

- Bot REST endpoints work on both the main host (proxied) and the `api.` subdomain. **The `wss://` tick stream must use the `api.` subdomain directly** — the main host's Next proxy cannot upgrade WebSockets. This is spelled out in the "Host note" at the top of `ALGO_API.md`; update the domain there per white-label (`api.trustedgefx.com` → `api.<wl-domain>`).
- Nginx: ensure `/ws/algo/prices` on the `api.` server block has the WebSocket upgrade headers (see `deploy/nginx/*.conf`).

---

## 7. Cross-codebase dependencies (only if the WL is NOT a fork of this repo)

`algo_connector.py` / `algo_market_data.py` assume these platform primitives exist — provide equivalents or the files won't run:

| Dependency | Used for |
|------------|----------|
| `redis_client` + `PriceChannel.tick_key()`, `prices` pub/sub, `bars:SYM:TF` lists | live/historical market data |
| `Instrument`, `Position`, `Order`, `TradeHistory`, `TradingAccount`, `User`, `PositionStatus` models | trade execution & persistence |
| `instrument_pricing`: `resolve_commission`, `compute_spread_revenue`, `get_open_fill_price`, `get_close_fill_price`, `get_spread_timing_mode` | fill pricing, commission, spread revenue |
| `trading_service.apply_position_pnl`, `quote_to_account_pnl` | master-aware P&L on close |
| `corecen_trade_client.forward_trade_open/close` | A-book LP hedging (optional — remove for B-book-only) |
| `get_current_user` (JWT dependency) | key-management auth |
| `MasterAccount`, `InvestorAllocation` | account-type labels in `/accounts` (optional — remove if no PAMM/MAM) |

If the WL is a fork (same backend), all of the above already exist and the three API files drop in with zero changes.

---

## 8. Port checklist

- [ ] Add `AlgoApiKey` model + create `algo_api_keys` table (migration).
- [ ] Copy `algo_keys.py`, `algo_connector.py`, `algo_market_data.py` into `services/gateway/src/api/`.
- [ ] Register 3 routers + the `/ws/algo/prices` WS in `main.py` (mind the `/api/v1/algo` vs `/api/algo` split).
- [ ] Copy `app/algo-connector/page.tsx`.
- [ ] Copy `app/api/algo/[...path]/route.ts`; confirm `app/api/v1/[...path]/route.ts` exists.
- [ ] Add the sidebar nav link.
- [ ] Set gateway-origin env var(s) for the proxies.
- [ ] Point the `api.` subdomain at the gateway; add WS upgrade headers in nginx.
- [ ] In `ALGO_API.md`, replace `trustedgefx.com` / `api.trustedgefx.com` with the WL domains before handing it to bot developers.
- [ ] Smoke test: generate a key in the UI → `curl /api/algo/account` with the headers → place a `BUY` → `CLOSE` → confirm the position and `TradeHistory` row, and that `last_used_at` / `trades_count` update.
- [ ] (If applicable) delete the PAMM/MAM/copy blocks and A-book forwarding if the WL doesn't have those systems.
```
