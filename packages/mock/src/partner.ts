import { seeded, hashString } from "./rng";
import { PEOPLE } from "./people";
import { getInstrument, type AssetClass } from "./symbols";

/* ------------------------------------------------------------------ */
/* IB levels, rate card, tiers, CPA                                    */
/* ------------------------------------------------------------------ */

export type IbLevelKey = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export interface IbLevel {
  key: IbLevelKey;
  name: string;
  /** Requirements to reach this level. */
  minActiveClients: number;
  minMonthlyLots: number;
  icon: string; // Icon3D name
  perks: string[];
}

export const IB_LEVELS: IbLevel[] = [
  { key: "bronze", name: "Bronze", minActiveClients: 0, minMonthlyLots: 0, icon: "coin", perks: ["Base rate card", "Monthly payouts", "Standard materials"] },
  { key: "silver", name: "Silver", minActiveClients: 10, minMonthlyLots: 200, icon: "crown", perks: ["+$2/lot on majors", "Weekly payouts", "Custom landing pages"] },
  { key: "gold", name: "Gold", minActiveClients: 50, minMonthlyLots: 1000, icon: "1st_place_medal", perks: ["+$2/lot on all groups", "CPA up to $300", "Dedicated partner manager"] },
  { key: "platinum", name: "Platinum", minActiveClients: 150, minMonthlyLots: 3000, icon: "trophy", perks: ["Priority payouts", "Co-branded campaigns", "Event sponsorship"] },
  { key: "diamond", name: "Diamond", minActiveClients: 400, minMonthlyLots: 8000, icon: "gem_stone", perks: ["Top rate card", "Revenue-share option", "Quarterly retreat"] },
];

export const CURRENT_LEVEL: IbLevelKey = "silver";
export const NEXT_LEVEL: IbLevelKey = "gold";

export type SymbolGroupKey = "fx-major" | "fx-minor" | "metals" | "indices" | "energies" | "crypto" | "stocks";

export const SYMBOL_GROUPS: { key: SymbolGroupKey; name: string; examples: string[] }[] = [
  { key: "fx-major", name: "Forex majors", examples: ["EURUSD", "GBPUSD", "USDJPY"] },
  { key: "fx-minor", name: "Forex minors & crosses", examples: ["GBPJPY", "EURJPY", "USDINR"] },
  { key: "metals", name: "Metals", examples: ["XAUUSD", "XAGUSD"] },
  { key: "indices", name: "Indices", examples: ["NAS100", "US30", "GER40"] },
  { key: "energies", name: "Energies", examples: ["USOIL", "UKOIL"] },
  { key: "crypto", name: "Crypto", examples: ["BTCUSD", "ETHUSD", "SOLUSD"] },
  { key: "stocks", name: "Stocks", examples: ["AAPL", "NVDA", "TSLA"] },
];

/** USD per standard lot, per symbol group, per IB level (closed live trades only). */
export const RATE_CARD: Record<SymbolGroupKey, Record<IbLevelKey, number>> = {
  "fx-major": { bronze: 5, silver: 7, gold: 9, platinum: 11, diamond: 13 },
  "fx-minor": { bronze: 6, silver: 8, gold: 10, platinum: 12, diamond: 14 },
  metals: { bronze: 8, silver: 10, gold: 12, platinum: 13.5, diamond: 15 },
  indices: { bronze: 2, silver: 3, gold: 4, platinum: 5, diamond: 6 },
  energies: { bronze: 4, silver: 5, gold: 6, platinum: 7, diamond: 8 },
  crypto: { bronze: 6, silver: 8, gold: 10, platinum: 12, diamond: 14 },
  stocks: { bronze: 1, silver: 1.5, gold: 2, platinum: 2.5, diamond: 3 },
};

const MAJORS = new Set(["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF"]);
export function symbolGroup(symbol: string): SymbolGroupKey {
  if (MAJORS.has(symbol)) return "fx-major";
  const ac: AssetClass = getInstrument(symbol).assetClass;
  return ac === "forex" ? "fx-minor" : ac;
}
export function rateFor(symbol: string, level: IbLevelKey = CURRENT_LEVEL) {
  return RATE_CARD[symbolGroup(symbol)][level];
}

