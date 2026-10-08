"use client";

// The account's option positions and working option orders. Option and CFD positions share one account (same
// equity and margin, plan O24) and arrive in the same engine state and stream; lib/store.tsx hands every engine
// state / stream frame through splitOptionState / routeOptionFrame, so the CFD book (Trade / History tabs, chart
// lines) only ever sees CFD entries and the options workspace reads them from here. Small and dependency-free:
// it is loaded with the terminal shell, the options workspace itself is loaded on demand.
//
// Closed option trades: the option deals of the engine state (`history.deals`) and of the stream (`deal` frames) are
// kept here too, and `closed` turns their exit deals (manual closes, stop-outs and liquidations, expiry settlements,
// knock-outs) into rows for the toolbox History tab (All / CFD / Options) and the workspace's Closed tab. Engine
// prices are per unit of the underlying in its quote currency; rows carry the USD-per-contract rate to show premiums
// like the positions tab does.
import * as React from "react";
import { priceFeed } from "@ezymex/mock";
import type { EngDeal, EngOrder, EngPosition, EngState, StreamFrame } from "@/lib/engine/types";
import type { OptGreeks, OptionInfo, OptOrder, OptPosition, Side } from "./types";

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
    venue: str(x.venue) ?? str((x.option as Obj | undefined)?.venue),
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

/** Why an option position (or part of it) closed. */
/**
 * Why an option position (or part of it) closed. `liquidation`: risk control closed it on the order book (a
 * reduce-only order, or the Ezymex market maker's backstop: `fillKind`), `bust`: the dealing desk cancelled the fill
 * and reversed it (a correction).
 */
export type OptCloseReason = "closed" | "expired" | "knocked_out" | "stop_out" | "liquidation" | "bust" | "sl" | "tp" | "dealer" | "other";

/** A closed option trade (one exit deal): premiums per unit in the quote currency, money in USD. */
export interface OptClosed {
  deal: string;
  ticket: string;
  login: string;
  /** the position's side */
  side: Side;
  contracts: number;
  openPrice: number;
  closePrice: number;
  openTime: string;
  closeTime: string;
  /** gross P&L, commission (entry share + exit), swap and the net profit, USD */
  gross: number;
  commission: number;
  swap: number;
  profit: number;
  reason: OptCloseReason;
  /** the engine's own reason code (shown when it maps to "other") */
  rawReason: string;
  /** order-book deals: the fill kind (book, rfq, liquidation, backstop, bust, novation) */
  fillKind?: string;
  /** USD per contract for one unit of premium (0 = unknown) */
  usdPerUnit: number;
  /** expiry settlements: the settlement price (fixing) the option was settled at */
  fixing?: number;
  comboId?: string;
  option: OptionInfo;
}

export interface BookView {
  positions: OptPosition[];
  orders: OptOrder[];
  /** closed option trades, newest first */
  closed: OptClosed[];
  /** the engine sent this login's state at least once */
  loaded: boolean;
}

const EMPTY: BookView = { positions: [], orders: [], closed: [], loaded: false };

/** Engine deal reason (and the book fill kind) → why it closed. */
export function closeReasonOf(d: EngDeal | Obj): { reason: OptCloseReason; raw: string } {
  const x = d as Obj;
  const raw = String(x.reason ?? "");
  const fill = ((x.option as Obj | undefined)?.fill ?? null) as Obj | null;
  const kind = String(fill?.kind ?? "").toLowerCase();
  if (kind === "bust") return { reason: "bust", raw };
  if (kind === "liquidation" || kind === "backstop") return { reason: "liquidation", raw };
  const r = raw.toLowerCase();
  if (r === "expiry" || r === "expired" || r === "settlement" || r === "settle" || r === "exercise") return { reason: "expired", raw };
  if (r === "knock_out" || r === "knockout" || r === "knocked_out" || r === "barrier") return { reason: "knocked_out", raw };
  if (r === "stop_out" || r === "stopout") return { reason: "stop_out", raw };
  if (r === "liquidation" || r === "backstop") return { reason: "liquidation", raw };
  if (r === "sl") return { reason: "sl", raw };
  if (r === "tp") return { reason: "tp", raw };
  if (r === "dealer" || r === "force" || r === "void" || r === "price_correction") return { reason: "dealer", raw };
  if (r === "client" || r === "close_by" || r === "pending_fill" || r === "" || r === "manual" || r === "book" || r === "rfq") return { reason: "closed", raw };
  return { reason: "other", raw };
}

/** USD per unit of a quote currency from the price feed (USD 1, JPY via USDJPY …), 0 when unknown. */
export function usdPerQuote(underlying: string): number {
  const ccy = /^(XAU|XAG)USD$|^(US|UK)OIL$/.test(underlying) || underlying.endsWith("USD") ? "USD" : underlying.slice(-3);
  if (ccy === "USD") return 1;
  try {
    const mid = (s: string) => {
      const q = priceFeed().snapshot(s);
      return q && q.bid > 0 ? (q.bid + q.ask) / 2 : 0;
    };
    const usdX = mid(`USD${ccy}`);
    if (usdX > 0) return 1 / usdX;
    const xUsd = mid(`${ccy}USD`);
    return xUsd > 0 ? xUsd : 0;
  } catch {
    return 0;
  }
}

