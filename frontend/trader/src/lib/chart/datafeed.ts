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

function wsPricesUrl(): string {
  if (typeof window === 'undefined') return '';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/prices`;
}

export function createDatafeed(opts: {
  apiBase?: string; // defaults to same-origin /api/v1
  instruments?: DatafeedInstrument[];
}) {
  const apiBase = (opts.apiBase || '/api/v1').replace(/\/$/, '');
  let instruments = opts.instruments || [];

  // subscriberUID → live subscription
  type Sub = { symbol: string; resolution: string; onTick: (b: Bar) => void };
  const subs = new Map<string, Sub>();
  // symbol → last known bar (seeded from history so realtime extends it cleanly)
  const lastBars = new Map<string, Bar>();

  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function ensureSocket() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
    try {
      socket = new WebSocket(wsPricesUrl());
    } catch {
      scheduleReconnect();
      return;
    }
    socket.onmessage = (ev: MessageEvent) => {
      let d: { symbol?: string; bid?: number; ask?: number; type?: string };
      try {
        d = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      if (!d || !d.symbol || d.type === 'ping') return; // ignore heartbeats
      const bid = Number(d.bid);
      const ask = Number(d.ask);
      const price = Number.isFinite(bid) && Number.isFinite(ask) ? (bid + ask) / 2 : bid || ask;
      if (!Number.isFinite(price)) return;
      const nowMs = Date.now();
      subs.forEach((sub) => {
        if (sub.symbol !== d.symbol) return;
        const stepMs = resSeconds(sub.resolution) * 1000;
        const barStart = Math.floor(nowMs / stepMs) * stepMs;
        const prev = lastBars.get(sub.symbol);
        if (!prev || barStart > prev.time) {
          // New candle. Open at the previous close for continuity when we have it.
          const open = prev ? prev.close : price;
          const nb: Bar = { time: barStart, open, high: Math.max(open, price), low: Math.min(open, price), close: price, volume: 0 };
          lastBars.set(sub.symbol, nb);
          sub.onTick({ ...nb });
        } else {
          const b = prev;
          b.close = price;
          if (price > b.high) b.high = price;
          if (price < b.low) b.low = price;
          sub.onTick({ ...b });
        }
      });
    };
    socket.onclose = () => scheduleReconnect();
    socket.onerror = () => { try { socket?.close(); } catch { /* noop */ } };
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (subs.size > 0) ensureSocket();
    }, 2000);
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
      subs.set(subscriberUID, { symbol, resolution, onTick });
      ensureSocket();
    },

    unsubscribeBars(subscriberUID: string) {
      subs.delete(subscriberUID);
      if (subs.size === 0 && socket) {
        try { socket.close(); } catch { /* noop */ }
        socket = null;
      }
    },
  };
}

export type SwissCrestaDatafeed = ReturnType<typeof createDatafeed>;
