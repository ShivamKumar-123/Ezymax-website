// Shapes of the prop service (services/prop/README.md), as the Client Area BFF returns them to the app through
// /api/mobile/prop/* (the same handlers as the web's /api/prop/*). Money is a JSON number.

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

/** The live rule dashboard of a phase account, from the prop evaluator's last look (about once a second). */
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

export type CertificateKind = "pass" | "funded" | "payout";

export interface Certificate {
  code: string;
  kind: CertificateKind;
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

export type PayoutStatus = "pending" | "approved" | "paid" | "rejected" | "failed";

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
  status: PayoutStatus;
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

export interface PayoutsData {
  payouts: Payout[];
  funded: FundedAccount[];
  kycStatus: string;
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
