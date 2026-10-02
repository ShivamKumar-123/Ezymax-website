"use client";

// The option chain stream. Live builds: one WebSocket to the options service (`wss://trade.<domain>/options/stream`
// behind Caddy; ws://127.0.0.1:8104/v1/options/stream in development) with a one-time ticket from the BFF, or no
// ticket for the guest (public chain) view. The server sends the full chain on subscribe, then only changed rows
// (≤ 4 frames/s per chain), changed series quotes and a heartbeat every 10 s. Reconnects with backoff + jitter and
// re-subscribes. Demo builds: the same frames computed in the browser from the demo pricer.
//
// Order book market data (docs/OPTIONS-EXCHANGE.md §10), once the broker's book is live: `{"op":"depth","series":
// [codes]}` sets the series whose depth this connection follows (10 levels each side, ≤ 4 frames/s, at most 20 series;
// an empty list stops them) and `{"op":"tape","series":[codes]}` the series whose trades it receives (batched every
// 250 ms). Frames: `{"type":"depth", series, bids:[{price, qty, orders}], asks, seq}` (levels may also come as
// [price, qty, orders] tuples) and `{"type":"tape", trades:[{id, series, price, qty, side, t, kind}]}`.
import { IS_LIVE } from "@kalks/mock";
import { optionsApi, isLaunchingSoon } from "./api";
import { demoBookTick, demoChain, demoDepth, demoQuote, demoTrades } from "./mock-engine";
import { normDepth, normTrade } from "./normalize";
import type { OptionChain, OptionChainRow, OptionQuote, OptionTradeState, SeriesDepth, TapeTrade } from "./types";

export type OptFrame =
  | ({ type: "chain" } & OptionChain)
  | { type: "rows"; u: string; expiry: string; spot: OptionChain["spot"]; state?: OptionTradeState; rows: OptionChainRow[] }
  | { type: "series"; quotes: OptionQuote[] }
  | ({ type: "depth" } & SeriesDepth)
  | { type: "tape"; trades: TapeTrade[] }
  | { type: "hb"; t: number }
  | { type: "error"; code: string; message: string };

/** A raw frame of the service, with the book frames normalised (unknown frames pass through). */
function parseFrame(raw: unknown): OptFrame | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as { type?: string; trades?: unknown[]; trade?: unknown };
  if (f.type === "depth") {
    const d = normDepth(raw);
    return d ? { type: "depth", ...d } : null;
  }
  if (f.type === "tape" || f.type === "trade" || f.type === "trades") {
    const list = Array.isArray(f.trades) ? f.trades : [f.trade ?? raw];
    return { type: "tape", trades: list.map((t) => normTrade(t)).filter((t): t is TapeTrade => !!t) };
  }
  return raw as OptFrame;
}

export type OptStreamStatus = "connecting" | "open" | "reconnecting" | "closed" | "unavailable";

export interface ChainSub {
  u: string;
  expiry: string;
}

export interface OptStreamHandlers {
  onFrame: (f: OptFrame) => void;
  onStatus: (s: OptStreamStatus, info?: { attempt?: number; reason?: string }) => void;
}

export interface OptStream {
  setChains(list: ChainSub[]): void;
  setSeries(codes: string[]): void;
  /** order book: series whose depth / trades to follow (replaces the previous set) */
  setDepth(codes: string[]): void;
  setTape(codes: string[]): void;
  stop(): void;
}

const key = (c: ChainSub) => `${c.u}|${c.expiry}`;

class LiveOptionsStream implements OptStream {
  private ws: WebSocket | null = null;
  private chains = new Map<string, ChainSub>();
  private series = new Set<string>();
  private depth: string[] = [];
  private tape: string[] = [];
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setInterval>;
  private lastFrame = 0;
  private stopped = false;
  private connecting = false;

