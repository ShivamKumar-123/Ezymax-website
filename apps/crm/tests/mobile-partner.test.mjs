// Mobile app, partner (IB) and rewards (/api/mobile/partner/* → /api/partner/*, /api/mobile/growth/* → /api/growth/*):
// `node --test apps/crm/tests`. The proxy and both BFFs run as they are, against stub gateway / IB / growth servers
// on loopback ports; no real service or secret is involved. Checks: the partner and the client reach the services
// from the bearer session only (never a user id from the app), query keys are filtered, view-only logins read the
// partner dashboard but change nothing and never see rewards, read-only staff sessions change nothing, a broker
// module switched off answers module_disabled before the services.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import "./helpers/ts-hooks.mjs";

const TOKENS = {
  user: "u".repeat(43),
  viewerPartner: `v.${"p".repeat(43)}`,
  viewerWallet: `v.${"w".repeat(43)}`,
  staffRead: `i.${"r".repeat(43)}`,
};
const USER = {
  id: 42,
  email: "priya@example.com",
  first_name: "Priya",
  last_name: "Kapoor",
  name: "Priya Kapoor",
  country: "in",
  kyc_status: "verified",
  created_at: "2026-09-01T10:00:00Z",
  referral_code: "PRIYA9756",
  tenant: { slug: "kalks", name: "Kalks" },
};
const viewer = (sections) => ({ id: 7, label: "Accountant", username: "acc", accounts: [], sections, expires_at: null, status: "active", last_login_at: null, created_at: "2026-09-01T00:00:00Z" });

