import { INSTRUMENTS, INSTRUMENT_MAP, type Instrument } from "./symbols";
import { seeded, hashString } from "./rng";
import { HISTORY, POSITIONS } from "./client";

export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  /** raw last price (charts are built from it) */
  last?: number;
  /** 1D % change vs today's (server-day) open */
  change: number;
  /** +1 up-tick, -1 down-tick, 0 unchanged */
  dir: 1 | -1 | 0;
  /** provider event time (ms) */
  time: number;
}

export interface DayStats {
  open: number;
  high: number;
  low: number;
}

/** A bar pushed by the market-data service; `t` is unix seconds (UTC). */
export interface LiveBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export type FeedMode = "connecting" | "live" | "sim";

/**
 * Depth of market from the market-data service (D97), with the account group's spread applied. `src` is
 * "feed" when the provider carries depth, else "indicative" (levels derived from the live bid/ask).
 * Levels are best first: `[price, lots]`.
 */
export interface DepthBook {
  symbol: string;
  src: "feed" | "indicative";
  t: number;
  bids: [number, number][];
  asks: [number, number][];
}

type Listener = (q: Quote) => void;
type DepthListener = (d: DepthBook) => void;
type RawQuotes = Record<string, { bid: number; ask: number; last: number; t: number; o?: number; h?: number; l?: number }>;
type BarListener = (b: LiveBar) => void;

declare const process: { env: Record<string, string | undefined> };

/** Kalks market-data service (Rust). Same host in every app; override per environment. */
export const MARKET_DATA_URL = (process.env.NEXT_PUBLIC_MARKET_DATA_URL || "http://127.0.0.1:8081").replace(/\/$/, "");

/** Per-symbol factor that moved the mock reference price onto the live price (1 = unchanged). */
const rebase = new Map<string, number>();

/**
 * Re-base demo trade prices (open/SL/TP/pending/close) onto live levels, keeping their distance
 * from the market in %. Demo-only: real accounts come from the trading engine.
 */
const rebased = new WeakSet<object>();
export function rebaseTrades<T extends { symbol: string }>(list: T[]): T[] {
  const keys = ["openPrice", "closePrice", "sl", "tp", "price", "stopLimit"] as const;
  for (const item of list) {
    if (rebased.has(item)) continue; // idempotent: each object is moved once
    const k = rebase.get(item.symbol);
    const inst = INSTRUMENT_MAP[item.symbol];
    if (!k || !inst) continue; // no live level yet (sim / connecting): leave it for the next call
    rebased.add(item);
    if (k === 1) continue;
    const rec = item as unknown as Record<string, unknown>;
    for (const key of keys) {
      const v = rec[key];
      if (typeof v === "number" && v > 0) rec[key] = +(v * k).toFixed(inst.digits);
    }
  }
  return list;
}

/**
 * Price feed shared by every app. Connects to the market-data service: loads the latest quotes
 * (with the account group's spread), then streams quotes and bars over one WebSocket.
 * If the service is unreachable it falls back to a local random-walk simulator.
 */
class PriceFeed {
  private quotes = new Map<string, Quote>();
  private open = new Map<string, number>();
  /** symbols whose `open` came from the service (day open, or the first live mid when it has none) */
  private liveOpen = new Set<string>();
  private days = new Map<string, DayStats>();
  private listeners = new Map<string, Set<Listener>>();
  private barListeners = new Map<string, Set<BarListener>>();
  private depthListeners = new Map<string, Set<DepthListener>>();
  private depths = new Map<string, DepthBook>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private dayTimer: ReturnType<typeof setTimeout> | null = null;
  private rand = seeded(20260924);
  private ws: WebSocket | null = null;
  private group = "standard";
  private fetchedGroup = "";
  private backoff = 0;
  /** last frame from the stream (quotes or the 5s heartbeat) — a silent socket is reconnected */
  private lastFrame = 0;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private opened = false;
  /** Group of the open socket (its quotes carry that group's spread). */
  private wsGroup = "";
  /** Until the feed goes live (first REST snapshot applied after hydration), stream quotes are held here: the
   *  socket opens at start-up in parallel with the snapshot instead of after it, and nothing reaches React early. */
  private holding = true;
  private held = new Map<string, { b: number; a: number; l?: number; t: number }>();
  private hiddenAt = 0;
  private resyncListeners = new Set<() => void>();
  /** symbols the service has no prices for (no provider): removed from INSTRUMENTS in live mode */
  readonly unavailable = new Set<string>();
  /** service-added + network latency samples (ms): browser receive time − service receive time */
  private lat: number[] = [];
  mode: FeedMode = "connecting";
  readonly ready: Promise<FeedMode>;
  private resolveReady!: (m: FeedMode) => void;
  private modeListeners = new Set<() => void>();
  private hydrated: Promise<void>;
  private resolveHydrated!: () => void;

