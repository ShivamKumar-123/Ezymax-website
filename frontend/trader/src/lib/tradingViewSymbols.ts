/** TradingView widget “symbol” values (chart + news timeline). */
export const TRADINGVIEW_SYMBOL_MAP: Record<string, string> = {
  EURUSD: 'FX:EURUSD',
  GBPUSD: 'FX:GBPUSD',
  USDJPY: 'FX:USDJPY',
  AUDUSD: 'FX:AUDUSD',
  USDCAD: 'FX:USDCAD',
  USDCHF: 'FX:USDCHF',
  NZDUSD: 'FX:NZDUSD',
  EURGBP: 'FX:EURGBP',
  EURJPY: 'FX:EURJPY',
  GBPJPY: 'FX:GBPJPY',
  // TVC: prefixes are CFD-ratio symbols (TVC:GOLD ~ 4694) — visibly
  // out of sync with the Infoway spot feed used by the order ticket.
  // OANDA: maps stay close to broker spot price for the visible match.
  XAUUSD: 'OANDA:XAUUSD',
  XAGUSD: 'OANDA:XAGUSD',
  USOIL: 'OANDA:WTICOUSD',
  US30: 'TVC:DJI',
  US500: 'SP:SPX',
  NAS100: 'NASDAQ:NDX',
  BTCUSD: 'BINANCE:BTCUSDT',
  ETHUSD: 'BINANCE:ETHUSDT',
  DOGUSD: 'BINANCE:DOGEUSDT',
  DOGEUSD: 'BINANCE:DOGEUSDT',
  SOLUSD: 'BINANCE:SOLUSDT',
  LTCUSD: 'BINANCE:LTCUSDT',
  XRPUSD: 'BINANCE:XRPUSDT',
};

export function toTradingViewSymbol(symbol: string | undefined | null): string {
  const s = (symbol || 'EURUSD').toUpperCase();
  return TRADINGVIEW_SYMBOL_MAP[s] || `FX:${s}`;
}
