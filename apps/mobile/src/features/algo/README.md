# Algo (`/algo`)

Automated trading on the phone: the strategies a client runs 24/7 on the server (deployments) with their controls and
the account-wide kill switch, strategy details with the rules in words, backtest reports, the strategy marketplace,
and API keys and webhooks. It uses the same server routes and rules as the Client Area's `components/algo`:
`/api/mobile/algo/*` is a rewrite of the cookie BFF `apps/crm/app/api/algo/[...path]/route.ts`, and the service
contract is `services/algo/README.md` ("Internal API"). Creating a strategy from natural language is the AI Trader
(`/ai`, `src/features/ai`): the home, strategy screens and empty states link there.

## Routes

| Route | Screen | What it does |
|---|---|---|
| `/algo` | `AlgoHome` | Ember block with what runs right now (realized P&L, open positions, trades), Create with AI / Marketplace / API keys & webhooks, the account-wide kill switch (stop everything, optionally closing every position automation opened; release), deployments (Active / All), my strategies, recent backtests (progress while running). A client with nothing yet sees one getting-started block (the mascot, three steps, two ways in). |
| `/algo/strategies/[id]` | `StrategyScreen` | Latest version: tags (symbol, timeframe, visual / code, origin, ready / errors), the last backtest (huge net profit, ratios, open the report), Deploy / Backtest, the rules in words ("EMA(20) crosses above EMA(50)" joined by and / or per signal; a code strategy shows its signal expressions), the service's notes, "Show as code", risk and schedule, deployments as cards with Pause / Resume, Stop, Kill, backtests, versions. Archive (refused by the service while it runs). Code strategies are edited on the web. |
| `/algo/strategies/[id]/deploy` | `DeployScreen` (modal) | Names the exact version; account (demo first); safety limits (lot multiplier, max open positions, a daily loss stop sized from the account's equity: 1 / 2 / 5 % or custom); restriction notice; real-money warning plus a required tick on live accounts. The server's answer, then "Open deployment". |
| `/algo/deployments/[id]` | `DeploymentScreen` | Realized P&L with the day-by-day balance curve (Skia), trades, win rate, open, orders, last bar checked; error and stop reason; controls (pause / resume, stop: keep or close the positions, kill: closes by default, close positions); the runtime log (every evaluated bar, signal, order, close, error; newest 60 polled, older pages on request), trades, setup (rules unless a marketplace author keeps them private, risk, limits). Marketplace copies land here. |
| `/algo/backtests/[id]` | `BacktestScreen` | While it runs: stage, progress, Cancel. Done: notes, huge net profit, profit factor / win rate / max drawdown / Sharpe / trades / expectancy, equity + balance + start line with the drawdown pane (Skia, scrub), monthly returns as a heat grid (3 × 4 per year), every statistic, the trade list (FlashList, newest first, All / Wins / Losses), data and costs (history segments, minute bars, signals, skipped reasons, spread, commission, swaps, conversion, model). Run again opens the period picker. |
| `/algo/marketplace` | `MarketplaceScreen` | Browse (search, Free / Paid, Newest / Top rated / Popular), subscriptions, my listings (earnings; publishing stays on the web). House strategies carry "House strategy · Operated by Kalks" in every row. |
| `/algo/marketplace/[id]` | `ListingScreen` | Verified track record (return, curve by day, win rate, max DD, trades, net, the source note), house disclosure in full and the house backtest (labelled "Backtest · simulated", apart from the track), description, risk, rules (only when the author allows cloning), reviews (rate / edit for subscribers). Sticky bar: Subscribe (free or "· N USDT / month"), an active subscription with Open deployment / Open strategy and Cancel, or "Your listing". |
| `/algo/marketplace/[id]/subscribe` | `SubscribeScreen` (modal) | Copy to my account (account, lot multiplier) or clone the rules (when allowed); price, due now and the wallet's available USDT for a paid listing (short: Deposit), a consent tick to be charged now and every 30 days, the live-account warning and tick. The server's answer (charged or free), then the deployment / cloned strategy. |
| `/algo/keys` | `KeysScreen` | Usage of the last 24 h (requests, errors, rate limited, median latency, orders), API keys (account, scopes, IP whitelist, expiry, last used; Revoke behind a confirmation), webhooks (switch on / off, Delete behind a confirmation, passphrase), recent alerts with each account's result. Creating keys and webhooks stays on the web (Open the Client Area). |

`/algo/deployments/[id]`, `/algo/keys` and the two modals are extra routes under `/algo` (the shared route map lists
`/algo`, `/algo/strategies/[id]`, `/algo/backtests/[id]`, `/algo/marketplace`, `/algo/marketplace/[id]`).
The AI Trader links to `/algo/strategies/[id]` (after a deploy) and `/algo/backtests/[id]` (full report); notification
links for `/developer/*` resolve to `/algo` (`src/features/platform/links.ts`).

## Server rules (all enforced server side)

- The client is the bearer session's user, never a body field. The proxy applies the broker's module switches before
  the service: "algo" for strategies, deployments, backtests, the marketplace, the AI assistant and the kill switch;
  "api" for keys and webhooks. View-only logins can't read Algo at all (no viewer section includes it); read-only staff
  sessions read but every change is refused (`staff_read_only`). The screens hide changes for both (`useReadOnly`).
- The kill switch (`/api/algo/controls`) now follows the "algo" module (it lived under "api" by the longest-prefix
  rule, so a broker with API access off could not reach it from the running-strategies page, on the web either).
  One line in `apps/crm/lib/tenant-config.ts`, covered by `apps/crm/tests/mobile-algo.test.mjs`.
- Orders placed by strategies go through the engine's normal checks (margin, market hours, dealer controls, the
  client's trading restrictions); deploying itself doesn't trade, so the deploy form only shows the restriction notice.
- Paid subscriptions are charged from the wallet by the service (idempotent per period, author credited minus the
  platform cut, refunded when the copy can't start). No step-up code: the web charges the same way.
- Never optimistic: every sheet and form shows the server's answer (closed / couldn't close counts, charged amount).

## Data

- `api.ts`: shapes, `algoGet/Post/Patch/Delete` (the service's codes read in the catalog's words: halted, limits,
  queue full, insufficient funds, ranges…), query keys under `algo:`, fetchers structurally shared with the cache
  (`share.ts`: a poll that changed nothing re-renders no row), prefetch on press-in for every row.
- Polls only while a screen is in front (`usePoll`): home deployments 10 s, backtests 2 s while one runs else 30 s,
  strategy 10 s, deployment 5 s, backtest 1.2 s until done, marketplace 60 s, subscriptions 30 s, keys 30 s, webhooks 15 s.
- Persisted (opens on the last answer): every list and detail. Finished backtest reports are kept on the phone apart
  from the query cache (up to 10, at most 800 trades each, written after interactions, cleared on sign-out) and the
  report opens on them at once, offline too.
- The More tab's broker menu (`more:menu`) is read for the "api" switch (the keys row is hidden when it's off).

