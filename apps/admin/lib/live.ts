import type { NavModule } from "@kalks/ui";
import { IS_DEMO, pathAllowed } from "@kalks/mock/mode";
import { ADMIN_NAV } from "@/lib/nav";

/**
 * Live builds (NEXT_PUBLIC_KALKS_MODE unset / "live") show only pages backed by real services.
 * Demo builds show the full mock showcase. See packages/mock/src/mode.ts.
 */

/** Pages (path prefixes) that run on real data in live builds. */
export const LIVE_PAGES = ["/", "/clients", "/security", "/org", "/config/spreads"] as const;

/** Sub-pages under a live prefix that are not live yet. */
export const LIVE_EXCLUDED = ["/clients/leads", "/clients/kyc", "/clients/aml", "/clients/duplicates", "/clients/segments", "/security/users", "/security/ip", "/org/roles", "/org/desks", "/org/kpis"] as const;

/** Next milestone: shown in the live nav with a "Soon" chip and a Coming soon page. */
export const SOON_PAGES: Record<string, { title: string; text: string }> = {
  "/finance/withdrawals": { title: "Withdrawals are coming soon", text: "USDT (TRC20) withdrawals with review, approval and on-chain payout are being connected to the live wallet." },
  "/finance/wallets": { title: "Wallets are coming soon", text: "Hot and cold USDT (TRC20) wallet balances and sweeps will appear here once the live wallet is connected." },
  "/finance": { title: "Deposits are coming soon", text: "USDT (TRC20) deposits, confirmations and crediting are being connected to the live wallet." },
  "/clients/kyc": { title: "KYC review is coming soon", text: "Document upload, verification and the review queue are being connected. Client KYC status is already shown on each client." },
  "/trading": { title: "Trading desk is coming soon", text: "Positions, orders and dealing controls go live with the trading engine. No real trades exist yet." },
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

const SOON = "Soon";
const mod = (key: string) => ADMIN_NAV.find((m) => m.key === key)!;

/** Navigation for live builds: live pages, plus upcoming modules marked "Soon". */
export const LIVE_NAV: NavModule[] = [
  { ...mod("command"), href: "/", match: ["/"], sub: [{ href: "/", label: "Overview" }] },
  { ...mod("clients"), badge: undefined, sub: [{ href: "/clients", label: "Clients" }, { href: "/clients/kyc", label: "KYC queue", badge: SOON }] },
  { ...mod("trading"), sub: [{ href: "/trading", label: "Trading desk", badge: SOON }] },
  { ...mod("config"), href: "/config/spreads", match: ["/config"], sub: [{ href: "/config/spreads", label: "Spreads" }] },
  {
    ...mod("finance"),
    badge: undefined,
    sub: [
      { href: "/finance", label: "Deposits", badge: SOON },
      { href: "/finance/withdrawals", label: "Withdrawals", badge: SOON },
      { href: "/finance/wallets", label: "Wallets", badge: SOON },
    ],
  },
  { ...mod("security"), sub: [{ href: "/security", label: "Audit log" }, { href: "/security/sessions", label: "Sessions" }] },
  { ...mod("org"), sub: [{ href: "/org", label: "Staff" }] },
];

export const NAV = IS_DEMO ? ADMIN_NAV : LIVE_NAV;

export const NAV_COMMANDS = NAV.flatMap((m) => (m.sub ?? [{ href: m.href, label: m.label }]).map((s) => ({ group: m.label, label: s.badge ? `${s.label} (soon)` : s.label, href: s.href, Icon: m.icon })));
