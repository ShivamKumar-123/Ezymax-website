// Rewards data for the app: the Client Area growth BFF through the bearer rewrite /api/mobile/growth/*
// (apps/crm/app/api/growth/[[...path]]/route.ts -> services/growth /v1/growth/me/*). The server takes the client
// and their segment (country, KYC, sign-up date) from the session and checks every rule: points balance, tier and
// stock on redemptions, eligibility and claim limits on bonuses, promo-code limits, contest windows and accounts.
// - Screens open on the last answer kept on the phone (useQuery persist), then refresh.
// - Writes are never optimistic: the screens show the server's answer, then the affected views refetch.
import { api, apiGet, type ApiError } from "@/lib/api";
import { i18n } from "@/i18n";
import { invalidate, prefetch, setQueryData, useQuery } from "@/lib/query";
import { rewardsTextWith } from "./lib";
import type { BannerView, CashbackMe, ContestDetail, ContestsResp, Grant, JoinResult, PointsPage, PromoResult, Promotions, Redemption, Rewards, Share, Voucher } from "./types";

/** Applies the server's confirmed answer to a cached view at once (the refetch that follows fills in the rest). */
function patch<T>(key: string, fn: (d: T) => T) {
  setQueryData<T>(key, (d) => (d === undefined ? (d as unknown as T) : fn(d)), true);
}

export const REWARDS_KEYS = {
  rewards: "growth/rewards",
  contests: "growth/contests",
  contest: (id: string | number) => `growth/contests/${id}`,
  cashback: "growth/cashback",
  promotions: "growth/promotions",
  points: (kind: string) => `growth/points/${kind}`,
  redemptions: "growth/redemptions",
  vouchers: "growth/vouchers",
  shares: "growth/shares",
  banners: (placement: string) => `growth/banners/${placement}`,
} as const;

const fetchRewards = () => apiGet<Rewards>("growth/rewards");
const fetchContests = () => apiGet<ContestsResp>("growth/contests");
const fetchContest = (id: string | number) => apiGet<ContestDetail>(`growth/contests/${encodeURIComponent(String(id))}`);
const fetchCashback = () => apiGet<CashbackMe>("growth/cashback");
const fetchPromotions = () => apiGet<Promotions>("growth/promotions");
const fetchPoints = (kind: string) => apiGet<PointsPage>(`growth/points?page=1&limit=100${kind === "all" ? "" : `&kind=${encodeURIComponent(kind)}`}`);
const fetchRedemptions = () => apiGet<{ items: Redemption[] }>("growth/redemptions");
const fetchVouchers = () => apiGet<{ items: Voucher[] }>("growth/vouchers");
const fetchShares = () => apiGet<{ items: Share[] }>("growth/shares");
const fetchBanners = (placement: string) => apiGet<{ items: BannerView[] }>(`growth/banners?placement=${encodeURIComponent(placement)}`);

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export const useRewards = () => useQuery(REWARDS_KEYS.rewards, fetchRewards, { persist: true, staleMs: 45_000 });
export const useContests = () => useQuery(REWARDS_KEYS.contests, fetchContests, { persist: true, staleMs: 30_000 });
/** A running contest's leaderboard refreshes every 15 s while on screen (the service recomputes it as often). */
export const useContest = (id: string | null, live: boolean) => useQuery(id ? REWARDS_KEYS.contest(id) : null, () => fetchContest(id!), { persist: true, staleMs: 15_000, intervalMs: live ? 15_000 : undefined });
export const useCashback = () => useQuery(REWARDS_KEYS.cashback, fetchCashback, { persist: true, staleMs: 45_000 });
export const usePromotions = () => useQuery(REWARDS_KEYS.promotions, fetchPromotions, { persist: true, staleMs: 45_000 });
export const usePoints = (kind: string) => useQuery(REWARDS_KEYS.points(kind), () => fetchPoints(kind), { persist: kind === "all", staleMs: 45_000 });
export const useRedemptions = () => useQuery(REWARDS_KEYS.redemptions, fetchRedemptions, { persist: true, staleMs: 45_000 });
export const useVouchers = () => useQuery(REWARDS_KEYS.vouchers, fetchVouchers, { persist: true, staleMs: 45_000 });
export const useShares = () => useQuery(REWARDS_KEYS.shares, fetchShares, { persist: true, staleMs: 45_000 });
/** The broker's banners for a placement (targeted by the service on the client's country, KYC, accounts, age). */
export const useBanners = (placement: string, enabled = true) => useQuery(REWARDS_KEYS.banners(placement), () => fetchBanners(placement), { persist: true, staleMs: 120_000, enabled });

export const prefetchRewards = {
  rewards: () => prefetch(REWARDS_KEYS.rewards, fetchRewards, { persist: true, staleMs: 45_000 }),
  contests: () => prefetch(REWARDS_KEYS.contests, fetchContests, { persist: true, staleMs: 30_000 }),
  contest: (id: number) => prefetch(REWARDS_KEYS.contest(id), () => fetchContest(id), { persist: true, staleMs: 15_000 }),
  cashback: () => prefetch(REWARDS_KEYS.cashback, fetchCashback, { persist: true, staleMs: 45_000 }),
  promotions: () => prefetch(REWARDS_KEYS.promotions, fetchPromotions, { persist: true, staleMs: 45_000 }),
  shares: () => prefetch(REWARDS_KEYS.shares, fetchShares, { persist: true, staleMs: 45_000 }),
  loyalty: () => {
    prefetch(REWARDS_KEYS.rewards, fetchRewards, { persist: true, staleMs: 45_000 });
    prefetch(REWARDS_KEYS.points("all"), () => fetchPoints("all"), { persist: true, staleMs: 45_000 });
  },
};

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

