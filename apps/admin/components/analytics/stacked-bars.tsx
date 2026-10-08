"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@ezymex/ui";

export interface BarSeries {
  key: string;
  label: string;
  color: string; // CSS colour (var(--k-…))
}

export interface BarDatum {
  label: string; // x label (short)
  title?: string; // tooltip heading
  values: Record<string, number>;
}

function niceStep(span: number, ticks: number) {
  const raw = span / ticks;
  const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

export function niceDomain(min: number, max: number, ticks = 4) {
  const step = niceStep(max - min || 1, ticks);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return { lo, hi, ticks: out };
}

export function compactMoney(v: number) {
  const a = Math.abs(v);
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(a >= 1e5 ? 0 : 1)}K` : a.toFixed(0);
  return `${v < 0 ? "-" : ""}$${s}`;
}

/**
 * Stacked bars supporting negative segments (stacked below zero), with an
 * optional overlay line (e.g. net), axis ticks, legend and hover tooltip.
 */
export function StackedBars({
  data,
  series,
  height = 260,
  format = compactMoney,
  line,
  labelEvery,
  className,
  legend = true,
}: {
  data: BarDatum[];
  series: readonly BarSeries[];
  height?: number;
  format?: (v: number) => string;
  line?: { key: string; label: string; color?: string; values: number[] };
  labelEvery?: number;
  className?: string;
  legend?: boolean;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const active = series.filter((s) => !hidden.has(s.key));

  const sums = data.map((d) => {
    let pos = 0;
    let neg = 0;
    for (const s of active) {
      const v = d.values[s.key] ?? 0;
      if (v >= 0) pos += v;
      else neg += v;
    }
    return { pos, neg };
  });
  const lineVals = line?.values ?? [];
  const rawMax = Math.max(0, ...sums.map((s) => s.pos), ...lineVals);
  const rawMin = Math.min(0, ...sums.map((s) => s.neg), ...lineVals);
  const { lo, hi, ticks } = niceDomain(rawMin, rawMax, 4);
  const span = hi - lo || 1;
  const y = (v: number) => ((hi - v) / span) * 100; // % from top
  const zero = y(0);
  const every = labelEvery ?? Math.max(1, Math.ceil(data.length / 10));
  const n = data.length;
  const gap = n > 120 ? 1 : n > 60 ? 2 : n > 20 ? 3 : 6;

  return (
    <div className={cn("w-full", className)}>
      {legend && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {series.map((s) => {
            const off = hidden.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() =>
                  setHidden((h) => {
                    const next = new Set(h);
                    if (next.has(s.key)) next.delete(s.key);
                    else next.add(s.key);
                    return next;
                  })
                }
                className={cn("inline-flex items-center gap-2 text-[12px] transition-opacity", off ? "text-fg-3 opacity-50" : "text-fg-2 hover:text-fg")}
              >
                <span className="size-2.5 rounded-[3px]" style={{ background: s.color, boxShadow: off ? undefined : `0 0 10px -1px ${s.color}` }} />
                {s.label}
              </button>
            );
          })}
          {line && (
            <span className="inline-flex items-center gap-2 text-[12px] text-fg-2">
              <span className="h-0.5 w-4 rounded-full" style={{ background: line.color ?? "var(--k-fg)" }} />
              {line.label}
            </span>
          )}
        </div>
      )}
      <div className="flex gap-3">
        {/* y axis */}
        <div className="relative w-12 shrink-0" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="k-num absolute right-0 -translate-y-1/2 text-[10.5px] text-fg-3" style={{ top: `${y(t)}%` }}>
              {format(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
            {/* grid */}
            {ticks.map((t) => (
              <div key={t} className={cn("absolute inset-x-0 border-t", t === 0 ? "border-fg-3/60" : "border-dashed border-line")} style={{ top: `${y(t)}%` }} />
            ))}
            {/* bars */}
            <div className="absolute inset-0 flex items-stretch" style={{ gap }}>
              {data.map((d, i) => {
                let accPos = 0;
                let accNeg = 0;
                const topKey = [...active].reverse().find((s) => (d.values[s.key] ?? 0) > 0)?.key;
                const botKey = [...active].reverse().find((s) => (d.values[s.key] ?? 0) < 0)?.key;
                return (
                  <div key={i} className={cn("relative flex-1 rounded-[4px] transition-colors", hover === i && "bg-fg/[0.04]")} onMouseEnter={() => setHover(i)}>
                    <motion.div
                      className="absolute inset-0"
                      style={{ transformOrigin: `50% ${zero}%` }}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ duration: 0.7, delay: Math.min(i * 0.008, 0.5), ease: [0.16, 1, 0.3, 1] }}
                    >
                      {active.map((s) => {
                        const v = d.values[s.key] ?? 0;
                        if (!v) return null;
                        let top: number;
                        let h: number;
                        if (v > 0) {
                          top = y(accPos + v);
                          h = y(accPos) - top;
                          accPos += v;
                        } else {
                          top = y(accNeg);
                          h = y(accNeg + v) - top;
                          accNeg += v;
                        }
                        const r = n > 90 ? 1.5 : 3;
                        return (
                          <div
                            key={s.key}
                            className="absolute inset-x-0"
                            style={{
                              top: `${top}%`,
                              height: `${h}%`,
                              background: s.color,
                              opacity: hover === null || hover === i ? 0.92 : 0.45,
                              borderTopLeftRadius: s.key === topKey ? r : 0,
                              borderTopRightRadius: s.key === topKey ? r : 0,
                              borderBottomLeftRadius: s.key === botKey ? r : 0,
                              borderBottomRightRadius: s.key === botKey ? r : 0,
                              boxShadow: v > 0 && s.key === topKey && hover === i ? `0 0 18px -2px ${s.color}` : undefined,
                              transition: "opacity .2s",
                            }}
                          />
                        );
                      })}
                    </motion.div>
                  </div>
                );
              })}
            </div>
            {/* overlay line */}
            {line && n > 1 && (
              <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                <motion.polyline
                  fill="none"
                  stroke={line.color ?? "var(--k-fg)"}
                  strokeWidth={1.6}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                  points={line.values.map((v, i) => `${((i + 0.5) / n) * 100},${y(v)}`).join(" ")}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.9 }}
                  transition={{ duration: 1.1, delay: 0.3 }}
                />
              </svg>
            )}
            {line && hover !== null && (
              <span
                className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-bg"
                style={{ left: `${((hover + 0.5) / n) * 100}%`, top: `${y(line.values[hover] ?? 0)}%`, borderColor: line.color ?? "var(--k-fg)" }}
              />
            )}
            {/* tooltip */}
            <AnimatePresence>
              {hover !== null && data[hover] && (
                <motion.div
                  key="tip"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className="pointer-events-none absolute top-2 z-20 min-w-[190px] rounded-2xl border border-line bg-surface-3/95 p-3 text-xs shadow-[0_20px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur"
                  style={hover > n / 2 ? { right: `${100 - (hover / n) * 100 + 1}%` } : { left: `${((hover + 1) / n) * 100 + 1}%` }}
                >
                  <div className="mb-2 font-medium text-fg">{data[hover]!.title ?? data[hover]!.label}</div>
                  <div className="space-y-1.5">
                    {active.map((s) => (
                      <div key={s.key} className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-2 text-fg-2">
                          <span className="size-2 rounded-[2px]" style={{ background: s.color }} />
                          {s.label}
                        </span>
                        <span className={cn("k-num font-medium", (data[hover]!.values[s.key] ?? 0) < 0 ? "text-down" : "text-fg")}>{format(data[hover]!.values[s.key] ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                  {line && (
                    <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                      <span className="text-fg-2">{line.label}</span>
                      <span className={cn("k-num font-semibold", (line.values[hover] ?? 0) < 0 ? "text-down" : "text-up")}>{format(line.values[hover] ?? 0)}</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* x labels */}
          <div className="relative mt-2 h-4">
            {data.map((d, i) =>
              i % every === 0 ? (
                <span key={i} className="k-num absolute -translate-x-1/2 whitespace-nowrap text-[10.5px] text-fg-3" style={{ left: `${((i + 0.5) / n) * 100}%` }}>
                  {d.label}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
