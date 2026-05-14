import { NextResponse, type NextRequest } from 'next/server';

/**
 * Domain split (asymmetric, by design):
 *   - fxartha.com (apex): marketing + auth + every user-app page.
 *     If the user lands on the apex with /trading/terminal, we bounce
 *     them to the trade subdomain so the terminal has a clean origin.
 *   - trade.fxartha.com: hosts the trading terminal canonically, but
 *     ALSO serves every other page. Previously we redirected non-
 *     terminal traffic back to the apex, but that caused two persistent
 *     production issues: (1) RSC prefetches and TradingView chart
 *     bundles cross-origin to the apex, getting CORS-blocked; (2) some
 *     browsers cached 308 redirects from older middleware builds and
 *     replayed them locally for weeks even after we shipped fixes.
 *     Letting both hosts serve all pages eliminates both problems and
 *     adds no real cost — they're authenticated app pages, not
 *     marketing pages with SEO concerns.
 *
 * The auth cookie is Domain=.fxartha.com so a single session works on
 * apex AND subdomain. If NEXT_PUBLIC_MARKETING_HOST or
 * NEXT_PUBLIC_TRADE_HOST is unset (local dev), this middleware no-ops.
 */

const TRADE_PREFIXES = ['/trading/terminal'];
const NEUTRAL_PREFIXES = ['/api/', '/_next/', '/s/', '/static/', '/images/', '/frames/'];
const NEUTRAL_EXACT = new Set<string>(['/favicon.ico', '/robots.txt', '/sitemap.xml']);

function isTradePath(path: string): boolean {
  return TRADE_PREFIXES.some((p) => path === p || path.startsWith(p + '/') || path.startsWith(p + '?'));
}

function isNeutral(path: string): boolean {
  if (NEUTRAL_EXACT.has(path)) return true;
  return NEUTRAL_PREFIXES.some((p) => path.startsWith(p));
}

export function middleware(req: NextRequest) {
  const marketingHost = process.env.NEXT_PUBLIC_MARKETING_HOST;
  const tradeHost = process.env.NEXT_PUBLIC_TRADE_HOST;
  if (!marketingHost || !tradeHost) return NextResponse.next();

  const host = req.headers.get('host')?.toLowerCase().split(':')[0] ?? '';
  const onMarketing = host === marketingHost.toLowerCase();
  const onTrade = host === tradeHost.toLowerCase();
  if (!onMarketing && !onTrade) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (isNeutral(pathname)) return NextResponse.next();

  const trade = isTradePath(pathname);

  // Helper: build a non-cacheable redirect. We use 307 (temporary) so a
  // browser can never cache the redirect across deploys; we also set
  // Cache-Control: no-store on the redirect response itself so the cache
  // never holds onto it. Without this, a stale 308 redirect from an older
  // middleware build will persist on every previously-visited browser
  // even after we deploy a fix — the request never even leaves the browser.
  const noCacheRedirect = (url: string) => {
    const r = NextResponse.redirect(url, 307);
    r.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return r;
  };

  // Terminal route on apex → bounce to trade subdomain. Only top-level
  // navigations are redirected — RSC prefetches / sub-resource fetches
  // must stay same-origin so CORS doesn't break them.
  if (onMarketing && trade) {
    const rsc = req.headers.get('rsc');
    const prefetch = req.headers.get('next-router-prefetch');
    const nextRouterStateTree = req.headers.get('next-router-state-tree');
    const mode = req.headers.get('sec-fetch-mode');
    const hasRscQuery = req.nextUrl.searchParams.has('_rsc');
    if (
      rsc ||
      prefetch ||
      nextRouterStateTree ||
      hasRscQuery ||
      (mode && mode !== 'navigate')
    ) {
      return NextResponse.next();
    }
    return noCacheRedirect(`https://${tradeHost}${pathname}${search}`);
  }
  // Trade subdomain → serve every page. We deliberately do NOT redirect
  // back to apex anymore (see the file-level comment for context).
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|frames/|charting_library/|datafeeds/).*)'],
};
