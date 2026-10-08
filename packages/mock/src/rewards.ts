import { seeded } from "./rng";
import { PEOPLE, type Person } from "./people";

/* ------------------------------------------------------------------ */
/* Contests                                                            */
/* ------------------------------------------------------------------ */

export type ContestKind = "demo" | "live";

export interface Contest {
  id: string;
  name: string;
  tagline: string;
  kind: ContestKind;
  image: string;
  prizePool: number;
  entryFee: number; // 0 = free
  startsAt: string; // ISO
  endsAt: string; // ISO
  participants: number;
  maxParticipants?: number;
  instruments: string;
  minDeposit?: number;
  prizes: number[]; // 1st, 2nd, 3rd …
  winner?: Person & { gainPct: number };
}

export const ACTIVE_CONTEST: Contest & { myRank: number; myGainPct: number; myEquity: number; myStartBalance: number; joined: boolean; rules: string[] } = {
  id: "c_sep26",
  name: "Autumn Gold Rush 2026",
  tagline: "Four weeks. One leaderboard. $50,000 in real prizes.",
  kind: "live",
  image: "/assets/photos/gold.jpg",
  prizePool: 50000,
  entryFee: 0,
  startsAt: "2026-09-07T00:00:00Z",
  endsAt: "2026-10-04T20:00:00Z",
  participants: 2318,
  instruments: "All symbols · XAUUSD 1.5× points",
  minDeposit: 200,
  prizes: [15000, 8000, 5000, 3500, 2500, 2000, 1500, 1200, 1000, 800],
  myRank: 14,
  myGainPct: 31.42,
  myEquity: 1314.2,
  myStartBalance: 1000,
  joined: true,
  rules: [
    "Dedicated contest account, $1,000 starting balance",
    "Ranking by % gain on equity, updated every 60s",
    "Max leverage 1:200 · no hedging across accounts",
    "Minimum 20 closed trades to qualify for prizes",
  ],
};

export interface LeaderRow {
  rank: number;
  person: Person;
  gainPct: number;
  equity: number;
  trades: number;
  winRate: number;
  prize: number;
  curve: number[];
  isMe?: boolean;
  change: number; // rank change vs yesterday
}

function curve(seed: number, gain: number, n = 28): number[] {
  const r = seeded(seed);
  const out: number[] = [];
  let v = 1000;
  const end = 1000 * (1 + gain / 100);
  for (let i = 0; i < n; i++) {
    const target = 1000 + ((end - 1000) * i) / (n - 1);
    v = target + r.normal() * 1000 * 0.025 * (1 + gain / 200);
    out.push(+v.toFixed(2));
  }
  out[n - 1] = +end.toFixed(2);
  return out;
}

export const LEADERBOARD: LeaderRow[] = (() => {
  const r = seeded(7117);
  const gains = [148.62, 121.4, 104.87, 88.15, 79.3, 71.62, 64.28, 58.9, 52.14, 47.66, 42.3, 38.72, 34.11];
  const pool = PEOPLE.slice(1);
  const rows: LeaderRow[] = gains.map((g, i) => {
    const p = pool[(i * 5 + 3) % pool.length]!;
    return {
      rank: i + 1,
      person: p,
      gainPct: g,
      equity: +(1000 * (1 + g / 100)).toFixed(2),
      trades: r.int(24, 188),
      winRate: +r.range(48, 76).toFixed(1),
      prize: ACTIVE_CONTEST.prizes[i] ?? 0,
      curve: curve(900 + i, g),
      change: r.pick([-2, -1, 0, 0, 1, 1, 2, 3]),
    };
  });
  rows.push({
    rank: 14,
    person: PEOPLE[0]!,
    gainPct: ACTIVE_CONTEST.myGainPct,
    equity: ACTIVE_CONTEST.myEquity,
    trades: 46,
    winRate: 63.0,
    prize: 0,
    curve: curve(4242, ACTIVE_CONTEST.myGainPct),
    isMe: true,
    change: 5,
  });
  return rows;
})();

