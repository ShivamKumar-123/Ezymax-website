"use client";

// CFD or Options: what Ezymex Trader trades. Not a choice: an account trades one product (its account type decides),
// so the mode is the active account's `product` (missing = CFD). lib/store.tsx sets it whenever the active account
// changes; a guest (no account) follows the link that opened the terminal. A tiny external store (kept outside
// lib/store.tsx) so the options chunks can read it without the terminal context.
import * as React from "react";
import { tr } from "@ezymex/i18n/react";
import type { AccountProduct } from "@ezymex/mock";

export type TradeMode = AccountProduct;

/** Underlying asked for by a link (`?u=`), read once by the options workspace. */
export const LINK_UNDERLYING_KEY = "ezymex.options.link-u";

/** The product of an account (engine JSON or mock): `"options"`, else CFD (older servers send none). */
export const productOf = (a: { product?: string | null } | null | undefined): TradeMode => (a?.product === "options" ? "options" : "cfd");

let mode: TradeMode = "cfd";
const listeners = new Set<() => void>();

export function getTradeMode() {
  return mode;
}

/**
 * lib/store.tsx only: the active account's product is the mode. Set while the terminal renders, so the first paint
 * already shows that account's workspace (no flash of the other one), then announced to anything not re-rendering.
 */
export function useSyncTradeMode(next: TradeMode) {
  mode = next;
  React.useLayoutEffect(() => {
    listeners.forEach((l) => l());
  }, [next]);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}

export function useTradeMode(): TradeMode {
  return React.useSyncExternalStore(subscribe, getTradeMode, () => "cfd");
}

/**
 * The product a link asks for: `?mode=options|cfd` (Client Area `/options` SSO hand-off, the public chain's "Trade"
 * button), else a CFD market (`?symbol=`, `?side=`) asks for CFD. null: the link doesn't care.
 */
export function linkProduct(link: { mode?: string | null; symbol?: string | null; side?: string | null }): TradeMode | null {
  const m = link.mode?.toLowerCase();
  if (m === "options" || m === "cfd") return m;
  return link.symbol || link.side === "buy" || link.side === "sell" ? "cfd" : null;
}

/**
 * The account a link opens on when the current one trades the other product: one of the product asked for, the same
 * live / demo kind first. null when the client has none (the terminal stays on the current account).
 */
export function accountForLink<A extends { type: string; product?: string | null }>(accounts: A[], current: A | null | undefined, want: TradeMode): A | null {
  const fits = accounts.filter((a) => productOf(a) === want);
  return fits.find((a) => a.type === current?.type) ?? fits[0] ?? null;
}

/** Remember the underlying of an options link (`?u=EURUSD`) for the options workspace. */
export function rememberLinkUnderlying(u: string | null | undefined) {
  const sym = u?.toUpperCase();
  if (!sym || !/^[A-Z]{5,7}$/.test(sym)) return;
  try {
    sessionStorage.setItem(LINK_UNDERLYING_KEY, sym);
  } catch {
    /* storage blocked */
  }
}

/** The engine refused a trade of the other product (`product_mismatch`): say what this account trades. */
export function productMismatchText() {
  return tr(mode === "options" ? "accounts.product.optionsOnly" : "accounts.product.cfdOnly");
}
