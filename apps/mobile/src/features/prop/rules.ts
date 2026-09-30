// Rule views for the dashboard: what the prop evaluator last measured, falling back to the plan terms before its
// first look, plus the same live maths as services/prop/src/rules.rs so equity from the engine stream moves the
// gauges between two evaluations. The server stays the judge: pass / breach verdicts only ever come from it.
import type { MessageKey, T } from "@/i18n";
import type { BlockColor } from "@/theme/tokens";
import { usd, feeLabel } from "./format";
import type { LiveParams } from "./lib";
import type { Challenge, ChallengeStatus, LiveRules, PhaseAccount, Plan, PlanSize, PlanType } from "./types";

export type View = LiveRules & { initial: number; live: boolean };

/** The rule dashboard of `a`: the evaluator's numbers, or the plan terms before its first look. */
export function viewOf(c: Pick<Challenge, "plan">, a: PhaseAccount): View {
  const init = a.initialBalance;
  const r = a.rules;
  const eq = a.equity ?? r?.equity ?? init;
  const bal = a.balance ?? r?.balance ?? init;
  if (r) return { ...r, equity: eq, balance: bal, initial: init, live: true };
  const dl = (init * c.plan.dailyLoss) / 100;
  const dd = (init * c.plan.maxDD) / 100;
  return {
    day: "",
    dailyLimit: dl,
    dailyRef: init,
    dailyFloor: init - dl,
    dailyUsed: 0,
    ddLimit: dd,
    ddFloor: init - dd,
    ddUsed: 0,
    hwm: init,
    profit: bal - init,
    targetAmount: a.targetPct !== null ? (init * a.targetPct) / 100 : null,
    targetReached: false,
    tradingDays: a.tradingDays,
    minDays: a.minDays,
    daysOk: a.tradingDays >= a.minDays,
    bestDay: null,
    consistencyLimit: null,
    consistencyOk: true,
    deadline: a.timeLimitDays ? new Date(new Date(a.startedAt).getTime() + a.timeLimitDays * 86_400_000).toISOString() : null,
    verdict: { kind: "ok" },
    warn: null,
    nextReset: "",
    weekendWindow: false,
    equity: eq,
    balance: bal,
    at: "",
    initial: init,
    live: false,
  };
}

/** The account the challenge trades on now (only that one can be traded or streamed). */
export function tradable(c: Pick<Challenge, "status" | "current">, a: PhaseAccount | null | undefined): boolean {
  return !!a && a.status === "active" && (c.status === "active" || c.status === "funded") && c.current?.id === a.id && !!a.login;
}

/* ------------------------------------------------------------------ */
/* Live maths (worklets in ./lib: they run on the UI thread from shared values) */
/* ------------------------------------------------------------------ */

export { dailyShare, dailyUsedOf, ddFloorOf, ddShare, ddUsedOf, targetShare, type LiveParams } from "./lib";

