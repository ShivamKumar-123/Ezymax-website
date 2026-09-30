// "Continue with Google" in the mobile app (apps/mobile, src/features/platform/google), server side.
//
// The app runs the OAuth 2.0 authorization-code flow with PKCE (S256) and a nonce against Google itself
// (expo-auth-session in the phone's system browser), with the app's own iOS / Android OAuth client, and hands the
// authorization code to this BFF:
//
//   POST /api/mobile/auth/google            {code, code_verifier, redirect_uri, nonce, ref?}
//   POST /api/mobile/auth/google/complete   {ticket, first_name, last_name, phone_dial, phone, country, date_of_birth,
//                                             referral_code?, accept_terms, marketing_consent?}   (new people only)
//
// Here the code is redeemed with Google server to server (installed-app clients have no secret; the PKCE verifier
// proves the caller started the flow), the ID token is verified exactly like the web flow (lib/google-oauth.ts:
// Google JWKS signature, iss, aud = that client id, azp, exp, nonce, email_verified), and the gateway signs in /
// links / starts the profile step (/v1/auth/google), as for the Client Area. The session token and the profile
// ticket come back in the JSON body: the app keeps the session in the phone's secure store, the ticket in memory.
//
// Which OAuth client a code belongs to is decided from X-Kalks-Platform and this server's configuration
// (GOOGLE_IOS_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID; the app's web preview uses GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET,
// and only on a development server), never from the request body.
//
// Plain TypeScript without Next or "@/" imports, so `node --test apps/crm/tests` can drive it with a local JWKS and
// stub exchange / gateway (tests/mobile-platform.test.mjs); production always uses Google's.

import type { JWTVerifyGetKey } from "jose";
import { GOOGLE_TOKEN_URL, GoogleAuthError, cleanRef, googleConfig, verifyIdToken, type GoogleIdentity } from "./google-oauth";

export type MobilePlatform = "ios" | "android" | "web";
export type MobileGoogleClient = { platform: MobilePlatform; clientId: string; clientSecret?: string };

/** The OAuth client for the app's platform, or null when Google sign-in isn't configured for it. */
export function mobileGoogleClient(platform: string | null | undefined, env: Record<string, string | undefined> = process.env): MobileGoogleClient | null {
  const p = (platform ?? "").trim().toLowerCase();
  if (p === "ios" || p === "android") {
    const clientId = (p === "ios" ? env.GOOGLE_IOS_CLIENT_ID : env.GOOGLE_ANDROID_CLIENT_ID)?.trim();
    return clientId ? { platform: p, clientId } : null;
  }
  if (p === "web") {
    // the app's web preview only (development): a production server redeems codes of the phones' clients alone
    if (env.NODE_ENV === "production") return null;
    const web = googleConfig(env);
    return web ? { platform: "web", clientId: web.clientId, clientSecret: web.clientSecret } : null;
  }
  return null;
}

export type CodeInput = { code: string; verifier: string; redirectUri: string; nonce: string; ref: string | null };
export type InputError = { field: string; message: string };

const VERIFIER_RE = /^[A-Za-z0-9._~-]{43,128}$/; // RFC 7636
const NONCE_RE = /^[A-Za-z0-9_-]{16,128}$/;
/** Installed-app redirect: a reverse-DNS custom scheme, e.g. com.kalkstrade.app:/oauthredirect. */
const NATIVE_REDIRECT_RE = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+:\/[A-Za-z0-9/_-]*$/i;

function webRedirectOk(uri: string): boolean {
  try {
    const u = new URL(uri);
    const loopback = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    return (u.protocol === "https:" || (u.protocol === "http:" && loopback)) && !u.username && !u.password && !u.hash;
  } catch {
    return false;
  }
}

