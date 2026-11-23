export type NavLink = { label: string; href: string; note?: string };

/** Primary navigation (desktop pill). */
export const NAV_PRIMARY: NavLink[] = [
  { label: 'Options', href: '/options', note: 'New' },
  { label: 'Markets', href: '/markets' },
  { label: 'Accounts', href: '/accounts' },
  { label: 'Platforms', href: '/platforms' },
];

/** Under "More" on desktop; listed in full in the mobile menu. */
export const NAV_MORE: NavLink[] = [
  { label: 'Copy trading & PAMM', href: '/copy-trading', note: 'Follow masters or run a fund' },
  { label: 'Partners (IB)', href: '/partners', note: 'Earn on every lot your network trades' },
  { label: 'Academy', href: '/academy', note: '118 lessons, 9 phases' },
  { label: 'White-label & API', href: '/white-label', note: 'For brokers and builders' },
  { label: 'About Ezymex', href: '/about' },
  { label: 'Help & contact', href: '/contact' },
];

export const FOOTER_COLUMNS: { title: string; links: NavLink[] }[] = [
  {
    title: 'Trade',
    links: [
      { label: 'Ezymex FX Options', href: '/options' },
      { label: 'Markets', href: '/markets' },
      { label: 'Forex', href: '/markets?class=forex' },
      { label: 'Metals & energies', href: '/markets?class=metals' },
      { label: 'Indices', href: '/markets?class=indices' },
      { label: 'Crypto', href: '/markets?class=crypto' },
    ],
  },
  {
    title: 'Accounts',
    links: [
      { label: 'Account types', href: '/accounts' },
      { label: 'Demo account', href: '/accounts#demo' },
      { label: 'Funding', href: '/accounts#funding' },
      { label: 'Copy trading & PAMM', href: '/copy-trading' },
    ],
  },
  {
    title: 'Platforms',
    links: [
      { label: 'Ezymex Trader', href: '/platforms#trader' },
      { label: 'Client Area', href: '/platforms#client-area' },
      { label: 'Mobile app', href: '/platforms#mobile' },
      { label: 'API & algo trading', href: '/white-label#api' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Partners (IB)', href: '/partners' },
      { label: 'White-label', href: '/white-label' },
      { label: 'Academy', href: '/academy' },
      { label: 'Help & contact', href: '/contact' },
      { label: 'FAQ', href: '/faq' },
    ],
  },
];

export const LEGAL_LINKS: NavLink[] = [
  { label: 'Security', href: '/security' },
  { label: 'Risk warning', href: '/risk-warning' },
  { label: 'Risk disclosure', href: '/risk' },
  { label: 'Terms & conditions', href: '/terms' },
  { label: 'Privacy policy', href: '/privacy' },
  { label: 'Deposit & withdrawal policy', href: '/deposit-withdrawal' },
  { label: 'Restricted countries', href: '/restricted-countries' },
  { label: 'Delete your account', href: '/delete-account' },
];

/** Homepage hero copy (founder, 2026-10-08). */
export const HERO = {
  eyebrow: 'Ezymex FX Options · the first forex options platform',
  headline: ['Trade like', 'a sovereign.'] as const,
  subline: 'Options on forex, gold and oil. 1,389 CFDs. Instant funding. One kingdom.',
  cta: 'Enter the kingdom',
};
