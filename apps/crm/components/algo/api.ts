"use client";

// Browser side of the ALGO BFF (app/api/algo/[...path]/route.ts). Shapes follow services/algo/README.md.

import * as React from "react";
import { toast } from "sonner";
import { tr } from "@kalks/i18n/react";

/* ------------------------------------------------------------------ */
/* Strategy spec (visual builder)                                      */
/* ------------------------------------------------------------------ */

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
  trailing: { mode: string; value: number; atrPeriod: number; breakevenTrigger: number; breakevenOffset: number };
  sessions: { start: string; end: string }[];
  days: number[];
  closeOutsideSession: boolean;
  maxTradesPerDay: number;
  maxDailyLoss: number;
  oneAtATime: boolean;
}

export const emptyRuleSet = (): RuleSet => ({ logic: "all", groups: [] });
export const operand = (p: Partial<Operand> & { kind: OperandKind }): Operand => ({ field: "close", indicator: "none", period: 0, period2: 0, period3: 0, mult: 0, value: 0, pattern: "none", ...p });

export function defaultSpec(symbol = "EURUSD", timeframe = "H1"): StrategySpec {
  return {
    name: tr("developer.spec.defaultName", { symbol, timeframe }),
    symbol,
    timeframe,
    long: emptyRuleSet(),
    short: emptyRuleSet(),
    exitLong: emptyRuleSet(),
    exitShort: emptyRuleSet(),
    exitIntrabar: false,
    sizing: { mode: "lots", lots: 0.1, riskPct: 1 },
    maxLots: 0.1,
    sl: { mode: "pips", value: 20, atrPeriod: 14 },
    tp: { mode: "rr", value: 2, atrPeriod: 14 },
    trailing: { mode: "none", value: 0, atrPeriod: 14, breakevenTrigger: 0, breakevenOffset: 0 },
    sessions: [],
    days: [],
    closeOutsideSession: false,
    maxTradesPerDay: 0,
    maxDailyLoss: 0,
    oneAtATime: true,
  };
}

/* ------------------------------------------------------------------ */
/* Service shapes                                                      */
/* ------------------------------------------------------------------ */

export interface MetaIndicator {
  key: string;
  label: string;
  description: string;
  period: number;
  period2: number;
  period3: number;
  mult: number;
  priceScale: boolean;
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
  session: string;
}
export interface Meta {
  symbols: MetaSymbol[];
  timeframes: string[];
  indicators: MetaIndicator[];
  priceFields: string[];
  patterns: string[];
  operators: string[];
  distanceModes: string[];
  trailModes: string[];
  dsl: { signals: string[]; functions: { syntax: string; text: string }[]; settings: { syntax: string; text: string }[]; limits: Record<string, number>; example: string };
  ai: { configured: boolean; model: string };
  publicUrl: string;
}

export interface BuildError {
  line?: number;
  col?: number;
  message: string;
}
export interface Built {
  kind: "visual" | "code";
  valid: boolean;
  errors: BuildError[];
  warnings: string[];
  spec: StrategySpec;
  code: string;
  source: string | null;
  timeframes: string[];
  lookback: number;
  summary: Partial<Record<"buy" | "sell" | "exit_buy" | "exit_sell", string>>;
}

