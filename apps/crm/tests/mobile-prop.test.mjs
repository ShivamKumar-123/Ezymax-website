// Mobile prop (/api/mobile/prop/*, a rewrite of the Client Area prop BFF): `node --test apps/crm/tests`.
// The proxy and the prop route handler run as they are against stub gateway and prop services on loopback ports.
// What the app relies on: identity only from the bearer session, the web's validation and idempotency rules for
// purchases, payouts on the same route, and the broker / viewer / staff policies before the prop service is asked.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import "./helpers/ts-hooks.mjs";

const TOKENS = { user: "u".repeat(43), viewer: `v.${"w".repeat(43)}`, staffRead: `i.${"r".repeat(43)}`, staffFull: `s.${"f".repeat(43)}` };
const USER = { id: 42, email: "priya@example.com", first_name: "Priya", last_name: "Patel", name: "Priya Patel", kyc_status: "verified", tenant: { slug: "kalks", name: "Kalks" } };
const VIEWER = { id: 7, label: "Accountant", accounts: ["50000001"], sections: ["accounts", "wallet"], status: "active" };

const calls = [];
let gateway, propSvc;

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
      // a broker that switched the prop module off (D112)
      const off = req.headers["x-kalks-host"] === "noprop.example";
      return [200, { maintenance: { active: false }, modules: off ? { prop: false } : {}, flags: {} }];
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
  propSvc = await stub("prop", (req, body) => {
    const url = new URL(req.url, "http://x");
    const p = url.pathname;
    if (req.headers["x-kalks-user-id"] !== "42") return [401, { error: { code: "unauthorized", message: "no user" } }];
    if (p === "/v1/plans") return [200, { plans: [{ id: "classic-2-step", name: "Kalks Classic 2-Step", type: "2-step", sizes: [{ size: 10000, fee: 89, leverage: 100, enabled: true }] }] }];
    if (p === "/v1/challenges" && req.method === "POST") {
      if (body?.planId === "classic-2-step" && body.size === 10000) return [200, { challenge: { id: 12, status: "active", current: { login: 10000001 } }, credentials: { login: 10000001, password: "Pw-1", investorPassword: "Inv-1" } }];
      return [422, { error: { code: "insufficient_funds", message: "Wallet balance too low" } }];
    }
    if (p === "/v1/challenges") return [200, { challenges: [] }];
    if (p === "/v1/challenges/12") return [200, { id: 12, events: [], certificates: [] }];
    if (p === "/v1/challenges/99") return [404, { error: { code: "not_found", message: "Challenge not found" } }];
    if (p === "/v1/challenges/12/equity") return [200, { points: [], query: url.search }];
    if (p === "/v1/challenges/12/payouts" && req.method === "POST") return [200, { payout: { id: 3, status: "pending", total: 19.6 } }];
    if (p === "/v1/payouts") return [200, { payouts: [], funded: [], kycStatus: "verified" }];
    if (p === "/v1/certificates") return [200, { certificates: [] }];
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  process.env.GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;
  process.env.PROP_URL = `http://127.0.0.1:${propSvc.address().port}`;
  process.env.PROP_INTERNAL_TOKEN = "test-prop-internal";
});

after(() => {
  gateway?.close();
  propSvc?.close();
});

// modules read their upstream URLs at import time: import them after the stubs are listening
const load = async () => ({
  ...(await import("next/server")),
  proxy: (await import("../proxy.ts")).proxy,
  prop: await import("../app/api/prop/[...path]/route.ts"),
});

const BASE = "https://app.kalkstrade.com";
const headersOf = (res) => Object.fromEntries(res.headers.entries());

