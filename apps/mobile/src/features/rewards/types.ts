// Rewards shapes, as the Client Area growth BFF returns them (/api/mobile/growth/* is the bearer rewrite of
// /api/growth/*, which serves services/growth /v1/growth/me/*). Money is USD as JSON numbers; times RFC 3339.
// Mirrors apps/crm/components/growth/api.ts (the web Client Area's rewards pages).

export interface Tier {
  key: string;
  name: string;
  rank: number;
  minPoints: number;
  multiplier: number;
  perks: string[];
}

export interface EarnRule {
  id: number;
  name: string;
  assetClass: string | null;
  symbols: string[];
  accountGroups: string[];
  accountType: string;
  pointsPerLot: number;
}

export type CatalogueKind = "cashback" | "bonus_credit" | "fee_discount" | string;

export interface CatalogueItem {
  id: number;
  name: string;
  description: string;
  kind: CatalogueKind;
  costPoints: number;
  value: number;
  minTier: string | null;
  stock: number | null;
  active: boolean;
  params: Record<string, unknown>;
}

export interface PointsTx {
  id: number;
  kind: "earn" | "redeem" | "bonus" | "promo" | "expire" | "adjust" | "reversal" | string;
  points: number;
  description: string;
  login: number | null;
  dealId: number | null;
  createdAt: string;
}

export interface Rewards {
  points: { balance: number; lifetime: number; earnedThisMonth: number; lotsThisMonth: number; earned12m: number; expiringSoon: { points: number; at: string } | null };
  tier: { key: string; name: string; rank: number; multiplier: number; minPoints: number; perks: string[] };
  nextTier: { key: string; name: string; minPoints: number; pointsToGo: number } | null;
  tiers: Tier[];
  rules: EarnRule[];
  pointValue: number;
  minHoldSeconds: number;
  pointsExpiryMonths: number;
  catalogue: CatalogueItem[];
  recent: PointsTx[];
  series: { day: string; points: number }[];
}

export interface PointsPage {
  items: PointsTx[];
  page: number;
  limit: number;
  total: number;
}

