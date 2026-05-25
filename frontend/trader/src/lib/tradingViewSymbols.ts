/** TradingView widget "symbol" values (chart + news timeline). */
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


/** Separate symbol map for the Technical Analysis widget.
 *
 * The chart map prefers OANDA / TVC ratio symbols because they visually
 * track the Infoway spot feed used by the order ticket. The TA widget,
 * however, only has analysis data for instruments TradingView's
 * scanner covers — `OANDA:XAGUSD` returns "No data here yet" because
 * TradingView's TA scanner indexes the front-month silver CFD under
 * TVC:SILVER, not the OANDA spot pair.
 *
 * Override entries here ONLY for symbols where the chart map's exchange
 * is missing TA coverage. Anything not listed falls back to the regular
 * chart symbol via `toTradingViewSymbol`. */
export const TRADINGVIEW_TA_SYMBOL_OVERRIDES: Record<string, string> = {
  // Metals — TVC ratio symbols always have TA data; OANDA pairs sometimes don't.
  XAUUSD: 'TVC:GOLD',
  XAGUSD: 'TVC:SILVER',
  // Oil — same story.
  USOIL: 'TVC:USOIL',
};

export function toTradingViewTASymbol(symbol: string | undefined | null): string {
  const s = (symbol || 'EURUSD').toUpperCase();
  return TRADINGVIEW_TA_SYMBOL_OVERRIDES[s] || toTradingViewSymbol(s);
}
