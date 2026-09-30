// Notification / deep link resolution (src/features/platform/links.ts and notifications/days.ts):
//   node --import ./apps/mobile/scripts/test-hooks.mjs --test apps/mobile/scripts/platform-links.test.mts
import { test } from "node:test";
import assert from "node:assert/strict";
import { appPath, resolveLink } from "../src/features/platform/links.ts";
import { dayKey, groupByDay } from "../src/features/platform/notifications/days.ts";
import { lockDue, TIMEOUTS } from "../src/features/platform/lock/policy.ts";

test("every link the services send opens its app screen", () => {
  const cases: [string, string][] = [
    ["/wallet/history", "/wallet/history"], // wallet notifier
    ["/wallet", "/wallet"],
    ["/accounts", "/accounts"], // wallet adjustments
    ["/accounts/50012345", "/accounts/50012345"], // margin call adapter
    ["/portfolio", "/portfolio"], // stop-out / SL / TP adapter
    ["/profile/verification", "/profile/verification"], // KYC decisions
    ["/support", "/support"],
    ["/support?c=17", "/support?c=17"], // support replies
    ["/prop/mine", "/prop/mine"], // prop notifier
    ["/prop/mine?id=12", "/prop/mine?id=12"],
    ["/prop/payouts", "/prop/payouts"],
    ["/partner/payouts", "/partner/payouts"], // IB notifier
    ["/calendar", "/calendar"], // news reminders sent before the event travelled in the link
    ["/calendar?event=4812", "/calendar?event=4812"], // news reminders: the event's sheet opens
    ["/alerts", "/alerts"], // price alerts (market-data)
    ["/rewards", "/rewards"], // contest prizes (growth)
    ["/rewards/cashback", "/rewards/cashback"], // cashback paid (growth)
    ["/rewards/promotions", "/rewards/promotions"], // bonus granted / removed (growth)
    ["/wallet/deposit", "/wallet/deposit"], // growth journeys
  ];
  for (const [link, want] of cases) assert.deepEqual(resolveLink(link), { kind: "route", href: want, tab: want === "/portfolio" }, link);
});

test("web-only paths map to the app's screen; tabs are switched to, not pushed", () => {
  assert.equal(appPath("/portfolio/history"), "/portfolio");
  assert.equal(appPath("/portfolio/statements"), "/reports/statements");
  assert.equal(appPath("/social/copy"), "/social/subscriptions");
  assert.equal(appPath("/social/masters/abc-12"), "/social/masters/abc-12");
  assert.equal(appPath("/social/investments"), "/social/pamm?tab=mine");
  assert.equal(appPath("/social/managed"), "/social/mam");
  assert.equal(appPath("/academy/phase/foundations"), "/academy/foundations");
  assert.equal(appPath("/academy/phase/foundations/exam"), "/academy/foundations/exam");
  assert.equal(appPath("/academy/progress"), "/academy/progress");
  assert.equal(appPath("/academy/coach"), "/academy");
  assert.equal(appPath("/academy/chapter/what-is-a-pip"), "/academy/chapter/what-is-a-pip");
  assert.equal(appPath("/developer/marketplace"), "/algo/marketplace");
  assert.equal(appPath("/developer/webhooks"), "/algo/keys");
  assert.equal(appPath("/developer/deployments"), "/algo");
  assert.equal(appPath("/rewards/contests/9"), "/rewards/contests/9");
  assert.equal(appPath("/rewards/loyalty"), "/rewards/loyalty");
  assert.equal(appPath("/partner/clients"), "/partner/clients");
  assert.equal(appPath("/partner/network"), "/partner");
  assert.equal(appPath("/prop/certificates"), "/prop/certificates");
  assert.equal(appPath("/profile/viewers"), "/profile/viewers");
  assert.equal(appPath("/settings/notifications"), "/profile/notifications");
  assert.equal(appPath("/kyc"), "/profile/verification");
  assert.equal(appPath("/dashboard"), "/");
  assert.equal(appPath("/wallet/history/"), "/wallet/history");
  assert.deepEqual(resolveLink("/"), { kind: "route", href: "/", tab: true });
  assert.deepEqual(resolveLink("/markets"), { kind: "route", href: "/markets", tab: true });
  assert.deepEqual(resolveLink("/wallet"), { kind: "route", href: "/wallet", tab: false });
});

test("the app's own paths (kalks://…) open the same screens", () => {
  for (const p of [
    "/partner/programme",
    "/partner/clients/41",
    "/rewards/share",
    "/academy/foundations",
    "/academy/foundations/exam",
    "/algo/deployments/12",
    "/algo/keys",
    "/algo/strategies/7",
    "/algo/marketplace/3",
    "/profile/password",
    "/profile/sessions",
    "/profile/sign-ins",
    "/support/history",
    "/support/88",
    "/social/subscriptions/5",
    "/social/pamm/9",
    "/social/mam/links/4",
    "/prop/12",
    "/news/n-381",
    "/depth/XAUUSD",
    "/settings/app-lock",
  ])
    assert.equal(appPath(p), p, p);
  // action screens (forms, confirmations) are never link targets
  for (const p of ["/algo/strategies/7/deploy", "/algo/marketplace/3/subscribe", "/social/pamm/9/invest", "/social/follow/3", "/profile/viewers/edit", "/prop/abc", "/academy/phase", "/academy/chapter"])
    assert.notEqual(appPath(p), p, p);
});

