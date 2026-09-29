// Social trading on live data: copy trading, PAMM funds and MAM, through the Client Area's social BFF
// (/api/mobile/social/* is a rewrite of /api/social/*, apps/crm/app/api/social/[...path]/route.ts). The same server
// routes and rules as the web Client Area (apps/crm/components/social-live): identity, KYC, restrictions, viewer
// and staff policies are decided server-side. Shapes follow the engine contract (services/trading README,
// "Copy trading and PAMM" and "MAM").
import { api, apiGet, type ApiError, type ApiResult } from "@/lib/api";
import { getQueryData } from "@/lib/query";
import { i18n } from "@/i18n";

export type Program = "copy" | "pamm" | "both";
export type FeePeriod = "daily" | "weekly" | "monthly";
export type SizingMode = "equity" | "allocation" | "multiplier" | "fixed_lot";
export type MasterStatus = "pending" | "approved" | "rejected" | "suspended";
export type FundStatus = "active" | "frozen" | "closed";

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
  /** house account: broker-operated, automated strategy (always shown with the disclosure) */
  house?: boolean;
  login?: number;
  reviewNote?: string | null;
  createdAt?: string;
}

export interface Leaderboard {
  items: MasterView[];
  totals: { masters: number; aum: number; followers: number; investors: number };
}

export interface MasterTrade {
  id: number;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  openPrice: number;
  closePrice: number;
  openTime: string;
  closeTime: string;
  profit: number;
}

export interface MasterProfile {
  master: MasterView;
  equity: { day: string; equity: number; index: number }[];
  monthly: { month: string; returnPct: number }[];
  trades: MasterTrade[];
  symbols: { symbol: string; trades: number; share: number }[];
  tradeDelayMinutes: number;
  terms: { perfFeePct: number; feePeriod: FeePeriod; hwm: boolean; minAllocation: number; platformCutPct: number };
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

export interface Position {
  ticket: number;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  openPrice: number;
  openTime: string;
  sl: number | null;
  tp: number | null;
  swap: number;
  commission: number;
  currentPrice: number | null;
  profit: number;
}

export interface Order {
  ticket: number;
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "stop_limit";
  volume: number;
  price: number | null;
  placedAt: string;
}

export interface FeeView {
  id: number;
  source: "copy" | "pamm" | "mam";
  masterId: number;
  master: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  hwmBefore: number;
  hwmAfter: number;
  status: "pending" | "approved" | "paid" | "rejected" | "failed";
  createdAt: string;
}

export interface CopyLogEntry {
  at: string;
  action: string;
  masterTicket: number | null;
  followerTicket: number | null;
  volume: number | null;
  status: string;
  message: string | null;
}

export interface SubscriptionDetail {
  subscription: SubscriptionView;
  positions: Position[];
  orders: Order[];
  log: CopyLogEntry[];
  fees: FeeView[];
}

export interface FollowResult {
  subscription: SubscriptionView;
  account: { login: number };
  funding: { status: "done" | "failed"; message?: string };
}

export interface StopResult {
  subscription: SubscriptionView;
  closed: number[];
  failed: { ticket: number | null; error: string }[];
  returned: number | null;
  returnError?: string | null;
}

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
}

