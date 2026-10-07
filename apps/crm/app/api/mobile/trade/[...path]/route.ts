import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, fetchMe, type GatewayUser } from "@/lib/gateway";
import { support } from "@/lib/support";
import { bearerOf, brokerServiceUrls, platformOf } from "@/lib/mobile";
import { LOGIN_RE, clientAccount, engineCall, engineSymbols, forgetTradeSession, isEngineToken, optionsCall, rememberSession, scrub, sessionInfo, unwrapTradeToken, wrapTradeToken, type Obj, type Result, type SessionInfo, type TradeKind } from "@/lib/mobile-trade";
import {
  COMBO_RE,
  ORDER_ID_RE,
  RFQ_ID_RE,
  SERIES_RE,
  SYMBOL_RE,
  TICKET_RE,
  DATE_RE,
  UNDERLYING_RE,
  bookAmendBody,
  bookOrderBody,
  bulkCloseBody,
  candlesQuery,
  closeBody,
  closeByBody,
  isUnderlying,
  optionBody,
  orderBody,
  orderPatch,
  pageQuery,
  positionPatch,
  rfqAcceptBody,
  rfqBody,
  underlyingQuery,
} from "@/lib/trade-bodies";

// Mobile trading BFF (docs/MOBILE-API.md, lib/mobile-trade.ts). App -> /api/mobile/trade/<route> -> trading engine
// (/v1/terminal/…) and the options service (/v1/options/…). The same routes and validation as Kalks Trader's BFF
// (apps/terminal app/api/engine/*, app/api/options/*), with the gateway session as the caller's identity.
//
// Public:
//   GET    symbols?tier=core|catalogue&symbols=A,B   {symbols[] (contract specs + liveTrading), live[], off[]}
// Bearer (gateway session) only:
//   POST   sessions {login}                  SSO for the client's own account -> {token, expiresAt, readOnly, login, account}
//   POST   sessions/check {tokens[≤8]}       which stored trade tokens are still alive -> {sessions:[{alive, login?, readOnly?, account?}]}
//   POST   login {login, password, server?}  MT5-style login (trading / investor password, any account) -> same as sessions
//   GET    notifications?before&limit&unread  the client's inbox (the bell; same as /api/mobile/notifications)
//   POST   notifications/read {ids?|all}
//   GET    options/public/book/{series} | trades/{series}?limit | stats/{u}   order book market data
// Bearer + X-Kalks-Trade (the trade token):
//   POST   logout                            ends the terminal session
//   GET    state?historyLimit=               account, positions, orders, recent deals (+ readOnly, restrictions, staff)
//   GET    history?from&to&page&limit        closed deals + done pending orders
//   GET    controls                          the broker's restrictions on the account
//   GET    mam?symbol&volume                 MAM role + allocation summary
//   POST   orders                            market / pending order (platform from X-Kalks-Platform)
//   PATCH  orders/{ticket}                   {price?, stopLimit?, volume?, sl?, tp?, trailingPoints?, expiry?, expiryAt?}
//   DELETE orders/{ticket}
//   POST   positions/{ticket}/close          {volume?, deviationPoints?, requestedPrice?}
//   PATCH  positions/{ticket}                {sl?, tp?, trailingPoints?}  (null clears)
//   POST   positions/close-by                {ticket, by}
//   POST   bulk-close                        {filter: all|profitable|losing|pending|buys|sells, symbol?}
//   POST   demo-refill                       demo accounts: top the balance back up
//   POST   stream-ticket                     {ticket, expiresIn, url}: one-time engine stream ticket (30 s)
//   Kalks FX Options, engine (same account and session; investor sessions are read-only):
//   POST   options/preview | options/orders | options/combos/{id}/close;  GET options/settlements?limit
//   POST   options/book/preview | options/book/orders;  GET options/book/orders?status&series;
//   DELETE options/book/orders?series|underlying;  PATCH|DELETE options/book/orders/{id};  GET options/book/fills?from&to
//   POST   options/rfq;  GET|DELETE options/rfq/{id};  POST options/rfq/{id}/accept
//   Kalks FX Options, options service (the acting account picks the module switch and the group's pricing):
//   GET    options/underlyings | expiries?u= | chain?u=&expiry= | series/{code} | candles?series&tf&limit&to | smile?u=&expiry=
//   POST   options/stream-ticket             {ticket, expiresIn, url}: chain stream ticket
// AI (own files): POST trade/options/explain, POST trade/ai-trader (lib/mobile-ai.ts budget).
//
// View-only logins never reach the engine here (they read accounts through /api/mobile/trading/*). Rejections keep the
// engine's status and code (market_closed, no_money, invalid_sl, read_only…) for the app to explain.

