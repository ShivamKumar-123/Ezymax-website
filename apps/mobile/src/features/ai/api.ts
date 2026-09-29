// AI Trader's server calls: the algo service through the Client Area BFF (/api/mobile/algo/* rewrites to the same
// /api/algo/* routes the web Client Area uses, so the same checks run: session user, module switch, view-only and
// staff read-only sessions, the AI hourly limit, strategy / backtest / deployment limits). Shapes follow
// services/algo/README.md ("Internal API"). Nothing here is optimistic: every change shows the server's answer.
import { apiGet, apiPost, type ApiResult } from "@/lib/api";
import { prefetch, useQuery } from "@/lib/query";

/* ---- strategy spec (visual builder schema, services/algo/src/spec.rs) ---- */

export type OperandKind = "price" | "indicator" | "value" | "candle";
export interface Operand {
  kind: OperandKind;
  field: string;
  indicator: string;
  period: number;
  period2: number;
  period3: number;
  mult: number;
  value: number;
  pattern: string;
}
export interface Condition {
  left: Operand;
  op: string;
  right: Operand;
  timeframe: string;
}
export interface RuleGroup {
  logic: "all" | "any";
  conditions: Condition[];
}
export interface RuleSet {
  logic: "all" | "any";
  groups: RuleGroup[];
}
export interface Distance {
  mode: string;
  value: number;
  atrPeriod: number;
}
export interface Trailing {
  mode: string;
  value: number;
  atrPeriod: number;
  breakevenTrigger: number;
  breakevenOffset: number;
}
export interface StrategySpec {
  name: string;
  symbol: string;
  timeframe: string;
  long: RuleSet;
  short: RuleSet;
  exitLong: RuleSet;
  exitShort: RuleSet;
  exitIntrabar: boolean;
  sizing: { mode: "lots" | "risk"; lots: number; riskPct: number };
  maxLots: number;
  sl: Distance;
  tp: Distance;
  trailing: Trailing;
  sessions: { start: string; end: string }[];
  days: number[];
  closeOutsideSession: boolean;
  maxTradesPerDay: number;
  maxDailyLoss: number;
  oneAtATime: boolean;
}

export type SignalKey = "buy" | "sell" | "exit_buy" | "exit_sell";

/** A validated strategy (`POST validate`, the AI's `result`). */
export interface Built {
  kind: "visual" | "code";
  valid: boolean;
  errors: { line?: number; col?: number; message: string }[];
  warnings: string[];
  spec: StrategySpec;
  code: string;
  source: string | null;
  timeframes: string[];
  lookback: number;
  summary: Partial<Record<SignalKey, string>>;
}

export interface AiReply {
  configured: boolean;
  model: string;
  target: "visual" | "code";
  status: "ok" | "needs_clarification";
  questions: string[];
  assumptions: string[];
  result: Built;
}

export interface MetaSymbol {
  symbol: string;
  assetClass: string;
  digits: number;
  point: number;
  pipSize: number;
  lotMin: number;
  lotMax: number;
  lotStep: number;
}
export interface Meta {
  symbols: MetaSymbol[];
  timeframes: string[];
  distanceModes: string[];
  trailModes: string[];
  ai: { configured: boolean; model: string };
}

export interface Saved {
  id: number;
  versionId: number;
  version: number;
  name?: string;
  valid: boolean;
}

export interface BacktestSummary {
  netProfit: number;
  returnPct: number;
  trades: number;
  winRate: number;
  profitFactor: number | null;
  maxDrawdownPct: number;
  sharpe: number | null;
  symbol: string;
  timeframe: string;
  firstBar: number | null;
  lastBar: number | null;
}
export type BacktestStatus = "queued" | "running" | "done" | "failed" | "cancelled";
export interface BacktestDetail {
  id: number;
  strategyId: number;
  versionId: number;
  version: number;
  params: { from: number; to: number; initialBalance: number; symbol: string; timeframe: string; login?: number };
  status: BacktestStatus;
  progress: number;
  stage: string | null;
  summary: BacktestSummary | null;
  error: string | null;
  report: { equity: { t: number; equity: number }[]; notes: string[] } | null;
}

export interface Deployment {
  id: number;
  strategyId: number;
  versionId: number;
  version: number;
  login: number;
  accountType: "demo" | "live";
  status: "running" | "paused" | "stopped" | "killed" | "error";
}

/* ---- calls ---- */

export const META_KEY = "algo/meta";
export const fetchMeta = () => apiGet<Meta>("algo/meta", { timeoutMs: 15_000 });

/** The builder catalogue (symbols with lot steps, timeframes) and whether the AI is configured. */
export function useMeta() {
  return useQuery(META_KEY, fetchMeta, { persist: true, staleMs: 60 * 60_000 });
}

/** Warm /ai before it opens (a menu row's press-in): the catalogue and whether the assistant is on. */
export function prefetchAi() {
  prefetch(META_KEY, fetchMeta, { persist: true, staleMs: 60 * 60_000 });
}

/** Natural language -> a validated visual strategy. Claude can take a minute: the BFF allows 240 s. */
export function draftStrategy(body: { prompt: string; symbol: string; timeframe: string; current?: StrategySpec }, signal?: AbortSignal): Promise<ApiResult<AiReply>> {
  return apiPost<AiReply>("algo/ai/strategy", { ...body, target: "visual" }, { timeoutMs: 240_000, signal });
}

export const validateSpec = (spec: StrategySpec) => apiPost<Built>("algo/validate", { kind: "visual", spec });

export const createStrategy = (body: { spec: StrategySpec; name: string; prompt?: string }) => apiPost<Saved>("algo/strategies", { kind: "visual", origin: "ai", ...body }, { timeoutMs: 30_000 });

export const saveVersion = (id: number, body: { spec: StrategySpec; name: string; prompt?: string; note?: string }) => apiPost<Saved>(`algo/strategies/${id}/versions`, { kind: "visual", ...body }, { timeoutMs: 30_000 });

export const startBacktest = (body: { strategyId: number; versionId: number; from: number; to: number; initialBalance: number; login?: number }) =>
  apiPost<{ id: number; status: BacktestStatus }>("algo/backtests", body, { timeoutMs: 30_000 });

export const fetchBacktest = (id: number) => apiGet<BacktestDetail>(`algo/backtests/${id}`, { timeoutMs: 30_000 });

export const cancelBacktest = (id: number) => apiPost<{ status: string }>(`algo/backtests/${id}/cancel`, {});

export type RiskLimits = { lotMultiplier?: number; maxOpenPositions?: number; maxDailyLoss?: number };
export const deployStrategy = (body: { strategyId: number; versionId: number; login: number; risk: RiskLimits }) => apiPost<{ id: number; status: string }>("algo/deployments", body, { timeoutMs: 30_000 });
