import { getWebSocketBaseUrl } from './getWebSocketBaseUrl';

type MessageHandler = (data: any) => void;

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

class WSManager {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private globalHandlers = new Set<MessageHandler>();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnect = 50; // was 10 — a flaky mobile network exhausted it permanently
  private statusCallbacks = new Set<(s: ConnectionStatus) => void>();
  private _status: ConnectionStatus = 'disconnected';
  private subscribedChannels = new Set<string>();

  // Half-open watchdog (ported from priceSocket after the 2026-07-09 prod
  // incident): the server pushes {type:'ping'} every 30s, so total silence
  // past DEAD_MS means the socket is dead even though readyState is OPEN —
  // onclose/onerror never fire on a half-open TCP connection, which froze
  // bid/ask + P&L at a stale price while the chart kept moving.
  private lastMessageAt = 0;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private readonly DEAD_MS = 45_000;

  get status() { return this._status; }

  private setStatus(s: ConnectionStatus) {
    this._status = s;
    this.statusCallbacks.forEach((cb) => cb(s));
  }

  connect(token?: string) {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.setStatus('connecting');

    const base = getWebSocketBaseUrl();
    const wsUrl = `${base}/ws/prices`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        this.lastMessageAt = Date.now();
        this.startWatchdog();
        if (this.subscribedChannels.size > 0) {
          this.ws?.send(JSON.stringify({
            action: 'subscribe',
            channels: Array.from(this.subscribedChannels),
          }));
        }
      };

      this.ws.onmessage = (event) => {
        this.lastMessageAt = Date.now();
        try {
          const data = JSON.parse(event.data);
          const type = data.type || data.symbol || 'unknown';

          this.globalHandlers.forEach((h) => h(data));

          const typeHandlers = this.handlers.get(type);
          if (typeHandlers) typeHandlers.forEach((h) => h(data));

          if (data.symbol) {
            const symbolHandlers = this.handlers.get(`tick:${data.symbol}`);
            if (symbolHandlers) symbolHandlers.forEach((h) => h(data));
          }
        } catch { /* ignore malformed */ }
      };

      this.ws.onclose = () => {
        this.stopWatchdog();
        this.setStatus('disconnected');
        this.scheduleReconnect(token);
      };

      this.ws.onerror = () => this.ws?.close();
    } catch {
      this.scheduleReconnect(token);
    }
  }

  /** Force a reconnect when the stream goes silent past DEAD_MS (half-open). */
  private startWatchdog() {
    this.stopWatchdog();
    this.watchdogTimer = setInterval(() => {
      if (
        this.ws?.readyState === WebSocket.OPEN &&
        Date.now() - this.lastMessageAt > this.DEAD_MS
      ) {
        try { this.ws.close(); } catch { /* noop — onclose schedules reconnect */ }
      }
    }, 10_000);
  }

  private stopWatchdog() {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.watchdogTimer = null;
  }

  private scheduleReconnect(token?: string) {
    if (this.reconnectAttempts >= this.maxReconnect) return;
    if (this.reconnectTimer) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(token);
    }, delay);
  }

  subscribe(channel: string, handler: MessageHandler) {
    if (!this.handlers.has(channel)) this.handlers.set(channel, new Set());
    this.handlers.get(channel)!.add(handler);
    this.subscribedChannels.add(channel);
    return () => {
      this.handlers.get(channel)?.delete(handler);
      if (this.handlers.get(channel)?.size === 0) {
        this.handlers.delete(channel);
        this.subscribedChannels.delete(channel);
      }
    };
  }

  onMessage(handler: MessageHandler) {
    this.globalHandlers.add(handler);
    return () => this.globalHandlers.delete(handler);
  }

  onStatusChange(cb: (s: ConnectionStatus) => void) {
    this.statusCallbacks.add(cb);
    return () => this.statusCallbacks.delete(cb);
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.reconnectAttempts = this.maxReconnect;
    this.stopWatchdog();
    this.ws?.close();
    this.ws = null;
    this.setStatus('disconnected');
  }
}

export const wsManager = new WSManager();