  constructor() {
    for (const inst of INSTRUMENTS) {
      const openPrice = inst.price / (1 + inst.change / 100);
      this.open.set(inst.symbol, openPrice);
      this.quotes.set(inst.symbol, this.makeQuote(inst, inst.price, 0));
    }
    this.ready = new Promise((r) => (this.resolveReady = r));
    this.hydrated = new Promise((r) => (this.resolveHydrated = r));
    if (typeof window === "undefined") this.resolveReady("connecting");
    else {
      this.autoHydrate();
      void this.connect();
    }
  }

  /**
   * Safety net for pages that never call markHydrated(): treat the page as hydrated shortly after
   * window `load`, or after 3s at the latest. Post-mount effects normally resolve it much earlier.
   */
  private autoHydrate() {
    const done = () => this.resolveHydrated();
    const afterLoad = () => setTimeout(done, 500);
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });
    setTimeout(done, 3000);
  }

  private setMode(m: FeedMode) {
    this.mode = m;
    this.modeListeners.forEach((l) => l());
  }

  onMode(fn: () => void): () => void {
    this.modeListeners.add(fn);
    return () => this.modeListeners.delete(fn);
  }

  /**
   * Fired when the stream may have missed data: after a reconnect, or when the tab becomes visible again after
   * being hidden. Charts refetch their latest bars so no gap is left.
   */
  onResync(fn: () => void): () => void {
    this.resyncListeners.add(fn);
    return () => this.resyncListeners.delete(fn);
  }

  private resync() {
    void this.loadQuotes(4000).then((ok) => ok && this.notifyAll());
    this.resyncListeners.forEach((l) => l());
  }

  /** p50/p95 of (browser receive − service receive) over the last 500 quotes, ms. */
  latency(): { p50: number; p95: number; n: number } {
    const s = [...this.lat].sort((a, b) => a - b);
    const at = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
    return { p50: at(0.5), p95: at(0.95), n: s.length };
  }

  private makeQuote(inst: Instrument, mid: number, dir: Quote["dir"]): Quote {
    const half = inst.spread / 2;
    const open = this.open.get(inst.symbol) ?? mid;
    return {
      symbol: inst.symbol,
      bid: +(mid - half).toFixed(inst.digits),
      ask: +(mid + half).toFixed(inst.digits),
      change: ((mid - open) / open) * 100,
      dir,
      time: Date.now(),
    };
  }

  /* ---------------- live (market-data service) ---------------- */

  private async fetchQuotes(timeoutMs: number): Promise<{ group: string; data: RawQuotes } | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const group = this.group;
    try {
      const res = await fetch(`${MARKET_DATA_URL}/v1/quotes?group=${encodeURIComponent(group)}`, { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) return null;
      return { group, data: (await res.json()) as RawQuotes };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private applyQuotes({ group, data }: { group: string; data: RawQuotes }) {
    this.dropUnavailable(data);
    for (const [symbol, q] of Object.entries(data)) {
      const inst = INSTRUMENT_MAP[symbol];
      if (!inst) continue;
      const mid = q.last || (q.bid + q.ask) / 2;
      if (q.o) {
        this.open.set(symbol, q.o);
        this.days.set(symbol, { open: q.o, high: q.h ?? mid, low: q.l ?? mid });
        this.liveOpen.add(symbol);
      } else if (!this.liveOpen.has(symbol)) {
        // no day open from the service: measure change from the first live price (0%), never the mock open
        this.open.set(symbol, mid);
        this.liveOpen.add(symbol);
      }
      const open = this.open.get(symbol)!;
      if (!rebase.has(symbol)) rebase.set(symbol, mid / inst.price);
      // reference data now reflects the real market
      inst.price = mid;
      inst.spread = +(q.ask - q.bid).toFixed(inst.digits);
      inst.change = ((mid - open) / open) * 100;
      const prev = this.quotes.get(symbol);
      // a live stream quote newer than this response wins (the REST reply can be older than the socket)
      if (prev && this.liveTimes.has(symbol) && prev.time > q.t) continue;
      this.quotes.set(symbol, { symbol, bid: q.bid, ask: q.ask, last: mid, change: inst.change, dir: 0, time: q.t });
    }
    this.fetchedGroup = group;
    this.scheduleDayRoll();
  }

  /** symbols that already received a stream quote */
  private liveTimes = new Set<string>();

  /**
   * A symbol the service has no price for (no provider data, e.g. USDINR) must never show the reference
   * price as if it were real: in live mode it is removed from the INSTRUMENTS list (lists, watch, search).
   * INSTRUMENT_MAP keeps it, so old trades/references still resolve.
   */
  private dropUnavailable(data: RawQuotes) {
    if (Object.keys(data).length === 0) return; // an empty reply says nothing about individual symbols
    for (let i = INSTRUMENTS.length - 1; i >= 0; i--) {
      const s = INSTRUMENTS[i]!.symbol;
      if (data[s]) continue;
      this.unavailable.add(s);
      INSTRUMENTS.splice(i, 1);
    }
  }

  /**
   * Day open/high/low roll at New York close (server midnight): reload them right after the next roll.
   * One timer per day — no polling; the stream keeps high/low current in between.
   */
  private scheduleDayRoll() {
    if (typeof window === "undefined") return;
    if (this.dayTimer) clearTimeout(this.dayTimer);
    const now = Math.floor(Date.now() / 1000);
    const off = serverOffset(now);
    const nextMidnight = (Math.floor((now + off) / 86400) + 1) * 86400 - off;
    this.dayTimer = setTimeout(() => void this.loadQuotes(4000).then((ok) => ok && this.notifyAll()), (nextMidnight - now + 2) * 1000);
  }

  private async loadQuotes(timeoutMs: number): Promise<boolean> {
    const r = await this.fetchQuotes(timeoutMs);
    if (!r) return false;
    await this.hydrated;
    this.applyQuotes(r);
    return true;
  }

  /**
   * Called from any post-mount effect: live data is applied only after React has hydrated the server HTML
   * (rendered with reference data), so the first client render always matches the server.
   */
  markHydrated() {
    this.resolveHydrated();
  }

  private async connect() {
    this.openSocket(); // handshake overlaps the snapshot request and hydration
    const ok = await this.loadQuotes(2500);
    if (!ok) {
      this.dropSocket();
      this.setMode("sim");
      this.resolveReady("sim");
      this.ensureSimulator();
      // keep trying in the background; switch to live as soon as the service is up
      setTimeout(() => void this.retryLive(), 5000);
      return;
    }
    await this.goLive();
  }

  private async retryLive() {
    if (this.mode === "live") return;
    if (await this.loadQuotes(2500)) await this.goLive();
    else setTimeout(() => void this.retryLive(), 10_000);
  }

  /** First quotes are in (at startup or after a sim period): switch every consumer to the live stream. */
  private async goLive() {
    // the account group may have been chosen while the first request was in flight
    if (this.fetchedGroup !== this.group) await this.loadQuotes(2500);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    rebaseTrades(POSITIONS);
    rebaseTrades(HISTORY);
    this.setMode("live");
    this.resolveReady("live"); // no-op when it already resolved as "sim"
    // the early socket is kept when it carries the current group; its held quotes are newer than the snapshot
    if (this.ws && this.wsGroup !== this.group) this.dropSocket();
    this.holding = false;
    for (const [sym, q] of this.held) this.onLiveQuote(sym, q.b, q.a, q.l, q.t);
    this.held.clear();
    this.notifyAll();
    if (!this.ws) this.openSocket();
    this.startWatchdog();
  }

  /** Reconnects a socket that went silent (no quote or heartbeat for 12s) and resyncs after a hidden tab. */
  private startWatchdog() {
    if (this.watchdog) return;
    this.watchdog = setInterval(() => {
      const ws = this.ws;
      if (ws && ws.readyState === WebSocket.OPEN && Date.now() - this.lastFrame > 12_000) {
        this.ws = null;
        ws.close();
        this.openSocket();
      }
    }, 2000);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.hiddenAt = Date.now();
      else if (this.hiddenAt && Date.now() - this.hiddenAt > 1000 && this.mode === "live") this.resync();
    });
  }

  private notifyAll() {
    for (const [symbol, subs] of this.listeners) {
      const q = this.quotes.get(symbol);
      if (q) subs.forEach((fn) => fn(q));
    }
  }

  /** Closes the current socket without the reconnect of onclose. */
  private dropSocket() {
    const old = this.ws;
    this.ws = null;
    this.held.clear();
    old?.close();
  }

  private openSocket() {
    const ws = new WebSocket(`${MARKET_DATA_URL.replace(/^http/, "ws")}/v1/stream?group=${encodeURIComponent(this.group)}`);
    this.ws = ws;
    this.wsGroup = this.group;
    this.lastFrame = Date.now();
    ws.onopen = () => {
      this.backoff = 0;
      this.lastFrame = Date.now();
      ws.send(JSON.stringify({ op: "subscribe", symbols: INSTRUMENTS.map((i) => i.symbol) }));
      for (const key of this.barListeners.keys()) {
        const [symbol, tf] = key.split("|");
        ws.send(JSON.stringify({ op: "bars", symbol, tf }));
      }
      if (this.depthListeners.size) ws.send(JSON.stringify({ op: "depth", symbols: [...this.depthListeners.keys()] }));
      // after a drop: bars/quotes may have been missed while disconnected
      if (this.opened && !this.holding) this.resync();
      this.opened = true;
    };
    ws.onmessage = (e) => {
      const now = Date.now();
      this.lastFrame = now;
      let m;
      try {
        m = JSON.parse(e.data as string);
      } catch {
        return; // ignore a malformed frame rather than kill the stream handler
      }
      if (m.type === "quote") {
        if (m.r > 0) {
          this.lat.push(now - m.r);
          if (this.lat.length > 500) this.lat.shift();
        }
        if (this.holding) this.held.set(m.s, { b: m.b, a: m.a, l: m.l, t: m.t });
        else this.onLiveQuote(m.s, m.b, m.a, m.l, m.t);
      } else if (m.type === "bar") this.barListeners.get(`${m.s}|${m.tf}`)?.forEach((fn) => fn({ t: m.t, o: m.o, h: m.h, l: m.l, c: m.c, v: m.v }));
      else if (m.type === "depth" && Array.isArray(m.b) && Array.isArray(m.a)) {
        const d: DepthBook = { symbol: m.s, src: m.src === "feed" ? "feed" : "indicative", t: m.t, bids: m.b, asks: m.a };
        this.depths.set(m.s, d);
        this.depthListeners.get(m.s)?.forEach((fn) => fn(d));
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      // first retry almost at once, then back off (max 2s) while the service is down
      setTimeout(() => this.openSocket(), this.backoff);
      this.backoff = Math.min(Math.max(250, this.backoff * 2), 2000);
    };
  }

  private onLiveQuote(symbol: string, bid: number, ask: number, last: number | undefined, time: number) {
    if (!(bid > 0) || !(ask > 0)) return;
    this.liveTimes.add(symbol);
    const prev = this.quotes.get(symbol);
    last = last || (bid + ask) / 2; // quotes without a trade price use the mid
    if (prev && prev.bid === bid && prev.ask === ask && prev.last === last) return;
    if (!this.liveOpen.has(symbol)) {
      // symbol missing from /v1/quotes: its first live price is the reference (0%), not the mock open
      this.open.set(symbol, last);
      this.liveOpen.add(symbol);
    }
    const open = this.open.get(symbol)!;
    const day = this.days.get(symbol);
    if (day) {
      day.high = Math.max(day.high, last);
      day.low = Math.min(day.low, last);
    }
    const dir: Quote["dir"] = !prev ? 0 : bid > prev.bid ? 1 : bid < prev.bid ? -1 : 0;
    const q: Quote = { symbol, bid, ask, last, change: ((last - open) / open) * 100, dir, time };
    this.quotes.set(symbol, q);
    this.listeners.get(symbol)?.forEach((fn) => fn(q));
  }

  /** Account group whose spread markup the quotes should carry (raw / standard / pro / ecn / cent). */
  setGroup(group: string) {
    const g = group.toLowerCase();
    if (g === this.group) return;
    this.group = g;
    if (this.mode !== "live") return;
    this.liveTimes.clear(); // the next REST reply carries the new group's spread: take it as is
    this.depths.clear(); // ladders carry the group's spread too: wait for the new socket's
    void this.loadQuotes(4000).then(() => this.notifyAll());
    const old = this.ws;
    this.ws = null;
    old?.close();
    this.openSocket();
  }

  /** Today's open/high/low (server day). */
  day(symbol: string): DayStats | undefined {
    return this.days.get(symbol);
  }

  /** Stream the forming bar of `symbol`/`tf` (live mode only). */
  subscribeBars(symbol: string, tf: string, fn: BarListener): () => void {
    const key = `${symbol}|${tf}`;
    let set = this.barListeners.get(key);
    if (!set) {
      set = new Set();
      this.barListeners.set(key, set);
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ op: "bars", symbol, tf }));
    }
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (set!.size === 0) {
        this.barListeners.delete(key);
        if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ op: "unbars", symbol, tf }));
      }
    };
  }

  /**
   * Stream the depth-of-market ladder of `symbol` (live mode only): every quote change pushes a fresh book.
   * The last book (if any) is delivered at once.
   */
  subscribeDepth(symbol: string, fn: DepthListener): () => void {
    let set = this.depthListeners.get(symbol);
    if (!set) {
      set = new Set();
      this.depthListeners.set(symbol, set);
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ op: "depth", symbols: [symbol] }));
    }
    set.add(fn);
    const cur = this.depths.get(symbol);
    if (cur) fn(cur);
    return () => {
      set!.delete(fn);
      if (set!.size === 0) {
        this.depthListeners.delete(symbol);
        this.depths.delete(symbol);
        if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ op: "undepth", symbols: [symbol] }));
      }
    };
  }

  /* ---------------- shared API ---------------- */

  snapshot(symbol: string): Quote | undefined {
    return this.quotes.get(symbol);
  }

  /** Like snapshot(), but never undefined: an unknown symbol gets an empty (zero) quote instead of a crash. */
  quote(symbol: string): Quote {
    return this.quotes.get(symbol) ?? { symbol, bid: 0, ask: 0, last: 0, change: 0, dir: 0, time: 0 };
  }

  subscribe(symbols: string[], fn: Listener): () => void {
    for (const s of symbols) {
      if (!this.listeners.has(s)) this.listeners.set(s, new Set());
      this.listeners.get(s)!.add(fn);
    }
    return () => {
      for (const s of symbols) this.listeners.get(s)?.delete(fn);
    };
  }

  /* ---------------- fallback simulator ---------------- */

  private ensureSimulator() {
    if (this.timer || typeof window === "undefined") return;
    this.timer = setInterval(() => this.tick(), 450);
  }

  private tick() {
    for (const inst of INSTRUMENTS) {
      const subs = this.listeners.get(inst.symbol);
      if (!subs || subs.size === 0) continue;
      if (this.rand.next() > 0.55) continue; // not every symbol ticks every cycle
      const prev = this.quotes.get(inst.symbol)!;
      const mid = (prev.bid + prev.ask) / 2;
      const vol = inst.assetClass === "crypto" ? 0.0009 : inst.assetClass === "forex" ? 0.00012 : 0.00035;
      const next = mid * (1 + this.rand.normal() * vol);
      const q = this.makeQuote(inst, next, next > mid ? 1 : next < mid ? -1 : 0);
      this.quotes.set(inst.symbol, q);
      subs.forEach((fn) => fn(q));
    }
  }
}

