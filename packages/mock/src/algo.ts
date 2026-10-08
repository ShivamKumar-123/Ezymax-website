/**
 * Strategy builder + backtest mocks (Client Area › API & Algo).
 * Everything is deterministic from a seed so SSR and client renders match.
 */
import { seeded, hashString } from "./rng";
import { INSTRUMENTS, getInstrument } from "./symbols";

/* ------------------------------------------------------------------ */
/* Rule model                                                          */
/* ------------------------------------------------------------------ */

export type Timeframe = "M1" | "M5" | "M15" | "M30" | "H1" | "H4" | "D1";
export const TIMEFRAMES: Timeframe[] = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"];

export type IndicatorKind =
  | "ema"
  | "sma"
  | "rsi"
  | "atr"
  | "macd"
  | "price"
  | "bb_upper"
  | "bb_lower"
  | "asian_high"
  | "asian_low"
  | "prev_high"
  | "prev_low"
  | "value";

export interface IndicatorDef {
  kind: IndicatorKind;
  label: string;
  group: "Trend" | "Momentum" | "Volatility" | "Price levels" | "Constant";
  period?: number; // default period, undefined = no period
  hint: string;
}

export const INDICATORS: IndicatorDef[] = [
  { kind: "ema", label: "EMA", group: "Trend", period: 20, hint: "Exponential moving average" },
  { kind: "sma", label: "SMA", group: "Trend", period: 50, hint: "Simple moving average" },
  { kind: "rsi", label: "RSI", group: "Momentum", period: 14, hint: "Relative strength index" },
  { kind: "macd", label: "MACD hist", group: "Momentum", hint: "MACD 12/26/9 histogram" },
  { kind: "atr", label: "ATR", group: "Volatility", period: 14, hint: "Average true range" },
  { kind: "bb_upper", label: "BB upper", group: "Volatility", period: 20, hint: "Bollinger upper band, 2σ" },
  { kind: "bb_lower", label: "BB lower", group: "Volatility", period: 20, hint: "Bollinger lower band, 2σ" },
  { kind: "price", label: "Close", group: "Price levels", hint: "Bar close price" },
  { kind: "asian_high", label: "Asian high", group: "Price levels", hint: "00:00–08:00 GMT+3 range high" },
  { kind: "asian_low", label: "Asian low", group: "Price levels", hint: "00:00–08:00 GMT+3 range low" },
  { kind: "prev_high", label: "Prev day high", group: "Price levels", hint: "Previous D1 high" },
  { kind: "prev_low", label: "Prev day low", group: "Price levels", hint: "Previous D1 low" },
  { kind: "value", label: "Value", group: "Constant", hint: "A fixed number" },
];
export const INDICATOR_MAP = Object.fromEntries(INDICATORS.map((i) => [i.kind, i])) as Record<IndicatorKind, IndicatorDef>;

export interface Operand {
  kind: IndicatorKind;
  period?: number;
  value?: number;
}

export type Comparator = "crosses_above" | "crosses_below" | ">" | "<" | ">=" | "<=";
export const COMPARATORS: { value: Comparator; label: string }[] = [
  { value: "crosses_above", label: "crosses above" },
  { value: "crosses_below", label: "crosses below" },
  { value: ">", label: ">" },
  { value: "<", label: "<" },
  { value: ">=", label: "≥" },
  { value: "<=", label: "≤" },
];

export interface Condition {
  id: string;
  left: Operand;
  op: Comparator;
  right: Operand;
}

export type Session = "any" | "asia" | "london" | "newyork" | "overlap";
export const SESSIONS: { value: Session; label: string; hours: string }[] = [
  { value: "any", label: "Any session", hours: "24h" },
  { value: "asia", label: "Asia", hours: "02:00–10:00" },
  { value: "london", label: "London", hours: "10:00–18:00" },
  { value: "newyork", label: "New York", hours: "15:00–23:00" },
  { value: "overlap", label: "LDN/NY overlap", hours: "15:00–18:00" },
];

export interface StrategyRules {
  name: string;
  symbol: string;
  timeframe: Timeframe;
  session: Session;
  /** conditions[0] is the trigger; the rest are filters */
  conditions: Condition[];
  join: "and" | "or";
  side: "buy" | "sell";
  sizing: { mode: "lots" | "risk"; value: number };
  sl: { mode: "atr" | "pips"; value: number };
  tp: { mode: "atr" | "pips" | "rr"; value: number };
  trailing: boolean;
}

const op = (kind: IndicatorKind, period?: number): Operand => ({ kind, period: period ?? INDICATOR_MAP[kind].period });
const val = (value: number): Operand => ({ kind: "value", value });

export function operandLabel(o: Operand) {
  if (o.kind === "value") return String(o.value ?? 0);
  const d = INDICATOR_MAP[o.kind];
  return d.period !== undefined ? `${d.label}(${o.period ?? d.period})` : d.label;
}

