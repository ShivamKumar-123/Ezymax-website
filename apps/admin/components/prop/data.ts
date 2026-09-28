/**
 * Back-office mock data for the Prop Firm module: plan catalogue, live
 * challenges with rule state, funded (simulated) accounts, payout requests
 * and detected violations with banned-strategy evidence.
 *
 * Everything is generated with a seeded PRNG so server and client renders
 * are identical. "Today" is 2026-09-24, server time GMT+3.
 */
import { PEOPLE, seeded, hashString, type Person } from "@kalks/mock";

/* ------------------------------------------------------------------ */
/* Time helpers                                                         */
/* ------------------------------------------------------------------ */

export const TODAY = Date.UTC(2026, 8, 24, 14, 30) / 1000; // unix seconds
const DAY = 86400;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "24 Sep 2026" — deterministic, no locale dependency. */
export function fmtDate(ts: number, withYear = true) {
  const d = new Date(ts * 1000);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}${withYear ? ` ${d.getUTCFullYear()}` : ""}`;
}
/** "24 Sep, 14:32" */
export function fmtDateTime(ts: number) {
  const d = new Date(ts * 1000);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
export function fmtAgo(ts: number) {
  const s = TODAY - ts;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < DAY) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / DAY)}d ago`;
}
export const usdK = (v: number) => (v >= 1000 ? `$${(v / 1000).toLocaleString("en-US", { maximumFractionDigits: 0 })}K` : `$${v}`);

/* ------------------------------------------------------------------ */
/* Plans                                                                */
/* ------------------------------------------------------------------ */

export type PlanType = "1-step" | "2-step" | "instant";
export type PlanStatus = "active" | "draft" | "paused";
export const PLAN_SIZES = [5000, 10000, 25000, 50000, 100000, 200000] as const;

export const BANNED_STRATEGIES = [
  "HFT",
  "Latency arbitrage",
  "Tick scalping",
  "Martingale",
  "Grid trading",
  "Copy-trading between accounts",
  "Hedging across accounts",
  "Reverse arbitrage",
  "Account management / pass service",
] as const;

export interface PlanSizeRow {
  size: number;
  fee: number;
  leverage: number; // 1:x
  enabled: boolean;
}
export interface PlanPhase {
  name: string;
  target: number; // % profit target
  minDays: number;
  timeLimit: number; // days, 0 = unlimited
}
export interface PropPlan {
  id: string;
  name: string;
  type: PlanType;
  status: PlanStatus;
  version: number;
  updated: string;
  sizes: PlanSizeRow[];
  phases: PlanPhase[];
  dailyLoss: number;
  dailyBasis: "balance" | "equity";
  maxDD: number;
  ddType: "static" | "trailing";
  consistency: number; // max share of total profit from one day, 0 = off
  newsTrading: boolean;
  newsWindow: number; // minutes around red-folder news
  weekendHolding: boolean;
  eaAllowed: boolean;
  banned: string[];
  split: number;
  splitMax: number;
  scalingEvery: number; // months
  scalingIncrease: number; // % balance increase
  scalingProfit: number; // % profit required
  scalingCap: number; // max balance
  refundFee: boolean;
  payoutFreq: "weekly" | "bi-weekly" | "monthly" | "on-demand";
  firstPayoutDays: number;
  minPayout: number;
  // stats
  active: number;
  sold30d: number;
  passRate: number;
  revenue30d: number;
  trend: number[];
}

const sizesFor = (fees: number[], lev: number, disabled: number[] = []): PlanSizeRow[] =>
  PLAN_SIZES.map((size, i) => ({ size, fee: fees[i], leverage: lev, enabled: !disabled.includes(size) }));

