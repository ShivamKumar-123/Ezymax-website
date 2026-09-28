// What the Client Area shows in live builds (NEXT_PUBLIC_KALKS_MODE unset or "live").
// Only pages backed by real data are rendered; every other path shows a "Coming soon" state
// (see components/live-gate.tsx). Demo builds (NEXT_PUBLIC_KALKS_MODE=demo) render everything.

/** Path prefixes rendered in live builds ("/" matches only the dashboard itself). */
export const LIVE_PAGES = ["/", "/markets", "/profile", "/support", "/accounts", "/portfolio", "/academy"] as const;

/** Sub-pages of a live prefix that are still mock-only and stay gated in live builds. */
export const LIVE_GATED = ["/profile/security", "/profile/viewers", "/profile/preferences", "/portfolio/analytics", "/academy/coach"] as const;

/** Modules that are next on the roadmap: listed in live navigation with a "Soon" chip. */
export type SoonModule = { prefix: string; title: string; text: string };

export const SOON_MODULES: SoonModule[] = [
  {
    prefix: "/wallet",
    title: "Wallet",
    text: "USDT (TRC20) deposits and withdrawals open here once your wallet is enabled. We will email you when it is ready.",
  },
  {
    prefix: "/portfolio/analytics",
    title: "Portfolio analytics",
    text: "Performance analytics across your accounts are being connected. Your trades, ledger and statements are already under Portfolio.",
  },
];

export function soonFor(pathname: string): SoonModule | undefined {
  return SOON_MODULES.find((m) => pathname === m.prefix || pathname.startsWith(m.prefix + "/"));
}

/** Kalks Trader (the trading terminal) — charts and prices there are live. Absolute (same default as
 * next.config.ts), so <Link>s to it are never prefetched through the cross-origin /trade redirect. */
export const TERMINAL_URL = (process.env.NEXT_PUBLIC_TERMINAL_URL ?? "http://localhost:3002").replace(/\/+$/, "");

export const SUPPORT_EMAIL = "support@kalkstrade.com";
