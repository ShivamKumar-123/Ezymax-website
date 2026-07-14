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
