export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface SubIb {
  name: string;
  email: string;
  referral_code: string;
  level: number;
  total_earned: number;
}

export interface DashboardData {
  referral_code: string;
  referral_link: string;
  level: number;
  total_referrals: number;
  total_commission: number;
  pending_payout: number;
  total_earned: number;
  is_active: boolean;
  traded_count: number;
  registered_no_trade: number;
  sub_ib_count: number;
  sub_ibs: SubIb[];
}

export interface ReferredUser {
  id: string;
  email: string;
  name: string;
  joined_at: string | null;
}

export interface Referral {
  id: string;
  user_id: string;
  referred_user: ReferredUser;
  accounts_count: number;
  total_deposit: number;
  trades_count: number;
  has_traded: boolean;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string | null;
}

export interface Commission {
  id: string;
  source_user: { id?: string; email: string; name: string };
  commission_type: string;
  amount: number;
  mlm_level: number;
  status: string;
  created_at: string | null;
}

export interface CommissionByType {
  commission_type: string;
  amount: number;
  count: number;
}
export interface CommissionSource {
  source_user: { id: string; email: string; name: string };
  total_amount: number;
  total_count: number;
  by_type: CommissionByType[];
}
export interface CommissionSummary {
  sources: CommissionSource[];
  grand_total: number;
  filters: { status: string | null; date_from: string | null; date_to: string | null };
}

export interface TradingAccount {
  id: string;
  account_number: string;
  currency: string;
  balance: number;
  credit: number;
  equity: number;
  margin_used: number;
  free_margin: number;
  leverage: number;
  is_demo: boolean;
  is_active: boolean;
  book_type?: string;
}

export interface Position {
  id: string;
  symbol?: string;
  instrument?: string;
  side: string;
  lots: number;
  open_price?: number;
  current_price?: number;
  profit?: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  status?: string;
  created_at?: string | null;
}

export interface IbUserDetail {
  user: {
    id: string;
    email: string;
    name: string;
    status: string;
    kyc_status: string;
    country: string | null;
    created_at: string | null;
  };
  accounts: TradingAccount[];
  open_positions: Position[];
  deposits_total: number;
  commission_earned: number;
}

export interface TreeNode {
  user_id?: string;
  name?: string;
  email?: string;
  referral_code?: string;
  level?: number;
  total_earned?: number;
  depth?: number;
  children?: TreeNode[];
}

export interface PlaceOrderInput {
  account_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  order_type: string;
  lots: number;
  price?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
}
