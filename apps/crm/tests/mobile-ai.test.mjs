// Mobile app AI Trader (/ai) and support chat (/support) through /api/mobile/algo/* and /api/mobile/support/*,
// the bearer rewrites of the Client Area's algo and support BFFs: `node --test apps/crm/tests`. The proxy and the
// route handlers run as they are, against stub gateway / algo / support servers on loopback ports; no real service,
// model or secret is involved.
//
// What the app relies on: the client always comes from the bearer session (never the body); the AI assistant, saving,
// backtests and deployments follow the broker's "algo" module switch; view-only and read-only staff sessions can't
// ask the AI, deploy or chat; the service's back-office routes are unreachable; chat attachments go through as the
// raw file with its name, and come back only as the owner's file with the safety headers.

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
const VIEWER = { id: 7, label: "Accountant", username: "acc", accounts: ["50000001"], sections: ["accounts", "wallet"], expires_at: null, status: "active", last_login_at: null, created_at: "2026-09-01T00:00:00Z" };
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a5f5a3e40000000049454e44ae426082", "hex");

const calls = []; // every upstream request: {svc, method, path, headers, body, raw}
let gateway, algoSvc, supportSvc;

function stub(name, handle) {
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);
    const json = (req.headers["content-type"] ?? "").includes("application/json") && raw.length ? JSON.parse(raw.toString()) : undefined;
    calls.push({ svc: name, method: req.method, path: req.url, headers: req.headers, body: json, raw });
    const out = await handle(req, json, raw);
    if (out.bytes) {
      res.writeHead(200, out.headers);
      res.end(out.bytes);
      return;
    }
    const [status, data] = out;
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(data));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

const bearer = (req) => (req.headers.authorization ?? "").replace(/^Bearer /, "");
const upstream = (svc, method, path) => calls.filter((c) => c.svc === svc && c.method === method && c.path.split("?")[0] === path);

