// Mobile app Algo (/algo: strategies, deployments, backtests, marketplace, API keys and webhooks) through
// /api/mobile/algo/*, the bearer rewrite of the Client Area's algo BFF: `node --test apps/crm/tests`. The proxy and
// the route handler run as they are, against stub gateway / algo servers on loopback ports; no real service or
// secret is involved.
//
// What the app relies on: the client always comes from the bearer session (never the body); deployment controls and
// the kill switch forward the client's explicit choice about open positions; only the documented query keys reach
// the service (log pages); view-only logins can't read Algo and read-only staff sessions can read but change nothing;
// the broker's "algo" and "api" module switches hold before the service (the kill switch follows "algo", where it
// lives); creating API keys stays possible only where the web allows it, revoking is the only key change besides
// the web's edits; the service's back-office routes stay unreachable.

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
const VIEWER = { id: 7, label: "Accountant", username: "acc", accounts: ["50000001"], sections: ["accounts", "wallet", "history", "dashboard"], expires_at: null, status: "active", last_login_at: null, created_at: "2026-09-01T00:00:00Z" };

const calls = []; // every upstream request: {svc, method, path, headers, body}
let gateway, algoSvc;

function stub(name, handle) {
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);
    const body = (req.headers["content-type"] ?? "").includes("application/json") && raw.length ? JSON.parse(raw.toString()) : undefined;
    calls.push({ svc: name, method: req.method, path: req.url, headers: req.headers, body });
    const [status, data] = await handle(req, body);
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(data));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

const bearer = (req) => (req.headers.authorization ?? "").replace(/^Bearer /, "");
const upstream = (method, path) => calls.filter((c) => c.svc === "algo" && c.method === method && c.path.split("?")[0] === path);
const algoCount = () => calls.filter((c) => c.svc === "algo").length;

