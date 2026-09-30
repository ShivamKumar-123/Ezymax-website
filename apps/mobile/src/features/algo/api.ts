// Algo on the phone: strategies, deployments (the 24/7 runtime), backtests, the strategy marketplace, API keys and
// webhooks. Everything goes through the Client Area's algo BFF: /api/mobile/algo/* is a rewrite of /api/algo/*
// (apps/crm/app/api/algo/[...path]/route.ts), so the same server routes and rules as the web Client Area
// (apps/crm/components/algo) apply: the client comes from the bearer session, the broker's "algo" / "api" module
// switches, view-only and read-only staff sessions, ownership, limits, kill switches and the engine's order checks.
// Shapes follow services/algo/README.md ("Internal API"). Writes are never optimistic: screens show the answer.
import { InteractionManager } from "react-native";
import { i18n } from "@/i18n";
import { api, apiGet, type ApiError, type ApiResult } from "@/lib/api";
import { kv } from "@/lib/kv";
import { getQueryData, invalidate, prefetch, setQueryData } from "@/lib/query";
import { onSignOut, sessionStore } from "@/session";
import { share } from "./share";

/* ------------------------------------------------------------------ */
/* Strategy spec (visual builder schema, services/algo/src/spec.rs)    */
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
export interface Trailing {
  mode: string;
  value: number;
  atrPeriod: number;
  breakevenTrigger: number;
  breakevenOffset: number;
}
export interface Sizing {
  mode: "lots" | "risk";
  lots: number;
  riskPct: number;
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
  sizing: Sizing;
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

/** The risk half of a spec: what a deployment and a marketplace listing show (never the rules of a private one). */
export type RiskSpec = Partial<Pick<StrategySpec, "symbol" | "timeframe" | "sizing" | "maxLots" | "sl" | "tp" | "trailing" | "sessions" | "days" | "maxTradesPerDay" | "maxDailyLoss" | "oneAtATime" | "closeOutsideSession">>;

export type SignalKey = "buy" | "sell" | "exit_buy" | "exit_sell";
/** The rules as the service writes them (DSL expressions), per signal. */
export type Summary = Partial<Record<SignalKey, string>>;

/* ------------------------------------------------------------------ */
/* Strategies                                                          */
/* ------------------------------------------------------------------ */

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
  summary: Summary | null;
  createdAt: string;
  updatedAt: string;
}

export interface VersionBuilt {
  id: number;
  version: number;
  kind: "visual" | "code";
  valid: boolean;
  errors: { line?: number; col?: number; message: string }[];
  warnings: string[];
  spec: StrategySpec;
  code: string;
  source: string | null;
  timeframes: string[];
  lookback: number;
  summary: Summary;
  note: string | null;
  prompt: string | null;
  createdAt: string;
}

