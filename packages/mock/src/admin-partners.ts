/**
 * Back Office mock data — Partners (IB) and Social & Algo modules.
 * Deterministic (seeded) so server and client renders match.
 * "Now" is 2026-09-24 GMT+3.
 */
import { seeded, hashString } from "./rng";
import { PEOPLE } from "./people";

export const NOW_ISO = "2026-09-24T14:32:00+03:00";
const NOW = Date.parse(NOW_ISO);
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

/* ================================================================== */
/* PARTNERS                                                             */
/* ================================================================== */

export type LevelKey = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export interface PartnerLevel {
  key: LevelKey;
  name: string;
  icon: string; // Icon3D name
  tone: "warn" | "neutral" | "gold" | "info" | "ember";
  criteria: { activeClients: number; monthlyLots: number; windowDays: number; minNetDeposits: number };
  benefits: { rateMultiplier: number; payoutFrequency: "Monthly" | "Bi-weekly" | "Weekly" | "Daily"; dedicatedManager: boolean; marketingBudget: number; customLanding: boolean; eventsInvites: boolean };
  partners: number;
}

export const LEVELS: PartnerLevel[] = [
  { key: "bronze", name: "Bronze", icon: "coin", tone: "warn", criteria: { activeClients: 0, monthlyLots: 0, windowDays: 30, minNetDeposits: 0 }, benefits: { rateMultiplier: 1, payoutFrequency: "Monthly", dedicatedManager: false, marketingBudget: 0, customLanding: false, eventsInvites: false }, partners: 812 },
  { key: "silver", name: "Silver", icon: "1st_place_medal", tone: "neutral", criteria: { activeClients: 10, monthlyLots: 150, windowDays: 30, minNetDeposits: 25_000 }, benefits: { rateMultiplier: 1.15, payoutFrequency: "Bi-weekly", dedicatedManager: false, marketingBudget: 500, customLanding: false, eventsInvites: false }, partners: 364 },
  { key: "gold", name: "Gold", icon: "trophy", tone: "gold", criteria: { activeClients: 35, monthlyLots: 600, windowDays: 60, minNetDeposits: 120_000 }, benefits: { rateMultiplier: 1.3, payoutFrequency: "Weekly", dedicatedManager: true, marketingBudget: 2_500, customLanding: true, eventsInvites: false }, partners: 141 },
  { key: "platinum", name: "Platinum", icon: "crown", tone: "info", criteria: { activeClients: 90, monthlyLots: 2_000, windowDays: 90, minNetDeposits: 450_000 }, benefits: { rateMultiplier: 1.5, payoutFrequency: "Weekly", dedicatedManager: true, marketingBudget: 8_000, customLanding: true, eventsInvites: true }, partners: 46 },
  { key: "diamond", name: "Diamond", icon: "gem_stone", tone: "ember", criteria: { activeClients: 250, monthlyLots: 6_500, windowDays: 90, minNetDeposits: 1_500_000 }, benefits: { rateMultiplier: 1.75, payoutFrequency: "Daily", dedicatedManager: true, marketingBudget: 25_000, customLanding: true, eventsInvites: true }, partners: 11 },
];
export const LEVEL_MAP = Object.fromEntries(LEVELS.map((l) => [l.key, l])) as Record<LevelKey, PartnerLevel>;

export const SYMBOL_GROUPS = ["Forex majors", "Forex minors", "Metals", "Indices", "Energies", "Crypto", "Stocks"] as const;
export type SymbolGroup = (typeof SYMBOL_GROUPS)[number];

export interface CommissionPlan {
  id: string;
  name: string;
  kind: "ib" | "cpa" | "hybrid";
  description: string;
  partners: number;
  updated: string;
  updatedBy: string;
  /** $/lot — [group][level] */
  rates: Record<SymbolGroup, Record<LevelKey, number>>;
  tiers: number[]; // % of rate per tier
  cpa: { enabled: boolean; amount: number; minDeposit: number; minLots: number; withinDays: number; countryTiers: { tier: string; countries: string[]; amount: number }[] };
}

function rateMatrix(base: Record<SymbolGroup, number>, mult = 1): CommissionPlan["rates"] {
  const out = {} as CommissionPlan["rates"];
  for (const g of SYMBOL_GROUPS) {
    out[g] = {} as Record<LevelKey, number>;
    for (const l of LEVELS) out[g][l.key] = +(base[g] * mult * l.benefits.rateMultiplier).toFixed(2);
  }
  return out;
}

const COUNTRY_TIERS = [
  { tier: "Tier A", countries: ["ae", "sa", "gb", "de", "sg", "au"], amount: 600 },
  { tier: "Tier B", countries: ["my", "tr", "br", "mx", "za", "th"], amount: 350 },
  { tier: "Tier C", countries: ["in", "ng", "pk", "vn", "eg", "ph"], amount: 150 },
];

export const PLANS: CommissionPlan[] = [
  {
    id: "PLN-STD",
    name: "Standard IB",
    kind: "ib",
    description: "Default rebate plan assigned on partner sign-up.",
    partners: 1_021,
    updated: "2026-09-12T10:14:00+03:00",
    updatedBy: "Mariam Khoury",
    rates: rateMatrix({ "Forex majors": 6, "Forex minors": 7, Metals: 8, Indices: 3, Energies: 4, Crypto: 5, Stocks: 1.5 }),
    tiers: [100, 20, 10],
    cpa: { enabled: false, amount: 250, minDeposit: 500, minLots: 2, withinDays: 30, countryTiers: COUNTRY_TIERS },
  },
  {
    id: "PLN-PRM",
    name: "Premium IB",
    kind: "hybrid",
    description: "Negotiated plan for Gold+ partners with deeper tiers.",
    partners: 198,
    updated: "2026-09-18T16:40:00+03:00",
    updatedBy: "Daniel Novak",
    rates: rateMatrix({ "Forex majors": 8, "Forex minors": 9, Metals: 11, Indices: 4, Energies: 5, Crypto: 7, Stocks: 2 }),
    tiers: [100, 25, 12, 5],
    cpa: { enabled: true, amount: 200, minDeposit: 1_000, minLots: 5, withinDays: 45, countryTiers: COUNTRY_TIERS },
  },
  {
    id: "PLN-CPA",
    name: "Affiliate CPA",
    kind: "cpa",
    description: "Media buyers and affiliates paid per qualified FTD.",
    partners: 127,
    updated: "2026-08-30T09:02:00+03:00",
    updatedBy: "Mariam Khoury",
    rates: rateMatrix({ "Forex majors": 0, "Forex minors": 0, Metals: 0, Indices: 0, Energies: 0, Crypto: 0, Stocks: 0 }),
    tiers: [100],
    cpa: { enabled: true, amount: 400, minDeposit: 250, minLots: 1, withinDays: 30, countryTiers: COUNTRY_TIERS },
  },
  {
    id: "PLN-SUB",
    name: "Regional Sub-broker",
    kind: "ib",
    description: "Country managers with override on their partner network.",
    partners: 28,
    updated: "2026-09-02T12:25:00+03:00",
    updatedBy: "Daniel Novak",
    rates: rateMatrix({ "Forex majors": 9, "Forex minors": 10, Metals: 12, Indices: 5, Energies: 6, Crypto: 8, Stocks: 2.5 }),
    tiers: [100, 30, 15, 8, 4],
    cpa: { enabled: false, amount: 150, minDeposit: 500, minLots: 3, withinDays: 60, countryTiers: COUNTRY_TIERS },
  },
];

