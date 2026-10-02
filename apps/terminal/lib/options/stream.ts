"use client";

// The option chain stream. Live builds: one WebSocket to the options service (`wss://trade.<domain>/options/stream`
// behind Caddy; ws://127.0.0.1:8104/v1/options/stream in development) with a one-time ticket from the BFF, or no
// ticket for the guest (public chain) view. The server sends the full chain on subscribe, then only changed rows
// (≤ 4 frames/s per chain), changed series quotes and a heartbeat every 10 s. Reconnects with backoff + jitter and
// re-subscribes. Demo builds: the same frames computed in the browser from the demo pricer.
import { IS_LIVE } from "@kalks/mock";
import { optionsApi, isLaunchingSoon } from "./api";
import { demoChain, demoQuote } from "./mock-engine";
import type { OptionChain, OptionChainRow, OptionQuote, OptionTradeState } from "./types";

export type OptFrame =
  | ({ type: "chain" } & OptionChain)
  | { type: "rows"; u: string; expiry: string; spot: OptionChain["spot"]; state?: OptionTradeState; rows: OptionChainRow[] }
  | { type: "series"; quotes: OptionQuote[] }
  | { type: "hb"; t: number }
  | { type: "error"; code: string; message: string };

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
  stop(): void;
}

const key = (c: ChainSub) => `${c.u}|${c.expiry}`;

class LiveOptionsStream implements OptStream {
  private ws: WebSocket | null = null;
  private chains = new Map<string, ChainSub>();
  private series = new Set<string>();
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
    };
    ws.onmessage = (e) => {
      this.lastFrame = Date.now();
      try {
        this.h.onFrame(JSON.parse(String(e.data)) as OptFrame);
      } catch {
        /* not JSON */
      }
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
  private timer: ReturnType<typeof setInterval>;

  constructor(private h: OptStreamHandlers) {
    queueMicrotask(() => h.onStatus("open"));
    this.timer = setInterval(() => this.tick(), 500);
  }

  private sig = (r: OptionChainRow) => `${r.call?.bid}|${r.call?.ask}|${r.put?.bid}|${r.put?.ask}|${r.call?.state}`;

  private full(k: string, sub: ChainSub) {
    const c = demoChain(sub.u, sub.expiry);
    if (!c) return;
    this.chains.set(k, { sub, last: new Map(c.rows.map((r) => [r.strikeLabel, this.sig(r)])) });
    this.h.onFrame({ type: "chain", ...c });
  }

  private tick() {
    if (document.visibilityState === "hidden") return;
    for (const [k, s] of this.chains) {
      const c = demoChain(s.sub.u, s.sub.expiry);
      if (!c) continue;
      if (c.rows.length !== s.last.size) {
        this.full(k, s.sub);
        continue;
      }
      const changed = c.rows.filter((r) => s.last.get(r.strikeLabel) !== this.sig(r));
      for (const r of changed) s.last.set(r.strikeLabel, this.sig(r));
      if (changed.length) this.h.onFrame({ type: "rows", u: c.underlying, expiry: c.expiry, spot: c.spot, state: c.state, rows: changed });
    }
    const quotes: OptionQuote[] = [];
    for (const [code, last] of this.series) {
      const q = demoQuote(code);
      if (!q) continue;
      const sig = `${q.bid}|${q.ask}|${q.state}`;
      if (sig !== last) {
        this.series.set(code, sig);
        quotes.push(q);
      }
    }
    if (quotes.length) this.h.onFrame({ type: "series", quotes });
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

  stop() {
    clearInterval(this.timer);
    this.h.onStatus("closed");
  }
}

export function createOptionsStream(login: string | null, h: OptStreamHandlers): OptStream {
  return IS_LIVE ? new LiveOptionsStream(login, h) : new DemoOptionsStream(h);
}
