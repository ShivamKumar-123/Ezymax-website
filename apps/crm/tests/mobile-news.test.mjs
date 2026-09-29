// Mobile app news and economic calendar (/api/mobile/news/*, the app's /news, /news/[id] and /calendar):
// `node --test apps/crm/tests`. The proxy and the Client Area news BFF run as they are, against stub gateway and news
// services on loopback ports: headlines, the brief and the calendar are the broker's public reads; reminders and
// alerts belong to the bearer session's client; view-only and read-only staff sessions never write; only validated
// queries and bodies reach the service.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import "./helpers/ts-hooks.mjs";

const TOKENS = {
  user: "u".repeat(43),
  viewerDash: `v.${"d".repeat(43)}`,
  viewerWallet: `v.${"w".repeat(43)}`,
  staffRead: `i.${"r".repeat(43)}`,
};
const USER = { id: 42, email: "arjun@example.com", first_name: "Arjun", last_name: "Mehta", name: "Arjun Mehta", kyc_status: "verified", tenant: { slug: "acme", name: "Acme Markets" } };
const viewer = (id, sections) => ({ id, label: "Accountant", username: `acc${id}`, accounts: [], sections, expires_at: null, status: "active", last_login_at: null, created_at: "2026-09-01T00:00:00Z" });
const VIEWERS = { [TOKENS.viewerDash]: viewer(7, ["dashboard"]), [TOKENS.viewerWallet]: viewer(8, ["wallet"]) };
const NEWS_TOKEN = "news-internal-test-token";

const calls = []; // news service requests: {method, path, headers, body}
const staffEvents = [];
let gateway, newsSvc;

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}
const json = (res, status, data) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
};

before(async () => {
  gateway = await listen(
    createServer(async (req, res) => {
      let raw = "";
      for await (const c of req) raw += c;
      const url = new URL(req.url, "http://x");
      const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
      if (url.pathname === "/v1/public/tenant-config") return json(res, 200, { maintenance: { active: false }, modules: {}, flags: {} });
      if (url.pathname === "/v1/auth/impersonation/event") {
        staffEvents.push(JSON.parse(raw || "{}"));
        return json(res, 200, { status: "ok" });
      }
      if (url.pathname === "/v1/auth/me") {
        if (token === TOKENS.user || token === TOKENS.staffRead) return json(res, 200, { user: USER, viewer: null });
        if (VIEWERS[token]) return json(res, 200, { user: USER, viewer: VIEWERS[token] });
        return json(res, 401, { error: { code: "unauthorized", message: "Please sign in." } });
      }
      return json(res, 404, { error: { code: "not_found", message: "stub" } });
    }),
  );
  newsSvc = await listen(
    createServer(async (req, res) => {
      let raw = "";
      for await (const c of req) raw += c;
      calls.push({ method: req.method, path: req.url, headers: req.headers, body: raw ? JSON.parse(raw) : undefined });
      const url = new URL(req.url, "http://x");
      if (url.pathname === "/v1/news") return json(res, 200, { pinned: [], items: [{ id: 5, title: "ECB holds rates", summary: "", symbols: ["EURUSD"] }], next: null });
      if (/^\/v1\/news\/\d+$/.test(url.pathname)) return json(res, 200, { item: { id: Number(url.pathname.split("/").pop()), title: "ECB holds rates" } });
      if (url.pathname === "/v1/brief") return json(res, 200, { brief: null, day: "2026-09-30", model: null, createdAt: null, configured: true });
      if (url.pathname === "/v1/calendar") return json(res, 200, { events: [], from: "2026-09-27T21:00:00Z", to: "2026-10-04T21:00:00Z", serverOffset: 3, now: "2026-09-30T01:00:00Z", updatedAt: null, source: { name: "Forex Factory" } });
      if (url.pathname === "/v1/calendar/next") return json(res, 200, { event: null, serverOffset: 3, now: "2026-09-30T01:00:00Z" });
      if (/^\/v1\/calendar\/\d+$/.test(url.pathname)) return json(res, 200, { event: { id: 12 }, history: [] });
      if (url.pathname === "/v1/me/calendar") return json(res, 200, { reminders: [12], alerts: null });
      if (url.pathname === "/v1/me/calendar/reminders" && req.method === "POST") return json(res, 200, { eventId: 12, minutes: 30, remindAt: "2026-10-02T12:00:00Z" });
      if (/^\/v1\/me\/calendar\/reminders\/\d+$/.test(url.pathname) && req.method === "DELETE") return json(res, 200, { ok: true });
      if (url.pathname === "/v1/me/calendar/alerts") return json(res, 200, { alerts: req.method === "DELETE" ? null : { highImpact: true, currencies: [], minutes: 15 } });
      return json(res, 404, { error: { code: "not_found", message: "Not found." } });
    }),
  );
  process.env.GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;
  process.env.NEWS_URL = `http://127.0.0.1:${newsSvc.address().port}`;
  process.env.NEWS_INTERNAL_TOKEN = NEWS_TOKEN;
});

