import { NextResponse, type NextRequest } from "next/server";
import { DEVICE_COOKIE, clientIp, edgeCountry, gateway, newDeviceId, setDeviceCookie, setSessionCookie } from "@/lib/gateway";
import { STATE_COOKIE, TICKET_COOKIE, exchangeCode, googleConfig, googleJwks, handleCallback, publicOrigin } from "@/lib/google-oauth";

// GET /api/auth/google/callback?code&state (Google redirects here after consent).
// Validates state, exchanges the code (client secret + PKCE), verifies the ID token, then signs in /
// links / starts the profile step through the gateway. Failures land on /login or /register with ?google_error=.

export async function GET(req: NextRequest) {
  const origin = publicOrigin(req.headers, req.url);
  const secure = origin.startsWith("https://");
  const cfg = googleConfig();
  if (!cfg) return NextResponse.redirect(`${origin}/login?google_error=unavailable`);

  let device = req.cookies.get(DEVICE_COOKIE)?.value;
  const mintDevice = !device;
  if (!device) device = newDeviceId();

  const out = await handleCallback(req.nextUrl.searchParams, req.cookies.get(STATE_COOKIE)?.value, cfg, {
    exchange: (code, verifier, redirectUri) => exchangeCode(code, verifier, redirectUri, cfg),
    jwks: googleJwks(),
    signIn: (identity) =>
      gateway("/v1/auth/google", { body: identity, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent"), device, country: edgeCountry(req.headers) }),
    log: (m) => console.warn(m),
  });

  const res = NextResponse.redirect(`${origin}${out.redirect}`, { headers: { "cache-control": "no-store" } });
  res.cookies.set(STATE_COOKIE, "", { httpOnly: true, secure, sameSite: "lax", path: "/api/auth/google", maxAge: 0 });
  if (mintDevice) setDeviceCookie(res, device);
  if (out.session) {
    setSessionCookie(res, out.session);
    res.cookies.set(TICKET_COOKIE, "", { httpOnly: true, secure, sameSite: "lax", path: "/api/auth/google", maxAge: 0 });
  }
  if (out.ticket) {
    res.cookies.set(TICKET_COOKIE, out.ticket.value, { httpOnly: true, secure, sameSite: "lax", path: "/api/auth/google", maxAge: out.ticket.maxAge });
  }
  return res;
}
