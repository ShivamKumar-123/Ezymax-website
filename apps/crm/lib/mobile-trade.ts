// Server-only: trading-engine and options-service access for the mobile app (/api/mobile/trade/*,
// docs/MOBILE-API.md).
//
// The app obtains engine access like Kalks Trader on the web:
// - `POST trade/sessions {login}`: the Client Area mints a one-time SSO token for the client's OWN account (engine
//   Client Area API, X-Kalks-User-Id from the gateway session) and redeems it at once for a terminal session
//   (POST /v1/terminal/sso) — the Trade button's flow, without the browser hop;
// - `POST trade/login {login, password, server?}`: MT5-style login with a trading or investor password (any account,
//   as on the web terminal; investor = read-only).
//
// The engine's terminal session token is handed to the app wrapped in a trade token bound to the signed-in client:
// `kt1.<kind>.<engine token>.<HMAC(client id, kind, engine token)>`. The app keeps it in the Keystore (the web
// terminal keeps the bare engine token in an HttpOnly cookie) and sends it back in `X-Kalks-Trade` with every trade
// call, next to its gateway session (`Authorization: Bearer`). Every call checks:
// 1. the gateway session is alive (sign-out, block or expiry on the gateway stops trading at once);
// 2. the trade token was issued to THIS client (HMAC), so a leaked trade token is useless with another client's
//    session; an SSO session must also still belong to the client in the engine's own view (owner check);
// 3. the engine still knows the session (its state; cached 60 s per token).
// The engine token alone is useless outside this BFF: the engine only answers requests that also carry the internal
// token, which never leaves the server.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/gateway";
import { Memo } from "@/lib/memo";

const TRADING_URL = (process.env.TRADING_URL ?? "http://127.0.0.1:8090").replace(/\/+$/, "");
const TRADING_TOKEN = process.env.TRADING_INTERNAL_TOKEN ?? "";
const OPTIONS_URL = (process.env.OPTIONS_URL ?? "http://127.0.0.1:8104").replace(/\/+$/, "");
const OPTIONS_TOKEN = process.env.OPTIONS_INTERNAL_TOKEN ?? "";

export type Obj = Record<string, unknown>;
export type Result<T = Obj> = { status: number; data: T };
type Method = "GET" | "POST" | "PATCH" | "DELETE";

export const LOGIN_RE = /^\d{8}$/;
/** Engine terminal session tokens (base64url). */
const ENGINE_TOKEN_RE = /^[A-Za-z0-9_-]{16,256}$/;

/** One call to the engine: `bearer` = terminal session; `userId` = Client Area API (X-Kalks-User-Id). */
export async function engineCall<T = Obj>(path: string, init: { method?: Method; body?: unknown; bearer?: string; userId?: number; tenant?: string; req: NextRequest }): Promise<Result<T>> {
  const headers: Record<string, string> = { "x-kalks-internal": TRADING_TOKEN, "x-kalks-tenant": init.tenant || "kalks", "x-forwarded-for": clientIp(init.req.headers) };
  if (init.bearer) headers.authorization = `Bearer ${init.bearer}`;
  if (init.userId !== undefined) headers["x-kalks-user-id"] = String(init.userId);
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

/** One call to the options service with the broker and the acting account's kind (live/demo). */
export async function optionsCall<T = Obj>(path: string, init: { method?: "GET" | "POST"; body?: unknown; tenant: string; kind?: "live" | "demo" | null; internal?: boolean; timeoutMs?: number }): Promise<Result<T>> {
  const headers: Record<string, string> = { "x-kalks-tenant": init.tenant };
  if (init.internal !== false) headers["x-kalks-internal"] = OPTIONS_TOKEN;
  if (init.kind) headers["x-kalks-account-kind"] = init.kind;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${OPTIONS_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 8_000),
    });
    const text = await res.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: { code: res.status === 404 ? "not_found" : "options_error", message: text.slice(0, 200) || `Options service error ${res.status}` } };
    }
    if (res.status === 404 && !(data as { error?: unknown }).error) data = { error: { code: "not_found", message: "Not found." } };
    return { status: res.status, data: data as T };
  } catch {
    return { status: 503, data: { error: { code: "unavailable", message: "Options prices are unavailable right now. Please try again shortly." } } as T };
  }
}

/** Dealing details never reach the app (book, routing, ledger ids, owner, dealer controls). */
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

/* ---- group -> spread group (the quotes an account trades at: market-data stream `?group=`) ---- */

