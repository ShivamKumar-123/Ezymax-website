// The symbol the Trade tab shows (and its timeframe), kept on the phone. Markets sets it on a row tap.
import { kv } from "@/lib/kv";
import { createStore, useStore } from "@/lib/store";
import { TIMEFRAMES, type Timeframe } from "../chart/data";

type State = { symbol: string; tf: Timeframe };
const KEY = "kalks.tradeSymbol";
const saved = kv.getJSON<State>(KEY);
export const tradeSymbolStore = createStore<State>(saved && TIMEFRAMES.includes(saved.tf) ? saved : { symbol: "EURUSD", tf: "M15" });
tradeSymbolStore.subscribe(() => kv.setJSON(KEY, tradeSymbolStore.get()));

export const useTradeSymbol = () => useStore(tradeSymbolStore, (s) => s.symbol);
export const useTradeTf = () => useStore(tradeSymbolStore, (s) => s.tf);
export const setTradeSymbol = (symbol: string) => tradeSymbolStore.set((s) => (s.symbol === symbol ? s : { ...s, symbol }));
export const setTradeTf = (tf: Timeframe) => tradeSymbolStore.set((s) => (s.tf === tf ? s : { ...s, tf }));
