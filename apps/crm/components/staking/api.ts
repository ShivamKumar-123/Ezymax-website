"use client";

// Browser side of the staking BFF (app/api/staking/[[...path]]/route.ts). Demo builds answer from
// @ezymex/mock/staking with the same shapes, so the pages are one set of components. Shapes:
// services/staking/README.md.

import * as React from "react";
import type { MessageKey } from "@ezymex/i18n";
import { tr } from "@ezymex/i18n/react";
import { IS_DEMO } from "@ezymex/mock/mode";
import { readCached, writeCached } from "@ezymex/ui/swr-cache";

/* ------------------------------------------------------------------ */
/* Service shapes                                                      */
/* ------------------------------------------------------------------ */

export interface RecentRate {
  period: string;
  ratePct: number;
}

export interface Plan {
  id: number;
  name: string;
  currency: string;
  status: "active" | "paused";
  termMonths: number;
  minAmount: number;
  maxAmount: number | null;
  perUserMax: number | null;
  capacityLeft: number | null;
  full: boolean;
  invested: number;
  /** The most this client can still subscribe (per subscription, own limit, capacity); null = no limit. */
  maxNow: number | null;
  description: string;
  riskText: string;
  version: number;
  recentRates: RecentRate[];
}

export interface PlansDoc {
  plans: Plan[];
  currencies: string[];
  currentPeriod: string;
  nextPayoutAfter: string;
  serverTime: string;
}

export type PositionStatus = "pending_payment" | "payment_failed" | "active" | "matured";

export interface Position {
  id: number;
  planId: number;
  planName: string;
  currency: string;
  termMonths: number;
  principal: number;
  status: PositionStatus;
  startedAt: string | null;
  maturesAt: string | null;
  maturedAt: string | null;
  returnsPaid: number;
  daysTotal: number;
  daysElapsed: number;
  failureReason: string | null;
  lastReturn: { period: string; ratePct: number; amount: number } | null;
  termsAcceptedAt: string;
  riskAcknowledgedAt: string;
  createdAt: string;
}

export interface Portfolio {
  summary: {
    currency: string;
    invested: number;
    pending: number;
    returnsPaid: number;
    returnsThisYear: number;
    activePositions: number;
    nextPayout: { period: string; after: string } | null;
    nextMaturity: { positionId: number; planName: string; date: string; principal: number } | null;
  };
  positions: Position[];
  monthly: { period: string; amount: number }[];
  serverTime: string;
}

export interface MonthReturn {
  period: string;
  ratePct: number;
  daysActive: number;
  daysInMonth: number;
  amount: number;
  status: "paid" | "pending" | "processing";
  paidAt: string | null;
}

export interface PositionDetail {
  position: Position;
  terms: { name: string; termMonths: number; currency: string; minAmount: number; maxAmount: number | null; description: string; riskText: string };
  returns: MonthReturn[];
}

export type HistoryKind = "subscribe" | "reward" | "principal" | "payment_failed";

export interface HistoryItem {
  kind: HistoryKind;
  at: string | null;
  positionId: number;
  planName: string;
  amount: number;
  currency: string;
  period: string | null;
  ratePct: number | null;
  days: number | null;
}