/** Runs a request through the proxy, then (like Next) through the handler it rewrites to. */
async function viaProxy(m, url, init, method = "GET") {
  const req = new m.NextRequest(`${BASE}${url}`, init);
  const res = await m.proxy(req);
  const h = headersOf(res);
  if (!h["x-middleware-rewrite"]) return { res, target: null };
  const overridden = (h["x-middleware-override-headers"] ?? "").split(",").filter(Boolean);
  const fwd = new Headers();
  for (const k of overridden) fwd.set(k, h[`x-middleware-request-${k}`]);
  const target = h["x-middleware-rewrite"];
  const inner = new m.NextRequest(target, { method: init?.method ?? "GET", headers: fwd, body: init?.body });
  const path = new URL(target).pathname.replace(/^\/api\/prop\//, "").split("/");
  return { res: await m.prop[method](inner, { params: Promise.resolve({ path }) }), target };
}

const json = (token, body, extra = {}) => ({ method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...extra }, body: JSON.stringify(body) });
const propCalls = (path) => calls.filter((c) => c.svc === "prop" && c.path.startsWith(path));

test("prop reads go to the prop service as the bearer's user, with the name and KYC the certificates and payouts use", async () => {
  const m = await load();
  const { res, target } = await viaProxy(m, "/api/mobile/prop/plans", { headers: { authorization: `Bearer ${TOKENS.user}` } });
  assert.equal(target, `${BASE}/api/prop/plans`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).plans[0].id, "classic-2-step");
  const sent = propCalls("/v1/plans").at(-1);
  assert.equal(sent.headers["x-kalks-user-id"], "42");
  assert.equal(decodeURIComponent(sent.headers["x-kalks-user-name"]), "Priya Patel");
  assert.equal(sent.headers["x-kalks-user-kyc"], "verified");
  assert.equal(sent.headers["x-kalks-internal"], "test-prop-internal", "the internal token is added server-side only");
});

test("the dashboard's reads pass their validated query; other users' challenges stay not found", async () => {
  const m = await load();
  const eq = await viaProxy(m, "/api/mobile/prop/challenges/12/equity?phase=1&limit=2000", { headers: { authorization: `Bearer ${TOKENS.user}` } });
  assert.equal(eq.res.status, 200);
  assert.equal(propCalls("/v1/challenges/12/equity").at(-1).path, "/v1/challenges/12/equity?phase=1&limit=2000");
  const bad = await viaProxy(m, "/api/mobile/prop/challenges/12/equity?phase=77", { headers: { authorization: `Bearer ${TOKENS.user}` } });
  assert.equal(bad.res.status, 400);
  const other = await viaProxy(m, "/api/mobile/prop/challenges/99", { headers: { authorization: `Bearer ${TOKENS.user}` } });
  assert.equal(other.res.status, 404);
});

test("buying a challenge: the app's idempotency key and choice reach the service, the user never comes from the body", async () => {
  const m = await load();
  const { res } = await viaProxy(m, "/api/mobile/prop/challenges", json(TOKENS.user, { planId: "classic-2-step", size: 10000, idempotencyKey: "0f9b3c1e-8a44-4d8e-9a53-2f1c2d7e6b11", userId: 7 }), "POST");
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.credentials.login, 10000001);
  const sent = propCalls("/v1/challenges").filter((c) => c.method === "POST").at(-1);
  assert.deepEqual(sent.body, { planId: "classic-2-step", size: 10000, idempotencyKey: "0f9b3c1e-8a44-4d8e-9a53-2f1c2d7e6b11" });
  assert.equal(sent.headers["x-kalks-user-id"], "42");
});

test("purchase validation and the service's refusals come back as they are", async () => {
  const m = await load();
  const n = propCalls("/v1/challenges").filter((c) => c.method === "POST").length;
  const badKey = await viaProxy(m, "/api/mobile/prop/challenges", json(TOKENS.user, { planId: "classic-2-step", size: 10000, idempotencyKey: "not a key!" }), "POST");
  assert.equal(badKey.res.status, 422);
  const badSize = await viaProxy(m, "/api/mobile/prop/challenges", json(TOKENS.user, { planId: "classic-2-step", size: "10000", idempotencyKey: "k-1" }), "POST");
  assert.equal(badSize.res.status, 422);
  assert.equal(propCalls("/v1/challenges").filter((c) => c.method === "POST").length, n, "invalid purchases never reach the service");
  const short = await viaProxy(m, "/api/mobile/prop/challenges", json(TOKENS.user, { planId: "classic-2-step", size: 50000, idempotencyKey: "k-2" }), "POST");
  assert.equal(short.res.status, 422);
  assert.equal((await short.res.json()).error.code, "insufficient_funds");
});

