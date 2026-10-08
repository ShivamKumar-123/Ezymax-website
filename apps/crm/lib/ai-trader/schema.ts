/**
 * AI Trader strategy schema: a server-side copy of Ezymex Trader's apps/terminal/lib/ai-trader/schema.ts for the
 * mobile app's AI Trader route (app/api/mobile/trade/ai-trader). Keep the two in step: the app shows and runs the
 * same StrategySpec as the web terminal. Only the contract lookups differ (lot limits from @ezymex/mock directly).
 *
 * One flat, non-recursive shape is used everywhere: the Claude structured-output schema, the local
 * parser, the runtime and the editor. "Unset" is encoded with sentinels (0, "none", "same", [])
 * instead of nulls so the JSON schema has no union types.
 *
 * Rule tree: RuleSet (all/any) -> RuleGroup (all/any) -> Condition (left op right).
 */
import { INSTRUMENTS, getInstrument, instrumentSpec } from "@ezymex/mock";

export const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

/** Volume limits of a symbol (Ezymex Trader's contractSpec: config/trading-specs.json, then the instrument). */
function contractSpec(symbol: string): { minVolume: number; maxVolume: number } {
  const inst = getInstrument(symbol);
  const spec = instrumentSpec(symbol);
  return { minVolume: spec?.lotMin ?? 0.01, maxVolume: spec?.lotMax ?? (inst.assetClass === "crypto" ? 20 : 100) };
}

export const PRICE_FIELDS = ["close", "open", "high", "low", "hl2", "hlc3"] as const;
export type PriceField = (typeof PRICE_FIELDS)[number];

export const INDICATOR_NAMES = [
  "none",
  "sma",
  "ema",
  "rsi",
  "macd",
  "macd_signal",
  "macd_hist",
  "bb_upper",
  "bb_middle",
  "bb_lower",
  "atr",
  "stoch_k",
  "stoch_d",
  "highest",
  "lowest",
] as const;
export type IndicatorName = (typeof INDICATOR_NAMES)[number];

export const CANDLE_PATTERNS = ["none", "bullish", "bearish", "bullish_engulfing", "bearish_engulfing", "hammer", "shooting_star", "doji", "inside_bar"] as const;
export type CandlePattern = (typeof CANDLE_PATTERNS)[number];

export const OPERATORS = ["gt", "lt", "gte", "lte", "crosses_above", "crosses_below"] as const;
export type Operator = (typeof OPERATORS)[number];

export const OPERAND_KINDS = ["price", "indicator", "value", "candle"] as const;
export type OperandKind = (typeof OPERAND_KINDS)[number];

export interface Operand {
  kind: OperandKind;
  /** Price field for kind=price, or the source series of an indicator (usually close). */
  field: PriceField;
  indicator: IndicatorName;
  /** Main period (SMA/EMA/RSI/ATR/BB/Stoch %K/highest/lowest; MACD fast). 0 = indicator default. */
  period: number;
  /** MACD slow / Stoch %D smoothing. 0 = default. */
  period2: number;
  /** MACD signal. 0 = default. */
  period3: number;
  /** Bollinger deviation multiplier. 0 = default (2). */
  mult: number;
  /** Constant for kind=value. */
  value: number;
  pattern: CandlePattern;
}

export interface Condition {
  left: Operand;
  op: Operator;
  right: Operand;
  /** Evaluate on another timeframe (multi-timeframe filter). "same" = the strategy timeframe. */
  timeframe: Timeframe | "same";
}

export interface RuleGroup {
  logic: "all" | "any";
  conditions: Condition[];
}

/** Empty `groups` means "no rule". */
export interface RuleSet {
  logic: "all" | "any";
  groups: RuleGroup[];
}

export const DISTANCE_MODES = ["none", "points", "pips", "price", "percent", "atr", "level", "rr"] as const;
export type DistanceMode = (typeof DISTANCE_MODES)[number];

export interface Distance {
  /**
   * points: MT5 points (1 / 10^digits) · pips · price: distance in price units · percent of entry ·
   * atr: value x ATR(atrPeriod) · level: absolute price · rr: TP only, value x the SL distance.
   */
  mode: DistanceMode;
  value: number;
  atrPeriod: number;
}

export const TRAIL_MODES = ["none", "points", "pips", "atr"] as const;
export type TrailMode = (typeof TRAIL_MODES)[number];

export interface Trailing {
  mode: TrailMode;
  value: number;
  atrPeriod: number;
  /** Move SL to entry (+offset) once profit reaches this many points. 0 = off. */
  breakevenTrigger: number;
  breakevenOffset: number;
}

