import type { NavModule } from "@kalks/ui";
import { IS_DEMO, pathAllowed } from "@kalks/mock/mode";
import { ADMIN_NAV } from "@/lib/nav";

/**
 * Live builds (NEXT_PUBLIC_KALKS_MODE unset / "live") show only pages backed by real services.
 * Demo builds show the full mock showcase. See packages/mock/src/mode.ts.
 */

/** Pages (path prefixes) that run on real data in live builds. */
export const LIVE_PAGES = ["/", "/clients", "/security", "/org", "/trading", "/config", "/content/academy"] as const;

/** Sub-pages under a live prefix that are not live yet. */
export const LIVE_EXCLUDED = [
  "/clients/leads",
  "/clients/aml",
  "/clients/duplicates",
  "/clients/segments",
  "/security/users",
  "/security/ip",
  "/org/roles",
  "/org/desks",
  "/org/kpis",
  // trading: everything runs on the trading engine except these two
  "/trading/rollovers",
  "/trading/corporate-actions",
  // config: account groups (/config, /config/groups) and spreads are live
  "/config/symbols",
  "/config/charges",
  "/config/swaps",
  "/config/margin",
  "/config/sessions",
  "/config/demo",
] as const;

/** Next milestone: shown in the live nav with a "Soon" chip and a Coming soon page. */
export const SOON_PAGES: Record<string, { title: string; text: string }> = {
  "/finance/withdrawals": { title: "Withdrawals", text: "The withdrawal queue with review, approval and on-chain payout is enabled with the USDT wallet." },
  "/finance/wallets": { title: "Wallets", text: "USDT (TRC20) wallet balances and deposit addresses are enabled with the USDT wallet." },
  "/finance": { title: "Deposits", text: "USDT (TRC20) deposits, confirmations and crediting are enabled with the USDT wallet." },
};

export function isLivePath(pathname: string): boolean {
  return pathAllowed(pathname, LIVE_PAGES) && !pathAllowed(pathname, LIVE_EXCLUDED);
}

/** Coming-soon copy for a path (longest matching Soon prefix), if it's an upcoming module. */
export function soonFor(pathname: string): { title: string; text: string } | null {
  const key = Object.keys(SOON_PAGES)
    .filter((p) => pathname === p || (p !== "/finance" && pathname.startsWith(p + "/")))
    .sort((a, b) => b.length - a.length)[0];
  return key ? SOON_PAGES[key]! : null;
}


/** Navigation for live builds: every module, like the demo, without the demo's mock count badges. */
export const LIVE_NAV: NavModule[] = ADMIN_NAV.map((m) => ({
  ...m,
  badge: undefined, // demo badges are mock counts
  sub: m.sub?.map((s) => ({ ...s, badge: undefined })),
}));

export const NAV = IS_DEMO ? ADMIN_NAV : LIVE_NAV;

export const NAV_COMMANDS = NAV.flatMap((m) => (m.sub ?? [{ href: m.href, label: m.label }]).map((s) => ({ group: m.label, label: s.label, href: s.href, Icon: m.icon })));
