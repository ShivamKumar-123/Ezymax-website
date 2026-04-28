/**
 * @feature trading
 * Trading terminal, order management, positions, watchlist, instruments.
 */

// Re-export from current locations during migration
export { useTradingStore } from '@/stores/tradingStore';
export type { Position, InstrumentInfo, TradingAccount, TickData } from '@/stores/tradingStore';
