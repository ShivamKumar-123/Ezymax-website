// Mobile trading BFF (/api/mobile/trade/*): `node --test apps/crm/tests`.
// Stub gateway and trading engine on loopback ports; the proxy and route handler run as they are.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import "./helpers/ts-hooks.mjs";

const TOKENS = { user: "u".repeat(43), other: "o".repeat(43), viewer: `v.${"w".repeat(43)}`, staffRead: `i.${"r".repeat(43)}` };
const USERS = { [TOKENS.user]: 42, [TOKENS.other]: 7, [TOKENS.staffRead]: 42 };
const TRADE = { own: "T-own-session-0000000001", foreign: "T-foreign-session-000002" };

const calls = [];
let gateway, engine;

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
      if (t === TOKENS.viewer) return [200, { user: { id: 42, email: "v@x", tenant: { slug: "kalks" } }, viewer: { id: 1, accounts: ["50000001"], sections: ["accounts"], status: "active" } }];
      if (USERS[t]) return [200, { user: { id: USERS[t], email: "c@x", name: "Client", tenant: { slug: "kalks" } }, viewer: null }];
      return [401, { error: { code: "unauthorized", message: "Please sign in." } }];
    }
    return [404, {}];
  });
  engine = await stub("engine", (req, body) => {
    const url = new URL(req.url, "http://x");
    const p = url.pathname;
    if (/^\/v1\/accounts\/\d{8}\/sso$/.test(p)) return req.headers["x-kalks-user-id"] === "42" ? [200, { token: "sso-one-time-0001" }] : [404, { error: { code: "not_found", message: "Account not found." } }];
    if (p === "/v1/terminal/sso") return body?.token === "sso-one-time-0001" ? [200, { token: TRADE.own, expiresAt: "2026-10-01T00:00:00Z", readOnly: false, account: { login: 50000001, userId: 42, group: "pro-netting", route: "B", version: 3, balance: 100 } }] : [401, { error: { code: "invalid_token", message: "x" } }];
    if (p === "/v1/groups") return [200, { groups: [{ code: "pro-netting", spreadGroup: "pro" }] }];
    if (p === "/v1/terminal/state") {
      const t = bearer(req);
      if (t === TRADE.own) return [200, { account: { login: 50000001, userId: 42, group: "pro-netting", route: "B" }, positions: [{ ticket: 1, book: "B", symbol: "EURUSD" }], orders: [] }];
      if (t === TRADE.foreign) return [200, { account: { login: 50000009, userId: 7, group: "standard" }, positions: [], orders: [] }];
      return [401, { error: { code: "unauthorized", message: "x" } }];
    }
    if (p === "/v1/terminal/orders") return [200, { status: "filled", received: body }];
    if (p === "/v1/symbols") return [200, { symbols: [{ symbol: "EURUSD", digits: 5 }] }];
    return [404, {}];
  });
  process.env.GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;
  process.env.TRADING_URL = `http://127.0.0.1:${engine.address().port}`;
});

after(() => {
  gateway?.close();
  engine?.close();
});

const load = async () => ({
  ...(await import("next/server")),
  proxy: (await import("../proxy.ts")).proxy,
  trade: await import("../app/api/mobile/trade/[...path]/route.ts"),
});

const BASE = "https://app.kalkstrade.com";