export interface HistoryDoc {
  items: HistoryItem[];
  total: number;
  page: number;
  limit: number;
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export class StakingError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const FRIENDLY: Record<string, MessageKey> = {
  unavailable: "staking.error.unavailable",
  kyc_required: "staking.error.kycRequired",
  wallet_restricted: "staking.error.walletRestricted",
  account_unavailable: "staking.error.accountUnavailable",
  insufficient_funds: "staking.error.insufficientFunds",
  plan_unavailable: "staking.error.planUnavailable",
  capacity_reached: "staking.error.capacityReached",
  user_limit: "staking.error.userLimit",
  below_minimum: "staking.error.belowMinimum",
  above_maximum: "staking.error.aboveMaximum",
  terms_required: "staking.error.termsRequired",
  risk_ack_required: "staking.error.riskRequired",
  payment_pending: "staking.error.paymentPending",
  payment_failed: "staking.error.paymentFailed",
  idempotency_conflict: "staking.error.idempotencyConflict",
};

/** The next step for an error code. */
export const ERROR_LINK: Record<string, { href: string; labelKey: MessageKey }> = {
  kyc_required: { href: "/profile/verification", labelKey: "staking.errorLink.verify" },
  insufficient_funds: { href: "/wallet/deposit", labelKey: "staking.errorLink.deposit" },
};

/* ------------------------------------------------------------------ */
/* Fetching                                                            */
/* ------------------------------------------------------------------ */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Demo builds: the mock data for a GET path. */
async function demoGet(path: string): Promise<unknown> {
  const m = await import("@ezymex/mock/staking");
  await sleep(150);
  const [route] = path.split("?");
  if (route === "plans") return m.STAKING_PLANS;
  if (route === "portfolio") return m.STAKING_PORTFOLIO;
  if (route === "positions") return { items: m.STAKING_POSITIONS };
  if (route === "history") {
    const items = [...m.STAKING_HISTORY.items].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
    return { ...m.STAKING_HISTORY, items };
  }
  const id = /^positions\/(\d+)$/.exec(route ?? "")?.[1];
  const position = m.STAKING_POSITIONS.find((p) => String(p.id) === id);
  if (position) {
    const plan = m.STAKING_PLANS.plans.find((p) => p.id === position.planId)!;
    return { position, terms: { ...plan }, returns: m.STAKING_RETURNS[position.id as number] ?? [] };
  }
  throw new StakingError(404, "not_found", tr("staking.error.generic"));
}

export async function stakingApi<T>(path: string, init?: { body?: unknown; signal?: AbortSignal }): Promise<T> {
  if (IS_DEMO) {
    if (init?.body !== undefined) throw new StakingError(0, "demo", tr("staking.error.generic"));
    return (await demoGet(path)) as T;
  }
  const method = init?.body !== undefined ? "POST" : "GET";
  let res: Response;
  try {
    res = await fetch(`/api/staking/${path}`, {
      method,
      headers: method === "POST" ? { "content-type": "application/json" } : undefined,
      body: method === "POST" ? JSON.stringify(init?.body ?? {}) : undefined,
      cache: "no-store",
      signal: init?.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new StakingError(0, "network", tr("staking.error.network"));
  }
  const data = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.assign(`/api/auth/expired?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
    const code = data.error?.code ?? "error";
    throw new StakingError(res.status, code, FRIENDLY[code] ? tr(FRIENDLY[code]) : (data.error?.message ?? tr("staking.error.generic")));
  }
  return data as T;
}

/** Polls `path` every `ms` while the tab is visible (0 = once). Opened again, a page starts from this tab's last
 *  answer while it refetches (@ezymex/ui/swr-cache). */
export function useStaking<T>(path: string | null, ms = 0) {
  const [data, setData] = React.useState<T | null>(() => (path ? (readCached<T>(`staking:${path}`) ?? null) : null));
  const [error, setError] = React.useState<StakingError | null>(null);
  const [tick, setTick] = React.useState(0);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    if (!path) return;
    const cached = readCached<T>(`staking:${path}`);
    if (cached !== undefined) setData(cached);
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ctl = new AbortController();
    const run = async () => {
      if (stop) return;
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        try {
          const d = await stakingApi<T>(path, { signal: ctl.signal });
          if (stop) return;
          setData(d);
          writeCached(`staking:${path}`, d);
          setError(null);
        } catch (e) {
          if (stop || (e as Error).name === "AbortError") return;
          setError(e instanceof StakingError ? e : new StakingError(0, "error", tr("staking.error.generic")));
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

  return { data, error, loading: data === null && error === null, reload };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** A fresh idempotency key per opened subscribe dialog (a retry reuses it, so nobody subscribes twice). */
export function newKey() {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return `web-${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** "2026-09" → a date in the middle of that month (for Intl month labels; months are server time). */
export function periodDate(p: string): Date {
  const [y, m] = p.split("-").map(Number);
  return new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, 15, 12));
}

/** Maturity of a subscription started today: the same day `months` later (server time, GMT+3). */
export function maturityFrom(months: number, from = Date.now()): Date {
  const s = new Date(from + 3 * 3_600_000);
  const day = s.getUTCDate();
  const target = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + months, 1, 12));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return target;
}

export const STATUS_TONE: Record<PositionStatus, "warn" | "down" | "up" | "neutral"> = {
  pending_payment: "warn",
  payment_failed: "down",
  active: "up",
  matured: "neutral",
};