export const PLANS: PropPlan[] = [
  {
    id: "classic-2",
    name: "Kalks Classic 2-Step",
    type: "2-step",
    status: "active",
    version: 7,
    updated: "18 Sep 2026",
    sizes: sizesFor([49, 89, 189, 299, 499, 979], 100),
    phases: [
      { name: "Phase 1", target: 8, minDays: 4, timeLimit: 0 },
      { name: "Phase 2", target: 5, minDays: 4, timeLimit: 0 },
    ],
    dailyLoss: 5,
    dailyBasis: "balance",
    maxDD: 10,
    ddType: "static",
    consistency: 0,
    newsTrading: true,
    newsWindow: 2,
    weekendHolding: true,
    eaAllowed: true,
    banned: ["HFT", "Latency arbitrage", "Tick scalping", "Copy-trading between accounts", "Hedging across accounts"],
    split: 80,
    splitMax: 90,
    scalingEvery: 4,
    scalingIncrease: 25,
    scalingProfit: 10,
    scalingCap: 2000000,
    refundFee: true,
    payoutFreq: "bi-weekly",
    firstPayoutDays: 14,
    minPayout: 100,
    active: 1184,
    sold30d: 642,
    passRate: 11.8,
    revenue30d: 168420,
    trend: [42, 48, 45, 51, 58, 55, 61, 66, 63, 70, 74, 79],
  },
  {
    id: "rapid-1",
    name: "Kalks Rapid 1-Step",
    type: "1-step",
    status: "active",
    version: 4,
    updated: "02 Sep 2026",
    sizes: sizesFor([59, 99, 199, 319, 549, 1049], 50),
    phases: [{ name: "Evaluation", target: 10, minDays: 3, timeLimit: 0 }],
    dailyLoss: 3,
    dailyBasis: "equity",
    maxDD: 6,
    ddType: "trailing",
    consistency: 40,
    newsTrading: false,
    newsWindow: 5,
    weekendHolding: false,
    eaAllowed: true,
    banned: ["HFT", "Latency arbitrage", "Tick scalping", "Martingale", "Grid trading", "Copy-trading between accounts", "Hedging across accounts"],
    split: 80,
    splitMax: 90,
    scalingEvery: 4,
    scalingIncrease: 25,
    scalingProfit: 10,
    scalingCap: 1000000,
    refundFee: true,
    payoutFreq: "bi-weekly",
    firstPayoutDays: 14,
    minPayout: 100,
    active: 736,
    sold30d: 418,
    passRate: 9.4,
    revenue30d: 121960,
    trend: [20, 22, 27, 25, 31, 35, 34, 38, 44, 41, 47, 52],
  },
  {
    id: "instant",
    name: "Kalks Instant Funding",
    type: "instant",
    status: "active",
    version: 3,
    updated: "27 Aug 2026",
    sizes: sizesFor([129, 229, 449, 749, 1349, 2499], 30, [200000]),
    phases: [],
    dailyLoss: 3,
    dailyBasis: "equity",
    maxDD: 6,
    ddType: "trailing",
    consistency: 30,
    newsTrading: false,
    newsWindow: 5,
    weekendHolding: false,
    eaAllowed: false,
    banned: ["HFT", "Latency arbitrage", "Tick scalping", "Martingale", "Grid trading", "Copy-trading between accounts", "Hedging across accounts", "Reverse arbitrage"],
    split: 70,
    splitMax: 85,
    scalingEvery: 3,
    scalingIncrease: 20,
    scalingProfit: 8,
    scalingCap: 500000,
    refundFee: false,
    payoutFreq: "weekly",
    firstPayoutDays: 7,
    minPayout: 50,
    active: 212,
    sold30d: 96,
    passRate: 0,
    revenue30d: 64180,
    trend: [8, 9, 11, 10, 12, 14, 13, 15, 17, 16, 19, 21],
  },
  {
    id: "swing-2",
    name: "Kalks Swing 2-Step",
    type: "2-step",
    status: "draft",
    version: 1,
    updated: "23 Sep 2026",
    sizes: sizesFor([69, 119, 239, 369, 599, 1149], 30, [5000]),
    phases: [
      { name: "Phase 1", target: 10, minDays: 5, timeLimit: 60 },
      { name: "Phase 2", target: 5, minDays: 5, timeLimit: 60 },
    ],
    dailyLoss: 5,
    dailyBasis: "balance",
    maxDD: 12,
    ddType: "static",
    consistency: 0,
    newsTrading: true,
    newsWindow: 0,
    weekendHolding: true,
    eaAllowed: true,
    banned: ["HFT", "Latency arbitrage", "Copy-trading between accounts"],
    split: 75,
    splitMax: 90,
    scalingEvery: 4,
    scalingIncrease: 25,
    scalingProfit: 10,
    scalingCap: 2000000,
    refundFee: true,
    payoutFreq: "monthly",
    firstPayoutDays: 30,
    minPayout: 100,
    active: 0,
    sold30d: 0,
    passRate: 0,
    revenue30d: 0,
    trend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
];

export const planById = (id: string) => PLANS.find((p) => p.id === id) ?? PLANS[0];

/* ------------------------------------------------------------------ */
/* Challenges                                                           */
/* ------------------------------------------------------------------ */

export type RuleState = "ok" | "warn" | "breach" | "pending" | "off";
export type ChallengeStatus = "active" | "passed" | "breached" | "expired";

export interface RuleCheck {
  key: "daily" | "maxdd" | "days" | "consistency";
  label: string;
  state: RuleState;
  used: number; // % of limit used (0–100+), for min days: % complete
  detail: string;
}

export interface Challenge {
  id: string;
  login: string;
  trader: Person;
  planId: string;
  planName: string;
  planType: PlanType;
  size: number;
  phase: string;
  phaseIndex: number;
  day: number;
  limit: number; // 0 = unlimited
  tradingDays: number;
  minDays: number;
  profitPct: number;
  targetPct: number;
  balance: number;
  equity: number;
  dailyLossLimit: number; // $
  dailyLossUsed: number; // $ today
  maxDDLimit: number; // $
  ddUsed: number; // $ from peak/initial
  bestDayShare: number; // %
  consistencyLimit: number; // % (0 = off)
  status: ChallengeStatus;
  started: number;
  trades: number;
  winRate: number;
  lots: number;
  server: string;
  ip: string;
}

function ruleState(used: number, warnAt = 70): RuleState {
  return used >= 100 ? "breach" : used >= warnAt ? "warn" : "ok";
}

export function challengeRules(c: Challenge): RuleCheck[] {
  const dUsed = (c.dailyLossUsed / c.dailyLossLimit) * 100;
  const ddUsed = (c.ddUsed / c.maxDDLimit) * 100;
  const daysPct = (c.tradingDays / Math.max(1, c.minDays)) * 100;
  const out: RuleCheck[] = [
    { key: "daily", label: "Daily loss", state: ruleState(dUsed), used: dUsed, detail: `$${Math.round(c.dailyLossUsed).toLocaleString()} of $${c.dailyLossLimit.toLocaleString()} used today` },
    { key: "maxdd", label: "Max drawdown", state: ruleState(ddUsed), used: ddUsed, detail: `$${Math.round(c.ddUsed).toLocaleString()} of $${c.maxDDLimit.toLocaleString()} drawdown` },
    { key: "days", label: "Min trading days", state: daysPct >= 100 ? "ok" : "pending", used: Math.min(100, daysPct), detail: `${c.tradingDays} of ${c.minDays} days traded` },
  ];
  if (c.consistencyLimit > 0) {
    const cu = (c.bestDayShare / c.consistencyLimit) * 100;
    out.push({ key: "consistency", label: "Consistency", state: cu > 100 ? "warn" : cu >= 85 ? "warn" : "ok", used: cu, detail: `Best day = ${c.bestDayShare.toFixed(1)}% of profit (limit ${c.consistencyLimit}%)` });
  } else {
    out.push({ key: "consistency", label: "Consistency", state: "off", used: 0, detail: "Not enforced on this plan" });
  }
  return out;
}

const SERVERS = ["Kalks-Prop01", "Kalks-Prop02", "Kalks-Prop01"];

export const CHALLENGES: Challenge[] = (() => {
  const r = seeded(4411);
  const evalPlans = PLANS.filter((p) => p.type !== "instant" && p.status === "active");
  const statuses: ChallengeStatus[] = [];
  for (let i = 0; i < 54; i++) statuses.push(i % 9 === 3 ? "breached" : i % 13 === 7 ? "passed" : i % 17 === 11 ? "expired" : i % 11 === 5 ? "breached" : "active");
  return statuses.map((status, i) => {
    const plan = evalPlans[i % 3 === 2 ? 1 : 0];
    const trader = PEOPLE[(i * 7 + 3) % PEOPLE.length];
    const size = r.pick([10000, 25000, 50000, 50000, 100000, 100000, 200000, 25000, 5000]);
    const phaseIndex = plan.phases.length > 1 && r.bool(0.38) ? 1 : 0;
    const phase = plan.phases[phaseIndex];
    const limit = r.bool(0.3) ? 30 : phase.timeLimit;
    const day = status === "expired" ? 30 : r.int(1, 28);
    const minDays = phase.minDays;
    const tradingDays = Math.min(day, r.int(Math.max(0, day - 8), day));
    const dailyLossLimit = Math.round((size * plan.dailyLoss) / 100);
    const maxDDLimit = Math.round((size * plan.maxDD) / 100);
    let profitPct: number;
    let dailyUsedPct: number;
    let ddUsedPct: number;
    if (status === "passed") {
      profitPct = phase.target + r.range(0.1, 1.6);
      dailyUsedPct = r.range(0, 30);
      ddUsedPct = r.range(5, 40);
    } else if (status === "breached") {
      const byDaily = r.bool(0.55);
      profitPct = r.range(-plan.maxDD, 2);
      dailyUsedPct = byDaily ? r.range(100, 118) : r.range(20, 80);
      ddUsedPct = byDaily ? r.range(40, 92) : r.range(100, 112);
      profitPct = byDaily ? profitPct : -plan.maxDD - r.range(0, 1);
    } else if (status === "expired") {
      profitPct = r.range(-3, phase.target - 1);
      dailyUsedPct = 0;
      ddUsedPct = r.range(10, 60);
    } else {
      profitPct = r.range(-4.5, phase.target - 0.2);
      dailyUsedPct = r.bool(0.18) ? r.range(70, 96) : r.range(0, 55);
      ddUsedPct = Math.max(r.range(4, 18), Math.min(97, (-profitPct / plan.maxDD) * 100 + r.range(5, 35)));
    }
    const balance = size * (1 + profitPct / 100);
    const equity = balance + (status === "active" ? r.range(-0.006, 0.006) * size : 0);
    const bestDayShare = plan.consistency ? r.range(18, 52) : r.range(15, 60);
    const login = String(70412000 + r.int(1000, 98999));
    return {
      id: `CH-${(284100 + i * 37).toString()}`,
      login,
      trader,
      planId: plan.id,
      planName: plan.name,
      planType: plan.type,
      size,
      phase: plan.type === "1-step" ? "Evaluation" : phase.name,
      phaseIndex,
      day,
      limit,
      tradingDays,
      minDays,
      profitPct,
      targetPct: phase.target,
      balance,
      equity,
      dailyLossLimit,
      dailyLossUsed: (dailyUsedPct / 100) * dailyLossLimit,
      maxDDLimit,
      ddUsed: (ddUsedPct / 100) * maxDDLimit,
      bestDayShare,
      consistencyLimit: plan.consistency,
      status,
      started: TODAY - day * DAY - r.int(0, 20000),
      trades: r.int(day * 2, day * 9 + 6),
      winRate: r.range(38, 71),
      lots: +r.range(day * 0.8, day * 6).toFixed(2),
      server: SERVERS[i % 3],
      ip: `${r.int(31, 212)}.${r.int(10, 250)}.${r.int(1, 250)}.${r.int(2, 250)}`,
    } satisfies Challenge;
  });
})();

/** Daily equity path from start to the current equity, deterministic per login. */
export function equityPath(login: string, start: number, end: number, days: number, startTs: number) {
  const r = seeded(hashString(login));
  const n = Math.max(6, days);
  const pts: { time: number; value: number; volume: number }[] = [];
  const walk = [0];
  for (let i = 1; i <= n; i++) walk.push(walk[i - 1] + r.normal() * start * 0.0055);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const v = start + walk[i] - t * walk[n] + t * (end - start);
    pts.push({ time: startTs + i * DAY, value: +v.toFixed(2), volume: r.range(0.2, 1) * start * 0.01 });
  }
  return pts;
}