export interface CustomDeal {
  kind: "rate" | "percent";
  value: number; // $/lot override or % bonus on top of plan
  group: SymbolGroup | "All groups";
  reason: string;
  approvedBy: string;
  expires: string;
}

export interface Partner {
  id: string;
  name: string;
  photo?: string;
  country: string;
  company: boolean;
  email: string;
  level: LevelKey;
  plan: string;
  status: "active" | "suspended" | "review";
  clientsActive: number;
  clientsTotal: number;
  tree: number[]; // clients per tier (T1, T2, T3…)
  subIbs: number;
  lotsMtd: number;
  lotsPrev: number;
  commissionMtd: number;
  commissionPending: number;
  commissionLifetime: number;
  netDeposits: number;
  customDeal: CustomDeal | null;
  joined: string;
  manager: string;
  subBroker: string | null;
  lotsSeries: number[]; // last 12 months
  refCode: string;
  flags: number;
}

const COMPANIES: [string, string][] = [
  ["Apex Trading Academy", "ng"],
  ["Gulf Markets Hub", "ae"],
  ["PipMasters Club", "my"],
  ["Nusantara FX Community", "id"],
  ["Lagos Traders Guild", "ng"],
  ["Sao Paulo Mercados", "br"],
  ["Istanbul Capital Circle", "tr"],
  ["Mumbai Trade School", "in"],
  ["Cairo FX Signals", "eg"],
  ["Manila Market Mentors", "ph"],
  ["Riyadh Wealth Network", "sa"],
  ["Hanoi Invest Club", "vn"],
  ["Karachi Charts Academy", "pk"],
  ["Johannesburg FX Desk", "za"],
  ["Monterrey Trading Co.", "mx"],
  ["Kuala Lumpur Signals", "my"],
];

const MANAGERS = ["Mariam Khoury", "Daniel Novak", "Anika Sharma", "Leo Hartmann"];

export const SUB_BROKER_NAMES = ["Omar Haddad", "Priya Nair", "Lucas Ferreira", "Hassan Karimi", "Mei Lin", "Daniel Okafor", "Carlos Mendoza", "Elena Petrova", "Aisha Rahman", "Kwame Mensah"];

export const PARTNERS: Partner[] = (() => {
  const r = seeded(4242);
  const indiv = PEOPLE.filter((p) => !SUB_BROKER_NAMES.includes(p.name));
  const pool: { name: string; photo?: string; country: string; company: boolean }[] = [
    ...indiv.map((p) => ({ name: p.name, photo: p.photo, country: p.country, company: false })),
    ...COMPANIES.map(([name, country]) => ({ name, country, company: true })),
    ...PEOPLE.filter((p) => SUB_BROKER_NAMES.includes(p.name)).slice(0, 10).map((p) => ({ name: p.name, photo: p.photo, country: p.country, company: false })),
  ].slice(0, 40);
  // level mix skewed to the top for the "top 40" by revenue
  const levelFor = (i: number): LevelKey => (i < 3 ? "diamond" : i < 9 ? "platinum" : i < 19 ? "gold" : i < 31 ? "silver" : "bronze");
  const order = pool.map((p, i) => ({ p, k: r.next() + (p.company ? 0.1 : 0) + i * 0.001 })).sort((a, b) => a.k - b.k).map((x) => x.p);
  return order.map((p, i) => {
    const level = levelFor(i);
    const L = LEVEL_MAP[level];
    const clientsActive = Math.round(L.criteria.activeClients * r.range(1.05, 1.6) + r.int(1, 8));
    const clientsTotal = Math.round(clientsActive * r.range(1.7, 3.2));
    const t1 = clientsTotal;
    const t2 = level === "bronze" ? 0 : Math.round(t1 * r.range(0.3, 1.2));
    const t3 = level === "bronze" || level === "silver" ? Math.round(t2 * r.range(0, 0.3)) : Math.round(t2 * r.range(0.3, 0.8));
    const t4 = level === "diamond" || level === "platinum" ? Math.round(t3 * r.range(0.1, 0.4)) : 0;
    const lotsMtd = Math.round((Math.max(L.criteria.monthlyLots, 40) * r.range(0.9, 1.5) * (level === "diamond" ? 1.2 : 1)) * 10) / 10;
    const status: Partner["status"] = i === 12 || i === 27 ? "suspended" : i === 7 || i === 33 || i === 21 ? "review" : "active";
    const rate = 6.4 * L.benefits.rateMultiplier;
    const commissionMtd = Math.round(lotsMtd * rate * r.range(0.8, 1.1) * 100) / 100;
    const customDeal: CustomDeal | null =
      i % 6 === 1 || i === 0
        ? {
            kind: r.bool(0.5) ? "rate" : "percent",
            value: r.bool(0.5) ? +(rate + r.range(1, 3)).toFixed(2) : r.pick([5, 10, 15, 20]),
            group: r.pick(["All groups", "Metals", "Forex majors", "Crypto"] as const),
            reason: r.pick(["Competitive match vs. rival broker", "Regional expansion incentive", "Volume commitment 5,000 lots/mo", "Event sponsorship agreement"]),
            approvedBy: r.pick(MANAGERS),
            expires: iso(NOW + r.int(20, 200) * DAY),
          }
        : null;
    if (customDeal && customDeal.kind === "percent") customDeal.value = r.pick([5, 10, 15, 20]);
    if (customDeal && customDeal.kind === "rate") customDeal.value = +(rate + r.range(1, 3)).toFixed(2);
    const base = lotsMtd / (1 + r.range(0, 0.4));
    const lotsSeries = Array.from({ length: 12 }, (_, m) => Math.round(base * (0.55 + m * 0.045) * r.range(0.8, 1.2)));
    lotsSeries[11] = Math.round(lotsMtd);
    const id = `IB-${10240 + ((hashString(p.name) % 8000) + i)}`;
    return {
      id,
      name: p.name,
      photo: p.photo,
      country: p.country,
      company: p.company,
      email: p.company ? `partners@${p.name.toLowerCase().replace(/[^a-z]+/g, "")}.com` : `${p.name.toLowerCase().replace(/[^a-z]+/g, ".")}@mail.com`,
      level,
      plan: level === "diamond" || level === "platinum" ? "Premium IB" : p.company && i % 3 === 0 ? "Affiliate CPA" : "Standard IB",
      status,
      clientsActive,
      clientsTotal,
      tree: [t1, t2, t3, t4].filter((x, k) => k === 0 || x > 0),
      subIbs: level === "bronze" ? 0 : Math.round(t1 * r.range(0.02, 0.08)),
      lotsMtd,
      lotsPrev: Math.round(lotsMtd * r.range(0.75, 1.2)),
      commissionMtd,
      commissionPending: Math.round(commissionMtd * r.range(0.12, 0.4) * 100) / 100,
      commissionLifetime: Math.round(commissionMtd * r.range(8, 30) * 100) / 100,
      netDeposits: Math.round(L.criteria.minNetDeposits * r.range(1.1, 2) + r.int(5000, 40000)),
      customDeal,
      joined: iso(NOW - r.int(90, 1400) * DAY),
      manager: r.pick(MANAGERS),
      subBroker: level === "bronze" && r.bool(0.4) ? null : r.pick(SUB_BROKER_NAMES),
      lotsSeries,
      refCode: `KX${(hashString(id) % 900000 + 100000).toString(36).toUpperCase()}`,
      flags: i === 12 || i === 27 ? 2 : i === 7 || i === 21 ? 1 : 0,
    } as Partner;
  }).sort((a, b) => b.commissionMtd - a.commissionMtd);
})();

