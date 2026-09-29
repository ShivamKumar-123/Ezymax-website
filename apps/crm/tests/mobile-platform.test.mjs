// Mobile app platform BFF: push tokens (/api/mobile/push/*) and "Continue with Google" (/api/mobile/auth/google*).
// `node --test apps/crm/tests`. The proxy and route handlers run as they are against stub gateway / support servers on
// loopback ports; Google is a local RSA key / JWKS with a stub token exchange (lib/google-mobile.ts dependencies).

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import "./helpers/ts-hooks.mjs";

const TOKENS = {
  user: "u".repeat(43),
  viewer: `v.${"w".repeat(43)}`,
  staffRead: `i.${"r".repeat(43)}`,
  staffFull: `s.${"f".repeat(43)}`,
  dead: "d".repeat(43),
};
const USER = { id: 42, email: "arjun@example.com", first_name: "Arjun", last_name: "Mehta", name: "Arjun Mehta", kyc_status: "verified", tenant: { slug: "kalks", name: "Kalks" } };
const VIEWER = { id: 7, label: "Accountant", username: "acc", accounts: ["50000001"], sections: ["accounts", "wallet"], expires_at: null, status: "active", last_login_at: null, created_at: "2026-09-01T00:00:00Z" };
const DEVICE = "D".repeat(32);
const PUSH = "ExponentPushToken[abcdefghijklmnopqrstuv]";

const calls = [];
let gatewaySvc, supportSvc;

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
  gatewaySvc = await stub("gateway", (req, body) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/v1/public/tenant-config") return [200, { maintenance: { active: false }, modules: {}, flags: {} }];
    if (url.pathname === "/v1/auth/impersonation/event") return [200, { status: "ok" }];
    if (url.pathname === "/v1/auth/me") {
      const t = bearer(req);
      if (t === TOKENS.user || t === TOKENS.staffFull || t === TOKENS.staffRead) return [200, { user: USER, viewer: null }];
      if (t === TOKENS.viewer) return [200, { user: USER, viewer: VIEWER }];
      return [401, { error: { code: "unauthorized", message: "Please sign in." } }];
    }
    if (url.pathname === "/v1/auth/google/complete") {
      if (body?.ticket !== "tkt-1") return [410, { error: { code: "google_expired", message: "Your Google sign-up has expired. Continue with Google again." } }];
      return [201, { status: "ok", user: USER, session: { token: TOKENS.user, expires_at: "2026-10-07T00:00:00Z" } }];
    }
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  supportSvc = await stub("support", (req, body) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/v1/push/tokens") return [200, { status: "ok", enabled: true }];
    if (url.pathname === "/v1/push/tokens/delete") return [200, { removed: 1 }];
    if (url.pathname === "/v1/push/tokens/forget") return [200, { removed: body?.deviceId === DEVICE ? 1 : 0 }];
    return [404, { error: { code: "not_found", message: "stub" } }];
  });
  process.env.GATEWAY_URL = `http://127.0.0.1:${gatewaySvc.address().port}`;
  process.env.SUPPORT_URL = `http://127.0.0.1:${supportSvc.address().port}`;
  process.env.SUPPORT_INTERNAL_TOKEN = "support-secret";
});

after(() => {
  gatewaySvc?.close();
  supportSvc?.close();
});

const load = async () => ({
  ...(await import("next/server")),
  mobile: await import("../lib/mobile.ts"),
  proxy: (await import("../proxy.ts")).proxy,
  push: await import("../app/api/mobile/push/[action]/route.ts"),
  google: await import("../app/api/mobile/auth/google/route.ts"),
  complete: await import("../app/api/mobile/auth/google/complete/route.ts"),
  lib: await import("../lib/google-mobile.ts"),
});

const BASE = "https://app.kalkstrade.com";
const headersOf = (res) => Object.fromEntries(res.headers.entries());

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
  return { res: await handler(inner, { params: Promise.resolve(params) }), forwarded: fwd };
}

const post = (token, body, extra = {}) => ({
  method: "POST",
  headers: { "content-type": "application/json", "x-kalks-device": DEVICE, "x-kalks-platform": "ios", "x-kalks-locale": "pt", "x-kalks-app-version": "1.0.0", ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra },
  body: JSON.stringify(body),
});
const supportCalls = (path) => calls.filter((c) => c.svc === "support" && c.path === path);

/* ------------------------------------------------------------------ */
/* Push tokens                                                         */
/* ------------------------------------------------------------------ */

