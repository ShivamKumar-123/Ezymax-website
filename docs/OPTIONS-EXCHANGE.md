# Kalks FX Options: order book exchange (design, decision O49)

This document is the build contract for the options order book. Founder decisions (2026-10-02):
- **Liquidity:** everyone can rest orders; clients trade with each other.
- **Kalks MM bot:** always quotes every series both sides from the model, under the **same rules** (no priority, no early view, no last look). External MMs come later.
- **Order types:** price-time priority; limit GTC/IOC/FOK; post-only; market with price band; reduce-only; stop orders.
- **Strategies:** combo RFQ with atomic fills; the Kalks MM always quotes.
- **Fees:** maker rebate / taker fee, capped at % of premium.
- **Mark:** model mark clamped inside best bid/ask.
- **Liquidation:** book first with a band, then the Kalks backstop at mark ± liquidation fee.
- **Public data:** depth (10 levels), trade tape, OI and volume per strike.
- **Rollout:** all series at once with the MM quoting.
- **Legacy positions are novated** to the book: the client keeps the position and P&L; Kalks's implied opposite moves into the MM account.
- **Barriers are not listed:** they become RFQ-only, Kalks-quoted and labelled.
- **The MM may keep quoting until cut − 1 min** (publicly disclosed exemption from the 15-minute no-open rule for liquidity-provider accounts).
- **Go-live:** live for everyone once tests pass.
- **No mocked market data in tests.** Pure-logic property tests are fine; end-to-end tests run against the real local market-data (:8081) and options service (:8104).
- **Regulatory note:** matching clients against each other may need an MTF/OTF-type licence per jurisdiction; check per broker.

## 1. Architecture
- **Lives in `services/trading`.** Order entry, reservations and fills must be consistent with account money.
- **One book actor per (tenant_id, account kind live|demo, underlying).** Demo and live never match, and each tenant has its own book.
- **New module `services/trading/src/book/`:**
  - `types.rs`: `BookKey`, `Ticks = i64` (price in premiumTick), `Steps = i64` (qty in contractStep), `Resting { id (= engine ticket), login, stp (= user_id), side, px, qty, left, prio (seq), tif, flags POST_ONLY|REDUCE_ONLY|EPHEMERAL, expire_ms, reserve_per_step }`, `SeriesBook { bids: BTreeMap<Reverse<Ticks>, VecDeque<id>>, asks, orders, state Open|CancelOnly|Closed, last, vol_day }`, `UnderlyingBooks { key, seq, series, pos: HashMap<(series, login), Steps>, rfqs, deadman }`.
  - `Cmd`: `New | Cancel | CancelAll | Amend | MassQuote | RfqQuote | RfqAccept | Backstop | Halt | OpenCheck | Expire | Seed | Timer`.
  - `Fill { id, seq, series, px, qty, maker: Party, taker: Party, kind: Book|Rfq|Liquidation|Backstop|Novation, combo, usd_per_quote, premium_usd (rounded once, r2), at }`.
  - `matching.rs`: pure `apply(&mut UnderlyingBooks, &Cmd) -> Out` with no IO and no clock (time comes in the command).
    - Price-time priority, FIFO per level; trades print at the resting price.
    - Self-trade prevention by user_id: cancel the incoming remainder and keep the resting order.
- **Order entry:**
  1. `api/options_book.rs` checks session, suitability and a rate limit (20 orders/s per login).
  2. `hub.exec(login, engine::options_book::enter)` runs the gates in the account shard: module/client/session (the no-open rule applies to the opening qty only; LP accounts are exempt until cut−1min), contract limits including working opening qty, tick, band, closing/opening split.
  3. It reserves (§3) and stores the order in `AccountState.book` (`#[serde(skip)]`, in memory). `Shard::execute` must swap the state when `tx.book_dirty` is set even without events.
  4. `books.call(key, Cmd::New)`.
