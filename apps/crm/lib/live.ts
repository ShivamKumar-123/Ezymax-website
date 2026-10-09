// What the Client Area shows in live builds (NEXT_PUBLIC_EZYMEX_MODE unset or "live").
// Only pages backed by real data are rendered; every other path shows a "Coming soon" state
// (see components/live-gate.tsx). Demo builds (NEXT_PUBLIC_EZYMEX_MODE=demo) render everything.

/** Path prefixes rendered in live builds ("/" matches only the dashboard itself). */
export const LIVE_PAGES = ["/", "/markets", "/profile", "/support", "/accounts", "/portfolio", "/social", "/partner", "/academy", "/prop", "/wallet", "/developer", "/rewards", "/news", "/calendar", "/options", "/updates"] as const;

/** Sub-pages of a live prefix that are still mock-only and stay gated in live builds. */
export const LIVE_GATED = ["/academy/coach"] as const;

/** Modules that are next on the roadmap: listed in live navigation with a "Soon" chip. */
export type SoonModule = { prefix: string; title: string; text: string };

export const SOON_MODULES: SoonModule[] = [
];

export function soonFor(pathname: string): SoonModule | undefined {
  return SOON_MODULES.find((m) => pathname === m.prefix || pathname.startsWith(m.prefix + "/"));
}

/** Ezymex Trader (the trading terminal) — charts and prices there are live. Absolute (same default as
 * next.config.ts), so <Link>s to it are never prefetched through the cross-origin /trade redirect. */
export const TERMINAL_URL = (process.env.NEXT_PUBLIC_TERMINAL_URL ?? "http://localhost:3002").replace(/\/+$/, "");

export const SUPPORT_EMAIL = "support@ezymex.com";
