import { NextResponse, type NextRequest } from 'next/server';
import { CRM_LOGIN } from '@/lib/crm';

/**
 * Domain split:
 *   - apex host (e.g. example.com): marketing + auth + ALL user-app pages
 *     (dashboard, wallet, kyc, accounts, portfolio, profile, etc.)
 *   - trade host (e.g. trade.example.com): ONLY the trading terminal
 *     (/trading/terminal/*)
 *
 * The auth cookie is set with Domain=.<apex> (see backend COOKIE_DOMAIN env)
 * so the same session works across the apex and the trade subdomain.
 *
 * If NEXT_PUBLIC_MARKETING_HOST or NEXT_PUBLIC_TRADE_HOST is unset (local dev),
 * the host split no-ops and a single host serves every route.
 *
 * Auth gate: protected app routes require the presence of the httpOnly
 * session cookie on top-level navigations; cookieless visitors are bounced
 * to /auth/login before anything renders. Presence-only by design — the
 * edge must not hold the JWT secret, so verification stays with the
 * backend, and the client-side AuthProvider still covers SPA transitions.
 */

const TRADE_PREFIXES = ['/trading/terminal'];
const NEUTRAL_PREFIXES = ['/api/', '/_next/', '/s/', '/static/', '/images/', '/frames/', '/charting_library/', '/datafeeds/'];
const NEUTRAL_EXACT = new Set<string>(['/favicon.ico', '/robots.txt', '/sitemap.xml']);

// Authenticated app surface. Marketing, auth, and public share pages are
// deliberately absent.
const PROTECTED_PREFIXES = [
  '/dashboard', '/accounts', '/wallet', '/transactions', '/portfolio',
  '/profile', '/kyc', '/referral', '/business', '/social', '/pamm',
  '/insurance', '/risk-calculator', '/more', '/support', '/trading',
];

// Public marketing pages that sit UNDER a protected prefix.
//
// `/trading` and `/accounts` above guard the authenticated app (the
// terminal, the account list), but the marketing site also publishes
// per-instrument and per-account-type landing pages beneath those same
// paths. Prefix matching captured them, so seven public pages redirected
// logged-out visitors to /auth/login — including four linked from the
// footer. Checked before isProtected(); exact matches only, so nothing
// deeper (e.g. /accounts/<uuid>) is exposed.
const PUBLIC_EXACT = new Set<string>([
  '/trading/forex',
  '/trading/indices',
  '/trading/commodities',
  '/trading/crypto',
  '/accounts/standard',
  '/accounts/pro',
  '/accounts/demo',
]);

// Must match ACCESS_TOKEN_COOKIE_NAME / REFRESH_TOKEN_COOKIE_NAME in
// backend/packages/common/src/config.py. Either cookie counts: an expired
// access token with a live refresh cookie is a recoverable session.
const ACCESS_COOKIE = process.env.NEXT_PUBLIC_ACCESS_TOKEN_COOKIE || 'pt_access';
const REFRESH_COOKIE = process.env.NEXT_PUBLIC_REFRESH_TOKEN_COOKIE || 'pt_refresh';

function isTradePath(path: string): boolean {
  return TRADE_PREFIXES.some((p) => path === p || path.startsWith(p + '/') || path.startsWith(p + '?'));
}

function isNeutral(path: string): boolean {
  if (NEUTRAL_EXACT.has(path)) return true;
  return NEUTRAL_PREFIXES.some((p) => path.startsWith(p));
}

function isProtected(path: string): boolean {
  if (PUBLIC_EXACT.has(path)) return false;
  return PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
}

export function middleware(req: NextRequest) {
  const { pathname: reqPath, search: reqSearch } = req.nextUrl;

  // ── Auth gate (runs regardless of the host-split configuration) ──
  if (!isNeutral(reqPath) && isProtected(reqPath)) {
    const mode = req.headers.get('sec-fetch-mode');
    const isNavigation = !mode || mode === 'navigate';
    if (
      isNavigation &&
      !req.cookies.get(ACCESS_COOKIE)?.value &&
      !req.cookies.get(REFRESH_COOKIE)?.value
    ) {
      // Signed-out visitors sign in on the Ezymex Client Area (it owns accounts).
      return NextResponse.redirect(CRM_LOGIN);
    }
  }

  const marketingHost = process.env.NEXT_PUBLIC_MARKETING_HOST;
  const tradeHost = process.env.NEXT_PUBLIC_TRADE_HOST;
  if (!marketingHost || !tradeHost) return NextResponse.next();
  // Misconfiguration guard: if both env vars resolve to the same host
  // the split makes no sense — and the `onTrade && !trade` branch below
  // would redirect every non-terminal request back to itself, producing
  // an infinite 308 loop. No-op out of the middleware instead.
  if (marketingHost.toLowerCase() === tradeHost.toLowerCase()) {
    return NextResponse.next();
  }

  const host = req.headers.get('host')?.toLowerCase().split(':')[0] ?? '';
  const onMarketing = host === marketingHost.toLowerCase();
  const onTrade = host === tradeHost.toLowerCase();
  if (!onMarketing && !onTrade) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (isNeutral(pathname)) return NextResponse.next();

  const trade = isTradePath(pathname);

  // Terminal route on apex → bounce to trade subdomain
  if (onMarketing && trade) {
    return NextResponse.redirect(`https://${tradeHost}${pathname}${search}`, 308);
  }
  // Anything that isn't the terminal must live on the apex — but only
  // redirect real top-level navigations.  Sub-resource fetches (RSC data,
  // scripts, prefetches) must resolve on the current origin to avoid CORS.
  if (onTrade && !trade) {
    const rsc = req.headers.get('rsc');
    const prefetch = req.headers.get('next-router-prefetch');
    const mode = req.headers.get('sec-fetch-mode');
    if (rsc || prefetch || (mode && mode !== 'navigate')) {
      return NextResponse.next();
    }
    return NextResponse.redirect(`https://${marketingHost}${pathname}${search}`, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|frames/|charting_library/|datafeeds/).*)'],
};
