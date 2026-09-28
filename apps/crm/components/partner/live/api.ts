"use client";

// Browser side of the partner BFF (app/api/partner/[[...path]]/route.ts -> services/ib /v1/ib/me/*).
// Live builds only: demo builds keep the mock partner data from @kalks/mock/partner.
// Shapes mirror services/ib/src/api/client.rs. Money is USD, sent as JSON numbers.

import * as React from "react";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

export interface Level {
  key: string;
  name: string;
  rank: number;
  icon: string;
  perks: string[];
  minActiveClients: number;
  minMonthlyLots: number;
  cpaAmount: number;
  /** USD per standard lot, per symbol group key. */
  rates: Record<string, number>;
}

export interface SymbolGroup {
  key: string;
  name: string;
  assetClass: string | null;
  symbols: string[];
}

export interface Programme {
  levels: Level[];
  symbolGroups: SymbolGroup[];
  tiers: { tier: number; pct: number }[];
  cpa: {
    enabled: boolean;
    minFirstDeposit: number;
    requireFirstTrade: boolean;
    holdDays: number;
  };
  minTradeSeconds: number;
  payout: {
    schedule: "daily" | "weekly" | "monthly" | string;
    minAmount: number;
    nextClose: string;
  };
  maxRebatePct: number;
  maxSplitPct: number;
  clientVisibility: "full" | "masked" | string;
  excludedGroups: string[];
}

export type CommissionKind =
  "lot" | "split" | "rebate" | "cpa" | "clawback" | "adjustment";
export type CommissionStatus =
  "pending" | "approved" | "paid" | "rejected" | "void";

export interface CommissionRow {
  id: number;
  kind: CommissionKind | string;
  status: CommissionStatus | string;
  amount: number;
  tier: number;
  rate: number;
  sharePct: number;
  lots: number;
  symbol: string | null;
  symbolGroup: string | null;
  dealId: number | null;
  source: string | null;
  levelKey: string | null;
  client: { id: number; name: string; country: string | null };
  createdAt: string;
  availableAt: string;
  batchId: number | null;
  note: string | null;
}

export interface Dashboard {
  member: {
    userId: number;
    code: string;
    name: string;
    level: Level | null;
    levelSince: string;
    joinedAt: string;
    rebatePct: number;
    splitPct: number;
    status: string;
    hasUpline: boolean;
  };
  progress: {
    month: string;
    monthEnds: string;
    activeClients: number;
    monthlyLots: number;
    prevMonthLots: number;
    next: Level | null;
    levels: Level[];
  };
  earnings: {
    pending: number;
    approved: number;
    paid: number;
    rejected: number;
    month: number;
    prevMonth: number;
    lifetime: number;
    cpaEarned: number;
    cpaCount: number;
    cpaWaiting: number;
  };
  counts: {
    referrals: number;
    referralsThisMonth: number;
    funded: number;
    subIbs: number;
  };
  funnel: { clicks: number; signups: number; ftds: number };
  /** Days with accruals only (last 180 days); `cumulative` includes everything before. */
  series: { date: string; amount: number; cumulative: number }[];
  /** Weeks with accruals only (last 12 weeks, week starts Monday UTC). */
  weekly: { week: string; amount: number }[];
  topClients: {
    id: number;
    name: string;
    country: string;
    lotsMonth: number;
  }[];
  recent: CommissionRow[];
  programme: Programme;
  /** Public origin of the Client Area; referral link = `${linkBase}/r/${code}`. */
  linkBase: string;
}

export interface Campaign {
  /** null = the default link (/r/CODE). */
  id: number | null;
  slug: string;
  name: string;
  landing: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  active: boolean;
  createdAt: string | null;
  clicks: number;
  uniqueClicks: number;
  signups: number;
  ftds: number;
  deposits: number;
  lots: number;
  /** Clicks per day, last 30 days (oldest first). */
  trend: number[];
}

export interface CampaignsResp {
  code: string;
  items: Campaign[];
}

export type ClientStatus = "active" | "funded" | "registered";

export interface NetworkClient {
  id: number;
  tier: number;
  name: string;
  email: string | null;
  country: string;
  joinedAt: string;
  kycStatus: string;
  level: string;
  parentId: number | null;
  campaign: string | null;
  referrals: number;
  firstDepositAt: string | null;
  firstDepositAmount: number | null;
  firstTradeAt: string | null;
  lastTradeAt: string | null;
  lotsMonth: number;
  lotsTotal: number;
  earned: number;
  status: ClientStatus;
}

export interface ClientsResp {
  items: NetworkClient[];
  visibility: "full" | "masked" | string;
  tiers: number;
}

export interface ClientTrade {
  dealId: number;
  source: string;
  login: number | null;
  symbol: string;
  side: string;
  volume: number;
  lots: number;
  openTime: string;
  closeTime: string;
  qualified: boolean;
  reason: string | null;
  reversed: boolean;
  earned: number;
}

export interface NetworkNode {
  id: number;
  parentId: number | null;
  tier: number;
  name: string;
  country: string;
  level: string;
  joinedAt: string;
  lotsMonth: number;
  earnedMonth: number;
}

export interface NetworkResp {
  root: { id: number; name: string; level: string; code: string };
  nodes: NetworkNode[];
  tiers: number;
}

