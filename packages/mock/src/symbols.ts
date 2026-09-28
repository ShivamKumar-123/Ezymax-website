export type AssetClass = "forex" | "metals" | "indices" | "energies" | "crypto" | "stocks";

/** How to draw the instrument avatar: two currency flags, a coin logo, a stock logo, or a country flag for an index. */
export type SymbolIcon =
  | { kind: "pair"; base: string; quote: string } // ISO country codes for flag-icons
  | { kind: "coin"; coin: string } // file in /assets/coins
  | { kind: "stock"; logo: string; bg: string } // file in /assets/stocks
  | { kind: "flag"; country: string }
  | { kind: "metal"; metal: "gold" | "silver" }
  | { kind: "energy"; code: string };

export interface Instrument {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  digits: number;
  price: number; // reference mid price
  spread: number; // in price units
  change: number; // 1D % change reference
  contractSize: number;
  icon: SymbolIcon;
}

const pair = (base: string, quote: string): SymbolIcon => ({ kind: "pair", base, quote });

export const INSTRUMENTS: Instrument[] = [
  { symbol: "EURUSD", name: "Euro vs US Dollar", assetClass: "forex", digits: 5, price: 1.08456, spread: 0.00008, change: 0.21, contractSize: 100000, icon: pair("eu", "us") },
  { symbol: "GBPUSD", name: "Pound vs US Dollar", assetClass: "forex", digits: 5, price: 1.27881, spread: 0.0001, change: -0.14, contractSize: 100000, icon: pair("gb", "us") },
  { symbol: "USDJPY", name: "US Dollar vs Yen", assetClass: "forex", digits: 3, price: 149.382, spread: 0.012, change: 0.36, contractSize: 100000, icon: pair("us", "jp") },
  { symbol: "AUDUSD", name: "Aussie vs US Dollar", assetClass: "forex", digits: 5, price: 0.66214, spread: 0.0001, change: 0.52, contractSize: 100000, icon: pair("au", "us") },
  { symbol: "USDCAD", name: "US Dollar vs Loonie", assetClass: "forex", digits: 5, price: 1.35722, spread: 0.00012, change: -0.08, contractSize: 100000, icon: pair("us", "ca") },
  { symbol: "USDCHF", name: "US Dollar vs Franc", assetClass: "forex", digits: 5, price: 0.84917, spread: 0.00012, change: -0.22, contractSize: 100000, icon: pair("us", "ch") },
  { symbol: "GBPJPY", name: "Pound vs Yen", assetClass: "forex", digits: 3, price: 191.024, spread: 0.02, change: 1.12, contractSize: 100000, icon: pair("gb", "jp") },
  { symbol: "EURJPY", name: "Euro vs Yen", assetClass: "forex", digits: 3, price: 162.011, spread: 0.018, change: 0.58, contractSize: 100000, icon: pair("eu", "jp") },
  { symbol: "USDINR", name: "US Dollar vs Rupee", assetClass: "forex", digits: 4, price: 83.5125, spread: 0.0035, change: 0.04, contractSize: 100000, icon: pair("us", "in") },
  { symbol: "XAUUSD", name: "Gold vs US Dollar", assetClass: "metals", digits: 2, price: 2654.3, spread: 0.18, change: 0.84, contractSize: 100, icon: { kind: "metal", metal: "gold" } },
  { symbol: "XAGUSD", name: "Silver vs US Dollar", assetClass: "metals", digits: 3, price: 31.184, spread: 0.02, change: 1.46, contractSize: 5000, icon: { kind: "metal", metal: "silver" } },
  { symbol: "US30", name: "Dow Jones 30", assetClass: "indices", digits: 1, price: 42318.5, spread: 1.8, change: 0.31, contractSize: 1, icon: { kind: "flag", country: "us" } },
  { symbol: "NAS100", name: "Nasdaq 100", assetClass: "indices", digits: 1, price: 20118.4, spread: 1.2, change: 1.24, contractSize: 1, icon: { kind: "flag", country: "us" } },
  { symbol: "SPX500", name: "S&P 500", assetClass: "indices", digits: 1, price: 5762.8, spread: 0.5, change: 0.44, contractSize: 1, icon: { kind: "flag", country: "us" } },
  { symbol: "GER40", name: "Germany 40", assetClass: "indices", digits: 1, price: 18994.2, spread: 1.4, change: -0.27, contractSize: 1, icon: { kind: "flag", country: "de" } },
  { symbol: "UK100", name: "FTSE 100", assetClass: "indices", digits: 1, price: 8321.6, spread: 1.1, change: -0.12, contractSize: 1, icon: { kind: "flag", country: "gb" } },
  { symbol: "JP225", name: "Nikkei 225", assetClass: "indices", digits: 0, price: 38742, spread: 8, change: 0.92, contractSize: 1, icon: { kind: "flag", country: "jp" } },
  { symbol: "USOIL", name: "WTI Crude Oil", assetClass: "energies", digits: 2, price: 71.84, spread: 0.03, change: -1.38, contractSize: 1000, icon: { kind: "energy", code: "WTI" } },
  { symbol: "UKOIL", name: "Brent Crude Oil", assetClass: "energies", digits: 2, price: 75.12, spread: 0.03, change: -1.11, contractSize: 1000, icon: { kind: "energy", code: "BRN" } },
  { symbol: "BTCUSD", name: "Bitcoin", assetClass: "crypto", digits: 2, price: 63412, spread: 18, change: 2.84, contractSize: 1, icon: { kind: "coin", coin: "btc" } },
  { symbol: "ETHUSD", name: "Ethereum", assetClass: "crypto", digits: 2, price: 2618.44, spread: 1.6, change: 1.92, contractSize: 1, icon: { kind: "coin", coin: "eth" } },
  { symbol: "SOLUSD", name: "Solana", assetClass: "crypto", digits: 3, price: 148.212, spread: 0.12, change: 4.61, contractSize: 1, icon: { kind: "coin", coin: "sol" } },
  { symbol: "XRPUSD", name: "Ripple", assetClass: "crypto", digits: 4, price: 0.5874, spread: 0.0012, change: -2.14, contractSize: 1, icon: { kind: "coin", coin: "xrp" } },
  { symbol: "AAPL", name: "Apple Inc.", assetClass: "stocks", digits: 2, price: 228.14, spread: 0.06, change: 0.72, contractSize: 1, icon: { kind: "stock", logo: "apple", bg: "#1d1d1f" } },
  { symbol: "TSLA", name: "Tesla Inc.", assetClass: "stocks", digits: 2, price: 254.28, spread: 0.08, change: -3.18, contractSize: 1, icon: { kind: "stock", logo: "tesla", bg: "#cc0000" } },
  { symbol: "NVDA", name: "NVIDIA Corp.", assetClass: "stocks", digits: 2, price: 121.44, spread: 0.05, change: 2.26, contractSize: 1, icon: { kind: "stock", logo: "nvidia", bg: "#76b900" } },
  { symbol: "META", name: "Meta Platforms", assetClass: "stocks", digits: 2, price: 568.31, spread: 0.12, change: 1.08, contractSize: 1, icon: { kind: "stock", logo: "meta", bg: "#0866ff" } },
  { symbol: "NFLX", name: "Netflix Inc.", assetClass: "stocks", digits: 2, price: 709.52, spread: 0.2, change: -0.64, contractSize: 1, icon: { kind: "stock", logo: "netflix", bg: "#e50914" } },
];

export const INSTRUMENT_MAP: Record<string, Instrument> = Object.fromEntries(INSTRUMENTS.map((i) => [i.symbol, i]));

export function getInstrument(symbol: string): Instrument {
  const i = INSTRUMENT_MAP[symbol];
  if (!i) throw new Error(`Unknown instrument ${symbol}`);
  return i;
}

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  forex: "Forex",
  metals: "Metals",
  indices: "Indices",
  energies: "Energies",
  crypto: "Crypto",
  stocks: "Stocks",
};
