import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Proxies /admin-api/* → admin-api service at /api/v1/admin/*.
 * Set ADMIN_API_PROXY_TARGET (e.g. http://admin-api:8001 in Docker, http://127.0.0.1:8001 locally).
 */
function adminApiOrigin(): string {
  const raw =
    process.env.ADMIN_API_PROXY_TARGET ||
    process.env.ADMIN_API_INTERNAL_URL ||
    'http://127.0.0.1:8001';
  return String(raw).replace(/\/$/, '');
}

async function segmentsFromParams(params: Promise<{ path?: string[] }>): Promise<string[]> {
  const p = await params;
  return p.path ?? [];
}

async function proxy(req: NextRequest, segments: string[]): Promise<NextResponse> {
  const sub = segments.length ? segments.join('/') : '';
  const path = sub ? `api/v1/admin/${sub}` : 'api/v1/admin';
  const targetUrl = `${adminApiOrigin()}/${path}${req.nextUrl.search}`;

  const headers = new Headers();
  const auth = req.headers.get('authorization');
  if (auth) headers.set('authorization', auth);
  const ct = req.headers.get('content-type');
  if (ct) headers.set('content-type', ct);
  // Forward the browser's cookies so admin-api can read fx_admin (the
  // HttpOnly session cookie set by /auth/login). Without this the proxy
  // strips the cookie and every authenticated request fails with 401.
  const cookie = req.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  // Preserve client IP in the audit logs.
  const fwdFor = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  if (fwdFor) headers.set('x-forwarded-for', fwdFor);

  const method = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  let body: ArrayBuffer | undefined;
  if (hasBody) {
    try {
      body = await req.arrayBuffer();
    } catch {
      body = undefined;
    }
  }

  const ctrl =
    typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
      ? AbortSignal.timeout(120_000)
      : undefined;

  let res: Response;
  try {
    res = await fetch(targetUrl, {
      method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      signal: ctrl,
    });
  } catch (e) {
    // Log the path only — full URLs can contain user-identifiable
    // query params (filter IDs, emails) we don't want in shared logs.
    const msg = e instanceof Error ? e.message : 'fetch failed';
    const path = new URL(targetUrl).pathname;
    console.error('[admin-api proxy] fetch', path, msg);
    return NextResponse.json(
      {
        detail:
          'Cannot reach admin API. Ensure admin-api is running and ADMIN_API_PROXY_TARGET is correct. ' +
          `Target: ${adminApiOrigin()}`,
      },
      { status: 502 },
    );
  }

  let buf: ArrayBuffer;
  try {
    buf = await res.arrayBuffer();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'read failed';
    const path = new URL(targetUrl).pathname;
    console.error('[admin-api proxy] read', path, msg);
    return NextResponse.json({ detail: 'Failed to read admin API response' }, { status: 502 });
  }

  const out = new Headers();
  const ctOut = res.headers.get('content-type');
  if (ctOut) out.set('content-type', ctOut);
  // Relay every Set-Cookie back to the browser. Critical for admin auth:
  // /auth/login sets the fx_admin HttpOnly session cookie here, and
  // /auth/logout deletes it. Without this passthrough the cookie never
  // reaches the browser and login appears to work for one request before
  // failing forever.
  // Headers.getSetCookie() returns the array of values (Node 20+, Next 15+).
  const cookies = (res.headers as unknown as { getSetCookie?: () => string[] })
    .getSetCookie?.();
  if (cookies && cookies.length) {
    for (const c of cookies) out.append('set-cookie', c);
  } else {
    const single = res.headers.get('set-cookie');
    if (single) out.set('set-cookie', single);
  }

  return new NextResponse(buf, {
    status: res.status,
    statusText: res.statusText,
    headers: out,
  });
}

type RouteCtx = { params: Promise<{ path?: string[] }> };

async function safeProxy(req: NextRequest, ctx: RouteCtx): Promise<NextResponse> {
  try {
    const segments = await segmentsFromParams(ctx.params);
    return await proxy(req, segments);
  } catch (e) {
    console.error('[admin-api proxy] unhandled', e);
    return NextResponse.json({ detail: 'Admin API proxy error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  return safeProxy(req, ctx);
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  return safeProxy(req, ctx);
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  return safeProxy(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  return safeProxy(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  return safeProxy(req, ctx);
}
