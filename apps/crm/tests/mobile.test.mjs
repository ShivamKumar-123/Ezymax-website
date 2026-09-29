// Mobile app BFF (/api/mobile/*): `node --test apps/crm/tests`.
// The proxy and the route handlers run as they are, against stub gateway / wallet / engine servers on loopback
// ports; no real service or secret is involved.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import "./helpers/ts-hooks.mjs";

/* ------------------------------------------------------------------ */
/* Stub upstreams                                                      */
/* ------------------------------------------------------------------ */

const TOKENS = {
  user: "u".repeat(43),
  viewer: `v.${"w".repeat(43)}`,
  staffRead: `i.${"r".repeat(43)}`,
  staffFull: `s.${"f".repeat(43)}`,
  blocked: "b".repeat(43),
};
const USER = { id: 42, email: "arjun@example.com", first_name: "Arjun", last_name: "Mehta", name: "Arjun Mehta", kyc_status: "verified", tenant: { slug: "kalks", name: "Kalks" } };
const VIEWER = { id: 7, label: "Accountant", username: "acc", accounts: ["50000001"], sections: ["accounts", "wallet"], expires_at: null, status: "active", last_login_at: null, created_at: "2026-09-01T00:00:00Z" };

const calls = []; // every upstream request: {svc, method, path, headers, body}
let gateway, walletSvc, engineSvc;

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
  gateway = await stub("gateway", (req, body) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/v1/public/tenant-config") return [200, { maintenance: { active: false }, modules: {}, flags: {} }];
    if (url.pathname === "/v1/auth/login") {
      if (body?.email === "blocked@example.com") return [403, { error: { code: "account_suspended", message: "This account is suspended." } }];
      if (body?.email === "newdevice@example.com") return [200, { status: "otp_required", challenge: "c-1", purpose: "login", email_masked: "n•••@example.com", expires_in: 600, resend_in: 30 }];
      return [200, { status: "ok", user: USER, session: { token: TOKENS.user, expires_at: "2026-10-07T00:00:00Z" } }];
    }
    if (url.pathname === "/v1/auth/verify-email") return [200, { status: "ok", user: USER, session: { token: TOKENS.user, expires_at: "2026-10-07T00:00:00Z" } }];
    if (url.pathname === "/v1/auth/logout") return [200, { status: "ok" }];
    if (url.pathname === "/v1/auth/stepup/verify") return [200, { stepup_token: "st-1" }];
    if (url.pathname === "/v1/auth/stepup/consume") return [200, { status: "ok" }];
    if (url.pathname === "/v1/auth/impersonation/event") return [200, { status: "ok" }];
    if (url.pathname === "/v1/auth/me") {
      const t = bearer(req);
      if (t === TOKENS.user || t === TOKENS.staffRead || t === TOKENS.staffFull) return [200, { user: USER, viewer: null, session: { id: 1, idle_minutes: 60, expires_at: "2026-10-07T00:00:00Z" } }];
      if (t === TOKENS.viewer) return [200, { user: { ...USER, id: 42 }, viewer: VIEWER }];
      return [401, { error: { code: "unauthorized", message: "Please sign in." } }];
    }
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  walletSvc = await stub("wallet", (req) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/v1/withdrawals/quote") return [200, { quote: { amount: "10", fee: "1", net_amount: "9" } }];
    if (url.pathname === "/v1/withdrawals") return [200, { withdrawal: { id: 1, status: "pending" } }];
    if (url.pathname.endsWith("/overview")) return [200, { balances: [{ currency: "USDT", available: "25" }] }];
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  engineSvc = await stub("engine", () => [200, { accounts: [] }]);
  process.env.GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;
  process.env.WALLET_URL = `http://127.0.0.1:${walletSvc.address().port}`;
  process.env.TRADING_URL = `http://127.0.0.1:${engineSvc.address().port}`;
});

after(() => {
  gateway?.close();
  walletSvc?.close();
  engineSvc?.close();
});