test("payout requests are forwarded for the bearer's user with no body fields of the app's", async () => {
  const m = await load();
  const { res } = await viaProxy(m, "/api/mobile/prop/challenges/12/payouts", json(TOKENS.user, { amount: 999999, userId: 7 }), "POST");
  assert.equal(res.status, 200);
  assert.equal((await res.json()).payout.status, "pending");
  const sent = propCalls("/v1/challenges/12/payouts").at(-1);
  assert.deepEqual(sent.body, {});
  assert.equal(sent.headers["x-kalks-user-id"], "42");
});

test("a browser cookie never authenticates the app's prop routes", async () => {
  const m = await load();
  const n = propCalls("/v1/challenges").filter((c) => c.method === "POST").length;
  const { res } = await viaProxy(m, "/api/mobile/prop/challenges", { method: "POST", headers: { "content-type": "application/json", cookie: `kalks_session=${TOKENS.user}`, origin: "https://evil.example" }, body: JSON.stringify({ planId: "classic-2-step", size: 10000, idempotencyKey: "k-3" }) }, "POST");
  assert.ok(res.status === 401 || res.status === 403, `got ${res.status}`);
  assert.equal(propCalls("/v1/challenges").filter((c) => c.method === "POST").length, n);
});

test("view-only logins have no prop access; read-only staff can look but not buy or request payouts", async () => {
  const m = await load();
  const n = calls.filter((c) => c.svc === "prop").length;
  const viewerRead = await viaProxy(m, "/api/mobile/prop/challenges", { headers: { authorization: `Bearer ${TOKENS.viewer}` } });
  assert.equal(viewerRead.res.status, 403);
  assert.equal((await viewerRead.res.json()).error.code, "viewer_scope");
  const viewerBuy = await viaProxy(m, "/api/mobile/prop/challenges", json(TOKENS.viewer, { planId: "classic-2-step", size: 10000, idempotencyKey: "k-4" }), "POST");
  assert.equal(viewerBuy.res.status, 403);
  assert.equal((await viewerBuy.res.json()).error.code, "viewer_read_only");
  const staffBuy = await viaProxy(m, "/api/mobile/prop/challenges", json(TOKENS.staffRead, { planId: "classic-2-step", size: 10000, idempotencyKey: "k-5" }), "POST");
  assert.equal(staffBuy.res.status, 403);
  assert.equal((await staffBuy.res.json()).error.code, "staff_read_only");
  const staffPayout = await viaProxy(m, "/api/mobile/prop/challenges/12/payouts", json(TOKENS.staffRead, {}), "POST");
  assert.equal(staffPayout.res.status, 403);
  assert.equal(calls.filter((c) => c.svc === "prop").length, n, "none of these reached the prop service");
  const staffRead = await viaProxy(m, "/api/mobile/prop/challenges", { headers: { authorization: `Bearer ${TOKENS.staffRead}` } });
  assert.equal(staffRead.res.status, 200);
  // a full-access staff session's purchase is audited as an action with the cookie-route path
  await viaProxy(m, "/api/mobile/prop/challenges", json(TOKENS.staffFull, { planId: "classic-2-step", size: 10000, idempotencyKey: "k-6" }), "POST");
  const ev = calls.filter((c) => c.path === "/v1/auth/impersonation/event").at(-1);
  assert.equal(ev.body.kind, "action");
  assert.equal(ev.body.path, "/api/prop/challenges");
});

test("a broker without the prop module answers module_disabled before the prop service", async () => {
  const m = await load();
  const n = calls.filter((c) => c.svc === "prop").length;
  const res = await m.proxy(new m.NextRequest(`${BASE}/api/mobile/prop/plans`, { headers: { host: "noprop.example", authorization: `Bearer ${TOKENS.user}` } }));
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error.code, "module_disabled");
  assert.equal(calls.filter((c) => c.svc === "prop").length, n);
});
