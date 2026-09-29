// Mobile app trading accounts (/api/mobile/trading/* rewrites and the native /api/mobile/accounts/options):
// `node --test apps/crm/tests`. The proxy and the route handlers run as they are, against stub gateway / engine
// servers on loopback ports; no real service or secret is involved.
//
// What the app relies on: identity always comes from the bearer session (never the body), view-only and read-only
// staff sessions can't change anything, prop groups and switched-off demo accounts are refused before the engine,
// leverage is refused while positions are open before the emailed confirmation is spent, and passwords / leverage
// need a step-up token the gateway redeems exactly once.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import "./helpers/ts-hooks.mjs";

const TOKENS = {
  user: "u".repeat(43),
  viewer: `v.${"w".repeat(43)}`,
  staffRead: `i.${"r".repeat(43)}`,
  staffFull: `s.${"f".repeat(43)}`,
};
const USER = { id: 42, email: "arjun@example.com", first_name: "Arjun", last_name: "Mehta", name: "Arjun Mehta", kyc_status: "verified", tenant: { slug: "kalks", name: "Kalks" } };
const VIEWER = { id: 7, label: "Accountant", username: "acc", accounts: ["50000001"], sections: ["accounts"], expires_at: null, status: "active", last_login_at: null, created_at: "2026-09-01T00:00:00Z" };

const account = (login, extra = {}) => ({
  login,
  userId: 42,
  type: "live",
  group: "standard",
  groupName: "Standard",
  mode: "hedging",
  cent: false,
  currency: "USD",
  leverage: 100,
  leverages: [50, 100, 500],
  status: "active",
  name: "",
  route: "B",
  version: 3,
  positions: 0,
  orders: 0,
  controls: { tradingDisabled: false, closeOnly: false, maxLot: null, execDelayMs: 0, markupPips: 0.4 },
  balance: 1000,
  credit: 0,
  bonus: 0,
  profit: 0,
  swap: 0,
  equity: 1000,
  margin: 0,
  freeMargin: 1000,
  marginLevel: null,
  demo: null,
  createdAt: "2026-09-20T10:00:00Z",
  ...extra,
});

const ACCOUNTS = {
  50000001: account(50000001),
  50000002: account(50000002, { positions: 2, margin: 80, marginLevel: 1250 }),
  60000001: account(60000001, { type: "demo", demo: { initialBalance: 10000, refillsPerDay: 3, refillsUsedToday: 1, expiryDays: 10 } }),
};

const calls = []; // every upstream request: {svc, method, path, headers, body}
let gateway, engineSvc;

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
const engineCalls = (method, path) => calls.filter((c) => c.svc === "engine" && c.method === method && c.path.split("?")[0] === path);
const consumes = () => calls.filter((c) => c.svc === "gateway" && c.path === "/v1/auth/stepup/consume");

