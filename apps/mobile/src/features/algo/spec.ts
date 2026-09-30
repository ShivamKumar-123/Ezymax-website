// A strategy's rules, readable on a phone: each visual-builder condition as a short line ("EMA(20) crosses above
// EMA(50)"), stops and sizes in plain words, the trading window and the daily limits. The same reading as the AI
// Trader's strategy card (same indicator defaults and notation), in this module's own strings. Code strategies and
// marketplace listings only expose the service's expressions per signal: those are shown as they are (monospace).
// Pure (no React Native): covered by scripts/algo-lib.test.mts.
import type { MessageKey, T } from "@/i18n";
import type { Condition, Distance, Operand, RiskSpec, RuleSet, SignalKey, StrategySpec, Summary, Trailing } from "./api";
import { num } from "./format";

/** Default periods the service fills in when a period is 0 (services/algo/src/spec.rs ind_defaults). */
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

const PATTERNS = new Set(["bullish", "bearish", "bullish_engulfing", "bearish_engulfing", "hammer", "shooting_star", "doji", "inside_bar"]);
const FIELDS = new Set(["close", "open", "high", "low", "hl2", "hlc3", "ohlc4", "volume"]);
/** Indicators computed on a price series (the series is named when it isn't the close). */
const ON_SOURCE = new Set(["sma", "ema", "wma", "rsi", "bb_upper", "bb_middle", "bb_lower", "stddev", "momentum", "roc", "macd", "macd_signal", "macd_hist"]);

export function operandText(t: T, o: Operand): string {
  switch (o.kind) {
    case "value":
      return num(o.value);
    case "price":
      return FIELDS.has(o.field) ? t(`mobileAlgo.field.${o.field}` as MessageKey) : o.field;
    case "candle":
      return PATTERNS.has(o.pattern) ? t(`mobileAlgo.pattern.${o.pattern}` as MessageKey) : o.pattern;
    default: {
      const d = DEFAULTS[o.indicator] ?? [14, 0, 0, 0];
      const p1 = o.period > 0 ? o.period : d[0];
      const p2 = o.period2 > 0 ? o.period2 : d[1];
      const p3 = o.period3 > 0 ? o.period3 : d[2];
      const m = o.mult > 0 ? o.mult : d[3];
      // ADX / DI smoothing only when it differs from the period: ADX(14), not ADX(14, 14)
      const p2shown = ["adx", "plus_di", "minus_di"].includes(o.indicator) && p2 === p1 ? 0 : p2;
      const params = [p1, p2shown, p3].filter((x) => x > 0).map(String);
      if (o.indicator.startsWith("bb_")) params.push(num(m));
      const label = o.indicator in DEFAULTS ? t(`mobileAlgo.ind.${o.indicator}` as MessageKey) : o.indicator.toUpperCase();
      const src = ON_SOURCE.has(o.indicator) && o.field && o.field !== "close" && FIELDS.has(o.field) ? ` · ${t(`mobileAlgo.field.${o.field}` as MessageKey)}` : "";
      return `${label}(${params.join(", ")})${src}`;
    }
  }
}

const OPS: Record<string, string> = { gt: ">", lt: "<", gte: "≥", lte: "≤", eq: "=", crosses_above: "mobileAlgo.op.crossesAbove", crosses_below: "mobileAlgo.op.crossesBelow" };

export function conditionText(t: T, c: Condition): string {
  const tf = c.timeframe && c.timeframe !== "same" ? ` ${t("mobileAlgo.rules.onTf", { tf: c.timeframe })}` : "";
  // a candle pattern is written as "pattern >= 1" (present): read it as the pattern itself
  if (c.left.kind === "candle" && c.right.kind === "value" && ((c.op === "gte" && c.right.value === 1) || (c.op === "gt" && c.right.value === 0))) return `${operandText(t, c.left)}${tf}`;
  const op = OPS[c.op] ?? c.op;
  const opText = op.startsWith("mobileAlgo.") ? t(op as MessageKey) : op;
  return `${operandText(t, c.left)} ${opText} ${operandText(t, c.right)}${tf}`;
}

/** One condition line and how it joins the one before it (and / or). */
export type RuleLine = { text: string; joiner: "and" | "or" | null };

