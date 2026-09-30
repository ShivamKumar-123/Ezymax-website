// Partner (IB programme) shapes, as the Client Area partner BFF returns them (/api/mobile/partner/* is the bearer
// rewrite of /api/partner/*, which serves services/ib /v1/ib/me/*). Money is USD as JSON numbers; times RFC 3339.
// Mirrors apps/crm/components/partner/live/api.ts (the web Client Area's partner pages).

export interface Level {
  key: string;
  name: string;
  rank: number;
  icon: string;
  perks: string[];
  minActiveClients: number;
  minMonthlyLots: number;
  cpaAmount: number;
  /** USD per standard lot, per symbol group key */
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
  cpa: { enabled: boolean; minFirstDeposit: number; requireFirstTrade: boolean; holdDays: number };
  minTradeSeconds: number;
  payout: { schedule: "daily" | "weekly" | "monthly" | string; minAmount: number; nextClose: string };
  maxRebatePct: number;
  maxSplitPct: number;
  /** full: names, emails and trades of network clients; masked: initials and totals only (D61) */
  clientVisibility: "full" | "masked" | string;
  excludedGroups: string[];
}

export type CommissionKind = "lot" | "split" | "rebate" | "cpa" | "clawback" | "adjustment";
export type CommissionStatus = "pending" | "approved" | "paid" | "rejected" | "void";

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
  /** why a line was rejected / voided (the broker's reason), or what an adjustment is for */
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
  counts: { referrals: number; referralsThisMonth: number; funded: number; subIbs: number };
  funnel: { clicks: number; signups: number; ftds: number };
  series: { date: string; amount: number; cumulative: number }[];
  weekly: { week: string; amount: number }[];
  topClients: { id: number; name: string; country: string; lotsMonth: number }[];
  recent: CommissionRow[];
  programme: Programme;
  /** public origin of the Client Area; referral link = `${linkBase}/r/${code}` */
  linkBase: string;
}

export interface Campaign {
  /** null = the default link (/r/CODE) */
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
  /** clicks per day, last 30 days (oldest first) */
  trend: number[];
}

export interface CampaignsResp {
  code: string;
  items: Campaign[];
  linkBase: string;
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
  status: ClientStatus | string;
}

export interface ClientsResp {
  items: NetworkClient[];
  visibility: "full" | "masked" | string;
  tiers: number;
  linkBase: string;
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
  /** why the deal earned nothing (short_duration, demo, excluded_group, self_referral, …) */
  reason: string | null;
  reversed: boolean;
  earned: number;
}

export interface CommissionsResp {
  items: CommissionRow[];
  page: number;
  limit: number;
  total: number;
  totals: Record<CommissionStatus, number>;
}

export type PayoutStatus = "awaiting_approval" | "processing" | "paid" | "rejected";

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
