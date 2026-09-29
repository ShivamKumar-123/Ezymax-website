// Reports data: the reports service through the Client Area BFF (GET only, read-only for every session).
//   GET reports/analytics?login=all|<login>&from&to          analytics (USD)
//   GET reports/accounts/{login}/months                      calendar months with net / deposits / withdrawals
//   GET reports/accounts/{login}/statement?from&to&format=pdf|xlsx|csv&open=0&charges=0&deals=0   the file
// The BFF resolves the client from the bearer session and enforces ownership and view-only scopes; the service
// answers 404 for accounts the client doesn't own. Periods are [from, to) in server days (YYYY-MM-DD).
import { apiFile, apiGet } from "@/lib/api";
import { prefetch } from "@/lib/query";
import type { Analytics, Months, Period, ReportAccount, Scope, StFormat, StOptions, StPeriod } from "./types";

/** The app-wide accounts cache entry (same key and shape as the Accounts and Trade screens). */
export const ACCOUNTS_KEY = "trading/accounts";
export const fetchAccounts = () => apiGet<{ accounts: ReportAccount[] }>("trading/accounts");

export const PERIODS: Period[] = ["7D", "30D", "90D", "1Y", "ALL"];
export const PERIOD_DAYS: Record<Period, number> = { "7D": 7, "30D": 30, "90D": 90, "1Y": 365, ALL: 3650 };
/** Analytics are recomputed by the service on every call (it first pulls the client's latest deals). */
export const ANALYTICS_STALE_MS = 60_000;

/** YYYY-MM-DD of a local date (the Client Area uses the same day boundary for its periods). */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(day: string, n: number): string {
  const x = new Date(`${day}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

/** Last N days including today: [today − N + 1, tomorrow). */
export function analyticsRange(p: Period, now = new Date()): { from: string; to: string } {
  const today = isoDay(now);
  return { from: addDays(today, -PERIOD_DAYS[p] + 1), to: addDays(today, 1) };
}

/** Cache key without dates: the screen reopens on the last answer for this account and period, then refreshes. */
export const analyticsKey = (scope: Scope, p: Period) => `reports/analytics/${scope}/${p}`;

export function fetchAnalytics(scope: Scope, p: Period) {
  const { from, to } = analyticsRange(p);
  return apiGet<Analytics>(`reports/analytics?login=${scope}&from=${from}&to=${to}`, { timeoutMs: 45_000 });
}

/** Warm the analytics of an account / period (press-in on a period pill, an account row or a link to the screen). */
export function prefetchAnalytics(scope: Scope, p: Period = "90D") {
  prefetch(analyticsKey(scope, p), () => fetchAnalytics(scope, p), { persist: true, staleMs: ANALYTICS_STALE_MS });
}

export const monthsKey = (login: number) => `reports/months/${login}`;
export const fetchMonths = (login: number) => apiGet<Months>(`reports/accounts/${login}/months`, { timeoutMs: 30_000 });

export function prefetchMonths(login: number) {
  prefetch(monthsKey(login), () => fetchMonths(login), { persist: true, staleMs: 60_000 });
}

/** The statement file (PDF / Excel / CSV) of one account for [from, to). */
export function fetchStatement(login: number, from: string, to: string, format: StFormat, opts?: StOptions, signal?: AbortSignal) {
  const q = new URLSearchParams({ from, to, format });
  if (opts && !opts.open) q.set("open", "0");
  if (opts && !opts.charges) q.set("charges", "0");
  if (opts && !opts.deals) q.set("deals", "0");
  return apiFile(`reports/accounts/${login}/statement?${q}`, { timeoutMs: 120_000, signal });
}

/* ------------------------------------------------------------------ */
/* Statement periods (same rules as the Client Area's Statements page)  */
/* ------------------------------------------------------------------ */

export type StPeriodInput = { period: StPeriod; day: string; month: string; year: string; from: string; to: string };

/** [from, to) in server days for the chosen period; null while the input is incomplete or reversed. */
export function statementRange(p: StPeriodInput): { from: string; to: string } | null {
  if (p.period === "day") return /^\d{4}-\d{2}-\d{2}$/.test(p.day) ? { from: p.day, to: addDays(p.day, 1) } : null;
  if (p.period === "month") {
    if (!/^\d{4}-\d{2}$/.test(p.month)) return null;
    const [y, m] = p.month.split("-").map(Number) as [number, number];
    return { from: `${p.month}-01`, to: m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01` };
  }
  if (p.period === "year") return /^\d{4}$/.test(p.year) ? { from: `${p.year}-01-01`, to: `${Number(p.year) + 1}-01-01` } : null;
  if (!p.from || !p.to || p.from > p.to) return null;
  return { from: p.from, to: addDays(p.to, 1) };
}

/** Months from the account's opening month to this month, newest first ("YYYY-MM"). */
export function monthsSince(createdAt: string | undefined, today: string): string[] {
  const start = createdAt && /^\d{4}-\d{2}/.test(createdAt) ? isoDay(new Date(createdAt)).slice(0, 7) : today.slice(0, 7);
  const out: string[] = [];
  let [y, m] = today.slice(0, 7).split("-").map(Number) as [number, number];
  while (out.length < 240) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push(key);
    if (key <= start) break;
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

export function yearsSince(createdAt: string | undefined, today: string): string[] {
  const first = createdAt && /^\d{4}/.test(createdAt) ? new Date(createdAt).getFullYear() : Number(today.slice(0, 4));
  const last = Number(today.slice(0, 4));
  return Array.from({ length: Math.max(1, last - first + 1) }, (_, i) => String(last - i));
}

/* ------------------------------------------------------------------ */
/* Default account                                                      */
/* ------------------------------------------------------------------ */

const usable = (a: ReportAccount) => !a.status || a.status !== "disabled";

/** Statements: the account asked for, else the active trading account, else the first live, else the first. */
export function pickStatementAccount(accounts: ReportAccount[], wanted: number | null, active: number | null): ReportAccount | undefined {
  return accounts.find((a) => a.login === wanted) ?? accounts.find((a) => a.login === active) ?? accounts.find((a) => a.type === "live" && usable(a)) ?? accounts[0];
}

/**
 * Analytics: every live account when the client has one, else the active trading account, else the first.
 * A view-only login gets one of the accounts shared with it (the BFF answers "all" only for a single shared
 * account, so it is never asked for "all"): the active one when shared, else the first.
 */
export function defaultScope(accounts: ReportAccount[] | undefined, viewerAccounts: number[] | null, active: number | null): Scope {
  if (viewerAccounts) return viewerAccounts.find((l) => l === active) ?? viewerAccounts[0] ?? "all";
  if (!accounts) return "all";
  if (accounts.some((a) => a.type === "live")) return "all";
  return (accounts.find((a) => a.login === active) ?? accounts[0])?.login ?? "all";
}

/** "All live accounts" is for the account owner; a view-only login picks one of its shared accounts. */
export const allowsAll = (viewerAccounts: number[] | null) => viewerAccounts === null;
