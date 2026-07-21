/**
 * TradingView Charting Library datafeed for SwissCresta.
 *
 * History  → GET /api/v1/instruments/{symbol}/bars?resolution=&from=&to=
 *            (returns [{ time (epoch SECONDS), open, high, low, close, volume }])
 * Realtime → WS /ws/bars (barsSocket). The gateway relays server-aggregated
 *            forming + closed bars; TradingView redraws the candle with the
 *            same `time` in place (the live candle) and opens a new one when
 *            `time` advances. A slow REST poll of the same /bars endpoint runs
 *            as a fallback so the candle still advances if the socket is down.
 *
 * The server serves only the BASE resolutions (1,5,15,30,60,240,1D); the
 * library builds 3m/10m/45m/2h/3h and 1W/1M/3M/6M/12M itself from those, so
 * the datafeed only ever receives base-resolution requests.
 *
 * Framework-agnostic (plain module) so both the web terminal and the mobile
 * WebView load the exact same chart. Market data is public.
 */

import { barsSocket } from '@/lib/ws/barsSocket';

type Bar = { time: number; open: number; high: number; low: number; close: number; volume: number };

export type DatafeedInstrument = { symbol: string; digits?: number; segment?: string };

// The SERVER serves only the base resolutions (1,5,15,30,60,240,1D).
// SUPPORTED_RESOLUTIONS is what the chart OFFERS the user — the library derives
// the extras from the base resolutions (intraday from intraday_multipliers,
// W/M/3M/6M/12M from 1D).
const SUPPORTED_RESOLUTIONS = [
  '1', '3', '5', '10', '15', '30', '45', '60', '120', '180', '240',
  '1D', '1W', '1M', '3M', '6M', '12M',
] as const;
const INTRADAY_MULTIPLIERS = ['1', '5', '15', '30', '60', '240'];
const DAILY_MULTIPLIERS = ['1'];

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
  // Current half-spread (price units) for a symbol, from the SAME store tick
  // the order panel renders. Server bars are MID-based; we shift every bar
  // (history AND realtime) DOWN by this so the chart's last price == panel BID
  // == a buy position's current price (MT4/MT5 convention). Returns 0 when the
  // spread is unknown (→ no shift, chart at mid). The spread is the admin
  // spread (constant per symbol), so the whole series shifts uniformly with no
  // seam between history and the live candle.
  getHalfSpread?: (symbol: string) => number;
}) {
  const apiBase = (opts.apiBase || '/api/v1').replace(/\/$/, '');
  let instruments = opts.instruments || [];
  const getHalfSpread = opts.getHalfSpread;

  // Shift a MID bar down to the BID basis (OHLC only; volume untouched).
  function toBid(b: Bar, symbol: string): Bar {
    const hs = getHalfSpread?.(symbol) ?? 0;
    if (!hs) return b;
    return {
      time: b.time,
      open: b.open - hs, high: b.high - hs, low: b.low - hs, close: b.close - hs,
      volume: b.volume,
    };
  }

  // subscriberUID → live subscription
  type Sub = {
    symbol: string;
    resolution: string;
    emit: (b: Bar) => void;
    timer: ReturnType<typeof setInterval> | null;
  };
  const subs = new Map<string, Sub>();
  // `${symbol}|${resolution}` → last pushed bar, so we never emit an
  // out-of-order tick AND so different timeframes on the same symbol don't
  // clobber each other's realtime state.
  const lastBars = new Map<string, Bar>();

  function barKey(symbol: string, resolution: string) {
    return `${symbol}|${resolution}`;
  }

  // Realtime primary is the WS bar stream; this slow poll is only a safety net
  // (spec §7) for when /ws/bars is unavailable. It shares the same
  // non-decreasing dedup so it never fights the socket.
  const FALLBACK_POLL_MS = 4000;

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
      sub.emit(toBid(nb, sub.symbol)); // MID → BID basis
    } catch {
      /* transient — the next poll retries */
    }
  }

  // Crypto trades 24/7; everything else closes on weekends.
  function isCryptoSymbol(symbol: string): boolean {
    const s = symbol.toUpperCase();
    const inst = instruments.find((i) => i.symbol.toUpperCase() === s);
    const seg = String(inst?.segment || '').toLowerCase();
    if (seg) return seg.includes('crypto');
    return /BTC|ETH|SOL|XRP|LTC|DOGE|BNB|ADA/.test(s);
  }

  // Drop closed-market weekend candles from a NON-crypto symbol's history.
  // Forex / metals / indices are closed from Friday ~21:00 UTC until Sunday
  // ~21:00-22:00 UTC, so bars inside that window are "no-trade" fillers that
  // clutter the chart. The Sunday-night reopen session (from 21:00 UTC) is
  // REAL trading data and must be kept — dropping all-of-Sunday-UTC blanks
  // the first hours of Monday's Asian session (sibling-platform client
  // report: "3:30-5:30 AM IST gap"). Crypto (24/7) is untouched. Weekday and
  // hour are read in UTC — bar.time is bar-open in ms UTC.
  function dropWeekendBars(bars: Bar[], symbol: string): Bar[] {
    if (isCryptoSymbol(symbol)) return bars;
    return bars.filter((b) => {
      const d = new Date(b.time);
      const day = d.getUTCDay(); // 0 = Sun, 6 = Sat
      if (day === 6) return false;                 // Saturday: closed all day
      if (day === 0) return d.getUTCHours() >= 21; // Sunday: keep from the 21:00 UTC reopen
      return true;
    });
  }

  return {
    setInstruments(list: DatafeedInstrument[]) {
      instruments = list || [];
    },

    onReady(callback: (config: unknown) => void) {
      setTimeout(() => callback({
        supported_resolutions: SUPPORTED_RESOLUTIONS,
        intraday_multipliers: INTRADAY_MULTIPLIERS,
        // The library builds W/M/3M/6M/12M from daily bars.
        has_weekly_and_monthly: false,
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
        intraday_multipliers: INTRADAY_MULTIPLIERS,
        has_daily: true,
        daily_multipliers: DAILY_MULTIPLIERS,
        // Library builds weekly/monthly from the daily bars.
        has_weekly_and_monthly: false,
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
        // Retry transient 5xx (the gateway can briefly 503 during load / a
        // rebuild) with backoff so the chart never flashes "Symbol Error" for a
        // blip. A 4xx is a real error — surface it immediately.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let raw: any = null;
        let lastStatus = '';
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            const res = await fetch(url, { credentials: 'include' });
            if (res.ok) { raw = await res.json(); break; }
            lastStatus = `HTTP ${res.status}`;
            if (res.status < 500) { onError(lastStatus); return; }
          } catch (e) {
            lastStatus = e instanceof Error ? e.message : String(e);
          }
          if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
        if (raw == null) { onError(lastStatus || 'load failed'); return; }
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
          .sort((a: Bar, b: Bar) => a.time - b.time)
          .map((b: Bar) => toBid(b, symbol)); // MID → BID basis

        const cleaned = dropWeekendBars(bars, symbol);
        const last = cleaned[cleaned.length - 1];
        if (firstDataRequest && last) {
          lastBars.set(barKey(symbol, resolution), { ...last });
        }
        // noData reflects the RAW fetch — an all-weekend window that filtered
        // to zero must not be reported as end-of-history.
        onResult(cleaned, { noData: bars.length === 0 });
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
      }
    },

    subscribeBars(
      symbolInfo: { ticker?: string; name?: string },
      resolution: string,
      onTick: (b: Bar) => void,
      subscriberUID: string,
      onResetCacheNeededCallback?: () => void,
    ) {
      const symbol = (symbolInfo.ticker || symbolInfo.name || '').toUpperCase();
      const key = barKey(symbol, resolution);

      // Shared emit: enforces TradingView's non-decreasing time rule and
      // dedups across the WS stream and the fallback poll.
      const emit = (b: Bar) => {
        const prev = lastBars.get(key);
        if (!prev || b.time >= prev.time) {
          lastBars.set(key, b);
          onTick({ ...b });
        }
      };

      const sub: Sub = { symbol, resolution, emit, timer: null };
      subs.set(subscriberUID, sub);

      // Primary: live WS bar stream (server-aggregated forming + closed bars).
      barsSocket.subscribe(
        subscriberUID,
        symbol,
        resolution,
        (bar) => emit(toBid({
          time: bar.time * 1000, // epoch seconds → ms
          open: bar.open, high: bar.high, low: bar.low,
          close: bar.close, volume: bar.volume,
        }, symbol)), // MID → BID basis
        // On socket reconnect, drop the realtime cache so the chart re-fetches
        // bars missed while the connection was down.
        () => onResetCacheNeededCallback?.(),
      );

      // Fallback safety net (spec §7): a slow poll so the candle still advances
      // if /ws/bars is unavailable. Shared dedup means it never fights the WS.
      void pollLatest(sub);
      sub.timer = setInterval(() => { void pollLatest(sub); }, FALLBACK_POLL_MS);
    },

    unsubscribeBars(subscriberUID: string) {
      const sub = subs.get(subscriberUID);
      if (sub?.timer) clearInterval(sub.timer);
      barsSocket.unsubscribe(subscriberUID);
      subs.delete(subscriberUID);
    },
  };
}

export type SwissCrestaDatafeed = ReturnType<typeof createDatafeed>;
