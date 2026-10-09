/* Back Office · Analytics → Traders and Broker risk (prefix BA_). Deterministic — safe for SSR.
 * The types are the reports service's responses (services/reports: GET /v1/admin/traders, GET /v1/admin/risk,
 * POST /v1/admin/scenarios); demo builds compute the same shapes from the mock book below, with the same rules
 * (break-even ±$5, flags, routing hints, scenario revaluation, capital strength). */
import { seeded } from "./rng";
import { ANL_TODAY } from "./admin-growth-analytics";

/* ------------------------------------------------------------------ */
/* Types (reports service)                                             */
/* ------------------------------------------------------------------ */

export type TraderPeriod = "day" | "week" | "month";
export type TraderSegment = "profitable" | "breakEven" | "losing";
export type RouteHint = "A" | "review" | "B";
export type BookMix = "A" | "B" | "mixed";

export interface TraderAccount {
  login: number;
  group: string | null;
  net: number;
  trades: number;
  winRate: number;
  lots: number;
  floating: number;
  equity: number;
  book: BookMix;
  bookAPct: number;
}

export interface TraderRow {
  userId: number;
  name: string;
  email: string;
  country: string;
  logins: number[];
  groups: string[];
  accounts: TraderAccount[];
  net: number;
  floating: number;
  total: number;
  equity: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number | null;
  grossProfit: number;
  grossLoss: number;
  avgHoldSecs: number;
  medianHoldSecs: number;
  lots: number;
  notional: number;
  returnPct: number | null;
  book: BookMix;
  bookAPct: number;
  brokerRevenue: number;
  segment: TraderSegment;
  consistency: { profitable: number; of: number };
  flags: { consistent: boolean; scalper: boolean; highWinRate: boolean; largeSize: boolean };
  sizeToEquity: number | null;
  routeHint: RouteHint;
  reasons: string[];
}

export interface TraderSegmentRow {
  key: TraderSegment;
  clients: number;
  pctClients: number;
  net: number;
  lots: number;
  pctVolume: number;
  trades: number;
  brokerRevenue: number;
  floating: number;
}

export interface TraderBucket {
  start: string;
  end: string;
  traders: number;
  profitable: number;
  losing: number;
  breakEven: number;
  clientNet: number;
  brokerRevenue: number;
  trades: number;
  lots: number;
}

export interface TradersReport {
  from: string;
  to: string;
  period: TraderPeriod;
  currency: string;
  filters: { group: string | null; country: string | null; book: string | null };
  options: { groups: string[]; countries: string[] };
  floatingSource: string;
  definitions: { breakEvenUsd: number; scalpSecs: number; highWinRate: number; largeSizeX: number; consistencyWindow: number };
  totals: {
    traders: number;
    profitable: number;
    losing: number;
    breakEven: number;
    profitablePct: number;
    losingPct: number;
    breakEvenPct: number;
    clientNet: number;
    clientFloating: number;
    brokerRevenue: number;
    bbook: number;
    ibCost: number;
    trades: number;
    lots: number;
    notional: number;
    winRate: number;
    profitFactor: number | null;
    avgHoldSecs: number;
    medianHoldSecs: number;
    flagged: { consistent: number; scalper: number; highWinRate: number; largeSize: number };
    hints: { A: number; review: number; B: number };
  };
  segments: TraderSegmentRow[];
  series: TraderBucket[];
  distribution: { key: string; label: string; min: number | null; max: number | null; clients: number; net: number }[];
  topWinners: TraderRow[];
  topLosers: TraderRow[];
  clients: TraderRow[];
}

export interface ExposureRow {
  symbol?: string;
  class: string;
  longLots: number;
  shortLots: number;
  netLots: number;
  longUsd: number;
  shortUsd: number;
  netUsd: number;
  grossUsd: number;
  bbookNetUsd: number;
  bbookSharePct: number;
  clientFloating: number;
  bbookFloating: number;
  positions: number;
  accounts: number;
}

export interface RiskAccount {
  login: number;
  userId: number;
  name: string;
  country: string;
  group: string;
  balance: number;
  credit: number;
  equity: number;
  margin: number;
  marginLevel: number | null;
  marginCallLevel: number;
  stopOutLevel: number;
  floating: number;
  positions: number;
  lossToStopOut: number | null;
  grossUsd?: number;
  netUsd?: number;
  sharePct?: number;
  bbookFloating?: number;
}

export interface PresetRow {
  preset: string;
  label: string;
  direction: string;
  brokerImpact: number;
  clientPnl: number;
  stopOuts: number;
  marginCalls: number;
  negativeBalance: number;
  capitalAfter: number | null;
}

export type CapitalStatus = "strong" | "adequate" | "weak" | "unset";

export interface CapitalInfo {
  amount: number | null;
  currency: string;
  reason: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface RiskReport {
  asOf: string;
  currency: string;
  source: string;
  totals: {
    accounts: number;
    withPositions: number;
    positions: number;
    balance: number;
    credit: number;
    equity: number;
    margin: number;
    freeMargin: number;
    marginLevel: number | null;
    clientFloating: number;
    bbookFloating: number;
    abookClientFloating: number;
    grossUsd: number;
    longUsd: number;
    shortUsd: number;
    netUsd: number;
    bbookGrossUsd: number;
    bbookSharePct: number;
    atRisk: number;
  };
  bySymbol: ExposureRow[];
  byClass: ExposureRow[];
  options: ExposureRow;
  concentration: { grossUsd: number; accounts: number; top10GrossPct: number; top10FloatingPct: number; topSymbolPct: number; topAccounts: RiskAccount[] };
  marginLevels: { accounts: number; buckets: { key: string; label: string; accounts: number; equity: number; floating: number }[] };
  atRisk: RiskAccount[];
  credit: { credit: number; accounts: number; inUse: number; inUseAccounts: number; negativeBalance: number; negativeBalanceAccounts: number; negativeEquity: number; negativeEquityAccounts: number };
  capital: CapitalInfo & {
    status: CapitalStatus;
    coverage: number | null;
    worst: PresetRow | null;
    capitalAfterWorst: number | null;
    bbookFloatingPct: number | null;
    presets: PresetRow[];
  };
}

export type ShockScope = "symbol" | "assetClass" | "all";
export interface ShockInput {
  scope: ShockScope;
  target?: string;
  pct: number;
}

export interface ScenarioAccount {
  login: number;
  userId: number;
  name: string;
  country: string;
  group: string;
  positions: number;
  clientPnl: number;
  brokerImpact: number;
  equityBefore: number;
  equityAfter: number;
  marginLevelBefore: number | null;
  marginLevelAfter: number | null;
  stopOutLevel: number;
  stopOut: boolean;
  marginCall: boolean;
  negativeBalance: number;
  creditUsed: number;
}

export interface ScenarioResult {
  asOf: string;
  currency: string;
  preset: string | null;
  label: string;
  direction: string;
  shocks: { scope: string; target: string | null; pct: number }[];
  legs: { direction: string; shocks: { scope: string; target: string | null; pct: number }[]; brokerImpact: number; clientPnl: number; stopOuts: number }[];
  totals: {
    accounts: number;
    affected: number;
    positions: number;
    clientPnl: number;
    clientPnlA: number;
    clientPnlB: number;
    bbookPnl: number;
    uncollectible: number;
    brokerImpact: number;
    stopOuts: number;
    marginCalls: number;
    negativeAccounts: number;
    negativeBalance: number;
    negativeBalanceNew: number;
    creditUsed: number;
    equityBefore: number;
    equityAfter: number;
    capital: number | null;
    capitalAfter: number | null;
    capitalAfterPct: number | null;
    coverage: number | null;
  };
  bySymbol: { symbol: string; class: string; pct: number; positions: number; clientPnl: number; bbookPnl: number }[];
  accounts: ScenarioAccount[];
}

export const BA_PRESETS = [
  { key: "pm1", label: "±1 % on every symbol" },
  { key: "pm3", label: "±3 % on every symbol" },
  { key: "pm5", label: "±5 % on every symbol" },
  { key: "flash", label: "Flash crash" },
] as const;
export const BA_CLASSES = ["forex", "indices", "stocks", "crypto", "metals", "energies"] as const;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const DAY = 86_400_000;
const r2 = (v: number) => Math.round(v * 100) / 100;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const parseDay = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!);
};
/** Server-day start as an instant (GMT+3 in the demo period). */
const instant = (t: number) => new Date(t - 3 * 3600_000).toISOString().replace(".000Z", "Z");

