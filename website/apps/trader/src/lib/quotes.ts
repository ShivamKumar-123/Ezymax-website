import { MARKET_API } from '@/lib/crm';

/** A quote from the public market-data API (services/market-data: GET /v1/quotes). */
export type Quote = {
  bid: number;
  ask: number;
  last?: number;
  /** Day open, high, low (provider daily bar). */
  o?: number;
  h?: number;
  l?: number;
  t?: number;
  /** Delayed snapshot rather than a streaming price. */
  d?: boolean;
};

export type QuoteMap = Record<string, Quote>;

/** Server-side snapshot for first paint. Cached for 30 s; returns {} if the API is unreachable (the UI then shows "—"). */
export async function getQuotes(symbols: string[]): Promise<QuoteMap> {
  try {
    const res = await fetch(`${MARKET_API}/v1/quotes?symbols=${encodeURIComponent(symbols.join(','))}`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return {};
    return (await res.json()) as QuoteMap;
  } catch {
    return {};
  }
}

export function mid(q?: Quote): number | undefined {
  if (!q || !Number.isFinite(q.bid) || !Number.isFinite(q.ask)) return undefined;
  return (q.bid + q.ask) / 2;
}

/** Change against the day open, in percent. */
export function changePct(q?: Quote): number | undefined {
  const m = mid(q);
  if (m === undefined || !q?.o) return undefined;
  return ((m - q.o) / q.o) * 100;
}

export function formatPrice(v: number | undefined, digits: number): string {
  if (v === undefined || !Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatPct(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return '—';
  const s = v >= 0 ? '+' : '−';
  return `${s}${Math.abs(v).toFixed(2)}%`;
}

/** Stream frame from WS /v1/stream: {"type":"quote","s","b","a","l","t","d"?:1}. */
export type StreamQuote = { type: 'quote'; s: string; b: number; a: number; l?: number; t?: number; d?: number };

export function applyFrame(prev: QuoteMap, f: StreamQuote): QuoteMap {
  const old = prev[f.s];
  return {
    ...prev,
    [f.s]: { ...old, bid: f.b, ask: f.a, last: f.l ?? old?.last, t: f.t ?? old?.t, d: Boolean(f.d) },
  };
}
