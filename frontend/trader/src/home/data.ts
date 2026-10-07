/**
 * Static content for the marketing home page.
 *
 * Ezymex positioning: a multi-asset trading platform that retail traders
 * open an account on directly. The previous copy in this file described a
 * B2B software vendor selling white-label platforms to other brokers —
 * that no longer matches the product, which takes deposits, runs KYC,
 * holds balances and executes orders itself.
 *
 * Claims policy for this file
 * ---------------------------
 * Everything here is either a verifiable property of the platform or a
 * qualitative statement. Specifically NOT present, and not to be added
 * without the fact behind it:
 *
 *   • an operating history or founding date — the brand has no track
 *     record to cite yet, and for a venue that holds client funds a
 *     fabricated one is the single most misleading thing on a page;
 *   • client/volume counts, payout totals, or any "trusted by N traders"
 *     figure, unless audited;
 *   • the words "regulated", "licensed", "segregated" or any named
 *     authority — there is no licence yet. Add these only alongside a real
 *     licence number and jurisdiction;
 *   • performance, profit or return figures of any kind.
 *
 * Trust here is carried by what the platform demonstrably does: the
 * execution and custody architecture, the security controls, and a plain
 * risk disclosure. That is also what a regulator, a payment provider and
 * an informed trader actually look for.
 */

import {
  BRAND_NAME,
  BRAND_LOGO,
  BRAND_LOGO_DARK,
  BRAND_LOGO_LIGHT,
  BRAND_COPYRIGHT,
} from '@/lib/brand';

/** Account opening — the primary conversion across the site. */
export const SIGNUP_HREF = '/auth/register';

/**
 * "Download App" target in the header.
 *
 * Was '/downloads/ezymex.apk' — a file that is not in public/, so the
 * button 404'd on the live site. Points at the download page until a
 * real build is published there; swap it back the moment one is.
 */
export const APK_HREF = '/download';

export const BRAND = {
  name: BRAND_NAME,
  tagline: 'Multi-asset trading, engineered properly.',
  logo: BRAND_LOGO,
  /** Ink mark — for the white header band. */
  logoDark: BRAND_LOGO_DARK,
  /** Reversed mark — for the black footer band. */
  logoLight: BRAND_LOGO_LIGHT,
};

// Nav targets all resolve to live landing routes. Items with `children`
// render as a dropdown; the parent href points at the first child.
export type NavItem = {
  label: string;
  href: string;
  /** lucide icon name, mapped to a component in Navbar.tsx. Top-level
   *  items carry one so the bar reads at a glance rather than as five
   *  words of the same weight. */
  icon?: string;
  children?: { label: string; href: string }[];
  // When true the link points off-site and is rendered as a plain
  // <a target="_blank"> instead of a Next <Link>.
  external?: boolean;
};

/**
 * Primary navigation, reorganised for a trader rather than a buyer:
 * what you can trade, what you trade it on, what else the account does,
 * then the company.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', icon: 'Home', href: '/' },
  {
    label: 'Markets',
    icon: 'CandlestickChart',
    href: '/trading/forex',
    children: [
      { label: 'Forex', href: '/trading/forex' },
      { label: 'Crypto', href: '/trading/crypto' },
      { label: 'Commodities', href: '/trading/commodities' },
      { label: 'Indices', href: '/trading/indices' },
    ],
  },
  {
    label: 'Platforms',
    icon: 'MonitorSmartphone',
    href: '/platforms/web',
    children: [
      { label: 'Web Terminal', href: '/platforms/web' },
      { label: 'Desktop Terminal', href: '/download' },
      { label: 'Copy Trading', href: '/platforms/copy-trading' },
      { label: 'Algo & API', href: '/platforms/prop-trading' },
    ],
  },
  {
    label: 'Accounts',
    icon: 'Wallet',
    href: '/account-types',
    children: [
      { label: 'Account Types', href: '/account-types' },
      { label: 'Demo Account', href: '/accounts/demo' },
      { label: 'Deposits & Withdrawals', href: '/deposit-withdrawal' },
      { label: 'Partners & IB', href: '/products/ib-referral' },
    ],
  },
  {
    label: 'Company',
    icon: 'Building2',
    href: '/company/about',
    children: [
      { label: 'About Us', href: '/company/about' },
      { label: 'Education', href: '/services/education' },
      { label: 'Contact', href: '/company/contact' },
      { label: 'Risk Warning', href: '/risk-warning' },
    ],
  },
];

export const HERO = {
  pill: 'Multi-Asset Trading Platform',
  // Sits where a "Since ____" badge usually goes. Says something true and
  // checkable instead of borrowing credibility from a date.
  pillBadge: 'Execution on your side of the browser',
  headline: 'Trade forex, metals, indices and crypto on one account',
  sub: 'One balance, one login, and a risk engine that runs on our servers — so your stops, targets and margin are enforced whether or not your browser is open.',
  ctaPrimary: 'Open an Account',
  ctaSecondary: 'Try a Demo',
  ctaHref: SIGNUP_HREF,
  ctaSecondaryHref: '/accounts/demo',
};

/**
 * Headlines the hero cycles through, one every HERO_ROTATE_MS.
 *
 * `lead` renders in ink, `accent` in brand red on its own line — the
 * two-tone split the design calls for. Keep each `lead` to roughly five
 * words: longer ones reflow to a fourth line on desktop and the block
 * visibly jumps as it rotates.
 *
 * HERO.headline stays the server-rendered first frame, so the fold has
 * real text for crawlers and the markup matches before hydration.
 * Entry 0 therefore mirrors it.
 */
