// Which product module (D112; the gateway's catalogue, services/gateway/src/tenancy.rs BUILTIN_FEATURES) every Client
// Area page and BFF path belongs to. The single map behind the proxy (a switched-off module's pages show /unavailable,
// its BFF calls and the mobile app's answer 403 module_disabled), the navigation, ⌘K and in-page links
// (components/tenant-config.tsx). Pure, no imports: it runs in the proxy, on the server and in the browser.
// The mobile app keeps a copy of the page entries (apps/mobile/lib/shell/nav.dart `_pageModules`): keep them in step.
//
// The longest matching prefix wins. Its module expression is
//   "a"    the module a
//   "a|b"  a path shared by two modules: open while either is on
//   "a&b"  a feature of one module that relies on another: open only while both are on
//   ""     never switched off (an exception under a switched prefix)
// A module the broker never set (or an older gateway doesn't know) counts as on.

export type ModuleSwitches = Record<string, boolean>;

export const MODULE_PATHS: readonly (readonly [string, string])[] = [
  ["/social/pamm", "pamm"],
  ["/social/investments", "pamm"],
  ["/api/social/funds", "pamm"],
  // PAMM investments and their invest / redeem requests (cancel) belong to PAMM, not copy trading
  ["/api/social/investments", "pamm"],
  ["/api/social/requests", "pamm"],
  ["/social", "copy_trading"],
  ["/api/social", "copy_trading"],
  ["/prop", "prop"],
  ["/api/prop", "prop"],
  ["/partner", "ib"],
  ["/api/partner", "ib"],
  ["/developer/strategies", "algo"],
  ["/developer/deployments", "algo"],
  ["/developer/backtests", "algo"],
  ["/developer/marketplace", "algo"],
  ["/api/algo/strategies", "algo"],
  ["/api/algo/deployments", "algo"],
  ["/api/algo/backtests", "algo"],
  ["/api/algo/market", "algo"],
  // the strategy builder's AI chat is an AI assistant feature too
  ["/api/algo/ai", "algo&ai_assistant"],
  ["/api/algo/validate", "algo"],
  // the kill switch stops running strategies: it follows Algo, where its page lives
  ["/api/algo/controls", "algo"],
  // the strategy catalogue and the account picker serve the strategy builder and AI Trader (Algo) as well as API keys
  // and webhooks (API)
  ["/api/algo/meta", "algo|api"],
  ["/api/algo/accounts", "algo|api"],
  ["/developer", "api"],
  ["/api/algo", "api"],
  ["/academy", "academy"],
  ["/academy/coach", "academy&ai_assistant"],
  ["/api/academy", "academy"],
  ["/wallet", "wallet"],
  ["/api/wallet", "wallet"],
  ["/rewards", "rewards"],
  // growth BFF: rewards features follow the module; banners and share cards stay on
  ...["rewards", "points", "redeem", "redemptions", "vouchers", "cashback", "promotions", "bonuses", "promo", "contests"].map((p) => [`/api/growth/${p}`, "rewards"] as const),
  // FX Options: the product page and its onboarding (suitability serves options only); the mobile app's options
  // trading and chain (the options service's own live / demo switches still apply on top)
  ["/options", "options"],
  ["/api/suitability/options", "options"],
  ["/api/mobile/trade/options", "options"],
  ["/api/mobile/trade/options/explain", "options&ai_assistant"],
  ["/api/mobile/trade/ai-trader", "ai_assistant"],
  // news BFF: headlines, the map and the daily brief are News; events, reminders and alerts are the calendar
  ["/news", "news"],
  ["/api/news", "news"],
  ["/calendar", "calendar"],
  ["/api/news/calendar", "calendar"],
  ["/api/news/me/calendar", "calendar"],
  // support chat (Ask AI on the dashboard talks to the same chat). The realtime stream also carries the notification
  // bell, so its ticket is never switched off; notifications (/api/notifications) aren't a module at all.
  ["/support", "support"],
  ["/api/support", "support"],
  ["/api/support/stream-ticket", ""],
];

/** The module expression of a page or BFF path (longest prefix), or null when it belongs to no module. */
export function moduleFor(pathname: string): string | null {
  let best: readonly [string, string] | null = null;
  for (const e of MODULE_PATHS) {
    if ((pathname === e[0] || pathname.startsWith(e[0] + "/")) && (!best || e[0].length > best[0].length)) best = e;
  }
  return best ? best[1] : null;
}

/** True unless the broker switched off what `expr` needs ("a", "a|b", "a&b"; empty / null = always on). */
export function modulesOn(modules: ModuleSwitches | null | undefined, expr: string | null | undefined): boolean {
  if (!expr || !modules) return true;
  const on = (m: string) => modules[m] !== false;
  return expr.includes("&") ? expr.split("&").every(on) : expr.split("|").some(on);
}

/** True when a page or BFF path belongs to a module (or modules) the broker switched off. */
export function moduleOff(modules: ModuleSwitches | null | undefined, pathname: string): boolean {
  return !modulesOn(modules, moduleFor(pathname));
}