before(async () => {
  gateway = await stub("gateway", (req, body) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/v1/public/tenant-config") {
      // the broker of on.broker.test has demo accounts on; every other broker here has them switched off
      const on = req.headers["x-kalks-host"] === "on.broker.test";
      return [200, { maintenance: { active: false }, modules: {}, flags: on ? {} : { demo_accounts: false } }];
    }
    if (url.pathname === "/v1/auth/stepup/consume") return body?.token === "st-ok" ? [200, { status: "ok" }] : [403, { error: { code: "stepup_invalid", message: "This confirmation has expired or was already used. Confirm the change again." } }];
    if (url.pathname === "/v1/auth/impersonation/event") return [200, { status: "ok" }];
    if (url.pathname === "/v1/auth/me") {
      const t = bearer(req);
      if (t === TOKENS.user || t === TOKENS.staffRead || t === TOKENS.staffFull) return [200, { user: USER, viewer: null, session: { id: 1, idle_minutes: 60, expires_at: "2026-10-07T00:00:00Z" } }];
      if (t === TOKENS.viewer) return [200, { user: USER, viewer: VIEWER }];
      return [401, { error: { code: "unauthorized", message: "Please sign in." } }];
    }
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  engineSvc = await stub("engine", (req, body) => {
    const url = new URL(req.url, "http://x");
    const p = url.pathname;
    if (req.headers["x-kalks-user-id"] !== "42") return [404, { error: { code: "not_found", message: "Account not found" } }];
    if (req.method === "GET" && p === "/v1/groups")
      return [200, { groups: [{ code: "standard", name: "Standard", route: "B", tenantId: 1, enabled: true, accountTypes: "both" }, { code: "prop-100k", name: "Prop 100K", route: "A", tenantId: 1, enabled: true, accountTypes: "live" }] }];
    if (req.method === "GET" && p === "/v1/accounts") return [200, { accounts: Object.values(ACCOUNTS) }];
    const m = /^\/v1\/accounts\/(\d+)(?:\/(.+))?$/.exec(p);
    if (req.method === "GET" && m && !m[2]) return ACCOUNTS[m[1]] ? [200, { account: ACCOUNTS[m[1]], positions: [], orders: [] }] : [404, { error: { code: "not_found", message: "Account not found" } }];
    if (req.method === "POST" && p === "/v1/accounts") return [200, { account: account(50000009, { type: body.type, group: body.group, leverage: body.leverage }), credentials: { login: 50000009, password: body.password ? undefined : "Gen3ratedPw", investorPassword: "Inv3storPw" } }];
    if (req.method === "POST" && m?.[2] === "leverage") return [200, { status: "ok", from: ACCOUNTS[m[1]].leverage, leverage: body.leverage }];
    if (req.method === "POST" && m?.[2] === "passwords") return [200, { status: "ok", sessionsRevoked: 1 }];
    if (req.method === "POST" && m?.[2] === "demo-refill") return [200, { status: "ok", amount: 500, balance: 10000 }];
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  process.env.GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;
  process.env.TRADING_URL = `http://127.0.0.1:${engineSvc.address().port}`;
});

after(() => {
  gateway?.close();
  engineSvc?.close();
});

// modules read their upstream URLs at import time: import them after the stubs are listening
const load = async () => ({
  ...(await import("next/server")),
  mobile: await import("../lib/mobile.ts"),
  proxy: (await import("../proxy.ts")).proxy,
  trading: await import("../app/api/trading/[...path]/route.ts"),
  options: await import("../app/api/mobile/accounts/options/route.ts"),
});

const BASE = "https://app.kalkstrade.com";
const headersOf = (res) => Object.fromEntries(res.headers.entries());
const json = (token, body, extra = {}) => ({ method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...extra }, body: JSON.stringify(body) });
const get = (token, extra = {}) => ({ headers: { authorization: `Bearer ${token}`, ...extra } });

/** Runs a request through the proxy, then (like Next) through the handler it rewrites / passes to. */
async function viaProxy(m, url, init, handler, params) {
  const req = new m.NextRequest(`${BASE}${url}`, init);
  const res = await m.proxy(req);
  const h = headersOf(res);
  if (!h["x-middleware-rewrite"] && !h["x-middleware-next"]) return { res, forwarded: null };
  const overridden = (h["x-middleware-override-headers"] ?? "").split(",").filter(Boolean);
  const fwd = new Headers();
  for (const k of overridden) fwd.set(k, h[`x-middleware-request-${k}`]);
  const target = h["x-middleware-rewrite"] ?? `${BASE}${url}`;
  const inner = new m.NextRequest(target, { method: init?.method ?? "GET", headers: fwd, body: init?.body });
  return { res: await handler(inner, { params: Promise.resolve(params) }), forwarded: fwd, target };
}

const trading = (m, url, init, path) => viaProxy(m, `/api/mobile/trading/${url}`, init, init?.method === "POST" ? m.trading.POST : m.trading.GET, { path });

/* ------------------------------------------------------------------ */
/* Routing                                                             */
/* ------------------------------------------------------------------ */

test("accounts paths: trading/* is a rewrite of the cookie route, accounts/* is native", async () => {
  const { mobile } = await load();
  assert.deepEqual(mobile.mobileRoute("/api/mobile/trading/accounts/50000001/leverage"), { kind: "rewrite", target: "/api/trading/accounts/50000001/leverage", policyPath: "/api/trading/accounts/50000001/leverage" });
  assert.deepEqual(mobile.mobileRoute("/api/mobile/accounts/options"), { kind: "native", target: "/api/mobile/accounts/options", policyPath: "/api/mobile/accounts/options" });
  assert.equal(mobile.mobileRoute("/api/mobile/accounts/../trading/accounts"), null);
});

/* ------------------------------------------------------------------ */
/* accounts/options (native)                                           */
/* ------------------------------------------------------------------ */

test("options: signed-in only; follows the broker's demo switch", async () => {
  const m = await load();
  const none = await viaProxy(m, "/api/mobile/accounts/options", {}, m.options.GET, {});
  assert.equal(none.res.status, 401);
  const dead = await viaProxy(m, "/api/mobile/accounts/options", get("d".repeat(43)), m.options.GET, {});
  assert.equal(dead.res.status, 401);
  const off = await viaProxy(m, "/api/mobile/accounts/options", get(TOKENS.user, { "x-forwarded-host": "off.broker.test" }), m.options.GET, {});
  assert.equal(off.res.status, 200);
  assert.deepEqual(await off.res.json(), { demoAccounts: false });
  const on = await viaProxy(m, "/api/mobile/accounts/options", get(TOKENS.user, { "x-forwarded-host": "on.broker.test" }), m.options.GET, {});
  assert.deepEqual(await on.res.json(), { demoAccounts: true });
  assert.equal(on.res.headers.get("cache-control"), "no-store");
});

test("options: a view-only login is kept out (it can't open accounts)", async () => {
  const m = await load();
  const { res } = await viaProxy(m, "/api/mobile/accounts/options", get(TOKENS.viewer), m.options.GET, {});
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error.code, "viewer_scope");
});

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

