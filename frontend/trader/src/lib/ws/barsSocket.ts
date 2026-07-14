import { getWebSocketBaseUrl } from './getWebSocketBaseUrl';

/**
 * Live OHLCV bar WebSocket singleton for the TradingView datafeed.
 *
 * Talks to the gateway's `/ws/bars` relay (see backend main.py). Protocol:
 *   client → { type: 'subscribe' | 'unsubscribe', symbol, resolution }
 *   server → { symbol, timeframe, time, open, high, low, close, volume, closed }
 *          → { type: 'ping' }  (every 30s)
 *
 * Hygiene (spec §7): exponential backoff reconnect, a half-open watchdog that
 * force-closes a silently-stalled socket, and resubscribe + resetCache on
 * every reconnect so the chart re-fetches bars missed during the drop.
 */

export interface BarMessage {
  symbol: string;
  timeframe: string;
  time: number; // epoch SECONDS (bar start)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closed?: boolean;
}

type BarHandler = (bar: BarMessage) => void;

// TradingView resolution string → aggregator timeframe name (server's `timeframe`).
const RES_TO_TF: Record<string, string> = {
  '1': '1m', '5': '5m', '15': '15m', '30': '30m',
  '60': '1h', '240': '4h', '1D': '1d', 'D': '1d',
};

function resToTf(resolution: string): string | null {
  return RES_TO_TF[resolution] || RES_TO_TF[resolution.toUpperCase()] || null;
}

interface Registration {
  symbol: string;
  resolution: string;
  tf: string;
  onBar: BarHandler;
  onResetCache?: () => void;
}

// Reconnect and liveness tuning.
const MAX_BACKOFF_MS = 30000;
// Server pings every 30s; if we hear NOTHING (not even a ping) for this long the
// socket is half-open — force it closed so the backoff loop reconnects.
const WATCHDOG_MS = 45000;

class BarsSocket {
  private ws: WebSocket | null = null;
  private regs = new Map<string, Registration>(); // subscriberUID → registration
  private serverSubs = new Map<string, number>(); // `${SYMBOL}|${tf}` → refcount
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private hadConnection = false; // true once we've been open at least once
  private manuallyClosed = false;

  private connect() {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    this.manuallyClosed = false;
    const url = `${getWebSocketBaseUrl()}/ws/bars`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.armWatchdog();
      // (Re)assert every active server-side subscription.
      for (const key of this.serverSubs.keys()) {
        const [symbol, tf] = key.split('|');
        if (!symbol || !tf) continue;
        this.send({ type: 'subscribe', symbol, resolution: this.tfToResolution(tf) });
      }
      // On a RECONNECT (not the first connect), tell the chart to drop its
      // realtime cache and re-fetch, so bars missed during the drop reappear.
      if (this.hadConnection) {
        for (const reg of this.regs.values()) reg.onResetCache?.();
      }
      this.hadConnection = true;
    };

    ws.onmessage = (event) => {
      this.armWatchdog(); // any frame — data OR ping — proves the link is alive
      let data: unknown;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!data || typeof data !== 'object') return;
      const o = data as Record<string, unknown>;
      if (o.type === 'ping') {
        this.send({ type: 'pong' });
        return;
      }
      if (o.symbol == null || o.timeframe == null || o.time == null) return;
      const bar: BarMessage = {
        symbol: String(o.symbol).toUpperCase(),
        timeframe: String(o.timeframe),
        time: Number(o.time),
        open: Number(o.open),
        high: Number(o.high),
        low: Number(o.low),
        close: Number(o.close),
        volume: Number(o.volume ?? 0),
        closed: o.closed === true,
      };
      if (!Number.isFinite(bar.time) || !Number.isFinite(bar.close)) return;
      for (const reg of this.regs.values()) {
        if (reg.symbol === bar.symbol && reg.tf === bar.timeframe) reg.onBar(bar);
      }
    };

    ws.onclose = () => {
      this.clearWatchdog();
      if (!this.manuallyClosed) this.scheduleReconnect();
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }

  private tfToResolution(tf: string): string {
    for (const [res, t] of Object.entries(RES_TO_TF)) {
      if (t === tf && res !== 'D') return res;
    }
    return '5';
  }

  private send(obj: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(obj));
      } catch {
        /* ignore */
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.manuallyClosed) return;
    if (this.regs.size === 0) return; // nothing to reconnect for
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, MAX_BACKOFF_MS);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private armWatchdog() {
    this.clearWatchdog();
    this.watchdogTimer = setTimeout(() => {
      // Silently stalled but still "open" — force a reconnect.
      try {
        this.ws?.close();
      } catch {
        /* ignore */
      }
    }, WATCHDOG_MS);
  }

  private clearWatchdog() {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  subscribe(
    id: string,
    symbol: string,
    resolution: string,
    onBar: BarHandler,
    onResetCache?: () => void,
  ) {
    const sym = symbol.toUpperCase();
    const tf = resToTf(resolution);
    if (!tf) return; // unknown resolution — nothing to stream
    this.regs.set(id, { symbol: sym, resolution, tf, onBar, onResetCache });
    const key = `${sym}|${tf}`;
    const count = this.serverSubs.get(key) || 0;
    this.serverSubs.set(key, count + 1);
    if (count === 0) this.send({ type: 'subscribe', symbol: sym, resolution });
    this.connect();
  }

  unsubscribe(id: string) {
    const reg = this.regs.get(id);
    if (!reg) return;
    this.regs.delete(id);
    const key = `${reg.symbol}|${reg.tf}`;
    const count = (this.serverSubs.get(key) || 1) - 1;
    if (count <= 0) {
      this.serverSubs.delete(key);
      this.send({ type: 'unsubscribe', symbol: reg.symbol, resolution: reg.resolution });
    } else {
      this.serverSubs.set(key, count);
    }
    // Fully idle → tear the socket down; it reconnects lazily on next subscribe.
    if (this.regs.size === 0) {
      this.manuallyClosed = true;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.clearWatchdog();
      try {
        this.ws?.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
      this.hadConnection = false;
      this.reconnectAttempts = 0;
    }
  }
}

export const barsSocket = new BarsSocket();
