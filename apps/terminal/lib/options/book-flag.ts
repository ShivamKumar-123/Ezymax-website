"use client";

// Two facts the terminal shell needs about the options order book without loading the options workspace: whether
// the book is live for the account on screen (the workspace's store sets it from the chain), and how many book orders
// are working (the orders store sets it). The toolbox offers its Orders tab from these. Dependency-free on purpose.
import * as React from "react";

interface Flag {
  live: boolean;
  /** login → working book orders */
  open: Record<string, number>;
}

let flag: Flag = { live: false, open: {} };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const bookFlag = {
  setLive(live: boolean) {
    if (flag.live === live) return;
    flag = { ...flag, live };
    emit();
  },
  setOpen(login: string, n: number) {
    if ((flag.open[login] ?? 0) === n) return;
    flag = { ...flag, open: { ...flag.open, [login]: n } };
    emit();
  },
};

function subscribe(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}

/** Book live + this login's working book orders. */
export function useBookFlag(login: string | null | undefined): { live: boolean; open: number } {
  const live = React.useSyncExternalStore(subscribe, () => flag.live, () => false);
  const open = React.useSyncExternalStore(subscribe, () => (login ? (flag.open[login] ?? 0) : 0), () => 0);
  return { live, open };
}
