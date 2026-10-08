/**
 * Mock data for the Prop Challenges module: challenge models & pricing,
 * the client's own challenges (live rule state, trades, equity path),
 * funded account payouts, scaling plan and certificates.
 */
import { seeded } from "./rng";
import { PEOPLE } from "./people";
import { getInstrument } from "./symbols";

/* ------------------------------------------------------------------ */
/* Store: models & sizes                                               */
/* ------------------------------------------------------------------ */

export type PropModelId = "1-step" | "2-step" | "instant";
export const PROP_SIZES = [5000, 10000, 25000, 50000, 100000, 200000] as const;
export type PropSize = (typeof PROP_SIZES)[number];

export interface PropModel {
  id: PropModelId;
  name: string;
  tagline: string;
  phases: { name: string; target: number | null }[]; // % profit target per phase
  dailyLoss: number; // %
  dailyLossBasis: "Balance" | "Equity" | "Higher of balance / equity";
  maxDD: number; // %
  ddType: "Static" | "Trailing";
  minDays: number;
  timeLimit: string;
  leverage: string;
  split: string;
  splitMax: string;
  refundable: boolean;
  consistency: string;
  news: string;
  weekend: string;
  ea: string;
  firstPayout: string;
  payoutCycle: string;
  fees: Record<PropSize, number>;
  popular?: boolean;
}

export const PROP_MODELS: PropModel[] = [
  {
    id: "1-step",
    name: "1-Step Challenge",
    tagline: "One phase, one target. The fastest path to a funded account.",
    phases: [{ name: "Evaluation", target: 10 }],
    dailyLoss: 3,
    dailyLossBasis: "Higher of balance / equity",
    maxDD: 6,
    ddType: "Trailing",
    minDays: 3,
    timeLimit: "Unlimited",
    leverage: "1:30",
    split: "80%",
    splitMax: "90%",
    refundable: true,
    consistency: "No day > 40% of profit",
    news: "No trades ±5 min of red-folder news",
    weekend: "Close before Fri 23:45",
    ea: "Allowed (no HFT)",
    firstPayout: "14 days",
    payoutCycle: "Bi-weekly",
    fees: { 5000: 59, 10000: 99, 25000: 199, 50000: 319, 100000: 549, 200000: 1049 },
  },
  {
    id: "2-step",
    name: "2-Step Challenge",
    tagline: "The classic evaluation — relaxed limits, lowest fee per $1 of capital.",
    phases: [
      { name: "Phase 1", target: 8 },
      { name: "Phase 2", target: 5 },
    ],
    dailyLoss: 5,
    dailyLossBasis: "Balance",
    maxDD: 10,
    ddType: "Static",
    minDays: 4,
    timeLimit: "Unlimited",
    leverage: "1:100",
    split: "80%",
    splitMax: "90%",
    refundable: true,
    consistency: "Funded stage only (45%)",
    news: "Allowed in challenge · ±2 min when funded",
    weekend: "Allowed (swap applies)",
    ea: "Allowed (no HFT)",
    firstPayout: "14 days",
    payoutCycle: "Bi-weekly",
    fees: { 5000: 49, 10000: 89, 25000: 179, 50000: 289, 100000: 499, 200000: 949 },
    popular: true,
  },
  {
    id: "instant",
    name: "Instant Funding",
    tagline: "Skip the evaluation. Trade simulated capital from day one.",
    phases: [{ name: "Funded", target: null }],
    dailyLoss: 3,
    dailyLossBasis: "Equity",
    maxDD: 6,
    ddType: "Trailing",
    minDays: 5,
    timeLimit: "Unlimited",
    leverage: "1:30",
    split: "70%",
    splitMax: "90%",
    refundable: false,
    consistency: "No day > 20% of profit",
    news: "No trades ±5 min of red-folder news",
    weekend: "Close before Fri 23:45",
    ea: "Allowed (no HFT)",
    firstPayout: "5 trading days",
    payoutCycle: "Weekly",
    fees: { 5000: 119, 10000: 199, 25000: 379, 50000: 649, 100000: 1099, 200000: 2099 },
  },
];

export const BANNED_STRATEGIES = [
  { name: "Latency arbitrage", text: "Exploiting delayed price feeds between venues." },
  { name: "Tick scalping", text: "Positions held < 60 seconds to farm tick-level inefficiencies." },
  { name: "Cross-account hedging", text: "Opposite positions across Ezymex or third-party accounts." },
  { name: "High-frequency trading", text: "> 200 orders per day or sub-second order bursts." },
];

export const PROP_STATS = {
  paidOut: 18_420_600,
  fundedTraders: 4_812,
  avgPayoutHours: 7.4,
  largestPayout: 61_240.8,
};

