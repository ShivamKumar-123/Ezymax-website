// Product modules (D112) and feature flags (D146) a broker switches in the Back Office: the gateway serves them with
// the brand (/v1/public/tenant-config `modules`, `flags`; lib/tenant-brand.ts reads them, lib/features.tsx hands them
// to client components). Pure, no imports: route handlers, the server layout and the browser all use it.
//
// Module expressions as in the Client Area (apps/crm/lib/modules.ts):
//   "a"    the module a
//   "a|b"  open while either is on
//   "a&b"  a feature of one module that relies on another: open only while both are on
// A module or flag the broker never set (or an older gateway doesn't know) counts as on; so does everything while the
// config is unknown (null: gateway unreachable, demo builds).

export type ModuleSwitches = Record<string, boolean>;

/** The broker's switches; null = unknown (everything on). */
export type Features = { modules: ModuleSwitches; flags: Record<string, boolean> };

/** True unless the broker switched off what `expr` needs (empty / null = always on). */
export function modulesOn(modules: ModuleSwitches | null | undefined, expr: string | null | undefined): boolean {
  if (!expr || !modules) return true;
  const on = (m: string) => modules[m] !== false;
  return expr.includes("&") ? expr.split("&").every(on) : expr.split("|").some(on);
}

// The Client Area pages the terminal links to, by module: a copy of the page entries of MODULE_PATHS in
// apps/crm/lib/modules.ts (the terminal can't import the Client Area), so a link never lands on its "unavailable" page.
// Keep them in step.
const CLIENT_AREA_PAGES: readonly (readonly [string, string])[] = [
  ["/social/pamm", "pamm"],
  ["/social/investments", "pamm"],
  ["/social", "copy_trading"],
  ["/prop", "prop"],
  ["/partner", "ib"],
  ["/developer/strategies", "algo"],
  ["/developer/deployments", "algo"],
  ["/developer/backtests", "algo"],
  ["/developer/marketplace", "algo"],
  ["/developer", "api"],
  ["/academy", "academy"],
  ["/academy/coach", "academy&ai_assistant"],
  ["/wallet", "wallet"],
  ["/rewards", "rewards"],
  ["/options", "options"],
  ["/news", "news"],
  ["/calendar", "calendar"],
  ["/support", "support"],
];

/** The module expression of a Client Area page (longest prefix), or null when it belongs to no module. */
export function pageModule(pathname: string): string | null {
  let best: readonly [string, string] | null = null;
  for (const e of CLIENT_AREA_PAGES) {
    if ((pathname === e[0] || pathname.startsWith(e[0] + "/")) && (!best || e[0].length > best[0].length)) best = e;
  }
  return best ? best[1] : null;
}
