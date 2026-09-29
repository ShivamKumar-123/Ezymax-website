"use client";

// Browser side of the growth BFF (app/api/growth/[[...path]]/route.ts -> services/growth /v1/growth/me/*).
// Live builds only: demo builds keep the mock rewards data from @kalks/mock/rewards.
// Shapes mirror services/growth/README.md. Money is USD, sent as JSON numbers; times are RFC 3339.

import * as React from "react";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

export type Id = number;

export interface Tier {
  key: string;
  name: string;
  rank: number;
  minPoints: number;
  multiplier: number;
  perks: string[];
}

export interface EarnRule {
  id: Id;
  name: string;
  assetClass: string | null;
  symbols: string[];
  accountGroups: string[];
  accountType: string;
  pointsPerLot: number;
}

export type CatalogueKind = "cashback" | "bonus_credit" | "fee_discount" | string;

export interface CatalogueItem {
  id: Id;
  name: string;
  description: string;
  kind: CatalogueKind;
  costPoints: number;
  value: number;
  minTier: string | null;
  stock: number | null;
  active: boolean;
  params: Record<string, unknown>;
}

export type PointsKind = "earn" | "redeem" | "bonus" | "promo" | "expire" | "adjust" | "reversal";

export interface PointsTx {
  id: Id;
  kind: PointsKind | string;
  points: number;
  description: string;
  login: number | null;
  dealId: number | null;
  createdAt: string;
}

export interface Rewards {
  points: {
    balance: number;
    lifetime: number;
    earnedThisMonth: number;
    lotsThisMonth: number;
    earned12m: number;
    expiringSoon: { points: number; at: string } | null;
  };
  tier: { key: string; name: string; rank: number; multiplier: number; minPoints: number; perks: string[] };
  nextTier: { key: string; name: string; minPoints: number; pointsToGo: number } | null;
  tiers: Tier[];
  rules: EarnRule[];
  pointValue: number;
  minHoldSeconds: number;
  pointsExpiryMonths: number;
  catalogue: CatalogueItem[];
  recent: PointsTx[];
  series: { day: string; points: number }[];
}

export interface PointsPage {
  items: PointsTx[];
  page: number;
  limit: number;
  total: number;
}

