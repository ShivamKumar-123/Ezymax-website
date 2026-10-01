"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { fetchCandles, priceFeed, getInstrument, type Quote } from "@kalks/mock";
import { cn } from "../lib/cn";
import { splitPrice } from "../lib/format";

/**
 * Coalesces UI updates to one per animation frame: every quote is kept (the latest per symbol wins), and all
 * pending React updates are applied together in the next frame — one render per frame instead of one per
 * tick, without dropping the final price. While the tab is hidden, updates wait for the next visible frame.
 * The updates render synchronously inside the frame callback (flushSync), so a tick is painted in the frame it
 * was applied in: left to React's scheduler, a render requested from requestAnimationFrame runs after that
 * frame's paint and shows up one frame (~16 ms) late.
 */
const frameQueue = new Set<() => void>();
let frameReq = 0;
function onFrame(fn: () => void) {
  frameQueue.add(fn);
  if (frameReq) return;
  frameReq = requestAnimationFrame(() => {
    frameReq = 0;
    const list = [...frameQueue];
    frameQueue.clear();
    flushSync(() => list.forEach((f) => f()));
  });
}

/** Live quote for one symbol from the price feed (market-data service; simulator when it is offline). */
export function useQuote(symbol: string): Quote {
  const feed = priceFeed();
  const [q, setQ] = React.useState<Quote>(() => feed.quote(symbol));
  React.useEffect(() => {
    feed.markHydrated();
    setQ(feed.quote(symbol));
    const flush = () => setQ(feed.quote(symbol));
    const unsub = feed.subscribe([symbol], () => onFrame(flush));
    const unmode = feed.onMode(flush);
    return () => {
      frameQueue.delete(flush);
      unsub();
      unmode();
    };
  }, [feed, symbol]);
  return q;
}

export function useQuotes(symbols: string[]): Record<string, Quote> {
  const feed = priceFeed();
  const key = symbols.join(",");
  const [qs, setQs] = React.useState<Record<string, Quote>>(() => Object.fromEntries(symbols.map((s) => [s, feed.quote(s)])));
  React.useEffect(() => {
    feed.markHydrated();
    const list = key.split(",");
    const refresh = () => setQs(Object.fromEntries(list.map((s) => [s, feed.quote(s)])));
    refresh();
    const dirty = new Set<string>();
    const flush = () => {
      if (dirty.size === 0) return;
      const changed = [...dirty];
      dirty.clear();
      setQs((prev) => {
        const next = { ...prev };
        for (const s of changed) next[s] = feed.quote(s);
        return next;
      });
    };
    const unsub = feed.subscribe(list, (q) => {
      dirty.add(q.symbol);
      onFrame(flush);
    });
    const unmode = feed.onMode(refresh); // live data arrived (or fell back): take the new snapshots
    return () => {
      frameQueue.delete(flush);
      unsub();
      unmode();
    };
  }, [feed, key]);
  // symbols added since the last effect (e.g. a re-sorted movers list) read the current snapshot
  return React.useMemo(() => Object.fromEntries(key.split(",").map((s) => [s, qs[s] ?? feed.quote(s)])), [qs, key, feed]);
}

const closesCache = new Map<string, Promise<number[] | null>>();

/**
 * Recent closes of `symbol` on `tf` from the market-data database (for sparklines), or null while loading /
 * when the service is offline. Successful results are cached per symbol+timeframe for the session; failures
 * are not, so the next mount retries.
 */
export function useCloses(symbol: string, tf: string, limit: number): number[] | null {
  const key = `${symbol}|${tf}|${limit}`;
  const mode = useFeedMode();
  const [v, setV] = React.useState<{ key: string; closes: number[] | null } | null>(null);
  React.useEffect(() => {
    priceFeed().markHydrated();
    if (mode !== "live") return;
    let alive = true;
    let p = closesCache.get(key);
    if (!p) {
      p = fetchCandles(symbol, tf, limit).then((b) => (b && b.length > 1 ? b.map((x) => x.close) : null));
      closesCache.set(key, p);
      void p.then((closes) => {
        if (!closes) closesCache.delete(key); // don't remember a failure
      });
    }
    void p.then((closes) => alive && setV({ key, closes }));
    return () => {
      alive = false;
    };
  }, [key, symbol, tf, limit, mode]);
  return v && v.key === key ? v.closes : null;
}

/** Current feed mode: "connecting" until the market-data service answers, then "live" (or "sim" if it's offline). */
export function useFeedMode() {
  const feed = priceFeed();
  React.useEffect(() => feed.markHydrated(), [feed]);
  return React.useSyncExternalStore(
    (cb) => feed.onMode(cb),
    () => feed.mode,
    () => "connecting" as const,
  );
}

/**
 * Re-mounts its children once when live market data first arrives, so anything computed from reference
 * data at mount (sorted movers, heat maps, sparklines) is rebuilt from real prices.
 * `remount={false}`: pages whose market views follow the feed mode themselves (live builds) keep their state —
 * a remount would drop data they already loaded and fetch it again, and on a slow link the feed (another origin)
 * often goes live after the page's own data has arrived.
 */
export function MarketBoundary({ children, remount = true }: { children: React.ReactNode; remount?: boolean }) {
  const mode = useFeedMode();
  React.useEffect(() => priceFeed().markHydrated(), []);
  return <React.Fragment key={remount && mode === "live" ? "live" : "ref"}>{children}</React.Fragment>;
}