const FIRST = ["Arjun", "Fatima", "Lucas", "Thu Ha", "Priya", "Omar", "Sofia", "Daniel", "Mei", "James", "Aisha", "Carlos", "Elena", "Rahul", "Yuki", "Hassan", "Ana", "Kwame", "Zara", "Thomas", "Laila", "Vikram", "Isabella", "Ethan", "Noah", "Amara", "Diego", "Hana", "Karim", "Leila", "Mateo", "Nadia", "Oliver", "Rania", "Samuel", "Tariq", "Valentina", "Wei", "Yusuf", "Zainab"];
const LAST = ["Mehta", "Al-Sayed", "Ferreira", "Nguyen", "Nair", "Haddad", "Rossi", "Okafor", "Lin", "Carter", "Rahman", "Mendoza", "Petrova", "Verma", "Tanaka", "Karimi", "Souza", "Mensah", "Sheikh", "Müller", "Farouk", "Iyer", "Cruz", "Brooks", "Kapoor", "Hoffmann", "Silva", "Chen", "Osei", "Novak", "Duarte", "Aziz", "Reyes", "Fischer", "Khan", "Mbeki", "Sato", "Ortiz", "Demir", "Lopez"];
const COUNTRIES = ["IN", "AE", "BR", "VN", "SA", "IT", "NG", "SG", "GB", "MY", "MX", "CY", "JP", "TR", "GH", "PK", "DE", "EG", "PH", "ZA"];
const GROUPS = ["standard", "pro", "raw", "cent"];

/* ------------------------------------------------------------------ */
/* Traders                                                             */
/* ------------------------------------------------------------------ */

interface DayRec {
  d: number; // day index (0 = today)
  trades: number;
  wins: number;
  gp: number;
  gl: number;
  lots: number;
}

interface MockTrader {
  userId: number;
  name: string;
  email: string;
  country: string;
  group: string;
  logins: number[];
  medianHold: number;
  avgHold: number;
  aShare: number; // A-book share of lots
  equity: number;
  floating: number;
  notionalPerLot: number;
  days: DayRec[];
}

const HORIZON = 420;

const TRADERS: MockTrader[] = (() => {
  const r = seeded(4417);
  const out: MockTrader[] = [];
  for (let i = 0; i < 168; i++) {
    const first = FIRST[i % FIRST.length]!;
    const last = LAST[(i * 7 + Math.floor(i / FIRST.length) * 3) % LAST.length]!;
    // archetypes: 0–5 sharp (consistent edge), 6–11 scalpers, 12–17 high win rate, the rest the crowd
    const sharp = i < 6;
    const scalp = i >= 6 && i < 12;
    const hiWin = i >= 12 && i < 18;
    const style = scalp ? "scalp" : r.bool(0.35) ? "swing" : "day";
    const medianHold = style === "scalp" ? r.range(35, 105) : style === "swing" ? r.range(86_400, 4 * 86_400) : r.range(900, 4 * 3600);
    const group = i % 9 === 0 ? "cent" : GROUPS[r.int(0, 2)]!;
    const size = group === "cent" ? r.range(0.02, 0.2) : r.range(0.05, scalp ? 3 : 1.6);
    const equity = Math.round(group === "cent" ? r.range(80, 900) : sharp ? r.range(25_000, 140_000) : r.range(400, 38_000));
    // per-trade edge in units of size × $100 (crowd loses on average)
    const edge = sharp ? r.range(0.5, 0.95) : scalp ? r.range(0.2, 0.6) : hiWin ? r.range(0.2, 0.4) : r.normal() * 0.35 - 0.22;
    const winP = hiWin ? r.range(0.84, 0.92) : scalp ? r.range(0.6, 0.72) : sharp ? r.range(0.55, 0.65) : r.range(0.36, 0.58);
    const activity = sharp || scalp ? r.range(0.55, 0.85) : r.range(0.08, 0.6);
    const days: DayRec[] = [];
    const start = r.int(0, HORIZON - 40);
    for (let d = HORIZON - 1; d >= 0; d--) {
      if (d > HORIZON - start || !r.bool(activity)) continue;
      const wd = new Date(ANL_TODAY - d * DAY).getUTCDay();
      if (wd === 6 || (wd === 0 && !r.bool(0.2))) continue; // crypto only on weekends
      const n = style === "scalp" ? r.int(8, 40) : style === "swing" ? r.int(1, 2) : r.int(1, 9);
      const rec: DayRec = { d, trades: n, wins: 0, gp: 0, gl: 0, lots: 0 };
      for (let k = 0; k < n; k++) {
        const lots = Math.max(0.01, size * r.range(0.4, 1.6));
        rec.lots += lots;
        const scale = lots * (style === "swing" ? 240 : style === "scalp" ? 22 : 90);
        let pnl: number;
        if (r.bool(winP)) pnl = scale * r.range(0.3, 1.4) * (hiWin ? 0.45 : 1);
        else pnl = -scale * r.range(0.3, 1.5) * (hiWin ? 1.2 : 1);
        pnl += edge * scale * 0.5;
        if (Math.abs(pnl) < 0.01) pnl = 0.01;
        if (pnl > 0) {
          rec.wins++;
          rec.gp += pnl;
        } else rec.gl -= pnl;
      }
      days.push(rec);
    }
    const login = 80410000 + i * 37 + 1;
    out.push({
      userId: 10_400 + i * 3,
      name: `${first} ${last}`,
      email: `${first}.${last}`.toLowerCase().replace(/[^a-z.]+/g, "") + "@mail.com",
      country: COUNTRIES[(i * 5) % COUNTRIES.length]!,
      group,
      logins: i % 4 === 0 ? [login, login + 11] : [login],
      medianHold,
      avgHold: medianHold * r.range(1.1, 1.8),
      aShare: sharp && i % 2 === 0 ? 1 : r.bool(0.12) ? r.range(0.2, 0.6) : 0,
      equity,
      floating: r2(r.normal() * equity * 0.03),
      notionalPerLot: r.range(60_000, 125_000),
      days,
    });
  }
  return out;
})();