test("only the query parameters a screen reads survive", () => {
  assert.equal(appPath("/support?c=17&utm_source=x"), "/support?c=17");
  assert.equal(appPath("/wallet/history?type=deposit#top"), "/wallet/history?type=deposit");
  assert.equal(appPath("/wallet?type=deposit"), "/wallet");
  assert.equal(appPath("/support?c=<script>"), "/support");
  assert.equal(appPath("/alerts?symbol=EURUSD"), "/alerts?symbol=EURUSD");
  assert.equal(appPath("/wallet/deposit?intent=dep_8f2a"), "/wallet/deposit?intent=dep_8f2a");
  assert.equal(appPath("/wallet/transfer?to=50012345&x=1"), "/wallet/transfer?to=50012345");
  assert.equal(appPath("/portfolio/analytics?login=all&period=30D"), "/reports/analytics?login=all&period=30D");
  assert.equal(appPath("/calendar?currency=USD&event=nfp-2026-10"), "/calendar?currency=USD&event=nfp-2026-10");
  assert.equal(appPath("/news?symbol=XAUUSD"), "/news?symbol=XAUUSD");
  assert.equal(appPath("/social/investments?tab=funds"), "/social/pamm?tab=mine", "the rule's own tab wins");
  assert.equal(appPath("/prop/mine?id=12"), "/prop/mine?id=12");
});

test("kalks:// and the Client Area's own https links open in the app; other sites open in the browser", () => {
  const hosts = ["app.kalkstrade.com"];
  assert.deepEqual(resolveLink("kalks://wallet/deposit", hosts), { kind: "route", href: "/wallet/deposit", tab: false });
  assert.deepEqual(resolveLink("kalks:///prop/mine?id=3", hosts), { kind: "route", href: "/prop/mine?id=3", tab: false });
  assert.deepEqual(resolveLink("https://app.kalkstrade.com/wallet/history", hosts), { kind: "route", href: "/wallet/history", tab: false });
  assert.deepEqual(resolveLink("https://APP.kalkstrade.com/portfolio/history", hosts), { kind: "route", href: "/portfolio", tab: true });
  assert.deepEqual(resolveLink("https://app.kalkstrade.com/developer/docs/intro/x", hosts), { kind: "web", url: "https://app.kalkstrade.com/developer/docs/intro/x" });
  assert.deepEqual(resolveLink("https://kalkstrade.com/promo", hosts), { kind: "web", url: "https://kalkstrade.com/promo" });
});

test("unknown, relative and unsafe links resolve to nothing", () => {
  const bad = [null, undefined, "", "   ", "javascript:alert(1)", "http://evil.example/x", "//evil.example/x", "wallet", "/../etc/passwd", "/prop/../../x", "/admin/users", "/wallet/deposit/extra", "data:text/html,x", "https://a:b@evil.example/x", `/${"x".repeat(1200)}`];
  for (const link of bad) assert.equal(resolveLink(link), null, String(link));
});

test("notifications are grouped by the reader's local day, newest first", () => {
  const now = new Date(2026, 8, 30, 15, 0, 0).getTime(); // 30 Sep 2026 15:00 local
  const at = (d: number, h: number) => new Date(2026, 8, d, h, 0, 0).toISOString();
  const items = [
    { id: 5, createdAt: at(30, 14) },
    { id: 4, createdAt: at(30, 0) },
    { id: 3, createdAt: at(29, 23) },
    { id: 2, createdAt: at(27, 9) },
    { id: 1, createdAt: at(27, 8) },
  ];
  const rows = groupByDay(items, now, (key, ago) => (ago === 0 ? "Today" : ago === 1 ? "Yesterday" : key));
  assert.deepEqual(
    rows.map((r) => (r.type === "day" ? `# ${r.label}` : r.item.id)),
    ["# Today", 5, 4, "# Yesterday", 3, `# ${dayKey(new Date(2026, 8, 27).getTime())}`, 2, 1],
  );
  assert.equal(groupByDay([], now, () => "").length, 0);
});

test("the app lock is due after the chosen time in the background", () => {
  assert.deepEqual(TIMEOUTS, [0, 60, 300, 900, 3600]);
  const t0 = 1_000_000;
  assert.equal(lockDue({ enabled: true, timeoutSec: 60 }, t0, t0 + 59_000), false);
  assert.equal(lockDue({ enabled: true, timeoutSec: 60 }, t0, t0 + 60_000), true);
  assert.equal(lockDue({ enabled: true, timeoutSec: 0 }, t0, t0 + 1), true, "immediately");
  assert.equal(lockDue({ enabled: false, timeoutSec: 0 }, t0, t0 + 999_999), false);
  assert.equal(lockDue({ enabled: true, timeoutSec: 60 }, null, t0), false, "never went to the background");
  assert.equal(lockDue({ enabled: true, timeoutSec: 300 }, t0, t0 - 5_000), true, "a clock set backwards locks rather than trusting it");
});