## Design

Editorial screens (Anton titles, colour blocks, huge numbers with small labels, pill chips) with MT5-dense rows for
deployments, backtests, trades and logs. Green / red only for money (P&L, returns, drawdown) and trade direction
(Buy / Sell tags); statuses use the palette (running ember, paused gold, stopped / killed neutral, errors amber).
Flat fills only. Charts (`components/chart`): one Skia canvas for the equity / drawdown pair and the single line
curves, scrubbed on the UI thread (pan, touch-and-hold, tap) with a Latin-digit tooltip; always left to right.

## Measured (web preview, 390 × 844, local stack, 2026-09-30)

| What | Result |
|---|---|
| Home idle with polls | 8 commits in 21 s of about 96 fibers (the header, rows and sections are memoised) |
| Home fast scroll | 60 fps, 0 dropped frames, 0 commits |
| Report open (client navigation, 690-trade report, 260 kB) | 237–291 ms to content |
| Report trade list fast scroll | 60 fps, p95 frame 16.8 ms, 0 dropped |
| Equity chart scrub | 0 React commits; 54–57 fps (headless Chromium draws WebGL on the CPU) |
| Deployment idle with 5 s polls | 29 fibers per commit |

## Testing

- `node --import ./apps/mobile/scripts/test-hooks.mjs --test apps/mobile/scripts/algo-lib.test.mts`: rules in words,
  stops / sizes / hours / limits, notes, periods per timeframe, money and ratios, durations, structural sharing,
  chart downsampling.
- `node --test apps/crm/tests/mobile-algo.test.mjs`: bearer identity, explicit close choices, log query keys, kill
  switch, marketplace, keys and webhooks, view-only and read-only staff sessions, module switches, back-office routes.

## Known gaps

- Creating or editing a strategy's rules on the phone is the AI Trader's job (visual rules); code strategies, API key
  and webhook creation, webhook routes and passphrases, and publishing to the marketplace stay on the web.
- The backtest form offers preset periods ending today, a starting balance and whose costs; a fixed spread override
  and custom date ranges are web-only.
- Strings are English; the translation pass adds the other 21 languages (`mobileAlgo`).
- Runtime log messages and the backtest model / notes are the service's English text.