export const HERO_ROTATING = [
  { lead: 'Trade Forex, Metals, Indices and Crypto', accent: 'on One Account' },
  { lead: 'Stops and Targets That Fire',             accent: 'Even When You Are Offline' },
  { lead: 'Web, Desktop and Mobile',                 accent: 'One Login, One Balance' },
  { lead: 'Start on a Demo',                         accent: 'Fund It When It Earns That' },
] as const;

/** Dwell time per headline, in milliseconds. */
export const HERO_ROTATE_MS = 4000;

/**
 * The four-up feature strip under the headline.
 *
 * The design this follows had "Secure & Regulated - Your Funds, Our
 * Priority" in slot two. That is the most load-bearing slot on the page
 * and we cannot fill it: there is no licence, and client money is not held
 * under a segregation regime. It carries the ledger guarantee instead,
 * which is real and checkable. Do not restore the original wording
 * without a licence number behind it.
 *
 * `icon` keys map to lucide components in Hero.tsx.
 */
export const HERO_FEATURES = [
  // Subs stay to roughly three words: at four-across in the hero column
  // each item gets ~110px of text width, and anything longer wraps to a
  // third line and breaks the row's baseline.
  { icon: 'Gauge',             label: 'Instant Fills',     sub: 'At live bid/ask' },
  { icon: 'Lock',              label: 'Ledgered Balances', sub: 'Fully auditable' },
  { icon: 'ShieldCheck',       label: 'Server-Side Risk',  sub: 'Stops always armed' },
  { icon: 'MonitorSmartphone', label: 'Multi-Platform',    sub: 'Web, desktop, mobile' },
] as const;

/**
 * Decorative asset chips floating around the hero artwork. Labels only --
 * deliberately no prices, because a hardcoded number beside a trading
 * screenshot reads as a live quote. Positions are percentages of the
 * artwork box so they track it as it scales.
 */
export const HERO_ASSET_CHIPS = [
  // Clustered around the open palm in the artwork (~10% / 58% of the
  // image box) so they read as being presented, not pasted over her.
  { label: 'GOLD',   glyph: 'Au', tone: 'gold',   top: '30%', left: '6%'  },
  { label: 'EURUSD', glyph: 'EU', tone: 'blue',   top: '46%', left: '-7%' },
  { label: 'BTC',    glyph: 'B',  tone: 'orange', top: '63%', left: '3%'  },
  { label: 'US30',   glyph: 'US', tone: 'navy',   top: '17%', left: '4%'  },
] as const;

/**
 * Trust line inside the stats panel. Qualitative by design — the honest
 * substitute for the client-count headline a template would put here.
 */
export const SOCIAL_PROOF = {
  ratingLabel: 'Built around your money, not around a demo',
  ratingSub: 'every balance change is ledgered, locked and auditable',
};

/**
 * Three pills above the hero CTAs — the first things a trader evaluating
 * a venue wants to know: where my orders are enforced, what happens to my
 * money, and how I get it back.
 */
export const HERO_TRUST_PILLS = [
  { icon: '/images/hero icon1.png', label: 'Server-side execution', sub: 'Stops and targets fire without your browser.' },
  { icon: '/images/hero icon2.png', label: 'Ledgered balances',     sub: 'Every movement double-entry and traceable.' },
  { icon: '/images/hero icon3.png', label: 'Withdraw on your terms', sub: 'Crypto or bank, with step-up verification.' },
] as const;

