# Social (copy trading, PAMM, MAM)

The social module of the Kalks app. It uses the same server routes and rules as the Client Area's `components/social-live`: `/api/mobile/social/*` is a rewrite of the cookie BFF `apps/crm/app/api/social/[...path]/route.ts`, and the engine contract is in `services/trading/README.md` ("Copy trading and PAMM", "MAM").

## Routes

| Route | Screen | What it does |
|---|---|---|
| `/social` | `HubScreen` | Leaderboard of approved masters: return, drawdown, AUM, followers, age and risk score 1–10. Period pills and a filters sheet (sort, programme, risk, track record). Shortcuts to my copies, PAMM and MAM. "For masters" summary. |
| `/social/masters/[id]` | `MasterScreen` | Profile: house disclosure in full, 1M / 1Y / all-time returns, Skia growth-of-$10,000 curve with scrub, risk score and statistics, monthly returns grid, instruments, fee terms (gold block), delayed trade history. Copy / Invest in a sticky bar. |
| `/social/follow/[id]` | `FollowScreen` (modal) | Follow wizard. 1: sizing (equity proportional, fixed lot, multiplier, fixed allocation), with a live sizing example. 2: drawdown stop, equity stop, max lot, symbol exclusions. 3: amount from the wallet, checked against the balance. 4: review and consent. Then the server's result. |
| `/social/subscriptions` | `SubscriptionsScreen` | My copies: totals, current / stopped, pause / resume, settings, stop. |
| `/social/subscriptions/[id]` | `SubscriptionScreen` | One subscription: equity, HWM, fees, next fee check, copied positions, orders, the copy log and fees. |
| `/social/subscriptions/[id]/settings` | `SubscriptionSettingsScreen` (modal) | Sizing and limits (PATCH). |
| `/social/pamm` | `PammScreen` | Funds (NAV, returns, rollover, lock-in, freeze) and **My investments** (`?tab=mine`): holdings, pending requests with cancel, stop-loss, request history. |
| `/social/pamm/[id]` | `FundScreen` | Fund: NAV history (Skia), terms, rollovers, my position, unit ledger and requests. |
| `/social/pamm/[id]/invest`, `/redeem` | `InvestScreen`, `RedeemScreen` (modals) | Invest is debited from the wallet now and queued to the rollover. Redeem by amount, by units or everything, queued to the rollover. |
| `/social/mam` | `MamScreen` | My managed accounts, and programmes to connect to. |
| `/social/mam/connect/[id]` | `MamConnectScreen` (modal) | Pick one of my live hedging accounts, set limits, read the full terms, consent, then grant. |
| `/social/mam/links/[id]` | `MamLinkScreen` | Managed account: MAM result, trades, history, fees, activity and my consent. Limits (modal `/limits`); revoke (sheet: close or keep the MAM trades). |

## Decisions

- **Forms that move money or grant authority are modal routes, not bottom sheets.** This covers follow, settings, invest, redeem, connect and limits. These forms have several inputs, so a modal gets keyboard avoidance (`FormScreen`: the footer rides the keyboard frame on the UI thread) and swipe-down to dismiss on iOS. Confirmations without typing are `Sheet`s: stop copying, revoke, cancel a request, investor stop-loss, leaderboard filters.
- **Never optimistic.** After a write, the screen shows the server's answer: account opened / funding failed, positions closed / kept, amount returned, fee settled, request queued. Then it invalidates `social:*` (and `wallet*`).
- **Stop copying: close all or keep.** The stop sheet offers:
  - "Close everything now" (default);
  - "Keep my positions open": the new engine option `closePositions: false`. Mirroring stops and the positions become the client's own trades.
  - Separately, "Move the balance back to my wallet".

  The BFF now always sends both flags explicitly. This also fixes the web, where unticking "move the balance back" had no effect.
- **MAM consent.** The terms and their SHA-256 hash always come fresh from the server (never from the device cache). The link is sent with that `termsHash` and `accept: true`, exactly like the web. On a `terms_changed` answer, the screen reloads the terms and asks for consent again.
- **Master and MAM-manager dashboards stay on the web.** Applying involves requirement checks. PAMM fund creation shows credentials only once. Programme set-up and fee reviews are long forms. So the app shows a summary instead ("For masters": status, followers, AUM, fees; the MAM programme's accounts and equity) with **Manage on the web**, which opens the Client Area page (`/social/master`, `/social/mam`) in the in-app browser.
- **House accounts** always show "House strategy · Operated by Kalks": in each leaderboard row (in full), on the profile with the full disclosure, in the follow wizard, and in the footnote under the list.
- **Colours.** Green / red only for money (returns, P&L, buy / sell). Risk scores use mint / gold / ember; excluded symbols use ember.
- **Wallet check before following.** The wizard compares the amount with the wallet's available USDT. Otherwise the engine would open a copy account that the wallet then can't fund. The server stays authoritative.

## Data

- `api.ts`: types, `socialGet/Post/Patch` (known terse error codes mapped to `mobileSocial.error.*`) and query keys under `social:`.
- `fetchers` are **structurally shared** with the cache (`replaceEqualDeep`), so a poll that changed nothing re-renders no row.
- Polling while open: subscription and MAM link detail 5 s, my copies 10 s, my investments 15 s, leaderboard / profile / funds 60 s. There is no per-tick subscription anywhere; the engine's P&L arrives with the polls.
- Persisted (open on cached content): leaderboard per filter, master profiles, subscriptions, funds, investments, MAM links / programmes, master summary.

## Performance (web preview, Playwright probe, 2026-09-30)

| What | Result |
|---|---|
| Leaderboard fast scroll | 60 fps, p95 frame 16.7 ms, 0 long tasks |
| Hub idle | 0 React commits |
| Master profile scroll | 60 fps, 0 frames over 25 ms |
| Growth chart scrub | Only the header re-renders (store leaf); canvas 0 renders |
| Subscription detail, 5 s poll with nothing changed | About 48 fibers per commit (rows, header and actions memoised and skipped) |

## Testing locally

- Web preview: follow the app README. The Skia chart on web needs `canvaskit.wasm` next to the export (`node scripts/copy-canvaskit.mjs <dir>`).
- BFF tests: `node --test apps/crm/tests/mobile-social.test.mjs`.
- Engine: `cargo test -p trading --lib api::social` and `cargo test -p trading --test social` (Postgres).
