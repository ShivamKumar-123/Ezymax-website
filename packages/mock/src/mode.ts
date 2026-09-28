declare const process: { env: Record<string, string | undefined> };

/**
 * Which build this is. `live` (default): production — only real data from the services, modules that
 * aren't backed by a service show "Coming soon". `demo`: the full showcase on mock data
 * (demo.kalkstrade.com, for broker and investor demos). Set at build time with NEXT_PUBLIC_KALKS_MODE.
 */
export const KALKS_MODE: "live" | "demo" = process.env.NEXT_PUBLIC_KALKS_MODE === "demo" ? "demo" : "live";
export const IS_DEMO = KALKS_MODE === "demo";
export const IS_LIVE = !IS_DEMO;

/** True when `pathname` is one of `prefixes` or below it ("/" only matches exactly). */
export function pathAllowed(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/")));
}