const calls = [];
let gateway, ibSvc, growthSvc;

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
      // brokers that switched the partner programme or rewards off (D112)
      const host = req.headers["x-kalks-host"];
      const modules = host === "noib.example" ? { ib: false } : host === "norewards.example" ? { rewards: false } : {};
      return [200, { maintenance: { active: false }, modules, flags: {} }];
    }
    if (url.pathname === "/v1/auth/impersonation/event") return [200, { status: "ok" }];
    if (url.pathname === "/v1/auth/me") {
      const t = bearer(req);
      if (t === TOKENS.user || t === TOKENS.staffRead) return [200, { user: USER, viewer: null }];
      if (t === TOKENS.viewerPartner) return [200, { user: USER, viewer: viewer(["partner"]) }];
      if (t === TOKENS.viewerWallet) return [200, { user: USER, viewer: viewer(["accounts", "wallet"]) }];
      return [401, { error: { code: "unauthorized", message: "Please sign in." } }];
    }
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  ibSvc = await stub("ib", (req, body) => {
    const url = new URL(req.url, "http://x");
    if (req.headers["x-kalks-user-id"] !== "42") return [401, { error: { code: "unauthorized", message: "Missing user." } }];
    if (url.pathname === "/v1/ib/me") return [200, { member: { userId: 42, code: "PRIYA9756", rebatePct: 0, splitPct: 0 }, counts: { referrals: 3 } }];
    if (url.pathname === "/v1/ib/me/clients") return [200, { items: [], visibility: "full", tiers: 3 }];
    if (url.pathname === "/v1/ib/me/settings") return [200, { rebatePct: body.rebatePct, splitPct: body.splitPct }];
    if (url.pathname === "/v1/ib/me/campaigns" && req.method === "POST") return [200, { id: 9, slug: "insta", name: body.name, landing: "/register" }];
    if (/^\/v1\/ib\/me\/campaigns\/\d+$/.test(url.pathname)) return [200, { status: "ok" }];
    if (url.pathname === "/v1/ib/me/payouts") return [200, { items: [], unbatched: 0, schedule: "weekly", minAmount: 10, nextClose: "2026-10-05T00:00:00Z" }];
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  growthSvc = await stub("growth", (req, body) => {
    const url = new URL(req.url, "http://x");
    if (req.headers["x-kalks-user-id"] !== "42") return [401, { error: { code: "unauthorized", message: "Missing user." } }];
    if (url.pathname === "/v1/growth/me/contests") return [200, { items: [], stats: { entered: 0, prizesWon: 0, prizeFinishes: 0, bestRank: null, active: 0 } }];
    if (url.pathname === "/v1/growth/me/points") return [200, { items: [], page: 1, limit: 100, total: 0 }];
    if (url.pathname === "/v1/growth/me/banners") return [200, { items: [] }];
    if (url.pathname === "/v1/growth/me/contests/5/join") return [200, { entry: { entryId: 1, me: true }, credentials: { login: 50000086, password: "pw-once", investorPassword: "inv-once" } }];
    if (url.pathname === "/v1/growth/me/redeem") return [200, { redemption: { id: 1, status: "pending" }, balance: 500 }];
    if (url.pathname === "/v1/growth/me/promo") return [200, { result: { kind: "points", message: "500 points added.", points: 500 } }];
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  process.env.GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;
  process.env.IB_URL = `http://127.0.0.1:${ibSvc.address().port}`;
  process.env.GROWTH_URL = `http://127.0.0.1:${growthSvc.address().port}`;
});

after(() => {
  gateway?.close();
  ibSvc?.close();
  growthSvc?.close();
});

const load = async () => ({
  ...(await import("next/server")),
  mobile: await import("../lib/mobile.ts"),
  proxy: (await import("../proxy.ts")).proxy,
  partner: await import("../app/api/partner/[[...path]]/route.ts"),
  growth: await import("../app/api/growth/[[...path]]/route.ts"),
});

const BASE = "https://app.kalkstrade.com";
const headersOf = (res) => Object.fromEntries(res.headers.entries());

/** Runs a request through the proxy, then (like Next) through the BFF handler it rewrites to. */
async function viaProxy(m, url, init = {}) {
  const req = new m.NextRequest(`${BASE}${url}`, init);
  const res = await m.proxy(req);
  const h = headersOf(res);
  if (!h["x-middleware-rewrite"]) return { res, forwarded: null };
  const overridden = (h["x-middleware-override-headers"] ?? "").split(",").filter(Boolean);
  const fwd = new Headers();
  for (const k of overridden) fwd.set(k, h[`x-middleware-request-${k}`]);
  const target = new URL(h["x-middleware-rewrite"]);
  const inner = new m.NextRequest(target, { method: init.method ?? "GET", headers: fwd, body: init.body });
  const [, , family, ...path] = target.pathname.split("/");
  const handler = family === "partner" ? m.partner : m.growth;
  const method = init.method ?? "GET";
  return { res: await handler[method](inner, { params: Promise.resolve({ path }) }), forwarded: fwd, target };
}

const auth = (token) => ({ headers: { authorization: `Bearer ${token}` } });
const send = (method, token, body) => ({ method, headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
const svcCalls = (svc, path) => calls.filter((c) => c.svc === svc && (!path || c.path.startsWith(path)));

test("partner and growth are rewrite families of the cookie BFFs (the dashboard is the family root)", async () => {
  const { mobile } = await load();
  assert.deepEqual(mobile.mobileRoute("/api/mobile/partner"), { kind: "rewrite", target: "/api/partner", policyPath: "/api/partner" });
  assert.deepEqual(mobile.mobileRoute("/api/mobile/partner/clients/197/trades"), { kind: "rewrite", target: "/api/partner/clients/197/trades", policyPath: "/api/partner/clients/197/trades" });
  assert.deepEqual(mobile.mobileRoute("/api/mobile/growth/contests/5/join"), { kind: "rewrite", target: "/api/growth/contests/5/join", policyPath: "/api/growth/contests/5/join" });
});

test("partner reads reach the IB service as the session's partner, with the app's link base; stray query keys are dropped", async () => {
  const m = await load();
  const dash = await viaProxy(m, "/api/mobile/partner", auth(TOKENS.user));
  assert.equal(dash.target.pathname, "/api/partner");
  assert.equal(dash.res.status, 200);
  const d = await dash.res.json();
  assert.equal(d.member.code, "PRIYA9756");
  assert.equal(d.linkBase, BASE, "referral links point at this Client Area");
  const sent = svcCalls("ib", "/v1/ib/me").at(-1);
  assert.equal(sent.path, "/v1/ib/me");
  assert.equal(sent.headers["x-kalks-user-id"], "42");
  assert.equal(sent.headers["x-kalks-tenant"], "kalks");
  const clients = await viaProxy(m, "/api/mobile/partner/clients?tier=2&q=ra&userId=9&user_id=9", auth(TOKENS.user));
  assert.equal(clients.res.status, 200);
  assert.equal(svcCalls("ib", "/v1/ib/me/clients").at(-1).path, "/v1/ib/me/clients?tier=2&q=ra");
});

test("only the partner routes the Client Area knows reach the IB service", async () => {
  const m = await load();
  const n = svcCalls("ib").length;
  for (const p of ["/api/mobile/partner/admin/overview", "/api/mobile/partner/clients/abc/trades", "/api/mobile/partner/commissions/5", "/api/mobile/partner/me/payouts"]) {
    const { res } = await viaProxy(m, p, auth(TOKENS.user));
    assert.equal(res.status, 404, p);
  }
  assert.equal(svcCalls("ib").length, n);
});

test("rebate / split and campaign links change for the session's partner; the IB service gets the header identity", async () => {
  const m = await load();
  const s = await viaProxy(m, "/api/mobile/partner/settings", send("PUT", TOKENS.user, { rebatePct: 10, splitPct: 5 }));
  assert.equal(s.res.status, 200);
  assert.deepEqual(await s.res.json(), { rebatePct: 10, splitPct: 5 });
  const sentSettings = svcCalls("ib", "/v1/ib/me/settings").at(-1);
  assert.equal(sentSettings.method, "PUT");
  assert.equal(sentSettings.headers["x-kalks-user-id"], "42");
  const c = await viaProxy(m, "/api/mobile/partner/campaigns", send("POST", TOKENS.user, { name: "Insta" }));
  assert.equal(c.res.status, 200);
  assert.equal(svcCalls("ib", "/v1/ib/me/campaigns").at(-1).method, "POST");
  const p = await viaProxy(m, "/api/mobile/partner/campaigns/7", send("PATCH", TOKENS.user, { active: false }));
  assert.equal(p.res.status, 200);
  assert.deepEqual(svcCalls("ib", "/v1/ib/me/campaigns/7").at(-1).body, { active: false });
});

test("a view-only login with the partner section reads the dashboard but changes nothing; without it, sees nothing", async () => {
  const m = await load();
  const read = await viaProxy(m, "/api/mobile/partner", auth(TOKENS.viewerPartner));
  assert.equal(read.res.status, 200);
  const n = svcCalls("ib").length;
  for (const [method, path, body] of [
    ["PUT", "/api/mobile/partner/settings", { rebatePct: 50, splitPct: 50 }],
    ["POST", "/api/mobile/partner/campaigns", { name: "Viewer" }],
    ["PATCH", "/api/mobile/partner/campaigns/7", { active: false }],
  ]) {
    const { res } = await viaProxy(m, path, send(method, TOKENS.viewerPartner, body));
    assert.equal(res.status, 403, path);
    assert.equal((await res.json()).error.code, "viewer_read_only");
  }
  assert.equal(svcCalls("ib").length, n, "no viewer change reached the IB service");
  const other = await viaProxy(m, "/api/mobile/partner", auth(TOKENS.viewerWallet));
  assert.equal(other.res.status, 403);
  assert.equal((await other.res.json()).error.code, "viewer_scope");
});

test("rewards are never part of a view-only login; read-only staff read them but can't join, redeem or apply codes", async () => {
  const m = await load();
  for (const token of [TOKENS.viewerPartner, TOKENS.viewerWallet]) {
    const r = await viaProxy(m, "/api/mobile/growth/contests", auth(token));
    assert.equal(r.res.status, 403);
    assert.equal((await r.res.json()).error.code, "viewer_scope");
  }
  const n = svcCalls("growth").length;
  const viewerJoin = await viaProxy(m, "/api/mobile/growth/contests/5/join", send("POST", TOKENS.viewerPartner, {}));
  assert.equal((await viewerJoin.res.json()).error.code, "viewer_read_only");
  const staffRead = await viaProxy(m, "/api/mobile/growth/contests", auth(TOKENS.staffRead));
  assert.equal(staffRead.res.status, 200);
  const m2 = svcCalls("growth").length;
  for (const [path, body] of [
    ["/api/mobile/growth/contests/5/join", { login: 10000089 }],
    ["/api/mobile/growth/redeem", { itemId: 1 }],
    ["/api/mobile/growth/promo", { code: "MOBILE500" }],
  ]) {
    const { res } = await viaProxy(m, path, send("POST", TOKENS.staffRead, body));
    assert.equal(res.status, 403, path);
    assert.equal((await res.json()).error.code, "staff_read_only");
  }
  assert.equal(svcCalls("growth").length, m2, "no refused write reached the growth service");
  assert.equal(m2, n + 1, "only the staff read went through");
});

test("rewards reach the growth service as the session's client with its segment (country, KYC, sign-up, name, code)", async () => {
  const m = await load();
  const r = await viaProxy(m, "/api/mobile/growth/points?kind=earn&page=2&limit=50&userId=9", auth(TOKENS.user));
  assert.equal(r.res.status, 200);
  const sent = svcCalls("growth", "/v1/growth/me/points").at(-1);
  assert.equal(sent.path, "/v1/growth/me/points?kind=earn&page=2&limit=50");
  assert.equal(sent.headers["x-kalks-user-id"], "42");
  assert.equal(sent.headers["x-kalks-country"], "in");
  assert.equal(sent.headers["x-kalks-kyc"], "verified");
  assert.equal(sent.headers["x-kalks-created-at"], "2026-09-01T10:00:00Z");
  assert.equal(decodeURIComponent(sent.headers["x-kalks-name"]), "Priya Kapoor");
  assert.equal(sent.headers["x-kalks-referral-code"], "PRIYA9756");
});

test("joining a demo contest passes its one-time credentials through; writes need a JSON object body", async () => {
  const m = await load();
  const j = await viaProxy(m, "/api/mobile/growth/contests/5/join", send("POST", TOKENS.user, {}));
  assert.equal(j.res.status, 200);
  const body = await j.res.json();
  assert.equal(body.credentials.login, 50000086);
  assert.equal(j.res.headers.get("cache-control"), "no-store", "credentials are never cached");
  const n = svcCalls("growth").length;
  const bad = await viaProxy(m, "/api/mobile/growth/promo", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${TOKENS.user}` }, body: "[1]" });
  assert.equal(bad.res.status, 400);
  assert.equal(svcCalls("growth").length, n);
});

test("a broker without the partner programme or rewards answers module_disabled before the services; banners stay on", async () => {
  const m = await load();
  const ib0 = svcCalls("ib").length;
  const g0 = svcCalls("growth").length;
  const call = (host, path) => m.proxy(new m.NextRequest(`${BASE}${path}`, { headers: { host, authorization: `Bearer ${TOKENS.user}` } }));
  const noIb = await call("noib.example", "/api/mobile/partner");
  assert.equal(noIb.status, 403);
  assert.equal((await noIb.json()).error.code, "module_disabled");
  const noRewards = await call("norewards.example", "/api/mobile/growth/contests");
  assert.equal(noRewards.status, 403);
  assert.equal((await noRewards.json()).error.code, "module_disabled");
  assert.equal(svcCalls("ib").length, ib0);
  assert.equal(svcCalls("growth").length, g0);
  // the growth BFF's banners are not a rewards feature: they stay reachable
  const banners = await call("norewards.example", "/api/mobile/growth/banners?placement=dashboard");
  assert.notEqual(banners.status, 403);
});

test("a request without a session never reaches the services", async () => {
  const m = await load();
  const ib0 = svcCalls("ib").length;
  const r = await viaProxy(m, "/api/mobile/partner/payouts", {});
  assert.equal(r.res.status, 401);
  assert.equal(svcCalls("ib").length, ib0);
});
