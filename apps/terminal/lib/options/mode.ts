"use client";

// CFD | Options switch at the top of Ezymex Trader. A tiny external store (kept outside lib/store.tsx), persisted per
// browser. `?mode=options` (and `?u=EURUSD` for the underlying) from the public option chain page selects Options.
import * as React from "react";

export type TradeMode = "cfd" | "options";

const KEY = "ezymex.terminal.mode";
/** Underlying asked for by a link (`?u=`), read once by the options workspace. */
export const LINK_UNDERLYING_KEY = "ezymex.options.link-u";

function initial(): TradeMode {
  if (typeof window === "undefined") return "cfd";
  try {
    const sp = new URLSearchParams(window.location.search);
    const m = sp.get("mode");
    const u = sp.get("u")?.toUpperCase();
    if (u && /^[A-Z]{5,7}$/.test(u)) sessionStorage.setItem(LINK_UNDERLYING_KEY, u);
    if (m === "options" || m === "cfd") {
      localStorage.setItem(KEY, m);
      return m;
    }
    return localStorage.getItem(KEY) === "options" ? "options" : "cfd";
  } catch {
    return "cfd";
  }
}

let mode: TradeMode = initial();
const listeners = new Set<() => void>();

export function getTradeMode() {
  return mode;
}

export function setTradeMode(next: TradeMode) {
  if (next === mode) return;
  mode = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage blocked: the choice lasts for this page */
  }
  listeners.forEach((l) => l());
}

/**
 * A link asked for a mode (Client Area `/options` SSO hand-off `…&mode=options`, the public chain's "Trade" button,
 * `?mode=options` on a normal or guest load): switch to it, and remember `u` for the options workspace.
 */
export function applyLinkMode(m: string | null | undefined, u?: string | null) {
  const want = m?.toLowerCase();
  if (want !== "options" && want !== "cfd") return false;
  const sym = u?.toUpperCase();
  if (want === "options" && sym && /^[A-Z]{5,7}$/.test(sym)) {
    try {
      sessionStorage.setItem(LINK_UNDERLYING_KEY, sym);
    } catch {
      /* storage blocked */
    }
  }
  setTradeMode(want);
  return true;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}

export function useTradeMode(): TradeMode {
  return React.useSyncExternalStore(subscribe, getTradeMode, () => "cfd");
}
