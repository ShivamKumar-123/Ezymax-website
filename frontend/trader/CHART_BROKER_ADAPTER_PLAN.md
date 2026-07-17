# Chart — native SL/TP via TradingView Broker Adapter (Phase 2, deferred)

## Why this exists
The chart shows open positions as **draggable SL/TP lines**. There are two ways to
render on-line controls (buttons that sit exactly on the price line):

1. **Custom overlay** (what we do NOW): draw `horizontal_line` SHAPES for entry/SL/TP
   (these ARE perfectly price-aligned — the library owns their Y). Actions are handled
   by the **positions table** (`+SL / +TP / CLOSE`, inline editor `setSltpEdit` /
   `saveSltpEdit`) and by **dragging the SL/TP shape lines** on the chart
   (`drawing_event` → confirm dialog → `PUT /positions/{id}`).
   - Limitation: you cannot attach real HTML buttons ONTO a shape line. A floating
     HTML "pill" of buttons was tried and removed — it could not stay pixel-aligned
     because the chart renders in an iframe with no price→pixel API in the parent DOM.

2. **Native Trading-Terminal lines** (`createPositionLine()` / `createOrderLine()`):
   these draw the entry line + quantity + P/L + close (✕) / modify (⚙) buttons and the
   draggable SL/TP lines with buttons **natively aligned** by the library.
   - **BLOCKER:** since charting library **v29**, these APIs are *only* available when
     the widget runs in **Trading Platform mode** — i.e. a `broker_factory` +
     `broker_config` must be provided. Our build is v31, so calling them without a
     broker silently does nothing. (Verified: `charting_library.d.ts` note on
     `createPositionLine` — "Starting from version 29, this method is only available in
     Trading Platform".)

Phase 2 = implement that broker adapter so we can switch to the native lines.

## What Phase 2 needs

### 1. Widget config (mount, in `TradingViewChart.tsx`)
```ts
new window.TradingView.widget({
  ...existing,
  broker_factory: (host) => createSwissCrestaBroker(host),
  broker_config: {
    configFlags: {
      supportPositions: true,
      supportPositionBrackets: true,   // renders draggable SL/TP on position lines
      supportClosePosition: true,
      supportPLUpdate: true,           // live P/L via host.plUpdate(id, pl)
      supportOrderBrackets: false,     // unless we also want SL/TP on pending orders
      supportEditAmount: false,
      supportLevel2Data: false,
      showQuantityInsteadOfAmount: true,
    },
  },
  enabled_features: [...existing, 'order_panel'],       // or keep disabled, see below
  disabled_features: [...existing,
    'trading_account_manager',   // hide the bottom Account Manager panel (we have our own)
    'order_panel',               // hide the order ticket (we place orders via ChartTradeWidget)
    'right_toolbar',
  ],
});
```
Tune `disabled_features` so ONLY the position/SL/TP lines show — no TradingView order
ticket / account manager UI (we already have our own panels).

### 2. The broker adapter — `src/lib/chart/broker.ts` (new)
Implements `IBrokerTerminal` (extends `IBrokerCommon`). Wire to OUR backend + store.
Required methods (≈25–30; many can be minimal/stubs since we don't use the TV order UI):

**Positions / brackets / close (the ones that matter):**
- `positions()` → map `useTradingStore` positions on the charted symbol to
  `{ id, symbol, qty (signed by side), avgPrice, side, pl }`.
- Feed live P/L: on every tick, `host.plUpdate(positionId, pnl)` and
  `host.positionUpdate(position)` so the line labels update in place.
- `editPositionBrackets(id, brackets)` → `PUT /positions/{id} { stop_loss, take_profit }`.
  On HTTP 400: toast the server message and `host.positionUpdate(oldPosition)` so the
  dragged line snaps back (never keep an unaccepted level drawn).
- `closePosition(id)` → `POST /positions/{id}/close`.

**Realtime sync (already have the pieces):**
- Subscribe the account WS (`/ws/trades/{accountId}`, already in `layout.tsx`):
  on `position_closed` / `stop_out` → `host.positionUpdate` with qty 0 (removes line);
  on `order_filled` / `position_opened` → add/refresh positions. Source of truth = WS,
  don't poll.

**Stubs / minimal (we don't use the TV trading UI):**
- `chartContextMenuActions()` → `[]`
- `isTradable(symbol)` → `{ tradable: true }`
- `connectionStatus()` → `Connected`
- `orders()` → `[]`, `ordersHistory?()` → `[]`, `executions()` → `[]`
- `symbolInfo(symbol)` → minimal `{ qty: { min, max, step }, pipValue, ... }` from our instrument config
- `accountManagerInfo()` → minimal (we hide the panel, but the method must return a shape)
- `accountsMetainfo()` / `currentAccount()` → single account from the store
- `subscribeEquity()` / `unsubscribeEquity()` → push `host.equityUpdate(equity)` from the store
- `subscribePlUpdates?` / `subscribePositions?` if the version wants them
- `placeOrder(order)` → either route to our `POST /orders/` (so the TV ticket works) or
  no-op/reject if we keep the ticket disabled
- `modifyOrder()` / `cancelOrder()` → no-op/reject while pending-order editing stays off

### 3. Replace the shape-based lines
Once the broker is in, DELETE from `TradingViewChart.tsx`:
- `syncLines` + `ensure` + `ensureBand` (the shape drawing)
- the `drawing_event` handler
- the confirm dialog can stay OR be replaced by the broker's own bracket-edit flow
The library will draw + move + align everything from the broker's `positions()` data.

### 4. Validation semantics (unchanged — backend already correct)
- `PUT /positions/{id}` validates SL/TP against the **current close price**
  (BUY→bid, SELL→ask), NOT open price; stale-tick fallback to open-price rule.
  Shared helper `check_sltp_levels` in `trading_service.py`. Keep as-is.

### 5. Server-side execution (unchanged — already done)
- `sltp_engine` (gateway) triggers/closes with idempotent guard + stale-tick guard +
  Redis leader lock. `close_position` row-lock guard. See the SL/TP spec.

## Risks / test checklist for Phase 2
- Trading Platform mode changes the widget UI — verify no stray TV panels appear.
- Verify with the acceptance checks: drag SL to break-even (accepted), drag past
  current bid (rejected + snap back), TP tick-through closes server-side + line vanishes
  via WS, two clients sync, race close = one history row.
- Headless testing is unreliable for the chart (iframe + position hydration timing);
  test in a real browser with a funded demo account.

## Current state (Phase 1 — shipped)
- Entry/SL/TP drawn as price-aligned shapes; entry colored by side (BUY blue / SELL red).
- Drag an SL/TP line → confirm dialog → PUT. Snap-back on reject.
- Add/edit/remove SL/TP and CLOSE via the **positions table**.
- Floating HTML button pill REMOVED (it was the source of the misalignment).
