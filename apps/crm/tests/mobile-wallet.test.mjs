// Mobile app wallet (apps/mobile/src/features/wallet) through /api/mobile/wallet/*, the bearer rewrites of the Client
// Area wallet BFF: `node --test apps/crm/tests`. The proxy and the route handler run as they are, against stub
// gateway / wallet / engine servers on loopback ports; no real service or secret is involved.
//
// What the app relies on: the user always comes from the bearer session (never the body); a withdrawal needs a
// verified identity, runs every wallet check before the emailed code is redeemed (so a refused request never spends
// it), redeems the code bound to "<chain>-<amount>" exactly once, and books with a per-user idempotency key; deposits
// and transfers are validated before the wallet sees them; view-only logins can't move money.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import "./helpers/ts-hooks.mjs";

const TOKENS = {
  user: "u".repeat(43),
  pending: "p".repeat(43),
  viewer: `v.${"w".repeat(43)}`,
};
const USER = { id: 42, email: "arjun@example.com", first_name: "Arjun", last_name: "Mehta", name: "Arjun Mehta", kyc_status: "verified", tenant: { slug: "kalks", name: "Kalks" } };
const PENDING = { ...USER, id: 43, email: "neha@example.com", kyc_status: "pending" };
const VIEWER = { id: 7, label: "Accountant", username: "acc", accounts: ["50000001"], sections: ["wallet"], expires_at: null, status: "active", last_login_at: null, created_at: "2026-09-01T00:00:00Z" };

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
const walletCalls = (method, path) => calls.filter((c) => c.svc === "wallet" && c.method === method && c.path.split("?")[0] === path);
const consumes = () => calls.filter((c) => c.svc === "gateway" && c.path === "/v1/auth/stepup/consume");

