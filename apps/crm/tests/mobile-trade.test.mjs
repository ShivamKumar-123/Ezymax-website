// Mobile trading API (/api/mobile/trade/*, docs/MOBILE-API.md): `node --test apps/crm/tests`.
// Stub gateway, trading engine, options and support services on loopback ports; the proxy and the route handlers run
// as they are.
//
// What it guards: engine sessions are minted server-side for the client's own account and handed out as trade tokens
// bound to that client; another client's trade token (or a bare engine token) is refused; orders carry the phone's
// platform; the options reads use the acting account's kind and group; view-only and read-only staff sessions never
// trade; the paid AI routes keep Ezymex Trader's per-client budget.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import "./helpers/ts-hooks.mjs";

const TOKENS = { user: "u".repeat(43), other: "o".repeat(43), viewer: `v.${"w".repeat(43)}`, staffRead: `i.${"r".repeat(43)}`, dead: "d".repeat(43) };
const USERS = { [TOKENS.user]: 42, [TOKENS.other]: 7, [TOKENS.staffRead]: 42 };
const ENGINE = {
  own: "E".repeat(43), // SSO session of 50000001 (owner 42)
  otherOwn: "F".repeat(43), // SSO session of 50000009 (owner 7)
  investor: "G".repeat(43), // investor login of 50000009 (owner 7), read-only
  demo: "H".repeat(43), // trading-password login of 50000005, a demo account of client 7
  moved: "J".repeat(43), // a session whose account no longer belongs to 42
};
const ACCOUNTS = {
  [ENGINE.own]: { login: 50000001, userId: 42, type: "live", group: "pro-netting", route: "B", version: 3, balance: 100 },
  [ENGINE.otherOwn]: { login: 50000009, userId: 7, type: "live", group: "standard", balance: 5 },
  [ENGINE.investor]: { login: 50000009, userId: 7, type: "live", group: "standard", balance: 5 },
  [ENGINE.demo]: { login: 50000005, userId: 7, type: "demo", group: "demo-std", balance: 10000 },
  [ENGINE.moved]: { login: 50000002, userId: 99, type: "live", group: "standard" },
};
const READ_ONLY = new Set([ENGINE.investor]);
let ssoOwner = { "50000001": 42, "50000009": 7, "50000002": 42 };

const calls = [];
let gateway, engine, optionsSvc, supportSvc;

function stub(name, handle) {
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    const body = raw ? JSON.parse(raw) : undefined;
    calls.push({ svc: name, method: req.method, path: req.url, headers: req.headers, body });
    const [status, data] = await handle(req, body);
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(data));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}
const bearer = (req) => (req.headers.authorization ?? "").replace(/^Bearer /, "");

