/**
 * Static content for the marketing home page.
 *
 * SetupFX positioning: a software development company that builds and
 * licenses trading platforms, back offices and risk engines to brokers
 * and prop firms — delivered white-label, under the client's own brand.
 * We are a technology vendor, not a broker. Copy never claims to operate
 * a brokerage, provide financial services, or hold/route client funds.
 *
 * Demo CTAs point at /company/contact ("Book a demo"); "Client Login"
 * keeps existing operators' users reaching /auth/login.
 */

import {
  BRAND_NAME,
  BRAND_LOGO,
  BRAND_LOGO_DARK,
  BRAND_LOGO_LIGHT,
  BRAND_COPYRIGHT,
} from '@/lib/brand';

/** "Book a demo" target — the primary conversion across the site. */
export const SIGNUP_HREF = '/company/contact';

/** Direct Android APK download (served from public/downloads). */
export const APK_HREF = '/downloads/swisscresta.apk';

export const BRAND = {
  name: BRAND_NAME,
  tagline: 'Trading platforms, built for brokers and prop firms.',
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
  children?: { label: string; href: string }[];
  // When true the link points off-site (e.g. the liquidity subdomain) and is
  // rendered as a plain <a target="_blank"> instead of a Next <Link>.
  external?: boolean;
};

/**
 * Primary navigation — four menus, each a dropdown of live pages. The
 * product surfaces sit under Platforms; the delivery/service lines under
 * Solutions; company pages under Company.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/' },
  {
    label: 'Platforms',
    href: '/platforms/web',
    children: [
      { label: 'Global Trading Platform', href: '/platforms/web' },
      { label: 'Copy Trading', href: '/platforms/copy-trading' },
      { label: 'IB Management', href: '/platforms/ib-management' },
      { label: 'Prop Trading', href: '/platforms/prop-trading' },
      { label: 'Admin & Back Office', href: '/platforms/super-admin' },
    ],
  },
  { label: 'Liquidity', href: 'https://liquidity.swisscresta.com', external: true },
  {
    label: 'Solutions',
    href: '/services/market-research',
    children: [
      { label: 'Market Research', href: '/services/market-research' },
      { label: 'Portfolio Management', href: '/services/portfolio-management' },
      { label: 'Education', href: '/services/education' },
    ],
  },
  {
    label: 'Company',
    href: '/company/about',
    children: [
      { label: 'About Us', href: '/company/about' },
      { label: 'Careers', href: '/careers' },
      { label: 'Contact', href: '/company/contact' },
    ],
  },
];

export const HERO = {
  pill: 'Software Development Company',
  pillBadge: 'Since 2010',
  headline: 'Trading platforms built for brokers and prop firms',
  sub: 'We build the technology behind trading businesses — platforms, back offices and risk engines, branded as yours and supported long after launch.',
  ctaPrimary: 'Book a free demo',
  ctaSecondary: 'View platforms',
  ctaHref: SIGNUP_HREF,
  ctaSecondaryHref: '/platforms/web',
};

/**
 * Social-proof line inside the stats panel. Qualitative by design — no
 * unaudited numbers.
 */
export const SOCIAL_PROOF = {
  ratingLabel: 'Trusted by operators',
  ratingSub: 'brokers and prop firms run on our stack',
};

/**
 * Three trust pills rendered above the hero CTAs — what SetupFX is, before
 * any scroll: in-house engineering, fast delivery, long-term support.
 */
export const HERO_TRUST_PILLS = [
  { icon: '/images/hero icon1.png', label: 'Built in-house',       sub: 'Our own engine, not a resold template.' },
  { icon: '/images/hero icon2.png', label: 'Live in weeks',        sub: 'From first call to launch, fast.' },
  { icon: '/images/hero icon3.png', label: 'Supported after launch', sub: 'The team that builds it maintains it.' },
] as const;

/**
 * Live market strip — a preview of the kind of real-time data the
 * platforms handle. Illustrative only; not a price quote we make.
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
 * What ships with a platform — capabilities we build in and hand over,
 * operated by the client under their own brand and licence.
 */