export function operandCode(o: Operand): string {
  const p = o.period ?? INDICATOR_MAP[o.kind].period;
  switch (o.kind) {
    case "ema":
    case "sma":
    case "rsi":
    case "atr":
      return `${o.kind}(${p})`;
    case "macd":
      return "macd(12, 26, 9).hist";
    case "price":
      return "close";
    case "bb_upper":
      return `bbands(${p}).upper`;
    case "bb_lower":
      return `bbands(${p}).lower`;
    case "asian_high":
      return 'session("asia").high';
    case "asian_low":
      return 'session("asia").low';
    case "prev_high":
      return "prev_day.high";
    case "prev_low":
      return "prev_day.low";
    case "value":
      return String(o.value ?? 0);
  }
}

export function conditionCode(c: Condition) {
  const l = operandCode(c.left);
  const r = operandCode(c.right);
  if (c.op === "crosses_above" || c.op === "crosses_below") return `${l}.${c.op}(${r})`;
  return `${l} ${c.op} ${r}`;
}

export function conditionText(c: Condition) {
  const cmp = COMPARATORS.find((x) => x.value === c.op)!.label;
  return `${operandLabel(c.left)} ${cmp} ${operandLabel(c.right)}`;
}

const num = (v: number) => (Number.isInteger(v) ? String(v) : String(+v.toFixed(2)));

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || "strategy"
  );
}

/** Python-like Ezymex Strategy DSL generated from the visual rules. */
export function generateCode(r: StrategyRules): string {
  const lines: string[] = [];
  lines.push("# Generated by Ezymex Strategy Builder · DSL v2.4");
  lines.push("# Runs server-side 24/7 · M1 tick engine · GMT+3");
  lines.push(`strategy "${r.name}":`);
  lines.push(`    symbol    = ${r.symbol}`);
  lines.push(`    timeframe = ${r.timeframe}`);
  if (r.session !== "any") lines.push(`    session   = "${r.session}"`);
  lines.push("");
  const conds = r.conditions.map(conditionCode);
  if (conds.length <= 2) {
    lines.push(`    when ${conds.join(` ${r.join} `)}:`);
  } else {
    lines.push(`    when ${r.join === "and" ? "all" : "any"}(`);
    conds.forEach((c) => lines.push(`        ${c},`));
    lines.push("    ):");
  }
  const size = r.sizing.mode === "lots" ? `lots=${num(r.sizing.value)}` : `risk_pct=${num(r.sizing.value)}`;
  const sl = r.sl.mode === "atr" ? `sl=${num(r.sl.value)} * atr(14)` : `sl=pips(${num(r.sl.value)})`;
  const tp = r.tp.mode === "atr" ? `tp=${num(r.tp.value)} * atr(14)` : r.tp.mode === "pips" ? `tp=pips(${num(r.tp.value)})` : `tp=rr(${num(r.tp.value)})`;
  lines.push(`        ${r.side}(${size}, ${sl}, ${tp})`);
  if (r.trailing) lines.push("        trail(stop=1 * atr(14), start=rr(1))");
  return lines.join("\n");
}