before(async () => {
  gateway = await stub("gateway", (req) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/v1/public/tenant-config") return [200, { maintenance: { active: false }, modules: {}, flags: {} }];
    if (url.pathname === "/v1/auth/impersonation/event") return [200, { status: "ok" }];
    if (url.pathname === "/v1/auth/me") {
      const t = bearer(req);
      if (t === TOKENS.viewer) return [200, { user: { id: 42, email: "v@x", tenant: { slug: "ezymex" } }, viewer: { id: 1, accounts: ["50000001"], sections: ["accounts"], status: "active" } }];
      if (USERS[t]) return [200, { user: { id: USERS[t], email: "c@x", name: "Client", first_name: "C", last_name: "L", tenant: { slug: "ezymex" } }, viewer: null }];
      return [401, { error: { code: "unauthorized", message: "Please sign in." } }];
    }
    return [404, {}];
  });
  engine = await stub("engine", (req, body) => {
    const url = new URL(req.url, "http://x");
    const p = url.pathname;
    const t = bearer(req);
    const sso = /^\/v1\/accounts\/(\d{8})\/sso$/.exec(p);
    if (sso) return String(ssoOwner[sso[1]]) === req.headers["x-ezymex-user-id"] ? [200, { token: `sso-${sso[1]}-one-time-0001` }] : [404, { error: { code: "not_found", message: "Account not found." } }];
    if (p === "/v1/terminal/sso") {
      const login = /^sso-(\d{8})-/.exec(body?.token ?? "")?.[1];
      const tok = { "50000001": ENGINE.own, "50000009": ENGINE.otherOwn, "50000002": ENGINE.moved }[login];
      return tok ? [200, { token: tok, expiresAt: "2026-10-09T00:00:00Z", readOnly: false, account: ACCOUNTS[tok] }] : [401, { error: { code: "invalid_token", message: "x" } }];
    }
    if (p === "/v1/terminal/login") {
      if (body?.login === 50000009 && body?.password === "Investor1") return [200, { token: ENGINE.investor, expiresAt: "2026-10-09T00:00:00Z", readOnly: true, account: ACCOUNTS[ENGINE.investor] }];
      if (body?.login === 50000005 && body?.password === "Trading1") return [200, { token: ENGINE.demo, expiresAt: "2026-10-09T00:00:00Z", readOnly: false, account: ACCOUNTS[ENGINE.demo] }];
      return [401, { error: { code: "invalid_credentials", message: "Invalid login or password." } }];
    }
    if (p === "/v1/groups") return [200, { groups: [{ code: "pro-netting", spreadGroup: "pro" }, { code: "standard", spreadGroup: "std" }] }];
    if (p === "/v1/symbols") return [200, { symbols: [{ symbol: "EURUSD", core: true, liveTrading: true, digits: 5 }, { symbol: "AUDNZD", core: false, liveTrading: true, digits: 5 }, { symbol: "TSLA.US", core: false, liveTrading: false, digits: 2 }] }];
    if (p.startsWith("/v1/accounts/") && p.endsWith("/demo-refill")) return [200, { status: "ok", amount: 10000, balance: 10000 }];
    if (!ACCOUNTS[t]) return [401, { error: { code: "unauthorized", message: "Session expired." } }];
    if (p === "/v1/terminal/state") return [200, { account: ACCOUNTS[t], readOnly: READ_ONLY.has(t), positions: [{ ticket: 1, book: "B", symbol: "EURUSD", parentTicket: null }], orders: [], history: { deals: [] }, expiresAt: "2026-10-09T00:00:00Z" }];
    if (p === "/v1/terminal/orders") {
      if (body?.symbol === "XAUUSD") return [409, { error: { code: "market_closed", message: "The market is closed." } }];
      return [200, { status: "filled", received: body }];
    }
    if (p === "/v1/terminal/positions/close-by") return [200, { status: "closed", received: body }];
    if (p === "/v1/terminal/stream-ticket") return [200, { ticket: "eng-ticket-1", expiresIn: 30 }];
    if (p === "/v1/terminal/controls") return [200, { userId: 42, tradingDisabled: false, closeOnly: false, staff: null }];
    if (p === "/v1/terminal/logout") return [200, { status: "ok" }];
    if (p === "/v1/terminal/options/orders") return READ_ONLY.has(t) ? [403, { error: { code: "read_only", message: "x" } }] : [200, { status: "filled", received: body }];
    if (p === "/v1/terminal/options/book/orders") return [200, { orders: [], query: url.search }];
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  optionsSvc = await stub("options", (req) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/v1/options/chain") return [200, { underlying: url.searchParams.get("u"), rows: [] }];
    if (url.pathname === "/v1/options/stream/ticket") return [200, { ticket: "opt-ticket-1", expiresIn: 30 }];
    if (url.pathname.startsWith("/v1/public/options/book/")) return [200, { bids: [], asks: [] }];
    return [404, { error: { code: "options_disabled", message: "x" } }];
  });
  supportSvc = await stub("support", (req) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/v1/notifications/me") return [200, { items: [], unread: 0, next: null }];
    if (url.pathname === "/v1/notifications/me/read") return [200, { unread: 0 }];
    return [404, {}];
  });
  process.env.GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;
  process.env.TRADING_URL = `http://127.0.0.1:${engine.address().port}`;
  process.env.OPTIONS_URL = `http://127.0.0.1:${optionsSvc.address().port}`;
  process.env.SUPPORT_URL = `http://127.0.0.1:${supportSvc.address().port}`;
  process.env.NEXT_PUBLIC_TERMINAL_URL = "https://trade.ezymex.com";
  process.env.TRADING_INTERNAL_TOKEN = "test-internal-token";
});