after(() => {
  gateway?.close();
  newsSvc?.close();
});

// modules read their upstream URLs at import time: import them after the stubs are listening
const load = async () => ({
  ...(await import("next/server")),
  proxy: (await import("../proxy.ts")).proxy,
  news: await import("../app/api/news/[...path]/route.ts"),
});

const BASE = "https://app.kalkstrade.com";
const headersOf = (res) => Object.fromEntries(res.headers.entries());

/** Runs a request through the proxy, then (like Next) through the news handler it rewrites to. */
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
  const path = target.pathname.replace(/^\/api\/news\//, "").split("/");
  const method = init.method ?? "GET";
  const inner = new m.NextRequest(target, { method, headers: fwd, body: init.body });
  return { res: await m.news[method](inner, { params: Promise.resolve({ path }) }), rewritten: true, target };
}

const lastCall = () => calls[calls.length - 1];
const JSON_BODY = (b) => ({ headers: { "content-type": "application/json" }, body: JSON.stringify(b) });

test("feed: the broker's headlines through the rewrite; only the known query keys reach the service", async () => {
  const m = await load();
  const n = calls.length;
  const { res, target } = await viaProxy(m, "/api/mobile/news/feed?limit=30&minImportance=45&sentiment=bullish&currency=USD&symbol=XAUUSD&before=2026-09-29T20%3A00%3A00Z&user_id=1", TOKENS.user, { headers: { cookie: "kalks_session=someone-else" } });
  assert.equal(target.pathname, "/api/news/feed");
  assert.equal(res.status, 200);
  assert.equal((await res.json()).items[0].title, "ECB holds rates");
  assert.equal(calls.length, n + 1);
  const c = lastCall();
  const q = new URL(c.path, "http://x");
  assert.equal(q.pathname, "/v1/news");
  assert.deepEqual(Object.fromEntries(q.searchParams), { symbol: "XAUUSD", currency: "USD", sentiment: "bullish", before: "2026-09-29T20:00:00Z", limit: "30", minImportance: "45" });
  // the broker whose pinned / hidden stories apply comes from the bearer session, never from the browser cookie
  assert.equal(c.headers["x-kalks-tenant"], "acme");
  assert.equal(c.headers["x-kalks-internal"], NEWS_TOKEN);
});

test("story, brief and calendar reads", async () => {
  const m = await load();
  let r = await viaProxy(m, "/api/mobile/news/feed/77", TOKENS.user);
  assert.equal(r.res.status, 200);
  assert.equal(lastCall().path, "/v1/news/77");
  r = await viaProxy(m, "/api/mobile/news/brief", TOKENS.user);
  assert.equal(r.res.status, 200);
  assert.equal(lastCall().path, "/v1/brief");
  r = await viaProxy(m, "/api/mobile/news/calendar?from=2026-10-04T21%3A00%3A00.000Z&to=2026-10-11T21%3A00%3A00.000Z&impact=3&currency=USD,EUR&drop=1", TOKENS.user);
  assert.equal(r.res.status, 200);
  const q = new URL(lastCall().path, "http://x");
  assert.equal(q.pathname, "/v1/calendar");
  assert.deepEqual(Object.fromEntries(q.searchParams), { from: "2026-10-04T21:00:00.000Z", to: "2026-10-11T21:00:00.000Z", currency: "USD,EUR", impact: "3" });
  r = await viaProxy(m, "/api/mobile/news/calendar/next?impact=3", TOKENS.user);
  assert.equal(r.res.status, 200);
  assert.equal(lastCall().path, "/v1/calendar/next?impact=3");
  r = await viaProxy(m, "/api/mobile/news/calendar/12", TOKENS.user);
  assert.equal(r.res.status, 200);
  assert.equal(lastCall().path, "/v1/calendar/12");
  for (const bad of ["/api/mobile/news/feed/abc", "/api/mobile/news/calendar/12/x", "/api/mobile/news/admin/news"]) {
    const { res } = await viaProxy(m, bad, TOKENS.user);
    assert.equal(res.status, 404, bad);
  }
});