export function liveParams(v: View, plan: Pick<Plan, "ddType" | "trailingLock">): LiveParams {
  return {
    initial: v.initial,
    dailyRef: v.dailyRef,
    dailyLimit: v.dailyLimit,
    ddLimit: v.ddLimit,
    hwm: v.hwm,
    trailing: plan.ddType === "trailing",
    lock: plan.trailingLock,
    target: v.targetAmount ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

const TYPE_KEY: Record<PlanType, MessageKey> = { "1-step": "mobileProp.type.oneStep", "2-step": "mobileProp.type.twoStep", instant: "mobileProp.type.instant" };
export const typeLabel = (t: T, x: PlanType) => (TYPE_KEY[x] ? t(TYPE_KEY[x]) : x);

const TYPE_TEXT_KEY: Record<PlanType, MessageKey> = { "1-step": "mobileProp.typeText.oneStep", "2-step": "mobileProp.typeText.twoStep", instant: "mobileProp.typeText.instant" };
export const typeText = (t: T, x: PlanType) => (TYPE_TEXT_KEY[x] ? t(TYPE_TEXT_KEY[x]) : "");

/** Plan colour blocks, in catalogue order (ember is kept for live challenges, gold for funded ones and payouts). */
export const PLAN_COLORS: BlockColor[] = ["periwinkle", "mint", "cream"];

const BANNED_KEY: Record<string, MessageKey> = {
  hft: "mobileProp.banned.hft",
  latency_arbitrage: "mobileProp.banned.latencyArbitrage",
  tick_scalping: "mobileProp.banned.tickScalping",
  cross_account_copying: "mobileProp.banned.crossAccountCopying",
  cross_account_hedging: "mobileProp.banned.crossAccountHedging",
  martingale: "mobileProp.banned.martingale",
  grid: "mobileProp.banned.grid",
};
export const bannedLabel = (t: T, k: string) => (BANNED_KEY[k] ? t(BANNED_KEY[k]) : k.replace(/_/g, " "));

const FREQ_KEY: Record<string, MessageKey> = { weekly: "mobileProp.payoutFreq.weekly", "bi-weekly": "mobileProp.payoutFreq.biWeekly", monthly: "mobileProp.payoutFreq.monthly", "on-demand": "mobileProp.payoutFreq.onDemand" };
export const payoutFreqLabel = (t: T, f: string) => (FREQ_KEY[f] ? t(FREQ_KEY[f]) : f);

const RULE_KEY: Record<string, MessageKey> = {
  daily_loss: "mobileProp.rule.dailyLoss",
  max_drawdown: "mobileProp.rule.maxDrawdown",
  profit_target: "mobileProp.rule.profitTarget",
  time_limit: "mobileProp.rule.timeLimit",
  weekend_holding: "mobileProp.rule.weekendHolding",
  news_window: "mobileProp.rule.newsWindow",
  banned_strategy: "mobileProp.rule.bannedStrategy",
  consistency: "mobileProp.rule.consistency",
  manual: "mobileProp.rule.riskDesk",
  override: "mobileProp.rule.riskDesk",
};
export const ruleLabel = (t: T, r: string) => (RULE_KEY[r] ? t(RULE_KEY[r]) : r.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()));

const BLOCKER_KEY: Record<string, MessageKey> = {
  not_yet_eligible: "mobileProp.blocker.notYetEligible",
  below_minimum: "mobileProp.blocker.belowMinimum",
  positions_open: "mobileProp.blocker.positionsOpen",
  payout_pending: "mobileProp.blocker.payoutPending",
  consistency: "mobileProp.blocker.consistency",
};
export const blockerText = (t: T, b: string) => (BLOCKER_KEY[b] ? t(BLOCKER_KEY[b]) : b.replace(/_/g, " "));

const STATUS_KEY: Record<ChallengeStatus, MessageKey> = {
  pending_payment: "mobileProp.status.pendingPayment",
  provisioning: "mobileProp.status.provisioning",
  active: "mobileProp.status.active",
  funded: "mobileProp.status.funded",
  failed: "mobileProp.status.failed",
  closed: "mobileProp.status.closed",
  payment_failed: "mobileProp.status.paymentFailed",
};
export const statusLabel = (t: T, s: string) => (STATUS_KEY[s as ChallengeStatus] ? t(STATUS_KEY[s as ChallengeStatus]) : s);

/** Where a challenge stands: "Phase 2 · Active", "Funded", "Phase 1 · Failed". */
export function stageLabel(t: T, c: Challenge): string {
  const cur = c.current;
  if (c.status === "funded") return t("mobileProp.status.funded");
  if (c.status === "active" && cur) return t("mobileProp.stage.active", { phase: cur.phase });
  if (c.status === "failed" && cur) return t("mobileProp.stage.failed", { phase: cur.phase });
  return statusLabel(t, c.status);
}

const PHASE_STATUS_KEY: Record<string, MessageKey> = {
  provisioning: "mobileProp.phaseStatus.provisioning",
  active: "mobileProp.phaseStatus.active",
  passed: "mobileProp.phaseStatus.passed",
  failed: "mobileProp.phaseStatus.failed",
  closed: "mobileProp.phaseStatus.closed",
};
export const phaseStatusLabel = (t: T, s: string) => (PHASE_STATUS_KEY[s] ? t(PHASE_STATUS_KEY[s]) : s);

/** The colour block a challenge card uses: live challenges are ember, funded gold, opening periwinkle. */
export function challengeColor(c: Pick<Challenge, "status">): BlockColor | null {
  if (c.status === "active") return "ember";
  if (c.status === "funded") return "gold";
  if (c.status === "provisioning" || c.status === "pending_payment") return "periwinkle";
  return null;
}

/* ------------------------------------------------------------------ */
/* Plan rules (checkout)                                               */
/* ------------------------------------------------------------------ */

const days = (t: T, n: number) => t("mobileProp.days", { count: n });

export function ddText(t: T, p: Plan): string {
  const base = t(p.ddType === "trailing" ? "mobileProp.rules.ddTrailing" : "mobileProp.rules.ddStatic", { pct: p.maxDD });
  return p.ddType === "trailing" && p.trailingLock ? t("mobileProp.rules.ddLocks", { dd: base }) : base;
}

/** Every rule of a plan at one size, as label / value rows (the checkout and the rules sheet). */
export function planRules(t: T, p: Plan, s: Pick<PlanSize, "size" | "leverage">): [string, string][] {
  const rows: [string, string][] = [];
  for (const ph of p.phases) {
    rows.push([t("mobileProp.rules.phaseTarget", { phase: ph.name }), `${ph.target}% · ${usd((s.size * ph.target) / 100, 0)}`]);
    rows.push([t("mobileProp.rules.phaseMinDays", { phase: ph.name }), days(t, ph.minDays)]);
    rows.push([t("mobileProp.rules.phaseTimeLimit", { phase: ph.name }), ph.timeLimit ? days(t, ph.timeLimit) : t("mobileProp.noTimeLimit")]);
  }
  if (!p.phases.length) rows.push([t("mobileProp.rules.evaluation"), t("mobileProp.rules.evaluationNone")]);
  rows.push([t("mobileProp.rules.dailyLoss"), t(p.dailyBasis === "equity" ? "mobileProp.rules.dailyLossEquity" : "mobileProp.rules.dailyLossBalance", { pct: p.dailyLoss, amount: usd((s.size * p.dailyLoss) / 100, 0) })]);
  rows.push([t("mobileProp.rule.maxDrawdown"), `${ddText(t, p)} · ${usd((s.size * p.maxDD) / 100, 0)}`]);
  rows.push([t("mobileProp.rule.consistency"), p.consistency > 0 ? t("mobileProp.rules.consistencyValue", { pct: p.consistency }) : t("mobileProp.none")]);
  rows.push([t("mobileProp.rules.news"), p.newsTrading ? t("mobileProp.allowed") : t(p.newsBreachFails ? "mobileProp.rules.newsBlockedFails" : "mobileProp.rules.newsBlocked", { min: p.newsWindow })]);
  rows.push([t("mobileProp.rule.weekendHolding"), p.weekendHolding ? t("mobileProp.allowed") : t("mobileProp.rules.weekendClosed")]);
  rows.push([t("mobileProp.rules.ea"), p.eaAllowed ? t("mobileProp.allowed") : t("mobileProp.notAllowed")]);
  rows.push([t("mobileProp.rules.banned"), p.banned.length ? p.banned.map((b) => bannedLabel(t, b)).join(", ") : t("mobileProp.none")]);
  rows.push([t("mobileProp.profitSplit"), p.splitMax > p.split ? t("mobileProp.rules.splitScaling", { split: p.split, max: p.splitMax }) : `${p.split}%`]);
  rows.push([t("mobileProp.rules.firstPayout"), t("mobileProp.rules.firstPayoutValue", { days: days(t, p.firstPayoutDays), freq: payoutFreqLabel(t, p.payoutFreq), min: usd(p.minPayout, 0) })]);
  rows.push([t("mobileProp.feeRefund"), p.refundFee ? t("mobileProp.rules.refunded") : t("mobileProp.nonRefundable")]);
  rows.push([t("mobileProp.leverage"), `1:${s.leverage}`]);
  return rows;
}

/** "8% / 5%" or "None" (instant plans). */
export const targetsText = (t: T, p: Plan) => (p.phases.length ? p.phases.map((x) => `${x.target}%`).join(" / ") : t("mobileProp.none"));

/** Cheapest fee of a plan ("From $49"). */
export const fromFee = (p: Plan) => feeLabel(Math.min(...p.sizes.map((s) => s.fee)));
