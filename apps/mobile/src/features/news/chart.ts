// Tagged instruments open the Trade tab's chart. Only symbols the broker quotes are tappable; the chart's candles
// are warmed on press-in so the chart opens drawn.
import { useSyncExternalStore } from "react";
import { router } from "expo-router";
import { feed } from "@/market/feed";
import { instruments, onInstruments } from "@/market/instruments";
import { prefetchCandles } from "../chart/data";
import { setTradeSymbol, tradeSymbolStore } from "../trade/symbol";

/** A symbol the app can chart (quoted by market-data, or in the cached instrument list). */
export function isTradable(symbol: string): boolean {
  return feed.available.has(symbol) || instruments().some((i) => i.symbol === symbol);
}

function subscribe(fn: () => void) {
  const offList = onInstruments(fn);
  const offSnap = feed.onSnapshot(fn);
  return () => {
    offList();
    offSnap();
  };
}

/** isTradable() that updates once the instrument list or the first quotes arrive (a cold start into a story). */
export function useTradable(symbol: string): boolean {
  const get = () => isTradable(symbol);
  return useSyncExternalStore(subscribe, get, get);
}

export function warmChart(symbol: string) {
  if (isTradable(symbol)) prefetchCandles(symbol, tradeSymbolStore.get().tf);
}

export function openChart(symbol: string) {
  if (!isTradable(symbol)) return;
  setTradeSymbol(symbol);
  router.navigate("/trade");
}
