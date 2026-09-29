// Mobile app price alerts (native /api/mobile/alerts/*, served by market-data): `node --test apps/crm/tests`.
// The proxy and the route handlers run as they are, against stub gateway / market-data servers on loopback ports;
// no real service or secret is involved.
//
// What the app relies on: the client is always the bearer session's user (never a user id or tenant from the
// request), only the alert fields reach the service, view-only logins can't see or change the owner's alerts,
// read-only staff sessions only read, and the service's answers (409 level_reached / limit, 404) come back as they are.

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
const USER = { id: 42, email: "arjun@example.com", first_name: "Arjun", last_name: "Mehta", name: "Arjun Mehta", kyc_status: "verified", tenant: { slug: "acme", name: "Acme Markets" } };
const VIEWER = { id: 7, label: "Accountant", username: "acc", accounts: ["50000001"], sections: ["accounts", "wallet", "history", "dashboard", "partner"], expires_at: null, status: "active", last_login_at: null, created_at: "2026-09-01T00:00:00Z" };
const INTERNAL = "md-internal-test-token";

const ALERT = { id: 5, symbol: "XAUUSD", condition: "above", value: 2700.5, basis: "bid", group: "standard", reference: null, target: 2700.5, repeat: false, status: "active", note: "", expiresAt: null, triggerCount: 0, triggeredAt: null, lastPrice: null, createdAt: "2026-09-30T10:00:00Z", updatedAt: "2026-09-30T10:00:00Z" };

const calls = []; // every upstream request: {svc, method, path, headers, body}
let gateway, marketData;
let mdDown = false;
let mdWrongToken = false;

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
const mdCalls = () => calls.filter((c) => c.svc === "market-data");

