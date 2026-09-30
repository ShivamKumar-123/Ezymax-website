# Partner (IB) and rewards (`src/features/partner`, `src/features/rewards`)

The Client Area's partner programme and rewards on the phone: the same BFFs, the same services and the same rules as
the web pages under `/partner` and `/rewards` (apps/crm). No new server routes: `partner` and `growth` are rewrite
families of the mobile BFF (`apps/crm/lib/mobile.ts`), so `/api/mobile/partner/*` is served by
`app/api/partner/[[...path]]` (services/ib `/v1/ib/me/*`) and `/api/mobile/growth/*` by `app/api/growth/[[...path]]`
(services/growth `/v1/growth/me/*`) with the bearer session. The partner and the client always come from the session;
the app never sends a user id.

## Screens

| Route | What it shows |
|---|---|
| `/partner` | The referral link as the hero (code in display type, share sheet, copy, QR) with its funnel (clicks, sign-ups, funded); the month in four big-number tiles (clients, active clients, network lots, commission); commission due and when the batch closes; the last 12 weeks as bars (drag to read a week); the level card (ladder of levels, both monthly targets toward the next level, what it unlocks); the latest commission lines; top clients; partner tools. A partner with no clients yet gets how the programme pays (from the broker's own rate card, CPA and payout schedule) with the partner illustration instead of empty lists. |
| `/partner/clients` | The network three tiers deep as the broker's visibility setting allows (full: names, emails, trades; masked: initials and totals only, with a notice). Totals, search, status and tier filters. FlashList of fixed-height memoised rows; a row opens the client (full visibility only, like the web). `?status=active` preselects a filter. |
| `/partner/clients/[id]` | One client: tier and where they came from, KYC, first deposit and trade, lots, what they earned the partner, and their closed trades: what each paid, or why it earned nothing as a label (held too briefly, not a live account, self-referral check, excluded group…, every reason code of services/ib). |
| `/partner/commissions` | The ledger: totals by status (rejected and void shown as "not counted"), status and type filters, pages of 50 loaded near the end of the list. A rejected or voided line carries the broker's reason as a label; tapping a line opens everything about it (rate, tier, deal, batch, payable from). |
| `/partner/payouts` | What is accruing in the current period with a countdown to the batch close, the minimum payout, how a batch gets paid, and every payout with its status. |
| `/partner/links` | Campaign links (the default `/r/CODE` and named ones with UTM tags): funnel per link, share, copy, QR, pause / resume, and a new-link sheet (name, optional slug that follows the name like the IB service's `slugify`, UTM tags, live preview; the created link is copied). |
| `/partner/programme` | Rate card per level and symbol group, rebate to own clients and split with sub-IBs (sliders that follow the finger on the UI thread, within the programme's maximums, with a worked example), tier shares, the CPA bonus, and the rules that decide whether a deal earns. |
| `/rewards` | Loyalty points as the hero (tier, value, progress to the next tier), cashback / offers / share card / contest record as tiles, and trading contests: the featured one (running first, else the next to start) as a colour block, the others, and past contests. The broker's targeted banners (placement `rewards`, like the web's BannerSlot) sit at the top of the hub, points, cashback and promotions: impression once per mount, a click opens the app's screen for the link (else the web page), dismiss hides it for the client. |
| `/rewards/contests/[id]` | Prize pool and time left, the reader's entry (rank, score in the contest's unit, trades still needed to rank, prize on track) or Join / Register, prize bands, rules and anti-cheat terms, the live leaderboard (top 100, refreshed every 15 s while the contest runs). Joining: a live contest with one of the eligible live accounts (groups, minimum equity); a demo contest opens a demo account whose credentials are shown once, with "Trade on this account". |
| `/rewards/loyalty` | Balance, tiers with multipliers and perks, how points are earned, the rewards catalogue with redemption (a trading bonus needs a live account; tier, stock and balance are shown before the server checks them again), vouchers, redemptions and the points history with filters. |
| `/rewards/cashback` | Accrued, this month, paid and lifetime; the last 30 days as bars; programmes (automatic or opt-in with Enrol, monthly cap); payouts and the latest accruals. |
| `/rewards/promotions` | Promo codes (optionally for one live account), bonus offers with terms and claiming (a fixed bonus on a chosen live account; a deposit bonus waits for the qualifying deposit), the client's bonuses with release progress, and the codes used with the reason a code was refused. |
| `/rewards/share` | Share cards (D136): a period's results on one account, amounts only when the client opts in, with the referral link; the card's image from the Client Area (`/s/<code>/image`), share the link or the image, and the cards made before with their views. |

## Rules kept from the Client Area

- **View-only logins (D90):** the proxy refuses every change they send. With the Partner section they read the dashboard, clients, commission and rates; payouts and campaign links are kept out of their reach like the web's `VIEWER_BLOCKED_PAGES` (the rows are hidden and the routes show a "not shared" state). Rewards are never part of a view-only login's access (every rewards route shows the "not shared" state without loading into refusals).
- **Read-only staff sessions** read everything and change nothing (the server refuses too); the screens say so and hide or disable the actions.
- **Broker modules (D112):** `ib` and `rewards` switched off answer `module_disabled`; the screens show the programme-off state. The More tab already hides them.
- **Restrictions:** the partner hub shows the `ib` restriction banner.
- **Right-to-left:** layouts use start / end; the slider, the level ladder and the bars are rows (no absolute start offsets), so they mirror on phones and in the web preview alike, and the drag gestures read the finger from the start edge.
- **Money actions are never optimistic:** rebate / split, links, joining, redeeming, enrolling, claiming and promo codes show the server's answer (in the reader's language, `rewardsText` maps the growth service's sentences), then the affected views refetch.
- **One request at a time, and the answer is never lost** (`sheet.ts`): a second tap, the keyboard's return key (promo codes) or a sheet reopened while the server answers can't send a redemption, claim, entry, promo code, link, share card or rebate change twice. A sheet closed with a tap outside while its request is in flight keeps its item and comes back with the answer: a demo contest's one-time credentials, a voucher code, or the reason for a refusal (a success without a view ends on its toast). While a request is out the sheet can't be swiped away.
- **Contest prizes:** a standing shows a prize (on track, or won) only when it is qualified and not disqualified, like the growth service's `allocate_prizes`; after finalizing, the server's own prize. An entry under the minimum trades keeps its rank but wins nothing.
- **Links:** notifications and deep links open the sub-screens at the Client Area's paths (the platform's link map: `/partner/payouts`, `/rewards/cashback`, `/rewards/contests/<id>` …). A contest link by slug (a banner's call to action) finds the contest's id in the contests list, since the growth service reads contests by id only; an unknown slug shows "not found".
- **States on the palette:** tags for states use the wallet and social screens' tones (settled = warm off-white, waiting = gold, refused / failed = ember); green and red are only for money amounts, and an amount that rounds to $0.00 is grey.

## Building blocks

- `components/Chrome.tsx`: the stack bar whose title fades in once the display title scrolls away (UI thread), page title, section headings, tags, label-over-number stats, bars, nav rows, pull to refresh with the haptic tick. `components/States.tsx`: offline (connection-lost art), maintenance, module off, view-only, setting up, error, and content-shaped static skeletons. `components/Tiles.tsx`: big-number colour tiles. `components/DayBars.tsx`: bars with a drag-to-read gesture. The rewards screens use them too.
- `share.ts`: the system share sheet (link + message; iOS takes the URL separately), the clipboard, and PNG files through expo-sharing (the web preview uses the Web Share API or a download).
- `qr.ts`: QR codes from qrcode-generator (level Q): one SVG path for the screen and a 1-bit PNG encoded in the module (stored deflate blocks, CRC32, Adler-32), so sharing a QR image needs no native module.
- `tint.ts`: translucent colours derived from the tokens (hairlines on colour blocks, state tints), never hex values.
- `sheet.ts`: `useSheetWrite` (one write at a time from a bottom sheet; the sheet keeps its item and comes back with the answer when it was closed meanwhile) and `useOneAtATime` (the same guard for writes sent from a screen).
- `lib.ts` (partner) and `rewards/lib.ts`: pure helpers (money, lots, week buckets, durations, commission lines, the slug rule, contest scores and prize bands, the growth service's sentences), tested with node.

## Performance (web preview, 390 × 844, local stack)

Every screen scrolls at 60 fps with 0 frames over 25 ms; no screen commits while idle (the payout and contest countdowns are leaf components that re-render only their text, every 30 s / 1 s / 1 min); a scroll causes at most a few 2–4 fiber commits (the stack bar); dragging across the 12-week bars renders only the bars (31 fibers per bar change).

## Tests

```bash
node --import ./apps/mobile/scripts/test-hooks.mjs --test apps/mobile/scripts/partner-lib.test.mts
node --test apps/crm/tests/mobile-partner.test.mjs
```

The first checks the pure logic (week buckets, durations, commission lines, the campaign slug rule against the IB service's own test vector, the QR PNG decoded back module by module, contest scores and prize bands) and that every reason code in services/ib and every growth-service sentence the app maps has words in the catalog. The second runs the proxy and both BFFs against stub services: identity from the bearer session only, filtered query keys, view-only and read-only staff refusals before the services, module switches.

## Known gaps

- The web's network tree (`/partner/network`) is not drawn on the phone; the clients list shows the tier and the sub-IB a client came through.
- Share cards are for a period; a card for one closed trade (`kind: "trade"`, the web's "Share P&L" on trade history) can be made with `createShare()` from the portfolio history.
