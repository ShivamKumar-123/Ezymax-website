/**
 * Candle series for the AI Trader: real history from the market-data service (fetchCandles), kept
 * current with the live forming bar (priceFeed().subscribeBars). When the service is offline the
 * series is built from quotes (simulator). Bar times are unix seconds UTC.
 *
 * A bar counts as closed when a newer bar arrives, or when its period has elapsed (watchdog),
 * so quiet markets still produce bar-close events.
 */
import { fetchCandles, priceFeed, serverOffset, type Candle } from "@kalks/mock";
import { TF_SECONDS, type Timeframe } from "../trading";

type CloseFn = (bar: Candle, bars: Candle[]) => void;
type TickFn = (bars: Candle[]) => void;

const HISTORY = 600;

export class BarSeries {
  readonly key: string;
  bars: Candle[] = [];
  status: "loading" | "ready" | "error" = "loading";
  source: "history" | "quotes" = "history";
  private closeFns = new Set<CloseFn>();
  private tickFns = new Set<TickFn>();
  private lastClosed = 0;
  private unsubs: (() => void)[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  refs = 0;

  constructor(
    readonly symbol: string,
    readonly tf: Timeframe,
  ) {
    this.key = `${symbol}|${tf}`;
    void this.start();
  }

  private get step() {
    return TF_SECONDS[this.tf];
  }

  private async start() {
    const feed = priceFeed();
    const mode = await feed.ready;
    if (mode === "live") {
      const hist = await fetchCandles(this.symbol, this.tf, HISTORY);
      if (hist && hist.length) {
        this.bars = hist;
        this.source = "history";
      }
    }
    if (!this.bars.length) this.source = "quotes";
    // Everything already in history except the newest bar is closed.
    const last = this.bars[this.bars.length - 1];
    this.lastClosed = last ? (this.isClosed(last) ? last.time : (this.bars[this.bars.length - 2]?.time ?? 0)) : 0;
    this.status = this.bars.length || this.source === "quotes" ? "ready" : "error";

    if (feed.mode === "live" && this.source === "history") {
      this.unsubs.push(
        feed.subscribeBars(this.symbol, this.tf, (b) => {
          this.apply({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v });
        }),
      );
    } else {
      this.unsubs.push(
        feed.subscribe([this.symbol], (q) => {
          const now = Math.floor(q.time / 1000);
          const off = this.tf === "D1" || this.tf === "W1" || this.tf === "MN" ? serverOffset(now) : 0;
          const t = Math.floor((now + off) / this.step) * this.step - off;
          const lastBar = this.bars[this.bars.length - 1];
          if (!lastBar || t > lastBar.time) this.apply({ time: t, open: q.bid, high: q.bid, low: q.bid, close: q.bid, volume: 1 });
          else this.apply({ ...lastBar, high: Math.max(lastBar.high, q.bid), low: Math.min(lastBar.low, q.bid), close: q.bid, volume: lastBar.volume + 1 });
        }),
      );
    }
    this.timer = setInterval(() => this.watchdog(), 1000);
  }

  private isClosed(b: Candle) {
    return Date.now() / 1000 >= b.time + this.step;
  }

  private apply(bar: Candle) {
    const last = this.bars[this.bars.length - 1];
    if (last && bar.time < last.time) return;
    if (!last || bar.time > last.time) {
      if (last && last.time > this.lastClosed) this.emitClose(last);
      this.bars.push(bar);
      if (this.bars.length > HISTORY * 2) this.bars.splice(0, this.bars.length - HISTORY);
    } else this.bars[this.bars.length - 1] = bar;
    this.tickFns.forEach((f) => f(this.bars));
  }

  private watchdog() {
    const last = this.bars[this.bars.length - 1];
    // a bar whose period has elapsed (+2s grace for the final update) is closed even if no new bar came yet
    if (last && last.time > this.lastClosed && Date.now() / 1000 >= last.time + this.step + 2) this.emitClose(last);
  }

  private emitClose(bar: Candle) {
    this.lastClosed = bar.time;
    const closed = this.closedBars();
    this.closeFns.forEach((f) => f(bar, closed));
  }

  /** Bars that are closed (drops the forming bar). */
  closedBars(): Candle[] {
    const last = this.bars[this.bars.length - 1];
    if (!last) return [];
    return last.time <= this.lastClosed ? this.bars : this.bars.slice(0, -1);
  }

  onClose(f: CloseFn) {
    this.closeFns.add(f);
    return () => this.closeFns.delete(f);
  }
  onTick(f: TickFn) {
    this.tickFns.add(f);
    return () => this.tickFns.delete(f);
  }

  dispose() {
    this.unsubs.forEach((u) => u());
    if (this.timer) clearInterval(this.timer);
    this.closeFns.clear();
    this.tickFns.clear();
  }
}

/** Shared, ref-counted series so several strategies on the same symbol/timeframe share one stream. */
const pool = new Map<string, BarSeries>();
export function acquireSeries(symbol: string, tf: Timeframe): BarSeries {
  const key = `${symbol}|${tf}`;
  let s = pool.get(key);
  if (!s) {
    s = new BarSeries(symbol, tf);
    pool.set(key, s);
  }
  s.refs++;
  return s;
}
export function releaseSeries(s: BarSeries) {
  s.refs--;
  if (s.refs <= 0) {
    s.dispose();
    pool.delete(s.key);
  }
}
