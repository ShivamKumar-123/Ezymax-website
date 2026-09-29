// Mobile app reports (/api/mobile/reports/*, the app's Statements and Analytics): `node --test apps/crm/tests`.
// The proxy and the Client Area reports BFF run as they are, against stub gateway and reports services on loopback
// ports: the bearer session decides who the client is, view-only logins stay inside their shared accounts, only
// validated queries reach the service, statement files pass through byte for byte, and nothing can be written.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import "./helpers/ts-hooks.mjs";

const TOKENS = {
  user: "u".repeat(43),
  viewerOne: `v.${"a".repeat(43)}`,
  viewerTwo: `v.${"b".repeat(43)}`,
  viewerNoHistory: `v.${"c".repeat(43)}`,
};
const USER = { id: 42, email: "arjun@example.com", first_name: "Arjun", last_name: "Mehta", name: "Arjun Mehta", kyc_status: "verified", tenant: { slug: "kalks", name: "Kalks" } };
const viewer = (id, accounts, sections) => ({ id, label: "Accountant", username: `acc${id}`, accounts, sections, expires_at: null, status: "active", last_login_at: null, created_at: "2026-09-01T00:00:00Z" });
const VIEWERS = {
  [TOKENS.viewerOne]: viewer(7, ["50000001"], ["history"]),
  [TOKENS.viewerTwo]: viewer(8, ["50000001", "50000002"], ["history"]),
  [TOKENS.viewerNoHistory]: viewer(9, ["50000001"], ["accounts"]),
};
const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255]), Buffer.from("\n%%EOF")]);

const calls = []; // reports service requests: {path, headers}
let gateway, reportsSvc;

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

before(async () => {
  gateway = await listen(
    createServer(async (req, res) => {
      for await (const _ of req);
      const url = new URL(req.url, "http://x");
      const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
      let status = 404;
      let data = { error: { code: "not_found", message: "stub" } };
      if (url.pathname === "/v1/public/tenant-config") [status, data] = [200, { maintenance: { active: false }, modules: {}, flags: {} }];
      else if (url.pathname === "/v1/auth/me") {
        if (token === TOKENS.user) [status, data] = [200, { user: USER, viewer: null }];
        else if (VIEWERS[token]) [status, data] = [200, { user: USER, viewer: VIEWERS[token] }];
        else [status, data] = [401, { error: { code: "unauthorized", message: "Please sign in." } }];
      }
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(data));
    }),
  );
  reportsSvc = await listen(
    createServer(async (req, res) => {
      for await (const _ of req);
      calls.push({ path: req.url, headers: req.headers });
      const url = new URL(req.url, "http://x");
      if (url.pathname.endsWith("/statement") && url.searchParams.get("format") !== "json") {
        res.writeHead(200, { "content-type": "application/pdf", "content-disposition": 'attachment; filename="kalks-statement-50000001-2026-09-01-2026-09-30.pdf"', "set-cookie": "leak=1" });
        return res.end(PDF);
      }
      if (url.pathname === "/v1/me/analytics") {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ scope: url.searchParams.get("login") === "all" ? "live" : "account", byDay: [{ key: "2026-09-30", trades: 3, wins: 1, winRate: 33.33, net: -8.21, lots: 0.25 }] }));
      }
      if (url.pathname.endsWith("/months")) {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ login: 50000001, currency: "USD", months: [] }));
      }
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { code: "not_found", message: "Account not found." } }));
    }),
  );
  process.env.GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;
  process.env.REPORTS_URL = `http://127.0.0.1:${reportsSvc.address().port}`;
  process.env.REPORTS_INTERNAL_TOKEN = "reports-internal-test-token";
});

after(() => {
  gateway?.close();
  reportsSvc?.close();
});

// modules read their upstream URLs at import time: import them after the stubs are listening
const load = async () => ({
  ...(await import("next/server")),
  proxy: (await import("../proxy.ts")).proxy,
  reports: await import("../app/api/reports/[...path]/route.ts"),
});

const BASE = "https://app.kalkstrade.com";
const headersOf = (res) => Object.fromEntries(res.headers.entries());