export interface SessionWindow {
  /** "HH:MM" server time */
  start: string;
  end: string;
}

export interface StrategySpec {
  name: string;
  symbol: string;
  timeframe: Timeframe;
  long: RuleSet;
  short: RuleSet;
  exitLong: RuleSet;
  exitShort: RuleSet;
  /** Also check exit rules on the forming bar (throttled to once a second). */
  exitIntrabar: boolean;
  sizing: { mode: "lots" | "risk"; lots: number; riskPct: number };
  /** Hard volume cap per order. */
  maxLots: number;
  sl: Distance;
  tp: Distance;
  trailing: Trailing;
  /** Empty = all day. */
  sessions: SessionWindow[];
  /** Server weekdays 0=Sun..6=Sat. Empty = every day. */
  days: number[];
  closeOutsideSession: boolean;
  /** 0 = unlimited */
  maxTradesPerDay: number;
  /** Account currency (USD). 0 = off */
  maxDailyLoss: number;
  oneAtATime: boolean;
}

/** What the converter (Claude or the local parser) returns. */
export interface ParseResult {
  status: "ok" | "needs_clarification";
  questions: string[];
  assumptions: string[];
  strategy: StrategySpec;
}

/* ------------------------------------------------------------------ */
/* Builders                                                            */
/* ------------------------------------------------------------------ */

export const emptyRuleSet = (): RuleSet => ({ logic: "all", groups: [] });
export const hasRules = (r: RuleSet) => r.groups.some((g) => g.conditions.length > 0);

export function operand(p: Partial<Operand> & { kind: OperandKind }): Operand {
  return { field: "close", indicator: "none", period: 0, period2: 0, period3: 0, mult: 0, value: 0, pattern: "none", ...p };
}
export const val = (value: number) => operand({ kind: "value", value });
export const price = (field: PriceField = "close") => operand({ kind: "price", field });
export const ind = (indicator: IndicatorName, period = 0, extra: Partial<Operand> = {}) => operand({ kind: "indicator", indicator, period, ...extra });
export const candle = (pattern: CandlePattern) => operand({ kind: "candle", pattern });

export function defaultSpec(symbol = "EURUSD", timeframe: Timeframe = "H1"): StrategySpec {
  return {
    name: `${symbol} ${timeframe} strategy`,
    symbol,
    timeframe,
    long: emptyRuleSet(),
    short: emptyRuleSet(),
    exitLong: emptyRuleSet(),
    exitShort: emptyRuleSet(),
    exitIntrabar: false,
    sizing: { mode: "lots", lots: 0.01, riskPct: 0 },
    maxLots: 0.01,
    sl: { mode: "none", value: 0, atrPeriod: 14 },
    tp: { mode: "none", value: 0, atrPeriod: 14 },
    trailing: { mode: "none", value: 0, atrPeriod: 14, breakevenTrigger: 0, breakevenOffset: 0 },
    sessions: [],
    days: [],
    closeOutsideSession: false,
    maxTradesPerDay: 0,
    maxDailyLoss: 0,
    oneAtATime: true,
  };
}

/* ------------------------------------------------------------------ */
/* Runtime validation (hand written, no dependency)                     */
/* ------------------------------------------------------------------ */

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const num = (x: unknown, d = 0) => (typeof x === "number" && Number.isFinite(x) ? x : typeof x === "string" && x.trim() !== "" && Number.isFinite(+x) ? +x : d);
function oneOf<T extends string>(x: unknown, list: readonly T[], d: T): T {
  return typeof x === "string" && (list as readonly string[]).includes(x) ? (x as T) : d;
}
const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** Default periods per indicator. */
export const IND_DEFAULTS: Partial<Record<IndicatorName, { period: number; period2?: number; period3?: number; mult?: number }>> = {
  sma: { period: 20 },
  ema: { period: 20 },
  rsi: { period: 14 },
  macd: { period: 12, period2: 26, period3: 9 },
  macd_signal: { period: 12, period2: 26, period3: 9 },
  macd_hist: { period: 12, period2: 26, period3: 9 },
  bb_upper: { period: 20, mult: 2 },
  bb_middle: { period: 20, mult: 2 },
  bb_lower: { period: 20, mult: 2 },
  atr: { period: 14 },
  stoch_k: { period: 14, period2: 3 },
  stoch_d: { period: 14, period2: 3 },
  highest: { period: 20 },
  lowest: { period: 20 },
};

