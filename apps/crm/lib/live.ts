// What the Client Area shows in live builds (NEXT_PUBLIC_KALKS_MODE unset or "live").
// Only pages backed by real data are rendered; every other path shows a "Coming soon" state
// (see components/live-gate.tsx). Demo builds (NEXT_PUBLIC_KALKS_MODE=demo) render everything.

/** Path prefixes rendered in live builds ("/" matches only the dashboard itself). */
export const LIVE_PAGES = ["/", "/markets", "/profile", "/support"] as const;

/** Sub-pages of a live prefix that are still mock-only and stay gated in live builds. */
export const LIVE_GATED = ["/profile/security", "/profile/verification", "/profile/viewers", "/profile/preferences"] as const;

/** Modules that are next on the roadmap: listed in live navigation with a "Soon" chip. */
export type SoonModule = { prefix: string; title: string; text: string };

export const SOON_MODULES: SoonModule[] = [
  {
    prefix: "/wallet",
    title: "Wallet",
    text: "USDT (TRC20) deposits and withdrawals open here once your wallet is enabled. We will email you when it is ready.",
  },
  {
    prefix: "/accounts",
    title: "Trading accounts",
    text: "Live and demo trading accounts open here once they are enabled for your profile. Meanwhile, follow live prices in Kalks Trader.",
  },
  {
    prefix: "/profile/verification",
    title: "Identity verification",
    text: "Document upload opens here once verification is enabled for your profile. We will email you when you can start.",
  },
];

export function soonFor(pathname: string): SoonModule | undefined {
  return SOON_MODULES.find((m) => pathname === m.prefix || pathname.startsWith(m.prefix + "/"));
}

/** Kalks Trader (the trading terminal) — charts and prices there are live. */
export const TERMINAL_URL = process.env.NEXT_PUBLIC_TERMINAL_URL ?? "/trade";

export const SUPPORT_EMAIL = "support@kalkstrade.com";