function bucketStart(period: TraderPeriod, t: number): number {
  const d = new Date(t);
  if (period === "day") return t;
  if (period === "week") return t - ((d.getUTCDay() + 6) % 7) * DAY;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}
function bucketNext(period: TraderPeriod, start: number): number {
  if (period === "day") return start + DAY;
  if (period === "week") return start + 7 * DAY;
  const d = new Date(start);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}
/** Default range ending today (inclusive): 30 days / 12 weeks / 12 months. */
export function baDefaultRange(period: TraderPeriod): { from: string; to: string } {
  const today = ANL_TODAY;
  const from = period === "day" ? today - 29 * DAY : period === "week" ? bucketStart("week", today) - 77 * DAY : (() => {
    const d = new Date(today);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 11, 1);
  })();
  return { from: iso(from), to: iso(today) };
}

const segment = (net: number): TraderSegment => (net > 5 ? "profitable" : net < -5 ? "losing" : "breakEven");
const DIST: [string, string, number, number][] = [
  ["lt10k", "Below −$10K", -Infinity, -10_000],
  ["10k1k", "−$10K to −$1K", -10_000, -1_000],
  ["1k100", "−$1K to −$100", -1_000, -100],
  ["100be", "−$100 to −$5", -100, -5],
  ["be", "Break-even (±$5)", -5, 5],
  ["be100", "$5 to $100", 5, 100],
  ["100_1k", "$100 to $1K", 100, 1_000],
  ["1k_10k", "$1K to $10K", 1_000, 10_000],
  ["gt10k", "Above $10K", 10_000, Infinity],
];
const distIndex = (net: number) => (Math.abs(net) <= 5 ? 4 : Math.max(0, DIST.findIndex(([, , lo, hi]) => (net > 0 ? net > lo && net <= hi : net >= lo && net < hi))));
const holdLabel = (s: number) => (s < 60 ? `${s.toFixed(0)} s` : s < 3600 ? `${(s / 60).toFixed(1)} min` : s < 86_400 ? `${(s / 3600).toFixed(1)} h` : `${(s / 86_400).toFixed(1)} d`);