export interface FundDetail {
  fund: FundView;
  master: MasterView | null;
  navHistory: { at: string; nav: number }[];
  rollovers: { id?: number; at: string; nav: number; invested: number; redeemed: number; fees: number }[];
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

export interface Investments {
  items: InvestmentView[];
  requests: RequestView[];
}

export interface Statement {
  items: { at: string; kind: string; units: number; nav: number; amount: number }[];
  requests: RequestView[];
}

/* ---- MAM ---- */

export type MamMethod = "equity" | "balance" | "multiplier" | "percent";
export type ManagerStatus = "active" | "frozen" | "closed";
export type LinkStatus = "active" | "revoked" | "stopped";

export interface ManagerView {
  id: number;
  masterId: number;
  nickname: string | null;
  name: string;
  description: string;
  method: MamMethod;
  perfFeePct: number;
  mgmtFeePct: number;
  feePeriod: FeePeriod;
  minEquity: number;
  status: ManagerStatus;
  freezeReason: string | null;
  createdAt: string;
  accounts: number;
  aum: number;
  track?: { return1m: number; return1y: number; returnAll: number; maxDd: number; riskScore: number; since: string | null } | null;
}

export interface LinkView {
  id: number;
  managerId: number;
  manager: { id: number; name: string; nickname: string; method: MamMethod; status: ManagerStatus } | null;
  login: number | string;
  status: LinkStatus;
  stopReason: string | null;
  maxLot: number | null;
  equityStop: number | null;
  perfFeePct: number;
  mgmtFeePct: number;
  feePeriod: FeePeriod;
  hwm: number;
  feesPaid: number;
  feesPending: number;
  equity: number;
  balance: number;
  mamResult: number;
  mamPositions: number;
  mamOrders: number;
  createdAt: string;
  endedAt: string | null;
  consentAt: string;
}

export interface Candidate {
  login: number;
  group: string;
  equity: number;
  balance: number;
  positions: number;
  eligible: boolean;
  reason: string | null;
}

export interface ManagerDetail {
  manager: ManagerView;
  terms: { text: string; hash: string };
  accounts: Candidate[];
  own: boolean;
}

export interface MamDeal {
  id: number;
  symbol: string;
  side: "buy" | "sell";
  entry: "in" | "out" | "out_by";
  volume: number;
  price: number;
  profit: number;
  swap: number;
  commission: number;
  time: string;
}

export interface MamLogEntry {
  at: string;
  action: string;
  volume: number | null;
  status: "done" | "skipped" | "failed";
  message: string;
}

export interface LinkDetail {
  link: LinkView;
  positions: Position[];
  orders: Order[];
  deals: MamDeal[];
  log: MamLogEntry[];
  fees: FeeView[];
  terms: string | null;
}

export interface RevokeResult {
  closed: number[];
  failed: unknown[];
  fee: number | null;
  link: LinkView;
}

/* ---- the caller as a master / MAM manager (summary; managed on the web) ---- */

export interface MasterMe {
  master: MasterView | null;
}

export interface MasterDashboard {
  master: MasterView;
  totals: { followers: number; aum: number; feesPending: number; feesPaid: number };
}

export interface ManagerMe {
  master: { id: number; nickname: string; status: string; frozen: boolean } | null;
  manager: ManagerView | null;
  totals?: { accounts: number; equity: number; mamResult: number; feesPending: number; feesPaid: number };
}

export interface WalletOverview {
  balances: { currency: string; available: string; locked: string }[];
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

// Server codes that come without a message of their own get the catalog text; the engine's own message is
// more specific for everything else (same rule as the web: components/social-live/api.ts).
const CODES = new Set([
  "unavailable",
  "not_master",
  "master_status",
  "requirements",
  "own_subscription",
  "min_allocation",
  "wallet_unavailable",
  "wallet_rejected",
  "fund_frozen",
  "min_investment",
  "locked",
  "insufficient_units",
  "request_done",
  "terms_changed",
]);

function friendly(e: ApiError): ApiError {
  if (!CODES.has(e.code)) return e;
  if (e.code === "unavailable" || e.code === "terms_changed" || !e.message) return { ...e, message: i18n.t.dyn(`mobileSocial.error.${e.code}`, e.message) };
  return e;
}

async function wrap<T>(p: Promise<ApiResult<T>>): Promise<ApiResult<T>> {
  const r = await p;
  return r.ok ? r : { ...r, error: friendly(r.error) };
}

export const socialGet = <T>(path: string) => wrap(apiGet<T>(`social/${path}`));

const isPlain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** `next`, reusing every part of `prev` that is deep-equal, so a poll that changed nothing re-renders no row. */
export function replaceEqualDeep<T>(prev: unknown, next: T): T {
  if (Object.is(prev, next)) return prev as T;
  if (Array.isArray(prev) && Array.isArray(next)) {
    let same = prev.length === next.length;
    const out = next.map((n, i) => {
      const r = replaceEqualDeep(prev[i], n);
      if (r !== prev[i]) same = false;
      return r;
    });
    return (same ? prev : out) as T;
  }
  if (isPlain(prev) && isPlain(next)) {
    const keysNext = Object.keys(next);
    let same = keysNext.length === Object.keys(prev).length;
    const out: Record<string, unknown> = {};
    for (const k of keysNext) {
      const r = replaceEqualDeep(prev[k], next[k]);
      out[k] = r;
      if (r !== prev[k]) same = false;
    }
    return (same ? prev : out) as T;
  }
  return next;
}

/** A fetcher whose answer is structurally shared with what the cache holds under `key`. */
export function shared<T>(key: string, fetch: () => Promise<ApiResult<T>>) {
  return async (): Promise<ApiResult<T>> => {
    const r = await fetch();
    return r.ok ? { ...r, data: replaceEqualDeep(getQueryData<T>(key), r.data) } : r;
  };
}
export const socialPost = <T>(path: string, body: unknown = {}) => wrap(api<T>(`social/${path}`, { method: "POST", body }));
export const socialPatch = <T>(path: string, body: unknown) => wrap(api<T>(`social/${path}`, { method: "PATCH", body }));

/* ------------------------------------------------------------------ */
/* Query keys (all under "social:"; persisted ones open the screen on the last answer)                    */
/* ------------------------------------------------------------------ */

export type LbPeriod = "1m" | "3m" | "1y" | "all";
export type LbSort = "return" | "dd" | "aum" | "followers" | "age";
export type LbProgram = "all" | "copy" | "pamm";
export type LbRisk = "all" | "low" | "med" | "high";
export type LbFilters = { period: LbPeriod; sort: LbSort; program: LbProgram; risk: LbRisk; minDays: number };

export function leaderboardPath(f: LbFilters) {
  const q = new URLSearchParams({ period: f.period, program: f.program, sort: f.sort, risk: f.risk });
  if (f.minDays) q.set("minDays", String(f.minDays));
  return `leaderboard?${q}`;
}

export const keys = {
  leaderboard: (f: LbFilters) => `social:lb:${f.period}:${f.sort}:${f.program}:${f.risk}:${f.minDays}`,
  master: (id: number | string) => `social:master:${id}`,
  subs: "social:subs",
  sub: (id: number | string) => `social:sub:${id}`,
  funds: "social:funds",
  fund: (id: number | string) => `social:fund:${id}`,
  investments: "social:inv",
  statement: (id: number | string) => `social:stmt:${id}`,
  managers: "social:mam:managers",
  manager: (id: number | string) => `social:mam:manager:${id}`,
  links: "social:mam:links",
  link: (id: number | string) => `social:mam:link:${id}`,
  me: "social:me",
  dashboard: "social:dashboard",
  mamOwn: "social:mam:own",
  symbols: "social:symbols",
  wallet: "social:wallet",
} as const;

// Polled or re-opened screens share structure with the cached answer (rows re-render only when they changed).
export const fetchers = {
  master: (id: number | string) => shared(keys.master(id), () => socialGet<MasterProfile>(`masters/${id}`)),
  subs: shared(keys.subs, () => socialGet<{ items: SubscriptionView[] }>("subscriptions")),
  sub: (id: number | string) => shared(keys.sub(id), () => socialGet<SubscriptionDetail>(`subscriptions/${id}`)),
  funds: shared(keys.funds, () => socialGet<{ items: FundView[] }>("funds")),
  fund: (id: number | string) => shared(keys.fund(id), () => socialGet<FundDetail>(`funds/${id}`)),
  investments: shared(keys.investments, () => socialGet<Investments>("investments")),
  statement: (id: number | string) => shared(keys.statement(id), () => socialGet<Statement>(`funds/${id}/statement`)),
  managers: shared(keys.managers, () => socialGet<{ items: ManagerView[] }>("mam/managers")),
  manager: (id: number | string) => () => socialGet<ManagerDetail>(`mam/managers/${id}`),
  links: shared(keys.links, () => socialGet<{ items: LinkView[]; accounts: Candidate[] }>("mam/links")),
  link: (id: number | string) => shared(keys.link(id), () => socialGet<LinkDetail>(`mam/links/${id}`)),
  me: () => socialGet<MasterMe>("master/me"),
  dashboard: () => socialGet<MasterDashboard>("master/dashboard"),
  mamOwn: () => socialGet<ManagerMe>("mam/manager"),
  symbols: () => socialGet<{ symbols: { symbol: string; assetClass: string | null }[] }>("symbols"),
  wallet: () => apiGet<WalletOverview>("wallet/overview"),
};

/** USDT available in the wallet (USDT is USD 1:1). */
export function walletAvailable(w: WalletOverview | undefined): number | null {
  const b = w?.balances?.find((x) => x.currency === "USDT");
  if (!b) return w ? 0 : null;
  const n = Number(b.available);
  return Number.isFinite(n) ? n : null;
}

/** Numeric route params only (the BFF refuses anything else too). */
export const validId = (id: unknown): id is string => typeof id === "string" && /^\d{1,12}$/.test(id);
