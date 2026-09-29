import type { NextRequest, NextResponse } from "next/server";
import { clientAccount, csrf, engine, error, readSessions, reply, sessionFor, soft, streamUrl, writeSessions, type EngineSession, type Obj } from "@/lib/engine/server";

// Kalks Trader trading BFF. Browser -> /api/engine/<route> (same origin, `X-Kalks-Login: <login>` picks which
// of this browser's sessions acts) -> engine /v1/terminal/<route> with that session's bearer token + the
// internal token. Neither token reaches the browser. CSRF: the cookie is SameSite=Lax and every write must
// be a same-origin JSON request. Investor sessions are read-only in the engine (403 read_only).
//
//   GET    state?historyLimit=              account, positions, orders, recent deals
//   GET    history?from&to&page&limit       closed deals + done pending orders
//   POST   orders                           market / pending order (fields below)
//   PATCH  orders/{ticket}                  {price?, stopLimit?, volume?, sl?, tp?, trailingPoints?, expiry?, expiryAt?}
//   DELETE orders/{ticket}
//   POST   positions/{ticket}/close         {volume?, deviationPoints?, requestedPrice?}
//   PATCH  positions/{ticket}               {sl?, tp?, trailingPoints?}  (null clears)
//   POST   positions/close-by               {ticket, by}
//   POST   bulk-close                       {filter: all|profitable|losing|pending|buys|sells, symbol?}
//   POST   stream-ticket                    {ticket, expiresIn, url}: one-time WebSocket ticket (30 s)
//   POST   demo-refill                      demo accounts: top the balance back up (Client Area API, owner resolved here)
//   GET    mam?symbol&volume                MAM role of the account + allocation summary (manager) / managing programme (client)

type Ctx = { params: Promise<{ path: string[] }> };

const TICKET_RE = /^\d{1,12}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;
const SYMBOL_RE = /^[A-Z0-9._]{2,20}$/;