test("accounts list: identity from the session; dealing details never reach the app", async () => {
  const m = await load();
  const { res, target } = await trading(m, "accounts?user_id=999", get(TOKENS.user), ["accounts"]);
  assert.equal(target, `${BASE}/api/trading/accounts?user_id=999`);
  assert.equal(res.status, 200);
  const { accounts } = await res.json();
  assert.equal(accounts.length, 3);
  for (const a of accounts) {
    assert.equal(a.route, undefined);
    assert.equal(a.userId, undefined);
    assert.equal(a.version, undefined);
    assert.equal(a.controls.markupPips, undefined);
  }
  const sent = engineCalls("GET", "/v1/accounts").at(-1);
  assert.equal(sent.headers["x-kalks-user-id"], "42");
  assert.ok(!sent.path.includes("999"), "a user id from the app is never forwarded");
});

test("groups: prop-challenge groups and routing are removed", async () => {
  const m = await load();
  const { res } = await trading(m, "groups", get(TOKENS.user), ["groups"]);
  const { groups } = await res.json();
  assert.deepEqual(groups.map((g) => g.code), ["standard"]);
  assert.equal(groups[0].route, undefined);
  assert.equal(groups[0].tenantId, undefined);
});

test("a view-only login reads only the accounts it was given", async () => {
  const m = await load();
  const { res } = await trading(m, "accounts", get(TOKENS.viewer), ["accounts"]);
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).accounts.map((a) => a.login), [50000001]);
  const other = await trading(m, "accounts/50000002", get(TOKENS.viewer), ["accounts", "50000002"]);
  assert.equal(other.res.status, 404);
});

/* ------------------------------------------------------------------ */
/* Open an account                                                     */
/* ------------------------------------------------------------------ */

