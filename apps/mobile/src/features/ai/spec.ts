// Reading a strategy spec on a phone: rules as short human lines ("EMA(20) crosses above EMA(50)"), stops and
// sizes as plain words, the service's validation notes in the reader's language where we know them, backtest
// periods allowed per timeframe (services/algo/src/backtest/jobs.rs max_days) and a stable fingerprint of a spec.
import type { MessageKey, T } from "@/i18n";
import type { Condition, Distance, Operand, RuleSet, StrategySpec, Trailing } from "./api";

/** Default periods the service fills in (services/algo/src/spec.rs ind_defaults). */
const DEFAULTS: Record<string, [number, number, number, number]> = {
  sma: [20, 0, 0, 0],
  ema: [20, 0, 0, 0],
  wma: [20, 0, 0, 0],
  highest: [20, 0, 0, 0],
  lowest: [20, 0, 0, 0],
  cci: [20, 0, 0, 0],
  stddev: [20, 0, 0, 0],
  rsi: [14, 0, 0, 0],
  atr: [14, 0, 0, 0],
  willr: [14, 0, 0, 0],
  momentum: [14, 0, 0, 0],
  roc: [14, 0, 0, 0],
  adx: [14, 14, 0, 0],
  plus_di: [14, 14, 0, 0],
  minus_di: [14, 14, 0, 0],
  macd: [12, 26, 9, 0],
  macd_signal: [12, 26, 9, 0],
  macd_hist: [12, 26, 9, 0],
  bb_upper: [20, 0, 0, 2],
  bb_middle: [20, 0, 0, 2],
  bb_lower: [20, 0, 0, 2],
  stoch_k: [14, 3, 0, 0],
  stoch_d: [14, 3, 0, 0],
};

/** 0.10 -> "0.1", 25 -> "25", 1.5 -> "1.5" (Latin digits, like prices). */
export function num(v: number, max = 5): string {
  if (!Number.isFinite(v)) return "—";
  return String(Number(v.toFixed(max)));
}

const IND_KEYS = new Set(Object.keys(DEFAULTS));
const PATTERN_KEYS = new Set(["bullish", "bearish", "bullish_engulfing", "bearish_engulfing", "hammer", "shooting_star", "doji", "inside_bar"]);
const FIELD_KEYS = new Set(["close", "open", "high", "low", "hl2", "hlc3", "ohlc4"]);

export function operandText(t: T, o: Operand): string {
  switch (o.kind) {
    case "value":
      return num(o.value);
    case "price":
      return FIELD_KEYS.has(o.field) ? t(`mobileAi.field.${o.field}` as MessageKey) : o.field;
    case "candle":
      return PATTERN_KEYS.has(o.pattern) ? t(`mobileAi.pattern.${o.pattern}` as MessageKey) : o.pattern;
    default: {
      const d = DEFAULTS[o.indicator] ?? [14, 0, 0, 0];
      const p1 = o.period > 0 ? o.period : d[0];
      const p2 = o.period2 > 0 ? o.period2 : d[1];
      const p3 = o.period3 > 0 ? o.period3 : d[2];
      const m = o.mult > 0 ? o.mult : d[3];
      // ADX / DI smoothing is shown only when it differs from the period (ADX(14), not ADX(14, 14))
      const p2shown = ["adx", "plus_di", "minus_di"].includes(o.indicator) && p2 === p1 ? 0 : p2;
      const params = [p1, p2shown, p3].filter((x) => x > 0).map(String);
      if (o.indicator.startsWith("bb_")) params.push(num(m));
      const label = IND_KEYS.has(o.indicator) ? t(`mobileAi.ind.${o.indicator}` as MessageKey) : o.indicator.toUpperCase();
      const src = ["sma", "ema", "wma", "rsi", "bb_upper", "bb_middle", "bb_lower", "stddev", "momentum", "roc", "macd", "macd_signal", "macd_hist"].includes(o.indicator) && o.field !== "close" && FIELD_KEYS.has(o.field) ? ` · ${t(`mobileAi.field.${o.field}` as MessageKey)}` : "";
      return `${label}(${params.join(", ")})${src}`;
    }
  }
}

