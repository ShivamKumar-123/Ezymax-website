import { HISTORY, type ClosedTrade } from "./client";

/* ------------------------------------------------------------------ */
/* Courses                                                             */
/* ------------------------------------------------------------------ */

export type Level = "Beginner" | "Intermediate" | "Advanced";

export interface Course {
  id: string;
  title: string;
  summary: string;
  level: Level;
  lessons: number;
  minutes: number;
  progress: number; // 0-100
  image: string;
  instructor: number; // PEOPLE index
  students: number;
  rating: number;
  tag?: string;
}

export const COURSES: Course[] = [
  { id: "fx-101", title: "Forex foundations", summary: "Pips, lots, leverage and how a currency pair actually moves.", level: "Beginner", lessons: 12, minutes: 94, progress: 100, image: "/assets/photos/trading-screen.jpg", instructor: 9, students: 18420, rating: 4.9 },
  { id: "risk", title: "Risk management that survives", summary: "Position sizing, the 1% rule, drawdown maths and stop placement.", level: "Beginner", lessons: 9, minutes: 72, progress: 64, image: "/assets/photos/analytics.jpg", instructor: 12, students: 14210, rating: 4.9, tag: "Recommended" },
  { id: "gold", title: "Trading gold (XAUUSD)", summary: "Real yields, the dollar, session behaviour and volatility regimes.", level: "Intermediate", lessons: 10, minutes: 88, progress: 30, image: "/assets/photos/gold.jpg", instructor: 5, students: 9620, rating: 4.8 },
  { id: "pa", title: "Price action & market structure", summary: "Swing points, liquidity sweeps, break-of-structure and order blocks.", level: "Intermediate", lessons: 14, minutes: 126, progress: 0, image: "/assets/photos/charts.jpg", instructor: 2, students: 12890, rating: 4.7 },
  { id: "crypto", title: "Crypto CFDs, 24/7", summary: "Weekend gaps, funding, correlation to NAS100 and on-chain signals.", level: "Intermediate", lessons: 8, minutes: 61, progress: 0, image: "/assets/photos/bitcoin.jpg", instructor: 22, students: 7340, rating: 4.6 },
  { id: "indices", title: "Index trading around US data", summary: "NFP, CPI and FOMC playbooks for NAS100 and US30.", level: "Advanced", lessons: 11, minutes: 104, progress: 0, image: "/assets/photos/nyc.jpg", instructor: 19, students: 5210, rating: 4.8, tag: "New" },
  { id: "psych", title: "Trading psychology", summary: "Tilt, revenge trading, journaling and building a repeatable process.", level: "Beginner", lessons: 7, minutes: 48, progress: 15, image: "/assets/photos/trader.jpg", instructor: 6, students: 16100, rating: 4.9 },
  { id: "algo", title: "Algo trading with the Ezymex API", summary: "REST + WebSocket, backtesting, and deploying a strategy safely.", level: "Advanced", lessons: 16, minutes: 172, progress: 0, image: "/assets/photos/dashboard.jpg", instructor: 13, students: 3480, rating: 4.7 },
  { id: "prop", title: "Passing a prop challenge", summary: "Daily loss limits, consistency rules and a 30-day plan to get funded.", level: "Advanced", lessons: 9, minutes: 83, progress: 0, image: "/assets/photos/skyscrapers.jpg", instructor: 1, students: 8870, rating: 4.8 },
];

export const CONTINUE_LEARNING = {
  courseId: "risk",
  lesson: 6,
  lessonTitle: "Sizing positions with ATR-based stops",
  remainingMin: 9,
};

