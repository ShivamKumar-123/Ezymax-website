// Mobile app Academy (apps/mobile/src/features/academy) through /api/mobile/academy/*, the bearer rewrites of the
// Client Area Academy BFF: `node --test apps/crm/tests`. The proxy and the route handler run as they are, against stub
// gateway / academy servers on loopback ports; no real service or secret is involved.
//
// What the app relies on: the learner always comes from the bearer session (never the body or the query); quiz and
// exam answers are validated before the Academy service sees them (the service grades them, the app never has the
// answers); the reading language is passed through; view-only logins can't open the Academy and read-only staff
// sessions can't record progress; a broker that switched the module off answers module_disabled; certificate images
// stay public (the verification link works for anyone) and odd codes never reach the service.

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
const CODE = "KA-ABCDE-23456";

const calls = []; // every upstream request: {svc, method, path, headers, body}
let gateway, academySvc;

function stub(name, handle) {
  const server = createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    const body = raw ? JSON.parse(raw) : undefined;
    calls.push({ svc: name, method: req.method, path: req.url, headers: req.headers, body });
    const [status, data, type] = await handle(req, body);
    res.writeHead(status, { "content-type": type ?? "application/json" });
    res.end(type ? data : JSON.stringify(data));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

const bearer = (req) => (req.headers.authorization ?? "").replace(/^Bearer /, "");
const academyCalls = () => calls.filter((c) => c.svc === "academy");

before(async () => {
  gateway = await stub("gateway", (req) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/v1/public/tenant-config") {
      // a broker that switched the Academy off (D112)
      const off = req.headers["x-kalks-host"] === "noacademy.example";
      return [200, { maintenance: { active: false }, modules: off ? { academy: false } : {}, flags: {} }];
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
  academySvc = await stub("academy", (req, body) => {
    const url = new URL(req.url, "http://x");
    const p = url.pathname;
    if (p === `/v1/public/certificates/${CODE}/svg`) return [200, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1131"><text>${CODE}</text></svg>`, "image/svg+xml; charset=utf-8"];
    if (p === `/v1/public/certificates/${CODE}`) return [200, { code: CODE, valid: true }];
    if (req.headers["x-kalks-user-id"] !== "42") return [401, { error: { code: "unauthorized", message: "Missing user." } }];
    if (p === "/v1/catalog") return [200, { lang: url.searchParams.get("lang") ?? "en", phases: [], me: { chapters_done: 0, chapters_total: 110 } }];
    if (p === "/v1/glossary") return [200, { terms: [], categories: [], total: 257 }];
    if (p === "/v1/me/certificates") return [200, { certificates: [] }];
    if (p === "/v1/chapters/p1-f-how-financial-markets-work") return [200, { chapter: { slug: "p1-f-how-financial-markets-work", quiz: [{ question: "Q?", options: ["a", "b"] }] } }];
    if (p === "/v1/chapters/nope") return [404, { error: { code: "not_found", message: "Chapter not found." } }];
    if (p.endsWith("/progress") && req.method === "POST") return [200, { progress: { read_pct: body.read_pct, completed: false } }];
    if (p.endsWith("/quiz") && req.method === "POST") return [200, { results: [], answered: body.answers.filter((a) => a !== null).length, all_answered: false }];
    if (p === "/v1/exams/phase-1" && req.method === "POST") return [409, { error: { code: "exam_locked", message: "Complete all 13 chapters of this phase first (12 done)." } }];
    if (p === "/v1/exams/phase-1") return [200, { unlocked: false, exam: { questions: [], count: 15, pass_mark: 70 } }];
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  process.env.GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;
  process.env.ACADEMY_URL = `http://127.0.0.1:${academySvc.address().port}`;
  process.env.ACADEMY_INTERNAL_TOKEN = "test-academy-internal";
});

after(() => {
  gateway?.close();
  academySvc?.close();
});

// modules read their upstream URLs at import time: import them after the stubs are listening
const load = async () => ({
  ...(await import("next/server")),
  mobile: await import("../lib/mobile.ts"),
  proxy: (await import("../proxy.ts")).proxy,
  academy: await import("../app/api/academy/[...path]/route.ts"),
});

const BASE = "https://app.kalkstrade.com";
const headersOf = (res) => Object.fromEntries(res.headers.entries());
const auth = (token, extra = {}) => ({ authorization: `Bearer ${token}`, ...extra });
const json = (token, body) => ({ method: "POST", headers: auth(token, { "content-type": "application/json" }), body: JSON.stringify(body) });

/** Runs a request through the proxy, then (like Next) through the handler it rewrites to. */
async function viaProxy(m, url, init, params) {
  const req = new m.NextRequest(`${BASE}${url}`, init);
  const res = await m.proxy(req);
  const h = headersOf(res);
  if (!h["x-middleware-rewrite"] && !h["x-middleware-next"]) return { res, forwarded: null };
  const overridden = (h["x-middleware-override-headers"] ?? "").split(",").filter(Boolean);
  const fwd = new Headers();
  for (const k of overridden) fwd.set(k, h[`x-middleware-request-${k}`]);
  const target = h["x-middleware-rewrite"] ?? `${BASE}${url}`;
  const inner = new m.NextRequest(target, { method: init?.method ?? "GET", headers: fwd, body: init?.body });
  const handler = (init?.method ?? "GET") === "GET" ? m.academy.GET : m.academy.POST;
  return { res: await handler(inner, { params: Promise.resolve({ path: params }) }), forwarded: fwd, target };
}

test("academy paths are rewrites of the Client Area Academy BFF", async () => {
  const { mobile } = await load();
  assert.deepEqual(mobile.mobileRoute("/api/mobile/academy/catalog"), { kind: "rewrite", target: "/api/academy/catalog", policyPath: "/api/academy/catalog" });
  assert.deepEqual(mobile.mobileRoute("/api/mobile/academy/chapters/p1-a/quiz"), { kind: "rewrite", target: "/api/academy/chapters/p1-a/quiz", policyPath: "/api/academy/chapters/p1-a/quiz" });
  assert.equal(mobile.mobileRoute("/api/mobile/academy/../wallet/overview"), null);
});

test("the learner comes from the bearer session; the reading language passes through; nothing is cached", async () => {
  const m = await load();
  const { res, target } = await viaProxy(m, "/api/mobile/academy/catalog?lang=hi&user=999", { headers: auth(TOKENS.user) }, ["catalog"]);
  assert.equal(target, `${BASE}/api/academy/catalog?lang=hi&user=999`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal((await res.json()).lang, "hi");
  const sent = academyCalls().at(-1);
  assert.equal(sent.path, "/v1/catalog?lang=hi", "only the language is forwarded");
  assert.equal(sent.headers["x-kalks-user-id"], "42");
  assert.equal(sent.headers["x-kalks-tenant"], "kalks");
  assert.equal(sent.headers["x-kalks-internal"], "test-academy-internal");
  assert.equal(sent.headers.authorization, undefined, "the session token never reaches the Academy service");
});

test("quiz answers are checked before the service and graded there; a user id in the body is ignored", async () => {
  const m = await load();
  const ok = await viaProxy(m, "/api/mobile/academy/chapters/p1-f-how-financial-markets-work/quiz?lang=en", json(TOKENS.user, { answers: [1, null, 3], user_id: 999 }), ["chapters", "p1-f-how-financial-markets-work", "quiz"]);
  assert.equal(ok.res.status, 200);
  const sent = academyCalls().at(-1);
  assert.equal(sent.path, "/v1/chapters/p1-f-how-financial-markets-work/quiz?lang=en");
  assert.deepEqual(sent.body, { answers: [1, null, 3] });
  assert.equal(sent.headers["x-kalks-user-id"], "42");
  const n = academyCalls().length;
  for (const answers of [["1"], [1.5], [-1], [10], Array(11).fill(0), "x"]) {
    const bad = await viaProxy(m, "/api/mobile/academy/chapters/p1-f-how-financial-markets-work/quiz", json(TOKENS.user, { answers }), ["chapters", "p1-f-how-financial-markets-work", "quiz"]);
    assert.equal(bad.res.status, 400, JSON.stringify(answers));
  }
  assert.equal(academyCalls().length, n, "refused answers never reach the service");
});

test("reading progress is clamped and rounded; exam answers must all be given", async () => {
  const m = await load();
  await viaProxy(m, "/api/mobile/academy/chapters/p1-f-how-financial-markets-work/progress", json(TOKENS.user, { read_pct: 150.7 }), ["chapters", "p1-f-how-financial-markets-work", "progress"]);
  assert.deepEqual(academyCalls().at(-1).body, { read_pct: 100 });
  await viaProxy(m, "/api/mobile/academy/chapters/p1-f-how-financial-markets-work/progress", json(TOKENS.user, { read_pct: 42.4 }), ["chapters", "p1-f-how-financial-markets-work", "progress"]);
  assert.deepEqual(academyCalls().at(-1).body, { read_pct: 42 });
  const n = academyCalls().length;
  const bad = await viaProxy(m, "/api/mobile/academy/exams/phase-1", json(TOKENS.user, { answers: [1, null] }), ["exams", "phase-1"]);
  assert.equal(bad.res.status, 400);
  assert.equal(academyCalls().length, n);
  // the service decides whether the exam is unlocked
  const locked = await viaProxy(m, "/api/mobile/academy/exams/phase-1", json(TOKENS.user, { answers: [1, 2, 0] }), ["exams", "phase-1"]);
  assert.equal(locked.res.status, 409);
  assert.equal((await locked.res.json()).error.code, "exam_locked");
});

test("unknown chapters answer 404 from the service; malformed slugs never reach it", async () => {
  const m = await load();
  const nf = await viaProxy(m, "/api/mobile/academy/chapters/nope", { headers: auth(TOKENS.user) }, ["chapters", "nope"]);
  assert.equal(nf.res.status, 404);
  const n = academyCalls().length;
  const bad = await viaProxy(m, "/api/mobile/academy/chapters/Bad_Slug!", { headers: auth(TOKENS.user) }, ["chapters", "Bad_Slug!"]);
  assert.equal(bad.res.status, 404);
  assert.equal(academyCalls().length, n);
});

test("a browser cookie never authenticates the Academy on the mobile path", async () => {
  const m = await load();
  const n = academyCalls().length;
  const { res } = await viaProxy(m, "/api/mobile/academy/catalog", { headers: { cookie: `kalks_session=${TOKENS.user}` } }, ["catalog"]);
  assert.equal(res.status, 401);
  const post = await viaProxy(m, "/api/mobile/academy/chapters/p1-f-how-financial-markets-work/quiz", { method: "POST", headers: { "content-type": "application/json", cookie: `kalks_session=${TOKENS.user}`, origin: "https://evil.example" }, body: JSON.stringify({ answers: [1] }) }, ["chapters", "p1-f-how-financial-markets-work", "quiz"]);
  assert.ok(post.res.status === 401 || post.res.status === 403, `got ${post.res.status}`);
  assert.equal(academyCalls().length, n);
});

test("view-only logins can't open the Academy; read-only staff sessions can read but not record anything", async () => {
  const m = await load();
  const n = academyCalls().length;
  const read = await viaProxy(m, "/api/mobile/academy/catalog", { headers: auth(TOKENS.viewer) }, ["catalog"]);
  assert.equal(read.res.status, 403);
  assert.equal((await read.res.json()).error.code, "viewer_scope");
  const write = await viaProxy(m, "/api/mobile/academy/chapters/p1-f-how-financial-markets-work/quiz", json(TOKENS.viewer, { answers: [1] }), ["chapters", "p1-f-how-financial-markets-work", "quiz"]);
  assert.equal(write.res.status, 403);
  assert.equal((await write.res.json()).error.code, "viewer_read_only");
  assert.equal(academyCalls().length, n);
  const staffRead = await viaProxy(m, "/api/mobile/academy/glossary", { headers: auth(TOKENS.staffRead) }, ["glossary"]);
  assert.equal(staffRead.res.status, 200);
  const before = academyCalls().length;
  const staffWrite = await viaProxy(m, "/api/mobile/academy/chapters/p1-f-how-financial-markets-work/progress", json(TOKENS.staffRead, { read_pct: 50 }), ["chapters", "p1-f-how-financial-markets-work", "progress"]);
  assert.equal(staffWrite.res.status, 403);
  assert.equal((await staffWrite.res.json()).error.code, "staff_read_only");
  assert.equal(academyCalls().length, before, "a refused write never reaches the Academy service");
  // the refusal is reported to the gateway for the staff audit
  const ev = calls.filter((c) => c.path === "/v1/auth/impersonation/event").at(-1);
  assert.equal(ev.body.kind, "write_refused");
  assert.equal(ev.body.path, "/api/academy/chapters/p1-f-how-financial-markets-work/progress");
});

test("a broker without the Academy module answers module_disabled before the Academy service", async () => {
  const m = await load();
  const n = academyCalls().length;
  const res = await m.proxy(new m.NextRequest(`${BASE}/api/mobile/academy/catalog`, { headers: { host: "noacademy.example", authorization: `Bearer ${TOKENS.user}` } }));
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error.code, "module_disabled");
  assert.equal(academyCalls().length, n);
});

test("certificate images and verification stay public on the mobile path; odd codes never reach the service", async () => {
  const m = await load();
  const img = await viaProxy(m, `/api/mobile/academy/certificates/${CODE}/image`, {}, ["certificates", CODE, "image"]);
  assert.equal(img.res.status, 200);
  assert.match(img.res.headers.get("content-type"), /^image\/svg\+xml/);
  assert.equal(img.res.headers.get("content-security-policy"), "default-src 'none'; style-src 'unsafe-inline'");
  assert.match(await img.res.text(), new RegExp(CODE));
  const verify = await viaProxy(m, `/api/mobile/academy/certificates/${CODE}`, {}, ["certificates", CODE]);
  assert.equal((await verify.res.json()).valid, true);
  const n = academyCalls().length;
  for (const code of ["KA-abcde-12345", "../../etc", "KA-ABCDE-2345"]) {
    const bad = await viaProxy(m, `/api/mobile/academy/certificates/${encodeURIComponent(code)}/image`, {}, ["certificates", code, "image"]);
    assert.equal(bad.res.status, 404, code);
  }
  assert.equal(academyCalls().length, n);
});