/** Very small "compiler" used by the Validate button on hand-edited code. */
export function validateCode(code: string): { ok: boolean; line?: number; message: string } {
  const lines = code.split("\n");
  const find = (re: RegExp) => lines.findIndex((l) => re.test(l));
  if (find(/^\s*strategy\s+"[^"]+"\s*:\s*$/) < 0) return { ok: false, line: 1, message: 'Missing `strategy "name":` header' };
  if (find(/^\s*symbol\s*=\s*[A-Z0-9]+\s*$/) < 0) return { ok: false, line: 4, message: "`symbol` is not set" };
  const w = find(/^\s*when\b/);
  if (w < 0) return { ok: false, line: 6, message: "No `when` entry condition found" };
  if (find(/^\s*(buy|sell)\s*\(/) < 0) return { ok: false, line: w + 2, message: "Entry block needs a buy(...) or sell(...) call" };
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    for (const ch of lines[i]!) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
    }
    if (depth < 0) return { ok: false, line: i + 1, message: "Unexpected `)`" };
  }
  if (depth !== 0) return { ok: false, line: lines.length, message: "Unclosed `(`" };
  return { ok: true, message: "Compiled OK · 0 warnings" };
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

export interface StrategyProfile {
  winRate: number; // 0..1
  rr: number; // avg win / avg loss
  perDay: number; // trades per day on the template timeframe
}

export interface StrategyTemplate {
  id: string;
  name: string;
  short: string;
  description: string;
  icon: string; // Icon3D name
  tags: string[];
  profile: StrategyProfile;
  rules: StrategyRules;
}

export const TEMPLATES: StrategyTemplate[] = [
  {
    id: "ma-cross",
    name: "MA Cross",
    short: "Trend following",
    description: "Fast EMA crosses the slow EMA, filtered by RSI so you don't buy the top.",
    icon: "chart_increasing",
    tags: ["Trend", "Beginner"],
    profile: { winRate: 0.58, rr: 0.84, perDay: 1.1 },
    rules: {
      name: "Gold EMA cross",
      symbol: "XAUUSD",
      timeframe: "M15",
      session: "any",
      conditions: [
        { id: "c1", left: op("ema", 20), op: "crosses_above", right: op("ema", 50) },
        { id: "c2", left: op("rsi", 14), op: "<", right: val(70) },
      ],
      join: "and",
      side: "buy",
      sizing: { mode: "lots", value: 0.5 },
      sl: { mode: "atr", value: 1.5 },
      tp: { mode: "atr", value: 3 },
      trailing: false,
    },
  },
  {
    id: "rsi-reversal",
    name: "RSI Reversal",
    short: "Mean reversion",
    description: "Buys oversold dips back above 30 while price holds the 200 SMA.",
    icon: "chart_decreasing",
    tags: ["Mean reversion"],
    profile: { winRate: 0.64, rr: 0.66, perDay: 0.7 },
    rules: {
      name: "EURUSD RSI snapback",
      symbol: "EURUSD",
      timeframe: "H1",
      session: "any",
      conditions: [
        { id: "c1", left: op("rsi", 14), op: "crosses_above", right: val(30) },
        { id: "c2", left: op("price"), op: ">", right: op("sma", 200) },
      ],
      join: "and",
      side: "buy",
      sizing: { mode: "risk", value: 1 },
      sl: { mode: "pips", value: 25 },
      tp: { mode: "rr", value: 2 },
      trailing: false,
    },
  },
  {
    id: "breakout",
    name: "Breakout",
    short: "Asian range",
    description: "Trades the London break of the overnight Asian range with volatility filter.",
    icon: "rocket",
    tags: ["Breakout", "Session"],
    profile: { winRate: 0.47, rr: 1.2, perDay: 0.45 },
    rules: {
      name: "EURUSD Asian breakout",
      symbol: "EURUSD",
      timeframe: "M15",
      session: "london",
      conditions: [
        { id: "c1", left: op("price"), op: "crosses_above", right: op("asian_high") },
        { id: "c2", left: op("atr", 14), op: ">", right: val(0.0006) },
      ],
      join: "and",
      side: "buy",
      sizing: { mode: "risk", value: 1 },
      sl: { mode: "atr", value: 1 },
      tp: { mode: "rr", value: 2 },
      trailing: true,
    },
  },
  {
    id: "grid",
    name: "Grid",
    short: "Range harvesting",
    description: "Layers small buys at the lower Bollinger band in quiet, ranging markets.",
    icon: "bar_chart",
    tags: ["Grid", "Advanced"],
    profile: { winRate: 0.78, rr: 0.4, perDay: 2.2 },
    rules: {
      name: "AUDUSD band grid",
      symbol: "AUDUSD",
      timeframe: "H1",
      session: "asia",
      conditions: [
        { id: "c1", left: op("price"), op: "crosses_below", right: op("bb_lower", 20) },
        { id: "c2", left: op("rsi", 14), op: "<", right: val(35) },
        { id: "c3", left: op("atr", 14), op: "<", right: val(0.0012) },
      ],
      join: "and",
      side: "buy",
      sizing: { mode: "lots", value: 0.1 },
      sl: { mode: "pips", value: 60 },
      tp: { mode: "pips", value: 20 },
      trailing: false,
    },
  },
  {
    id: "london-open",
    name: "London Open",
    short: "Momentum scalp",
    description: "Rides the first impulse of the London open when short EMAs align.",
    icon: "globe_with_meridians",
    tags: ["Scalping", "Session"],
    profile: { winRate: 0.54, rr: 0.93, perDay: 1.6 },
    rules: {
      name: "Cable London open",
      symbol: "GBPUSD",
      timeframe: "M5",
      session: "london",
      conditions: [
        { id: "c1", left: op("price"), op: "crosses_above", right: op("prev_high") },
        { id: "c2", left: op("ema", 9), op: ">", right: op("ema", 21) },
        { id: "c3", left: op("macd"), op: ">", right: val(0) },
      ],
      join: "and",
      side: "buy",
      sizing: { mode: "lots", value: 0.3 },
      sl: { mode: "atr", value: 1 },
      tp: { mode: "atr", value: 2 },
      trailing: true,
    },
  },
];

export function cloneRules(r: StrategyRules): StrategyRules {
  return JSON.parse(JSON.stringify(r)) as StrategyRules;
}

/* ------------------------------------------------------------------ */
/* My strategies + live signals                                        */
/* ------------------------------------------------------------------ */

export interface MyStrategy {
  id: string;
  name: string;
  status: "running" | "paused";
  login: string;
  server: string;
  templateId: string;
  pnlToday: number;
  pnlTotal: number;
  trades: number;
  uptime: string;
  spark: number[];
  rules: StrategyRules;
}

function spark(seed: number, n: number, drift: number) {
  const r = seeded(seed);
  let v = 100;
  return Array.from({ length: n }, () => (v += drift + r.normal() * 1.4));
}

const withName = (id: string, patch: Partial<StrategyRules>): StrategyRules => ({ ...cloneRules(TEMPLATES.find((t) => t.id === id)!.rules), ...patch });

export const MY_STRATEGIES: MyStrategy[] = [
  { id: "s-gold-ema", name: "Gold EMA cross", status: "running", login: "80412337", server: "Ezymex-Live01", templateId: "ma-cross", pnlToday: 412.6, pnlTotal: 6284.2, trades: 214, uptime: "18d 04h", spark: spark(11, 28, 0.6), rules: withName("ma-cross", {}) },
  { id: "s-eu-break", name: "EU London breakout", status: "running", login: "90022871", server: "Ezymex-Demo", templateId: "breakout", pnlToday: -86.4, pnlTotal: 2140.75, trades: 96, uptime: "6d 11h", spark: spark(23, 28, 0.35), rules: withName("breakout", { name: "EU London breakout" }) },
  { id: "s-cable", name: "Cable momentum", status: "paused", login: "80412512", server: "Ezymex-Live01", templateId: "london-open", pnlToday: 0, pnlTotal: 918.3, trades: 142, uptime: "—", spark: spark(37, 28, 0.15), rules: withName("london-open", { name: "Cable momentum" }) },
  { id: "s-aud-grid", name: "Aussie band grid", status: "paused", login: "90022904", server: "Ezymex-Demo", templateId: "grid", pnlToday: 0, pnlTotal: -312.9, trades: 388, uptime: "—", spark: spark(41, 28, -0.2), rules: withName("grid", { name: "Aussie band grid" }) },
];

export interface LiveSignal {
  id: string;
  time: string; // HH:MM:SS server time
  strategy: string;
  symbol: string;
  side: "buy" | "sell";
  price: number;
  lots: number;
  status: "filled" | "closed" | "skipped";
  note: string;
}

export const LIVE_SIGNALS: LiveSignal[] = [
  { id: "g1", time: "14:32:08", strategy: "Gold EMA cross", symbol: "XAUUSD", side: "buy", price: 2651.84, lots: 0.5, status: "filled", note: "EMA20 ↑ EMA50 · RSI 58.2" },
  { id: "g2", time: "13:47:51", strategy: "EU London breakout", symbol: "EURUSD", side: "sell", price: 1.08391, lots: 0.8, status: "closed", note: "SL hit · −10.8 pips" },
  { id: "g3", time: "11:15:02", strategy: "Gold EMA cross", symbol: "XAUUSD", side: "buy", price: 2644.1, lots: 0.5, status: "closed", note: "TP hit · +$412.60" },
  { id: "g4", time: "10:00:14", strategy: "EU London breakout", symbol: "EURUSD", side: "buy", price: 1.08512, lots: 0.8, status: "skipped", note: "Max positions reached" },
  { id: "g5", time: "09:41:37", strategy: "Gold EMA cross", symbol: "XAUUSD", side: "buy", price: 2639.55, lots: 0.5, status: "skipped", note: "RSI 72.4 ≥ 70 filter" },
];

/* ------------------------------------------------------------------ */
/* AI assistant (Claude) — natural language → rules                    */
/* ------------------------------------------------------------------ */

export const AI_SUGGESTIONS = [
  "Buy EURUSD on London open breakout of Asian range with 1% risk",
  "Sell gold when RSI crosses below 70 on H1, 2R target",
  "Trend-follow NAS100 with EMA 20/50 cross on M15",
  "Grid AUDUSD in quiet Asian session, 0.1 lots",
];

const SYMBOL_WORDS: [RegExp, string][] = [
  [/\bgold\b/, "XAUUSD"],
  [/\bsilver\b/, "XAGUSD"],
  [/\b(bitcoin|btc)\b/, "BTCUSD"],
  [/\b(ethereum|eth)\b/, "ETHUSD"],
  [/\bnasdaq\b/, "NAS100"],
  [/\b(dow)\b/, "US30"],
  [/\b(s&p|spx)\b/, "SPX500"],
  [/\b(dax)\b/, "GER40"],
  [/\bcable\b/, "GBPUSD"],
  [/\b(fiber|euro)\b/, "EURUSD"],
  [/\b(yen)\b/, "USDJPY"],
  [/\b(aussie)\b/, "AUDUSD"],
  [/\b(oil|wti)\b/, "USOIL"],
];

export interface AiDraft {
  templateId: string;
  rules: StrategyRules;
  reply: string;
}

export function aiDraft(prompt: string): AiDraft {
  const q = prompt.toLowerCase();
  const up = prompt.toUpperCase();
  const templateId = /grid/.test(q)
    ? "grid"
    : /breakout|asian|range/.test(q)
      ? "breakout"
      : /rsi|oversold|overbought|reversal|revert|mean/.test(q)
        ? "rsi-reversal"
        : /london|open|scalp|momentum/.test(q)
          ? "london-open"
          : "ma-cross";
  const tpl = TEMPLATES.find((t) => t.id === templateId)!;
  const r = cloneRules(tpl.rules);

  let symbol = INSTRUMENTS.find((i) => new RegExp(`\\b${i.symbol}\\b`).test(up))?.symbol;
  if (!symbol) symbol = SYMBOL_WORDS.find(([re]) => re.test(q))?.[1];
  if (symbol) r.symbol = symbol;

  const tf = q.match(/\b(m1|m5|m15|m30|h1|h4|d1)\b/);
  if (tf) r.timeframe = tf[1]!.toUpperCase() as Timeframe;
  else if (/hourly|1h\b/.test(q)) r.timeframe = "H1";
  else if (/4h\b|4 hour/.test(q)) r.timeframe = "H4";
  else if (/15 ?min/.test(q)) r.timeframe = "M15";

  if (/\b(sell|short)\b/.test(q)) {
    r.side = "sell";
    // mirror every condition for shorts
    const flip: Record<Comparator, Comparator> = { crosses_above: "crosses_below", crosses_below: "crosses_above", ">": "<", "<": ">", ">=": "<=", "<=": ">=" };
    const mirrorLevel = (o: Operand): Operand =>
      o.kind === "asian_high" ? { kind: "asian_low" } : o.kind === "asian_low" ? { kind: "asian_high" } : o.kind === "prev_high" ? { kind: "prev_low" } : o.kind === "prev_low" ? { kind: "prev_high" } : o.kind === "bb_lower" ? { ...o, kind: "bb_upper" } : o.kind === "bb_upper" ? { ...o, kind: "bb_lower" } : o;
    for (const c of r.conditions) {
      if (c.left.kind === "atr") continue; // volatility filters are direction-neutral
      c.op = flip[c.op];
      c.right = mirrorLevel(c.right);
      if (c.left.kind === "rsi" && c.right.kind === "value") c.right = { kind: "value", value: 100 - (c.right.value ?? 50) };
    }
  }
  if (/\b(london)\b/.test(q)) r.session = "london";
  else if (/new york|\bny\b/.test(q)) r.session = "newyork";
  else if (/\basia(n)? session\b/.test(q)) r.session = "asia";

  const ema = q.match(/ema\s*(\d+)\s*\/\s*(\d+)/);
  if (ema && r.conditions[0]!.left.kind === "ema") {
    r.conditions[0]!.left.period = +ema[1]!;
    r.conditions[0]!.right.period = +ema[2]!;
  }
  const risk = q.match(/(\d+(?:\.\d+)?)\s*%\s*risk|risk(?:ing)?\s*(\d+(?:\.\d+)?)\s*%/);
  if (risk) r.sizing = { mode: "risk", value: +(risk[1] ?? risk[2])! };
  const lots = q.match(/(\d+(?:\.\d+)?)\s*lots?\b/);
  if (lots) r.sizing = { mode: "lots", value: +lots[1]! };
  const rr = q.match(/(\d(?:\.\d)?)\s*r\b|1\s*:\s*(\d(?:\.\d)?)/);
  if (rr) r.tp = { mode: "rr", value: +(rr[1] ?? rr[2])! };
  const sl = q.match(/(\d+)\s*pips?\s*(?:sl|stop)|stop(?:\s*loss)?\s*(?:of\s*)?(\d+)\s*pips?/);
  if (sl) r.sl = { mode: "pips", value: +(sl[1] ?? sl[2])! };

  const sess = SESSIONS.find((s) => s.value === r.session)!;
  r.name = `${r.symbol} ${tpl.name === "MA Cross" ? "EMA cross" : tpl.name}${r.side === "sell" ? " short" : ""}`;
  const sizeTxt = r.sizing.mode === "risk" ? `${r.sizing.value}% equity risk per trade` : `${r.sizing.value} lots per trade`;
  const slTxt = r.sl.mode === "atr" ? `${r.sl.value}× ATR(14)` : `${r.sl.value} pips`;
  const tpTxt = r.tp.mode === "rr" ? `${r.tp.value}R` : r.tp.mode === "atr" ? `${r.tp.value}× ATR(14)` : `${r.tp.value} pips`;
  const reply = [
    `Mapped this to the ${tpl.name} template on ${r.symbol} ${r.timeframe}.`,
    "",
    `• Trigger: ${conditionText(r.conditions[0]!)}${r.session !== "any" ? ` · ${sess.label} session (${sess.hours})` : ""}`,
    ...r.conditions.slice(1).map((c) => `• Filter: ${conditionText(c)}`),
    `• Entry: ${r.side === "buy" ? "Buy" : "Sell"}, ${sizeTxt}`,
    `• Exits: SL ${slTxt}, TP ${tpTxt}${r.trailing ? ", trailing after 1R" : ""}`,
    "",
    `Loaded ${r.conditions.length + 2} blocks into the builder. Historically this setup wins ~${Math.round(tpl.profile.winRate * 100)}% — run a backtest before going live.`,
  ].join("\n");
  return { templateId, rules: r, reply };
}

/* ------------------------------------------------------------------ */
/* Backtests                                                           */
/* ------------------------------------------------------------------ */

export type CostModel = "raw" | "standard" | "fixed";
export const COST_MODELS: { value: CostModel; label: string; hint: string }[] = [
  { value: "raw", label: "Raw spread + commission", hint: "Pro/ECN · $3.50 per lot per side" },
  { value: "standard", label: "Standard spread", hint: "Standard · no commission, +0.6 pip" },
  { value: "fixed", label: "Fixed 2.0 pip spread", hint: "Stress test · worst case" },
];

export interface BacktestStrategy {
  id: string;
  name: string;
  symbol: string;
  timeframe: Timeframe;
  profile: StrategyProfile;
}

export const BACKTEST_STRATEGIES: BacktestStrategy[] = [
  ...MY_STRATEGIES.map((s) => {
    const t = TEMPLATES.find((x) => x.id === s.templateId)!;
    return { id: s.id, name: s.name, symbol: s.rules.symbol, timeframe: s.rules.timeframe, profile: t.profile };
  }),
  ...TEMPLATES.map((t) => ({ id: t.id, name: `${t.name} (template)`, symbol: t.rules.symbol, timeframe: t.rules.timeframe, profile: t.profile })),
];

export interface BacktestParams {
  strategyId: string;
  symbol: string;
  timeframe: Timeframe;
  from: string; // YYYY-MM-DD
  to: string;
  balance: number;
  costModel: CostModel;
}

export interface BtTrade {
  ticket: string;
  symbol: string;
  side: "buy" | "sell";
  lots: number;
  openTime: number; // unix sec (UTC)
  closeTime: number;
  entry: number;
  exit: number;
  pips: number;
  profit: number;
}

export interface BtPoint {
  time: number;
  value: number;
  volume?: number;
}

export interface MonthlyRow {
  year: number;
  months: (number | null)[];
  ytd: number;
}

export interface BacktestResult {
  params: BacktestParams;
  seed: number;
  bars: number;
  trades: BtTrade[];
  equity: BtPoint[];
  drawdown: BtPoint[]; // % (<= 0)
  monthly: MonthlyRow[];
  distribution: { from: number; to: number; count: number }[];
  kpis: {
    netProfit: number;
    returnPct: number;
    winRate: number;
    profitFactor: number;
    sharpe: number;
    maxDdPct: number;
    maxDdAbs: number;
    trades: number;
    grossProfit: number;
    grossLoss: number;
    avgWin: number;
    avgLoss: number;
    expectancy: number;
    largestWin: number;
    largestLoss: number;
    maxConsecLosses: number;
    maxConsecWins: number;
    avgHoldMin: number;
    recoveryFactor: number;
    longPct: number;
    commission: number;
  };
}

const TF_FREQ: Record<Timeframe, number> = { M1: 3.2, M5: 2, M15: 1.2, M30: 0.9, H1: 0.65, H4: 0.28, D1: 0.09 };
const TF_HOLD: Record<Timeframe, [number, number]> = { M1: [3, 45], M5: [10, 150], M15: [30, 480], M30: [45, 720], H1: [90, 1800], H4: [360, 5400], D1: [1440, 12000] };

export function pipSize(symbol: string) {
  const d = getInstrument(symbol).digits;
  return d >= 4 ? 0.0001 : d === 3 ? 0.01 : d === 2 ? 0.1 : 1;
}

function pipValuePerLot(symbol: string) {
  const inst = getInstrument(symbol);
  const pv = pipSize(symbol) * inst.contractSize;
  return symbol.endsWith("USD") || inst.assetClass !== "forex" ? pv : pv / inst.price;
}

const typicalSlPips = (symbol: string) => {
  const a = getInstrument(symbol).assetClass;
  return a === "metals" ? 90 : a === "indices" ? 45 : a === "crypto" ? 600 : a === "energies" ? 40 : a === "stocks" ? 30 : 22;
};

const DAY = 86400;

export function runBacktest(params: BacktestParams, seed: number): BacktestResult {
  const r = seeded((seed ^ hashString(JSON.stringify(params))) >>> 0);
  const inst = getInstrument(params.symbol);
  const strat = BACKTEST_STRATEGIES.find((s) => s.id === params.strategyId) ?? BACKTEST_STRATEGIES[0]!;
  const prof = strat.profile;
  const start = Date.parse(`${params.from}T00:00:00Z`) / 1000;
  const end = Date.parse(`${params.to}T00:00:00Z`) / 1000;
  const days = Math.max(20, Math.round((end - start) / DAY));
  const perDay = Math.min(6, Math.max(0.06, (prof.perDay * TF_FREQ[params.timeframe]) / TF_FREQ[strat.timeframe]));
  const [hMin, hMax] = TF_HOLD[params.timeframe];
  const costPerLot = params.costModel === "raw" ? 7 : params.costModel === "standard" ? 6 : 20;
  const pv = pipValuePerLot(params.symbol);
  const ps = pipSize(params.symbol);
  const baseSl = typicalSlPips(params.symbol);
  const crypto = inst.assetClass === "crypto";
  const phase = r.range(0, 6);
  const edge = r.range(-0.035, 0.03); // run-to-run variance

  // price path that ends at the current reference price
  const walk: number[] = [0];
  for (let d = 1; d <= days; d++) walk.push(walk[d - 1]! + r.normal() * 0.0065 + 0.0002);
  const last = walk[days]!;
  const priceAt = (d: number) => inst.price * Math.exp(walk[d]! - last);

  let eq = params.balance;
  let peak = eq;
  let ticket = 51_204_000 + r.int(1000, 9000);
  const trades: BtTrade[] = [];
  const equity: BtPoint[] = [];
  const drawdown: BtPoint[] = [];
  let commission = 0;

  for (let d = 0; d <= days; d++) {
    const t0 = start + d * DAY;
    const wd = new Date(t0 * 1000).getUTCDay();
    let dayTrades = 0;
    if (crypto || (wd !== 0 && wd !== 6)) {
      const lam = perDay * (0.6 + r.next() * 0.8);
      const n = Math.floor(lam) + (r.next() < lam - Math.floor(lam) ? 1 : 0);
      const month = Math.floor(d / 30);
      const wr = Math.min(0.9, Math.max(0.2, prof.winRate + edge + 0.12 * Math.sin(month * 0.9 + phase) + 0.05 * Math.sin(d / 9 + phase * 2) + r.normal() * 0.03));
      const opens = Array.from({ length: n }, () => t0 + r.int(1, 22) * 3600 + r.int(0, 59) * 60 + r.int(0, 59)).sort((a, b) => a - b);
      for (const openTime of opens) {
        const riskAmt = eq * r.range(0.004, 0.008);
        const win = r.next() < wr;
        const R = win ? prof.rr * r.range(0.5, 1.5) : -r.range(0.55, 1.05);
        const slPips = baseSl * r.range(0.7, 1.3);
        const lots = Math.max(0.01, +(riskAmt / (slPips * pv)).toFixed(2));
        const cost = lots * costPerLot;
        const gross = riskAmt * R;
        const profit = +(gross - cost).toFixed(2);
        const pips = +(profit / (lots * pv)).toFixed(1);
        const side: "buy" | "sell" = r.next() < 0.58 ? "buy" : "sell";
        const entry = +(priceAt(d) * (1 + r.normal() * 0.0015)).toFixed(inst.digits);
        const exit = +(entry + (side === "buy" ? 1 : -1) * pips * ps).toFixed(inst.digits);
        const hold = r.int(hMin, hMax) * 60;
        commission += cost;
        eq += profit;
        trades.push({ ticket: String(ticket++), symbol: params.symbol, side, lots, openTime, closeTime: openTime + hold, entry, exit, pips, profit });
        dayTrades++;
      }
    }
    peak = Math.max(peak, eq);
    equity.push({ time: t0, value: +eq.toFixed(2), volume: dayTrades });
    drawdown.push({ time: t0, value: +(((eq - peak) / peak) * 100).toFixed(3) });
  }

  // monthly returns
  const monthEnd = new Map<string, number>();
  let prevEq = params.balance;
  const firstYear = new Date(start * 1000).getUTCFullYear();
  const lastYear = new Date((start + days * DAY) * 1000).getUTCFullYear();
  for (const p of equity) {
    const dt = new Date(p.time * 1000);
    monthEnd.set(`${dt.getUTCFullYear()}-${dt.getUTCMonth()}`, p.value);
  }
  const monthly: MonthlyRow[] = [];
  for (let y = firstYear; y <= lastYear; y++) {
    const months: (number | null)[] = [];
    let ytd = 1;
    for (let m = 0; m < 12; m++) {
      const v = monthEnd.get(`${y}-${m}`);
      if (v === undefined) {
        months.push(null);
        continue;
      }
      const ret = (v / prevEq - 1) * 100;
      months.push(+ret.toFixed(2));
      ytd *= 1 + ret / 100;
      prevEq = v;
    }
    monthly.push({ year: y, months, ytd: +((ytd - 1) * 100).toFixed(2) });
  }

  // KPIs
  const wins = trades.filter((t) => t.profit > 0);
  const losses = trades.filter((t) => t.profit <= 0);
  const grossProfit = wins.reduce((s, t) => s + t.profit, 0);
  const grossLoss = -losses.reduce((s, t) => s + t.profit, 0);
  const rets = equity.slice(1).map((p, i) => p.value / equity[i]!.value - 1);
  const mean = rets.reduce((s, v) => s + v, 0) / Math.max(1, rets.length);
  const sd = Math.sqrt(rets.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, rets.length)) || 1;
  const maxDdPct = Math.min(0, ...drawdown.map((p) => p.value));
  let maxDdAbs = 0;
  let pk = params.balance;
  for (const p of equity) {
    pk = Math.max(pk, p.value);
    maxDdAbs = Math.max(maxDdAbs, pk - p.value);
  }
  let cw = 0,
    cl = 0,
    mw = 0,
    ml = 0;
  for (const t of trades) {
    if (t.profit > 0) {
      cw++;
      cl = 0;
    } else {
      cl++;
      cw = 0;
    }
    mw = Math.max(mw, cw);
    ml = Math.max(ml, cl);
  }
  const netProfit = eq - params.balance;

  // distribution
  const profits = trades.map((t) => t.profit);
  const lo = Math.min(...profits, -1);
  const hi = Math.max(...profits, 1);
  const bins = 24;
  const w = (hi - lo) / bins;
  const distribution = Array.from({ length: bins }, (_, i) => ({ from: lo + i * w, to: lo + (i + 1) * w, count: 0 }));
  for (const p of profits) distribution[Math.min(bins - 1, Math.floor((p - lo) / w))]!.count++;

  return {
    params,
    seed,
    bars: Math.round(days * 1440 * (crypto ? 1 : 5 / 7)),
    trades: trades.reverse(),
    equity,
    drawdown,
    monthly,
    distribution,
    kpis: {
      netProfit,
      returnPct: (netProfit / params.balance) * 100,
      winRate: (wins.length / Math.max(1, trades.length)) * 100,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit,
      sharpe: (mean / sd) * Math.sqrt(252),
      maxDdPct,
      maxDdAbs,
      trades: trades.length,
      grossProfit,
      grossLoss,
      avgWin: grossProfit / Math.max(1, wins.length),
      avgLoss: -grossLoss / Math.max(1, losses.length),
      expectancy: netProfit / Math.max(1, trades.length),
      largestWin: Math.max(0, ...profits),
      largestLoss: Math.min(0, ...profits),
      maxConsecLosses: ml,
      maxConsecWins: mw,
      avgHoldMin: trades.reduce((s, t) => s + (t.closeTime - t.openTime), 0) / 60 / Math.max(1, trades.length),
      recoveryFactor: maxDdAbs > 0 ? netProfit / maxDdAbs : 0,
      longPct: (trades.filter((t) => t.side === "buy").length / Math.max(1, trades.length)) * 100,
      commission,
    },
  };
}

