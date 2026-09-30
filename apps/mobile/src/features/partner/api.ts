// Partner (IB) data for the app: the Client Area partner BFF through the bearer rewrite /api/mobile/partner/*
// (apps/crm/app/api/partner/[[...path]]/route.ts -> services/ib /v1/ib/me/*). The server resolves the partner
// from the session, applies the broker's client-visibility setting and refuses view-only / read-only staff writes;
// the app only reads, shows and asks.
// - Screens open on the last answer kept on the phone (useQuery persist), then refresh.
// - Writes (rebate / split, campaign links) are never optimistic: the screens show the server's answer.
import * as React from "react";
import { api, apiGet, type ApiError } from "@/lib/api";
import { invalidate, prefetch, setQueryData, useQuery } from "@/lib/query";
import { i18n } from "@/i18n";
import { useSession } from "@/session";
import type { Campaign, CampaignsResp, ClientsResp, ClientTrade, CommissionRow, CommissionsResp, Dashboard, PayoutsResp } from "./types";

export const PARTNER_KEYS = {
  dash: "partner/dash",
  clients: "partner/clients",
  trades: (id: number) => `partner/clients/${id}/trades`,
  commissions: (status: string, kind: string) => `partner/commissions/${status}/${kind}`,
  payouts: "partner/payouts",
  campaigns: "partner/campaigns",
} as const;

const fetchDash = () => apiGet<Dashboard>("partner");
const fetchClients = () => apiGet<ClientsResp>("partner/clients");
const fetchTrades = (id: number) => apiGet<{ items: ClientTrade[] }>(`partner/clients/${id}/trades`);
const fetchPayouts = () => apiGet<PayoutsResp>("partner/payouts");
const fetchCampaigns = () => apiGet<CampaignsResp>("partner/campaigns");

export const COMMISSIONS_PAGE = 50;

function commissionsPath(status: string, kind: string, page: number) {
  const q = new URLSearchParams({ page: String(page), limit: String(COMMISSIONS_PAGE) });
  if (status !== "all") q.set("status", status);
  if (kind !== "all") q.set("kind", kind);
  return `partner/commissions?${q}`;
}
const fetchCommissions = (status: string, kind: string, page: number) => apiGet<CommissionsResp>(commissionsPath(status, kind, page));

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export function usePartnerDashboard() {
  return useQuery(PARTNER_KEYS.dash, fetchDash, { persist: true, staleMs: 45_000 });
}

export function useNetworkClients() {
  return useQuery(PARTNER_KEYS.clients, fetchClients, { persist: true, staleMs: 45_000 });
}

export function useClientTrades(id: number | null, enabled = true) {
  return useQuery(id === null ? null : PARTNER_KEYS.trades(id), () => fetchTrades(id!), { persist: true, staleMs: 30_000, enabled });
}

/** `enabled: false` for a view-only login (payouts and campaign links aren't shared with viewers). */
export function usePayouts(enabled = true) {
  return useQuery(PARTNER_KEYS.payouts, fetchPayouts, { persist: true, staleMs: 45_000, enabled });
}

export function useCampaigns(enabled = true) {
  return useQuery(PARTNER_KEYS.campaigns, fetchCampaigns, { persist: true, staleMs: 45_000, enabled });
}

/** Warm a screen's data while the finger is still on the row that opens it. */
export const prefetchPartner = {
  dash: () => prefetch(PARTNER_KEYS.dash, fetchDash, { persist: true, staleMs: 45_000 }),
  clients: () => prefetch(PARTNER_KEYS.clients, fetchClients, { persist: true, staleMs: 45_000 }),
  trades: (id: number) => prefetch(PARTNER_KEYS.trades(id), () => fetchTrades(id), { persist: true, staleMs: 30_000 }),
  commissions: () => prefetch(PARTNER_KEYS.commissions("all", "all"), () => fetchCommissions("all", "all", 1), { persist: true, staleMs: 30_000 }),
  payouts: () => prefetch(PARTNER_KEYS.payouts, fetchPayouts, { persist: true, staleMs: 45_000 }),
  campaigns: () => prefetch(PARTNER_KEYS.campaigns, fetchCampaigns, { persist: true, staleMs: 45_000 }),
};

/**
 * The commission ledger for a status / kind filter: the first page comes from the cache (kept on the phone for the
 * unfiltered view), further pages are fetched as the list nears its end and appended (deduplicated by line id).
 */
type Extra = { key: string; base: CommissionsResp | undefined; page: number; items: CommissionRow[]; loading: boolean; error: ApiError | null; end: boolean };

