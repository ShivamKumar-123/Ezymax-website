/**
 * Custom datafeed for the self-hosted TradingView Advanced Charts library
 * (`public/charting_library-master`). Unlike the old iframe embed — which
 * pulled candles from external exchanges (Binance/OANDA) — this feeds the
 * chart the BROKER's own OHLC data and live quotes, so the chart matches the
 * executable price.
 *
 * Sources:
 *  - History:  GET /api/v1/instruments/{symbol}/bars (already TV-shaped)
 *  - Realtime: priceSocket (/ws/prices) live bid/ask ticks, aggregated here
 *              into the in-progress candle for the active resolution.
 */
import { getApiBase } from '@/lib/api/client';
import { useTradingStore } from '@/stores/tradingStore';
import { getDigits } from '@/lib/utils';

type Bar = { time: number; open: number; high: number; low: number; close: number; volume?: number };

const SUPPORTED_RESOLUTIONS = ['1', '5', '15', '30', '60', '240', '1D'];

type InstrumentMeta = {
  symbol: string;
  display_name?: string | null;
  segment?: string | null;
  digits?: number;
};

// ── Instruments metadata (digits / names) — fetched once, cached ──────────
let instrumentsCache: InstrumentMeta[] | null = null;
let instrumentsPromise: Promise<InstrumentMeta[]> | null = null;

async function loadInstruments(): Promise<InstrumentMeta[]> {
  if (instrumentsCache) return instrumentsCache;
  if (!instrumentsPromise) {
    instrumentsPromise = fetch(`${getApiBase()}/instruments/`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: unknown) => (Array.isArray(list) ? (list as InstrumentMeta[]) : []))
      .then((list) => {
        instrumentsCache = list;
        return list;
      })
      .catch(() => {
        instrumentsCache = [];
        return [] as InstrumentMeta[];
      });
  }
  return instrumentsPromise;
}

function resolutionToSeconds(resolution: string): number {
  if (resolution.includes('D')) return 86400;
  if (resolution.includes('W')) return 604800;
  if (resolution.includes('M')) return 2592000;
  const n = parseInt(resolution, 10);
  return (Number.isFinite(n) && n > 0 ? n : 5) * 60;
}

function segmentToType(segment?: string | null): string {
  const s = (segment || '').toLowerCase();
  if (s.includes('crypto')) return 'crypto';
  if (s.includes('metal') || s.includes('commod') || s.includes('energy')) return 'commodity';
  if (s.includes('ind') || s.includes('stock') || s.includes('equit')) return 'index';
  return 'forex';
}

// ── Realtime streaming ─────────────────────────────────────────────────────
// Ticks come from the SAME source the rest of the trading UI uses — the
// tradingStore `prices` map (fed by wsManager on the trading pages). Reading
// the store (instead of a separate socket) guarantees the chart streams the
// exact live quotes shown elsewhere. One store subscription fans out to every
// chart subscriber, building the in-progress candle for its resolution.
type Subscriber = {
  symbol: string;
  sec: number;
  lastBar: Bar | null;
  onTick: (bar: Bar) => void;
};
const subscribers = new Map<string, Subscriber>();
// Last bar seen per `${symbol}|${sec}` (seeded by getBars) so the first tick
// continues the correct in-progress candle instead of starting a fresh one.
const lastBarCache = new Map<string, Bar>();
let storeUnsub: (() => void) | null = null;

function applyPrice(sub: Subscriber, price: number) {
  if (!Number.isFinite(price) || price <= 0) return;
  const barStartMs = Math.floor(Math.floor(Date.now() / 1000) / sub.sec) * sub.sec * 1000;
  const prev = sub.lastBar;
  let bar: Bar;
  if (prev && prev.time === barStartMs) {
    // Same candle → extend it.
    bar = { ...prev, high: Math.max(prev.high, price), low: Math.min(prev.low, price), close: price };
  } else if (prev && barStartMs < prev.time) {
    // Late tick for an already-closed bucket — ignore.
    return;
  } else {
    // New candle opens at the previous close (gapless) or this price.
    const open = prev ? prev.close : price;
    bar = { time: barStartMs, open, high: Math.max(open, price), low: Math.min(open, price), close: price, volume: 0 };
  }
  sub.lastBar = bar;
  lastBarCache.set(`${sub.symbol}|${sub.sec}`, bar);
  sub.onTick(bar);
}

function ensureStream() {
  if (storeUnsub) return;
  storeUnsub = useTradingStore.subscribe((state, prev) => {
    if (subscribers.size === 0) return;
    subscribers.forEach((sub) => {
      const tick = state.prices[sub.symbol];
      // Only react when THIS symbol's tick actually changed.
      if (!tick || tick === prev.prices[sub.symbol]) return;
      applyPrice(sub, (Number(tick.bid) + Number(tick.ask)) / 2);
    });
  });
}

