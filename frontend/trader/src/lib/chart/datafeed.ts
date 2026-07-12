/**
 * TradingView Charting Library datafeed for SwissCresta.
 *
 * History  → GET /api/v1/instruments/{symbol}/bars?resolution=&from=&to=
 *            (returns [{ time (epoch SECONDS), open, high, low, close, volume }])
 * Realtime → WS /ws/prices, which streams { symbol, bid, ask, timestamp, spread }
 *            for every symbol. We build/extend the in-progress candle from the
 *            mid price and push it to the chart.
 *
 * Framework-agnostic (plain module) so both the web terminal and the mobile
 * WebView load the exact same chart. No auth needed: /ws/prices and the bars
 * endpoint are public (market data).
 */

type Bar = { time: number; open: number; high: number; low: number; close: number; volume: number };

export type DatafeedInstrument = { symbol: string; digits?: number; segment?: string };

const SUPPORTED_RESOLUTIONS = ['1', '5', '15', '30', '60', '240', '1D'] as const;

// Bar length in seconds per TradingView resolution.
const RES_SECONDS: Record<string, number> = {
  '1': 60, '5': 300, '15': 900, '30': 1800, '60': 3600, '240': 14400,
  '1D': 86400, 'D': 86400,
};

function resSeconds(resolution: string): number {
  return RES_SECONDS[resolution] ?? 300;
}

