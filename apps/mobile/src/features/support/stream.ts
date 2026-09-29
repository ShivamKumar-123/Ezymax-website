// The support service's realtime stream (chat frames and notification frames), one connection for the app.
// - Opened on the first subscriber with a one-time ticket (POST /api/mobile/support/stream-ticket, 30 s), closed a
//   little after the last subscriber leaves and after 30 s in the background.
// - Where: the ticket's URL when it is a public one; otherwise wss://<Client Area host>/support/stream, which the
//   production edge (Caddy) and the mobile dev relay both map to the service (a phone can't reach a loopback URL).
// - Reconnects with backoff (and at once when the network comes back or the app returns to the foreground);
//   subscribers get {type: "reconnected"} after a reconnect or a server "resync", to reload what they missed.
// - The server pings every 25 s; 60 s of silence counts as a dead connection.
import { AppState } from "react-native";
import { API_BASE } from "@/lib/config";
import { netStore } from "@/lib/net";
import { createStore } from "@/lib/store";
import { onSignOut } from "@/session";
import { streamTicket } from "./api";
import { streamBase } from "./url";

export type Frame = { type: string; [k: string]: unknown };
type Handler = (f: Frame) => void;

export const streamStatus = createStore<"idle" | "connecting" | "live" | "offline">("idle");

class SupportStream {
  private ws: WebSocket | null = null;
  /** one entry per subscription (the same handler may be subscribed by several screens) */
  private handlers = new Set<{ fn: Handler }>();
  private attempt = 0;
  private everOpen = false;
  private connecting = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private bgTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private lastFrame = 0;
  private offs: (() => void)[] = [];
  private gen = 0;

  subscribe(fn: Handler): () => void {
    const entry = { fn };
    this.handlers.add(entry);
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.start();
    return () => {
      this.handlers.delete(entry);
      if (!this.handlers.size && !this.idleTimer) this.idleTimer = setTimeout(() => this.stop(), 15_000);
    };
  }

  private emit(f: Frame) {
    this.handlers.forEach((h) => {
      try {
        h.fn(f);
      } catch {
        // one failing subscriber never breaks the others
      }
    });
  }

  private start() {
    if (this.offs.length) return;
    const app = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        if (this.bgTimer) clearTimeout(this.bgTimer);
        this.bgTimer = null;
        if (!this.ws && !this.connecting) this.reconnectNow();
      } else if (!this.bgTimer) {
        this.bgTimer = setTimeout(() => this.drop(), 30_000);
      }
    });
    const net = netStore.subscribe(() => {
      if (netStore.get().online && !this.ws && !this.connecting) this.reconnectNow();
    });
    this.offs = [() => app.remove(), () => void net()];
    this.watchdog = setInterval(() => {
      if (this.ws && this.ws.readyState === 1 && Date.now() - this.lastFrame > 60_000) this.ws.close();
    }, 10_000);
    void this.connect();
  }

  /** Last subscriber gone for a while, or signed out: close everything. */
  stop() {
    this.gen++;
    this.offs.forEach((f) => f());
    this.offs = [];
    for (const t of [this.timer, this.idleTimer, this.bgTimer]) if (t) clearTimeout(t);
    this.timer = this.idleTimer = this.bgTimer = null;
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
    this.drop();
    this.attempt = 0;
    this.everOpen = false;
    streamStatus.set("idle");
  }

  private drop() {
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }

  private reconnectNow() {
    this.attempt = 0;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    void this.connect();
  }

  private async connect() {
    if (this.connecting || this.ws || !this.offs.length) return;
    this.connecting = true;
    const gen = this.gen;
    streamStatus.set("connecting");
    const r = await streamTicket();
    this.connecting = false;
    if (gen !== this.gen || !this.offs.length) return;
    if (!r.ok) {
      // signed out / view-only / module off: no point retrying on a timer
      if (r.status === 401 || r.status === 403) return streamStatus.set("offline");
      return this.later();
    }
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${streamBase(r.data.url, API_BASE)}?ticket=${encodeURIComponent(r.data.ticket)}`);
    } catch {
      return this.later();
    }
    this.ws = ws;
    ws.onopen = () => {
      this.lastFrame = Date.now();
      this.attempt = 0;
      streamStatus.set("live");
      if (this.everOpen) this.emit({ type: "reconnected" });
      this.everOpen = true;
    };
    ws.onmessage = (e) => {
      this.lastFrame = Date.now();
      let f: Frame;
      try {
        f = JSON.parse(String(e.data)) as Frame;
      } catch {
        return;
      }
      if (f.type === "ping") return;
      this.emit(f.type === "resync" ? { type: "reconnected" } : f);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      streamStatus.set("offline");
      if (AppState.currentState === "active") this.later();
    };
    ws.onerror = () => {};
  }

  private later() {
    if (this.timer || !this.offs.length) return;
    this.attempt++;
    const base = Math.min(20_000, 800 * 2 ** Math.min(this.attempt - 1, 5));
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.connect();
    }, Math.round(base * (0.75 + Math.random() * 0.5)));
  }
}

export const supportStream = new SupportStream();

onSignOut(() => supportStream.stop());
