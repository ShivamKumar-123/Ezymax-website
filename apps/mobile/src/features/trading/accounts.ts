// The client's trading accounts (Client Area BFF, live metrics) and the active-account controller: picks a
// default when none is chosen, follows the active account's engine stream and quotes its spread group.
import * as React from "react";
import { apiGet } from "@/lib/api";
import { getQueryData, useQuery } from "@/lib/query";
import { feed } from "@/market/feed";
import { useSession } from "@/session";
import { setActiveLogin, useActiveLogin } from "@/session/activeAccount";
import { followAccount } from "./live";
import type { EngAccount } from "./types";

export const ACCOUNTS_KEY = "trading/accounts";
export const GROUPS_KEY = "trading/groups";
export const fetchAccounts = () => apiGet<{ accounts: EngAccount[] }>("trading/accounts");
const fetchGroups = () => apiGet<{ groups: { code: string; spreadGroup?: string }[] }>("trading/groups");

export function useAccounts() {
  return useQuery(ACCOUNTS_KEY, fetchAccounts, { persist: true, staleMs: 15_000 });
}

export function useGroups() {
  return useQuery(GROUPS_KEY, fetchGroups, { persist: true, staleMs: 5 * 60_000 });
}

/** Live first (active), then demo; prop accounts are opened by the prop module and are never the default. */
export function pickDefault(list: EngAccount[]): number | null {
  const usable = list.filter((a) => a.status === "active" || !a.status);
  return (usable.find((a) => a.type === "live") ?? usable.find((a) => a.type === "demo") ?? list[0])?.login ?? null;
}

export function accountOf(login: number | null): EngAccount | undefined {
  if (login === null) return undefined;
  return getQueryData<{ accounts: EngAccount[] }>(ACCOUNTS_KEY)?.accounts.find((a) => a.login === login);
}

export function useActiveAccount(): EngAccount | undefined {
  const login = useActiveLogin();
  const q = useAccounts();
  return React.useMemo(() => q.data?.accounts.find((a) => a.login === login), [q.data, login]);
}

/** Mounted once in the signed-in layout. */
export function useTradingController() {
  const signedIn = useSession((s) => s.status === "signedIn");
  const viewer = useSession((s) => !!s.viewer);
  const accounts = useAccounts();
  const groups = useGroups();
  const active = useActiveLogin();

  // default / stale choice -> first live, else first demo
  React.useEffect(() => {
    const list = accounts.data?.accounts;
    if (!list) return;
    if (active === null || !list.some((a) => a.login === active)) {
      const next = pickDefault(list);
      if (next !== active) setActiveLogin(next);
    }
  }, [accounts.data, active]);

  // one engine stream for the active account (view-only logins can't open trading sessions)
  React.useEffect(() => {
    followAccount(signedIn && !viewer ? active : null);
  }, [signedIn, viewer, active]);

  // quotes carry the active account's spread group
  React.useEffect(() => {
    const acc = accounts.data?.accounts.find((a) => a.login === active);
    if (!acc) return;
    const g = groups.data?.groups.find((x) => x.code === acc.group);
    feed.setGroup(acc.spreadGroup ?? g?.spreadGroup ?? acc.group);
  }, [accounts.data, groups.data, active]);

  React.useEffect(() => () => followAccount(null), []);
}