/**
 * Direction of the last change of `value` (1 up / -1 down), plus a counter that bumps on every change —
 * use the counter as a React `key` to restart a CSS flash animation. Ignores the first render.
 */
export function useTick(value: number): { dir: 1 | -1 | 0; n: number } {
  const prev = React.useRef(value);
  const [t, setT] = React.useState<{ dir: 1 | -1 | 0; n: number }>({ dir: 0, n: 0 });
  React.useEffect(() => {
    if (value === prev.current) return;
    const dir = value > prev.current ? 1 : -1;
    prev.current = value;
    setT((x) => ({ dir, n: x.n + 1 }));
  }, [value]);
  return t;
}

/** Rolls a displayed number to its new value in ~`ms` (fast, like pro terminals). */
export function useRolling(value: number, ms = 180): number {
  const [shown, setShown] = React.useState(value);
  const from = React.useRef(value);
  const shownRef = React.useRef(value);
  React.useEffect(() => {
    from.current = shownRef.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const e = 1 - (1 - k) * (1 - k); // ease-out
      const v = from.current + (value - from.current) * e;
      shownRef.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

const UP = "var(--k-up)";
const DOWN = "var(--k-down)";

/**
 * Smooth tick glow: on each change, fades the element's background from a soft green/red tint to transparent
 * with the Web Animations API. The element is never remounted and a new tick blends from the current state,
 * so rapid ticks don't strobe or flicker.
 */
export function useTickGlow<T extends HTMLElement>(value: number, { strength = 16, duration = 750 } = {}) {
  const ref = React.useRef<T>(null);
  const prev = React.useRef(value);
  // the running glow, cancelled directly: el.getAnimations() would force a style recalculation on every tick
  const anim = React.useRef<Animation | null>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || value === prev.current) return;
    const up = value > prev.current;
    prev.current = value;
    if (typeof el.animate !== "function" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const tint = `color-mix(in oklab, ${up ? UP : DOWN} ${strength}%, transparent)`;
    anim.current?.cancel();
    anim.current = el.animate([{ backgroundColor: tint }, { backgroundColor: "transparent" }], { duration, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
  }, [value, strength, duration]);
  return ref;
}

/**
 * One character of a price. When it changes, its colour eases from green/red back to normal (no remount).
 * Memoised: on a tick only the characters that changed re-render; the running animation is kept in a ref and
 * cancelled directly (el.getAnimations() forces a synchronous style recalculation per call).
 */
const Digit = React.memo(function Digit({ ch, dir }: { ch: string; dir: 1 | -1 | 0 }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const prev = React.useRef(ch);
  const anim = React.useRef<Animation | null>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || ch === prev.current) return;
    prev.current = ch;
    if (!dir || typeof el.animate !== "function") return;
    anim.current?.cancel();
    anim.current = el.animate([{ color: dir === 1 ? UP : DOWN }, { color: dir === 1 ? UP : DOWN, offset: 0.25 }, {}], { duration: 650, easing: "ease-out" });
  }, [ch, dir]);
  return <span ref={ref}>{ch}</span>;
});

/**
 * Price with MT5-style emphasised pips. On each tick only the digits that actually changed
 * flash green/red and slide in from the direction of the move; `pulse` also flashes the cell background.
 */
export function PriceText({
  symbol,
  value,
  dir = 0,
  className,
  size = "md",
  pulse = false,
}: {
  symbol: string;
  value: number;
  dir?: 1 | -1 | 0;
  className?: string;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
}) {
  const inst = getInstrument(symbol);
  const { head, pips, tail } = splitPrice(value, inst.digits);
  const prevValue = React.useRef(value);
  const moveDir: 1 | -1 | 0 = value === prevValue.current ? 0 : value > prevValue.current ? 1 : -1;
  const lastDir = React.useRef<1 | -1 | 0>(0);
  if (moveDir) lastDir.current = moveDir;
  React.useEffect(() => {
    prevValue.current = value;
  }, [value]);
  const d = dir || lastDir.current;
  const glow = useTickGlow<HTMLSpanElement>(pulse ? value : 0, { strength: 14, duration: 700 });

  // stable per-character spans (keyed by position) — only characters that change animate
  const chars = (text: string, offset: number) => [...text].map((ch, i) => <Digit key={offset + i} ch={ch} dir={d} />);
  const pipSize = size === "lg" ? "text-[1.25em]" : "text-[1.12em]";
  return (
    <span ref={glow} className={cn("k-num inline-flex items-baseline rounded-[3px] font-mono", className)}>
      <span className="text-fg-2">{chars(head, 0)}</span>
      <span className={cn("font-semibold text-fg", pipSize)}>{chars(pips, 100)}</span>
      {tail && <span className="relative -top-[0.45em] text-[0.7em] text-fg-2">{chars(tail, 200)}</span>}
    </span>
  );
}

export function LivePrice({ symbol, side = "bid", className, size }: { symbol: string; side?: "bid" | "ask"; className?: string; size?: "sm" | "md" | "lg" }) {
  const q = useQuote(symbol);
  return <PriceText symbol={symbol} value={q[side]} dir={q.dir} className={className} size={size} />;
}