function cleanOperand(x: unknown, path: string, errors: string[]): Operand {
  const o = isObj(x) ? x : {};
  if (!isObj(x)) errors.push(`${path}: operand missing`);
  const kind = oneOf(o.kind, OPERAND_KINDS, "value");
  const out = operand({
    kind,
    field: oneOf(o.field, PRICE_FIELDS, "close"),
    indicator: oneOf(o.indicator, INDICATOR_NAMES, "none"),
    period: Math.round(num(o.period)),
    period2: Math.round(num(o.period2)),
    period3: Math.round(num(o.period3)),
    mult: num(o.mult),
    value: num(o.value),
    pattern: oneOf(o.pattern, CANDLE_PATTERNS, "none"),
  });
  if (kind === "indicator") {
    if (out.indicator === "none") errors.push(`${path}: indicator not specified`);
    const d = IND_DEFAULTS[out.indicator];
    if (d) {
      if (out.period <= 0) out.period = d.period;
      if (out.period2 <= 0 && d.period2) out.period2 = d.period2;
      if (out.period3 <= 0 && d.period3) out.period3 = d.period3;
      if (out.mult <= 0 && d.mult) out.mult = d.mult;
    }
    if (out.period > 1000 || out.period2 > 1000 || out.period3 > 1000) errors.push(`${path}: period too long (max 1000)`);
  }
  if (kind === "candle" && out.pattern === "none") errors.push(`${path}: candle pattern not specified`);
  return out;
}

function cleanRuleSet(x: unknown, path: string, errors: string[]): RuleSet {
  if (!isObj(x)) return emptyRuleSet();
  const groups = Array.isArray(x.groups) ? x.groups : [];
  return {
    logic: oneOf(x.logic, ["all", "any"] as const, "all"),
    groups: groups
      .filter(isObj)
      .map((g, gi) => ({
        logic: oneOf(g.logic, ["all", "any"] as const, "all"),
        conditions: (Array.isArray(g.conditions) ? g.conditions : []).filter(isObj).map((c, ci) => {
          const p = `${path}.groups[${gi}].conditions[${ci}]`;
          const cond: Condition = {
            left: cleanOperand(c.left, `${p}.left`, errors),
            op: oneOf(c.op, OPERATORS, "gt"),
            right: cleanOperand(c.right, `${p}.right`, errors),
            timeframe: oneOf(c.timeframe, [...TIMEFRAMES, "same"] as const, "same"),
          };
          if (!OPERATORS.includes(c.op as Operator)) errors.push(`${p}.op: unknown operator "${String(c.op)}"`);
          return cond;
        }),
      }))
      .filter((g) => g.conditions.length > 0),
  };
}

function cleanDistance(x: unknown, allowRR: boolean): Distance {
  const o = isObj(x) ? x : {};
  const mode = oneOf(o.mode, DISTANCE_MODES, "none");
  return { mode: !allowRR && mode === "rr" ? "none" : mode, value: Math.abs(num(o.value)), atrPeriod: Math.round(num(o.atrPeriod, 14)) || 14 };
}

/**
 * Validate + normalise anything (model output, localStorage, editor state) into a StrategySpec.
 * `errors` are blocking; `warnings` are shown on the card.
 */
