// The client's trading accounts (Client Area BFF, live metrics) and the active-account controller: picks a
// default when none is chosen, follows the active account's engine stream and quotes its spread group.
//
// The list is the shared "trading/accounts" cache. Its equity figures change on every refresh (Home, Trade and
// Portfolio refresh it; the Accounts screen polls it every 5 s), so anything that needs only a piece of it reads that
// piece with `useAccountsSelect` (a selector: re-renders only when its slice changes) instead of the whole list.
import * as React from "react";
import { apiGet } from "@/lib/api";
import { getQueryData, refreshQuery, useQuery, useQuerySelect } from "@/lib/query";
import { feed } from "@/market/feed";
import { useSession } from "@/session";
import { setActiveLogin, useActiveLogin } from "@/session/activeAccount";
import { followAccount } from "./live";
import { pickDefault } from "./pick";
import type { EngAccount } from "./types";

export { isProgrammeAccount, noTradingAccount, pickDefault } from "./pick";

export const ACCOUNTS_KEY = "trading/accounts";
export const GROUPS_KEY = "trading/groups";
type AccountsData = { accounts: EngAccount[] };
type GroupsData = { groups: { code: string; spreadGroup?: string }[] };
export const fetchAccounts = () => apiGet<AccountsData>("trading/accounts");
const fetchGroups = () => apiGet<GroupsData>("trading/groups");
const ACCOUNTS_OPTS = { persist: true, staleMs: 15_000 } as const;
/** View-only sections that include the trading accounts (apps/crm/lib/viewer.ts). */
const ACCOUNT_SECTIONS = ["dashboard", "accounts", "history"];
const GROUPS_OPTS = { persist: true, staleMs: 5 * 60_000 } as const;

export function useAccounts() {
  return useQuery(ACCOUNTS_KEY, fetchAccounts, ACCOUNTS_OPTS);
}

export function useGroups() {
  return useQuery(GROUPS_KEY, fetchGroups, GROUPS_OPTS);
}

/** Refetch the account list now (pull to refresh), without subscribing the caller to it. */
export const refreshAccounts = () => refreshQuery(ACCOUNTS_KEY, fetchAccounts, true);

/**
 * A slice of the account list (undefined while it has never loaded): the component re-renders only when the slice
 * changes, not on every refresh of the list's equity figures. Return primitives or plain data from `select`.
 */
export function useAccountsSelect<S>(select: (accounts: EngAccount[] | undefined) => S): S {
  return useQuerySelect<AccountsData, S>(ACCOUNTS_KEY, fetchAccounts, (d) => select(d?.accounts), ACCOUNTS_OPTS);
}

export function accountOf(login: number | null): EngAccount | undefined {
  if (login === null) return undefined;
  return getQueryData<AccountsData>(ACCOUNTS_KEY)?.accounts.find((a) => a.login === login);
}

export function useActiveAccount(): EngAccount | undefined {
  const login = useActiveLogin();
  const q = useAccounts();
  return React.useMemo(() => q.data?.accounts.find((a) => a.login === login), [q.data, login]);
}

/** The active account's type and number, re-rendering only when those change (chips and labels). */
export function useActiveAccountLabel(): Pick<EngAccount, "type" | "login" | "currency"> | null {
  const login = useActiveLogin();
  return useAccountsSelect((list) => {
    const a = list?.find((x) => x.login === login);
    return a ? { type: a.type, login: a.login, currency: a.currency } : null;
  });
}

/**
 * The active trading account's controller, mounted once in the signed-in layout (app/(app)/_layout.tsx). It renders
 * nothing and reads the list through selectors, so an accounts refresh re-renders neither the layout nor itself
 * unless the default pick or the quote group changes.
 * - Default / stale choice: a standard live account, else demo (`pickDefault`); a view-only login, which never trades,
 *   falls back to its first shared account when none of them is standard.
 * - One engine stream for the active account (view-only logins can't open trading sessions).
 * - Quotes carry the active account's spread group (view-only logins can't read the group list: their account's
 *   own group is used).
 */
export function TradingController() {
  const signedIn = useSession((s) => s.status === "signedIn");
  const viewer = useSession((s) => !!s.viewer);
  // a view-only login reads trading accounts only with one of these sections (the proxy answers 403 otherwise)
  const readsAccounts = useSession((s) => !s.viewer || s.viewer.sections.some((x) => ACCOUNT_SECTIONS.includes(x)));
  const active = useActiveLogin();

  // the login the app should be on: the active one while it's still the client's, else the default
  // (undefined until the list has loaded once)
  const next = useQuerySelect<AccountsData, number | null | undefined>(
    readsAccounts ? ACCOUNTS_KEY : null,
    fetchAccounts,
    (d) => {
      const list = d?.accounts;
      if (!list) return undefined;
      if (active !== null && list.some((a) => a.login === active)) return active;
      return pickDefault(list) ?? (viewer ? (list[0]?.login ?? null) : null);
    },
    ACCOUNTS_OPTS,
  );
  React.useEffect(() => {
    if (next !== undefined && next !== active) setActiveLogin(next);
  }, [next, active]);

  // one engine stream for the active account
  React.useEffect(() => {
    followAccount(signedIn && !viewer ? active : null);
  }, [signedIn, viewer, active]);
  React.useEffect(() => () => followAccount(null), []);

  // quotes carry the active account's spread group: its own when the list has it, else its group's (the group list
  // is only read when needed, and never by a view-only login)
  const acc = useQuerySelect<AccountsData, { group: string; spread: string | null } | null>(
    readsAccounts ? ACCOUNTS_KEY : null,
    fetchAccounts,
    (d) => {
      const a = d?.accounts.find((x) => x.login === active);
      return a ? { group: a.group, spread: a.spreadGroup ?? null } : null;
    },
    ACCOUNTS_OPTS,
  );
  const lookup = !viewer && !!acc && !acc.spread;
  const groupSpread = useQuerySelect<GroupsData, string | null>(lookup ? GROUPS_KEY : null, fetchGroups, (d) => (acc ? (d?.groups.find((g) => g.code === acc.group)?.spreadGroup ?? null) : null), GROUPS_OPTS);
  const quoteGroup = acc ? (acc.spread ?? groupSpread ?? acc.group) : null;
  React.useEffect(() => {
    if (quoteGroup) feed.setGroup(quoteGroup);
  }, [quoteGroup]);

  return null;
}