before(async () => {
  gateway = await stub("gateway", (req) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/v1/public/tenant-config") {
      const off = req.headers["x-kalks-host"] === "noalgo.broker.test";
      return [200, { maintenance: { active: false }, modules: off ? { algo: false } : {}, flags: {} }];
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
  algoSvc = await stub("algo", (req, body) => {
    const p = new URL(req.url, "http://x").pathname;
    if (p === "/v1/ai/strategy") return [200, { configured: true, model: "stub", target: "visual", status: "ok", questions: [], assumptions: ["RSI period 14"], result: { valid: true, errors: [], warnings: [], spec: { name: "EMA", symbol: body?.symbol ?? "EURUSD", timeframe: "H1" }, summary: { buy: "crosses_above(ema(close, 20), ema(close, 50))" } } }];
    if (p === "/v1/meta") return [200, { symbols: [], timeframes: ["H1"], ai: { configured: true, model: "stub" } }];
    if (p === "/v1/strategies") return [200, { id: 5, versionId: 9, version: 1, valid: true }];
    if (p === "/v1/backtests") return [200, { id: 3, status: "queued" }];
    if (p === "/v1/deployments") return [200, { id: 11, status: "running" }];
    if (p === "/v1/validate") return [200, { valid: true, errors: [], warnings: [] }];
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  supportSvc = await stub("support", (req, body, raw) => {
    const p = new URL(req.url, "http://x").pathname;
    if (p === "/v1/support/me") return [200, { settings: { botName: "Kalks AI", greeting: "Hi.", ai: true, agentsOnline: 0, maxAttachmentMb: 10 }, conversation: null, messages: [] }];
    if (p === "/v1/support/me/messages") return [200, { conversation: { id: 1, status: "bot" }, message: { id: 1, conversationId: 1, author: "client", body: body?.body ?? "", attachment: body?.attachmentId ? { id: body.attachmentId } : null } }];
    if (p === "/v1/support/me/handover") return [200, { conversation: { id: 1, status: "waiting" } }];
    if (p === "/v1/stream/ticket") return [200, { ticket: "t-123", expiresIn: 30 }];
    if (p === "/v1/support/me/attachments") return [200, { attachment: { id: 7, name: decodeURIComponent(req.headers["x-file-name"] ?? ""), mime: "image/png", size: raw.length } }];
    if (p === "/v1/support/me/attachments/7") return { bytes: PNG, headers: { "content-type": "image/png", "content-disposition": 'inline; filename="shot.png"', "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'", "set-cookie": "leak=1" } };
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  process.env.GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;
  process.env.ALGO_URL = `http://127.0.0.1:${algoSvc.address().port}`;
  process.env.ALGO_INTERNAL_TOKEN = "algo-internal";
  process.env.SUPPORT_URL = `http://127.0.0.1:${supportSvc.address().port}`;
  process.env.SUPPORT_INTERNAL_TOKEN = "support-internal";
});

after(() => {
  gateway?.close();
  algoSvc?.close();
  supportSvc?.close();
});

// modules read their upstream URLs at import time: import them after the stubs are listening
const load = async () => ({
  ...(await import("next/server")),
  proxy: (await import("../proxy.ts")).proxy,
  algo: await import("../app/api/algo/[...path]/route.ts"),
  support: await import("../app/api/support/[...path]/route.ts"),
});

const BASE = "https://app.kalkstrade.com";
const headersOf = (res) => Object.fromEntries(res.headers.entries());

/** Runs a request through the proxy, then (like Next) through the handler it rewrites to. */
async function viaProxy(m, url, init = {}) {
  const req = new m.NextRequest(`${BASE}${url}`, { ...init, headers: { host: "app.kalkstrade.com", ...init.headers } });
  const res = await m.proxy(req);
  const h = headersOf(res);
  if (!h["x-middleware-rewrite"] && !h["x-middleware-next"]) return { res };
  const overridden = (h["x-middleware-override-headers"] ?? "").split(",").filter(Boolean);
  const fwd = new Headers();
  for (const k of overridden) fwd.set(k, h[`x-middleware-request-${k}`]);
  const target = new URL(h["x-middleware-rewrite"] ?? `${BASE}${url}`);
  const [, , family, ...rest] = target.pathname.split("/");
  const mod = family === "algo" ? m.algo : m.support;
  const method = init.method ?? "GET";
  const inner = new m.NextRequest(target, { method, headers: fwd, body: init.body });
  const handler = mod[method];
  return { res: await handler(inner, { params: Promise.resolve({ path: rest }) }), target: target.pathname };
}

const json = (m, path, token, body, extra = {}) =>
  viaProxy(m, `/api/mobile/${path}`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...extra }, body: JSON.stringify(body) });
const get = (m, path, token, extra = {}) => viaProxy(m, `/api/mobile/${path}`, { headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra } });

/* ------------------------------------------------------------------ */
/* AI Trader                                                           */
/* ------------------------------------------------------------------ */

test("the AI draft goes to the algo service as the session's user, with the internal token, never a user from the body", async () => {
  const m = await load();
  const { res, target } = await json(m, "algo/ai/strategy", TOKENS.user, { prompt: "EMA cross", symbol: "EURUSD", timeframe: "H1", target: "visual", userId: 999, user_id: 999 });
  assert.equal(target, "/api/algo/ai/strategy");
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, "ok");
  const c = upstream("algo", "POST", "/v1/ai/strategy").at(-1);
  assert.equal(c.headers["x-kalks-user-id"], "42");
  assert.equal(c.headers["x-kalks-internal"], "algo-internal");
  assert.equal(c.body.prompt, "EMA cross");
  assert.equal(c.body.target, "visual");
});

test("saving, backtesting and deploying name the session's user; the service's back-office routes stay unreachable", async () => {
  const m = await load();
  for (const [path, body] of [
    ["algo/strategies", { kind: "visual", origin: "ai", spec: { name: "EMA" }, name: "EMA" }],
    ["algo/backtests", { strategyId: 5, versionId: 9, from: 1, to: 2, initialBalance: 10000 }],
    ["algo/deployments", { strategyId: 5, versionId: 9, login: 50000001, risk: {} }],
  ]) {
    const { res } = await json(m, path, TOKENS.user, body);
    assert.equal(res.status, 200, path);
    assert.equal(upstream("algo", "POST", `/v1/${path.slice(5)}`).at(-1).headers["x-kalks-user-id"], "42", path);
  }
  const before = calls.length;
  for (const path of ["algo/admin/overview", "algo/admin/settings", "algo/admin/house"]) {
    const { res } = await get(m, path, TOKENS.user);
    assert.equal(res.status, 404, path);
  }
  assert.equal(calls.slice(before).filter((c) => c.svc === "algo").length, 0);
});

test("the broker's algo switch: with the module off, the assistant, saving, backtests and deployments are refused before the service", async () => {
  const m = await load();
  const before = calls.filter((c) => c.svc === "algo").length;
  for (const path of ["algo/ai/strategy", "algo/strategies", "algo/backtests", "algo/deployments", "algo/validate"]) {
    const { res } = await json(m, path, TOKENS.user, { prompt: "x" }, { host: "noalgo.broker.test" });
    assert.equal(res.status, 403, path);
    assert.equal((await res.json()).error.code, "module_disabled", path);
  }
  assert.equal(calls.filter((c) => c.svc === "algo").length, before);
});

test("view-only logins can't ask the AI or read strategies; read-only staff sessions can read but not deploy", async () => {
  const m = await load();
  const before = calls.filter((c) => c.svc === "algo").length;
  const ask = await json(m, "algo/ai/strategy", TOKENS.viewer, { prompt: "x" });
  assert.equal(ask.res.status, 403);
  const list = await get(m, "algo/strategies", TOKENS.viewer);
  assert.equal(list.res.status, 403);
  const dep = await json(m, "algo/deployments", TOKENS.staffRead, { strategyId: 5, login: 50000001 });
  assert.equal(dep.res.status, 403);
  assert.equal((await dep.res.json()).error.code, "staff_read_only");
  assert.equal(calls.filter((c) => c.svc === "algo").length, before, "nothing reached the algo service");
  const meta = await get(m, "algo/meta", TOKENS.staffRead);
  assert.equal(meta.res.status, 200);
});

test("without a bearer token a browser cookie never authenticates the app's algo routes", async () => {
  const m = await load();
  const { res } = await viaProxy(m, "/api/mobile/algo/strategies", { headers: { cookie: `kalks_session=${TOKENS.user}` } });
  assert.equal(res.status, 401);
});

/* ------------------------------------------------------------------ */
/* Support chat                                                        */
/* ------------------------------------------------------------------ */

test("chat messages and handover are the session user's; the stream ticket comes from the service", async () => {
  const m = await load();
  const sent = await json(m, "support/messages", TOKENS.user, { body: "Where is my withdrawal?", userId: 999 });
  assert.equal(sent.res.status, 200);
  const c = upstream("support", "POST", "/v1/support/me/messages").at(-1);
  assert.equal(c.headers["x-kalks-user-id"], "42");
  assert.equal(c.headers["x-kalks-internal"], "support-internal");
  assert.equal(c.body.body, "Where is my withdrawal?");
  const h = await json(m, "support/handover", TOKENS.user, {});
  assert.equal((await h.res.json()).conversation.status, "waiting");
  const tk = await json(m, "support/stream-ticket", TOKENS.user, {});
  assert.equal(tk.res.status, 200);
  assert.equal((await tk.res.json()).ticket, "t-123");
  assert.equal(upstream("support", "POST", "/v1/stream/ticket").at(-1).headers["x-kalks-user-id"], "42");
});

test("attachments: the raw file goes up with its name; it comes back with the service's safety headers and nothing else", async () => {
  const m = await load();
  const up = await viaProxy(m, "/api/mobile/support/attachments", { method: "POST", headers: { authorization: `Bearer ${TOKENS.user}`, "content-type": "image/png", "x-file-name": encodeURIComponent("my shot.png") }, body: PNG });
  assert.equal(up.res.status, 200);
  const a = (await up.res.json()).attachment;
  assert.equal(a.name, "my shot.png");
  const c = upstream("support", "POST", "/v1/support/me/attachments").at(-1);
  assert.equal(c.headers["x-kalks-user-id"], "42");
  assert.equal(c.raw.length, PNG.length);
  const file = await get(m, "support/attachments/7", TOKENS.user);
  assert.equal(file.res.status, 200);
  const h = headersOf(file.res);
  assert.equal(h["content-type"], "image/png");
  assert.equal(h["x-content-type-options"], "nosniff");
  assert.equal(h["content-security-policy"], "default-src 'none'");
  assert.equal(h["cache-control"], "private, no-store");
  assert.equal(h["set-cookie"], undefined);
  assert.equal(Buffer.from(await file.res.arrayBuffer()).length, PNG.length);
});

test("view-only logins have no support chat (read or write); read-only staff can read it but not write", async () => {
  const m = await load();
  const before = calls.filter((c) => c.svc === "support").length;
  assert.equal((await get(m, "support/me", TOKENS.viewer)).res.status, 403);
  assert.equal((await json(m, "support/messages", TOKENS.viewer, { body: "hi" })).res.status, 403);
  const staff = await json(m, "support/messages", TOKENS.staffRead, { body: "hi" });
  assert.equal(staff.res.status, 403);
  assert.equal((await staff.res.json()).error.code, "staff_read_only");
  assert.equal(calls.filter((c) => c.svc === "support").length, before);
  assert.equal((await get(m, "support/me", TOKENS.staffRead)).res.status, 200);
});
