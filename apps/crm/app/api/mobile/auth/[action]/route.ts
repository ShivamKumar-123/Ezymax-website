import { NextResponse, type NextRequest } from "next/server";
import { clientIp, edgeCountry, gateway } from "@/lib/gateway";
import { bearerOf, deviceOf } from "@/lib/mobile";

// Mobile app auth BFF (apps/mobile). App -> /api/mobile/auth/<action> -> gateway /v1/auth/<action>.
// Same gateway flows as the Client Area (/api/auth/<action>): email + password, email code for unverified emails
// and new devices, password reset, step-up codes, blocked sign-in and restrictions are all decided by the gateway.
// Differences from the cookie route, because the app has no cookies:
// - the session token comes back in the JSON body (`session: {token, expires_at}`); the app keeps it in the
//   phone's secure store and sends it as `Authorization: Bearer <token>`;
// - the device id comes from `X-Kalks-Device` (minted here and returned as `device` when the app has none yet).
// No CSRF check is needed: nothing here is authenticated by a cookie (the proxy drops cookies on /api/mobile/*).

const POST_ACTIONS: Record<string, string> = {
  register: "/v1/auth/register",
  login: "/v1/auth/login",
  "verify-email": "/v1/auth/verify-email",
  resend: "/v1/auth/resend",
  forgot: "/v1/auth/forgot",
  reset: "/v1/auth/reset",
  logout: "/v1/auth/logout",
  stepup: "/v1/auth/stepup",
  "stepup-resend": "/v1/auth/stepup/resend",
  "stepup-verify": "/v1/auth/stepup/verify",
  password: "/v1/auth/password",
};

/** Actions that act on the current session: they need the bearer token. */
const SESSION_ACTIONS = new Set(["logout", "stepup", "stepup-resend", "stepup-verify", "password"]);

const NO_STORE = { "cache-control": "no-store" };

type Session = { token: string; expires_at: string };

function error(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: NO_STORE });
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
  if (!req.headers.get("content-type")?.includes("application/json")) return error(415, "bad_request", "Expected JSON.");
  const body = action === "logout" ? {} : await req.json().catch(() => null);
  if (body === null || typeof body !== "object" || Array.isArray(body)) return error(400, "bad_request", "Invalid request body.");

  const token = bearerOf(req.headers);
  if (SESSION_ACTIONS.has(action) && !token) return error(401, "unauthorized", "Please sign in.");
  const known = deviceOf(req.headers);
  const device = known ?? newDeviceId();

  const r = await gateway<Record<string, unknown> & { session?: Session }>(path, {
    body,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    device,
    token: SESSION_ACTIONS.has(action) ? token : undefined,
    country: edgeCountry(req.headers),
  });

  const { session, ...data } = r.data;
  const out: Record<string, unknown> = { ...data };
  if (session?.token) out.session = { token: session.token, expires_at: session.expires_at };
  if (!known) out.device = device;
  return NextResponse.json(out, { status: r.status, headers: NO_STORE });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action !== "me") return error(404, "not_found", "Not found.");
  const token = bearerOf(req.headers);
  if (!token) return error(401, "unauthorized", "Please sign in.");
  const r = await gateway("/v1/auth/me", { token, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
  return NextResponse.json(r.data, { status: r.status, headers: NO_STORE });
}
