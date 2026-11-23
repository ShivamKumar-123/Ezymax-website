/**
 * Trade Insurance API client.
 * Backed by /api/v1/insurance/* — see backend/services/gateway/src/api/insurance.py
 */
import api from './client';

// Backend returns the admin-defined tier label verbatim. Legacy mode
// returns one of basic/advanced/pro/elite; simple mode returns whatever
// admin typed (e.g. "50%", "70%"). UI must render it as-is — never key
// off a fixed enum.
export type InsuranceTier = string;

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
}

export interface ActivateResponse {
  policy_id: string;
  fee_charged: string;
  status: 'active';
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
  activated_at: string;
  settled_at: string | null;
  // Why the policy ended up denied/expired. Backend persists a short
  // code (min_duration, daily_claim_limit, not_a_loss, …); the UI maps
  // it to a human-readable explanation.
  settled_reason: string | null;
}

export type ClaimStatus = 'pending' | 'paid';

export interface ClaimOut {
  id: string;
  policy_id: string;
  loss_amount: string;
  claim_amount: string;
  status: ClaimStatus;
  paid_at: string | null;
  claimed_at: string | null;
  instrument_symbol: string | null;
  tier: InsuranceTier | null;
}

export interface ClaimPayResponse {
  claim_id: string;
  amount: string;
  credited_to: 'credit' | 'balance';
  status: 'paid';
}

export const insuranceApi = {
  quote: (body: QuoteRequest) => api.post<TierQuote[]>('/insurance/quote', body),
  activate: (position_id: string, tier: InsuranceTier) =>
    api.post<ActivateResponse>('/insurance/activate', { position_id, tier }),
  active: () => api.get<PolicyOut[]>('/insurance/active'),
  policies: (limit = 50) => api.get<PolicyOut[]>(`/insurance/policies?limit=${limit}`),
  claims: (limit = 50, status?: ClaimStatus) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (status) params.set('status', status);
    return api.get<ClaimOut[]>(`/insurance/claims?${params.toString()}`);
  },
  claimPayout: (claimId: string) =>
    api.post<ClaimPayResponse>(`/insurance/claims/${claimId}/claim`, {}),
};