/**
 * Live market strip.
 *
 * NOTE: these are STATIC illustrative values, not quotes. They are
 * labelled as indicative wherever rendered — a venue must never show a
 * stale hardcoded number in a way a visitor could mistake for a dealable
 * price. The live quotes come from the price socket on the terminal.
 */
export const LIVE_TICKER = [
  { pair: 'BTC/USD',   price: '67,420',  change: '+1.82%', up: true },
  { pair: 'ETH/USD',   price: '3,580',   change: '+0.94%', up: true },
  { pair: 'EUR/USD',   price: '1.0842',  change: '+0.12%', up: true },
  { pair: 'XAU/USD',   price: '2318.50', change: '+0.45%', up: true },
  { pair: 'SOL/USD',   price: '168.20',  change: '+2.31%', up: true },
  { pair: 'GBP/USD',   price: '1.2654',  change: '-0.08%', up: false },
  { pair: 'USD/JPY',   price: '149.82',  change: '+0.23%', up: true },
  { pair: 'XRP/USD',   price: '0.5423',  change: '-0.15%', up: false },
  { pair: 'ADA/USD',   price: '0.4612',  change: '+0.72%', up: true },
  { pair: 'AUD/USD',   price: '0.6512',  change: '+0.08%', up: true },
  { pair: 'MATIC/USD', price: '0.8120',  change: '+1.05%', up: true },
  { pair: 'DOT/USD',   price: '7.42',    change: '-0.21%', up: false },
];

/**
 * What you can actually do with the account. Replaces the old
 * "capabilities we hand over to a broker" framing.
 */
export const INSTRUMENTS = [
  { image: '/images/card1.png', title: 'Markets',        badge: 'FX · Metals · Indices · Crypto', body: 'Majors, minors, gold and silver, the major indices, and crypto that keeps trading through the weekend — all from one balance.', href: '/trading/forex' },
  { image: '/images/card2.png', title: 'Copy Trading',   badge: 'Follow a strategy',              body: 'Mirror a trader you rate. Position sizing scales to your balance, and you can stop and unwind at any time.',                        href: '/platforms/copy-trading' },
  { image: '/images/card3.png', title: 'Managed & PAMM', badge: 'Pooled allocation',              body: 'Allocate to a managed pool with unit-based accounting and high-water-mark fees, so you are never charged twice for the same gain.',   href: '/pamm' },
] as const;

/**
 * Standing headline offer. Demo-first rather than bonus-first: a deposit
 * incentive as the lead offer is what a regulator reads as pressure
 * selling, and it attracts exactly the wrong first trade.
 */
export const REWARDS = [
  {
    image: '/images/hero banner 3.png',
    title: 'Practise before you fund',
    body: 'Open a demo with simulated balance and trade the live price feed with the real engine — same execution, same margin rules, none of your money. Move to a funded account whenever you are ready.',
    href: '/accounts/demo',
  },
] as const;

/**
 * Checklist beside the platform screenshot — what the terminal gives you.
 */
export const PLATFORM_FEATURES = [
  'Web, desktop and Android terminals on one login',
  'Charting with seven timeframes and saved layouts',
  'Server-side stop-loss, take-profit and trailing logic',
  'Strategy builder, backtesting and a REST/WebSocket API',
] as const;

/**
 * Two audience columns — where a new trader and an experienced one each
 * want to go next.
 */
export const TRADER_PATHS = [
  {
    heading: 'New to trading',
    image: '/images/card-banner1.png',
    links: [
      { label: 'Open a demo account', href: '/accounts/demo' },
      { label: 'How trading works', href: '/how-it-works' },
      { label: 'Learn the basics', href: '/services/education' },
      { label: 'Understand the risks', href: '/risk-warning' },
    ],
  },
  {
    heading: 'Already trading',
    image: '/images/card-banner2.png',
    links: [
      { label: 'Account types & conditions', href: '/account-types' },
      { label: 'Algo & API access', href: '/platforms/prop-trading' },
      { label: 'Copy trading', href: '/platforms/copy-trading' },
      { label: 'Partner programme', href: '/products/ib-referral' },
    ],
  },
] as const;

/**
 * "Why choose us" — the engineering case, which is the honest one.
 * Each item describes something the platform actually implements.
 */