/* ------------------------------------------------------------------ */
/* Funded traders                                                       */
/* ------------------------------------------------------------------ */

export interface FundedAccount {
  id: string;
  login: string;
  trader: Person;
  planId: string;
  planName: string;
  size: number;
  initialSize: number;
  split: number;
  profit: number; // current cycle, $
  profitPct: number;
  eligibleOn: number; // ts
  scalingLevel: number; // 0..4
  nextScaleOn: number;
  consistency: number; // 0..100 score
  payouts: number;
  paidTotal: number;
  ddUsedPct: number;
  status: "active" | "paused" | "review";
  fundedOn: number;
  kyc: boolean;
}

export const FUNDED: FundedAccount[] = (() => {
  const r = seeded(9021);
  return Array.from({ length: 28 }, (_, i) => {
    const plan = PLANS[i % 5 === 4 ? 2 : i % 3 === 1 ? 1 : 0];
    const trader = PEOPLE[(i * 5 + 1) % PEOPLE.length];
    const initialSize = r.pick([25000, 50000, 100000, 100000, 200000, 50000]);
    const scalingLevel = r.pick([0, 0, 0, 1, 1, 2, 3]);
    const size = Math.round(initialSize * Math.pow(1 + plan.scalingIncrease / 100, scalingLevel));
    const profitPct = r.range(-2.4, 7.8);
    const payouts = scalingLevel * 3 + r.int(0, 4);
    const split = Math.min(plan.splitMax, plan.split + scalingLevel * 5 + (r.bool(0.2) ? 5 : 0));
    const fundedOn = TODAY - (scalingLevel * 120 + r.int(10, 110)) * DAY;
    return {
      id: `FA-${51200 + i * 13}`,
      login: String(90500000 + r.int(10000, 99999)),
      trader,
      planId: plan.id,
      planName: plan.name,
      size,
      initialSize,
      split,
      profit: (profitPct / 100) * size,
      profitPct,
      eligibleOn: TODAY + r.int(-4, 13) * DAY,
      scalingLevel,
      nextScaleOn: TODAY + r.int(6, 110) * DAY,
      consistency: Math.round(r.range(42, 97)),
      payouts,
      paidTotal: payouts * r.range(900, 4200) * (size / 100000),
      ddUsedPct: Math.max(4, Math.min(92, -profitPct * 9 + r.range(10, 40))),
      status: i % 11 === 6 ? "review" : i % 13 === 9 ? "paused" : "active",
      fundedOn,
      kyc: i % 9 !== 7,
    } satisfies FundedAccount;
  });
})();

