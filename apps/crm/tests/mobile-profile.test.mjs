// Mobile app › More / Profile / Security / Verification BFF (/api/mobile/*): `node --test apps/crm/tests`.
// The proxy and the route handlers run as they are, against stub gateway / support servers on loopback ports.
// Covers the native `menu` route and the bearer access (and refusals) of the cookie routes the profile screens use.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import "./helpers/ts-hooks.mjs";

const TOKENS = {
  user: "p".repeat(43),
  viewer: `v.${"q".repeat(43)}`,
  staffRead: `i.${"s".repeat(43)}`,
};
const USER = { id: 77, email: "priya@example.com", first_name: "Priya", last_name: "Raman", name: "Priya Raman", kyc_status: "unverified", tenant: { slug: "kalks", name: "Kalks" } };
const VIEWER = { id: 9, label: "Accountant", username: "acc", accounts: [], sections: ["accounts", "history"], expires_at: null, status: "active", last_login_at: null, created_at: "2026-09-01T00:00:00Z" };

const calls = [];
let gateway, supportSvc;
let tenant = { maintenance: { active: false }, modules: { prop: false, wallet: true }, flags: { demo_accounts: true }, branding: { name: "Broker One", support_email: "help@brokerone.com", urls: { website: null } } };

function stub(name, handle) {
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);
    const isJson = (req.headers["content-type"] ?? "").includes("application/json");
    const body = isJson && raw.length ? JSON.parse(raw.toString()) : undefined;
    calls.push({ svc: name, method: req.method, path: req.url, headers: req.headers, body, raw });
    const [status, data] = await handle(req, body, raw);
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(data));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

const bearer = (req) => (req.headers.authorization ?? "").replace(/^Bearer /, "");

