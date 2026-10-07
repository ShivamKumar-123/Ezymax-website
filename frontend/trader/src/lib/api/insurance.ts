/**
 * Trade Insurance API client.
 * Backed by /api/v1/insurance/* — see backend/services/gateway/src/api/insurance.py
 */
import api from './client';

export type InsuranceTier = 'basic' | 'advanced' | 'pro' | 'elite';
export type InsuranceDuration = '1d' | '1w' | '1m';

export interface TierQuote {
  tier: InsuranceTier;
  fee: number;
  coverage_pct: number;
  max_cap: number;
  estimated_refund: number;
  risk_score: number;
}

export interface QuoteRequest {
  account_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  lots: number;
  leverage?: number;
  stop_loss?: number;
  take_profit?: number;
  duration?: InsuranceDuration;
}

export interface ActivateResponse {
  policy_id: string;
  fee_charged: string;
  status: 'active';
  duration: InsuranceDuration;
  expires_at: string | null;
}

export interface PolicyOut {
  id: string;
  position_id: string | null;
  instrument_symbol: string | null;
  tier: InsuranceTier;
  fee: string;
  coverage_pct: string;
  max_cap: string;
  status: 'active' | 'claimed' | 'expired' | 'denied';
  duration: InsuranceDuration;
  expires_at: string | null;
  activated_at: string;
  settled_at: string | null;
}

export interface ClaimOut {
  id: string;
  policy_id: string;
  loss_amount: string;
  claim_amount: string;
  paid_at: string;
}

export const insuranceApi = {
  quote: (body: QuoteRequest) => api.post<TierQuote[]>('/insurance/quote', body),
  activate: (position_id: string, tier: InsuranceTier, duration: InsuranceDuration = '1d') =>
    api.post<ActivateResponse>('/insurance/activate', { position_id, tier, duration }),
  active: () => api.get<PolicyOut[]>('/insurance/active'),
  policies: (limit = 50) => api.get<PolicyOut[]>(`/insurance/policies?limit=${limit}`),
  claims: (limit = 50) => api.get<ClaimOut[]>(`/insurance/claims?limit=${limit}`),
};

/* ─────────────────────────────────────────────────────────────────────
 * Ezymax Shield — aggregate period-plan insurance (separate product).
 * Backed by /api/v1/insurance/shield/* (backend/services/gateway/src/api/shield.py).
 * Unlike per-trade insurance, the user buys ONE period plan (Daily/Weekly/
 * Monthly) that covers a share of their cumulative loss over that window.
 * ──────────────────────────────────────────────────────────────────── */

export type ShieldPeriod = 'daily' | 'weekly' | 'monthly';
export type ShieldTier = 'basic' | 'plus' | 'pro' | 'elite';

export interface ShieldPlan {
  id: string;
  code: string;
  period: ShieldPeriod;
  tier: ShieldTier;
  coverage_pct: number;
  max_payout: number;
  premium: number;
}

export interface ShieldState {
  id: string;
  period: ShieldPeriod;
  tier: ShieldTier;
  coverage_pct: number;
  max_payout: number;
  premium_paid: number;
  cumulative_eligible_loss: number;
  coverage_used: number;
  coverage_remaining: number;
  status: 'active' | 'expired' | 'cancelled' | 'replaced' | 'exhausted';
  activated_at: string | null;
  expires_at: string | null;
}

/** A row from the Shield audit trail. Denials only ever existed here, never as
 *  claim rows, which is why a trade that missed a gate used to leave the trader
 *  with nothing on screen at all. */
export interface ShieldEvent {
  id: string;
  type: 'claim_denied' | 'claim_paid' | 'expired' | 'purchase' | 'replace' | 'cancelled';
  detail: string | null;
  /** Plain-English explanation, present on denials. */
  reason: string | null;
  created_at: string | null;
}

/** Eligibility rules, served with the catalogue so the copy can never drift
 *  from the engine that enforces it. */
export interface ShieldRules {
  min_hold_seconds: number;
  /** The four conditions a losing trade must meet. */
  items: { title: string; body: string }[];
  /** How the payout itself behaves — closing order, cap, cumulative total. */
  notes?: { title: string; body: string }[];
  /** Worked scenario for the hedge rule, which is the one people misread. */
  example?: {
    title: string;
    intro: string;
    rows: { action: string; result: string; covered: boolean }[];
    footer: string;
  };
}

export interface ShieldClaimsResponse {
  claims: ShieldClaim[];
  events: ShieldEvent[];
  summary: { total_paid: number; paid_count: number; denied_count: number };
}

export interface ShieldClaim {
  id: string;
  position_id: string | null;
  trade_loss: number;
  cumulative_eligible_loss: number;
  payout_amount: number;
  status: string;
  created_at: string | null;
}

export const shieldApi = {
  plans: () => api.get<{ plans: ShieldPlan[]; rules?: ShieldRules }>('/insurance/shield/plans'),
  status: () => api.get<{ active: ShieldState | null; history: ShieldState[] }>('/insurance/shield/status'),
  purchase: (planId: string, replace = false) =>
    api.post<{ shield: ShieldState }>('/insurance/shield/purchase', { plan_id: planId, replace }),
  claims: (limit = 50) =>
    api.get<ShieldClaimsResponse>(`/insurance/shield/claims?limit=${limit}`),
};