/* ------------------------------------------------------------------ */
/* Payouts                                                              */
/* ------------------------------------------------------------------ */

export interface PayoutCheck {
  key: "consistency" | "minDays" | "violations" | "kyc" | "ip";
  label: string;
  pass: boolean;
  detail: string;
}
export interface PayoutRequest {
  id: string;
  account: FundedAccount;
  requested: number;
  profit: number;
  split: number;
  traderShare: number;
  firmShare: number;
  refund: number;
  method: "USDT TRC20" | "Bank wire" | "Rise";
  address: string;
  checks: PayoutCheck[];
  status: "pending" | "review" | "approved" | "rejected" | "completed" | "processing";
  cycle: number;
  decidedBy?: string;
  decidedAt?: number;
  hash?: string;
}

const HEX = "0123456789abcdef";
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export const PAYOUTS: PayoutRequest[] = (() => {
  const r = seeded(7788);
  const staff = ["Nadia Karim", "Marco Bellini", "Sara Idris"];
  return Array.from({ length: 42 }, (_, i) => {
    const acct = FUNDED[(i * 3 + 2) % FUNDED.length];
    const pending = i < 16;
    const profit = Math.round(acct.size * r.range(0.018, 0.071));
    const split = acct.split;
    const plan = planById(acct.planId);
    const first = acct.payouts === 0 || (pending && i % 5 === 0);
    const sizeRow = plan.sizes.find((s) => s.size === acct.initialSize);
    const refund = first && plan.refundFee ? (sizeRow?.fee ?? 0) : 0;
    const traderShare = (profit * split) / 100;
    const consistencyOk = !(pending && (i === 3 || i === 11));
    const violationsOk = !(pending && i === 7);
    const kycOk = pending ? i !== 9 : true;
    const ipOk = !(pending && i === 13);
    const checks: PayoutCheck[] = [
      { key: "consistency", label: "Consistency", pass: consistencyOk, detail: consistencyOk ? `Best day ${r.int(14, 34)}% of cycle profit (limit ${plan.consistency || 40}%)` : `Best day ${r.int(46, 71)}% of cycle profit (limit ${plan.consistency || 40}%)` },
      { key: "minDays", label: "Min trading days", pass: true, detail: `${r.int(6, 14)} of 4 required days` },
      { key: "violations", label: "No violations", pass: violationsOk, detail: violationsOk ? "No open flags this cycle" : "Open flag: news trading (NFP, 5 Sep)" },
      { key: "kyc", label: "KYC verified", pass: kycOk, detail: kycOk ? "Level 2 · POI + POA approved" : "POA expired 14 Sep 2026" },
      { key: "ip", label: "IP / device", pass: ipOk, detail: ipOk ? "Single device, consistent geo" : "Login from 2 countries in 24h" },
    ];
    const status: PayoutRequest["status"] = pending ? (checks.every((c) => c.pass) ? "pending" : "review") : r.pick(["completed", "completed", "completed", "approved", "processing", "rejected"] as const);
    let address = "T";
    for (let k = 0; k < 33; k++) address += B58[r.int(0, B58.length - 1)];
    let hash = "";
    for (let k = 0; k < 64; k++) hash += HEX[r.int(0, 15)];
    const method: PayoutRequest["method"] = r.bool(0.7) ? "USDT TRC20" : r.bool(0.5) ? "Rise" : "Bank wire";
    return {
      id: `PO-${38120 + i * 7}`,
      account: acct,
      requested: pending ? TODAY - r.int(600, 3 * DAY) : TODAY - r.int(2 * DAY, 60 * DAY),
      profit,
      split,
      traderShare,
      firmShare: profit - traderShare,
      refund,
      method,
      address: method === "USDT TRC20" ? address : method === "Rise" ? `rise-${acct.login}` : "GB29 NWBK 6016 1331 9268 19",
      checks,
      status,
      cycle: acct.payouts + 1,
      decidedBy: pending ? undefined : r.pick(staff),
      decidedAt: pending ? undefined : TODAY - r.int(DAY, 55 * DAY),
      hash: !pending && status === "completed" && method === "USDT TRC20" ? hash : undefined,
    } satisfies PayoutRequest;
  }).sort((a, b) => b.requested - a.requested);
})();