/** Recent payouts ticker for social proof on the store page. */
export const RECENT_PAYOUTS = [3, 5, 9, 1, 12, 7, 14, 2].map((pi, i) => {
  const r = seeded(700 + i);
  const p = PEOPLE[pi % PEOPLE.length]!;
  return {
    name: p.name.split(" ")[0] + " " + (p.name.split(" ")[1]?.[0] ?? "") + ".",
    photo: p.photo,
    country: p.country,
    amount: +r.range(620, 14800).toFixed(2),
    size: r.pick([25000, 50000, 100000, 200000] as const),
    hoursAgo: i * 2 + r.int(0, 2) + 1,
  };
});

export const PROP_FAQ = [
  {
    q: "Is this real money? What does \"funded\" mean?",
    a: "Funded accounts are simulated. You trade simulated capital on Ezymex-Prop servers with live market pricing, and you're paid a share of the simulated profit. Your payouts are real and land in your Ezymex wallet in USDT.",
  },
  {
    q: "How are the rules enforced?",
    a: "Every rule runs live on the server. The daily loss limit and max drawdown are checked on every tick. If one is breached, the account fails automatically and all positions are closed at market. You'll get an email and a push notification with a breach report.",
  },
  {
    q: "When does the daily loss limit reset?",
    a: "At 00:00 server time (GMT+3). The day-start figure is the higher of your balance or equity at the reset (the 2-Step uses balance only).",
  },
  {
    q: "What's the difference between static and trailing drawdown?",
    a: "Static drawdown is a fixed floor at initial balance minus the limit (e.g. $45,000 on a $50k 2-Step). Trailing drawdown moves up with your highest closed balance until it reaches the initial balance, then locks there.",
  },
  {
    q: "When do I get my fee back?",
    a: "Your 1-Step or 2-Step challenge fee is refunded in full with your first payout from the funded account. Instant Funding fees are non-refundable.",
  },
  {
    q: "How do payouts work?",
    a: "Request a payout from the Payouts page once you're eligible. The request goes to our risk desk for approval, usually within 8 hours, and is then credited to your Ezymex wallet. From there you can withdraw to TRC20 or fund a live account.",
  },
  {
    q: "Can I use Expert Advisors?",
    a: "Yes, EAs and copy trading into your own challenge are allowed. Latency arbitrage, tick scalping, cross-account hedging and HFT are banned and result in a failed account.",
  },
];

/* ------------------------------------------------------------------ */
/* My challenges                                                       */
/* ------------------------------------------------------------------ */

export type RuleState = "ongoing" | "passed" | "failed";

export interface MyChallenge {
  id: string;
  model: PropModelId;
  size: PropSize;
  stage: "Phase 1" | "Phase 2" | "Funded";
  stageIndex: number; // 0 Phase 1, 1 Phase 2, 2 Funded
  status: "active" | "passed" | "funded";
  login: string;
  server: string;
  investorPassword: string;
  masterPassword: string;
  startDate: string;
  endDate?: string;
  balance: number;
  equity: number;
  dayStart: number;
  profit: number;
  target: number;
  dailyLimit: number;
  dailyUsed: number;
  maxLoss: number;
  maxLossUsed: number; // peak drawdown from initial
  minDays: number;
  daysTraded: number;
  trades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  lots: number;
  bestDayPct: number;
}

export const MY_CHALLENGES: MyChallenge[] = [
  {
    id: "CH-50-2S-4412",
    model: "2-step",
    size: 50000,
    stage: "Phase 1",
    stageIndex: 0,
    status: "active",
    login: "80520114",
    server: "Ezymex-Prop01",
    investorPassword: "demo-inv1",
    masterPassword: "demo-mast1",
    startDate: "2026-09-21",
    balance: 52860,
    equity: 52448.2,
    dayStart: 52860,
    profit: 2860,
    target: 4000,
    dailyLimit: 2500,
    dailyUsed: 411.8,
    maxLoss: 5000,
    maxLossUsed: 1080.4,
    minDays: 4,
    daysTraded: 3,
    trades: 18,
    winRate: 61.1,
    avgWin: 412.6,
    avgLoss: -236.9,
    profitFactor: 2.74,
    lots: 14.6,
    bestDayPct: 38.2,
  },
  {
    id: "CH-25-2S-3908",
    model: "2-step",
    size: 25000,
    stage: "Phase 2",
    stageIndex: 1,
    status: "passed",
    login: "80519406",
    server: "Ezymex-Prop01",
    investorPassword: "demo-inv2",
    masterPassword: "demo-mast2",
    startDate: "2026-09-08",
    endDate: "2026-09-18",
    balance: 26412.8,
    equity: 26412.8,
    dayStart: 26412.8,
    profit: 1412.8,
    target: 1250,
    dailyLimit: 1250,
    dailyUsed: 0,
    maxLoss: 2500,
    maxLossUsed: 318.5,
    minDays: 4,
    daysTraded: 7,
    trades: 26,
    winRate: 65.4,
    avgWin: 188.2,
    avgLoss: -127.4,
    profitFactor: 2.61,
    lots: 9.8,
    bestDayPct: 29.4,
  },
  {
    id: "CH-100-1S-2177",
    model: "1-step",
    size: 100000,
    stage: "Funded",
    stageIndex: 2,
    status: "funded",
    login: "80519877",
    server: "Ezymex-Prop02",
    investorPassword: "demo-inv3",
    masterPassword: "demo-mast3",
    startDate: "2026-06-02",
    balance: 106240.5,
    equity: 106512.3,
    dayStart: 106240.5,
    profit: 6240.5,
    target: 0,
    dailyLimit: 3187.2,
    dailyUsed: 0,
    maxLoss: 6000,
    maxLossUsed: 1412.6,
    minDays: 3,
    daysTraded: 9,
    trades: 41,
    winRate: 58.5,
    avgWin: 544.1,
    avgLoss: -312.8,
    profitFactor: 2.12,
    lots: 38.4,
    bestDayPct: 24.8,
  },
];

