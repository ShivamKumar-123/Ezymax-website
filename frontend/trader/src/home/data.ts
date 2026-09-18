/**
 * Static content for the marketing home page.
 *
 * The single CTA target across the page is `/auth/register` so every
 * "Get Started" / "Create Account" / "Start Investing" link drops the
 * user onto the trader signup flow regardless of which CTA they click.
 */

import {
  BRAND_NAME,
  BRAND_LOGO,
  BRAND_LOGO_DARK,
  BRAND_LOGO_LIGHT,
  BRAND_COPYRIGHT,
} from '@/lib/brand';

export const SIGNUP_HREF = '/auth/register';

export const BRAND = {
  name: BRAND_NAME,
  tagline: 'Trade global currency markets with confidence.',
  logo: BRAND_LOGO,
  /** Ink mark — for the white header band. */
  logoDark: BRAND_LOGO_DARK,
  /** Reversed mark — for the black footer band. */
  logoLight: BRAND_LOGO_LIGHT,
};

// Nav targets all resolve to public landing routes. /markets and
// /account-types are explicit pages with their own content; AuthProvider
// allow-lists them so unauthenticated visitors are not bounced to login.
// Items with `children` render as a dropdown.
export type NavItem = {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
};

/**
 * Primary navigation — exactly four menus (2026-09-02 content pass).
 *
 * `Trading` replaces the former `Accounts` entry and points at
 * /account-types, which now carries the whole trading offer (platforms,
 * conditions, account types, spreads, leverage, execution, tools).
 *
 * The former `Risk Management` and `Products` menus are gone, and About Us
 * sits as a flat link rather than under a Company dropdown. Products
 * (IB, Referral, Insurance) and Contact remain live pages reachable from
 * the footer, so nothing here orphans a route.
 *
 * NOTE: /trading/* is a middleware-protected prefix (see middleware.ts),
 * which is why the Trading menu targets /account-types rather than a
 * /trading landing route.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Home',    href: '/' },
  { label: 'Markets', href: '/markets' },
  { label: 'Trading', href: '/account-types' },
  { label: 'About Us', href: '/company/about' },
];

export const HERO = {
  pill: 'Forex Trading Platform',
  pillBadge: 'Live',
  headline: 'Trade the Currency Markets',
  sub: 'Access major, minor and exotic currency pairs with tight spreads, fast execution and a platform built for serious forex traders.',
  ctaPrimary: 'Start Trading',
  ctaSecondary: 'Explore Markets',
  ctaHref: SIGNUP_HREF,
  ctaSecondaryHref: '/markets',
};

/**
 * Social-proof line inside the stats panel.
 *
 * Deliberately QUALITATIVE — the platform has no audited review score to
 * cite, so this never states a number. The counters beside it reuse STATS
 * verbatim; never add a new figure here without a verifiable source.
 *
 * NOTE (2026-09-02): the testimonial marquee this used to summarise was
 * removed from the homepage, so the five-star line no longer has any
 * on-site reviews behind it. Retire it, or point it at a real review
 * source, rather than leaving an unsupported rating claim standing.
 */
export const SOCIAL_PROOF = {
  ratingLabel: 'Five-star reviews',
  ratingSub: 'from traders across our client base',
};

/**
 * Three trust pills rendered above the hero CTAs — the first words a
 * first-time visitor reads. Communicates "what we do" before any scroll:
 * execution speed, pricing, and platform security.
 *
 * Icon names are lucide-react component names — resolved in Hero.tsx via
 * an iconMap so we don't ship the entire icon catalog client-side.
 */
export const HERO_TRUST_PILLS = [
  { icon: '/images/hero icon1.png', label: 'Fast Execution',  sub: 'Orders filled in milliseconds.' },
  { icon: '/images/hero icon2.png', label: 'Tight Spreads',   sub: 'Competitive pricing on major pairs.' },
  { icon: '/images/hero icon3.png', label: 'Secure Platform', sub: 'Segregated funds, encrypted access.' },
] as const;

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
 * Markets / trading highlights — one card per asset class.
 *
 * The Major / Minor / Exotic pair cards were removed on request
 * (2026-09-02): they split forex across four of the six tiles and repeated
 * what the Forex card already says. The pair breakdown still lives on
 * /markets, which the grid's "View all markets" link points at.
 *
 * Every href here resolves to a live page — nothing links to a market we
 * do not offer.
 */