test("push is a native mobile family", async () => {
  const { mobile } = await load();
  assert.deepEqual(mobile.mobileRoute("/api/mobile/push/register"), { kind: "native", target: "/api/mobile/push/register", policyPath: "/api/mobile/push/register" });
  assert.equal(mobile.mobileRoute("/api/mobile/auth/google").kind, "native");
  assert.equal(mobile.mobileRoute("/api/mobile/auth/google/complete").kind, "native");
});

test("a signed-in client registers this phone: identity from the session, device and platform from the app's headers", async () => {
  const m = await load();
  const { res } = await viaProxy(m, "/api/mobile/push/register", post(TOKENS.user, { token: PUSH, user_id: 999, deviceId: "spoofed-device-id-xxxx" }), m.push.POST, { action: "register" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok", enabled: true });
  const sent = supportCalls("/v1/push/tokens").at(-1);
  assert.equal(sent.headers["x-kalks-user-id"], "42");
  assert.equal(sent.headers["x-kalks-internal"], "support-secret");
  assert.deepEqual(sent.body, { token: PUSH, deviceId: DEVICE, platform: "ios", locale: "pt", appVersion: "1.0.0" });
});

test("view-only logins and staff sessions can't turn pushes on for the client's account", async () => {
  const m = await load();
  const n = supportCalls("/v1/push/tokens").length;
  const viewer = await viaProxy(m, "/api/mobile/push/register", post(TOKENS.viewer, { token: PUSH }), m.push.POST, { action: "register" });
  assert.equal(viewer.res.status, 403);
  assert.equal((await viewer.res.json()).error.code, "viewer_read_only");
  const ro = await viaProxy(m, "/api/mobile/push/register", post(TOKENS.staffRead, { token: PUSH }), m.push.POST, { action: "register" });
  assert.equal(ro.res.status, 403);
  assert.equal((await ro.res.json()).error.code, "staff_read_only");
  const full = await viaProxy(m, "/api/mobile/push/register", post(TOKENS.staffFull, { token: PUSH }), m.push.POST, { action: "register" });
  assert.equal(full.res.status, 403);
  assert.equal((await full.res.json()).error.code, "staff_session");
  assert.equal(supportCalls("/v1/push/tokens").length, n, "the support service never saw them");
});

test("registration needs a session, an Expo token, a device id and the iOS / Android app", async () => {
  const m = await load();
  const cases = [
    [post(null, { token: PUSH }), 401],
    [post(TOKENS.user, { token: "fcm-token-xyz" }), 422],
    [post(TOKENS.user, { token: PUSH }, { "x-kalks-platform": "web" }), 422],
    [post(TOKENS.user, { token: PUSH }, { "x-kalks-device": "bad" }), 400],
    [post(TOKENS.dead, { token: PUSH }), 401],
    [{ ...post(TOKENS.user, { token: PUSH }), headers: { authorization: `Bearer ${TOKENS.user}`, "content-type": "text/plain" } }, 415],
  ];
  for (const [init, status] of cases) {
    const { res } = await viaProxy(m, "/api/mobile/push/register", init, m.push.POST, { action: "register" });
    assert.equal(res.status, status, JSON.stringify(init.headers));
  }
  const { res } = await viaProxy(m, "/api/mobile/push/other", post(TOKENS.user, { token: PUSH }), m.push.POST, { action: "other" });
  assert.equal(res.status, 404);
});

test("sign-out removes the phone: the client's own row with a session, else proven by the installation id", async () => {
  const m = await load();
  const live = await viaProxy(m, "/api/mobile/push/unregister", post(TOKENS.user, { token: PUSH }), m.push.POST, { action: "unregister" });
  assert.equal(live.res.status, 200);
  const del = supportCalls("/v1/push/tokens/delete").at(-1);
  assert.equal(del.headers["x-kalks-user-id"], "42");
  assert.deepEqual(del.body, { token: PUSH });
  // the session already ended (expired / revoked elsewhere): token + device id, no user
  const dead = await viaProxy(m, "/api/mobile/push/unregister", post(TOKENS.dead, { token: PUSH }), m.push.POST, { action: "unregister" });
  assert.deepEqual(await dead.res.json(), { removed: 1 });
  const forget = supportCalls("/v1/push/tokens/forget").at(-1);
  assert.equal(forget.headers["x-kalks-user-id"], undefined);
  assert.deepEqual(forget.body, { token: PUSH, deviceId: DEVICE });
  const anon = await viaProxy(m, "/api/mobile/push/unregister", post(null, { token: PUSH }, { "x-kalks-device": "E".repeat(32) }), m.push.POST, { action: "unregister" });
  assert.deepEqual(await anon.res.json(), { removed: 0 }, "another phone's id removes nothing");
  const noDevice = await viaProxy(m, "/api/mobile/push/unregister", post(null, { token: PUSH }, { "x-kalks-device": "" }), m.push.POST, { action: "unregister" });
  assert.equal(noDevice.res.status, 400);
});

/* ------------------------------------------------------------------ */
/* Continue with Google                                                */
/* ------------------------------------------------------------------ */

const IOS_CLIENT = "ios-client.apps.googleusercontent.com";
const keys = await generateKeyPair("RS256");
const jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(keys.publicKey)), kid: "k1", alg: "RS256", use: "sig" }] });

