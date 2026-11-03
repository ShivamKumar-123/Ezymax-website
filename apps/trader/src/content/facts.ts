/**
 * Every number on the website comes from here, and every value here comes from the Ezymex platform repo
 * (paths relative to that repo). Most values are seeded defaults that Back Office staff can change, so
 * re-check them against production before a campaign. Never add a number without a source.
 */

/** config/instruments.json (1,389 rows); live rule in services/trading/src/specs.rs:15-18 */
export const INSTRUMENTS = {
  total: 1389,
  liveMarkets: 261, // 28 core + 233 catalogue rows with "live": true
  byClass: {
    forex: { total: 63, live: 44 },
    metals: { total: 16, live: 16 },
    energies: { total: 4, live: 4 },
    indices: { total: 34, live: 32 },
    crypto: { total: 167, live: 160 },
    stocks: { total: 1105, live: 5, comingSoon: 1100 }, // 800 US, 150 Hong Kong, 150 Tokyo
  },
  assetClasses: 6,
} as const;

/** config/trading-specs.json — maximum leverage per instrument class (min of account and symbol cap applies) */
export const LEVERAGE = {
  accountMax: 1000, // Standard and Cent groups, services/trading/migrations/0001_trading.sql:57-64
  coreCaps: { forex: 1000, metals: 500, indices: 200, energies: 200, crypto: 20, stocks: 10 },
} as const;

export type AccountType = {
  id: string;
  name: string;
  tagline: string;
  currency: string;
  minDeposit: string;
  leverage: string;
  leverageOptions: string;
  pricing: string;
  spread: string;
  commission: string;
  marginCall: string;
  stopOut: string;
  mode: string;
  bestFor: string;
  highlight?: boolean;
};

/** Trading engine groups `standard`, `pro`, `vip` (Back Office -> Trading -> Groups) and the XAUUSD spread markups
 *  per spread group (market-data). "Gold from" is the lowest all-in XAUUSD spread seen over five days of raw ticks
 *  (raw minimum 0.16) plus the group's gold markup; it is a floor, not a typical figure. */
export const ACCOUNTS: AccountType[] = [
  {
    id: 'standard',
    name: 'Standard',
    tagline: 'Designed for traders seeking simplicity, flexibility and seamless market access.',
    currency: 'USD',
    minDeposit: '$20',
    leverage: '1:1000',
    leverageOptions: '1:50 Â· 1:100 Â· 1:200 Â· 1:500 Â· 1:1000',
    pricing: 'All-in spread, no commission',
    spread: 'Gold from $0.45',
    commission: 'None',
    marginCall: '100%',
    stopOut: '50%',
    mode: 'Hedging',
    bestFor: 'Most traders, from the first trade on',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Built for active traders who require enhanced pricing and optimised execution.',
    currency: 'USD',
    minDeposit: '$200',
    leverage: '1:500',
    leverageOptions: '1:50 Â· 1:100 Â· 1:200 Â· 1:500',
    pricing: 'Tighter spread + commission',
    spread: 'Gold from $0.30',
    commission: '$6 per lot round turn',
    marginCall: '100%',
    stopOut: '50%',
    mode: 'Hedging',
    bestFor: 'Active traders who want tighter pricing',
    highlight: true,
  },
  {
    id: 'vip',
    name: 'VIP',
    tagline: 'Engineered for high-performance trading with ultra-tight spreads and precision execution.',
    currency: 'USD',
    minDeposit: '$1,000',
    leverage: '1:500',
    leverageOptions: '1:50 Â· 1:100 Â· 1:200 Â· 1:500',
    pricing: 'Raw spread + commission',
    spread: 'Gold from $0.16',
    commission: '$10 per lot round turn',
    marginCall: '100%',
    stopOut: '50%',
    mode: 'Hedging',
    bestFor: 'Large accounts and professional volume',
  },
];

/** services/trading/migrations/0001_trading.sql:47-49 and services/trading/README.md:149 */
export const DEMO = {
  defaultBalance: '$10,000',
  balanceRange: '$100 to $1,000,000',
  refillsPerDay: 3,
} as const;

/** services/options (seed.rs:46-58, README.md:11-17, migrations/20261002120000_options.sql) */
export const OPTIONS = {
  underlyingsLive: ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'EURJPY', 'GBPJPY', 'XAUUSD', 'XAGUSD', 'USOIL', 'UKOIL'],
  underlyingsSoon: ['NZDUSD'],
  fxPairs: 9,
  expiries: { daily: 'the next 5 business days', weekly: 'the next 4 Fridays', monthly: 'the next 3 month-end Fridays' },
  dailyPerWeek: 5,
  cut: '10:00 New York',
  settlement: 'Cash in USD, at the average of 1-second mid prices over the 30 minutes before the cut',
  contract: { fx: '10,000 units of the base currency', xau: '1 oz', xag: '50 oz', oil: '10 barrels' },
  commission: '$0.25 per contract, capped at 10% of the premium',
  contractsPerOrder: '1 to 100',
  strategies: ['Long call', 'Long put', 'Straddle', 'Strangle', 'Bull call spread', 'Bear put spread', 'Iron condor', 'Butterfly'],
  maxLegs: 8,
  models: 'Garman-Kohlhagen (FX), Black-Scholes with a lease rate (gold, silver), Black-76 (oil)',
} as const;