before(async () => {
  gateway = await stub("gateway", (req, body) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/v1/public/tenant-config") return [200, tenant];
    if (url.pathname === "/v1/auth/impersonation/event") return [200, { status: "ok" }];
    if (url.pathname === "/v1/auth/me") {
      const t = bearer(req);
      if (t === TOKENS.user || t === TOKENS.staffRead) return [200, { user: USER, viewer: null, session: { id: 1, idle_minutes: 30, expires_at: "2026-10-07T00:00:00Z" } }];
      if (t === TOKENS.viewer) return [200, { user: USER, viewer: VIEWER }];
      return [401, { error: { code: "unauthorized", message: "Please sign in." } }];
    }
    if (bearer(req) !== TOKENS.user && bearer(req) !== TOKENS.staffRead) return [401, { error: { code: "unauthorized", message: "Please sign in." } }];
    if (url.pathname === "/v1/auth/sessions") return [200, { items: [{ id: 1, current: true }], idle_minutes: 30, max_days: 7 }];
    if (url.pathname === "/v1/auth/sessions/5/revoke") return [200, { status: "ok" }];
    if (url.pathname === "/v1/auth/requests" && req.method === "POST") return [201, { request: { id: 3, kind: body?.kind, status: "open" } }];
    if (url.pathname === "/v1/auth/password") return [200, { status: "ok", sessions_revoked: 2 }];
    if (url.pathname === "/v1/auth/marketing") return [200, { marketing_consent: body?.consent ?? true }];
    if (url.pathname === "/v1/kyc/documents") return [200, { status: "ok", document: { id: 11 }, state: { kyc_status: "unverified" } }];
    if (url.pathname === "/v1/kyc") return [200, { kyc_status: "unverified", case: null }];
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  supportSvc = await stub("support", (req, body) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/v1/notifications/me/prefs" && req.method === "PUT") return [200, { prefs: { wallet: { inApp: true, email: body?.prefs?.wallet?.email ?? true } } }];
    if (url.pathname === "/v1/notifications/me/prefs") return [200, { catalog: [{ key: "wallet", label: "Deposits and withdrawals", hint: "", locked: false }], prefs: {} }];
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  process.env.GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;
  process.env.SUPPORT_URL = `http://127.0.0.1:${supportSvc.address().port}`;
});

after(() => {
  gateway?.close();
  supportSvc?.close();
});

const load = async () => ({
  ...(await import("next/server")),
  mobile: await import("../lib/mobile.ts"),
  proxy: (await import("../proxy.ts")).proxy,
  menu: await import("../app/api/mobile/menu/route.ts"),
  security: await import("../app/api/security/[...path]/route.ts"),
  kyc: await import("../app/api/kyc/[[...path]]/route.ts"),
  auth: await import("../app/api/mobile/auth/[action]/route.ts"),
  marketing: await import("../app/api/auth/marketing/route.ts"),
  notifications: await import("../app/api/notifications/[[...path]]/route.ts"),
});

const BASE = "https://app.kalkstrade.com";
const headersOf = (res) => Object.fromEntries(res.headers.entries());

/** Runs a request through the proxy, then (like Next) through the handler it rewrites / passes to. */
async function viaProxy(m, url, init, handler, params, base = BASE) {
  const req = new m.NextRequest(`${base}${url}`, init);
  const res = await m.proxy(req);
  const h = headersOf(res);
  if (!h["x-middleware-rewrite"] && !h["x-middleware-next"]) return { res, forwarded: null };
  const overridden = (h["x-middleware-override-headers"] ?? "").split(",").filter(Boolean);
  const fwd = new Headers();
  for (const k of overridden) fwd.set(k, h[`x-middleware-request-${k}`]);
  const target = h["x-middleware-rewrite"] ?? `${base}${url}`;
  const inner = new m.NextRequest(target, { method: init?.method ?? "GET", headers: fwd, body: init?.body, duplex: init?.body ? "half" : undefined });
  return { res: await handler(inner, { params: Promise.resolve(params) }), forwarded: fwd, target };
}

const auth = (t, extra = {}) => ({ authorization: `Bearer ${t}`, ...extra });

/* ------------------------------------------------------------------ */
/* GET /api/mobile/menu                                                */
/* ------------------------------------------------------------------ */

test("menu is a native mobile route, judged like /auth/me by the proxy's policies", async () => {
  const { mobile } = await load();
  assert.deepEqual(mobile.mobileRoute("/api/mobile/menu"), { kind: "native", target: "/api/mobile/menu", policyPath: "/api/auth/me" });
  assert.equal(mobile.mobileRoute("/api/mobile/menu/anything"), null, "nothing else under menu/");
});

test("menu needs a session and returns the broker's modules, support email and legal pages", async () => {
  const m = await load();
  const none = await viaProxy(m, "/api/mobile/menu", { headers: { host: "app.brokerone.com" } }, m.menu.GET, {}, "https://app.brokerone.com");
  assert.equal(none.res.status, 401);
  const { res } = await viaProxy(m, "/api/mobile/menu", { headers: auth(TOKENS.user, { host: "app.brokerone.com" }) }, m.menu.GET, {}, "https://app.brokerone.com");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const d = await res.json();
  assert.equal(d.modules.prop, false, "a module the broker switched off is reported off");
  assert.equal(d.modules.wallet, true);
  assert.equal(d.brand.support_email, "help@brokerone.com");
  assert.equal(d.brand.website, "https://brokerone.com", "the website is the Client Area host without app.");
  assert.deepEqual(d.legal.map((l) => l.key), ["terms", "privacy", "risk", "disclaimer", "restricted"]);
  assert.equal(d.legal[0].url, "https://brokerone.com/terms");
});

test("menu prefers the broker's configured website; local hosts fall back to the Kalks website", async () => {
  const m = await load();
  tenant = { ...tenant, branding: { ...tenant.branding, urls: { website: "https://www.brokertwo.com" } } };
  const configured = await viaProxy(m, "/api/mobile/menu", { headers: auth(TOKENS.user, { host: "app.brokertwo.com" }) }, m.menu.GET, {}, "https://app.brokertwo.com");
  assert.equal((await configured.res.json()).legal[1].url, "https://www.brokertwo.com/privacy");
  tenant = { ...tenant, branding: { ...tenant.branding, urls: { website: null } } };
  const local = await viaProxy(m, "/api/mobile/menu", { headers: auth(TOKENS.user, { host: "localhost:8794" }) }, m.menu.GET, {}, "http://localhost:8794");
  assert.equal((await local.res.json()).brand.website, "https://kalkstrade.com");
});

test("a view-only login reads the broker's menu (module switches, support email, legal pages) but can't write to it", async () => {
  const m = await load();
  const { res } = await viaProxy(m, "/api/mobile/menu", { headers: auth(TOKENS.viewer, { host: "app.brokerone.com" }) }, m.menu.GET, {}, "https://app.brokerone.com");
  assert.equal(res.status, 200);
  const d = await res.json();
  assert.equal(d.modules.prop, false);
  assert.equal(d.legal[0].url, "https://brokerone.com/terms", "the broker's own legal pages, not the Kalks website");
  const post = await viaProxy(m, "/api/mobile/menu", { method: "POST", headers: auth(TOKENS.viewer, { "content-type": "application/json" }), body: "{}" }, m.menu.GET, {});
  assert.equal(post.res.status, 403);
  assert.equal((await post.res.json()).error.code, "viewer_read_only");
});

test("a dead viewer session gets no menu", async () => {
  const m = await load();
  const { res } = await viaProxy(m, "/api/mobile/menu", { headers: auth(`v.${"z".repeat(43)}`) }, m.menu.GET, {});
  assert.equal(res.status, 401);
});

/* ------------------------------------------------------------------ */
/* Security: sessions, requests                                         */
/* ------------------------------------------------------------------ */

test("sessions are read and revoked with the bearer session; identity comes from the gateway", async () => {
  const m = await load();
  const list = await viaProxy(m, "/api/mobile/security/sessions", { headers: auth(TOKENS.user) }, m.security.GET, { path: ["sessions"] });
  assert.equal(list.target, `${BASE}/api/security/sessions`);
  assert.equal(list.res.status, 200);
  assert.equal(calls.findLast((c) => c.path === "/v1/auth/sessions").headers.authorization, `Bearer ${TOKENS.user}`);
  const revoke = await viaProxy(m, "/api/mobile/security/sessions/5/revoke", { method: "POST", headers: auth(TOKENS.user, { "content-type": "application/json" }), body: "{}" }, m.security.POST, { path: ["sessions", "5", "revoke"] });
  assert.equal(revoke.res.status, 200);
  assert.equal(calls.findLast((c) => c.path === "/v1/auth/sessions/5/revoke").headers.authorization, `Bearer ${TOKENS.user}`);
});

test("view-only and read-only staff sessions can't revoke devices or file requests", async () => {
  const m = await load();
  const before = calls.filter((c) => c.path.startsWith("/v1/auth/sessions/5") || c.path === "/v1/auth/requests").length;
  const viewer = await viaProxy(m, "/api/mobile/security/sessions/5/revoke", { method: "POST", headers: auth(TOKENS.viewer, { "content-type": "application/json" }), body: "{}" }, m.security.POST, { path: ["sessions", "5", "revoke"] });
  assert.equal(viewer.res.status, 403);
  assert.equal((await viewer.res.json()).error.code, "viewer_read_only");
  const staff = await viaProxy(m, "/api/mobile/security/requests", { method: "POST", headers: auth(TOKENS.staffRead, { "content-type": "application/json" }), body: JSON.stringify({ kind: "closure" }) }, m.security.POST, { path: ["requests"] });
  assert.equal(staff.res.status, 403);
  assert.equal((await staff.res.json()).error.code, "staff_read_only");
  assert.equal(calls.filter((c) => c.path.startsWith("/v1/auth/sessions/5") || c.path === "/v1/auth/requests").length, before, "nothing reached the gateway");
});

test("a data export request is filed for the bearer's own account", async () => {
  const m = await load();
  const { res } = await viaProxy(m, "/api/mobile/security/requests", { method: "POST", headers: auth(TOKENS.user, { "content-type": "application/json" }), body: JSON.stringify({ kind: "data_export", reason: "records", user_id: 1 }) }, m.security.POST, { path: ["requests"] });
  assert.equal(res.status, 201);
  const sent = calls.findLast((c) => c.path === "/v1/auth/requests");
  assert.deepEqual(sent.body, { kind: "data_export", reason: "records" }, "only kind and reason are forwarded");
  assert.equal(sent.headers.authorization, `Bearer ${TOKENS.user}`);
});

/* ------------------------------------------------------------------ */
/* Password (step-up) and marketing consent                             */
/* ------------------------------------------------------------------ */

test("password change goes to the gateway with the bearer and the step-up token; viewers are refused first", async () => {
  const m = await load();
  const body = JSON.stringify({ current: "Old!2026pw", new: "New!2027pw", stepup_token: "st-9", sign_out_others: true });
  const ok = await viaProxy(m, "/api/mobile/auth/password", { method: "POST", headers: auth(TOKENS.user, { "content-type": "application/json" }), body }, m.auth.POST, { action: "password" });
  assert.equal(ok.res.status, 200);
  const sent = calls.findLast((c) => c.path === "/v1/auth/password");
  assert.equal(sent.headers.authorization, `Bearer ${TOKENS.user}`);
  assert.equal(sent.body.stepup_token, "st-9");
  const n = calls.filter((c) => c.path === "/v1/auth/password").length;
  const viewer = await viaProxy(m, "/api/mobile/auth/password", { method: "POST", headers: auth(TOKENS.viewer, { "content-type": "application/json" }), body }, m.auth.POST, { action: "password" });
  assert.equal(viewer.res.status, 403);
  assert.equal(calls.filter((c) => c.path === "/v1/auth/password").length, n);
  const anon = await viaProxy(m, "/api/mobile/auth/password", { method: "POST", headers: { "content-type": "application/json" }, body }, m.auth.POST, { action: "password" });
  assert.equal(anon.res.status, 401);
});

test("marketing consent is read and changed through the auth rewrite", async () => {
  const m = await load();
  const put = await viaProxy(m, "/api/mobile/auth/marketing", { method: "PUT", headers: auth(TOKENS.user, { "content-type": "application/json" }), body: JSON.stringify({ consent: false }) }, m.marketing.PUT, {});
  assert.equal(put.target, `${BASE}/api/auth/marketing`);
  assert.equal(put.res.status, 200);
  const sent = calls.findLast((c) => c.path === "/v1/auth/marketing");
  assert.equal(sent.method, "POST");
  assert.deepEqual(sent.body, { consent: false });
  assert.equal(sent.headers.authorization, `Bearer ${TOKENS.user}`);
});

test("notification preferences are saved for the bearer's user", async () => {
  const m = await load();
  const { res, target } = await viaProxy(m, "/api/mobile/notifications/prefs", { method: "PUT", headers: auth(TOKENS.user, { "content-type": "application/json" }), body: JSON.stringify({ prefs: { wallet: { email: false } } }) }, m.notifications.PUT, { path: ["prefs"] });
  assert.equal(target, `${BASE}/api/notifications/prefs`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).prefs.wallet.email, false);
  assert.equal(calls.findLast((c) => c.svc === "support").headers["x-kalks-user-id"], "77");
});

/* ------------------------------------------------------------------ */
/* KYC document upload (multipart through the rewrite)                   */
/* ------------------------------------------------------------------ */

test("a KYC document uploads through the rewrite as raw bytes with the bearer session", async () => {
  const m = await load();
  const bytes = new Uint8Array(12_000).fill(7);
  const fd = new FormData();
  fd.append("file", new Blob([bytes], { type: "image/jpeg" }), "passport.jpg");
  fd.append("kind", "id_document");
  fd.append("side", "front");
  fd.append("checks", JSON.stringify({ source: "camera", width: 1600, height: 1000 }));
  const req = new Request("http://x", { method: "POST", body: fd });
  const ct = req.headers.get("content-type");
  const body = new Uint8Array(await req.arrayBuffer());
  const { res, target } = await viaProxy(m, "/api/mobile/kyc/documents", { method: "POST", headers: auth(TOKENS.user, { "content-type": ct }), body }, m.kyc.POST, { path: ["documents"] });
  assert.equal(target, `${BASE}/api/kyc/documents`);
  assert.equal(res.status, 200);
  const sent = calls.findLast((c) => c.path.startsWith("/v1/kyc/documents"));
  assert.equal(sent.headers.authorization, `Bearer ${TOKENS.user}`);
  assert.match(sent.path, /kind=id_document/);
  assert.match(sent.path, /side=front/);
  assert.equal(sent.raw.length, 12_000, "the file itself, not the multipart envelope");
  assert.equal(JSON.parse(sent.headers["x-kalks-kyc-checks"]).source, "camera");
});

test("view-only logins can't upload KYC documents", async () => {
  const m = await load();
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(9000)], { type: "image/jpeg" }), "x.jpg");
  fd.append("kind", "selfie");
  const req = new Request("http://x", { method: "POST", body: fd });
  const { res } = await viaProxy(m, "/api/mobile/kyc/documents", { method: "POST", headers: auth(TOKENS.viewer, { "content-type": req.headers.get("content-type") }), body: new Uint8Array(await req.arrayBuffer()) }, m.kyc.POST, { path: ["documents"] });
  assert.equal(res.status, 403);
});
