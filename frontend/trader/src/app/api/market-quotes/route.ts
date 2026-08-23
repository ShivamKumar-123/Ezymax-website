import { NextResponse } from 'next/server';

/**
 * GET /api/market-quotes
 *
 * Real public market quotes for the dashboard "Top daily movers" — used as
 * the source of truth when the platform's own price feed (market-data
 * service / Infoway) has no tick for a symbol, and always for the rich
 * details (instrument name, day range, intraday sparkline).
 *
 * Sources (free, no key): Yahoo Finance chart API for gold / Nasdaq 100 /
 * EUR-USD, Binance public REST for Bitcoin. Cached 60s server-side.
 */
export const dynamic = 'force-dynamic';

export interface PublicQuote {
  symbol: string;
  name: string;
  price: number;
  prevClose: number;
  changePct: number;
  high: number | null;
  low: number | null;
  spark: number[];
  digits: number;
  asOf: string;
}

type Spec =
  | { symbol: string; name: string; digits: number; src: 'yahoo'; id: string }
  | { symbol: string; name: string; digits: number; src: 'binance'; id: string };

const SPECS: readonly Spec[] = [
  { symbol: 'XAUUSD', name: 'Gold', digits: 2, src: 'yahoo', id: 'GC=F' },
  { symbol: 'NAS100', name: 'Nasdaq 100', digits: 2, src: 'yahoo', id: '^NDX' },
  { symbol: 'BTCUSD', name: 'Bitcoin', digits: 0, src: 'binance', id: 'BTCUSDT' },
  { symbol: 'EURUSD', name: 'EUR / USD', digits: 4, src: 'yahoo', id: 'EURUSD=X' },
];

const UA = { 'User-Agent': 'Mozilla/5.0 (SwissCresta dashboard)' };
const CACHE_TTL_MS = 60_000;
let cache: { at: number; items: PublicQuote[] } | null = null;

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : NaN;
};

async function fromYahoo(s: Extract<Spec, { src: 'yahoo' }>): Promise<PublicQuote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.id)}?range=1d&interval=15m`;
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    chart?: { result?: Array<{ meta: Record<string, unknown>; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> };
  };
  const r = json.chart?.result?.[0];
  if (!r) return null;
  const m = r.meta;
  const price = num(m.regularMarketPrice);
  const prev = num(m.chartPreviousClose ?? m.previousClose);
  if (!Number.isFinite(price)) return null;
  const closes = (r.indicators?.quote?.[0]?.close ?? []).filter((c): c is number => typeof c === 'number');
  return {
    symbol: s.symbol, name: s.name, digits: s.digits,
    price, prevClose: prev,
    changePct: Number.isFinite(prev) && prev > 0 ? ((price - prev) / prev) * 100 : NaN,
    high: Number.isFinite(num(m.regularMarketDayHigh)) ? num(m.regularMarketDayHigh) : null,
    low: Number.isFinite(num(m.regularMarketDayLow)) ? num(m.regularMarketDayLow) : null,
    spark: closes.slice(-60),
    asOf: new Date().toISOString(),
  };
}

async function fromBinance(s: Extract<Spec, { src: 'binance' }>): Promise<PublicQuote | null> {
  const [tRes, kRes] = await Promise.all([
    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${s.id}`, { signal: AbortSignal.timeout(8000) }),
    fetch(`https://api.binance.com/api/v3/klines?symbol=${s.id}&interval=15m&limit=60`, { signal: AbortSignal.timeout(8000) }),
  ]);
  if (!tRes.ok) return null;
  const t = (await tRes.json()) as Record<string, string>;
  const price = num(t.lastPrice);
  if (!Number.isFinite(price)) return null;
  const klines = kRes.ok ? ((await kRes.json()) as unknown[][]) : [];
  return {
    symbol: s.symbol, name: s.name, digits: s.digits,
    price, prevClose: num(t.openPrice),
    changePct: num(t.priceChangePercent),
    high: Number.isFinite(num(t.highPrice)) ? num(t.highPrice) : null,
    low: Number.isFinite(num(t.lowPrice)) ? num(t.lowPrice) : null,
    spark: klines.map((k) => num(k[4])).filter(Number.isFinite),
    asOf: new Date().toISOString(),
  };
}

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ items: cache.items, cached: true });
  }
  const results = await Promise.all(
    SPECS.map((s) => (s.src === 'yahoo' ? fromYahoo(s) : fromBinance(s)).catch(() => null)),
  );
  const items = results.filter((q): q is PublicQuote => q !== null);
  if (items.length === 0) {
    if (cache) return NextResponse.json({ items: cache.items, cached: true, stale: true });
    return NextResponse.json({ items: [], error: 'quotes unavailable' }, { status: 502 });
  }
  cache = { at: Date.now(), items };
  return NextResponse.json({ items, cached: false });
}