export interface PartnerCommission {
  id: string;
  time: string;
  client: string;
  login: string;
  symbol: string;
  lots: number;
  tier: number;
  amount: number;
  kind: "rebate" | "cpa";
}

export function partnerCommissions(partnerId: string, n = 12): PartnerCommission[] {
  const r = seeded(hashString(partnerId));
  const syms = ["EURUSD", "XAUUSD", "GBPUSD", "NAS100", "BTCUSD", "USDJPY", "US30", "USOIL", "ETHUSD", "GBPJPY"];
  let t = NOW - r.int(2, 30) * 60_000;
  return Array.from({ length: n }, (_, i) => {
    t -= r.int(8, 190) * 60_000;
    const cpa = i === 5;
    const tier = r.pick([1, 1, 1, 2, 2, 3]);
    const lots = +r.range(0.1, 6).toFixed(2);
    const pct = tier === 1 ? 1 : tier === 2 ? 0.2 : 0.1;
    return {
      id: `CM-${880000 + (hashString(partnerId + i) % 99999)}`,
      time: iso(t),
      client: PEOPLE[r.int(0, PEOPLE.length - 1)]!.name,
      login: String(80400000 + r.int(1000, 99999)),
      symbol: cpa ? "—" : r.pick(syms),
      lots: cpa ? 0 : lots,
      tier: cpa ? 1 : tier,
      amount: cpa ? 250 : +(lots * 7.5 * pct).toFixed(2),
      kind: cpa ? "cpa" : "rebate",
    };
  });
}

/** 12 months of network commissions, split by tier and by product. */
export const COMMISSION_MONTHS: { label: string; tier: [number, number, number]; product: [number, number, number, number, number]; cpa: number; lots: number }[] = (() => {
  const r = seeded(771);
  const months = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];
  return months.map((label, i) => {
    const total = 310_000 + i * 21_000 + r.range(-25_000, 30_000);
    const t1 = total * r.range(0.7, 0.76);
    const t2 = total * r.range(0.15, 0.19);
    const t3 = total - t1 - t2;
    const fx = total * r.range(0.4, 0.46);
    const met = total * r.range(0.24, 0.3);
    const idx = total * r.range(0.1, 0.13);
    const cry = total * r.range(0.07, 0.11);
    const oth = Math.max(0, total - fx - met - idx - cry);
    return { label, tier: [t1, t2, t3], product: [fx, met, idx, cry, oth], cpa: Math.round(38_000 + i * 1_800 + r.range(-5000, 6000)), lots: Math.round(total / 7.1) };
  });
})();

export interface PayoutBatch {
  id: string;
  period: string;
  frequency: "Monthly" | "Bi-weekly" | "Weekly" | "Daily";
  partners: number;
  amount: number;
  status: "pending" | "review" | "approved" | "completed" | "processing";
  approvals: { name: string; role: string; at?: string }[];
  created: string;
  method: { usdt: number; bank: number; wallet: number };
  held: number;
}