test("open: the engine gets the session's user; generated credentials come back once", async () => {
  const m = await load();
  const { res } = await trading(m, "accounts", json(TOKENS.user, { type: "live", group: "standard", leverage: 500, name: "  Gold swing  ", userId: 999 }), ["accounts"]);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.account.login, 50000009);
  assert.equal(data.account.route, undefined);
  assert.equal(data.credentials.password, "Gen3ratedPw");
  assert.equal(data.credentials.investorPassword, "Inv3storPw");
  const sent = engineCalls("POST", "/v1/accounts").at(-1);
  assert.equal(sent.headers["x-kalks-user-id"], "42");
  assert.deepEqual(sent.body, { type: "live", group: "standard", leverage: 500, name: "Gold swing" });
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("open: an own password is echoed back so it can be shown once", async () => {
  const m = await load();
  const { res } = await trading(m, "accounts", json(TOKENS.user, { type: "live", group: "standard", leverage: 100, password: "MyOwn2026x" }), ["accounts"]);
  const data = await res.json();
  assert.equal(data.credentials.password, "MyOwn2026x");
  assert.equal(engineCalls("POST", "/v1/accounts").at(-1).body.password, "MyOwn2026x");
});

test("open: prop groups and switched-off demo accounts are refused before the engine", async () => {
  const m = await load();
  const n = engineCalls("POST", "/v1/accounts").length;
  const prop = await trading(m, "accounts", json(TOKENS.user, { type: "live", group: "prop-100k", leverage: 100 }), ["accounts"]);
  assert.equal(prop.res.status, 422);
  const demo = await trading(m, "accounts", json(TOKENS.user, { type: "demo", group: "standard", leverage: 100, initialBalance: 10000 }), ["accounts"]);
  assert.equal(demo.res.status, 403);
  assert.equal((await demo.res.json()).error.code, "feature_disabled");
  const bad = await trading(m, "accounts", json(TOKENS.user, { type: "savings", group: "standard" }), ["accounts"]);
  assert.equal(bad.res.status, 422);
  assert.equal(engineCalls("POST", "/v1/accounts").length, n);
});

test("open: view-only and read-only staff sessions can't open accounts; a full staff session is audited", async () => {
  const m = await load();
  const n = engineCalls("POST", "/v1/accounts").length;
  const viewer = await trading(m, "accounts", json(TOKENS.viewer, { type: "live", group: "standard", leverage: 100 }), ["accounts"]);
  assert.equal(viewer.res.status, 403);
  assert.equal((await viewer.res.json()).error.code, "viewer_read_only");
  const staff = await trading(m, "accounts", json(TOKENS.staffRead, { type: "live", group: "standard", leverage: 100 }), ["accounts"]);
  assert.equal(staff.res.status, 403);
  assert.equal((await staff.res.json()).error.code, "staff_read_only");
  assert.equal(engineCalls("POST", "/v1/accounts").length, n);
  const ev = calls.filter((c) => c.path === "/v1/auth/impersonation/event").at(-1);
  assert.equal(ev.body.kind, "write_refused");
  assert.equal(ev.body.path, "/api/trading/accounts");
  const full = await trading(m, "accounts", json(TOKENS.staffFull, { type: "live", group: "standard", leverage: 100 }), ["accounts"]);
  assert.equal(full.res.status, 200);
  assert.equal(calls.filter((c) => c.path === "/v1/auth/impersonation/event").at(-1).body.kind, "action");
});

/* ------------------------------------------------------------------ */
/* Leverage, passwords, demo refill                                    */
/* ------------------------------------------------------------------ */

test("leverage: refused while positions are open, before the emailed confirmation is spent", async () => {
  const m = await load();
  const before = consumes().length;
  const { res } = await trading(m, "accounts/50000002/leverage", json(TOKENS.user, { leverage: 500, stepup_token: "st-ok" }), ["accounts", "50000002", "leverage"]);
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error.code, "positions_open");
  assert.equal(consumes().length, before, "the step-up token is not redeemed");
  assert.equal(engineCalls("POST", "/v1/accounts/50000002/leverage").length, 0);
});