/* ------------------------------------------------------------------ */
/* Violations                                                           */
/* ------------------------------------------------------------------ */

export type ViolationType = "daily-loss" | "max-dd" | "consistency" | "news" | "weekend" | "hft" | "latency-arb" | "copy-accounts" | "hedge-accounts" | "martingale";
export const VIOLATION_LABEL: Record<ViolationType, string> = {
  "daily-loss": "Daily loss breach",
  "max-dd": "Max drawdown breach",
  consistency: "Consistency breach",
  news: "News trading",
  weekend: "Weekend holding",
  hft: "HFT",
  "latency-arb": "Latency arbitrage",
  "copy-accounts": "Copy across accounts",
  "hedge-accounts": "Hedging across accounts",
  martingale: "Martingale",
};
export const BANNED_TYPES: ViolationType[] = ["hft", "latency-arb", "copy-accounts", "hedge-accounts", "martingale"];

export interface Violation {
  id: string;
  type: ViolationType;
  severity: "critical" | "high" | "medium" | "low";
  trader: Person;
  login: string;
  accountKind: "Challenge" | "Funded";
  planName: string;
  size: number;
  detected: number;
  detail: string;
  metric: string;
  autoAction: "Account breached" | "Trading disabled" | "Payout held" | "Flagged for review" | "Trades voided" | "Warning sent";
  status: "open" | "confirmed" | "overturned";
  confidence: number;
}

