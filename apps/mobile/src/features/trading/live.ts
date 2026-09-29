// The active account, live: positions, pending orders and recent deals from the trading-engine stream, plus
// the money that moves with prices (equity frames, at most 4 a second).
//
// Two stores on purpose:
// - `tradeStore` changes only on structural events (a fill, a close, an SL/TP change), so lists re-render then.
// - `live` holds equity and per-position P&L; only tiny leaf components subscribe (usePositionLive / useAccountLive),
//   so a price tick never re-renders a list or a screen.
import * as React from "react";
import { AppState } from "react-native";
import { i18n } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { netStore } from "@/lib/net";
import { invalidate } from "@/lib/query";
import { createStore, useStore } from "@/lib/store";
import { toast } from "@/ui/Toast";
import { dropTradeSession, tradeApi } from "./session";
import type { EngAccount, EngDeal, EngEquity, EngOrder, EngPosition, StreamFrame } from "./types";

export type StreamStatus = "idle" | "connecting" | "open" | "reconnecting" | "error";

export type TradeState = {
  login: number | null;
  status: StreamStatus;
  readOnly: boolean;
  account: EngAccount | null;
  positions: EngPosition[];
  orders: EngOrder[];
  /** latest deals first (session only; History loads the full list) */
  deals: EngDeal[];
  error: { code: string; message: string } | null;
};

const EMPTY: TradeState = { login: null, status: "idle", readOnly: false, account: null, positions: [], orders: [], deals: [], error: null };
export const tradeStore = createStore<TradeState>(EMPTY);
export const useTrade = <S>(select: (s: TradeState) => S, equal?: (a: S, b: S) => boolean) => useStore(tradeStore, select, equal);

/* ------------------------------------------------------------------ */
/* Live money (leaf subscribers only)                                  */
/* ------------------------------------------------------------------ */

export type AccountLive = { balance: number; credit: number; profit: number; swap: number; equity: number; margin: number; freeMargin: number; marginLevel: number | null };
export type PositionLive = { price: number; profit: number; swap: number };

class LiveMoney {
  account: AccountLive | null = null;
  private pos = new Map<number, PositionLive>();
  private accSubs = new Set<() => void>();
  private posSubs = new Map<number, Set<() => void>>();

  position(ticket: number) {
    return this.pos.get(ticket);
  }
  onAccount(fn: () => void) {
    this.accSubs.add(fn);
    return () => this.accSubs.delete(fn);
  }
  onPosition(ticket: number, fn: () => void) {
    let s = this.posSubs.get(ticket);
    if (!s) this.posSubs.set(ticket, (s = new Set()));
    s.add(fn);
    return () => s!.delete(fn);
  }
  setAccount(a: Pick<EngAccount, "balance" | "credit" | "bonus" | "profit" | "swap" | "equity" | "margin" | "freeMargin" | "marginLevel">) {
    this.account = { balance: a.balance, credit: (a.credit ?? 0) + (a.bonus ?? 0), profit: a.profit, swap: a.swap, equity: a.equity, margin: a.margin, freeMargin: a.freeMargin, marginLevel: a.marginLevel };
    this.accSubs.forEach((f) => f());
  }
  setEquity(f: EngEquity) {
    this.setAccount(f);
    for (const p of f.positions) {
      this.pos.set(p.ticket, { price: p.price, profit: p.profit, swap: p.swap });
      this.posSubs.get(p.ticket)?.forEach((fn) => fn());
    }
  }
  seedPositions(list: EngPosition[]) {
    for (const p of list) {
      if (!this.pos.has(p.ticket)) this.pos.set(p.ticket, { price: p.currentPrice ?? p.openPrice, profit: p.profit ?? 0, swap: p.swap ?? 0 });
    }
  }
  drop(ticket: number) {
    this.pos.delete(ticket);
  }
  clear() {
    this.account = null;
    this.pos.clear();
    this.accSubs.forEach((f) => f());
  }
}

export const live = new LiveMoney();