/** Option exit deals → closed-trade rows (entry deals give the commission share), newest first. */
export function mapOptionClosed(deals: (EngDeal | Obj)[], cent: boolean): OptClosed[] {
  const k = cent ? 100 : 1;
  const entries = new Map<number, Obj>();
  for (const raw of deals) {
    const d = raw as Obj;
    if (d.entry === "in" && !entries.has(Number(d.positionTicket))) entries.set(Number(d.positionTicket), d);
  }
  return deals
    .map((raw) => raw as Obj)
    .filter((d) => (d.entry === "out" || d.entry === "out_by") && !d.reversed)
    .map((d): OptClosed => {
      const e = entries.get(Number(d.positionTicket));
      const volume = num(d.volume) ?? num(d.contracts) ?? 0;
      const eVol = e ? (num(e.volume) ?? 0) : 0;
      const entryCommission = e && eVol > 0 ? (num(e.commission) ?? 0) * Math.min(1, volume / eVol) : 0;
      const commission = ((num(d.commission) ?? 0) + entryCommission) / k;
      const swap = (num(d.swap) ?? 0) / k;
      const gross = (num(d.profit) ?? 0) / k;
      const side: Side = d.positionSide === "sell" ? "sell" : d.positionSide === "buy" ? "buy" : d.side === "buy" ? "sell" : "buy";
      const open = num(d.openPrice) ?? 0;
      const close = num(d.price) ?? 0;
      const info = infoOf(d);
      // the rate the engine used: gross = ±(close − open) × rate × contracts
      const move = (side === "buy" ? 1 : -1) * (close - open) * volume;
      const derived = Math.abs(move) > 1e-12 && Math.abs(gross) > 0.004 ? gross / move : 0;
      const fallback = (info.contractSize || 0) * usdPerQuote(info.underlying);
      const usdPerUnit = derived > 0 && (!fallback || Math.abs(derived / fallback - 1) < 0.5) ? derived : fallback;
      const { reason, raw } = closeReasonOf(d);
      return {
        deal: String(d.id),
        ticket: String(d.positionTicket),
        login: String(d.login ?? ""),
        side,
        contracts: volume,
        openPrice: open,
        closePrice: close,
        openTime: str(d.openTime) ?? str(d.time) ?? "",
        closeTime: str(d.time) ?? "",
        gross: +gross.toFixed(2),
        commission: +commission.toFixed(2),
        swap: +swap.toFixed(2),
        profit: +(gross + swap - commission).toFixed(2),
        reason,
        rawReason: raw,
        fillKind: str(((d.option as Obj | undefined)?.fill as Obj | undefined)?.kind),
        usdPerUnit,
        fixing: num((d.option as Obj | undefined)?.fixing) ?? (reason === "expired" ? num(d.fixing) : undefined),
        comboId: str(d.comboId) ?? (typeof d.comboId === "number" ? String(d.comboId) : undefined),
        option: info,
      };
    })
    .sort((a, b) => Date.parse(b.closeTime) - Date.parse(a.closeTime));
}

class OptionBook {
  private books = new Map<string, BookView>();
  /** login → option deals (entries and exits), deduplicated by id */
  private deals = new Map<string, { cent: boolean; list: Obj[] }>();
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
    this.put(login, { positions, orders, closed: this.get(login).closed, loaded: true });
  }
  /** The option deals of a full engine state (replaces what was kept, but keeps deals the stream added since). */
  setDeals(login: string, deals: (EngDeal | Obj)[], cent: boolean) {
    const prev = this.deals.get(login)?.list ?? [];
    const ids = new Set(deals.map((d) => String((d as Obj).id)));
    const list = [...(deals as Obj[]), ...prev.filter((d) => !ids.has(String(d.id)))].slice(0, 1000);
    this.deals.set(login, { cent, list });
    this.put(login, { ...this.get(login), closed: mapOptionClosed(list, cent) });
  }
  /** One option deal from the stream (or a demo close). */
  addDeal(login: string, deal: EngDeal | Obj, cent: boolean) {
    const cur = this.deals.get(login);
    const id = String((deal as Obj).id);
    if (cur?.list.some((d) => String(d.id) === id)) return;
    const list = [deal as Obj, ...(cur?.list ?? [])].slice(0, 1000);
    this.deals.set(login, { cent: cur?.cent ?? cent, list });
    this.put(login, { ...this.get(login), closed: mapOptionClosed(list, cur?.cent ?? cent) });
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
    this.deals.delete(login);
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
  // closed option trades: kept here (History › Options, the workspace's Closed tab)
  optionBook.setDeals(login, deals.filter(isOptionEntry), cent);
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
      optionBook.addDeal(login, f.deal, cent);
      if (f.deal.entry !== "in") optionBook.closed(login, f.deal);
      return null;
    default:
      return f;
  }
}

/**
 * Closed option trades older than the state's recent deals: the engine's history of the last `days` (up to 500
 * deals), merged into what is kept. Live engine sessions only.
 */
export async function loadOptionHistory(login: string, cent: boolean, days = 90): Promise<boolean> {
  const { engineApi } = await import("@/lib/engine/client");
  const r = await engineApi.history(login, { from: new Date(Date.now() - days * 86_400_000).toISOString(), limit: 500 });
  if (!r.ok) return false;
  optionBook.setDeals(login, (r.data.deals ?? []).filter(isOptionEntry), cent);
  return true;
}

export function useOptionBook(login: string | null | undefined): BookView {
  return React.useSyncExternalStore(
    optionBook.subscribe,
    () => (login ? optionBook.get(login) : EMPTY),
    () => EMPTY,
  );
}
