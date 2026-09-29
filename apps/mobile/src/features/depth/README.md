# Depth of market and price alerts (mobile)

Two trading tools, both opened from the Trade tab's header (Layers and Bell icons):
- `/depth/[symbol]`: the ladder (this folder).
- `/alerts`, optionally `?symbol=` to open a new alert for that symbol: price alerts (`src/features/alerts`).

Strings live in the `mobileDepth` namespace, and the existing `order.dom.*` keys are reused.

## Depth of market (`/depth/[symbol]`)

- **Data.** The quote feed's depth subscription (`feed.subscribeDepth`, market-data `op: "depth"`). It uses the account group's spread, like the quotes, and is re-subscribed after reconnects and group changes. When market-data builds the ladder from the live bid / ask (`src: "indicative"`), the screen says so: an Indicative tag and a note.
- **Rendering.**
  - `book.ts` writes each frame to a shared value, coalesced to one write per frame.
  - `Ladder.tsx` records the whole ladder as one Skia picture on the UI thread: asks above, bids below, lots with bars, the client's own pending orders tagged on the nearest level, and the spread and mid.
  - A tick never re-renders React. Measured on the web build: 0 commits from the ladder, only the Sell / Buy price leaves; 60 fps idle and while scrolling.
  - The canvas draws only digits and Latin text; the spread row's words are React text laid over it.
  - On the web, Skia loads after CanvasKit (`LadderLazy.web.tsx`), so layout constants live in `layout.ts`. Don't import `Ladder.tsx` statically.
- **Trading**, the Kalks Trader rules:
  - tap a bid level → buy limit at that price;
  - tap an ask level → sell limit;
  - Sell / Buy → market order;
  - lots in between, remembered per symbol.
  - Orders go through `placeOrder` (`src/features/trading/actions`), the same path as the Trade tab's ticket, so every engine and BFF rule applies. A limit price that has turned marketable is flagged before sending (the engine's rule, stops level included).
- **One-tap trading** (`oneTap.ts`) is a setting on this phone, off by default and reset on sign-out:
  - off: every tap opens a review sheet (`components/ConfirmSheet.tsx`);
  - on: the order is sent at once, one at a time;
  - turning it on goes through an explanation sheet (`components/OneTapSheet.tsx`).
  - Other trading screens can read the same setting (`useOneTap`).
- **States.** Skeleton ladder until the first book, "depth unavailable" when the service has no price for the symbol, offline, and view-only / no account / read-only / restricted / market closed (the controls are disabled; the server refuses anyway).

## Price alerts (`/alerts`)

- **Server side.** Alerts are kept and evaluated by market-data on every quote change, on the client's account-group price (`services/market-data`, [Price alerts](../../../../../services/market-data/README.md#price-alerts)). They fire with the app closed.
  - Delivery goes through the support service (`POST /v1/notify`, type `alerts.price`, link `/alerts`): the bell, email per the client's "Price alerts" preference, and push.
  - BFF: `/api/mobile/alerts`, `/api/mobile/alerts/{id}` and `/api/mobile/alerts/history` (`apps/crm/lib/alerts.ts`).
- **Conditions.** Above / below a level, or up / down by a % from the price when set (a repeating % alert measures from its last trigger). Also bid or ask, repeat (at most every 5 minutes), expiry, a note, pause / resume, and "set again" for a triggered or expired alert. A client can have 50 live alerts.
- **Screen.**
  - The list (FlashList, fixed-height memo rows) shows the live price and the distance to the trigger as leaf subscribers. Swipe to delete (Delete is also an accessibility action); tap to edit.
  - The Triggered tab shows the history with delivery status, paging and Clear (with a confirmation).
  - Both lists open on cached data and refresh; pull to refresh; the list polls every 30 s while open.
- **Sheet** (`components/AlertSheet.tsx`):
  - the symbol picker and the live price it will be judged on;
  - the condition, and the level or % with quick picks;
  - the level is checked against the live price as you type, with a one-line "what will fire" hint. The server checks again (`level_reached`, `limit`, `no_price`).
- View-only logins don't see the owner's alerts (the BFF refuses them too).