const OP_TEXT: Record<string, MessageKey | string> = { gt: ">", lt: "<", gte: "≥", lte: "≤", crosses_above: "mobileAi.op.crossesAbove", crosses_below: "mobileAi.op.crossesBelow" };

export function conditionText(t: T, c: Condition): string {
  const tf = c.timeframe && c.timeframe !== "same" ? ` ${t("mobileAi.cond.onTf", { tf: c.timeframe })}` : "";
  // a candle pattern is written as "pattern >= 1" (present): read it as the pattern itself
  if (c.left.kind === "candle" && c.right.kind === "value" && ((c.op === "gte" && c.right.value === 1) || (c.op === "gt" && c.right.value === 0))) return `${operandText(t, c.left)}${tf}`;
  const op = OP_TEXT[c.op] ?? c.op;
  const opText = op.startsWith("mobileAi.") ? t(op as MessageKey) : op;
  return `${operandText(t, c.left)} ${opText} ${operandText(t, c.right)}${tf}`;
}

/** A rule set as lines: each line joins its conditions with and / or; lines are joined by the set's logic. */
export type RuleLine = { text: string; joiner: "and" | "or" | null };
export function ruleLines(t: T, rs: RuleSet | undefined): RuleLine[] {
  if (!rs?.groups?.length) return [];
  const out: RuleLine[] = [];
  rs.groups.forEach((g, gi) => {
    g.conditions.forEach((c, ci) => {
      const joiner: RuleLine["joiner"] = ci > 0 ? (g.logic === "any" ? "or" : "and") : gi > 0 ? (rs.logic === "all" ? "and" : "or") : null;
      out.push({ text: conditionText(t, c), joiner });
    });
  });
  return out;
}

export function distanceText(t: T, d: Distance): string | null {
  const v = num(d.value);
  switch (d.mode) {
    case "none":
      return null;
    case "pips":
      return t("mobileAi.dist.pips", { v });
    case "points":
      return t("mobileAi.dist.points", { v });
    case "price":
      return t("mobileAi.dist.price", { v });
    case "percent":
      return t("mobileAi.dist.percent", { v });
    case "atr":
      return t("mobileAi.dist.atr", { v, p: d.atrPeriod || 14 });
    case "level":
      return t("mobileAi.dist.level", { v });
    case "rr":
      return t("mobileAi.dist.rr", { v });
    default:
      return `${v} ${d.mode}`;
  }
}

export function trailingText(t: T, tr: Trailing): string | null {
  const parts: string[] = [];
  if (tr.mode !== "none" && tr.value > 0) parts.push(distanceText(t, { mode: tr.mode, value: tr.value, atrPeriod: tr.atrPeriod }) ?? "");
  if (tr.breakevenTrigger > 0) parts.push(t("mobileAi.card.breakeven", { v: num(tr.breakevenTrigger) }));
  return parts.filter(Boolean).join(" · ") || null;
}

export function sizeText(t: T, s: StrategySpec): string {
  const base = s.sizing.mode === "risk" ? t("mobileAi.card.riskPct", { pct: num(s.sizing.riskPct, 2) }) : t("mobileAi.card.lots", { lots: num(s.sizing.lots, 2) });
  const capped = s.maxLots > 0 && (s.sizing.mode === "risk" || s.maxLots !== s.sizing.lots);
  return capped ? `${base} · ${t("mobileAi.card.maxLots", { lots: num(s.maxLots, 2) })}` : base;
}

export function windowText(t: T, s: StrategySpec, weekday: (d: number) => string): string {
  const hours = s.sessions.length ? s.sessions.map((w) => `${w.start}–${w.end}`).join(", ") : t("mobileAi.card.allDay");
  const days = s.days.length && s.days.length < 7 ? ` · ${s.days.map(weekday).join(" ")}` : "";
  return `${hours}${days}`;
}