// modules read their upstream URLs at import time: import them after the stubs are listening
const load = async () => ({
  ...(await import("next/server")),
  mobile: await import("../lib/mobile.ts"),
  proxy: (await import("../proxy.ts")).proxy,
  auth: await import("../app/api/mobile/auth/[action]/route.ts"),
  wallet: await import("../app/api/wallet/[...path]/route.ts"),
});

const BASE = "https://app.kalkstrade.com";
const headersOf = (res) => Object.fromEntries(res.headers.entries());

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

/* ------------------------------------------------------------------ */
/* Routing and header rules                                            */
/* ------------------------------------------------------------------ */

test("mobile paths resolve to rewrites of cookie routes or native routes; unknown paths are refused", async () => {
  const { mobile } = await load();
  assert.deepEqual(mobile.mobileRoute("/api/mobile/wallet/overview"), { kind: "rewrite", target: "/api/wallet/overview", policyPath: "/api/wallet/overview" });
  assert.deepEqual(mobile.mobileRoute("/api/mobile/auth/heartbeat"), { kind: "rewrite", target: "/api/auth/heartbeat", policyPath: "/api/auth/heartbeat" });
  assert.equal(mobile.mobileRoute("/api/mobile/auth/login").kind, "native");
  assert.equal(mobile.mobileRoute("/api/mobile/auth/login").policyPath, "/api/auth/login");
  assert.equal(mobile.mobileRoute("/api/mobile/config").kind, "native");
  for (const bad of ["/api/mobile/", "/api/mobile/admin/x", "/api/mobile/../auth/login", "/api/mobile//wallet", "/api/wallet/overview", "/api/mobile/config/x"]) {
    assert.equal(mobile.mobileRoute(bad), null, bad);
  }
});

test("bearer tokens are parsed strictly", async () => {
  const { mobile } = await load();
  const h = (v) => new Headers(v ? { authorization: v } : {});
  assert.equal(mobile.bearerOf(h(`Bearer ${TOKENS.user}`)), TOKENS.user);
  assert.equal(mobile.bearerOf(h(`Bearer ${TOKENS.viewer}`)), TOKENS.viewer);
  for (const bad of [undefined, "Basic abc", "Bearer short", `Bearer ${TOKENS.user};x`, `Bearer ${TOKENS.user} extra`, "Bearer a=b; kalks_session=x"]) assert.equal(mobile.bearerOf(h(bad)), null, String(bad));
});

test("rewritten requests carry the bearer as the session cookie, drop browser cookies and pass the same-origin check", async () => {
  const { mobile } = await load();
  const route = mobile.mobileRoute("/api/mobile/wallet/withdrawals");
  const incoming = new Headers({ host: "app.kalkstrade.com", "x-forwarded-proto": "https", cookie: "kalks_session=victim", origin: "https://evil.example", "x-kalks-locale": "ar", "x-kalks-mobile": "spoofed" });
  const out = mobile.mobileRequestHeaders(incoming, TOKENS.user, route);
  assert.equal(out.get("cookie"), `kalks_locale=ar; kalks_session=${TOKENS.user}`);
  assert.equal(out.get("origin"), "https://app.kalkstrade.com");
  assert.equal(out.get("sec-fetch-site"), "same-origin");
  assert.equal(out.get("authorization"), null);
  // without a bearer token nothing is authenticated and the (cross-site) origin is left as it came
  const anon = mobile.mobileRequestHeaders(incoming, null, route);
  assert.equal(anon.get("cookie"), "kalks_locale=ar");
  assert.equal(anon.get("origin"), "https://evil.example");
});

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

test("sign-in returns the session in the body (no cookie) and mints a device id", async () => {
  const m = await load();
  const { res } = await viaProxy(m, "/api/mobile/auth/login", { method: "POST", headers: { "content-type": "application/json", cookie: "kalks_session=browser" }, body: JSON.stringify({ email: "arjun@example.com", password: "x" }) }, m.auth.POST, { action: "login" });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.session.token, TOKENS.user);
  assert.match(data.device, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(res.headers.get("set-cookie"), null);
  const sent = calls.findLast((c) => c.path === "/v1/auth/login");
  assert.equal(sent.headers["x-kalks-device"], data.device);
  assert.equal(sent.headers.authorization, undefined, "sign-in never forwards a session");
});

