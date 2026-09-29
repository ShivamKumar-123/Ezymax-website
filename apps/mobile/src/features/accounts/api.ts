// Accounts data: the Client Area trading BFF through the app's bearer session (/api/mobile/trading/* is a rewrite
// of the web's /api/trading/*, so the identical server rules run: ownership, view-only and read-only staff
// sessions, prop groups refused, the broker's demo switch, account limits, leverage only when flat, emailed
// step-up codes for passwords and leverage, the demo refill cap). Contract: services/trading/README.md.
//
//   GET  trading/accounts                    the client's accounts with live metrics (polled while on screen)
//   GET  trading/groups                      open-account groups (prop groups are removed by the BFF)
//   GET  trading/accounts/{login}            {account, positions[], orders[]}
//   POST trading/accounts                    open: {type, group, leverage, name?, password?, initialBalance? (demo)}
//   POST trading/accounts/{login}/demo-refill
//   POST trading/accounts/{login}/leverage   {leverage, stepup_token}   (only without open positions)
//   POST trading/accounts/{login}/passwords  {kind, password, stepup_token}
//   GET  accounts/options                    native mobile route: {demoAccounts} (the broker's demo switch)
//
// Cache keys are the API paths, shared with Home / Trade / Portfolio ("trading/accounts" = the account list), so a
// change confirmed here shows everywhere. Polled answers keep the identity of unchanged objects (structural
// sharing), so a refresh that changed nothing re-renders no row. Writes are never optimistic.
import * as React from "react";
import { useIsFocused } from "expo-router";
import { i18n } from "@/i18n";
import { apiGet, apiPost, type ApiError, type ApiResult } from "@/lib/api";
import { getQueryData, invalidate, prefetch, setQueryData, useQuery } from "@/lib/query";
import { useSession } from "@/session";
import { publishFigures } from "./figures";
import { share } from "./share";
import type { Account, AccountDetail, Group, OpenRequest, OpenResult, PasswordKind } from "./types";

export const KEYS = {
  list: "trading/accounts",
  detail: (login: number | string) => `trading/accounts/${login}`,
  groups: "trading/groups",
  options: "accounts/options",
} as const;

export const LOGIN_RE = /^\d{8}$/;

