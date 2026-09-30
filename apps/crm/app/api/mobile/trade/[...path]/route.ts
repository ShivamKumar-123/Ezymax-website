import { NextResponse, type NextRequest } from "next/server";
import { fetchMe, type GatewayUser } from "@/lib/gateway";
import { bearerOf, platformOf } from "@/lib/mobile";
import { LOGIN_RE, TRADE_TOKEN_RE, engineCall, engineStreamUrl, forgetTradeSession, requestOrigin, scrub, sessionOwner, spreadGroupOf, type Obj } from "@/lib/mobile-trade";

// Mobile trading BFF (apps/mobile). App -> /api/mobile/trade/<route> -> trading engine, see lib/mobile-trade.ts.
//
//   POST   session {login}                   SSO for the client's own account -> {token, expiresAt, readOnly, account}
//   ---- the calls below need Authorization: Bearer <gateway session> AND X-Kalks-Trade: <terminal session> ----
//   GET    state?historyLimit=                account, positions, orders, recent deals
//   GET    history?from&to&page&limit         closed deals + done pending orders
//   GET    symbols                            contract specs (digits, pip size, contract size, lots, margin %)
//   POST   orders                             market / pending order (terminal order body)
//   PATCH  orders/{ticket}                    {price?, stopLimit?, volume?, sl?, tp?, expiry?, expiryAt?}
//   DELETE orders/{ticket}
//   POST   positions/{ticket}/close           {volume?}  (no volume = full close)
//   POST   positions/close-by                 {ticket, by}  Close By (hedging): the overlapping volume of two opposite
//                                            positions on one symbol, closed at the open price of `by`
//   PATCH  positions/{ticket}                 {sl?, tp?, trailingPoints?}  (null clears)
//   POST   stream-ticket                      {ticket, expiresIn, url}: one-time WebSocket ticket (30 s)
//   POST   logout                             ends the terminal session
//
// View-only logins can't trade (the proxy refuses their writes; reads need a terminal session they can't get).
// Rejections keep the engine's status and code (market_closed, no_money, invalid_sl…) for the app to explain.

type Ctx = { params: Promise<{ path: string[] }> };

const NO_STORE = { "cache-control": "no-store" };
const TICKET_RE = /^\d{1,12}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;
const SYMBOL_RE = /^[A-Z0-9._]{2,20}$/;

