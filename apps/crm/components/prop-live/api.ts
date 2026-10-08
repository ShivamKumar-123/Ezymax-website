"use client";

// Browser side of the prop BFF (app/api/prop/[...path]/route.ts). Live builds only: demo builds keep the mock
// challenges from @ezymex/mock/prop. Shapes: services/prop/README.md.

import * as React from "react";
import { toast } from "sonner";
import { intlTag, type MessageKey } from "@ezymex/i18n";
import { tr } from "@ezymex/i18n/react";
import { readCached, writeCached } from "@ezymex/ui/swr-cache";

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
export const ERROR_LINK: Record<string, { href: string; labelKey: MessageKey }> = {
  insufficient_funds: { href: "/wallet/deposit", labelKey: "prop.errorLink.deposit" },
  kyc_required: { href: "/profile/verification", labelKey: "prop.errorLink.verify" },
};

const FRIENDLY: Record<string, MessageKey> = {
  insufficient_funds: "prop.error.insufficientFunds",
  kyc_required: "prop.error.kycRequired",
  payment_pending: "prop.error.paymentPending",
  payment_failed: "prop.error.paymentFailed",
  wallet_pending: "prop.error.walletPending",
  wallet_rejected: "prop.error.walletRejected",
  provisioning: "prop.error.provisioning",
  plan_unavailable: "prop.error.planUnavailable",
  not_yet_eligible: "prop.error.notYetEligible",
  below_minimum: "prop.error.belowMinimum",
  positions_open: "prop.error.positionsOpen",
  payout_pending: "prop.error.payoutPending",
  consistency: "prop.error.consistency",
  not_funded: "prop.error.notFunded",
  account_unavailable: "prop.error.accountUnavailable",
  idempotency_conflict: "prop.error.idempotencyConflict",
  not_active: "prop.error.notActive",
  account_limit: "prop.error.accountLimit",
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
    throw new PropError(0, "network", tr("prop.error.network"));
  }
  const data = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string; field?: string } };
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.assign(`/api/auth/expired?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
    const code = data.error?.code ?? "error";
    const fallback = code.startsWith("engine_") ? tr("prop.error.engine") : tr("prop.error.generic");
    // payout gate codes: the service message carries the specifics (dates, amounts)
    const msg = PREFER_SERVICE.has(code) && data.error?.message ? data.error.message : (FRIENDLY[code] ? tr(FRIENDLY[code]) : data.error?.message ?? fallback);
    throw new PropError(res.status, code, msg, data.error?.field);
  }
  return data as T;
}

export function errorToast(title: string, e: unknown) {
  toast.error(title, { description: e instanceof Error ? e.message : tr("prop.error.generic") });
}

/** Polls `path` every `ms` while the tab is visible (0 = once). `reload()` refetches at once.
 *  Opened again, a page starts from this tab's last answer while it refetches (@ezymex/ui/swr-cache). */
export function usePropPoll<T>(path: string | null, ms: number) {
  const [data, setData] = React.useState<T | null>(() => (path ? (readCached<T>(`prop:${path}`) ?? null) : null));
  const [error, setError] = React.useState<PropError | null>(null);
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    if (!path) return;
    const cached = readCached<T>(`prop:${path}`);
    if (cached !== undefined) setData(cached);
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
          writeCached(`prop:${path}`, d);
          setError(null);
        } catch (e) {
          if (stop || (e as Error).name === "AbortError") return;
          setError(e instanceof PropError ? e : new PropError(0, "error", tr("prop.error.generic")));
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

// Labels below are looked up when rendered (tr follows the reader's language); they are only shown after
// client-side fetches, so server rendering never sees them.
const TYPE_KEY: Record<PlanType, MessageKey> = { "1-step": "prop.type.oneStep", "2-step": "prop.type.twoStep", instant: "prop.type.instant" };
export const typeLabel = (x: PlanType) => (TYPE_KEY[x] ? tr(TYPE_KEY[x]) : x);

const BANNED_KEY: Record<string, MessageKey> = {
  hft: "prop.banned.hft",
  latency_arbitrage: "prop.banned.latencyArbitrage",
  tick_scalping: "prop.banned.tickScalping",
  cross_account_copying: "prop.banned.crossAccountCopying",
  cross_account_hedging: "prop.banned.crossAccountHedging",
  martingale: "prop.banned.martingale",
  grid: "prop.banned.grid",
};

export const bannedLabel = (k: string) => (BANNED_KEY[k] ? tr(BANNED_KEY[k]) : k.replace(/_/g, " "));

const PAYOUT_FREQ_KEY: Record<string, MessageKey> = { weekly: "prop.payoutFreq.weekly", "bi-weekly": "prop.payoutFreq.biWeekly", monthly: "prop.payoutFreq.monthly", "on-demand": "prop.payoutFreq.onDemand" };
/** Payout cycle in lower case for use inside a sentence ("then weekly"). */
export const payoutFreqLabel = (f: string) => (PAYOUT_FREQ_KEY[f] ? tr(PAYOUT_FREQ_KEY[f]) : f);

const RULE_KEY: Record<string, MessageKey> = {
  daily_loss: "prop.rule.dailyLoss",
  max_drawdown: "prop.rule.maxDrawdown",
  profit_target: "prop.rule.profitTarget",
  time_limit: "prop.rule.timeLimit",
  weekend_holding: "prop.rule.weekendHolding",
  news_window: "prop.rule.newsWindow",
  banned_strategy: "prop.rule.bannedStrategy",
  consistency: "prop.rule.consistency",
  manual: "prop.rule.riskDesk",
  override: "prop.rule.riskDesk",
};

export const ruleLabel = (r: string) => (RULE_KEY[r] ? tr(RULE_KEY[r]) : r.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()));

const BLOCKER_KEY: Record<string, MessageKey> = {
  not_yet_eligible: "prop.blocker.notYetEligible",
  below_minimum: "prop.blocker.belowMinimum",
  positions_open: "prop.blocker.positionsOpen",
  payout_pending: "prop.blocker.payoutPending",
  consistency: "prop.blocker.consistency",
};
export const blockerText = (b: string) => (BLOCKER_KEY[b] ? tr(BLOCKER_KEY[b]) : b.replace(/_/g, " "));

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(intlTag(tr.locale), { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(intlTag(tr.locale), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function fmtDuration(secs: number) {
  if (!Number.isFinite(secs) || secs < 0) return "—";
  if (secs < 60) return tr("prop.duration.s", { s: Math.round(secs) });
  if (secs < 3600) return tr("prop.duration.ms", { m: Math.floor(secs / 60), s: Math.round(secs % 60) });
  if (secs < 86400) return tr("prop.duration.hm", { h: Math.floor(secs / 3600), m: Math.floor((secs % 3600) / 60) });
  return tr("prop.duration.dh", { d: Math.floor(secs / 86400), h: Math.floor((secs % 86400) / 3600) });
}

/** Steps of a plan: Phase 1 → Phase 2 → Funded / Evaluation → Funded / Funded. */
export function planSteps(p: Pick<Plan, "phases">): string[] {
  return [...p.phases.map((x) => x.name), tr("prop.status.funded")];
}

export const CHALLENGE_STATUS: Record<ChallengeStatus, { labelKey: MessageKey; tone: "up" | "down" | "warn" | "gold" | "ember" | "neutral" | "info" }> = {
  pending_payment: { labelKey: "prop.status.pendingPayment", tone: "warn" },
  provisioning: { labelKey: "prop.status.provisioning", tone: "info" },
  active: { labelKey: "prop.status.active", tone: "ember" },
  funded: { labelKey: "prop.status.funded", tone: "gold" },
  failed: { labelKey: "prop.status.failed", tone: "down" },
  closed: { labelKey: "prop.status.closed", tone: "neutral" },
  payment_failed: { labelKey: "prop.status.paymentFailed", tone: "down" },
};

export const challengeStatusLabel = (s: string) => {
  const m = CHALLENGE_STATUS[s as ChallengeStatus];
  return m ? tr(m.labelKey) : s;
};

/** Short label of where a challenge stands, e.g. "Phase 2 · Active", "Funded", "Phase 1 · Failed". */
export function stageLabel(c: Challenge) {
  const cur = c.current;
  if (c.status === "funded") return tr("prop.status.funded");
  if (c.status === "active" && cur) return tr("prop.stage.active", { phase: cur.phase });
  if (c.status === "failed" && cur) return tr("prop.stage.failed", { phase: cur.phase });
  return challengeStatusLabel(c.status);
}

/** Stepper index for a challenge (steps from planSteps). */
export function stepIndex(c: Challenge) {
  if (c.status === "funded") return c.plan.phases.length;
  return Math.min(c.phaseIndex, c.plan.phases.length);
}