// ── Datafeed factory ───────────────────────────────────────────────────────
export function createDatafeed() {
  return {
    onReady: (cb: (config: unknown) => void) => {
      setTimeout(
        () =>
          cb({
            supported_resolutions: SUPPORTED_RESOLUTIONS,
            supports_time: true,
            supports_marks: false,
            supports_timescale_marks: false,
            exchanges: [{ value: 'FXArtha', name: 'FXArtha', desc: 'FXArtha' }],
            symbols_types: [
              { name: 'All', value: '' },
              { name: 'Forex', value: 'forex' },
              { name: 'Crypto', value: 'crypto' },
              { name: 'Commodity', value: 'commodity' },
              { name: 'Index', value: 'index' },
            ],
          }),
        0,
      );
    },

    searchSymbols: async (
      userInput: string,
      _exchange: string,
      symbolType: string,
      onResult: (items: unknown[]) => void,
    ) => {
      const list = await loadInstruments();
      const q = (userInput || '').toUpperCase();
      const items = list
        .filter((i) => {
          const matchesText =
            i.symbol.toUpperCase().includes(q) || (i.display_name || '').toUpperCase().includes(q);
          const matchesType = !symbolType || segmentToType(i.segment) === symbolType;
          return matchesText && matchesType;
        })
        .slice(0, 40)
        .map((i) => ({
          symbol: i.symbol,
          full_name: i.symbol,
          description: i.display_name || i.symbol,
          exchange: 'FXArtha',
          ticker: i.symbol,
          type: segmentToType(i.segment),
        }));
      onResult(items);
    },

    resolveSymbol: async (
      symbolName: string,
      onResolve: (info: unknown) => void,
      onError: (reason: string) => void,
    ) => {
      try {
        const list = await loadInstruments();
        const clean = (symbolName || 'EURUSD').split(':').pop()!.toUpperCase();
        const meta = list.find((i) => i.symbol.toUpperCase() === clean);
        const digits = meta?.digits ?? getDigits(clean);
        const pricescale = Math.pow(10, digits);
        onResolve({
          name: clean,
          full_name: clean,
          ticker: clean,
          description: meta?.display_name || clean,
          type: segmentToType(meta?.segment),
          session: '24x7',
          timezone: 'Etc/UTC',
          exchange: 'FXArtha',
          listed_exchange: 'FXArtha',
          format: 'price',
          minmov: 1,
          pricescale,
          has_intraday: true,
          has_daily: true,
          has_weekly_and_monthly: true,
          supported_resolutions: SUPPORTED_RESOLUTIONS,
          volume_precision: 2,
          data_status: 'streaming',
        });
      } catch (e) {
        onError(String(e));
      }
    },

    getBars: async (
      symbolInfo: { name: string },
      resolution: string,
      periodParams: { from: number; to: number; firstDataRequest: boolean },
      onResult: (bars: Bar[], meta: { noData: boolean }) => void,
      onError: (reason: string) => void,
    ) => {
      const { from, to, firstDataRequest } = periodParams;
      try {
        const sym = symbolInfo.name.toUpperCase();
        const url = `${getApiBase()}/instruments/${encodeURIComponent(sym)}/bars?resolution=${encodeURIComponent(
          resolution,
        )}&from=${from}&to=${to}`;
        const r = await fetch(url, { credentials: 'include' });
        const json = await r.json().catch(() => ({}));
        const raw: Array<Record<string, unknown>> = Array.isArray(json?.bars) ? json.bars : [];
        const bars: Bar[] = raw
          .map((b) => ({
            time: Number(b.time) * 1000,
            open: Number(b.open),
            high: Number(b.high),
            low: Number(b.low),
            close: Number(b.close),
            volume: Number(b.volume ?? 0),
          }))
          .filter((b) => Number.isFinite(b.time) && Number.isFinite(b.close))
          .sort((a, b) => a.time - b.time);
        if (firstDataRequest && bars.length) {
          const sec = resolutionToSeconds(resolution);
          lastBarCache.set(`${sym}|${sec}`, bars[bars.length - 1]);
        }
        onResult(bars, { noData: bars.length === 0 });
      } catch (e) {
        onError(String(e));
      }
    },

    subscribeBars: (
      symbolInfo: { name: string },
      resolution: string,
      onTick: (bar: Bar) => void,
      listenerGuid: string,
    ) => {
      const sym = symbolInfo.name.toUpperCase();
      const sec = resolutionToSeconds(resolution);
      const sub: Subscriber = {
        symbol: sym,
        sec,
        lastBar: lastBarCache.get(`${sym}|${sec}`) || null,
        onTick,
      };
      subscribers.set(listenerGuid, sub);
      ensureStream();
      // Prime immediately from the store's current tick so the candle updates
      // right away instead of waiting for the next incoming price change.
      const cur = useTradingStore.getState().prices[sym];
      if (cur) applyPrice(sub, (Number(cur.bid) + Number(cur.ask)) / 2);
    },

    unsubscribeBars: (listenerGuid: string) => {
      subscribers.delete(listenerGuid);
    },
  };
}
