# Ezymex Design System v2 (reference-driven)

## 1. Product context
Ezymex is a global multi-asset broker platform (Forex, Metals, Indices, Energies, Crypto CFDs, Stocks, Prop challenges) competing with Exness, XM and Vantage. There are two surfaces:

1. **Client Area (CRM):**
   - Dashboard, trading accounts (Live/Demo · Standard/Pro/Cent/ECN · Hedging/Netting), wallet (USDT-TRC20)
   - Portfolio and analytics, Partner (IB), Copy trading, PAMM, Prop challenges, Contests & Rewards
   - API & Algo, Strategy builder, Academy, AI Coach, Profile/KYC, Support
2. **Back Office (Super Admin):** dense operations for dealer, risk, finance, compliance, sales and support staff, plus the platform owner (multi-broker white-label).

## 2. Visual DNA (from founder's references)
Premium **dark-first** trading UI:
- **Near-black canvas** with **one warm ambient glow**: an ember-orange radial glow bleeding in from the top edge of the page, fading to black within ~400px.
- **Floating pill navigation.**
- **Soft-edged dark cards**: a subtle top-lit inner gradient and a 1px hairline border that is brighter at the top edge.
- **Round icon buttons**, **huge numbers with dimmed decimals**, **gold line charts over dotted grids** with hatched volume bars.
- **3D glossy illustrated icons** (coins, rocket, chart bars, shield, wallet, trophy) as accents in KPI cards.
- **Circular glowing gauge** (fear & greed / margin level), **AI prompt bar with suggestion chips**.
- Faint **star/particle noise** texture inside hero cards.

It must feel luxurious, cinematic and alive, but still readable and dense enough for real trading data. Not flat SaaS.

## 3. Logo
Use the founder's real logo (files in `brand/`): the **"Ezymex"** wordmark, a bold geometric rounded sans with a split angled **K** (a vertical bar with a cut top-left corner + two parallelogram strokes). White version on dark, black version on light. Never redraw or restyle the wordmark. In the 76px icon rail, use the **K glyph alone** as the mark, white on a --surface-3 rounded square with a faint ember glow.

## 4. Colour tokens

### Dark (default)
| Token | Value | Use |
|---|---|---|
| --bg | #07070A | page |
| --bg-glow | radial-gradient(1200px 420px at 50% -120px, rgba(255,92,31,.55), rgba(196,52,20,.25) 40%, transparent 70%) | top ambient ember glow on every page |
| --surface | #111114 | cards |
| --surface-2 | #17171C | inner rows, inputs, table header |
| --surface-3 | #1E1E24 | hover, pills |
| --card-gradient | linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.01)) over --surface | |
| --border | rgba(255,255,255,.07) | hairlines |
| --border-top | rgba(255,255,255,.14) | brighter top edge of cards/pills |
| --text | #F5F5F7 | |
| --text-2 | #A1A1AA | |
| --text-3 | #63636E | labels, dimmed decimals |
| --ember | #FF5A1F | Ezymex primary: CTAs, active pill, glow |
| --ember-2 | #FF8A3D | gradient end: CTA = linear-gradient(135deg,#FF7A2F,#E8431A) |
| --ember-soft | rgba(255,90,31,.12) | active backgrounds, chips |
| --gold | #E9B949 | charts, premium (IB level, prop, VIP), highlights |
| --gold-soft | rgba(233,185,73,.12) | |
| --up | #22C55E (soft rgba(34,197,94,.12)) | profit, BUY |
| --down | #F04438 (soft rgba(240,68,56,.12)) | loss, SELL |
| --warn | #F59E0B · --info #38BDF8 | |

