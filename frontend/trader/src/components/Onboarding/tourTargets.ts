/**
 * Central registry of `data-tour="..."` target names for the onboarding tour.
 *
 * BOTH the tour step definitions (tourSteps.ts) AND the actual DOM elements
 * reference these constants — so a rename is one place, and a `grep` for any
 * value finds every reference. Values are plain string literals (no dynamic
 * interpolation) so they stay greppable.
 *
 * Usage on an element:  <div data-tour={TOUR_TARGETS.DASHBOARD_BALANCE}>
 * Usage in a step:      target: sel(TOUR_TARGETS.DASHBOARD_BALANCE)
 */
export const TOUR_TARGETS = {
  // ── Dashboard ──
  DASHBOARD_BALANCE: 'dashboard-balance',
  DASHBOARD_DEPOSIT: 'dashboard-deposit',
  DASHBOARD_TRADE_NOW: 'dashboard-trade-now',
  // ── Global chrome ──
  TOPBAR_PROFILE: 'topbar-profile',
  SIDEBAR_HELP: 'sidebar-help',
  // ── Terminal ──
  INSTRUMENTS_TICKER: 'instruments-ticker',
  ORDER_MARKETS_BUTTON: 'order-markets-button',
  CHART_MAIN: 'chart-main',
  ORDER_BUY_SELL: 'order-buy-sell',
  ORDER_VOLUME: 'order-volume',
  ORDER_SL_TP: 'order-sl-tp',
  POSITIONS_OPEN_TAB: 'positions-open-tab',
  POSITIONS_PENDING_TAB: 'positions-pending-tab',
  POSITIONS_BALANCE: 'positions-balance',
} as const;

export type TourTarget = (typeof TOUR_TARGETS)[keyof typeof TOUR_TARGETS];

/** CSS attribute selector for a tour target. */
export const sel = (t: TourTarget): string => `[data-tour="${t}"]`;
