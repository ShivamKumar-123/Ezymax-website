import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV !== 'production';

/* The website is marketing only. Accounts, sign-in and every signed-in page live in the Ezymex Client Area;
   trading lives in Ezymex Trader. Query strings (?ref=CODE, utm_*) are kept on every redirect. */
const CRM_URL = (process.env.NEXT_PUBLIC_CRM_URL || 'https://app.ezymex.com').replace(/\/$/, '');
const TRADER_URL = (process.env.NEXT_PUBLIC_TRADER_URL || 'https://trade.ezymex.com').replace(/\/$/, '');

/* Vercel builds Next.js natively and does not consume a standalone bundle. Keep it for Docker / self-hosting. */
const isVercel = Boolean(process.env.VERCEL);

const to = (source, destination) => ({ source, destination, permanent: false });

const nextConfig = {
  ...(isVercel ? {} : { output: 'standalone' }),
  outputFileTracingRoot: __dirname,
  /* Separate output folder for local check builds (NEXT_DIST_DIR=.next-check) so they never clobber a running dev server. */
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  ...(isDev && {
    experimental: {
      staleTimes: { dynamic: 0, static: 0 },
    },
  }),
  /** Set NEXT_PUBLIC_APP_VERSION at build so each deploy gets new `_next/static` hashes. */
  generateBuildId: async () => {
    const v = process.env.NEXT_PUBLIC_APP_VERSION?.trim();
    if (v) return v.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 48) || 'release';
    const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
    if (sha) return sha.slice(0, 12);
    return 'development';
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [390, 640, 828, 1080, 1280, 1600, 1920, 2400],
    imageSizes: [64, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async redirects() {
    return [
      /* Sign-in and registration: the Ezymex Client Area. */
      to('/auth/login', `${CRM_URL}/login`),
      to('/auth/register', `${CRM_URL}/register`),
      to('/auth/reset-password', `${CRM_URL}/forgot`),
      to('/auth/check-email', `${CRM_URL}/login`),
      to('/auth/verify-email', `${CRM_URL}/login`),
      to('/auth/impersonate', `${CRM_URL}/login`),

      /* Signed-in pages of the old website app: their Client Area equivalents. */
      to('/dashboard', `${CRM_URL}/`),
      to('/more', `${CRM_URL}/`),
      to('/deposit', `${CRM_URL}/wallet/deposit`),
      to('/wallet/deposit/:path*', `${CRM_URL}/wallet/deposit`),
      to('/wallet', `${CRM_URL}/wallet`),
      to('/wallet/:path*', `${CRM_URL}/wallet`),
      to('/kyc', `${CRM_URL}/profile/verification`),
      to('/portfolio', `${CRM_URL}/portfolio`),
      to('/profile', `${CRM_URL}/profile`),
      to('/transactions', `${CRM_URL}/wallet/history`),
      to('/s/:code', `${CRM_URL}/s/:code`),
      to('/news', `${CRM_URL}/news`),
      to('/trading', `${CRM_URL}/accounts`),
      to('/trading/open-account', `${CRM_URL}/accounts/new`),
      to('/trading/terminal', TRADER_URL),
      to('/trading/terminal/:path*', TRADER_URL),
      to('/advanced-chart', TRADER_URL),

      /* Old marketing addresses: the new pages. */
      to('/trading/forex', '/markets?class=forex'),
      to('/trading/indices', '/markets?class=indices'),
      to('/trading/commodities', '/markets?class=metals'),
      to('/trading/crypto', '/markets?class=crypto'),
      to('/account-types', '/accounts'),
      to('/accounts/standard', '/accounts#standard'),
      to('/accounts/pro', '/accounts#pro'),
      to('/accounts/demo', '/accounts#demo'),
      to('/company/about', '/about'),
      to('/company/why-bullza', '/about'),
      to('/company/contact', '/contact'),
      to('/careers', '/about'),
      to('/support', '/contact'),
      to('/download', '/platforms#mobile'),
      to('/how-it-works', '/accounts#open'),
      to('/education/:path*', '/academy'),
      to('/academy/:path+', '/academy'),
      to('/services/education', '/academy'),
      to('/services/market-research', '/markets'),
      to('/services/portfolio-management', '/copy-trading'),
      to('/services/ico-coming-soon', '/'),
      to('/platforms/web', '/platforms'),
      to('/platforms/copy-trading', '/copy-trading'),
      to('/platforms/prop-trading', '/prop'),
      to('/platforms/ib-management', '/partners'),
      to('/platforms/super-admin', '/white-label'),
      to('/platforms/insurance', '/'),
      to('/products/ib-referral', '/partners'),
      to('/products/referral', '/partners'),
      to('/products/insurance', '/'),
      to('/insurance', '/'),
      to('/social', '/copy-trading'),
      to('/pamm', '/copy-trading#pamm'),
      to('/referral', '/partners'),
      to('/business', '/white-label'),
      to('/risk-calculator', '/markets'),
    ];
  },
  async headers() {
    const security = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];
    if (!isDev) {
      return [
        { source: '/(.*)', headers: security },
        {
          source: '/images/:path*',
          headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' }],
        },
      ];
    }
    return [
      {
        source: '/(.*)',
        headers: [
          ...security,
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
