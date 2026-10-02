// Server-only helpers for the growth service (services/growth, 127.0.0.1:8101): loyalty points, cashback,
// contests, bonuses, promo codes, banners and share cards. The browser never sees the service or its internal
// token: /api/growth/* resolves the signed-in client from the gateway session cookie and forwards the gateway
// user id plus the segment headers (country, KYC, sign-up date, name, referral code) the service targets on.

import type { GatewayUser } from "@/lib/gateway";

const GROWTH_URL = (process.env.GROWTH_URL ?? "http://127.0.0.1:8101").replace(/\/+$/, "");
const GROWTH_TOKEN = process.env.GROWTH_INTERNAL_TOKEN ?? "";

export type GrowthResult<T = Record<string, unknown>> = { status: number; data: T };

const UNAVAILABLE = { error: { code: "unavailable", message: "The rewards service is unavailable. Please try again shortly." } };

/** Segment headers the growth service reads (and uses to refresh the client's profile row). */
function userHeaders(user: GatewayUser): Record<string, string> {
  const h: Record<string, string> = { "x-kalks-user-id": String(user.id) };
  if (user.country) h["x-kalks-country"] = user.country;
  if (user.kyc_status) h["x-kalks-kyc"] = user.kyc_status;
  if (user.created_at) h["x-kalks-created-at"] = user.created_at;
  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  if (name) h["x-kalks-name"] = encodeURIComponent(name);
  if (user.referral_code) h["x-kalks-referral-code"] = user.referral_code;
  return h;
}

export async function growth<T = Record<string, unknown>>(
  path: string,
  init: { method?: "GET" | "POST" | "PUT" | "PATCH"; body?: unknown; user?: GatewayUser; tenant?: string; timeoutMs?: number } = {},
): Promise<GrowthResult<T>> {
  const headers: Record<string, string> = { "x-kalks-internal": GROWTH_TOKEN, "x-kalks-tenant": init.tenant || init.user?.tenant?.slug || "kalks" };
  if (init.user) Object.assign(headers, userHeaders(init.user));
  if (init.body !== undefined) headers["content-type"] = "application/json";
  try {
    const res = await fetch(`${GROWTH_URL}${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs ?? 15_000),
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, data };
  } catch {
    return { status: 503, data: UNAVAILABLE as T };
  }
}

/* ------------------------------------------------------------------ */
/* Public share cards (/s/<code>, no sign-in)                          */
/* ------------------------------------------------------------------ */

export type ShareData = {
  name: string;
  symbol: string | null;
  side: "buy" | "sell" | string | null;
  openPrice: number | null;
  closePrice: number | null;
  openTime: string | null;
  closeTime: string | null;
  movePct: number | null;
  returnPct: number | null;
  trades: number | null;
  winRate: number | null;
  lots: number | null;
  /** Only present when the client opted in to showing amounts. */
  profit: number | null;
  currency: string;
  from: string | null;
  to: string | null;
  referralCode: string | null;
  brand: string;
  /** "option" on an options share card (O36): then `contracts` and `option` are set and `lots` is null. */
  instrument?: "option" | string;
  contracts?: number | null;
  option?: ShareOption;
};

/** Options share card terms and premiums (services/growth shares.rs option_card). Premiums are USD per contract;
 *  `pnlPct` is the P&L on the opening premium; `breakeven` / `settle` are underlying prices for the payoff sketch. */
export type ShareOption = {
  series: string;
  underlying: string;
  right: "call" | "put";
  strike: number | null;
  expiry: string | null;
  style: string;
  side: "buy" | "sell" | string;
  contracts: number;
  entryPremium: number | null;
  exitPremium: number | null;
  pnlPct: number | null;
  reason: "closed" | "expired" | "knocked_out" | "stop_out" | "sl" | "tp" | string;
  openPremiumUnit?: number | null;
  closePremiumUnit?: number | null;
  breakeven: number | null;
  settle: number | null;
};

/** The strike of an options share card as its series code writes it ("1.1650", "150.00"), else the number. */
export function optionStrikeLabel(o: Pick<ShareOption, "series" | "strike">): string {
  const m = /^[A-Za-z0-9]+-\d{8}-(\d+(?:\.\d+)?)-[CPcp]$/.exec(o.series ?? "");
  if (m && o.strike !== null && Math.abs(Number(m[1]) - o.strike) < 1e-9) return m[1]!;
  if (o.strike === null || !Number.isFinite(o.strike)) return "";
  return String(+o.strike.toFixed(6));
}

export type PublicShare = {
  code: string;
  kind: "trade" | "period";
  login: number;
  showAmounts: boolean;
  createdAt: string;
  views: number;
  url: string;
  data: ShareData;
};

const SHARE_CODE_RE = /^[A-Za-z0-9_-]{4,40}$/;

/**
 * Reads a share card for the public page / image. `view: false` does not count a view (the image and the
 * page metadata read it too; only the page render counts). null = unknown code.
 */
export async function publicShare(code: string, view = false): Promise<PublicShare | null | "unavailable"> {
  if (!SHARE_CODE_RE.test(code)) return null;
  const r = await growth<PublicShare>(`/v1/growth/public/shares/${encodeURIComponent(code)}${view ? "" : "?view=0"}`, { timeoutMs: 5000 });
  if (r.status === 404) return null;
  if (r.status !== 200 || !r.data?.code) return "unavailable";
  return r.data;
}
