import { seeded, hashString } from "./rng";
import { PEOPLE, type Person } from "./people";
import { getInstrument } from "./symbols";

/* ------------------------------------------------------------------ */
/* Masters                                                             */
/* ------------------------------------------------------------------ */

export type MasterProgram = "copy" | "pamm" | "both";
export type Rollover = "daily" | "weekly" | "monthly";

export interface Master {
  id: string;
  person: Person;
  strategy: string;
  description: string;
  tags: string[];
  program: MasterProgram;
  verified: boolean;
  featured: boolean;
  /** Returns in %. */
  returnAll: number;
  return1y: number;
  return3m: number;
  return1m: number;
  maxDD: number;
  currentDD: number;
  risk: number; // 1–10 system risk score
  followers: number;
  aum: number;
  ageDays: number;
  winRate: number;
  profitFactor: number;
  avgHold: string;
  tradesPerWeek: number;
  sharpe: number;
  perfFee: number;
  hwm: boolean;
  rollover: Rollover;
  minInvestment: number;
  lockInDays: number;
  ownCapitalPct: number;
  leverage: number;
  api: boolean;
  instruments: { label: string; value: number }[];
  account: string;
}

const P = (i: number) => PEOPLE[i]!;

export const MASTERS: Master[] = [
  {
    id: "lucas-ferreira", person: P(2), strategy: "Carioca Gold Swing",
    description: "Discretionary gold swing trading around London and New York sessions. Two to five positions a week, hard stop on every trade, never more than 2% risk per idea. Macro-driven: real yields, USD and Fed pricing.",
    tags: ["Gold", "Swing", "Low frequency"], program: "both", verified: true, featured: true,
    returnAll: 184.6, return1y: 62.4, return3m: 14.8, return1m: 4.2, maxDD: 11.8, currentDD: 2.1, risk: 4, followers: 2841, aum: 3_420_500, ageDays: 1094,
    winRate: 61.4, profitFactor: 2.18, avgHold: "1d 6h", tradesPerWeek: 4.2, sharpe: 1.84, perfFee: 25, hwm: true, rollover: "weekly", minInvestment: 500, lockInDays: 30, ownCapitalPct: 14, leverage: 200, api: false,
    instruments: [{ label: "XAUUSD", value: 68 }, { label: "XAGUSD", value: 14 }, { label: "EURUSD", value: 10 }, { label: "US30", value: 8 }], account: "81042210",
  },
  {
    id: "nguyen-thu-ha", person: P(3), strategy: "Saigon FX Momentum",
    description: "Systematic intraday momentum on majors, running on a VPS via the Ezymex API. Trades the Asian-to-London handover with volatility-scaled sizing and a daily loss cap of 1.5%.",
    tags: ["Forex", "Algo", "Intraday"], program: "copy", verified: true, featured: true,
    returnAll: 96.2, return1y: 41.8, return3m: 9.6, return1m: 2.8, maxDD: 8.4, currentDD: 0.9, risk: 3, followers: 1932, aum: 1_284_000, ageDays: 812,
    winRate: 57.2, profitFactor: 1.74, avgHold: "3h 20m", tradesPerWeek: 38, sharpe: 2.11, perfFee: 20, hwm: true, rollover: "weekly", minInvestment: 100, lockInDays: 0, ownCapitalPct: 11, leverage: 100, api: true,
    instruments: [{ label: "EURUSD", value: 34 }, { label: "GBPUSD", value: 26 }, { label: "USDJPY", value: 22 }, { label: "AUDUSD", value: 18 }], account: "81044982",
  },
  {
    id: "sofia-rossi", person: P(6), strategy: "Milano Index Carry",
    description: "Medium-term long bias on US and European indices, hedged with options-style stop ladders. Adds on pullbacks, cuts risk ahead of CPI and FOMC. Conservative leverage.",
    tags: ["Indices", "Position", "Conservative"], program: "pamm", verified: true, featured: true,
    returnAll: 72.4, return1y: 28.9, return3m: 6.1, return1m: 1.9, maxDD: 6.2, currentDD: 1.4, risk: 2, followers: 1204, aum: 5_812_300, ageDays: 1402,
    winRate: 66.8, profitFactor: 2.46, avgHold: "4d 2h", tradesPerWeek: 2.1, sharpe: 2.34, perfFee: 20, hwm: true, rollover: "monthly", minInvestment: 1000, lockInDays: 90, ownCapitalPct: 18, leverage: 50, api: false,
    instruments: [{ label: "NAS100", value: 38 }, { label: "SPX500", value: 30 }, { label: "GER40", value: 22 }, { label: "US30", value: 10 }], account: "81031177",
  },
  {
    id: "james-carter", person: P(9), strategy: "Thames Breakout",
    description: "Breakout trading on GBP crosses and gold at the London open. Aggressive position sizing on high-conviction setups; expect larger swings in exchange for higher returns.",
    tags: ["Forex", "Breakout", "Aggressive"], program: "copy", verified: true, featured: true,
    returnAll: 241.8, return1y: 88.2, return3m: 21.4, return1m: -3.6, maxDD: 24.6, currentDD: 7.8, risk: 7, followers: 3610, aum: 2_104_800, ageDays: 688,
    winRate: 48.9, profitFactor: 1.62, avgHold: "9h 40m", tradesPerWeek: 14, sharpe: 1.21, perfFee: 30, hwm: true, rollover: "weekly", minInvestment: 200, lockInDays: 0, ownCapitalPct: 10, leverage: 500, api: false,
    instruments: [{ label: "GBPJPY", value: 36 }, { label: "GBPUSD", value: 28 }, { label: "XAUUSD", value: 24 }, { label: "EURJPY", value: 12 }], account: "81047705",
  },
  {
    id: "elena-petrova", person: P(12), strategy: "Limassol Multi-Asset",
    description: "Diversified portfolio across FX, metals, energies and indices, rebalanced weekly using a risk-parity model. Designed for steady compounding with low correlation to equities.",
    tags: ["Multi-asset", "Risk parity", "Low risk"], program: "both", verified: true, featured: true,
    returnAll: 58.1, return1y: 22.6, return3m: 5.4, return1m: 1.6, maxDD: 5.1, currentDD: 0.4, risk: 2, followers: 986, aum: 4_260_900, ageDays: 1188,
    winRate: 63.1, profitFactor: 2.02, avgHold: "2d 14h", tradesPerWeek: 9, sharpe: 2.52, perfFee: 18, hwm: true, rollover: "monthly", minInvestment: 1000, lockInDays: 60, ownCapitalPct: 22, leverage: 100, api: true,
    instruments: [{ label: "XAUUSD", value: 24 }, { label: "EURUSD", value: 22 }, { label: "SPX500", value: 20 }, { label: "USOIL", value: 18 }, { label: "USDJPY", value: 16 }], account: "81033016",
  },
  {
    id: "yuki-tanaka", person: P(14), strategy: "Tokyo Yen Scalper",
    description: "High-frequency yen scalping during the Tokyo session with tight 8–15 pip stops. Uses the Ezymex API with sub-50ms execution; best copied on Pro or ECN accounts.",
    tags: ["Forex", "Scalping", "Algo"], program: "copy", verified: true, featured: false,
    returnAll: 128.4, return1y: 51.2, return3m: 11.9, return1m: 3.4, maxDD: 13.9, currentDD: 3.2, risk: 5, followers: 1488, aum: 842_600, ageDays: 544,
    winRate: 71.6, profitFactor: 1.58, avgHold: "18m", tradesPerWeek: 142, sharpe: 1.66, perfFee: 25, hwm: true, rollover: "weekly", minInvestment: 300, lockInDays: 0, ownCapitalPct: 12, leverage: 500, api: true,
    instruments: [{ label: "USDJPY", value: 48 }, { label: "EURJPY", value: 30 }, { label: "GBPJPY", value: 22 }], account: "81049931",
  },
  {
    id: "hassan-karimi", person: P(15), strategy: "Bosphorus Crypto Trend",
    description: "Trend-following on BTC, ETH and SOL with ATR trailing stops. Sits in cash during chop, pyramids into strong trends. Weekend exposure is capped at 50% of normal size.",
    tags: ["Crypto", "Trend", "Volatile"], program: "both", verified: true, featured: true,
    returnAll: 312.6, return1y: 104.4, return3m: 28.2, return1m: 8.9, maxDD: 31.2, currentDD: 4.6, risk: 8, followers: 4102, aum: 1_902_400, ageDays: 736,
    winRate: 44.2, profitFactor: 1.88, avgHold: "3d 8h", tradesPerWeek: 6, sharpe: 1.12, perfFee: 30, hwm: true, rollover: "weekly", minInvestment: 250, lockInDays: 14, ownCapitalPct: 15, leverage: 20, api: false,
    instruments: [{ label: "BTCUSD", value: 52 }, { label: "ETHUSD", value: 28 }, { label: "SOLUSD", value: 20 }], account: "81045520",
  },
  {
    id: "thomas-muller", person: P(19), strategy: "Frankfurt DAX Mean-Reversion",
    description: "Mean-reversion on GER40 and EURUSD using session VWAP bands. Strict daily stop, flat by the close. A quiet, consistent return stream.",
    tags: ["Indices", "Mean reversion", "Intraday"], program: "pamm", verified: true, featured: false,
    returnAll: 64.9, return1y: 24.1, return3m: 5.8, return1m: 1.2, maxDD: 7.4, currentDD: 1.1, risk: 3, followers: 642, aum: 2_980_000, ageDays: 1260,
    winRate: 64.4, profitFactor: 1.92, avgHold: "2h 10m", tradesPerWeek: 22, sharpe: 2.06, perfFee: 20, hwm: true, rollover: "weekly", minInvestment: 500, lockInDays: 30, ownCapitalPct: 16, leverage: 100, api: false,
    instruments: [{ label: "GER40", value: 58 }, { label: "EURUSD", value: 26 }, { label: "UK100", value: 16 }], account: "81030488",
  },
  {
    id: "aisha-rahman", person: P(10), strategy: "KL Swap-Free Growth",
    description: "Swap-free, Shariah-conscious portfolio of gold, major FX and US stocks. No overnight interest, no hedging tricks, long holding periods and transparent risk.",
    tags: ["Swap-free", "Stocks", "Gold"], program: "both", verified: true, featured: false,
    returnAll: 44.2, return1y: 19.6, return3m: 4.2, return1m: 0.8, maxDD: 6.8, currentDD: 1.9, risk: 3, followers: 1716, aum: 1_540_200, ageDays: 902,
    winRate: 59.8, profitFactor: 1.84, avgHold: "5d 4h", tradesPerWeek: 3, sharpe: 1.78, perfFee: 15, hwm: true, rollover: "monthly", minInvestment: 200, lockInDays: 30, ownCapitalPct: 13, leverage: 100, api: false,
    instruments: [{ label: "XAUUSD", value: 34 }, { label: "AAPL", value: 22 }, { label: "NVDA", value: 20 }, { label: "EURUSD", value: 24 }], account: "81041173",
  },
  {
    id: "carlos-mendoza", person: P(11), strategy: "Azteca Oil & Metals",
    description: "Commodity specialist trading WTI, Brent and silver around inventory reports and OPEC headlines. Moderate risk with a strict three-loss daily circuit breaker.",
    tags: ["Energies", "Metals", "News"], program: "copy", verified: true, featured: false,
    returnAll: 88.7, return1y: 33.4, return3m: 7.9, return1m: -1.4, maxDD: 15.6, currentDD: 3.9, risk: 5, followers: 804, aum: 612_300, ageDays: 620,
    winRate: 53.1, profitFactor: 1.69, avgHold: "11h", tradesPerWeek: 11, sharpe: 1.38, perfFee: 25, hwm: true, rollover: "weekly", minInvestment: 200, lockInDays: 0, ownCapitalPct: 10, leverage: 200, api: false,
    instruments: [{ label: "USOIL", value: 42 }, { label: "UKOIL", value: 28 }, { label: "XAGUSD", value: 30 }], account: "81046611",
  },
  {
    id: "kwame-mensah", person: P(17), strategy: "Accra Stocks Momentum",
    description: "US mega-cap momentum using earnings drift and relative strength. Holds 3–6 names at a time, rotates monthly, and hedges with NAS100 shorts in risk-off weeks.",
    tags: ["Stocks", "Momentum", "Swing"], program: "copy", verified: false, featured: false,
    returnAll: 52.3, return1y: 36.8, return3m: 12.4, return1m: 3.1, maxDD: 12.2, currentDD: 2.6, risk: 5, followers: 318, aum: 208_400, ageDays: 214,
    winRate: 55.4, profitFactor: 1.71, avgHold: "6d", tradesPerWeek: 2.4, sharpe: 1.52, perfFee: 20, hwm: true, rollover: "weekly", minInvestment: 100, lockInDays: 0, ownCapitalPct: 10, leverage: 20, api: false,
    instruments: [{ label: "NVDA", value: 30 }, { label: "AAPL", value: 22 }, { label: "META", value: 20 }, { label: "TSLA", value: 14 }, { label: "NAS100", value: 14 }], account: "81048802",
  },
  {
    id: "vikram-iyer", person: P(21), strategy: "Mumbai Range Grid",
    description: "Range grid on EURUSD and AUDUSD with a hard basket stop — no martingale, no averaging beyond three levels. Works best in low-volatility regimes; paused around major news.",
    tags: ["Forex", "Grid", "Algo"], program: "both", verified: true, featured: false,
    returnAll: 38.6, return1y: 17.2, return3m: 3.1, return1m: 0.6, maxDD: 9.8, currentDD: 1.2, risk: 4, followers: 522, aum: 734_900, ageDays: 468,
    winRate: 78.4, profitFactor: 1.42, avgHold: "7h 30m", tradesPerWeek: 64, sharpe: 1.44, perfFee: 20, hwm: true, rollover: "daily", minInvestment: 100, lockInDays: 7, ownCapitalPct: 12, leverage: 200, api: true,
    instruments: [{ label: "EURUSD", value: 54 }, { label: "AUDUSD", value: 46 }], account: "81043390",
  },
  {
    id: "laila-farouk", person: P(20), strategy: "Nile Gold Scalper",
    description: "Very short-term gold scalping around US data releases. High trade count and high volatility of returns — only suitable for investors who accept deep drawdowns.",
    tags: ["Gold", "Scalping", "High risk"], program: "copy", verified: true, featured: false,
    returnAll: 402.1, return1y: 131.6, return3m: -8.4, return1m: -12.2, maxDD: 42.8, currentDD: 18.4, risk: 9, followers: 2230, aum: 488_100, ageDays: 402,
    winRate: 52.6, profitFactor: 1.31, avgHold: "6m", tradesPerWeek: 210, sharpe: 0.82, perfFee: 35, hwm: true, rollover: "weekly", minInvestment: 100, lockInDays: 0, ownCapitalPct: 10, leverage: 1000, api: true,
    instruments: [{ label: "XAUUSD", value: 92 }, { label: "XAGUSD", value: 8 }], account: "81050214",
  },
  {
    id: "isabella-cruz", person: P(22), strategy: "Manila Balanced Income",
    description: "Low-leverage income strategy: carry-positive FX pairs plus index dips, sized for single-digit drawdowns. Newer track record, steadily growing following.",
    tags: ["Forex", "Indices", "Income"], program: "pamm", verified: true, featured: false,
    returnAll: 21.4, return1y: 21.4, return3m: 4.6, return1m: 1.4, maxDD: 4.3, currentDD: 0.6, risk: 2, followers: 214, aum: 402_600, ageDays: 312,
    winRate: 67.9, profitFactor: 2.21, avgHold: "2d 2h", tradesPerWeek: 5, sharpe: 2.18, perfFee: 15, hwm: true, rollover: "monthly", minInvestment: 250, lockInDays: 30, ownCapitalPct: 20, leverage: 50, api: false,
    instruments: [{ label: "AUDUSD", value: 30 }, { label: "USDJPY", value: 26 }, { label: "SPX500", value: 24 }, { label: "NAS100", value: 20 }], account: "81051507",
  },
];

