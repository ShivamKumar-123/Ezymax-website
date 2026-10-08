"use client";

import * as React from "react";
import { INSTRUMENTS, INSTRUMENT_MAP, priceFeed, type Quote } from "@ezymex/mock";

/**
 * Market-wide stats built on the shared price feed: today's high/low per symbol,
 * a short history of real ticks (for the order dialog tick chart) and a quotes-per-second counter.
 */
interface Range {
  open: number;
  high: number;
  low: number;
}

/** fallback ranges for the offline simulator only (live mode reads the service's day stats) */
const simRanges = new Map<string, Range>();
const ticks = new Map<string, number[]>();
let tickCount = 0;
let qps = 0;
let started = false;
let version = 0;
const listeners = new Set<() => void>();

/** Simulator: a plausible range around the reference price, widened by simulated ticks. */
function simRange(symbol: string): Range {
  let r = simRanges.get(symbol);
  if (!r) {
    const inst = INSTRUMENT_MAP[symbol];
    if (!inst) return { open: 0, high: 0, low: 0 };
    const open = inst.price / (1 + inst.change / 100);
    const h = [...inst.symbol].reduce((a, c) => a + c.charCodeAt(0), 0);
    const ext = inst.assetClass === "forex" ? 0.0018 : inst.assetClass === "crypto" ? 0.012 : 0.004;
    r = { open, high: Math.max(open, inst.price) * (1 + ext * (0.3 + (h % 7) / 10)), low: Math.min(open, inst.price) * (1 - ext * (0.3 + (h % 5) / 10)) };
    simRanges.set(symbol, r);
  }
  return r;
}

/** Tick history restarts from the current price whenever the feed changes mode (sim → live never mixes). */
function resetTicks() {
  const feed = priceFeed();
  ticks.clear();
  for (const inst of INSTRUMENTS) ticks.set(inst.symbol, [feed.quote(inst.symbol).bid]);
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  const feed = priceFeed();
  resetTicks();
  feed.onMode(() => {
    simRanges.clear();
    resetTicks();
  });
  feed.subscribe(
    INSTRUMENTS.map((i) => i.symbol),
    (q: Quote) => {
      tickCount++;
      if (feed.mode !== "live") {
        const r = simRange(q.symbol);
        r.high = Math.max(r.high, q.bid);
        r.low = Math.min(r.low, q.bid);
      }
      let t = ticks.get(q.symbol);
      if (!t) ticks.set(q.symbol, (t = []));
      t.push(q.bid);
      if (t.length > 120) t.shift();
    },
  );
  setInterval(() => {
    qps = tickCount;
    tickCount = 0;
    version++;
    listeners.forEach((l) => l());
  }, 1000);
}

function subscribe(l: () => void) {
  start();
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Today's (server day) open/high/low: live from the market-data service, kept current by the stream. */
export function getRange(symbol: string): Range {
  start();
  const feed = priceFeed();
  const day = feed.mode === "live" ? feed.day(symbol) : undefined;
  if (day) return day;
  if (feed.mode === "live") {
    const q = feed.quote(symbol); // no day bar yet: the range is just the current price
    const p = q.last ?? q.bid;
    return { open: p, high: p, low: p };
  }
  return simRange(symbol);
}
export function getTicks(symbol: string): number[] {
  start();
  return ticks.get(symbol) ?? [];
}

/** Re-renders once per second; use for slow-moving market stats. */
export function useMarketClock() {
  return React.useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
}
export function useQps() {
  React.useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  return qps;
}
export function startMarket() {
  start();
}

/**
 * Quote of `symbol`, re-rendering at most once per `ms` (trailing: the last tick of a burst is always shown).
 * For numbers derived from the price that don't need every tick (margin, pip value, placeholders), so a
 * large component doesn't re-render per tick; live prices belong in small leaf components with useQuote.
 */
export function useSlowQuote(symbol: string, ms = 1000): Quote {
  const feed = priceFeed();
  const [q, setQ] = React.useState<Quote>(() => feed.quote(symbol));
  React.useEffect(() => {
    setQ(feed.quote(symbol));
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = feed.subscribe([symbol], () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        setQ(feed.quote(symbol));
      }, ms);
    });
    const unmode = feed.onMode(() => setQ(feed.quote(symbol)));
    return () => {
      unsub();
      unmode();
      if (timer) clearTimeout(timer);
    };
  }, [feed, symbol, ms]);
  return q;
}