/** A rule set as lines: conditions of a group join with the group's logic; groups join with the set's logic. */
export function ruleLines(t: T, rs: RuleSet | undefined | null): RuleLine[] {
  if (!rs?.groups?.length) return [];
  const out: RuleLine[] = [];
  rs.groups.forEach((g, gi) => {
    g.conditions.forEach((c, ci) => {
      const joiner: RuleLine["joiner"] = ci > 0 ? (g.logic === "any" ? "or" : "and") : gi > 0 ? (rs.logic === "any" ? "or" : "and") : null;
      out.push({ text: conditionText(t, c), joiner });
    });
  });
  return out;
}

export const SIGNALS: { key: SignalKey; set: "long" | "short" | "exitLong" | "exitShort"; label: MessageKey }[] = [
  { key: "buy", set: "long", label: "mobileAlgo.rules.buy" },
  { key: "sell", set: "short", label: "mobileAlgo.rules.sell" },
  { key: "exit_buy", set: "exitLong", label: "mobileAlgo.rules.exitBuy" },
  { key: "exit_sell", set: "exitShort", label: "mobileAlgo.rules.exitSell" },
];

/** The signals of a visual spec that have rules, as lines. */
export function specSignals(t: T, s: StrategySpec): { key: SignalKey; label: MessageKey; lines: RuleLine[] }[] {
  return SIGNALS.map((x) => ({ key: x.key, label: x.label, lines: ruleLines(t, s[x.set]) })).filter((x) => x.lines.length > 0);
}

/** The service's expressions per signal (code strategies, listings that allow cloning), in signal order. */
export function summarySignals(s: Summary | null | undefined): { key: SignalKey; label: MessageKey; expr: string }[] {
  if (!s) return [];
  return SIGNALS.filter((x) => typeof s[x.key] === "string" && s[x.key]!.trim()).map((x) => ({ key: x.key, label: x.label, expr: s[x.key]! }));
}

export function distanceText(t: T, d: Distance | undefined | null): string | null {
  if (!d) return null;
  const v = num(d.value);
  switch (d.mode) {
    case "none":
      return null;
    case "pips":
      return t("mobileAlgo.dist.pips", { v });
    case "points":
      return t("mobileAlgo.dist.points", { v });
    case "price":
      return t("mobileAlgo.dist.price", { v });
    case "percent":
      return t("mobileAlgo.dist.percent", { v });
    case "atr":
      return t("mobileAlgo.dist.atr", { v, p: d.atrPeriod || 14 });
    case "level":
      return t("mobileAlgo.dist.level", { v });
    case "rr":
      return t("mobileAlgo.dist.rr", { v });
    default:
      return `${v} ${d.mode}`;
  }
}

export function trailingText(t: T, tr: Trailing | undefined | null): string | null {
  if (!tr) return null;
  const parts: string[] = [];
  if (tr.mode && tr.mode !== "none" && tr.value > 0) parts.push(distanceText(t, { mode: tr.mode, value: tr.value, atrPeriod: tr.atrPeriod }) ?? "");
  if (tr.breakevenTrigger > 0) parts.push(t("mobileAlgo.rules.breakeven", { v: num(tr.breakevenTrigger), o: num(tr.breakevenOffset || 0) }));
  return parts.filter(Boolean).join(" · ") || null;
}

export function sizeText(t: T, s: RiskSpec): string | null {
  if (!s.sizing) return null;
  const base = s.sizing.mode === "risk" ? t("mobileAlgo.rules.riskPct", { pct: num(s.sizing.riskPct, 2) }) : t("mobileAlgo.rules.lots", { lots: num(s.sizing.lots, 2) });
  const max = s.maxLots ?? 0;
  const capped = max > 0 && (s.sizing.mode === "risk" || max !== s.sizing.lots);
  return capped ? `${base} · ${t("mobileAlgo.rules.maxLots", { lots: num(max, 2) })}` : base;
}

/** "08:00–20:00 · Mon Tue Wed Thu Fri" (server time), or "Around the clock". */
export function windowText(t: T, s: RiskSpec, weekday: (d: number) => string): string {
  const sessions = s.sessions ?? [];
  const days = s.days ?? [];
  const hours = sessions.length ? sessions.map((w) => `${w.start}–${w.end}`).join(", ") : t("mobileAlgo.rules.allDay");
  const dayText = days.length && days.length < 7 ? ` · ${[...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(weekday).join(" ")}` : "";
  return `${hours}${dayText}`;
}