- **Book actor:**
  - Drains up to 256 commands and applies each to a clone of the touched SeriesBook.
  - **Group-commits one Postgres transaction:** `book_journal` (seq, cmd, outputs), `book_orders` (non-ephemeral resting), `book_positions`, `book_fills`, `book_outbox`.
  - Only then swaps state, replies and publishes market data. If the commit fails, it rolls back and sends `Done{rejected}` to release the reservations.
- **Outbox dispatcher** (per actor, seq order per login):
  - Each fill produces two items (maker and taker), each run as `hub.exec(login, apply_fill)`. Removals produce `Done{id,status}`.
  - The HTTP handler waits up to 1 s for the taker's own fill to apply.
  - Retry with backoff from 100 ms to 30 s. While a login has fills unapplied for more than 2 s, its new orders get `settling`. After 10 failures the item is marked `failed`, that underlying goes cancel-only and ops are alerted. Items are never dropped.
- **`apply_fill`** never refuses (the money was reserved):
  - Idempotent via `st.book.applied`.
  - Nets FIFO against open positions in the series (legacy and book) via the existing `exit()`; the rest opens or adds to one netted book position (VWAP price, summed premium basis).
  - Releases `qty × reserve_per_step`, then runs `risk::check_margin`.
  - Deals carry `option.fill = {id, role: maker|taker, kind, combo}`.
- **Clearing** (each Tx stays balanced, one account at a time). Account `house:options_clearing.{UNDERLYING}.{YYYYMMDD}:USD`:
  - Buyer: `acct:B:balance −P / clearing +P`. Seller: `acct:S:balance +P / clearing −P`.
  - Cent accounts use the 4-leg form via `house:fx:USC/USD`.
  - Keys: `fill:{fillId}:{login}:prem|fee|rebate`.
- **Determinism:**
  - `book_journal` holds every non-ephemeral command with its outputs. Ephemeral MM commands go to `book_quote_journal` (async COPY every 1 s, same seq).
  - Each fill stores the full resting-order state.
  - A nightly `book-replay` re-runs `apply` and compares outputs byte for byte; the result is shown in the Back Office as "Replay audit OK".
- **Crash recovery** (`main.rs`, after account replay):
  1. Load `book_orders` by prio, `book_positions` and the last seq. Ephemeral orders are gone; journal a `RestartCancel`.
  2. Rebuild shard reservations.
  3. Reconcile actor positions with account positions after pending outbox items. On a mismatch, put that underlying in cancel-only and alert (CFD trading stays up).
  4. Re-dispatch pending outbox items.
  5. Resubmit fired-but-unacknowledged stops; the actor dedupes by ticket.
- **Migration:** `services/trading/migrations/20261012000000_options_book.sql` creates `book_journal`, `book_quote_journal` (monthly partitions), `book_orders`, `book_positions`, `book_fills`, `book_outbox`, `book_rfqs`, `book_halts`, `option_liquidations`, `option_book_venues` and `book_snapshots`, all with RLS.

## 2. Order types
| type | semantics |
|---|---|
| limit gtc / gtd (`expireAt`) | Rests. A buy must be ≤ `mark × (1+limitBandPct) + bandMinTicks`, and a sell must be ≥ the mirror of that (`price_out_of_band`). The passive side may be any price ≥ 1 tick. |
| ioc | Matches what it can; cancels the rest. |
| fok | Fills fully or not at all; the actor checks depth first. |
| postOnly (gtc only) | Rejected with `would_take` if it would cross. |
| market | Becomes an IOC limit at the band (buy `min(mark×(1+marketBandPct), mark + k ticks)`, sell mirrored), stamped in the shard. Never rests. |
| reduceOnly | Clipped to the net position at every match; the rest is cancelled. |
| stop_market / stop_limit | Takes `trigger {source: mark\|underlying, op, price}` and is stored as an account Order. Evaluated on underlying ticks and timers; on firing it calls `enter()` and sends to the actor. Nothing is reserved until it fires; if funds are short then, it is rejected and the client is notified. |