export const ACTIVE_CHALLENGE = MY_CHALLENGES[0]!;

export interface PropTrade {
  ticket: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  openTime: string;
  closeTime: string;
  openPrice: number;
  closePrice: number;
  profit: number;
  duration: string;
}

/** Closed trades that sum exactly to the challenge's closed profit. */
export function propTrades(ch: MyChallenge): PropTrade[] {
  const r = seeded(ch.login.length * 97 + Number(ch.login.slice(-4)));
  const syms = ["XAUUSD", "EURUSD", "NAS100", "GBPUSD", "USDJPY", "XAUUSD", "US30", "GBPJPY"];
  const start = Date.parse(ch.startDate + "T06:00:00Z");
  const n = ch.trades;
  const span = Math.max(1, ch.daysTraded) * 86400000;
  const raw: PropTrade[] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const sym = r.pick(syms);
    const inst = getInstrument(sym);
    const side = r.bool(0.55) ? "buy" : "sell";
    const win = r.bool(ch.winRate / 100);
    const p = win ? r.range(0.4, 1.6) * ch.avgWin : r.range(0.5, 1.4) * ch.avgLoss;
    const volume = +(sym.startsWith("XAU") ? r.range(0.3, 1.5) : sym.includes("100") || sym.includes("30") ? r.range(1, 6) : r.range(0.5, 3)).toFixed(2);
    const open = inst.price * (1 + r.normal() * 0.003);
    const move = p / (volume * inst.contractSize) * (sym.endsWith("JPY") ? open : 1);
    const close = side === "buy" ? open + move : open - move;
    const t0 = start + (i / n) * span + r.int(0, 3600) * 1000;
    const mins = r.int(6, 380);
    raw.push({
      ticket: String(51820400 + i * 7 + r.int(0, 6)),
      symbol: sym,
      side,
      volume,
      openTime: new Date(t0).toISOString(),
      closeTime: new Date(t0 + mins * 60000).toISOString(),
      openPrice: +open.toFixed(inst.digits),
      closePrice: +close.toFixed(inst.digits),
      profit: +p.toFixed(2),
      duration: mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`,
    });
    sum += +p.toFixed(2);
  }
  // Nudge the largest trade so the total matches exactly.
  const diff = +(ch.profit - sum).toFixed(2);
  const idx = raw.reduce((b, t, i) => (Math.abs(t.profit) > Math.abs(raw[b]!.profit) ? i : b), 0);
  raw[idx]!.profit = +(raw[idx]!.profit + diff).toFixed(2);
  return raw.reverse();
}

/** Hourly equity path from the challenge start to now (ends at current equity). */
export function propEquityPath(ch: MyChallenge, points = 84): { time: number; value: number }[] {
  const r = seeded(Number(ch.login.slice(-5)));
  const start = Date.parse(ch.startDate + "T00:00:00Z") / 1000;
  const end = Date.parse("2026-09-24T15:00:00Z") / 1000;
  const floor = ch.size - ch.maxLossUsed;
  const out: { time: number; value: number }[] = [];
  let v = ch.size;
  const lowAt = Math.floor(points * 0.22);
  for (let i = 0; i < points; i++) {
    const tgt = i < lowAt ? ch.size - (ch.maxLossUsed * i) / lowAt : floor + ((ch.equity - floor) * (i - lowAt)) / (points - 1 - lowAt);
    v = tgt + r.normal() * ch.size * 0.0016;
    out.push({ time: Math.round(start + ((end - start) * i) / (points - 1)), value: +v.toFixed(2) });
  }
  out[0]!.value = ch.size;
  out[lowAt]!.value = +floor.toFixed(2);
  out[points - 1]!.value = ch.equity;
  return out;
}

export const OPEN_PROP_POSITION = {
  ticket: "51820561",
  symbol: "XAUUSD",
  side: "buy" as const,
  volume: 1.2,
  openPrice: 2657.73,
  sl: 2644.08,
  floating: -411.8,
  lossIfSl: 1638.2,
};

/* ------------------------------------------------------------------ */
/* Funded account, payouts, scaling, certificates                      */
/* ------------------------------------------------------------------ */

export const FUNDED = {
  ...MY_CHALLENGES[2]!,
  splitPct: 80,
  cycleStart: "2026-09-10",
  eligibleFrom: "2026-09-24",
  nextCycle: "2026-10-08",
  feePaid: 549,
  feeRefunded: true,
  totalPaid: 14_901.8,
  payoutsCount: 3,
};

export const FUNDED_SHARE = +(FUNDED.profit * (FUNDED.splitPct / 100)).toFixed(2);

export const SCALING = {
  from: 100000,
  to: 125000,
  monthsRequired: 4,
  monthsDone: 3.7,
  profitRequired: 10,
  profitDone: 8.4,
  payoutsRequired: 2,
  payoutsDone: 3,
  reviewDate: "2026-10-02",
  milestones: [
    { size: 100000, label: "Start", date: "Jun 2026", done: true },
    { size: 125000, label: "+25%", date: "Oct 2026", done: false, next: true },
    { size: 156000, label: "+25%", date: "Feb 2027", done: false },
    { size: 195000, label: "+25%", date: "Jun 2027", done: false },
    { size: 2000000, label: "Cap", date: "", done: false },
  ],
};

export interface PropPayout {
  id: string;
  account: string;
  size: number;
  requestedAt: string;
  paidAt?: string;
  gross: number;
  split: number;
  share: number;
  refund: number;
  status: "completed" | "pending" | "processing" | "rejected";
  tx: string;
}

export const PROP_PAYOUTS: PropPayout[] = [
  { id: "PO-24108", account: "80519877", size: 100000, requestedAt: "2026-08-27T10:14:00Z", paidAt: "2026-08-27T16:02:00Z", gross: 5150.75, split: 80, share: 4120.6, refund: 0, status: "completed", tx: "WTX-883104" },
  { id: "PO-23761", account: "80519877", size: 100000, requestedAt: "2026-07-30T09:41:00Z", paidAt: "2026-07-30T13:25:00Z", gross: 4410.9, split: 80, share: 3528.72, refund: 0, status: "completed", tx: "WTX-861492" },
  { id: "PO-23390", account: "80519877", size: 100000, requestedAt: "2026-07-02T12:08:00Z", paidAt: "2026-07-02T19:47:00Z", gross: 8379.35, split: 80, share: 6703.48, refund: 549, status: "completed", tx: "WTX-842237" },
  { id: "PO-21944", account: "80517702", size: 50000, requestedAt: "2026-03-18T08:30:00Z", paidAt: "2026-03-18T14:11:00Z", gross: 2140.2, split: 80, share: 1712.16, refund: 0, status: "completed", tx: "WTX-760018" },
  { id: "PO-21602", account: "80517702", size: 50000, requestedAt: "2026-02-19T11:02:00Z", gross: 980.0, split: 80, share: 784.0, refund: 0, status: "rejected", tx: "—" },
  { id: "PO-21317", account: "80517702", size: 50000, requestedAt: "2026-01-28T15:44:00Z", paidAt: "2026-01-29T09:03:00Z", gross: 3605.5, split: 80, share: 2884.4, refund: 289, status: "completed", tx: "WTX-731775" },
];

export interface PropCertificate {
  id: string;
  kind: "funded" | "payout" | "passed";
  title: string;
  amount: number;
  date: string;
  account: string;
}

export const PROP_CERTIFICATES: PropCertificate[] = [
  { id: "KC-2026-0827-4120", kind: "payout", title: "Payout certificate", amount: 4120.6, date: "2026-08-27", account: "80519877" },
  { id: "KC-2026-0602-1000", kind: "funded", title: "Funded trader", amount: 100000, date: "2026-06-02", account: "80519877" },
  { id: "KC-2026-0918-0250", kind: "passed", title: "Challenge passed", amount: 25000, date: "2026-09-18", account: "80519406" },
  { id: "KC-2026-0702-6703", kind: "payout", title: "Payout certificate", amount: 6703.48, date: "2026-07-02", account: "80519877" },
];
