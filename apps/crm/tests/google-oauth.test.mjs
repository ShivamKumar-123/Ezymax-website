// Google sign-in BFF logic: `node --test apps/crm/tests` (Node 22.6+ strips the TypeScript types).
// Google is replaced by a local RSA key / JWKS and stub token exchange + gateway, injected as
// dependencies of handleCallback. Nothing here changes how production verifies tokens.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import {
  CALLBACK_PATH,
  errorRedirect,
  handleCallback,
  openState,
  publicOrigin,
  sealState,
  startFlow,
  verifyIdToken,
} from "../lib/google-oauth.ts";

const cfg = { clientId: "test-client.apps.googleusercontent.com", clientSecret: "test-secret" };

const { privateKey, publicKey } = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
const jwks = createLocalJWKSet({ keys: [jwk] });
const other = await generateKeyPair("RS256");

async function idToken(claims = {}, opts = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: "arjun@gmail.com", email_verified: true, given_name: "Arjun", family_name: "Mehta", nonce: "n-1", azp: cfg.clientId, ...claims })
    .setProtectedHeader({ alg: "RS256", kid: opts.kid ?? "k1" })
    .setIssuer(opts.iss ?? "https://accounts.google.com")
    .setAudience(opts.aud ?? cfg.clientId)
    .setSubject("109876543210")
    .setIssuedAt(opts.iat ?? now)
    .setExpirationTime(opts.exp ?? now + 3600)
    .sign(opts.key ?? privateKey);
}

