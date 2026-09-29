// Formatting and small rules for trading accounts (the same rules as the web Client Area, components/trading).
// Money and leverage always use Latin digits with fixed decimals, like MT5.
import { fmtMoney } from "@/lib/format";
import type { Account, AccountKind, Group } from "./types";

/** Currency code for money on an account: USC on cent accounts (amounts are USD × 100). */
export const curOf = (a: Pick<Account, "cent" | "currency">) => (a.cent || a.currency === "USC" ? "USC" : a.currency || "USD");

export const money = (v: number | null | undefined, a: Pick<Account, "cent" | "currency">, opts: { signed?: boolean; decimals?: number } = {}) => fmtMoney(v, { currency: curOf(a), ...opts });

/** USD value of an amount in the account currency. */
export const toUsd = (a: Pick<Account, "cent" | "currency">, v: number) => (curOf(a) === "USC" ? v / 100 : v);

/** "1:500", "1:1,000". */
export const lev = (l: number) => `1:${Math.round(l).toLocaleString("en-US")}`;

/** MT5-style server name shown with the login. */
export const serverOf = (type: AccountKind) => (type === "live" ? "Kalks-Live" : "Kalks-Demo");

/** Margin level health: fine above 500 %, watch above 200 %, at risk below (no margin used: none). */
export function levelTone(a: Pick<Account, "margin" | "marginLevel">): "ok" | "warn" | "risk" | null {
  const ml = a.marginLevel;
  if (!(a.margin > 0) || ml === null || ml === undefined || !Number.isFinite(ml)) return null;
  return ml > 500 ? "ok" : ml > 200 ? "warn" : "risk";
}

export function fmtLevel(a: Pick<Account, "margin" | "marginLevel">): string {
  const ml = a.marginLevel;
  if (!(a.margin > 0) || ml === null || ml === undefined || !Number.isFinite(ml) || ml <= 0) return "—";
  return `${Math.round(ml).toLocaleString("en-US")}%`;
}

export const refillsLeft = (a: Pick<Account, "demo">) => (a.demo ? Math.max(0, a.demo.refillsPerDay - a.demo.refillsUsedToday) : 0);

/** A refill tops the balance back to the starting amount, so there is nothing to refill at or above it. */
export const demoFull = (a: Pick<Account, "demo" | "balance">) => !!a.demo && a.balance >= a.demo.initialBalance;

/** Font size that keeps a JetBrains Mono string (0.6 em per character) on one line within `width` points. */
export const fitMono = (text: string, width: number, max: number, min = 18) => Math.max(min, Math.min(max, Math.floor(width / (Math.max(1, text.length) * 0.6))));

/** Kalks Trader refuses disabled and expired accounts. */
export const canTrade = (a: Pick<Account, "status">) => a.status !== "disabled" && a.status !== "expired";

export const notFunded = (a: Pick<Account, "type" | "balance" | "equity">) => a.type === "live" && a.balance === 0 && a.equity === 0;

/* ---- open-account rules (web: components/trading/open-account.tsx) ---- */

/** Groups a client may open for this kind: enabled, not prop-challenge only, offering the kind. */
export const offers = (g: Group, kind: AccountKind) => g.enabled && !g.code.toLowerCase().startsWith("prop") && (g.accountTypes === "both" || g.accountTypes === kind);

/** Accounts of this kind the client already holds in the group (the per-group limit is per kind). */
export const usedIn = (accounts: Account[], g: Group, kind: AccountKind) => accounts.filter((a) => a.group === g.code && a.type === kind).length;

export const maxLeverage = (g: Pick<Group, "leverages">) => (g.leverages.length ? Math.max(...g.leverages) : 0);

/** Demo starting balances offered (USD), plus the group's own default. */
export const DEMO_BALANCES = [1000, 5000, 10000, 25000, 50000, 100000];
export const demoBalancesFor = (g: Group) => [...new Set([...DEMO_BALANCES, g.demoInitialBalance])].filter((b) => b >= 100 && b <= 1_000_000).sort((x, y) => x - y);

/** A demo amount chosen in USD, shown in the group's currency (× 100 in USC on cent groups). */
export const groupMoney = (usd: number, g: Pick<Group, "cent">, decimals = 0) => fmtMoney(g.cent ? usd * 100 : usd, { currency: g.cent ? "USC" : "USD", decimals });

/** A letter in any script (built at runtime: an engine without Unicode property escapes falls back to cased letters). */
const LETTER: RegExp = (() => {
  try {
    return new RegExp("\\p{L}", "u");
  } catch {
    return /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ֐-׿؀-ۿऀ-෿฀-๿぀-ヿ㐀-鿿가-힯]/;
  }
})();

/** Trading password rule (the BFF and the engine): 8–64 characters with at least one letter and one digit. */
export const PASSWORD_RULES = [
  { key: "len", test: (p: string) => p.length >= 8 && p.length <= 64 },
  { key: "letter", test: (p: string) => LETTER.test(p) },
  { key: "digit", test: (p: string) => /\d/.test(p) },
] as const;
export const passwordOk = (p: string) => PASSWORD_RULES.every((r) => r.test(p));


/** Colour blocks for account types, stable per type (its place in the broker's list). */
const BLOCKS = ["mint", "periwinkle", "cream", "gold", "ember"] as const;
export type GroupColor = (typeof BLOCKS)[number];
export function groupColor(code: string, groups: Pick<Group, "code">[]): GroupColor {
  const i = groups.findIndex((g) => g.code === code);
  if (i >= 0) return BLOCKS[i % BLOCKS.length]!;
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return BLOCKS[h % BLOCKS.length]!;
}
