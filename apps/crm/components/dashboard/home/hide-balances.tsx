"use client";

// "Hide balances" on the dashboard: one switch for every money figure on it (total equity, today's / floating P&L,
// wallet balance, rewards, the total balance and the account cards). Remembered on this device; every component that
// reads it (and other open tabs) updates at once.

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { useT } from "@ezymex/i18n/react";
import { cn } from "@/components/kit";

const KEY = "ezymex.dashboard.hideBalances";
const subscribers = new Set<() => void>();

/** What a hidden amount shows instead of the number. */
export const MASK = "••••••";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setBalancesHidden(hidden: boolean) {
  try {
    localStorage.setItem(KEY, hidden ? "1" : "0");
  } catch {
    /* private mode: the switch still works for this page */
  }
  subscribers.forEach((f) => f());
}

function subscribe(onChange: () => void) {
  subscribers.add(onChange);
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange();
  window.addEventListener("storage", onStorage);
  return () => {
    subscribers.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** True while the client chose to hide balances (shown on the server render and before the choice is read). */
export function useBalancesHidden(): boolean {
  return React.useSyncExternalStore(subscribe, read, () => false);
}

/** The eye button: hides / shows every amount on the dashboard. */
export function HideBalancesButton({ className }: { className?: string }) {
  const t = useT();
  const hidden = useBalancesHidden();
  const label = hidden ? t("dashboard.home.showBalances") : t("dashboard.home.hideBalances");
  return (
    <button
      type="button"
      onClick={() => setBalancesHidden(!hidden)}
      aria-pressed={hidden}
      aria-label={label}
      title={label}
      className={cn("grid size-10 shrink-0 place-items-center rounded-full text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg", className)}
    >
      {hidden ? <Eye className="size-[18px]" /> : <EyeOff className="size-[18px]" />}
    </button>
  );
}