- **SL/TP:** premium SL/TP on a position becomes a reduce-only `stop_market` triggered by mark, never by last trade.
- **Per-underlying fields in the options service:**
  - `premiumTick`, quote currency per unit. Defaults: FX pip/10 (EURUSD 0.00001 = $0.10 per contract), XAU 0.01, USDJPY 0.001, oil 0.001.
  - `marketBandPct` 10, `limitBandPct` 50, `bandMinTicks` 5, `minContracts`, `contractStep`, `maxContracts` per order.
- **Limits:** at most 50 working orders per series and 200 per account.
- **Amend:** reducing qty keeps priority; a price change or qty increase loses it. Increases go to the shard first (reserve more); decreases go to the actor first (then release).
- **Session open:** `OpenCheck` cancels resting orders that are outside the band against the new mark (weekend-gap protection).

## 3. Order margin
- **Buy:** `left × limit × contractSize × usdPerQuote × (1 + 2% FX buffer if the quote currency is not USD)` plus the worst-case taker fee. Checked against free cash, and against the balance when closing a short.
- **Sell, opening qty:** the standalone scenario margin of that qty (optmath grid, no offsets) plus the fee. **Sell, closing qty:** the fee only.
- **Per series:** reserve = max(Σ buy reserves, Σ sell reserves).
- **Metrics** gain `order_reserve`: `free_margin = equity − margin − order_reserve`, and `free_cash` and `withdrawable` also subtract it. The margin level stays equity / position margin.
- **Release:** pro rata on fill, fully on cancel, expiry or reject. A test asserts the reserve is 0 when no orders are working.

## 4. Kalks MM bot (`book/mm.rs`)
- **Account:** one house MM account per (tenant, kind), opened like `hedger::hedge_account`.
  - User `OPTIONS_MM_USER_ID`, group `options-mm` with fees 0/0 (published as the MM tier).
  - Capital: `house_capital` (demo accounts use demo funding).
- **Pricing:**
  - Theoretical = model mid at the smile vol. Bid at σ−s(tenor bucket 0DTE / ≤7d / ≤30d / >30d), ask at σ+s, at least `minSpreadTicks` apart.
  - Skew: vol skew by −`skewVol`·(net vega of the expiry / maxVega), and price shifted by −`skewTicksPerContract`·inventory.
  - Size: `baseSize`, scaled by moneyness and shrinking toward the limits.
  - A side is withdrawn when it would breach `maxNetDelta`, `maxGamma`, `maxVega` or `maxContractsPerSeries`. If the bid would be under 1 tick, there is no bid.
- **Quoting rules:**
  - Quotes are post-only and ephemeral, sent via **MassQuote**, a public endpoint for MM-programme accounts. **The MM never takes liquidity.**
  - Refresh on an underlying tick (250 ms throttle near the money and short-dated, 2 s otherwise), a snapshot version change, an own fill, or a 5 s theta timer.
  - Requote only if the price moved at least max(1 tick, 25% of the half-spread) or the size changed.
- **Cancel-all** on: spot stale for more than 3 s, a stale snapshot, market closed, cutoff (cut−1min for LP), pause, or shutdown. A deadman switch for any account fires after 5 s without a heartbeat.
- **Delta hedge:** `hedger::client_delta` uses the MM's option delta plus house-venue positions (barriers), live only.
- **Settings:** options-service table `mm_settings` (tenant or `*`, kind, underlying), delivered in the snapshot as `mm[]`. Pause and resume through an engine endpoint.
- **Same-rules guarantees** (each one is a test):
  1. The MM submits through the same `book::entry::submit(login, req)` path as clients.
  2. `matching.rs` and `actor.rs` never refer to the MM login (a grep test). Priority is only (price, seq).
  3. The MM sees only the public view plus its own orders.
  4. Its quotes are firm.
  5. Fills record the maker quote, and the nightly replay audit checks them.

  A public "MM rules" page discloses its in-process latency.

