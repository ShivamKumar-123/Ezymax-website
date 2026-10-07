import type { NavModule, SubNavItem } from "@/components/kit";

/** The module a path belongs to (its `match` prefixes, or its href). */
export function isActive(pathname: string, m: NavModule) {
  const prefixes = m.match ?? [m.href];
  return prefixes.some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/")));
}

/** Longest matching sub-page wins, so /wallet and /wallet/deposit never both light up. */
export function activeSub(pathname: string, all: SubNavItem[]): SubNavItem | undefined {
  const matches = all.filter((x) => (x.href === "/" ? pathname === "/" : pathname === x.href || pathname.startsWith(x.href + "/")));
  return matches.sort((a, b) => b.href.length - a.href.length)[0];
}