const V_TEMPLATES: { type: ViolationType; severity: Violation["severity"]; detail: string; metric: string; action: Violation["autoAction"] }[] = [
  { type: "daily-loss", severity: "high", detail: "Equity fell to $47,412.80 vs daily floor $47,500.00 at 16:42:11", metric: "-5.17% day", action: "Account breached" },
  { type: "max-dd", severity: "high", detail: "Trailing drawdown floor $94,000.00 touched on XAUUSD spike", metric: "-6.02% DD", action: "Account breached" },
  { type: "hft", severity: "critical", detail: "212 trades held < 30s in 3 sessions, median hold 7.4s", metric: "212 trades < 30s", action: "Trading disabled" },
  { type: "latency-arb", severity: "critical", detail: "Fills cluster 180–420 ms after feed lag on EURUSD / GBPUSD", metric: "94% fills on stale quotes", action: "Trades voided" },
  { type: "copy-accounts", severity: "critical", detail: "38 matching tickets with 70412893 within 400 ms, shared IP", metric: "38 mirrored tickets", action: "Payout held" },
  { type: "consistency", severity: "medium", detail: "Single day (NFP) produced 58.4% of cycle profit", metric: "58.4% vs 40%", action: "Payout held" },
  { type: "news", severity: "medium", detail: "3 trades opened within 2 min of US CPI release (red folder)", metric: "3 trades · CPI", action: "Flagged for review" },
  { type: "weekend", severity: "low", detail: "XAUUSD 2.00 lots held through weekend close (Fri 23:59)", metric: "2.00 lots held", action: "Warning sent" },
  { type: "hedge-accounts", severity: "high", detail: "Opposite NAS100 positions on 2 accounts of same household", metric: "14 hedged pairs", action: "Flagged for review" },
  { type: "martingale", severity: "medium", detail: "Position size doubled after 6 consecutive losses on GBPJPY", metric: "x2 ladder · 6 steps", action: "Flagged for review" },
];