export const LEARNING_PATHS = [
  {
    id: "new",
    title: "New trader path",
    subtitle: "From first trade to a consistent routine",
    steps: ["Forex foundations", "Risk management", "Trading psychology", "Demo challenge"],
    current: 2,
    icon: "books",
    weeks: 4,
  },
  {
    id: "funded",
    title: "Get funded path",
    subtitle: "Structure, risk and prop rules",
    steps: ["Price action", "Risk management", "Passing a prop challenge", "$25k evaluation"],
    current: 1,
    icon: "rocket",
    weeks: 6,
  },
  {
    id: "macro",
    title: "Macro & indices path",
    subtitle: "Trade the data, not the noise",
    steps: ["Trading gold", "Index trading around US data", "Economic calendar mastery", "Live NFP session"],
    current: 0,
    icon: "globe_with_meridians",
    weeks: 5,
  },
] as const;

/* ------------------------------------------------------------------ */
/* Glossary                                                            */
/* ------------------------------------------------------------------ */

export const GLOSSARY: { term: string; def: string; cat: string }[] = [
  { term: "Pip", def: "The standard price increment of a currency pair — 0.0001 for most pairs, 0.01 for JPY pairs. On 1 lot EURUSD, one pip is worth $10.", cat: "Basics" },
  { term: "Pipette", def: "A fractional pip (the 5th decimal on EURUSD). Ezymex quotes show it as the small trailing digit.", cat: "Basics" },
  { term: "Lot", def: "A standard trade size: 1 lot = 100,000 units of the base currency, 100 oz of gold, or 1 BTC on BTCUSD.", cat: "Basics" },
  { term: "Leverage", def: "Borrowed exposure relative to your margin. At 1:100, $1,000 of margin controls a $100,000 position.", cat: "Margin" },
  { term: "Margin", def: "The collateral locked to keep a position open. Required margin = position value ÷ leverage.", cat: "Margin" },
  { term: "Margin level", def: "Equity ÷ used margin × 100%. Below 100% you can't open new trades; at the stop-out level (e.g. 50%) positions close automatically.", cat: "Margin" },
  { term: "Free margin", def: "Equity minus used margin — what's available to open new positions or absorb floating losses.", cat: "Margin" },
  { term: "Stop out", def: "The margin level at which the server starts closing your largest losing position to protect the account from going negative.", cat: "Margin" },
  { term: "Swap", def: "Overnight financing charged or paid when a position is held past 00:00 server time. Triple swap applies on Wednesday for FX.", cat: "Costs" },
  { term: "Spread", def: "The difference between bid and ask. It's the main trading cost on Standard accounts; Pro and ECN run raw spreads plus commission.", cat: "Costs" },
  { term: "Commission", def: "A fixed fee per lot charged on ECN-style accounts, e.g. $3.50 per side per lot.", cat: "Costs" },
  { term: "Slippage", def: "The difference between the price you requested and the price you were filled at, common during news or thin liquidity.", cat: "Execution" },
  { term: "Limit order", def: "An order to buy below or sell above the current price. Fills only at your price or better.", cat: "Execution" },
  { term: "Stop loss", def: "A pending instruction to close a position at a predefined loss level. Your single most important risk tool.", cat: "Risk" },
  { term: "Drawdown", def: "The peak-to-trough decline in equity, usually as a %. Prop challenges typically cap daily drawdown at 5% and max at 10%.", cat: "Risk" },
  { term: "Risk-reward ratio", def: "Potential profit ÷ potential loss of a trade. A 1:2 R:R lets you stay profitable with a win rate as low as 34%.", cat: "Risk" },
  { term: "Hedging", def: "Holding opposite positions on the same symbol. Allowed on Hedging accounts; Netting accounts combine them into one net position.", cat: "Accounts" },
  { term: "Equity", def: "Balance plus floating profit or loss of open positions — the real-time value of your account.", cat: "Accounts" },
  { term: "Volatility", def: "How much and how fast price moves. Often measured with ATR; higher volatility means wider stops and smaller size.", cat: "Analysis" },
  { term: "Liquidity", def: "How easily a market can be traded without moving price. FX majors are most liquid during the London–New York overlap.", cat: "Analysis" },
  { term: "Support & resistance", def: "Price zones where buying or selling pressure has repeatedly appeared, often used for entries and stop placement.", cat: "Analysis" },
  { term: "Gap", def: "A jump between one candle's close and the next open, common at the weekly open and after major news.", cat: "Analysis" },
];