after(() => {
  gateway?.close();
  engine?.close();
  optionsSvc?.close();
  supportSvc?.close();
});

const load = async () => ({
  ...(await import("next/server")),
  proxy: (await import("../proxy.ts")).proxy,
  trade: await import("../app/api/mobile/trade/[...path]/route.ts"),
  ai: await import("../lib/mobile-ai.ts"),
  mt: await import("../lib/mobile-trade.ts"),
});

const BASE = "https://app.ezymex.com";

/** A call through the proxy and (when it lets the request through) the trade route. */
async function call(m, method, path, { token, trade, body, headers = {} } = {}) {
  const h = { host: "app.ezymex.com", "x-forwarded-proto": "https", ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  if (trade) h["x-ezymex-trade"] = trade;
  if (body !== undefined) h["content-type"] = "application/json";
  const init = { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined };
  const res0 = await m.proxy(new m.NextRequest(`${BASE}/api/mobile/trade/${path}`, init));
  const ph = Object.fromEntries(res0.headers.entries());
  if (!ph["x-middleware-next"]) return res0; // refused by the proxy
  const fwd = new Headers();
  for (const k of (ph["x-middleware-override-headers"] ?? "").split(",").filter(Boolean)) fwd.set(k, ph[`x-middleware-request-${k}`]);
  const req = new m.NextRequest(`${BASE}/api/mobile/trade/${path}`, { method, headers: fwd, body: init.body });
  const segs = path.split("?")[0].split("/");
  return m.trade[method](req, { params: Promise.resolve({ path: segs }) });
}

const open = async (m, token, login) => {
  const res = await call(m, "POST", "sessions", { token, body: { login } });
  return { res, data: await res.json() };
};

test("POST sessions mints the engine session server-side for the client's own account and binds it to the client", async () => {
  const m = await load();
  const { res, data } = await open(m, TOKENS.user, "50000001");
  assert.equal(res.status, 200);
  assert.match(data.token, /^kt1\.s\.E{43}\.[A-Za-z0-9_-]{43}$/);
  assert.equal(data.login, "50000001");
  assert.equal(data.readOnly, false);
  assert.equal(data.expiresAt, "2026-10-09T00:00:00.000Z");
  assert.equal(data.account.spreadGroup, "pro");
  for (const hidden of ["userId", "route", "version"]) assert.equal(data.account[hidden], undefined, hidden);
  const sso = calls.findLast((c) => c.path === "/v1/accounts/50000001/sso");
  assert.equal(sso.headers["x-ezymex-user-id"], "42", "the owner comes from the gateway session");
  assert.equal(sso.headers["x-ezymex-internal"], "test-internal-token");
  // someone else's account: the engine's 404 comes back, no session
  const other = await open(m, TOKENS.user, "50000009");
  assert.equal(other.res.status, 404);
  assert.equal(other.data.token, undefined);
  // the login is validated
  assert.equal((await open(m, TOKENS.user, "123")).res.status, 422);
});

test("trade session ownership: another client's trade token, a bare engine token or a tampered one are refused", async () => {
  const m = await load();
  const mine = (await open(m, TOKENS.user, "50000001")).data.token;
  const theirs = (await open(m, TOKENS.other, "50000009")).data.token;
  const ok = await call(m, "GET", "state", { token: TOKENS.user, trade: mine });
  assert.equal(ok.status, 200);
  // the other client's (valid) trade token with my session
  const foreign = await call(m, "GET", "state", { token: TOKENS.user, trade: theirs });
  assert.equal(foreign.status, 403);
  assert.equal((await foreign.json()).error.code, "trade_session_foreign");
  // my trade token with the other client's session: refused before any order reaches the engine
  const orders = calls.filter((c) => c.path === "/v1/terminal/orders").length;
  const swapped = await call(m, "POST", "orders", { token: TOKENS.other, trade: mine, body: { symbol: "EURUSD", side: "buy", type: "market", volume: 0.1 } });
  assert.equal(swapped.status, 403);
  assert.equal(calls.filter((c) => c.path === "/v1/terminal/orders").length, orders);
  // a bare engine token (as in the web terminal's cookie) is not a trade token
  const bare = await call(m, "GET", "state", { token: TOKENS.user, trade: ENGINE.own });
  assert.equal(bare.status, 401);
  assert.equal((await bare.json()).error.code, "session_expired");
  // a tampered signature, or a token re-labelled as a password login
  const tampered = mine.slice(0, -2) + (mine.endsWith("AA") ? "BB" : "AA");
  assert.equal((await call(m, "GET", "state", { token: TOKENS.user, trade: tampered })).status, 403);
  assert.equal((await call(m, "GET", "state", { token: TOKENS.user, trade: mine.replace("kt1.s.", "kt1.p.") })).status, 403);
  // no trade token at all
  const none = await call(m, "GET", "state", { token: TOKENS.user });
  assert.equal(none.status, 401);
  assert.equal((await none.json()).error.code, "trade_session_required");
});

test("an SSO session whose account no longer belongs to the client is refused", async () => {
  const m = await load();
  const { data } = await open(m, TOKENS.user, "50000002");
  // the account moved to client 99 after the session was opened (the engine's view wins once the cache is cold)
  m.mt.forgetTradeSession(ENGINE.moved);
  const res = await call(m, "GET", "state", { token: TOKENS.user, trade: data.token });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error.code, "trade_session_foreign");
});