export const INSTRUMENTS = [
  { image: '/images/card1.png', title: 'Liquidity Routing',   badge: 'A-book / B-book', body: 'Bridge order flow to your own liquidity providers, or run it internally — configurable per client.', href: '/platforms/web' },
  { image: '/images/card2.png', title: 'Managed Accounts',    badge: 'MAM / PAMM',      body: 'Unit-based managed-account structures with high-water-mark performance fees, handled by the engine.', href: '/platforms/ib-management' },
  { image: '/images/card3.png', title: 'Copy Trading',        badge: 'Master / follower', body: 'Followers mirror a master account automatically, with performance-fee accounting built in.',      href: '/platforms/copy-trading' },
] as const;

/**
 * Rewards band — the standing headline offer: a fully branded platform,
 * delivered fast.
 */
export const REWARDS = [
  {
    image: '/images/hero banner 3.png',
    title: 'White-label, live in weeks',
    body: 'Launch a fully branded trading platform on your own domain — your identity, your colours, your back office — typically live within weeks of kickoff.',
    href: '/company/contact',
  },
] as const;

/**
 * Checklist beside the platform screenshot — what a delivered platform
 * actually ships with.
 */
export const PLATFORM_FEATURES = [
  'Web, mobile and desktop terminals under your brand',
  'Admin back office with CRM, risk and reporting',
  'Server-side risk engine: margin, stop-out, SL/TP',
  'Payments, KYC and liquidity integrations wired in',
] as const;

/**
 * Two audience columns — brokers and prop firms. Every link target is a
 * live route.
 */
export const TRADER_PATHS = [
  {
    heading: 'For brokers',
    image: '/images/card-banner1.png',
    links: [
      { label: 'Global trading platform', href: '/platforms/web' },
      { label: 'Liquidity & back office', href: '/platforms/super-admin' },
      { label: 'Copy trading & MAM/PAMM', href: '/platforms/copy-trading' },
      { label: 'Book a demo', href: '/company/contact' },
    ],
  },
  {
    heading: 'For prop firms',
    image: '/images/card-banner2.png',
    links: [
      { label: 'Prop trading platform', href: '/platforms/prop-trading' },
      { label: 'How delivery works', href: '/how-it-works' },
      { label: 'Integration services', href: '/services/market-research' },
      { label: 'Talk to the team', href: '/company/contact' },
    ],
  },
] as const;

/**
 * "Why choose us" — benefit-led, technology-vendor framing. No performance
 * figures, no brokerage claims.
 */
export const WHY_US = [
  { icon: 'Zap',          title: 'Delivered fast',             body: 'A working, branded platform is typically live within weeks of kickoff — not quarters.' },
  { icon: 'BadgeCheck',   title: 'Your brand, our engine',     body: 'Everything ships under your identity, on your domain, in your colours. Nobody sees SetupFX.' },
  { icon: 'Cpu',          title: 'Built in-house',             body: 'We write the engine we sell, so a change you ask for is a change we can actually make.' },
  { icon: 'MonitorSmartphone', title: 'Every surface, one login', body: 'Web, mobile and desktop terminals plus a full admin back office, all on one account model.' },
  { icon: 'ShieldCheck',  title: 'Risk engine included',       body: 'Server-side margin, stop-out and SL/TP handling that keeps working when the browser is closed.' },
  { icon: 'Briefcase',    title: 'Integrations that fit',      body: 'Payments, KYC, liquidity, CRM and third-party APIs connected to what your business already uses.' },
] as const;

/**
 * The three platforms we build and ship white-label.
 */
export const PLATFORMS = [
  { icon: 'Globe2',    title: 'Global Trading Platform', body: 'Multi-asset terminal for web, mobile and desktop — charting, orders and account management.' },
  { icon: 'Smartphone', title: 'AI & Algo Trading',     body: 'An in-platform strategy builder, backtesting and live algorithmic execution, under your brand.' },
  { icon: 'Monitor',   title: 'Admin & Back Office',    body: 'CRM, risk controls, liquidity routing and reporting — the console your team runs the business from.' },
] as const;