export interface Redemption {
  id: number;
  itemId: number;
  itemName: string;
  kind: CatalogueKind;
  points: number;
  value: number;
  status: "pending" | "completed" | "failed" | string;
  login: number | null;
  voucherCode: string | null;
  grantId: number | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface Voucher {
  id: number;
  code: string;
  kind: "fee_discount" | string;
  pct: number;
  appliesTo: "any" | "prop" | "commission" | string;
  status: "active" | "used" | "expired" | string;
  expiresAt: string;
  usedAt: string | null;
  source: string;
}

export interface CashbackProgramme {
  id: number;
  name: string;
  description: string;
  assetClasses: string[];
  symbols: string[];
  accountGroups: string[];
  usdPerLot: number;
  maxPerMonth: number | null;
  optIn: boolean;
  enrolled: boolean;
  startsAt: string;
  endsAt: string | null;
  lotsMonth: number;
  earnedMonth: number;
}

export interface CashbackAccrual {
  id: number;
  programmeId: number;
  programme: string;
  dealId: number;
  login: number;
  symbol: string;
  lots: number;
  amount: number;
  status: string;
  createdAt: string;
}

export interface CashbackPayout {
  id: number;
  amount: number;
  status: "pending" | "paid" | "failed" | string;
  createdAt: string;
  paidAt: string | null;
}

export interface CashbackMe {
  programmes: CashbackProgramme[];
  totals: { accrued: number; paid: number; month: number; lifetime: number };
  accruals: CashbackAccrual[];
  payouts: CashbackPayout[];
  series: { day: string; amount: number }[];
}

export interface CampaignPublic {
  id: number;
  name: string;
  description: string;
  terms: string;
  kind: "deposit" | "fixed";
  pct: number;
  cap: number;
  fixedAmount: number;
  minDeposit: number;
  releasePerLot: number;
  expiryDays: number;
  forfeitOnWithdrawal: boolean;
  claimWindowDays: number;
  startsAt: string;
  endsAt: string | null;
  eligible: boolean;
  reason: string | null;
  claimed: boolean;
}

export interface Grant {
  id: number;
  campaignId: number;
  campaign: string;
  status: "awaiting_deposit" | "pending" | "active" | "completed" | "forfeited" | "expired" | "cancelled" | "failed" | string;
  source: string;
  login: number | null;
  depositAmount: number | null;
  amount: number;
  released: number;
  remaining: number;
  lotsTraded: number;
  lotsRequired: number;
  releasePerLot: number;
  progressPct: number;
  claimedAt: string;
  grantedAt: string | null;
  expiresAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  claimDeadline: string | null;
}

export interface PromoUse {
  id: number;
  code: string;
  kind: string;
  status: "applied" | "blocked" | string;
  reason: string | null;
  createdAt: string;
}

export interface Promotions {
  campaigns: CampaignPublic[];
  grants: Grant[];
  promoHistory: PromoUse[];
}

export interface PromoResult {
  result: { kind: string; message: string; grant?: Grant; points?: number; voucher?: Voucher };
}

export interface Prize {
  rankFrom: number;
  rankTo: number;
  amount: number;
  payout: "wallet" | "credit" | string;
}

export interface Contest {
  id: number;
  slug: string;
  name: string;
  description: string;
  kind: "demo" | "live";
  status: "draft" | "scheduled" | "running" | "ended" | "finalized" | "paid" | "cancelled" | string;
  startsAt: string;
  endsAt: string;
  scoring: "return_pct" | "profit" | "lots" | string;
  minTrades: number;
  maxEntrants: number | null;
  entrants: number;
  startingBalance: number | null;
  demoGroup: string | null;
  accountGroups: string[];
  kycRequired: boolean;
  minEquity: number | null;
  prizes: Prize[];
  prizePool: number;
  rules: string;
  antiCheat: { minHoldSeconds: number; maxSingleTradePct: number; disqualifyOnBalanceChange: boolean };
  updatedAt: string;
}

export interface Standing {
  entryId: number;
  userId: number | null;
  name: string;
  country: string | null;
  login: number | null;
  rank: number | null;
  score: number;
  returnPct: number;
  profit: number;
  lots: number;
  trades: number;
  qualified: boolean;
  status: "active" | "disqualified" | string;
  prize: number | null;
  prizeStatus: string | null;
  me: boolean;
  updatedAt: string;
}

export type ContestCard = Contest & { myEntry: Standing | null };

export interface ContestsResp {
  items: ContestCard[];
  stats: { entered: number; prizesWon: number; prizeFinishes: number; bestRank: number | null; active: number };
}

export interface ContestDetail {
  contest: Contest;
  leaderboard: Standing[];
  myEntry: Standing | null;
  entrants: number;
}

export interface JoinResult {
  entry: Standing;
  /** demo contests only: the new demo account, shown once */
  credentials?: { login: number; password: string; investorPassword: string };
}

export interface ShareData {
  name: string;
  symbol: string | null;
  side: string | null;
  openPrice: number | null;
  closePrice: number | null;
  openTime: string | null;
  closeTime: string | null;
  movePct: number | null;
  returnPct: number | null;
  trades: number | null;
  winRate: number | null;
  lots: number | null;
  profit: number | null;
  currency: string;
  from: string | null;
  to: string | null;
  referralCode: string | null;
  brand: string;
}

export interface Share {
  code: string;
  kind: "trade" | "period";
  login: number;
  showAmounts: boolean;
  createdAt: string;
  views: number;
  url: string;
  data: ShareData;
}

/** A targeted marketing banner (D121) for one placement ("rewards" on these screens). */
export interface BannerView {
  id: number;
  title: string;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  imageUrl: string | null;
  tone: "ember" | "gold" | "neutral" | "up" | string;
  placement: string;
  dismissible: boolean;
}