/* ------------------------------------------------------------------ */
/* Quiz                                                                */
/* ------------------------------------------------------------------ */

export const QUIZ = [
  {
    q: "Your account equity is $2,400 and used margin is $1,600. What is your margin level?",
    options: ["66%", "150%", "240%", "33%"],
    answer: 1,
    explain: "Margin level = equity ÷ used margin × 100 = 2,400 ÷ 1,600 × 100 = 150%.",
  },
  {
    q: "You buy 0.5 lot EURUSD. Price moves up 20 pips. Roughly what's your profit?",
    options: ["$10", "$50", "$100", "$200"],
    answer: 2,
    explain: "One pip on 1 lot EURUSD ≈ $10, so on 0.5 lot ≈ $5. 20 pips × $5 = $100.",
  },
  {
    q: "Which day of the week usually carries a triple swap on FX pairs?",
    options: ["Monday", "Wednesday", "Friday", "Sunday"],
    answer: 1,
    explain: "Wednesday's rollover covers the weekend settlement (T+2), so it's charged 3×.",
  },
];

/* ------------------------------------------------------------------ */
/* AI Coach analytics (derived from HISTORY)                           */
/* ------------------------------------------------------------------ */

const GMT3 = 3 * 3600 * 1000;
const localDate = (iso: string) => new Date(Date.parse(iso) + GMT3);

function summarise(trades: ClosedTrade[]) {
  const wins = trades.filter((t) => t.profit > 0);
  const losses = trades.filter((t) => t.profit <= 0);
  const net = trades.reduce((s, t) => s + t.profit, 0);
  const grossW = wins.reduce((s, t) => s + t.profit, 0);
  const grossL = Math.abs(losses.reduce((s, t) => s + t.profit, 0));
  return {
    count: trades.length,
    wins: wins.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    net: +net.toFixed(2),
    avgWin: wins.length ? grossW / wins.length : 0,
    avgLoss: losses.length ? grossL / losses.length : 0,
    profitFactor: grossL ? grossW / grossL : 0,
    lots: +trades.reduce((s, t) => s + t.volume, 0).toFixed(2),
  };
}

const NOW = Date.parse("2026-09-24T16:00:00Z");
const WEEK = HISTORY.filter((t) => Date.parse(t.closeTime) > NOW - 7 * 86400 * 1000);
const PREV_WEEK = HISTORY.filter((t) => {
  const c = Date.parse(t.closeTime);
  return c <= NOW - 7 * 86400 * 1000 && c > NOW - 14 * 86400 * 1000;
});

const bySymbol = (() => {
  const m = new Map<string, { symbol: string; net: number; count: number; wins: number }>();
  for (const t of HISTORY) {
    const e = m.get(t.symbol) ?? { symbol: t.symbol, net: 0, count: 0, wins: 0 };
    e.net += t.profit;
    e.count++;
    if (t.profit > 0) e.wins++;
    m.set(t.symbol, e);
  }
  return [...m.values()].map((e) => ({ ...e, net: +e.net.toFixed(2), winRate: (e.wins / e.count) * 100 })).sort((a, b) => b.net - a.net);
})();

export const SESSIONS = ["Asia", "London", "New York"] as const;
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

function sessionOf(iso: string): (typeof SESSIONS)[number] {
  const h = localDate(iso).getUTCHours();
  if (h >= 10 && h < 16) return "London";
  if (h >= 16 && h < 24) return "New York";
  return "Asia";
}

const heat = (() => {
  const grid = SESSIONS.map((s) => WEEKDAYS.map((d) => ({ session: s, day: d, net: 0, count: 0 })));
  for (const t of HISTORY) {
    const d = localDate(t.openTime).getUTCDay(); // 0 Sun
    if (d === 0 || d === 6) continue;
    const si = SESSIONS.indexOf(sessionOf(t.openTime));
    const cell = grid[si]![d - 1]!;
    cell.net += t.profit;
    cell.count++;
  }
  return grid.map((row) => row.map((c) => ({ ...c, net: +c.net.toFixed(2) })));
})();