export interface Redemption {
  id: Id;
  itemId: Id;
  itemName: string;
  kind: CatalogueKind;
  points: number;
  value: number;
  status: "pending" | "completed" | "failed" | string;
  login: number | null;
  voucherCode: string | null;
  grantId: Id | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface Voucher {
  id: Id;
  code: string;
  kind: "fee_discount" | string;
  pct: number;
  appliesTo: "any" | "prop" | "commission" | string;
  status: "active" | "used" | "expired" | string;
  expiresAt: string;
  usedAt: string | null;
  source: string;
}

export interface CashbackProgramme {
  id: Id;
  name: string;
  description: string;
  assetClasses: string[];
  symbols: string[];
  accountGroups: string[];
  usdPerLot: number;
  maxPerMonth: number | null;
  optIn: boolean;
  enrolled: boolean;
  startsAt: string;
  endsAt: string | null;
  lotsMonth: number;
  earnedMonth: number;
}

export interface CashbackAccrual {
  id: Id;
  programmeId: Id;
  programme: string;
  dealId: number;
  login: number;
  symbol: string;
  lots: number;
  amount: number;
  status: string;
  createdAt: string;
}

export interface CashbackPayout {
  id: Id;
  amount: number;
  status: "pending" | "paid" | "failed" | string;
  createdAt: string;
  paidAt: string | null;
}

export interface CashbackMe {
  programmes: CashbackProgramme[];
  totals: { accrued: number; paid: number; month: number; lifetime: number };
  accruals: CashbackAccrual[];
  payouts: CashbackPayout[];
  series: { day: string; amount: number }[];
}

export interface CampaignPublic {
  id: Id;
  name: string;
  description: string;
  terms: string;
  kind: "deposit" | "fixed";
  pct: number;
  cap: number;
  fixedAmount: number;
  minDeposit: number;
  releasePerLot: number;
  expiryDays: number;
  forfeitOnWithdrawal: boolean;
  claimWindowDays: number;
  startsAt: string;
  endsAt: string | null;
  eligible: boolean;
  reason: string | null;
  claimed: boolean;
}

export type GrantStatus = "awaiting_deposit" | "pending" | "active" | "completed" | "forfeited" | "expired" | "cancelled" | "failed";

export interface Grant {
  id: Id;
  campaignId: Id;
  campaign: string;
  status: GrantStatus | string;
  source: string;
  login: number | null;
  depositAmount: number | null;
  amount: number;
  released: number;
  remaining: number;
  lotsTraded: number;
  lotsRequired: number;
  releasePerLot: number;
  progressPct: number;
  claimedAt: string;
  grantedAt: string | null;
  expiresAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  claimDeadline: string | null;
}

export interface PromoUse {
  id: Id;
  code: string;
  kind: string;
  status: "applied" | "blocked" | string;
  reason: string | null;
  createdAt: string;
}

export interface Promotions {
  campaigns: CampaignPublic[];
  grants: Grant[];
  promoHistory: PromoUse[];
}

export interface PromoResult {
  result: { kind: string; message: string; grant?: Grant; points?: number; voucher?: Voucher };
}

export type ContestStatus = "draft" | "scheduled" | "running" | "ended" | "finalized" | "paid" | "cancelled";

export interface Prize {
  rankFrom: number;
  rankTo: number;
  amount: number;
  payout: "wallet" | "credit" | string;
}

export interface Contest {
  id: Id;
  slug: string;
  name: string;
  description: string;
  kind: "demo" | "live";
  status: ContestStatus | string;
  startsAt: string;
  endsAt: string;
  scoring: "return_pct" | "profit" | "lots" | string;
  minTrades: number;
  maxEntrants: number | null;
  entrants: number;
  startingBalance: number | null;
  demoGroup: string | null;
  accountGroups: string[];
  kycRequired: boolean;
  minEquity: number | null;
  prizes: Prize[];
  prizePool: number;
  rules: string;
  antiCheat: { minHoldSeconds: number; maxSingleTradePct: number; disqualifyOnBalanceChange: boolean };
  updatedAt: string;
}

export interface Standing {
  entryId: Id;
  userId: number | null;
  name: string;
  country: string | null;
  login: number | null;
  rank: number | null;
  score: number;
  returnPct: number;
  profit: number;
  lots: number;
  trades: number;
  qualified: boolean;
  status: "active" | "disqualified" | string;
  prize: number | null;
  prizeStatus: string | null;
  me: boolean;
  updatedAt: string;
}

export type ContestCard = Contest & { myEntry: Standing | null };

export interface ContestsResp {
  items: ContestCard[];
  stats: { entered: number; prizesWon: number; prizeFinishes: number; bestRank: number | null; active: number };
}

export interface ContestDetail {
  contest: Contest;
  leaderboard: Standing[];
  myEntry: Standing | null;
  entrants: number;
}

export interface JoinResult {
  entry: Standing;
  credentials?: { login: number; password: string; investorPassword: string };
}

export interface BannerView {
  id: Id;
  title: string;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  imageUrl: string | null;
  tone: "ember" | "gold" | "neutral" | "up" | string;
  placement: string;
  dismissible: boolean;
}

export interface ShareData {
  name: string;
  symbol: string | null;
  side: string | null;
  openPrice: number | null;
  closePrice: number | null;
  openTime: string | null;
  closeTime: string | null;
  movePct: number | null;
  returnPct: number | null;
  trades: number | null;
  winRate: number | null;
  lots: number | null;
  profit: number | null;
  currency: string;
  from: string | null;
  to: string | null;
  referralCode: string | null;
  brand: string;
}

export interface Share {
  code: string;
  kind: "trade" | "period";
  login: number;
  showAmounts: boolean;
  createdAt: string;
  views: number;
  url: string;
  data: ShareData;
}

/* ------------------------------------------------------------------ */
/* Fetch                                                               */
/* ------------------------------------------------------------------ */

export class GrowthApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

const FRIENDLY: Record<string, string> = {
  insufficient_points: "You don't have enough points for this reward.",
  out_of_stock: "This reward is out of stock.",
  already_joined: "You have already joined this contest.",
  already_claimed: "You have already claimed this bonus.",
  contest_closed: "This contest is no longer open for entries.",
  limit_reached: "This offer has reached its limit.",
};

export async function growthApi<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal }): Promise<T> {
  const method = init?.method ?? (init?.body !== undefined ? "POST" : "GET");
  const write = method !== "GET";
  let res: Response;
  try {
    res = await fetch(`/api/growth/${path}`, {
      method,
      headers: write ? { "content-type": "application/json" } : undefined,
      body: write ? JSON.stringify(init?.body ?? {}) : undefined,
      cache: "no-store",
      signal: init?.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new GrowthApiError(0, "network", "Network error. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string; field?: string } };
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.assign(`/api/auth/expired?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
    const code = data.error?.code ?? "error";
    const msg =
      code === "unavailable" || res.status >= 500
        ? "The rewards service is unavailable. Please try again shortly."
        : (data.error?.message ?? FRIENDLY[code] ?? "Something went wrong. Please try again.");
    throw new GrowthApiError(res.status, code, msg, data.error?.field);
  }
  return data as T;
}

export function errorToast(title: string, e: unknown) {
  toast.error(title, { description: e instanceof Error ? e.message : "Something went wrong. Please try again." });
}

/** Loads `path` once (and again on `reload()`); refreshes quietly every `ms` while the tab is visible. */
export function useGrowth<T>(path: string | null, ms = 0) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<GrowthApiError | null>(null);
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    if (path === null) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ctl = new AbortController();
    const run = async () => {
      if (stop) return;
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        try {
          const d = await growthApi<T>(path, { signal: ctl.signal });
          if (stop) return;
          setData(d);
          setError(null);
        } catch (e) {
          if (stop || (e as Error).name === "AbortError") return;
          setError(e instanceof GrowthApiError ? e : new GrowthApiError(0, "error", "Something went wrong."));
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

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "28 Sep 2026" (local time). */
export function fmtDate(iso: string | null | undefined, withYear = true) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")} ${MON[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ""}`;
}

/** "28 Sep, 14:03" (local time). */
export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${fmtDate(iso, false)}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "28 Sep" for a "YYYY-MM-DD" day key. */
export function fmtDay(day: string) {
  const [, m, d] = day.split("-").map(Number);
  return m && d ? `${d} ${MON[m - 1]}` : day;
}

export const fmtPoints = (v: number) => Math.round(v).toLocaleString("en-US");

export function fmtUsd(v: number, digits = 2) {
  const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${v < 0 ? "-" : ""}$${s}`;
}

/** 12.5 -> "12.5%", 12 -> "12%". */
export function fmtPct(v: number, signed = false) {
  const n = Number.isInteger(v) ? String(v) : String(+v.toFixed(2));
  return `${signed && v > 0 ? "+" : ""}${n}%`;
}

export const fmtLots = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const titleCase = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** "#1", "#2–5" for a prize band. */
export const bandLabel = (p: Pick<Prize, "rankFrom" | "rankTo">) => (p.rankFrom === p.rankTo ? `#${p.rankFrom}` : `#${p.rankFrom}–${p.rankTo}`);

/** Prize for a rank from the contest's bands (null outside the prize zone). */
export function prizeFor(c: Pick<Contest, "prizes">, rank: number | null) {
  if (!rank) return null;
  return c.prizes.find((p) => rank >= p.rankFrom && rank <= p.rankTo)?.amount ?? null;
}

/** Last rank that wins a prize. */
export const prizeZone = (c: Pick<Contest, "prizes">) => c.prizes.reduce((m, p) => Math.max(m, p.rankTo), 0);

export const SCORING_LABEL: Record<string, string> = { return_pct: "Return %", profit: "Profit", lots: "Lots traded" };
export const scoringLabel = (s: string) => SCORING_LABEL[s] ?? titleCase(s);

/** Public origin for share links: NEXT_PUBLIC_APP_URL, else this page's origin. */
export function linkBase(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/+$/, "");
  return typeof window === "undefined" ? "" : window.location.origin;
}
