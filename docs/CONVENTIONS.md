# Kalks Frontend Conventions

These rules apply to anyone, human or AI, working in the Kalks monorepo:

- `apps/crm`: Client Area, http://localhost:3000
- `apps/admin`: Back Office, http://localhost:3001
- `apps/terminal`: Kalks Trader trading terminal, http://localhost:3002
- `services/market-data`: Rust market-data service (prices, candles, spreads), http://localhost:8081; see `services/market-data/README.md`

The page and design rules below apply to the three Next.js apps.

- **Design source of truth:** `.superdesign/design-system.md`
- **Visual references:** `.superdesign/references/*.png`
- **Quality bar:** `apps/crm/app/(app)/page.tsx` (the dashboard). Match its density, polish and motion.

## Stack
- Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Motion (`motion/react`), lucide-react.
- Shared UI lives in `packages/ui` (import from `@kalks/ui`).
- Mock data lives in `packages/mock` (import from `@kalks/mock`, or from a sub-file `@kalks/mock/<file>`).

## Where things go
- **Pages:** `apps/<app>/app/(app)/<module>/.../page.tsx`. Pages are client components (`"use client"`) that use mock data.
- **Components specific to one module:** `apps/<app>/components/<module>/*.tsx`.
- **Mock data for a module:** create `packages/mock/src/<module>.ts` and import it via `@kalks/mock/<module>`. Do **not** edit `packages/mock/src/index.ts` or `client.ts`; other people are working in parallel.
- **Shared UI:** do **not** edit files in `packages/ui` unless told to. If you need a new reusable widget, put it in your app's `components/` folder.
- Navigation is already defined in `apps/crm/lib/nav.ts` and `apps/admin/lib/nav.ts`. Every `sub` href there must resolve to a real page.

## Design rules
- **Page skeleton:** start every page with `<PageHeader title subtitle actions />`. Then use a grid of `<Card>` blocks with `<CardHeader title subtitle action />` (padding `px-6`, content `px-4 sm:px-6 pb-5/6`).
- **Numbers:**
  - Money uses `<Money value />`, which dims the decimals and counts up.
  - Deltas use `<Delta value />`.
  - Live prices use `<LivePrice symbol />` or `<PriceText />` with `useQuote(s)` / `useQuotes([...])`.
  - All numbers get the `k-num` class.
  - IDs, logins, hashes and tickets use `font-mono`.
- **Symbols:** `<SymbolCell symbol />` or `<SymbolAvatar symbol />`. Real flags, coin and stock logos are wired in.
- **People:** `<Avatar src={person.photo} name />` with real portraits from `PEOPLE` in `@kalks/mock`. Flags: `<Flag country="in" />`.
- **Status:** `<StatusChip status="pending|approved|rejected|processing|completed|running|verified|…" />` or `<Chip tone="up|down|ember|gold|warn|info|neutral">`.
- **Tables:** `<DataTable columns rows search exportName pageSize />`. Cells stay concise; right-align numbers.
- **Lists:** `<ListRow>` for rounded sub-card rows (signals/watchlist style); `k-row` class for custom rows.
- **KPI rows:** `<KpiCard label value icon chip chipTone href illustration? hot? />`.
- **Charts:**
  - `<EquityChart data />`: gold line over a dotted grid with volume bars.
  - `<Gauge />`: glowing ring.
  - `<Donut data />`, `<BarcodeBars />`, `<CapsuleBars />`, `<Sparkline />`, `<DivergingBar />`, `<MiniBars />`.
- **Controls:**
  - Tabs: `<Segmented>` (pills) and `<Tabs>` (underline).
  - Steps: `<Stepper>`.
  - Overlays: `<Dialog>` (pass `side="right"` for a drawer), `<Menu>`, `<Tooltip>`, `<Popover>`.
  - Forms: `<Field label><Input leading trailing /></Field>`, `<Toggle>`.
  - Buttons: `<Button variant="ember|surface|ghost|outline|buy|sell|up-outline|down-outline|gold" size="xs..xl">`, `<IconButton>`.
- **Feedback:** `toast` from `sonner` confirms every action (approve, save, copy, submit). No dead buttons: every button either opens something or toasts.
- **Imagery:**
  - Real photos are in `/assets/photos/*.jpg`: trading-screen, stock-market, crypto, bitcoin, money, analytics, dashboard, skyscrapers, skyline, dubai, singapore, london, nyc, gold, crypto-coins, trader, charts, finance.
  - Portraits: `/assets/people/{men|women}-NN.jpg`.
  - Feature icons via `<AnimIcon name="coin|rocket|trophy|money_bag|shield|bank|crown|gem_stone|robot|…" />` (static lucide tiles; `Icon3D` is an alias). No emoji, no image icons.
  - Never use emoji as icons, and never use lorem ipsum.
- **Motion:** wrap page sections in `<Reveal delay>` for a staggered fade-up. Use `SpotlightCard` / `Starfield` / `k-hot-card` sparingly for hero or highlight cards (ember gradient).
- **Colours:** only the tokens: `bg-bg/surface/surface-2/surface-3`, `text-fg/fg-2/fg-3`, `border-line`, `ember`, `gold`, `up`, `down`, `warn`, `info` (plus their `-soft` variants). No purple, blue-SaaS, or random hex values.
- **Layout:** responsive down to 360px (use `grid-cols-1` then `sm/lg/xl`). Tables scroll horizontally on mobile.
- **Realistic data:**
  - Symbols from `INSTRUMENTS`, people from `PEOPLE`.
  - Logins look like `80412337`; server time is GMT+3; amounts are realistic; USDT on TRC20.

## Verify your work
- Typecheck: `cd apps/<app> && npx tsc --noEmit`. Fix errors in YOUR files. Other people's in-progress files may show errors; ignore those.
- Screenshot: open the page with Playwright (e.g. 1440×900), take a screenshot and check the browser console for errors. Review the image and fix visual problems.
