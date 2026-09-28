import { NextResponse, type NextRequest } from "next/server";
import { DEVICE_COOKIE, SESSION_COOKIE, clientIp, gateway, safeNext } from "@/lib/gateway";

// Client Area auth BFF. Browser -> /api/auth/<action> (same origin) -> gateway /v1/auth/<action>.
// CSRF: cookies are SameSite=Lax, POSTs must be JSON and carry a same-origin Origin header.

const POST_ACTIONS: Record<string, string> = {
  register: "/v1/auth/register",
  login: "/v1/auth/login",
  "verify-email": "/v1/auth/verify-email",
  resend: "/v1/auth/resend",
  forgot: "/v1/auth/forgot",
  reset: "/v1/auth/reset",
  logout: "/v1/auth/logout",
};

const PROD = process.env.NODE_ENV === "production";
const DEVICE_MAX_AGE = 400 * 24 * 3600;

type Session = { token: string; expires_at: string };

function error(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "same-origin";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function newDeviceId(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Buffer.from(b).toString("base64url");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const path = POST_ACTIONS[action];
  if (!path) return error(404, "not_found", "Not found.");
  if (!sameOrigin(req)) return error(403, "forbidden", "Cross-site request blocked.");
  if (!req.headers.get("content-type")?.includes("application/json")) return error(415, "bad_request", "Expected JSON.");

  const body = action === "logout" ? {} : await req.json().catch(() => null);
  if (body === null || typeof body !== "object") return error(400, "bad_request", "Invalid request body.");

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  let device = req.cookies.get(DEVICE_COOKIE)?.value;
  const mintDevice = !device;
  if (!device) device = newDeviceId();

  const r = await gateway<Record<string, unknown> & { session?: Session }>(path, {
    body,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    device,
    token: action === "logout" ? token : undefined,
  });

  const { session, ...data } = r.data;
  const res = NextResponse.json(data, { status: r.status, headers: { "cache-control": "no-store" } });
  if (mintDevice) {
    res.cookies.set(DEVICE_COOKIE, device, { httpOnly: true, secure: PROD, sameSite: "lax", path: "/", maxAge: DEVICE_MAX_AGE });
  }
  if (session?.token) {
    const maxAge = Math.max(60, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000));
    res.cookies.set(SESSION_COOKIE, session.token, { httpOnly: true, secure: PROD, sameSite: "lax", path: "/", maxAge });
  }
  if (action === "logout" || action === "reset") res.cookies.delete(SESSION_COOKIE);
  return res;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action === "me") {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return error(401, "unauthorized", "Please sign in.");
    const r = await gateway("/v1/auth/me", { token, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
    const res = NextResponse.json(r.data, { status: r.status, headers: { "cache-control": "no-store" } });
    if (r.status === 401) res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  if (action === "expired") {
    // Stale or revoked session: drop the cookie and go to sign-in (keeps the page the user wanted).
    const next = safeNext(req.nextUrl.searchParams.get("next"), "");
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (token) {
      // only clear a cookie that really is dead, so a cross-site link can't sign someone out
      const r = await gateway("/v1/auth/me", { token, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
      if (r.status !== 401) return NextResponse.redirect(new URL(next || "/", req.url));
    }
    const url = new URL("/login", req.url);
    if (next) url.searchParams.set("next", next);
    const res = NextResponse.redirect(url);
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  return error(404, "not_found", "Not found.");
}