### Light (secondary theme)
- **Base:** --bg #F6F4F1 (warm off-white) with the same ember glow at 18% opacity; --surface #FFFFFF; --surface-2 #FAF8F5; --border rgba(15,15,20,.08); --text #0E0E12; --text-2 #55555F; --text-3 #9A9AA3.
- **Colours:** ember/gold/up/down unchanged (gold darkened to #C9971F for contrast).
- **Cards:** white with a soft shadow `0 1px 2px rgba(0,0,0,.04), 0 8px 24px -12px rgba(0,0,0,.08)`.

## 5. Typography
- **UI:** "Geist" (fallback Inter).
- **Display numbers:** "Geist" 600 with tabular numerals. **Decimals and trailing digits are dimmed** to --text-3 ($54,208.**11** where ".11" is dimmed). Prices: the last pip is larger.
- **Mono:** "Geist Mono" for logins, tickets, hashes and tables of prices.

Scale:
- KPI display 34/40/600
- Page greeting 30/36/500 ("Good evening, Arjun")
- H2 18/24/500
- Body 14/20
- Label 12/16 uppercase +0.04em, --text-2
- Micro 11/14

## 6. Shape, spacing, elevation
- **Radius:** 20 for cards; 14 for inner rows/list items (rows are their own rounded sub-cards on --surface-2); 999 for pills, chips, icon buttons and CTAs.
- **Spacing:** 8px grid; card padding 24; gaps 16–20.
- **Elevation:** no hard shadows in dark mode. Depth comes from the gradient, the top border highlight and glows.
- **Primary CTA:** ember gradient pill, 44px, soft ember outer glow `0 8px 24px -8px rgba(255,90,31,.6)`.
- **Highlighted card:** e.g. the selected account, or the Balance KPI in ref 2. Filled with a deep ember→dark gradient and a faint star-particle texture.

## 7. Layout & navigation
- **Left icon rail**, 76px, floating (inset 12px, radius 24, --surface):
  - Top: logo mark.
  - Middle: module icons in 44px round buttons, the active one ember-soft with an ember icon and a small ember bar on the left.
  - Bottom: support, avatar, logout.
  - Hovering an icon shows a tooltip label.
- **Top bar** (transparent over the glow):
  - Left: EZYMEX wordmark or page title.
  - Center: a **floating pill tab group** with the current module's sub-pages. E.g. Dashboard module: Overview · Accounts · Wallet · Portfolio · Analytics. The active pill is filled --surface-3 with a white icon + label and a bright top border; inactive pills are round icon-only or text-only.
  - Right: round icon buttons (search ⌘K, language flag, theme moon/sun, notifications with an ember dot), an ember "Deposit" CTA pill, and an avatar with a verified tick.
- **Page header:** large greeting or page title + subtitle; primary CTA on the right.
- **Client Area modules (rail):**
  - Dashboard, Accounts, Wallet, Portfolio & Analytics, Trade (opens the terminal)
  - Partner (IB), Copy & PAMM, Prop Challenges, Contests & Rewards
  - API & Algo, Academy & AI Coach, Profile & Verification, Support
- **Back Office:**
  - Same rail pattern, with more modules: Command Center, Clients, Trading, Config, Finance, Partners, Social & Algo, Prop Firm, Marketing, Support, Content, Analytics, Security & Audit, Organization, Brokers, Settings.
  - Sub-pages go in the pill nav, overflowing into a "More ▾" pill.
  - Denser tables (row 44).
  - Top bar adds: tenant switcher pill, feed-status pill (● Infoways live 38ms), server clock GMT+3, queue counter chips.
- Max content width 1600; responsive to 360px (the rail becomes a bottom tab bar on mobile).

## 8. Components
- **KPI card** (ref 1):
  - Uppercase label at top left, round 40px icon button at top right (outlined, arrow/chart icon).
  - Huge number with dimmed decimals.
  - Bottom row: a darker footer band with a pill chip (+3.4% green; "5 BUY | 4 SELL"; "Simulated portfolio") and a ↗ link icon at the far right.
- **Illustrated KPI card** (ref 2): icon + title, value, delta pill, and a **3D glossy illustration** at the bottom right (coin stack, rocket, bar chart).
- **List row** (signals/trades/watchlist):
  - A rounded row sub-card on --surface-2 with an overlapping coin/flag avatar pair, symbol + small description.
  - On the right: a percentage in bold and status pills (BUY green-outline, SELL red-outline, ● RUNNING ember-outline).
  - The last row fades out with a gradient mask.
- **Account card:**
  - Top: account type pill (LIVE ember / DEMO gold outline), group "Pro · Hedging", login in mono with a copy icon, server "Ezymex-Live01".
  - Balance (big, dimmed decimals); Equity / Free margin / Margin level / Leverage in a 4-up mini grid of inner rounded rows.
  - Actions: Trade (ember pill), Deposit, Withdraw (surface pills), ⋯.
  - Credential fields in rounded inputs (Login, Investor pass, Master pass with eye toggle), as in ref 2.
- **Charts:**
  - Balance/equity line in **gold** over a **dotted grid**, with a hover crosshair vertical dashed line.
  - Volume/activity as thin **hatched vertical bars** at the bottom.
  - Range pills 1D 1W 1M 3M YTD 1Y ALL (active = filled surface-3).
  - Weekly bar chart with rounded capsule bars; the active capsule glows (ember gradient) with a value tooltip pill.
  - P/L distribution as thin barcode bars, red for losses and green for profits.
- **Gauge:** circular ring, ember→red gradient arc with an outer glow, big number in the centre + label (Greed / Margin level / Risk score).
- **Tables:**
  - Header row in a rounded --surface-2 bar; body rows separated by hairlines; numbers tabular.
  - BUY/SELL as coloured soft pills; profit coloured.
  - Search pill at the top right.
- **Chips/pills:** 26px, radius 999, soft fill + 1px border; status dot variants.
- **AI prompt bar:** a rounded 20px container with an ember gradient border glow; suggestion chips row above; an ember round button with a sparkle on the left; "Ask anything about markets…"; a mic/voice button on the right.
- **Economic calendar row:** a left coloured impact bar (red high, amber medium), time, event name, currency pill.
- **Countdown / timer box:** mono digits in a rounded input (ref 2, "07:14:45").
- **Profile header:** real portrait avatar, name, status pills (Active green, Instant/Pro grey), account # with copy icon.

## 9. Imagery
- Real portrait photos (diverse, professional) for avatars, masters, IBs and support.
- Real skyline/trading-desk photography for promo, academy and auth, colour-graded dark with an ember tint.
- **3D glossy illustrations** for KPI accents and empty states (gold coins, BTC coin, rocket, bar chart, shield, trophy, wallet), consistent ember/gold/violet-free palette.
- Official coin logos (BTC orange, ETH, USDT green, SOL), circular country flags, stock logos.

## 10. Motion
- The ambient glow slowly breathes (opacity .85↔1, 8s).
- Numbers count up on load; live prices flash green/red on the changed digits.
- Cards fade + rise 12px with a 50ms stagger; active pill slides between tabs (shared layout animation).
- The chart line draws in; gauge arcs sweep in over 900ms.
- Hover: card border-top brightens + a subtle radial spotlight following the cursor (React Bits "spotlight card").
- CTA shimmer sweep every 6s; star particles drift slowly in highlighted cards.
- Honour reduced-motion.

## 11. Content rules
Realistic data only:
- Symbols: EURUSD 1.08456, XAUUSD 2,654.30, BTCUSD 63,412.00, NAS100 20,118.4.
- Names: Arjun Mehta, Fatima Al-Sayed, Lucas Ferreira, Nguyen Thu Ha.
- Logins like 80412337, server "Ezymex-Live01", USDT TRC20 addresses TQ7x…9KfE, server time GMT+3.
- Cent accounts in USC.

## 12. Fidelity constraint
Use ONLY the fonts, colours, radii, glows, spacing and component styles defined in this design system. Do not introduce purple/violet, blue-SaaS palettes, or any fonts, colours or styles not listed here.