export function masterById(id: string): Master | undefined {
  return MASTERS.find((m) => m.id === id);
}

export function riskTone(risk: number): "up" | "warn" | "down" {
  return risk <= 3 ? "up" : risk <= 6 ? "warn" : "down";
}
export function riskLabel(risk: number) {
  return risk <= 3 ? "Low" : risk <= 6 ? "Medium" : "High";
}

/* ------------------------------------------------------------------ */
/* Master series                                                       */
/* ------------------------------------------------------------------ */

const NOW = Date.parse("2026-09-24T00:00:00Z");

/** Monthly returns (%) oldest → newest, compounding exactly to returnAll. */
export function masterMonthly(m: Master): { year: number; month: number; ret: number }[] {
  const months = Math.max(3, Math.round(m.ageDays / 30.4));
  const r = seeded(hashString(m.id + "mo"));
  const vol = 0.012 + m.risk * 0.0065;
  const logs = Array.from({ length: months }, () => r.normal() * vol);
  const target = Math.log(1 + m.returnAll / 100);
  const shift = (target - logs.reduce((s, x) => s + x, 0)) / months;
  const d = new Date(NOW);
  let y = d.getUTCFullYear();
  let mo = d.getUTCMonth(); // current month (Sep = 8)
  const out: { year: number; month: number; ret: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    out.unshift({ year: y, month: mo, ret: +((Math.exp(logs[i]! + shift) - 1) * 100).toFixed(2) });
    mo -= 1;
    if (mo < 0) {
      mo = 11;
      y -= 1;
    }
  }
  return out;
}