async function shared<T>(key: string, r: Promise<ApiResult<T>>): Promise<ApiResult<T>> {
  const res = await r;
  return res.ok ? { ...res, data: share(getQueryData(key), res.data) } : res;
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

type ListData = { accounts: Account[] };
type GroupsData = { groups: Group[] };
export type AccountOptions = { demoAccounts: boolean };

// price-driven figures go to their leaf subscribers before the cache notifies the screens (figures.ts)
export const fetchAccounts = () =>
  shared<ListData>(
    KEYS.list,
    apiGet<ListData>("trading/accounts").then((r) => {
      if (!r.ok) return r;
      const accounts = r.data.accounts ?? [];
      publishFigures(accounts);
      return { ...r, data: { accounts } };
    }),
  );
export const fetchAccount = (login: number | string) =>
  shared<AccountDetail>(
    KEYS.detail(login),
    apiGet<AccountDetail>(`trading/accounts/${login}`).then((r) => {
      if (r.ok && r.data.account) publishFigures([r.data.account]);
      return r;
    }),
  );
export const fetchGroups = () => shared<GroupsData>(KEYS.groups, apiGet<GroupsData>("trading/groups").then((r) => (r.ok ? { ...r, data: { groups: r.data.groups ?? [] } } : r)));
const fetchOptions = () => apiGet<AccountOptions>("accounts/options");

/** Polls only while the screen is on top (a pushed detail screen stops the list's polling). */
function usePollMs(ms: number) {
  const focused = useIsFocused();
  return focused ? ms : undefined;
}

/** The client's trading accounts with live metrics (equity and margin move with prices: polled every 5 s). */
export function useAccountList(opts: { poll?: boolean } = {}) {
  const intervalMs = usePollMs(5_000);
  return useQuery(KEYS.list, fetchAccounts, { persist: true, staleMs: 4_000, intervalMs: opts.poll === false ? undefined : intervalMs });
}

/** One account with its open positions and pending orders (polled every 4 s while on screen). */
export function useAccountDetail(login: number | null) {
  const intervalMs = usePollMs(4_000);
  const fetcher = React.useCallback(() => fetchAccount(login ?? 0), [login]);
  return useQuery(login ? KEYS.detail(login) : null, fetcher, { persist: true, staleMs: 3_000, intervalMs });
}

/** Account types the broker offers (commercial terms only; prop groups are removed by the server). */
export function useGroups(enabled = true) {
  return useQuery(KEYS.groups, fetchGroups, { persist: true, staleMs: 5 * 60_000, enabled });
}

/** The broker's switches for the open-account wizard (demo accounts can be turned off in the Back Office). */
export function useAccountOptions(enabled = true) {
  return useQuery(KEYS.options, fetchOptions, { persist: true, staleMs: 60_000, enabled });
}

/** Warm an account's detail before its screen opens (row press-in). */
export function prefetchAccount(login: number) {
  prefetch(KEYS.detail(login), () => fetchAccount(login), { persist: true, staleMs: 3_000 });
}

/** Warm the open-account wizard (types and the broker's demo switch) on a press-in. */
export function prefetchWizard() {
  prefetch(KEYS.groups, fetchGroups, { persist: true, staleMs: 5 * 60_000 });
  prefetch(KEYS.options, fetchOptions, { persist: true, staleMs: 60_000 });
}

/** The list entry of an account (the detail screen opens on it while its own answer loads). */
export function cachedAccount(login: number): Account | undefined {
  return getQueryData<ListData>(KEYS.list)?.accounts.find((a) => a.login === login);
}

/** A view-only login (D90) or a read-only staff session: account actions are hidden (the server refuses them too). */
export function useReadOnly(): boolean {
  const viewer = useSession((s) => !!s.viewer);
  const staffReadOnly = useSession((s) => (s.user as { impersonation?: { mode?: string } | null } | null)?.impersonation?.mode === "read_only");
  return viewer || staffReadOnly;
}

/* ------------------------------------------------------------------ */
/* Writes (never optimistic: the screens show the server's answer)     */
/* ------------------------------------------------------------------ */

/** Opens an account; the server's new account joins the shared list at once. Credentials come back only here. */
export async function openAccount(body: OpenRequest) {
  const r = await apiPost<OpenResult>("trading/accounts", body, { timeoutMs: 30_000 });
  if (r.ok && r.data.account) addOpenedAccount(r.data.account);
  return r;
}

export async function refillDemo(login: number) {
  const r = await apiPost<{ status?: string; amount: number; balance: number }>(`trading/accounts/${login}/demo-refill`, {});
  if (r.ok) refreshAccounts();
  return r;
}

export async function changeLeverage(login: number, leverage: number, stepupToken: string) {
  const r = await apiPost<{ status?: string; from: number; leverage: number }>(`trading/accounts/${login}/leverage`, { leverage, stepup_token: stepupToken });
  if (r.ok) refreshAccounts();
  return r;
}

export const changePassword = (login: number, kind: PasswordKind, password: string, stepupToken: string) =>
  apiPost<{ status?: string; sessionsRevoked?: number }>(`trading/accounts/${login}/passwords`, { kind, password, stepup_token: stepupToken });

/** After a confirmed change: every account view refetches (list, details, Home, Trade). */
export function refreshAccounts() {
  invalidate(KEYS.list);
}

/** The server's new account goes into the shared list at once (before the refetch), so the Trade tab knows it. */
export function addOpenedAccount(account: Account) {
  publishFigures([account]);
  setQueryData<ListData>(KEYS.list, (prev) => ({ accounts: [...(prev?.accounts ?? []).filter((a) => a.login !== account.login), account] }), true);
  refreshAccounts();
}

/* ------------------------------------------------------------------ */
/* Errors in the reader's language                                     */
/* ------------------------------------------------------------------ */

/** Server codes of the trading BFF / engine / gateway that the accounts screens explain in their own words. */
const CODES = new Set([
  "positions_open",
  "refill_limit",
  "refill_not_needed",
  "account_limit",
  "invalid_leverage",
  "unavailable",
  "stepup_required",
  "stepup_invalid",
  "viewer_read_only",
  "viewer_scope",
  "staff_read_only",
  "feature_disabled",
  "maintenance",
  "module_disabled",
  "account_status",
  "not_found",
]);

/** Validation texts the BFF / engine send in English, mapped to catalog keys. */
const MESSAGES: Record<string, string> = {
  "Use 8 to 64 characters with letters and digits.": "passwordRules",
  "Password must be 8–64 characters": "passwordRules",
  "Password must contain letters and digits": "passwordRules",
  "Trading and investor passwords must differ": "passwordsMustDiffer",
  "The investor password must differ from the trading password": "passwordsMustDiffer",
  "The account already uses this leverage.": "sameLeverage",
  "Prop accounts are opened by buying a prop challenge.": "propGroup",
  "Invalid demo balance.": "demoBalance",
  "Demo balance must be between 100 and 1 000 000": "demoBalance",
};

export function accountError(e: ApiError): string {
  const t = i18n.t;
  if (CODES.has(e.code)) return t.dyn(`mobileAccounts.error.${e.code}`, e.message);
  const key = MESSAGES[e.message];
  if (key) return t.dyn(`mobileAccounts.error.${key}`, e.message);
  return e.message || t("common.errorRetry");
}

/** The confirmation was spent or refused: the change has to be confirmed with a new code. */
export const isStepupError = (e: ApiError) => e.code === "stepup_required" || e.code === "stepup_invalid";