export function validateSpec(x: unknown): { spec: StrategySpec; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const o = isObj(x) ? x : {};
  if (!isObj(x)) errors.push("Strategy is not an object");
  const rawSym = typeof o.symbol === "string" ? o.symbol.toUpperCase().replace(/[^A-Z0-9.]/g, "") : "";
  const known = INSTRUMENTS.some((i) => i.symbol === rawSym);
  if (!known) errors.push(rawSym ? `Unknown symbol "${rawSym}"` : "Symbol is missing");
  const symbol = known ? rawSym : "EURUSD";
  const timeframe = oneOf(o.timeframe, TIMEFRAMES, "H1");
  if (!TIMEFRAMES.includes(o.timeframe as Timeframe)) errors.push(`Unknown timeframe "${String(o.timeframe ?? "")}"`);
  const d = defaultSpec(symbol, timeframe);
  const sz = isObj(o.sizing) ? o.sizing : {};
  const spec: StrategySpec = {
    name: typeof o.name === "string" && o.name.trim() ? o.name.trim().slice(0, 48) : d.name,
    symbol,
    timeframe,
    long: cleanRuleSet(o.long, "long", errors),
    short: cleanRuleSet(o.short, "short", errors),
    exitLong: cleanRuleSet(o.exitLong, "exitLong", errors),
    exitShort: cleanRuleSet(o.exitShort, "exitShort", errors),
    exitIntrabar: o.exitIntrabar === true,
    sizing: { mode: oneOf(sz.mode, ["lots", "risk"] as const, "lots"), lots: Math.abs(num(sz.lots)), riskPct: Math.abs(num(sz.riskPct)) },
    maxLots: Math.abs(num(o.maxLots)),
    sl: cleanDistance(o.sl, false),
    tp: cleanDistance(o.tp, true),
    trailing: (() => {
      const t = isObj(o.trailing) ? o.trailing : {};
      return {
        mode: oneOf(t.mode, TRAIL_MODES, "none"),
        value: Math.abs(num(t.value)),
        atrPeriod: Math.round(num(t.atrPeriod, 14)) || 14,
        breakevenTrigger: Math.abs(num(t.breakevenTrigger)),
        breakevenOffset: num(t.breakevenOffset),
      };
    })(),
    sessions: (Array.isArray(o.sessions) ? o.sessions : [])
      .filter(isObj)
      .map((s) => ({ start: String(s.start ?? ""), end: String(s.end ?? "") }))
      .filter((s) => {
        const ok = HHMM.test(s.start) && HHMM.test(s.end);
        if (!ok) errors.push(`Invalid session window ${s.start}–${s.end}`);
        return ok;
      })
      .map((s) => ({ start: pad(s.start), end: pad(s.end) })),
    days: [...new Set((Array.isArray(o.days) ? o.days : []).map((v) => Math.round(num(v, -1))).filter((v) => v >= 0 && v <= 6))].sort(),
    closeOutsideSession: o.closeOutsideSession === true,
    maxTradesPerDay: Math.max(0, Math.round(num(o.maxTradesPerDay))),
    maxDailyLoss: Math.abs(num(o.maxDailyLoss)),
    oneAtATime: o.oneAtATime !== false,
  };

  // semantic checks
  if (!hasRules(spec.long) && !hasRules(spec.short)) errors.push("No entry rule: add a buy or sell condition");
  const spec2 = contractSpec(symbol);
  if (spec.sizing.mode === "lots") {
    if (!(spec.sizing.lots >= spec2.minVolume)) errors.push(`Volume must be at least ${spec2.minVolume} lot`);
    spec.sizing.lots = +spec.sizing.lots.toFixed(2);
  } else {
    if (!(spec.sizing.riskPct > 0)) errors.push("Risk % must be above 0");
    if (spec.sizing.riskPct > 5) errors.push("Risk above 5% per trade is not allowed");
    if (spec.sl.mode === "none") errors.push("Risk-based sizing needs a stop loss");
  }
  if (!(spec.maxLots > 0)) spec.maxLots = spec.sizing.mode === "lots" ? spec.sizing.lots : 1;
  spec.maxLots = +Math.min(spec.maxLots, spec2.maxVolume).toFixed(2);
  if (spec.sizing.mode === "lots" && spec.sizing.lots > spec.maxLots) warnings.push(`Volume ${spec.sizing.lots} is above the cap; orders are capped at ${spec.maxLots}`);
  if (spec.tp.mode === "rr" && spec.sl.mode === "none") errors.push("Take profit as R multiple needs a stop loss");
  for (const [k, dist] of [["Stop loss", spec.sl], ["Take profit", spec.tp]] as const) {
    if (dist.mode !== "none" && !(dist.value > 0)) errors.push(`${k} value must be above 0`);
  }
  if (spec.trailing.mode !== "none" && !(spec.trailing.value > 0)) errors.push("Trailing distance must be above 0");
  if (spec.sl.mode === "none") warnings.push("No stop loss: positions are unprotected");
  if (spec.maxTradesPerDay === 0) warnings.push("No daily trade limit");
  if (spec.sl.mode === "level" || spec.tp.mode === "level") warnings.push("Absolute SL/TP levels are reused for every trade");
  void getInstrument;
  return { spec, errors, warnings };
}

function pad(hhmm: string) {
  const [h, m] = hhmm.split(":");
  return `${h!.padStart(2, "0")}:${m}`;
}

/* ------------------------------------------------------------------ */
/* JSON Schema for Claude structured output (no unions, no recursion)   */
/* ------------------------------------------------------------------ */