/** Redeems a catalogue item (a live account for a trading bonus). Points leave in the same transaction. */
export async function redeem(itemId: number, login?: number | null) {
  const r = await api<{ redemption: Redemption; balance: number }>("growth/redeem", { method: "POST", body: login ? { itemId, login } : { itemId } });
  if (r.ok) {
    const balance = r.data.balance;
    patch<Rewards>(REWARDS_KEYS.rewards, (d) => ({ ...d, points: { ...d.points, balance } }));
    invalidate(REWARDS_KEYS.rewards);
    invalidate("growth/points/");
    invalidate(REWARDS_KEYS.redemptions);
    invalidate(REWARDS_KEYS.vouchers);
    if (login) invalidate("trading/accounts");
  }
  return r;
}

export async function enrolCashback(programmeId: number) {
  const r = await api<{ enrolled: boolean }>(`growth/cashback/${programmeId}/enrol`, { method: "POST", body: {} });
  if (r.ok) {
    patch<CashbackMe>(REWARDS_KEYS.cashback, (d) => ({ ...d, programmes: d.programmes.map((p) => (p.id === programmeId ? { ...p, enrolled: true } : p)) }));
    invalidate(REWARDS_KEYS.cashback);
  }
  return r;
}

/** Claims a bonus offer (a live account for a fixed bonus; a deposit bonus waits for the qualifying deposit). */
export async function claimBonus(campaignId: number, login?: number | null) {
  const r = await api<{ grant: Grant }>(`growth/bonuses/${campaignId}/claim`, { method: "POST", body: login ? { login } : {} });
  if (r.ok) {
    const grant = r.data.grant;
    patch<Promotions>(REWARDS_KEYS.promotions, (d) => ({ ...d, campaigns: d.campaigns.map((c) => (c.id === campaignId ? { ...c, claimed: true, eligible: false } : c)), grants: [grant, ...d.grants.filter((g) => g.id !== grant.id)] }));
    invalidate(REWARDS_KEYS.promotions);
    if (login) invalidate("trading/accounts");
  }
  return r;
}

export async function applyPromo(code: string, login?: number | null) {
  const r = await api<PromoResult>("growth/promo", { method: "POST", body: login ? { code, login } : { code } });
  // a blocked attempt is logged in the history too
  invalidate(REWARDS_KEYS.promotions);
  if (r.ok) {
    const added = r.data.result.kind === "points" ? (r.data.result.points ?? 0) : 0;
    if (added) patch<Rewards>(REWARDS_KEYS.rewards, (d) => ({ ...d, points: { ...d.points, balance: d.points.balance + added } }));
    invalidate(REWARDS_KEYS.rewards);
    invalidate("growth/points/");
    invalidate(REWARDS_KEYS.vouchers);
  }
  return r;
}

/** Joins a contest: a live one on the chosen live account; a demo one opens a demo account (credentials once). */
export async function joinContest(id: number, login?: number | null) {
  const r = await api<JoinResult>(`growth/contests/${id}/join`, { method: "POST", body: login ? { login } : {}, timeoutMs: 30_000 });
  if (r.ok) {
    const entry = r.data.entry;
    patch<ContestDetail>(REWARDS_KEYS.contest(id), (d) => ({ ...d, myEntry: entry, entrants: d.myEntry ? d.entrants : d.entrants + 1 }));
    patch<ContestsResp>(REWARDS_KEYS.contests, (d) => ({ ...d, items: d.items.map((c) => (c.id === id ? { ...c, myEntry: entry, entrants: c.myEntry ? c.entrants : c.entrants + 1 } : c)) }));
    invalidate(REWARDS_KEYS.contests);
    invalidate(REWARDS_KEYS.contest(id));
    if (r.data.credentials) invalidate("trading/accounts");
  }
  return r;
}

export type ShareRequest = { kind: "period"; login: number; from: string; to: string; showAmounts: boolean } | { kind: "trade"; login: number; dealId: number; showAmounts: boolean };

export async function createShare(body: ShareRequest) {
  const r = await api<{ share: Share }>("growth/shares", { method: "POST", body });
  if (r.ok) invalidate(REWARDS_KEYS.shares);
  return r;
}

/** Counts a banner impression / click, or dismisses it for this client (it stays hidden on every device). Best effort. */
export async function bannerEvent(id: number, kind: "impression" | "click" | "dismiss", placement: string) {
  const r = await api<{ ok: boolean }>(`growth/banners/${id}/events`, { method: "POST", body: { kind } });
  if (r.ok && kind === "dismiss") patch<{ items: BannerView[] }>(REWARDS_KEYS.banners(placement), (d) => ({ ...d, items: d.items.filter((b) => b.id !== id) }));
  return r;
}

/** Pull to refresh on the rewards hub: every rewards view refetches. */
export function refreshRewards() {
  invalidate("growth/");
}

/* ------------------------------------------------------------------ */
/* Errors in the reader's language                                     */
/* ------------------------------------------------------------------ */

/** Access and service states: the app's own words. */
const CODES = new Set(["viewer_read_only", "viewer_scope", "staff_read_only", "module_disabled", "maintenance", "unavailable"]);

/** A server sentence (an error, an offer's "why not", a refused code's reason) in the reader's language. */
export const rewardsText = (message: string | null | undefined) => rewardsTextWith(i18n.t, message);

export function rewardsError(e: ApiError): string {
  const t = i18n.t;
  if (CODES.has(e.code)) return t.dyn(`mobileRewards.error.${e.code}`, e.message);
  if (e.message) return rewardsText(e.message);
  return t("common.errorRetry");
}