export const VIOLATIONS: Violation[] = (() => {
  const r = seeded(3301);
  return Array.from({ length: 36 }, (_, i) => {
    const t = V_TEMPLATES[i < 10 ? i : r.int(0, V_TEMPLATES.length - 1)];
    const trader = PEOPLE[(i * 11 + 2) % PEOPLE.length];
    const funded = r.bool(0.4);
    return {
      id: `VL-${60410 + i * 9}`,
      type: t.type,
      severity: t.severity,
      trader,
      login: funded ? String(90500000 + r.int(10000, 99999)) : String(70412000 + r.int(1000, 98999)),
      accountKind: funded ? "Funded" : "Challenge",
      planName: r.pick(["Kalks Classic 2-Step", "Kalks Rapid 1-Step", "Kalks Instant Funding"]),
      size: r.pick([25000, 50000, 100000, 100000, 200000]),
      detected: TODAY - (i < 10 ? i * 2400 + r.int(300, 2000) : r.int(DAY / 2, 14 * DAY)),
      detail: t.detail,
      metric: t.metric,
      autoAction: t.action,
      status: i < 14 ? "open" : r.bool(0.72) ? "confirmed" : "overturned",
      confidence: t.type === "daily-loss" || t.type === "max-dd" ? 100 : r.int(71, 98),
    } satisfies Violation;
  });
})();

/** HFT evidence: trade hold-time histogram. */
export const HFT_BUCKETS = [
  { label: "<5s", values: [64] },
  { label: "5–10s", values: [71] },
  { label: "10–20s", values: [49] },
  { label: "20–30s", values: [28] },
  { label: "30–60s", values: [9] },
  { label: "1–5m", values: [6] },
  { label: "5–30m", values: [3] },
  { label: ">30m", values: [2] },
];

/** Latency-arb evidence: per-trade feed lag (ms) vs P/L (pips). */
export const LATENCY_POINTS: { lag: number; pips: number; symbol: string }[] = (() => {
  const r = seeded(512);
  return Array.from({ length: 86 }, () => {
    const lag = r.bool(0.82) ? r.range(160, 440) : r.range(10, 160);
    const pips = lag > 160 ? r.range(0.4, 3.2) + (lag - 160) / 160 : r.range(-2.2, 1.2);
    return { lag, pips, symbol: r.pick(["EURUSD", "GBPUSD", "USDJPY", "XAUUSD"]) };
  });
})();

