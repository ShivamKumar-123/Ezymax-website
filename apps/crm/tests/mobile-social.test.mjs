// Mobile app, social trading (/api/mobile/social/* → /api/social/*): `node --test apps/crm/tests`.
// The proxy and the social BFF run as they are, against stub gateway / engine servers on loopback ports; no real
// service or secret is involved. Checks: bearer identity reaches the engine (never a user id from the body),
// view-only and read-only staff sessions can't change anything, stop options and MAM consent are forwarded
// explicitly and validated.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import "./helpers/ts-hooks.mjs";

const TOKENS = {
  user: "u".repeat(43),
  viewer: `v.${"w".repeat(43)}`,
  staffRead: `i.${"r".repeat(43)}`,
};
const USER = { id: 42, email: "arjun@example.com", first_name: "Arjun", last_name: "Mehta", name: "Arjun Mehta", kyc_status: "verified", tenant: { slug: "kalks", name: "Kalks" } };
const VIEWER = {
  id: 7,
  label: "Accountant",
  username: "acc",
  accounts: ["50000001"],
  sections: ["accounts", "wallet"],
  expires_at: null,
  status: "active",
  last_login_at: null,
  created_at: "2026-09-01T00:00:00Z",
};
const HASH = "a".repeat(64);
const PAMM_ONLY_HOST = "pamm-only.example";

const calls = [];
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

