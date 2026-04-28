# FXArtha Trader — Architecture Guide

> FAANG-grade frontend architecture for the FXArtha trading platform.
> Next.js 15 App Router · React 18 · Zustand · TailwindCSS · TypeScript

---

## Directory Structure

```
src/
├── app/                              # Next.js App Router — ROUTES ONLY
│   ├── (landing)/                    # Landing page route group
│   ├── auth/
│   ├── trading/
│   ├── dashboard/
│   ├── wallet/
│   ├── api/                          # API routes (proxy layer)
│   ├── layout.tsx                    # Root layout
│   └── globals.css                   # Global styles → move to styles/
│
├── config/                           # App-wide configuration
│   ├── env.ts                        # Runtime env validation
│   ├── constants.ts                  # Magic numbers, feature flags
│   ├── routes.ts                     # All route paths (single source of truth)
│   └── brand.ts                      # Brand name, logos, URLs
│
├── features/                         # Domain modules (the core pattern)
│   ├── auth/
│   │   ├── components/
│   │   │   ├── AuthInput.tsx
│   │   │   └── LoginForm.tsx
│   │   ├── hooks/
│   │   │   └── useAuth.ts
│   │   ├── store/
│   │   │   └── authStore.ts
│   │   ├── lib/
│   │   │   └── authClient.ts
│   │   ├── types.ts
│   │   └── index.ts                  # Barrel export
│   │
│   ├── trading/
│   │   ├── components/
│   │   │   ├── OrderPanel/
│   │   │   │   ├── OrderPanel.tsx
│   │   │   │   ├── OrderForm.tsx
│   │   │   │   ├── LeverageSelector.tsx
│   │   │   │   ├── PriceInput.tsx
│   │   │   │   └── index.ts
│   │   │   ├── PositionsPanel/
│   │   │   │   ├── PositionsPanel.tsx
│   │   │   │   ├── PositionRow.tsx
│   │   │   │   ├── PositionActions.tsx
│   │   │   │   ├── ClosePositionModal.tsx
│   │   │   │   ├── ModifyPositionModal.tsx
│   │   │   │   └── index.ts
│   │   │   ├── Watchlist/
│   │   │   │   ├── Watchlist.tsx
│   │   │   │   ├── WatchlistRow.tsx
│   │   │   │   └── index.ts
│   │   │   ├── ShareTrade/
│   │   │   │   ├── ShareTradeCard.tsx
│   │   │   │   ├── ShareTradeModal.tsx
│   │   │   │   └── index.ts
│   │   │   ├── Terminal/
│   │   │   │   ├── TerminalLeftRail.tsx
│   │   │   │   ├── TerminalLayout.tsx
│   │   │   │   └── index.ts
│   │   │   ├── AccountBar.tsx
│   │   │   ├── ActiveAccountBadge.tsx
│   │   │   ├── InstrumentsTable.tsx
│   │   │   ├── MobileOrderSheet.tsx
│   │   │   └── RiskCalculator.tsx
│   │   ├── hooks/
│   │   │   ├── useTradingAccount.ts
│   │   │   ├── useMarketData.ts
│   │   │   ├── useOrderExecution.ts
│   │   │   └── usePositions.ts
│   │   ├── store/
│   │   │   └── tradingStore.ts
│   │   ├── lib/
│   │   │   ├── datafeed.ts
│   │   │   ├── marketHours.ts
│   │   │   ├── tradingNav.ts
│   │   │   ├── tradingDashboard.ts
│   │   │   └── tradingViewSymbols.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── wallet/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── store/
│   │   ├── lib/
│   │   └── index.ts
│   │
│   ├── social/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── index.ts
│   │
│   ├── portfolio/
│   │   ├── components/
│   │   └── index.ts
│   │
│   ├── news/
│   │   ├── components/
│   │   ├── lib/
│   │   │   └── economicCalendar.ts
│   │   └── index.ts
│   │
│   ├── notifications/
│   │   ├── components/
│   │   │   ├── NotificationListener.tsx
│   │   │   └── NotificationPoller.tsx
│   │   ├── store/
│   │   │   └── notificationStore.ts
│   │   └── index.ts
│   │
│   ├── landing/
│   │   ├── components/               # All landing UI (Navbar, Footer, etc.)
│   │   ├── pages/                    # Landing page components
│   │   ├── animations/
│   │   ├── landing.css
│   │   └── index.ts
│   │
│   └── academy/
│       ├── data/
│       │   └── academy.ts
│       └── index.ts
│
├── shared/                           # Cross-feature shared code
│   ├── components/
│   │   ├── ui/                       # Design system primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Dropdown.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Tabs.tsx
│   │   │   └── index.ts
│   │   ├── layout/                   # App shell chrome
│   │   │   ├── AppHeader.tsx
│   │   │   ├── AppSidebar.tsx
│   │   │   ├── DashboardShell.tsx
│   │   │   ├── FXArthaWordmark.tsx
│   │   │   ├── MobileBottomNav.tsx
│   │   │   ├── TopBar.tsx
│   │   │   ├── TraderHeader.tsx
│   │   │   └── index.ts
│   │   ├── charts/                   # TradingView wrappers
│   │   │   ├── AdvancedChart.tsx
│   │   │   ├── Chart.tsx
│   │   │   ├── TradingViewChart.tsx
│   │   │   └── index.ts
│   │   └── ErrorBoundary.tsx
│   ├── hooks/
│   │   ├── useDocumentTitle.ts
│   │   ├── useMediaQuery.ts
│   │   ├── useDebounce.ts
│   │   ├── useLocalStorage.ts
│   │   └── index.ts
│   ├── lib/
│   │   ├── api/
│   │   │   └── client.ts
│   │   ├── ws/
│   │   │   ├── wsManager.ts
│   │   │   ├── priceSocket.ts
│   │   │   ├── tradeSocket.ts
│   │   │   └── index.ts
│   │   ├── pdf/
│   │   │   └── tradeStatementPdf.ts
│   │   ├── sounds.ts
│   │   └── utils.ts
│   ├── stores/                       # Global-only stores
│   │   ├── uiStore.ts
│   │   ├── platformStatusStore.ts
│   │   └── wsStore.ts
│   └── types/
│       ├── charting_library.d.ts
│       ├── datafeed-api.d.ts
│       └── index.ts
│
├── styles/                           # Global styles
│   └── globals.css
│
└── test/                             # Test infrastructure
    ├── setup.ts
    ├── utils.tsx                      # renderWithProviders, mocks
    └── mocks/
        └── handlers.ts               # MSW handlers
```

