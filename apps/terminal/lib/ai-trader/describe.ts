/** Human-readable text for strategy parts (card, logs, confirmation). */
import type { Condition, Distance, Operand, Operator, RuleSet, StrategySpec, Trailing } from "./schema";

const IND_LABEL: Record<string, string> = {
  sma: "SMA",
  ema: "EMA",
  rsi: "RSI",
  macd: "MACD",
  macd_signal: "MACD signal",
  macd_hist: "MACD hist",
  bb_upper: "BB upper",
  bb_middle: "BB middle",
  bb_lower: "BB lower",
  atr: "ATR",
  stoch_k: "Stoch %K",
  stoch_d: "Stoch %D",
  highest: "Highest high",
  lowest: "Lowest low",
};
const PATTERN_LABEL: Record<string, string> = {
  bullish: "Bullish candle",
  bearish: "Bearish candle",
  bullish_engulfing: "Bullish engulfing",
  bearish_engulfing: "Bearish engulfing",
  hammer: "Hammer",
  shooting_star: "Shooting star",
  doji: "Doji",
  inside_bar: "Inside bar",
};
export const OP_LABEL: Record<Operator, string> = {
  gt: ">",
  lt: "<",
  gte: "≥",
  lte: "≤",
  crosses_above: "crosses above",
  crosses_below: "crosses below",
};

export function describeOperand(o: Operand): string {
  if (o.kind === "value") return trimNum(o.value);
  if (o.kind === "price") return o.field === "close" ? "Close" : o.field === "hl2" ? "HL/2" : o.field === "hlc3" ? "HLC/3" : o.field[0]!.toUpperCase() + o.field.slice(1);
  if (o.kind === "candle") return PATTERN_LABEL[o.pattern] ?? o.pattern;
  const name = IND_LABEL[o.indicator] ?? o.indicator;
  const src = o.field !== "close" ? `, ${o.field}` : "";
  switch (o.indicator) {
    case "macd":
    case "macd_signal":
    case "macd_hist":
      return `${name}(${o.period},${o.period2},${o.period3})`;
    case "bb_upper":
    case "bb_middle":
    case "bb_lower":
      return `${name}(${o.period},${trimNum(o.mult)}${src})`;
    case "stoch_k":
    case "stoch_d":
      return `${name}(${o.period},${o.period2})`;
    default:
      return `${name}(${o.period}${src})`;
  }
}

export function describeCondition(c: Condition): string {
  const tf = c.timeframe !== "same" ? ` [${c.timeframe}]` : "";
  if (c.left.kind === "candle" && c.right.kind === "value" && (c.op === "gte" || c.op === "gt") && c.right.value <= 1) return `${describeOperand(c.left)}${tf}`;
  return `${describeOperand(c.left)} ${OP_LABEL[c.op]} ${describeOperand(c.right)}${tf}`;
}

export function describeRuleSet(r: RuleSet): string {
  if (!r.groups.length) return "—";
  const parts = r.groups.map((g) => {
    const s = g.conditions.map(describeCondition).join(g.logic === "all" ? " AND " : " OR ");
    return r.groups.length > 1 && g.conditions.length > 1 ? `(${s})` : s;
  });
  return parts.join(r.logic === "all" ? " AND " : " OR ");
}

export function describeDistance(d: Distance, kind: "sl" | "tp"): string {
  switch (d.mode) {
    case "none":
      return "None";
    case "points":
      return `${trimNum(d.value)} points`;
    case "pips":
      return `${trimNum(d.value)} pips`;
    case "price":
      return `${trimNum(d.value)} price units`;
    case "percent":
      return `${trimNum(d.value)}% of entry`;
    case "atr":
      return `${trimNum(d.value)} x ATR(${d.atrPeriod})`;
    case "level":
      return `at ${trimNum(d.value)}`;
    case "rr":
      return kind === "tp" ? `${trimNum(d.value)}R (x stop distance)` : "None";
  }
}

export function describeTrailing(t: Trailing): string {
  const parts: string[] = [];
  if (t.mode === "points") parts.push(`${trimNum(t.value)} points`);
  else if (t.mode === "pips") parts.push(`${trimNum(t.value)} pips`);
  else if (t.mode === "atr") parts.push(`${trimNum(t.value)} x ATR(${t.atrPeriod}) at entry`);
  if (t.breakevenTrigger > 0) parts.push(`breakeven at +${trimNum(t.breakevenTrigger)} pts${t.breakevenOffset ? ` (lock ${trimNum(t.breakevenOffset)} pts)` : ""}`);
  return parts.length ? parts.join(" · ") : "None";
}

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function describeSchedule(s: StrategySpec): string {
  const win = s.sessions.length ? s.sessions.map((w) => `${w.start}–${w.end}`).join(", ") : "All day";
  const days = !s.days.length ? "" : s.days.join(",") === "1,2,3,4,5" ? " · Mon–Fri" : ` · ${s.days.map((d) => DAY[d]).join(" ")}`;
  return `${win}${days} (server time)`;
}

export function describeSide(s: StrategySpec): "Buy" | "Sell" | "Buy & Sell" {
  const l = s.long.groups.length > 0;
  const sh = s.short.groups.length > 0;
  return l && sh ? "Buy & Sell" : sh ? "Sell" : "Buy";
}

export function describeSizing(s: StrategySpec): string {
  return s.sizing.mode === "lots" ? `${s.sizing.lots.toFixed(2)} lot` : `${trimNum(s.sizing.riskPct)}% risk`;
}

export function trimNum(v: number) {
  return Number.isInteger(v) ? String(v) : String(+v.toFixed(6));
}
