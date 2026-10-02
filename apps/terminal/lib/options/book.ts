"use client";

// The account's option positions and working option orders. Option and CFD positions share one account (same
// equity and margin, plan O24) and arrive in the same engine state and stream; lib/store.tsx hands every engine
// state / stream frame through splitOptionState / routeOptionFrame, so the CFD book (Trade / History tabs, chart
// lines) only ever sees CFD entries and the options workspace reads them from here. Small and dependency-free:
// it is loaded with the terminal shell, the options workspace itself is loaded on demand.
import * as React from "react";
import type { EngDeal, EngOrder, EngPosition, EngState, StreamFrame } from "@/lib/engine/types";
import type { OptGreeks, OptionInfo, OptOrder, OptPosition } from "./types";

type Obj = Record<string, unknown>;

const SERIES_RE = /^[A-Z0-9]{3,12}-\d{8}-/;

/** An engine position / order / deal of an option (it carries `option`, or its symbol is a series code). */
export function isOptionEntry(x: unknown): boolean {
  if (!x || typeof x !== "object") return false;
  const o = x as Obj;
  return (!!o.option && typeof o.option === "object") || (typeof o.symbol === "string" && SERIES_RE.test(o.symbol));
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

function infoOf(x: Obj): OptionInfo {
  const o = (x.option ?? {}) as Obj;
  const series = str(o.series) ?? str(x.symbol) ?? "";
  const m = /^([A-Z0-9]{3,12})-(\d{4})(\d{2})(\d{2})-([0-9.]+)-([CP])/.exec(series);
  return {
    series,
    underlying: str(o.underlying) ?? m?.[1] ?? "",
    right: o.right === "put" || o.right === "call" ? o.right : m?.[6] === "P" ? "put" : "call",
    strike: num(o.strike) ?? (m ? Number(m[5]) : 0),
    expiry: str(o.expiry)?.slice(0, 10) ?? (m ? `${m[2]}-${m[3]}-${m[4]}` : ""),
    expiryAt: str(o.expiryAt) ?? "",
    style: str(o.style) ?? "european",
    barrier: o.barrier && typeof o.barrier === "object" ? (o.barrier as OptionInfo["barrier"]) : null,
    contractSize: num(o.contractSize) ?? 0,
  };
}

function greeksOf(v: unknown): OptGreeks | undefined {
  if (!v || typeof v !== "object") return undefined;
  const g = v as Obj;
  return { delta: num(g.delta), gamma: num(g.gamma), vega: num(g.vega), theta: num(g.theta) };
}

export function mapOptionPosition(p: EngPosition | Obj, cent = false): OptPosition {
  const x = p as Obj;
  const k = cent ? 100 : 1;
  const profit = num(x.profit);
  return {
    ticket: String(x.ticket),
    login: String(x.login ?? ""),
    side: x.side === "sell" ? "sell" : "buy",
    contracts: num(x.contracts) ?? num(x.volume) ?? 0,
    openPrice: num(x.openPrice) ?? 0,
    openTime: str(x.openTime) ?? new Date().toISOString(),
    commission: (num(x.commission) ?? 0) / k,
    profit: profit === undefined ? undefined : profit / k,
    mark: num(x.mark) ?? num(x.currentPrice),
    greeks: greeksOf(x.greeks),
    comboId: str(x.comboId) ?? (typeof x.comboId === "number" ? String(x.comboId) : undefined),
    sl: num(x.sl),
    tp: num(x.tp),
    option: infoOf(x),
  };
}

export function mapOptionOrder(o: EngOrder | Obj): OptOrder {
  const x = o as Obj;
  const trig = x.trigger && typeof x.trigger === "object" ? (x.trigger as Obj) : null;
  return {
    ticket: String(x.ticket),
    login: String(x.login ?? ""),
    side: x.side === "sell" ? "sell" : "buy",
    contracts: num(x.contracts) ?? num(x.volume) ?? 0,
    type: str(x.type) ?? "limit",
    price: num(x.limitPremium) ?? num(x.price),
    trigger: trig ? { symbol: str(trig.symbol) ?? "", op: str(trig.op) ?? "above", price: num(trig.price) ?? 0 } : null,
    comboId: str(x.comboId),
    placedAt: str(x.placedAt) ?? new Date().toISOString(),
    option: infoOf(x),
  };
}

export interface BookView {
  positions: OptPosition[];
  orders: OptOrder[];
  /** the engine sent this login's state at least once */
  loaded: boolean;
}

const EMPTY: BookView = { positions: [], orders: [], loaded: false };

class OptionBook {
  private books = new Map<string, BookView>();
  private listeners = new Set<() => void>();
  private closeListeners = new Set<(login: string, d: EngDeal | Obj) => void>();

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };
  private put(login: string, next: BookView) {
    this.books.set(login, next);
    this.listeners.forEach((l) => l());
  }
  get(login: string): BookView {
    return this.books.get(login) ?? EMPTY;
  }
  set(login: string, positions: OptPosition[], orders: OptOrder[]) {
    this.put(login, { positions, orders, loaded: true });
  }
  upsertPosition(login: string, p: OptPosition) {
    const b = this.get(login);
    const has = b.positions.some((x) => x.ticket === p.ticket);
    this.put(login, { ...b, positions: has ? b.positions.map((x) => (x.ticket === p.ticket ? p : x)) : [...b.positions, p] });
  }
  removePosition(login: string, ticket: string): boolean {
    const b = this.get(login);
    if (!b.positions.some((x) => x.ticket === ticket)) return false;
    this.put(login, { ...b, positions: b.positions.filter((x) => x.ticket !== ticket) });
    return true;
  }
  upsertOrder(login: string, o: OptOrder) {
    const b = this.get(login);
    const has = b.orders.some((x) => x.ticket === o.ticket);
    this.put(login, { ...b, orders: has ? b.orders.map((x) => (x.ticket === o.ticket ? o : x)) : [...b.orders, o] });
  }
  removeOrder(login: string, ticket: string): boolean {
    const b = this.get(login);
    if (!b.orders.some((x) => x.ticket === ticket)) return false;
    this.put(login, { ...b, orders: b.orders.filter((x) => x.ticket !== ticket) });
    return true;
  }
  clear(login: string) {
    if (this.books.delete(login)) this.listeners.forEach((l) => l());
  }
  /** Option exit deals (close, expiry settlement, knock-out) as the stream reports them. */
  onClose(l: (login: string, d: EngDeal | Obj) => void) {
    this.closeListeners.add(l);
    return () => void this.closeListeners.delete(l);
  }
  closed(login: string, d: EngDeal | Obj) {
    this.closeListeners.forEach((l) => l(login, d));
  }
}