/** Daily growth curve (starting at 10,000) consistent with monthly returns. */
export function masterEquity(m: Master, days?: number): { time: number; value: number; volume: number }[] {
  const monthly = masterMonthly(m);
  const r = seeded(hashString(m.id + "eq"));
  const out: { time: number; value: number; volume: number }[] = [];
  let v = 10000;
  const totalDays = monthly.length * 30;
  const start = Math.floor(NOW / 1000) - (totalDays - 1) * 86400;
  let k = 0;
  for (const mm of monthly) {
    const target = v * (1 + mm.ret / 100);
    const steps = 30;
    const noise = Array.from({ length: steps }, () => r.normal() * (0.002 + m.risk * 0.0012));
    const base = Math.log(target / v) / steps;
    const nSum = noise.reduce((s, x) => s + x, 0) / steps;
    for (let s = 0; s < steps; s++) {
      v *= Math.exp(base + noise[s]! - nSum);
      out.push({ time: start + k * 86400, value: +v.toFixed(2), volume: Math.round(r.range(2, 30) * (1 + m.tradesPerWeek / 40)) });
      k++;
    }
  }
  return days ? out.slice(-days) : out;
}

export function masterSpark(m: Master, points = 40): number[] {
  const eq = masterEquity(m, 180);
  const step = Math.max(1, Math.floor(eq.length / points));
  return eq.filter((_, i) => i % step === 0).map((p) => p.value);
}