async function call(m, method, path, { token, trade, body, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  if (trade) h["x-kalks-trade"] = trade;
  if (body !== undefined) h["content-type"] = "application/json";
  const init = { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined };
  const res0 = await m.proxy(new m.NextRequest(`${BASE}/api/mobile/trade/${path}`, init));
  const ph = Object.fromEntries(res0.headers.entries());
  if (!ph["x-middleware-next"]) return res0; // refused by the proxy
  const fwd = new Headers();
  for (const k of (ph["x-middleware-override-headers"] ?? "").split(",").filter(Boolean)) fwd.set(k, ph[`x-middleware-request-${k}`]);
  const req = new m.NextRequest(`${BASE}/api/mobile/trade/${path}`, { method, headers: fwd, body: init.body });
  return m.trade[method](req, { params: Promise.resolve({ path: path.split("?")[0].split("/") }) });
}

test("session: SSO for the client's own account, redeemed at once; dealing fields never reach the app", async () => {
  const m = await load();
  const res = await call(m, "POST", "session", { token: TOKENS.user, body: { login: "50000001" } });
  assert.equal(res.status, 200);
  const d = await res.json();
  assert.equal(d.token, TRADE.own);
  assert.equal(d.account.spreadGroup, "pro");
  assert.equal(d.account.userId, undefined);
  assert.equal(d.account.route, undefined);
  assert.equal(calls.findLast((c) => c.path.endsWith("/sso") && c.path.startsWith("/v1/accounts")).headers["x-kalks-user-id"], "42");
});

test("session: another client's account is refused by the engine; bad input and no sign-in are refused", async () => {
  const m = await load();
  assert.equal((await call(m, "POST", "session", { token: TOKENS.other, body: { login: "50000001" } })).status, 404);
  assert.equal((await call(m, "POST", "session", { token: TOKENS.user, body: { login: "123" } })).status, 422);
  assert.equal((await call(m, "POST", "session", { body: { login: "50000001" } })).status, 401);
});

test("view-only logins can't open a trading session", async () => {
  const m = await load();
  const res = await call(m, "POST", "session", { token: TOKENS.viewer, body: { login: "50000001" } });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error.code, "viewer_read_only");
});

test("trade calls need both the gateway session and the owner's terminal session", async () => {
  const m = await load();
  const ok = await call(m, "GET", "state", { token: TOKENS.user, trade: TRADE.own });
  assert.equal(ok.status, 200);
  const st = await ok.json();
  assert.equal(st.account.spreadGroup, "pro");
  assert.equal(st.positions[0].book, undefined);
  // a terminal session without a signed-in client
  assert.equal((await call(m, "GET", "state", { trade: TRADE.own })).status, 401);
  // someone else's terminal session with my gateway session
  const foreign = await call(m, "GET", "state", { token: TOKENS.user, trade: TRADE.foreign });
  assert.equal(foreign.status, 403);
  // my terminal session with someone else's gateway session
  assert.equal((await call(m, "GET", "state", { token: TOKENS.other, trade: TRADE.own })).status, 403);
  // no / malformed terminal session
  const none = await call(m, "GET", "state", { token: TOKENS.user });
  assert.equal(none.status, 401);
  assert.equal((await none.json()).error.code, "session_expired");
});

test("orders: validated like Kalks Trader, always manual, platform from the app", async () => {
  const m = await load();
  const res = await call(m, "POST", "orders", { token: TOKENS.user, trade: TRADE.own, headers: { "x-kalks-platform": "ios" }, body: { symbol: "EURUSD", side: "buy", type: "market", volume: 0.1, source: "copy", platform: "API" } });
  assert.equal(res.status, 200);
  const sent = calls.findLast((c) => c.path === "/v1/terminal/orders").body;
  assert.equal(sent.source, "manual");
  assert.equal(sent.platform, "iOS");
  assert.equal(sent.volume, 0.1);
  assert.equal((await call(m, "POST", "orders", { token: TOKENS.user, trade: TRADE.own, body: { symbol: "EURUSD", side: "hold", type: "market", volume: 1 } })).status, 422);
  assert.equal((await call(m, "POST", "orders", { token: TOKENS.user, trade: TRADE.own, body: { symbol: "eur usd", side: "buy", type: "market", volume: 1 } })).status, 422);
});

test("read-only staff sessions can't trade from the app", async () => {
  const m = await load();
  const before = calls.filter((c) => c.path === "/v1/terminal/orders").length;
  const res = await call(m, "POST", "orders", { token: TOKENS.staffRead, trade: TRADE.own, body: { symbol: "EURUSD", side: "buy", type: "market", volume: 0.1 } });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error.code, "staff_read_only");
  assert.equal(calls.filter((c) => c.path === "/v1/terminal/orders").length, before);
});

test("contract specs need a signed-in client", async () => {
  const m = await load();
  assert.equal((await call(m, "GET", "symbols", { token: TOKENS.user })).status, 200);
  assert.equal((await call(m, "GET", "symbols", {})).status, 401);
});