async function idToken(claims = {}, opts = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: "priya@gmail.com", email_verified: true, given_name: "Priya", family_name: "Nair", nonce: "nonce-0123456789abcdef", azp: IOS_CLIENT, ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer("https://accounts.google.com")
    .setAudience(opts.aud ?? IOS_CLIENT)
    .setSubject("109876543210")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(keys.privateKey);
}

const VERIFIER = "v".repeat(64);
const input = { code: "4/0AX-code", code_verifier: VERIFIER, redirect_uri: "com.kalkstrade.app:/oauthredirect", nonce: "nonce-0123456789abcdef", ref: "PRIYA1234" };

test("the OAuth client comes from the server's configuration for the app's platform", async () => {
  const { lib } = await load();
  const env = { GOOGLE_IOS_CLIENT_ID: IOS_CLIENT, GOOGLE_CLIENT_ID: "web.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "web-secret" };
  assert.deepEqual(lib.mobileGoogleClient("ios", env), { platform: "ios", clientId: IOS_CLIENT });
  assert.equal(lib.mobileGoogleClient("android", env), null, "not configured yet");
  assert.deepEqual(lib.mobileGoogleClient("web", env), { platform: "web", clientId: "web.apps.googleusercontent.com", clientSecret: "web-secret" });
  assert.equal(lib.mobileGoogleClient("desktop", env), null);
  assert.equal(lib.mobileGoogleClient(null, env), null);
});

test("the app's code request is validated strictly", async () => {
  const { lib } = await load();
  assert.deepEqual(lib.parseCodeInput(input, "ios"), { code: "4/0AX-code", verifier: VERIFIER, redirectUri: "com.kalkstrade.app:/oauthredirect", nonce: "nonce-0123456789abcdef", ref: "PRIYA1234" });
  const bad = [
    [{ ...input, code: "" }, "code"],
    [{ ...input, code_verifier: "short" }, "code_verifier"],
    [{ ...input, nonce: "n" }, "nonce"],
    [{ ...input, redirect_uri: "https://evil.example/cb" }, "redirect_uri"],
    [{ ...input, redirect_uri: "javascript:/alert" }, "redirect_uri"],
  ];
  for (const [b, field] of bad) assert.equal(lib.parseCodeInput(b, "ios").field, field);
  assert.equal(lib.parseCodeInput({ ...input, redirect_uri: "http://localhost:8802/sign-in" }, "web").redirectUri, "http://localhost:8802/sign-in");
  assert.equal(lib.parseCodeInput({ ...input, redirect_uri: "http://evil.example/sign-in" }, "web").field, "redirect_uri");
  assert.equal(lib.parseCodeInput({ ...input, ref: "<bad>" }, "ios").ref, null);
});

test("the code is redeemed with PKCE and no secret for the phone's client (the web client keeps its secret)", async () => {
  const { lib } = await load();
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, form: new URLSearchParams(init.body) });
    return new Response(JSON.stringify({ id_token: "id.tok.en" }), { status: 200 });
  };
  const parsed = lib.parseCodeInput(input, "ios");
  assert.equal(await lib.exchangeMobileCode(parsed, { platform: "ios", clientId: IOS_CLIENT }, fetchImpl), "id.tok.en");
  assert.equal(seen[0].url, "https://oauth2.googleapis.com/token");
  assert.equal(seen[0].form.get("code_verifier"), VERIFIER);
  assert.equal(seen[0].form.get("client_id"), IOS_CLIENT);
  assert.equal(seen[0].form.get("redirect_uri"), "com.kalkstrade.app:/oauthredirect");
  assert.equal(seen[0].form.get("client_secret"), null);
  await lib.exchangeMobileCode(parsed, { platform: "web", clientId: "web", clientSecret: "web-secret" }, fetchImpl);
  assert.equal(seen[1].form.get("client_secret"), "web-secret");
  const used = async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
  await assert.rejects(lib.exchangeMobileCode(parsed, { platform: "ios", clientId: IOS_CLIENT }, used), (e) => e.code === "expired");
});

