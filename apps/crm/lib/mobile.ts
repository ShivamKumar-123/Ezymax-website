// The Kalks mobile app (apps/mobile) talks to this Client Area BFF under /api/mobile/*.
//
// The app has no cookies: it keeps the gateway session token in the phone's secure store and sends it as
// `Authorization: Bearer <token>`. Identity is still derived server-side exactly like the cookie routes:
//
// - Most mobile paths are REWRITES of the existing cookie BFF routes (/api/mobile/wallet/... -> /api/wallet/...).
//   The proxy (proxy.ts) moves the bearer token into the request's session cookie and marks the rewritten request
//   as same-origin, so the very same handlers (validation, step-up codes, viewer scopes, ownership checks) run.
// - A few paths are NATIVE mobile routes (auth sign-in flows that must return the session token in the body,
//   the trading-engine terminal API, and the public app config).
//
// CSRF: a bearer token is never sent by a browser on its own (cross-site pages cannot add an Authorization header
// without a CORS preflight, which this app never grants), and every cookie a browser attaches to /api/mobile/* is
// dropped by the proxy. So only the holder of the token can act with it, and the cookie routes keep their
// same-origin checks unchanged.

import { isLocale, LOCALE_COOKIE } from "@kalks/i18n/locales";

export const MOBILE_PREFIX = "/api/mobile/";

/** Gateway session tokens: base64url, optionally prefixed (`v.` viewer, `i.` / `s.` staff sessions). */
const TOKEN_RE = /^(?:[a-z]\.)?[A-Za-z0-9_-]{32,128}$/;
/** Device ids minted by the app (base64url of random bytes). */
const DEVICE_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** Existing cookie BFF families the app may use through a rewrite (first path segment). */
const REWRITES = new Set(["trading", "wallet", "news", "notifications", "kyc", "security", "support", "status", "growth", "partner", "social", "prop", "academy", "reports", "algo"]);
/** Auth routes that are plain cookie routes (no session in the body), used through a rewrite. */
const AUTH_REWRITES = new Set(["heartbeat", "impersonation", "marketing"]);
/** Native mobile route families (apps/crm/app/api/mobile/<family>/...). Feature agents add theirs here. */
const NATIVE = new Set(["auth", "trade", "config", "accounts", "menu"]);

export type MobileRoute = {
  /** rewrite: served by the cookie route at `target`; native: served by app/api/mobile/... itself. */
  kind: "rewrite" | "native";
  /** Where the request is served (the rewrite target, or the mobile path itself). */
  target: string;
  /** The equivalent cookie-route path, used for the maintenance / module / viewer / staff policies. */
  policyPath: string;
};

/** Resolves a /api/mobile/* path; null for anything the app may not call. */
export function mobileRoute(pathname: string): MobileRoute | null {
  if (!pathname.startsWith(MOBILE_PREFIX)) return null;
  const rest = pathname.slice(MOBILE_PREFIX.length).replace(/\/+$/, "");
  if (!rest || rest.includes("..") || rest.includes("//")) return null;
  const [family, second] = rest.split("/");
  if (family === "auth" && second && AUTH_REWRITES.has(second)) return { kind: "rewrite", target: `/api/${rest}`, policyPath: `/api/${rest}` };
  if (family === "config") return rest === "config" ? { kind: "native", target: pathname, policyPath: "/api/status" } : null;
  if (family === "auth") return second ? { kind: "native", target: pathname, policyPath: `/api/auth/${second}` } : null;
  if (family && NATIVE.has(family)) return { kind: "native", target: pathname, policyPath: pathname };
  if (family && REWRITES.has(family)) return { kind: "rewrite", target: `/api/${rest}`, policyPath: `/api/${rest}` };
  return null;
}

/** The bearer session token of a mobile request (null when absent or malformed). */
export function bearerOf(h: Headers): string | null {
  const v = h.get("authorization");
  if (!v) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(v.trim());
  return m && TOKEN_RE.test(m[1]!) ? m[1]! : null;
}

/** The app's device id (`X-Kalks-Device`), when well-formed. */
export function deviceOf(h: Headers): string | null {
  const v = h.get("x-kalks-device")?.trim();
  return v && DEVICE_RE.test(v) ? v : null;
}

/** The reader's language sent by the app (`X-Kalks-Locale`), when supported. */
export function localeOf(h: Headers): string | null {
  const v = h.get("x-kalks-locale")?.trim().toLowerCase();
  return v && isLocale(v) ? v : null;
}

/** `iOS` / `Android` from `X-Kalks-Platform` (recorded on orders); anything else counts as Web. */
export function platformOf(h: Headers): "iOS" | "Android" | "Web" {
  const v = h.get("x-kalks-platform")?.trim().toLowerCase();
  return v === "ios" ? "iOS" : v === "android" ? "Android" : "Web";
}

/**
 * Request headers for the handler that serves a mobile request.
 * - Any cookie the client sent is dropped (a browser's Client Area cookie never authenticates /api/mobile/*).
 * - Rewrites: the bearer token becomes the session cookie, and the request is marked same-origin (the token
 *   itself is the proof the caller holds the session, see the CSRF note at the top).
 * - The app's language goes into the locale cookie, so gateway emails and errors follow it.
 */
export function mobileRequestHeaders(incoming: Headers, token: string | null, route: MobileRoute): Headers {
  const h = new Headers(incoming);
  h.delete("cookie");
  h.delete("x-kalks-mobile");
  const cookies: string[] = [];
  const locale = localeOf(incoming);
  if (locale) cookies.push(`${LOCALE_COOKIE}=${locale}`);
  if (token && route.kind === "rewrite") {
    cookies.push(`kalks_session=${token}`);
    h.delete("authorization");
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const proto = h.get("x-forwarded-proto") === "https" ? "https" : "http";
    if (host) h.set("origin", `${proto}://${host.split(",")[0]!.trim()}`);
    h.set("sec-fetch-site", "same-origin");
  }
  if (cookies.length) h.set("cookie", cookies.join("; "));
  h.set("x-kalks-mobile", "1");
  return h;
}

/** Loopback hosts (local development). */
export function isLoopbackHost(host: string): boolean {
  const name = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "").toLowerCase();
  return name === "localhost" || name === "127.0.0.1" || name === "::1" || name.endsWith(".localhost");
}

/**
 * A service URL for the app. Production URLs are returned as they are. A loopback URL (local stack) is rebased
 * onto the origin the phone used to reach this BFF when that origin is not loopback: the phone then goes through
 * the mobile dev relay (apps/mobile/scripts/dev-relay.mjs), which maps the same paths as the production edge.
 */
export function publicServiceUrl(configured: string, reqOrigin: URL, path = ""): string {
  const u = new URL(configured);
  if (isLoopbackHost(u.host) && !isLoopbackHost(reqOrigin.host)) return `${reqOrigin.origin}${path}`;
  return `${u.origin}${u.pathname.replace(/\/+$/, "")}${path}`;
}

export const toWs = (url: string) => url.replace(/^http/, "ws");