/** The Traders report for demo builds (same rules as the reports service). `to` is inclusive here. */
export function baTraders(q: { period: TraderPeriod; from?: string; to?: string; group?: string | null; country?: string | null; book?: string | null }): TradersReport {
  const period = q.period;
  const def = baDefaultRange(period);
  const fromT = parseDay(q.from || def.from);
  const toT = Math.min(parseDay(q.to || def.to), ANL_TODAY);
  const buckets: number[] = [];
  for (let b = bucketStart(period, fromT); b <= toT && buckets.length < 400; b = bucketNext(period, b)) buckets.push(b);
  const window = buckets.slice(-6);
  const bookShare = (t: MockTrader) => (q.book === "A" ? t.aShare : q.book === "B" ? 1 - t.aShare : 1);
  const rows: TraderRow[] = [];
  const perBucket = new Map<number, { p: number; l: number; be: number; net: number; trades: number; lots: number; rev: number }>();
  for (const b of buckets) perBucket.set(b, { p: 0, l: 0, be: 0, net: 0, trades: 0, lots: 0, rev: 0 });
  let totalLots = 0;
  for (const t of TRADERS) {
    if ((q.group && t.group !== q.group) || (q.country && t.country !== q.country)) continue;
    const share = bookShare(t);
    if (share <= 0) continue;
    let trades = 0, wins = 0, gp = 0, gl = 0, lots = 0;
    const byB = new Map<number, number>();
    for (const rec of t.days) {
      const at = ANL_TODAY - rec.d * DAY;
      if (at < fromT || at > toT) continue;
      const n = Math.max(1, Math.round(rec.trades * share));
      trades += n;
      wins += Math.round(rec.wins * share);
      gp += rec.gp * share;
      gl += rec.gl * share;
      lots += rec.lots * share;
      const b = bucketStart(period, at);
      byB.set(b, (byB.get(b) ?? 0) + (rec.gp - rec.gl) * share);
      const pb = perBucket.get(b);
      if (pb) {
        pb.trades += n;
        pb.lots += rec.lots * share;
        pb.rev += (-(rec.gp - rec.gl) * (1 - t.aShare) + rec.lots * 6.5) * share;
      }
    }
    if (trades === 0) continue;
    for (const [b, net] of byB) {
      const pb = perBucket.get(b);
      if (!pb) continue;
      pb.net += net;
      const s = segment(net);
      if (s === "profitable") pb.p++;
      else if (s === "losing") pb.l++;
      else pb.be++;
    }
    totalLots += lots;
    const net = gp - gl;
    const consistentN = window.filter((b) => (byB.get(b) ?? 0) > 5).length;
    const m = window.length;
    const consistent = m >= 3 && consistentN * 3 >= m * 2 && consistentN >= 3;
    const winRate = (wins / trades) * 100;
    const pf = gl > 0 ? gp / gl : null;
    const scalper = trades >= 5 && t.medianHold < 120;
    const highWinRate = trades >= 10 && winRate >= 80;
    const notional = lots * t.notionalPerLot;
    const sizeX = t.equity > 0 ? notional / trades / t.equity : null;
    const largeSize = sizeX !== null && sizeX >= 25;
    const profitable = net > 5;
    const reasons: string[] = [];
    if (consistent) reasons.push(`Profitable in ${consistentN} of the last ${m} periods`);
    if (scalper) reasons.push(`Median holding time ${holdLabel(t.medianHold)}`);
    if (highWinRate) reasons.push(`Win rate ${winRate.toFixed(0)}% over ${trades} trades`);
    if (largeSize && sizeX) reasons.push(`Average trade ${sizeX.toFixed(0)}× equity`);
    const routeHint: RouteHint = profitable && (consistent || scalper || (highWinRate && (pf === null || pf >= 1.5))) ? "A" : profitable && largeSize ? "review" : "B";
    const aPct = r2(t.aShare * 100);
    const book: BookMix = t.aShare >= 0.999 ? "A" : t.aShare > 0 ? "mixed" : "B";
    const revenue = -net * (1 - t.aShare) + lots * 6.5;
    const base = Math.max(1, t.equity - net * 0.6);
    rows.push({
      userId: t.userId,
      name: t.name,
      email: t.email,
      country: t.country,
      logins: t.logins,
      groups: [t.group],
      accounts: t.logins.map((login, j) => {
        const f = t.logins.length === 1 ? 1 : j === 0 ? 0.7 : 0.3;
        return { login, group: t.group, net: r2(net * f), trades: Math.max(1, Math.round(trades * f)), winRate: r2(winRate), lots: r2(lots * f), floating: r2(t.floating * f), equity: r2(t.equity * f), book, bookAPct: aPct };
      }),
      net: r2(net),
      floating: t.floating,
      total: r2(net + t.floating),
      equity: t.equity,
      trades,
      wins,
      losses: trades - wins,
      winRate: r2(winRate),
      profitFactor: pf === null ? null : r2(pf),
      grossProfit: r2(gp),
      grossLoss: r2(gl),
      avgHoldSecs: r2(t.avgHold),
      medianHoldSecs: r2(t.medianHold),
      lots: r2(lots),
      notional: r2(notional),
      returnPct: r2((net / base) * 100),
      book,
      bookAPct: aPct,
      brokerRevenue: r2(revenue),
      segment: segment(net),
      consistency: { profitable: consistentN, of: m },
      flags: { consistent, scalper, highWinRate, largeSize },
      sizeToEquity: sizeX === null ? null : r2(sizeX),
      routeHint,
      reasons,
    });
  }
  rows.sort((a, b) => b.net - a.net || a.userId - b.userId);
  const n = rows.length;
  const pct = (x: number) => (n ? r2((x / n) * 100) : 0);
  const segments: TraderSegmentRow[] = (["profitable", "breakEven", "losing"] as const).map((k) => {
    const s = rows.filter((c) => c.segment === k);
    const lots = s.reduce((a, c) => a + c.lots, 0);
    return {
      key: k,
      clients: s.length,
      pctClients: pct(s.length),
      net: r2(s.reduce((a, c) => a + c.net, 0)),
      lots: r2(lots),
      pctVolume: totalLots ? r2((lots / totalLots) * 100) : 0,
      trades: s.reduce((a, c) => a + c.trades, 0),
      brokerRevenue: r2(s.reduce((a, c) => a + c.brokerRevenue, 0)),
      floating: r2(s.reduce((a, c) => a + c.floating, 0)),
    };
  });
  const dist = DIST.map(([key, label, min, max]) => ({ key, label, min: Number.isFinite(min) ? min : null, max: Number.isFinite(max) ? max : null, clients: 0, net: 0 }));
  for (const c of rows) {
    const d = dist[distIndex(c.net)]!;
    d.clients++;
    d.net = r2(d.net + c.net);
  }
  const count = (s: TraderSegment) => rows.filter((c) => c.segment === s).length;
  const gp = rows.reduce((a, c) => a + c.grossProfit, 0);
  const gl = rows.reduce((a, c) => a + c.grossLoss, 0);
  const trades = rows.reduce((a, c) => a + c.trades, 0);
  const wins = rows.reduce((a, c) => a + c.wins, 0);
  const bbook = rows.reduce((a, c) => a - c.net * (1 - c.bookAPct / 100), 0);
  const commission = totalLots * 6.5;
  const ibCost = commission * 0.18;
  const holds = rows.map((c) => c.medianHoldSecs).sort((a, b) => a - b);
  const flagged = (k: keyof TraderRow["flags"]) => rows.filter((c) => c.flags[k]).length;
  const series: TraderBucket[] = buckets.map((b) => {
    const pb = perBucket.get(b)!;
    return {
      start: iso(b),
      end: iso(bucketNext(period, b)),
      traders: pb.p + pb.l + pb.be,
      profitable: pb.p,
      losing: pb.l,
      breakEven: pb.be,
      clientNet: r2(pb.net),
      brokerRevenue: r2(pb.rev * 0.82),
      trades: pb.trades,
      lots: r2(pb.lots),
    };
  });
  return {
    from: instant(fromT),
    to: instant(toT + DAY),
    period,
    currency: "USD",
    filters: { group: q.group ?? null, country: q.country ?? null, book: q.book ?? null },
    options: { groups: [...GROUPS].sort(), countries: [...new Set(TRADERS.map((t) => t.country))].sort() },
    floatingSource: "engine",
    definitions: { breakEvenUsd: 5, scalpSecs: 120, highWinRate: 80, largeSizeX: 25, consistencyWindow: 6 },
    totals: {
      traders: n,
      profitable: count("profitable"),
      losing: count("losing"),
      breakEven: count("breakEven"),
      profitablePct: pct(count("profitable")),
      losingPct: pct(count("losing")),
      breakEvenPct: pct(count("breakEven")),
      clientNet: r2(gp - gl),
      clientFloating: r2(rows.reduce((a, c) => a + c.floating, 0)),
      brokerRevenue: r2(bbook + commission - ibCost),
      bbook: r2(bbook),
      ibCost: r2(ibCost),
      trades,
      lots: r2(totalLots),
      notional: r2(rows.reduce((a, c) => a + c.notional, 0)),
      winRate: trades ? r2((wins / trades) * 100) : 0,
      profitFactor: gl > 0 ? r2(gp / gl) : null,
      avgHoldSecs: r2(rows.reduce((a, c) => a + c.avgHoldSecs, 0) / Math.max(1, n)),
      medianHoldSecs: holds.length ? r2(holds[Math.floor(holds.length / 2)]!) : 0,
      flagged: { consistent: flagged("consistent"), scalper: flagged("scalper"), highWinRate: flagged("highWinRate"), largeSize: flagged("largeSize") },
      hints: { A: rows.filter((c) => c.routeHint === "A").length, review: rows.filter((c) => c.routeHint === "review").length, B: rows.filter((c) => c.routeHint === "B").length },
    },
    segments,
    series,
    distribution: dist,
    topWinners: rows.filter((c) => c.net > 5).slice(0, 10),
    topLosers: [...rows].reverse().filter((c) => c.net < -5).slice(0, 10),
    clients: rows,
  };
}