const S = {
  str: (description?: string) => ({ type: "string", ...(description ? { description } : {}) }),
  num: (description?: string) => ({ type: "number", ...(description ? { description } : {}) }),
  bool: (description?: string) => ({ type: "boolean", ...(description ? { description } : {}) }),
  enm: (values: readonly string[], description?: string) => ({ type: "string", enum: [...values], ...(description ? { description } : {}) }),
  arr: (items: object, description?: string) => ({ type: "array", items, ...(description ? { description } : {}) }),
  obj: (properties: Record<string, object>, description?: string) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false, ...(description ? { description } : {}) }),
};

const OPERAND_SCHEMA = S.obj({
  kind: S.enm(OPERAND_KINDS, "price = bar price field; indicator; value = constant; candle = pattern (1 when present, 0 otherwise)"),
  field: S.enm(PRICE_FIELDS, "Price field for kind=price, or indicator source series (use close unless stated)"),
  indicator: S.enm(INDICATOR_NAMES, "Indicator for kind=indicator, else none"),
  period: S.num("Main period; 0 = default (SMA/EMA 20, RSI 14, ATR 14, BB 20, Stoch 14, MACD fast 12, highest/lowest 20)"),
  period2: S.num("MACD slow (26) or Stoch %D (3); 0 = default"),
  period3: S.num("MACD signal (9); 0 = default"),
  mult: S.num("Bollinger deviations; 0 = default 2"),
  value: S.num("Constant for kind=value, else 0"),
  pattern: S.enm(CANDLE_PATTERNS, "Candle pattern for kind=candle, else none"),
});

const RULESET_SCHEMA = S.obj(
  {
    logic: S.enm(["all", "any"]),
    groups: S.arr(
      S.obj({
        logic: S.enm(["all", "any"]),
        conditions: S.arr(
          S.obj({
            left: OPERAND_SCHEMA,
            op: S.enm(OPERATORS),
            right: OPERAND_SCHEMA,
            timeframe: S.enm([...TIMEFRAMES, "same"], "same = strategy timeframe; set another timeframe only for explicit higher-timeframe filters"),
          }),
        ),
      }),
    ),
  },
  "Empty groups array = no rule",
);

const DISTANCE_SCHEMA = S.obj({
  mode: S.enm(DISTANCE_MODES, "points = MT5 points (1/10^digits); pips; price = distance in price units; percent of entry; atr = value x ATR(atrPeriod); level = absolute price; rr = take profit only, value x stop distance; none"),
  value: S.num(),
  atrPeriod: S.num("ATR period when mode=atr, else 14"),
});

export const STRATEGY_JSON_SCHEMA = S.obj({
  name: S.str("Short strategy name, max 40 chars"),
  symbol: S.str("Exact instrument symbol from the provided list"),
  timeframe: S.enm(TIMEFRAMES),
  long: RULESET_SCHEMA,
  short: RULESET_SCHEMA,
  exitLong: RULESET_SCHEMA,
  exitShort: RULESET_SCHEMA,
  exitIntrabar: S.bool("true only if exits must be checked before the bar closes"),
  sizing: S.obj({ mode: S.enm(["lots", "risk"]), lots: S.num("lots when mode=lots, else 0"), riskPct: S.num("% of balance risked per trade when mode=risk, else 0") }),
  maxLots: S.num("Hard cap per order; equal to lots unless the user gave a cap"),
  sl: DISTANCE_SCHEMA,
  tp: DISTANCE_SCHEMA,
  trailing: S.obj({
    mode: S.enm(TRAIL_MODES),
    value: S.num("distance in points/pips, or ATR multiple"),
    atrPeriod: S.num(),
    breakevenTrigger: S.num("points of profit that move SL to entry; 0 = off"),
    breakevenOffset: S.num("points beyond entry for the breakeven stop; usually 0"),
  }),
  sessions: S.arr(S.obj({ start: S.str("HH:MM server time"), end: S.str("HH:MM server time") }), "Empty = trade all day"),
  days: S.arr({ type: "integer" }, "Server weekdays 0=Sun..6=Sat; empty = every day"),
  closeOutsideSession: S.bool(),
  maxTradesPerDay: S.num("0 = unlimited"),
  maxDailyLoss: S.num("Account currency; 0 = off"),
  oneAtATime: S.bool("Only one open position at a time (default true)"),
});

export const PARSE_RESULT_JSON_SCHEMA = S.obj({
  status: S.enm(["ok", "needs_clarification"]),
  questions: S.arr(S.str(), "Clarifying questions when something essential is missing or ambiguous"),
  assumptions: S.arr(S.str(), "Every default you filled in or interpretation you made"),
  strategy: STRATEGY_JSON_SCHEMA,
});
