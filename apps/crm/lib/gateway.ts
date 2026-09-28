// Server-only helpers for talking to the Kalks gateway (services/gateway).
// The browser never sees the gateway or the raw session token: route handlers under /api/auth
// keep the token in an HttpOnly first-party cookie and forward it here as a bearer token.

export const SESSION_COOKIE = "kalks_session";
export const DEVICE_COOKIE = "kalks_did";

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
  email_verified: boolean;
  referral_code: string;
  created_at: string;
  tenant: { slug: string; name: string };
};

export type GatewayResult<T = Record<string, unknown>> = { status: number; data: T };

type Forward = { ip?: string | null; userAgent?: string | null; device?: string | null; token?: string | null };

export async function gateway<T = Record<string, unknown>>(path: string, init: { method?: "GET" | "POST"; body?: unknown } & Forward = {}): Promise<GatewayResult<T>> {
  const headers: Record<string, string> = { "x-kalks-internal": INTERNAL_TOKEN, "x-kalks-tenant": "kalks" };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.ip) headers["x-forwarded-for"] = init.ip;
  if (init.userAgent) headers["user-agent"] = init.userAgent;
  if (init.device) headers["x-kalks-device"] = init.device;
  if (init.token) headers.authorization = `Bearer ${init.token}`;
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

/** Client IP as seen by this app (first X-Forwarded-For hop, else loopback in dev). */
export function clientIp(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "127.0.0.1";
}

/** Only same-app relative paths are allowed as post-login redirects. */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.startsWith("/api/")) return fallback;
  return next;
}

export async function fetchMe(token: string, h: Headers): Promise<GatewayUser | null | "unavailable"> {
  const r = await gateway<{ user?: GatewayUser }>("/v1/auth/me", { token, ip: clientIp(h), userAgent: h.get("user-agent") });
  if (r.status === 200 && r.data.user) return r.data.user;
  if (r.status === 401) return null;
  return "unavailable";
}
