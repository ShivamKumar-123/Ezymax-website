"use client";

// Browser side of the social BFF (app/api/social/[...path]/route.ts): copy trading and PAMM on live data.
// Shapes follow the engine contract (services/trading README, "Copy trading and PAMM" → "Social API").

import * as React from "react";
import { ApiError } from "@/components/trading/api";
import type { EngineOrder, EnginePosition } from "@/components/trading/api";

export { ApiError };

/* ------------------------------------------------------------------ */
/* Contract shapes                                                     */
/* ------------------------------------------------------------------ */

export type Program = "copy" | "pamm" | "both";
export type FeePeriod = "daily" | "weekly" | "monthly";
export type SizingMode = "equity" | "allocation" | "multiplier" | "fixed_lot";
export type MasterStatus = "pending" | "approved" | "rejected" | "suspended";

export interface MasterStats {
  return1m: number;
  return3m: number;
  return1y: number;
  returnAll: number;
  maxDd: number;
  currentDd: number;
  volatility: number;
  riskScore: number;
  equity: number;
  aum: number;
  followers: number;
  investors: number;
  trades: number;
  winRate: number;
  spark: number[];
}

export interface MasterFundCard {
  id: number;
  name: string;
  nav: number;
  period: FeePeriod;
  perfFeePct: number;
  lockInDays: number;
  minInvestment: number;
  status: FundStatus;
}

export interface MasterView {
  id: number;
  nickname: string;
  strategy: string;
  description: string;
  program: Program;
  perfFeePct: number;
  feePeriod: FeePeriod;
  minAllocation: number;
  status: MasterStatus;
  hidden: boolean;
  frozen: boolean;
  since: string | null;
  ageDays: number;
  stats: MasterStats;
  fund: MasterFundCard | null;
  /** House account: operated by the broker, runs an automated strategy (always shown with the disclosure label) */
  house?: boolean;
  // private (own profile only)
  login?: number;
  kycVerified?: boolean;
  reviewNote?: string | null;
  createdAt?: string;
}

export interface Sizing {
  mode: SizingMode;
  value: number;
}

export interface SubscriptionView {
  id: number;
  masterId: number;
  master: { id: number; nickname: string; strategy: string; riskScore: number; frozen: boolean; status: MasterStatus; house?: boolean };
  login: number;
  status: "active" | "paused" | "stopped";
  stopReason: string | null;
  sizing: Sizing;
  maxLot: number | null;
  equityStop: number | null;
  maxDdPct: number | null;
  excludedSymbols: string[];
  perfFeePct: number;
  feePeriod: FeePeriod;
  allocation: number;
  netDeposits: number;
  hwm: number;
  peakEquity: number;
  feesPaid: number;
  feesPending: number;
  balance: number;
  equity: number;
  profit: number;
  returnPct: number;
  positions: number;
  orders: number;
  createdAt: string;
  stoppedAt: string | null;
  nextFeeAt: string | null;
}

export type FundStatus = "active" | "frozen" | "closed";

export interface FundView {
  id: number;
  masterId: number;
  master: { id: number; nickname: string };
  name: string;
  status: FundStatus;
  period: FeePeriod;
  perfFeePct: number;
  lockInDays: number;
  minInvestment: number;
  maxDdPct: number;
  minOwnPct: number;
  nav: number;
  units: number;
  equity: number;
  aum: number;
  investors: number;
  masterSharePct: number;
  navPeak: number;
  drawdownPct: number;
  returnAll: number;
  return1m: number;
  lastRolloverAt: string | null;
  nextRolloverAt: string | null;
  createdAt: string;
  login?: number;
}

export interface RequestView {
  id: number;
  fundId: number;
  kind: "invest" | "redeem";
  amount: number | null;
  units: number | null;
  all: boolean;
  status: "pending" | "done" | "rejected" | "cancelled";
  reason: string | null;
  createdAt: string;
  executedAt: string | null;
  nav: number | null;
  unitsDelta: number | null;
  amountOut: number | null;
  fee: number | null;
}

export interface InvestmentView {
  fundId: number;
  fund: FundView;
  units: number;
  nav: number;
  value: number;
  netInvested: number;
  pnl: number;
  pnlPct: number;
  hwmNav: number;
  stopLossPct: number | null;
  lockedUntil: string | null;
  feesPaid: number;
  pending: RequestView[];
}