/** Multi-tier: share of the base commission paid to each upline tier. Set by admin. */
export const TIERS = [
  { tier: 1, label: "Tier 1 · direct clients", pct: 100, note: "Clients who signed up with your link" },
  { tier: 2, label: "Tier 2 · sub-IB clients", pct: 20, note: "Clients of partners you referred" },
  { tier: 3, label: "Tier 3 · second-level", pct: 10, note: "Clients of your sub-IBs' partners" },
] as const;

export const CPA_RULES = {
  amount: 200,
  goldAmount: 300,
  minFirstDeposit: 500,
  requireFirstTrade: true,
  minTradeSeconds: 120,
  holdDays: 30,
};

export const ANTI_ABUSE = [
  { title: "Minimum trade duration", text: `Trades closed in under ${CPA_RULES.minTradeSeconds} seconds do not earn commission.` },
  { title: "Self-referral blocked", text: "Accounts matching your identity, device or payment details are excluded automatically." },
  { title: "Live accounts only", text: "Demo, bonus-credit and internal accounts never generate commission." },
  { title: "Permanent attribution", text: "A client stays linked to you for life, including their PAMM and copy-trading lots." },
];

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

export const PARTNER = {
  level: CURRENT_LEVEL,
  levelName: "Silver",
  since: "2024-03-02",
  totalReferrals: 214,
  referralsThisMonth: 17,
  activeClients: 38,
  activeTarget: 50,
  monthlyLots: 612.4,
  lotsTarget: 1000,
  lotsChangePct: 12.8,
  pendingCommission: 1284.36,
  approvedCommission: 412.8,
  paidAllTime: 18422.9,
  monthCommission: 4718.52,
  monthChangePct: 9.4,
  cpaEarned: 2600,
  cpaCount: 13,
  cpaPendingCount: 2,
  rebatePct: 15,
  subIbSplitPct: 30,
  conversionPct: 44.9,
  code: "ARJUN24",
};

/** Commission by week (last 12 weeks). */
export const WEEKLY_COMMISSION: { label: string; value: number }[] = (() => {
  const r = seeded(812);
  const labels = ["Jul 06", "Jul 13", "Jul 20", "Jul 27", "Aug 03", "Aug 10", "Aug 17", "Aug 24", "Aug 31", "Sep 07", "Sep 14", "Sep 21"];
  let v = 720;
  return labels.map((label) => {
    v = v * (1 + 0.035 + r.normal() * 0.09);
    return { label, value: +v.toFixed(2) };
  });
})();

/** Cumulative earnings (daily) with daily commission as volume bars. */
export function commissionSeries(days = 180): { time: number; value: number; volume: number }[] {
  const r = seeded(4411);
  const now = Math.floor(Date.parse("2026-09-24T00:00:00Z") / 1000);
  const daily: number[] = [];
  for (let i = 0; i < days; i++) {
    const dow = new Date((now - (days - 1 - i) * 86400) * 1000).getUTCDay();
    const weekend = dow === 0 || dow === 6;
    const trend = 60 + (i / days) * 140;
    daily.push(weekend ? r.range(4, 22) : Math.max(8, trend + r.normal() * 38));
  }
  const endTotal = PARTNER.paidAllTime + PARTNER.pendingCommission + PARTNER.approvedCommission;
  const sum = daily.reduce((s, x) => s + x, 0);
  let acc = endTotal - sum;
  return daily.map((d, i) => {
    acc += d;
    return { time: now - (days - 1 - i) * 86400, value: +acc.toFixed(2), volume: +d.toFixed(2) };
  });
}

/* ------------------------------------------------------------------ */
/* Referred clients                                                    */
/* ------------------------------------------------------------------ */

export type KycStatus = "verified" | "pending" | "unverified" | "rejected";
export type ClientStatus = "active" | "dormant" | "registered";

