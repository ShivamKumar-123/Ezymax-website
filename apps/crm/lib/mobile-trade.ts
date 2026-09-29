// Server-only: trading-engine access for the mobile app (/api/mobile/trade/*).
//
// The app obtains engine access exactly like Kalks Trader: the Client Area mints a one-time SSO token for the
// client's own account (engine Client Area API, X-Kalks-User-Id from the gateway session) and redeems it at once
// for a terminal session (POST /v1/terminal/sso). The terminal session token is handed to the app, which keeps it
// in the phone's secure store (the web terminal keeps the same token in an HttpOnly cookie) and sends it back in
// `X-Kalks-Trade` with every trade call. It is useless without this BFF: the engine only answers requests that
// also carry the internal token, which never leaves the server.
//
// Every trade call must ALSO carry a live gateway session (Authorization: Bearer) of the account's owner: the
// engine session's owner is checked against the signed-in client (cached briefly), so a leaked trade token can't
// be used with another client's session, and a sign-out or block on the gateway stops trading at once.

import type { NextRequest } from "next/server";
import { clientIp, type GatewayUser } from "@/lib/gateway";
import { createHash } from "node:crypto";
import { TERMINAL_BASE } from "@/lib/trading";
import { isLoopbackHost, toWs } from "@/lib/mobile";

const TRADING_URL = (process.env.TRADING_URL ?? "http://127.0.0.1:8090").replace(/\/+$/, "");
const TRADING_TOKEN = process.env.TRADING_INTERNAL_TOKEN ?? "";

export type Obj = Record<string, unknown>;
export type EngineResult<T = Obj> = { status: number; data: T };

/** Engine terminal session tokens (opaque, URL-safe). */
export const TRADE_TOKEN_RE = /^[A-Za-z0-9_.~-]{16,256}$/;
export const LOGIN_RE = /^\d{8}$/;

/** One call to the engine: `bearer` = terminal session; `user` = Client Area API (X-Kalks-User-Id). */
export async function engineCall<T = Obj>(
  path: string,
  init: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; bearer?: string; user?: GatewayUser; req: NextRequest },
): Promise<EngineResult<T>> {
  const headers: Record<string, string> = { "x-kalks-internal": TRADING_TOKEN, "x-kalks-tenant": init.user?.tenant?.slug || "kalks", "x-forwarded-for": clientIp(init.req.headers) };
  if (init.bearer) headers.authorization = `Bearer ${init.bearer}`;
  if (init.user) headers["x-kalks-user-id"] = String(init.user.id);
  const ua = init.req.headers.get("user-agent");
  if (ua) headers["user-agent"] = ua.slice(0, 400);
  const method = init.method ?? (init.body !== undefined ? "POST" : "GET");
  // axum rejects `content-type: application/json` with an empty body, so writes always carry a JSON body
  const body = init.body !== undefined ? init.body : method === "GET" || method === "DELETE" ? undefined : {};
  if (body !== undefined) headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${TRADING_URL}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, cache: "no-store" });
    const text = await res.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: { code: res.status === 400 ? "bad_request" : "engine_error", message: text.slice(0, 200) || `Trade server error ${res.status}` } };
    }
    return { status: res.status, data: data as T };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "The trade server is unavailable. Please try again shortly." } } as T };
  }
}

/** Dealing details never reach the app (book, routing, ledger ids, dealer controls). */
const HIDDEN = new Set(["book", "route", "userId", "ledgerTxn", "parentTicket", "childTickets", "priceCorrected", "version", "tenantId"]);
export function scrub(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(scrub);
  if (!v || typeof v !== "object") return v;
  const out: Obj = {};
  for (const [k, x] of Object.entries(v as Obj)) {
    if (HIDDEN.has(k)) continue;
    if (k === "controls" && x && typeof x === "object") {
      const c = x as Obj;
      out[k] = { tradingDisabled: !!c.tradingDisabled, closeOnly: !!c.closeOnly, maxLot: c.maxLot ?? null };
    } else out[k] = scrub(x);
  }
  return out;
}

/* ---- small TTL caches (per Next process) ---- */

type Owner = { status: number; userId: number | null; login: string | null };
const OWNER_TTL_MS = 60_000;
const owners = new Map<string, { at: number; v: Owner }>();
const hashOf = (token: string) => createHash("sha256").update(`trade:${token}`).digest("base64url");

/** The client and login a terminal session belongs to, from the engine's own view of it (cached 60 s). */
export async function sessionOwner(req: NextRequest, token: string): Promise<Owner> {
  const key = hashOf(token);
  const hit = owners.get(key);
  if (hit && Date.now() - hit.at < OWNER_TTL_MS) return hit.v;
  const r = await engineCall<{ account?: { userId?: number; login?: number } }>("/v1/terminal/state?historyLimit=0", { bearer: token, req });
  const v: Owner =
    r.status === 200 && r.data.account
      ? { status: 200, userId: Number(r.data.account.userId ?? NaN) || null, login: r.data.account.login !== undefined ? String(r.data.account.login) : null }
      : { status: r.status === 200 ? 401 : r.status, userId: null, login: null };
  if (v.status === 200) {
    if (owners.size > 5_000) owners.clear();
    owners.set(key, { at: Date.now(), v });
  } else owners.delete(key);
  return v;
}

export function forgetTradeSession(token: string) {
  owners.delete(hashOf(token));
}

/* ---- group -> spread group (the quotes an account trades at) ---- */

let spread: { at: number; map: Record<string, string> } | null = null;
export async function spreadGroupOf(req: NextRequest, group: string): Promise<string> {
  if (!spread || Date.now() - spread.at > 60_000) {
    const r = await engineCall<{ groups?: { code: string; spreadGroup?: string }[] }>("/v1/groups", { req });
    if (r.status === 200) {
      const map: Record<string, string> = {};
      for (const g of r.data.groups ?? []) map[g.code] = g.spreadGroup || g.code;
      spread = { at: Date.now(), map };
    }
  }
  return spread?.map[group] ?? group;
}

/* ---- where the app opens the account stream ---- */

/** Trading-engine account stream for the app: trade.<domain>/engine/stream in production (Caddy); locally the
 *  engine port from this Mac, or the dev relay's /engine/stream from a phone on the LAN. */
export function engineStreamUrl(origin: URL): string {
  if (process.env.MOBILE_ENGINE_STREAM_URL) return process.env.MOBILE_ENGINE_STREAM_URL;
  const terminal = new URL(TERMINAL_BASE);
  if (!isLoopbackHost(terminal.host)) return `${toWs(terminal.origin)}/engine/stream`;
  return isLoopbackHost(origin.host) ? `${toWs(TRADING_URL)}/v1/terminal/stream` : `${toWs(origin.origin)}/engine/stream`;
}

/** The origin the app used to reach this BFF (Caddy / the dev relay forward the public host). */
export function requestOrigin(req: NextRequest): URL {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host).split(",")[0]!.trim();
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return new URL(`${proto === "https" ? "https" : "http"}://${host}`);
}
