import { NextResponse, type NextRequest } from 'next/server';

const MARKETING_PATHS = new Set<string>([
  '/',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/risk',
  '/platforms',
  '/white-label',
  '/trading/forex',
  '/trading/commodities',
  '/trading/indices',
  '/trading/crypto',
  '/platforms/web',
  '/platforms/copy-trading',
  '/platforms/prop-trading',
  '/platforms/ib-management',
  '/platforms/super-admin',
  '/accounts/standard',
  '/accounts/pro',
  '/accounts/demo',
]);
const MARKETING_PREFIXES = ['/company/', '/education/'];
const NEUTRAL_PREFIXES = ['/api/', '/_next/', '/s/', '/static/'];
const NEUTRAL_EXACT = new Set<string>(['/favicon.ico', '/robots.txt', '/sitemap.xml']);

function isMarketing(path: string): boolean {
  if (MARKETING_PATHS.has(path)) return true;
  return MARKETING_PREFIXES.some((p) => path.startsWith(p));
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

  const marketing = isMarketing(pathname);

  if (onTrade && marketing) {
    return NextResponse.redirect(`https://${marketingHost}${pathname}${search}`, 308);
  }
  if (onMarketing && !marketing) {
    return NextResponse.redirect(`https://${tradeHost}${pathname}${search}`, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