/** Runs a request through the proxy, then (like Next) through the reports handler it rewrites to. */
async function viaProxy(m, url, token, init = {}) {
  const headers = { ...(init.headers ?? {}), ...(token ? { authorization: `Bearer ${token}` } : {}) };
  const req = new m.NextRequest(`${BASE}${url}`, { ...init, headers });
  const res = await m.proxy(req);
  const h = headersOf(res);
  if (!h["x-middleware-rewrite"]) return { res, rewritten: false };
  const overridden = (h["x-middleware-override-headers"] ?? "").split(",").filter(Boolean);
  const fwd = new Headers();
  for (const k of overridden) fwd.set(k, h[`x-middleware-request-${k}`]);
  const target = new URL(h["x-middleware-rewrite"]);
  const path = target.pathname.replace(/^\/api\/reports\//, "").split("/");
  const inner = new m.NextRequest(target, { method: init.method ?? "GET", headers: fwd });
  return { res: await m.reports.GET(inner, { params: Promise.resolve({ path }) }), rewritten: true, target };
}

const lastCall = () => calls[calls.length - 1];

test("analytics: the bearer session is the client; the service gets its id, the tenant and the internal token", async () => {
  const m = await load();
  const n = calls.length;
  const { res, target } = await viaProxy(m, "/api/mobile/reports/analytics?login=all&from=2026-07-02&to=2026-10-01", TOKENS.user, { headers: { cookie: "kalks_session=someone-else" } });
  assert.equal(target.pathname, "/api/reports/analytics");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual((await res.json()).byDay[0], { key: "2026-09-30", trades: 3, wins: 1, winRate: 33.33, net: -8.21, lots: 0.25 });
  assert.equal(calls.length, n + 1);
  const c = lastCall();
  assert.equal(c.path, "/v1/me/analytics?login=all&from=2026-07-02&to=2026-10-01");
  assert.equal(c.headers["x-kalks-user-id"], "42");
  assert.equal(c.headers["x-kalks-tenant"], "kalks");
  assert.equal(c.headers["x-kalks-internal"], "reports-internal-test-token");
});

test("statement files pass through byte for byte with their type and name, never cached, no upstream cookies", async () => {
  const m = await load();
  const { res } = await viaProxy(m, "/api/mobile/reports/accounts/50000001/statement?from=2026-09-01&to=2026-10-01&format=pdf&open=0", TOKENS.user);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/pdf");
  assert.match(res.headers.get("content-disposition"), /filename="kalks-statement-50000001-2026-09-01-2026-09-30\.pdf"/);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("set-cookie"), null);
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), PDF);
  assert.equal(lastCall().path, "/v1/me/accounts/50000001/statement?from=2026-09-01&to=2026-10-01&format=pdf&open=0");
});

test("only validated queries reach the service", async () => {
  const m = await load();
  const n = calls.length;
  for (const bad of [
    "/api/mobile/reports/accounts/50000001/statement?from=2026-09-01&to=2026-10-01&format=exe",
    "/api/mobile/reports/accounts/50000001/statement?from=tomorrow&format=pdf",
    "/api/mobile/reports/accounts/50000001/statement?format=pdf&open=yes",
    "/api/mobile/reports/analytics?login=12345",
    "/api/mobile/reports/analytics?login=all&to=2026-10-01T00:00:00Z;drop",
  ]) {
    const { res } = await viaProxy(m, bad, TOKENS.user);
    assert.equal(res.status, 400, bad);
  }
  for (const unknown of ["/api/mobile/reports/accounts/5000/months", "/api/mobile/reports/accounts/50000001/ledger", "/api/mobile/reports/admin/pnl"]) {
    const { res } = await viaProxy(m, unknown, TOKENS.user);
    assert.equal(res.status, 404, unknown);
  }
  // an unknown query key is dropped, not forwarded
  await viaProxy(m, "/api/mobile/reports/accounts/50000001/months?user_id=1", TOKENS.user);
  assert.equal(lastCall().path, "/v1/me/accounts/50000001/months");
  assert.equal(calls.length, n + 1, "rejected requests never reached the service");
});

test("no session: 401 before the service is called", async () => {
  const m = await load();
  const n = calls.length;
  const { res } = await viaProxy(m, "/api/mobile/reports/analytics?login=all", null);
  assert.equal(res.status, 401);
  assert.equal(calls.length, n);
});

test("view-only logins: one shared account answers 'all' with it; several must pick one; others' accounts refused", async () => {
  const m = await load();
  let r = await viaProxy(m, "/api/mobile/reports/analytics?login=all&from=2026-07-02&to=2026-10-01", TOKENS.viewerOne);
  assert.equal(r.res.status, 200);
  assert.equal(new URL(lastCall().path, "http://x").searchParams.get("login"), "50000001");

  const n = calls.length;
  r = await viaProxy(m, "/api/mobile/reports/analytics?login=all", TOKENS.viewerTwo);
  assert.equal(r.res.status, 403);
  assert.match((await r.res.json()).error.message, /Choose one of the accounts shared with you/);
  r = await viaProxy(m, "/api/mobile/reports/analytics?login=50000003", TOKENS.viewerTwo);
  assert.equal(r.res.status, 403);
  r = await viaProxy(m, "/api/mobile/reports/accounts/50000003/statement?format=pdf", TOKENS.viewerTwo);
  assert.equal(r.res.status, 403);
  r = await viaProxy(m, "/api/mobile/reports/accounts/50000003/months", TOKENS.viewerTwo);
  assert.equal(r.res.status, 403);
  assert.equal(calls.length, n, "out-of-scope requests never reached the service");

  r = await viaProxy(m, "/api/mobile/reports/accounts/50000002/months", TOKENS.viewerTwo);
  assert.equal(r.res.status, 200);
});

test("view-only logins without the statements section are held at the proxy", async () => {
  const m = await load();
  const n = calls.length;
  const { res, rewritten } = await viaProxy(m, "/api/mobile/reports/analytics?login=50000001", TOKENS.viewerNoHistory);
  assert.equal(rewritten, false);
  assert.equal(res.status, 403);
  assert.equal(calls.length, n);
});

test("reports are read-only: no write handler, and a view-only write is refused at the proxy", async () => {
  const m = await load();
  assert.equal(m.reports.POST, undefined);
  assert.equal(m.reports.PUT, undefined);
  assert.equal(m.reports.DELETE, undefined);
  const { res, rewritten } = await viaProxy(m, "/api/mobile/reports/analytics", TOKENS.viewerOne, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(rewritten, false);
  assert.equal(res.status, 403);
});
