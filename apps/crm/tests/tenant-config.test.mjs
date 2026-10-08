// Broker module switches (lib/tenant-config.ts, applied by proxy.ts): `node --test apps/crm/tests`. The proxy runs
// as it is against a stub gateway on a loopback port that answers /v1/public/tenant-config per host.
//
// What it guards: a page or BFF path follows its module; the strategy catalogue (/api/algo/meta) and the account
// picker (/api/algo/accounts) serve both the strategy builder and AI Trader (Algo) and API keys and webhooks (API), so
// they stay open while EITHER module is on and close only when both are off.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import "./helpers/ts-hooks.mjs";

const MODULES = {
  "algo-off.broker.test": { algo: false },
  "api-off.broker.test": { api: false },
  "both-off.broker.test": { algo: false, api: false },
  "all-on.broker.test": {},
};
let gateway;

before(async () => {
  gateway = createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    res.writeHead(url.pathname === "/v1/public/tenant-config" ? 200 : 404, { "content-type": "application/json" });
    if (url.pathname !== "/v1/public/tenant-config") return res.end(JSON.stringify({ error: { code: "not_found", message: "stub" } }));
    res.end(JSON.stringify({ maintenance: { active: false }, modules: MODULES[req.headers["x-ezymex-host"]] ?? {}, flags: {} }));
  });
  await new Promise((resolve) => gateway.listen(0, "127.0.0.1", resolve));
  process.env.GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;
});

after(() => gateway?.close());

// modules read their upstream URLs at import time: import them after the stub is listening
const load = async () => ({ ...(await import("next/server")), cfg: await import("../lib/tenant-config.ts"), proxy: (await import("../proxy.ts")).proxy });

/** The proxy's answer for a GET of `path` on `host`: "open", or the module_disabled refusal. */
async function gate(m, host, path) {
  const res = await m.proxy(new m.NextRequest(`https://${host}${path}`, { headers: { host } }));
  if (res.status === 403) {
    const body = await res.json();
    assert.equal(body.error.code, "module_disabled", `${host}${path}`);
    return "off";
  }
  return "open";
}

test("shared algo paths belong to both modules; the others to one", async () => {
  const { cfg } = await load();
  assert.equal(cfg.moduleFor("/api/algo/meta"), "algo|api");
  assert.equal(cfg.moduleFor("/api/algo/accounts"), "algo|api");
  assert.equal(cfg.moduleFor("/api/algo/keys/9/revoke"), "api");
  assert.equal(cfg.moduleFor("/api/algo/strategies/4"), "algo");
  assert.equal(cfg.moduleFor("/api/algo/controls/kill"), "algo");
  assert.equal(cfg.moduleFor("/api/algo/metadata"), "api", "a prefix match is by path segment");
  assert.equal(cfg.moduleFor("/wallet"), "wallet");
  assert.equal(cfg.moduleFor("/api/trading/accounts"), null);
  // closed only when every module of the path is off
  assert.equal(cfg.moduleOff({ algo: false }, "/api/algo/meta"), false);
  assert.equal(cfg.moduleOff({ api: false }, "/api/algo/accounts"), false);
  assert.equal(cfg.moduleOff({ algo: false, api: false }, "/api/algo/meta"), true);
  assert.equal(cfg.moduleOff({ api: false }, "/api/algo/keys"), true);
  assert.equal(cfg.moduleOff({ algo: false }, "/api/algo/keys"), false);
  assert.equal(cfg.moduleOff({}, "/api/algo/strategies"), false);
  assert.equal(cfg.moduleOff({ algo: true }, "/api/algo/strategies"), false);
  assert.equal(cfg.moduleOff({ wallet: false }, "/api/trading/accounts"), false);
});

test("the strategy catalogue and account picker stay open while Algo or API is on", async () => {
  const m = await load();
  for (const path of ["/api/algo/meta", "/api/algo/accounts"]) {
    assert.equal(await gate(m, "all-on.broker.test", path), "open", path);
    // API off, Algo on: the strategy builder and AI Trader still load their catalogue and accounts
    assert.equal(await gate(m, "api-off.broker.test", path), "open", path);
    // Algo off, API on: API keys and webhooks still pick an account
    assert.equal(await gate(m, "algo-off.broker.test", path), "open", path);
    assert.equal(await gate(m, "both-off.broker.test", path), "off", path);
  }
  // single-module paths are unchanged
  assert.equal(await gate(m, "api-off.broker.test", "/api/algo/keys"), "off");
  assert.equal(await gate(m, "api-off.broker.test", "/api/algo/webhooks"), "off");
  assert.equal(await gate(m, "api-off.broker.test", "/api/algo/strategies"), "open");
  assert.equal(await gate(m, "algo-off.broker.test", "/api/algo/strategies"), "off");
  assert.equal(await gate(m, "algo-off.broker.test", "/api/algo/ai/strategy"), "off");
  assert.equal(await gate(m, "algo-off.broker.test", "/api/algo/keys"), "open");
});