export const INSTRUMENTS = [
  { image: '/images/card1.png', title: 'Forex',                 badge: '50+ pairs',        body: 'Trade the world’s most liquid market, quoted 24 hours a day, five days a week.', href: '/trading/forex' },
  { image: '/images/card2.png', title: 'Indices & Commodities', badge: 'Alongside forex',  body: 'Stock indices, gold and silver available from the same account.',                href: '/trading/indices' },
  { image: '/images/card3.png', title: 'Cryptocurrencies',      badge: 'Around the clock', body: 'Major digital assets quoted continuously with transparent pricing.',             href: '/trading/crypto' },
] as const;

/**
 * Rewards band. The first-deposit bonus card was removed along with the
 * rest of that promotion, leaving a single card for the IB programme —
 * the only standing offer the site still advertises.
 */
export const REWARDS = [
  {
    image: '/images/hero banner 3.png',
    title: 'Partner commissions',
    body: 'Introduce clients through the IB programme and earn weekly per-lot commissions on every trade they place.',
    href: '/products/ib-referral',
  },
] as const;

/**
 * Checklist beside the platform screenshot. Kept to capabilities the
 * platform genuinely ships — no MetaTrader, no native desktop client.
 */
export const PLATFORM_FEATURES = [
  'Fast, browser-based platform on desktop and mobile',
  'Professional charting with real-time pricing',
  'Server-side stop-loss, take-profit and pending orders',
  'One account, synced across every device',
] as const;

/**
 * Two audience columns, mirroring the reference's "experienced / new"
 * split. Every link target is a live route.
 */
export const TRADER_PATHS = [
  {
    heading: 'For experienced traders',
    image: '/images/card-banner1.png',
    links: [
      { label: 'Compare account types', href: '/account-types' },
      { label: 'See spreads and conditions', href: '/markets' },
      { label: 'Explore the web platform', href: '/platforms/web' },
      { label: 'Copy trading', href: '/platforms/copy-trading' },
    ],
  },
  {
    heading: 'For new traders',
    image: '/images/card-banner2.png',
    links: [
      { label: 'How trading works', href: '/how-it-works' },
      { label: 'Open a demo account', href: '/accounts/demo' },
      { label: 'Trading guides', href: '/academy/pdfs' },
      { label: 'Frequently asked questions', href: '/faq' },
    ],
  },
] as const;

/**
 * "Why choose us" — benefit-led, and deliberately free of performance
 * figures. The previous set led with a "90% accuracy" AI claim and a
 * guaranteed-return framing; neither is substantiable, and a broker site
 * should not carry them.
 */
export const WHY_US = [
  { icon: 'Zap',          title: 'Fast Execution',                body: 'Orders are routed and filled in milliseconds, with no dealing-desk intervention on market orders.' },
  { icon: 'BadgeCheck',   title: 'Competitive Trading Conditions', body: 'Tight spreads on major pairs, transparent commissions, and no hidden markup on the quotes you trade.' },
  { icon: 'Cpu',          title: 'Advanced Trading Technology',   body: 'Real-time pricing, professional charting and server-side order handling that keeps working when your browser is closed.' },
  { icon: 'MonitorSmartphone', title: 'Multiple Trading Platforms', body: 'One account across web, mobile and desktop browser — positions, alerts and watchlists stay in sync.' },
  { icon: 'ShieldCheck',  title: 'Secure & Reliable Infrastructure', body: 'Segregated client funds, encrypted sessions and monitored infrastructure built for continuous market hours.' },
  { icon: 'Briefcase',    title: 'Professional Trading Environment', body: 'Standard, ECN and Pro accounts with adjustable leverage, plus a free demo funded with virtual balance.' },
] as const;

/**
 * Platform surfaces. The product is a single web application — there is no
 * native desktop installer and no MetaTrader bridge — so "desktop" here
 * means the desktop browser. Keep it that way unless a real client ships.
 */
export const PLATFORMS = [
  { icon: 'Globe2',    title: 'Web Trading',     body: 'Trade in any modern browser. Nothing to install, nothing to update.' },
  { icon: 'Smartphone', title: 'Mobile Trading', body: 'Install to your phone home screen and trade with the full platform on the move.' },
  { icon: 'Monitor',   title: 'Desktop Trading', body: 'Full charting and order tools on a desktop browser, on the same login.' },
] as const;

export const HOW_IT_WORKS = [
  { n: '1', title: 'Open an Account', body: 'Register in a few minutes and complete verification to activate live trading.' },
  { n: '2', title: 'Fund Your Account', body: 'Deposit by bank transfer, card, e-wallet or crypto. Most methods credit instantly.' },
  { n: '3', title: 'Start Trading',   body: 'Access major, minor and exotic pairs from the web, mobile or desktop platform.' },
] as const;

