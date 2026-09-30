// Shared by the Skia curve and its placeholders. No Skia import here: safe before CanvasKit loads on the web.

/** The series of a curve, prepared on the JS side (downsampled, tooltip texts precomputed). */
export type CurveData = {
  /** equity / value, oldest first */
  main: number[];
  /** balance (dashed), same length */
  second?: number[];
  /** drawdown from the peak in % (≤ 0), same length: drawn in a lower pane */
  dd?: number[];
  /** a horizontal reference (the starting balance), dashed */
  baseline?: number;
  /** tooltip texts per point. Skia text has no font fallback: Latin script only (digits, ISO dates) */
  tipDate: string[];
  tipMain: string[];
  tipSecond?: string[];
  tipDd?: string[];
  /** axis labels of the main pane (top / bottom of the range) */
  hi: string;
  lo: string;
  /** title and figure over the drawdown pane */
  ddTitle?: string;
  ddLabel?: string;
  /** main line colour (a token) */
  color: string;
  /** what the chart shows, for screen readers */
  a11y: string;
};

/** Pane heights: tooltip strip, main pane, gap, drawdown pane. */
export type CurveLayout = { tip: number; main: number; gap: number; dd: number };

export const EQUITY_LAYOUT: CurveLayout = { tip: 46, main: 176, gap: 26, dd: 64 };
export const LINE_LAYOUT: CurveLayout = { tip: 46, main: 132, gap: 0, dd: 0 };

export const curveHeight = (l: CurveLayout, withDd: boolean) => l.tip + l.main + (withDd ? l.gap + l.dd : 0);

/**
 * Indices that keep the shape of a long series in about `target` points: per bucket the lowest and the highest
 * value, in time order (drawdowns and peaks survive, unlike every-nth sampling). First and last are always kept.
 */
export function downsample(values: number[], target: number): number[] {
  const n = values.length;
  if (n <= target * 2 || target < 2) return values.map((_, i) => i);
  const size = Math.ceil(n / target);
  const out: number[] = [0];
  for (let s = 1; s < n - 1; s += size) {
    const e = Math.min(n - 1, s + size);
    let lo = s;
    let hi = s;
    for (let i = s; i < e; i++) {
      if (values[i]! < values[lo]!) lo = i;
      if (values[i]! > values[hi]!) hi = i;
    }
    if (lo === hi) out.push(lo);
    else out.push(Math.min(lo, hi), Math.max(lo, hi));
  }
  out.push(n - 1);
  return out;
}

/** "2026-04-02 14:00" in server time (GMT+3), Latin digits: tooltip text for Skia. */
export function isoMinute(ms: number): string {
  const d = new Date(ms + 3 * 3600_000);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** "2026-04-02": a day, Latin digits. */
export const isoDay = (ms: number) => isoMinute(ms).slice(0, 10);
