// Contract specifications from the engine and the maths the order ticket previews (the same formulas as the
// engine: services/trading/src/engine/mod.rs symbol_margin / pnl / to_usd).
import { apiGet } from "@/lib/api";
import { getQueryData, useQuery } from "@/lib/query";
import { feed } from "@/market/feed";
import type { SymbolSpec } from "./types";

export const SPECS_KEY = "trade/symbols";
const fetchSpecs = () => apiGet<{ symbols: SymbolSpec[] }>("trade/symbols");

/** `live`: poll every minute while mounted (the Trade tab: each spec's `open` flag follows the trading session). */
export function useSpecs(opts: { live?: boolean } = {}) {
  return useQuery(SPECS_KEY, fetchSpecs, opts.live ? { persist: true, staleMs: 60_000, intervalMs: 60_000 } : { persist: true, staleMs: 10 * 60_000 });
}

export function specOf(symbol: string): SymbolSpec | undefined {
  return getQueryData<{ symbols: SymbolSpec[] }>(SPECS_KEY)?.symbols.find((s) => s.symbol === symbol);
}

export function useSpec(symbol: string): SymbolSpec | undefined {
  const q = useSpecs();
  return q.data?.symbols.find((s) => s.symbol === symbol);
}

/** Converts `amount` in `ccy` to USD with the live mid of USD<ccy> (divide) or <ccy>USD (multiply). */
export function toUsd(ccy: string, amount: number, own?: { symbol: string; price: number }): number {
  if (!ccy || ccy === "USD") return amount;
  for (const [pair, multiply] of [[`USD${ccy}`, false], [`${ccy}USD`, true]] as const) {
    const rate = own && own.symbol === pair ? own.price : feed.mid(pair);
    if (rate && rate > 0) return multiply ? amount * rate : amount / rate;
  }
  return amount;
}

/** Account-currency factor: cent accounts count in USC (USD x 100). */
export const centFactor = (cent: boolean | undefined) => (cent ? 100 : 1);

/** Margin for `lots` at `price` (account currency). */
export function marginFor(spec: SymbolSpec, lots: number, price: number, leverage: number, cent?: boolean): number {
  const lev = Math.max(1, Math.min(leverage || 1, spec.maxLeverage || leverage || 1));
  const perLotQuote = spec.contractSize * price;
  const perLotUsd = toUsd(spec.profitCurrency, perLotQuote, { symbol: spec.symbol, price });
  return ((perLotUsd * spec.marginPct) / 100 / lev) * lots * centFactor(cent);
}

/** Value of one pip for `lots` (account currency). */
export function pipValue(spec: SymbolSpec, lots: number, price: number, cent?: boolean): number {
  return toUsd(spec.profitCurrency, spec.pipSize * spec.contractSize * lots, { symbol: spec.symbol, price }) * centFactor(cent);
}

/** Price P&L of a trade closed at `close` (account currency, before swap / commission). */
export function profitAt(spec: SymbolSpec, side: "buy" | "sell", lots: number, open: number, close: number, cent?: boolean): number {
  const q = (close - open) * (side === "buy" ? 1 : -1) * lots * spec.contractSize;
  return toUsd(spec.profitCurrency, q, { symbol: spec.symbol, price: close }) * centFactor(cent);
}

/** Rounds a volume to the symbol's lot step within its limits. */
export function clampLots(spec: SymbolSpec | undefined, v: number): number {
  const step = spec?.lotStep || 0.01;
  const min = spec?.lotMin || step;
  const max = spec?.lotMax || 100;
  const n = Math.round(v / step) * step;
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  return +Math.min(max, Math.max(min, n)).toFixed(decimals);
}

export const roundTo = (v: number, digits: number) => +v.toFixed(digits);