test("leverage: only the account type's values; a step-up token is required and redeemed once", async () => {
  const m = await load();
  const off = await trading(m, "accounts/50000001/leverage", json(TOKENS.user, { leverage: 3000, stepup_token: "st-ok" }), ["accounts", "50000001", "leverage"]);
  assert.equal(off.res.status, 422);
  assert.equal((await off.res.json()).error.code, "invalid_leverage");
  const missing = await trading(m, "accounts/50000001/leverage", json(TOKENS.user, { leverage: 500 }), ["accounts", "50000001", "leverage"]);
  assert.equal(missing.res.status, 403);
  assert.equal((await missing.res.json()).error.code, "stepup_required");
  const spent = await trading(m, "accounts/50000001/leverage", json(TOKENS.user, { leverage: 500, stepup_token: "st-used" }), ["accounts", "50000001", "leverage"]);
  assert.equal(spent.res.status, 403);
  assert.equal((await spent.res.json()).error.code, "stepup_invalid");
  assert.equal(engineCalls("POST", "/v1/accounts/50000001/leverage").length, 0);
  const ok = await trading(m, "accounts/50000001/leverage", json(TOKENS.user, { leverage: 500, stepup_token: "st-ok" }), ["accounts", "50000001", "leverage"]);
  assert.equal(ok.res.status, 200);
  assert.deepEqual(await ok.res.json(), { status: "ok", from: 100, leverage: 500 });
  const c = consumes().at(-1);
  assert.deepEqual(c.body, { token: "st-ok", user_id: 42, action: "leverage", target: "50000001" });
});

test("passwords: the rule is checked before the confirmation; the token is bound to the kind and the login", async () => {
  const m = await load();
  const before = consumes().length;
  const weak = await trading(m, "accounts/50000001/passwords", json(TOKENS.user, { kind: "trading", password: "short", stepup_token: "st-ok" }), ["accounts", "50000001", "passwords"]);
  assert.equal(weak.res.status, 422);
  assert.equal(consumes().length, before);
  const ok = await trading(m, "accounts/50000001/passwords", json(TOKENS.user, { kind: "investor", password: "Watch2026x", stepup_token: "st-ok" }), ["accounts", "50000001", "passwords"]);
  assert.equal(ok.res.status, 200);
  assert.equal((await ok.res.json()).sessionsRevoked, 1);
  assert.deepEqual(consumes().at(-1).body, { token: "st-ok", user_id: 42, action: "investor_password", target: "50000001" });
  assert.deepEqual(engineCalls("POST", "/v1/accounts/50000001/passwords").at(-1).body, { kind: "investor", password: "Watch2026x" });
  // someone else's account: not found, and the confirmation stays unspent
  const n = consumes().length;
  const foreign = await trading(m, "accounts/70000001/passwords", json(TOKENS.user, { kind: "trading", password: "Trade2026x", stepup_token: "st-ok" }), ["accounts", "70000001", "passwords"]);
  assert.equal(foreign.res.status, 404);
  assert.equal(consumes().length, n);
});

test("demo refill goes to the engine for the session's user; viewers can't refill", async () => {
  const m = await load();
  const { res } = await trading(m, "accounts/60000001/demo-refill", json(TOKENS.user, {}), ["accounts", "60000001", "demo-refill"]);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok", amount: 500, balance: 10000 });
  assert.equal(engineCalls("POST", "/v1/accounts/60000001/demo-refill").at(-1).headers["x-kalks-user-id"], "42");
  const viewer = await trading(m, "accounts/60000001/demo-refill", json(TOKENS.viewer, {}), ["accounts", "60000001", "demo-refill"]);
  assert.equal(viewer.res.status, 403);
});

test("a browser cookie never authenticates a mobile accounts request", async () => {
  const m = await load();
  const n = engineCalls("POST", "/v1/accounts").length;
  const { res } = await trading(m, "accounts", { method: "POST", headers: { "content-type": "application/json", cookie: `kalks_session=${TOKENS.user}`, origin: "https://evil.example" }, body: JSON.stringify({ type: "live", group: "standard" }) }, ["accounts"]);
  assert.ok(res.status === 401 || res.status === 403, `got ${res.status}`);
  assert.equal(engineCalls("POST", "/v1/accounts").length, n);
});