export const UPCOMING_CONTESTS: Contest[] = [
  {
    id: "c_oct_demo",
    name: "Demo Sprint · October",
    tagline: "Risk-free weekly sprint for new traders",
    kind: "demo",
    image: "/assets/photos/trading-screen.jpg",
    prizePool: 5000,
    entryFee: 0,
    startsAt: "2026-10-05T00:00:00Z",
    endsAt: "2026-10-11T20:00:00Z",
    participants: 1284,
    instruments: "Forex majors only",
    prizes: [1500, 1000, 750],
  },
  {
    id: "c_crypto_q4",
    name: "Crypto Clash Q4",
    tagline: "BTC, ETH, SOL — highest % gain wins",
    kind: "live",
    image: "/assets/photos/bitcoin.jpg",
    prizePool: 25000,
    entryFee: 0,
    startsAt: "2026-10-12T00:00:00Z",
    endsAt: "2026-11-08T20:00:00Z",
    participants: 642,
    maxParticipants: 3000,
    instruments: "Crypto CFDs",
    minDeposit: 500,
    prizes: [8000, 5000, 3000],
  },
  {
    id: "c_nyc",
    name: "Wall Street Open",
    tagline: "US indices & stocks during NY session",
    kind: "live",
    image: "/assets/photos/nyc.jpg",
    prizePool: 30000,
    entryFee: 25,
    startsAt: "2026-11-02T00:00:00Z",
    endsAt: "2026-11-27T20:00:00Z",
    participants: 318,
    maxParticipants: 1500,
    instruments: "NAS100 · US30 · SPX500 · US stocks",
    minDeposit: 1000,
    prizes: [10000, 6000, 4000],
  },
];

export const PAST_CONTESTS: Contest[] = [
  {
    id: "c_aug26",
    name: "Summer FX Masters",
    tagline: "",
    kind: "live",
    image: "/assets/photos/london.jpg",
    prizePool: 40000,
    entryFee: 0,
    startsAt: "2026-08-03T00:00:00Z",
    endsAt: "2026-08-30T20:00:00Z",
    participants: 2104,
    instruments: "Forex",
    prizes: [12000],
    winner: { ...PEOPLE[8]!, gainPct: 212.4 },
  },
  {
    id: "c_jul_demo",
    name: "Demo Sprint · July",
    tagline: "",
    kind: "demo",
    image: "/assets/photos/charts.jpg",
    prizePool: 5000,
    entryFee: 0,
    startsAt: "2026-07-13T00:00:00Z",
    endsAt: "2026-07-19T20:00:00Z",
    participants: 1812,
    instruments: "Forex majors",
    prizes: [1500],
    winner: { ...PEOPLE[15]!, gainPct: 96.1 },
  },
  {
    id: "c_jun26",
    name: "Dubai Gold Cup",
    tagline: "",
    kind: "live",
    image: "/assets/photos/dubai.jpg",
    prizePool: 50000,
    entryFee: 0,
    startsAt: "2026-06-01T00:00:00Z",
    endsAt: "2026-06-28T20:00:00Z",
    participants: 2640,
    instruments: "Metals",
    prizes: [15000],
    winner: { ...PEOPLE[1]!, gainPct: 176.8 },
  },
  {
    id: "c_may26",
    name: "Singapore Index Open",
    tagline: "",
    kind: "live",
    image: "/assets/photos/singapore.jpg",
    prizePool: 20000,
    entryFee: 0,
    startsAt: "2026-05-04T00:00:00Z",
    endsAt: "2026-05-29T20:00:00Z",
    participants: 1422,
    instruments: "Indices",
    prizes: [7000],
    winner: { ...PEOPLE[19]!, gainPct: 131.5 },
  },
];

/* ------------------------------------------------------------------ */
/* Loyalty                                                             */
/* ------------------------------------------------------------------ */

export const LOYALTY_TIERS = [
  { key: "bronze", name: "Bronze", min: 0, perks: ["1× points", "Monthly market webinar"] },
  { key: "silver", name: "Silver", min: 5000, perks: ["1.1× points", "Priority email support"] },
  { key: "gold", name: "Gold", min: 15000, perks: ["1.25× points", "−10% on Pro spreads", "Free VPS"] },
  { key: "platinum", name: "Platinum", min: 30000, perks: ["1.5× points", "Dedicated manager", "Swap discounts"] },
  { key: "diamond", name: "Diamond", min: 60000, perks: ["2× points", "Private events", "Custom leverage"] },
] as const;