export const WHY_US = [
  { icon: 'ShieldCheck', title: 'Your orders do not depend on your browser', body: 'Stop-loss, take-profit and stop-out are evaluated server-side against the live feed. Close the tab, lose your connection, flatten your phone battery — the levels you set still fire.' },
  { icon: 'Lock',        title: 'Money moves on a ledger, not a flag',      body: 'Every credit and debit claims a unique ledger key before a balance changes, and the rows are locked while it does. A retried payment or a double-clicked withdrawal cannot move your balance twice.' },
  { icon: 'Gauge',       title: 'Margin you can see coming',                body: 'Equity, used margin and margin level update on every tick, with a margin call at 80% and stop-out at 50% — published, not discretionary, so you always know where the line is.' },
  { icon: 'Network',     title: 'Deposits verified on-chain',               body: 'USDT deposits on Ethereum, BSC and Tron are confirmed against the chain itself — contract, recipient, amount and confirmations — before anything is credited.' },
  { icon: 'ShieldPlus',  title: 'Withdrawals need more than a password',    body: 'Two-factor authentication, step-up verification on withdrawal, and a cooling-off window on a newly linked wallet. Sessions can be revoked server-side the moment you log out.' },
  { icon: 'Cpu',         title: 'Infrastructure that expects to be attacked', body: 'Encrypted daily backups, an origin reachable only through the CDN edge, rate-limited authentication, and a codebase that has been through a documented security remediation.' },
] as const;

/**
 * The three surfaces you can trade from.
 */
export const PLATFORMS = [
  { icon: 'MonitorSmartphone', title: 'Web & Mobile Terminal', body: 'Full charting, order ticket and position management in the browser, and an Android build for the same account.' },
  { icon: 'Monitor',           title: 'Desktop Terminal',      body: 'A native Windows and macOS terminal with live watchlist, charts and one-click order entry for traders who want it off the browser.' },
  { icon: 'Brain',             title: 'Algo & AI Strategies',  body: 'Describe a strategy in plain language, backtest it against stored bars, then deploy it — or drive the account yourself over the REST and WebSocket API.' },
] as const;

export const HOW_IT_WORKS = [
  { n: '1', title: 'Open an account',   body: 'Register with an email or a wallet, complete verification, and start on a demo balance while you look around.' },
  { n: '2', title: 'Fund it when ready', body: 'Deposit by crypto or local bank transfer. Crypto deposits are confirmed against the chain; nothing is credited on trust.' },
  { n: '3', title: 'Trade, or let the engine', body: 'Trade manually, copy a strategy, allocate to a managed pool, or run your own algorithm over the API.' },
] as const;

/**
 * Platform facts only.
 *
 * The outgoing version led with "Since 2010", a date this brand cannot
 * support. These four are properties of the running system instead —
 * every one of them is checkable by a visitor who opens an account.
 */
export const STATS = [
  { value: '24/7',   label: 'Crypto markets, weekends included' },
  { value: '1:100',  label: 'Default account leverage' },
  { value: '3',      label: 'Terminals on one login' },
  { value: 'Server', label: 'Where your stops are enforced' },
] as const;

export const FAQ = [
  {
    q: `Is ${BRAND_NAME} regulated?`,
    a: `${BRAND_NAME} does not currently hold a financial services licence, and we will not imply otherwise. You should factor that into how much you deposit and treat it as you would any unlicensed venue. What we can show you is how the platform handles your money and your orders — the execution model, the ledger, the verification steps — and we document those openly rather than asking you to take them on faith.`,
  },
  {
    q: 'What happens to my open trades if I close the browser?',
    a: 'Nothing changes. Stop-loss, take-profit and stop-out are evaluated on our servers against the live price feed, not in your browser. Positions are managed continuously whether or not you are connected.',
  },
  {
    q: 'How are deposits and withdrawals handled?',
    a: 'Crypto deposits (USDT on Ethereum, BSC and Tron) are verified against the blockchain — correct contract, correct recipient, correct amount, enough confirmations — before your balance moves. Local bank transfer is also supported. Withdrawals require two-factor authentication and step-up verification, and a newly linked wallet has a cooling-off period before it can be withdrawn to.',
  },
  {
    q: 'What is the margin call and stop-out level?',
    a: 'Margin call at 80% and stop-out at 50%. Those thresholds are published rather than discretionary: when margin level falls to the stop-out point, positions are closed automatically to stop the account going negative.',
  },
  {
    q: 'Can I try it without depositing?',
    a: 'Yes. A demo account runs on the same engine and the same live price feed as a funded one — same execution path, same margin rules, simulated balance. It is the honest way to judge a platform before funding it.',
  },
  {
    q: 'Can I trade with my own software?',
    a: 'Yes. Each trading account can issue an API key and secret for the REST and WebSocket API, so an EA, bot or dashboard can place orders, read positions and stream prices. There is also an in-platform strategy builder with backtesting if you would rather not write the code.',
  },
  {
    q: 'What are the risks?',
    a: 'Leveraged trading can lose you money quickly, including more than you intended to risk on a position. Leverage magnifies losses exactly as it magnifies gains, and markets can gap through your stop. Only trade with money you can afford to lose, and read the risk warning before you fund an account.',
  },
] as const;