before(async () => {
  gateway = await stub("gateway", (req, body) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/v1/public/tenant-config") return [200, { maintenance: { active: false }, modules: {}, flags: {} }];
    if (url.pathname === "/v1/auth/stepup/consume") {
      return body?.token === "st-ok" ? [200, { status: "ok" }] : [403, { error: { code: "stepup_invalid", message: "This confirmation has expired or was already used. Confirm the change again." } }];
    }
    if (url.pathname === "/v1/auth/me") {
      const t = bearer(req);
      if (t === TOKENS.user) return [200, { user: USER, viewer: null }];
      if (t === TOKENS.pending) return [200, { user: PENDING, viewer: null }];
      if (t === TOKENS.viewer) return [200, { user: USER, viewer: VIEWER }];
      return [401, { error: { code: "unauthorized", message: "Please sign in." } }];
    }
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  walletSvc = await stub("wallet", (req, body) => {
    const url = new URL(req.url, "http://x");
    const p = url.pathname;
    if (p === "/v1/withdrawals/quote") {
      if (body?.amount === "999") return [422, { error: { code: "insufficient_funds", message: "Insufficient available balance" } }];
      return [200, { quote: { amount: body.amount, fee: "1", net_amount: String(Number(body.amount) - 1), used_today: "0", daily_max: "100000", available: "500" } }];
    }
    if (p === "/v1/withdrawals") return [200, { withdrawal: { id: 9, status: "requested", amount: body.amount, fee: "1", net_amount: "19" } }];
    if (/^\/v1\/withdrawals\/\d+\/cancel$/.test(p)) return [200, { withdrawal: { id: 77, status: "cancelled" } }];
    if (p === "/v1/deposits/intents") return [200, { intent: { id: "dep_0123456789abcdef01234567", chain: body.chain, amount: body.amount, address: "0x11e9373d598703f83582e34378e086ebeec5da11", status: "open" } }];
    if (p === "/v1/deposits/submit") return [200, { deposit: { id: 5, status: "pending", tx_hash: body.tx_hash } }];
    if (p.startsWith("/v1/deposits/intents/")) return [200, { intent: { id: p.split("/").pop() }, deposit: null }];
    if (/^\/v1\/wallets\/\d+\/(to|from)-trading$/.test(p)) return [200, { transfer: { id: 3, status: "completed", login: body.login, amount: body.amount } }];
    if (/^\/v1\/wallets\/\d+\/activity$/.test(p)) return [200, { items: [], page: 1, limit: 25, total: 0 }];
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
  proxy: (await import("../proxy.ts")).proxy,
  wallet: await import("../app/api/wallet/[...path]/route.ts"),
});

const BASE = "https://app.kalkstrade.com";
const headersOf = (res) => Object.fromEntries(res.headers.entries());

/** Runs a request through the proxy, then (like Next) through the handler it rewrites to. */
async function viaProxy(m, url, init, params) {
  const req = new m.NextRequest(`${BASE}${url}`, init);
  const res = await m.proxy(req);
  const h = headersOf(res);
  if (!h["x-middleware-rewrite"] && !h["x-middleware-next"]) return { res };
  const overridden = (h["x-middleware-override-headers"] ?? "").split(",").filter(Boolean);
  const fwd = new Headers();
  for (const k of overridden) fwd.set(k, h[`x-middleware-request-${k}`]);
  const target = h["x-middleware-rewrite"] ?? `${BASE}${url}`;
  const inner = new m.NextRequest(target, { method: init?.method ?? "GET", headers: fwd, body: init?.body });
  const handler = (init?.method ?? "GET") === "GET" ? m.wallet.GET : m.wallet.POST;
  return { res: await handler(inner, { params: Promise.resolve(params) }), target };
}

const post = (m, path, token, body) =>
  viaProxy(m, `/api/mobile/wallet/${path}`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) }, { path: path.split("?")[0].split("/") });
const get = (m, path, token) => viaProxy(m, `/api/mobile/wallet/${path}`, { headers: { authorization: `Bearer ${token}` } }, { path: path.split("?")[0].split("/") });

const WITHDRAW = { chain: "bsc", amount: "20", to_address: "0x8f3A7dF7ffaFcd1d062E5C27eb87cfAC78C11232", idempotency_key: "Kq3vX9_aZ-0123456789ab" };

/* ------------------------------------------------------------------ */
/* Withdrawals                                                         */
/* ------------------------------------------------------------------ */

test("a withdrawal checks everything first, then redeems the code bound to <chain>-<amount>, then books once per key", async () => {
  const m = await load();
  const n = calls.length;
  const { res } = await post(m, "withdrawals", TOKENS.user, { ...WITHDRAW, stepup_token: "st-ok", user_id: 999 });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).withdrawal.status, "requested");
  const seq = calls.slice(n).filter((c) => c.svc !== "gateway" || c.path === "/v1/auth/stepup/consume").map((c) => c.path.split("?")[0]);
  assert.deepEqual(seq, ["/v1/withdrawals/quote", "/v1/auth/stepup/consume", "/v1/withdrawals"]);
  const consume = consumes().at(-1).body;
  assert.deepEqual({ ...consume }, { token: "st-ok", user_id: 42, action: "withdrawal", target: "bsc-20" });
  const booked = walletCalls("POST", "/v1/withdrawals").at(-1).body;
  assert.equal(booked.user_id, 42, "the user comes from the session, never the body");
  assert.equal(booked.idempotency_key, `crm:42:${WITHDRAW.idempotency_key}`);
  assert.equal(booked.to_address, WITHDRAW.to_address);
});

test("a withdrawal the wallet would refuse never spends the emailed code", async () => {
  const m = await load();
  const before = { consume: consumes().length, book: walletCalls("POST", "/v1/withdrawals").length };
  const { res } = await post(m, "withdrawals", TOKENS.user, { ...WITHDRAW, amount: "999", stepup_token: "st-ok" });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).error.code, "insufficient_funds");
  assert.equal(consumes().length, before.consume);
  assert.equal(walletCalls("POST", "/v1/withdrawals").length, before.book);
});

