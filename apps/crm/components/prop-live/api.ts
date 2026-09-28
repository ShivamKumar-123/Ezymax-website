"use client";

// Browser side of the prop BFF (app/api/prop/[...path]/route.ts). Live builds only: demo builds keep the mock
// challenges from @kalks/mock/prop. Shapes: services/prop/README.md.

import * as React from "react";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/* Service shapes                                                      */
/* ------------------------------------------------------------------ */

export type PlanType = "1-step" | "2-step" | "instant";

export interface PlanSize {
  size: number;
  fee: number;
  leverage: number;
  enabled: boolean;
}

export interface PlanPhase {
  name: string;
  target: number;
  minDays: number;
  timeLimit: number;
}

export interface Plan {
  id: string;
  name: string;
  type: PlanType;
  status: string;
  version: number;
  group: string;
  sizes: PlanSize[];
  phases: PlanPhase[];
  dailyLoss: number;
  dailyBasis: "balance" | "equity";
  maxDD: number;
  ddType: "static" | "trailing";
  trailingLock: boolean;
  consistency: number;
  newsTrading: boolean;
  newsWindow: number;
  newsBreachFails: boolean;
  weekendHolding: boolean;
  eaAllowed: boolean;
  banned: string[];
  split: number;
  splitMax: number;
  scalingEvery: number;
  scalingIncrease: number;
  scalingProfit: number;
  scalingCap: number;
  refundFee: boolean;
  payoutFreq: string;
  firstPayoutDays: number;
  minPayout: number;
}

export interface Verdict {
  kind: "ok" | "pass" | "breach";
  rule?: string;
  message?: string;
  threshold?: number;
}

export interface LiveRules {
  day: string;
  dailyLimit: number;
  dailyRef: number;
  dailyFloor: number;
  dailyUsed: number;
  ddLimit: number;
  ddFloor: number;
  ddUsed: number;
  hwm: number;
  profit: number;
  targetAmount: number | null;
  targetReached: boolean;
  tradingDays: number;
  minDays: number;
  daysOk: boolean;
  bestDay: number | null;
  consistencyLimit: number | null;
  consistencyOk: boolean;
  deadline: string | null;
  verdict: Verdict;
  warn: number | null;
  nextReset: string;
  weekendWindow: boolean;
  equity: number;
  balance: number;
  at: string;
}

export interface TradingStats {
  trades: number;
  open: number;
  wins: number;
  losses: number;
  winRate: number | null;
  avgWin: number;
  avgLoss: number;
  profitFactor: number | null;
  lots: number;
  bestDay: { day: string; profit: number } | null;
  days: string[];
  dayProfits: { day: string; profit: number }[];
}

export type PhaseStatus = "provisioning" | "active" | "passed" | "failed" | "closed";

export interface PhaseAccount {
  id: number;
  challengeId: number;
  phaseIndex: number;
  phase: string;
  funded: boolean;
  login: number | null;
  status: PhaseStatus;
  initialBalance: number;
  targetPct: number | null;
  minDays: number;
  timeLimitDays: number;
  startedAt: string;
  endedAt: string | null;
  endReason: string | null;
  balance: number | null;
  equity: number | null;
  openPositions: number;
  tradingDays: number;
  lastEvalAt: string | null;
  lastPayoutAt: string | null;
  scaledAt: string | null;
  rules: LiveRules | null;
  stats: TradingStats | null;
}

export type ChallengeStatus = "pending_payment" | "provisioning" | "active" | "funded" | "failed" | "closed" | "payment_failed";

export interface PayoutQuote {
  eligibleFrom: string | null;
  profit: number;
  split: number;
  traderAmount: number;
  firmAmount: number;
  feeRefund: number;
  total: number;
  minPayout: number;
  blockers: string[];
  eligible: boolean;
}

export interface RuleEvent {
  id: number;
  accountId: number;
  login: number | null;
  rule: string;
  severity: "breach" | "violation" | "warning" | "info" | string;
  at: string;
  equity: number | null;
  balance: number | null;
  threshold: number | null;
  message: string;
  details: unknown;
}

export interface Certificate {
  code: string;
  kind: "pass" | "funded" | "payout";
  title: string;
  traderName: string;
  planName: string;
  size: number;
  amount: number | null;
  phase: string | null;
  issuedAt: string;
  revoked: boolean;
  challengeId: number;
  verifyUrl: string;
}

export interface Challenge {
  id: number;
  traderName: string;
  planId: string;
  planName: string;
  type: PlanType;
  size: number;
  fee: number;
  leverage: number;
  group: string;
  status: ChallengeStatus;
  phaseIndex: number;
  feeRefunded: boolean;
  split: number;
  failureReason: string | null;
  createdAt: string;
  plan: Plan;
  phases: PhaseAccount[];
  current: PhaseAccount | null;
}