export const PAYOUT_BATCHES: PayoutBatch[] = [
  { id: "PB-2026-W39", period: "15 Sep – 21 Sep 2026", frequency: "Weekly", partners: 198, amount: 184_322.46, status: "pending", approvals: [{ name: "Mariam Khoury", role: "IB Manager", at: "2026-09-24T09:12:00+03:00" }, { name: "Head of Finance", role: "Finance" }], created: "2026-09-22T00:05:00+03:00", method: { usdt: 58, bank: 22, wallet: 20 }, held: 3 },
  { id: "PB-2026-D267", period: "23 Sep 2026", frequency: "Daily", partners: 11, amount: 41_880.12, status: "processing", approvals: [{ name: "Mariam Khoury", role: "IB Manager", at: "2026-09-24T08:02:00+03:00" }, { name: "Leo Hartmann", role: "Finance", at: "2026-09-24T08:40:00+03:00" }], created: "2026-09-24T00:05:00+03:00", method: { usdt: 72, bank: 18, wallet: 10 }, held: 0 },
  { id: "PB-2026-B18", period: "01 Sep – 15 Sep 2026", frequency: "Bi-weekly", partners: 364, amount: 96_410.9, status: "completed", approvals: [{ name: "Daniel Novak", role: "IB Manager", at: "2026-09-16T10:00:00+03:00" }, { name: "Leo Hartmann", role: "Finance", at: "2026-09-16T12:31:00+03:00" }], created: "2026-09-16T00:05:00+03:00", method: { usdt: 51, bank: 19, wallet: 30 }, held: 5 },
  { id: "PB-2026-M08", period: "August 2026", frequency: "Monthly", partners: 812, amount: 71_204.33, status: "completed", approvals: [{ name: "Mariam Khoury", role: "IB Manager", at: "2026-09-02T09:20:00+03:00" }, { name: "Leo Hartmann", role: "Finance", at: "2026-09-02T11:02:00+03:00" }], created: "2026-09-01T00:05:00+03:00", method: { usdt: 44, bank: 14, wallet: 42 }, held: 9 },
];

export const IB_KPIS = {
  partners: LEVELS.reduce((s, l) => s + l.partners, 0),
  active: 1_086,
  newThisMonth: 64,
  networkLotsMtd: 71_842.6,
  networkLotsDelta: 8.4,
  commissionPending: 226_202.58,
  commissionPaidMtd: 412_896.4,
  cpaMtd: 51_600,
  clientsReferred: 38_412,
  ibShareOfVolume: 61.2,
};

/* ---------------- Sub-brokers ---------------- */

export interface SubBroker {
  id: string;
  name: string;
  photo: string;
  country: string;
  region: string;
  countries: string[];
  partners: number;
  activePartners: number;
  overridePct: number;
  lotsMtd: number;
  lotsPrev: number;
  overrideEarned: number;
  netDeposits: number;
  status: "active" | "paused" | "review";
  since: string;
  target: number; // lots target
}

export const SUB_BROKERS: SubBroker[] = (() => {
  const r = seeded(9090);
  const regions: [string, string, string[]][] = [
    ["Omar Haddad", "GCC", ["sa", "ae", "kw", "qa", "bh", "om"]],
    ["Priya Nair", "South Asia", ["in", "lk", "bd"]],
    ["Lucas Ferreira", "LATAM South", ["br", "ar", "cl", "uy"]],
    ["Hassan Karimi", "Türkiye & Caucasus", ["tr", "az", "ge"]],
    ["Mei Lin", "South-East Asia", ["sg", "my", "id", "th"]],
    ["Daniel Okafor", "West Africa", ["ng", "gh", "ci", "sn"]],
    ["Carlos Mendoza", "LATAM North", ["mx", "co", "pe", "gt"]],
    ["Elena Petrova", "Europe (EEA)", ["cy", "gr", "bg", "ro"]],
    ["Aisha Rahman", "Malaysia & Brunei", ["my", "bn"]],
    ["Kwame Mensah", "East & South Africa", ["ke", "za", "ug", "tz"]],
  ];
  return regions.map(([name, region, countries], i) => {
    const p = PEOPLE.find((x) => x.name === name)!;
    const partners = r.int(28, 190);
    const lotsMtd = Math.round(r.range(1800, 14_000));
    return {
      id: `SB-${301 + i}`,
      name,
      photo: p.photo,
      country: p.country,
      region,
      countries,
      partners,
      activePartners: Math.round(partners * r.range(0.55, 0.85)),
      overridePct: r.pick([5, 7.5, 10, 10, 12.5, 15]),
      lotsMtd,
      lotsPrev: Math.round(lotsMtd * r.range(0.8, 1.15)),
      overrideEarned: Math.round(lotsMtd * r.range(0.6, 1.1) * 100) / 100,
      netDeposits: Math.round(r.range(180_000, 2_400_000)),
      status: i === 8 ? "review" : i === 9 ? "paused" : "active",
      since: iso(NOW - r.int(200, 1500) * DAY),
      target: Math.round(lotsMtd * r.range(0.9, 1.5) / 100) * 100,
    };
  });
})();

/* ---------------- Fraud flags ---------------- */

export type FraudType = "wash" | "hedge" | "selfref";
export const FRAUD_LABEL: Record<FraudType, string> = { wash: "Wash trading", hedge: "Cross-client hedging", selfref: "Self-referral" };

export interface TradePair {
  symbol: string;
  a: { login: string; ticket: string; side: "buy" | "sell"; lots: number; time: string };
  b: { login: string; ticket: string; side: "buy" | "sell"; lots: number; time: string };
  deltaMs: number;
  pnlA: number;
  pnlB: number;
}

export interface FraudFlag {
  id: string;
  type: FraudType;
  partnerId: string;
  partnerName: string;
  partnerPhoto?: string;
  country: string;
  severity: "critical" | "high" | "medium" | "low";
  score: number;
  accounts: string[];
  affectedCommission: number;
  affectedLots: number;
  detected: string;
  status: "open" | "investigating" | "resolved" | "dismissed";
  summary: string;
  pairs: TradePair[];
  shared: { kind: "ip" | "device" | "wallet" | "card" | "address"; value: string; accounts: number; note?: string }[];
  rule: string;
}