export interface CommissionsResp {
  items: CommissionRow[];
  page: number;
  limit: number;
  total: number;
  totals: Record<CommissionStatus, number>;
}

export type PayoutStatus =
  "awaiting_approval" | "processing" | "paid" | "rejected";

export interface Payout {
  id: number;
  batchId: number;
  amount: number;
  lines: number;
  status: PayoutStatus | string;
  createdAt: string;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string;
  schedule: string;
  destination: string;
}

export interface PayoutsResp {
  items: Payout[];
  unbatched: number;
  schedule: string;
  minAmount: number;
  nextClose: string;
}

/* ------------------------------------------------------------------ */
/* Fetch                                                               */
/* ------------------------------------------------------------------ */

export class PartnerApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH";

export async function partnerApi<T>(
  path: string,
  init?: { method?: Method; body?: unknown; signal?: AbortSignal },
): Promise<T> {
  const method = init?.method ?? (init?.body !== undefined ? "POST" : "GET");
  const write = method !== "GET";
  let res: Response;
  try {
    res = await fetch(`/api/partner${path ? `/${path}` : ""}`, {
      method,
      headers: write ? { "content-type": "application/json" } : undefined,
      body: write ? JSON.stringify(init?.body ?? {}) : undefined,
      cache: "no-store",
      signal: init?.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new PartnerApiError(
      0,
      "network",
      "Network error. Check your connection and try again.",
    );
  }
  const data = (await res.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string; field?: string };
  };
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.assign(
        `/api/auth/expired?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
      );
    }
    const code = data.error?.code ?? "error";
    const msg =
      code === "unavailable" || res.status >= 500
        ? "The partner service is unavailable. Please try again shortly."
        : (data.error?.message ?? "Something went wrong. Please try again.");
    throw new PartnerApiError(res.status, code, msg, data.error?.field);
  }
  return data as T;
}

export function errorToast(title: string, e: unknown) {
  toast.error(title, {
    description:
      e instanceof Error
        ? e.message
        : "Something went wrong. Please try again.",
  });
}

/** Loads `path` once (and again on `reload()`); refreshes quietly every `ms` while the tab is visible. */
export function usePartner<T>(path: string | null, ms = 0) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<PartnerApiError | null>(null);
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    if (!path && path !== "") return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ctl = new AbortController();
    const run = async () => {
      if (stop) return;
      if (
        typeof document === "undefined" ||
        document.visibilityState === "visible"
      ) {
        try {
          const d = await partnerApi<T>(path, { signal: ctl.signal });
          if (stop) return;
          setData(d);
          setError(null);
        } catch (e) {
          if (stop || (e as Error).name === "AbortError") return;
          setError(
            e instanceof PartnerApiError
              ? e
              : new PartnerApiError(0, "error", "Something went wrong."),
          );
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

  return {
    data,
    error,
    loading: data === null && error === null,
    reload,
    setData,
  };
}

/* ------------------------------------------------------------------ */
/* Links                                                               */
/* ------------------------------------------------------------------ */

/** Public origin for referral links: NEXT_PUBLIC_APP_URL, else this page's origin (same rule as the BFF). */
export function linkBase(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/+$/, "");
  return typeof window === "undefined" ? "" : window.location.origin;
}

export const referralLink = (base: string, code: string) => `${base}/r/${code}`;
export const campaignLink = (base: string, code: string, slug: string) =>
  slug ? `${base}/r/${code}/${slug}` : `${base}/r/${code}`;
export const shortUrl = (u: string) => u.replace(/^https?:\/\//, "");

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const MON = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

/** "Mon 5 Oct" (local time). */
export function fmtDay(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
}

/** "Mar 2024". */
export function fmtMonth(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : `${MON[d.getMonth()]} ${d.getFullYear()}`;
}

/** Month name for a "YYYY-MM" key, e.g. "Sep". */
export function monthName(key: string, offset = 0) {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return "";
  return MON[(((m - 1 + offset) % 12) + 12) % 12]!;
}

export function relTime(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const m = Math.round((now - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 45) return `${d}d ago`;
  return `${Math.round(d / 30)}mo ago`;
}

export function fmtLots(v: number, digits = 2) {
  return v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** 12.5 -> "12.5", 12 -> "12". */
export function fmtPct(v: number) {
  return `${Number.isInteger(v) ? v : +v.toFixed(2)}%`;
}

/** "$5" / "$13.50" */
export function fmtRate(v: number) {
  return `$${v % 1 ? v.toFixed(2) : v.toFixed(0)}`;
}

export const SCHEDULE_LABEL: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};
export const scheduleLabel = (s: string) => SCHEDULE_LABEL[s] ?? s;

export const KIND_LABEL: Record<string, string> = {
  lot: "Lot commission",
  split: "Sub-IB split",
  rebate: "Rebate",
  cpa: "CPA bonus",
  clawback: "Clawback",
  adjustment: "Adjustment",
};
export const kindLabel = (k: string) => KIND_LABEL[k] ?? k.replace(/_/g, " ");

export const SOURCE_LABEL: Record<string, string> = {
  engine: "",
  pamm: "PAMM",
  copy: "Copy trading",
};
