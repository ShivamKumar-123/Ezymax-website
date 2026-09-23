import { NextResponse, type NextRequest } from 'next/server';

/**
 * Domain split (asymmetric, by design):
 *   - swisscresta.com (apex): marketing + auth + every user-app page.
 *     If the user lands on the apex with /trading/terminal, we bounce
 *     them to the trade subdomain so the terminal has a clean origin.
 *   - trade.swisscresta.com: hosts the trading terminal canonically, but
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
 * The auth cookie is Domain=.swisscresta.com so a single session works on
 * apex AND subdomain. If NEXT_PUBLIC_MARKETING_HOST or
 * NEXT_PUBLIC_TRADE_HOST is unset (local dev), this middleware no-ops.
 *
 * ── Auth-endpoint rate limiting (P1 M4) ─────────────────────────
 * In-memory token bucket layered in front of the gateway as defense
 * in depth. Single-instance deploy assumption — each Next.js process
 * keeps its own counter, so for multi-instance deploys the effective
 * limit is N × this value. For strict cluster-wide limits, swap the
 * `rateLimitStore` Map for a Redis-backed implementation (Upstash,
 * `@upstash/ratelimit`) without changing the surrounding logic.
 *
 * Why in middleware and not the proxy route: middleware runs BEFORE
 * the body is parsed — a flood attack costs us almost nothing, vs
 * the proxy route which would already have ingested the JSON body.
 */

const TRADE_PREFIXES = ['/trading/terminal'];
const NEUTRAL_PREFIXES = ['/api/', '/_next/', '/s/', '/static/', '/images/'];
const NEUTRAL_EXACT = new Set<string>(['/favicon.ico', '/robots.txt', '/sitemap.xml']);

/* ── Rate-limit configuration ──────────────────────────────────
 * Paths NOT listed here are NOT rate-limited at this layer (the
 * gateway/CDN may still throttle them). Keep the set tight — every
 * map insertion costs memory per IP. */
const RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  '/api/v1/auth/login':           { limit: 5, windowMs: 60_000 },
  '/api/v1/auth/register':        { limit: 3, windowMs: 60_000 },
  '/api/v1/auth/reset-password':  { limit: 3, windowMs: 60_000 },
  '/api/v1/auth/email/start-verification': { limit: 5, windowMs: 60_000 },
  '/api/v1/auth/email/verify-otp':         { limit: 10, windowMs: 60_000 },
  '/api/v1/auth/google':          { limit: 10, windowMs: 60_000 },
};

/* Per-process bucket: key = `${ip}:${path}`, value = recent ts list.
 * Trimmed lazily on each access. Cap on map size prevents
 * unbounded growth from spammy IPs. */
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_MAX_KEYS = 10_000;

function getClientIp(req: NextRequest): string {
  /* Cloudflare → cf-connecting-ip > x-forwarded-for[0] > x-real-ip.
   * Falls back to 'unknown' which buckets all anonymous traffic
   * together — intentionally aggressive for safety. */
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0];
    if (first) return first.trim();
  }
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

