// Prop data for the app: the Client Area prop BFF through /api/mobile/prop/* (a rewrite of the web's /api/prop/*,
// so ownership, validation and the payment / payout rules are the very same server code). Screen data opens on
// the on-device cache (useQuery persist) and refreshes in the background; money actions (buy, request a payout)
// call the server directly and only ever show its answer.
import * as React from "react";
import { apiGet, apiPost, type ApiError, type ApiResult } from "@/lib/api";
import { invalidate, prefetch, useQuery } from "@/lib/query";
import { i18n, type MessageKey } from "@/i18n";
import { useSession } from "@/session";
import type { Certificate, Challenge, ChallengeDetail, EquityPoint, Payout, PayoutsData, Plan, PlanType, PurchaseResult, Trade } from "./types";

/* ------------------------------------------------------------------ */
/* Keys + fetchers                                                     */
/* ------------------------------------------------------------------ */

export const PROP_KEY = {
  plans: "prop/plans",
  challenges: "prop/challenges",
  challenge: (id: number) => `prop/challenge/${id}`,
  equity: (id: number, phase: number) => `prop/equity/${id}/${phase}`,
  trades: (id: number, phase: number) => `prop/trades/${id}/${phase}`,
  payouts: "prop/payouts",
  certificates: "prop/certificates",
  wallet: "prop/wallet",
} as const;

export type WalletOverview = { balances: { currency: string; available: string; locked?: string }[] };

export const fetchPlans = () => apiGet<{ plans: Plan[] }>("prop/plans");
export const fetchChallenges = () => apiGet<{ challenges: Challenge[] }>("prop/challenges");
export const fetchChallenge = (id: number) => apiGet<ChallengeDetail>(`prop/challenges/${id}`);
export const fetchEquity = (id: number, phase: number) => apiGet<{ points: EquityPoint[]; initialBalance: number }>(`prop/challenges/${id}/equity?phase=${phase}&limit=2000`);
export const fetchTrades = (id: number, phase: number) => apiGet<{ trades: Trade[] }>(`prop/challenges/${id}/trades?phase=${phase}`);
export const fetchPayouts = () => apiGet<PayoutsData>("prop/payouts");
export const fetchCertificates = () => apiGet<{ certificates: Certificate[] }>("prop/certificates");
const fetchWallet = () => apiGet<WalletOverview>("wallet/overview");

/* ------------------------------------------------------------------ */
/* Screen hooks                                                        */
/* ------------------------------------------------------------------ */

export const usePlans = () => useQuery(PROP_KEY.plans, fetchPlans, { persist: true, staleMs: 5 * 60_000 });

/** `poll`: refresh every 20 s while the screen is in front (statuses move on their own: opening, pass, breach). */
export const useChallenges = (poll = false) => useQuery(PROP_KEY.challenges, fetchChallenges, { persist: true, staleMs: 10_000, intervalMs: poll ? 20_000 : undefined });

export const useChallenge = (id: number | null, intervalMs?: number) =>
  useQuery(id === null ? null : PROP_KEY.challenge(id), () => fetchChallenge(id ?? 0), { persist: true, staleMs: 3_000, intervalMs });

export const useEquity = (id: number, phase: number, intervalMs?: number) =>
  useQuery(PROP_KEY.equity(id, phase), () => fetchEquity(id, phase), { persist: true, staleMs: 30_000, intervalMs });

export const useTrades = (id: number, phase: number, intervalMs?: number) =>
  useQuery(PROP_KEY.trades(id, phase), () => fetchTrades(id, phase), { persist: true, staleMs: 15_000, intervalMs });

export const usePayouts = (poll = false) => useQuery(PROP_KEY.payouts, fetchPayouts, { persist: true, staleMs: 10_000, intervalMs: poll ? 20_000 : undefined });

export const useCertificates = () => useQuery(PROP_KEY.certificates, fetchCertificates, { persist: true, staleMs: 60_000 });