test("the gateway session is checked on every trade call: signed out = no trading", async () => {
  const m = await load();
  const mine = (await open(m, TOKENS.user, "50000001")).data.token;
  const res = await call(m, "GET", "state", { token: TOKENS.dead, trade: mine });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error.code, "unauthorized");
  const anon = await call(m, "GET", "state", { trade: mine });
  assert.equal(anon.status, 401);
});

test("the engine's view of a session is cached for a minute", async () => {
  const m = await load();
  const mine = (await open(m, TOKENS.user, "50000001")).data.token;
  m.mt.forgetTradeSession(ENGINE.own);
  const n = () => calls.filter((c) => c.path === "/v1/terminal/state?historyLimit=0").length;
  const before = n();
  await call(m, "GET", "controls", { token: TOKENS.user, trade: mine });
  await call(m, "GET", "controls", { token: TOKENS.user, trade: mine });
  await call(m, "GET", "history", { token: TOKENS.user, trade: mine });
  assert.equal(n() - before, 1);
});

test("orders record the phone's platform and stay manual; engine rejections keep their code", async () => {
  const m = await load();
  const mine = (await open(m, TOKENS.user, "50000001")).data.token;
  const order = { symbol: "EURUSD", side: "buy", type: "market", volume: 0.1, sl: 1.05, source: "copy", comment: "x".repeat(50), userId: 999 };
  const a = await call(m, "POST", "orders", { token: TOKENS.user, trade: mine, body: order, headers: { "x-ezymex-platform": "android" } });
  assert.equal(a.status, 200);
  const sent = (await a.json()).received;
  assert.equal(sent.platform, "Android");
  assert.equal(sent.source, "manual");
  assert.equal(sent.comment.length, 31);
  assert.equal(sent.userId, undefined, "only the order fields reach the engine");
  const engineCall = calls.findLast((c) => c.path === "/v1/terminal/orders");
  assert.equal(engineCall.headers.authorization, `Bearer ${ENGINE.own}`);
  const ios = await call(m, "POST", "orders", { token: TOKENS.user, trade: mine, body: { ...order, source: "ai" }, headers: { "x-ezymex-platform": "ios" } });
  const iosSent = (await ios.json()).received;
  assert.equal(iosSent.platform, "iOS");
  assert.equal(iosSent.source, "ai");
  const bad = await call(m, "POST", "orders", { token: TOKENS.user, trade: mine, body: { ...order, side: "long" } });
  assert.equal(bad.status, 422);
  const closed = await call(m, "POST", "orders", { token: TOKENS.user, trade: mine, body: { ...order, symbol: "XAUUSD" } });
  assert.equal(closed.status, 409);
  assert.equal((await closed.json()).error.code, "market_closed");
  const cb = await call(m, "POST", "positions/close-by", { token: TOKENS.user, trade: mine, body: { ticket: 11, by: 12 } });
  assert.equal(cb.status, 200);
  assert.equal((await call(m, "POST", "positions/close-by", { token: TOKENS.user, trade: mine, body: { ticket: 11, by: 11 } })).status, 422);
});