test("a new device gets the email-code challenge; a known device id is kept", async () => {
  const m = await load();
  const device = "D".repeat(32);
  const { res } = await viaProxy(m, "/api/mobile/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-kalks-device": device }, body: JSON.stringify({ email: "newdevice@example.com", password: "x" }) }, m.auth.POST, { action: "login" });
  const data = await res.json();
  assert.equal(data.status, "otp_required");
  assert.equal(data.purpose, "login");
  assert.equal(data.session, undefined);
  assert.equal(data.device, undefined);
  assert.equal(calls.findLast((c) => c.path === "/v1/auth/login").headers["x-kalks-device"], device);
});

test("blocked users are refused at sign-in and their sessions are dead", async () => {
  const m = await load();
  const { res } = await viaProxy(m, "/api/mobile/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "blocked@example.com", password: "x" }) }, m.auth.POST, { action: "login" });
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error.code, "account_suspended");
  assert.equal(data.session, undefined);
  const me = await viaProxy(m, "/api/mobile/auth/me", { headers: { authorization: `Bearer ${TOKENS.blocked}` } }, m.auth.GET, { action: "me" });
  assert.equal(me.res.status, 401);
  const w = await viaProxy(m, "/api/mobile/wallet/overview", { headers: { authorization: `Bearer ${TOKENS.blocked}` } }, m.wallet.GET, { path: ["overview"] });
  assert.equal(w.res.status, 401);
});

test("session actions need the bearer token; me answers for it", async () => {
  const m = await load();
  const none = await viaProxy(m, "/api/mobile/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }, m.auth.POST, { action: "logout" });
  assert.equal(none.res.status, 401);
  const out = await viaProxy(m, "/api/mobile/auth/logout", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${TOKENS.user}` }, body: "{}" }, m.auth.POST, { action: "logout" });
  assert.equal(out.res.status, 200);
  assert.equal(calls.findLast((c) => c.path === "/v1/auth/logout").headers.authorization, `Bearer ${TOKENS.user}`);
  const me = await viaProxy(m, "/api/mobile/auth/me", { headers: { authorization: `Bearer ${TOKENS.user}` } }, m.auth.GET, { action: "me" });
  assert.equal(me.res.status, 200);
  assert.equal((await me.res.json()).user.id, 42);
});

/* ------------------------------------------------------------------ */
/* Bearer access to the cookie BFFs                                    */
/* ------------------------------------------------------------------ */

test("bearer auth is accepted on rewritten routes; identity comes from the gateway, never the body", async () => {
  const m = await load();
  const { res, target } = await viaProxy(m, "/api/mobile/wallet/withdrawals/quote", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${TOKENS.user}` }, body: JSON.stringify({ amount: "10", chain: "tron", to_address: "TU7PHUS22Hw632YsnAyjxNh4gu3u8PzcHZ", user_id: 999 }) }, m.wallet.POST, { path: ["withdrawals", "quote"] });
  assert.equal(target, `${BASE}/api/wallet/withdrawals/quote`);
  assert.equal(res.status, 200);
  assert.equal(calls.findLast((c) => c.path === "/v1/withdrawals/quote").body.user_id, 42);
});

test("cookie-less CSRF safety: a browser cookie never authenticates a mobile request", async () => {
  const m = await load();
  const { res, forwarded } = await viaProxy(m, "/api/mobile/wallet/overview", { headers: { cookie: `kalks_session=${TOKENS.user}` } }, m.wallet.GET, { path: ["overview"] });
  assert.equal(res.status, 401);
  assert.ok(!(forwarded.get("cookie") ?? "").includes("kalks_session"));
  // a cross-site POST that relies on the cookie is refused before the wallet sees it
  const before = calls.filter((c) => c.path === "/v1/withdrawals").length;
  const post = await viaProxy(m, "/api/mobile/wallet/withdrawals", { method: "POST", headers: { "content-type": "application/json", cookie: `kalks_session=${TOKENS.user}`, origin: "https://evil.example" }, body: JSON.stringify({ amount: "10", chain: "tron", to_address: "T1", idempotency_key: "k-12345678" }) }, m.wallet.POST, { path: ["withdrawals"] });
  assert.ok(post.res.status === 403 || post.res.status === 401, `got ${post.res.status}`);
  assert.equal(calls.filter((c) => c.path === "/v1/withdrawals").length, before);
});

