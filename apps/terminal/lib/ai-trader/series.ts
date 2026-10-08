/**
 * Thin adapters from the rule schema to indicator maths in lib/indicators.ts
 * (SMA, EMA, RSI, MACD, Bollinger). ATR, Stochastic, rolling high/low and candle
 * patterns are computed here because indicators.ts does not provide them yet.
 */
import type { Candle } from "@ezymex/mock";
import { bollinger, ema, macd, rsi, sma } from "../indicators";
import type { Condition, Operand, PriceField, RuleSet } from "./schema";

export function fieldSeries(bars: Candle[], f: PriceField): number[] {
  switch (f) {
    case "open":
      return bars.map((b) => b.open);
    case "high":
      return bars.map((b) => b.high);
    case "low":
      return bars.map((b) => b.low);
    case "hl2":
      return bars.map((b) => (b.high + b.low) / 2);
    case "hlc3":
      return bars.map((b) => (b.high + b.low + b.close) / 3);
    default:
      return bars.map((b) => b.close);
  }
}

/** Wilder ATR. */
export function atr(bars: Candle[], n = 14): number[] {
  const out = new Array<number>(bars.length).fill(NaN);
  let prev = NaN;
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]!;
    const pc = i > 0 ? bars[i - 1]!.close : b.close;
    const tr = Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc));
    if (i < n) {
      sum += tr;
      if (i === n - 1) out[i] = prev = sum / n;
    } else {
      prev = (prev * (n - 1) + tr) / n;
      out[i] = prev;
    }
  }
  return out;
}

function stochastic(bars: Candle[], n = 14, d = 3) {
  const k = new Array<number>(bars.length).fill(NaN);
  for (let i = n - 1; i < bars.length; i++) {
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - n + 1; j <= i; j++) {
      hi = Math.max(hi, bars[j]!.high);
      lo = Math.min(lo, bars[j]!.low);
    }
    k[i] = hi === lo ? 50 : ((bars[i]!.close - lo) / (hi - lo)) * 100;
  }
  const start = k.findIndex((x) => !Number.isNaN(x));
  const dPart = start < 0 ? [] : sma(k.slice(start), d);
  const dd = k.map((_, i) => (start < 0 || i < start ? NaN : dPart[i - start]!));
  return { k, d: dd };
}

/** Highest high / lowest low of the N bars BEFORE the current one (so "close breaks above the 20-bar high" works). */
function rolling(bars: Candle[], n: number, hi: boolean): number[] {
  const out = new Array<number>(bars.length).fill(NaN);
  for (let i = n; i < bars.length; i++) {
    let v = hi ? -Infinity : Infinity;
    for (let j = i - n; j < i; j++) v = hi ? Math.max(v, bars[j]!.high) : Math.min(v, bars[j]!.low);
    out[i] = v;
  }
  return out;
}

function pattern(bars: Candle[], p: Operand["pattern"]): number[] {
  return bars.map((b, i) => {
    const prev = bars[i - 1];
    const body = Math.abs(b.close - b.open);
    const range = b.high - b.low || 1e-12;
    const upper = b.high - Math.max(b.open, b.close);
    const lower = Math.min(b.open, b.close) - b.low;
    switch (p) {
      case "bullish":
        return b.close > b.open ? 1 : 0;
      case "bearish":
        return b.close < b.open ? 1 : 0;
      case "bullish_engulfing":
        return prev && prev.close < prev.open && b.close > b.open && b.close >= prev.open && b.open <= prev.close ? 1 : 0;
      case "bearish_engulfing":
        return prev && prev.close > prev.open && b.close < b.open && b.close <= prev.open && b.open >= prev.close ? 1 : 0;
      case "hammer":
        return lower >= body * 2 && upper <= body * 0.6 && body / range < 0.4 ? 1 : 0;
      case "shooting_star":
        return upper >= body * 2 && lower <= body * 0.6 && body / range < 0.4 ? 1 : 0;
      case "doji":
        return body / range <= 0.1 ? 1 : 0;
      case "inside_bar":
        return prev && b.high <= prev.high && b.low >= prev.low ? 1 : 0;
      default:
        return 0;
    }
  });
}