/** Validates the app's request body. */
export function parseCodeInput(body: unknown, platform: MobilePlatform): CodeInput | InputError {
  const b = (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");
  const code = str("code");
  if (!code || code.length > 2048) return { field: "code", message: "Missing authorization code." };
  const verifier = str("code_verifier");
  if (!VERIFIER_RE.test(verifier)) return { field: "code_verifier", message: "Invalid PKCE verifier." };
  const nonce = str("nonce");
  if (!NONCE_RE.test(nonce)) return { field: "nonce", message: "Invalid nonce." };
  const redirectUri = str("redirect_uri");
  const redirectOk = redirectUri.length <= 512 && (platform === "web" ? webRedirectOk(redirectUri) : NATIVE_REDIRECT_RE.test(redirectUri));
  if (!redirectOk) return { field: "redirect_uri", message: "Invalid redirect URI." };
  return { code, verifier, redirectUri, nonce, ref: cleanRef(str("ref")) || null };
}

/** Redeems the code with Google (PKCE; the client secret only for the web client). Returns the ID token. */
export async function exchangeMobileCode(input: CodeInput, client: MobileGoogleClient, fetchImpl: typeof fetch = fetch): Promise<string> {
  const form = new URLSearchParams({ grant_type: "authorization_code", code: input.code, code_verifier: input.verifier, redirect_uri: input.redirectUri, client_id: client.clientId });
  if (client.clientSecret) form.set("client_secret", client.clientSecret);
  let res: Response;
  try {
    res = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: form.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new GoogleAuthError("unavailable", "Google did not respond");
  }
  const data = (await res.json().catch(() => ({}))) as { id_token?: unknown; error?: unknown };
  if (!res.ok || typeof data.id_token !== "string") {
    // invalid_grant = the code was already used, expired, or doesn't match the verifier / redirect
    throw new GoogleAuthError(data.error === "invalid_grant" ? "expired" : res.status >= 500 ? "unavailable" : "failed", `token exchange failed (${res.status} ${String(data.error ?? "")})`);
  }
  return data.id_token;
}

type GatewayReply = { status: number; data: Record<string, unknown> };

export type MobileGoogleDeps = {
  /** code -> ID token (production: exchangeMobileCode against Google) */
  exchange: (input: CodeInput, client: MobileGoogleClient) => Promise<string>;
  jwks: JWTVerifyGetKey;
  /** POST /v1/auth/google on the gateway */
  signIn: (body: GoogleIdentity & { ref: string | null }) => Promise<GatewayReply>;
  now?: Date;
  log?: (msg: string) => void;
};

export type MobileGoogleOutcome = { status: number; body: Record<string, unknown> };

const FAILURES: Record<string, { status: number; message: string }> = {
  expired: { status: 410, message: "Your Google sign-in timed out. Please try again." },
  unverified: { status: 403, message: "Your Google account's email address isn't verified. Verify it with Google, or sign up with email instead." },
  unavailable: { status: 503, message: "Google sign-in is unavailable right now. Please try again shortly, or use your email." },
  failed: { status: 401, message: "We couldn't sign you in with Google. Please try again." },
};

function failure(code: string): MobileGoogleOutcome {
  const f = FAILURES[code] ?? FAILURES.failed!;
  return { status: f.status, body: { error: { code: `google_${FAILURES[code] ? code : "failed"}`, message: f.message } } };
}

/**
 * Exchange, verify, then the gateway. `ok` -> {status: "ok", user, session}; a new person -> {status:
 * "profile_required", ticket, expires_in, profile}; gateway refusals (google_conflict, account_suspended, rate_limited,
 * feature_disabled …) are passed through as they are.
 */
export async function mobileGoogleSignIn(input: CodeInput, client: MobileGoogleClient, deps: MobileGoogleDeps): Promise<MobileGoogleOutcome> {
  let identity: GoogleIdentity;
  try {
    const idToken = await deps.exchange(input, client);
    identity = await verifyIdToken(idToken, { clientId: client.clientId, nonce: input.nonce, jwks: deps.jwks, now: deps.now });
  } catch (e) {
    deps.log?.(`mobile google sign-in (${client.platform}): ${e instanceof Error ? e.message : String(e)}`);
    return failure(e instanceof GoogleAuthError ? e.code : "failed");
  }
  const r = await deps.signIn({ ...identity, ref: input.ref });
  const d = r.data;
  const session = d.session as { token?: unknown; expires_at?: unknown } | undefined;
  if (r.status === 200 && d.status === "ok" && typeof session?.token === "string") {
    return { status: 200, body: { status: "ok", user: d.user, session: { token: session.token, expires_at: session.expires_at } } };
  }
  if (r.status === 200 && d.status === "profile_required" && typeof d.ticket === "string") {
    return { status: 200, body: { status: "profile_required", ticket: d.ticket, expires_in: typeof d.expires_in === "number" ? d.expires_in : 1800, profile: d.profile ?? null } };
  }
  deps.log?.(`mobile google sign-in: gateway ${r.status} ${String((d.error as { code?: string } | undefined)?.code ?? "")}`);
  if (r.status === 200) return failure("failed");
  return { status: r.status, body: d.error ? { error: d.error } : failure(r.status >= 500 ? "unavailable" : "failed").body };
}

/** Profile step fields the app may send (the ticket is added by the route). */
export const COMPLETE_FIELDS = ["first_name", "last_name", "phone_dial", "phone", "country", "date_of_birth", "referral_code", "accept_terms", "marketing_consent"] as const;

/** The gateway body for /v1/auth/google/complete, or null when the ticket is missing. */
export function completeBody(body: unknown): Record<string, unknown> | null {
  const b = (body && typeof body === "object" && !Array.isArray(body) ? body : null) as Record<string, unknown> | null;
  if (!b || typeof b.ticket !== "string" || !b.ticket || b.ticket.length > 4096) return null;
  const out: Record<string, unknown> = { ticket: b.ticket };
  for (const k of COMPLETE_FIELDS) if (k in b) out[k] = b[k];
  return out;
}