---

## Rules & Conventions

### 1. Feature Module Rules
- Each feature is **self-contained**: own components, hooks, store slice, lib, types.
- Features **never import from another feature** directly. Use `shared/` or lift to shared.
- Feature barrel (`index.ts`) exports only the **public API** of that feature.
- If two features need the same thing → promote it to `shared/`.

### 2. App Router Rules
- `app/` contains **route shells only** — thin wrappers that import from `features/`.
- Page files should be < 50 lines. All logic lives in feature components.
- Example:
  ```tsx
  // app/trading/page.tsx
  import { TradingPage } from '@/features/trading';
  export default function Page() { return <TradingPage />; }
  ```

### 3. Component Rules
- **Max 300 lines** per component file. Split into sub-components.
- Components that exceed this get their own folder:
  ```
  OrderPanel/
  ├── OrderPanel.tsx       # Main orchestrator
  ├── OrderForm.tsx        # Form sub-component
  ├── PriceInput.tsx       # Reusable input
  └── index.ts             # Barrel: export { OrderPanel } from './OrderPanel'
  ```
- Co-locate component-specific hooks and utils inside the component folder.

### 4. Import Rules
- **Absolute imports only** via `@/` alias.
- Import order (enforced by ESLint):
  1. React / Next.js
  2. External libraries
  3. `@/shared/`
  4. `@/features/`
  5. Relative (same feature/component only)
- **Barrel imports for shared**: `import { Button, Modal } from '@/shared/components/ui'`
- **Direct imports within features**: avoid deep barrel re-exports.

### 5. State Management Rules
- **Global stores** (`shared/stores/`): auth, UI preferences, platform status, WebSocket state.
- **Feature stores** (`features/X/store/`): trading positions, wallet balances, etc.
- Stores must expose **selectors**, not raw state. Example:
  ```ts
  // Good
  const positions = useTradingStore(s => s.openPositions);
  // Bad
  const store = useTradingStore();
  ```

### 6. Hook Rules
- Custom hooks that use feature-specific store/API → `features/X/hooks/`
- Truly generic hooks (useDebounce, useMediaQuery) → `shared/hooks/`
- Every hook must have a `use` prefix. No exceptions.