function reply(status: number, data: unknown) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}
function error(status: number, code: string, message: string) {
  return reply(status, { error: { code, message } });
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
const numOrNull = (v: unknown) => (v === null ? null : num(v));

function pick(src: Obj, spec: Record<string, "num" | "numOrNull" | "str" | "int">): Obj | string {
  const out: Obj = {};
  for (const [k, kind] of Object.entries(spec)) {
    if (!(k in src) || src[k] === undefined) continue;
    const v = src[k];
    if (kind === "str") {
      if (typeof v !== "string" || v.length > 64) return k;
      out[k] = v;
    } else if (kind === "numOrNull") {
      const n = numOrNull(v);
      if (n === undefined) return k;
      out[k] = n;
    } else {
      const n = num(v);
      if (n === undefined || (kind === "int" && !Number.isInteger(n))) return k;
      out[k] = n;
    }
  }
  return out;
}

function orderBody(b: Obj, req: NextRequest): Obj | NextResponse {
  const o = pick(b, { symbol: "str", side: "str", type: "str", volume: "num", price: "num", stopLimit: "num", sl: "num", tp: "num", trailingPoints: "int", expiry: "str", expiryAt: "str", requestedPrice: "num", deviationPoints: "int", comment: "str", clientOrderId: "str" });
  if (typeof o === "string") return error(422, "validation", `Invalid ${o}.`);
  if (!SYMBOL_RE.test(String(o.symbol ?? ""))) return error(422, "validation", "Invalid symbol.");
  if (o.side !== "buy" && o.side !== "sell") return error(422, "validation", "Invalid side.");
  if (!["market", "limit", "stop", "stop_limit"].includes(String(o.type))) return error(422, "validation", "Invalid order type.");
  // the app's own orders are always manual, recorded with the phone's platform
  o.source = "manual";
  o.platform = platformOf(req.headers);
  if (typeof o.comment === "string") o.comment = o.comment.slice(0, 31);
  return o;
}

function pageQuery(req: NextRequest): string | NextResponse {
  const sp = req.nextUrl.searchParams;
  const out = new URLSearchParams();
  for (const k of ["from", "to"] as const) {
    const v = sp.get(k);
    if (!v) continue;
    if (!DATE_RE.test(v)) return error(400, "bad_request", `Invalid ${k} date.`);
    out.set(k, v);
  }
  for (const [k, max] of [["page", 100000], ["limit", 500]] as const) {
    const v = sp.get(k);
    if (!v) continue;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > max) return error(400, "bad_request", `Invalid ${k}.`);
    out.set(k, String(n));
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

/** The signed-in client (gateway session). View-only sessions never trade. */
async function client(req: NextRequest, write: boolean): Promise<GatewayUser | NextResponse> {
  const token = bearerOf(req.headers);
  if (!token) return error(401, "unauthorized", "Please sign in.");
  const user = await fetchMe(token, req.headers);
  if (user === "unavailable") return error(503, "unavailable", "Sign-in service is unavailable. Please try again shortly.");
  if (!user) return error(401, "unauthorized", "Please sign in.");
  if (user.viewer && write) return error(403, "viewer_read_only", "This is a view-only login. Viewers can't make changes.");
  return user;
}

/** The terminal session sent by the app, checked against the signed-in client. */
async function tradeSession(req: NextRequest, user: GatewayUser): Promise<{ token: string; login: string } | NextResponse> {
  const token = req.headers.get("x-kalks-trade")?.trim() ?? "";
  if (!TRADE_TOKEN_RE.test(token)) return error(401, "session_expired", "Your trading session has expired. Open the account again.");
  const owner = await sessionOwner(req, token);
  if (owner.status === 401 || owner.status === 404) return error(401, "session_expired", "Your trading session has expired. Open the account again.");
  if (owner.status !== 200) return error(owner.status, "unavailable", "The trade server is unavailable. Please try again shortly.");
  if (owner.userId !== user.id || !owner.login) return error(403, "forbidden", "This trading session belongs to another client.");
  return { token, login: owner.login };
}

async function handle(req: NextRequest, { params }: Ctx, method: "GET" | "POST" | "PATCH" | "DELETE") {
  const path = (await params).path;
  const [a, b, c] = path;
  const write = method !== "GET";
  let body: Obj = {};
  if (method === "POST" || method === "PATCH") {
    if (!req.headers.get("content-type")?.includes("application/json")) return error(415, "bad_request", "Expected JSON.");
    const parsed = await req.json().catch(() => null);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return error(400, "bad_request", "Invalid request body.");
    body = parsed as Obj;
  }
  const user = await client(req, write || a === "session");
  if (user instanceof NextResponse) return user;

  // ---- engine access for one of the client's own accounts (same SSO as the Client Area's Trade button)
  if (a === "session" && path.length === 1 && method === "POST") {
    const login = String(body.login ?? "");
    if (!LOGIN_RE.test(login)) return error(422, "validation", "Choose a trading account.");
    const sso = await engineCall<{ token?: string }>(`/v1/accounts/${login}/sso`, { method: "POST", user, req });
    if (sso.status !== 200 || !sso.data.token) return reply(sso.status === 200 ? 502 : sso.status, scrub(sso.data));
    const r = await engineCall<{ token?: string; expiresAt?: string; readOnly?: boolean; account?: Obj }>("/v1/terminal/sso", { body: { token: sso.data.token }, req });
    if (r.status !== 200 || !r.data.token || !r.data.account) return reply(r.status === 200 ? 502 : r.status, scrub(r.data));
    const account = scrub(r.data.account) as Obj;
    account.spreadGroup = await spreadGroupOf(req, String(account.group ?? ""));
    return reply(200, { token: r.data.token, expiresAt: r.data.expiresAt, readOnly: !!r.data.readOnly, login, account });
  }

  // ---- contract specs (engine Client Area API; the same for every account of the broker)
  if (a === "symbols" && path.length === 1 && method === "GET") {
    const r = await engineCall<{ symbols?: Obj[] }>("/v1/symbols", { user, req });
    return reply(r.status, r.status === 200 ? { symbols: r.data.symbols ?? [] } : scrub(r.data));
  }

  const s = await tradeSession(req, user);
  if (s instanceof NextResponse) return s;
  const forward = async (p: string, init: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {}) => {
    const r = await engineCall<Obj>(p, { ...init, bearer: s.token, req });
    if (r.status === 401) {
      forgetTradeSession(s.token);
      return error(401, "session_expired", "Your trading session has expired. Open the account again.");
    }
    return reply(r.status, scrub(r.data));
  };

  if (method === "GET" && a === "state" && path.length === 1) {
    const n = Number(req.nextUrl.searchParams.get("historyLimit") ?? 50);
    const limit = Number.isInteger(n) && n >= 0 && n <= 500 ? n : 50;
    const r = await engineCall<Obj>(`/v1/terminal/state?historyLimit=${limit}`, { bearer: s.token, req });
    if (r.status === 401) return error(401, "session_expired", "Your trading session has expired. Open the account again.");
    if (r.status !== 200) return reply(r.status, scrub(r.data));
    const out = scrub(r.data) as Obj;
    const account = out.account as Obj | undefined;
    if (account) account.spreadGroup = await spreadGroupOf(req, String(account.group ?? ""));
    return reply(200, out);
  }
  if (method === "GET" && a === "history" && path.length === 1) {
    const q = pageQuery(req);
    if (typeof q !== "string") return q;
    return forward(`/v1/terminal/history${q}`);
  }
  if (a === "orders" && path.length === 1 && method === "POST") {
    const o = orderBody(body, req);
    if (o instanceof NextResponse) return o;
    return forward("/v1/terminal/orders", { method: "POST", body: o });
  }
  if (a === "orders" && path.length === 2 && TICKET_RE.test(b ?? "")) {
    if (method === "DELETE") return forward(`/v1/terminal/orders/${b}`, { method: "DELETE" });
    if (method === "PATCH") {
      const o = pick(body, { price: "num", stopLimit: "num", volume: "num", sl: "numOrNull", tp: "numOrNull", trailingPoints: "numOrNull", expiry: "str", expiryAt: "str" });
      if (typeof o === "string") return error(422, "validation", `Invalid ${o}.`);
      return forward(`/v1/terminal/orders/${b}`, { method: "PATCH", body: o });
    }
  }
  if (a === "positions" && b === "close-by" && path.length === 2 && method === "POST") {
    const o = pick(body, { ticket: "int", by: "int" });
    const ticket = typeof o === "string" ? undefined : o.ticket;
    const by = typeof o === "string" ? undefined : o.by;
    const valid = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n > 0 && TICKET_RE.test(String(n));
    if (!valid(ticket) || !valid(by) || ticket === by) return error(422, "validation", "Choose two opposite positions.");
    // the engine checks the rest: a hedging account, two open positions of this account, opposite sides, one symbol
    return forward("/v1/terminal/positions/close-by", { method: "POST", body: { ticket, by } });
  }
  if (a === "positions" && TICKET_RE.test(b ?? "")) {
    if (path.length === 3 && c === "close" && method === "POST") {
      const o = pick(body, { volume: "num", deviationPoints: "int", requestedPrice: "num" });
      if (typeof o === "string") return error(422, "validation", `Invalid ${o}.`);
      return forward(`/v1/terminal/positions/${b}/close`, { method: "POST", body: o });
    }
    if (path.length === 2 && method === "PATCH") {
      const o = pick(body, { sl: "numOrNull", tp: "numOrNull", trailingPoints: "numOrNull" });
      if (typeof o === "string") return error(422, "validation", `Invalid ${o}.`);
      return forward(`/v1/terminal/positions/${b}`, { method: "PATCH", body: o });
    }
  }
  if (a === "stream-ticket" && path.length === 1 && method === "POST") {
    const r = await engineCall<{ ticket?: string; expiresIn?: number }>("/v1/terminal/stream-ticket", { method: "POST", bearer: s.token, req });
    if (r.status === 401) return error(401, "session_expired", "Your trading session has expired. Open the account again.");
    if (r.status !== 200 || !r.data.ticket) return reply(r.status === 200 ? 502 : r.status, scrub(r.data));
    return reply(200, { ticket: r.data.ticket, expiresIn: r.data.expiresIn, url: engineStreamUrl(requestOrigin(req)) });
  }
  if (a === "logout" && path.length === 1 && method === "POST") {
    const r = await engineCall<Obj>("/v1/terminal/logout", { method: "POST", bearer: s.token, req });
    forgetTradeSession(s.token);
    return reply(r.status === 401 ? 200 : r.status, r.status === 401 ? { status: "ok" } : scrub(r.data));
  }
  return error(404, "not_found", "Not found.");
}

export const dynamic = "force-dynamic";
export const GET = (req: NextRequest, ctx: Ctx) => handle(req, ctx, "GET");
export const POST = (req: NextRequest, ctx: Ctx) => handle(req, ctx, "POST");
export const PATCH = (req: NextRequest, ctx: Ctx) => handle(req, ctx, "PATCH");
export const DELETE = (req: NextRequest, ctx: Ctx) => handle(req, ctx, "DELETE");
