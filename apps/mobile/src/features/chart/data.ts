// Candle history from market-data (GET /v1/candles, the same bars as Kalks Trader) and the timeframes.
// Charts are drawn in broker server time like MT5 (GMT+3 while US DST is active, else GMT+2), so the day
// starts at New York close.
import type { ApiResult } from "@/lib/api";
import { prefetch } from "@/lib/query";
import { loadConfig } from "@/market/config";

export const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];
export const TF_SECONDS: Record<Timeframe, number> = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400, W1: 604800, MN: 2592000 };

export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

/** Broker server time offset (seconds) at `unixSec`: GMT+3 while US DST is active, else GMT+2. */
export function serverOffset(unixSec: number): number {
  const d = new Date(unixSec * 1000);
  const y = d.getUTCFullYear();
  const nthSunday = (month: number, n: number) => {
    const first = new Date(Date.UTC(y, month, 1));
    return Date.UTC(y, month, 1 + ((7 - first.getUTCDay()) % 7) + (n - 1) * 7);
  };
  const start = nthSunday(2, 2) + 7 * 3600_000;
  const end = nthSunday(10, 1) + 6 * 3600_000;
  const t = unixSec * 1000;
  return t >= start && t < end ? 3 * 3600 : 2 * 3600;
}
export const toChartTime = (utc: number) => utc + serverOffset(utc);

export const candlesKey = (symbol: string, tf: Timeframe) => `md/candles/${symbol}/${tf}`;

/** Bars (ascending, times in chart time); `to` = UTC seconds for older pages. */
export async function fetchCandles(symbol: string, tf: Timeframe, limit = 500, to?: number): Promise<ApiResult<Candle[]>> {
  const cfg = await loadConfig();
  if (!cfg) return { ok: false, status: 0, error: { code: "network", message: "offline" } };
  const q = new URLSearchParams({ symbol, tf, limit: String(limit) });
  if (to) q.set("to", String(to));
  // a stalled request would keep the chart on its skeleton: give up after 12 s and show the retry state
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(`${cfg.marketData.http}/v1/candles?${q}`, { signal: ctrl.signal });
    if (!res.ok) return { ok: false, status: res.status, error: { code: "unavailable", message: `candles ${res.status}` } };
    const data = (await res.json()) as { bars: Candle[] };
    return { ok: true, status: 200, data: data.bars.map((b) => ({ ...b, t: toChartTime(b.t) })) };
  } catch {
    return { ok: false, status: 0, error: { code: "network", message: "offline" } };
  } finally {
    clearTimeout(timer);
  }
}

/** Warm the chart before it opens (watchlist row press-in). */
export function prefetchCandles(symbol: string, tf: Timeframe) {
  prefetch(candlesKey(symbol, tf), () => fetchCandles(symbol, tf), { staleMs: 20_000 });
}