export const FRAUD_FLAGS: FraudFlag[] = (() => {
  const r = seeded(31337);
  const types: FraudType[] = ["wash", "hedge", "selfref", "wash", "hedge", "selfref", "hedge", "wash", "selfref", "hedge", "wash", "selfref", "hedge", "wash"];
  const sev: FraudFlag["severity"][] = ["critical", "high", "high", "medium", "critical", "medium", "high", "low", "medium", "high", "medium", "low", "medium", "high"];
  const syms = ["EURUSD", "XAUUSD", "GBPUSD", "USDJPY", "NAS100", "BTCUSD", "GBPJPY"];
  const ps = PARTNERS.slice(3);
  return types.map((type, i) => {
    const p = ps[(i * 5) % ps.length]!;
    const n = r.int(2, 4);
    const accounts = Array.from({ length: n }, () => String(80400000 + r.int(10000, 99999)));
    const detected = NOW - r.int(1, 60) * 3_600_000 * (i + 1) * 0.6;
    const pairs: TradePair[] =
      type === "selfref"
        ? []
        : Array.from({ length: r.int(5, 9) }, (_, k) => {
            const t = Math.round(detected - k * r.int(20, 90) * 60_000 - r.int(0, 59_999));
            const d = type === "wash" ? r.int(40, 900) : r.int(300, 2600);
            const lots = +r.pick([1, 2, 2.5, 3, 5, 10]).toFixed(2);
            const side = r.bool() ? "buy" : "sell";
            const pnl = +r.range(-420, 420).toFixed(2);
            return {
              symbol: r.pick(syms),
              a: { login: accounts[0]!, ticket: String(51_200_000 + r.int(1000, 99999)), side, lots, time: iso(t) },
              b: { login: accounts[1]!, ticket: String(51_200_000 + r.int(1000, 99999)), side: side === "buy" ? "sell" : "buy", lots, time: iso(t + d) },
              deltaMs: d,
              pnlA: pnl,
              pnlB: +(-pnl - r.range(2, 18)).toFixed(2),
            } as TradePair;
          });
    const ip = `${r.int(31, 197)}.${r.int(10, 250)}.${r.int(0, 255)}.${r.int(2, 254)}`;
    const shared: FraudFlag["shared"] =
      type === "wash"
        ? [
            { kind: "ip", value: ip, accounts: n, note: "Same /32 within 2s of each fill" },
            { kind: "device", value: `fp_${(hashString(ip) >>> 0).toString(16)}`, accounts: n - 1, note: "Chrome 128 · macOS 14.6" },
          ]
        : type === "hedge"
          ? [
              { kind: "ip", value: ip, accounts: n, note: "Residential ISP, shared across logins" },
              { kind: "device", value: `fp_${(hashString(ip + "d") >>> 0).toString(16)}`, accounts: n, note: "MT5 Android 5.0.4" },
              { kind: "address", value: r.pick(["Apt 12, Palm Residence, Dubai Marina", "14 Adeola Odeku St, Lagos", "Jl. Sudirman 21, Jakarta"]), accounts: 2 },
            ]
          : [
              { kind: "device", value: `fp_${(hashString(ip + "s") >>> 0).toString(16)}`, accounts: n + 1, note: "Partner login and client sign-up on same device" },
              { kind: "wallet", value: `TQ7x${(hashString(ip) >>> 0).toString(36).toUpperCase()}pLm${r.int(100, 999)}9KfE`, accounts: n + 1, note: "USDT TRC20 deposit source = partner payout wallet" },
              { kind: "ip", value: ip, accounts: n, note: "Sign-up IP matches partner last login" },
            ];
    const affectedLots = type === "selfref" ? +r.range(40, 380).toFixed(1) : pairs.reduce((s, x) => s + x.a.lots + x.b.lots, 0) * r.int(6, 14);
    return {
      id: `FRD-${7710 + i}`,
      type,
      partnerId: p.id,
      partnerName: p.name,
      partnerPhoto: p.photo,
      country: p.country,
      severity: sev[i]!,
      score: sev[i] === "critical" ? r.int(88, 97) : sev[i] === "high" ? r.int(72, 87) : sev[i] === "medium" ? r.int(48, 71) : r.int(25, 47),
      accounts,
      affectedCommission: +(affectedLots * r.range(6, 9.5)).toFixed(2),
      affectedLots: +affectedLots.toFixed(1),
      detected: iso(detected),
      status: i < 5 ? "open" : i < 9 ? "investigating" : i < 12 ? "resolved" : "dismissed",
      summary:
        type === "wash"
          ? `${pairs.length} opposing fill pairs within ${Math.max(...pairs.map((x) => x.deltaMs))}ms across ${n} referred accounts`
          : type === "hedge"
            ? `Mirrored positions on ${n} accounts from one IP / device, net exposure ≈ 0`
            : `${n + 1} referred clients share the partner's device fingerprint and payout wallet`,
      rule: type === "wash" ? "R-WASH-02 · opposing trades < 1s, same symbol & size" : type === "hedge" ? "R-HEDGE-05 · mirrored exposure ≥ 90% across linked accounts" : "R-SELF-01 · partner ↔ client identity overlap",
      pairs,
      shared,
    };
  });
})();

/* ================================================================== */
/* SOCIAL & ALGO                                                        */
/* ================================================================== */

export interface Master {
  id: string;
  name: string;
  photo: string;
  country: string;
  strategy: string;
  type: "copy" | "pamm" | "signal";
  status: "active" | "paused" | "review" | "suspended";
  hidden: boolean;
  aum: number;
  followers: number;
  return12m: number;
  return30d: number;
  maxDD: number;
  riskScore: number;
  perfFee: number;
  mgmtFee: number;
  since: string;
  trades: number;
  winRate: number;
  openPositions: number;
  login: string;
  equity: number[];
}

export const MASTERS: Master[] = (() => {
  const r = seeded(5150);
  const strategies = ["Gold Momentum", "London Breakout", "Asian Range Scalper", "Swing Majors", "Index Trend Rider", "Crypto Carry", "Mean Reversion FX", "NY Session Sniper", "Macro Carry Basket", "Oil Seasonal", "Nasdaq Pullbacks", "Grid Hedger EA", "Yen Crosses Swing", "BTC Volatility", "Metals Arbitrage", "Quant Multi-Asset", "Scalp Pro 5M", "Conservative Growth", "Aggressive Gold", "Euro Trend", "Harmonic Patterns", "Swiss Army FX"];
  return strategies.map((strategy, i) => {
    const p = PEOPLE[(i * 7 + 3) % PEOPLE.length]!;
    const type: Master["type"] = i % 4 === 1 ? "pamm" : i % 7 === 3 ? "signal" : "copy";
    const risk = r.int(12, 92);
    const maxDD = +(risk * r.range(0.3, 0.55)).toFixed(1);
    const ret = +(r.range(-12, 30) + risk * r.range(0.2, 0.9)).toFixed(1);
    let v = 100;
    const equity = Array.from({ length: 52 }, () => (v *= 1 + (ret / 100 / 52) + r.normal() * (risk / 3000)));
    const realRet = +((equity[equity.length - 1]! / 100 - 1) * 100).toFixed(1);
    const last4 = +((equity[equity.length - 1]! / equity[equity.length - 5]! - 1) * 100).toFixed(2);
    return {
      id: `MS-${2100 + i}`,
      name: p.name,
      photo: p.photo,
      country: p.country,
      strategy,
      type,
      status: i === 11 ? "suspended" : i === 17 || i === 6 ? "review" : i === 14 ? "paused" : "active",
      hidden: i === 11 || i === 18,
      aum: Math.round(r.range(40_000, type === "pamm" ? 4_800_000 : 1_900_000)),
      followers: r.int(18, 2400),
      return12m: realRet,
      return30d: last4,
      maxDD,
      riskScore: risk,
      perfFee: r.pick([15, 20, 20, 25, 30, 35]),
      mgmtFee: type === "pamm" ? r.pick([1, 1.5, 2]) : 0,
      since: iso(NOW - r.int(120, 1300) * DAY),
      trades: r.int(180, 5200),
      winRate: +r.range(42, 78).toFixed(1),
      openPositions: r.int(0, 34),
      login: String(80410000 + r.int(1000, 89999)),
      equity,
    };
  });
})();