test("cookie routes keep their same-origin check (unchanged by the mobile path)", async () => {
  const m = await load();
  const req = new m.NextRequest(`${BASE}/api/wallet/withdrawals/quote`, { method: "POST", headers: { host: "app.kalkstrade.com", "content-type": "application/json", cookie: `kalks_session=${TOKENS.user}`, origin: "https://evil.example" }, body: JSON.stringify({ amount: "10", chain: "tron", to_address: "T1" }) });
  const res = await m.wallet.POST(req, { params: Promise.resolve({ path: ["withdrawals", "quote"] }) });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error.code, "forbidden");
});

test("view-only logins stay read-only and in scope on mobile", async () => {
  const m = await load();
  const write = await viaProxy(m, "/api/mobile/wallet/withdrawals/quote", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${TOKENS.viewer}` }, body: "{}" }, m.wallet.POST, { path: ["withdrawals", "quote"] });
  assert.equal(write.res.status, 403);
  assert.equal((await write.res.json()).error.code, "viewer_read_only");
  const outOfScope = await viaProxy(m, "/api/mobile/notifications", { headers: { authorization: `Bearer ${TOKENS.viewer}` } }, () => new Response("unreachable"), {});
  assert.equal(outOfScope.res.status, 403);
  assert.equal((await outOfScope.res.json()).error.code, "viewer_scope");
  const read = await viaProxy(m, "/api/mobile/wallet/overview", { headers: { authorization: `Bearer ${TOKENS.viewer}` } }, m.wallet.GET, { path: ["overview"] });
  assert.equal(read.res.status, 200);
  const stepup = await viaProxy(m, "/api/mobile/auth/stepup", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${TOKENS.viewer}` }, body: "{}" }, m.auth.POST, { action: "stepup" });
  assert.equal(stepup.res.status, 403);
});

test("read-only staff sessions (log in as client) can't change anything on mobile and are audited", async () => {
  const m = await load();
  const n = calls.filter((c) => c.path === "/v1/auth/impersonation/event").length;
  const { res } = await viaProxy(m, "/api/mobile/wallet/withdrawals", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${TOKENS.staffRead}` }, body: "{}" }, m.wallet.POST, { path: ["withdrawals"] });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error.code, "staff_read_only");
  const ev = calls.filter((c) => c.path === "/v1/auth/impersonation/event");
  assert.equal(ev.length, n + 1);
  assert.equal(ev.at(-1).body.kind, "write_refused");
  assert.equal(ev.at(-1).body.path, "/api/wallet/withdrawals");
  // reads are allowed; a full staff session's change is audited as an action
  const read = await viaProxy(m, "/api/mobile/wallet/overview", { headers: { authorization: `Bearer ${TOKENS.staffRead}` } }, m.wallet.GET, { path: ["overview"] });
  assert.equal(read.res.status, 200);
  await viaProxy(m, "/api/mobile/wallet/withdrawals/quote", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${TOKENS.staffFull}` }, body: JSON.stringify({ amount: "10", chain: "tron", to_address: "T1" }) }, m.wallet.POST, { path: ["withdrawals", "quote"] });
  assert.equal(calls.filter((c) => c.path === "/v1/auth/impersonation/event").at(-1).body.kind, "action");
});

test("unknown mobile paths answer 404 without reaching a handler", async () => {
  const m = await load();
  const res = await m.proxy(new m.NextRequest(`${BASE}/api/mobile/admin/users`, { headers: { authorization: `Bearer ${TOKENS.user}` } }));
  assert.equal(res.status, 404);
});