before(async () => {
  gateway = await stub("gateway", (req) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/v1/public/tenant-config") {
      const host = req.headers["x-kalks-host"];
      const modules = host === "noalgo.broker.test" ? { algo: false } : host === "noapi.broker.test" ? { api: false } : {};
      return [200, { maintenance: { active: false }, modules, flags: {} }];
    }
    if (url.pathname === "/v1/auth/impersonation/event") return [200, { status: "ok" }];
    if (url.pathname === "/v1/auth/me") {
      const t = bearer(req);
      if (t === TOKENS.user || t === TOKENS.staffRead || t === TOKENS.staffFull) return [200, { user: USER, viewer: null }];
      if (t === TOKENS.viewer) return [200, { user: USER, viewer: VIEWER }];
      return [401, { error: { code: "unauthorized", message: "Please sign in." } }];
    }
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  algoSvc = await stub("algo", (req, body) => {
    const p = new URL(req.url, "http://x").pathname;
    if (req.method === "GET" && p === "/v1/deployments") return [200, { items: [{ id: 5, status: "running", strategyId: 9, login: 50000001, stats: { realized: 12.5 } }] }];
    if (req.method === "GET" && p === "/v1/deployments/5") return [200, { id: 5, status: "running", logs: [], positions: [], daily: [], rulesHidden: false }];
    const act = /^\/v1\/deployments\/5\/(pause|resume|stop|kill|close-positions)$/.exec(p);
    if (act) return [200, act[1] === "stop" || act[1] === "kill" ? { status: act[1] === "kill" ? "killed" : "stopped", closed: body?.closePositions ? 2 : 0, failed: 0 } : act[1] === "close-positions" ? { closed: 2, failed: 0 } : { status: act[1] === "pause" ? "paused" : "running" }];
    if (p === "/v1/controls") return [200, { killed: false, killedAt: null, killedBy: null, reason: null, globalKill: false }];
    if (p === "/v1/controls/kill") return [200, { killed: body?.killed, stopped: body?.killed ? 3 : 0, closed: body?.closePositions ? 4 : 0, failed: 0 }];
    if (p === "/v1/strategies") return [200, { items: [] }];
    if (p === "/v1/strategies/9" && req.method === "PATCH") return [200, { status: "ok" }];
    if (p === "/v1/backtests" && req.method === "POST") return [200, { id: 3, status: "queued" }];
    if (p === "/v1/backtests/3/cancel") return [200, { status: "cancelled" }];
    if (p === "/v1/market/listings") return [200, { items: [{ id: 4, house: true, priceMonthly: 0 }], subscribed: [], platformCutPct: 20 }];
    if (p === "/v1/market/listings/4") return [200, { id: 4, house: true, subscription: null, reviews: [] }];
    if (p === "/v1/market/listings/4/subscribe") return [200, { id: 11, status: "active", mode: body?.mode, deploymentId: body?.mode === "copy" ? 6 : null, clonedStrategyId: null, charged: 0 }];
    if (p === "/v1/market/listings/4/reviews") return [200, { status: "ok" }];
    if (p === "/v1/market/subscriptions") return [200, { items: [] }];
    if (p === "/v1/market/subscriptions/11/cancel") return [200, { status: "cancelled" }];
    if (p === "/v1/keys") return [200, { items: [], usage: {}, baseUrl: "http://x/public/v1" }];
    if (p === "/v1/keys/9/revoke") return [200, { status: "revoked" }];
    if (p === "/v1/webhooks") return [200, { items: [], events: [], baseUrl: "http://x/hooks/" }];
    if (p === "/v1/webhooks/2") return [200, { status: req.method === "DELETE" ? "deleted" : "ok" }];
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  process.env.GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;
  process.env.ALGO_URL = `http://127.0.0.1:${algoSvc.address().port}`;
  process.env.ALGO_INTERNAL_TOKEN = "algo-internal";
});

after(() => {
  gateway?.close();
  algoSvc?.close();
});

// modules read their upstream URLs at import time: import them after the stubs are listening
const load = async () => ({
  ...(await import("next/server")),
  mobile: await import("../lib/mobile.ts"),
  proxy: (await import("../proxy.ts")).proxy,
  algo: await import("../app/api/algo/[...path]/route.ts"),
});

const BASE = "https://app.kalkstrade.com";
const headersOf = (res) => Object.fromEntries(res.headers.entries());

/** Runs a request through the proxy, then (like Next) through the algo handler it rewrites to. */
async function viaProxy(m, url, init = {}) {
  const req = new m.NextRequest(`${BASE}${url}`, { ...init, headers: { host: "app.kalkstrade.com", ...init.headers } });
  const res = await m.proxy(req);
  const h = headersOf(res);
  if (!h["x-middleware-rewrite"]) return { res };
  const overridden = (h["x-middleware-override-headers"] ?? "").split(",").filter(Boolean);
  const fwd = new Headers();
  for (const k of overridden) fwd.set(k, h[`x-middleware-request-${k}`]);
  const target = new URL(h["x-middleware-rewrite"]);
  const method = init.method ?? "GET";
  const inner = new m.NextRequest(target, { method, headers: fwd, body: init.body });
  const path = target.pathname.replace(/^\/api\/algo\//, "").split("/");
  return { res: await m.algo[method](inner, { params: Promise.resolve({ path }) }), target };
}

const send = (m, method, path, token, body, extra = {}) =>
  viaProxy(m, `/api/mobile/${path}`, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
const get = (m, path, token, extra) => send(m, "GET", path, token, undefined, extra);
const post = (m, path, token, body = {}, extra) => send(m, "POST", path, token, body, extra);

test("algo is a rewrite family of the cookie BFF", async () => {
  const { mobile } = await load();
  assert.deepEqual(mobile.mobileRoute("/api/mobile/algo/deployments/5/kill"), { kind: "rewrite", target: "/api/algo/deployments/5/kill", policyPath: "/api/algo/deployments/5/kill" });
  assert.deepEqual(mobile.mobileRoute("/api/mobile/algo/market/listings/4/subscribe"), { kind: "rewrite", target: "/api/algo/market/listings/4/subscribe", policyPath: "/api/algo/market/listings/4/subscribe" });
});

test("deployment controls name the session's user and forward the client's choice about open positions", async () => {
  const m = await load();
  for (const [action, body, closed] of [
    ["stop", { closePositions: false }, 0],
    ["stop", { closePositions: true }, 2],
    ["kill", { closePositions: true }, 2],
    ["kill", { closePositions: false }, 0],
  ]) {
    const { res } = await post(m, `algo/deployments/5/${action}`, TOKENS.user, { ...body, userId: 999, user_id: 999 });
    assert.equal(res.status, 200, action);
    assert.equal((await res.json()).closed, closed, `${action} ${JSON.stringify(body)}`);
    const c = upstream("POST", `/v1/deployments/5/${action}`).at(-1);
    assert.equal(c.headers["x-kalks-user-id"], "42");
    assert.equal(c.headers["x-kalks-internal"], "algo-internal");
    assert.equal(c.body.closePositions, body.closePositions);
  }
  for (const action of ["pause", "resume", "close-positions"]) {
    const { res } = await post(m, `algo/deployments/5/${action}`, TOKENS.user, {});
    assert.equal(res.status, 200, action);
    assert.equal(upstream("POST", `/v1/deployments/5/${action}`).at(-1).headers["x-kalks-user-id"], "42", action);
  }
});

test("log pages: only the documented query keys reach the service", async () => {
  const m = await load();
  const { res } = await get(m, "algo/deployments/5?before=100&limit=60&user_id=7&userId=7", TOKENS.user);
  assert.equal(res.status, 200);
  const q = new URL(upstream("GET", "/v1/deployments/5").at(-1).path, "http://x").searchParams;
  assert.equal(q.get("before"), "100");
  assert.equal(q.get("limit"), "60");
  assert.equal(q.get("user_id"), null);
  assert.equal(q.get("userId"), null);
});

test("the account-wide kill switch forwards the close choice; releasing it sends no close", async () => {
  const m = await load();
  let r = await post(m, "algo/controls/kill", TOKENS.user, { killed: true, closePositions: true });
  assert.equal(r.res.status, 200);
  assert.deepEqual(await r.res.json(), { killed: true, stopped: 3, closed: 4, failed: 0 });
  r = await post(m, "algo/controls/kill", TOKENS.user, { killed: false, closePositions: false });
  assert.equal(r.res.status, 200);
  const c = upstream("POST", "/v1/controls/kill").at(-1);
  assert.equal(c.body.killed, false);
  assert.equal(c.body.closePositions, false);
  assert.equal(c.headers["x-kalks-user-id"], "42");
});

test("marketplace: subscribe, review and cancel as the session's user; the listing decides free / paid server side", async () => {
  const m = await load();
  let r = await post(m, "algo/market/listings/4/subscribe", TOKENS.user, { mode: "copy", login: 50000001, risk: { lotMultiplier: 0.5 }, price: 0, charged: 0 });
  assert.equal(r.res.status, 200);
  assert.equal((await r.res.json()).deploymentId, 6);
  const sub = upstream("POST", "/v1/market/listings/4/subscribe").at(-1);
  assert.equal(sub.headers["x-kalks-user-id"], "42");
  assert.deepEqual(sub.body.risk, { lotMultiplier: 0.5 });
  r = await post(m, "algo/market/listings/4/reviews", TOKENS.user, { rating: 4, comment: "ok" });
  assert.equal(r.res.status, 200);
  r = await post(m, "algo/market/subscriptions/11/cancel", TOKENS.user, {});
  assert.equal(r.res.status, 200);
  assert.equal(upstream("POST", "/v1/market/subscriptions/11/cancel").at(-1).headers["x-kalks-user-id"], "42");
});

test("API keys: revoke goes through; deleting or rotating a key isn't a route; webhooks switch off and delete", async () => {
  const m = await load();
  let r = await post(m, "algo/keys/9/revoke", TOKENS.user, {});
  assert.equal(r.res.status, 200);
  const before = algoCount();
  r = await send(m, "DELETE", "algo/keys/9", TOKENS.user);
  assert.equal(r.res.status, 404);
  r = await post(m, "algo/keys/9/rotate", TOKENS.user, {});
  assert.equal(r.res.status, 404);
  assert.equal(algoCount(), before, "refused before the service");
  r = await send(m, "PATCH", "algo/webhooks/2", TOKENS.user, { status: "disabled" });
  assert.equal(r.res.status, 200);
  assert.equal(upstream("PATCH", "/v1/webhooks/2").at(-1).body.status, "disabled");
  r = await send(m, "DELETE", "algo/webhooks/2", TOKENS.user);
  assert.equal(r.res.status, 200);
  assert.equal(upstream("DELETE", "/v1/webhooks/2").at(-1).headers["x-kalks-user-id"], "42");
});

test("view-only logins can't read Algo or change anything; nothing reaches the service", async () => {
  const m = await load();
  const before = algoCount();
  for (const path of ["algo/deployments", "algo/strategies", "algo/market/listings", "algo/keys", "algo/webhooks", "algo/controls"]) {
    const { res } = await get(m, path, TOKENS.viewer);
    assert.equal(res.status, 403, path);
  }
  for (const [path, body] of [
    ["algo/deployments/5/kill", { closePositions: true }],
    ["algo/controls/kill", { killed: true }],
    ["algo/market/listings/4/subscribe", { mode: "copy", login: 50000001 }],
    ["algo/keys/9/revoke", {}],
  ]) {
    const { res } = await post(m, path, TOKENS.viewer, body);
    assert.equal(res.status, 403, path);
    assert.equal((await res.json()).error.code, "viewer_read_only", path);
  }
  assert.equal(algoCount(), before);
});

test("read-only staff sessions read Algo but every change is refused before the service", async () => {
  const m = await load();
  for (const path of ["algo/deployments", "algo/deployments/5", "algo/market/listings", "algo/keys"]) {
    const { res } = await get(m, path, TOKENS.staffRead);
    assert.equal(res.status, 200, path);
  }
  const before = algoCount();
  for (const [method, path, body] of [
    ["POST", "algo/deployments/5/pause", {}],
    ["POST", "algo/deployments/5/stop", { closePositions: false }],
    ["POST", "algo/controls/kill", { killed: true, closePositions: true }],
    ["POST", "algo/backtests", { strategyId: 9, from: 1, to: 2 }],
    ["POST", "algo/market/listings/4/subscribe", { mode: "copy", login: 50000001 }],
    ["POST", "algo/keys/9/revoke", {}],
    ["PATCH", "algo/webhooks/2", { status: "disabled" }],
    ["PATCH", "algo/strategies/9", { status: "archived" }],
  ]) {
    const { res } = await send(m, method, path, TOKENS.staffRead, body);
    assert.equal(res.status, 403, path);
    assert.equal((await res.json()).error.code, "staff_read_only", path);
  }
  const del = await send(m, "DELETE", "algo/webhooks/2", TOKENS.staffRead);
  assert.equal(del.res.status, 403);
  assert.equal(algoCount(), before);
  // a full staff session (the client's own consent) acts, and is audited by the gateway
  const { res } = await post(m, "algo/deployments/5/pause", TOKENS.staffFull, {});
  assert.equal(res.status, 200);
  assert.ok(calls.some((c) => c.svc === "gateway" && c.path === "/v1/auth/impersonation/event" && c.body?.kind === "action"));
});

test("broker switches: Algo off refuses strategies, deployments, backtests, the marketplace and the kill switch; API off refuses keys and webhooks only", async () => {
  const m = await load();
  const before = algoCount();
  for (const path of ["algo/deployments", "algo/strategies", "algo/backtests", "algo/market/listings", "algo/controls"]) {
    const { res } = await get(m, path, TOKENS.user, { host: "noalgo.broker.test" });
    assert.equal(res.status, 403, path);
    assert.equal((await res.json()).error.code, "module_disabled", path);
  }
  const kill = await post(m, "algo/controls/kill", TOKENS.user, { killed: true }, { host: "noalgo.broker.test" });
  assert.equal(kill.res.status, 403);
  for (const path of ["algo/keys", "algo/webhooks"]) {
    const { res } = await get(m, path, TOKENS.user, { host: "noapi.broker.test" });
    assert.equal(res.status, 403, path);
    assert.equal((await res.json()).error.code, "module_disabled", path);
  }
  assert.equal(algoCount(), before, "nothing reached the service");
  // the kill switch lives with the running strategies: it stays available when only the API module is off
  const ctl = await get(m, "algo/controls", TOKENS.user, { host: "noapi.broker.test" });
  assert.equal(ctl.res.status, 200);
  const off = await post(m, "algo/controls/kill", TOKENS.user, { killed: true, closePositions: true }, { host: "noapi.broker.test" });
  assert.equal(off.res.status, 200);
  const deps = await get(m, "algo/deployments", TOKENS.user, { host: "noapi.broker.test" });
  assert.equal(deps.res.status, 200);
});

test("the service's back-office routes stay unreachable; a browser cookie never authenticates the app's algo routes", async () => {
  const m = await load();
  const before = algoCount();
  for (const path of ["algo/admin/overview", "algo/admin/house", "algo/admin/deployments/5/kill", "algo/deployments/5/delete"]) {
    const { res } = await get(m, path, TOKENS.user);
    assert.equal(res.status, 404, path);
  }
  const { res } = await viaProxy(m, "/api/mobile/algo/deployments", { headers: { cookie: `kalks_session=${TOKENS.user}` } });
  assert.equal(res.status, 401);
  assert.equal(algoCount(), before);
});