test("without a valid confirmation code nothing is booked", async () => {
  const m = await load();
  const before = walletCalls("POST", "/v1/withdrawals").length;
  const missing = await post(m, "withdrawals", TOKENS.user, WITHDRAW);
  assert.equal(missing.res.status, 403);
  assert.equal((await missing.res.json()).error.code, "stepup_required");
  const used = await post(m, "withdrawals", TOKENS.user, { ...WITHDRAW, stepup_token: "st-used" });
  assert.equal(used.res.status, 403);
  assert.equal((await used.res.json()).error.code, "stepup_invalid");
  assert.equal(walletCalls("POST", "/v1/withdrawals").length, before);
});

test("an unverified identity is refused before any check or code (the app shows the KYC state)", async () => {
  const m = await load();
  const before = { quote: walletCalls("POST", "/v1/withdrawals/quote").length, consume: consumes().length };
  const { res } = await post(m, "withdrawals", TOKENS.pending, { ...WITHDRAW, stepup_token: "st-ok" });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error.code, "kyc_required");
  assert.equal(walletCalls("POST", "/v1/withdrawals/quote").length, before.quote);
  assert.equal(consumes().length, before.consume);
});

test("withdrawal amounts have at most 2 decimals and need a destination; a missing request id is refused", async () => {
  const m = await load();
  for (const [body, field] of [
    [{ ...WITHDRAW, amount: "20.555" }, "amount"],
    [{ ...WITHDRAW, amount: "0" }, "amount"],
    [{ ...WITHDRAW, chain: "eth" }, "chain"],
    [{ ...WITHDRAW, to_address: "" }, "to_address"],
    [{ ...WITHDRAW, idempotency_key: "short" }, "idempotency_key"],
  ]) {
    const { res } = await post(m, "withdrawals", TOKENS.user, { ...body, stepup_token: "st-ok" });
    assert.equal(res.status, 422, JSON.stringify(body));
    assert.equal((await res.json()).error.field, field);
  }
});

test("cancelling a withdrawal names the session's user", async () => {
  const m = await load();
  const { res } = await post(m, "withdrawals/77/cancel", TOKENS.user, { user_id: 999 });
  assert.equal(res.status, 200);
  assert.equal(walletCalls("POST", "/v1/withdrawals/77/cancel").at(-1).body.user_id, 42);
  const bad = await post(m, "withdrawals/abc/cancel", TOKENS.user, {});
  assert.equal(bad.res.status, 404);
});

/* ------------------------------------------------------------------ */
/* Deposits                                                            */
/* ------------------------------------------------------------------ */

test("deposit requests: network and amount validated, the user from the session", async () => {
  const m = await load();
  const ok = await post(m, "deposits/intents", TOKENS.user, { chain: "bsc", amount: "100", user_id: 999 });
  assert.equal(ok.res.status, 200);
  assert.deepEqual({ ...walletCalls("POST", "/v1/deposits/intents").at(-1).body }, { user_id: 42, chain: "bsc", amount: "100" });
  const chain = await post(m, "deposits/intents", TOKENS.user, { chain: "eth", amount: "100" });
  assert.equal(chain.res.status, 422);
  assert.equal((await chain.res.json()).error.field, "chain");
  const amount = await post(m, "deposits/intents", TOKENS.user, { chain: "tron", amount: "1.1234567" });
  assert.equal(amount.res.status, 422);
  assert.equal((await amount.res.json()).error.field, "amount");
});

