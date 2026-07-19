import { getWebSocketBaseUrl } from './getWebSocketBaseUrl';

type TradeCallback = (data: TradeEvent) => void;

export interface TradeEvent {
  type: string;
  [key: string]: unknown;
}

class TradeSocket {
  private ws: WebSocket | null = null;
  private callbacks: Set<TradeCallback> = new Set();
  private accountId: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;

  /** `token` is now ignored — the backend reads the HttpOnly pt_access
   * cookie automatically. The parameter stays for API compatibility
   * with older callers but should be dropped over time. */
  connect(accountId: string, _token?: string) {
    void _token;
    this.accountId = accountId;
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const base = getWebSocketBaseUrl();
    const wsUrl = `${base}/ws/trades/${accountId}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const data: TradeEvent = JSON.parse(event.data);
        this.callbacks.forEach((cb) => cb(data));
      } catch {
        // ignore
      }
    };

    this.ws.onclose = () => {
      // Exponential backoff (3s → 48s cap) mirrors wsManager — a downed
      // gateway shouldn't be hammered every 3s by every open tab forever.
      if (this.accountId) {
        const delay = Math.min(3000 * 2 ** this.reconnectAttempts, 48000);
        this.reconnectAttempts += 1;
        this.reconnectTimer = setTimeout(() => this.connect(accountId), delay);
      }
    };

    this.ws.onerror = () => this.ws?.close();
  }

  subscribe(callback: TradeCallback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  disconnect() {
    this.accountId = null;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.callbacks.clear();
  }
}

export const tradeSocket = new TradeSocket();
