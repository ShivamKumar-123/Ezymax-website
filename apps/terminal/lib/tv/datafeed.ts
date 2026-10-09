"use client";

// TradingView JS-API datafeed (docs/TERMINAL-DESIGN.md Part 7) over the terminal's own market data: candle history from
// the market-data service (fetchCandles), the live forming bar and quotes from priceFeed(), the simulator's history and
// ticks when the service is offline. Bars are drawn in server time like every Ezymex chart (lib/chart-time.ts): the
// symbol's time zone is UTC and bar times are shifted to server time, so the axis, the clock and the countdown read
// server time; sessions are written in server time too.
import { INSTRUMENT_MAP, fetchCandles, getInstrument, priceFeed, type AssetClass, type Candle, type Instrument } from "@ezymex/mock";
import { visibleInstruments, visibleSymbol } from "@/lib/scope";
import { TF_SECONDS, TIMEFRAMES, type Timeframe } from "@/lib/trading";
import { LiveChartBars, buildHistory, chartSeries, fromChartTime, toChartTime, type ChartSeries } from "@/lib/chart-time";
import type { TvBar, TvDatafeed, TvQuote, TvResolution, TvSearchResult, TvSymbolInfo } from "./types";

/** Our timeframes as TradingView resolutions. */
export const TF_RES: Record<Timeframe, TvResolution> = { M1: "1", M5: "5", M15: "15", M30: "30", H1: "60", H4: "240", D1: "1D", W1: "1W", MN: "1M" };
export const RESOLUTIONS: TvResolution[] = TIMEFRAMES.map((tf) => TF_RES[tf]);

/** A TradingView resolution as our timeframe ("D" and "1D" alike), or null for one we don't serve. */
export function resToTf(res: TvResolution): Timeframe | null {
  const r = res === "D" ? "1D" : res === "W" ? "1W" : res === "M" ? "1M" : res;
  return TIMEFRAMES.find((tf) => TF_RES[tf] === r) ?? null;
}

/** "EURUSD", or "EXCHANGE:EURUSD" from TradingView's search: our symbol. */
export const tvSymbol = (name: string) => name.slice(name.lastIndexOf(":") + 1);

/**
 * Trading hours in server time (TradingView days: 1 Sunday … 7 Saturday). Bars outside them are not drawn by the
 * library, so they must cover every bar the service stores: FX, metals, energies and indices Monday 00:00 to Friday
 * 24:00 (a fixed week in server time, New York close); US shares 09:30–16:00 New York = 16:30–23:00; Asian shares
 * move against server time with US daylight saving, so they get the span of both offsets; crypto never closes.
 */
function sessionOf(i: Instrument): string {
  if (i.assetClass === "crypto" || i.session === "24x7") return "24x7";
  if (i.session === "hk_equity") return "0330-1100:23456";
  if (i.session === "jp_equity") return "0200-0930:23456";
  if (i.session === "sg_equity") return "0300-1200:23456";
  if (i.assetClass === "stocks") return "1630-2300:23456";
  return "0000-0000:23456";
}

/** The library's symbol: `broker` names the market's venue when the instrument has no exchange of its own. */
export function symbolInfo(symbol: string, broker: string): TvSymbolInfo {
  const i = getInstrument(symbol);
  return {
    name: i.symbol,
    ticker: i.symbol,
    description: i.name,
    type: i.assetClass,
    session: sessionOf(i),
    timezone: "Etc/UTC",
    exchange: i.exchange || broker,
    listed_exchange: i.exchange || broker,
    format: "price",
    pricescale: 10 ** i.digits,
    minmov: 1,
    has_intraday: true,
    has_daily: true,
    has_weekly_and_monthly: true,
    supported_resolutions: RESOLUTIONS,
    intraday_multipliers: ["1", "5", "15", "30", "60", "240"],
    volume_precision: 0,
    data_status: "streaming",
    visible_plots_set: "ohlcv",
  };
}

const DAY = 86400;
/** The chart-time bar a moment belongs to: intraday and D1 by their length (D1 from server midnight), weeks from
 *  Monday (the library's weeks), months from the 1st. */