export interface StrategyDetail {
  id: number;
  name: string;
  symbol: string;
  timeframe: string;
  kind: "visual" | "code";
  origin: string;
  status: "active" | "archived";
  latestVersion: number;
  current: VersionBuilt;
  versions: { id: number; version: number; kind: string; valid: boolean; note: string | null; createdAt: string }[];
  deployments: Deployment[];
  backtests: BacktestRow[];
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Backtests                                                           */
/* ------------------------------------------------------------------ */

export type BacktestStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export interface BacktestParams {
  from: number;
  to: number;
  initialBalance: number;
  symbol: string;
  timeframe: string;
  group?: string;
  login?: number;
  spreadPoints?: number;
  commissionPerLot?: number;
  swaps?: boolean;
}

export interface BacktestRow {
  id: number;
  versionId: number;
  params: BacktestParams;
  status: BacktestStatus;
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
  /** equity / balance and the drawdown from the peak in % (≤ 0), at most 1500 points */
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

/* ------------------------------------------------------------------ */
/* Deployments (the runtime)                                           */
/* ------------------------------------------------------------------ */

export type DeploymentStatus = "running" | "paused" | "stopped" | "killed" | "error";

export interface RiskLimits {
  lotMultiplier?: number;
  maxLots?: number;
  maxOpenPositions?: number;
  maxDailyLoss?: number;
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
  status: DeploymentStatus;
  risk: RiskLimits;
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

export interface DeploymentLog {
  id: number;
  at: string;
  level: "info" | "warn" | "error" | string;
  kind: "eval" | "signal" | "order" | "close" | "manage" | "error" | "info" | string;
  message: string;
}

export interface DeploymentPosition {
  ticket: number;
  symbol: string;
  side: string;
  volume: number;
  openPrice: number | null;
  openedAt: string;
  closedAt: string | null;
  closePrice: number | null;
  profit: number | null;
  reason: string | null;
}

export interface DeploymentDetail extends Deployment {
  logs: DeploymentLog[];
  positions: DeploymentPosition[];
  daily: { day: string; realized: number; trades: number; wins: number }[];
  summary?: Summary;
  spec?: RiskSpec;
  rulesHidden: boolean;
}

export interface Controls {
  killed: boolean;
  killedAt: string | null;
  killedBy: string | null;
  reason: string | null;
  globalKill: boolean;
}

/** Answer of stop / kill / close-positions: what the engine closed. */
export interface ActionResult {
  status?: string;
  closed?: number;
  failed?: number;
}

/* ------------------------------------------------------------------ */
/* Marketplace                                                         */
/* ------------------------------------------------------------------ */

export interface Track {
  returnPct: number;
  winRate: number;
  trades: number;
  maxDrawdownPct: number;
  days: number;
  accountType: "live" | "demo" | string;
  /** list: equity per day (numbers); detail: {day, realized, equity} per day */
  curve?: number[] | { day: string; realized: number; equity: number }[];
  netProfit?: number;
  since?: string;
  startBalance?: number;
  deploymentStatus?: string;
}

export interface Listing {
  id: number;
  title: string;
  description: string;
  author: string;
  authorUserId: number;
  symbol: string;
  timeframe: string;
  priceMonthly: number;
  currency: string;
  allowClone: boolean;
  status: "pending" | "approved" | "rejected" | "suspended" | "unlisted" | string;
  moderationNote: string | null;
  rating: number;
  ratings: number;
  subscribers: number;
  track: Track;
  createdAt: string;
  updatedAt?: string;
  /** a house account's listing: operated by the broker, always shown with the disclosure */
  house?: boolean;
}

/** A house listing's backtest: simulated on history, never part of the live track record. */
export interface HouseBacktest {
  kind: "backtest";
  label: string;
  summary: Partial<BacktestSummary> | null;
  curve: { t: number; equity: number }[];
  notes: string[] | null;
  model?: string;
}

export interface ListingSubscription {
  id: number;
  mode: "copy" | "clone";
  status: "active" | "cancelled" | "expired" | "past_due" | string;
  login: number | null;
  deploymentId: number | null;
  clonedStrategyId: number | null;
  periodEnd: string | null;
  autoRenew: boolean;
}

export interface Review {
  id: number;
  user: string;
  rating: number;
  comment: string;
  createdAt: string;
  mine: boolean;
}

export interface ListingDetail extends Listing {
  risk?: RiskSpec;
  summary?: Summary;
  kind?: "visual" | "code";
  reviews: Review[];
  subscription: ListingSubscription | null;
  isAuthor: boolean;
  platformCutPct: number;
  backtest?: HouseBacktest | null;
}

export interface Browse {
  items: Listing[];
  subscribed: number[];
  platformCutPct: number;
}

export interface MarketSubscription {
  id: number;
  listingId: number;
  title: string;
  author: string;
  symbol: string;
  timeframe: string;
  mode: "copy" | "clone";
  status: string;
  login: number | null;
  deploymentId: number | null;
  deploymentStatus: DeploymentStatus | null;
  clonedStrategyId: number | null;
  price: number;
  autoRenew: boolean;
  periodEnd: string | null;
  createdAt: string;
}

export interface MyListings {
  items: Listing[];
  earned: number;
  platformFees: number;
  payments: number;
}

export interface SubscribeResult {
  id: number;
  status: string;
  mode: "copy" | "clone";
  deploymentId: number | null;
  clonedStrategyId: number | null;
  charged: number | null;
}

/* ------------------------------------------------------------------ */
/* API keys and webhooks                                               */
/* ------------------------------------------------------------------ */

export interface ApiKey {
  id: number;
  name: string;
  keyId: string;
  login: number;
  accountType: "live" | "demo" | string;
  scopes: string[];
  ipWhitelist: string[];
  ratePerMin: number | null;
  expiresAt: string | null;
  status: "active" | "revoked" | "expired";
  createdAt: string;
  lastUsedAt: string | null;
  lastIp: string | null;
  revokedAt?: string | null;
}

export interface KeysResp {
  items: ApiKey[];
  usage: { requests24h: number; errors24h: number; rateLimited24h: number; p50: number; p99: number; writes24h: number; hourly: { t: string; n: number }[] };
  baseUrl: string;
}

export interface Webhook {
  id: number;
  name: string;
  status: "active" | "disabled";
  tokenHint: string;
  passphrase: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  routes?: number;
  events24h?: number;
}

export interface WebhookEvent {
  id: number;
  webhookId: number;
  receivedAt: string;
  ip: string | null;
  payload: Record<string, unknown> | null;
  status: string;
  error: string | null;
  results: { login: number; symbol?: string; status: string; ticket?: number; volume?: number; error?: string }[];
}

export interface WebhooksResp {
  items: Webhook[];
  events: WebhookEvent[];
  baseUrl: string;
}

/* ------------------------------------------------------------------ */
/* Transport and errors                                                */
/* ------------------------------------------------------------------ */

/**
 * The service answers in English with a machine code. Known codes read in the reader's language (the numbers they
 * carry are kept); anything else keeps the service's own wording, which is specific (a field, a limit, a date).
 */
function friendly(e: ApiError): ApiError {
  const t = i18n.t;
  const m = e.message ?? "";
  let message: string | null = null;
  switch (e.code) {
    case "halted":
      message = /platform/.test(m) ? t("mobileAlgo.error.haltedPlatform") : t("mobileAlgo.error.haltedMine");
      break;
    case "limit": {
      const n = /up to (\d+) strateg/.exec(m)?.[1];
      if (n) message = t("mobileAlgo.error.limitRunning", { n });
      break;
    }
    case "account_status":
      message = t("mobileAlgo.error.accountStatus");
      break;
    case "exists":
      if (/already running/.test(m)) message = t("mobileAlgo.error.alreadyRunning");
      break;
    case "invalid_strategy":
      message = t("mobileAlgo.error.invalidStrategy");
      break;
    case "state":
      message = t("mobileAlgo.error.state");
      break;
    case "queue_full":
      message = t("mobileAlgo.error.queueFull");
      break;
    case "daily_limit": {
      const n = /\((\d+)\)/.exec(m)?.[1];
      message = n ? t("mobileAlgo.error.dailyLimit", { n }) : null;
      break;
    }
    case "own_listing":
      message = t("mobileAlgo.error.ownListing");
      break;
    case "subscribed":
      message = t("mobileAlgo.error.subscribed");
      break;
    case "clone_not_allowed":
      message = t("mobileAlgo.error.cloneNotAllowed");
      break;
    case "insufficient_funds": {
      const amount = /below ([\d.,]+) USDT/.exec(m)?.[1];
      message = amount ? t("mobileAlgo.error.insufficientFunds", { amount }) : t("mobileAlgo.error.insufficientFundsPlain");
      break;
    }
    case "inactive":
      message = t("mobileAlgo.error.inactive");
      break;
    case "running":
      message = t("mobileAlgo.error.archiveRunning");
      break;
    case "archived":
      message = t("mobileAlgo.error.archived");
      break;
    case "finished":
      message = t("mobileAlgo.error.finished");
      break;
    case "revoked":
      message = t("mobileAlgo.error.revoked");
      break;
    case "module_disabled":
      message = t("mobileAlgo.state.disabled.text");
      break;
    case "not_found":
      message = t("mobileAlgo.error.notFound");
      break;
    case "validation": {
      const days = /^(\w+) backtests can cover at most (\d+) days/.exec(m);
      if (days) message = t("mobileAlgo.error.rangeTooLong", { tf: days[1], days: days[2] });
      else if (/^Initial balance must be between/.test(m)) message = t("mobileAlgo.error.balanceRange");
      else if (/^The start date must be before the end date/.test(m)) message = t("mobileAlgo.error.dates");
      break;
    }
  }
  return message ? { ...e, message } : e;
}

async function wrap<T>(p: Promise<ApiResult<T>>): Promise<ApiResult<T>> {
  const r = await p;
  return r.ok ? r : { ...r, error: friendly(r.error) };
}

export const algoGet = <T>(path: string, timeoutMs = 20_000) => wrap(apiGet<T>(`algo/${path}`, { timeoutMs }));
export const algoPost = <T>(path: string, body: unknown = {}, timeoutMs = 30_000) => wrap(api<T>(`algo/${path}`, { method: "POST", body, timeoutMs }));
export const algoPatch = <T>(path: string, body: unknown) => wrap(api<T>(`algo/${path}`, { method: "PATCH", body }));
export const algoDelete = <T>(path: string) => wrap(api<T>(`algo/${path}`, { method: "DELETE" }));

/** A fetcher whose answer is structurally shared with the cached answer under `key`. */
function shared<T>(key: string, fetch: () => Promise<ApiResult<T>>) {
  return async (): Promise<ApiResult<T>> => {
    const r = await fetch();
    return r.ok ? { ...r, data: share(getQueryData<T>(key), r.data) } : r;
  };
}

/** Numeric route params only (the BFF refuses anything else too). */
export const validId = (id: unknown): id is string => typeof id === "string" && /^\d{1,12}$/.test(id);

/* ------------------------------------------------------------------ */
/* Query keys and fetchers (all under "algo:")                         */
/* ------------------------------------------------------------------ */

export type Price = "" | "free" | "paid";
export type Sort = "updated" | "rating" | "subscribers";

export const keys = {
  strategies: "algo:strategies",
  strategy: (id: number | string) => `algo:strategy:${id}`,
  deployments: "algo:deployments",
  deployment: (id: number | string) => `algo:deployment:${id}`,
  backtests: "algo:backtests",
  backtest: (id: number | string) => `algo:bt:${id}`,
  controls: "algo:controls",
  market: (q: string, price: Price, sort: Sort) => `algo:market:${price}:${sort}:${q.trim().toLowerCase()}`,
  listing: (id: number | string) => `algo:listing:${id}`,
  subscriptions: "algo:subs",
  mine: "algo:mine",
  keys: "algo:keys",
  webhooks: "algo:webhooks",
  /** the wallet's USDT balance (paid subscriptions) */
  wallet: "algo:wallet",
  /** the More tab's broker menu (native route /api/mobile/menu): read here for the "api" module switch */
  menu: "more:menu",
} as const;

export function marketPath(q: string, price: Price, sort: Sort) {
  const s = new URLSearchParams({ sort });
  if (q.trim()) s.set("q", q.trim().slice(0, 60));
  if (price) s.set("price", price);
  return `market/listings?${s}`;
}

export const fetchers = {
  strategies: shared(keys.strategies, () => algoGet<{ items: StrategyItem[] }>("strategies")),
  strategy: (id: number | string) => shared(keys.strategy(id), () => algoGet<StrategyDetail>(`strategies/${id}`)),
  deployments: shared(keys.deployments, () => algoGet<{ items: Deployment[] }>("deployments")),
  deployment: (id: number | string) => shared(keys.deployment(id), () => algoGet<DeploymentDetail>(`deployments/${id}?limit=${LOG_PAGE}`)),
  backtests: shared(keys.backtests, () => algoGet<{ items: BacktestRow[] }>("backtests?limit=30")),
  backtest: (id: number | string) => async (): Promise<ApiResult<BacktestDetail>> => {
    const r = await algoGet<BacktestDetail>(`backtests/${id}`, 30_000);
    if (r.ok) keepReport(r.data);
    return r.ok ? { ...r, data: share(getQueryData<BacktestDetail>(keys.backtest(id)), r.data) } : r;
  },
  controls: shared(keys.controls, () => algoGet<Controls>("controls")),
  market: (q: string, price: Price, sort: Sort) => shared(keys.market(q, price, sort), () => algoGet<Browse>(marketPath(q, price, sort))),
  listing: (id: number | string) => shared(keys.listing(id), () => algoGet<ListingDetail>(`market/listings/${id}`)),
  subscriptions: shared(keys.subscriptions, () => algoGet<{ items: MarketSubscription[] }>("market/subscriptions")),
  mine: shared(keys.mine, () => algoGet<MyListings>("market/mine")),
  keys: shared(keys.keys, () => algoGet<KeysResp>("keys")),
  webhooks: shared(keys.webhooks, () => algoGet<WebhooksResp>("webhooks")),
  menu: () => apiGet<{ modules?: Record<string, boolean> }>("menu"),
};

/** Runtime log lines per page (the newest page is polled with the deployment; older pages load on request). */
export const LOG_PAGE = 60;

/** Older runtime log lines of a deployment (the log pages back by id). */
export const fetchOlderLogs = (id: number, before: number) => algoGet<DeploymentDetail>(`deployments/${id}?before=${before}&limit=${LOG_PAGE}`);

/* ------------------------------------------------------------------ */
/* Prefetch (row press-in)                                             */
/* ------------------------------------------------------------------ */

export function prefetchHome() {
  prefetch(keys.deployments, fetchers.deployments, { persist: true, staleMs: 5_000 });
  prefetch(keys.strategies, fetchers.strategies, { persist: true, staleMs: 10_000 });
  prefetch(keys.backtests, fetchers.backtests, { persist: true, staleMs: 5_000 });
  prefetch(keys.controls, fetchers.controls, { persist: true, staleMs: 15_000 });
}
export const prefetchStrategy = (id: number) => prefetch(keys.strategy(id), fetchers.strategy(id), { persist: true, staleMs: 5_000 });
export const prefetchDeployment = (id: number) => prefetch(keys.deployment(id), fetchers.deployment(id), { persist: true, staleMs: 3_000 });
export const prefetchListing = (id: number) => prefetch(keys.listing(id), fetchers.listing(id), { persist: true, staleMs: 10_000 });
export function prefetchMarket() {
  prefetch(keys.market("", "", "updated"), fetchers.market("", "", "updated"), { persist: true, staleMs: 30_000 });
}
export function prefetchBacktest(id: number) {
  seedReport(id);
  const cur = getQueryData<BacktestDetail>(keys.backtest(id));
  if (cur?.status === "done" && cur.report) return;
  prefetch(keys.backtest(id), fetchers.backtest(id), { staleMs: 1_000 });
}

/* ------------------------------------------------------------------ */
/* Finished backtest reports on the device                              */
/* ------------------------------------------------------------------ */

// A finished report never changes, and it is the heaviest screen of the module, so the last few reports are kept on
// the phone (per user, cleared on sign-out) and the report screen opens on them at once, offline too. Only reports
// up to REPORT_MAX_TRADES trades are kept: bigger ones would make the synchronous read noticeable.
const REPORT_MAX_TRADES = 800;
const REPORTS_KEPT = 10;
const userId = () => sessionStore.get().user?.id ?? null;
const reportKey = (uid: number, id: number | string) => `algo.bt.${uid}.${id}`;
const indexKey = (uid: number) => `algo.bt.idx.${uid}`;

function keepReport(d: BacktestDetail) {
  const uid = userId();
  if (uid === null || d.status !== "done" || !d.report || d.report.trades.length > REPORT_MAX_TRADES) return;
  const idx = kv.getJSON<number[]>(indexKey(uid)) ?? [];
  if (idx.includes(d.id)) return;
  // written after the screen settles: a report can be a few hundred kB
  InteractionManager.runAfterInteractions(() => {
    kv.setJSON(reportKey(uid, d.id), d);
    const next = [d.id, ...idx.filter((x) => x !== d.id)];
    for (const old of next.slice(REPORTS_KEPT)) kv.remove(reportKey(uid, old));
    kv.setJSON(indexKey(uid), next.slice(0, REPORTS_KEPT));
  });
}

/** Puts a report kept on the phone into the screen cache (before its screen reads it). */
export function seedReport(id: number | string) {
  const key = keys.backtest(id);
  if (getQueryData(key)) return;
  const uid = userId();
  if (uid === null) return;
  const saved = kv.getJSON<BacktestDetail>(reportKey(uid, id));
  if (saved?.report) setQueryData(key, saved);
}

onSignOut(() => {
  const uid = userId();
  if (uid === null) return;
  for (const id of kv.getJSON<number[]>(indexKey(uid)) ?? []) kv.remove(reportKey(uid, id));
  kv.remove(indexKey(uid));
});

/* ------------------------------------------------------------------ */
/* After a confirmed change                                            */
/* ------------------------------------------------------------------ */

/** Refreshes every algo screen that is open (and marks the rest stale). */
export function refreshAlgo() {
  invalidate("algo:");
}