/** Re-render at most once per frame when `subscribe` fires. */
function useCoalesced<T>(subscribe: (fn: () => void) => () => void, read: () => T): T {
  const [v, setV] = React.useState(read);
  React.useEffect(() => {
    let raf = 0;
    setV(read);
    const off = subscribe(() => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          setV(read);
        });
    });
    return () => {
      off();
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe]);
  return v;
}

export function usePositionLive(ticket: number): PositionLive | undefined {
  const sub = React.useCallback((fn: () => void) => live.onPosition(ticket, fn), [ticket]);
  return useCoalesced(sub, () => live.position(ticket));
}

export function useAccountLive(): AccountLive | null {
  const sub = React.useCallback((fn: () => void) => live.onAccount(fn), []);
  return useCoalesced(sub, () => live.account);
}

/* ------------------------------------------------------------------ */
/* Stream                                                              */
/* ------------------------------------------------------------------ */

class AccountStream {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private lastFrame = 0;
  private stopped = false;
  private connecting = false;
  private bgTimer: ReturnType<typeof setTimeout> | null = null;
  private subs: { remove(): void }[] = [];
  private offNet: (() => void) | null = null;

  constructor(readonly login: number) {
    this.watchdog = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN && Date.now() - this.lastFrame > 20_000) this.ws.close();
    }, 5000);
    this.subs.push(
      AppState.addEventListener("change", (s) => {
        if (s === "active") {
          if (this.bgTimer) clearTimeout(this.bgTimer);
          this.bgTimer = null;
          if (!this.ws) this.reconnect();
        } else if (!this.bgTimer) {
          // background for 30 s: close (battery); the snapshot on reconnect resyncs everything
          this.bgTimer = setTimeout(() => {
            const ws = this.ws;
            this.ws = null;
            ws?.close();
          }, 30_000);
        }
      }),
    );
    const off = netStore.subscribe(() => netStore.get().online && !this.ws && this.reconnect());
    this.offNet = () => void off();
    void this.connect();
  }

  private async connect() {
    if (this.stopped || this.connecting) return;
    this.connecting = true;
    patch({ status: this.attempt ? "reconnecting" : "connecting" });
    const t = await tradeApi<{ ticket: string; url: string }>(this.login, "stream-ticket", { method: "POST", body: {} });
    this.connecting = false;
    if (this.stopped) return;
    if (!t.ok) {
      patch({ status: "error", error: { code: t.error.code, message: t.error.message } });
      if (t.status === 403 || t.status === 404) return; // not this client's account: stop
      return this.retry();
    }
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${t.data.url}?ticket=${encodeURIComponent(t.data.ticket)}`);
    } catch {
      return this.retry();
    }
    this.ws = ws;
    ws.onopen = () => {
      this.lastFrame = Date.now();
    };
    ws.onmessage = (e) => {
      this.lastFrame = Date.now();
      let f: StreamFrame;
      try {
        f = JSON.parse(String(e.data)) as StreamFrame;
      } catch {
        return;
      }
      if (f.type === "snapshot") this.attempt = 0;
      if (f.type === "resync") return this.reconnect();
      onFrame(this.login, f);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (!this.stopped && AppState.currentState === "active") this.retry();
    };
    ws.onerror = () => {};
  }

  private retry() {
    if (this.stopped) return;
    this.attempt++;
    const base = Math.min(15_000, 500 * 2 ** Math.min(this.attempt - 1, 5));
    const delay = Math.round(base * (0.75 + Math.random() * 0.5));
    patch({ status: "reconnecting" });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.connect();
    }, delay);
  }

  reconnect() {
    if (this.stopped) return;
    this.attempt = 0;
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    if (this.timer) clearTimeout(this.timer);
    void this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.watchdog) clearInterval(this.watchdog);
    if (this.bgTimer) clearTimeout(this.bgTimer);
    this.subs.forEach((s) => s.remove());
    this.offNet?.();
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }
}

function patch(p: Partial<TradeState>) {
  tradeStore.set((s) => ({ ...s, ...p }));
}

const sortPositions = (list: EngPosition[]) => [...list].sort((a, b) => b.ticket - a.ticket);
const sortOrders = (list: EngOrder[]) => [...list].sort((a, b) => b.ticket - a.ticket);

function onFrame(login: number, f: StreamFrame) {
  if (tradeStore.get().login !== login) return;
  switch (f.type) {
    case "snapshot":
      live.seedPositions(f.positions);
      live.setAccount(f.account);
      patch({ status: "open", error: null, readOnly: !!f.readOnly, account: f.account, positions: sortPositions(f.positions), orders: sortOrders(f.orders) });
      return;
    case "position":
      if (f.op === "upsert") {
        live.seedPositions([f.position]);
        tradeStore.set((s) => ({ ...s, positions: sortPositions([f.position, ...s.positions.filter((p) => p.ticket !== f.position.ticket)]) }));
      } else {
        live.drop(f.ticket);
        tradeStore.set((s) => ({ ...s, positions: s.positions.filter((p) => p.ticket !== f.ticket) }));
      }
      return;
    case "order":
      if (f.op === "upsert") tradeStore.set((s) => ({ ...s, orders: sortOrders([f.order, ...s.orders.filter((o) => o.ticket !== f.order.ticket)]) }));
      else tradeStore.set((s) => ({ ...s, orders: s.orders.filter((o) => o.ticket !== f.ticket) }));
      return;
    case "deal":
      tradeStore.set((s) => ({ ...s, deals: [f.deal, ...s.deals].slice(0, 100) }));
      if (f.deal.entry !== "in") invalidate(`trade/history/${login}`);
      return;
    case "account":
      live.setAccount(f.account);
      patch({ account: f.account });
      invalidate("trading/accounts");
      return;
    case "equity":
      live.setEquity(f);
      return;
    case "notification":
      notify(f.kind, f.message, f.data);
      return;
    default:
      return;
  }
}

/** Engine notifications the phone should feel: fills and closes buzz; margin warnings stand out. */
function notify(kind: string, message: string, data?: Record<string, unknown>) {
  const t = i18n.t;
  switch (kind) {
    case "sl":
    case "tp":
    case "order_filled":
    case "order_triggered":
      haptic.success();
      toast.show({ title: t.dyn(`mobileTrade.notify.${kind}`, message), body: message, tone: "success" });
      return;
    case "margin_call":
    case "stop_out":
      haptic.warning();
      toast.show({ title: t.dyn(`mobileTrade.notify.${kind}`, message), body: message, tone: "error" }, 5000);
      return;
    case "order_rejected":
    case "order_expired":
    case "order_cancelled":
      toast.show({ title: t.dyn(`mobileTrade.notify.${kind}`, message), body: message });
      return;
    default:
      void data;
  }
}

/* ------------------------------------------------------------------ */
/* Controller: one stream for the active account                       */
/* ------------------------------------------------------------------ */

let stream: AccountStream | null = null;

/** Opens (or switches) the engine stream for `login`; null closes it. */
export function followAccount(login: number | null) {
  if (tradeStore.get().login === login && (stream || login === null)) return;
  stream?.stop();
  stream = null;
  live.clear();
  tradeStore.set({ ...EMPTY, login });
  if (login !== null) stream = new AccountStream(login);
}

/** Reload after a write when the stream isn't delivering (the engine is the source of truth). */
export async function refreshState() {
  const login = tradeStore.get().login;
  if (login === null) return;
  const r = await tradeApi<{ account: EngAccount; positions: EngPosition[]; orders: EngOrder[]; readOnly: boolean }>(login, "state?historyLimit=0");
  if (!r.ok || tradeStore.get().login !== login) return;
  live.seedPositions(r.data.positions);
  live.setAccount(r.data.account);
  patch({ account: r.data.account, positions: sortPositions(r.data.positions), orders: sortOrders(r.data.orders), readOnly: !!r.data.readOnly });
}

export function streamIsOpen() {
  return tradeStore.get().status === "open";
}

export async function forgetAccountSession(login: number) {
  await dropTradeSession(login);
}