export function createDatafeed(opts: {
  apiBase?: string; // defaults to same-origin /api/v1
  instruments?: DatafeedInstrument[];
}) {
  const apiBase = (opts.apiBase || '/api/v1').replace(/\/$/, '');
  let instruments = opts.instruments || [];

  // subscriberUID → live subscription
  type Sub = { symbol: string; resolution: string; onTick: (b: Bar) => void; timer: ReturnType<typeof setInterval> | null };
  const subs = new Map<string, Sub>();
  // symbol → last pushed bar, so we never emit an out-of-order tick.
  const lastBars = new Map<string, Bar>();

  // Realtime is DB-DRIVEN: we POLL the same /bars endpoint the history comes
  // from (the server merges the stored bars with the live in-progress bar), so
  // every candle — historical AND live — is one consistent source. No
  // client-side tick aggregation, so no jumps, bounces or broken candles, and
  // all timeframes stay smooth.
  const POLL_MS = 1500;

  async function pollLatest(sub: Sub) {
    const step = resSeconds(sub.resolution);
    const to = Math.floor(Date.now() / 1000);
    const from = to - step * 5; // just the current + a couple recent bars
    try {
      const url = `${apiBase}/instruments/${encodeURIComponent(sub.symbol)}/bars`
        + `?resolution=${encodeURIComponent(sub.resolution)}&from=${from}&to=${to}&live=1`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) return;
      const raw = await res.json();
      const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.bars) ? raw.bars : []);
      const bars: Bar[] = list
        .map((b: Record<string, unknown>) => ({
          time: Number(b.time) * 1000,
          open: Number(b.open), high: Number(b.high), low: Number(b.low),
          close: Number(b.close), volume: Number(b.volume ?? 0),
        }))
        .filter((b: Bar) => Number.isFinite(b.time) && Number.isFinite(b.close))
        .sort((a: Bar, b: Bar) => a.time - b.time);
      const nb = bars[bars.length - 1];
      if (!nb) return;
      const prev = lastBars.get(sub.symbol);
      // Only emit a bar at or after the last one (TradingView requires
      // non-decreasing time) — updates the current candle, or starts a new one.
      if (!prev || nb.time >= prev.time) {
        lastBars.set(sub.symbol, nb);
        sub.onTick({ ...nb });
      }
    } catch {
      /* transient — the next poll retries */
    }
  }

  return {
    setInstruments(list: DatafeedInstrument[]) {
      instruments = list || [];
    },

    onReady(callback: (config: unknown) => void) {
      setTimeout(() => callback({
        supported_resolutions: SUPPORTED_RESOLUTIONS,
        supports_time: true,
        supports_marks: false,
        supports_timescale_marks: false,
        exchanges: [{ value: 'SwissCresta', name: 'SwissCresta', desc: 'SwissCresta' }],
        symbols_types: [{ name: 'All', value: '' }],
      }), 0);
    },

    searchSymbols(userInput: string, _exchange: string, _symbolType: string, onResult: (r: unknown[]) => void) {
      const q = (userInput || '').toUpperCase();
      const out = instruments
        .filter((i) => !q || i.symbol.toUpperCase().includes(q))
        .slice(0, 30)
        .map((i) => ({
          symbol: i.symbol,
          full_name: i.symbol,
          description: i.symbol,
          exchange: 'SwissCresta',
          ticker: i.symbol,
          type: i.segment || 'forex',
        }));
      onResult(out);
    },

    resolveSymbol(symbolName: string, onResolve: (info: unknown) => void, onError: (e: string) => void) {
      const name = (symbolName || '').toUpperCase();
      const inst = instruments.find((i) => i.symbol.toUpperCase() === name);
      const digits = inst?.digits ?? (name.endsWith('JPY') ? 3 : name.includes('USD') && !/^[A-Z]{6}$/.test(name) ? 2 : 5);
      const pricescale = Math.pow(10, digits);
      setTimeout(() => onResolve({
        name: inst?.symbol || name,
        ticker: inst?.symbol || name,
        description: inst?.symbol || name,
        type: inst?.segment || 'forex',
        session: '24x7',
        timezone: 'Etc/UTC',
        exchange: 'SwissCresta',
        listed_exchange: 'SwissCresta',
        format: 'price',
        minmov: 1,
        pricescale,
        has_intraday: true,
        has_daily: true,
        has_weekly_and_monthly: true,
        supported_resolutions: SUPPORTED_RESOLUTIONS,
        volume_precision: 2,
        data_status: 'streaming',
      }), 0);
      void onError;
    },

    async getBars(
      symbolInfo: { ticker?: string; name?: string },
      resolution: string,
      periodParams: { from: number; to: number; firstDataRequest: boolean; countBack?: number },
      onResult: (bars: Bar[], meta: { noData: boolean }) => void,
      onError: (e: string) => void,
    ) {
      const symbol = (symbolInfo.ticker || symbolInfo.name || '').toUpperCase();
      const { from, to, firstDataRequest } = periodParams;
      try {
        const url = `${apiBase}/instruments/${encodeURIComponent(symbol)}/bars?resolution=${encodeURIComponent(resolution)}&from=${from}&to=${to}`;
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) {
          onError(`HTTP ${res.status}`);
          return;
        }
        const raw = await res.json();
        // The endpoint returns { s, bars, noData }; also tolerate a bare array
        // or { items } for safety.
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.bars)
            ? raw.bars
            : Array.isArray(raw?.items)
              ? raw.items
              : [];
        const bars: Bar[] = list
          .map((b: Record<string, unknown>) => ({
            time: Number(b.time) * 1000, // epoch seconds → ms
            open: Number(b.open),
            high: Number(b.high),
            low: Number(b.low),
            close: Number(b.close),
            volume: Number(b.volume ?? 0),
          }))
          .filter((b: Bar) => Number.isFinite(b.time) && Number.isFinite(b.close))
          .sort((a: Bar, b: Bar) => a.time - b.time);

        const last = bars[bars.length - 1];
        if (firstDataRequest && last) {
          lastBars.set(symbol, { ...last });
        }
        onResult(bars, { noData: bars.length === 0 });
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
      }
    },

    subscribeBars(
      symbolInfo: { ticker?: string; name?: string },
      resolution: string,
      onTick: (b: Bar) => void,
      subscriberUID: string,
    ) {
      const symbol = (symbolInfo.ticker || symbolInfo.name || '').toUpperCase();
      const sub: Sub = { symbol, resolution, onTick, timer: null };
      subs.set(subscriberUID, sub);
      void pollLatest(sub);
      sub.timer = setInterval(() => { void pollLatest(sub); }, POLL_MS);
    },

    unsubscribeBars(subscriberUID: string) {
      const sub = subs.get(subscriberUID);
      if (sub?.timer) clearInterval(sub.timer);
      subs.delete(subscriberUID);
    },
  };
}

export type SwissCrestaDatafeed = ReturnType<typeof createDatafeed>;
