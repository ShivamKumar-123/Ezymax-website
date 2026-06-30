/**
 * Onboarding tour — all step content in ONE config (easy to edit / translate
 * later). Each step is tagged with the `page` it belongs to so the controlled
 * tour can navigate between the dashboard and the trading terminal.
 *
 * Shape maps onto a driver.js step: `element` is a CSS selector (omit for a
 * centered, modal-style step), `title`/`description` fill the popover, and
 * `side`/`align` hint the popover placement.
 *
 * To translate: swap the `title`/`description` strings for t('key') calls.
 */
import { TOUR_TARGETS, sel } from './tourTargets';

export type TourPage = 'dashboard' | 'terminal';
type Side = 'top' | 'right' | 'bottom' | 'left';
type Align = 'start' | 'center' | 'end';

export interface TourStep {
  /** Which route this step lives on. Drives multi-page navigation. */
  page: TourPage;
  /** CSS selector of the spotlight target; omit for a centered modal. */
  element?: string;
  title: string;
  description: string;
  side?: Side;
  align?: Align;
}

export const TOUR_STEPS: TourStep[] = [
  // ── Phase 1 — Dashboard ──
  {
    page: 'dashboard',
    title: 'Welcome to FXArtha 👋',
    description:
      "Let's take a quick 60-second tour of the essentials. Click Next to begin — you can Skip anytime.",
  },
  {
    page: 'dashboard',
    element: sel(TOUR_TARGETS.DASHBOARD_BALANCE),
    title: 'Your balance',
    description: 'Your wallet balance at a glance.',
    side: 'bottom',
    align: 'start',
  },
  {
    page: 'dashboard',
    element: sel(TOUR_TARGETS.DASHBOARD_DEPOSIT),
    title: 'Add funds',
    description: 'Add funds here to start trading.',
    side: 'bottom',
    align: 'start',
  },
  {
    page: 'dashboard',
    element: sel(TOUR_TARGETS.TOPBAR_PROFILE),
    title: 'Profile & settings',
    description: 'Your profile, KYC and settings live here.',
    side: 'bottom',
    align: 'end',
  },
  {
    page: 'dashboard',
    element: sel(TOUR_TARGETS.SIDEBAR_HELP),
    title: 'Need help?',
    description: 'Reach our 24/7 support team anytime from here.',
    side: 'right',
    align: 'start',
  },
  {
    page: 'dashboard',
    element: sel(TOUR_TARGETS.DASHBOARD_TRADE_NOW),
    title: 'Open the terminal',
    description: "Let's head to the trading terminal — click Next.",
    side: 'bottom',
    align: 'start',
  },

  // ── Phase 2 — Trading terminal ──
  {
    page: 'terminal',
    element: sel(TOUR_TARGETS.INSTRUMENTS_TICKER),
    title: 'Top instruments',
    description: 'Your top instruments — click any to switch the active symbol.',
    side: 'bottom',
    align: 'start',
  },
  {
    page: 'terminal',
    element: sel(TOUR_TARGETS.ORDER_MARKETS_BUTTON),
    title: 'All markets',
    description:
      'Browse 100+ instruments — Forex, Gold, Indices, Crypto. Click any to load it on the chart.',
    side: 'left',
    align: 'start',
  },
  {
    page: 'terminal',
    element: sel(TOUR_TARGETS.CHART_MAIN),
    title: 'Live chart',
    description: 'Live price chart. Change the timeframe from the toolbar above.',
    side: 'top',
    align: 'center',
  },
  {
    page: 'terminal',
    element: sel(TOUR_TARGETS.ORDER_BUY_SELL),
    title: 'Buy & Sell',
    description:
      'Trade instantly — Buy = go long (you profit when price rises), Sell = go short (you profit when price falls).',
    side: 'left',
    align: 'start',
  },
  {
    page: 'terminal',
    element: sel(TOUR_TARGETS.ORDER_VOLUME),
    title: 'Trade size',
    description: 'Set your trade size (lots) before you Buy or Sell.',
    side: 'left',
    align: 'start',
  },
  {
    page: 'terminal',
    element: sel(TOUR_TARGETS.ORDER_SL_TP),
    title: 'Stop Loss / Take Profit',
    description:
      'Set a Stop Loss and Take Profit to manage risk automatically — recommended on every trade.',
    side: 'left',
    align: 'start',
  },
  {
    page: 'terminal',
    element: sel(TOUR_TARGETS.POSITIONS_OPEN_TAB),
    title: 'Open positions',
    description: 'Your active trades appear here — click any to modify or close it.',
    side: 'top',
    align: 'start',
  },
  {
    page: 'terminal',
    element: sel(TOUR_TARGETS.POSITIONS_PENDING_TAB),
    title: 'Pending orders',
    description: 'Limit and stop orders waiting to trigger show up here.',
    side: 'top',
    align: 'start',
  },
  {
    page: 'terminal',
    element: sel(TOUR_TARGETS.POSITIONS_BALANCE),
    title: 'Account summary',
    description: 'Your live balance, equity, margin and free margin.',
    side: 'top',
    align: 'end',
  },
  {
    page: 'terminal',
    title: "You're all set! 🎉",
    description:
      'Happy trading. You can replay this tour anytime from Profile → Take a Tour.',
  },
];

/** Route each page maps to. */
export const PAGE_ROUTES: Record<TourPage, string> = {
  dashboard: '/dashboard',
  terminal: '/trading/terminal',
};