/** Copy-across-accounts evidence: matching ticket pairs. */
export const COPY_MATCHES: { symbol: string; side: "buy" | "sell"; lots: [number, number]; tickets: [string, string]; open: string; delta: number; ip: string }[] = (() => {
  const r = seeded(889);
  const syms = ["XAUUSD", "NAS100", "EURUSD", "GBPJPY", "US30"];
  return Array.from({ length: 9 }, (_, i) => {
    const lots = +r.range(0.5, 4).toFixed(2);
    const h = 9 + Math.floor(i / 2);
    const m = r.int(0, 59);
    const s = r.int(0, 59);
    return {
      symbol: r.pick(syms),
      side: r.bool() ? "buy" : "sell",
      lots: [lots, +(lots * r.pick([1, 1, 2, 0.5])).toFixed(2)],
      tickets: [String(48120400 + i * 311 + r.int(0, 90)), String(48120400 + i * 311 + r.int(91, 200))],
      open: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      delta: r.int(40, 390),
      ip: "185.203.72.14",
    };
  });
})();

/* ------------------------------------------------------------------ */
/* Overview                                                             */
/* ------------------------------------------------------------------ */

export const MONTHLY: { label: string; fees: number; payouts: number; sold: number }[] = (() => {
  const r = seeded(1207);
  const labels = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];
  return labels.map((label, i) => {
    const fees = Math.round(212000 + i * 17500 + r.range(-18000, 22000));
    const payouts = Math.round(fees * r.range(0.31, 0.46));
    return { label, fees, payouts, sold: Math.round(fees / 262) };
  });
})();

export const OVERVIEW = {
  activeChallenges: PLANS.reduce((s, p) => s + p.active, 0),
  passRate: 11.2,
  funded: 318,
  feesMonth: MONTHLY[11].fees,
  payoutsMonth: MONTHLY[11].payouts,
  feesYtd: MONTHLY.slice(3).reduce((s, m) => s + m.fees, 0),
  payoutsYtd: MONTHLY.slice(3).reduce((s, m) => s + m.payouts, 0),
  funnel: [
    { label: "Phase 1", value: 9864, sub: "Started · 90d" },
    { label: "Phase 2", value: 2417, sub: "Passed phase 1" },
    { label: "Funded", value: 1104, sub: "Passed evaluation" },
    { label: "1st payout", value: 486, sub: "Received payout" },
  ],
  breachReasons: [
    { label: "Daily loss", value: 46 },
    { label: "Max drawdown", value: 31 },
    { label: "Time limit", value: 9 },
    { label: "Consistency", value: 7 },
    { label: "Banned strategy", value: 4 },
    { label: "News / weekend", value: 3 },
  ],
};

export interface PropEvent {
  id: string;
  kind: "passed" | "breached" | "funded" | "payout";
  trader: Person;
  login: string;
  text: string;
  amount?: number;
  ts: number;
}

export const EVENTS: PropEvent[] = (() => {
  const r = seeded(6060);
  const kinds: PropEvent["kind"][] = ["passed", "breached", "funded", "passed", "payout", "breached", "passed", "funded", "breached", "payout"];
  return kinds.map((kind, i) => {
    const trader = PEOPLE[(i * 9 + 4) % PEOPLE.length];
    const size = r.pick([25000, 50000, 100000, 200000]);
    const text =
      kind === "passed"
        ? `Passed ${r.pick(["Phase 1", "Phase 2", "Evaluation"])} · ${usdK(size)} ${r.pick(["Classic 2-Step", "Rapid 1-Step"])}`
        : kind === "breached"
          ? `${r.pick(["Daily loss", "Max drawdown", "Daily loss"])} breach · ${usdK(size)}`
          : kind === "funded"
            ? `Funded account issued · ${usdK(size)}`
            : `Payout approved · ${r.pick([80, 85, 90])}% split`;
    return {
      id: `EV-${i}`,
      kind,
      trader,
      login: String(70412000 + r.int(1000, 98999)),
      text,
      amount: kind === "payout" ? Math.round(r.range(1200, 9800)) : kind === "passed" ? +(size * r.range(0.08, 0.11)).toFixed(2) : undefined,
      ts: TODAY - (i * 1900 + r.int(120, 1500)),
    };
  });
})();
