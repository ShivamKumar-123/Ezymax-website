// Server-only helpers for talking to the Ezymex gateway (services/gateway).
// The browser never sees the gateway or the raw session token: route handlers under /api/auth
// keep the token in an HttpOnly first-party cookie and forward it here as a bearer token.

import type { NextResponse } from "next/server";
import type { ViewerScope } from "@/lib/viewer";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "@ezymex/i18n/locales";
import { requestHost } from "@/lib/tenant-host";
import { Memo, secretKey } from "@/lib/memo";

export const SESSION_COOKIE = "ezymex_session";
export const DEVICE_COOKIE = "ezymex_did";

const PROD = process.env.NODE_ENV === "production";
const DEVICE_MAX_AGE = 400 * 24 * 3600;

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://127.0.0.1:8080";
const INTERNAL_TOKEN = process.env.GATEWAY_INTERNAL_TOKEN ?? "";

export type GatewayUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  name: string;
  phone_dial: string;
  phone: string;
  country: string;
  date_of_birth: string;
  kyc_status: "unverified" | "pending" | "verified" | "rejected";
  /** Latest KYC case status (gateway /v1/kyc); null before verification is started. */
  kyc_case_status?: "draft" | "submitted" | "in_review" | "more_info" | "approved" | "rejected" | null;
  /** D92: name and date of birth are locked after identity verification. */
  identity_locked?: boolean;
  email_verified: boolean;
  /** Signs in with Google (account linked to a Google account). */
  google_linked?: boolean;
  referral_code: string;
  /** Whether the client's referral link counts yet: it does once they have deposited (gateway referral.rs). Only on
   *  the client's own session record (/v1/auth/me); absent for view-only sessions. */
  referral_active?: boolean;
  /** Why it doesn't: `no_deposit` (show "activates after your first deposit") or `unavailable` (the wallet couldn't
   *  be asked; show nothing). Null when active. */
  referral_inactive_reason?: "no_deposit" | "unavailable" | null;
  created_at: string;
  tenant: { slug: string; name: string };
  /** Set when this is a view-only session (D90): the owner's reduced record, read-only, limited to the scope. */
  viewer?: ViewerScope | null;
  /** The current session: id and the broker's idle sign-out time (minutes). */
  session?: { id: number; idle_minutes: number; expires_at: string };
};

export type GatewayResult<T = Record<string, unknown>> = { status: number; data: T };

type Forward = { ip?: string | null; userAgent?: string | null; device?: string | null; token?: string | null; country?: string | null; host?: string | null };