export interface ChallengeDetail extends Challenge {
  payout?: PayoutQuote;
  events: RuleEvent[];
  certificates: Certificate[];
}

export interface Payout {
  id: number;
  challengeId: number;
  login: number | null;
  profit: number;
  split: number;
  traderAmount: number;
  firmAmount: number;
  feeRefund: number;
  total: number;
  status: "pending" | "approved" | "paid" | "rejected" | "failed";
  kycStatus: string | null;
  requestedAt: string;
  decidedAt: string | null;
  note: string | null;
  error: string | null;
  planName: string;
  size: number;
}

export interface FundedAccount {
  challengeId: number;
  planName: string;
  size: number;
  login: number | null;
  balance: number | null;
  equity: number | null;
  quote: PayoutQuote;
  refundFee: boolean;
  feeRefunded: boolean;
}

export interface Trade {
  ticket: number;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  openTime: string;
  closeTime: string;
  openPrice: number;
  closePrice: number;
  profit: number;
  durationSecs: number;
}

export interface EquityPoint {
  at: string;
  balance: number;
  equity: number;
}

export interface PurchaseResult {
  challenge: Challenge;
  credentials: { login: number; password: string; investorPassword: string } | null;
}

/* ------------------------------------------------------------------ */
/* Fetch                                                               */
/* ------------------------------------------------------------------ */

export class PropError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

/** Codes that need an action outside this page: shown with a link. */
export const ERROR_LINK: Record<string, { href: string; label: string }> = {
  insufficient_funds: { href: "/wallet/deposit", label: "Deposit USDT" },
  kyc_required: { href: "/profile/verification", label: "Verify identity" },
};

const FRIENDLY: Record<string, string> = {
  insufficient_funds: "Your USDT wallet balance is too low for this challenge fee. Deposit USDT and try again.",
  kyc_required: "Verify your identity before requesting a payout.",
  payment_pending: "We couldn't confirm the wallet payment yet. Please try again in a minute: you won't be charged twice.",
  payment_failed: "The wallet payment didn't go through. You haven't been charged.",
  wallet_pending: "The wallet hasn't confirmed yet. Please try again in a minute.",
  wallet_rejected: "The wallet refused this payment. Please contact support.",
  provisioning: "Payment received. Your trading account is still being opened: it will appear under My challenges within a minute.",
  plan_unavailable: "This plan or size isn't available any more. Please pick another one.",
  not_yet_eligible: "This account isn't eligible for a payout yet.",
  below_minimum: "The profit is below the minimum payout amount.",
  positions_open: "Close all open positions before requesting a payout.",
  payout_pending: "A payout for this account is already in review.",
  consistency: "The consistency rule isn't met yet: your best day is too large a share of the profit.",
  not_funded: "Payouts are available on funded accounts only.",
  account_unavailable: "The trading account is unavailable right now. Please try again shortly.",
  idempotency_conflict: "This request was already used for a different purchase. Close the dialog and start again.",
  not_active: "This challenge isn't active.",
  account_limit: "You have reached the maximum number of prop accounts. Contact support to raise the limit.",
};

const PREFER_SERVICE = new Set(["not_yet_eligible", "below_minimum", "consistency", "positions_open", "payout_pending", "plan_unavailable"]);

