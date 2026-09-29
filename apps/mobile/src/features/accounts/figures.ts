// Price-driven account figures (equity, margin, free margin, margin level, floating P&L…) kept outside React props.
// Every polled answer publishes them here and small leaf components subscribe per account, while the screens and
// rows get the account's structural part (login, type, leverage, status, balance, counts…), which keeps its identity
// until something structural changes. So a refresh that only moved prices re-renders a few numbers, never a row, a
// list or a screen (the same rule as the price stream).
import * as React from "react";
import { onSignOut } from "@/session";
import type { Account } from "./types";

export const PRICE_FIELDS = ["equity", "margin", "freeMargin", "marginLevel", "profit", "swap", "withdrawable", "marginCall"] as const;
export type PriceField = (typeof PRICE_FIELDS)[number];
export type Figures = Pick<Account, "equity" | "margin" | "freeMargin" | "marginLevel" | "profit" | "swap" | "marginCall"> & { withdrawable?: number };

const store = new Map<number, Figures>();
const subs = new Map<number, Set<() => void>>();

const pick = (a: Account): Figures => ({ equity: a.equity, margin: a.margin, freeMargin: a.freeMargin, marginLevel: a.marginLevel, profit: a.profit, swap: a.swap, withdrawable: a.withdrawable, marginCall: a.marginCall });
const same = (x: Figures, y: Figures) => PRICE_FIELDS.every((k) => Object.is(x[k], y[k]));

/** Called with every confirmed server answer (list or one account). */
export function publishFigures(accounts: Account[]) {
  for (const a of accounts) {
    const next = pick(a);
    const prev = store.get(a.login);
    if (prev && same(prev, next)) continue;
    store.set(a.login, next);
    subs.get(a.login)?.forEach((fn) => fn());
  }
}

onSignOut(() => {
  store.clear();
});

/** The latest polled figures of one account (falls back to the account the caller holds). */
export function useFigures(a: Account): Figures {
  const login = a.login;
  const subscribe = React.useCallback(
    (fn: () => void) => {
      let set = subs.get(login);
      if (!set) subs.set(login, (set = new Set()));
      set.add(fn);
      return () => {
        set!.delete(fn);
      };
    },
    [login],
  );
  const read = () => store.get(login);
  return React.useSyncExternalStore(subscribe, read, read) ?? pick(a);
}

/** Figures of several accounts (a list's totals). Re-renders when any of them changes. */
export function useFiguresOf(accounts: Account[]): Figures[] {
  const key = accounts.map((a) => a.login).join(",");
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    const offs = accounts.map((a) => {
      let set = subs.get(a.login);
      if (!set) subs.set(a.login, (set = new Set()));
      set.add(bump);
      return () => set!.delete(bump);
    });
    return () => offs.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return accounts.map((a) => store.get(a.login) ?? pick(a));
}

/* ---- the structural part ---- */

const structuralKey = (a: Account) => {
  const rest: Record<string, unknown> = { ...a };
  for (const k of PRICE_FIELDS) delete rest[k];
  return JSON.stringify(rest);
};

/** The account object, kept identical while only its price-driven figures change. */
export function useStructural(a: Account | undefined): Account | undefined {
  const ref = React.useRef<{ key: string; a: Account } | null>(null);
  if (!a) return undefined;
  const key = structuralKey(a);
  if (!ref.current || ref.current.key !== key) ref.current = { key, a };
  return ref.current.a;
}

/** A list of accounts with each entry kept identical while only its figures change (memoised rows stay put). */
export function useStructuralList(list: Account[]): Account[] {
  const cache = React.useRef(new Map<number, { key: string; a: Account }>());
  const prevOut = React.useRef<Account[]>([]);
  return React.useMemo(() => {
    const next = list.map((a) => {
      const key = structuralKey(a);
      const hit = cache.current.get(a.login);
      if (hit && hit.key === key) return hit.a;
      cache.current.set(a.login, { key, a });
      return a;
    });
    const prev = prevOut.current;
    const unchanged = prev.length === next.length && prev.every((x, i) => x === next[i]);
    if (unchanged) return prev;
    prevOut.current = next;
    return next;
  }, [list]);
}
