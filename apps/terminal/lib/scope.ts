// Which markets this session may see (founder decision 2026-10-07: no "demo only" anywhere). Live accounts, and guests
// (who see what a new live client could trade), only see instruments whose live trading is on; demo accounts see the
// whole catalogue. The flags come from the trading engine (`liveTrading` of /v1/symbols, via /api/engine/symbols),
// loaded on start and every 5 minutes, so a class or symbol enabled in the Back Office appears without a deploy.
// Demo builds have no engine: they keep the defaults of packages/mock (every class but stocks).
"use client";

import * as React from "react";
import { ALL_INSTRUMENTS, IS_DEMO, liveFlags, liveTradable, type Instrument } from "@ezymex/mock";

let restricted = false;
let rev = 0;
const subs = new Set<() => void>();
const notify = () => {
  rev++;
  subs.forEach((f) => f());
};

/** Called by the terminal store while rendering: live account or guest. Children of the same render read it at once. */
export function syncRestricted(v: boolean) {
  if (restricted === v) return;
  restricted = v;
  queueMicrotask(notify);
}

export const isRestricted = () => restricted;

/** May this session see / open `symbol`? */
export const visibleSymbol = (symbol: string) => !restricted || liveTradable(symbol);

let cache: { key: string; list: Instrument[] } | null = null;
/** The instruments this session sees (core first, then the catalogue). */
export function visibleInstruments(): Instrument[] {
  const key = `${restricted}|${liveFlags.rev()}|${ALL_INSTRUMENTS.length}`;
  if (cache?.key === key) return cache.list;
  const list = restricted ? ALL_INSTRUMENTS.filter((i) => liveTradable(i.symbol)) : ALL_INSTRUMENTS;
  cache = { key, list };
  return list;
}

const subscribe = (f: () => void) => {
  subs.add(f);
  const off = liveFlags.subscribe(f);
  return () => {
    subs.delete(f);
    off();
  };
};
const snapshot = () => `${restricted}|${rev}|${liveFlags.rev()}`;

/** Re-renders when the account kind or the live flags change. */
export function useMarketScope(): { restricted: boolean; list: Instrument[]; visible: (s: string) => boolean } {
  React.useSyncExternalStore(subscribe, snapshot, snapshot);
  return { restricted, list: visibleInstruments(), visible: visibleSymbol };
}

/** Live builds: load the engine's live switch now and every 5 minutes (no-op in demo builds). */
export function startLiveFlags(): () => void {
  if (IS_DEMO || typeof window === "undefined") return () => {};
  let alive = true;
  const load = async () => {
    try {
      const r = await fetch("/api/engine/symbols", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { live?: string[]; off?: string[] };
      if (!alive || !Array.isArray(d.live) || !Array.isArray(d.off)) return;
      const flags: Record<string, boolean> = {};
      for (const s of d.live) flags[s] = true;
      for (const s of d.off) flags[s] = false;
      liveFlags.set(flags);
    } catch {
      /* engine unavailable: keep the last flags */
    }
  };
  void load();
  const id = setInterval(() => void load(), 5 * 60_000);
  return () => {
    alive = false;
    clearInterval(id);
  };
}
