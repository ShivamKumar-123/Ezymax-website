"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Chip, Toggle, cn } from "@/components/kit";
import { candles, getInstrument } from "@ezymex/mock";
import { operandLabel, type Operand, type StrategyRules } from "@ezymex/mock/algo";
import { toast } from "sonner";

const TF_SEC: Record<string, number> = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400 };

function ma(v: number[], p: number, ema: boolean) {
  const out: number[] = [];
  const k = 2 / (p + 1);
  let prev = v[0]!;
  for (let i = 0; i < v.length; i++) {
    if (ema) prev = i === 0 ? v[0]! : v[i]! * k + prev * (1 - k);
    else {
      const s = v.slice(Math.max(0, i - p + 1), i + 1);
      prev = s.reduce((a, b) => a + b, 0) / s.length;
    }
    out.push(prev);
  }
  return out;
}

function series(o: Operand, c: { open: number; high: number; low: number; close: number }[]): number[] | null {
  const close = c.map((x) => x.close);
  const p = o.period ?? 20;
  switch (o.kind) {
    case "ema":
      return ma(close, p, true);
    case "sma":
      return ma(close, p, false);
    case "price":
      return close;
    case "bb_upper":
    case "bb_lower": {
      const m = ma(close, p, false);
      return m.map((mid, i) => {
        const s = close.slice(Math.max(0, i - p + 1), i + 1);
        const sd = Math.sqrt(s.reduce((a, b) => a + (b - mid) ** 2, 0) / s.length);
        return o.kind === "bb_upper" ? mid + 2 * sd : mid - 2 * sd;
      });
    }
    case "asian_high":
    case "prev_high":
      return c.map((_, i) => Math.max(...c.slice(Math.max(0, i - 32), Math.max(1, i - 1)).map((x) => x.high)));
    case "asian_low":
    case "prev_low":
      return c.map((_, i) => Math.min(...c.slice(Math.max(0, i - 32), Math.max(1, i - 1)).map((x) => x.low)));
    default:
      return null;
  }
}