## 5. Combo RFQ (`book/rfq.rs`)
1. **Request:** `POST rfq {legs[{series, side, ratio}], qty, reduceOnly?}` lives 30 s and is shown to responders without its side.
2. **MM quote:** `{bid, ask}` net per combo unit, built from the summed theos, a combo spread and skew. The MM reserves for its worst side, and the quote is firm for `rfqQuoteTtlSecs` (5 s).
3. **Accept:** `{quoteId, side, limitNet}` reserves for the taker, then `Cmd::RfqAccept` fills all legs in one journal entry.
   - Leg prices are the theos scaled to sum to the net and rounded to ticks, with the remainder on the largest leg and no leg below 0.
   - Each account gets one outbox item holding all legs, so the fill is atomic per account.
   - The tape shows the legs plus one `combo` print. Outright books are not touched.
- **Later:** external responders go in `rfq_responders`; best price wins, and ties go to the earliest quote.
- **Users:** the strategy builder and `combos/{id}/close` use RFQ.
- **Barriers:** RFQ only, Kalks-quoted at the model price ± spread, labelled "Kalks-quoted (not order book)", settled against `house:options_settlement` as today (venue = house).

## 6. Mark
- **Formula:** `mark = clamp(model mid, bestBid, bestAsk)` when both sides have at least `markMinQty` and the spread is ≤ `markMaxSpreadMult` × the model spread. With one side only: `max(model, bid)` or `min(model, ask)`. Otherwise the model mid.
- **Plumbing:** the actor publishes top of book into `book::Top` (RwLock map plus version). `OptionsCtx::mark` clamps against it, and the cache key includes the Top version. Shared helper: `crates/optmath/src/mark.rs`.
- **Used for:** equity, margin, stop-out, stop triggers and bands.
- **Published fields:** `mark`, `markIv`, `theo`, `theoIv`.

## 7. Fees
- **Group fields** (options service, in the snapshot): `makerFeePerContract` (negative = rebate) and `takerFeePerContract`. `feeCapPct` reuses `commission_cap_pct`.
- **Formula:** `fee = sign × min(|rate| × qty, cap% × premium)`. Admin validation enforces min(taker) ≥ max(|maker rebate|).
- **Postings:**
  - Taker fee: `acct −f / house:commission +f`.
  - Rebate: `acct +r / house:options_rebates −r`, as new `TxnKind::OptionRebate`.
- **Deal fields:** `commission` = fee charged (≥ 0), plus a separate `option.rebate`.
- **MM fees:** 0/0, which is a house-to-house wash.

## 8. Liquidation (`book/liquidator.rs`)
1. At stop-out, `check_margin` emits StopOut and calls `liquidator.try_send(login)`.
2. The loop runs `CancelAll` and waits until it is applied, then re-reads metrics and picks the unit that frees the most margin (reuse `units_of` / `margin_without`).
3. Closing by unit type:
   - CFD: closed in the shard.
   - Option: reduce-only IOC at mark × (1 ∓ `liqBandPct`).
   - Combo: RFQ to the MM, auto-accepted.
4. **Backstop:** any remainder goes to `Cmd::Backstop`. The MM takes it at mark ∓ max(`liqFeePct`·mark, 1 tick), ignoring MM limits. The tape flags it `liquidation`.
5. Repeat until the level is above stop-out or nothing more closes.
- Every step is logged in `option_liquidations`. NBP applies afterwards.

## 9. Settlement
- At cut − closeOnlyMinutes, `Cmd::Expire` cancels all orders on that expiry and releases their reserves.
- `options::settle` posts `venue = book` positions against the expiry's clearing account (same key `settle:{key}:{run}:{ticket}`). The house venue posts against `options_settlement` as today. Re-runs reverse both sides.
- **Invariants:** Σ long = Σ short; clearing = 0 once the outbox is empty; after settlement, any |clearing| ≤ 0.005 × positions is swept to `house:options_rounding` (key `clrsweep:{tenant}:{kind}:{expiry}:{run}`).
- **As built (settle.rs, engine/options.rs):** a book position's payout is rounded once in USD and booked like a fill (cent accounts: 4 legs through `house:fx:USC/USD`), so USD and cent sides net per ledger code; the sweep runs per (tenant, kind) once every book position of the expiry is settled and its outbox is empty, and again every minute for the runs of the last 2 h (a sweep that had to wait, or a crash between settlement and sweep); a larger residue is never swept (`ALERT`). Re-run reversals go back through the account they were booked against. Crosses convert at one rate per expiry (the conversion pair's own fixing of that date, else the live mid at the pass). A barrier whose level the fixing itself reached was touched in the window: knock-out → rebate, knock-in → vanilla. The restart reconcile treats series past their cut as settling (no false cancel-only after a crash mid-pass).