export function limitsText(t: T, s: RiskSpec, money: (v: number) => string): string {
  const parts: string[] = [];
  if ((s.maxTradesPerDay ?? 0) > 0) parts.push(t("mobileAlgo.rules.perDay", { count: s.maxTradesPerDay ?? 0 }));
  if ((s.maxDailyLoss ?? 0) > 0) parts.push(t("mobileAlgo.rules.dailyLoss", { amount: money(s.maxDailyLoss ?? 0) }));
  if (s.oneAtATime) parts.push(t("mobileAlgo.rules.oneAtATime"));
  if (s.closeOutsideSession) parts.push(t("mobileAlgo.rules.closeOutside"));
  return parts.join(" · ") || t("mobileAlgo.rules.noLimits");
}

/** The risk and schedule of a spec as label / value rows (strategy, deployment setup, listing). */
export function riskRows(t: T, s: RiskSpec, money: (v: number) => string, weekday: (d: number) => string): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const size = sizeText(t, s);
  if (size) rows.push({ label: t("mobileAlgo.rules.size"), value: size });
  if (s.sl) rows.push({ label: t("mobileAlgo.rules.stop"), value: distanceText(t, s.sl) ?? t("mobileAlgo.rules.none") });
  if (s.tp) rows.push({ label: t("mobileAlgo.rules.target"), value: distanceText(t, s.tp) ?? t("mobileAlgo.rules.none") });
  const trail = trailingText(t, s.trailing);
  if (s.trailing) rows.push({ label: t("mobileAlgo.rules.trailing"), value: trail ?? t("mobileAlgo.rules.none") });
  if (s.sessions || s.days) rows.push({ label: t("mobileAlgo.rules.window"), value: windowText(t, s, weekday) });
  rows.push({ label: t("mobileAlgo.rules.limits"), value: limitsText(t, s, money) });
  return rows;
}

/** Service validation notes in the reader's language where we know them; anything else keeps its wording. */
const NOTES: [RegExp, MessageKey][] = [
  [/^No daily trade limit$/, "mobileAlgo.note.noDailyLimit"],
  [/^No stop loss: positions are unprotected$/, "mobileAlgo.note.noStop"],
  [/^Risk-based sizing needs a stop loss$/, "mobileAlgo.note.riskNeedsStop"],
  [/^Take profit as R multiple needs a stop loss$/, "mobileAlgo.note.rrNeedsStop"],
  [/^No entry rule: add a buy or sell condition$/, "mobileAlgo.note.noEntry"],
];
export function noteText(t: T, raw: string): string {
  for (const [re, key] of NOTES) if (re.test(raw)) return t(key);
  return raw;
}

/* ---- backtest periods ---- */

/** Longest range per timeframe (days), as the service allows it (services/algo/src/backtest/jobs.rs max_days). */
export function maxDays(tf: string): number {
  return ({ M1: 60, M5: 365, M15: 730, M30: 1095, H1: 1826, H4: 3653 } as Record<string, number>)[tf] ?? 7305;
}

export type PeriodKey = "p1m" | "p3m" | "p6m" | "p1y" | "p2y" | "p5y";
export const PERIODS: { key: PeriodKey; days: number; label: MessageKey }[] = [
  { key: "p1m", days: 30, label: "mobileAlgo.period.p1m" },
  { key: "p3m", days: 91, label: "mobileAlgo.period.p3m" },
  { key: "p6m", days: 182, label: "mobileAlgo.period.p6m" },
  { key: "p1y", days: 365, label: "mobileAlgo.period.p1y" },
  { key: "p2y", days: 730, label: "mobileAlgo.period.p2y" },
  { key: "p5y", days: 1825, label: "mobileAlgo.period.p5y" },
];

/** The periods a timeframe may test (never longer than the service allows). */
export const periodsFor = (tf: string) => PERIODS.filter((p) => p.days <= maxDays(tf));

/** A sensible default: 1 year for H1 and above, less for the fast timeframes. */
export function defaultPeriod(tf: string): PeriodKey {
  if (tf === "M1") return "p1m";
  if (tf === "M5") return "p3m";
  if (tf === "M15" || tf === "M30") return "p6m";
  return "p1y";
}

/** [from, to] in unix seconds for a period ending now (the service caps `to` at now). */
export function periodRange(key: PeriodKey, now = Date.now()): [number, number] {
  const days = PERIODS.find((p) => p.key === key)?.days ?? 365;
  const to = Math.floor(now / 1000);
  return [to - days * 86400, to];
}
