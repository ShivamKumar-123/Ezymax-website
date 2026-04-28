/**
 * Single source of truth for all route paths.
 * Never hardcode paths in components — import from here.
 */

export const ROUTES = {
  // ── Auth ──
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  RESET_PASSWORD: '/auth/reset-password',

  // ── Dashboard ──
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  KYC: '/kyc',

  // ── Trading ──
  TRADING: '/trading',
  TRADING_TERMINAL: '/trading/terminal',
  OPEN_ACCOUNT: '/trading/open-account',
  ACCOUNTS: '/accounts',

  // ── Finance ──
  WALLET: '/wallet',
  DEPOSIT: '/deposit',
  TRANSACTIONS: '/transactions',

  // ── Social ──
  SOCIAL: '/social',
  PORTFOLIO: '/portfolio',
  PAMM: '/pamm',

  // ── Tools ──
  NEWS: '/news',
  ALGO_CONNECTOR: '/algo-connector',
  RISK_CALCULATOR: '/risk-calculator',
  EDGE_BUILDER: '/edge-builder',

  // ── Business ──
  BUSINESS: '/business',
  WHITE_LABEL: '/white-label',

  // ── Support ──
  SUPPORT: '/support',

  // ── Landing ──
  HOME: '/',
  ABOUT: '/company/about',
  WHY_FXARTHA: '/company/why-fxartha',
  CONTACT: '/company/contact',
  PLATFORMS: '/platforms',

  // ── Legal ──
  TERMS: '/terms',
  PRIVACY: '/privacy',
  RISK: '/risk',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
