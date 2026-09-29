"use client";

// One realtime connection per tab to the support service stream (support chat + notifications bell).
// Opened lazily on the first subscriber with a one-time ticket from /api/support/stream-ticket; reconnects
// with backoff and emits {type:"reconnected"} so subscribers can reload what they may have missed.

export type Frame = { type: string; [k: string]: unknown };
type Handler = (f: Frame) => void;

const TICKET_PATH = "/api/support/stream-ticket";

class Realtime {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private connecting = false;
  private everOpen = false;
  status: "idle" | "connecting" | "live" | "offline" = "idle";

  subscribe(h: Handler): () => void {
    this.handlers.add(h);
    if (!this.ws && !this.connecting && !this.timer) void this.connect();
    return () => {
      this.handlers.delete(h);
    };
  }

  private emit(f: Frame) {
    this.handlers.forEach((h) => {
      try {
        h(f);
      } catch {
        /* a failing subscriber never breaks the others */
      }
    });
  }

  private async connect() {
    this.connecting = true;
    this.status = "connecting";
    try {
      const r = await fetch(TICKET_PATH, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (r.status === 401) {
        this.connecting = false;
        this.status = "offline";
        return;
      }
      const t = (await r.json().catch(() => ({}))) as { ticket?: string; url?: string | null };
      if (!r.ok || !t.ticket) throw new Error("ticket");
      const base = t.url || `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/support/stream`;
      const ws = new WebSocket(`${base}?ticket=${encodeURIComponent(t.ticket)}`);
      this.ws = ws;
      ws.onopen = () => {
        this.retry = 0;
        this.status = "live";
        document.documentElement.dataset.realtime = "live";
        if (this.everOpen) this.emit({ type: "reconnected" });
        this.everOpen = true;
      };
      ws.onmessage = (e) => {
        try {
          const f = JSON.parse(String(e.data)) as Frame;
          if (f.type === "ping") return;
          this.emit(f.type === "resync" ? { type: "reconnected" } : f);
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        if (this.ws === ws) this.ws = null;
        this.status = "offline";
        document.documentElement.dataset.realtime = "offline";
        this.later();
      };
      ws.onerror = () => ws.close();
    } catch {
      this.status = "offline";
      this.later();
    } finally {
      this.connecting = false;
    }
  }

  private later() {
    if (this.timer || this.handlers.size === 0) return;
    const wait = Math.min(20_000, 1000 * 2 ** this.retry++) + Math.random() * 500;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.connect();
    }, wait);
  }
}

let instance: Realtime | null = null;
export function realtime(): Realtime {
  if (!instance) instance = new Realtime();
  return instance;
}