let feed: PriceFeed | null = null;
export function priceFeed(): PriceFeed {
  if (!feed) feed = new PriceFeed();
  return feed;
}

/** Candle history from our market-data database. `time` is unix seconds (UTC). Null when unavailable. */
export async function fetchCandles(symbol: string, tf: string, limit = 1000, to?: number): Promise<Candle[] | null> {
  try {
    const q = new URLSearchParams({ symbol, tf, limit: String(limit) });
    if (to) q.set("to", String(to));
    const res = await fetch(`${MARKET_DATA_URL}/v1/candles?${q}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { bars: LiveBar[] };
    return data.bars.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }));
  } catch {
    return null;
  }
}

/** Broker server time offset (seconds) at `unixSec`: GMT+3 while US DST is active, else GMT+2 (New York close). */
export function serverOffset(unixSec: number): number {
  const d = new Date(unixSec * 1000);
  const y = d.getUTCFullYear();
  const nthSunday = (month: number, n: number) => {
    const first = new Date(Date.UTC(y, month, 1));
    return Date.UTC(y, month, 1 + ((7 - first.getUTCDay()) % 7) + (n - 1) * 7);
  };
  const start = nthSunday(2, 2) + 7 * 3600_000; // 2nd Sunday of March, 02:00 New York
  const end = nthSunday(10, 1) + 6 * 3600_000; // 1st Sunday of November, 02:00 New York
  const t = unixSec * 1000;
  return t >= start && t < end ? 3 * 3600 : 2 * 3600;
}

/**
 * Is the market for `symbol` open at `ms`? Same rules as the market-data service: crypto trades 24/7, US stocks
 * 09:30–16:00 New York on weekdays, everything else (FX, metals, indices, energies) Monday–Friday server time.
 * While closed the feed holds the last session price and sends no ticks.
 */
export function isMarketOpen(symbol: string, ms = Date.now()): boolean {
  const inst = INSTRUMENT_MAP[symbol];
  if (!inst || inst.assetClass === "crypto") return true;
  const sec = Math.floor(ms / 1000);
  const server = new Date((sec + serverOffset(sec)) * 1000);
  const day = server.getUTCDay();
  if (inst.assetClass === "stocks") {
    const ny = new Date((sec + serverOffset(sec) - 7 * 3600) * 1000); // New York = server time − 7h
    const mins = ny.getUTCHours() * 60 + ny.getUTCMinutes();
    return ny.getUTCDay() !== 0 && ny.getUTCDay() !== 6 && mins >= 570 && mins < 960;
  }
  return day !== 0 && day !== 6;
}

/** Deterministic sparkline/intraday series for a symbol. */
export function sparkline(symbol: string, points = 32, drift?: number): number[] {
  const inst = INSTRUMENTS.find((i) => i.symbol === symbol);
  const r = seeded(hashString(symbol) + points);
  const d = drift ?? (inst ? inst.change / 100 / points : 0);
  let v = 100;
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    v *= 1 + d + r.normal() * 0.004;
    out.push(v);
  }
  return out;
}

export interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number }

/** Daily OHLC history ending today, seeded per symbol. */
export function candles(symbol: string, count = 180, stepSec = 86400): Candle[] {
  const inst = INSTRUMENTS.find((i) => i.symbol === symbol)!;
  const r = seeded(hashString(symbol + count));
  const now = Math.floor(Date.parse("2026-09-24T21:00:00Z") / 1000 / stepSec) * stepSec;
  const vol = inst.assetClass === "crypto" ? 0.028 : inst.assetClass === "forex" ? 0.004 : 0.011;
  let price = inst.price * (1 - inst.change / 100) * (0.9 + r.next() * 0.1);
  const out: Candle[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const open = price;
    const close = open * (1 + r.normal() * vol + 0.0006);
    const high = Math.max(open, close) * (1 + r.next() * vol * 0.6);
    const low = Math.min(open, close) * (1 - r.next() * vol * 0.6);
    out.push({ time: now - i * stepSec, open, high, low, close, volume: Math.round(500 + r.next() * 3000) });
    price = close;
  }
  // pin the last close to the reference price
  const k = inst.price / out[out.length - 1]!.close;
  return out.map((c) => ({ ...c, open: c.open * k, high: c.high * k, low: c.low * k, close: c.close * k }));
}