export interface ReferredClient {
  id: string;
  name: string;
  email: string;
  photo?: string;
  country: string;
  countryName: string;
  tier: 1 | 2 | 3;
  parentId: string | null; // null = your direct client
  isSubIb: boolean;
  joinedAt: string;
  kyc: KycStatus;
  status: ClientStatus;
  deposits: number;
  withdrawals: number;
  equity: number;
  lotsMonth: number;
  lotsTotal: number;
  commission: number;
  lastTrade: string | null;
  login: string | null;
  accountGroup: string;
  campaign: string;
  cpaPaid: boolean;
  viaCopy: number; // lots from copy/PAMM
  phone: string;
}

const EXTRA_NAMES: [string, string, string][] = [
  ["Rohan Kapoor", "in", "India"],
  ["Sneha Patil", "in", "India"],
  ["Ahmed Nasser", "ae", "United Arab Emirates"],
  ["Khalid Al-Harbi", "sa", "Saudi Arabia"],
  ["Tran Minh Duc", "vn", "Vietnam"],
  ["Le Thi Mai", "vn", "Vietnam"],
  ["Gabriel Santos", "br", "Brazil"],
  ["Juliana Costa", "br", "Brazil"],
  ["Chinedu Eze", "ng", "Nigeria"],
  ["Ngozi Adeyemi", "ng", "Nigeria"],
  ["Siti Aminah", "my", "Malaysia"],
  ["Farid Hakimi", "my", "Malaysia"],
  ["Mehmet Yilmaz", "tr", "Türkiye"],
  ["Ayse Demir", "tr", "Türkiye"],
  ["Diego Ramirez", "mx", "Mexico"],
  ["Valentina Lopez", "mx", "Mexico"],
  ["Kofi Boateng", "gh", "Ghana"],
  ["Imran Qureshi", "pk", "Pakistan"],
  ["Hina Malik", "pk", "Pakistan"],
  ["Nikos Georgiou", "cy", "Cyprus"],
  ["Youssef Mansour", "eg", "Egypt"],
  ["Mariam Adel", "eg", "Egypt"],
  ["Jose Reyes", "ph", "Philippines"],
  ["Andrea Bautista", "ph", "Philippines"],
  ["Sipho Ndlovu", "za", "South Africa"],
  ["Lerato Khumalo", "za", "South Africa"],
  ["Wei Jie Tan", "sg", "Singapore"],
  ["Kenji Watanabe", "jp", "Japan"],
  ["Anil Reddy", "in", "India"],
  ["Deepika Rao", "in", "India"],
  ["Tariq Aziz", "ae", "United Arab Emirates"],
  ["Paolo Bianchi", "it", "Italy"],
  ["Hannah Weber", "de", "Germany"],
  ["Oliver Hughes", "gb", "United Kingdom"],
  ["Pham Quoc Bao", "vn", "Vietnam"],
  ["Rafael Oliveira", "br", "Brazil"],
  ["Emeka Obi", "ng", "Nigeria"],
  ["Nurul Huda", "my", "Malaysia"],
  ["Burak Aydin", "tr", "Türkiye"],
  ["Sanjay Gupta", "in", "India"],
  ["Lina Haddad", "sa", "Saudi Arabia"],
  ["Marco Conti", "it", "Italy"],
  ["Ama Owusu", "gh", "Ghana"],
  ["Bilal Chaudhry", "pk", "Pakistan"],
  ["Grace Mwangi", "za", "South Africa"],
  ["Daisuke Ito", "jp", "Japan"],
  ["Camila Rocha", "br", "Brazil"],
  ["Arif Rahman", "my", "Malaysia"],
  ["Nadia Karim", "eg", "Egypt"],
  ["Luis Navarro", "mx", "Mexico"],
  ["Ravi Shankar", "in", "India"],
  ["Hoang Anh", "vn", "Vietnam"],
  ["Fernanda Lima", "br", "Brazil"],
  ["Samuel Adjei", "gh", "Ghana"],
  ["Jasmine Tay", "sg", "Singapore"],
  ["Mustafa Celik", "tr", "Türkiye"],
  ["Ifeoma Nwosu", "ng", "Nigeria"],
  ["Karan Malhotra", "in", "India"],
  ["Yasmin Saleh", "ae", "United Arab Emirates"],
  ["Tomas Novak", "cy", "Cyprus"],
  ["Aditya Joshi", "in", "India"],
  ["Rizal Ahmad", "my", "Malaysia"],
  ["Beatriz Almeida", "br", "Brazil"],
];

