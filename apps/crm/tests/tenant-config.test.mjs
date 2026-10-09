// Broker module switches (lib/modules.ts, applied by proxy.ts): `node --test apps/crm/tests`. The proxy runs
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
  "lean.broker.test": { options: false, news: false, support: false, ai_assistant: false },
  "calendar-off.broker.test": { calendar: false },
};
const FLAGS = { "lean.broker.test": { client_registration: false } };
let gateway;

before(async () => {
  gateway = createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    res.writeHead(url.pathname === "/v1/public/tenant-config" ? 200 : 404, { "content-type": "application/json" });
    if (url.pathname !== "/v1/public/tenant-config") return res.end(JSON.stringify({ error: { code: "not_found", message: "stub" } }));
    res.end(JSON.stringify({ maintenance: { active: false }, modules: MODULES[req.headers["x-ezymex-host"]] ?? {}, flags: FLAGS[req.headers["x-ezymex-host"]] ?? {} }));
  });
  await new Promise((resolve) => gateway.listen(0, "127.0.0.1", resolve));
  process.env.GATEWAY_URL = `http://127.0.0.1:${gateway.address().port}`;
});

after(() => gateway?.close());

// modules read their upstream URLs at import time: import them after the stub is listening
const load = async () => ({ ...(await import("next/server")), cfg: await import("../lib/modules.ts"), proxy: (await import("../proxy.ts")).proxy });

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

/** Where the proxy sends a page load on `host`: "unavailable" (the module is off), the redirect target, or "open". */
async function page(m, host, path) {
  const res = await m.proxy(new m.NextRequest(`https://${host}${path}`, { headers: { host } }));
  const rewrite = res.headers.get("x-middleware-rewrite");
  if (rewrite) return new URL(rewrite).pathname === "/unavailable" ? "unavailable" : rewrite;
  const to = res.headers.get("location");
  return to ? new URL(to).pathname : "open";
}

test("options, news, calendar, support and the AI assistant have their pages and BFF paths", async () => {
  const { cfg } = await load();
  assert.equal(cfg.moduleFor("/options"), "options");
  assert.equal(cfg.moduleFor("/api/suitability/options/accept"), "options");
  assert.equal(cfg.moduleFor("/api/mobile/trade/options/chain"), "options");
  assert.equal(cfg.moduleFor("/api/mobile/trade/options/explain"), "options&ai_assistant");
  assert.equal(cfg.moduleFor("/api/mobile/trade/ai-trader"), "ai_assistant");
  assert.equal(cfg.moduleFor("/api/news/feed"), "news");
  assert.equal(cfg.moduleFor("/api/news/calendar/next"), "calendar");
  assert.equal(cfg.moduleFor("/api/news/me/calendar/reminders"), "calendar");
  assert.equal(cfg.moduleFor("/academy/coach"), "academy&ai_assistant");
  assert.equal(cfg.moduleFor("/academy/glossary"), "academy");
  // the support stream ticket also feeds the notification bell; the bell's own routes are no module
  assert.equal(cfg.moduleFor("/api/support/messages"), "support");
  assert.equal(cfg.modulesOn({ support: false }, cfg.moduleFor("/api/support/stream-ticket")), true);
  assert.equal(cfg.moduleFor("/api/notifications"), null);
  // "a&b" needs both modules
  assert.equal(cfg.moduleOff({ ai_assistant: false }, "/academy/coach"), true);
  assert.equal(cfg.moduleOff({ academy: false }, "/academy/coach"), true);
  assert.equal(cfg.moduleOff({ news: false }, "/academy/coach"), false);
  assert.equal(cfg.moduleOff({ ai_assistant: false }, "/api/algo/ai/strategy"), true);
  assert.equal(cfg.moduleOff({ ai_assistant: false }, "/api/algo/strategies"), false);
  assert.equal(cfg.modulesOn(null, "options"), true);
  // staking (off by default at the gateway): its pages, BFF and the mobile rewrite policy path
  assert.equal(cfg.moduleFor("/staking/portfolio"), "staking");
  assert.equal(cfg.moduleFor("/api/staking/positions"), "staking");
  assert.equal(cfg.moduleOff({ staking: false }, "/staking"), true);
  assert.equal(cfg.moduleOff({ staking: true }, "/api/staking/plans"), false);
});

test("switched-off modules close their pages and BFF calls; notifications keep working", async () => {
  const m = await load();
  const host = "lean.broker.test";
  for (const path of ["/options", "/news", "/support", "/academy/coach"]) assert.equal(await page(m, host, path), "unavailable", path);
  assert.equal(await page(m, host, "/calendar"), "/login", "the calendar stays on");
  assert.equal(await page(m, "calendar-off.broker.test", "/calendar"), "unavailable");
  assert.equal(await page(m, "calendar-off.broker.test", "/news"), "/login");
  for (const path of ["/api/suitability/options", "/api/news/feed", "/api/support/me", "/api/support/messages", "/api/mobile/trade/ai-trader", "/api/mobile/trade/options/chain"]) {
    assert.equal(await gate(m, host, path), "off", path);
  }
  assert.equal(await gate(m, host, "/api/news/calendar"), "open");
  assert.equal(await gate(m, "calendar-off.broker.test", "/api/news/calendar"), "off");
  assert.equal(await gate(m, "calendar-off.broker.test", "/api/news/feed"), "open");
  assert.equal(await gate(m, host, "/api/support/stream-ticket"), "open");
  assert.equal(await gate(m, host, "/api/notifications"), "open");
  assert.equal(await gate(m, host, "/api/mobile/trade/state"), "open");
  assert.equal(await gate(m, "all-on.broker.test", "/api/support/messages"), "open");
});

test("brand promotions: Events & updates and the posts BFF follow the module; images and banners stay on", async () => {
  const { cfg } = await load();
  assert.equal(cfg.moduleFor("/updates"), "promotions");
  assert.equal(cfg.moduleFor("/updates/42"), "promotions");
  assert.equal(cfg.moduleFor("/api/growth/posts"), "promotions");
  assert.equal(cfg.moduleFor("/api/growth/posts/42"), "promotions");
  assert.equal(cfg.moduleOff({ promotions: false }, "/updates/42"), true);
  assert.equal(cfg.moduleOff({ promotions: false }, "/api/growth/posts"), true);
  // uploaded images also illustrate the card banners, which are no module
  assert.equal(cfg.moduleOff({ promotions: false }, "/api/growth/media/0123456789abcdef01234567"), false);
  assert.equal(cfg.moduleOff({ promotions: false }, "/api/growth/banners"), false);
  assert.equal(cfg.moduleOff({ rewards: false }, "/api/growth/posts"), false);
  assert.equal(cfg.moduleOff({ promotions: false }, "/"), false);
});

test("closed sign-ups send the sign-up pages to sign-in", async () => {
  const m = await load();
  assert.equal(await page(m, "lean.broker.test", "/register"), "/login");
  assert.equal(await page(m, "lean.broker.test", "/register/complete"), "/login");
  assert.equal(await page(m, "lean.broker.test", "/login"), "open");
  assert.equal(await page(m, "all-on.broker.test", "/register"), "open");
});
