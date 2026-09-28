"use client";

// Live account numbers from the engine's `equity` frames (≤ 4 per second). Kept outside the terminal
// context so a price tick re-renders only the cells that show money, not the whole terminal.
import * as React from "react";
import type { EngAccount, EngEquity } from "./types";
import type { StreamStatus } from "./stream";

export interface LiveEquity {
  balance: number;
  credit: number;
  profit: number;
  swap: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number | null;
  /** ticket → engine price / profit / swap (account currency converted to USD) */
  positions: Map<string, { price: number; profit: number; swap: number }>;
}

type Listener = () => void;

class LiveStore {
  private eq = new Map<string, LiveEquity>();
  private status: { s: StreamStatus; attempt: number; delayMs?: number } = { s: "closed", attempt: 0 };
  private listeners = new Set<Listener>();

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };
  private emit() {
    for (const l of this.listeners) l();
  }

  setEquity(login: string, f: EngEquity, cent: boolean) {
    const k = cent ? 100 : 1;
    const positions = new Map<string, { price: number; profit: number; swap: number }>();
    for (const p of f.positions) positions.set(String(p.ticket), { price: p.price, profit: p.profit / k, swap: p.swap / k });
    this.eq.set(login, {
      balance: f.balance / k,
      credit: (f.credit + (f.bonus ?? 0)) / k,
      profit: f.profit / k,
      swap: f.swap / k,
      equity: f.equity / k,
      margin: f.margin / k,
      freeMargin: f.freeMargin / k,
      marginLevel: f.marginLevel,
      positions,
    });
    this.emit();
  }
  /** An account view (after a balance change, close, deposit…): numbers now, per-position values kept. */
  setAccount(login: string, a: EngAccount) {
    const k = a.cent ? 100 : 1;
    const prev = this.eq.get(login);
    this.eq.set(login, {
      balance: a.balance / k,
      credit: (a.credit + (a.bonus ?? 0)) / k,
      profit: a.profit / k,
      swap: a.swap / k,
      equity: a.equity / k,
      margin: a.margin / k,
      freeMargin: a.freeMargin / k,
      marginLevel: a.marginLevel,
      positions: prev?.positions ?? new Map(),
    });
    this.emit();
  }
  clear(login?: string) {
    if (login) this.eq.delete(login);
    else this.eq.clear();
    this.emit();
  }
  equity(login: string) {
    return this.eq.get(login);
  }
  setStatus(s: StreamStatus, attempt = 0, delayMs?: number) {
    this.status = { s, attempt, delayMs };
    this.emit();
  }
  getStatus = () => this.status;
}

export const liveStore = new LiveStore();

export function useLiveEquity(login: string | null | undefined): LiveEquity | undefined {
  return React.useSyncExternalStore(
    liveStore.subscribe,
    () => (login ? liveStore.equity(login) : undefined),
    () => undefined,
  );
}

export function useLivePosition(login: string | null | undefined, ticket: string) {
  const eq = useLiveEquity(login);
  return eq?.positions.get(ticket);
}

export function useStreamStatus() {
  return React.useSyncExternalStore(liveStore.subscribe, liveStore.getStatus, liveStore.getStatus);
}