## 10. Market data
- **The engine is the source** for depth, tape, OI (Σ longs) and volume.
  - Internal WS `GET /v1/internal/options/book/stream` (`book/md.rs`, `api/book_feed.rs`):
    - `top` frames per series at ≤ 4/s: `{series, bid, bidQty, ask, askQty, last, lastQty, mark, oi, vol, seq}`;
    - `depth` with 10 levels on subscribe;
    - `trade` frames.
  - Plus `GET /v1/internal/options/book/{tenant}/{kind}/snapshot|trades`.
- **The options service merges** (new `src/book_feed.rs`):
  - Chain row `bid`/`ask` become the book's best bid/offer (null if empty), plus `bidQty`, `askQty`, `last`, `change`, `oi`, `volume`, `mark`, `markIv`, `theo`, `theoIv`, `bidIv`, `askIv`. Greeks come from the model. PCR per expiry.
  - New WS ops: `depth` (max 20 per connection, ≤ 4/s) and `tape` (batched every 250 ms).
- **Public, no login**, at `api.*/v1/public/options/*`: `book/{series}`, `trades/{series}`, `stats/{u}`. Cached 1 s and limited to 10 requests/s per IP.

## 11. Rollout
1. The engine ships with the book code dormant.
2. `POST /v1/admin/options/book/enable {kind, reason}` (four-eyes, with a dry-run `GET …/enable/plan`) runs:
   1. Halt house opens.
   2. Cancel legacy pending option orders (clients notified).
   3. Start the actors and the MM, and wait for quote coverage.
   4. Novate: `Seed` journal entry plus MM mirror positions with `DealReason::Novation` (key `novate:{tenant}:{kind}:{series}`), and the client `PositionUpdated` venue = book. Cash moves `house:options_premium → MM balance`. Barriers stay venue = house.
   5. Write the `option_book_venues` row.
3. Forward-only: there is no switch-off. Kill switches: halt or cancel-only per series / expiry / underlying / all, MM pause, MM widen.
4. **Founder decision:** turn on for live (and demo) as soon as the tests pass.

## 12. APIs
**Terminal** (engine; add these to the terminal BFF allow-list):
- **Orders:**
  - `POST /v1/terminal/options/book/orders` with `{series, side, type: limit|market|stop_market|stop_limit, qty, price?, tif: gtc|ioc|fok|gtd, expireAt?, postOnly?, reduceOnly?, trigger?: {source, op, price}, clientOrderId}`.
  - Answers `{status: working|filled|partially_filled|cancelled|rejected, order: {id, series, side, qty, filled, left, avgPrice, price, tif, flags, reserved, createdAt}, fills: [{fillId, price, qty, role, fee, positionTicket}], reason?}`.
- **Order management:** `PATCH …/book/orders/{id} {price?, qty?}`; `DELETE …/book/orders/{id}`; `DELETE …/book/orders?series=&underlying=`; `GET …/book/orders?status=open|history&series=`; `GET …/book/fills?from&to`; `POST …/book/preview` (adds reserve, estimated average price from depth, fee).
- **RFQ:**
  - `POST /v1/terminal/options/rfq` → `{rfq: {id, expiresAt, legs, qty}}`.
  - `GET …/rfq/{id}` → `{rfq, quotes: [{quoteId, responder, bid, ask, qty, validUntil}]}`, plus the stream frame `rfq_quote`.
  - `POST …/rfq/{id}/accept {quoteId, side, limitNet}` → `{status, comboId, fills}`.
  - `DELETE …/rfq/{id}`.
- **Other:**
  - `POST /v1/terminal/positions/{ticket}/close` on a book-venue option becomes a reduce-only market IOC: `{status: filled|partial, filled, avgPrice, left}`.
  - `POST …/book/deadman {timeoutMs}`; `POST …/book/mass-quote` (MM-programme accounts only).