### 7. Naming Conventions
| Item | Convention | Example |
|------|-----------|---------|
| Component files | PascalCase | `OrderPanel.tsx` |
| Hook files | camelCase with `use` prefix | `useTradingAccount.ts` |
| Store files | camelCase with `Store` suffix | `tradingStore.ts` |
| Util/lib files | camelCase | `marketHours.ts` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_LEVERAGE` |
| Types/interfaces | PascalCase, no `I` prefix | `Position`, `TradeOrder` |
| Barrel exports | Always `index.ts` | — |

### 8. Testing Conventions
- Test files: `ComponentName.test.tsx` co-located next to source.
- Integration tests: `__tests__/` folder at feature root.
- Minimum coverage targets: 80% for `lib/`, 60% for components.
- Use `@testing-library/react` + Vitest.

### 9. Error Handling
- Every async operation must have error boundaries or try/catch.
- Use `<ErrorBoundary>` at feature boundaries (each route).
- Toast for user-facing errors, `console.error` for dev-only.

### 10. Performance
- Lazy-load features with `dynamic()` at the route level.
- Heavy components (charts, PDF) should be dynamically imported.
- Use `React.memo()` for pure list items (PositionRow, WatchlistRow).
- Zustand selectors prevent unnecessary re-renders.

---

## Migration Checklist

### Phase 1: Infrastructure (non-breaking)
- [ ] Create `src/config/` (env.ts, constants.ts, routes.ts, brand.ts)
- [ ] Create `src/shared/` scaffold with barrel exports
- [ ] Create `src/features/` scaffold with barrel exports
- [ ] Add ErrorBoundary component
- [ ] Add Vitest + testing-library setup
- [ ] Add path alias `@/config`, `@/shared`, `@/features`

### Phase 2: Shared Layer
- [ ] Move `components/ui/` → `shared/components/ui/`
- [ ] Move `components/layout/` → `shared/components/layout/`
- [ ] Move `components/charts/` → `shared/components/charts/`
- [ ] Move `hooks/` → `shared/hooks/`
- [ ] Move `lib/api/`, `lib/ws/`, `lib/utils.ts` → `shared/lib/`
- [ ] Move `stores/uiStore`, `platformStatusStore`, `wsStore` → `shared/stores/`
- [ ] Move `types/` → `shared/types/`
- [ ] Update all imports

### Phase 3: Feature Extraction
- [ ] Extract `features/auth/` (store, login/register components)
- [ ] Extract `features/trading/` (store, all trading components, hooks, lib)
- [ ] Extract `features/wallet/`
- [ ] Extract `features/social/`
- [ ] Extract `features/portfolio/`
- [ ] Extract `features/news/`
- [ ] Extract `features/notifications/`
- [ ] Extract `features/landing/` (entire landing/ directory)
- [ ] Extract `features/academy/`

### Phase 4: Component Splitting
- [ ] Split `PositionsPanel.tsx` (90KB) → PositionRow, PositionActions, modals
- [ ] Split `OrderPanel.tsx` (31KB) → OrderForm, PriceInput, LeverageSelector
- [ ] Split `Watchlist.tsx` (31KB) → WatchlistRow, WatchlistHeader
- [ ] Split `AccountTradePanel.tsx` (28KB)
- [ ] Split `MobileOrderSheet.tsx` (16KB)
- [ ] Split `InstrumentsTable.tsx` (17KB)

### Phase 5: Polish
- [ ] Thin out `app/` route pages to < 50 lines each
- [ ] Add missing hooks (useWebSocket, useTradingAccount, useMarketData)
- [ ] Add `React.memo` to list item components
- [ ] Add `dynamic()` imports for heavy routes
- [ ] ESLint import-order rule
- [ ] Write example unit tests for 3 features
- [ ] Remove old duplicate files

---

## File Move Map (old → new)

| Old Path | New Path |
|----------|----------|
| `components/ui/*` | `shared/components/ui/*` |
| `components/layout/*` | `shared/components/layout/*` |
| `components/charts/*` | `shared/components/charts/*` |
| `components/trading/*` | `features/trading/components/*` |
| `components/accounts/*` | `features/trading/components/*` |
| `components/landing/*` | `shared/components/landing/*` |
| `components/providers/*` | `features/auth/components/*` |
| `components/profile/*` | `features/auth/components/*` |
| `components/demo/*` | `shared/components/*` |
| `components/NotificationListener.tsx` | `features/notifications/components/` |
| `components/NotificationPoller.tsx` | `features/notifications/components/` |
| `components/ThemeProvider.tsx` | `shared/components/ThemeProvider.tsx` |
| `hooks/useDocumentTitle.ts` | `shared/hooks/useDocumentTitle.ts` |
| `stores/authStore.ts` | `features/auth/store/authStore.ts` |
| `stores/tradingStore.ts` | `features/trading/store/tradingStore.ts` |
| `stores/notificationStore.ts` | `features/notifications/store/` |
| `stores/marketDataStore.ts` | `features/trading/store/` |
| `stores/uiStore.ts` | `shared/stores/uiStore.ts` |
| `stores/platformStatusStore.ts` | `shared/stores/platformStatusStore.ts` |
| `stores/wsStore.ts` | `shared/stores/wsStore.ts` |
| `stores/shellStore.ts` | `shared/stores/shellStore.ts` |
| `lib/api/client.ts` | `shared/lib/api/client.ts` |
| `lib/ws/*` | `shared/lib/ws/*` |
| `lib/pdf/*` | `shared/lib/pdf/*` |
| `lib/charting/*` | `features/trading/lib/*` |
| `lib/brand.ts` | `config/brand.ts` |
| `lib/utils.ts` | `shared/lib/utils.ts` |
| `lib/sounds.ts` | `shared/lib/sounds.ts` |
| `lib/marketHours.ts` | `features/trading/lib/marketHours.ts` |
| `lib/tradingNav.ts` | `features/trading/lib/tradingNav.ts` |
| `lib/trading-dashboard.ts` | `features/trading/lib/tradingDashboard.ts` |
| `lib/tradingViewSymbols.ts` | `features/trading/lib/tradingViewSymbols.ts` |
| `lib/economic-calendar.ts` | `features/news/lib/economicCalendar.ts` |
| `lib/terminalLayout.ts` | `features/trading/lib/terminalLayout.ts` |
| `lib/wallet/*` | `features/wallet/lib/*` |
| `landing/*` | `features/landing/*` |
| `data/academy.ts` | `features/academy/data/academy.ts` |
| `types/*` | `shared/types/*` |
| `charting/*` | kept at root (static assets for TradingView) |