export interface StrategyItem {
  id: number;
  name: string;
  symbol: string;
  timeframe: string;
  kind: "visual" | "code";
  origin: string;
  version: number;
  versionId: number;
  valid: boolean;
  running: number;
  listed: boolean;
  lastBacktest: BacktestSummary | null;
  summary: Built["summary"] | null;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyDetail {
  id: number;
  name: string;
  symbol: string;
  timeframe: string;
  kind: "visual" | "code";
  origin: string;
  status: string;
  latestVersion: number;
  current: Built & { id: number; version: number; note: string | null; prompt: string | null; createdAt: string };
  versions: { id: number; version: number; kind: string; valid: boolean; note: string | null; createdAt: string }[];
  deployments: Deployment[];
  backtests: BacktestRow[];
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

export interface BacktestRow {
  id: number;
  versionId: number;
  params: { from: number; to: number; initialBalance: number; symbol: string; timeframe: string; group?: string; login?: number; spreadPoints?: number };
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  progress: number;
  summary: BacktestSummary | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  strategyId?: number;
  strategyName?: string;
  version?: number;
}

export interface Trade {
  id: number;
  side: "buy" | "sell";
  volume: number;
  openTime: number;
  openPrice: number;
  closeTime: number;
  closePrice: number;
  sl: number | null;
  tp: number | null;
  profit: number;
  commission: number;
  swap: number;
  net: number;
  reason: string;
  bars: number;
  mae: number;
  mfe: number;
}

export interface Metrics {
  initialBalance: number;
  finalBalance: number;
  netProfit: number;
  returnPct: number;
  cagrPct: number | null;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  longTrades: number;
  longWinRate: number;
  shortTrades: number;
  shortWinRate: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  expectancy: number;
  payoffRatio: number | null;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  recoveryFactor: number | null;
  sharpe: number | null;
  sortino: number | null;
  avgBarsHeld: number;
  exposurePct: number;
  totalCommission: number;
  totalSwap: number;
  spreadCost: number;
  barsTested: number;
}

export interface Report {
  metrics: Metrics;
  equity: { t: number; balance: number; equity: number; dd: number }[];
  monthly: { year: number; months: (number | null)[]; total: number }[];
  trades: Trade[];
  tradesTruncated: boolean;
  signals: { buy: number; sell: number; exitBuy: number; exitSell: number };
  skipped: { reason: string; count: number }[];
  model: string;
  intrabarM1Bars: number;
  coverage: {
    requested: { from: number; to: number };
    segments: { tf: string; source: string; from: number; to: number }[];
    m1From: number | null;
    m1Bars: number;
    costs: { group: string; spread: number; spreadPoints: number; spreadSource: string; commissionPerLot: number; swaps: boolean; quoteToUsd: number; usdBase: boolean };
  };
  notes: string[];
  firstBar: number | null;
  lastBar: number | null;
}

export interface BacktestDetail extends BacktestRow {
  stage: string | null;
  cpuMs: number | null;
  report: Report | null;
}

export interface TradingAccount {
  login: number;
  type: "live" | "demo";
  group: string;
  groupName: string;
  mode: string;
  currency: string;
  balance: number;
  equity: number;
  status: string;
  name: string;
  leverage: number;
}

export interface Deployment {
  id: number;
  userId: number;
  strategyId: number;
  strategyName: string;
  symbol: string;
  timeframe: string;
  versionId: number;
  version: number;
  login: number;
  accountType: "demo" | "live";
  status: "running" | "paused" | "stopped" | "killed" | "error";
  risk: { lotMultiplier?: number; maxLots?: number; maxOpenPositions?: number; maxDailyLoss?: number };
  stats: { trades?: number; wins?: number; realized?: number; open?: number; orders?: number; lastOrderAt?: string };
  subscriptionId: number | null;
  openPositions: number;
  lastBarT: number | null;
  lastEvalAt: string | null;
  error: string | null;
  stopReason: string | null;
  startBalance: string | number | null;
  createdAt: string;
  stoppedAt: string | null;
}

export interface DeploymentDetail extends Deployment {
  logs: { id: number; at: string; level: string; kind: string; message: string }[];
  positions: { ticket: number; symbol: string; side: string; volume: number; openPrice: number | null; openedAt: string; closedAt: string | null; closePrice: number | null; profit: number | null; reason: string | null }[];
  daily: { day: string; realized: number; trades: number; wins: number }[];
  summary?: Built["summary"];
  spec?: Partial<StrategySpec>;
  rulesHidden: boolean;
}

export interface Controls {
  killed: boolean;
  killedAt: string | null;
  killedBy: string | null;
  reason: string | null;
  globalKill: boolean;
}

/* ------------------------------------------------------------------ */
/* Fetch                                                               */
/* ------------------------------------------------------------------ */

export class AlgoError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export async function algoApi<T>(path: string, init?: { method?: Method; body?: unknown; signal?: AbortSignal }): Promise<T> {
  const method = init?.method ?? (init?.body !== undefined ? "POST" : "GET");
  const hasBody = method !== "GET" && method !== "DELETE";
  let res: Response;
  try {
    res = await fetch(`/api/algo/${path}`, {
      method,
      headers: hasBody ? { "content-type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(init?.body ?? {}) : undefined,
      cache: "no-store",
      signal: init?.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new AlgoError(0, "network", tr("common.networkError"));
  }
  const data = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string; field?: string } };
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.assign(`/api/auth/expired?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
    throw new AlgoError(res.status, data.error?.code ?? "error", data.error?.message ?? tr("common.errorRetry"), data.error?.field);
  }
  return data as T;
}

export function algoError(title: string, e: unknown) {
  toast.error(title, { description: e instanceof Error ? e.message : tr("common.errorRetry") });
}

/** Polls `path` every `ms` (0 = once) while the tab is visible. */
export function useAlgo<T>(path: string | null, ms = 0) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<AlgoError | null>(null);
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);
  React.useEffect(() => {
    if (!path) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ctl = new AbortController();
    const run = async () => {
      if (stop) return;
      if (document.visibilityState === "visible") {
        try {
          const d = await algoApi<T>(path, { signal: ctl.signal });
          if (stop) return;
          setData(d);
          setError(null);
        } catch (e) {
          if (stop || (e as Error).name === "AbortError") return;
          setError(e instanceof AlgoError ? e : new AlgoError(0, "error", tr("common.errorRetry")));
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
  return { data, error, loading: data === null && error === null, reload, setData };
}

/** Catalogue shared by the builder pages (fetched once per page load). */
let metaCache: Promise<Meta> | null = null;
export function useMeta() {
  const [meta, setMeta] = React.useState<Meta | null>(null);
  React.useEffect(() => {
    metaCache ??= algoApi<Meta>("meta").catch((e) => {
      metaCache = null;
      throw e;
    });
    metaCache.then(setMeta).catch(() => undefined);
  }, []);
  return meta;
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export const fmtMoney = (v: number | null | undefined, digits = 2) => (v === null || v === undefined || !Number.isFinite(v) ? "–" : `${v < 0 ? "−" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`);
export const fmtSigned = (v: number | null | undefined, digits = 2) => (v === null || v === undefined || !Number.isFinite(v) ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`);
export const fmtPct = (v: number | null | undefined, digits = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}%`);
export const fmtNum = (v: number | null | undefined, digits = 2) => (v === null || v === undefined || !Number.isFinite(v) ? "–" : v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }));
export const fmtDate = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString().slice(0, 10) : "–");
export const fmtDateTime = (iso: string | number | null | undefined) => {
  if (iso === null || iso === undefined) return "–";
  const d = typeof iso === "number" ? new Date(iso * 1000) : new Date(iso);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`;
};
export function ago(iso: string | null | undefined) {
  if (!iso) return tr("developer.ago.never");
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return tr("developer.ago.seconds", { n: Math.round(s) });
  if (s < 3600) return tr("developer.ago.minutes", { n: Math.round(s / 60) });
  if (s < 86400) return tr("developer.ago.hours", { n: Math.round(s / 3600) });
  return tr("developer.ago.days", { n: Math.round(s / 86400) });
}

/** Translation keys for the signal names; call t(SIGNAL_LABEL[k]) at render. */
export const SIGNAL_LABEL: Record<string, "developer.signal.buy" | "developer.signal.sell" | "developer.signal.exitBuy" | "developer.signal.exitSell"> = { buy: "developer.signal.buy", sell: "developer.signal.sell", exit_buy: "developer.signal.exitBuy", exit_sell: "developer.signal.exitSell" };
export const DEP_TONE: Record<Deployment["status"], "ember" | "neutral" | "down" | "warn"> = { running: "ember", paused: "neutral", stopped: "neutral", killed: "down", error: "down" };