function bucket(t: number, tf: Timeframe): number {
  if (tf === "W1") {
    const d = Math.floor(t / DAY);
    return (d - ((d + 3) % 7)) * DAY; // 1970-01-01 was a Thursday
  }
  if (tf === "MN") {
    const d = new Date(t * 1000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
  }
  const step = TF_SECONDS[tf];
  return Math.floor(t / step) * step;
}

/** The simulator's history on calendar periods for W1 / MN (the library aligns those), as is otherwise. */
function simHistory(symbol: string, tf: Timeframe): Candle[] {
  const bars = buildHistory(symbol, tf);
  if (tf !== "W1" && tf !== "MN") return bars;
  let t = bucket(toChartTime(Math.floor(Date.now() / 1000)), tf);
  const out = bars.slice();
  for (let i = out.length - 1; i >= 0; i--) {
    out[i] = { ...out[i]!, time: t };
    t = tf === "W1" ? t - 7 * DAY : bucket(t - DAY, tf);
  }
  return out;
}

/** A bar for the library: a new object every time (it keeps and edits the bars it is given), time in ms. */
const tvBar = (b: Candle): TvBar => ({ time: b.time * 1000, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume });

function quoteOf(symbol: string): TvQuote {
  const q = priceFeed().quote(symbol);
  const day = priceFeed().day(symbol);
  const i = INSTRUMENT_MAP[symbol];
  const last = q.last || (q.bid + q.ask) / 2;
  return {
    s: "ok",
    n: symbol,
    v: { bid: q.bid, ask: q.ask, lp: last, spread: q.ask - q.bid, chp: q.change, ch: day ? last - day.open : 0, short_name: symbol, description: i?.name, exchange: i?.exchange ?? "", open_price: day?.open, high_price: day?.high, low_price: day?.low },
  };
}

export interface DatafeedOptions {
  /** search filter names, translated: "All" and one per asset class */
  types: { all: string } & Record<AssetClass, string>;
  /** the broker's name: the venue of markets without an exchange of their own (FX, metals, indices…) */
  broker: string;
  /** the cache was reset (simulator → live service, a reconnect, the hour repeated at the end of US DST): the chart
   *  must request its bars again */
  onReset: () => void;
}

/** One datafeed per chart widget. */
export function createDatafeed(opts: DatafeedOptions): TvDatafeed & { dispose: () => void } {
  // per symbol|timeframe: drawn from the simulator, the newest bar handed to the library, how it was built
  const sim = new Set<string>();
  const newest = new Map<string, Candle>();
  const tails = new Map<string, Pick<ChartSeries, "utc" | "base">>();
  const bars = new Map<string, { off: () => void; reset: () => void }>();
  const quotes = new Map<string, () => void>();
  const later = (f: () => void) => setTimeout(f, 0); // the library expects its callbacks asynchronously

  const resetAll = () => {
    sim.clear();
    newest.clear();
    tails.clear();
    bars.forEach((b) => b.reset());
    opts.onReset();
  };
  // the service came up after a simulator period, or the stream reconnected / the tab came back: reload the bars
  const offMode = priceFeed().onMode(() => priceFeed().mode === "live" && sim.size > 0 && resetAll());
  const offResync = priceFeed().onResync(resetAll);

  const classes = [...new Set(visibleInstruments().map((i) => i.assetClass))];

  return {
    onReady: (cb) =>
      later(() =>
        cb({
          supported_resolutions: RESOLUTIONS,
          supports_time: true,
          supports_marks: false,
          supports_timescale_marks: false,
          exchanges: [],
          symbols_types: [{ name: opts.types.all, value: "" }, ...classes.map((c) => ({ name: opts.types[c], value: c }))],
        }),
      ),

    // server time for the clock and the bar countdown, in the same shifted frame as the bars
    getServerTime: (cb) => later(() => cb(toChartTime(Math.floor(Date.now() / 1000)))),

    searchSymbols: (input, _exchange, type, onResult) => {
      const q = input.trim().toUpperCase();
      const rank = (i: Instrument) => (!q ? 0 : i.symbol === q ? 0 : i.symbol.startsWith(q) ? 1 : i.symbol.includes(q) ? 2 : 3);
      const list = visibleInstruments()
        .filter((i) => (!type || i.assetClass === type) && (!q || i.symbol.includes(q) || i.name.toUpperCase().includes(q)))
        .map((i) => [rank(i), i] as const)
        .sort((a, b) => a[0] - b[0])
        .slice(0, 60)
        .map(([, i]): TvSearchResult => ({ symbol: i.symbol, full_name: i.symbol, description: i.name, exchange: i.exchange || opts.broker, ticker: i.symbol, type: i.assetClass }));
      later(() => onResult(list));
    },

    resolveSymbol: (name, onResolve, onError) => {
      const symbol = tvSymbol(name);
      later(() => (INSTRUMENT_MAP[symbol] && visibleSymbol(symbol) ? onResolve(symbolInfo(symbol, opts.broker)) : onError("unknown_symbol")));
    },

    getBars: (info, res, period, onResult) => {
      const tf = resToTf(res);
      const symbol = info.name;
      if (!tf) return later(() => onResult([], { noData: true }));
      const key = `${symbol}|${tf}`;
      void (async () => {
        await priceFeed().ready; // resolves once ("sim" stays resolved): read the current mode instead
        const fromSim = () => {
          // the simulator draws one page; a symbol the service has no history for falls back to it too (as our chart)
          if (!period.firstDataRequest) return onResult([], { noData: true });
          sim.add(key);
          const h = simHistory(symbol, tf);
          newest.set(key, h[h.length - 1]!);
          onResult(h.map(tvBar), { noData: false });
        };
        if (priceFeed().mode !== "live" || (sim.has(key) && !period.firstDataRequest)) return fromSim();
        const limit = Math.min(5000, Math.max(period.countBack + 2, 300));
        // the service's `to` is inclusive and UTC; the library's is exclusive and in chart time. The first page has
        // no `to`, so it carries the forming bar.
        const utc = await fetchCandles(symbol, tf, limit, period.firstDataRequest ? undefined : fromChartTime(period.to) - 1);
        if (!utc || utc.length === 0) return period.firstDataRequest ? fromSim() : onResult([], { noData: true });
        const s = chartSeries(utc);
        const page = period.firstDataRequest ? s.bars : s.bars.filter((b) => b.time < period.to);
        if (period.firstDataRequest) {
          sim.delete(key);
          newest.set(key, page[page.length - 1]!);
          tails.set(key, s);
        }
        onResult(page.map(tvBar), { noData: page.length === 0 });
      })();
    },

    subscribeBars: (info, res, onTick, guid, onReset) => {
      const tf = resToTf(res);
      if (!tf) return;
      const symbol = info.name;
      const key = `${symbol}|${tf}`;
      let off: () => void;
      if (!sim.has(key)) {
        // the service pushes the exact forming bar (built from the last trade price, as stored)
        const live = new LiveChartBars();
        live.reset(tails.get(key));
        off = priceFeed().subscribeBars(symbol, tf, (b) => {
          const bar = live.map({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }, newest.get(key));
          if (live.stale) resetAll();
          if (!bar) return;
          newest.set(key, bar);
          onTick(tvBar(bar));
        });
      } else {
        // simulator: the forming bar from bid ticks, bucketed in server time (as our own chart)
        off = priceFeed().subscribe([symbol], (q) => {
          const last = newest.get(key);
          if (!last || !(q.bid > 0)) return;
          const t = bucket(toChartTime(Math.floor(q.time / 1000)), tf);
          const bar: Candle =
            t > last.time
              ? { time: t, open: last.close, high: Math.max(last.close, q.bid), low: Math.min(last.close, q.bid), close: q.bid, volume: 1 }
              : { ...last, high: Math.max(last.high, q.bid), low: Math.min(last.low, q.bid), close: q.bid, volume: last.volume + Math.round(1 + Math.random() * 6) };
          newest.set(key, bar);
          onTick(tvBar(bar));
        });
      }
      bars.get(guid)?.off();
      bars.set(guid, { off, reset: onReset });
    },

    unsubscribeBars: (guid) => {
      bars.get(guid)?.off();
      bars.delete(guid);
    },

    getQuotes: (symbols, onData) => later(() => onData(symbols.map((s) => quoteOf(tvSymbol(s))))),

    subscribeQuotes: (symbols, fast, onData, guid) => {
      const list = [...new Set([...symbols, ...fast].map(tvSymbol))].filter((s) => INSTRUMENT_MAP[s]);
      quotes.get(guid)?.();
      quotes.set(guid, priceFeed().subscribe(list, (q) => onData([quoteOf(q.symbol)])));
    },

    unsubscribeQuotes: (guid) => {
      quotes.get(guid)?.();
      quotes.delete(guid);
    },

    dispose: () => {
      offMode();
      offResync();
      bars.forEach((b) => b.off());
      bars.clear();
      quotes.forEach((f) => f());
      quotes.clear();
    },
  };
}