  constructor(
    private login: string | null,
    private h: OptStreamHandlers,
  ) {
    document.addEventListener("visibilitychange", this.onVisible);
    window.addEventListener("online", this.onVisible);
    this.watchdog = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN && Date.now() - this.lastFrame > 25_000) this.ws.close(4000, "silent");
    }, 5_000);
    void this.connect();
  }

  private onVisible = () => {
    if (this.stopped || document.visibilityState !== "visible") return;
    if (!this.ws || this.ws.readyState >= WebSocket.CLOSING) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      void this.connect();
    }
  };

  private send(v: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(v));
  }

  private async connect() {
    if (this.stopped || this.connecting) return;
    this.connecting = true;
    this.h.onStatus(this.attempt ? "reconnecting" : "connecting", { attempt: this.attempt });
    let url: string;
    if (this.login) {
      const t = await optionsApi.streamTicket(this.login);
      if (!t.ok) {
        this.connecting = false;
        if (isLaunchingSoon(t.err)) return this.unavailable(t.err.message);
        return this.retry(t.err.message);
      }
      url = `${t.data.url}?ticket=${encodeURIComponent(t.data.ticket)}`;
    } else {
      const u = await optionsApi.publicStreamUrl();
      if (!u.ok) {
        this.connecting = false;
        return this.retry(u.err.message);
      }
      url = u.data.url;
    }
    this.connecting = false;
    if (this.stopped) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      return this.retry("socket error");
    }
    this.ws = ws;
    ws.onopen = () => {
      this.lastFrame = Date.now();
      this.attempt = 0;
      this.h.onStatus("open");
      for (const c of this.chains.values()) this.send({ op: "subscribe", u: c.u, expiry: c.expiry });
      const codes = [...this.series];
      for (let i = 0; i < codes.length; i += 200) this.send({ op: "subscribe", series: codes.slice(i, i + 200) });
      if (this.depth.length) this.send({ op: "depth", series: this.depth });
      if (this.tape.length) this.send({ op: "tape", series: this.tape });
    };
    ws.onmessage = (e) => {
      this.lastFrame = Date.now();
      let raw: unknown;
      try {
        raw = JSON.parse(String(e.data));
      } catch {
        return; /* not JSON */
      }
      const f = parseFrame(raw);
      if (f) this.h.onFrame(f);
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (!this.stopped) this.retry(e.reason || (e.code === 1006 ? "connection lost" : `closed (${e.code})`));
    };
    ws.onerror = () => {
      /* onclose follows */
    };
  }

  /** The module is off (or the public chain is): try again in a minute, quietly. */
  private unavailable(reason: string) {
    this.h.onStatus("unavailable", { reason });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.connect();
    }, 60_000);
  }

  private retry(reason: string) {
    if (this.stopped) return;
    this.attempt++;
    const base = Math.min(15_000, 500 * 2 ** Math.min(this.attempt - 1, 5));
    const delay = Math.round(base * (0.75 + Math.random() * 0.5));
    this.h.onStatus("reconnecting", { attempt: this.attempt, reason });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.connect();
    }, document.visibilityState === "hidden" ? Math.max(delay, 5_000) : delay);
  }

  setChains(list: ChainSub[]) {
    const next = new Map(list.map((c) => [key(c), c]));
    for (const [k, c] of this.chains) if (!next.has(k)) this.send({ op: "unsubscribe", u: c.u, expiry: c.expiry });
    for (const [k, c] of next) if (!this.chains.has(k)) this.send({ op: "subscribe", u: c.u, expiry: c.expiry });
    this.chains = next;
  }

  setSeries(codes: string[]) {
    const next = new Set(codes.slice(0, 200));
    const gone = [...this.series].filter((c) => !next.has(c));
    const added = [...next].filter((c) => !this.series.has(c));
    if (gone.length) this.send({ op: "unsubscribe", series: gone });
    if (added.length) this.send({ op: "subscribe", series: added });
    this.series = next;
  }

  setDepth(codes: string[]) {
    const next = [...new Set(codes)].slice(0, 20);
    if (next.join() === this.depth.join()) return;
    this.depth = next;
    this.send({ op: "depth", series: next });
  }

  setTape(codes: string[]) {
    const next = [...new Set(codes)].slice(0, 20);
    if (next.join() === this.tape.join()) return;
    this.tape = next;
    this.send({ op: "tape", series: next });
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    clearInterval(this.watchdog);
    document.removeEventListener("visibilitychange", this.onVisible);
    window.removeEventListener("online", this.onVisible);
    const ws = this.ws;
    this.ws = null;
    ws?.close(1000, "done");
    this.h.onStatus("closed");
  }
}

/** Demo builds: the stream's frames computed from the in-browser pricer twice a second. */
class DemoOptionsStream implements OptStream {
  private chains = new Map<string, { sub: ChainSub; last: Map<string, string> }>();
  private series = new Map<string, string>();
  private depth = new Map<string, string>();
  private tape = new Map<string, string>();
  private timer: ReturnType<typeof setInterval>;

  constructor(private h: OptStreamHandlers) {
    queueMicrotask(() => h.onStatus("open"));
    this.timer = setInterval(() => this.tick(), 500);
  }