test("verified identities sign in or start the profile step; forged or foreign tokens never reach the gateway", async () => {
  const { lib } = await load();
  const client = { platform: "ios", clientId: IOS_CLIENT };
  const parsed = lib.parseCodeInput(input, "ios");
  const signIns = [];
  const deps = (token, reply) => ({
    exchange: async () => token,
    jwks,
    signIn: async (body) => {
      signIns.push(body);
      return reply;
    },
  });
  const ok = await lib.mobileGoogleSignIn(parsed, client, deps(await idToken(), { status: 200, data: { status: "ok", user: USER, session: { token: TOKENS.user, expires_at: "2026-10-07T00:00:00Z" }, extra: "dropped" } }));
  assert.deepEqual(ok, { status: 200, body: { status: "ok", user: USER, session: { token: TOKENS.user, expires_at: "2026-10-07T00:00:00Z" } } });
  assert.deepEqual(signIns.at(-1), { sub: "109876543210", email: "priya@gmail.com", email_verified: true, given_name: "Priya", family_name: "Nair", picture: undefined, ref: "PRIYA1234" });

  const fresh = await lib.mobileGoogleSignIn(parsed, client, deps(await idToken(), { status: 200, data: { status: "profile_required", ticket: "tkt-1", expires_in: 1800, profile: { email: "priya@gmail.com", first_name: "Priya" } } }));
  assert.equal(fresh.body.status, "profile_required");
  assert.equal(fresh.body.ticket, "tkt-1");

  const n = signIns.length;
  const wrongNonce = await lib.mobileGoogleSignIn(parsed, client, deps(await idToken({ nonce: "another-nonce-0123456789" }), { status: 200, data: {} }));
  assert.equal(wrongNonce.status, 401);
  assert.equal(wrongNonce.body.error.code, "google_failed");
  const otherApp = await lib.mobileGoogleSignIn(parsed, client, deps(await idToken({ azp: "other.apps.googleusercontent.com" }, { aud: "other.apps.googleusercontent.com" }), { status: 200, data: {} }));
  assert.equal(otherApp.body.error.code, "google_failed");
  const unverified = await lib.mobileGoogleSignIn(parsed, client, deps(await idToken({ email_verified: false }), { status: 200, data: {} }));
  assert.equal(unverified.status, 403);
  assert.equal(unverified.body.error.code, "google_unverified");
  assert.equal(signIns.length, n, "rejected tokens never reach the gateway");

  const conflict = await lib.mobileGoogleSignIn(parsed, client, deps(await idToken(), { status: 409, data: { error: { code: "google_conflict", message: "linked elsewhere" } } }));
  assert.deepEqual(conflict, { status: 409, body: { error: { code: "google_conflict", message: "linked elsewhere" } } });
});

test("the Google route answers 'unavailable' until the app's OAuth client is configured, and validates before calling Google", async () => {
  const m = await load();
  delete process.env.GOOGLE_IOS_CLIENT_ID;
  const off = await viaProxy(m, "/api/mobile/auth/google", post(null, input), m.google.POST, {});
  assert.equal(off.res.status, 503);
  assert.equal((await off.res.json()).error.code, "google_unavailable");
  process.env.GOOGLE_IOS_CLIENT_ID = IOS_CLIENT;
  const bad = await viaProxy(m, "/api/mobile/auth/google", post(null, { ...input, redirect_uri: "https://evil.example/cb" }), m.google.POST, {});
  assert.equal(bad.res.status, 400);
  assert.equal((await bad.res.json()).error.field, "redirect_uri");
  delete process.env.GOOGLE_IOS_CLIENT_ID;
});

test("the profile step forwards only the profile fields with the ticket and returns the session in the body", async () => {
  const m = await load();
  const { res } = await viaProxy(m, "/api/mobile/auth/google/complete", post(null, { ticket: "tkt-1", first_name: "Priya", last_name: "Nair", phone_dial: "+91", phone: "9876543210", country: "in", date_of_birth: "1994-05-02", accept_terms: true, marketing_consent: false, email: "evil@example.com", user_id: 1 }, { "x-kalks-device": "" }), m.complete.POST, {});
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.session.token, TOKENS.user);
  assert.match(data.device, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(res.headers.get("set-cookie"), null);
  const sent = calls.findLast((c) => c.path === "/v1/auth/google/complete");
  assert.deepEqual(Object.keys(sent.body).sort(), ["accept_terms", "country", "date_of_birth", "first_name", "last_name", "marketing_consent", "phone", "phone_dial", "ticket"]);
  assert.equal(sent.headers["x-kalks-device"], data.device);
  const expired = await viaProxy(m, "/api/mobile/auth/google/complete", post(null, { first_name: "Priya" }), m.complete.POST, {});
  assert.equal(expired.res.status, 410);
  assert.equal((await expired.res.json()).error.code, "google_expired");
});