export const HOW_IT_WORKS = [
  { n: '1', title: 'Tell us what you are building', body: 'A short call to map your markets, your instruments and how you want order flow handled. No obligation.' },
  { n: '2', title: 'We build and brand it',         body: 'Your platform, your identity, your domain — with the integrations your business depends on wired in.' },
  { n: '3', title: 'Go live, and keep going',       body: 'Deployment, handover, then the monitoring and enhancement cycles that follow launch.' },
] as const;

/**
 * Company facts only — nothing about trading outcomes.
 */
export const STATS = [
  { value: 'Since 2010', label: 'Building trading technology' },
  { value: '3',          label: 'Platforms we ship' },
  { value: 'Weeks',      label: 'Typical time to launch' },
  { value: '24/7',       label: 'Support after go-live' },
] as const;

export const FAQ = [
  {
    q: 'Is SetupFX a broker?',
    a: `No. ${BRAND_NAME} is a software development company. We build and license trading technology — platforms, back offices, risk engines and integrations — to licensed brokers, proprietary trading firms and other operators. Any platform in production is operated by that client, under their own brand and their own regulatory obligations.`,
  },
  {
    q: 'What exactly do you build?',
    a: 'Complete trading terminals for web, mobile and desktop; an admin back office with CRM, risk and reporting; a server-side risk engine; and the integrations around them — payments, KYC, liquidity routing, copy trading and MAM/PAMM. The whole stack is ours, delivered white-label under your brand.',
  },
  {
    q: 'How long does a platform take to launch?',
    a: 'Because the stack is built in-house and deployed white-label, a branded platform is typically live within weeks of kickoff — the exact timeline depends on the integrations and instruments you need.',
  },
  {
    q: 'Can the platform be fully branded as ours?',
    a: `Yes. Everything ships under your identity — your name, logo, colours and domain. ${BRAND_NAME} stays behind the scenes as the technology vendor; your clients see only your brand.`,
  },
  {
    q: 'Which integrations do you support?',
    a: 'Payment gateways, KYC/AML providers, liquidity providers and bridges, CRM systems and third-party APIs. If your business already relies on a particular provider, we connect the platform to it rather than forcing a replacement.',
  },
  {
    q: 'What happens after launch?',
    a: 'We do not disappear at go-live. You get monitoring, updates and enhancement cycles once you are running — and the team that wrote the code is the team that answers when something needs attention.',
  },
] as const;

export const CTA = {
  headline: 'From first call to live platform',
  sub: 'Tell us what you are building. We will map it, build it under your brand, and keep it running after launch.',
  primary: 'Book a free demo',
  secondary: 'View platforms',
  href: SIGNUP_HREF,
  secondaryHref: '/platforms/web',
};

/**
 * Footer columns — three balanced columns of live routes.
 *
 * `FOOTER_EXPLORE` is derived from NAV_ITEMS so the footer's primary
 * column can never drift from the header's.
 */
export const FOOTER_EXPLORE = NAV_ITEMS.map(({ label, href }) => ({ label, href }));

export const FOOTER_PLATFORM = [
  { label: 'Global Trading Platform', href: '/platforms/web' },
  { label: 'AI & Algo Trading',       href: '/platforms/prop-trading' },
  { label: 'Copy Trading',            href: '/platforms/copy-trading' },
  { label: 'Admin & Back Office',     href: '/platforms/super-admin' },
];

export const FOOTER_COMPANY = [
  { label: 'How it Works', href: '/how-it-works' },
  { label: 'About Us',     href: '/company/about' },
  { label: 'Careers',      href: '/careers' },
  { label: 'Contact',      href: '/company/contact' },
];

/* Legal links are surfaced via the footer bottom bar. */
export const FOOTER_LINKS: { label: string; href: string }[] = [
  // intentionally empty — legal nav lives elsewhere in the footer
];

export const COPYRIGHT = `${BRAND_COPYRIGHT} · Software for trading businesses since 2010`;

/**
 * Vendor disclosure — SetupFX is a technology provider, not a broker.
 * Deliberately does not make any claim about custody of client funds.
 */
export const RISK_DISCLAIMER =
  `${BRAND_NAME} is a software development company. We build and license trading technology to licensed operators; we are not a broker, exchange or financial institution and we do not provide financial, investment or advisory services. Any platform in production is operated by our client under their own licence and regulatory obligations. Trading leveraged products carries a high level of risk.`;