  private qsig = (q: OptionQuote | null) => (q ? `${q.bid}|${q.ask}|${q.bidQty ?? ""}|${q.askQty ?? ""}|${q.volume ?? ""}|${q.state}` : "");
  private sig = (r: OptionChainRow) => `${this.qsig(r.call)}/${this.qsig(r.put)}`;

  private full(k: string, sub: ChainSub) {
    const c = demoChain(sub.u, sub.expiry);
    if (!c) return;
    this.chains.set(k, { sub, last: new Map(c.rows.map((r) => [r.strikeLabel, this.sig(r)])) });
    this.h.onFrame({ type: "chain", ...c });
  }

  private tick() {
    if (document.visibilityState === "hidden") return;
    // near-the-money series of the chains on screen: where the simulated outside flow trades
    const flow: string[] = [];
    for (const [k, s] of this.chains) {
      const c = demoChain(s.sub.u, s.sub.expiry);
      if (!c) continue;
      const spot = c.spot?.mid ?? 0;
      const i0 = c.rows.reduce((best, r, i) => (Math.abs(r.strike - spot) < Math.abs(c.rows[best]!.strike - spot) ? i : best), 0);
      for (const r of c.rows.slice(Math.max(0, i0 - 3), i0 + 4)) for (const q of [r.call, r.put]) if (q) flow.push(q.code);
      if (c.rows.length !== s.last.size) {
        this.full(k, s.sub);
        continue;
      }
      const changed = c.rows.filter((r) => s.last.get(r.strikeLabel) !== this.sig(r));
      for (const r of changed) s.last.set(r.strikeLabel, this.sig(r));
      if (changed.length) this.h.onFrame({ type: "rows", u: c.underlying, expiry: c.expiry, spot: c.spot, state: c.state, rows: changed });
    }
    demoBookTick([...flow, ...this.depth.keys()]);
    const quotes: OptionQuote[] = [];
    for (const [code, last] of this.series) {
      const q = demoQuote(code);
      if (!q) continue;
      const sig = this.qsig(q);
      if (sig !== last) {
        this.series.set(code, sig);
        quotes.push(q);
      }
    }
    if (quotes.length) this.h.onFrame({ type: "series", quotes });
    for (const [code, last] of this.depth) {
      const d = demoDepth(code);
      if (!d) continue;
      const sig = JSON.stringify([d.bids, d.asks]);
      if (sig === last) continue;
      this.depth.set(code, sig);
      this.h.onFrame({ type: "depth", ...d });
    }
    for (const [code, last] of this.tape) {
      const list = demoTrades(code, 60);
      const i = last ? list.findIndex((t) => t.id === last) : list.length;
      const fresh = i < 0 ? list : list.slice(0, i);
      if (!fresh.length) continue;
      this.tape.set(code, fresh[0]!.id);
      this.h.onFrame({ type: "tape", trades: [...fresh].reverse() });
    }
  }

  setChains(list: ChainSub[]) {
    const next = new Map(list.map((c) => [key(c), c]));
    for (const k of [...this.chains.keys()]) if (!next.has(k)) this.chains.delete(k);
    for (const [k, c] of next) if (!this.chains.has(k)) this.full(k, c);
  }

  setSeries(codes: string[]) {
    const next = new Map<string, string>();
    for (const c of codes) next.set(c, this.series.get(c) ?? "");
    this.series = next;
  }

  setDepth(codes: string[]) {
    const next = new Map<string, string>();
    for (const c of codes.slice(0, 20)) next.set(c, this.depth.get(c) ?? "");
    this.depth = next;
    // the first frame at once, like the service on subscribe
    queueMicrotask(() => {
      for (const [code, sig] of this.depth) {
        if (sig) continue;
        const d = demoDepth(code);
        if (!d) continue;
        this.depth.set(code, JSON.stringify([d.bids, d.asks]));
        this.h.onFrame({ type: "depth", ...d });
      }
    });
  }

  setTape(codes: string[]) {
    const next = new Map<string, string>();
    for (const c of codes.slice(0, 20)) next.set(c, this.tape.get(c) ?? "");
    this.tape = next;
    queueMicrotask(() => {
      for (const [code, last] of this.tape) {
        if (last) continue;
        const list = demoTrades(code, 60);
        if (!list.length) continue;
        this.tape.set(code, list[0]!.id);
        this.h.onFrame({ type: "tape", trades: [...list].reverse() });
      }
    });
  }

  stop() {
    clearInterval(this.timer);
    this.h.onStatus("closed");
  }
}

export function createOptionsStream(login: string | null, h: OptStreamHandlers): OptStream {
  return IS_LIVE ? new LiveOptionsStream(login, h) : new DemoOptionsStream(h);
}