test("state is scrubbed and carries the spread group; the stream ticket names the engine stream", async () => {
  const m = await load();
  const mine = (await open(m, TOKENS.user, "50000001")).data.token;
  const st = await (await call(m, "GET", "state?historyLimit=5", { token: TOKENS.user, trade: mine })).json();
  assert.equal(st.account.spreadGroup, "pro");
  assert.equal(st.account.userId, undefined);
  assert.equal(st.positions[0].book, undefined);
  assert.equal(st.positions[0].parentTicket, undefined);
  assert.ok(calls.some((c) => c.path === "/v1/terminal/state?historyLimit=5"));
  const t = await (await call(m, "POST", "stream-ticket", { token: TOKENS.user, trade: mine, body: {} })).json();
  assert.deepEqual(t, { ticket: "eng-ticket-1", expiresIn: 30, url: "wss://trade.ezymex.com/engine/stream" });
  const ctl = await (await call(m, "GET", "controls", { token: TOKENS.user, trade: mine })).json();
  assert.equal(ctl.userId, undefined);
});

test("MT5-style login: investor = read-only, any account; wrong server refused; the trade token is bound to the client", async () => {
  const m = await load();
  const inv = await call(m, "POST", "login", { token: TOKENS.user, body: { login: "50000009", password: "Investor1", server: "Ezymex-Live" } });
  assert.equal(inv.status, 200);
  const d = await inv.json();
  assert.equal(d.readOnly, true);
  assert.match(d.token, /^kt1\.p\./);
  // reading works (the account belongs to someone else: a password login is not owner-bound)
  assert.equal((await call(m, "GET", "state", { token: TOKENS.user, trade: d.token })).status, 200);
  // but not for another client
  assert.equal((await call(m, "GET", "state", { token: TOKENS.other, trade: d.token })).status, 403);
  // read-only: option orders refused before the engine
  const before = calls.filter((c) => c.path === "/v1/terminal/options/orders").length;
  const o = await call(m, "POST", "options/orders", { token: TOKENS.user, trade: d.token, body: { legs: [{ series: "EURUSD-20261009-1.1650-C", side: "buy", contracts: 1 }], clientOrderId: "abcdefgh-1" } });
  assert.equal(o.status, 403);
  assert.equal((await o.json()).error.code, "read_only");
  assert.equal(calls.filter((c) => c.path === "/v1/terminal/options/orders").length, before);
  // wrong server: the engine session is closed again
  const wrong = await call(m, "POST", "login", { token: TOKENS.user, body: { login: "50000005", password: "Trading1", server: "Ezymex-Live" } });
  assert.equal(wrong.status, 409);
  assert.equal((await wrong.json()).error.code, "wrong_server");
  assert.equal(bearer({ headers: calls.findLast((c) => c.path === "/v1/terminal/logout").headers }), ENGINE.demo);
  const badPw = await call(m, "POST", "login", { token: TOKENS.user, body: { login: "50000005", password: "nope" } });
  assert.equal(badPw.status, 401);
  assert.equal((await badPw.json()).error.code, "invalid_credentials");
});

test("demo refill acts for the account's owner (the engine's view), never a read-only session", async () => {
  const m = await load();
  const demo = (await (await call(m, "POST", "login", { token: TOKENS.user, body: { login: "50000005", password: "Trading1", server: "Ezymex-Demo" } })).json()).token;
  const r = await call(m, "POST", "demo-refill", { token: TOKENS.user, trade: demo, body: {} });
  assert.equal(r.status, 200);
  const sent = calls.findLast((c) => c.path === "/v1/accounts/50000005/demo-refill");
  assert.equal(sent.headers["x-ezymex-user-id"], "7");
  const inv = (await (await call(m, "POST", "login", { token: TOKENS.user, body: { login: "50000009", password: "Investor1" } })).json()).token;
  assert.equal((await call(m, "POST", "demo-refill", { token: TOKENS.user, trade: inv, body: {} })).status, 403);
});