const spreadGroups = new Memo<Record<string, string> | null>(60_000, 4);
async function spreadMap(req: NextRequest): Promise<Record<string, string>> {
  const m = await spreadGroups.get(
    "groups",
    async () => {
      const r = await engineCall<{ groups?: { code: string; spreadGroup?: string }[] }>("/v1/groups", { req });
      if (r.status !== 200) return null;
      const map: Record<string, string> = {};
      for (const g of r.data.groups ?? []) map[g.code] = g.spreadGroup || g.code;
      return map;
    },
    (v) => v !== null,
  );
  return m ?? {};
}

/** The engine's account view for the app: dealer fields removed, the spread group added. */
export async function clientAccount(req: NextRequest, a: unknown): Promise<Obj | null> {
  if (!a || typeof a !== "object") return null;
  const out = scrub(a) as Obj;
  const group = String((a as Obj).group ?? "");
  out.spreadGroup = (await spreadMap(req))[group] ?? group;
  return out;
}

/* ---- trade tokens: an engine session bound to the gateway client it was issued to ---- */

/** s = SSO session of the client's own account; p = password login (MT5-style, any account). */
export type TradeKind = "s" | "p";
const TRADE_TOKEN_RE = /^kt1\.([sp])\.([A-Za-z0-9_-]{16,256})\.([A-Za-z0-9_-]{43})$/;

/** The binding key: MOBILE_TRADE_SECRET, else derived from the server-only internal tokens (never sent anywhere). */
function bindingKey(): Buffer {
  const own = process.env.MOBILE_TRADE_SECRET;
  return createHash("sha256")
    .update(own ? `own|${own}` : `kalks-mobile-trade|${TRADING_TOKEN}|${process.env.GATEWAY_INTERNAL_TOKEN ?? ""}`)
    .digest();
}

const sign = (userId: number, kind: TradeKind, engine: string) => createHmac("sha256", bindingKey()).update(`kt1|${userId}|${kind}|${engine}`).digest("base64url");

/** The trade token handed to the app for an engine session opened by `userId`. */
export function wrapTradeToken(userId: number, kind: TradeKind, engine: string): string {
  return `kt1.${kind}.${engine}.${sign(userId, kind, engine)}`;
}

/** The engine session of a trade token, when it was issued to `userId`; "malformed" / "foreign" otherwise. */
export function unwrapTradeToken(userId: number, token: string): { kind: TradeKind; engine: string } | "malformed" | "foreign" {
  const m = TRADE_TOKEN_RE.exec(token);
  if (!m) return "malformed";
  const kind = m[1] as TradeKind;
  const engine = m[2]!;
  if (!ENGINE_TOKEN_RE.test(engine)) return "malformed";
  const want = Buffer.from(sign(userId, kind, engine));
  const got = Buffer.from(m[3]!);
  return want.length === got.length && timingSafeEqual(want, got) ? { kind, engine } : "foreign";
}

export const isEngineToken = (t: unknown): t is string => typeof t === "string" && ENGINE_TOKEN_RE.test(t);

/* ---- what the engine says about a terminal session (cached 60 s per token) ---- */

export type SessionInfo = { status: number; login: string; ownerId: number | null; readOnly: boolean; kind: "live" | "demo"; group: string };
const SESSION_TTL_MS = 60_000;
const sessions = new Memo<SessionInfo>(SESSION_TTL_MS, 5_000);
const keyOf = (engine: string) => createHash("sha256").update(`trade:${engine}`).digest("base64url");

export async function sessionInfo(req: NextRequest, engine: string): Promise<SessionInfo> {
  return sessions.get(
    keyOf(engine),
    async () => {
      const r = await engineCall<{ account?: { userId?: number; login?: number; type?: string; group?: string }; readOnly?: boolean }>("/v1/terminal/state?historyLimit=0", { bearer: engine, req });
      const a = r.data?.account;
      if (r.status !== 200 || !a) return { status: r.status === 200 ? 401 : r.status, login: "", ownerId: null, readOnly: true, kind: "live", group: "" };
      const owner = Number(a.userId);
      return { status: 200, login: String(a.login ?? ""), ownerId: Number.isSafeInteger(owner) && owner > 0 ? owner : null, readOnly: !!r.data.readOnly, kind: a.type === "demo" ? "demo" : "live", group: String(a.group ?? "") };
    },
    (v) => v.status === 200,
  );
}

/** Seeds the cache with a session just opened (the engine already answered for it). */
export function rememberSession(engine: string, info: Omit<SessionInfo, "status">) {
  void sessions.get(keyOf(engine), async () => ({ status: 200, ...info }));
}

export function forgetTradeSession(engine: string) {
  sessions.delete(keyOf(engine));
}

/* ---- contract specs (public product information, the same for every account of the broker) ---- */

const symbolsCache = new Memo<Result>(60_000, 20);
export function engineSymbols(req: NextRequest, query: string): Promise<Result> {
  return symbolsCache.get(query, () => engineCall(`/v1/symbols${query}`, { req }), (r) => r.status === 200);
}
