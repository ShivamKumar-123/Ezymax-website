import { WS_URL } from '../../constants';
import * as SecureStore from 'expo-secure-store';
import logger from '../../utils/logger';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.priceWs = null;
    this.tradeWs = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 12;
    this.reconnectDelay = 3000;
    this.priceListeners = new Set();
    this.tradeListeners = new Set();
    this.isConnecting = false;
    // Set while WE close a socket on purpose — its onclose must not schedule
    // a reconnect (previously disconnectPriceStream() triggered an immediate
    // reconnect via its own close event).
    this.intentionalClose = { price: false, trade: false };
    this.tradeAccountId = null;
  }

  async connectPriceStream() {
    if (this.priceWs && this.priceWs.readyState === WebSocket.OPEN) {
      logger.log('Price WebSocket already connected');
      return;
    }

    if (this.isConnecting) {
      logger.log('Price WebSocket connection already in progress');
      return;
    }

    this.isConnecting = true;

    try {
      const wsUrl = `${WS_URL}/ws/prices`;
      
      this.priceWs = new WebSocket(wsUrl);

      this.priceWs.onopen = () => {
        logger.log('Price WebSocket connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
      };

      this.priceWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notifyPriceListeners(data);
        } catch (error) {
          logger.error('Error parsing price message:', error);
        }
      };

      this.priceWs.onerror = () => {
        // Don't surface as logger.error — Expo Go shows that as an in-app red toast.
        // Reconnect logic handles the actual recovery.
        this.isConnecting = false;
      };

      this.priceWs.onclose = () => {
        this.isConnecting = false;
        if (this.intentionalClose.price) {
          this.intentionalClose.price = false;
          return;
        }
        this.handleReconnect('price');
      };
    } catch (error) {
      logger.error('Error connecting to price stream:', error);
      this.isConnecting = false;
    }
  }

  async connectTradeStream(accountId) {
    if (this.tradeWs && this.tradeWs.readyState === WebSocket.OPEN) {
      logger.log('Trade WebSocket already connected');
      return;
    }

    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        logger.error('No token found for trade stream');
        return;
      }

      const wsUrl = `${WS_URL}/ws/trades/${accountId}?token=${token}`;
      
      this.tradeWs = new WebSocket(wsUrl);

      this.tradeWs.onopen = () => {
        logger.log('Trade WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.tradeWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notifyTradeListeners(data);
        } catch (error) {
          logger.error('Error parsing trade message:', error);
        }
      };

      this.tradeWs.onerror = () => {
        // Silent — handleReconnect handles recovery.
      };

      this.tradeWs.onclose = () => {
        if (this.intentionalClose.trade) {
          this.intentionalClose.trade = false;
          return;
        }
        this.handleReconnect('trade', accountId);
      };
    } catch (error) {
      logger.error('Error connecting to trade stream:', error);
    }
  }

  handleReconnect(type, accountId = null) {
    this.reconnectAttempts++;
    // Bounded, backed-off retries (prices also have a REST polling fallback,
    // so giving up is safe). reconnectAttempts resets to 0 on a successful
    // open; a fresh connect*Stream() call from a screen also retries anew.
    if (this.reconnectAttempts > this.maxReconnectAttempts) return;
    const delay = Math.min(this.reconnectDelay * this.reconnectAttempts, 15000);

    setTimeout(() => {
      if (type === 'price') {
        this.connectPriceStream();
      } else if (type === 'trade' && accountId) {
        this.connectTradeStream(accountId);
      }
    }, delay);
  }

  onPriceUpdate(callback) {
    this.priceListeners.add(callback);
    return () => this.priceListeners.delete(callback);
  }

  onTradeUpdate(callback) {
    this.tradeListeners.add(callback);
    return () => this.tradeListeners.delete(callback);
  }

  notifyPriceListeners(data) {
    this.priceListeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        logger.error('Error in price listener:', error);
      }
    });
  }

  notifyTradeListeners(data) {
    this.tradeListeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        logger.error('Error in trade listener:', error);
      }
    });
  }

  disconnectPriceStream() {
    if (this.priceWs) {
      this.intentionalClose.price = true;
      this.priceWs.close();
      this.priceWs = null;
    }
  }

  disconnectTradeStream() {
    if (this.tradeWs) {
      this.intentionalClose.trade = true;
      this.tradeWs.close();
      this.tradeWs = null;
    }
  }

  disconnectAll() {
    this.disconnectPriceStream();
    this.disconnectTradeStream();
    this.priceListeners.clear();
    this.tradeListeners.clear();
  }

  getConnectionStatus() {
    return {
      price: this.priceWs ? this.priceWs.readyState : WebSocket.CLOSED,
      trade: this.tradeWs ? this.tradeWs.readyState : WebSocket.CLOSED,
    };
  }
}

export default new WebSocketService();