test("a transaction hash is accepted with or without 0x, for the session's own request id format only", async () => {
  const m = await load();
  const id = "dep_0123456789abcdef01234567";
  for (const hash of [`0x${"ab".repeat(32)}`, "CD".repeat(32)]) {
    const { res } = await post(m, "deposits/submit", TOKENS.user, { intent_id: id, tx_hash: hash });
    assert.equal(res.status, 200, hash);
    assert.equal(walletCalls("POST", "/v1/deposits/submit").at(-1).body.user_id, 42);
  }
  const bad = await post(m, "deposits/submit", TOKENS.user, { intent_id: id, tx_hash: "0x1234" });
  assert.equal(bad.res.status, 422);
  assert.equal((await bad.res.json()).error.field, "tx_hash");
  const otherId = await post(m, "deposits/submit", TOKENS.user, { intent_id: "dep_../../x", tx_hash: "ab".repeat(32) });
  assert.equal(otherId.res.status, 422);
  // status polling: the request is looked up for the session's user
  const poll = await get(m, `deposits/intents/${id}`, TOKENS.user);
  assert.equal(poll.res.status, 200);
  assert.ok(walletCalls("GET", `/v1/deposits/intents/${id}`).at(-1).path.endsWith("?user_id=42"));
  const junk = await get(m, "deposits/intents/not-an-id", TOKENS.user);
  assert.equal(junk.res.status, 404);
});

/* ------------------------------------------------------------------ */
/* Transfers and history                                               */
/* ------------------------------------------------------------------ */

test("wallet <-> account transfers: 8-digit login, 2 decimals, a per-user idempotency key", async () => {
  const m = await load();
  const { res } = await post(m, "transfers/to-trading", TOKENS.user, { login: 10000074, amount: "5.5", idempotency_key: "Zx81_-abcdefghij" });
  assert.equal(res.status, 200);
  const sent = walletCalls("POST", "/v1/wallets/42/to-trading").at(-1).body;
  assert.deepEqual({ ...sent }, { login: 10000074, amount: "5.5", idempotency_key: "crm:42:Zx81_-abcdefghij" });
  const back = await post(m, "transfers/from-trading", TOKENS.user, { login: 10000074, amount: "2", idempotency_key: "Zx81_-abcdefghik" });
  assert.equal(back.res.status, 200);
  assert.equal(walletCalls("POST", "/v1/wallets/42/from-trading").length, 1);
  for (const [body, field] of [
    [{ login: 10000074, amount: "5.555", idempotency_key: "Zx81_-abcdefghij" }, "amount"],
    [{ login: "10000074", amount: "5", idempotency_key: "Zx81_-abcdefghij" }, "login"],
    [{ login: 123, amount: "5", idempotency_key: "Zx81_-abcdefghij" }, "login"],
    [{ login: 10000074, amount: "5" }, "idempotency_key"],
  ]) {
    const r = await post(m, "transfers/to-trading", TOKENS.user, body);
    assert.equal(r.res.status, 422, JSON.stringify(body));
    assert.equal((await r.res.json()).error.field, field);
  }
});

test("history filters and paging are validated before the wallet", async () => {
  const m = await load();
  const ok = await get(m, "activity?type=deposit&page=2&limit=25", TOKENS.user);
  assert.equal(ok.res.status, 200);
  const path = walletCalls("GET", "/v1/wallets/42/activity").at(-1).path;
  assert.match(path, /[?&]page=2(&|$)/);
  assert.match(path, /[?&]limit=25(&|$)/);
  assert.match(path, /[?&]type=deposit(&|$)/);
  for (const q of ["page=0", "limit=500", "page=abc"]) {
    const r = await get(m, `activity?${q}`, TOKENS.user);
    assert.equal(r.res.status, 400, q);
  }
});

test("view-only logins can read the wallet but can't move money from the app", async () => {
  const m = await load();
  const before = calls.filter((c) => c.svc === "wallet" && c.method === "POST").length;
  for (const [path, body] of [
    ["deposits/intents", { chain: "bsc", amount: "100" }],
    ["transfers/to-trading", { login: 10000074, amount: "5", idempotency_key: "Zx81_-abcdefghij" }],
    ["withdrawals/77/cancel", {}],
  ]) {
    const { res } = await post(m, path, TOKENS.viewer, body);
    assert.equal(res.status, 403, path);
    assert.equal((await res.json()).error.code, "viewer_read_only");
  }
  assert.equal(calls.filter((c) => c.svc === "wallet" && c.method === "POST").length, before);
  const read = await get(m, "activity?type=all", TOKENS.viewer);
  assert.equal(read.res.status, 200);
});