/** The USDT wallet balance the checkout compares with the fee (never cached on the device: money). */
export const useWalletUsdt = (enabled: boolean) => {
  const q = useQuery(enabled ? PROP_KEY.wallet : null, fetchWallet, { staleMs: 5_000 });
  const row = q.data?.balances.find((b) => b.currency === "USDT");
  const available = q.data ? Number(row?.available ?? 0) : null;
  return { available: available !== null && Number.isFinite(available) ? available : null, loading: q.loading, error: q.error, refresh: q.refresh };
};

/**
 * The same reference while the data is unchanged. Polls hand back a new object each time; with this, a poll that
 * brings nothing new re-renders nothing below the screen (sections are memoised on these references).
 */
export function useStable<T>(value: T): T {
  const ref = React.useRef<{ v: T; s: string } | null>(null);
  const s = value === undefined ? "" : JSON.stringify(value);
  if (!ref.current || ref.current.s !== s) ref.current = { v: value, s };
  return ref.current.v;
}

/**
 * A view-only login (D90) or a read-only staff session ("Log in as client"): the screens keep every number but no
 * purchase or payout request is offered (the proxy refuses them with viewer_read_only / staff_read_only anyway).
 */
export function useReadOnly(): boolean {
  const viewer = useSession((s) => !!s.viewer);
  const staffReadOnly = useSession((s) => (s.user as { impersonation?: { mode?: string } | null } | null)?.impersonation?.mode === "read_only");
  return viewer || staffReadOnly;
}

/** Warm Prop home (the plans and the client's challenges) from a link elsewhere (the More tab), on press-in. */
export function prefetchHome() {
  prefetch(PROP_KEY.plans, fetchPlans, { persist: true, staleMs: 5 * 60_000 });
  prefetch(PROP_KEY.challenges, fetchChallenges, { persist: true, staleMs: 10_000 });
}

/** Warm a challenge before its dashboard opens (press-in on a card). */
export function prefetchChallenge(id: number) {
  prefetch(PROP_KEY.challenge(id), () => fetchChallenge(id), { persist: true, staleMs: 3_000 });
}

/** Warm the wallet balance before the checkout opens (press-in on Start). */
export function prefetchWallet() {
  prefetch(PROP_KEY.wallet, fetchWallet, { staleMs: 5_000 });
}

export function prefetchPayouts() {
  prefetch(PROP_KEY.payouts, fetchPayouts, { persist: true, staleMs: 10_000 });
}

export function prefetchCertificates() {
  prefetch(PROP_KEY.certificates, fetchCertificates, { persist: true, staleMs: 60_000 });
}

/* ------------------------------------------------------------------ */
/* Money actions (never optimistic)                                     */
/* ------------------------------------------------------------------ */

/** Buys a challenge. `key` is one per checkout: a retry reuses it, so the fee is never charged twice. */
export function purchaseChallenge(planId: string, size: number, key: string): Promise<ApiResult<PurchaseResult>> {
  return apiPost<PurchaseResult>("prop/challenges", { planId, size, idempotencyKey: key }, { timeoutMs: 45_000 });
}

/** Requests the whole current profit of a funded account (the quote the server shows). */
export function requestPayout(challengeId: number): Promise<ApiResult<{ payout: Payout }>> {
  return apiPost<{ payout: Payout }>(`prop/challenges/${challengeId}/payouts`, {}, { timeoutMs: 30_000 });
}

/** After a refused payout request: the quote on screen may be out of date (a position opened, a request in review). */
export function refreshPayouts() {
  invalidate(PROP_KEY.payouts);
}

/** After a confirmed purchase or payout: prop screens, the wallet and the accounts list refresh. */
export function refreshAfterMoney() {
  invalidate("prop/");
  invalidate("wallet");
  invalidate("trading/accounts");
}

/* ------------------------------------------------------------------ */
/* Errors in the reader's language                                     */
/* ------------------------------------------------------------------ */