before(async () => {
  gateway = await stub("gateway", (req) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/v1/public/tenant-config") {
      // a broker that runs PAMM funds but switched copy trading off
      if (req.headers["x-kalks-host"] === PAMM_ONLY_HOST) return [200, { maintenance: { active: false }, modules: { copy_trading: false, pamm: true }, flags: {} }];
      return [200, { maintenance: { active: false }, modules: {}, flags: {} }];
    }
    if (url.pathname === "/v1/auth/impersonation/event") return [200, { status: "ok" }];
    if (url.pathname === "/v1/auth/me") {
      const t = bearer(req);
      if (t === TOKENS.user || t === TOKENS.staffRead) return [200, { user: USER, viewer: null }];
      if (t === TOKENS.viewer) return [200, { user: USER, viewer: VIEWER }];
      return [401, { error: { code: "unauthorized", message: "Please sign in." } }];
    }
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  engineSvc = await stub("engine", (req, body) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/v1/social/leaderboard")
      return [200, { items: [{ id: 3, nickname: "Gold", login: 10000024, userId: 106, house: true }], totals: { masters: 1, aum: 0, followers: 0, investors: 0 } }];
    if (url.pathname === "/v1/social/subscriptions") return [200, { subscription: { id: 9 }, account: { login: 10000060 }, funding: { status: "done" } }];
    if (/^\/v1\/social\/subscriptions\/\d+\/stop$/.test(url.pathname))
      return [200, { subscription: { id: 9, status: "stopped" }, closed: body?.closePositions === false ? [] : [1], failed: [], returned: null }];
    if (url.pathname === "/v1/social/mam/links") return [200, { link: { id: 5 } }];
    if (url.pathname === "/v1/social/investments") return [200, { items: [], requests: [] }];
    if (/^\/v1\/social\/requests\/\d+\/cancel$/.test(url.pathname)) return [200, { request: { id: 5, status: "cancelled" } }];
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  process.env.GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;
  process.env.TRADING_URL = `http://127.0.0.1:${engineSvc.address().port}`;
});

after(() => {
  gateway?.close();
  engineSvc?.close();
});

const load = async () => ({
  ...(await import("next/server")),
  mobile: await import("../lib/mobile.ts"),
  proxy: (await import("../proxy.ts")).proxy,
  social: await import("../app/api/social/[...path]/route.ts"),
});

const BASE = "https://app.kalkstrade.com";
const headersOf = (res) => Object.fromEntries(res.headers.entries());

/** Runs a request through the proxy, then (like Next) through the social handler it rewrites to. */
async function viaProxy(m, url, init) {
  const req = new m.NextRequest(`${BASE}${url}`, init);
  const res = await m.proxy(req);
  const h = headersOf(res);
  if (!h["x-middleware-rewrite"]) return { res, forwarded: null };
  const overridden = (h["x-middleware-override-headers"] ?? "").split(",").filter(Boolean);
  const fwd = new Headers();
  for (const k of overridden) fwd.set(k, h[`x-middleware-request-${k}`]);
  const target = new URL(h["x-middleware-rewrite"]);
  const inner = new m.NextRequest(target, { method: init?.method ?? "GET", headers: fwd, body: init?.body });
  const path = target.pathname.replace(/^\/api\/social\//, "").split("/");
  const method = init?.method ?? "GET";
  return { res: await m.social[method](inner, { params: Promise.resolve({ path }) }), forwarded: fwd, target };
}

const post = (token, body) => ({ method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const engineCalls = (path) => calls.filter((c) => c.svc === "engine" && c.path.startsWith(path));

test("social is a rewrite family of the cookie BFF", async () => {
  const { mobile } = await load();
  assert.deepEqual(mobile.mobileRoute("/api/mobile/social/leaderboard"), { kind: "rewrite", target: "/api/social/leaderboard", policyPath: "/api/social/leaderboard" });
  assert.deepEqual(mobile.mobileRoute("/api/mobile/social/mam/links/5/revoke"), { kind: "rewrite", target: "/api/social/mam/links/5/revoke", policyPath: "/api/social/mam/links/5/revoke" });
});

test("reads carry the gateway identity and KYC; public master cards never carry the login or user id", async () => {
  const m = await load();
  const { res, target } = await viaProxy(m, "/api/mobile/social/leaderboard?period=3m&sort=return", { headers: { authorization: `Bearer ${TOKENS.user}` } });
  assert.equal(target.pathname, "/api/social/leaderboard");
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.items[0].login, undefined);
  assert.equal(data.items[0].userId, undefined);
  assert.equal(data.items[0].house, true, "the house flag reaches the app (disclosure label)");
  const sent = engineCalls("/v1/social/leaderboard").at(-1);
  assert.equal(sent.headers["x-kalks-user-id"], "42");
  assert.equal(sent.headers["x-kalks-kyc"], "verified");
});

test("the leaderboard query is validated before the engine", async () => {
  const m = await load();
  const n = engineCalls("/v1/social/leaderboard").length;
  const { res } = await viaProxy(m, "/api/mobile/social/leaderboard?period=10y", { headers: { authorization: `Bearer ${TOKENS.user}` } });
  assert.equal(res.status, 400);
  assert.equal(engineCalls("/v1/social/leaderboard").length, n);
});

test("following a master: the body is rebuilt from known fields; a user id in the body is ignored", async () => {
  const m = await load();
  const { res } = await viaProxy(
    m,
    "/api/mobile/social/subscriptions",
    post(TOKENS.user, { masterId: 3, sizing: { mode: "equity", value: 1 }, allocation: 500, maxLot: 1, equityStop: 100, maxDdPct: 30, excludedSymbols: ["USDJPY"], userId: 999, login: 1 }),
  );
  assert.equal(res.status, 200);
  const sent = engineCalls("/v1/social/subscriptions").at(-1);
  assert.equal(sent.headers["x-kalks-user-id"], "42");
  assert.deepEqual(sent.body, { masterId: 3, sizing: { mode: "equity", value: 1 }, allocation: 500, maxLot: 1, equityStop: 100, maxDdPct: 30, excludedSymbols: ["USDJPY"] });
  const bad = await viaProxy(m, "/api/mobile/social/subscriptions", post(TOKENS.user, { masterId: 3, sizing: { mode: "martingale", value: 2 }, allocation: 500 }));
  assert.equal(bad.res.status, 422);
});

test("stopping a subscription sends both options explicitly: close all or keep the positions, return the balance only when asked", async () => {
  const m = await load();
  const stop = async (body) => {
    const { res } = await viaProxy(m, "/api/mobile/social/subscriptions/9/stop", post(TOKENS.user, body));
    assert.equal(res.status, 200);
    return engineCalls("/v1/social/subscriptions/9/stop").at(-1).body;
  };
  assert.deepEqual(await stop({ closePositions: false, returnFunds: false }), { returnFunds: false, closePositions: false });
  assert.deepEqual(await stop({ returnFunds: true }), { returnFunds: true, closePositions: true });
  // the web sends {} when its "move the balance back" box is unticked: nothing goes back, everything closes
  assert.deepEqual(await stop({}), { returnFunds: false, closePositions: true });
  const n = engineCalls("/v1/social/subscriptions/9/stop").length;
  const bad = await viaProxy(m, "/api/mobile/social/subscriptions/9/stop", post(TOKENS.user, { closePositions: "no" }));
  assert.equal(bad.res.status, 422);
  assert.equal(engineCalls("/v1/social/subscriptions/9/stop").length, n);
});

test("a MAM link needs explicit consent: accept:true and the SHA-256 hash of the terms shown", async () => {
  const m = await load();
  const n = engineCalls("/v1/social/mam/links").length;
  for (const body of [
    { managerId: 2, login: 10000087, termsHash: HASH },
    { managerId: 2, login: 10000087, termsHash: "abc", accept: true },
  ]) {
    const { res } = await viaProxy(m, "/api/mobile/social/mam/links", post(TOKENS.user, body));
    assert.equal(res.status, 422);
  }
  assert.equal(engineCalls("/v1/social/mam/links").length, n, "nothing reaches the engine without consent");
  const { res } = await viaProxy(m, "/api/mobile/social/mam/links", post(TOKENS.user, { managerId: 2, login: 10000087, termsHash: HASH, accept: true, maxLot: 1, equityStop: 500 }));
  assert.equal(res.status, 200);
  assert.deepEqual(engineCalls("/v1/social/mam/links").at(-1).body, { managerId: 2, login: 10000087, termsHash: HASH, accept: true, maxLot: 1, equityStop: 500 });
});

test("view-only logins can't open social at all; read-only staff can read but not change anything", async () => {
  const m = await load();
  const viewerRead = await viaProxy(m, "/api/mobile/social/leaderboard", { headers: { authorization: `Bearer ${TOKENS.viewer}` } });
  assert.equal(viewerRead.res.status, 403);
  assert.equal((await viewerRead.res.json()).error.code, "viewer_scope");
  const n = engineCalls("/v1/social/subscriptions").length;
  const viewerWrite = await viaProxy(m, "/api/mobile/social/subscriptions", post(TOKENS.viewer, { masterId: 3, sizing: { mode: "equity", value: 1 }, allocation: 500 }));
  assert.equal(viewerWrite.res.status, 403);
  assert.equal((await viewerWrite.res.json()).error.code, "viewer_read_only");
  const staffWrite = await viaProxy(m, "/api/mobile/social/subscriptions/9/stop", post(TOKENS.staffRead, { closePositions: true }));
  assert.equal(staffWrite.res.status, 403);
  assert.equal((await staffWrite.res.json()).error.code, "staff_read_only");
  assert.equal(engineCalls("/v1/social/subscriptions").length, n, "no social write reached the engine");
  const staffRead = await viaProxy(m, "/api/mobile/social/leaderboard", { headers: { authorization: `Bearer ${TOKENS.staffRead}` } });
  assert.equal(staffRead.res.status, 200);
});

test("a browser cookie never authenticates a mobile social request", async () => {
  const m = await load();
  const n = engineCalls("/v1/social/subscriptions").length;
  const { res } = await viaProxy(m, "/api/mobile/social/subscriptions", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `kalks_session=${TOKENS.user}`, origin: "https://evil.example" },
    body: JSON.stringify({ masterId: 3, sizing: { mode: "equity", value: 1 }, allocation: 500 }),
  });
  assert.ok(res.status === 401 || res.status === 403, `got ${res.status}`);
  assert.equal(engineCalls("/v1/social/subscriptions").length, n);
});

test("a broker with PAMM on and copy trading off: PAMM investments and request cancels stay open, copy trading doesn't", async () => {
  const m = await load();
  const headers = { authorization: `Bearer ${TOKENS.user}`, host: PAMM_ONLY_HOST };
  const inv = await viaProxy(m, "/api/mobile/social/investments", { headers });
  assert.equal(inv.res.status, 200);
  const cancel = await viaProxy(m, "/api/mobile/social/requests/5/cancel", { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: "{}" });
  assert.equal(cancel.res.status, 200);
  assert.equal(engineCalls("/v1/social/requests/5/cancel").length, 1);
  const lb = await viaProxy(m, "/api/mobile/social/leaderboard", { headers });
  assert.equal(lb.res.status, 403);
  assert.equal((await lb.res.json()).error.code, "module_disabled");
});
