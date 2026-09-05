import { getWebSocketBaseUrl } from './getWebSocketBaseUrl';

type MessageHandler = (data: any) => void;

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

class WSManager {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<MessageHandler>>();
  private globalHandlers = new Set<MessageHandler>();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  /** Only disconnect() sets this. Previously a `maxReconnect = 10` ceiling made
   *  the manager give up FOREVER after ~3 minutes of trouble, so a brief network
   *  blip froze every price on the page until a full reload. Backoff is capped
   *  by delay now, never by attempt count. */
  private stopped = false;
  /** A WebSocket can stay "open" while the connection behind it is dead — no
   *  onclose fires, so nothing ever reconnects and prices silently freeze. The
   *  server feeds already guard against this; the browser did not. */
  private silenceTimer: NodeJS.Timeout | null = null;
  private lastMessageAt = 0;
  private lastToken: string | undefined;
  private wakeListenersInstalled = false;
  private static readonly SILENT_RECONNECT_MS = 45_000;
  private statusCallbacks = new Set<(s: ConnectionStatus) => void>();
  private _status: ConnectionStatus = 'disconnected';
  private subscribedChannels = new Set<string>();

  get status() { return this._status; }

  private setStatus(s: ConnectionStatus) {
    this._status = s;
    this.statusCallbacks.forEach((cb) => cb(s));
  }

  connect(token?: string) {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.stopped = false;
    this.lastToken = token;
    this.setStatus('connecting');
    this.installWakeListeners();

    const base = getWebSocketBaseUrl();
    const wsUrl = `${base}/ws/prices`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        this.lastMessageAt = Date.now();
        this.startSilenceWatchdog();
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
        this.setStatus('disconnected');
        this.scheduleReconnect(token);
      };

      this.ws.onerror = () => this.ws?.close();
    } catch {
      this.scheduleReconnect(token);
    }
  }

  /** Force a reconnect when the socket has gone quiet. A half-open connection
   *  (laptop sleep, Wi-Fi drop, a proxy silently dropping the tunnel) leaves
   *  readyState OPEN and never fires onclose, so without this the page just
   *  shows frozen prices forever. Closing here makes onclose fire, which runs
   *  the normal reconnect path. */
  private startSilenceWatchdog() {
    this.stopSilenceWatchdog();
    this.silenceTimer = setInterval(() => {
      if (this.stopped || this.ws?.readyState !== WebSocket.OPEN) return;
      if (Date.now() - this.lastMessageAt < WSManager.SILENT_RECONNECT_MS) return;
      try { this.ws.close(); } catch { /* onclose still schedules the retry */ }
    }, 10_000);
  }

  private stopSilenceWatchdog() {
    if (this.silenceTimer) clearInterval(this.silenceTimer);
    this.silenceTimer = null;
  }

  /** Reconnect immediately when the machine comes back rather than waiting out
   *  the backoff — coming out of sleep or regaining Wi-Fi should feel instant. */
  private installWakeListeners() {
    if (this.wakeListenersInstalled || typeof window === 'undefined') return;
    this.wakeListenersInstalled = true;
    const wake = () => {
      if (this.stopped) return;
      if (this.ws?.readyState === WebSocket.OPEN) return;
      if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
      this.reconnectAttempts = 0;
      this.connect(this.lastToken);
    };
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') wake();
    });
  }

  private scheduleReconnect(token?: string) {
    if (this.stopped) return;
    if (this.reconnectTimer) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.stopSilenceWatchdog();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(token ?? this.lastToken);
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
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.stopSilenceWatchdog();
    this.ws?.close();
    this.ws = null;
    this.setStatus('disconnected');
  }
}

export const wsManager = new WSManager();