test("options: option orders carry the platform; reads use the account's kind and group; the stream ticket names the options stream", async () => {
  const m = await load();
  const mine = (await open(m, TOKENS.user, "50000001")).data.token;
  const o = await call(m, "POST", "options/orders", { token: TOKENS.user, trade: mine, body: { legs: [{ series: "EURUSD-20261009-1.1650-C", side: "buy", contracts: 2 }], clientOrderId: "abcdefgh-2" }, headers: { "x-ezymex-platform": "android" } });
  assert.equal(o.status, 200);
  const sent = (await o.json()).received;
  assert.equal(sent.platform, "Android");
  assert.deepEqual(sent.legs, [{ series: "EURUSD-20261009-1.1650-C", side: "buy", contracts: 2 }]);
  assert.equal((await call(m, "POST", "options/orders", { token: TOKENS.user, trade: mine, body: { legs: [{ series: "nope", side: "buy", contracts: 1 }], clientOrderId: "abcdefgh-3" } })).status, 422);
  const chain = await call(m, "GET", "options/chain?u=eurusd&expiry=2026-10-09", { token: TOKENS.user, trade: mine });
  assert.equal(chain.status, 200);
  const q = calls.findLast((c) => c.path.startsWith("/v1/options/chain"));
  assert.equal(q.path, "/v1/options/chain?u=EURUSD&expiry=2026-10-09&group=pro-netting");
  assert.equal(q.headers["x-ezymex-account-kind"], "live");
  assert.equal(q.headers["x-ezymex-tenant"], "ezymex");
  assert.equal((await call(m, "GET", "options/chain?u=EUR-USD", { token: TOKENS.user, trade: mine })).status, 400);
  const t = await (await call(m, "POST", "options/stream-ticket", { token: TOKENS.user, trade: mine, body: {} })).json();
  assert.deepEqual(t, { ticket: "opt-ticket-1", expiresIn: 30, url: "wss://trade.ezymex.com/options/stream" });
  const book = await call(m, "GET", "options/book/orders?status=open&series=EURUSD-20261009-1.1650-C", { token: TOKENS.user, trade: mine });
  assert.equal(book.status, 200);
  assert.equal((await call(m, "GET", "options/public/book/EURUSD-20261009-1.1650-C", { token: TOKENS.user })).status, 200, "public book data needs no trade session");
});

test("contract specs are public; notifications are the client's own inbox", async () => {
  const m = await load();
  const s = await call(m, "GET", "symbols");
  assert.equal(s.status, 200);
  const d = await s.json();
  assert.equal(d.symbols.length, 3);
  assert.deepEqual(d.live, ["AUDNZD"]);
  assert.deepEqual(d.off, ["TSLA.US"]);
  assert.equal((await call(m, "GET", "symbols?tier=all")).status, 400);
  const n = await call(m, "GET", "notifications?limit=20", { token: TOKENS.user });
  assert.equal(n.status, 200);
  const sent = calls.findLast((c) => c.path.startsWith("/v1/notifications/me"));
  assert.equal(sent.path, "/v1/notifications/me?limit=20");
  assert.equal(sent.headers["x-ezymex-user-id"], "42");
  assert.equal((await call(m, "POST", "notifications/read", { token: TOKENS.user, body: { all: true } })).status, 200);
});