const riskBuckets = (() => {
  const BAL = 22795;
  const buckets = [
    { label: "<0.5%", max: 0.5, count: 0 },
    { label: "0.5–1%", max: 1, count: 0 },
    { label: "1–2%", max: 2, count: 0 },
    { label: "2–3%", max: 3, count: 0 },
    { label: ">3%", max: Infinity, count: 0 },
  ];
  for (const t of HISTORY) {
    // Risk proxy: typical adverse excursion ~ size-driven exposure
    const pct = (Math.abs(t.profit) * 1.1 + t.volume * 60) / BAL * 100;
    buckets.find((b) => pct < b.max)!.count++;
  }
  return buckets.map(({ label, count }) => ({ label, count }));
})();

const overtrading = (() => {
  const days = new Map<string, { date: string; count: number; net: number; worst: number }>();
  for (const t of HISTORY) {
    const k = localDate(t.closeTime).toISOString().slice(0, 10);
    const e = days.get(k) ?? { date: k, count: 0, net: 0, worst: 0 };
    e.count++;
    e.net += t.profit;
    e.worst = Math.min(e.worst, t.profit);
    days.set(k, e);
  }
  const arr = [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  const avg = arr.reduce((s, d) => s + d.count, 0) / arr.length;
  const flagged = arr.map((d, i) => ({ ...d, net: +d.net.toFixed(2), afterLoss: i > 0 && arr[i - 1]!.worst < -60 && d.count > avg }));
  return { days: flagged, avg: +avg.toFixed(1) };
})();

export const COACH = {
  week: summarise(WEEK),
  prevWeek: summarise(PREV_WEEK),
  allTime: summarise(HISTORY),
  weekBest: [...WEEK].sort((a, b) => b.profit - a.profit)[0] ?? HISTORY[0]!,
  weekWorst: [...WEEK].sort((a, b) => a.profit - b.profit)[0] ?? HISTORY[1]!,
  bySymbol,
  heat,
  riskBuckets,
  overtrading,
  sessionNet: SESSIONS.map((s) => ({ session: s, net: +HISTORY.filter((t) => sessionOf(t.openTime) === s).reduce((a, t) => a + t.profit, 0).toFixed(2) })),
};

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

export type Mood = "confident" | "calm" | "anxious" | "frustrated" | "excited";

export interface JournalNote {
  id: string;
  date: string;
  title: string;
  body: string;
  tags: string[];
  mood: Mood;
  symbol?: string;
  pnl?: number;
}

export const JOURNAL: JournalNote[] = [
  { id: "j1", date: "2026-09-24T11:20:00Z", title: "Waited for London open to settle", body: "Skipped the first 30 min on EURUSD like the coach suggested. Entry at the retest was cleaner and I held to TP.", tags: ["patience", "london"], mood: "calm", symbol: "EURUSD", pnl: 184.2 },
  { id: "j2", date: "2026-09-23T17:45:00Z", title: "Revenge trade on NAS100 after CPI", body: "Got stopped on the spike, then doubled size on the re-entry. Broke my 1% rule — need a 20 min cooldown after a loss.", tags: ["revenge", "news", "rule-break"], mood: "frustrated", symbol: "NAS100", pnl: -412.6 },
  { id: "j3", date: "2026-09-22T09:10:00Z", title: "Gold long from Asian range low", body: "Planned the trade the night before. Partial at 1R, trailed the rest under structure.", tags: ["plan", "gold"], mood: "confident", symbol: "XAUUSD", pnl: 612.4 },
  { id: "j4", date: "2026-09-19T20:30:00Z", title: "Tired Friday session", body: "Took 6 trades after 22:00 with no real setup. Friday NY close is not my edge.", tags: ["overtrading", "fatigue"], mood: "anxious", symbol: "GBPJPY", pnl: -148.3 },
];