export function limitsText(t: T, s: StrategySpec, money: (v: number) => string): string {
  const parts: string[] = [];
  if (s.maxTradesPerDay > 0) parts.push(t("mobileAi.limits.perDay", { count: s.maxTradesPerDay }));
  if (s.maxDailyLoss > 0) parts.push(t("mobileAi.limits.dailyLoss", { amount: money(s.maxDailyLoss) }));
  if (s.oneAtATime) parts.push(t("mobileAi.limits.oneAtATime"));
  return parts.join(" · ") || t("mobileAi.limits.none");
}

/** The service's validation notes in the reader's language where we know them; anything else keeps its wording. */
const NOTES: [RegExp, MessageKey][] = [
  [/^No daily trade limit$/, "mobileAi.note.noDailyLimit"],
  [/^No stop loss: positions are unprotected$/, "mobileAi.note.noStop"],
  [/^Risk-based sizing needs a stop loss$/, "mobileAi.note.riskNeedsStop"],
  [/^Take profit as R multiple needs a stop loss$/, "mobileAi.note.rrNeedsStop"],
  [/^Risk above 5% per trade is not allowed$/, "mobileAi.note.riskMax"],
  [/^Risk % must be above 0$/, "mobileAi.note.riskZero"],
  [/^No entry rule: add a buy or sell condition$/, "mobileAi.note.noEntry"],
  [/^Trailing distance must be above 0$/, "mobileAi.note.trailZero"],
  [/^Absolute SL\/TP levels are reused for every trade$/, "mobileAi.note.levels"],
];
export function noteText(t: T, raw: string): string {
  for (const [re, key] of NOTES) if (re.test(raw)) return t(key);
  const vol = /^Volume must be at least ([\d.]+) lot$/.exec(raw);
  if (vol) return t("mobileAi.note.minVolume", { lots: vol[1] });
  return raw;
}

/* ---- backtests ---- */

/** Longest range per timeframe (days), as the service allows it. */
export function maxDays(tf: string): number {
  return ({ M1: 60, M5: 365, M15: 730, M30: 1095, H1: 1826, H4: 3653 } as Record<string, number>)[tf] ?? 7305;
}

export type Period = { key: "p1m" | "p3m" | "p6m" | "p1y" | "p2y" | "p5y"; days: number };
const PERIODS: Period[] = [
  { key: "p1m", days: 30 },
  { key: "p3m", days: 91 },
  { key: "p6m", days: 182 },
  { key: "p1y", days: 365 },
  { key: "p2y", days: 730 },
  { key: "p5y", days: 1825 },
];
export function periodsFor(tf: string): Period[] {
  return PERIODS.filter((p) => p.days <= maxDays(tf));
}
/** A sensible default: 1 year for H1 and above, less for the fast timeframes. */
export function defaultPeriod(tf: string): Period["key"] {
  if (tf === "M1") return "p1m";
  if (tf === "M5") return "p3m";
  if (tf === "M15" || tf === "M30") return "p6m";
  return "p1y";
}

/* ---- refinements (the pills under the newest draft) ---- */

export type RefineKey = "trailing" | "session" | "risk" | "limit" | "longOnly";
const REFINES: [RefineKey, (s: StrategySpec) => boolean][] = [
  ["trailing", (s) => !!s.trailing && s.trailing.mode !== "none" && s.trailing.value > 0],
  ["session", (s) => (s.sessions?.length ?? 0) > 0],
  ["risk", (s) => s.sizing?.mode === "risk"],
  ["limit", (s) => s.maxTradesPerDay > 0],
  ["longOnly", (s) => !s.short?.groups?.length],
];
/** The refinements worth offering for a draft: one it already has (a trailing stop, set hours, risk sizing, a daily
 *  trade cap, buys only) is left out. */
export function openRefinements(s: StrategySpec): RefineKey[] {
  return REFINES.filter(([, has]) => !has(s)).map(([k]) => k);
}

/* ---- identity ---- */

/** Stable JSON (sorted keys): the same spec always gives the same text, whatever the key order. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

/** A short fingerprint of a spec: a saved version is reused while the spec is unchanged. */
export function specKey(s: StrategySpec): string {
  const text = stable(s);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x5bd1e995) >>> 0;
  }
  return `${h1.toString(36)}${h2.toString(36)}${text.length.toString(36)}`;
}