/* ------------------------------------------------------------------ */
/* Broker risk: the open book                                          */
/* ------------------------------------------------------------------ */

interface MockSpec {
  cls: string;
  contract: number;
  price: number;
  usdBase?: boolean;
  conv?: number;
}

const SPECS: Record<string, MockSpec> = {
  EURUSD: { cls: "forex", contract: 100_000, price: 1.1652 },
  GBPUSD: { cls: "forex", contract: 100_000, price: 1.3418 },
  USDJPY: { cls: "forex", contract: 100_000, price: 148.24, usdBase: true },
  AUDUSD: { cls: "forex", contract: 100_000, price: 0.6612 },
  GBPJPY: { cls: "forex", contract: 100_000, price: 198.9, conv: 1 / 148.24 },
  XAUUSD: { cls: "metals", contract: 100, price: 2654.3 },
  XAGUSD: { cls: "metals", contract: 5000, price: 31.42 },
  US30: { cls: "indices", contract: 1, price: 42_315 },
  NAS100: { cls: "indices", contract: 1, price: 20_480 },
  GER40: { cls: "indices", contract: 1, price: 19_265, conv: 1.165 },
  USOIL: { cls: "energies", contract: 1000, price: 74.18 },
  BTCUSD: { cls: "crypto", contract: 1, price: 63_480 },
  ETHUSD: { cls: "crypto", contract: 1, price: 2_482 },
  SOLUSD: { cls: "crypto", contract: 1, price: 146.2 },
  AAPL: { cls: "stocks", contract: 1, price: 228.4 },
  TSLA: { cls: "stocks", contract: 1, price: 252.1 },
  NVDA: { cls: "stocks", contract: 1, price: 121.6 },
};

interface MockPos {
  login: number;
  symbol: string;
  sign: number;
  volume: number;
  book: "A" | "B";
  floating: number;
}

interface MockAcct {
  login: number;
  userId: number;
  name: string;
  country: string;
  group: string;
  balance: number;
  credit: number;
  equity: number;
  margin: number;
  floating: number;
  marginCall: number;
  stopOut: number;
}

const convOf = (s: MockSpec) => (s.usdBase ? 1 / s.price : (s.conv ?? 1));
const notionalOf = (p: MockPos) => {
  const s = SPECS[p.symbol]!;
  return p.volume * s.contract * s.price * convOf(s);
};

const BOOK: { accounts: MockAcct[]; positions: MockPos[] } = (() => {
  const r = seeded(7313);
  const syms = Object.keys(SPECS);
  const weights: Record<string, number> = { EURUSD: 6, XAUUSD: 6, GBPUSD: 3, USDJPY: 3, BTCUSD: 4, NAS100: 3, US30: 2, ETHUSD: 2 };
  const pickSym = () => {
    const total = syms.reduce((a, s) => a + (weights[s] ?? 1), 0);
    let x = r.range(0, total);
    for (const s of syms) {
      x -= weights[s] ?? 1;
      if (x <= 0) return s;
    }
    return "EURUSD";
  };
  const accounts: MockAcct[] = [];
  const positions: MockPos[] = [];
  for (let i = 0; i < 80; i++) {
    const t = TRADERS[(i * 2) % TRADERS.length]!;
    const login = t.logins[0]!;
    const lev = r.pick([100, 200, 300, 500]);
    const target = i % 11 === 0 ? r.range(0.7, 1.4) : i % 7 === 0 ? r.range(1.5, 2.6) : r.range(2.5, 30); // equity ÷ margin
    const n = r.int(1, 4);
    let margin = 0;
    let floating = 0;
    const mine: MockPos[] = [];
    for (let k = 0; k < n; k++) {
      const symbol = k === 0 && i < 6 ? (i % 2 ? "XAUUSD" : "BTCUSD") : pickSym();
      const s = SPECS[symbol]!;
      const lotUsd = s.contract * s.price * convOf(s);
      const volume = Math.max(0.01, Math.round(((r.range(4_000, 160_000) * (i < 6 ? 6 : 1)) / lotUsd) * 100) / 100);
      const p: MockPos = { login, symbol, sign: r.bool(0.62) ? 1 : -1, volume, book: t.aShare >= 0.999 || (t.aShare > 0 && r.bool(t.aShare)) ? "A" : "B", floating: 0 };
      const n0 = notionalOf(p);
      p.floating = r2(n0 * r.normal() * 0.006);
      margin += n0 / Math.min(lev, s.cls === "forex" ? lev : s.cls === "crypto" ? 20 : 100);
      floating += p.floating;
      mine.push(p);
    }
    positions.push(...mine);
    const equity = r2(margin * target);
    const credit = i % 6 === 0 ? r2(Math.min(equity * 0.3, r.range(100, 2_500))) : 0;
    accounts.push({
      login,
      userId: t.userId,
      name: t.name,
      country: t.country,
      group: t.group,
      balance: r2(equity - floating - credit),
      credit,
      equity,
      margin: r2(margin),
      floating: r2(floating),
      marginCall: 100,
      stopOut: 50,
    });
  }
  // accounts without open positions
  for (let i = 0; i < 64; i++) {
    const t = TRADERS[(i * 2 + 1) % TRADERS.length]!;
    const balance = r2(r.range(150, 22_000));
    const credit = i % 9 === 0 ? 250 : 0;
    accounts.push({ login: t.logins[t.logins.length - 1]! + 3, userId: t.userId, name: t.name, country: t.country, group: t.group, balance: i === 5 ? -84.2 : balance, credit, equity: i === 5 ? -84.2 + credit : balance + credit, margin: 0, floating: 0, marginCall: 100, stopOut: 50 });
  }
  return { accounts, positions };
})();

/* ------------------------------------------------------------------ */
/* Scenarios (port of services/reports/src/risk.rs)                    */
/* ------------------------------------------------------------------ */

function pctFor(shocks: ShockInput[], symbol: string, cls: string): number {
  const find = (scope: ShockScope, t: string) => [...shocks].reverse().find((s) => s.scope === scope && (scope === "all" || (s.target ?? "").toUpperCase() === t.toUpperCase()))?.pct;
  return find("symbol", symbol) ?? find("assetClass", cls) ?? find("all", "") ?? 0;
}

