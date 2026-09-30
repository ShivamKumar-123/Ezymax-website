// Live quotes from the public market-data stream (wss://api.<domain>/v1/stream), with the account group's spread.
//
// Performance model: a tick never re-renders React. Every symbol owns Reanimated shared values (bid, ask, dir,
// change); price cells read them on the UI thread (PriceCell, useAnimatedProps). JS consumers that need the
// number at an action (order ticket, P&L maths) read `feed.quote(symbol)` or subscribe with `feed.on()`.
// Reconnects with backoff, a 12 s silence watchdog, a REST snapshot after every reconnect / foreground, and
// closes the socket when the app has been in the background for 30 s (battery).
import { AppState } from "react-native";
import { makeMutable, type SharedValue } from "react-native-reanimated";
import { netStore } from "@/lib/net";
import { createStore } from "@/lib/store";
import { loadConfig, type MarketConfig } from "./config";
import { instruments, loadInstruments } from "./instruments";

export type Quote = { symbol: string; bid: number; ask: number; last: number; open: number; high: number; low: number; t: number; dir: -1 | 0 | 1 };
export type LiveBar = { t: number; o: number; h: number; l: number; c: number; v: number };
/** Depth of market with the account group's spread (levels best first, [price, lots]); `indicative` = built from
 *  the live bid / ask (no provider book for the symbol), `feed` = the provider's book. */
export type DepthBook = { symbol: string; src: "feed" | "indicative"; t: number; bids: [number, number][]; asks: [number, number][] };

export type QuoteValues = {
  bid: SharedValue<number>;
  ask: SharedValue<number>;
  /** +1 up / -1 down tick; `seq` increments on every change (drives the price flash) */
  dir: SharedValue<number>;
  seq: SharedValue<number>;
  /** % change from the day open */
  change: SharedValue<number>;
};

type RawQuote = { bid: number; ask: number; last?: number; o?: number; h?: number; l?: number; t: number };

export type FeedStatus = "connecting" | "live" | "offline";
export const feedStatus = createStore<{ status: FeedStatus; group: string }>({ status: "connecting", group: "standard" });

class QuoteFeed {
  private quotes = new Map<string, Quote>();
  private values = new Map<string, QuoteValues>();
  private listeners = new Map<string, Set<(q: Quote) => void>>();
  private barListeners = new Map<string, Set<(b: LiveBar) => void>>();
  private depthListeners = new Map<string, Set<(d: DepthBook) => void>>();
  private depthLevels = 10;
  private anyListeners = new Set<() => void>();
  private ws: WebSocket | null = null;
  private cfg: MarketConfig | null = null;
  private group = "standard";
  private backoff = 0;
  private lastFrame = 0;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private bgTimer: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  private paused = false;
  /** symbols the service has prices for (others are hidden from lists) */
  readonly available = new Set<string>();
  /** receive latency samples: phone receive − service receive (ms) */
  private lat: number[] = [];
  /** ticks received in the current second (perf overlay) */
  ticks = 0;

  /** Shared values for a symbol (created on first use; stable for the app's lifetime). */
  sv(symbol: string): QuoteValues {
    let v = this.values.get(symbol);
    if (!v) {
      const q = this.quotes.get(symbol);
      v = { bid: makeMutable(q?.bid ?? 0), ask: makeMutable(q?.ask ?? 0), dir: makeMutable(0), seq: makeMutable(0), change: makeMutable(q ? pct(q) : 0) };
      this.values.set(symbol, v);
    }
    return v;
  }

  quote(symbol: string): Quote | undefined {
    return this.quotes.get(symbol);
  }

  /** Mid price of a symbol, for conversions. */
  mid(symbol: string): number | undefined {
    const q = this.quotes.get(symbol);
    return q ? (q.bid + q.ask) / 2 : undefined;
  }

