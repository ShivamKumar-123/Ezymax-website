/**
 * Onboarding tour — all step content in ONE config (easy to edit / translate
 * later). Each step is tagged with the `page` it belongs to so the controlled
 * tour can navigate between the dashboard and the trading terminal.
 *
 * To translate: swap the `title`/`content` strings for t('key') calls — the
 * structure stays the same.
 */
import type { Step } from 'react-joyride';
import { TOUR_TARGETS, sel } from './tourTargets';

export type TourPage = 'dashboard' | 'terminal';

export interface TourStep extends Step {
  /** Which route this step lives on. Drives multi-page navigation. */
  page: TourPage;
}

const center: Pick<Step, 'placement' | 'disableBeacon'> = {
  placement: 'center',
  disableBeacon: true,
};

export const TOUR_STEPS: TourStep[] = [
  // ── Phase 1 — Dashboard ──
  {
    page: 'dashboard',
    target: 'body',
    ...center,
    title: 'Welcome to FXArtha 👋',
    content:
      "Let's take a quick 60-second tour of the essentials. Click Next to begin — you can Skip anytime.",
  },
  {
    page: 'dashboard',
    target: sel(TOUR_TARGETS.DASHBOARD_BALANCE),
    title: 'Your balance',
    content: 'Your wallet balance at a glance.',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    page: 'dashboard',
    target: sel(TOUR_TARGETS.DASHBOARD_DEPOSIT),
    title: 'Add funds',
    content: 'Add funds here to start trading.',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    page: 'dashboard',
    target: sel(TOUR_TARGETS.TOPBAR_PROFILE),
    title: 'Profile & settings',
    content: 'Your profile, KYC and settings live here.',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    page: 'dashboard',
    target: sel(TOUR_TARGETS.SIDEBAR_HELP),
    title: 'Need help?',
    content: 'Reach our 24/7 support team anytime from here.',
    disableBeacon: true,
    placement: 'right',
  },
  {
    page: 'dashboard',
    target: sel(TOUR_TARGETS.DASHBOARD_TRADE_NOW),
    title: 'Open the terminal',
    content: "Let's head to the trading terminal — click Next.",
    disableBeacon: true,
    placement: 'bottom',
  },

  // ── Phase 2 — Trading terminal ──
  {
    page: 'terminal',
    target: sel(TOUR_TARGETS.INSTRUMENTS_TICKER),
    title: 'Top instruments',
    content: 'Your top instruments — click any to switch the active symbol.',
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    page: 'terminal',
    target: sel(TOUR_TARGETS.ORDER_MARKETS_BUTTON),
    title: 'All markets',
    content:
      'Browse 100+ instruments — Forex, Gold, Indices, Crypto. Click any to load it on the chart.',
    disableBeacon: true,
    placement: 'left',
  },
  {
    page: 'terminal',
    target: sel(TOUR_TARGETS.CHART_MAIN),
    title: 'Live chart',
    content: 'Live price chart. Change the timeframe from the toolbar above.',
    disableBeacon: true,
    placement: 'top',
  },
  {
    page: 'terminal',
    target: sel(TOUR_TARGETS.ORDER_BUY_SELL),
    title: 'Buy & Sell',
    content:
      'Trade instantly — Buy = go long (you profit when price rises), Sell = go short (you profit when price falls).',
    disableBeacon: true,
    placement: 'left',
  },
  {
    page: 'terminal',
    target: sel(TOUR_TARGETS.ORDER_VOLUME),
    title: 'Trade size',
    content: 'Set your trade size (lots) before you Buy or Sell.',
    disableBeacon: true,
    placement: 'left',
  },
  {
    page: 'terminal',
    target: sel(TOUR_TARGETS.ORDER_SL_TP),
    title: 'Stop Loss / Take Profit',
    content:
      'Set a Stop Loss and Take Profit to manage risk automatically — recommended on every trade.',
    disableBeacon: true,
    placement: 'left',
  },
  {
    page: 'terminal',
    target: sel(TOUR_TARGETS.POSITIONS_OPEN_TAB),
    title: 'Open positions',
    content: 'Your active trades appear here — click any to modify or close it.',
    disableBeacon: true,
    placement: 'top',
  },
  {
    page: 'terminal',
    target: sel(TOUR_TARGETS.POSITIONS_PENDING_TAB),
    title: 'Pending orders',
    content: 'Limit and stop orders waiting to trigger show up here.',
    disableBeacon: true,
    placement: 'top',
  },
  {
    page: 'terminal',
    target: sel(TOUR_TARGETS.POSITIONS_BALANCE),
    title: 'Account summary',
    content: 'Your live balance, equity, margin and free margin.',
    disableBeacon: true,
    placement: 'top',
  },
  {
    page: 'terminal',
    target: 'body',
    ...center,
    title: "You're all set! 🎉",
    content:
      'Happy trading. You can replay this tour anytime from Profile → Take a Tour.',
  },
];

/** Route each page maps to. */
export const PAGE_ROUTES: Record<TourPage, string> = {
  dashboard: '/dashboard',
  terminal: '/trading/terminal',
};