export const LOYALTY = {
  balance: 18420,
  pointValue: 0.01, // $ per point
  lifetime: 26880,
  tier: "gold" as (typeof LOYALTY_TIERS)[number]["key"],
  tierProgress: 26880, // qualifying points (rolling 12m)
  earnedThisMonth: 2146,
  expiringSoon: { points: 640, date: "2026-10-31" },
  lotsThisMonth: 58.4,
};

export const EARN_RULES = [
  { assetClass: "forex", label: "Forex", pointsPerLot: 10, example: "EURUSD, GBPJPY, USDJPY", icon: "globe_with_meridians" },
  { assetClass: "metals", label: "Metals", pointsPerLot: 14, example: "XAUUSD, XAGUSD", icon: "coin" },
  { assetClass: "indices", label: "Indices", pointsPerLot: 6, example: "NAS100, US30, GER40", icon: "bar_chart" },
  { assetClass: "energies", label: "Energies", pointsPerLot: 8, example: "USOIL, UKOIL, NGAS", icon: "fire" },
  { assetClass: "crypto", label: "Crypto", pointsPerLot: 12, example: "BTCUSD, ETHUSD, SOLUSD", icon: "gem_stone" },
  { assetClass: "stocks", label: "Stocks", pointsPerLot: 4, example: "TSLA, NVDA, AAPL", icon: "chart_increasing" },
] as const;

export const REDEEM_CATALOGUE = [
  { id: "r_cash50", title: "$50 cashback", text: "Credited to your USDT wallet instantly", cost: 5000, icon: "money_with_wings", tag: "Popular" },
  { id: "r_cash100", title: "$100 cashback", text: "Credited to your USDT wallet instantly", cost: 9500, icon: "money_bag", tag: "Best value" },
  { id: "r_spread", title: "VIP spreads · 30 days", text: "Pro account spreads −20% on all FX majors", cost: 8000, icon: "gem_stone" },
  { id: "r_prop", title: "Free prop challenge", text: "$25k Ezymex Funded evaluation, 1 attempt", cost: 16000, icon: "rocket", tag: "Gold+" },
  { id: "r_swap", title: "Swap-free week", text: "No overnight swaps on one live account", cost: 3500, icon: "hourglass_not_done" },
  { id: "r_contest", title: "Contest entry ticket", text: "Paid entry to any live contest", cost: 2500, icon: "trophy" },
  { id: "r_academy", title: "Academy Pro · 3 months", text: "All advanced courses and live mentoring", cost: 6000, icon: "graduation_cap" },
  { id: "r_vps", title: "Trading VPS · 1 month", text: "London LD4 low-latency VPS, 2 vCPU", cost: 4200, icon: "laptop" },
] as const;

export interface PointsTx {
  id: string;
  date: string;
  type: "earned" | "redeemed" | "bonus" | "expired";
  description: string;
  account?: string;
  points: number;
}

