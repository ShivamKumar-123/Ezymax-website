// The account stream: one WebSocket per active login, opened with a one-time ticket minted by the BFF.
// Reconnects with exponential backoff + jitter, reconnects at once when the tab becomes visible or the
// browser comes back online, and treats a silent socket (no frame for 20 s; the engine sends hb every 5 s)
// as dead. Every (re)connect starts with a `snapshot` frame, so state is resynced by construction.
import { engineApi } from "./client";
import type { StreamFrame } from "./types";

export type StreamStatus = "connecting" | "open" | "reconnecting" | "closed";

export interface StreamHandlers {
  onFrame: (f: StreamFrame) => void;
  onStatus: (s: StreamStatus, info?: { attempt: number; delayMs?: number; reason?: string }) => void;
  /** the session is gone (401): stop, the store logs this account out */
  onUnauthorized: () => void;
}

export class AccountStream {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private lastFrame = 0;
  private stopped = false;
  private connecting = false;
  status: StreamStatus = "connecting";

  constructor(
    readonly login: string,
    private h: StreamHandlers,
  ) {
    document.addEventListener("visibilitychange", this.onVisible);
    window.addEventListener("online", this.onVisible);
    this.watchdog = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN && Date.now() - this.lastFrame > 20_000) this.ws.close(4000, "silent");
    }, 5_000);
    void this.connect();
  }

  private setStatus(s: StreamStatus, info?: { attempt: number; delayMs?: number; reason?: string }) {
    this.status = s;
    this.h.onStatus(s, info);
  }

  private onVisible = () => {
    if (this.stopped || document.visibilityState !== "visible") return;
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      void this.connect();
    }
  };

  private async connect() {
    if (this.stopped || this.connecting) return;
    this.connecting = true;
    this.setStatus(this.attempt ? "reconnecting" : "connecting", { attempt: this.attempt });
    const t = await engineApi.streamTicket(this.login);
    this.connecting = false;
    if (this.stopped) return;
    if (!t.ok) {
      if (t.err.status === 401) {
        this.stop();
        this.h.onUnauthorized();
        return;
      }
      return this.retry(t.err.message);
    }
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${t.data.url}?ticket=${encodeURIComponent(t.data.ticket)}`);
    } catch {
      return this.retry("socket error");
    }
    this.ws = ws;
    ws.onopen = () => {
      this.lastFrame = Date.now();
    };
    ws.onmessage = (e) => {
      this.lastFrame = Date.now();
      let f: StreamFrame;
      try {
        f = JSON.parse(String(e.data)) as StreamFrame;
      } catch {
        return;
      }
      if (f.type === "snapshot") {
        this.attempt = 0;
        this.setStatus("open", { attempt: 0 });
      }
      this.h.onFrame(f);
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.stopped) return;
      this.retry(e.reason || (e.code === 1006 ? "connection lost" : `closed (${e.code})`));
    };
    ws.onerror = () => {
      /* onclose follows */
    };
  }

  private retry(reason: string) {
    if (this.stopped) return;
    this.attempt++;
    const base = Math.min(15_000, 500 * 2 ** Math.min(this.attempt - 1, 5));
    const delay = Math.round(base * (0.75 + Math.random() * 0.5));
    this.setStatus("reconnecting", { attempt: this.attempt, delayMs: delay, reason });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.connect();
    }, document.visibilityState === "hidden" ? Math.max(delay, 5_000) : delay);
  }

  /** Drop the socket and reconnect now (e.g. after a `resync` frame). */
  reconnect() {
    if (this.stopped) return;
    this.attempt = 0;
    const ws = this.ws;
    this.ws = null;
    ws?.close(1000, "resync");
    void this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.watchdog) clearInterval(this.watchdog);
    document.removeEventListener("visibilitychange", this.onVisible);
    window.removeEventListener("online", this.onVisible);
    const ws = this.ws;
    this.ws = null;
    ws?.close(1000, "logout");
    this.setStatus("closed");
  }

  /** test hook: kill the socket as if the network dropped */
  kill() {
    this.ws?.close(4001, "killed");
  }
}