test("reminders and alerts belong to the bearer session's client", async () => {
  const m = await load();
  let r = await viaProxy(m, "/api/mobile/news/me/calendar", TOKENS.user);
  assert.equal(r.res.status, 200);
  assert.deepEqual((await r.res.json()).reminders, [12]);
  assert.equal(lastCall().headers["x-kalks-user-id"], "42");

  r = await viaProxy(m, "/api/mobile/news/me/calendar/reminders", TOKENS.user, { method: "POST", ...JSON_BODY({ eventId: 12, minutes: 30, userId: 99 }) });
  assert.equal(r.res.status, 200);
  let c = lastCall();
  assert.equal(c.method, "POST");
  assert.equal(c.path, "/v1/me/calendar/reminders");
  assert.equal(c.headers["x-kalks-user-id"], "42");
  assert.equal(c.headers["x-kalks-tenant"], "acme");
  assert.deepEqual(c.body, { eventId: 12, minutes: 30 }, "only the event and the lead time are forwarded");

  r = await viaProxy(m, "/api/mobile/news/me/calendar/reminders/12", TOKENS.user, { method: "DELETE" });
  assert.equal(r.res.status, 200);
  c = lastCall();
  assert.equal(c.method, "DELETE");
  assert.equal(c.path, "/v1/me/calendar/reminders/12");
  assert.equal(c.headers["x-kalks-user-id"], "42");

  r = await viaProxy(m, "/api/mobile/news/me/calendar/alerts", TOKENS.user, { method: "PUT", ...JSON_BODY({ highImpact: true, currencies: ["USD", 5], minutes: 30 }) });
  assert.equal(r.res.status, 200);
  assert.deepEqual(lastCall().body, { highImpact: true, currencies: ["USD"], minutes: 30 });
  r = await viaProxy(m, "/api/mobile/news/me/calendar/alerts", TOKENS.user, { method: "DELETE" });
  assert.equal(r.res.status, 200);
  assert.equal(lastCall().method, "DELETE");
});

test("no bearer session: reminders are refused before the service; a browser cookie never counts", async () => {
  const m = await load();
  const n = calls.length;
  // a write without the bearer token is an anonymous cross-site request for the cookie route (same-origin check)
  let r = await viaProxy(m, "/api/mobile/news/me/calendar/reminders", null, { method: "POST", ...JSON_BODY({ eventId: 12 }) });
  assert.equal(r.res.status, 403);
  r = await viaProxy(m, "/api/mobile/news/me/calendar", null, { headers: { cookie: `kalks_session=${TOKENS.user}` } });
  assert.equal(r.res.status, 401);
  assert.equal(calls.length, n);
});

test("invalid reminder input is refused before the service", async () => {
  const m = await load();
  const n = calls.length;
  for (const body of [{ eventId: "abc" }, { eventId: -3 }, { eventId: 1.5 }, {}]) {
    const { res } = await viaProxy(m, "/api/mobile/news/me/calendar/reminders", TOKENS.user, { method: "POST", ...JSON_BODY(body) });
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  const { res } = await viaProxy(m, "/api/mobile/news/me/calendar/reminders/12;drop", TOKENS.user, { method: "DELETE" });
  assert.equal(res.status, 404);
  assert.equal(calls.length, n, "rejected requests never reached the service");
});

test("view-only logins: news and the calendar with the Dashboard section; never a reminder or an alert", async () => {
  const m = await load();
  let r = await viaProxy(m, "/api/mobile/news/calendar/next?impact=2", TOKENS.viewerDash);
  assert.equal(r.res.status, 200);
  const n = calls.length;
  for (const [method, path, body] of [
    ["POST", "/api/mobile/news/me/calendar/reminders", { eventId: 12, minutes: 15 }],
    ["DELETE", "/api/mobile/news/me/calendar/reminders/12", undefined],
    ["PUT", "/api/mobile/news/me/calendar/alerts", { highImpact: true, currencies: [], minutes: 15 }],
    ["DELETE", "/api/mobile/news/me/calendar/alerts", undefined],
  ]) {
    r = await viaProxy(m, path, TOKENS.viewerDash, { method, ...(body ? JSON_BODY(body) : {}) });
    assert.equal(r.rewritten, false, `${method} ${path}`);
    assert.equal(r.res.status, 403);
    assert.equal((await r.res.json()).error.code, "viewer_read_only");
  }
  // a login without the Dashboard section can't read the news at all
  r = await viaProxy(m, "/api/mobile/news/feed?limit=5", TOKENS.viewerWallet);
  assert.equal(r.rewritten, false);
  assert.equal(r.res.status, 403);
  assert.equal((await r.res.json()).error.code, "viewer_scope");
  assert.equal(calls.length, n, "held requests never reached the service");
});

test("read-only staff sessions can read but not set reminders (the refusal is reported for the audit)", async () => {
  const m = await load();
  let r = await viaProxy(m, "/api/mobile/news/me/calendar", TOKENS.staffRead);
  assert.equal(r.res.status, 200);
  const n = calls.length;
  const e = staffEvents.length;
  r = await viaProxy(m, "/api/mobile/news/me/calendar/reminders", TOKENS.staffRead, { method: "POST", ...JSON_BODY({ eventId: 12 }) });
  assert.equal(r.rewritten, false);
  assert.equal(r.res.status, 403);
  assert.equal((await r.res.json()).error.code, "staff_read_only");
  assert.equal(calls.length, n);
  assert.equal(staffEvents.length, e + 1);
  assert.equal(staffEvents.at(-1).kind, "write_refused");
});
