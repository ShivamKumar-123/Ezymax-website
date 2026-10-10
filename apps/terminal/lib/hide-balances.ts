"use client";

// "Hide balances" in Ezymex Trader (the Client Area dashboard has the same switch:
// apps/crm/components/dashboard/home/hide-balances.tsx). One eye masks every account-level amount (balance, equity,
// credit, floating P&L, margin, free margin) in the top bar, the account health strip, the account menus, the phone
// header and Trade tab, and the free margin / cash of the order summaries. Per-position P&L stays: traders need it to
// trade. Remembered on this device; every component that reads it, and other open tabs, update at once.
// components/ui/balances.tsx has the eye button and <AccountMoney>; dependency-free so lib/store.tsx can read it too.
import * as React from "react";

export const HIDE_BALANCES_KEY = "ezymex.terminal.hideBalances";

/** What a hidden amount shows instead of the number. */
export const MASK = "••••••";

const subscribers = new Set<() => void>();
const emit = () => subscribers.forEach((f) => f());

// this page's value: read from storage once, then kept here (storage blocked or full: the switch still works here)
let hidden: boolean | null = null;

/** True while the trader chose to hide balances (outside React: toasts, logs). */
export function balancesHidden(): boolean {
  if (hidden === null) {
    try {
      hidden = localStorage.getItem(HIDE_BALANCES_KEY) === "1";
    } catch {
      hidden = false;
    }
  }
  return hidden;
}

export function setBalancesHidden(v: boolean) {
  hidden = v;
  try {
    localStorage.setItem(HIDE_BALANCES_KEY, v ? "1" : "0");
  } catch {
    /* private mode: this page only */
  }
  emit();
}

export const toggleBalancesHidden = () => setBalancesHidden(!balancesHidden());

/** `text`, or the mask while balances are hidden: for amounts that end up in a string (toasts). */
export const maskMoney = (text: string) => (balancesHidden() ? MASK : text);

function subscribe(onChange: () => void) {
  subscribers.add(onChange);
  // another tab switched it (key null: that tab cleared the storage)
  const onStorage = (e: StorageEvent) => {
    if (e.key !== HIDE_BALANCES_KEY && e.key !== null) return;
    hidden = null;
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    subscribers.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Re-renders when balances are hidden or shown (false on the server render and before the choice is read). */
export function useBalancesHidden(): boolean {
  return React.useSyncExternalStore(subscribe, balancesHidden, () => false);
}