before(async () => {
  gateway = await stub("gateway", (req) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/v1/public/tenant-config") return [200, { maintenance: { active: false }, modules: {}, flags: {} }];
    if (url.pathname === "/v1/auth/impersonation/event") return [200, { status: "ok" }];
    if (url.pathname === "/v1/auth/me") {
      const t = bearer(req);
      if (t === TOKENS.user || t === TOKENS.staffRead || t === TOKENS.staffFull) return [200, { user: USER, viewer: null, session: { id: 1, idle_minutes: 60, expires_at: "2026-10-07T00:00:00Z" } }];
      if (t === TOKENS.viewer) return [200, { user: USER, viewer: VIEWER }];
      return [401, { error: { code: "unauthorized", message: "Please sign in." } }];
    }
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  marketData = await stub("market-data", (req, body) => {
    if (mdWrongToken) return [401, { error: { code: "unauthorized", message: "Internal token required." } }];
    if (req.headers["x-kalks-internal"] !== INTERNAL) return [401, { error: { code: "unauthorized", message: "Internal token required." } }];
    const url = new URL(req.url, "http://x");
    const p = url.pathname;
    if (p === "/v1/internal/alerts" && req.method === "GET") return [200, { items: [ALERT], limit: 50, live: 1 }];
    if (p === "/v1/internal/alerts" && req.method === "POST") {
      if (body.value === 1) return [409, { error: { code: "level_reached", message: "XAUUSD is already above 1.00 (bid 2650.10). Choose a higher level.", field: "value" } }];
      return [201, { alert: { ...ALERT, ...body, id: 6 } }];
    }
    if (p === "/v1/internal/alerts/history" && req.method === "GET") return [200, { items: [], next: null }];
    if (p === "/v1/internal/alerts/history" && req.method === "DELETE") return [200, { ok: true, cleared: 3 }];
    const m = /^\/v1\/internal\/alerts\/(\d+)$/.exec(p);
    if (m && m[1] !== "5") return [404, { error: { code: "not_found", message: "Alert not found." } }];
    if (m && req.method === "PATCH") return [200, { alert: { ...ALERT, ...body } }];
    if (m && req.method === "DELETE") return [200, { ok: true }];
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  process.env.GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;
  process.env.MARKET_DATA_URL = `http://127.0.0.1:${marketData.address().port}`;
  process.env.MARKET_DATA_INTERNAL_TOKEN = INTERNAL;
});

after(() => {
  gateway?.close();
  marketData?.close();
});

// modules read their upstream URLs at import time: import them after the stubs are listening
const load = async () => ({
  ...(await import("next/server")),
  mobile: await import("../lib/mobile.ts"),
  proxy: (await import("../proxy.ts")).proxy,
  list: await import("../app/api/mobile/alerts/route.ts"),
  one: await import("../app/api/mobile/alerts/[id]/route.ts"),
  history: await import("../app/api/mobile/alerts/history/route.ts"),
});

const BASE = "https://app.kalkstrade.com";
const headersOf = (res) => Object.fromEntries(res.headers.entries());
const send = (method, token, body, extra = {}) => ({ method, headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
const get = (token, extra = {}) => ({ headers: { authorization: `Bearer ${token}`, ...extra } });

/** Runs a request through the proxy, then (like Next) through the handler it passes to. */
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

/* ------------------------------------------------------------------ */
/* Routing and sessions                                                */
/* ------------------------------------------------------------------ */

test("alerts paths are native mobile routes", async () => {
  const { mobile } = await load();
  assert.deepEqual(mobile.mobileRoute("/api/mobile/alerts"), { kind: "native", target: "/api/mobile/alerts", policyPath: "/api/mobile/alerts" });
  assert.deepEqual(mobile.mobileRoute("/api/mobile/alerts/history"), { kind: "native", target: "/api/mobile/alerts/history", policyPath: "/api/mobile/alerts/history" });
  assert.deepEqual(mobile.mobileRoute("/api/mobile/alerts/12"), { kind: "native", target: "/api/mobile/alerts/12", policyPath: "/api/mobile/alerts/12" });
  assert.equal(mobile.mobileRoute("/api/mobile/alerts/../wallet"), null);
});

test("signed-in only: no session, a dead session", async () => {
  const m = await load();
  const n = mdCalls().length;
  const none = await viaProxy(m, "/api/mobile/alerts", {}, m.list.GET, {});
  assert.equal(none.res.status, 401);
  const dead = await viaProxy(m, "/api/mobile/alerts", get("d".repeat(43)), m.list.GET, {});
  assert.equal(dead.res.status, 401);
  assert.equal(mdCalls().length, n, "the service is never called without a session");
});

test("list: the service gets the session's tenant and user, never ids from the request", async () => {
  const m = await load();
  const { res } = await viaProxy(m, "/api/mobile/alerts?symbol=xauusd&user_id=999", get(TOKENS.user, { "x-kalks-user-id": "999", "x-kalks-tenant": "evil" }), m.list.GET, {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(await res.json(), { items: [ALERT], limit: 50, live: 1 });
  const sent = mdCalls().at(-1);
  assert.equal(sent.path, "/v1/internal/alerts?symbol=XAUUSD");
  assert.equal(sent.headers["x-kalks-user-id"], "42");
  assert.equal(sent.headers["x-kalks-tenant"], "acme");
  assert.equal(sent.headers["x-kalks-internal"], INTERNAL);
  const bad = await viaProxy(m, "/api/mobile/alerts?symbol=%3Cscript%3E", get(TOKENS.user), m.list.GET, {});
  assert.equal(bad.res.status, 400);
});

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

test("create: only the alert fields reach the service", async () => {
  const m = await load();
  const body = { symbol: " xauusd ", condition: "above", value: "2710.5", basis: "ask", group: "Pro", repeat: true, expiresAt: "2026-10-30T10:00:00.000Z", note: "breakout", userId: 999, tenant: "evil", status: "triggered", target: 1 };
  const { res } = await viaProxy(m, "/api/mobile/alerts", send("POST", TOKENS.user, body), m.list.POST, {});
  assert.equal(res.status, 201);
  assert.equal((await res.json()).alert.id, 6);
  const sent = mdCalls().at(-1);
  assert.equal(sent.method, "POST");
  assert.deepEqual(sent.body, { symbol: "XAUUSD", condition: "above", value: 2710.5, basis: "ask", group: "pro", repeat: true, expiresAt: "2026-10-30T10:00:00.000Z", note: "breakout" });
  assert.equal(sent.headers["x-kalks-user-id"], "42");
});

test("create: malformed input is refused before the service", async () => {
  const m = await load();
  const n = mdCalls().length;
  for (const [body, field] of [
    [{ condition: "above", value: 1 }, "symbol"],
    [{ symbol: "XAUUSD", condition: "sideways", value: 1 }, "condition"],
    [{ symbol: "XAUUSD", condition: "above", value: -3 }, "value"],
    [{ symbol: "XAUUSD", condition: "above", value: "abc" }, "value"],
    [{ symbol: "XAUUSD", condition: "above", value: 1, basis: "mid" }, "basis"],
    [{ symbol: "XAUUSD", condition: "above", value: 1, group: "a b" }, "group"],
    [{ symbol: "XAUUSD", condition: "above", value: 1, repeat: "yes" }, "repeat"],
    [{ symbol: "XAUUSD", condition: "above", value: 1, active: true }, "active"],
    [{ symbol: "XAUUSD", condition: "above", value: 1, expiresAt: "next week" }, "expiresAt"],
    [{ symbol: "XAUUSD", condition: "above", value: 1, note: "x".repeat(501) }, "note"],
  ]) {
    const { res } = await viaProxy(m, "/api/mobile/alerts", send("POST", TOKENS.user, body), m.list.POST, {});
    assert.equal(res.status, 422, JSON.stringify(body));
    const { error } = await res.json();
    assert.deepEqual([error.code, error.field], ["validation", field]);
  }
  const notJson = await viaProxy(m, "/api/mobile/alerts", { method: "POST", headers: { authorization: `Bearer ${TOKENS.user}`, "content-type": "text/plain" }, body: "hi" }, m.list.POST, {});
  assert.equal(notJson.res.status, 415);
  assert.equal(mdCalls().length, n);
});

test("create: the service's refusals come back as they are", async () => {
  const m = await load();
  const { res } = await viaProxy(m, "/api/mobile/alerts", send("POST", TOKENS.user, { symbol: "XAUUSD", condition: "above", value: 1 }), m.list.POST, {});
  assert.equal(res.status, 409);
  const { error } = await res.json();
  assert.equal(error.code, "level_reached");
  assert.equal(error.field, "value");
});

/* ------------------------------------------------------------------ */
/* Change, delete, history                                             */
/* ------------------------------------------------------------------ */

test("change: pause / resume and edits are forwarded; the symbol can't change", async () => {
  const m = await load();
  const { res } = await viaProxy(m, "/api/mobile/alerts/5", send("PATCH", TOKENS.user, { active: false, note: "later", expiresAt: null }), m.one.PATCH, { id: "5" });
  assert.equal(res.status, 200);
  assert.deepEqual(mdCalls().at(-1).body, { active: false, expiresAt: null, note: "later" });
  assert.equal(mdCalls().at(-1).path, "/v1/internal/alerts/5");
  const sym = await viaProxy(m, "/api/mobile/alerts/5", send("PATCH", TOKENS.user, { symbol: "EURUSD" }), m.one.PATCH, { id: "5" });
  assert.equal(sym.res.status, 422);
  const empty = await viaProxy(m, "/api/mobile/alerts/5", send("PATCH", TOKENS.user, { userId: 1 }), m.one.PATCH, { id: "5" });
  assert.equal(empty.res.status, 422);
  const other = await viaProxy(m, "/api/mobile/alerts/9", send("PATCH", TOKENS.user, { note: "x" }), m.one.PATCH, { id: "9" });
  assert.equal(other.res.status, 404);
  const n = mdCalls().length;
  const badId = await viaProxy(m, "/api/mobile/alerts/abc", send("PATCH", TOKENS.user, { note: "x" }), m.one.PATCH, { id: "abc" });
  assert.equal(badId.res.status, 404);
  assert.equal(mdCalls().length, n);
});

test("delete and history", async () => {
  const m = await load();
  const del = await viaProxy(m, "/api/mobile/alerts/5", { method: "DELETE", headers: { authorization: `Bearer ${TOKENS.user}` } }, m.one.DELETE, { id: "5" });
  assert.equal(del.res.status, 200);
  assert.equal(mdCalls().at(-1).method, "DELETE");
  const h = await viaProxy(m, "/api/mobile/alerts/history?before=120&limit=20&symbol=eurusd", get(TOKENS.user), m.history.GET, {});
  assert.equal(h.res.status, 200);
  assert.equal(mdCalls().at(-1).path, "/v1/internal/alerts/history?before=120&limit=20&symbol=EURUSD");
  for (const q of ["before=-1", "before=abc", "limit=0", "limit=101", "symbol=%3Cx%3E"]) {
    const bad = await viaProxy(m, `/api/mobile/alerts/history?${q}`, get(TOKENS.user), m.history.GET, {});
    assert.equal(bad.res.status, 400, q);
  }
  const clear = await viaProxy(m, "/api/mobile/alerts/history", { method: "DELETE", headers: { authorization: `Bearer ${TOKENS.user}` } }, m.history.DELETE, {});
  assert.deepEqual(await clear.res.json(), { ok: true, cleared: 3 });
});

/* ------------------------------------------------------------------ */
/* View-only and staff sessions                                        */
/* ------------------------------------------------------------------ */

test("a view-only login never sees or changes the owner's alerts", async () => {
  const m = await load();
  const n = mdCalls().length;
  const list = await viaProxy(m, "/api/mobile/alerts", get(TOKENS.viewer), m.list.GET, {});
  assert.equal(list.res.status, 403);
  assert.equal((await list.res.json()).error.code, "viewer_scope");
  const create = await viaProxy(m, "/api/mobile/alerts", send("POST", TOKENS.viewer, { symbol: "XAUUSD", condition: "above", value: 2700 }), m.list.POST, {});
  assert.equal(create.res.status, 403);
  assert.equal((await create.res.json()).error.code, "viewer_read_only");
  // the handler refuses them too (if a request ever got past the proxy)
  const direct = await m.list.GET(new m.NextRequest(`${BASE}/api/mobile/alerts`, get(TOKENS.viewer)));
  assert.equal(direct.status, 403);
  assert.equal(mdCalls().length, n);
});

test("read-only staff sessions read but don't change; full staff sessions are audited", async () => {
  const m = await load();
  const list = await viaProxy(m, "/api/mobile/alerts", get(TOKENS.staffRead), m.list.GET, {});
  assert.equal(list.res.status, 200);
  const n = mdCalls().length;
  const create = await viaProxy(m, "/api/mobile/alerts", send("POST", TOKENS.staffRead, { symbol: "XAUUSD", condition: "above", value: 2700 }), m.list.POST, {});
  assert.equal(create.res.status, 403);
  assert.equal((await create.res.json()).error.code, "staff_read_only");
  const direct = await m.one.DELETE(new m.NextRequest(`${BASE}/api/mobile/alerts/5`, { method: "DELETE", headers: { authorization: `Bearer ${TOKENS.staffRead}` } }), { params: Promise.resolve({ id: "5" }) });
  assert.equal(direct.status, 403);
  assert.equal(mdCalls().length, n);
  const audited = calls.filter((c) => c.svc === "gateway" && c.path === "/v1/auth/impersonation/event").length;
  const full = await viaProxy(m, "/api/mobile/alerts", send("POST", TOKENS.staffFull, { symbol: "XAUUSD", condition: "above", value: 2700 }), m.list.POST, {});
  assert.equal(full.res.status, 201);
  assert.ok(calls.filter((c) => c.svc === "gateway" && c.path === "/v1/auth/impersonation/event").length > audited, "the staff change is audited");
});

/* ------------------------------------------------------------------ */
/* The service being unavailable                                       */
/* ------------------------------------------------------------------ */

test("a wrong internal token or a down service reads as unavailable, never as signed out", async () => {
  const m = await load();
  mdWrongToken = true;
  try {
    const { res } = await viaProxy(m, "/api/mobile/alerts", get(TOKENS.user), m.list.GET, {});
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error.code, "unavailable");
  } finally {
    mdWrongToken = false;
  }
  mdDown = true;
  const port = marketData.address().port;
  await new Promise((r) => marketData.close(r));
  try {
    const { res } = await viaProxy(m, "/api/mobile/alerts", get(TOKENS.user), m.list.GET, {});
    assert.equal(res.status, 503);
  } finally {
    marketData = await new Promise((resolve) => {
      const s = createServer((req, res) => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end("{}");
      });
      s.listen(port, "127.0.0.1", () => resolve(s));
    });
    mdDown = false;
  }
});