function positionDelta(p: MockPos, pct: number): number {
  if (!pct) return 0;
  const s = SPECS[p.symbol]!;
  const p1 = s.price * (1 + pct / 100);
  const dq = p.sign * p.volume * s.contract * (p1 - s.price);
  return s.usdBase ? dq / p1 : dq * convOf(s);
}

interface Out {
  a: MockAcct;
  positions: number;
  d: number;
  dA: number;
  dB: number;
  equityAfter: number;
  marginAfter: number;
  levelAfter: number | null;
  stopOut: boolean;
  marginCall: boolean;
  negativeAfter: number;
  negativeNew: number;
  creditUsed: number;
  uncollectible: number;
  impact: number;
}

function run(shocks: ShockInput[]): { accounts: Out[]; bySymbol: Map<string, { cls: string; pct: number; positions: number; client: number; bbook: number }> } {
  const per = new Map<number, MockPos[]>();
  for (const p of BOOK.positions) per.set(p.login, [...(per.get(p.login) ?? []), p]);
  const accounts: Out[] = [];
  const bySymbol = new Map<string, { cls: string; pct: number; positions: number; client: number; bbook: number }>();
  for (const a of BOOK.accounts) {
    const ps = per.get(a.login);
    if (!ps) continue;
    let d = 0, dA = 0, dB = 0, n0 = 0, n1 = 0;
    for (const p of ps) {
      const s = SPECS[p.symbol]!;
      const pct = pctFor(shocks, p.symbol, s.cls);
      const x = positionDelta(p, pct);
      d += x;
      if (p.book === "A") dA += x;
      else dB += x;
      n0 += notionalOf(p);
      n1 += s.usdBase ? notionalOf(p) : notionalOf(p) * (1 + pct / 100);
      const row = bySymbol.get(p.symbol) ?? { cls: s.cls, pct, positions: 0, client: 0, bbook: 0 };
      row.positions++;
      row.client += x;
      if (p.book !== "A") row.bbook -= x;
      bySymbol.set(p.symbol, row);
    }
    const equityAfter = a.equity + d;
    const marginAfter = n0 > 0 ? (a.margin * n1) / n0 : a.margin;
    const levelAfter = marginAfter > 0 ? (equityAfter / marginAfter) * 100 : null;
    const stopOut = (levelAfter !== null && levelAfter <= a.stopOut) || (equityAfter <= 0 && marginAfter > 0);
    const marginCall = !stopOut && levelAfter !== null && levelAfter <= a.marginCall;
    const own0 = a.equity - a.credit;
    const own1 = own0 + d;
    const unc = (own: number) => Math.max(0, -own);
    const cu = (own: number) => Math.min(Math.max(0, a.credit), Math.max(0, -own));
    const uncollectible = unc(own1) - unc(own0);
    const negativeAfter = Math.max(0, -equityAfter);
    accounts.push({ a, positions: ps.length, d, dA, dB, equityAfter, marginAfter, levelAfter, stopOut, marginCall, negativeAfter, negativeNew: negativeAfter - Math.max(0, -a.equity), creditUsed: cu(own1) - cu(own0), uncollectible, impact: -dB - uncollectible });
  }
  return { accounts, bySymbol };
}

const sumOf = (o: Out[], f: (x: Out) => number) => o.reduce((s, x) => s + f(x), 0);

function legsOf(preset: string): { dir: string; shocks: ShockInput[] }[] | null {
  const pm = (x: number) => [
    { dir: "up", shocks: [{ scope: "all" as const, pct: x }] },
    { dir: "down", shocks: [{ scope: "all" as const, pct: -x }] },
  ];
  if (preset === "pm1") return pm(1);
  if (preset === "pm3") return pm(3);
  if (preset === "pm5") return pm(5);
  if (preset === "flash")
    return [{ dir: "down", shocks: [["crypto", -20], ["stocks", -10], ["indices", -7], ["energies", -8], ["metals", -4], ["forex", -2]].map(([c, p]) => ({ scope: "assetClass" as const, target: c as string, pct: p as number })) }];
  return null;
}

const shockJson = (s: ShockInput) => ({ scope: s.scope, target: s.scope === "all" ? null : (s.target ?? null), pct: s.pct });

function worst(legs: { dir: string; shocks: ShockInput[] }[]) {
  let best: { dir: string; shocks: ShockInput[]; o: ReturnType<typeof run> } | null = null;
  const summary = [];
  for (const l of legs) {
    const o = run(l.shocks);
    const impact = sumOf(o.accounts, (x) => x.impact);
    summary.push({ direction: l.dir, shocks: l.shocks.map(shockJson), brokerImpact: r2(impact), clientPnl: r2(sumOf(o.accounts, (x) => x.d)), stopOuts: o.accounts.filter((x) => x.stopOut).length });
    if (!best || impact < sumOf(best.o.accounts, (x) => x.impact)) best = { ...l, o };
  }
  return { best: best!, summary };
}

export function baStrength(capital: number | null, worstImpact: number): { status: CapitalStatus; coverage: number | null } {
  if (!capital || capital <= 0) return { status: "unset", coverage: null };
  const loss = Math.max(0, -worstImpact);
  if (loss < 0.01) return { status: "strong", coverage: null };
  const c = capital / loss;
  return { status: c >= 2 ? "strong" : c >= 1 ? "adequate" : "weak", coverage: c };
}

const AS_OF = new Date(ANL_TODAY + 11.5 * 3600_000).toISOString().replace(".000Z", "Z");

