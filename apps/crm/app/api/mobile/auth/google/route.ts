import { NextResponse, type NextRequest } from "next/server";
import { clientIp, edgeCountry, gateway, newDeviceId } from "@/lib/gateway";
import { googleJwks } from "@/lib/google-oauth";
import { exchangeMobileCode, mobileGoogleClient, mobileGoogleSignIn, parseCodeInput } from "@/lib/google-mobile";
import { deviceOf } from "@/lib/mobile";

// POST /api/mobile/auth/google {code, code_verifier, redirect_uri, nonce, ref?}: "Continue with Google" in the mobile
// app (lib/google-mobile.ts). The app ran the authorization-code + PKCE flow with its own iOS / Android OAuth client;
// this redeems the code with Google, verifies the ID token and signs in / links / starts the profile step through the
// gateway, like the Client Area's /api/auth/google/callback. The session token (or the profile ticket of a new person)
// comes back in the JSON body; the device id like the other mobile auth routes (X-Kalks-Device, minted when missing).
// No CSRF check is needed: nothing here is authenticated by a cookie (the proxy drops cookies on /api/mobile/*).

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

function error(status: number, code: string, message: string, field?: string) {
  return NextResponse.json({ error: field ? { code, message, field } : { code, message } }, { status, headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  if (!req.headers.get("content-type")?.includes("application/json")) return error(415, "bad_request", "Expected JSON.");
  const client = mobileGoogleClient(req.headers.get("x-kalks-platform"));
  if (!client) return error(503, "google_unavailable", "Google sign-in isn't available in this app yet. Please use your email.");
  const body = await req.json().catch(() => null);
  const input = parseCodeInput(body, client.platform);
  if ("field" in input) return error(400, "bad_request", input.message, input.field);

  const known = deviceOf(req.headers);
  const device = known ?? newDeviceId();
  const out = await mobileGoogleSignIn(input, client, {
    exchange: (i, c) => exchangeMobileCode(i, c),
    jwks: googleJwks(),
    signIn: (identity) => gateway("/v1/auth/google", { body: identity, ip: clientIp(req.headers), userAgent: req.headers.get("user-agent"), device, country: edgeCountry(req.headers) }),
    log: (m) => console.warn(m),
  });
  const res: Record<string, unknown> = { ...out.body };
  if (!known && out.status === 200) res.device = device;
  return NextResponse.json(res, { status: out.status, headers: NO_STORE });
}