export const CTA = {
  headline: 'Start on a demo. Fund it when it earns that.',
  sub: 'Same engine, same live prices, simulated balance. Judge the platform on how it behaves before you put money on it.',
  primary: 'Open an account',
  secondary: 'Try the demo',
  href: SIGNUP_HREF,
  secondaryHref: '/accounts/demo',
};

/**
 * Footer columns — three balanced columns of live routes.
 *
 * `FOOTER_EXPLORE` is derived from NAV_ITEMS so the footer's primary
 * column can never drift from the header's.
 */
export const FOOTER_EXPLORE = NAV_ITEMS.map(({ label, href }) => ({ label, href }));

export const FOOTER_PLATFORM = [
  { label: 'Web Terminal',    href: '/platforms/web' },
  { label: 'Desktop Terminal', href: '/download' },
  { label: 'Copy Trading',    href: '/platforms/copy-trading' },
  { label: 'Algo & API',      href: '/platforms/prop-trading' },
];

export const FOOTER_COMPANY = [
  { label: 'About Us',      href: '/company/about' },
  { label: 'How it Works',  href: '/how-it-works' },
  { label: 'Risk Warning',  href: '/risk-warning' },
  { label: 'Contact',       href: '/company/contact' },
];

/**
 * Footer blurb. One line: a footer signature, not an About page.
 */
export const FOOTER_BLURB =
  'A multi-asset trading platform — forex, metals, indices and crypto on one account, with execution and risk enforced server-side.';

/**
 * Social profiles.
 *
 * Deliberately EMPTY hrefs until the real profiles exist. The footer
 * renders only entries with an href, so an unfilled row shows nothing
 * rather than four buttons that bounce the visitor back to the homepage
 * (which is what they did before — every one pointed at the apex).
 * Fill a url in and the icon appears; no other change needed.
 */
export const SOCIAL_LINKS = [
  { key: 'Facebook',  href: '' },
  { key: 'Instagram', href: '' },
  { key: 'Linkedin',  href: '' },
  { key: 'Youtube',   href: '' },
] as const;

/**
 * Newsletter card copy.
 *
 * `endpoint` is the single integration point. While it is empty the form
 * falls back to opening a prefilled mail to support — which actually
 * reaches a human — instead of posting into the void. Point it at a real
 * route and the fallback stops being used.
 */
export const NEWSLETTER = {
  title: 'Stay',
  titleAccent: 'Updated',
  body: 'Get the latest news, product updates and market insights.',
  placeholder: 'Enter your email address',
  cta: 'Subscribe',
  endpoint: '',
} as const;

/* Legal links are surfaced via the footer bottom bar. */
export const FOOTER_LINKS: { label: string; href: string }[] = [
  // intentionally empty — legal nav lives elsewhere in the footer
];

export const COPYRIGHT = `${BRAND_COPYRIGHT} · Trading involves risk to your capital`;

/**
 * Risk disclosure.
 *
 * Present and prominent on purpose. Every venue a trader should take
 * seriously carries one; its absence is a louder signal than anything
 * marketing copy can say. The previous text here was a software-vendor
 * disclaimer ("we are not a broker"), which is no longer true of this
 * product and would have been actively misleading to leave in place.
 */
export const RISK_DISCLAIMER =
  `Trading leveraged products carries a high level of risk and can result in the loss of your capital. Leverage magnifies losses as well as gains, prices can gap through a stop level, and past performance never indicates future results. ${BRAND_NAME} does not provide investment, financial, tax or legal advice, and nothing on this site is a recommendation to trade. ${BRAND_NAME} does not currently hold a financial services licence. Trade only with money you can afford to lose, and seek independent advice if you are unsure.`;