export const SOCIAL_KPIS = {
  masters: 312,
  activeMasters: 248,
  followers: 18_406,
  copiedAum: 42_880_310.55,
  pammAum: 27_406_922.1,
  feesMtd: 318_442.9,
  platformCutMtd: 63_688.58,
  copiedVolumeLots: 94_210,
};

/* ---------------- PAMM ---------------- */

export interface PammFund {
  id: string;
  name: string;
  manager: string;
  photo: string;
  country: string;
  nav: number;
  navChange30d: number;
  units: number;
  aum: number;
  investors: number;
  rollover: "Daily" | "Weekly" | "Monthly";
  nextRollover: string;
  perfFee: number;
  mgmtFee: number;
  hwm: number;
  minInvestment: number;
  lockupDays: number;
  status: "active" | "paused" | "review";
  maxDD: number;
  return12m: number;
  managerCapital: number;
}

export const PAMM_FUNDS: PammFund[] = (() => {
  const r = seeded(6060);
  const names = ["Kalks Gold Alpha", "Majors Balanced", "Index Momentum", "Crypto Quant I", "Conservative Yield", "Emerging FX Carry", "Energy Macro", "Asia Swing Fund"];
  const rolls: PammFund["rollover"][] = ["Weekly", "Monthly", "Daily", "Weekly", "Monthly", "Weekly", "Daily", "Monthly"];
  return names.map((name, i) => {
    const p = PEOPLE[(i * 5 + 2) % PEOPLE.length]!;
    const nav = +r.range(0.92, 2.4).toFixed(4);
    const units = Math.round(r.range(900_000, 5_600_000));
    const roll = rolls[i]!;
    const next = roll === "Daily" ? Date.parse("2026-09-25T00:00:00+03:00") : roll === "Weekly" ? Date.parse("2026-09-28T00:00:00+03:00") : Date.parse("2026-10-01T00:00:00+03:00");
    return {
      id: `PAMM-${410 + i}`,
      name,
      manager: p.name,
      photo: p.photo,
      country: p.country,
      nav,
      navChange30d: +r.range(-3.5, 7.8).toFixed(2),
      units,
      aum: +(nav * units).toFixed(2),
      investors: r.int(24, 860),
      rollover: roll,
      nextRollover: iso(next),
      perfFee: r.pick([20, 25, 30]),
      mgmtFee: r.pick([1, 1.5, 2]),
      hwm: +(nav * r.range(1, 1.06)).toFixed(4),
      minInvestment: r.pick([100, 250, 500, 1000]),
      lockupDays: r.pick([0, 7, 30]),
      status: i === 6 ? "paused" : i === 7 ? "review" : "active",
      maxDD: +r.range(4, 26).toFixed(1),
      return12m: +r.range(-6, 48).toFixed(1),
      managerCapital: Math.round(r.range(25_000, 380_000)),
    };
  });
})();

export function navSeries(fundId: string, days = 180) {
  const f = PAMM_FUNDS.find((x) => x.id === fundId) ?? PAMM_FUNDS[0]!;
  const r = seeded(hashString(fundId));
  const out: { time: number; value: number; volume: number }[] = [];
  let v = f.nav / (1 + f.return12m / 100 / 2);
  const drift = Math.log(f.nav / v) / days;
  const start = Math.floor(Date.parse("2026-09-24T00:00:00Z") / 1000) - days * 86400;
  for (let d = 0; d < days; d++) {
    v *= Math.exp(drift + r.normal() * 0.006);
    out.push({ time: start + d * 86400, value: +v.toFixed(4), volume: Math.round(r.range(200, 4000)) });
  }
  const k = f.nav / out[out.length - 1]!.value;
  return out.map((p) => ({ ...p, value: +(p.value * k).toFixed(4) }));
}

export interface PammRequest {
  id: string;
  fundId: string;
  fund: string;
  investor: string;
  photo: string;
  country: string;
  kind: "deposit" | "withdrawal";
  amount: number;
  units: number;
  created: string;
  executesAt: string;
  status: "pending" | "approved" | "rejected";
  note?: string;
}

export const PAMM_REQUESTS: PammRequest[] = (() => {
  const r = seeded(6161);
  return Array.from({ length: 14 }, (_, i) => {
    const f = PAMM_FUNDS[r.int(0, PAMM_FUNDS.length - 1)]!;
    const p = PEOPLE[r.int(0, PEOPLE.length - 1)]!;
    const kind = r.bool(0.58) ? "deposit" : "withdrawal";
    const amount = Math.round(r.range(250, kind === "deposit" ? 48_000 : 26_000));
    return {
      id: `PRQ-${55120 + i}`,
      fundId: f.id,
      fund: f.name,
      investor: p.name,
      photo: p.photo,
      country: p.country,
      kind,
      amount,
      units: +(amount / f.nav).toFixed(2),
      created: iso(NOW - r.int(10, 3000) * 60_000),
      executesAt: f.nextRollover,
      status: "pending",
      note: kind === "withdrawal" && i % 5 === 0 ? "Inside lock-up — early exit fee 2%" : amount > 25_000 ? "Large ticket — source of funds check" : undefined,
    };
  });
})();

/* ---------------- Applications ---------------- */

export interface MasterApplication {
  id: string;
  name: string;
  photo: string;
  country: string;
  type: "copy" | "pamm" | "signal";
  strategy: string;
  description: string;
  login: string;
  submitted: string;
  kyc: boolean;
  trackDays: number;
  equity: number;
  maxDD: number;
  trades: number;
  violations: number;
  return90d: number;
  requestedPerfFee: number;
  requestedMgmtFee: number;
  instruments: string[];
  status: "pending" | "review" | "approved" | "rejected";
  equityCurve: number[];
}

