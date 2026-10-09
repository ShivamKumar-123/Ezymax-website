// Chart time (docs/TERMINAL-DESIGN.md §2.5, Part 7): every chart, ours and TradingView's, is drawn in broker server time
// like MT5: GMT+3 while US daylight saving is active, GMT+2 otherwise, so the day starts at New York close. Bars and
// ticks arrive in UTC and are converted here, never with a fixed offset.
import { candles, priceFeed, serverOffset, type Candle } from "@ezymex/mock";
import { TF_SECONDS, TIMEFRAMES, type Timeframe } from "@/lib/trading";

/** UTC unix seconds → chart time (server time, New York close). */
export const toChartTime = (utc: number) => utc + serverOffset(utc);

/** Chart time → UTC unix seconds (inverse of toChartTime, DST-aware; the repeated hour maps to its first pass). */
export function fromChartTime(chart: number): number {
  const summer = chart - 3 * 3600;
  return summer + serverOffset(summer) === chart ? summer : chart - 2 * 3600;
}

/** One bar from two that share a chart time: the first one's open, the second one's close, the extremes, both volumes. */
export const mergeBars = (a: Candle, b: Candle): Candle => ({ time: a.time, open: a.open, high: Math.max(a.high, b.high), low: Math.min(a.low, b.low), close: b.close, volume: a.volume + b.volume });

/** A history in chart time, and how its newest bar was built (for the live stream that continues it). */
export interface ChartSeries {
  bars: Candle[];
  /** UTC time of the last bar that went into the newest chart bar */
  utc: number;
  /** the newest chart bar without that last part, when it merged two (the repeated hour below), else null */
  base: Candle | null;
}

/**
 * UTC bars (oldest first) → chart time. When US daylight saving ends (first Sunday of November, 06:00 UTC) the server
 * clock goes back an hour, so 05:xx and 06:xx UTC are both 08:xx on the chart: an intraday bar whose chart time is
 * already taken merges into that bar instead of repeating the time (a repeated time breaks both chart engines).
 */
export function chartSeries(utc: readonly Candle[]): ChartSeries {
  const bars: Candle[] = [];
  let last = { utc: 0, base: null as Candle | null };
  for (const b of utc) {
    const t = toChartTime(b.time);
    const n = bars.length;
    if (!n || t > bars[n - 1]!.time) {
      bars.push({ ...b, time: t });
      last = { utc: b.time, base: null };
      continue;
    }
    // the repeated hour: find the bar of the first pass with this chart time (M1…M30 go back up to an hour)
    let i = n - 1;
    while (i >= 0 && bars[i]!.time > t) i--;
    if (i >= 0 && bars[i]!.time === t) {
      if (i === n - 1) last = { utc: b.time, base: bars[i]! };
      bars[i] = mergeBars(bars[i]!, b);
    } else bars.splice(i + 1, 0, { ...b, time: t });
  }
  return { bars, ...last };
}

/** UTC bars → chart-time bars (see chartSeries). */
export const chartBars = (utc: readonly Candle[]): Candle[] => chartSeries(utc).bars;

/**
 * The live stream's forming bar (UTC) as the chart's newest bar. In the repeated hour an H1+ bar lands on the chart time
 * the chart already shows: it is merged with that bar's first pass (`base`). M1…M30 bars of the repeated hour fall
 * behind the newest bar and can't be shown in place: `map` returns null, and `stale` asks the owner to reload the
 * history once the hour is over (the reloaded history merges them).
 */
export class LiveChartBars {
  private utc = 0;
  private base: Candle | null = null;
  private skipped = false;
  private reload = false;

  /** Continue a history converted by chartSeries (or start fresh: no argument). */
  reset(s?: Pick<ChartSeries, "utc" | "base">) {
    this.utc = s?.utc ?? 0;
    this.base = s?.base ?? null;
    this.skipped = this.reload = false;
  }

  /** The bar to draw for stream bar `b` (UTC time), given the chart's newest bar, or null to skip it. */
  map(b: Candle, last: Candle | undefined): Candle | null {
    const t = toChartTime(b.time);
    const bar = { ...b, time: t };
    if (!last || t > last.time) {
      this.utc = b.time;
      this.base = null;
      if (this.skipped) this.reload = true;
      this.skipped = false;
      return bar;
    }
    if (t < last.time) {
      this.skipped = true;
      return null;
    }
    if (b.time > this.utc && this.utc > 0) {
      // the second pass of the repeated hour reached the newest bar: merge with what the chart has
      this.base = last;
      this.utc = b.time;
    } else if (b.time < this.utc) return null; // an older bar than the one forming
    else this.utc = b.time;
    return this.base ? mergeBars(this.base, bar) : bar;
  }

  /** True once after bars were skipped and the stream has moved past them: reload the history. */
  get stale(): boolean {
    const r = this.reload;
    this.reload = false;
    return r;
  }
}

/** Simulator history (no market-data service): seeded bars re-timed to "now" (chart time), scaled to the timeframe. */
export function buildHistory(symbol: string, tf: Timeframe): Candle[] {
  const step = TF_SECONDS[tf];
  const idx = TIMEFRAMES.indexOf(tf);
  const count = tf === "MN" ? 120 : tf === "W1" ? 200 : tf === "D1" ? 300 : 360 + idx;
  const raw = candles(symbol, count, step);
  const k = Math.min(2.6, 0.24 * Math.pow(step / 60, 0.2));
  const last = raw[raw.length - 1]!.close;
  const bid = priceFeed().snapshot(symbol)?.bid ?? last;
  const f = (p: number) => bid * Math.exp(k * Math.log(p / last));
  const now = toChartTime(Math.floor(Date.now() / 1000));
  const lastT = Math.floor(now / step) * step;
  return raw.map((c, i) => {
    const o = f(c.open);
    const cl = f(c.close);
    return { time: lastT - (raw.length - 1 - i) * step, open: o, high: Math.max(f(c.high), o, cl), low: Math.min(f(c.low), o, cl), close: cl, volume: c.volume };
  });
}