export async function propApi<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal }): Promise<T> {
  const method = init?.method ?? (init?.body !== undefined ? "POST" : "GET");
  let res: Response;
  try {
    res = await fetch(`/api/prop/${path}`, {
      method,
      headers: method === "POST" ? { "content-type": "application/json" } : undefined,
      body: method === "POST" ? JSON.stringify(init?.body ?? {}) : undefined,
      cache: "no-store",
      signal: init?.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new PropError(0, "network", "Network error. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string; field?: string } };
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.assign(`/api/auth/expired?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
    const code = data.error?.code ?? "error";
    const fallback = code.startsWith("engine_") ? "The trading server didn't respond. Please try again shortly." : "Something went wrong. Please try again.";
    // payout gate codes: the service message carries the specifics (dates, amounts)
    const msg = PREFER_SERVICE.has(code) && data.error?.message ? data.error.message : (FRIENDLY[code] ?? data.error?.message ?? fallback);
    throw new PropError(res.status, code, msg, data.error?.field);
  }
  return data as T;
}

export function errorToast(title: string, e: unknown) {
  toast.error(title, { description: e instanceof Error ? e.message : "Something went wrong. Please try again." });
}

/** Polls `path` every `ms` while the tab is visible (0 = once). `reload()` refetches at once. */
export function usePropPoll<T>(path: string | null, ms: number) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<PropError | null>(null);
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
          const d = await propApi<T>(path, { signal: ctl.signal });
          if (stop) return;
          setData(d);
          setError(null);
        } catch (e) {
          if (stop || (e as Error).name === "AbortError") return;
          setError(e instanceof PropError ? e : new PropError(0, "error", "Something went wrong."));
        }
      }
      if (!stop && ms > 0) timer = setTimeout(run, ms);
    };
    // refresh at once when the tab becomes visible again
    const onVis = () => {
      if (document.visibilityState === "visible" && ms > 0) {
        if (timer) clearTimeout(timer);
        run();
      }
    };
    run();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      ctl.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [path, ms, tick]);

  return { data, error, loading: data === null && error === null, reload };
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export const usd = (v: number | null | undefined, decimals = 2) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

/** "$10k", "$200k", "$1M" */
export const sizeLabel = (n: number) => (n >= 1_000_000 ? `$${+(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `$${+(n / 1000).toFixed(1)}k` : `$${n}`);

export const pct = (v: number | null | undefined, d = 0) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${+v.toFixed(d)}%`);

export const TYPE_LABEL: Record<PlanType, string> = { "1-step": "1-Step", "2-step": "2-Step", instant: "Instant" };

export const BANNED_LABEL: Record<string, string> = {
  hft: "High-frequency trading",
  latency_arbitrage: "Latency arbitrage",
  tick_scalping: "Tick scalping",
  cross_account_copying: "Copying between accounts",
  cross_account_hedging: "Hedging between accounts",
  martingale: "Martingale",
  grid: "Grid trading",
};

export const bannedLabel = (k: string) => BANNED_LABEL[k] ?? k.replace(/_/g, " ");

export const PAYOUT_FREQ: Record<string, string> = { weekly: "Weekly", "bi-weekly": "Every 2 weeks", monthly: "Monthly", "on-demand": "On demand" };

export const RULE_LABEL: Record<string, string> = {
  daily_loss: "Daily loss",
  max_drawdown: "Max drawdown",
  profit_target: "Profit target",
  time_limit: "Time limit",
  weekend_holding: "Weekend holding",
  news_window: "News window",
  banned_strategy: "Banned strategy",
  consistency: "Consistency",
  manual: "Risk desk decision",
  override: "Risk desk decision",
};

export const ruleLabel = (r: string) => RULE_LABEL[r] ?? r.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export const BLOCKER_TEXT: Record<string, string> = {
  not_yet_eligible: "Not eligible yet: the first payout opens after the waiting period, then once per payout cycle.",
  below_minimum: "Profit is below the minimum payout.",
  positions_open: "Close all open positions to request a payout.",
  payout_pending: "A payout is already in review.",
  consistency: "Consistency rule not met: your best day is too large a share of the profit.",
};

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function fmtDuration(secs: number) {
  if (!Number.isFinite(secs) || secs < 0) return "—";
  if (secs < 60) return `${Math.round(secs)}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
  return `${Math.floor(secs / 86400)}d ${Math.floor((secs % 86400) / 3600)}h`;
}

/** Steps of a plan: Phase 1 → Phase 2 → Funded / Evaluation → Funded / Funded. */
export function planSteps(p: Pick<Plan, "phases">): string[] {
  return [...p.phases.map((x) => x.name), "Funded"];
}

export const CHALLENGE_STATUS: Record<ChallengeStatus, { label: string; tone: "up" | "down" | "warn" | "gold" | "ember" | "neutral" | "info" }> = {
  pending_payment: { label: "Awaiting payment", tone: "warn" },
  provisioning: { label: "Opening account", tone: "info" },
  active: { label: "Active", tone: "ember" },
  funded: { label: "Funded", tone: "gold" },
  failed: { label: "Failed", tone: "down" },
  closed: { label: "Closed", tone: "neutral" },
  payment_failed: { label: "Payment failed", tone: "down" },
};

/** Short label of where a challenge stands, e.g. "Phase 2 · Active", "Funded", "Phase 1 · Failed". */
export function stageLabel(c: Challenge) {
  const cur = c.current;
  if (c.status === "funded") return "Funded";
  if (c.status === "active" && cur) return `${cur.phase} · Active`;
  if (c.status === "failed" && cur) return `${cur.phase} · Failed`;
  return CHALLENGE_STATUS[c.status]?.label ?? c.status;
}

/** Stepper index for a challenge (steps from planSteps). */
export function stepIndex(c: Challenge) {
  if (c.status === "funded") return c.plan.phases.length;
  return Math.min(c.phaseIndex, c.plan.phases.length);
}