/** Mini candle chart with the trigger's operands overlaid and the entries it would have taken. */
export function SignalPreview({ rules }: { rules: StrategyRules }) {
  const box = React.useRef<HTMLDivElement>(null);
  const [w, setW] = React.useState(640);
  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 210;
  const N = 90;
  const data = React.useMemo(() => {
    const all = candles(rules.symbol, N + 60, TF_SEC[rules.timeframe] ?? 900);
    const trig = rules.conditions[0]!;
    const L = series(trig.left, all);
    const R = series(trig.right, all);
    const cut = (s: number[] | null) => (s ? s.slice(-N) : null);
    const c = all.slice(-N);
    const l = cut(L);
    const r = cut(R);
    const hits: number[] = [];
    const wantUp = trig.op === "crosses_above" || trig.op === ">" || trig.op === ">=";
    if (l && r) {
      for (let i = 1; i < N; i++) {
        const a = l[i - 1]! - r[i - 1]!;
        const b = l[i]! - r[i]!;
        if (wantUp ? a <= 0 && b > 0 : a >= 0 && b < 0) {
          if (!hits.length || i - hits[hits.length - 1]! > 4) hits.push(i);
        }
      }
    }
    if (hits.length < 2) {
      // fall back to pullback re-entries: close crossing the fast line in the trade direction
      const f = l && trig.left.kind !== "price" ? l : ma(c.map((k) => k.close), 20, true);
      for (let i = 1; i < N; i++) {
        const a = c[i - 1]!.close - f[i - 1]!;
        const b = c[i]!.close - f[i]!;
        if ((wantUp ? a <= 0 && b > 0 : a >= 0 && b < 0) && (!hits.length || i - hits[hits.length - 1]! > 8)) hits.push(i);
      }
    }
    return { c, l, r, hits };
  }, [rules.symbol, rules.timeframe, rules.conditions]);

  const { c, l, r, hits } = data;
  const lo = Math.min(...c.map((x) => x.low), ...(l ?? []), ...(r ?? []));
  const hi = Math.max(...c.map((x) => x.high), ...(l ?? []), ...(r ?? []));
  const pad = (hi - lo) * 0.08;
  const y = (v: number) => 8 + ((hi + pad - v) / (hi - lo + 2 * pad)) * (H - 16);
  const cw = w / N;
  const x = (i: number) => i * cw + cw / 2;
  const path = (s: number[]) => s.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const buy = rules.side === "buy";
  const digits = getInstrument(rules.symbol).digits;
  const lastHit = hits[hits.length - 1];
  const atr = c.slice(-14).reduce((s, k) => s + (k.high - k.low), 0) / 14;
  const slDist = rules.sl.mode === "atr" ? rules.sl.value * atr : atr * 1.2;
  const tpDist = rules.tp.mode === "atr" ? rules.tp.value * atr : rules.tp.mode === "rr" ? rules.tp.value * slDist : slDist * 1.6;
  const trig = rules.conditions[0]!;

  return (
    <div className="k-row overflow-hidden px-4 pb-3 pt-3.5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-medium">Signal preview</span>
        <span className="text-[11px] text-fg-3">
          last {N} × {rules.timeframe} bars
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-fg-3">
          {l && trig.left.kind !== "price" && (
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded bg-ember" /> {operandLabel(trig.left)}
            </span>
          )}
          {r && (
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded bg-gold" /> {operandLabel(trig.right)}
            </span>
          )}
          <Chip size="sm" tone={buy ? "up" : "down"}>
            {hits.length} entries
          </Chip>
        </span>
      </div>
      <div ref={box} className="relative" style={{ height: H }}>
        <div className="k-dotgrid absolute inset-0 rounded-lg opacity-60" />
        <svg width={w} height={H} className="relative block">
          {lastHit !== undefined && (
            <g>
              <rect x={x(lastHit)} width={w - x(lastHit)} y={buy ? y(c[lastHit]!.close + tpDist) : y(c[lastHit]!.close)} height={Math.abs(y(c[lastHit]!.close) - y(c[lastHit]!.close + tpDist))} fill="var(--k-up)" opacity={0.08} />
              <rect x={x(lastHit)} width={w - x(lastHit)} y={buy ? y(c[lastHit]!.close) : y(c[lastHit]!.close + slDist)} height={Math.abs(y(c[lastHit]!.close) - y(c[lastHit]!.close - slDist))} fill="var(--k-down)" opacity={0.08} />
            </g>
          )}
          {c.map((k, i) => {
            const upC = k.close >= k.open;
            return (
              <g key={i} opacity={0.85}>
                <line x1={x(i)} x2={x(i)} y1={y(k.high)} y2={y(k.low)} stroke={upC ? "var(--k-up)" : "var(--k-down)"} strokeWidth={1} opacity={0.55} />
                <rect x={x(i) - Math.max(1, cw * 0.32)} width={Math.max(2, cw * 0.64)} y={y(Math.max(k.open, k.close))} height={Math.max(1, Math.abs(y(k.open) - y(k.close)))} fill={upC ? "var(--k-up)" : "var(--k-down)"} rx={0.5} opacity={0.7} />
              </g>
            );
          })}
          {l && trig.left.kind !== "price" && <motion.path key={`l${rules.symbol}${trig.left.period}`} d={path(l)} fill="none" stroke="var(--k-ember)" strokeWidth={1.6} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9 }} />}
          {r && <motion.path key={`r${rules.symbol}${trig.right.period}`} d={path(r)} fill="none" stroke="var(--k-gold)" strokeWidth={1.6} strokeDasharray={trig.right.kind.includes("high") || trig.right.kind.includes("low") ? "4 3" : undefined} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: 0.1 }} />}
          {hits.map((i, n) => {
            const px = x(i);
            const py = buy ? y(c[i]!.low) + 12 : y(c[i]!.high) - 12;
            return (
              <motion.g key={`${i}-${rules.side}`} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 + n * 0.06 }} style={{ transformOrigin: `${px}px ${py}px` }}>
                <line x1={px} x2={px} y1={8} y2={H - 8} stroke={buy ? "var(--k-up)" : "var(--k-down)"} strokeDasharray="2 4" opacity={0.25} />
                <path d={buy ? `M${px},${py - 6} l5,8 h-10 z` : `M${px},${py + 6} l5,-8 h-10 z`} fill={buy ? "var(--k-up)" : "var(--k-down)"} />
              </motion.g>
            );
          })}
        </svg>
        {lastHit !== undefined && (
          <div className="pointer-events-none absolute right-1 top-1 rounded-md border border-line bg-surface/90 px-2 py-1 font-mono text-[10.5px] text-fg-2 backdrop-blur">
            last {buy ? "BUY" : "SELL"} @ {c[lastHit]!.close.toFixed(digits)}
          </div>
        )}
      </div>
    </div>
  );
}

/** Execution filters applied by the server-side engine. */
export function ExecutionFilters() {
  const [f, setF] = React.useState({ news: true, spread: true, onePerBar: true, friday: false });
  const items: { key: keyof typeof f; title: string; sub: string }[] = [
    { key: "news", title: "Pause around red news", sub: "±15 min of high-impact events" },
    { key: "spread", title: "Max spread filter", sub: "Skip entries above 2.5 pips" },
    { key: "onePerBar", title: "One entry per bar", sub: "No stacking on the same candle" },
    { key: "friday", title: "Flat before weekend", sub: "Close all Fri 23:45 GMT+3" },
  ];
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {items.map((it) => (
        <div key={it.key} className={cn("k-row flex items-center gap-3 px-3.5 py-2.5", f[it.key] && "border-info/20")}>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium">{it.title}</div>
            <div className="truncate text-[11px] text-fg-3">{it.sub}</div>
          </div>
          <Toggle
            checked={f[it.key]}
            label={it.title}
            onChange={(v) => {
              setF((s) => ({ ...s, [it.key]: v }));
              toast(v ? `${it.title} enabled` : `${it.title} disabled`);
            }}
          />
        </div>
      ))}
    </div>
  );
}