/** Weekly followers & AUM for the last 26 weeks. */
export function masterGrowth(m: Master): { label: string; followers: number; aum: number }[] {
  const r = seeded(hashString(m.id + "gr"));
  const out: { label: string; followers: number; aum: number }[] = [];
  let f = m.followers;
  let a = m.aum;
  for (let i = 0; i < 26; i++) {
    const t = NOW - i * 7 * 86400000;
    out.unshift({ label: new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), followers: Math.round(f), aum: Math.round(a) });
    f = f / (1 + 0.012 + r.normal() * 0.01);
    a = a / (1 + 0.016 + r.normal() * 0.018);
  }
  return out;
}

export interface MasterTrade {
  ticket: string;
  symbol: string;
  side: "buy" | "sell";
  lots: number;
  openPrice: number;
  closePrice: number;
  openTime: string;
  closeTime: string;
  pips: number;
  profitPct: number;
}

/** Closed trades, delayed by 24 hours. */
export function masterTrades(m: Master, n = 30): MasterTrade[] {
  const r = seeded(hashString(m.id + "tr"));
  const syms = m.instruments.flatMap((i) => Array(Math.max(1, Math.round(i.value / 10))).fill(i.label) as string[]);
  let t = NOW - 26 * 3600000 + 9 * 3600000;
  const out: MasterTrade[] = [];
  for (let i = 0; i < n; i++) {
    const symbol = r.pick(syms);
    const inst = getInstrument(symbol);
    const side = r.bool(0.55) ? "buy" : "sell";
    const win = r.bool(m.winRate / 100);
    const pipSize = inst.digits >= 4 ? 0.0001 : inst.digits === 3 ? 0.01 : inst.assetClass === "metals" ? 0.1 : 1;
    const pips = +((win ? 1 : -0.8) * Math.abs(r.normal() * 30 + 18) * (m.risk / 4)).toFixed(1);
    const openPrice = inst.price * (1 + r.normal() * 0.01);
    const closePrice = side === "buy" ? openPrice + pips * pipSize : openPrice - pips * pipSize;
    const holdMin = r.int(4, 60 * 48);
    out.push({
      ticket: String(60200000 + (hashString(m.id + i) % 700000)),
      symbol,
      side,
      lots: r.pick([0.1, 0.2, 0.5, 1, 1.5, 2, 3]),
      openPrice: +openPrice.toFixed(inst.digits),
      closePrice: +closePrice.toFixed(inst.digits),
      openTime: new Date(t - holdMin * 60000).toISOString(),
      closeTime: new Date(t).toISOString(),
      pips,
      profitPct: +(pips * 0.012 * (m.risk / 3)).toFixed(2),
    });
    t -= r.int(1, 30) * 3600000 * (m.tradesPerWeek > 30 ? 0.2 : 1);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* PAMM funds                                                          */
/* ------------------------------------------------------------------ */

export interface PammFund {
  id: string;
  masterId: string;
  name: string;
  navPerUnit: number;
  navChange24h: number;
  aum: number;
  investors: number;
  returnAll: number;
  return1y: number;
  maxDD: number;
  ddFreeze: number; // fund max-drawdown freeze %
  rollover: Rollover;
  nextRollover: string; // ISO
  nextRolloverLabel: string;
  perfFee: number;
  mgmtFee: number;
  minInvestment: number;
  lockInDays: number;
  ownCapitalPct: number;
  risk: number;
  status: "open" | "frozen" | "closed";
  inception: string;
}

const ROLLOVER_NEXT: Record<Rollover, { iso: string; label: string }> = {
  daily: { iso: "2026-09-24T21:00:00Z", label: "Fri 00:00 GMT+3" },
  weekly: { iso: "2026-09-27T21:00:00Z", label: "Mon 00:00 GMT+3" },
  monthly: { iso: "2026-09-30T21:00:00Z", label: "Thu 1 Oct 00:00 GMT+3" },
};

const FUND_NAMES: Record<string, string> = {
  "lucas-ferreira": "Carioca Gold Fund",
  "sofia-rossi": "Milano Index Fund",
  "elena-petrova": "Limassol All-Weather Fund",
  "hassan-karimi": "Bosphorus Crypto Fund",
  "thomas-muller": "Frankfurt DAX Fund",
  "aisha-rahman": "KL Swap-Free Fund",
  "vikram-iyer": "Mumbai Range Fund",
  "isabella-cruz": "Manila Income Fund",
};

export const PAMM_FUNDS: PammFund[] = MASTERS.filter((m) => m.program !== "copy").map((m) => {
  const r = seeded(hashString(m.id + "pamm"));
  const nav = +(100 * (1 + m.returnAll / 100)).toFixed(4);
  return {
    id: `pf-${m.id}`,
    masterId: m.id,
    name: FUND_NAMES[m.id] ?? `${m.strategy} Fund`,
    navPerUnit: nav,
    navChange24h: +(r.normal() * 0.4 + 0.08).toFixed(2),
    aum: Math.round(m.aum * (m.program === "both" ? 0.62 : 1)),
    investors: Math.round(m.followers * (m.program === "both" ? 0.34 : 0.9)),
    returnAll: m.returnAll,
    return1y: m.return1y,
    maxDD: m.maxDD,
    ddFreeze: m.risk >= 7 ? 40 : m.risk >= 4 ? 25 : 15,
    rollover: m.rollover,
    nextRollover: ROLLOVER_NEXT[m.rollover].iso,
    nextRolloverLabel: ROLLOVER_NEXT[m.rollover].label,
    perfFee: m.perfFee,
    mgmtFee: 0,
    minInvestment: m.minInvestment,
    lockInDays: m.lockInDays,
    ownCapitalPct: m.ownCapitalPct,
    risk: m.risk,
    status: "open",
    inception: new Date(NOW - m.ageDays * 86400000).toISOString(),
  };
});

export function fundById(id: string) {
  return PAMM_FUNDS.find((f) => f.id === id);
}

/* ------------------------------------------------------------------ */
/* Sizing modes & policy                                               */
/* ------------------------------------------------------------------ */

export type SizingMode = "proportional" | "fixed-lot" | "multiplier" | "fixed-allocation";

export const SIZING_MODES: { key: SizingMode; title: string; text: string }[] = [
  { key: "proportional", title: "Equity proportional", text: "Each trade is scaled by your copy-account equity relative to the master's equity." },
  { key: "fixed-lot", title: "Fixed lot", text: "Every copied trade opens with the same lot size, whatever the master trades." },
  { key: "multiplier", title: "Lot multiplier", text: "Copy the master's lot size multiplied by a factor (e.g. 0.5× or 2×)." },
  { key: "fixed-allocation", title: "Fixed allocation", text: "Risk a fixed dollar amount per master trade, sized by the trade's stop distance." },
];

export const SOCIAL_POLICY = {
  perfFeeMin: 10,
  perfFeeMax: 50,
  minTrackRecordDays: 90,
  minOwnCapitalPct: 10,
  tradeDelayHours: 24,
  copyAccountPrefix: "81",
  feeSettlement: "Performance fees are calculated above the high-water mark at each settlement, held as pending, and released after admin approval.",
};

/* ------------------------------------------------------------------ */
/* My investments                                                      */
/* ------------------------------------------------------------------ */

export interface CopySubscription {
  id: string;
  masterId: string;
  copyAccount: string;
  status: "active" | "paused" | "stopped";
  startedAt: string;
  mode: SizingMode;
  modeValue: string;
  allocated: number;
  equity: number;
  pnl: number;
  hwm: number;
  feesAccrued: number;
  feesPaid: number;
  openTrades: number;
  equityStopPct: number;
  maxLot: number;
  excluded: string[];
}

export const MY_COPY_SUBS: CopySubscription[] = [
  { id: "cs1", masterId: "lucas-ferreira", copyAccount: "81204417", status: "active", startedAt: "2026-03-11T08:20:00Z", mode: "proportional", modeValue: "Equity ratio", allocated: 5000, equity: 6284.4, pnl: 1284.4, hwm: 6412.1, feesAccrued: 0, feesPaid: 342.18, openTrades: 2, equityStopPct: 25, maxLot: 1, excluded: ["US30"] },
  { id: "cs2", masterId: "nguyen-thu-ha", copyAccount: "81204562", status: "active", startedAt: "2026-06-02T11:05:00Z", mode: "multiplier", modeValue: "0.5×", allocated: 2500, equity: 2748.92, pnl: 248.92, hwm: 2702.3, feesAccrued: 9.32, feesPaid: 0, openTrades: 3, equityStopPct: 20, maxLot: 0.5, excluded: [] },
  { id: "cs3", masterId: "james-carter", copyAccount: "81204790", status: "paused", startedAt: "2026-08-19T14:40:00Z", mode: "fixed-lot", modeValue: "0.10 lot", allocated: 1500, equity: 1392.6, pnl: -107.4, hwm: 1560.2, feesAccrued: 0, feesPaid: 18.0, openTrades: 0, equityStopPct: 30, maxLot: 0.3, excluded: ["XAUUSD"] },
];

export interface PammHolding {
  id: string;
  fundId: string;
  units: number;
  avgNav: number;
  invested: number;
  stopLossPct: number;
  lockUntil: string | null;
  since: string;
  hwmNav: number;
  feesPaid: number;
  pending: { id: string; type: "invest" | "redeem"; amount: number; units?: number; submittedAt: string; executesAt: string }[];
}

export const MY_PAMM_HOLDINGS: PammHolding[] = [
  {
    id: "ph1", fundId: "pf-sofia-rossi", units: 28.6124, avgNav: 151.82, invested: 4344.12, stopLossPct: 15, lockUntil: null, since: "2025-11-01T00:00:00Z", hwmNav: 172.4, feesPaid: 96.4,
    pending: [{ id: "rq1", type: "invest", amount: 1000, submittedAt: "2026-09-22T10:14:00Z", executesAt: "2026-09-30T21:00:00Z" }],
  },
  {
    id: "ph2", fundId: "pf-elena-petrova", units: 15.2081, avgNav: 141.3, invested: 2148.9, stopLossPct: 20, lockUntil: "2026-10-18T00:00:00Z", since: "2026-08-18T00:00:00Z", hwmNav: 158.1, feesPaid: 12.6,
    pending: [],
  },
  {
    id: "ph3", fundId: "pf-hassan-karimi", units: 4.1022, avgNav: 358.9, invested: 1472.28, stopLossPct: 30, lockUntil: null, since: "2026-05-04T00:00:00Z", hwmNav: 412.6, feesPaid: 48.3,
    pending: [{ id: "rq2", type: "redeem", amount: 400, units: 0.9696, submittedAt: "2026-09-23T16:48:00Z", executesAt: "2026-09-27T21:00:00Z" }],
  },
];

/* ------------------------------------------------------------------ */
/* Master application                                                  */
/* ------------------------------------------------------------------ */

export const MASTER_APPLICATION = {
  status: "draft" as "draft" | "submitted" | "review" | "approved" | "rejected",
  account: "80412337",
  trackRecordDays: 94,
  ownCapitalPct: 12,
  kyc: "pending" as "pending" | "verified",
  timeline: [
    { key: "draft", label: "Application started", date: "2026-09-21T09:12:00Z", done: true },
    { key: "checks", label: "Automatic eligibility checks", date: "2026-09-21T09:13:00Z", done: true },
    { key: "kyc", label: "KYC verification", date: null as string | null, done: false },
    { key: "submitted", label: "Submitted for approval", date: null as string | null, done: false },
    { key: "review", label: "Compliance & risk review", date: null as string | null, done: false },
    { key: "live", label: "Profile goes live", date: null as string | null, done: false },
  ],
};