function checkRateLimit(
  path: string,
  ip: string,
): { allowed: true } | { allowed: false; retryAfterSec: number } {
  const config = RATE_LIMITS[path];
  if (!config) return { allowed: true };
  const key = `${ip}:${path}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const prev = rateLimitStore.get(key) ?? [];
  /* Drop expired timestamps so the bucket only counts current-window hits. */
  const timestamps = prev.filter((t) => t > windowStart);
  if (timestamps.length >= config.limit) {
    /* timestamps[0] is the oldest in-window hit. Retry-After is the
     * time until that hit falls out of the window. */
    const oldest = timestamps[0]!;
    const retryAfter = Math.ceil((oldest + config.windowMs - now) / 1000);
    return { allowed: false, retryAfterSec: Math.max(retryAfter, 1) };
  }
  timestamps.push(now);
  rateLimitStore.set(key, timestamps);
  /* LRU-style eviction: when the map exceeds the cap, drop the
   * oldest-inserted key. Map preserves insertion order in JS, so
   * `keys().next().value` is the oldest. */
  if (rateLimitStore.size > RATE_LIMIT_MAX_KEYS) {
    const firstKey = rateLimitStore.keys().next().value;
    if (firstKey !== undefined) rateLimitStore.delete(firstKey);
  }
  return { allowed: true };
}

/* ── White-label tenant marketing block-list ─────────────────────
 * The (landing) route group = SwissCresta's marketing + platform legal
 * pages. On a tenant's custom domain these must redirect to the login
 * page. Kept in sync with src/app/(landing)/ — top-level segments only;
 * matching is exact-or-prefix per segment.
 *   - '/accounts' is EXCLUDED as an exact path (it's the trader app's
 *     accounts page); its marketing children /accounts/demo|pro|standard
 *     are covered by the entries below.
 *   - '/trading' marketing children are listed explicitly so the app's
 *     /trading/terminal keeps serving. */
const TENANT_BLOCKED_EXACT = new Set<string>(['/', '/trading']);
const TENANT_BLOCKED_PREFIXES = [
  '/about', '/account-deletion', '/careers', '/cfds', '/collaboration',
  '/company', '/contact', '/currency-pairs', '/demo-account', '/group',
  '/how-it-works', '/institutional', '/introducing-brokers', '/markets',
  '/money-managers', '/partners', '/platforms', '/policy',
  '/precious-metals', '/privacy', '/protocol', '/risk', '/terms',
  '/white-label',
  '/accounts/demo', '/accounts/pro', '/accounts/standard',
  '/trading/commodities', '/trading/crypto', '/trading/forex',
  '/trading/indices', '/trading/overview',
];

function isTenantMarketingPath(path: string): boolean {
  if (TENANT_BLOCKED_EXACT.has(path)) return true;
  return TENANT_BLOCKED_PREFIXES.some(
    (p) => path === p || path.startsWith(p + '/'),
  );
}

function isTradePath(path: string): boolean {
  return TRADE_PREFIXES.some((p) => path === p || path.startsWith(p + '/') || path.startsWith(p + '?'));
}

/* ── H-FE-3: private-route auth guard (defence in depth) ──────────
 * Unambiguously-authenticated app sections. A request to one of these
 * with no session cookie is redirected to /auth/login by the middleware,
 * in addition to the client-side AuthProvider gate. Ambiguous prefixes
 * shared with marketing (/accounts, /trading) are intentionally omitted
 * so we never bounce a legitimate marketing visitor. */
const PRIVATE_APP_PREFIXES = [
  '/dashboard', '/wallet', '/deposit', '/portfolio', '/transactions',
  '/profile', '/kyc', '/social', '/pamm', '/ai-strategies',
  '/algo-connector', '/business',
];

function isPrivateAppPath(path: string): boolean {
  return PRIVATE_APP_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
}

function hasSessionCookie(req: NextRequest): boolean {
  // Cookie names from backend config (ACCESS/REFRESH_TOKEN_COOKIE_NAME).
  return req.cookies.has('pt_access') || req.cookies.has('pt_refresh');
}

function isNeutral(path: string): boolean {
  if (NEUTRAL_EXACT.has(path)) return true;
  return NEUTRAL_PREFIXES.some((p) => path.startsWith(p));
}

export function middleware(req: NextRequest) {
  /* Rate-limit auth endpoints FIRST — before the host-routing logic
   * below. This applies whether the host split is configured or not
   * (local dev gets protection too). */
  const path = req.nextUrl.pathname;
  if (RATE_LIMITS[path]) {
    const ip = getClientIp(req);
    const check = checkRateLimit(path, ip);
    if (!check.allowed) {
      return new NextResponse(
        JSON.stringify({ detail: 'Too many requests. Please wait before retrying.' }),
        {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'retry-after': String(check.retryAfterSec),
            /* Match the proxy's standard cache directive so 429s aren't
             * cached by an intermediate proxy and replayed at the user. */
            'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
          },
        },
      );
    }
  }

  // H-FE-3: defence-in-depth auth guard — runs on every host, before the host
  // split. A private app route with no session cookie is redirected to login
  // (the client AuthProvider enforces this too). Neutral paths (/api, /_next,
  // static) are skipped so proxied API calls keep handling their own auth.
  if (!isNeutral(path) && isPrivateAppPath(path) && !hasSessionCookie(req)) {
    const loginUrl = new URL('/auth/login', req.url);
    loginUrl.searchParams.set('next', path);
    const r = NextResponse.redirect(loginUrl, 307);
    r.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return r;
  }

  const marketingHost = process.env.NEXT_PUBLIC_MARKETING_HOST;
  const tradeHost = process.env.NEXT_PUBLIC_TRADE_HOST;
  if (!marketingHost || !tradeHost) return NextResponse.next();

  const host = req.headers.get('host')?.toLowerCase().split(':')[0] ?? '';
  const onMarketing = host === marketingHost.toLowerCase();
  const onTrade = host === tradeHost.toLowerCase();
  if (!onMarketing && !onTrade) {
    // ── White-label tenant host ────────────────────────────────────
    // Any other host reaching this app is a broker's custom domain
    // (nginx only routes provisioned tenant server_names here). Those
    // visitors must never see the SwissCresta marketing site or the
    // platform's legal pages — a tenant's site starts at their login.
    // App pages (/dashboard, /trading/terminal, /auth/*, …) serve
    // normally; only the (landing) marketing group is intercepted.
    // The apex '/' REWRITES (address bar keeps the broker's domain) to
    // the generated tenant landing page; every other SwissCresta
    // marketing/legal path redirects to the branded login.
    if (req.nextUrl.pathname === '/') {
      return NextResponse.rewrite(new URL('/tenant-home', req.url));
    }
    if (isTenantMarketingPath(req.nextUrl.pathname)) {
      const r = NextResponse.redirect(new URL('/auth/login', req.url), 307);
      r.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      return r;
    }
    return NextResponse.next();
  }

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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|charting_library/|datafeeds/).*)'],
};