export const POINTS_HISTORY: PointsTx[] = (() => {
  const r = seeded(3301);
  const out: PointsTx[] = [];
  let t = Date.parse("2026-09-24T10:00:00Z");
  const syms = [
    ["XAUUSD", 14],
    ["EURUSD", 10],
    ["NAS100", 6],
    ["BTCUSD", 12],
    ["GBPJPY", 10],
    ["USOIL", 8],
    ["TSLA", 4],
  ] as const;
  for (let i = 0; i < 36; i++) {
    const roll = r.next();
    if (i === 5) out.push({ id: `p${i}`, date: new Date(t).toISOString(), type: "redeemed", description: "Redeemed · $50 cashback", points: -5000 });
    else if (i === 12) out.push({ id: `p${i}`, date: new Date(t).toISOString(), type: "bonus", description: "Tier upgrade bonus · Gold", points: 1500 });
    else if (i === 19) out.push({ id: `p${i}`, date: new Date(t).toISOString(), type: "redeemed", description: "Redeemed · Contest entry ticket", points: -2500 });
    else if (i === 27) out.push({ id: `p${i}`, date: new Date(t).toISOString(), type: "expired", description: "Points expired (12-month rule)", points: -220 });
    else if (roll < 0.08) out.push({ id: `p${i}`, date: new Date(t).toISOString(), type: "bonus", description: "Referral bonus · friend funded", points: 500 });
    else {
      const [sym, ppl] = r.pick(syms);
      const lots = +r.pick([0.5, 1, 1.5, 2, 3, 4.2, 5]).toFixed(2);
      out.push({
        id: `p${i}`,
        date: new Date(t).toISOString(),
        type: "earned",
        description: `${lots} lots · ${sym}`,
        account: r.pick(["80412337", "80412337", "80412512"]),
        points: Math.round(lots * ppl * 1.25),
      });
    }
    t -= r.int(6, 40) * 3600 * 1000;
  }
  return out;
})();

/* ------------------------------------------------------------------ */
/* Cashback                                                            */
/* ------------------------------------------------------------------ */

export const CASHBACK_RATES = [
  { type: "Standard", perLot: 2.0, note: "All symbols", accounts: 1, lots: 21.6 },
  { type: "Pro", perLot: 3.5, note: "Forex & metals", accounts: 1, lots: 31.4 },
  { type: "ECN", perLot: 1.5, note: "On top of raw spread", accounts: 0, lots: 0 },
  { type: "Cent", perLot: 0.5, note: "Per standard-lot equivalent", accounts: 1, lots: 5.4 },
] as const;

export const CASHBACK = {
  available: 186.42,
  thisMonth: 155.0,
  lastMonth: 128.3,
  lifetime: 2412.86,
  pending: 38.2,
  nextPayout: "2026-10-01",
};

export const CASHBACK_WEEKLY = [
  { label: "W31", value: 22.4 },
  { label: "W32", value: 31.8 },
  { label: "W33", value: 18.2 },
  { label: "W34", value: 36.5 },
  { label: "W35", value: 28.9 },
  { label: "W36", value: 41.2 },
  { label: "W37", value: 33.6 },
  { label: "W38", value: 47.9 },
  { label: "W39", value: 32.3 },
];

export const CASHBACK_BY_ACCOUNT = [
  { login: "80412337", type: "Pro", group: "Pro · Hedging", lots: 31.4, rate: 3.5, earned: 109.9 },
  { login: "80412512", type: "Standard", group: "Standard · Netting", lots: 21.6, rate: 2.0, earned: 43.2 },
  { login: "80413001", type: "Cent", group: "Cent · Hedging", lots: 3.8, rate: 0.5, earned: 1.9 },
];

export interface CashbackTx {
  id: string;
  date: string;
  login: string;
  symbol: string;
  lots: number;
  rate: number;
  amount: number;
  status: "completed" | "pending" | "processing";
}

export const CASHBACK_HISTORY: CashbackTx[] = (() => {
  const r = seeded(5150);
  const syms = ["XAUUSD", "EURUSD", "GBPUSD", "NAS100", "BTCUSD", "USDJPY", "US30", "USOIL", "GBPJPY"];
  const out: CashbackTx[] = [];
  let t = Date.parse("2026-09-24T14:00:00Z");
  for (let i = 0; i < 42; i++) {
    const acc = r.pick(CASHBACK_BY_ACCOUNT);
    const lots = +r.pick([0.1, 0.2, 0.5, 1, 1.5, 2, 3]).toFixed(2);
    out.push({
      id: `CB${(771240 - i * 7).toString()}`,
      date: new Date(t).toISOString(),
      login: acc.login,
      symbol: r.pick(syms),
      lots,
      rate: acc.rate,
      amount: +(lots * acc.rate).toFixed(2),
      status: i < 3 ? "pending" : i < 5 ? "processing" : "completed",
    });
    t -= r.int(3, 26) * 3600 * 1000;
  }
  return out;
})();