export interface FeeView {
  id: number;
  source: "copy" | "pamm";
  masterId: number;
  master: string;
  subscriptionId: number | null;
  fundId: number | null;
  login: number;
  amount: number;
  platformCut: number;
  masterAmount: number;
  periodStart: string;
  periodEnd: string;
  hwmBefore: number;
  hwmAfter: number;
  equity: number;
  status: "pending" | "approved" | "paid" | "rejected" | "failed";
  note: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface Leaderboard {
  items: MasterView[];
  totals: { masters: number; aum: number; followers: number; investors: number };
}

export interface MasterProfile {
  master: MasterView;
  equity: { day: string; equity: number; index: number }[];
  monthly: { month: string; returnPct: number }[];
  trades: { id: number; symbol: string; side: "buy" | "sell"; volume: number; openPrice: number; closePrice: number; openTime: string; closeTime: string; profit: number }[];
  symbols: { symbol: string; trades: number; share: number }[];
  tradeDelayMinutes: number;
  terms: { perfFeePct: number; feePeriod: FeePeriod; hwm: boolean; minAllocation: number; platformCutPct: number };
}

export interface Check {
  key: "kyc" | "live" | "track" | "equity" | "free" | string;
  ok: boolean;
  label: string;
  detail: string;
}

export interface Candidate {
  login: number;
  group: string;
  equity: number;
  ageDays: number;
  eligible: boolean;
  checks: Check[];
}

export interface SocialSettings {
  feeMinPct: number;
  feeMaxPct: number;
  minTrackDays: number;
  minOwnCapitalPct: number;
  minMasterEquity: number;
  platformCutPct: number;
  minAllocation: number;
}

export interface MasterMe {
  master: MasterView | null;
  settings: SocialSettings;
  candidates: Candidate[];
}

/** Dashboard fund: FundView with `investors` as a list (the contract overrides the count) and the pending requests. */
export type DashboardFund = Omit<FundView, "investors"> & {
  investors: { investorId: number; units: number; value: number; since: string }[] | number;
  pending: number | RequestView[];
};

export interface MasterDashboard {
  master: MasterView;
  followers: { subscriptionId: number; since: string; status: SubscriptionView["status"]; sizing: Sizing; equity: number; profit: number }[];
  funds: DashboardFund[];
  fees: FeeView[];
  totals: { followers: number; aum: number; feesPending: number; feesPaid: number };
}

export interface SubscriptionDetail {
  subscription: SubscriptionView;
  positions: EnginePosition[];
  orders: EngineOrder[];
  log: { at: string; action: string; masterTicket: number | null; followerTicket: number | null; volume: number | null; status: string; message: string | null }[];
  fees: FeeView[];
}

export interface FundDetail {
  fund: FundView;
  master: MasterView | null;
  navHistory: { at: string; nav: number }[];
  rollovers: { at: string; nav: number; invested: number; redeemed: number; fees: number }[];
}

export interface Statement {
  items: { at: string; kind: "seed" | "invest" | "redeem" | "fee" | "stop_loss" | string; units: number; nav: number; amount: number }[];
  requests: RequestView[];
}

export interface FollowResult {
  subscription: SubscriptionView;
  account: { login: number } & Record<string, unknown>;
  funding: { status: "done" | "failed"; message?: string };
}

export interface StopResult {
  subscription: SubscriptionView;
  closed: number[];
  failed: { ticket: number; error: string }[];
  returned: number | null;
}

/* ------------------------------------------------------------------ */
/* Fetch                                                               */
/* ------------------------------------------------------------------ */

const FRIENDLY: Record<string, string> = {
  unavailable: "Copy trading is unavailable right now. Please try again shortly.",
  not_master: "This is available to approved masters only.",
  master_status: "This master isn't accepting new followers right now.",
  requirements: "Your account doesn't meet every requirement yet.",
  fee_out_of_range: "The performance fee is outside the allowed range.",
  own_subscription: "You can't copy your own strategy.",
  min_allocation: "The amount is below the master's minimum allocation.",
  wallet_unavailable: "The wallet is unavailable right now. Please try again shortly.",
  wallet_rejected: "Your wallet balance doesn't cover this amount.",
  fund_frozen: "This fund is frozen and isn't accepting investments.",
  min_investment: "The amount is below the fund's minimum investment.",
  locked: "Your investment is still in its lock-in period.",
  insufficient_units: "You don't hold enough units for this redemption.",
  request_done: "This request has already been processed.",
  pamm_account: "Money moves in and out of a PAMM fund only through invest and redeem.",
};

export async function socialApi<T>(path: string, init?: { method?: "GET" | "POST" | "PATCH"; body?: unknown; signal?: AbortSignal }): Promise<T> {
  const method = init?.method ?? (init?.body !== undefined ? "POST" : "GET");
  let res: Response;
  try {
    res = await fetch(`/api/social/${path}`, {
      method,
      headers: method !== "GET" ? { "content-type": "application/json" } : undefined,
      body: method !== "GET" ? JSON.stringify(init?.body ?? {}) : undefined,
      cache: "no-store",
      signal: init?.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "network", "Network error. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string; field?: string; checks?: Check[] } };
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.assign(`/api/auth/expired?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
    const code = data.error?.code ?? "error";
    // the engine's own message is more specific for validation-type errors; the map covers the terse codes
    const msg = data.error?.message && code !== "unavailable" ? data.error.message : FRIENDLY[code] ?? "Something went wrong. Please try again.";
    const err = new ApiError(res.status, code, res.status === 404 && code === "not_found" && !data.error?.message ? "Not found." : msg, data.error?.field);
    (err as ApiError & { checks?: Check[] }).checks = data.error?.checks;
    throw err;
  }
  return data as T;
}

/** Polls `path` every `ms` (0 = once) while the tab is visible. `reload()` refetches at once. */
export function useSocial<T>(path: string | null, ms = 0) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    if (!path) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ctl = new AbortController();
    const run = async () => {
      if (stop) return;
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        try {
          const d = await socialApi<T>(path, { signal: ctl.signal });
          if (stop) return;
          setData(d);
          setError(null);
        } catch (e) {
          if (stop || (e as Error).name === "AbortError") return;
          setError(e instanceof ApiError ? e : new ApiError(0, "error", "Something went wrong."));
        }
      }
      if (!stop && ms > 0) timer = setTimeout(run, ms);
    };
    run();
    return () => {
      stop = true;
      ctl.abort();
      if (timer) clearTimeout(timer);
    };
  }, [path, ms, tick]);

  return { data, error, loading: data === null && error === null, reload };
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const safe = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** "+12.34%" / "-3.10%" / "0.00%". */
export function pct(v: number | null | undefined, decimals = 2, signed = true) {
  const n = safe(v);
  const s = Math.abs(n).toFixed(decimals);
  return `${signed ? (n > 0 ? "+" : n < 0 ? "-" : "") : n < 0 ? "-" : ""}${s}%`;
}

/** "$1,234.56"; signed adds "+" / "-". */
export function usd(v: number | null | undefined, decimals = 2, signed = false) {
  const n = safe(v);
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${signed ? (n > 0 ? "+" : n < 0 ? "-" : "") : n < 0 ? "-" : ""}$${s}`;
}

export function compactUsd(v: number | null | undefined) {
  const n = safe(v);
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e4) return `$${(n / 1e3).toFixed(1)}K`;
  return usd(n, 0);
}

export const nav4 = (v: number | null | undefined) => safe(v).toFixed(4);
export const units4 = (v: number | null | undefined) => safe(v).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export function formatAge(days: number | null | undefined) {
  const d = Math.max(0, Math.floor(safe(days)));
  if (d < 30) return `${d}d`;
  const y = Math.floor(d / 365);
  const mo = Math.floor((d % 365) / 30.4);
  return y > 0 ? `${y}y ${mo}m` : `${mo}m`;
}

export const PERIOD_LABEL: Record<FeePeriod, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

export const SIZING_LABEL: Record<SizingMode, string> = {
  equity: "Equity proportional",
  fixed_lot: "Fixed lot",
  multiplier: "Multiplier",
  allocation: "Fixed allocation",
};

export function sizingText(s: Sizing | null | undefined) {
  if (!s) return "—";
  switch (s.mode) {
    case "equity":
      return "Equity proportional";
    case "fixed_lot":
      return `Fixed ${safe(s.value).toFixed(2)} lot`;
    case "multiplier":
      return `Multiplier ${safe(s.value)}×`;
    case "allocation":
      return `Allocation ${usd(s.value, 0)}`;
  }
}

export const riskLabel = (r: number) => (r <= 3 ? "Low" : r <= 6 ? "Medium" : "High");
export const riskTone = (r: number): "up" | "warn" | "down" => (r <= 3 ? "up" : r <= 6 ? "warn" : "down");

export const toneOf = (v: number | null | undefined) => (safe(v) > 0 ? "text-up" : safe(v) < 0 ? "text-down" : "text-fg-2");
