// Chart indicators (the same definitions as Kalks Trader: SMA 20, EMA 50, Bollinger Bands 20 / 2, RSI 14 Wilder).
// Full series are computed on the JS thread when the history changes (once per bar); the forming bar's values
// are recomputed on the UI thread on every tick by the `tail*` worklets, so indicators move with the price.

export const MA_PERIOD = 20;
export const EMA_PERIOD = 50;
export const BB_PERIOD = 20;
export const BB_K = 2;
export const RSI_PERIOD = 14;

export type IndicatorKey = "ma" | "ema" | "bb" | "rsi";

export type Series = {
  ma: number[];
  ema: number[];
  bbU: number[];
  bbM: number[];
  bbL: number[];
  rsi: number[];
  /** Wilder averages (RSI state per bar) */
  ag: number[];
  al: number[];
};

export const EMPTY_SERIES: Series = { ma: [], ema: [], bbU: [], bbM: [], bbL: [], rsi: [], ag: [], al: [] };

/** closes -> every indicator (NaN where not defined yet). */
export function computeSeries(closes: number[]): Series {
  const n = closes.length;
  const ma = new Array<number>(n).fill(NaN);
  const ema = new Array<number>(n).fill(NaN);
  const bbU = new Array<number>(n).fill(NaN);
  const bbM = new Array<number>(n).fill(NaN);
  const bbL = new Array<number>(n).fill(NaN);
  const rsi = new Array<number>(n).fill(NaN);
  const ag = new Array<number>(n).fill(NaN);
  const al = new Array<number>(n).fill(NaN);

  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += closes[i]!;
    if (i >= MA_PERIOD) sum -= closes[i - MA_PERIOD]!;
    if (i >= MA_PERIOD - 1) ma[i] = sum / MA_PERIOD;
  }
  const k = 2 / (EMA_PERIOD + 1);
  for (let i = 0; i < n; i++) {
    if (i < EMA_PERIOD - 1) continue;
    if (i === EMA_PERIOD - 1) {
      let s = 0;
      for (let j = 0; j < EMA_PERIOD; j++) s += closes[j]!;
      ema[i] = s / EMA_PERIOD;
    } else ema[i] = ema[i - 1]! + k * (closes[i]! - ema[i - 1]!);
  }
  for (let i = BB_PERIOD - 1; i < n; i++) {
    let s = 0;
    for (let j = i - BB_PERIOD + 1; j <= i; j++) s += closes[j]!;
    const mean = s / BB_PERIOD;
    let v = 0;
    for (let j = i - BB_PERIOD + 1; j <= i; j++) v += (closes[j]! - mean) ** 2;
    const sd = Math.sqrt(v / BB_PERIOD);
    bbM[i] = mean;
    bbU[i] = mean + BB_K * sd;
    bbL[i] = mean - BB_K * sd;
  }
  if (n > RSI_PERIOD) {
    let g = 0;
    let l = 0;
    for (let i = 1; i <= RSI_PERIOD; i++) {
      const d = closes[i]! - closes[i - 1]!;
      if (d > 0) g += d;
      else l -= d;
    }
    ag[RSI_PERIOD] = g / RSI_PERIOD;
    al[RSI_PERIOD] = l / RSI_PERIOD;
    rsi[RSI_PERIOD] = rsiOf(ag[RSI_PERIOD]!, al[RSI_PERIOD]!);
    for (let i = RSI_PERIOD + 1; i < n; i++) {
      const d = closes[i]! - closes[i - 1]!;
      ag[i] = (ag[i - 1]! * (RSI_PERIOD - 1) + Math.max(d, 0)) / RSI_PERIOD;
      al[i] = (al[i - 1]! * (RSI_PERIOD - 1) + Math.max(-d, 0)) / RSI_PERIOD;
      rsi[i] = rsiOf(ag[i]!, al[i]!);
    }
  }
  return { ma, ema, bbU, bbM, bbL, rsi, ag, al };
}

function rsiOf(g: number, l: number) {
  "worklet";
  if (l === 0) return g === 0 ? 50 : 100;
  return 100 - 100 / (1 + g / l);
}

/**
 * Values of every indicator at the last index when its close is `c` (the forming bar). `closes` holds the
 * history closes (the last element is replaced by `c`).
 */
export function tailValues(closes: number[], s: Series, c: number): { ma: number; ema: number; bbU: number; bbM: number; bbL: number; rsi: number } {
  "worklet";
  const n = closes.length;
  const last = n - 1;
  const out = { ma: NaN, ema: NaN, bbU: NaN, bbM: NaN, bbL: NaN, rsi: NaN };
  if (n === 0) return out;
  if (n >= MA_PERIOD) {
    let sum = c;
    for (let j = last - (MA_PERIOD - 1); j < last; j++) sum += closes[j]!;
    out.ma = sum / MA_PERIOD;
  }
  if (n >= BB_PERIOD) {
    let sum = c;
    for (let j = last - (BB_PERIOD - 1); j < last; j++) sum += closes[j]!;
    const mean = sum / BB_PERIOD;
    let v = (c - mean) * (c - mean);
    for (let j = last - (BB_PERIOD - 1); j < last; j++) v += (closes[j]! - mean) * (closes[j]! - mean);
    const sd = Math.sqrt(v / BB_PERIOD);
    out.bbM = mean;
    out.bbU = mean + BB_K * sd;
    out.bbL = mean - BB_K * sd;
  }
  if (n > EMA_PERIOD) {
    const prev = s.ema[last - 1];
    if (prev !== undefined && prev === prev) out.ema = prev + (2 / (EMA_PERIOD + 1)) * (c - prev);
  }
  if (n > RSI_PERIOD + 1) {
    const pg = s.ag[last - 1];
    const pl = s.al[last - 1];
    if (pg !== undefined && pl !== undefined && pg === pg && pl === pl) {
      const d = c - closes[last - 1]!;
      const g = (pg * (RSI_PERIOD - 1) + Math.max(d, 0)) / RSI_PERIOD;
      const l = (pl * (RSI_PERIOD - 1) + Math.max(-d, 0)) / RSI_PERIOD;
      out.rsi = rsiOf(g, l);
    }
  }
  return out;
}