  /** JS subscription to one symbol's quotes (order ticket, P&L). Prefer shared values for display. */
  on(symbol: string, fn: (q: Quote) => void): () => void {
    let set = this.listeners.get(symbol);
    if (!set) this.listeners.set(symbol, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }

  /** Called after a snapshot is applied (lists re-sort, availability changes). */
  onSnapshot(fn: () => void): () => void {
    this.anyListeners.add(fn);
    return () => this.anyListeners.delete(fn);
  }

  /** The forming bar of symbol / timeframe (chart). */
  subscribeBars(symbol: string, tf: string, fn: (b: LiveBar) => void): () => void {
    const key = `${symbol}|${tf}`;
    let set = this.barListeners.get(key);
    if (!set) {
      this.barListeners.set(key, (set = new Set()));
      this.send({ op: "bars", symbol, tf });
    }
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (!set!.size) {
        this.barListeners.delete(key);
        this.send({ op: "unbars", symbol, tf });
      }
    };
  }

  /** Depth of market of `symbol` on every quote change (a frame right after subscribing, again after reconnects). */
  subscribeDepth(symbol: string, fn: (d: DepthBook) => void, levels = 10): () => void {
    let set = this.depthListeners.get(symbol);
    if (!set) {
      this.depthListeners.set(symbol, (set = new Set()));
      this.depthLevels = levels;
      this.send({ op: "depth", symbols: [symbol], levels });
    }
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (!set!.size) {
        this.depthListeners.delete(symbol);
        this.send({ op: "undepth", symbols: [symbol] });
      }
    };
  }

  latency(): { p50: number; p95: number; n: number } {
    const s = [...this.lat].sort((a, b) => a - b);
    const at = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
    return { p50: at(0.5), p95: at(0.95), n: s.length };
  }

  /** Account group whose spread the quotes carry (standard / pro / ecn / cent …). */
  setGroup(group: string) {
    const g = (group || "standard").toLowerCase();
    if (g === this.group) return;
    this.group = g;
    feedStatus.set((s) => ({ ...s, group: g }));
    if (!this.started) return;
    void this.snapshot();
    this.reopen();
  }

  start() {
    if (this.started) return;
    this.started = true;
    void (async () => {
      this.cfg = await loadConfig();
      await loadInstruments();
      if (!this.cfg) {
        feedStatus.set((s) => ({ ...s, status: "offline" }));
        setTimeout(() => {
          this.started = false;
          this.start();
        }, 3000);
        return;
      }
      this.open();
      void this.snapshot();
      this.startWatchdog();
    })();
    AppState.addEventListener("change", (s) => {
      if (s === "active") {
        if (this.bgTimer) clearTimeout(this.bgTimer);
        this.bgTimer = null;
        if (this.paused) {
          this.paused = false;
          this.open();
        }
        void this.snapshot();
      } else if (!this.bgTimer) {
        this.bgTimer = setTimeout(() => {
          this.paused = true;
          this.close();
        }, 30_000);
      }
    });
    netStore.subscribe(() => {
      if (netStore.get().online && !this.paused) {
        this.backoff = 0;
        this.reopen();
        void this.snapshot();
      }
    });
  }

  /** REST snapshot of every quote (start-up, reconnects, foreground). */
  async snapshot(): Promise<boolean> {
    const cfg = this.cfg ?? (await loadConfig());
    if (!cfg) return false;
    // a stalled request must not hold pull-to-refresh (or a reconnect) for minutes
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(`${cfg.marketData.http}/v1/quotes?group=${encodeURIComponent(this.group)}`, { signal: ctrl.signal });
      if (!res.ok) return false;
      const data = (await res.json()) as Record<string, RawQuote>;
      for (const [symbol, q] of Object.entries(data)) {
        this.available.add(symbol);
        this.apply(symbol, q, true);
      }
      this.anyListeners.forEach((f) => f());
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  private apply(symbol: string, q: RawQuote, snapshot = false) {
    if (!(q.bid > 0) || !(q.ask > 0)) return;
    const prev = this.quotes.get(symbol);
    if (snapshot && prev && prev.t > q.t) return; // a stream quote newer than the REST answer wins
    const last = q.last || (q.bid + q.ask) / 2;
    const open = q.o ?? prev?.open ?? last;
    const next: Quote = {
      symbol,
      bid: q.bid,
      ask: q.ask,
      last,
      open,
      high: Math.max(q.h ?? last, prev?.high ?? last),
      low: Math.min(q.l ?? last, prev?.low ?? last),
      t: q.t,
      dir: !prev ? 0 : q.bid > prev.bid ? 1 : q.bid < prev.bid ? -1 : 0,
    };
    if (snapshot && q.h !== undefined) next.high = q.h;
    if (snapshot && q.l !== undefined) next.low = q.l;
    if (prev && prev.bid === next.bid && prev.ask === next.ask) {
      this.quotes.set(symbol, next);
      return;
    }
    this.quotes.set(symbol, next);
    const v = this.values.get(symbol);
    if (v) {
      v.bid.value = next.bid;
      v.ask.value = next.ask;
      v.change.value = pct(next);
      if (next.dir !== 0) {
        v.dir.value = next.dir;
        v.seq.value = v.seq.value + 1;
      }
    }
    this.listeners.get(symbol)?.forEach((fn) => fn(next));
  }

  private send(m: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  private open() {
    if (!this.cfg || this.ws || this.paused) return;
    const ws = new WebSocket(`${this.cfg.marketData.ws}?group=${encodeURIComponent(this.group)}`);
    this.ws = ws;
    this.lastFrame = Date.now();
    ws.onopen = () => {
      this.backoff = 0;
      this.lastFrame = Date.now();
      const symbols = instruments().map((i) => i.symbol);
      ws.send(JSON.stringify({ op: "subscribe", symbols }));
      // the catalogue failed to load at start (first launch offline): load it now and subscribe to it
      if (!symbols.length)
        void loadInstruments().then((list) => {
          if (list.length && this.ws === ws) this.send({ op: "subscribe", symbols: list.map((i) => i.symbol) });
        });
      for (const key of this.barListeners.keys()) {
        const [symbol, tf] = key.split("|");
        ws.send(JSON.stringify({ op: "bars", symbol, tf }));
      }
      if (this.depthListeners.size) ws.send(JSON.stringify({ op: "depth", symbols: [...this.depthListeners.keys()], levels: this.depthLevels }));
      feedStatus.set((s) => ({ ...s, status: "live" }));
    };
    ws.onmessage = (e) => {
      const now = Date.now();
      this.lastFrame = now;
      let m: { type?: string; s?: string; b?: number; a?: number; l?: number; t?: number; r?: number; tf?: string; o?: number; h?: number; c?: number; v?: number };
      try {
        m = JSON.parse(e.data as string);
      } catch {
        return;
      }
      if (m.type === "quote" && m.s) {
        this.ticks++;
        if (m.r && m.r > 0) {
          this.lat.push(now - m.r);
          if (this.lat.length > 500) this.lat.shift();
        }
        this.available.add(m.s);
        this.apply(m.s, { bid: m.b!, ask: m.a!, last: m.l, t: m.t ?? now });
      } else if (m.type === "bar" && m.s && m.tf) {
        const bar = { t: m.t!, o: m.o!, h: m.h!, l: m.l!, c: m.c!, v: m.v ?? 0 };
        this.barListeners.get(`${m.s}|${m.tf}`)?.forEach((fn) => fn(bar));
      } else if (m.type === "depth" && m.s) {
        const set = this.depthListeners.get(m.s);
        const d = m as unknown as { src?: string; t?: number; b?: [number, number][]; a?: [number, number][] };
        if (set && Array.isArray(d.b) && Array.isArray(d.a)) {
          const book: DepthBook = { symbol: m.s, src: d.src === "feed" ? "feed" : "indicative", t: d.t ?? now, bids: d.b, asks: d.a };
          set.forEach((fn) => fn(book));
        }
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.paused) return;
      feedStatus.set((s) => ({ ...s, status: netStore.get().online ? "connecting" : "offline" }));
      setTimeout(() => {
        this.open();
        void this.snapshot();
      }, this.backoff);
      this.backoff = Math.min(Math.max(300, this.backoff * 2), 5000);
    };
    ws.onerror = () => ws.close();
  }

  private close() {
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }

  private reopen() {
    this.close();
    this.open();
  }

  private startWatchdog() {
    if (this.watchdog) return;
    // silent for 12 s, or still connecting after 12 s (a half-dead network can hold a connect for a minute or more)
    this.watchdog = setInterval(() => {
      const ws = this.ws;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) && Date.now() - this.lastFrame > 12_000) {
        this.reopen();
        void this.snapshot();
      }
    }, 3000);
  }
}

function pct(q: Quote): number {
  return q.open > 0 ? ((q.last - q.open) / q.open) * 100 : 0;
}

export const feed = new QuoteFeed();
