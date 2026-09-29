// Server-only helpers for talking to the Kalks trading engine (services/trading, 127.0.0.1:8090).
// The browser never sees the engine or its internal token: route handlers under /api/trading resolve the
// signed-in client from the gateway session cookie and forward the gateway user id as X-Kalks-User-Id.
// Contract: services/trading/README.md ("Client Area API").

import type { NextRequest } from "next/server";
import { SESSION_COOKIE, clientIp, fetchMe, type GatewayUser } from "@/lib/gateway";

const TRADING_URL = process.env.TRADING_URL ?? "http://127.0.0.1:8090";
const TRADING_TOKEN = process.env.TRADING_INTERNAL_TOKEN ?? "";

/**
 * Kalks Trader base URL. The Trade button opens `${TERMINAL_BASE}/?sso=<one-time token>`; the terminal
 * redeems the token with POST /v1/terminal/sso (one-time, 60 s) and drops the query param.
 */
export const TERMINAL_BASE = (process.env.NEXT_PUBLIC_TERMINAL_URL ?? "http://localhost:3002").replace(/\/+$/, "");

export type EngineResult<T = Record<string, unknown>> = { status: number; data: T };

export async function engine<T = Record<string, unknown>>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; user: GatewayUser; req: NextRequest },
): Promise<EngineResult<T>> {
  const headers: Record<string, string> = {
    "x-kalks-internal": TRADING_TOKEN,
    "x-kalks-tenant": init.user.tenant?.slug || "kalks",
    "x-kalks-user-id": String(init.user.id),
    "x-forwarded-for": clientIp(init.req.headers),
  };
  const ua = init.req.headers.get("user-agent");
  if (ua) headers["user-agent"] = ua;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${TRADING_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, data };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "Trading service is unavailable. Please try again shortly." } } as T };
  }
}

/** The signed-in client, resolved server-side from the HttpOnly session cookie (never from the request body). */
export async function sessionUser(req: NextRequest): Promise<GatewayUser | null | "unavailable"> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const user = await fetchMe(token, req.headers);
  // Defence in depth: a view-only session (D90) never acts through a BFF. The proxy already refuses its
  // non-GET requests with 403 viewer_read_only; should one get here anyway, it is treated as signed out.
  if (user && user !== "unavailable" && user.viewer && req.method !== "GET" && req.method !== "HEAD") return null;
  return user;
}

/** Same-origin check for state-changing requests (cookies are SameSite=Lax; POSTs must be JSON too). */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "same-origin";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Client-safe views: dealer-only fields never reach the browser        */
/* ------------------------------------------------------------------ */

type Obj = Record<string, unknown>;

export function clientAccount(a: unknown): Obj | null {
  if (!a || typeof a !== "object") return null;
  const { route: _route, controls, userId: _userId, version: _version, ...rest } = a as Obj;
  const c = (controls ?? {}) as Obj;
  return { ...rest, controls: { tradingDisabled: !!c.tradingDisabled, closeOnly: !!c.closeOnly, maxLot: c.maxLot ?? null } };
}

export function clientPosition(p: unknown): Obj {
  const { book: _book, parentTicket: _p, childTickets: _c, priceCorrected, ...rest } = (p ?? {}) as Obj;
  return { ...rest, priceCorrected: !!priceCorrected };
}

export function clientOrder(o: unknown): Obj {
  const { book: _book, ...rest } = (o ?? {}) as Obj;
  return rest;
}

export function clientDeal(d: unknown): Obj {
  const { book: _book, ledgerTxn: _l, ...rest } = (d ?? {}) as Obj;
  return rest;
}