export interface PastRun {
  id: string;
  seed: number;
  created: string; // server time label
  duration: string;
  params: BacktestParams;
}

export const DEFAULT_BACKTEST: BacktestParams = {
  strategyId: "s-gold-ema",
  symbol: "XAUUSD",
  timeframe: "M15",
  from: "2024-01-01",
  to: "2026-08-31",
  balance: 10000,
  costModel: "raw",
};

export const PAST_RUNS: PastRun[] = [
  { id: "bt-2291", seed: 7741, created: "24 Sep · 11:42", duration: "2.1s", params: DEFAULT_BACKTEST },
  { id: "bt-2288", seed: 1203, created: "23 Sep · 19:05", duration: "1.6s", params: { ...DEFAULT_BACKTEST, strategyId: "s-eu-break", symbol: "EURUSD", timeframe: "M15", balance: 25000 } },
  { id: "bt-2285", seed: 9920, created: "23 Sep · 16:18", duration: "3.4s", params: { ...DEFAULT_BACKTEST, strategyId: "s-cable", symbol: "GBPUSD", timeframe: "M5", from: "2025-01-01" } },
  { id: "bt-2279", seed: 4410, created: "22 Sep · 09:51", duration: "1.2s", params: { ...DEFAULT_BACKTEST, strategyId: "rsi-reversal", symbol: "EURUSD", timeframe: "H1", costModel: "standard" } },
  { id: "bt-2270", seed: 5832, created: "20 Sep · 22:37", duration: "2.8s", params: { ...DEFAULT_BACKTEST, strategyId: "s-aud-grid", symbol: "AUDUSD", timeframe: "H1", costModel: "fixed", balance: 5000 } },
  { id: "bt-2264", seed: 3317, created: "19 Sep · 14:03", duration: "1.9s", params: { ...DEFAULT_BACKTEST, strategyId: "ma-cross", symbol: "NAS100", timeframe: "M30", from: "2025-03-01", balance: 50000 } },
];