/** Dealing details never reach the browser (book, routing, ledger ids, dealer controls). */
const HIDDEN = new Set(["book", "route", "userId", "ledgerTxn", "parentTicket", "childTickets", "priceCorrected", "version", "tenantId"]);
function scrub(v: unknown): unknown {
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

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
/** number, or null (explicit clear), or undefined (not sent) */
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

function orderBody(b: Obj): Obj | NextResponse {
  const o = pick(b, { symbol: "str", side: "str", type: "str", volume: "num", price: "num", stopLimit: "num", sl: "num", tp: "num", trailingPoints: "int", expiry: "str", expiryAt: "str", requestedPrice: "num", deviationPoints: "int", ocoWith: "int", comment: "str", clientOrderId: "str", source: "str" });
  if (typeof o === "string") return error(422, "validation", `Invalid ${o}.`);
  if (!SYMBOL_RE.test(String(o.symbol ?? ""))) return error(422, "validation", "Invalid symbol.");
  if (o.side !== "buy" && o.side !== "sell") return error(422, "validation", "Invalid side.");
  if (!["market", "limit", "stop", "stop_limit"].includes(String(o.type))) return error(422, "validation", "Invalid order type.");
  // a browser may tag its own orders as manual or AI Trader only (never api / copy / dealer …)
  o.source = o.source === "ai" ? "ai" : "manual";
  o.platform = "Web";
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

/** Resolve the acting session; a session the engine no longer knows is dropped from the cookie. */
async function forward(req: NextRequest, s: EngineSession, path: string, init: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {}): Promise<{ status: number; data: Obj; expired?: NextResponse }> {
  const r = await engine<Obj>(path, { ...init, bearer: s.t, req });
  if (r.status === 401) {
    const res = reply(401, { error: { code: "session_expired", message: "Your trading session has expired. Log in again." } });
    return { ...r, expired: writeSessions(req, res, readSessions(req).filter((x) => x.l !== s.l)) };
  }
  return r;
}

async function handle(req: NextRequest, { params }: Ctx, method: "GET" | "POST" | "PATCH" | "DELETE") {
  const path = (await params).path;
  if (method !== "GET") {
    const blocked = csrf(req, method !== "DELETE");
    if (blocked) return blocked;
  }
  const s = sessionFor(req);
  if (!s) return error(401, "unauthorized", "Log in to your trading account.");
  const [a, b, c] = path;
  const body = method === "POST" || method === "PATCH" ? (((await req.json().catch(() => null)) ?? {}) as Obj) : {};
  if (typeof body !== "object" || Array.isArray(body)) return error(400, "bad_request", "Invalid request body.");

  const done = async (r: { status: number; data: Obj; expired?: NextResponse }, map?: (d: Obj) => Promise<Obj> | Obj) => {
    if (r.expired) return r.expired;
    return reply(r.status, r.status < 300 && map ? await map(r.data) : scrub(r.data));
  };

  // ---- reads
  if (method === "GET" && a === "state" && path.length === 1) {
    const n = Number(req.nextUrl.searchParams.get("historyLimit") ?? 100);
    const limit = Number.isInteger(n) && n >= 0 && n <= 500 ? n : 100;
    return done(await forward(req, s, `/v1/terminal/state?historyLimit=${limit}`), async (d) => ({ ...(scrub(d) as Obj), account: await clientAccount(d.account) }));
  }
  if (method === "GET" && a === "mam" && path.length === 1) {
    const sp = req.nextUrl.searchParams;
    const symbol = sp.get("symbol");
    const volume = sp.get("volume") ?? "1";
    if (symbol !== null && !SYMBOL_RE.test(symbol)) return error(400, "bad_request", "Invalid symbol.");
    if (!/^\d{1,4}(\.\d{1,2})?$/.test(volume) || Number(volume) <= 0) return error(400, "bad_request", "Invalid volume.");
    return done(await forward(req, s, `/v1/terminal/mam${symbol ? `?symbol=${symbol}&volume=${volume}` : ""}`));
  }
  if (method === "GET" && a === "history" && path.length === 1) {
    const q = pageQuery(req);
    if (typeof q !== "string") return q;
    return done(await forward(req, s, `/v1/terminal/history${q}`));
  }

  // ---- writes
  if (a === "orders" && path.length === 1 && method === "POST") {
    const o = orderBody(body);
    if (o instanceof Response) return o;
    return done(await forward(req, s, "/v1/terminal/orders", { method: "POST", body: o }));
  }
  if (a === "orders" && path.length === 2 && TICKET_RE.test(b ?? "")) {
    if (method === "DELETE") return done(await forward(req, s, `/v1/terminal/orders/${b}`, { method: "DELETE" }));
    if (method === "PATCH") {
      const o = pick(body, { price: "num", stopLimit: "num", volume: "num", sl: "numOrNull", tp: "numOrNull", trailingPoints: "numOrNull", expiry: "str", expiryAt: "str" });
      if (typeof o === "string") return error(422, "validation", `Invalid ${o}.`);
      return done(await forward(req, s, `/v1/terminal/orders/${b}`, { method: "PATCH", body: o }));
    }
  }
  if (a === "positions" && path.length === 2 && b === "close-by" && method === "POST") {
    const o = pick(body, { ticket: "int", by: "int" });
    if (typeof o === "string" || o.ticket === undefined || o.by === undefined) return error(422, "validation", "Choose two positions.");
    return done(await forward(req, s, "/v1/terminal/positions/close-by", { method: "POST", body: o }));
  }
  if (a === "positions" && TICKET_RE.test(b ?? "")) {
    if (path.length === 3 && c === "close" && method === "POST") {
      const o = pick(body, { volume: "num", deviationPoints: "int", requestedPrice: "num" });
      if (typeof o === "string") return error(422, "validation", `Invalid ${o}.`);
      return done(await forward(req, s, `/v1/terminal/positions/${b}/close`, { method: "POST", body: o }));
    }
    if (path.length === 2 && method === "PATCH") {
      const o = pick(body, { sl: "numOrNull", tp: "numOrNull", trailingPoints: "numOrNull" });
      if (typeof o === "string") return error(422, "validation", `Invalid ${o}.`);
      return done(await forward(req, s, `/v1/terminal/positions/${b}`, { method: "PATCH", body: o }));
    }
  }
  if (a === "bulk-close" && path.length === 1 && method === "POST") {
    const filter = String(body.filter ?? "");
    if (!["all", "profitable", "losing", "pending", "buys", "sells"].includes(filter)) return error(422, "validation", "Invalid filter.");
    const symbol = body.symbol === undefined ? undefined : String(body.symbol);
    if (symbol !== undefined && !SYMBOL_RE.test(symbol)) return error(422, "validation", "Invalid symbol.");
    return done(await forward(req, s, "/v1/terminal/bulk-close", { method: "POST", body: { filter, ...(symbol ? { symbol } : {}) } }));
  }
  if (a === "stream-ticket" && path.length === 1 && method === "POST") {
    return done(await forward(req, s, "/v1/terminal/stream-ticket", { method: "POST" }), (d) => ({ ticket: d.ticket, expiresIn: d.expiresIn, url: streamUrl(req) }));
  }
  if (a === "demo-refill" && path.length === 1 && method === "POST") {
    if (s.r) return error(403, "read_only", "Investor (read-only) sessions can't refill the balance.");
    // the owner comes from the engine's own view of this session, never from the browser
    const st = await forward(req, s, "/v1/terminal/state?historyLimit=0");
    if (st.expired) return st.expired;
    if (st.status !== 200) return reply(st.status, scrub(st.data));
    if (st.data.readOnly) return error(403, "read_only", "Investor (read-only) sessions can't refill the balance.");
    const acc = (st.data.account ?? {}) as Obj;
    const r = await engine<Obj>(`/v1/accounts/${s.l}/demo-refill`, { method: "POST", req, headers: { "x-kalks-user-id": String(acc.userId ?? "") } });
    return reply(r.status, scrub(r.data));
  }
  return error(404, "not_found", "Not found.");
}

export const dynamic = "force-dynamic";
export const GET = async (req: NextRequest, ctx: Ctx) => soft(req, await handle(req, ctx, "GET"));
export const POST = async (req: NextRequest, ctx: Ctx) => soft(req, await handle(req, ctx, "POST"));
export const PATCH = async (req: NextRequest, ctx: Ctx) => soft(req, await handle(req, ctx, "PATCH"));
export const DELETE = async (req: NextRequest, ctx: Ctx) => soft(req, await handle(req, ctx, "DELETE"));
