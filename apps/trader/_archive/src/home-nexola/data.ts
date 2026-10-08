import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

/** Brand strings shared by the homepage and the four menu pages. */
// Prose form of the brand name: 'EZYMEX' from the environment becomes 'Ezymex' in copy.
export const BRAND = BRAND_NAME === BRAND_NAME.toUpperCase() && BRAND_NAME.length > 1 ? BRAND_NAME[0] + BRAND_NAME.slice(1).toLowerCase() : BRAND_NAME;
export const MAIL = BRAND_SUPPORT_EMAIL;
export const PHONE = '+44 7737 119978';
/** tel: form of PHONE (digits only). */
export const PHONE_HREF = 'tel:+447737119978';

/** Every link target used by the marketing pages, in one place. */
export const LINKS = {
  home: '/',
  register: '/auth/register',
  demo: '/auth/register?type=demo',
  login: '/auth/login',
  terminal: '/trading/terminal',
  markets: '/markets',
  accounts: '/account-types',
  platforms: '/platforms',
  contact: '/contact',
  help: '/faq',
  risk: '/risk-warning',
  privacy: '/privacy',
  terms: '/terms',
  // Deeper destinations the homepage and menu pages link into.
  forex: '/trading/forex',
  metals: '/trading/commodities',
  indices: '/trading/indices',
  crypto: '/trading/crypto',
  webPlatform: '/platforms/web',
  copyTrading: '/platforms/copy-trading',
  download: '/download',
  accountStandard: '/accounts/standard',
  accountPro: '/accounts/pro',
  accountDemo: '/accounts/demo',
  ib: '/products/ib-referral',
  about: '/company/about',
  why: '/company/why-bullza',
  careers: '/careers',
  academy: '/academy',
  blog: '/academy/blogs',
  restricted: '/restricted-countries',
} as const;

/** Menu: Home plus the four content pages. */
export const NAV = [
  { label: 'Home', href: LINKS.home },
  { label: 'Markets', href: LINKS.markets },
  { label: 'Accounts', href: LINKS.accounts },
  { label: 'Platforms', href: LINKS.platforms },
  { label: 'Contact', href: LINKS.contact },
] as const;

/** Footer risk line (condensed from the spec's footer disclaimer). */
export const RISK_LINE =
  'Trading Forex and CFDs on margin carries a high level of risk and may not be suitable for all investors. Leverage can work against you as well as for you. Past performance is not a reliable indicator of future results.';
