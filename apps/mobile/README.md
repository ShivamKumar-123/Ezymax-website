# Kalks mobile app (`apps/mobile`)

The native Kalks app for iOS and Android: React Native + Expo SDK 57, expo-router, Reanimated 4, Gesture Handler, Skia (chart), FlashList, @gorhom/bottom-sheet.

Design direction (approved by the founder): a hybrid app.
- **Trading screens are dense** like MT5 / cTrader: watchlist, chart with a one-tap Sell / Buy bar, the order ticket as a bottom sheet, positions / orders / history.
- **Everything else is bold and editorial:** tall condensed uppercase headings (Anton), big saturated colour blocks with a 28–32 radius on the near-black `#07070A` canvas, pill chips, a floating pill tab bar, and huge numbers with small labels.
- **Prices** use JetBrains Mono (tabular digits).
- **Green and red are reserved for money:** P&L and price direction only.
- **No** emoji, blur, glow, particles or looping animation. Motion is functional only: price flash, swipe, sheet, press feedback, and haptics on fills.

## Run it on your phone (Expo Go)

1. Install **Expo Go** from the App Store / Play Store. It must support SDK 57.
2. Put the phone and the Mac on the **same Wi-Fi**.
3. From the repo root:
   ```bash
   pnpm install
   pnpm --filter @kalks/mobile start        # Metro on :8082 (market-data owns :8081)
   ```
4. Scan the QR code: with the Camera app on iOS, or from inside Expo Go on Android.

By default the app talks to **production** (`https://app.kalkstrade.com`), so you sign in with your real Kalks account.

### Against the local stack

```bash
scripts/dev-services.sh                                  # Postgres, services, Client Area on :3000
pnpm --filter @kalks/mobile dev-relay                    # 0.0.0.0:8790, maps the local stack like the production edge
EXPO_PUBLIC_API_BASE=http://<your Mac's LAN IP>:8790 pnpm --filter @kalks/mobile start
```

Find the Mac's LAN IP with `ipconfig getifaddr en0`.

The relay (`scripts/dev-relay.mjs`) forwards these paths:

| Path | Goes to |
|---|---|
| `/api/*` | Client Area BFF `:3000` |
| `/v1/*` | market-data `:8081` (HTTP and WebSocket) |
| `/engine/stream` | trading engine `:8090` |
| `/support/stream` | support service `:8100` |

The BFF's `/api/mobile/config` tells the app to use the relay for quotes and streams when it is reached over the LAN. The relay is for development only; never deploy it.

### Web preview (screenshots, quick checks)

```bash
EXPO_PUBLIC_API_BASE=http://localhost:8790 pnpm --filter @kalks/mobile export:web
pnpm --filter @kalks/mobile dev-relay                    # also serves dist-web/ at http://localhost:8790
```

## Builds (EAS)

`eas.json` has three profiles:

| Profile | What it builds |
|---|---|
| `development` | dev client |
| `preview` | internal APK / ad-hoc IPA |
| `production` | store build |

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build --profile preview --platform android
npx eas-cli build --profile production --platform ios
```

Every profile points `EXPO_PUBLIC_API_BASE` at production. Nothing here runs a cloud build automatically.

The server deploy (`deploy/deploy.sh`, `deploy-demo.sh`) installs with `--filter '!@kalks/mobile'`, so the VPS never installs or builds the React Native toolchain.

### Expo Go compatibility

Everything in phase 1 runs in Expo Go.
- **Storage:** expo-sqlite's kv-store stands in for MMKV. MMKV needs a dev build; kv-store gives synchronous reads, so screens still open on cached data.
- **Fonts:** loaded at runtime.

Push notifications need a development or store build (Expo Go on Android has no remote pushes since SDK 53). Face ID / fingerprint unlock works in Expo Go; Google sign-in needs a build with the app's bundle id (its button is hidden in Expo Go).

## Security model

- The app never contains an internal service token. It talks only to the Client Area BFF under `/api/mobile/*` (`apps/crm/lib/mobile.ts`, `apps/crm/proxy.ts`).
- The gateway session token lives in the **secure store** (Keychain / Keystore) and is sent as `Authorization: Bearer <token>`. It is the same session model as the web (email code on new devices, step-up codes, restrictions, blocked sign-in).
- **Most mobile paths are rewrites of the existing cookie routes.** For example, `/api/mobile/wallet/...` is served by `/api/wallet/...`. The proxy moves the bearer token into the session cookie of the rewritten request and drops any browser cookie, so the identical handler logic runs, including viewer scopes, ownership checks and read-only staff sessions. Cookie routes keep their same-origin (CSRF) check unchanged.
- **Native mobile routes:**
  - `auth/*` returns the session token in the JSON body.
  - `config` gives the public service URLs.
  - `trade/*` covers trading-engine sessions, obtained through the same SSO token as Kalks Trader, and every trade call (orders, closes, Close By on hedging accounts: `POST trade/positions/close-by {ticket, by}`), each checked against the owner of the terminal session.
  - `accounts/options` tells the open-account wizard whether the broker allows new demo accounts (Back Office › Settings › Features).
  - `menu` gives the More tab the broker's modules (a module switched off is hidden), support email and legal page links; every session reads it, view-only logins too (judged like `/auth/me`).
  - `push/*` keeps this phone's Expo push token for the signed-in client (never for view-only logins or staff sessions). Sign-out removes it: with the session, or with the phone's installation id once the session is gone.
  - `auth/google` and `auth/google/complete` run "Continue with Google": the server redeems the app's authorization code (PKCE) and verifies the ID token like the web flow; the session comes back in the body.
- Tests: `node --test apps/crm/tests/mobile.test.mjs` and the feature files next to it (e.g. `mobile-platform.test.mjs` for push and Google, `mobile-trade.test.mjs` for the trade routes and Close By). The app's pure logic: `node --import ./apps/mobile/scripts/test-hooks.mjs --test apps/mobile/scripts/*.test.mts` (`core-lib.test.mts`: the default account, structural sharing, the Trade links, the share card's figures).

## Conventions (for everyone adding a feature)

### Where things live

| What | Where |
|---|---|
| Tabs (Home, Markets, Trade, Portfolio, More) | `app/(app)/(tabs)/<tab>.tsx` (thin: imports the screen from `src/features/<feature>`) |
| Feature screens pushed on the stack | `app/(app)/<feature>/<screen>.tsx`, e.g. `app/(app)/wallet/deposit.tsx` |
| Signed-out screens | `app/(auth)/…` |
| Feature code (components, hooks, API calls) | `src/features/<feature>/…` |
| Shared UI kit | `src/ui` (import from `@/ui`) |
| Tokens (colours, spacing, radii, type) | `src/theme/tokens.ts` |
| API client, cache, storage, haptics | `src/lib` |
| Session (me, restrictions, sign-out hooks) | `src/session` |
| Quotes stream, instruments | `src/market` |
| Illustrations | `assets/illustrations` (generated) |

Signed-in routes are protected by `Stack.Protected` in `app/_layout.tsx`. Anything under `app/(app)/` requires a session automatically. Don't add screens to the root layout.

Shared registry files are `app/_layout.tsx`, `app/(app)/_layout.tsx`, `app/(app)/(tabs)/_layout.tsx` and `src/ui/index.ts`. Keep hunks in them small. Most features need no change there, because expo-router picks up new files by themselves.

### Server (BFF) routes for the app

- **Existing cookie route?** Just call it as `/api/mobile/<family>/...` with `api()`. The family (first segment) must be listed in `REWRITES` in `apps/crm/lib/mobile.ts`. Already listed: trading, wallet, news, notifications, kyc, security, support, status, growth, partner, social, prop, academy, reports, algo.
- **Needs a mobile-only route?** Add `apps/crm/app/api/mobile/<family>/.../route.ts`, add `<family>` to `NATIVE` in `lib/mobile.ts`, and read the session with `bearerOf(req.headers)` + `fetchMe()`. The proxy has already applied the maintenance, module, viewer and staff policies. Add tests next to `apps/crm/tests/mobile.test.mjs`.

### Calling the API

```ts
import { api, apiGet, apiPost } from "@/lib/api";
const r = await apiGet<{ accounts: Account[] }>("trading/accounts");
if (!r.ok) show(r.error.message); // already in the reader's language
```

- **Screen data:** use `useQuery(key, fetcher, { persist: true })` (`src/lib/query.ts`). It returns cached data at once and refreshes in the background.
- **A slice of shared data:** `useQuerySelect(key, fetcher, select, opts)` fetches the same way but re-renders only when `select`'s result changes (it is structurally shared with the previous one, `src/lib/structural.ts`). Use it for controllers and leaves that need one piece of a list that refreshes often (e.g. `useAccountsSelect` for the account list, whose equity figures change on every refresh). `refreshQuery(key)` refetches without subscribing (pull to refresh).
- **Invalidation:** after a confirmed change, call `invalidate(prefix)` or `setQueryData()`.
- **Money actions** (orders, withdrawals, transfers) are never optimistic. Show the server's answer.
- **Sign-out cleanup:** clear feature state with `onSignOut(fn)`.

### i18n

- **Shared catalogs:** everything is in `packages/i18n` (22 languages, English fallback).
- **New strings:** give each feature its own namespace file, `packages/i18n/src/catalog/en/mobile<Feature>.ts` (for example `mobileWallet`), registered in `en/index.ts`.
- **Translations:** put them in `packages/i18n/src/catalog/<lang>/mobile<Feature>.ts`, typed `NsMessages<"mobile<Feature>">`. Locale `index.ts` files don't need them; the app loads namespaces directly.
- **Reuse** existing keys (`common.*`, `auth.*`, `wallet.*`, `order.*` …) before adding new ones.
- **Regenerate the loaders** after adding a namespace: `pnpm --filter @kalks/mobile i18n`. It rewrites `src/i18n/loaders.generated.ts` and includes every `mobile*` namespace automatically.
- **In code:**
  - `const t = useT(); t("mobileWallet.title")`.
  - Outside React, use `i18n.t`.
  - Rich text with tags uses `<Trans k=… tags={…} />`.
- **RTL** (ar, ur, fa) flips the root view's `direction`. Use `start` / `end` (`marginStart`, `paddingEnd`, `start:`), never left / right.

### Performance rules (Instagram / Netflix bar: 60 fps, 120 on ProMotion)

1. **A price tick never re-renders a list or a screen.**
   - Live numbers are leaf components: `PriceCell`, `ChangeText`, `LivePrice`, `useLiveQuote`, each coalesced to one update per frame.
   - The UI thread reads `feed.sv(symbol)` shared values.
2. **Lists use FlashList.**
   - Rows are `React.memo` with stable props and a fixed height (pass it to the list).
   - Don't pass inline objects or closures to rows.
3. **Gestures and animations run on the UI thread** (Reanimated / Gesture Handler worklets). Springs come from `motion` in tokens. Gestures follow the finger 1:1 and can be interrupted.
4. **Open to content:** use `useQuery(…, { persist: true })` and skeletons shaped like the content (`Skeleton`, `SkeletonRows`), never a centred spinner for a whole screen.
5. **Prefetch** on press-in (e.g. chart candles from a watchlist row) with `prefetch()`. Each module exports its screens' warm-ups from its `api.ts` (`prefetchWallet`, `prefetchPartner`, `prefetchAcademy`, `prefetchNews`, `prefetchSocial` in `social/prefetch.ts` …); the More tab rows and Home's quick actions call them.
6. **Images:** use `<Illustration>` (expo-image, memory+disk cache, fixed aspect ratio, @2x / @3x WebP).
7. **Haptics** (`src/lib/haptics.ts`) are for meaningful moments only:
   - order fill, close;
   - swipe threshold;
   - pull-to-refresh;
   - selection changes.
8. **No decorative motion:** no looping animations, blur or glow. Skeletons are static.

### UI kit (`@/ui`)

> **Colours and finish:** the app uses the web platform's colour family (`packages/ui/src/styles.css`: `#07070A` canvas, graphite surfaces, `#F5F5F7` text, ember `#FF5A1F`, light ember `#FF8A3D`, gold `#E9B949`, warm off-white `#F6F4F1`; tertiary text `text3` is one step lighter than the web's so small labels pass WCAG AA on every surface) and a MATTE FINISH: flat solid fills only, no gradients, gloss, sheen, glass, drop shadows or glows. Charts use flat lines and flat low-opacity fills. Always use tokens from `@/theme/tokens`, never hex values in feature code; a translucent tint is a token too: `alpha(colors.down, 0.3)` (`@/theme/alpha`). Text on every colour block and on the Buy / Sell green and red is `colors.ink` (light text is under 4.5:1 on the web palette's green, red and ember).

| Group | Components |
|---|---|
| Text | `Text` (variants: title, headline, body, callout, caption, label), `Display` (Anton, uppercase), `Mono` (tabular) |
| Surfaces | `Card`, `ColorBlock` (ember / gold / mint = light ember / periwinkle = warm sand / cream = warm off-white; all from the web colour family, flat matte fills only; both take `onPress` and `onPressIn` for a prefetch), `Screen` (safe areas, header, pull-to-refresh, tab-bar padding, keyboard) |
| Controls | `Pill` / `PillRow`, `Button` (primary, secondary, ghost, cream, buy, sell), `IconButton`, `PressableScale` (press feedback; a `haptics` tick only where the press is a selection change: pills, checkboxes), `TextField`, `OtpInput`, `Sheet` (bottom sheet; `scrollable` for forms and tickets). Buttons, icon buttons and pressable blocks give no haptic on a plain press (rule 7); all of them take `onPressIn` for a prefetch. |
| States and notices | `Skeleton`, `EmptyState`, `Illustration`, `Banner`, `toast` (`success` = the off-white "done" accent, never green: green is money) |
| Rows | `ListRow`, `Divider` |
| Navigation | `BackButton` (the bare chevron every stack screen uses, flipped in RTL; back, else `fallback` when opened from a link), `Flip` (mirrors a directional icon in RTL, on a wrapping view) |
| Numbers and brand | `PriceCell` (`flash={false}` + `color` for a price on a coloured button), `ChangeText`, `LivePrice`, `Money`, `KalksMark` |

Tokens: 4 / 8 pt spacing (`space`), `GUTTER` 20, radii `card` 28 / `block` 32, touch targets ≥ 44 pt (`HIT`).

**Typing inside a bottom sheet.** @gorhom/bottom-sheet only lifts a sheet above the keyboard for its own text input. `TextField` and `OtpInput` detect a sheet (`useInSheet()`) and use that input there, so a plain `<TextField>` in any `Sheet` stays above the keyboard. A sheet whose content can be taller than the space above the keyboard (a form, the order ticket) also sets `scrollable`, so every field and the confirm button stay reachable. A custom input inside a sheet uses `SheetTextInput` (plus `NO_WEB_OUTLINE`). The older `SheetTextField` / `SheetOtpInput` (`src/features/accounts/components/SheetInputs.tsx`) keep working.

### Illustrations

`pnpm --filter @kalks/mobile illustrations` processes the source PNGs.

- **Input:** it reads `illustrator/*.png` at the repo root and never modifies them.
- **Background:** it removes the baked-in checkerboard (a flood fill from the borders, with a feathered edge). A few images get their own treatment (`OPTIONS` in the script): the rewards chest loses its white ground and grey ground shadow (a glow on the dark screens), the market globe its grain specks (a starfield on dark), and the full-bleed scenes (maintenance, partner IB, market closed) get rounded corners like the cards.
- **Output:** @1x / @2x / @3x WebP, plus `src/ui/illustrations.generated.ts` (names and aspect ratios).
- **Placeholders:** images the founder is regenerating keep a clean placeholder: copy trading, empty watchlist, PAMM funds, prop challenge, prop passed. When a source file changes, re-running the script picks it up automatically (`scripts/illustrations.manifest.json` keeps the old hashes).

## What phase 1 contains (core modules)

| Area | Where | Notes |
|---|---|---|
| Onboarding, sign in, sign up, reset | `app/(auth)`, `src/features/auth` | The gateway flows through `/api/mobile/auth/*`: email code on new devices and unverified emails, rate limits, blocked sign-in, referral code (`kalks://sign-up?ref=CODE`). The dev code hint appears only when a server has no SMTP. |
| Home | `src/features/home` | Equity block (live, a matte ember block with the globe art), closed today (refreshes on every close) and open P&L, account switcher, quick actions, Explore (copy trading, prop, academy, AI Trader and invite friends as matte colour blocks with the founder's illustrations; a module the broker switched off is hidden like in the More tab; warmed on press-in; no price or account data), top movers, headlines, bell; illustrated no-account, error and offline states. Only the equity block follows the account list (a refresh of its figures re-renders nothing else). A view-only login reads the figures through the Client Area; it gets no quick actions or Explore, and headlines only with its dashboard section. |
| Markets | `src/features/markets` | Segments, search, favourites, live Bid / Ask with a tick flash; prefetches candles on press-in. |
| Trade | `src/features/trade`, `src/features/chart` | Skia chart (limit and stop orders labelled apart, the bars missed during a disconnection filled in on reconnect), one-tap Sell / Buy bar, order ticket sheet (market / limit / stop; price, volume, SL / TP typed or stepped; margin and pip-value preview; rejections in plain words; a retry after a lost answer never opens a second trade; opening it gives no haptic, the fill does), symbol search, News (`/news?symbol=`), Calendar (`/calendar?currency=`: the symbol's base currency when the calendar covers it, else its quote currency, `trade/currencies.ts`), Alert and Depth in the header (the first two warmed on press-in), market-closed notice refreshed every minute (view-only logins don't ask for contract specs). A link to `/trade?symbol=X` switches the tab to X (the param is cleared once applied). |
| Portfolio | `src/features/portfolio` | Live summary; positions with swipe to close, partial close, SL / TP and Close By on hedging accounts (pick the opposite position on the same symbol, see what the overlap locks in, confirm; the engine closes the overlap at the picked position's open price); orders with edit and cancel (a spinner while it goes, a refusal in words); history with each closed trade's details and **Share P&L**: a matte Skia-drawn card (the Kalks mark, symbol, side, the move in % and the net result in money, the close date; the client's referral code and its QR from the partner API when there is one and the reader keeps it on) shared as a PNG through the share sheet (`share/`; it never shows a balance, equity, account number or volume). Statements and Analytics (`/reports/analytics?login=<active>`) links, warmed on press-in. Connecting, offline and error states; a view-only login gets the shared account read-only (no share). |
| Trading core | `src/features/trading` | Engine session (SSO), account stream, live money, actions (incl. Close By), contract specs, accounts controller (`<TradingController />`, selectors), account switcher. The default account is a standard live one, else demo: never a prop, copy, PAMM or MAM account (`pick.ts`). |
| Accounts | `src/features/accounts` | Live / demo list with USD totals, open-account wizard (the Client Area's rules, credentials shown once), account screen: live figures for the active account, demo refill with the daily cap, leverage and trading / investor passwords confirmed with an emailed code, Trade on this account, transfer and statement shortcuts. Reusable: `useStepUp` / `StepUpCode` (`stepup.tsx`), and `SheetTextField` / `SheetOtpInput` for typing inside bottom sheets (a sheet only rises above the keyboard for its own inputs). |
| Wallet | `src/features/wallet` | The Client Area's wallet BFF (`/api/mobile/wallet/*`, same rules: identity check, restrictions, view-only and read-only staff sessions refused on the server). Overview (`/wallet`): the USDT balance, Deposit / Withdraw / Transfer (warmed on press-in), what is in progress, live accounts to top up, recent activity. Deposit (`/wallet/deposit[?intent=dep_…]`): only the service's address, network and token contract, with QR, copy and share, the expiry countdown and the transaction hash; the status is polled every 5 s until credited (illustration and one success haptic), and the request in progress is resumed after a trip to a wallet app. "Open in wallet app" is an EIP-681 link for BEP20 only (TronLink's transfer link needs the payer's own address and an HTTPS callback, so TRON uses QR, copy and share). Withdraw (`/wallet/withdraw`): the destination checked as typed (EIP-55, TRON base58check, other network, token contract), the service's quote before any code, an emailed code bound to `<chain>-<amount>`, a request id kept across network retries (never booked twice), cancel while waiting for review. Transfer (`/wallet/transfer[?to=|?from=]`): own live accounts, the engine's withdrawable amount as the limit, cent accounts in USC. History (`/wallet/history[?type=]`): filters, paging, a detail sheet with the server's explorer link and Back Office notes. Money actions are never optimistic, and a sheet closed while the server answers comes back with the answer. |
| Social | `src/features/social` | Copy trading, PAMM and MAM on the social BFF: leaderboard with filters and house disclosure, master profile (Skia growth curve with scrub, monthly returns, fee terms, delayed trades), follow wizard, my copies (pause, settings, stop: close all or keep the positions), PAMM funds / my investments (invest and redeem queued to the rollover, stop-loss, cancel), MAM programmes (terms-hash consent, limits, revoke: close or keep). Master and MAM-manager dashboards: summary plus "Manage on the web". Details: `src/features/social/README.md`. |
| Prop | `src/features/prop` | The Client Area's prop BFF (`/api/mobile/prop/*`, same rules: validation, ownership, payment, payout gates; view-only and read-only staff sessions can't pay or request a payout). Home (`/prop`): your challenges as colour blocks with progress, the plan catalogue (sizes, fee, key rules) with checkout in a sheet (one idempotency key per plan and size: a retry never charges twice), How it works. Challenge (`/prop/[id]`): the live rule dashboard on the engine stream (profit target, daily loss and drawdown rings on the UI thread, trading-days / time-limit / consistency bars, reset countdown, equity curve with floors, rule log, trades, certificates; breach / pass / funded / opening / closed states), Open in Trade. Payouts (`/prop/payouts`): quotes with what blocks them, request sheet, KYC gate, history. Certificates (`/prop/certificates`): Skia-drawn art, share as PNG, verify link. `/prop/mine?id=` resolves the prop service's notification links. Details: `src/features/prop/README.md`. |
| Platform | `src/features/platform` | Notifications inbox (`/notifications`: grouped by day, unread, mark read / all, each notification opens its screen). Push notifications (Expo push from services/support; a soft ask from the second launch, never on the first; a tap opens the screen; sign-out removes the phone). App lock (`/settings/app-lock`, `/lock`: Face ID / fingerprint / passcode on a cold start and after the chosen time in the background, a cover in the app switcher). Continue with Google (`<GoogleSignIn />` for the sign-in screens, `/google-profile`). Links into the app (`kalks://…`, `+native-intent`, `+not-found`). Founder steps and details: `src/features/platform/README.md`. |
| Academy | `src/features/academy` | The Client Area's Academy on the phone (same BFF, same rules: the service grades every quiz and exam, a pass of 60 % completes a chapter, a phase exam unlocks when all its chapters are complete and passing it issues the certificate). Home: continue where you left off, streak / chapters / quiz average / certificates, the eight phases as colour blocks. Phase: chapters by track (FlashList, memoised rows), final exam, certificate. Reader: the course markdown drawn natively (no WebView): callouts, tables that fit or scroll sideways, `text` blocks, svg diagrams with a pinch-zoom viewer; contents sheet, reading progress measured on the UI thread and synced like the web, instant server-graded quiz feedback, next / previous, practise on the demo account in the Trade tab; the chapter's updated date and the learner's completion date. Glossary: 257 terms, search, categories, A–Z scrubber, term sheet with related terms. Progress: by phase, certificates (drawn from the service's SVG; share, copy link, verify). Routes: `/academy`, `/academy/[phase]`, `/academy/[phase]/exam`, `/academy/chapter/[id]` (`?resume=1` reopens at the last position), `/academy/glossary` (`?q=`, `?term=<slug>`, `?focus=1`), `/academy/progress`. Measured on the web preview: reader scroll 60 fps with no screen re-render (4 commits of 4 fibers), no long task opening the longest chapter, glossary scroll and scrub 60 fps. |
| AI Trader and support chat | `src/features/ai`, `src/features/support`, `src/features/chat` | AI Trader (`/ai`): describe a strategy in words; the algo service's assistant returns the rules as a card with its assumptions and questions; edit the key numbers, backtest it (result card, then `/algo/backtests/[id]`) and deploy it on a demo or live account only through a confirmation sheet (then `/algo/strategies/[id]`); the conversation is kept on the phone. Support (`/support`, `/support/history`, `/support/[id]`): the Kalks AI bot streamed word by word, "Talk to a person", agents joining, typing and replying live, photo / PDF attachments, end and rate, history and read-only transcripts. One realtime socket for the app (`supportStream` in `src/features/support/stream.ts`, reusable for the notifications inbox). Shared chat building blocks in `src/features/chat`. Details: `src/features/ai/README.md`, `src/features/support/README.md`. |
| News and calendar | `src/features/news` | The Client Area's news and economic calendar (same BFF, same rules: the broker's pinned and hidden stories, teasers only with "Read at source" in the in-app browser, reminders and alerts refused for view-only and read-only staff sessions). News (`/news`): the daily AI brief, the lead story as a colour block (pinned in gold), rows with tone and importance chips and instruments, infinite scroll, filters (importance, tone, currency, instrument). Story (`/news/[id]`): opens from the list with no request; tagged instruments with live prices open the chart, currencies open their calendar, more on the same instrument. Calendar (`/calendar`): the week grouped by day under sticky headings in the phone's time zone (or server time), actual / forecast / previous, a reminder bell with a haptic (lead time 5–60 minutes in the event sheet), the now line, a day strip, the next high-impact countdown, high-impact alerts. Links: `/news?symbol=` / `?currency=`, `/calendar?currency=` / `?event=`. Measured on the web preview: feed and calendar scroll 60 fps with 4–6 components per commit, 0 commits idle, a price tick renders only its text. Details: `src/features/news/README.md`. |
| Depth of market and price alerts | `src/features/depth`, `src/features/alerts` | Depth (`/depth/[symbol]`): the market-data ladder with the account group's spread (Indicative when built from the live bid / ask), drawn as one Skia picture on the UI thread (a tick renders no React), the client's own pending orders tagged on it; tap a bid to buy limit, an ask to sell limit, Sell / Buy for market orders, through the Trade tab's `placeOrder`; one-tap trading (off by default, `useOneTap` in `oneTap.ts`) or a review sheet first. Price alerts (`/alerts`, `?symbol=` opens a new one): kept and checked server-side by market-data on every quote change (above / below a level, up / down by a %, bid or ask, repeat, expiry, pause), delivered through the support service (bell, email, push) as `alerts.price`; list with live distance leaves, swipe to delete, triggered history. Measured on the web preview: the ladder's ticks cause 0 React commits besides the Sell / Buy price leaves; ladder and alert list scroll at 60 fps. Details: `src/features/depth/README.md`. |
| Reports | `src/features/reports` | The Client Area's Statements and Analytics on the reports service (same BFF, same rules; read-only). Statements (`/reports/statements?login=`): PDF / Excel / CSV of one account for a day, month, year or custom range (server days) with the sections to include, and the monthly list with a month sheet; the file comes through `/api/mobile/reports` (`apiFile`), is written to the app cache (emptied on sign-out) and opens the share sheet. Analytics (`/reports/analytics?login=all\|<login>&period=7D\|30D\|90D\|1Y\|ALL`): net P&L hero and stat tiles, equity / balance / drawdown on Skia with a UI-thread scrub and tooltip (0 React commits while scrubbing), the P&L calendar from the service's `byDay`, breakdowns by symbol, weekday, hour and session, long vs short, money flow, charges and behaviour insights. Opens on the cached answer per account and period; while another loads, the previous one stays dimmed under its own labels; a failed load shows offline / not shared / error with a retry. View-only logins get their shared accounts only (the BFF also filters the analytics account list). Other screens warm it on press-in with `prefetchAnalytics` / `prefetchMonths` (`@/features/reports/api`). Measured on the web preview: 0 commits idle or while a position ticks, full-page scroll at 60 fps. |
| Partner (IB) and rewards | `src/features/partner`, `src/features/rewards` | The Client Area's partner programme and rewards (same BFFs `partner` / `growth`, same rules). Partner (`/partner`): the referral link as the hero (share sheet, copy, QR code with a shareable PNG), the month in big numbers (clients, active clients, network lots, commission), commission due and the batch close, the last 12 weeks, the level and both targets toward the next one, latest commission and top clients; a partner with no clients yet gets how the programme pays. `/partner/clients` (the broker's visibility setting: full or initials only; `/partner/clients/[id]` with each trade's commission or the reason it earned nothing), `/partner/commissions` (ledger, the broker's reason on rejected and void lines), `/partner/payouts` (countdown to the batch close), `/partner/links` (campaign links with their funnel, create, pause / resume), `/partner/programme` (rate card, rebate / split sliders, tiers, CPA, rules). Rewards (`/rewards`): points hero, cashback / offers / share card tiles, trading contests; `/rewards/contests/[id]` (live leaderboard, join with a live account or a demo account whose credentials are shown once), `/rewards/loyalty` (tiers, catalogue and redemption, vouchers, history), `/rewards/cashback` (programmes, enrol, 30-day bars), `/rewards/promotions` (promo codes, bonus offers and claims, bonuses with release progress), `/rewards/share` (share cards). View-only logins: the partner dashboard read-only without payouts or links, no rewards; read-only staff change nothing. Measured on the web preview: 60 fps scroll on every screen, 0 commits idle. Details: `src/features/partner/README.md`. |
| Algo | `src/features/algo` | The Client Area's algo BFF (same rules: the session's user, the broker's "algo" / "api" switches, view-only and read-only staff sessions refused on the server). Home (`/algo`): what runs now with its realized P&L, the account-wide kill switch (stop everything, optionally closing automation's positions; release), deployments, strategies, recent backtests, the ways in (AI Trader, marketplace, API keys and webhooks). Strategy (`/algo/strategies/[id]`): the rules in words, risk and schedule, the last backtest, deployments with pause / resume / stop / kill behind confirmations, backtests, versions; Deploy (modal: account, safety limits, a tick for live money). Deployment (`/algo/deployments/[id]`): day-by-day P&L curve, controls, the runtime log with older pages, trades, setup. Backtest report (`/algo/backtests/[id]`): progress and cancel, Skia equity and drawdown with scrub, statistics, monthly heat grid, trade list, data and costs; Run again (period picker). Marketplace (`/algo/marketplace`, `/[id]`, `/[id]/subscribe`): search and filters, house disclosure, verified track record, the house backtest labelled as simulated, reviews, subscribe free or paid from the wallet, cancel. API keys and webhooks (`/algo/keys`): usage, revoke, switch off, delete (created on the web). Details: `src/features/algo/README.md`. |
| Profile and More | `src/features/more`, `src/features/profile` | More tab: name, client ID, verification chip, restriction / view-only / staff notices, the broker's modules and legal pages from `/api/mobile/menu` (view-only logins read it too), sign out. Profile (the record as registered, change rules, a correction by chat or email), Verification (status tracker; individual and company flows with a guided camera, the photo library, files and the Client Area's instant checks; more-info resubmission), Security (sessions, sign-in history, password with an emailed code, view-only logins, data export and closure requests), Language (22, RTL restart), Notifications (push, in the app and email per topic; marketing consent). Statuses use the off-white "ok" tone, gold and ember (green / red stay for money). Details: `src/features/profile/README.md`. |

### Trading and chart building blocks (for other modules)

- `useActiveLogin()` / `setActiveLogin()` (`@/session/activeAccount`) pick the account.
  - `<TradingController />` (mounted in `app/(app)/_layout.tsx`, renders nothing) picks the default account (`pickDefault`: a standard live account, else demo, never a prop / copy / PAMM / MAM one), opens that account's engine stream and sets the quote group (the group list is never requested for view-only logins). It reads the list through selectors, so a refresh of the list's figures re-renders neither it nor the layout.
  - `useActiveAccount()` / `useAccounts()` (`@/features/trading/accounts`) read the account list, which is the shared `"trading/accounts"` cache. For a piece of it, prefer `useAccountsSelect(select)` or `useActiveAccountLabel()` (type, login, currency): they re-render only when that piece changes. `refreshAccounts()` refetches it (pull to refresh).
- **Live structure:** `useTrade(select)` gives positions, orders, recent deals and stream status. It changes only on fills, closes and modifications.
- **Live money:** `useAccountLive()` / `usePositionLive(ticket)` update from equity frames (at most 4 a second). Use them only in small leaf components; `useAccountValue((a) => a?.freeMargin)` for one number re-renders only when that number changes.
- **Actions:** `placeOrder`, `closePosition`, `closeBy`, `modifyPosition`, `modifyOrder`, `cancelOrder` (`@/features/trading/actions`). Haptics and toasts are included (a close that went through is a "done" toast whatever its result; red is for refusals). They return `{ ok }` or `{ ok: false, reason, title, body, uncertain }`:
  - `reason` is one localized line (for a toast); `title` / `body` fill a banner: the engine's reason in the reader's language, a plain-language hint (`mobileTrade.reject.<code>`) and the engine's own detail;
  - `uncertain`: no answer (network, timeout, 502 / 503 / 504), so the action may have gone through. Say so; never retry on your own.
  - Orders are idempotent: give `placeOrder` a `clientOrderId` (`newClientOrderId()`) and send the same one again after an uncertain answer. The engine then answers with the order it already has (`status: "duplicate"`, toast "Already placed") instead of opening a second trade. The order ticket does this.
- **Number entry:** `<Stepper label value digits step normalize onChange />` (`@/features/trading/Stepper`): typed on a decimal pad (keyboard-safe inside a sheet) or stepped with − / + (press and hold repeats, then speeds up). `normalize` rounds and clamps when the field is left; round again before you send (the reader may tap Confirm while typing).
- **Stream status:** `useTrade((s) => s.account !== null)` is true once the account's first snapshot arrived; `retryAccountStream()` for a Retry button.
- **Raw engine calls:** `tradeApi(login, path, init)` (`@/features/trading/session`) goes to `/api/mobile/trade/*` and renews a stale terminal session once.
- **Contract maths:** `useSpec(symbol)`, `marginFor`, `pipValue`, `profitAt`, `clampLots` (`@/features/trading/specs`) use the same formulas as the engine.
- **Quotes:**
  - `feed.quote(symbol)` / `feed.on(symbol, fn)` from JS;
  - `feed.sv(symbol)` shared values on the UI thread;
  - `useLiveQuote(symbol)`, `PriceCell`, `ChangeText`, `LivePrice` in React.
- **Chart:**
  - `<ChartLazy symbol tf digits type indicators fallback />` (`@/features/chart/ChartLazy`);
  - candles with `fetchCandles` / `prefetchCandles` (`@/features/chart/data`);
  - the Trade tab's symbol with `setTradeSymbol(symbol)` + `router.navigate("/trade")`, or a link to `/trade?symbol=X`.

## Performance (measured)

There is no Xcode or Android emulator on the build Mac, so these numbers come from the react-native-web build in headless Chromium, iPhone-size viewport, against the local stack, measured on 2026-09-30 with a Playwright probe:

- commits counted through a React DevTools hook;
- tick-to-screen timed from WebSocket frame arrival to the DOM text change;
- fps taken from `requestAnimationFrame` intervals.

These runs happened while other builds were loading the Mac (load average 8–19 on 8 cores), and headless Chromium draws WebGL on the CPU, so the chart numbers are pessimistic.

| What | Result (several runs) |
|---|---|
| Cold start with a saved session, reload to Home content on screen | 193–273 ms (medians around 200 ms) |
| Markets: tick to screen (WebSocket frame to price text changed) | p50 10–13 ms, p95 16–18 ms |
| Markets: work per tick | p50 **32** fibers rendered per React commit, max 137. A full Markets tree is about 900 fibers, so only the ticking price leaves render, never the rows or the list. |
| Fast watchlist scroll while prices tick | **60 fps**, 0 dropped frames (3 of 3 runs) |
| Chart pan | 56–60 fps, **0 React commits** during the pan |
| Chart pinch zoom (two-finger CDP touch) | 43–60 fps depending on load, **0 React commits** during the pinch |
| iOS Hermes bundle (`expo export --platform ios`) | 10 MB .hbc. About 4 MB of that is the 21 translated languages for the app's namespaces, loaded lazily per language. |

Re-measured in the core review (2026-09-30, same probe, load average 7–11):

| What | Result |
|---|---|
| Markets: tick to screen | p50 8–10 ms, p95 16–18 ms, no long tasks |
| Chart pan and pinch, quote frames muted | 60 fps, **0 React commits** caused by the gestures (with prices on, the only commits during a gesture are the header's price leaves) |
| Portfolio while positions tick | p95 77 fibers per commit (was 123): the summary is one leaf per number (`useAccountValue`) |
| Order ticket | tap on Buy to the confirm button on screen in 108–113 ms |
| Background refreshes | a poll or stale refresh whose answer did not change re-renders nothing (`useQuery` keeps the same data and doesn't announce `fetching` when data is on screen) |
| iOS Hermes bundle | 13.4 MB .hbc with every module |

Re-measured in the core follow-ups (2026-09-30, unminified web build, React DevTools hook, quote frames muted unless noted):

| What | Result |
|---|---|
| The account list refreshes (4 refetches with new figures after trades on the active account) | the signed-in layout, `TradingController`, `HomeScreen`, Explore and the account chip: **0 renders**; Home's equity block (the only full-list reader on screen): 6 |
| The Accounts screen polls the list every 5 s over the tabs | the layout, the controller and every tab screen: **0 renders** |
| Home while prices tick (12 s) | screens, Explore, Movers: 0 renders; only the mover cards' and the equity's leaves |
| Portfolio while positions tick (12 s) | `PortfolioScreen`, the rows and the list: 0 renders; only the P&L / price / summary leaves |

The web preview can't freeze hidden tabs (react-native-screens' web `Screen` has no freeze), so there the Home tab's price leaves keep rendering behind the other tabs and the commit counts above include them. On iOS and Android `freezeOnBlur` freezes hidden tabs.

Pre-rendering hidden tabs was tried and dropped. Preloaded tabs are never frozen, so their prices kept rendering in the background: tick p95 went from 18 to 57 ms and pinch fell to 45 fps. The app warms the chart module and the Trade tab's candles after the first paint instead.

On a phone, confirm the numbers with Expo Go's **Performance Monitor**: shake the phone, open the dev menu, and check that the UI and JS threads stay at 60 / 120 fps while scrolling Markets and panning the chart.

## Known gaps (phase 1)

- Translations for the new `mobile*` namespaces are English only for now; a dedicated pass translates them into the other 21 languages. Existing keys (`auth.*`, `order.*`, `market.*`, …) are already translated.
- Google sign-in and push notifications need the founder's one-time setup (the app's Google OAuth clients, an EAS project, APNs and FCM credentials): `src/features/platform/README.md` › Founder steps. Universal links (https://app.kalkstrade.com/… opening the app) wait for the store builds; the app already maps those links.
- On a phone, native smoothness has not been measured yet: this build Mac has no simulator. Use the Performance Monitor steps above.
- Local market-data runs in relay mode, so local candle history can have gaps. Production history is complete.
- Keyboard handling inside sheets (typed prices in the order ticket, codes in step-up sheets) was checked on the web preview only: confirm on an iPhone and an Android phone that the sheet rises with the keyboard.
- No shared-element transition from a watchlist row to the chart header. Tabs are not pre-rendered: the data and the chart module are warmed instead (see Performance).

## Phase 2 (not in this build)

| Area | Scope |
|---|---|
| Device features | Universal / app links (needs the Apple Team ID and the signing certificate; the app already maps the links) |