/** POST /v1/admin/scenarios for demo builds. */
export function baScenario(body: { preset?: string; shocks?: ShockInput[] }, capital: number | null): ScenarioResult {
  const legs = body.preset ? legsOf(body.preset) : [{ dir: "custom", shocks: body.shocks ?? [] }];
  if (!legs || !legs[0]!.shocks.length) throw new Error("Choose a preset or add price shocks.");
  const { best, summary } = worst(legs);
  const o = best.o.accounts;
  const impact = sumOf(o, (x) => x.impact);
  const cov = baStrength(capital, impact).coverage;
  const affected = o.filter((x) => Math.abs(x.d) >= 0.01).sort((a, b) => Number(b.stopOut) - Number(a.stopOut) || a.d - b.d || a.a.login - b.a.login);
  return {
    asOf: AS_OF,
    currency: "USD",
    preset: body.preset ?? null,
    label: BA_PRESETS.find((p) => p.key === body.preset)?.label ?? "Custom",
    direction: best.dir,
    shocks: best.shocks.map(shockJson),
    legs: summary,
    totals: {
      accounts: o.length,
      affected: affected.length,
      positions: sumOf(o, (x) => x.positions),
      clientPnl: r2(sumOf(o, (x) => x.d)),
      clientPnlA: r2(sumOf(o, (x) => x.dA)),
      clientPnlB: r2(sumOf(o, (x) => x.dB)),
      bbookPnl: r2(-sumOf(o, (x) => x.dB)),
      uncollectible: r2(sumOf(o, (x) => x.uncollectible)),
      brokerImpact: r2(impact),
      stopOuts: o.filter((x) => x.stopOut).length,
      marginCalls: o.filter((x) => x.marginCall).length,
      negativeAccounts: o.filter((x) => x.equityAfter < 0).length,
      negativeBalance: r2(sumOf(o, (x) => x.negativeAfter)),
      negativeBalanceNew: r2(sumOf(o, (x) => x.negativeNew)),
      creditUsed: r2(sumOf(o, (x) => x.creditUsed)),
      equityBefore: r2(sumOf(o, (x) => x.a.equity)),
      equityAfter: r2(sumOf(o, (x) => x.equityAfter)),
      capital,
      capitalAfter: capital === null ? null : r2(capital + impact),
      capitalAfterPct: capital ? r2(((capital + impact) / capital) * 100) : null,
      coverage: cov === null ? null : r2(cov),
    },
    bySymbol: [...best.o.bySymbol.entries()]
      .filter(([, s]) => s.pct !== 0)
      .map(([symbol, s]) => ({ symbol, class: s.cls, pct: s.pct, positions: s.positions, clientPnl: r2(s.client), bbookPnl: r2(s.bbook) }))
      .sort((a, b) => a.bbookPnl - b.bbookPnl),
    accounts: affected.slice(0, 50).map((x) => ({
      login: x.a.login,
      userId: x.a.userId,
      name: x.a.name,
      country: x.a.country,
      group: x.a.group,
      positions: x.positions,
      clientPnl: r2(x.d),
      brokerImpact: r2(x.impact),
      equityBefore: r2(x.a.equity),
      equityAfter: r2(x.equityAfter),
      marginLevelBefore: x.a.margin > 0 ? r2((x.a.equity / x.a.margin) * 100) : null,
      marginLevelAfter: x.levelAfter === null ? null : r2(x.levelAfter),
      stopOutLevel: x.a.stopOut,
      stopOut: x.stopOut,
      marginCall: x.marginCall,
      negativeBalance: r2(x.negativeAfter),
      creditUsed: r2(x.creditUsed),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Live risk report                                                    */
/* ------------------------------------------------------------------ */

export const BA_CAPITAL: CapitalInfo = { amount: 2_500_000, currency: "USD", reason: "Audited regulatory capital, Q3 2026", updatedBy: "Priya Nair", updatedAt: "2026-09-02T08:14:00Z" };

const LEVELS: [string, string, number, number][] = [
  ["healthy", "200 % and above", 200, Infinity],
  ["watch", "100–200 %", 100, 200],
  ["nearStopOut", "50–100 % (near stop-out)", 50, 100],
  ["critical", "Below 50 %", -Infinity, 50],
];

function acctRow(a: MockAcct, positions: number): RiskAccount {
  return {
    login: a.login,
    userId: a.userId,
    name: a.name,
    country: a.country,
    group: a.group,
    balance: r2(a.balance),
    credit: r2(a.credit),
    equity: r2(a.equity),
    margin: r2(a.margin),
    marginLevel: a.margin > 0 ? r2((a.equity / a.margin) * 100) : null,
    marginCallLevel: a.marginCall,
    stopOutLevel: a.stopOut,
    floating: r2(a.floating),
    positions,
    lossToStopOut: a.margin > 0 ? r2(Math.max(0, a.equity - (a.stopOut / 100) * a.margin)) : null,
  };
}

/** GET /v1/admin/risk for demo builds. */
export function baRisk(capital: CapitalInfo = BA_CAPITAL): RiskReport {
  type E = Omit<ExposureRow, "netLots" | "netUsd" | "grossUsd" | "bbookSharePct"> & { bGross: number; logins: Set<number> };
  const blank = (cls: string): E => ({ class: cls, longLots: 0, shortLots: 0, longUsd: 0, shortUsd: 0, bbookNetUsd: 0, clientFloating: 0, bbookFloating: 0, positions: 0, accounts: 0, bGross: 0, logins: new Set() });
  const add = (e: E, p: MockPos) => {
    const n = notionalOf(p);
    if (p.sign > 0) {
      e.longLots += p.volume;
      e.longUsd += n;
    } else {
      e.shortLots += p.volume;
      e.shortUsd += n;
    }
    if (p.book !== "A") {
      e.bGross += n;
      e.bbookNetUsd += p.sign * n;
      e.bbookFloating -= p.floating;
    }
    e.clientFloating += p.floating;
    e.positions++;
    e.logins.add(p.login);
  };
  const fin = (e: E, symbol?: string): ExposureRow => {
    const gross = e.longUsd + e.shortUsd;
    return {
      ...(symbol ? { symbol } : {}),
      class: e.class,
      longLots: r2(e.longLots),
      shortLots: r2(e.shortLots),
      netLots: r2(e.longLots - e.shortLots),
      longUsd: r2(e.longUsd),
      shortUsd: r2(e.shortUsd),
      netUsd: r2(e.longUsd - e.shortUsd),
      grossUsd: r2(gross),
      bbookNetUsd: r2(e.bbookNetUsd),
      bbookSharePct: gross ? r2((e.bGross / gross) * 100) : 0,
      clientFloating: r2(e.clientFloating),
      bbookFloating: r2(e.bbookFloating),
      positions: e.positions,
      accounts: e.logins.size,
    };
  };
  const sym = new Map<string, E>();
  const cls = new Map<string, E>();
  const perLogin = new Map<number, { gross: number; net: number; bf: number; n: number }>();
  for (const p of BOOK.positions) {
    const s = SPECS[p.symbol]!;
    if (!sym.has(p.symbol)) sym.set(p.symbol, blank(s.cls));
    if (!cls.has(s.cls)) cls.set(s.cls, blank(s.cls));
    add(sym.get(p.symbol)!, p);
    add(cls.get(s.cls)!, p);
    const l = perLogin.get(p.login) ?? { gross: 0, net: 0, bf: 0, n: 0 };
    l.gross += notionalOf(p);
    l.net += p.sign * notionalOf(p);
    if (p.book !== "A") l.bf -= p.floating;
    l.n++;
    perLogin.set(p.login, l);
  }
  const bySymbol = [...sym.entries()].map(([k, e]) => fin(e, k)).sort((a, b) => b.grossUsd - a.grossUsd);
  const byClass = [...cls.values()].map((e) => fin(e)).sort((a, b) => b.grossUsd - a.grossUsd);
  const gross = bySymbol.reduce((a, s) => a + s.grossUsd, 0);
  const long = bySymbol.reduce((a, s) => a + s.longUsd, 0);
  const short = bySymbol.reduce((a, s) => a + s.shortUsd, 0);
  const bGross = [...sym.values()].reduce((a, e) => a + e.bGross, 0);
  const bbookFloating = BOOK.positions.filter((p) => p.book !== "A").reduce((a, p) => a - p.floating, 0);
  const abook = BOOK.positions.filter((p) => p.book === "A").reduce((a, p) => a + p.floating, 0);
  const accts = new Map(BOOK.accounts.map((a) => [a.login, a]));
  const ranked = [...perLogin.entries()].sort((a, b) => b[1].gross - a[1].gross || a[0] - b[0]);
  const acctGross = ranked.reduce((a, [, v]) => a + v.gross, 0);
  const floats = ranked.map(([, v]) => Math.abs(v.bf)).sort((a, b) => b - a);
  const floatAbs = floats.reduce((a, b) => a + b, 0);
  const levels = LEVELS.map(([key, label]) => ({ key, label, accounts: 0, equity: 0, floating: 0 }));
  const atRisk: MockAcct[] = [];
  for (const a of BOOK.accounts) {
    if (a.margin <= 0) continue;
    const l = (a.equity / a.margin) * 100;
    const i = Math.max(0, LEVELS.findIndex(([, , lo, hi]) => l >= lo && l < hi));
    levels[i]!.accounts++;
    levels[i]!.equity = r2(levels[i]!.equity + a.equity);
    levels[i]!.floating = r2(levels[i]!.floating + a.floating);
    if (l <= Math.max(150, a.marginCall)) atRisk.push(a);
  }
  atRisk.sort((a, b) => a.equity / a.margin - b.equity / b.margin);
  const inUse = (a: MockAcct) => Math.min(Math.max(0, a.credit), Math.max(0, a.credit - a.equity));
  const eq = BOOK.accounts.reduce((s, a) => s + a.equity, 0);
  const mg = BOOK.accounts.reduce((s, a) => s + a.margin, 0);
  const cap = capital.amount;
  const presets: PresetRow[] = BA_PRESETS.map(({ key, label }) => {
    const { best } = worst(legsOf(key)!);
    const o = best.o.accounts;
    const impact = sumOf(o, (x) => x.impact);
    return { preset: key, label, direction: best.dir, brokerImpact: r2(impact), clientPnl: r2(sumOf(o, (x) => x.d)), stopOuts: o.filter((x) => x.stopOut).length, marginCalls: o.filter((x) => x.marginCall).length, negativeBalance: r2(sumOf(o, (x) => x.negativeAfter)), capitalAfter: cap === null ? null : r2(cap + impact) };
  });
  const w = presets.reduce<PresetRow | null>((a, p) => (!a || p.brokerImpact < a.brokerImpact ? p : a), null);
  const st = baStrength(cap, w?.brokerImpact ?? 0);
  const positionsOf = (login: number) => perLogin.get(login)?.n ?? 0;
  return {
    asOf: AS_OF,
    currency: "USD",
    source: "engine",
    totals: {
      accounts: BOOK.accounts.length,
      withPositions: perLogin.size,
      positions: BOOK.positions.length,
      balance: r2(BOOK.accounts.reduce((s, a) => s + a.balance, 0)),
      credit: r2(BOOK.accounts.reduce((s, a) => s + a.credit, 0)),
      equity: r2(eq),
      margin: r2(mg),
      freeMargin: r2(eq - mg),
      marginLevel: mg > 0 ? r2((eq / mg) * 100) : null,
      clientFloating: r2(BOOK.accounts.reduce((s, a) => s + a.floating, 0)),
      bbookFloating: r2(bbookFloating),
      abookClientFloating: r2(abook),
      grossUsd: r2(gross),
      longUsd: r2(long),
      shortUsd: r2(short),
      netUsd: r2(long - short),
      bbookGrossUsd: r2(bGross),
      bbookSharePct: gross ? r2((bGross / gross) * 100) : 0,
      atRisk: atRisk.length,
    },
    bySymbol,
    byClass,
    options: fin(blank("options")),
    concentration: {
      grossUsd: r2(acctGross),
      accounts: perLogin.size,
      top10GrossPct: acctGross ? r2((ranked.slice(0, 10).reduce((a, [, v]) => a + v.gross, 0) / acctGross) * 100) : 0,
      top10FloatingPct: floatAbs ? r2((floats.slice(0, 10).reduce((a, b) => a + b, 0) / floatAbs) * 100) : 0,
      topSymbolPct: gross && bySymbol[0] ? r2((bySymbol[0].grossUsd / gross) * 100) : 0,
      topAccounts: ranked.slice(0, 10).map(([login, v]) => ({ ...acctRow(accts.get(login)!, v.n), grossUsd: r2(v.gross), netUsd: r2(v.net), sharePct: acctGross ? r2((v.gross / acctGross) * 100) : 0, bbookFloating: r2(v.bf) })),
    },
    marginLevels: { accounts: BOOK.accounts.filter((a) => a.margin > 0).length, buckets: levels },
    atRisk: atRisk.map((a) => acctRow(a, positionsOf(a.login))),
    credit: {
      credit: r2(BOOK.accounts.reduce((s, a) => s + a.credit, 0)),
      accounts: BOOK.accounts.filter((a) => a.credit > 0).length,
      inUse: r2(BOOK.accounts.reduce((s, a) => s + inUse(a), 0)),
      inUseAccounts: BOOK.accounts.filter((a) => inUse(a) > 0).length,
      negativeBalance: r2(BOOK.accounts.reduce((s, a) => s + Math.max(0, -a.balance), 0)),
      negativeBalanceAccounts: BOOK.accounts.filter((a) => a.balance < 0).length,
      negativeEquity: r2(BOOK.accounts.reduce((s, a) => s + Math.max(0, -a.equity), 0)),
      negativeEquityAccounts: BOOK.accounts.filter((a) => a.equity < 0).length,
    },
    capital: {
      ...capital,
      status: st.status,
      coverage: st.coverage === null ? null : r2(st.coverage),
      worst: w,
      capitalAfterWorst: cap === null || !w ? null : r2(cap + w.brokerImpact),
      bbookFloatingPct: cap ? r2((bbookFloating / cap) * 100) : null,
      presets,
    },
  };
}
