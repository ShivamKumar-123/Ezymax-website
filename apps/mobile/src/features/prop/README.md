# Prop (mobile)

Prop challenges in the Kalks app: the plan catalogue and checkout, a live rule dashboard for each challenge, payouts and certificates. Server side it is the Client Area prop BFF (`apps/crm/app/api/prop/[...path]`, reached as `/api/mobile/prop/*`) in front of `services/prop`, so the app runs on the same validation, ownership, payment and payout rules as the web Client Area.

## Screens

| Route | Screen | What it does |
|---|---|---|
| `/prop` | `screens/PropHome.tsx` | The hero (a matte ember block: the best profit split on sale and the founder's "prop challenge" art; with no plans on sale the plain subtitle instead, the empty catalogue carrying the art), your challenges (open ones as colour blocks with their progress, finished ones as rows), payouts and certificates at a glance, the plan catalogue (colour-block cards with sizes, fee and key rules), How it works. Checkout opens as a sheet. |
| `/prop/[id]` | `screens/ChallengeScreen.tsx` | The live rule dashboard of a challenge: equity, the profit-target ring (or the payout window on funded accounts), daily-loss and max-drawdown rings, trading-days, time-limit and consistency bars, the daily reset countdown, the equity curve with its floors and target, stats, the rule log, closed trades, certificates, account details. Breach, pass, funded, opening, payment-failed and closed states take over the top. A phase passed while the trader watches stays on screen with its passed state ("Go to Phase 2"). Open in Trade makes the account the app's active account and shows the Trade tab. |
| `/prop/payouts` | `screens/PayoutsScreen.tsx` | Available / in review / paid totals, each funded account's quote (profit, split, firm share, fee refund) with what still blocks it, the request sheet, profit split and scaling, history. The service takes a request only from a verified trader, so an unverified one gets "Verify identity" instead of the request (and a pending verification a disabled request with the reason). |
| `/prop/certificates` | `screens/CertificatesScreen.tsx` | Every certificate as a colour tile; the viewer draws it and shares it. |

`/prop/mine` (the Client Area's page, used by the prop service's notification links) redirects to the challenge in `?id=`, else to `/prop`. Other modules link to `/prop` (More tab, Home). Deposit shortcuts go to `/wallet/deposit`, KYC to `/profile/verification`, support to `/support`.

## Data

- Reads use `useQuery(…, { persist: true })` (open on the cached answer, refresh in the background) with the keys in `api.ts` (`prop/…`). Polls run only while a screen is in front (`useIsFocused`): the challenge every 3 s without the stream and every 8 s with it, lists every 20 s. `useStable` keeps the same object while a poll brings nothing new, so the memoised sections below the screen skip the render.
- Money actions (`purchaseChallenge`, `requestPayout`) call the server directly and show only its answer. A purchase carries one idempotency key per plan + size in an open checkout: a retry after a lost answer (network, time-out, 5xx such as `payment_pending`) never charges twice. A final refusal (4xx: `insufficient_funds`, `plan_unavailable`, `account_unavailable`…) takes a new key, because the service keeps the refused purchase under the old one and would only replay it; an answer carrying a challenge that ended (closed and refunded, payment failed) is shown as that error, never as "You're in". A double tap sends one request (a ref, set before the first await). After a confirmed purchase or payout the prop screens, the wallet and the accounts list refresh (`refreshAfterMoney`).
- View-only logins and read-only staff sessions (`useReadOnly`) see everything but can't pay or request a payout (the proxy refuses them too).
- A challenge that ended (failed, closed, payment failed) isn't polled any more; pull to refresh still works.
- Closed challenges: when the engine refuses the next account (for example the broker's accounts-per-user limit on the prop group), the service refunds the fee and closes the challenge; the dashboard says so (never "opening"), with Contact support.
- Errors: the service's codes map to `mobileProp.error.*`; payout gate codes keep the service's wording for English readers (it carries dates and amounts). `insufficient_funds` offers Deposit, `kyc_required` offers Verify identity.

## Live

`live.ts` streams the challenge's current account from the trading engine, the stream Kalks Trader uses: a terminal session for the client's own account from the mobile trade BFF (`trade/session`, shared with the Trade tab through `features/trading/session.ts`) and a one-time ticket (`trade/stream-ticket`).

- Equity frames (at most 4 a second) land in Reanimated shared values. The rings, bars and the chart's live head derive their share on the UI thread with the same maths as `services/prop/src/rules.rs` (`rules.ts`: daily loss from the reference at the reset, trailing or static drawdown floor from the high-water mark, target on closed balance). Only leaf texts (`LiveText`) subscribe to the numbers, coalesced to one render per frame. Measured on the web preview: 42 equity frames in 20 s rendered `LiveText` 55 times and the screen 6 times (its polls), frames p95 16.8 ms.
- A deal, an account status change or a resync refetches the prop service's verdict at once (debounced), so a breach or a pass shows within about a second.
- Without a stream (view-only or read-only staff sessions, an older server) the gauges follow the evaluator's numbers from the polls; the badge says when they were checked. The socket closes after 30 s in the background and reconnects with backoff and a 15 s silence watchdog.

## Motion and haptics

Functional only, like the rest of the app: pull to refresh and choosing a size or showing a password (selection) give a haptic; a purchase or a payout answer, a copy or a navigation tap don't. Gauges ease to new values (220 ms); nothing loops.

## Skia

`components/skia/parts.tsx` draws the rings, bars, the equity curve (flat lines and a flat low-opacity fill: the app's matte finish) and the certificate art. On native it is imported as is (`components/gauges.tsx`). On web (`gauges.web.tsx`) each part renders a same-size placeholder until CanvasKit is loaded (`canvaskit.wasm` at the site root, copied by `scripts/copy-canvaskit.mjs`), then the drawing module is imported.

## Certificates

The art is drawn on the phone (portrait 1080 × 1350, the post format) with the app's fonts: the kind's colour block, the headline, the figure, the trader, the issue date and a QR code of the public verify page (`<Client Area>/verify/<code>`). The same drawing is shown in the viewer and rendered off screen (`drawAsImage`) to a PNG for the share sheet (`expo-file-system` + `expo-sharing`; the web preview downloads it). Its texts stay English like the web certificate image, since it is a verifiable document; dates are UTC like the verify page.

## Tests

`lib.ts` holds the pure logic (no React Native): the live rule maths (worklets, same definitions as
`services/prop/src/rules.rs`), the 17:00 New York reset clock (each day judged on its own for daylight time) and how
a purchase answer is read (which refusals take a new idempotency key, which answers carry an ended challenge).

```bash
node --import ./apps/mobile/scripts/test-hooks.mjs --test apps/mobile/scripts/prop-lib.test.mts
```

The server side (identity from the bearer, purchase validation and idempotency key, payouts, view-only / read-only
staff / module-off policies) is `apps/crm/tests/mobile-prop.test.mjs`.

## Strings

`packages/i18n/src/catalog/en/mobileProp.ts` (English; the translation pass adds the other languages).