test("view-only logins and read-only staff sessions never trade; bearer + cookie is refused", async () => {
  const m = await load();
  const v = await call(m, "POST", "sessions", { token: TOKENS.viewer, body: { login: "50000001" } });
  assert.equal(v.status, 403);
  assert.equal((await v.json()).error.code, "viewer_read_only");
  const vr = await call(m, "GET", "notifications", { token: TOKENS.viewer });
  assert.equal(vr.status, 403);
  const staff = await call(m, "POST", "sessions", { token: TOKENS.staffRead, body: { login: "50000001" } });
  assert.equal(staff.status, 403);
  assert.equal((await staff.json()).error.code, "staff_read_only");
  const mixed = await call(m, "GET", "state", { token: TOKENS.user, headers: { cookie: `ezymex_session=${TOKENS.user}` } });
  assert.equal(mixed.status, 400);
  assert.equal((await mixed.json()).error.code, "bearer_with_cookies");
});

test("sessions/check tells which stored trade tokens are alive; logout ends one", async () => {
  const m = await load();
  const mine = (await open(m, TOKENS.user, "50000001")).data.token;
  const theirs = (await open(m, TOKENS.other, "50000009")).data.token;
  const r = await (await call(m, "POST", "sessions/check", { token: TOKENS.user, body: { tokens: [mine, theirs, "junk"] } })).json();
  assert.equal(r.sessions[0].alive, true);
  assert.equal(r.sessions[0].login, "50000001");
  assert.equal(r.sessions[0].account.spreadGroup, "pro");
  assert.deepEqual(r.sessions[1], { alive: false });
  assert.deepEqual(r.sessions[2], { alive: false });
  const out = await call(m, "POST", "logout", { token: TOKENS.user, trade: mine, body: {} });
  assert.equal(out.status, 200);
  assert.equal(bearer({ headers: calls.findLast((c) => c.path === "/v1/terminal/logout").headers }), ENGINE.own);
});

test("the paid AI routes need a live, non-viewer session and keep the per-client budget", async () => {
  const m = await load();
  const req = (token) => new m.NextRequest(`${BASE}/api/mobile/trade/ai-trader`, { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {} });
  const anon = await m.ai.mobileAiGate(req());
  assert.equal(anon.status, 401);
  assert.equal((await anon.json()).code, "signin");
  assert.equal((await m.ai.mobileAiGate(req(TOKENS.dead))).status, 401);
  assert.equal((await m.ai.mobileAiGate(req(TOKENS.viewer))).status, 403);
  for (let i = 0; i < m.ai.AI_PER_MINUTE; i++) assert.equal(await m.ai.mobileAiGate(req(TOKENS.other)), null, `call ${i + 1}`);
  const over = await m.ai.mobileAiGate(req(TOKENS.other));
  assert.equal(over.status, 429);
  assert.equal((await over.json()).code, "rate_minute");
  assert.ok(Number(over.headers.get("retry-after")) >= 1);
  // another client has their own budget
  assert.equal(await m.ai.mobileAiGate(req(TOKENS.user)), null);
});

test("the AI routes are wired to the gate (no model call without a session) and answer configured:false without a key", async () => {
  const m = await load();
  const trader = await import("../app/api/mobile/trade/ai-trader/route.ts");
  const explain = await import("../app/api/mobile/trade/options/explain/route.ts");
  const strategy = { underlying: "EURUSD", legs: [{ side: "buy", right: "call", strike: 1.165, contracts: 1 }] };
  const post = (route, token, body) => route.POST(new m.NextRequest(`${BASE}/api/mobile/trade/x`, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }));
  assert.deepEqual(await (await post(explain, TOKENS.user, { locale: "en", strategy })).json(), { configured: false });
  const saved = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "sk-test-not-used";
  try {
    const a = await post(explain, null, { locale: "en", strategy });
    assert.equal(a.status, 401);
    assert.equal((await a.json()).code, "signin");
    const b = await post(trader, TOKENS.viewer, { prompt: "buy gold when RSI crosses 30" });
    assert.equal(b.status, 403);
    assert.equal((await b.json()).code, "forbidden");
  } finally {
    if (saved === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = saved;
  }
  // the ported strategy checks match Ezymex Trader's
  const { validateSpec } = await import("../lib/ai-trader/schema.ts");
  assert.ok(validateSpec({ symbol: "XAUUSD", timeframe: "M5", sizing: { mode: "lots", lots: 0.001 } }).errors.includes("Volume must be at least 0.01 lot"));
});