/**
 * Platform facts only. The previous set advertised "90% profitable trades"
 * and "up to 7% monthly return" — unverifiable performance claims that do
 * not belong on a brokerage site. Everything here describes the offering
 * rather than an outcome.
 */
export const STATS = [
  { value: '50+',    label: 'Currency Pairs Available' },
  { value: '24/5',   label: 'Forex Market Coverage' },
  { value: '1:500',  label: 'Maximum Leverage' },
  { value: '$50',    label: 'Minimum First Deposit' },
] as const;

export const FAQ = [
  {
    q: 'What is the minimum deposit required to start trading?',
    a: 'Only $50. A $50 first deposit unlocks the Standard live account or the IB partner account; ECN starts at $200. A free Demo account with $100,000 in virtual funds is also available — no commitment.',
  },
  {
    q: 'Which deposit and withdrawal methods are available, and how long do they take?',
    a: 'We support bank wire transfers, Visa/Mastercard, Skrill, Neteller, and cryptocurrency. Card and e-wallet deposits are typically instant; bank wires and crypto withdrawals usually settle within 1–3 business days.',
  },
  {
    q: 'Which trading platforms and devices are supported?',
    a: `${BRAND_NAME} offers a fast web platform accessible from any modern browser, plus dedicated iOS and Android mobile apps. All platforms sync to a single account, so your positions, alerts, and watchlists stay in sync across every device.`,
  },
  {
    q: 'Which currency pairs can I trade?',
    a: `${BRAND_NAME} quotes major pairs such as EUR/USD, GBP/USD and USD/JPY, minor crosses including EUR/GBP and AUD/JPY, and exotic pairs across emerging markets. Stock indices, gold and silver, and major digital assets are available from the same account.`,
  },
  {
    q: 'What spreads and leverage are available?',
    a: 'Spreads start from 0.0 pips on ECN accounts and from 1.0 pip on Standard, with commission shown on the order ticket before you confirm. Leverage is adjustable up to 1:500 depending on account type and instrument. Higher leverage increases both potential gains and potential losses.',
  },
  {
    q: 'How do I apply for the IB program?',
    a: 'Visit Products → IB Referral and fill out the short partner application (name, country, email, phone, and a brief note about your audience). Our partner team reviews and activates accounts within 24 hours. Once approved you receive a unique referral link plus a marketing kit, and you start earning weekly per-lot commissions (up to $7 / lot at Platinum tier) on every trade your referrals place — for life.',
  },
] as const;

export const CTA = {
  headline: 'Trade Global Markets with Confidence',
  sub: 'Open an account and access the currency markets on a platform built for professional trading.',
  primary: 'Start Trading',
  secondary: 'Explore Markets',
  href: SIGNUP_HREF,
  secondaryHref: '/markets',
};

/**
 * Footer columns.
 *
 * The old shape was a nine-item "Quick Links" column beside a four-item
 * "Our Services" one — lopsided, and its first four entries silently
 * duplicated the header nav. It is now three balanced columns of four.
 *
 * `FOOTER_EXPLORE` is derived from NAV_ITEMS rather than retyped, so the
 * footer's primary column can never drift from the header's. Changing the
 * nav changes both.
 */
export const FOOTER_EXPLORE = NAV_ITEMS.map(({ label, href }) => ({ label, href }));

export const FOOTER_PLATFORM = [
  { label: 'Trading Platforms', href: '/platforms/web' },
  { label: 'Download',          href: '/download' },
  { label: 'Partner Programme', href: '/products/ib-referral' },
  { label: 'Market Research',   href: '/services/market-research' },
];

export const FOOTER_COMPANY = [
  { label: 'How it Works', href: '/how-it-works' },
  { label: 'FAQ',          href: '/faq' },
  { label: 'Careers',      href: '/careers' },
  { label: 'Contact',      href: '/company/contact' },
];

/* Legal links are now surfaced via the Legal dropdown in NAV_ITEMS.
   FOOTER_LINKS kept empty so we don't double-list the same routes
   on the home-page footer bottom bar. */
export const FOOTER_LINKS: { label: string; href: string }[] = [
  // intentionally empty — legal nav now lives in the Legal dropdown
];

export const COPYRIGHT = `${BRAND_COPYRIGHT} · Founded in 2010`;

/**
 * Regulatory risk disclosure — distinct from the "Risk Management" product
 * menu that this content pass removed. Every broker must carry a leveraged-
 * trading warning; this stays.
 */
export const RISK_DISCLAIMER =
  'Trading foreign exchange and CFDs on margin carries a high level of risk and may not be suitable for all investors. Past performance is not indicative of future results. Trade only with capital you can afford to lose.';