/** Series of an operand over `bars` (aligned; NaN while warming up). Memoised per call site via `cache`. */
export function operandSeries(bars: Candle[], o: Operand, cache: Map<string, number[]>): number[] {
  const key = JSON.stringify(o);
  const hit = cache.get(key);
  if (hit) return hit;
  let out: number[];
  if (o.kind === "value") out = bars.map(() => o.value);
  else if (o.kind === "price") out = fieldSeries(bars, o.field);
  else if (o.kind === "candle") out = pattern(bars, o.pattern);
  else {
    const src = fieldSeries(bars, o.field);
    switch (o.indicator) {
      case "sma":
        out = sma(src, o.period);
        break;
      case "ema":
        out = ema(src, o.period);
        break;
      case "rsi":
        out = rsi(src, o.period);
        break;
      case "macd":
      case "macd_signal":
      case "macd_hist": {
        if (src.length < o.period2 + o.period3) {
          out = src.map(() => NaN);
          break;
        }
        const m = macd(src, o.period, o.period2, o.period3);
        out = o.indicator === "macd" ? m.line : o.indicator === "macd_signal" ? m.signal : m.hist;
        break;
      }
      case "bb_upper":
      case "bb_middle":
      case "bb_lower": {
        const b = bollinger(src, o.period, o.mult);
        out = o.indicator === "bb_upper" ? b.up : o.indicator === "bb_lower" ? b.lo : b.mid;
        break;
      }
      case "atr":
        out = atr(bars, o.period);
        break;
      case "stoch_k":
      case "stoch_d": {
        const s = stochastic(bars, o.period, o.period2 || 3);
        out = o.indicator === "stoch_k" ? s.k : s.d;
        break;
      }
      case "highest":
        out = rolling(bars, o.period, true);
        break;
      case "lowest":
        out = rolling(bars, o.period, false);
        break;
      default:
        out = bars.map(() => NaN);
    }
  }
  cache.set(key, out);
  return out;
}

export interface CondResult {
  ok: boolean;
  ready: boolean;
  left: number;
  right: number;
}

/** Evaluate a condition on bar `i` of `bars`. */
export function evalCondition(bars: Candle[], c: Condition, i: number, cache: Map<string, number[]>): CondResult {
  const L = operandSeries(bars, c.left, cache);
  const R = operandSeries(bars, c.right, cache);
  const l = L[i] ?? NaN;
  const r = R[i] ?? NaN;
  const cross = c.op === "crosses_above" || c.op === "crosses_below";
  const lp = L[i - 1] ?? NaN;
  const rp = R[i - 1] ?? NaN;
  const ready = Number.isFinite(l) && Number.isFinite(r) && (!cross || (Number.isFinite(lp) && Number.isFinite(rp)));
  if (!ready) return { ok: false, ready, left: l, right: r };
  let ok = false;
  switch (c.op) {
    case "gt":
      ok = l > r;
      break;
    case "lt":
      ok = l < r;
      break;
    case "gte":
      ok = l >= r;
      break;
    case "lte":
      ok = l <= r;
      break;
    case "crosses_above":
      ok = lp <= rp && l > r;
      break;
    case "crosses_below":
      ok = lp >= rp && l < r;
      break;
  }
  return { ok, ready, left: l, right: r };
}

export interface RuleEval {
  ok: boolean;
  ready: boolean;
  details: { cond: Condition; res: CondResult }[];
}

/**
 * Evaluate a rule set. `seriesFor(tf)` returns the closed bars (and index) to use for a condition's timeframe.
 */
export function evalRuleSet(rs: RuleSet, seriesFor: (c: Condition) => { bars: Candle[]; i: number; cache: Map<string, number[]> } | null): RuleEval {
  const details: RuleEval["details"] = [];
  let ready = true;
  const groupOk = rs.groups.map((g) => {
    const rs2 = g.conditions.map((c) => {
      const s = seriesFor(c);
      const res = s ? evalCondition(s.bars, c, s.i, s.cache) : { ok: false, ready: false, left: NaN, right: NaN };
      if (!res.ready) ready = false;
      details.push({ cond: c, res });
      return res.ok;
    });
    return g.logic === "all" ? rs2.every(Boolean) : rs2.some(Boolean);
  });
  const ok = rs.groups.length > 0 && (rs.logic === "all" ? groupOk.every(Boolean) : groupOk.some(Boolean));
  return { ok: ok && ready, ready, details };
}