/** services/ib/src/model.rs:106-127, 254-262 — USD per lot: FX major / FX minor / metals / indices / energies / crypto / stocks */
export const IB_LEVELS = [
  { name: 'Bronze', fxMajor: 5, metals: 8, crypto: 6, cpa: 200, needs: 'From sign-up' },
  { name: 'Silver', fxMajor: 7, metals: 10, crypto: 8, cpa: 200, needs: '10 active clients · 200 lots a month' },
  { name: 'Gold', fxMajor: 9, metals: 12, crypto: 10, cpa: 300, needs: '50 active clients · 1,000 lots a month' },
  { name: 'Platinum', fxMajor: 11, metals: 13.5, crypto: 12, cpa: 300, needs: '150 active clients · 3,000 lots a month' },
  { name: 'Diamond', fxMajor: 13, metals: 15, crypto: 14, cpa: 300, needs: '400 active clients · 8,000 lots a month' },
] as const;

export const IB = {
  tiers: 3, // default network depth paying 100% / 20% / 10% of the per-lot rate
  tierShares: '100% · 20% · 10%',
  payout: 'Weekly, every Monday, to your USDT wallet',
  minPayout: '$10',
} as const;

/** services/trading/migrations/0002_social.sql:16-29, services/trading/README.md:431-470, 595-604 */
export const SOCIAL = {
  perfFee: 'up to 50%',
  trackRecordDays: 30,
  minMasterEquity: '$100',
  minAllocation: '$50',
  historyDelay: '30 minutes',
  sizingModes: ['Equity ratio', 'Fixed allocation', 'Multiplier', 'Fixed lot'],
  followerControls: ['Maximum lot size', 'Equity stop', 'Maximum drawdown', 'Excluded symbols'],
  mamMethods: ['Equity', 'Balance', 'Multiplier', 'Percent'],
} as const;

/** content/academy/en (9 phases, 118 lessons, 473 quiz questions, 274 glossary terms) */
export const ACADEMY = {
  phases: 9,
  lessons: 118,
  quizQuestions: 473,
  glossary: 274,
  passMark: '70%',
  list: [
    { n: 1, title: 'Markets and instruments', level: 'Beginner', lessons: 13 },
    { n: 2, title: 'How trading works', level: 'Beginner', lessons: 14 },
    { n: 3, title: 'Economics and price action', level: 'Intermediate', lessons: 14 },
    { n: 4, title: 'News and indicators', level: 'Intermediate', lessons: 14 },
    { n: 5, title: 'Intermarket analysis and risk control', level: 'Intermediate', lessons: 14 },
    { n: 6, title: 'Sentiment, positioning and systems', level: 'Advanced', lessons: 14 },
    { n: 7, title: "Asset classes and the trader's mind", level: 'Advanced', lessons: 13 },
    { n: 8, title: 'Macro regimes and professional trading', level: 'Professional', lessons: 14 },
    { n: 9, title: 'Ezymex FX Options', level: 'Intermediate', lessons: 8 },
  ],
} as const;

/** services/wallet (README.md, migrations/0001_wallet.sql:17-23) */
export const FUNDING = {
  methods: 'USDT on BNB Chain (BEP20) and TRON (TRC20)',
  minDeposit: '10 USDT',
  withdrawalRange: '10 to 50,000 USDT',
  withdrawalFee: '1 USDT flat',
  creditTime: 'usually within a minute',
  transfers: 'Wallet to account transfers are instant and free',
} as const;

/** packages/i18n/src/locales.ts:4-27 */
export const LANGUAGES = [
  'English', 'हिन्दी', 'العربية', 'اردو', 'فارسی', 'Español', 'Português', 'Français', 'Deutsch', 'Italiano', 'Русский',
  'Türkçe', 'Bahasa Indonesia', 'Bahasa Melayu', 'Tiếng Việt', 'ไทย', '简体中文', '日本語', '한국어', 'বাংলা', 'தமிழ்', 'Kiswahili',
] as const;

/** Ezymex Trader (apps/terminal): chart types, timeframes, indicators, order types */
export const TRADER = {
  chartTypes: 4,
  timeframes: ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN'],
  indicators: 35,
  drawingTools: 6,
} as const;

/** API & algo (services/algo/README.md) */
export const ALGO = {
  rateLimit: '60 requests a minute per key',
  webhookRoutes: 10,
  indicatorSeries: 32,
} as const;

/** packages/i18n/src/catalog/en/common.ts:98 — the platform's official wording. */
export const RISK_WARNING =
  'CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage. Consider whether you understand how CFDs work and whether you can afford to take the high risk of losing your money.';

export const OPTIONS_RISK =
  'Buying an option can lose 100% of the premium paid. Selling an option can lose more than the premium received and uses margin.';

/** The Android app on the website (served by nginx from /srv/ezymex/downloads on the server). Update on each release. */
export const ANDROID_APP = {
  version: '1.0.21',
  build: 23,
  // versioned so a new release is never served from the CDN's copy of the last one
  href: '/download/ezymex-android-1.0.21.apk',
  hrefUniversal: '/download/ezymex-android-1.0.21.apk',
  sizeMb: 109,
  sha256: '12ca692338eb21e35f3e29656d5cd36d8cecc0d4d0378905e816cb02f3edb6fb',
  minAndroid: 'Android 7.0',
  releasedOn: '3 November 2026',
  /** Signed with the same key as every build since 1.0.10, so it installs over those; only a build older than 1.0.10 (another key) needs a reinstall. */
  requiresReinstall: false,
};