const FRIENDLY: Record<string, MessageKey> = {
  insufficient_funds: "mobileProp.error.insufficientFunds",
  kyc_required: "mobileProp.error.kycRequired",
  payment_pending: "mobileProp.error.paymentPending",
  payment_failed: "mobileProp.error.paymentFailed",
  wallet_not_found: "mobileProp.error.paymentFailed",
  wallet_pending: "mobileProp.error.walletPending",
  wallet_rejected: "mobileProp.error.walletRejected",
  provisioning: "mobileProp.error.provisioning",
  plan_unavailable: "mobileProp.error.planUnavailable",
  not_yet_eligible: "mobileProp.error.notYetEligible",
  below_minimum: "mobileProp.error.belowMinimum",
  positions_open: "mobileProp.error.positionsOpen",
  payout_pending: "mobileProp.error.payoutPending",
  consistency: "mobileProp.error.consistency",
  not_funded: "mobileProp.error.notFunded",
  account_unavailable: "mobileProp.error.accountUnavailable",
  idempotency_conflict: "mobileProp.error.idempotencyConflict",
  not_active: "mobileProp.error.notActive",
  account_limit: "mobileProp.error.accountLimit",
  staff_read_only: "mobileProp.error.staffReadOnly",
  viewer_read_only: "mobile.viewOnlyBody",
  viewer_scope: "mobile.viewOnlyBody",
};

/** Codes that need a step outside the prop screens: the error shows a button for it. */
export const ERROR_LINK: Record<string, { href: "/wallet/deposit" | "/profile/verification"; label: MessageKey }> = {
  insufficient_funds: { href: "/wallet/deposit", label: "mobileProp.errorLink.deposit" },
  kyc_required: { href: "/profile/verification", label: "mobileProp.errorLink.verify" },
};

/** Codes where the service's own wording is the useful one (it carries dates and amounts). */
const PREFER_SERVICE = new Set(["not_yet_eligible", "below_minimum", "consistency", "positions_open", "payout_pending"]);

/** The message to show for a prop error. The app's api() has already localised the shared codes. */
export function propMessage(e: ApiError | undefined | null): string {
  const t = i18n.t;
  if (!e) return t("mobileProp.error.generic");
  if (PREFER_SERVICE.has(e.code) && e.message && i18n.locale === "en") return e.message;
  const key = FRIENDLY[e.code];
  if (key) return t(key);
  if (e.code.startsWith("engine_")) return t("mobileProp.error.engine");
  return e.message || t("mobileProp.error.generic");
}

/** Soft outcomes, final refusals (a new idempotency key) and ended purchases: see ./lib (tested there). */
export { endedPurchase, isFinalRefusal, isSoftError } from "./lib";

/* ------------------------------------------------------------------ */
/* Plans                                                               */
/* ------------------------------------------------------------------ */

const TYPE_ORDER: PlanType[] = ["2-step", "1-step", "instant"];

/** Active plans with their enabled sizes (ascending), classic 2-step first. */
export function normalizePlans(plans: Plan[] | undefined): Plan[] {
  return (plans ?? [])
    .map((p) => ({ ...p, sizes: p.sizes.filter((s) => s.enabled !== false).sort((a, b) => a.size - b.size) }))
    .filter((p) => p.sizes.length > 0)
    .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.name.localeCompare(b.name));
}

/** The size a plan card starts on: $50K when offered (the most popular size), else the middle one. */
export function defaultSize(p: Plan): number {
  return (p.sizes.find((s) => s.size === 50_000) ?? p.sizes[Math.floor((p.sizes.length - 1) / 2)] ?? p.sizes[0])?.size ?? 0;
}

/** Active and funded challenges first, then the ones opening, then the rest; newest first inside each group. */
export function sortChallenges(list: Challenge[] | undefined): Challenge[] {
  const rank = (c: Challenge) => (c.status === "active" || c.status === "funded" ? 0 : c.status === "provisioning" || c.status === "pending_payment" ? 1 : 2);
  return [...(list ?? [])].sort((a, b) => rank(a) - rank(b) || b.id - a.id);
}

export const isOpenChallenge = (c: Challenge) => c.status === "active" || c.status === "funded" || c.status === "provisioning" || c.status === "pending_payment";