const DIAL: Record<string, string> = { in: "91", ae: "971", br: "55", vn: "84", sa: "966", it: "39", ng: "234", sg: "65", gb: "44", my: "60", mx: "52", cy: "357", jp: "81", tr: "90", gh: "233", pk: "92", de: "49", eg: "20", ph: "63", za: "27" };

/** Sub-IBs among your direct clients (by PEOPLE index). */
const SUB_IB_PEOPLE = [1, 5, 8, 7];

export const REFERRED_CLIENTS: ReferredClient[] = (() => {
  const r = seeded(2024);
  const pool: { name: string; email: string; photo?: string; country: string; countryName: string }[] = [];
  // Direct sub-IBs first (portraits)
  for (const i of SUB_IB_PEOPLE) pool.push(PEOPLE[i]!);
  for (let i = 1; i < PEOPLE.length; i++) if (!SUB_IB_PEOPLE.includes(i)) pool.push(PEOPLE[i]!);
  for (const [name, country, countryName] of EXTRA_NAMES)
    pool.push({ name, country, countryName, email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@mail.com` });

  const N = pool.length; // 86
  // Tier split: 58 direct, 21 tier-2, 7 tier-3
  const tiers: (1 | 2 | 3)[] = pool.map((_, i) => (i < 4 ? 1 : i < 58 ? 1 : i < 79 ? 2 : 3));
  // Put some portrait people in tier 2 so the tree has faces
  const byName = (n: string) => pool.findIndex((p) => p.name === n);
  for (const n of ["Priya Nair", "Rahul Verma", "Zara Sheikh", "Ethan Brooks"]) tiers[byName(n)] = 2;
  for (const n of ["Ana Souza", "Vikram Iyer"]) tiers[byName(n)] = 3;
  for (const n of ["Pham Quoc Bao", "Rafael Oliveira", "Emeka Obi", "Nurul Huda", "Burak Aydin", "Sanjay Gupta"]) tiers[byName(n)] = 1;

  // Exactly 38 active clients
  // Portrait clients first so they are more likely to be active, then shuffle the rest
  const idx = pool.map((_, i) => i).filter((i) => i >= 4);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  const photoIdx = idx.filter((i) => pool[i]!.photo).slice(0, 14);
  const rest = idx.filter((i) => !photoIdx.includes(i));
  const activeSet = new Set<number>([0, 1, 2, 3, ...photoIdx, ...rest.slice(0, 20)]);
  const dormantSet = new Set<number>(rest.slice(20, 44));

  const campaigns = ["YouTube · Gold webinar", "Telegram channel", "Instagram bio", "Direct link", "Blog · XAUUSD guide", "WhatsApp group"];
  const groups = ["Standard", "Pro", "Pro", "Cent", "ECN"];
  const now = Date.parse("2026-09-24T12:00:00Z");
  const out: ReferredClient[] = pool.map((p, i) => {
    const status: ClientStatus = activeSet.has(i) ? "active" : dormantSet.has(i) ? "dormant" : "registered";
    const joinedDaysAgo = i < 4 ? r.int(420, 560) : r.int(3, 620);
    const deposits = status === "registered" ? 0 : +(r.pick([250, 500, 1000, 1500, 2500, 5000, 10000, 25000]) * r.range(0.8, 2.4)).toFixed(2);
    const lotsTotal = status === "registered" ? 0 : +(r.range(4, 420) * (i < 4 ? 3 : 1)).toFixed(2);
    const lotsMonth = status === "active" ? (p.photo ? r.range(8, 40) : r.range(2, 24)) : 0;
    const kyc: KycStatus = status === "registered" ? r.pick(["unverified", "unverified", "pending"] as const) : r.bool(0.9) ? "verified" : r.pick(["pending", "rejected"] as const);
    const lastTradeHoursAgo = status === "active" ? r.int(1, 24 * 20) : status === "dormant" ? r.int(24 * 35, 24 * 160) : null;
    return {
      id: `c_${31000 + i * 7}`,
      name: p.name,
      email: p.email,
      photo: p.photo,
      country: p.country,
      countryName: p.countryName,
      tier: tiers[i]!,
      parentId: null,
      isSubIb: i < 4,
      joinedAt: new Date(now - joinedDaysAgo * 86400000).toISOString(),
      kyc,
      status,
      deposits,
      withdrawals: status === "registered" ? 0 : +(deposits * r.range(0, 0.45)).toFixed(2),
      equity: status === "registered" ? 0 : +(deposits * r.range(0.55, 1.6)).toFixed(2),
      lotsMonth,
      lotsTotal,
      commission: 0,
      lastTrade: lastTradeHoursAgo === null ? null : new Date(now - lastTradeHoursAgo * 3600000).toISOString(),
      login: status === "registered" ? null : String(80500000 + hashString(p.name) % 99999),
      accountGroup: r.pick(groups),
      campaign: r.pick(campaigns),
      cpaPaid: status !== "registered" && deposits >= 500 && r.bool(0.35),
      viaCopy: status === "active" && r.bool(0.3) ? +r.range(0.5, 6).toFixed(2) : 0,
      phone: `+${DIAL[p.country] ?? "44"} ${r.int(100, 999)} ${r.int(100, 999)} ${r.int(1000, 9999)}`,
    };
  });

  // Scale monthly lots so the network total is exactly PARTNER.monthlyLots
  const sum = out.reduce((s, c) => s + c.lotsMonth, 0);
  for (const c of out) c.lotsMonth = +((c.lotsMonth / sum) * PARTNER.monthlyLots).toFixed(2);

  // Parenting: tier-2 → one of the 4 direct sub-IBs; two tier-2 clients act as sub-IBs for tier-3
  const tier2 = out.filter((c) => c.tier === 2);
  tier2.forEach((c, k) => (c.parentId = out[k % 4]!.id));
  const t2Ibs = [out.find((c) => c.name === "Priya Nair")!, out.find((c) => c.name === "Rahul Verma")!];
  t2Ibs.forEach((c) => (c.isSubIb = true));
  out.filter((c) => c.tier === 3).forEach((c, k) => (c.parentId = t2Ibs[k % 2]!.id));

  // Commission generated (lifetime, your share)
  for (const c of out) {
    const pct = c.tier === 1 ? 1 : c.tier === 2 ? 0.2 : 0.1;
    c.commission = +(c.lotsTotal * 7.4 * pct).toFixed(2);
  }
  return out;
})();

export function clientById(id: string) {
  return REFERRED_CLIENTS.find((c) => c.id === id);
}

export interface ClientTrade {
  ticket: string;
  symbol: string;
  side: "buy" | "sell";
  lots: number;
  openPrice: number;
  closePrice: number;
  profit: number;
  closedAt: string;
  durationSec: number;
  qualifies: boolean;
  commission: number;
}

export function clientTrades(clientId: string, n = 12): ClientTrade[] {
  const c = clientById(clientId);
  if (!c || c.status === "registered") return [];
  const r = seeded(hashString(clientId));
  const syms = ["XAUUSD", "EURUSD", "GBPUSD", "NAS100", "BTCUSD", "USDJPY", "US30", "GBPJPY", "USOIL", "ETHUSD"];
  let t = c.lastTrade ? Date.parse(c.lastTrade) : Date.parse("2026-09-20T10:00:00Z");
  const out: ClientTrade[] = [];
  for (let i = 0; i < n; i++) {
    const symbol = r.pick(syms);
    const inst = getInstrument(symbol);
    const side = r.bool(0.55) ? "buy" : "sell";
    const lots = r.pick([0.01, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2]);
    const openPrice = inst.price * (1 + r.normal() * 0.006);
    const move = r.normal() * inst.price * (inst.assetClass === "forex" ? 0.0018 : 0.005);
    const closePrice = openPrice + move;
    let profit = (side === "buy" ? move : -move) * lots * inst.contractSize;
    if (symbol.endsWith("JPY")) profit /= closePrice;
    const durationSec = r.bool(0.08) ? r.int(8, 110) : r.int(300, 3600 * 30);
    const qualifies = durationSec >= CPA_RULES.minTradeSeconds;
    const pct = c.tier === 1 ? 1 : c.tier === 2 ? 0.2 : 0.1;
    out.push({
      ticket: String(51200000 + (hashString(clientId + i) % 800000)),
      symbol,
      side,
      lots,
      openPrice: +openPrice.toFixed(inst.digits),
      closePrice: +closePrice.toFixed(inst.digits),
      profit: +profit.toFixed(2),
      closedAt: new Date(t).toISOString(),
      durationSec,
      qualifies,
      commission: qualifies ? +(lots * rateFor(symbol) * pct).toFixed(2) : 0,
    });
    t -= r.int(2, 60) * 3600000;
  }
  return out;
}

/** Deposit/lot activity for a client over the last 8 weeks. */
export function clientActivity(clientId: string): number[] {
  const r = seeded(hashString(clientId + "act"));
  return Array.from({ length: 16 }, () => +r.range(0, 12).toFixed(1));
}

/* ------------------------------------------------------------------ */
/* Commission ledger                                                   */
/* ------------------------------------------------------------------ */

export type CommissionStatus = "pending" | "approved" | "paid" | "rejected";

export interface CommissionEvent {
  id: string;
  kind: "lot" | "cpa";
  ticket: string | null;
  clientId: string;
  clientName: string;
  clientPhoto?: string;
  clientCountry: string;
  symbol: string | null;
  lots: number;
  tier: 1 | 2 | 3;
  rate: number;
  amount: number;
  status: CommissionStatus;
  source: "manual" | "copy" | "pamm";
  closedAt: string;
  note?: string;
}

export const COMMISSION_LEDGER: CommissionEvent[] = (() => {
  const r = seeded(9921);
  const active = REFERRED_CLIENTS.filter((c) => c.status === "active");
  const syms = ["XAUUSD", "XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "US30", "BTCUSD", "GBPJPY", "USOIL", "ETHUSD", "XAGUSD", "AAPL"];
  const out: CommissionEvent[] = [];
  let t = Date.parse("2026-09-24T15:42:00Z");
  for (let i = 0; i < 140; i++) {
    const c = r.pick(active);
    const ageDays = (Date.parse("2026-09-24T15:42:00Z") - t) / 86400000;
    const status: CommissionStatus = ageDays < 3.5 ? "pending" : ageDays < 7 ? (r.bool(0.96) ? "approved" : "rejected") : "paid";
    const isCpa = i % 23 === 11;
    if (isCpa) {
      out.push({
        id: `CM${700400 - i}`,
        kind: "cpa",
        ticket: null,
        clientId: c.id,
        clientName: c.name,
        clientPhoto: c.photo,
        clientCountry: c.country,
        symbol: null,
        lots: 0,
        tier: 1,
        rate: CPA_RULES.amount,
        amount: CPA_RULES.amount,
        status,
        source: "manual",
        closedAt: new Date(t).toISOString(),
        note: `First deposit $${r.pick([500, 750, 1000, 2500])} + first trade`,
      });
    } else {
      const symbol = r.pick(syms);
      const lots = r.pick([0.3, 0.5, 1, 1, 1.5, 2, 2, 3, 5]);
      const pct = c.tier === 1 ? 1 : c.tier === 2 ? 0.2 : 0.1;
      const rate = rateFor(symbol);
      out.push({
        id: `CM${700400 - i}`,
        kind: "lot",
        ticket: String(51990000 - i * 173),
        clientId: c.id,
        clientName: c.name,
        clientPhoto: c.photo,
        clientCountry: c.country,
        symbol,
        lots,
        tier: c.tier,
        rate,
        amount: +(lots * rate * pct).toFixed(2),
        status,
        source: c.viaCopy > 0 && r.bool(0.4) ? r.pick(["copy", "pamm"] as const) : "manual",
        closedAt: new Date(t).toISOString(),
      });
    }
    t -= r.int(40, 220) * 60000;
  }
  return out;
})();

// Keep the summary in sync with the ledger
PARTNER.pendingCommission = +COMMISSION_LEDGER.filter((e) => e.status === "pending").reduce((s, e) => s + e.amount, 0).toFixed(2);
PARTNER.approvedCommission = +COMMISSION_LEDGER.filter((e) => e.status === "approved").reduce((s, e) => s + e.amount, 0).toFixed(2);

/* ------------------------------------------------------------------ */
/* Campaigns, banners, landing pages                                   */
/* ------------------------------------------------------------------ */

export interface Campaign {
  id: string;
  name: string;
  slug: string;
  landing: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  clicks: number;
  signups: number;
  ftds: number;
  deposits: number;
  lots: number;
  createdAt: string;
  active: boolean;
  trend: number[];
}

export const CAMPAIGNS: Campaign[] = [
  { id: "cp1", name: "YouTube · Gold webinar", slug: "gold-webinar", landing: "Gold trading", utmSource: "youtube", utmMedium: "video", utmCampaign: "gold_sep", clicks: 4812, signups: 386, ftds: 71, deposits: 64210, lots: 1840.2, createdAt: "2026-06-14", active: true, trend: [] },
  { id: "cp2", name: "Telegram channel", slug: "tg", landing: "Kalks homepage", utmSource: "telegram", utmMedium: "social", utmCampaign: "channel", clicks: 3120, signups: 298, ftds: 58, deposits: 41880, lots: 1322.6, createdAt: "2025-11-02", active: true, trend: [] },
  { id: "cp3", name: "Instagram bio", slug: "ig", landing: "Open an account", utmSource: "instagram", utmMedium: "social", utmCampaign: "bio", clicks: 2204, signups: 141, ftds: 19, deposits: 12040, lots: 318.4, createdAt: "2025-09-20", active: true, trend: [] },
  { id: "cp4", name: "Blog · XAUUSD guide", slug: "xau-guide", landing: "Gold trading", utmSource: "blog", utmMedium: "organic", utmCampaign: "xau_guide", clicks: 1688, signups: 122, ftds: 27, deposits: 22630, lots: 604.9, createdAt: "2026-02-08", active: true, trend: [] },
  { id: "cp5", name: "WhatsApp group", slug: "wa", landing: "Copy trading", utmSource: "whatsapp", utmMedium: "chat", utmCampaign: "group", clicks: 940, signups: 104, ftds: 22, deposits: 15200, lots: 288.1, createdAt: "2026-04-17", active: true, trend: [] },
  { id: "cp6", name: "Ramadan promo 2026", slug: "ramadan26", landing: "Swap-free accounts", utmSource: "x", utmMedium: "social", utmCampaign: "ramadan26", clicks: 1310, signups: 77, ftds: 11, deposits: 8120, lots: 140.7, createdAt: "2026-02-26", active: false, trend: [] },
].map((c) => {
  const r = seeded(hashString(c.id));
  let v = 40;
  return { ...c, trend: Array.from({ length: 20 }, () => (v = Math.max(5, v + r.normal() * 9 + (c.active ? 1.5 : -1.2)))) };
});

export const LANDING_PAGES = [
  { id: "lp1", name: "Kalks homepage", path: "/", photo: "/assets/photos/trading-screen.jpg", conv: 8.2, visits: 9420, lang: ["EN", "AR", "HI", "PT"] },
  { id: "lp2", name: "Gold trading", path: "/markets/gold", photo: "/assets/photos/gold.jpg", conv: 11.4, visits: 6810, lang: ["EN", "AR", "HI"] },
  { id: "lp3", name: "Open an account", path: "/open-account", photo: "/assets/photos/dashboard.jpg", conv: 14.9, visits: 3120, lang: ["EN", "AR", "VI", "PT", "ES"] },
  { id: "lp4", name: "Copy trading", path: "/copy-trading", photo: "/assets/photos/trader.jpg", conv: 9.7, visits: 2280, lang: ["EN", "PT", "ES"] },
  { id: "lp5", name: "Swap-free accounts", path: "/islamic-account", photo: "/assets/photos/dubai.jpg", conv: 10.3, visits: 1740, lang: ["EN", "AR", "MS"] },
  { id: "lp6", name: "Crypto CFDs", path: "/markets/crypto", photo: "/assets/photos/bitcoin.jpg", conv: 7.1, visits: 1510, lang: ["EN", "VI", "TR"] },
];

export const BANNERS = [
  { id: "bn1", title: "Trade gold with spreads from 0.18", cta: "Start trading", photo: "/assets/photos/gold.jpg", theme: "Metals" },
  { id: "bn2", title: "Copy top traders in one click", cta: "Discover masters", photo: "/assets/photos/trader.jpg", theme: "Copy trading" },
  { id: "bn3", title: "Crypto CFDs, 24/7 — BTC, ETH, SOL", cta: "Open account", photo: "/assets/photos/crypto-coins.jpg", theme: "Crypto" },
  { id: "bn4", title: "Leverage up to 1:1000 on Cent", cta: "Try Cent", photo: "/assets/photos/skyline.jpg", theme: "Accounts" },
  { id: "bn5", title: "Swap-free accounts for every trader", cta: "Learn more", photo: "/assets/photos/dubai.jpg", theme: "Islamic" },
  { id: "bn6", title: "Trade the Nasdaq at 20,000+", cta: "Trade NAS100", photo: "/assets/photos/nyc.jpg", theme: "Indices" },
];

export const BANNER_SIZES = [
  { key: "728x90", w: 728, h: 90, label: "Leaderboard" },
  { key: "300x250", w: 300, h: 250, label: "Medium rectangle" },
  { key: "1080x1080", w: 1080, h: 1080, label: "Social square" },
] as const;

/* ------------------------------------------------------------------ */
/* Payouts                                                             */
/* ------------------------------------------------------------------ */

export interface PayoutBatch {
  id: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  events: number;
  lotCommission: number;
  cpa: number;
  adjustments: number;
  amount: number;
  status: "pending" | "approved" | "processing" | "completed" | "rejected";
  paidAt: string | null;
  walletTx: string | null;
}

export const PAYOUT_SCHEDULE = {
  frequency: "Weekly",
  cutoff: "Sunday 23:59 GMT+3",
  approval: "Monday 10:00–14:00 GMT+3",
  nextBatch: "2026-09-28T09:00:00Z", // Mon 12:00 GMT+3
  minPayout: 50,
  destination: "Kalks wallet · USDT",
};

export const PAYOUT_BATCHES: PayoutBatch[] = (() => {
  const r = seeded(3131);
  const out: PayoutBatch[] = [];
  let end = Date.parse("2026-09-27T20:59:00Z"); // Sun 23:59 GMT+3 (current week)
  for (let i = 0; i < 18; i++) {
    const start = end - 7 * 86400000 + 60000;
    const lot = +(r.range(780, 1450) * (1 - i * 0.012)).toFixed(2);
    const cpa = r.bool(0.45) ? CPA_RULES.amount * r.int(1, 2) : 0;
    const adj = r.bool(0.15) ? -+r.range(5, 40).toFixed(2) : 0;
    const status: PayoutBatch["status"] = i === 0 ? "pending" : "completed";
    const paid = status === "completed" ? new Date(end + 12 * 3600000 + r.int(1, 5) * 3600000 + r.int(0, 59) * 60000).toISOString() : null;
    const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const fmt = (t: number) => {
      const d = new Date(t + 3 * 3600000);
      return `${String(d.getUTCDate()).padStart(2, "0")} ${MON[d.getUTCMonth()]}`;
    };
    out.push({
      id: `PB-${2026}-${String(38 - i).padStart(2, "0")}`,
      period: `${fmt(start)} – ${fmt(end)}`,
      periodStart: new Date(start).toISOString(),
      periodEnd: new Date(end).toISOString(),
      events: r.int(90, 210),
      lotCommission: lot,
      cpa,
      adjustments: adj,
      amount: +(lot + cpa + adj).toFixed(2),
      status,
      paidAt: paid,
      walletTx: paid ? `TX${904300 - i * 211}` : null,
    });
    end -= 7 * 86400000;
  }
  // Current week accumulates: pending + approved, paid next Monday
  const cur = out[0]!;
  cur.cpa = CPA_RULES.amount;
  cur.adjustments = 0;
  cur.amount = +(PARTNER.pendingCommission + PARTNER.approvedCommission).toFixed(2);
  cur.lotCommission = +(cur.amount - cur.cpa).toFixed(2);
  return out;
})();
