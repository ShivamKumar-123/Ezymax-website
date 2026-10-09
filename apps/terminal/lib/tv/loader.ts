"use client";

// Loads the licensed TradingView Advanced Charts library (docs/INTEGRATIONS.md) from the terminal's own origin. The
// build records whether scripts/sync-assets.mjs put it in public/charting_library (next.config.ts →
// EZYMEX_TV_LIBRARY); without it, or when the script can't load, the terminal draws its own chart (ChartView).
import * as React from "react";
import type { TvLibrary } from "./types";

export const TV_LIBRARY_PATH = "/charting_library/";
const BUILT_WITH_TV = process.env.EZYMEX_TV_LIBRARY === "1";

export type TvStatus = "loading" | "ready" | "missing";

let status: TvStatus = BUILT_WITH_TV ? "loading" : "missing";
let loading: Promise<TvLibrary | null> | null = null;
const subs = new Set<() => void>();

/** The library's global (one script per page, shared by every chart), or null when it isn't installed. */
export function loadTradingView(): Promise<TvLibrary | null> {
  if (!BUILT_WITH_TV || typeof window === "undefined") return Promise.resolve(null);
  if (!loading) {
    loading = new Promise<TvLibrary | null>((resolve) => {
      const w = window as unknown as { TradingView?: TvLibrary };
      if (w.TradingView?.widget) return resolve(w.TradingView);
      const s = document.createElement("script");
      s.src = `${TV_LIBRARY_PATH}charting_library.standalone.js`;
      s.async = true;
      s.onload = () => resolve(w.TradingView?.widget ? w.TradingView : null);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    }).then((lib) => {
      status = lib ? "ready" : "missing";
      subs.forEach((f) => f());
      return lib;
    });
  }
  return loading;
}

/** Are chart slots TradingView charts (loaded, or still loading)? Read outside React (store, hotkeys). */
export const tvCharts = () => status !== "missing";

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};

/** "loading" until the script is in, then "ready", or "missing" (not installed / failed: use our own chart). */
export function useTvStatus(): TvStatus {
  const s = React.useSyncExternalStore(subscribe, () => status, () => (BUILT_WITH_TV ? "loading" : "missing"));
  React.useEffect(() => {
    void loadTradingView();
  }, []);
  return s;
}
