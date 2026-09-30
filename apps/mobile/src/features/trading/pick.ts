// Which trading account the app opens on (pure: no React Native, unit-tested in scripts/core-lib.test.mts).
import type { EngAccount } from "./types";

/**
 * Accounts a programme opens and runs, never the app's default: prop challenges (groups `prop*`, the rule of the
 * prop service and the wallet), copy-trading followers (`copy`, `copy-netting`), PAMM funds (`pamm`) and MAM
 * programmes (`mam`), the engine's system groups (services/trading/src/social/mam.rs SYSTEM_GROUPS).
 */
export function isProgrammeAccount(a: Pick<EngAccount, "group">): boolean {
  const g = String(a.group ?? "").toLowerCase();
  return g.startsWith("prop") || /^(copy|pamm|mam)([-_.].*)?$/.test(g);
}

/**
 * The account the app opens on when none is chosen: a standard live account, else a standard demo account (active
 * ones first). Prop, copy, PAMM and MAM accounts are never picked (they are opened on purpose, e.g. the prop
 * module's "Open in Trade"); null when the client has no standard account.
 */
export function pickDefault(list: Pick<EngAccount, "login" | "type" | "group" | "status">[]): number | null {
  const standard = list.filter((a) => !isProgrammeAccount(a));
  const usable = standard.filter((a) => a.status === "active" || !a.status);
  const first = (from: typeof list, type: EngAccount["type"]) => from.find((a) => a.type === type);
  return (first(usable, "live") ?? first(usable, "demo") ?? first(standard, "live") ?? first(standard, "demo"))?.login ?? null;
}

/** Nothing to trade on by default: no account at all, or only programme accounts and none chosen. */
export function noTradingAccount(list: Pick<EngAccount, "group">[] | undefined, active: number | null): boolean {
  return !!list && (list.length === 0 || (active === null && list.every(isProgrammeAccount)));
}