type Ctx = { params: Promise<{ path: string[] }> };
type Method = "GET" | "POST" | "PATCH" | "DELETE";

const NO_STORE = { "cache-control": "no-store" };
const MAX_CHECK = 8;
/** MT5 servers: an account only exists on its own server. */
const SERVERS: Record<string, "live" | "demo"> = { "Kalks-Live": "live", "Kalks-Demo": "demo" };

function reply(status: number, data: unknown, headers?: Record<string, string>) {
  return NextResponse.json(data, { status, headers: { ...NO_STORE, ...headers } });
}
function error(status: number, code: string, message: string) {
  return reply(status, { error: { code, message } });
}
const invalid = (message: string) => error(422, "validation", message);
const badQuery = (message: string) => error(400, "bad_request", message);
const expired = () => error(401, "session_expired", "Your trading session has expired. Open the account again.");
const readOnly = () => error(403, "read_only", "Trading is disabled with the investor password.");
const relay = (r: Result) => reply(r.status, scrub(r.data));

/** The signed-in client (gateway session). View-only logins and read-only staff sessions never act here. */
async function client(req: NextRequest, write: boolean): Promise<GatewayUser | NextResponse> {
  const token = bearerOf(req.headers);
  if (!token) return error(401, "unauthorized", "Please sign in.");
  // a bearer token next to a browser session cookie is refused (the proxy does this first; defence in depth)
  if (req.cookies.get(SESSION_COOKIE)?.value) return error(400, "bearer_with_cookies", "Send the session token without cookies.");
  const user = await fetchMe(token, req.headers);
  if (user === "unavailable") return error(503, "unavailable", "Sign-in service is unavailable. Please try again shortly.");
  if (!user) return error(401, "unauthorized", "Please sign in.");
  if (user.viewer) return write ? error(403, "viewer_read_only", "This is a view-only login. Viewers can't make changes.") : error(403, "viewer_scope", "This isn't shared with your view-only login.");
  if (write && token.startsWith("i.")) return error(403, "staff_read_only", "This is a read-only staff session. Changes are not allowed.");
  return user;
}

type Acting = { engine: string; kind: TradeKind; info: SessionInfo };

/** The trade session sent by the app (`X-Kalks-Trade`), checked against the signed-in client. */
async function tradeSession(req: NextRequest, user: GatewayUser): Promise<Acting | NextResponse> {
  const raw = req.headers.get("x-kalks-trade")?.trim() ?? "";
  if (!raw) return error(401, "trade_session_required", "Open a trading account first.");
  const t = unwrapTradeToken(user.id, raw);
  if (t === "malformed") return expired();
  if (t === "foreign") return error(403, "trade_session_foreign", "This trading session belongs to another client.");
  const info = await sessionInfo(req, t.engine);
  if (info.status === 401 || info.status === 403 || info.status === 404) return expired();
  if (info.status !== 200) return error(503, "unavailable", "The trade server is unavailable. Please try again shortly.");
  // an account opened through the Client Area SSO must still be the client's own
  if (t.kind === "s" && info.ownerId !== user.id) return error(403, "trade_session_foreign", "This trading session belongs to another client.");
  return { engine: t.engine, kind: t.kind, info };
}

/** {token, expiresAt, readOnly, login, account} for a terminal session just opened by `user`. */
async function opened(req: NextRequest, user: GatewayUser, kind: TradeKind, r: { token: string; expiresAt?: string; readOnly?: boolean; account: Obj }) {
  const a = r.account;
  const login = String(a.login ?? "");
  const owner = Number(a.userId);
  rememberSession(r.token, { login, ownerId: Number.isSafeInteger(owner) && owner > 0 ? owner : null, readOnly: !!r.readOnly, kind: a.type === "demo" ? "demo" : "live", group: String(a.group ?? "") });
  const exp = Date.parse(r.expiresAt ?? "") || Date.now() + 12 * 3600e3;
  return reply(200, { token: wrapTradeToken(user.id, kind, r.token), expiresAt: new Date(exp).toISOString(), readOnly: !!r.readOnly, login, account: await clientAccount(req, a) });
}