test("start builds the Google URL with state, nonce and PKCE S256", () => {
  const f = startFlow({ mode: "register", next: "/wallet", ref: "PRIYA1234", origin: "https://app.kalkstrade.com" }, cfg);
  const u = new URL(f.url);
  assert.equal(u.origin + u.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  const p = u.searchParams;
  assert.equal(p.get("client_id"), cfg.clientId);
  assert.equal(p.get("redirect_uri"), "https://app.kalkstrade.com" + CALLBACK_PATH);
  assert.equal(p.get("response_type"), "code");
  assert.equal(p.get("scope"), "openid email profile");
  assert.equal(p.get("prompt"), "select_account");
  assert.equal(p.get("code_challenge_method"), "S256");
  assert.equal(p.get("state"), f.state.state);
  assert.equal(p.get("nonce"), f.state.nonce);
  assert.equal(p.get("code_challenge"), createHash("sha256").update(f.state.verifier).digest("base64url"));
  assert.ok(!f.url.includes(cfg.clientSecret));
  assert.ok(!f.url.includes(f.state.verifier));
  const s = openState(f.cookie, cfg);
  assert.equal(s.mode, "register");
  assert.equal(s.next, "/wallet");
  assert.equal(s.ref, "PRIYA1234");
});

test("start drops unsafe next and malformed ref", () => {
  for (const next of ["https://evil.com", "//evil.com", "/api/auth/logout", "/\\evil"]) {
    assert.equal(startFlow({ mode: "login", next, ref: "", origin: "http://localhost:3000" }, cfg).state.next, "/");
  }
  assert.equal(startFlow({ mode: "login", next: "/", ref: "a b<script>", origin: "http://localhost:3000" }, cfg).state.ref, "");
});

test("state cookie rejects tampering, other secrets and age", () => {
  const f = startFlow({ mode: "login", next: "/", ref: "", origin: "http://localhost:3000" }, cfg);
  const [payload, mac] = f.cookie.split(".");
  const forged = Buffer.from(JSON.stringify({ ...f.state, next: "/evil" })).toString("base64url");
  assert.equal(openState(`${forged}.${mac}`, cfg), null);
  assert.equal(openState(f.cookie, { ...cfg, clientSecret: "other" }), null);
  assert.equal(openState(f.cookie, cfg, f.state.iat + 601), null);
  assert.equal(openState(`${payload}.${mac}.x`, cfg), null);
  assert.equal(openState(undefined, cfg), null);
  assert.ok(openState(sealState(f.state, cfg), cfg));
});

test("public origin follows Caddy's forwarded headers, else the request", () => {
  const h = new Headers({ "x-forwarded-host": "app.kalkstrade.com", "x-forwarded-proto": "https", host: "127.0.0.1:3000" });
  assert.equal(publicOrigin(h, "http://127.0.0.1:3000/api/auth/google/start"), "https://app.kalkstrade.com");
  assert.equal(publicOrigin(new Headers({ host: "localhost:3000" }), "http://localhost:3000/api/auth/google/start"), "http://localhost:3000");
  assert.equal(publicOrigin(new Headers({ "x-forwarded-host": "evil.com/x?" }), "http://localhost:3000/a"), "http://localhost:3000");
});

test("ID token verification: signature, iss, aud, exp, nonce, email_verified", async () => {
  const ok = await verifyIdToken(await idToken(), { clientId: cfg.clientId, nonce: "n-1", jwks });
  assert.deepEqual(ok, { sub: "109876543210", email: "arjun@gmail.com", email_verified: true, given_name: "Arjun", family_name: "Mehta", picture: undefined });
  // legacy issuer form is also Google's
  await verifyIdToken(await idToken({}, { iss: "accounts.google.com" }), { clientId: cfg.clientId, nonce: "n-1", jwks });

  const bad = async (tok, code, nonce = "n-1") =>
    assert.rejects(() => verifyIdToken(tok, { clientId: cfg.clientId, nonce, jwks }), (e) => e.code === code);
  await bad(await idToken({}, { aud: "someone-else" }), "failed");
  await bad(await idToken({}, { iss: "https://evil.example" }), "failed");
  await bad(await idToken({}, { exp: Math.floor(Date.now() / 1000) - 3600, iat: Math.floor(Date.now() / 1000) - 7200 }), "failed");
  await bad(await idToken({}, { key: other.privateKey }), "failed");
  await bad(await idToken({ azp: "other-client" }), "failed");
  await bad(await idToken(), "failed", "different-nonce");
  await bad(await idToken({ nonce: undefined }), "failed");
  await bad(await idToken({ email_verified: false }), "unverified");
  const unsigned = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: "1", email: "a@b.co" })).toString("base64url")}.`;
  await bad(unsigned, "failed");
});

function deps(reply, calls = []) {
  return {
    exchange: async (code, verifier, redirectUri) => {
      calls.push({ code, verifier, redirectUri });
      return idToken({ nonce: calls.nonce });
    },
    jwks,
    signIn: async (body) => {
      calls.push(body);
      return reply;
    },
  };
}

async function flow(mode = "login", next = "/", ref = "") {
  const f = startFlow({ mode, next, ref, origin: "https://app.kalkstrade.com" }, cfg);
  return { f, query: new URLSearchParams({ code: "4/abc", state: f.state.state }) };
}

test("callback: signed in -> session and ?next", async () => {
  const { f, query } = await flow("login", "/wallet");
  const calls = [];
  calls.nonce = f.state.nonce;
  const out = await handleCallback(query, f.cookie, cfg, deps({ status: 200, data: { status: "ok", session: { token: "t", expires_at: "2030-01-01T00:00:00Z" } } }, calls));
  assert.equal(out.redirect, "/wallet");
  assert.equal(out.session.token, "t");
  assert.deepEqual(calls[0], { code: "4/abc", verifier: f.state.verifier, redirectUri: "https://app.kalkstrade.com/api/auth/google/callback" });
  assert.equal(calls[1].sub, "109876543210");
  assert.equal(calls[1].email_verified, true);
});

test("callback: new person -> profile step with ticket, ref forwarded", async () => {
  const { f, query } = await flow("register", "/", "PRIYA1234");
  const calls = [];
  calls.nonce = f.state.nonce;
  const out = await handleCallback(query, f.cookie, cfg, deps({ status: 200, data: { status: "profile_required", ticket: "tkt", expires_in: 1800 } }, calls));
  assert.equal(out.redirect, "/register/complete");
  assert.deepEqual(out.ticket, { value: "tkt", maxAge: 1800 });
  assert.equal(calls[1].ref, "PRIYA1234");
});

test("callback: friendly errors", async () => {
  const { f, query } = await flow("register", "/", "PRIYA1234");
  const d = deps({ status: 200, data: {} });

  // consent cancelled on Google's screen
  let out = await handleCallback(new URLSearchParams({ error: "access_denied", state: f.state.state }), f.cookie, cfg, d);
  assert.equal(out.redirect, "/register?google_error=cancelled&ref=PRIYA1234");
  // state cookie missing (expired) or state mismatch (possible CSRF)
  assert.equal((await handleCallback(query, undefined, cfg, d)).error, "expired");
  assert.equal((await handleCallback(new URLSearchParams({ code: "x", state: "other" }), f.cookie, cfg, d)).error, "expired");
  // nonce mismatch (token not from this flow)
  const calls = [];
  calls.nonce = "someone-elses-nonce";
  assert.equal((await handleCallback(query, f.cookie, cfg, deps({ status: 200, data: {} }, calls))).error, "failed");
  // unverified Google email
  const c2 = [];
  c2.nonce = f.state.nonce;
  const unverified = { ...deps({ status: 200, data: {} }, c2), exchange: async () => idToken({ nonce: f.state.nonce, email_verified: false }) };
  assert.equal((await handleCallback(query, f.cookie, cfg, unverified)).error, "unverified");
  // gateway outcomes
  const c3 = [];
  c3.nonce = f.state.nonce;
  const conflict = deps({ status: 409, data: { error: { code: "google_conflict" } } }, c3);
  assert.equal((await handleCallback(query, f.cookie, cfg, conflict)).error, "conflict");
  const c4 = [];
  c4.nonce = f.state.nonce;
  assert.equal((await handleCallback(query, f.cookie, cfg, deps({ status: 503, data: { error: { code: "unavailable" } } }, c4))).error, "unavailable");
  // token exchange failure (code reused)
  const reused = { ...d, exchange: async () => { const { GoogleAuthError } = await import("../lib/google-oauth.ts"); throw new GoogleAuthError("expired", "invalid_grant"); } };
  assert.equal((await handleCallback(query, f.cookie, cfg, reused)).error, "expired");
});

test("error redirects stay on this app", () => {
  assert.equal(errorRedirect("expired", "login", "/wallet").redirect, "/login?google_error=expired&next=%2Fwallet");
  assert.equal(errorRedirect("failed", "login").redirect, "/login?google_error=failed");
});
