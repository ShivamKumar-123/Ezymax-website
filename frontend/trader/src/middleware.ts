import { NextResponse, type NextRequest } from 'next/server';

/**
 * Domain split:
 *   - fxartha.com (apex): marketing + auth + ALL user-app pages
 *     (dashboard, wallet, kyc, accounts, portfolio, profile, etc.)
 *   - trade.fxartha.com: ONLY the trading terminal (/trading/terminal/*)
 *
 * The auth cookie is set with Domain=.fxartha.com (see backend COOKIE_DOMAIN env)
 * so the same session works across the apex and the trade subdomain.
 *
 * If NEXT_PUBLIC_MARKETING_HOST or NEXT_PUBLIC_TRADE_HOST is unset (local dev),
 * this middleware no-ops and a single host serves every route.
 */

const TRADE_PREFIXES = ['/trading/terminal'];
const NEUTRAL_PREFIXES = ['/api/', '/_next/', '/s/', '/static/'];
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

  // Terminal route on apex → bounce to trade subdomain
  if (onMarketing && trade) {
    return NextResponse.redirect(`https://${tradeHost}${pathname}${search}`, 308);
  }
  // Anything that isn't the terminal must live on the apex
  if (onTrade && !trade) {
    return NextResponse.redirect(`https://${marketingHost}${pathname}${search}`, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
