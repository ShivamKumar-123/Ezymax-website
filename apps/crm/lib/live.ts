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
    title: "Wallet is coming soon",
    text: "Deposits and withdrawals in USDT on the TRC20 network are being connected. Your wallet will appear here as soon as it is live.",
  },
  {
    prefix: "/accounts",
    title: "Trading accounts are coming soon",
    text: "You will be able to open live and demo trading accounts here once funding is live. Until then, follow live prices in Kalks Trader.",
  },
  {
    prefix: "/profile/verification",
    title: "Identity verification is coming soon",
    text: "Online identity verification (KYC) opens with the next release. We will email you as soon as you can upload your documents.",
  },
];

export function soonFor(pathname: string): SoonModule | undefined {
  return SOON_MODULES.find((m) => pathname === m.prefix || pathname.startsWith(m.prefix + "/"));
}

/** Kalks Trader (the trading terminal) — charts and prices there are live. */
export const TERMINAL_URL = process.env.NEXT_PUBLIC_TERMINAL_URL ?? "/trade";

export const SUPPORT_EMAIL = "support@kalkstrade.com";
