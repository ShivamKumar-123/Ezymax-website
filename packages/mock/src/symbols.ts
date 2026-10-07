import { CATALOGUE_ROWS, SPEC_ROWS, type CatalogueRow } from "./catalogue.generated";

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
  /** "core": the 28 hand-maintained instruments (always streamed); "catalogue": generated from the provider catalogue */
  tier?: "core" | "catalogue";
  /** tradable on live accounts (core: always; catalogue: the row's default, then the engine's switch via liveFlags) */
  liveTrading?: boolean;
  /** why a catalogue market is kept off live trading (config "live_off"), if it is */
  liveOff?: string;
  /** trading session key shared with the engine: fx, 24x7, us_equity, hk_equity, jp_equity */
  session?: string;
  quoteCcy?: string;
  baseCcy?: string;
  exchange?: string;
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

for (const i of INSTRUMENTS) {
  i.tier = "core";
  i.liveTrading = true;
}

function catalogueIcon(code: string): SymbolIcon {
  const [k, a = "", b = ""] = code.split(":");
  if (k === "p") return { kind: "pair", base: a, quote: b };
  if (k === "c") return { kind: "coin", coin: a };
  if (k === "f") return { kind: "flag", country: a };
  if (k === "m") return { kind: "metal", metal: a === "silver" ? "silver" : "gold" };
  return { kind: "energy", code: a };
}

const fromRow = ([symbol, name, assetClass, digits, spread, price, change, contractSize, session, quoteCcy, baseCcy, exchange, icon, live, liveOff]: CatalogueRow): Instrument => ({
  symbol,
  name,
  assetClass: assetClass as AssetClass,
  digits,
  price,
  spread,
  change,
  contractSize,
  icon: catalogueIcon(icon),
  tier: "catalogue",
  // the row's default (config "live": true, not kept off); live builds take the engine's switch on top (liveFlags)
  liveTrading: live === 1,
  liveOff: liveOff || undefined,
  session: session || undefined,
  quoteCcy: quoteCcy || undefined,
  baseCcy: baseCcy || undefined,
  exchange: exchange || undefined,
});

/**
 * The provider catalogue (1,381 instruments: forex, metals, energies, indices, crypto, US / Hong Kong / Tokyo stocks),
 * generated from config/instruments.json and priced from the provider snapshot (scripts/gen-catalogue.mjs). Demo-only
 * on live accounts until enabled (liveTrading: false).
 */
export const CATALOGUE: Instrument[] = CATALOGUE_ROWS.map(fromRow);

/** Every instrument: the 28 core ones first, then the catalogue (the terminal's Instruments list and search). */
export const ALL_INSTRUMENTS: Instrument[] = [...INSTRUMENTS, ...CATALOGUE];

export const INSTRUMENT_MAP: Record<string, Instrument> = Object.fromEntries(ALL_INSTRUMENTS.map((i) => [i.symbol, i]));

/** Open on live accounts? Core instruments yes; catalogue ones once enabled (demo accounts trade everything). */
export const liveTradable = (symbol: string) => INSTRUMENT_MAP[symbol]?.liveTrading !== false;

/** Effective trading spec of an instrument (config/trading-specs.json layered like the engine). */
export interface InstrumentSpec {
  contractSize: number;
  lotMin: number;
  lotMax: number;
  lotStep: number;
  maxLeverage: number;
  swapLong: number;
  swapShort: number;
  /** "points": points per lot per night (core instruments); "percent_per_year": yearly % of the position value */
  swapUnit: "points" | "percent_per_year";
  /** weekday charged three nights ("" = none: charged every night) */
  tripleSwapDay: string;
  /** "mon-fri" or "all" (every night, crypto) */
  swapDays: string;
  stopsLevelPoints: number;
}

const SPECS = new Map<string, InstrumentSpec>(
  SPEC_ROWS.map(([symbol, contractSize, lotMin, lotMax, lotStep, maxLeverage, swapLong, swapShort, pct, tripleSwapDay, swapDays, stopsLevelPoints]) => [
    symbol,
    { contractSize, lotMin, lotMax, lotStep, maxLeverage, swapLong, swapShort, swapUnit: pct ? "percent_per_year" : "points", tripleSwapDay, swapDays, stopsLevelPoints },
  ]),
);

/** The trading spec of `symbol` (undefined for symbols outside the catalogue). */
export const instrumentSpec = (symbol: string): InstrumentSpec | undefined => SPECS.get(symbol);

let liveRev = 0;
const liveSubs = new Set<() => void>();

/**
 * The live-trading switch per instrument, as the trading engine reports it (`liveTrading` of /v1/symbols). Live
 * accounts and guests only see markets that are on; enabling a class or a symbol in the Back Office shows it without
 * a deploy. Core instruments always trade live.
 */
export const liveFlags = {
  set(flags: Record<string, boolean>) {
    let changed = false;
    for (const [symbol, on] of Object.entries(flags)) {
      const i = INSTRUMENT_MAP[symbol];
      if (!i || i.tier !== "catalogue" || i.liveTrading === on) continue;
      i.liveTrading = on;
      changed = true;
    }
    if (!changed) return;
    liveRev++;
    liveSubs.forEach((f) => f());
  },
  subscribe(f: () => void): () => void {
    liveSubs.add(f);
    return () => void liveSubs.delete(f);
  },
  /** changes each time a flag changes (for useSyncExternalStore) */
  rev: () => liveRev,
};

/** Option series code from the options service / engine, e.g. EURUSD-20261002-1.1000-C. */
const SERIES_RE = /^([A-Z0-9.]+)-(\d{4})(\d{2})(\d{2})-([\d.]+)-([CP])$/;
const fallbacks = new Map<string, Instrument>();

/**
 * The instrument for a symbol. Never throws: an option series resolves to its underlying's look (named
 * "EURUSD 1.1000 Call · 2026-10-02"), any other unknown symbol (a broker's own instrument, a renamed feed code)
 * to a neutral text avatar, so a list containing it still renders.
 */
export function getInstrument(symbol: string): Instrument {
  const i = INSTRUMENT_MAP[symbol];
  if (i) return i;
  let f = fallbacks.get(symbol);
  if (!f) {
    const m = SERIES_RE.exec(symbol);
    const base = m ? INSTRUMENT_MAP[m[1]!] : undefined;
    f = m
      ? { ...(base ?? { assetClass: "forex", digits: 5, price: 0, spread: 0, change: 0, contractSize: 1, icon: { kind: "energy", code: m[1]!.slice(0, 3) } as SymbolIcon }), symbol, name: `${m[1]} ${m[5]} ${m[6] === "C" ? "Call" : "Put"} · ${m[2]}-${m[3]}-${m[4]}` }
      : { symbol, name: symbol, assetClass: "forex", digits: 5, price: 0, spread: 0, change: 0, contractSize: 1, icon: { kind: "energy", code: symbol.slice(0, 3) } };
    fallbacks.set(symbol, f);
  }
  return f;
}

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  forex: "Forex",
  metals: "Metals",
  indices: "Indices",
  energies: "Energies",
  crypto: "Crypto",
  stocks: "Stocks",
};
