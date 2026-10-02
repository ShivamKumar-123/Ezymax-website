"use client";

// The account's working book orders (docs/OPTIONS-EXCHANGE.md §12 `GET …/book/orders?status=open`): the Orders tab,
// the depth ladder's own-order highlight, the toolbox count and the series kept streamed. Live builds refresh every
// 3 s while something on screen uses them, and at once after any order action or fill notification; demo builds get
// every change from the in-browser book as it happens. An engine without the book routes reports `missing` once, and
// the workspace falls back to the house-priced flow.
import * as React from "react";
import { IS_LIVE } from "@kalks/mock";
import { bookApi, bookMissing } from "./book-api";
import { bookFlag } from "./book-flag";
import { onDemoBookChange } from "./mock-engine";
import type { BookOrder } from "./types";

export interface OrdersView {
  open: BookOrder[];
  loaded: boolean;
}

const EMPTY: OrdersView = { open: [], loaded: false };

class BookOrders {
  private views = new Map<string, OrdersView>();
  private listeners = new Set<() => void>();
  private users = new Map<string, number>();
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private inflight = new Set<string>();
  private missing = new Set<() => void>();

  constructor() {
    if (!IS_LIVE && typeof window !== "undefined") onDemoBookChange((login) => void this.refresh(login));
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };

  get(login: string): OrdersView {
    return this.views.get(login) ?? EMPTY;
  }

  /** The engine has no book routes: the store falls back to house prices. */
  onMissing(l: () => void) {
    this.missing.add(l);
    return () => void this.missing.delete(l);
  }

  async refresh(login: string) {
    if (!login || login === "guest" || this.inflight.has(login)) return;
    this.inflight.add(login);
    const r = await bookApi.orders(login, { status: "open" });
    this.inflight.delete(login);
    if (!r.ok) {
      if (bookMissing(r.err)) this.missing.forEach((l) => l());
      return;
    }
    const open = [...r.data].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const prev = this.views.get(login);
    if (prev?.loaded && JSON.stringify(prev.open) === JSON.stringify(open)) return;
    this.views.set(login, { open, loaded: true });
    bookFlag.setOpen(login, open.length);
    this.listeners.forEach((l) => l());
  }

  /** Keeps a login's open orders fresh while at least one user is mounted. */
  attach(login: string) {
    const n = (this.users.get(login) ?? 0) + 1;
    this.users.set(login, n);
    if (n === 1) {
      void this.refresh(login);
      if (IS_LIVE)
        this.timers.set(
          login,
          setInterval(() => {
            if (document.visibilityState === "visible") void this.refresh(login);
          }, 3_000),
        );
    }
    return () => {
      const left = (this.users.get(login) ?? 1) - 1;
      this.users.set(login, left);
      if (left > 0) return;
      const t = this.timers.get(login);
      if (t) clearInterval(t);
      this.timers.delete(login);
    };
  }
}

export const bookOrders = new BookOrders();

/** The working book orders of a login (null / disabled = none), kept fresh while mounted. */
export function useBookOrders(login: string | null | undefined, enabled = true): OrdersView {
  React.useEffect(() => (login && enabled && login !== "guest" ? bookOrders.attach(login) : undefined), [login, enabled]);
  return React.useSyncExternalStore(
    bookOrders.subscribe,
    () => (login && enabled ? bookOrders.get(login) : EMPTY),
    () => EMPTY,
  );
}