async function readBody(req: NextRequest, method: Method): Promise<Obj | NextResponse> {
  if (method !== "POST" && method !== "PATCH") return {};
  const ct = req.headers.get("content-type") ?? "";
  const text = await req.text();
  if (!text.trim()) return {};
  if (!ct.includes("application/json")) return error(415, "bad_request", "Expected JSON.");
  if (text.length > 64_000) return error(413, "too_large", "Request too large.");
  try {
    const v = JSON.parse(text) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Obj;
  } catch {
    /* falls through */
  }
  return error(400, "bad_request", "Invalid request body.");
}

async function handle(req: NextRequest, { params }: Ctx, method: Method): Promise<NextResponse> {
  const path = (await params).path;
  const [a, b, c, d] = path;
  const sp = req.nextUrl.searchParams;

  // ---- public product information: contract specs + which markets trade on live accounts (cached a minute)
  if (method === "GET" && a === "symbols" && path.length === 1) {
    const q = new URLSearchParams();
    const tier = sp.get("tier");
    if (tier !== null && tier !== "core" && tier !== "catalogue") return badQuery("Invalid tier.");
    if (tier) q.set("tier", tier);
    const symbols = sp.get("symbols");
    if (symbols !== null) {
      const list = symbols.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
      if (!list.length || list.length > 200 || !list.every((s) => SYMBOL_RE.test(s))) return badQuery("Invalid symbols.");
      q.set("symbols", list.join(","));
    }
    const r = await engineSymbols(req, q.size ? `?${q}` : "");
    if (r.status !== 200 || !Array.isArray(r.data.symbols)) return error(503, "unavailable", "The trade server is unavailable.");
    const list = r.data.symbols as { symbol?: string; core?: boolean; liveTrading?: boolean }[];
    const live: string[] = [];
    const off: string[] = [];
    for (const s of list) if (typeof s.symbol === "string" && !s.core) (s.liveTrading ? live : off).push(s.symbol);
    return reply(200, { symbols: list, live, off }, { "cache-control": "private, max-age=60" });
  }

  const body = await readBody(req, method);
  if (body instanceof NextResponse) return body;
  const write = method !== "GET";
  const user = await client(req, write && !(a === "sessions" && b === "check"));
  if (user instanceof NextResponse) return user;
  const tenant = user.tenant?.slug || "kalks";
  const platform = platformOf(req.headers);

  // ---- engine access for one of the client's own accounts (the Client Area Trade button's SSO)
  if (a === "sessions" && path.length === 1 && method === "POST") {
    const login = String(body.login ?? "");
    if (!LOGIN_RE.test(login)) return invalid("Choose a trading account.");
    const sso = await engineCall<{ token?: string }>(`/v1/accounts/${login}/sso`, { method: "POST", userId: user.id, tenant, req });
    if (sso.status !== 200 || !sso.data.token) return reply(sso.status === 200 ? 502 : sso.status, scrub(sso.data));
    const r = await engineCall<{ token?: string; expiresAt?: string; readOnly?: boolean; account?: Obj }>("/v1/terminal/sso", { body: { token: sso.data.token }, req });
    if (r.status !== 200 || !isEngineToken(r.data.token) || !r.data.account) return reply(r.status === 200 ? 502 : r.status, scrub(r.data));
    return opened(req, user, "s", { token: r.data.token, expiresAt: r.data.expiresAt, readOnly: r.data.readOnly, account: r.data.account });
  }

  // ---- which of the app's stored trade tokens are still alive (the account switcher)
  if (a === "sessions" && b === "check" && path.length === 2 && method === "POST") {
    const tokens = Array.isArray(body.tokens) ? body.tokens : null;
    if (!tokens || tokens.length > MAX_CHECK || !tokens.every((t) => typeof t === "string" && t.length <= 400)) return invalid(`Give up to ${MAX_CHECK} trade tokens.`);
    const out = await Promise.all(
      (tokens as string[]).map(async (raw) => {
        const t = unwrapTradeToken(user.id, raw);
        if (typeof t === "string") return { alive: false };
        const st = await engineCall<{ account?: Obj; readOnly?: boolean; expiresAt?: string }>("/v1/terminal/state?historyLimit=0", { bearer: t.engine, req });
        if (st.status !== 200 || !st.data.account) {
          if (st.status === 401 || st.status === 403 || st.status === 404) forgetTradeSession(t.engine);
          return st.status === 401 || st.status === 403 || st.status === 404 ? { alive: false } : { alive: true, unavailable: true };
        }
        if (t.kind === "s" && Number(st.data.account.userId) !== user.id) return { alive: false };
        return { alive: true, login: String(st.data.account.login ?? ""), readOnly: !!st.data.readOnly, expiresAt: st.data.expiresAt ?? null, account: await clientAccount(req, st.data.account) };
      }),
    );
    return reply(200, { sessions: out });
  }

  // ---- MT5-style login: trading password = full access, investor password = read-only
  if (a === "login" && path.length === 1 && method === "POST") {
    const login = String(body.login ?? "").trim();
    const password = typeof body.password === "string" ? body.password : "";
    if (!LOGIN_RE.test(login)) return invalid("Enter your 8-digit account number (login).");
    if (!password || password.length > 128) return invalid("Enter your trading or investor password.");
    const server = typeof body.server === "string" && body.server ? body.server : undefined;
    if (server !== undefined && !SERVERS[server]) return invalid("Unknown server.");
    const r = await engineCall<{ token?: string; expiresAt?: string; readOnly?: boolean; account?: Obj; error?: Obj }>("/v1/terminal/login", { body: { login: Number(login), password }, req });
    if (r.status !== 200 || !isEngineToken(r.data.token) || !r.data.account) return reply(r.status === 200 ? 502 : r.status, r.data.error ? { error: r.data.error } : { error: { code: "engine_error", message: "Login failed." } });
    const type = r.data.account.type;
    if (server && type && SERVERS[server] !== type) {
      await engineCall("/v1/terminal/logout", { method: "POST", bearer: r.data.token, req });
      return error(409, "wrong_server", `Account ${login} is on ${type === "demo" ? "Kalks-Demo" : "Kalks-Live"}, not ${server}.`);
    }
    return opened(req, user, "p", { token: r.data.token, expiresAt: r.data.expiresAt, readOnly: r.data.readOnly, account: r.data.account });
  }

  // ---- the client's notifications (the same inbox as the Client Area bell and Kalks Trader's bell)
  if (a === "notifications") {
    if (method === "GET" && path.length === 1) {
      const q = new URLSearchParams();
      for (const k of ["before", "limit", "unread"]) {
        const v = sp.get(k);
        if (v && /^\w{1,20}$/.test(v)) q.set(k, v);
      }
      const r = await support(`/v1/notifications/me${q.size ? `?${q}` : ""}`, { user });
      return reply(r.status, r.data);
    }
    if (method === "POST" && b === "read" && path.length === 2) {
      const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is number => Number.isSafeInteger(x) && (x as number) > 0).slice(0, 200) : undefined;
      if (!ids?.length && body.all !== true) return badQuery("Give ids or all.");
      const r = await support("/v1/notifications/me/read", { method: "POST", body: body.all === true ? { all: true } : { ids }, user });
      return reply(r.status, r.data);
    }
    return error(404, "not_found", "Not found.");
  }

  // ---- options order book market data (public in Kalks Trader too)
  if (a === "options" && b === "public" && method === "GET") {
    if ((c === "book" || c === "trades") && path.length === 4 && SERIES_RE.test(d ?? "")) {
      let q = "";
      if (c === "trades") {
        const limit = sp.get("limit");
        if (limit !== null && !/^\d{1,3}$/.test(limit)) return badQuery("Invalid limit.");
        if (limit) q = `?limit=${Math.min(200, Math.max(1, Number(limit)))}`;
      }
      return reply(...pair(await optionsCall(`/v1/public/options/${c}/${encodeURIComponent(d!)}${q}`, { tenant, internal: false, timeoutMs: 5_000 })));
    }
    if (c === "stats" && path.length === 4 && isUnderlying((d ?? "").toUpperCase())) {
      return reply(...pair(await optionsCall(`/v1/public/options/stats/${d!.toUpperCase()}`, { tenant, internal: false, timeoutMs: 5_000 })));
    }
    return error(404, "not_found", "Not found.");
  }

  // ---- everything below acts on one trading account: the trade session
  const s = await tradeSession(req, user);
  if (s instanceof NextResponse) return s;
  /** A call with the terminal session; an expired session is forgotten and answers 401 session_expired. */
  const forward = async (p: string, init: { method?: Method; body?: unknown } = {}) => {
    const r = await engineCall<Obj>(p, { ...init, bearer: s.engine, req });
    if (r.status === 401) {
      forgetTradeSession(s.engine);
      return { expired: true as const, r };
    }
    return { expired: false as const, r };
  };
  const done = async (p: string, init: { method?: Method; body?: unknown } = {}, map?: (d: Obj) => Promise<unknown> | unknown) => {
    const x = await forward(p, init);
    if (x.expired) return expired();
    return reply(x.r.status, x.r.status < 300 && map ? await map(x.r.data) : scrub(x.r.data));
  };

  if (a === "logout" && path.length === 1 && method === "POST") {
    const r = await engineCall<Obj>("/v1/terminal/logout", { method: "POST", bearer: s.engine, req });
    forgetTradeSession(s.engine);
    return r.status === 401 || r.status === 200 ? reply(200, { status: "ok" }) : relay(r);
  }

  // ---- reads
  if (method === "GET" && a === "state" && path.length === 1) {
    const n = Number(sp.get("historyLimit") ?? 100);
    const limit = Number.isInteger(n) && n >= 0 && n <= 500 ? n : 100;
    return done(`/v1/terminal/state?historyLimit=${limit}`, {}, async (d) => ({ ...(scrub(d) as Obj), account: await clientAccount(req, d.account) }));
  }
  if (method === "GET" && a === "history" && path.length === 1) {
    const q = pageQuery(sp);
    if (typeof q === "string") return badQuery(q);
    return done(`/v1/terminal/history${q.q}`);
  }
  if (method === "GET" && a === "controls" && path.length === 1) {
    return done("/v1/terminal/controls", {}, (d) => {
      const { userId: _owner, ...rest } = d;
      return rest;
    });
  }
  if (method === "GET" && a === "mam" && path.length === 1) {
    const symbol = sp.get("symbol");
    const volume = sp.get("volume") ?? "1";
    if (symbol !== null && !SYMBOL_RE.test(symbol)) return badQuery("Invalid symbol.");
    if (!/^\d{1,4}(\.\d{1,2})?$/.test(volume) || Number(volume) <= 0) return badQuery("Invalid volume.");
    return done(`/v1/terminal/mam${symbol ? `?symbol=${symbol}&volume=${volume}` : ""}`);
  }

  // ---- CFD trading
  if (a === "orders" && path.length === 1 && method === "POST") {
    const o = orderBody(body, platform);
    if (typeof o === "string") return invalid(o);
    return done("/v1/terminal/orders", { method: "POST", body: o });
  }
  if (a === "orders" && path.length === 2 && TICKET_RE.test(b ?? "")) {
    if (method === "DELETE") return done(`/v1/terminal/orders/${b}`, { method: "DELETE" });
    if (method === "PATCH") {
      const o = orderPatch(body);
      if (typeof o === "string") return invalid(`Invalid ${o}.`);
      return done(`/v1/terminal/orders/${b}`, { method: "PATCH", body: o });
    }
  }
  if (a === "positions" && b === "close-by" && path.length === 2 && method === "POST") {
    const o = closeByBody(body);
    if (typeof o === "string") return invalid(o);
    return done("/v1/terminal/positions/close-by", { method: "POST", body: o });
  }
  if (a === "positions" && TICKET_RE.test(b ?? "")) {
    if (path.length === 3 && c === "close" && method === "POST") {
      const o = closeBody(body);
      if (typeof o === "string") return invalid(`Invalid ${o}.`);
      return done(`/v1/terminal/positions/${b}/close`, { method: "POST", body: o });
    }
    if (path.length === 2 && method === "PATCH") {
      const o = positionPatch(body);
      if (typeof o === "string") return invalid(`Invalid ${o}.`);
      return done(`/v1/terminal/positions/${b}`, { method: "PATCH", body: o });
    }
  }
  if (a === "bulk-close" && path.length === 1 && method === "POST") {
    const o = bulkCloseBody(body);
    if (typeof o === "string") return invalid(o);
    return done("/v1/terminal/bulk-close", { method: "POST", body: o });
  }
  if (a === "demo-refill" && path.length === 1 && method === "POST") {
    if (s.info.readOnly) return error(403, "read_only", "Investor (read-only) sessions can't refill the balance.");
    // the owner comes from the engine's own view of this session, never from the app (as in Kalks Trader)
    if (!s.info.ownerId) return error(404, "not_found", "Account not found.");
    return relay(await engineCall<Obj>(`/v1/accounts/${s.info.login}/demo-refill`, { method: "POST", userId: s.info.ownerId, tenant, req }));
  }
  if (a === "stream-ticket" && path.length === 1 && method === "POST") {
    return done("/v1/terminal/stream-ticket", { method: "POST" }, async (d) => ({ ticket: d.ticket, expiresIn: d.expiresIn, url: (await urls(req)).streams.engine }));
  }

  // ---- Kalks FX Options
  if (a === "options") return options(req, s, path, method, body, sp, tenant, platform, done);
  return error(404, "not_found", "Not found.");
}