export const APPLICATIONS: MasterApplication[] = (() => {
  const r = seeded(7272);
  const strat = [
    ["Gold Session Breakout", "Trades XAUUSD breakouts from the Asian range with fixed 1:2 R:R; max 3 trades a day."],
    ["FX Carry Basket", "Long high-yield vs. funding currencies, rebalanced weekly; hedged with options overlay on MT5."],
    ["Nasdaq Opening Drive", "Momentum entries on NAS100 in the first 45 minutes of the US cash session."],
    ["Martingale Recovery EA", "Grid entries on EURUSD doubling lot size after each loss until basket TP."],
    ["Swing Majors Pro", "Daily-chart swing trades on the 4 majors using structure and 50/200 EMA."],
    ["BTC Volatility Harvest", "Mean-reversion on BTCUSD around VWAP bands with hard stops."],
    ["Oil Inventory Fade", "Fades the EIA inventory spike on USOIL/UKOIL with 15-minute holds."],
    ["Yen Crosses Trend", "Trend-following on GBPJPY / EURJPY with ATR trailing stops."],
    ["Index Pairs Neutral", "Long/short US30 vs. SPX500 spread, market neutral."],
    ["Scalper Ultra 1M", "High-frequency scalping on EURUSD during London open."],
  ];
  return strat.map(([strategy, description], i) => {
    const p = PEOPLE[(i * 3 + 5) % PEOPLE.length]!;
    const bad = i === 3 || i === 9;
    let v = 100;
    const eq = Array.from({ length: 30 }, () => (v *= 1 + r.range(-0.012, 0.018)));
    return {
      id: `APP-${3300 + i}`,
      name: p.name,
      photo: p.photo,
      country: p.country,
      type: i % 3 === 1 ? "pamm" : i === 6 ? "signal" : "copy",
      strategy: strategy!,
      description: description!,
      login: String(80420000 + r.int(1000, 89999)),
      submitted: iso(NOW - r.int(1, 120) * 3_600_000),
      kyc: i !== 5,
      trackDays: bad ? r.int(40, 80) : r.int(95, 720),
      equity: i === 7 ? 740 : Math.round(r.range(1_800, 120_000)),
      maxDD: bad ? +r.range(38, 61).toFixed(1) : +r.range(6, 31).toFixed(1),
      trades: i === 8 ? 34 : r.int(60, 2400),
      violations: i === 3 ? 2 : i === 9 ? 1 : 0,
      return90d: +r.range(-4, 38).toFixed(1),
      requestedPerfFee: r.pick([20, 25, 30, 40]),
      requestedMgmtFee: i % 3 === 1 ? r.pick([1, 2, 3]) : 0,
      instruments: r.pick([["XAUUSD"], ["EURUSD", "GBPUSD", "USDJPY"], ["NAS100", "US30"], ["BTCUSD", "ETHUSD"], ["USOIL", "UKOIL"], ["GBPJPY", "EURJPY"]]),
      status: i < 7 ? "pending" : i === 7 ? "review" : "pending",
      equityCurve: eq,
    };
  });
})();

/* ---------------- Marketplace ---------------- */

export interface Listing {
  id: string;
  title: string;
  author: string;
  photo: string;
  country: string;
  category: "Strategy" | "EA" | "Signal" | "Indicator";
  platform: "MT5" | "cTrader" | "API" | "Web";
  priceModel: "one-time" | "monthly" | "free" | "profit-share";
  price: number;
  backtest: { period: string; winRate: number; profitFactor: number; maxDD: number; trades: number; cagr: number; sharpe: number };
  flags: string[];
  status: "pending" | "changes" | "live" | "rejected";
  submitted: string;
  subscribers: number;
  rating: number;
  revenue30d: number;
  claim: string;
  symbols: string[];
}

