// "Continue with Google": the OAuth 2.0 authorization-code flow with PKCE (S256), `state` and a nonce, in the phone's
// system browser (expo-auth-session: ASWebAuthenticationSession / Custom Tabs), with the app's own Google OAuth
// client. The app never sees a Google token: it hands the authorization code, its PKCE verifier and the nonce to the
// Client Area BFF (/api/mobile/auth/google, apps/crm/lib/google-mobile.ts), which redeems the code with Google,
// verifies the ID token and signs in through the gateway exactly like the Client Area's Google sign-in.
//
// Outcomes: signed in (the session goes to the secure store, like a password sign-in); a new person gets the profile
// step (country, phone, date of birth, terms: app/(auth)/google-profile.tsx), holding the gateway's signed ticket in
// memory only; or an error in the reader's language.
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { authPost, type SessionAnswer } from "@/features/auth/api";
import { i18n } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { randomId } from "@/lib/device";
import { completeSignIn } from "@/session";
import { APP_ID, GOOGLE_CLIENT_ID } from "./config";

// web preview: Google's popup lands on /google-profile (this module's screen), which hands the result to the window
// that opened it and closes
if (Platform.OS === "web") WebBrowser.maybeCompleteAuthSession();

const DISCOVERY: AuthSession.AuthDiscoveryDocument = { authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth" };

export type GoogleProfile = { email: string; first_name: string; last_name: string; referral_code: string | null; picture: string | null };
type ProfileAnswer = { status: "profile_required"; ticket: string; expires_in: number; profile: GoogleProfile | null };

export type GoogleOutcome = { kind: "signedIn" } | { kind: "profile" } | { kind: "cancelled" } | { kind: "error"; code: string; message: string };

/** Gateway / BFF error codes -> the Client Area's translated Google messages (auth.google.error.*). */
const ERRORS: Record<string, string> = {
  google_expired: "expired",
  google_unverified: "unverified",
  google_conflict: "conflict",
  account_disabled: "disabled",
  account_suspended: "suspended",
  rate_limited: "rate_limited",
  google_unavailable: "unavailable",
  unavailable: "unavailable",
  network: "unavailable",
  google_failed: "failed",
  google_cancelled: "cancelled",
};

export function googleError(e: Pick<ApiError, "code" | "message"> | string): { code: string; message: string } {
  const code = typeof e === "string" ? e : e.code;
  const key = ERRORS[code];
  const message = key ? i18n.t.dyn(`auth.google.error.${key}`, "") : typeof e === "string" ? "" : e.message;
  return { code, message: message || i18n.t("auth.google.error.failed") };
}

/** Where Google sends the browser back: the app's own URL scheme on a phone, the profile step page on the web preview. */
export function redirectUri(): string {
  return Platform.OS === "web" ? AuthSession.makeRedirectUri({ path: "google-profile" }) : `${APP_ID}:/oauthredirect`;
}

let pending: { ticket: string; profile: GoogleProfile | null; until: number } | null = null;

/** The profile step's ticket and Google profile (memory only; gone after the ticket expires or the app restarts). */
export function pendingGoogleProfile(): { ticket: string; profile: GoogleProfile | null } | null {
  if (pending && Date.now() > pending.until) pending = null;
  return pending;
}

export function clearGoogleProfile() {
  pending = null;
}

let running = false;

/** Runs the whole flow. `ref` = a partner referral code (sign-up links). */
export async function continueWithGoogle(ref?: string | null): Promise<GoogleOutcome> {
  if (!GOOGLE_CLIENT_ID) return { kind: "error", ...googleError("google_unavailable") };
  if (running) return { kind: "cancelled" };
  running = true;
  try {
    const uri = redirectUri();
    const nonce = randomId(24);
    const request = new AuthSession.AuthRequest({
      clientId: GOOGLE_CLIENT_ID,
      redirectUri: uri,
      scopes: ["openid", "email", "profile"],
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      prompt: AuthSession.Prompt.SelectAccount,
      extraParams: { nonce },
    });
    let result: AuthSession.AuthSessionResult;
    try {
      result = await request.promptAsync(DISCOVERY);
    } catch {
      return { kind: "error", ...googleError("google_failed") };
    }
    if (result.type !== "success") {
      if (result.type === "error") return { kind: "error", ...googleError(result.params.error === "access_denied" ? "google_cancelled" : "google_failed") };
      return { kind: "cancelled" };
    }
    const code = result.params.code;
    if (!code || !request.codeVerifier) return { kind: "error", ...googleError("google_failed") };
    const r = await authPost<SessionAnswer | ProfileAnswer>("google", { code, code_verifier: request.codeVerifier, redirect_uri: uri, nonce, ref: ref || undefined });
    if (!r.ok) return { kind: "error", ...googleError(r.error) };
    if (r.data.status === "ok" && r.data.session?.token) {
      await completeSignIn(r.data.session, r.data.user);
      return { kind: "signedIn" };
    }
    if (r.data.status === "profile_required" && typeof r.data.ticket === "string") {
      pending = { ticket: r.data.ticket, profile: r.data.profile ?? null, until: Date.now() + Math.max(60, r.data.expires_in || 1800) * 1000 - 30_000 };
      return { kind: "profile" };
    }
    return { kind: "error", ...googleError("google_failed") };
  } finally {
    running = false;
  }
}

export type ProfileForm = { first_name: string; last_name: string; phone_dial: string; phone: string; country: string; date_of_birth: string; referral_code: string | null; accept_terms: boolean; marketing_consent: boolean };

/** The profile step: creates the account (the email Google verified) and signs in. */
export async function completeGoogleProfile(form: ProfileForm): Promise<{ ok: true } | { ok: false; error: ApiError }> {
  const p = pendingGoogleProfile();
  if (!p) return { ok: false, error: { code: "google_expired", message: googleError("google_expired").message } };
  const r = await authPost<SessionAnswer>("google/complete", { ticket: p.ticket, ...form });
  if (!r.ok) {
    if (r.error.code === "google_expired" || r.error.code === "google_account_exists") pending = null;
    return { ok: false, error: r.error.code === "google_expired" ? { ...r.error, message: googleError("google_expired").message } : r.error };
  }
  if (!r.data.session?.token) return { ok: false, error: { code: "google_failed", message: googleError("google_failed").message } };
  pending = null;
  await completeSignIn(r.data.session, r.data.user);
  return { ok: true };
}
