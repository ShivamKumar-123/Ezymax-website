import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, clientIp, edgeCountry, forgetSession, gateway, newDeviceId } from "@/lib/gateway";
import { withCampaign } from "@/lib/ib";
import { withAttribution } from "@/lib/attribution";
import { bearerOf, deviceOf, platformOf } from "@/lib/mobile";

// Mobile app auth BFF (docs/MOBILE-API.md). App -> /api/mobile/auth/<action> -> gateway /v1/auth/<action>.
// The same gateway calls as the Client Area's cookie route (/api/auth/<action>): email + password, the email code for
// unverified emails and new devices, password reset, step-up codes, blocked sign-in, restrictions and the gateway's
// rate limits (per IP and per email; the client IP is forwarded the same way) are all decided by the gateway.
// Differences from the cookie route, because the app has no cookies:
// - the session comes back in the JSON body (`session: {token, expires_at}`); the app keeps it in the Keystore and
//   sends it as `Authorization: Bearer <token>`;
// - the device id comes from `X-Ezymex-Device`; when the app has none yet one is minted here and returned as `device`
//   (the gateway trusts a device after its first email code, like the browser's ezymex_did cookie);
// - no same-origin check: nothing here is authenticated by a cookie (the proxy drops cookies on /api/mobile/*).
// Session tokens are never logged.
//
//   POST login            {email, password}                 {status: ok, user, session} | {status: otp_required, challenge, …}
//   POST verify-email     {challenge, code}                 {status: ok, user, session}
//   POST resend           {challenge}
//   POST register         {first_name, last_name, email, password, country, phone_dial?, phone?, referral_code?,
//                          referral_campaign?, marketing_consent?, …}   -> {status: otp_required, challenge, …}
//   POST forgot           {email}
//   POST reset            {challenge?, email?, code, password}
//   POST logout           (bearer)
//   POST stepup           (bearer) {action, target}        -> {challenge, …}
//   POST stepup-resend    (bearer) {challenge}
//   POST stepup-verify    (bearer) {challenge, code, action, target} -> {stepup_token}
//   POST password         (bearer) {current, new, stepup_token, sign_out_others}
//   GET  me               (bearer)                          {user, viewer, session, restrictions, …}
// (heartbeat, impersonation and marketing are the cookie routes, reached through the rewrite.)

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

/** A bearer token next to a browser session cookie is refused (the proxy does this first; defence in depth). */
const mixed = (req: NextRequest) => !!bearerOf(req.headers) && !!req.cookies.get(SESSION_COOKIE)?.value;

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const path = POST_ACTIONS[action];
  if (!path) return error(404, "not_found", "Not found.");
  if (mixed(req)) return error(400, "bearer_with_cookies", "Send the session token without cookies.");
  let body: unknown = {};
  if (action !== "logout") {
    if (!req.headers.get("content-type")?.includes("application/json")) return error(415, "bad_request", "Expected JSON.");
    body = await req.json().catch(() => null);
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) return error(400, "bad_request", "Invalid request body.");
  const fields = body as Record<string, unknown>;

  const token = bearerOf(req.headers);
  if (SESSION_ACTIONS.has(action) && !token) return error(401, "unauthorized", "Please sign in.");
  if (action === "register") {
    // partner campaign from the referral code the app sends; attribution never comes from the request body
    withCampaign(fields, req);
    withAttribution(fields, req);
    if (!fields.attribution) fields.attribution = { utm_source: "ezymex_app", utm_medium: platformOf(req.headers).toLowerCase() };
  }
  const known = deviceOf(req.headers);
  // a device id is minted for the sign-in flows only (session actions just pass the app's own along)
  const mint = !known && !SESSION_ACTIONS.has(action);
  const device = known ?? (mint ? newDeviceId() : null);

  const r = await gateway<Record<string, unknown> & { session?: Session }>(path, {
    body: fields,
    ip: clientIp(req.headers),
    userAgent: req.headers.get("user-agent"),
    device,
    token: SESSION_ACTIONS.has(action) ? token : undefined,
    country: edgeCountry(req.headers),
  });

  const { session, ...data } = r.data ?? {};
  const out: Record<string, unknown> = { ...data };
  if (session?.token) out.session = { token: session.token, expires_at: session.expires_at };
  if (mint) out.device = device;
  if (action === "logout" || action === "password") await forgetSession(token);
  return NextResponse.json(out, { status: r.status, headers: NO_STORE });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action !== "me") return error(404, "not_found", "Not found.");
  if (mixed(req)) return error(400, "bearer_with_cookies", "Send the session token without cookies.");
  const token = bearerOf(req.headers);
  if (!token) return error(401, "unauthorized", "Please sign in.");
  const r = await gateway("/v1/auth/me", { token, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent") });
  return NextResponse.json(r.data, { status: r.status, headers: NO_STORE });
}