/** Monte Carlo reshuffle of trade order → robustness percentiles. */
export function monteCarlo(res: BacktestResult, sims = 400) {
  const r = seeded(res.seed ^ 0x9e3779b9);
  const pnl = res.trades.map((t) => t.profit);
  const bal = res.params.balance;
  const dds: number[] = [];
  const finals: number[] = [];
  const curves: number[][] = [];
  for (let s = 0; s < sims; s++) {
    const a = pnl.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r.next() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    let eq = bal;
    let pk = bal;
    let dd = 0;
    const curve: number[] = [];
    a.forEach((p, i) => {
      eq += p * (0.85 + r.next() * 0.3);
      pk = Math.max(pk, eq);
      dd = Math.min(dd, (eq - pk) / pk);
      if (s < 24 && i % Math.max(1, Math.floor(a.length / 40)) === 0) curve.push(eq);
    });
    if (s < 24) curves.push(curve);
    dds.push(dd * 100);
    finals.push(((eq - bal) / bal) * 100);
  }
  const pct = (arr: number[], q: number) => {
    const s = arr.slice().sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
  };
  return {
    sims,
    curves,
    probProfit: (finals.filter((f) => f > 0).length / sims) * 100,
    medianReturn: pct(finals, 0.5),
    p5Return: pct(finals, 0.05),
    p95Return: pct(finals, 0.95),
    medianDd: pct(dds, 0.5),
    worstDd95: pct(dds, 0.05),
    ruin: (dds.filter((d) => d < -30).length / sims) * 100,
  };
}

/* ------------------------------------------------------------------ */
/* Time helpers (server time GMT+3, deterministic, locale-free)        */
/* ------------------------------------------------------------------ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_LABELS = MONTHS;

export function serverTime(unix: number, withTime = true) {
  const d = new Date((unix + 3 * 3600) * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  const date = `${p(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
  return withTime ? `${date} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` : date;
}

export function formatDateLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}