**Admin** (engine, staff perms):
- `GET /v1/admin/options/books?kind=`: monitor per underlying (resting orders, MM coverage %, spreads, OI, volume, seq, outbox lag, clearing).
- `GET …/books/{series}`: depth with owners; the view itself is audited.
- `POST …/books/halt {scope, target, mode, reason}`, `DELETE …/books/halt/{id}`.
- `POST …/mm/pause|resume {scope, reason}`, `GET …/mm` (inventory, Greeks, limits, uptime).
- `GET …/liquidations`, `GET …/clearing?expiry=`.
- `POST …/fills/{id}/bust {reason}` (four-eyes; reverses both sides with keys `bust:{fillId}:{login}:*`).
- `POST …/book/enable`, `GET …/book/enable/plan`.

**Options service:**
- New underlying fields from §2 plus `liqBandPct`, `liqFeePct`, `rfqQuoteTtlSecs`, `markMinQty`, `markMaxSpreadMult`.
- New group fields `makerFeePerContract` and `takerFeePerContract`.
- `mm_settings` CRUD and snapshot `mm[]`.
- The feed consumer and the public routes.

## 13. Testing (no mocked market data)
- **`book/matching.rs` proptests:** random command streams checked against a naive O(n²) reference. Properties: never crossed, price-time priority, qty conserved, FOK all-or-nothing, IOC never rests, post-only never takes, STP never fills the same user_id, reduce-only never grows |pos|, same journal gives identical outputs.
- **Ledger and reserve properties** on the Postgres harness: every Tx balances, per-fill clearing = 0, Σ long = Σ short, reserve = 0 when idle, replay identical.
- **Crash kill points:** after the journal commit, after one side applied, during novation. Each must give exactly-once on restart and a clean reconcile.
- **End to end** (`tests/book_e2e.rs`, `--ignored`) against the real local market-data :8081, the options service :8104 and Postgres: the MM quotes from the real snapshot, clients trade, the mark clamps, OI = positions, and a real 0DTE fixing settles with clearing at 0.
- **Load:** full-chain MM at 4 Hz plus 200 clients. Targets: actor p99 < 5 ms, outbox lag < 50 ms.

## 14. Implementation notes (second milestone, 2026-10-02)
What the MM, RFQ, liquidator, enable and Back Office build does where this design left a choice (details in `services/trading/README.md` "Options order book"):
- **MM spot staleness:** quotes are pulled after **10 s** without a raw tick (not 3 s): the production relay has multi-second gaps on quiet pairs and pulling the whole chain on every gap would empty the book.
- **MM load:** at most 400 series are requoted per 250 ms pass (nearest the money first, the starting underlying rotates), in mass quotes of 40 series, so the MM account's shard stays responsive; the MM's own in-memory removals are applied in one account transaction per batch.
- **MM tier:** liquidity-provider quotes trade at 0 / 0 fees and are exempt from the per-client contract limit (their own `maxContractsPerSeries` and Greek limits apply). MM capital: `OPTIONS_MM_CAPITAL` (default 25 M USD) must cover the order reserve of a full-chain quote.
- **RFQ:** legs must be listed vanilla series of one underlying (`rfq_underlyings`); a barrier leg answers `kalks_quoted` (barrier strategies stay on the house ticket). The leg split is integer (`matching::rfq_split`); when no whole-tick split makes the net, the last tick goes the taker's way. RFQ fills move positions and volume but not the outright levels or the last trade price.
- **Halt modes:** `halt` cancels the resting orders in scope (reservations released) and accepts cancels only; `cancel_only` keeps them.
- **Bust:** a fill of an expired series cannot be busted (settlement already used it).
- **Restart:** `RestartCancel` also drops series left empty, so a book loaded after a restart and its journal replay stay identical when only MM quotes had created a series.
- **Enable after a crash:** re-running the enable completes it exactly once and lifts the reconcile cancel-only once book and accounts agree.