export const optionBook = new OptionBook();

/** Engine state without its option entries (they go to the option book). */
export function splitOptionState(login: string, st: EngState): EngState {
  const cent = !!st.account?.cent;
  optionBook.set(login, st.positions.filter(isOptionEntry).map((p) => mapOptionPosition(p, cent)), st.orders.filter(isOptionEntry).map(mapOptionOrder));
  const deals = st.history?.deals ?? [];
  if (!st.positions.some(isOptionEntry) && !st.orders.some(isOptionEntry) && !deals.some(isOptionEntry)) return st;
  return {
    ...st,
    positions: st.positions.filter((p) => !isOptionEntry(p)),
    orders: st.orders.filter((o) => !isOptionEntry(o)),
    history: { ...st.history, deals: deals.filter((d) => !isOptionEntry(d)) },
  };
}

/** A stream frame for the CFD book, or null when it was an option entry (stored here instead). */
export function routeOptionFrame(login: string, f: StreamFrame, cent: boolean): StreamFrame | null {
  switch (f.type) {
    case "snapshot": {
      optionBook.set(login, f.positions.filter(isOptionEntry).map((p) => mapOptionPosition(p, f.account?.cent ?? cent)), f.orders.filter(isOptionEntry).map(mapOptionOrder));
      if (!f.positions.some(isOptionEntry) && !f.orders.some(isOptionEntry)) return f;
      return { ...f, positions: f.positions.filter((p) => !isOptionEntry(p)), orders: f.orders.filter((o) => !isOptionEntry(o)) };
    }
    case "position":
      if (f.op === "upsert") {
        if (!isOptionEntry(f.position)) return f;
        optionBook.upsertPosition(login, mapOptionPosition(f.position, cent));
        return null;
      }
      return optionBook.removePosition(login, String(f.ticket)) ? null : f;
    case "order":
      if (f.op === "upsert") {
        if (!isOptionEntry(f.order)) return f;
        optionBook.upsertOrder(login, mapOptionOrder(f.order));
        return null;
      }
      return optionBook.removeOrder(login, String(f.ticket)) ? null : f;
    case "deal":
      if (!isOptionEntry(f.deal)) return f;
      if (f.deal.entry !== "in") optionBook.closed(login, f.deal);
      return null;
    default:
      return f;
  }
}

export function useOptionBook(login: string | null | undefined): BookView {
  return React.useSyncExternalStore(
    optionBook.subscribe,
    () => (login ? optionBook.get(login) : EMPTY),
    () => EMPTY,
  );
}