export async function gateway<T = Record<string, unknown>>(path: string, init: { method?: "GET" | "POST" | "PATCH"; body?: unknown } & Forward = {}): Promise<GatewayResult<T>> {
  const headers: Record<string, string> = { "x-ezymex-internal": INTERNAL_TOKEN, "x-ezymex-tenant": "ezymex" };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.ip) headers["x-forwarded-for"] = init.ip;
  if (init.userAgent) headers["user-agent"] = init.userAgent;
  if (init.device) headers["x-ezymex-device"] = init.device;
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  if (init.country) headers["x-ezymex-country"] = init.country;
  // the broker (tenant) is resolved by the gateway from the visitor's host (tenant_domains)
  const host = init.host ?? (await requestHost());
  if (host) headers["x-ezymex-host"] = host;
  // the reader's language (Client Area switcher cookie): the gateway writes code and welcome emails in it
  const locale = await requestLocale();
  if (locale) headers["x-ezymex-locale"] = locale;
  try {
    const res = await fetch(`${GATEWAY_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, data };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "Sign-in service is unavailable. Please try again shortly." } } as T };
  }
}

/** The ezymex_locale cookie of the current request, when there is one (route handlers and server components). */
async function requestLocale(): Promise<string | undefined> {
  try {
    const v = (await cookies()).get(LOCALE_COOKIE)?.value;
    return v && isLocale(v) ? v : undefined;
  } catch {
    return undefined; // outside a request scope
  }
}

/** Client IP as seen by this app (first X-Forwarded-For hop, else loopback in dev). */
export function clientIp(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "127.0.0.1";
}

/** Only same-app relative paths are allowed as post-login redirects. */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.startsWith("/api/")) return fallback;
  return next;
}

/** Approximate location of the visitor from the edge (Cloudflare CF-IPCountry), for new sessions. */
export function edgeCountry(h: Headers): string | null {
  const c = h.get("cf-ipcountry")?.trim();
  return c && /^[A-Za-z]{2}$/.test(c) ? c : null;
}

// Every page render and BFF call resolves the session; a page load fans out into several BFF calls, so the answer
// is shared for a few seconds per session (and per client IP / host) instead of asking the gateway each time.
// Sign-out drops the entry at once (forgetSession); a revocation elsewhere applies within ME_TTL_MS.
const ME_TTL_MS = 3_000;
const meCache = new Memo<GatewayUser | null | "unavailable">(ME_TTL_MS, 5_000);

export async function fetchMe(token: string, h: Headers): Promise<GatewayUser | null | "unavailable"> {
  const ip = clientIp(h);
  const key = `${await secretKey(token)}|${ip}|${(await requestHost()) ?? ""}`;
  return meCache.get(
    key,
    async () => {
      const r = await gateway<{ user?: GatewayUser; viewer?: ViewerScope | null; session?: GatewayUser["session"] }>("/v1/auth/me", { token, ip, userAgent: h.get("user-agent") });
      if (r.status === 200 && r.data.user) return { ...r.data.user, viewer: r.data.viewer ?? null, session: r.data.session };
      if (r.status === 401) return null;
      return "unavailable";
    },
    (v) => v !== "unavailable" && v !== null,
  );
}

/** Forget the cached session answer (sign-out, password change). */
export async function forgetSession(token: string | undefined | null) {
  if (token) meCache.deletePrefix(`${await secretKey(token)}|`);
}

/** CSRF check for state-changing requests: the Origin (or Sec-Fetch-Site) must be this app. */
export function sameOrigin(h: Headers): boolean {
  const origin = h.get("origin");
  if (!origin) return h.get("sec-fetch-site") === "same-origin";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function newDeviceId(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Buffer.from(b).toString("base64url");
}

export function setDeviceCookie(res: NextResponse, device: string) {
  res.cookies.set(DEVICE_COOKIE, device, { httpOnly: true, secure: PROD, sameSite: "lax", path: "/", maxAge: DEVICE_MAX_AGE });
}

export function setSessionCookie(res: NextResponse, session: { token: string; expires_at: string }) {
  const maxAge = Math.max(60, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000));
  res.cookies.set(SESSION_COOKIE, session.token, { httpOnly: true, secure: PROD, sameSite: "lax", path: "/", maxAge });
}

/** Step-up actions (D20): sensitive changes confirmed with an emailed code even inside a session. */
export type StepupAction = "trading_password" | "investor_password" | "leverage" | "withdrawal" | "account_password" | "profile_email" | "profile_phone" | "viewer_access" | "account_archive" | "account_close" | "internal_transfer";

/** The step-up token the browser got from /api/auth/stepup-verify: body field `stepup_token` or header `X-Ezymex-Stepup`. */
export function stepupTokenOf(h: Headers, body?: Record<string, unknown> | null): string {
  const b = body?.stepup_token;
  const v = typeof b === "string" && b ? b : (h.get("x-ezymex-stepup") ?? "");
  return v.trim().slice(0, 128);
}

/**
 * Redeems a step-up token with the gateway right before performing the change. Single use, bound to
 * user + action + target. Returns null when the change may go ahead, else the error to send back.
 */
export async function consumeStepup(userId: number, h: Headers, action: StepupAction, target: string, token: string): Promise<GatewayResult | null> {
  if (!token) return { status: 403, data: { error: { code: "stepup_required", message: "Confirm this change with the code we email you." } } };
  const r = await gateway("/v1/auth/stepup/consume", { body: { token, user_id: userId, action, target }, ip: clientIp(h), userAgent: h.get("user-agent") });
  return r.status === 200 ? null : r;
}