const pair = (r: Result): [number, unknown, Record<string, string>?] => [r.status, r.data, r.status === 200 ? { "cache-control": "private, max-age=1" } : undefined];

const urls = (req: NextRequest) => brokerServiceUrls(req.headers, req.nextUrl);

type Done = (p: string, init?: { method?: Method; body?: unknown }, map?: (d: Obj) => Promise<unknown> | unknown) => Promise<NextResponse>;

async function options(req: NextRequest, s: Acting, path: string[], method: Method, body: Obj, sp: URLSearchParams, tenant: string, platform: string, done: Done): Promise<NextResponse> {
  const [, b, c, d] = path;
  const ro = s.info.readOnly;

  // -- engine: trading (house venue)
  if (method === "POST" && b === "preview" && path.length === 2) {
    const o = optionBody(body, false);
    if (typeof o === "string") return invalid(o);
    return done("/v1/terminal/options/preview", { method: "POST", body: o });
  }
  if (method === "POST" && b === "orders" && path.length === 2) {
    if (ro) return readOnly();
    const o = optionBody(body, true, platform);
    if (typeof o === "string") return invalid(o);
    return done("/v1/terminal/options/orders", { method: "POST", body: o });
  }
  if (method === "POST" && b === "combos" && path.length === 4 && COMBO_RE.test(c ?? "") && d === "close") {
    if (ro) return readOnly();
    return done(`/v1/terminal/options/combos/${encodeURIComponent(c!)}/close`, { method: "POST" });
  }
  if (method === "GET" && b === "settlements" && path.length === 2) {
    const n = Number(sp.get("limit") ?? 100);
    const limit = Number.isInteger(n) && n >= 1 && n <= 500 ? n : 100;
    return done(`/v1/terminal/options/settlements?limit=${limit}`);
  }

  // -- engine: order book
  if (b === "book") {
    if (method === "POST" && c === "preview" && path.length === 3) {
      const o = bookOrderBody(body, false);
      if (typeof o === "string") return invalid(o);
      return done("/v1/terminal/options/book/preview", { method: "POST", body: o });
    }
    if (c === "orders" && path.length === 3) {
      if (method === "POST") {
        if (ro) return readOnly();
        const o = bookOrderBody(body, true);
        if (typeof o === "string") return invalid(o);
        return done("/v1/terminal/options/book/orders", { method: "POST", body: o });
      }
      const series = sp.get("series");
      if (series !== null && !SERIES_RE.test(series)) return badQuery("Invalid series.");
      if (method === "GET") {
        const status = sp.get("status") ?? "open";
        if (status !== "open" && status !== "history") return badQuery("Invalid status.");
        return done(`/v1/terminal/options/book/orders?status=${status}${series ? `&series=${encodeURIComponent(series)}` : ""}`);
      }
      if (method === "DELETE") {
        if (ro) return readOnly();
        const underlying = sp.get("underlying");
        if (underlying !== null && !UNDERLYING_RE.test(underlying)) return badQuery("Invalid underlying.");
        if (!series && !underlying) return badQuery("Choose a series or an underlying.");
        const q = new URLSearchParams();
        if (series) q.set("series", series);
        if (underlying) q.set("underlying", underlying);
        return done(`/v1/terminal/options/book/orders?${q}`, { method: "DELETE" });
      }
    }
    if (c === "orders" && path.length === 4 && ORDER_ID_RE.test(d ?? "")) {
      if (ro) return readOnly();
      if (method === "DELETE") return done(`/v1/terminal/options/book/orders/${d}`, { method: "DELETE" });
      if (method === "PATCH") {
        const o = bookAmendBody(body);
        if (typeof o === "string") return invalid(o);
        return done(`/v1/terminal/options/book/orders/${d}`, { method: "PATCH", body: o });
      }
    }
    if (method === "GET" && c === "fills" && path.length === 3) {
      const q = new URLSearchParams();
      for (const k of ["from", "to"] as const) {
        const v = sp.get(k);
        if (!v) continue;
        if (!DATE_RE.test(v)) return badQuery(`Invalid ${k} date.`);
        q.set(k, v);
      }
      return done(`/v1/terminal/options/book/fills${q.size ? `?${q}` : ""}`);
    }
    return error(404, "not_found", "Not found.");
  }

  // -- engine: combo RFQ
  if (b === "rfq") {
    if (method === "POST" && path.length === 2) {
      if (ro) return readOnly();
      const o = rfqBody(body);
      if (typeof o === "string") return invalid(o);
      return done("/v1/terminal/options/rfq", { method: "POST", body: o });
    }
    if (path.length >= 3 && RFQ_ID_RE.test(c ?? "")) {
      const id = encodeURIComponent(c!);
      if (method === "GET" && path.length === 3) return done(`/v1/terminal/options/rfq/${id}`);
      if (method === "DELETE" && path.length === 3) {
        if (ro) return readOnly();
        return done(`/v1/terminal/options/rfq/${id}`, { method: "DELETE" });
      }
      if (method === "POST" && path.length === 4 && d === "accept") {
        if (ro) return readOnly();
        const o = rfqAcceptBody(body);
        if (typeof o === "string") return invalid(o);
        return done(`/v1/terminal/options/rfq/${id}/accept`, { method: "POST", body: o });
      }
    }
    return error(404, "not_found", "Not found.");
  }

  // -- options service: chain, prices and the chain stream (module switch per account kind, pricing per group)
  const { kind, group } = s.info;
  const call = (p: string, payload?: unknown) => optionsCall(p, { tenant, kind, body: payload, method: payload !== undefined ? "POST" : "GET" });
  const g = encodeURIComponent(group || "*");
  if (method === "GET" && b === "underlyings" && path.length === 2) return reply(...pair(await call("/v1/options/underlyings")));
  if (method === "GET" && b === "expiries" && path.length === 2) {
    const x = underlyingQuery(sp, true);
    if (!x) return badQuery("Invalid underlying.");
    return reply(...pair(await call(`/v1/options/expiries?u=${x.u}`)));
  }
  if (method === "GET" && b === "chain" && path.length === 2) {
    const x = underlyingQuery(sp, true);
    if (!x) return badQuery("Invalid underlying or expiry.");
    return reply(...pair(await call(`/v1/options/chain?u=${x.u}${x.expiry ? `&expiry=${x.expiry}` : ""}&group=${g}`)));
  }
  if (method === "GET" && b === "smile" && path.length === 2) {
    const x = underlyingQuery(sp, true);
    if (!x) return badQuery("Invalid underlying or expiry.");
    return reply(...pair(await call(`/v1/options/smile?u=${x.u}${x.expiry ? `&expiry=${x.expiry}` : ""}`)));
  }
  if (method === "GET" && b === "series" && path.length === 3 && SERIES_RE.test(c ?? "")) return reply(...pair(await call(`/v1/options/series/${encodeURIComponent(c!)}?group=${g}`)));
  if (method === "GET" && b === "candles" && path.length === 2) {
    const cq = candlesQuery(sp);
    if (!cq) return badQuery("Invalid series, timeframe, limit or time.");
    return reply(...pair(await call(`/v1/options/candles?${cq}`)));
  }
  if (method === "POST" && b === "stream-ticket" && path.length === 2) {
    const r = await call("/v1/options/stream/ticket", { group: group || "*" });
    if (r.status !== 200) return reply(r.status, r.data);
    return reply(200, { ticket: r.data.ticket, expiresIn: r.data.expiresIn, url: (await urls(req)).streams.options });
  }
  return error(404, "not_found", "Not found.");
}

export const dynamic = "force-dynamic";
export const GET = (req: NextRequest, ctx: Ctx) => handle(req, ctx, "GET");
export const POST = (req: NextRequest, ctx: Ctx) => handle(req, ctx, "POST");
export const PATCH = (req: NextRequest, ctx: Ctx) => handle(req, ctx, "PATCH");
export const DELETE = (req: NextRequest, ctx: Ctx) => handle(req, ctx, "DELETE");