export const LISTINGS: Listing[] = (() => {
  const r = seeded(8383);
  const raw: [string, Listing["category"], Listing["platform"], Listing["priceModel"], string[], string][] = [
    ["Aurum Breakout EA", "EA", "MT5", "one-time", [], "Breakout EA for XAUUSD with news filter"],
    ["Never-Lose Grid Master", "EA", "MT5", "monthly", ["Misleading claims", "Martingale detected"], "Guaranteed 30% monthly, zero losing months"],
    ["London Open Signals", "Signal", "Web", "monthly", [], "3–5 London session signals a day with SL/TP"],
    ["Quant Trend Basket", "Strategy", "API", "profit-share", ["Backtest overfit"], "Multi-asset trend basket via REST API"],
    ["Volume Profile Pro", "Indicator", "MT5", "one-time", [], "Session volume profile with POC / value area"],
    ["Crypto Pump Radar", "Signal", "Web", "monthly", ["Misleading claims", "Unlicensed advice"], "Catch 100x altcoin pumps before they happen"],
    ["Swing Majors Copy", "Strategy", "cTrader", "profit-share", [], "Daily swing trades on 4 majors"],
    ["Recovery Hedger EA", "EA", "MT5", "one-time", ["Martingale detected"], "Averaging-down hedge engine for EURUSD"],
    ["Index Gap Fader", "Strategy", "MT5", "monthly", [], "Fades overnight gaps on NAS100 / US30"],
    ["Smart Money Zones", "Indicator", "MT5", "free", [], "Order block and liquidity sweep detection"],
    ["Gold Scalper X", "EA", "MT5", "one-time", ["Latency arbitrage suspected"], "Sub-second gold scalps on tick data"],
    ["Macro Carry Signals", "Signal", "Web", "monthly", [], "Weekly carry-trade signals with rationale"],
    ["Yen Trend Rider", "Strategy", "API", "profit-share", [], "ATR trend-following on JPY crosses"],
    ["Asian Range Bot", "EA", "cTrader", "monthly", [], "Range trading during the Tokyo session"],
    ["Oil Seasonal Map", "Indicator", "Web", "one-time", [], "Seasonality overlay for WTI and Brent"],
    ["BTC Momentum API", "Strategy", "API", "profit-share", [], "4h momentum on BTC and ETH via REST"],
  ];
  const statuses: Listing["status"][] = ["pending", "pending", "pending", "changes", "pending", "pending", "live", "pending", "live", "live", "pending", "live", "live", "changes", "live", "live"];
  const symbolsFor = (t: string) => (t.match(/Gold|Aurum/) ? ["XAUUSD"] : t.match(/Index|Nas/) ? ["NAS100", "US30"] : t.match(/Crypto|BTC/) ? ["BTCUSD", "ETHUSD"] : t.match(/Oil/) ? ["USOIL", "UKOIL"] : t.match(/Yen/) ? ["GBPJPY", "USDJPY"] : ["EURUSD", "GBPUSD"]);
  return raw.map(([title, category, platform, priceModel, flags, claim], i) => {
    const p = PEOPLE[(i * 5 + 1) % PEOPLE.length]!;
    const risky = flags.length > 0;
    return {
      id: `MKT-${6100 + i}`,
      title,
      author: p.name,
      photo: p.photo,
      country: p.country,
      category,
      platform,
      priceModel,
      price: priceModel === "free" ? 0 : priceModel === "profit-share" ? r.pick([15, 20, 25]) : priceModel === "monthly" ? r.pick([29, 49, 79, 99, 149]) : r.pick([199, 299, 449, 699, 990]),
      backtest: {
        period: r.pick(["Jan 2021 – Aug 2026", "Jan 2019 – Aug 2026", "Mar 2023 – Sep 2026"]),
        winRate: risky ? +r.range(82, 96).toFixed(1) : +r.range(44, 68).toFixed(1),
        profitFactor: risky ? +r.range(2.8, 6.4).toFixed(2) : +r.range(1.2, 2.1).toFixed(2),
        maxDD: risky ? +r.range(38, 78).toFixed(1) : +r.range(6, 24).toFixed(1),
        trades: r.int(240, 9000),
        cagr: risky ? +r.range(180, 900).toFixed(0) : +r.range(8, 46).toFixed(1),
        sharpe: risky ? +r.range(3.2, 6.1).toFixed(2) : +r.range(0.8, 2.2).toFixed(2),
      },
      flags,
      status: statuses[i]!,
      submitted: iso(NOW - r.int(1, 200) * 3_600_000),
      subscribers: statuses[i] === "live" ? r.int(40, 2600) : 0,
      rating: +r.range(3.6, 4.9).toFixed(1),
      revenue30d: statuses[i] === "live" ? Math.round(r.range(900, 38_000)) : 0,
      claim,
      symbols: symbolsFor(title),
    };
  });
})();

/* ---------------- API keys ---------------- */

export interface ApiKey {
  id: string;
  prefix: string;
  label: string;
  owner: string;
  photo: string;
  country: string;
  login: string;
  scopes: string[];
  rpm: number;
  limit: number;
  usage: number[]; // req/min last 30 min
  rateHits24h: number;
  orders24h: number;
  openPositions: number;
  lastIp: string;
  ipCountry: string;
  lastSeen: string;
  created: string;
  status: "active" | "throttled" | "killed";
  anomaly?: string;
}

export const API_KEYS: ApiKey[] = (() => {
  const r = seeded(9393);
  const labels = ["Grid bot prod", "TradingView webhook", "Python quant", "Copy bridge", "Portfolio sync", "HFT gold", "Rebalancer", "Signal relay", "News trader", "cTrader bridge", "Backtest runner", "Arb scanner", "Hedge engine", "Telegram bot", "Market maker", "Data export"];
  const scopeSets = [["read", "trade"], ["read", "trade", "withdraw:none"], ["read"], ["read", "trade", "copy"], ["read", "trade", "transfer"], ["read", "trade"]];
  return labels.map((label, i) => {
    const p = PEOPLE[(i * 11 + 4) % PEOPLE.length]!;
    const limit = r.pick([120, 300, 600, 1200]);
    const hot = i === 5 || i === 11 || i === 14;
    const base = hot ? limit * r.range(0.75, 1.05) : limit * r.range(0.04, 0.45);
    const usage = Array.from({ length: 30 }, (_, k) => Math.max(0, Math.round(base * (0.7 + r.range(0, 0.6)) * (hot && k > 22 ? 1.25 : 1))));
    const status: ApiKey["status"] = i === 11 ? "killed" : i === 5 || i === 14 ? "throttled" : "active";
    return {
      id: `KEY-${4400 + i}`,
      prefix: `kx_live_${(hashString(label) >>> 0).toString(36).slice(0, 6)}`,
      label,
      owner: p.name,
      photo: p.photo,
      country: p.country,
      login: String(80430000 + r.int(1000, 89999)),
      scopes: scopeSets[i % scopeSets.length]!,
      rpm: status === "killed" ? 0 : usage[usage.length - 1]!,
      limit,
      usage,
      rateHits24h: hot ? r.int(420, 4800) : r.int(0, 30),
      orders24h: r.int(20, hot ? 48_000 : 3_000),
      openPositions: status === "killed" ? 0 : r.int(0, hot ? 180 : 24),
      lastIp: `${r.int(31, 197)}.${r.int(10, 250)}.${r.int(0, 255)}.${r.int(2, 254)}`,
      ipCountry: i === 7 ? "ru" : p.country,
      lastSeen: iso(NOW - (status === "killed" ? 3 * 3_600_000 : r.int(1, 300) * 1000)),
      created: iso(NOW - r.int(10, 500) * DAY),
      status,
      anomaly: i === 5 ? "Order-to-trade ratio 94:1" : i === 14 ? "Quote stuffing pattern" : i === 11 ? "Latency arbitrage vs. LP feed" : i === 7 ? "New IP geography" : undefined,
    };
  });
})();

/* ---------------- Settings ---------------- */

export const SOCIAL_SETTINGS = {
  perfFeeMin: 5,
  perfFeeMax: 50,
  mgmtFeeMax: 3,
  subscriptionFeeMax: 199,
  entryFeeMax: 2,
  platformCut: 20,
  highWaterMark: true,
  rolloverPeriods: ["Daily", "Weekly", "Monthly"] as string[],
  leaderboard: { minDays: 90, minEquity: 1000, maxDD: 35, minTrades: 50, minFollowers: 5, requireKyc: true, excludeMartingale: true },
  copy: { maxFollowersPerMaster: 5000, minCopyAmount: 50, maxSlippagePips: 3, allowReverseCopy: false },
};