export function useCommissionLedger(status: string, kind: string) {
  const key = PARTNER_KEYS.commissions(status, kind);
  const first = useQuery(key, () => fetchCommissions(status, kind, 1), { persist: status === "all" && kind === "all", staleMs: 30_000 });
  const [extra, setExtra] = React.useState<Extra | null>(null);
  // a new first page (another filter, a refresh) starts the extra pages over
  const cur: Extra = extra && extra.key === key && extra.base === first.data ? extra : { key, base: first.data, page: 1, items: [], loading: false, error: null, end: false };
  const curRef = React.useRef(cur);
  curRef.current = cur;
  const inflight = React.useRef(false);
  const total = first.data?.total ?? 0;
  const loaded = (first.data?.items.length ?? 0) + cur.items.length;
  const hasMore = !!first.data && loaded < total && !cur.end;

  const loadMore = React.useCallback(async () => {
    const base = curRef.current;
    if (!base.base || inflight.current || base.end || base.base.items.length + base.items.length >= base.base.total) return;
    inflight.current = true;
    const next = base.page + 1;
    setExtra({ ...base, loading: true, error: null });
    const r = await fetchCommissions(status, kind, next);
    inflight.current = false;
    setExtra((s) => {
      // the filter or the first page changed meanwhile: this answer belongs to an older list
      if (!s || s.key !== base.key || s.base !== base.base) return s;
      if (!r.ok) return { ...s, loading: false, error: r.error };
      const seen = new Set([...(base.base?.items ?? []), ...s.items].map((x) => x.id));
      const fresh = r.data.items.filter((x) => !seen.has(x.id));
      return { ...s, page: next, loading: false, items: fresh.length ? [...s.items, ...fresh] : s.items, end: fresh.length === 0 };
    });
  }, [status, kind]);

  const items = React.useMemo(() => (first.data ? (cur.items.length ? [...first.data.items, ...cur.items] : first.data.items) : undefined), [first.data, cur.items]);
  return { ...first, items, totals: first.data?.totals, total, hasMore, loadingMore: cur.loading, moreError: cur.error, loadMore };
}

/* ------------------------------------------------------------------ */
/* Who may change things                                               */
/* ------------------------------------------------------------------ */

/** A view-only login (D90): the Client Area keeps payouts and campaign links out of its reach (lib/viewer.ts). */
export const useViewer = () => useSession((s) => !!s.viewer);

/** View-only logins and read-only staff sessions can look but not change anything (the server refuses too). */
export function useReadOnly(): boolean {
  const viewer = useSession((s) => !!s.viewer);
  const staffReadOnly = useSession((s) => (s.user as { impersonation?: { mode?: string } | null } | null)?.impersonation?.mode === "read_only");
  return viewer || staffReadOnly;
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

/** Rebate to own clients and split with sub-IBs (applies to deals closed from now on). */
export async function saveRates(rebatePct: number, splitPct: number) {
  const r = await api<{ rebatePct: number; splitPct: number }>("partner/settings", { method: "PUT", body: { rebatePct, splitPct } });
  if (r.ok) setQueryData<Dashboard>(PARTNER_KEYS.dash, (d) => (d ? { ...d, member: { ...d.member, rebatePct: r.data.rebatePct, splitPct: r.data.splitPct } } : d!), true);
  return r;
}

export type NewCampaign = { name: string; slug?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string };

export async function createCampaign(body: NewCampaign) {
  const r = await api<{ id: number; slug: string; name: string; landing: string }>("partner/campaigns", { method: "POST", body });
  if (r.ok) {
    // the new link shows at once with empty stats; the refetch fills them in
    const c: Campaign = { id: r.data.id, slug: r.data.slug, name: r.data.name, landing: r.data.landing, utmSource: body.utmSource ?? null, utmMedium: body.utmMedium ?? null, utmCampaign: body.utmCampaign ?? null, active: true, createdAt: new Date().toISOString(), clicks: 0, uniqueClicks: 0, signups: 0, ftds: 0, deposits: 0, lots: 0, trend: [] };
    setQueryData<CampaignsResp>(PARTNER_KEYS.campaigns, (d) => (d ? { ...d, items: [c, ...d.items.filter((x) => x.id !== c.id)] } : d!), true);
    invalidate(PARTNER_KEYS.campaigns);
  }
  return r;
}

/** Pauses or resumes a campaign link (a paused link still counts clicks but no longer attributes the campaign). */
export async function setCampaignActive(c: Campaign, active: boolean) {
  const r = await api<{ status: string }>(`partner/campaigns/${c.id}`, { method: "PATCH", body: { active } });
  if (r.ok) setQueryData<CampaignsResp>(PARTNER_KEYS.campaigns, (d) => (d ? { ...d, items: d.items.map((x) => (x.id === c.id ? { ...x, active } : x)) } : d!), true);
  return r;
}

/** Pull to refresh on the dashboard: every partner view refetches. */
export function refreshPartner() {
  invalidate("partner/");
}

/* ------------------------------------------------------------------ */
/* Errors in the reader's language                                     */
/* ------------------------------------------------------------------ */

const CODES = new Set(["viewer_read_only", "viewer_scope", "staff_read_only", "module_disabled", "maintenance", "not_ready", "unavailable", "limit", "exists", "forbidden"]);

export function partnerError(e: ApiError): string {
  const t = i18n.t;
  if (CODES.has(e.code)) return t.dyn(`mobilePartner.error.${e.code}`, e.message);
  return e.message || t("common.errorRetry");
}
