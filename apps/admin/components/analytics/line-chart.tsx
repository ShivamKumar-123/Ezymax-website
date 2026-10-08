"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@ezymex/ui";
import { compactMoney, niceDomain } from "./stacked-bars";

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
  width?: number;
  dashed?: boolean;
  area?: boolean;
  muted?: boolean;
}

/** Multi-series SVG line chart over a dotted grid with a crosshair + tooltip. */
export function LineChart({
  labels,
  series,
  height = 260,
  format = compactMoney,
  className,
  legend = true,
  minZero = true,
}: {
  labels: string[];
  series: LineSeries[];
  height?: number;
  format?: (v: number) => string;
  className?: string;
  legend?: boolean;
  minZero?: boolean;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const [focus, setFocus] = React.useState<string | null>(null);
  const plotRef = React.useRef<HTMLDivElement>(null);
  const id = React.useId().replace(/:/g, "");
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const { lo, hi, ticks } = niceDomain(minZero ? Math.min(0, ...all) : Math.min(...all), Math.max(...all), 4);
  const span = hi - lo || 1;
  const n = labels.length;
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => ((hi - v) / span) * 100;

  const path = (vals: (number | null)[]) => {
    let d = "";
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)} `;
      pen = true;
    });
    return d.trim();
  };

  const onMove = (e: React.MouseEvent) => {
    const r = plotRef.current?.getBoundingClientRect();
    if (!r) return;
    const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div className={cn("w-full", className)}>
      {legend && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {series.map((s) => (
            <button
              key={s.key}
              type="button"
              onMouseEnter={() => setFocus(s.key)}
              onMouseLeave={() => setFocus(null)}
              className={cn("inline-flex items-center gap-2 text-[12px] transition-colors", focus && focus !== s.key ? "text-fg-3" : "text-fg-2")}
            >
              <span className={cn("h-0.5 w-4 rounded-full", s.dashed && "bg-transparent border-t-2 border-dashed")} style={s.dashed ? { borderColor: s.color } : { background: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-3">
        <div className="relative w-12 shrink-0" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="k-num absolute right-0 -translate-y-1/2 text-[10.5px] text-fg-3" style={{ top: `${y(t)}%` }}>
              {format(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div ref={plotRef} className="relative" style={{ height }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
            <div className="k-dotgrid absolute inset-0 rounded-xl opacity-50" />
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 border-t border-dashed border-line" style={{ top: `${y(t)}%` }} />
            ))}
            <svg className="absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                {series.map((s, i) => (
                  <linearGradient key={s.key} id={`${id}-a${i}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor={s.color} stopOpacity="0.22" />
                    <stop offset="1" stopColor={s.color} stopOpacity="0" />
                  </linearGradient>
                ))}
                <clipPath id={`${id}-clip`}>
                  <motion.rect x="-1" y="-10" height="120" initial={{ width: 0 }} animate={{ width: 102 }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }} />
                </clipPath>
              </defs>
              <g clipPath={`url(#${id}-clip)`}>
              {series.map((s, i) => {
                const d = path(s.values);
                if (!d) return null;
                const lastIdx = s.values.reduce<number>((acc, v, k) => (v !== null ? k : acc), 0);
                const firstIdx = s.values.findIndex((v) => v !== null);
                const dim = focus ? focus !== s.key : s.muted;
                return (
                  <g key={s.key} style={{ opacity: dim ? 0.28 : 1, transition: "opacity .2s" }}>
                    {s.area && <path d={`${d} L${x(lastIdx)},${y(Math.max(lo, 0))} L${x(firstIdx)},${y(Math.max(lo, 0))} Z`} fill={`url(#${id}-a${i})`} />}
                    <path
                      d={d}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={s.width ?? 2}
                      strokeDasharray={s.dashed ? "5 5" : undefined}
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}
              </g>
            </svg>
            {hover !== null && (
              <>
                <div className="pointer-events-none absolute inset-y-0 border-l border-dashed border-fg-3" style={{ left: `${x(hover)}%` }} />
                {series.map((s) => {
                  const v = s.values[hover];
                  if (v === null || v === undefined) return null;
                  return (
                    <span
                      key={s.key}
                      className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-bg"
                      style={{ left: `${x(hover)}%`, top: `${y(v)}%`, borderColor: s.color }}
                    />
                  );
                })}
              </>
            )}
            <AnimatePresence>
              {hover !== null && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className="pointer-events-none absolute top-2 z-20 min-w-[170px] rounded-2xl border border-line bg-surface-3/95 p-3 text-xs shadow-[0_20px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur"
                  style={hover > (n - 1) / 2 ? { right: `${100 - x(hover) + 2}%` } : { left: `${x(hover) + 2}%` }}
                >
                  <div className="mb-2 font-medium text-fg">{labels[hover]}</div>
                  <div className="space-y-1.5">
                    {series
                      .filter((s) => s.values[hover] !== null && s.values[hover] !== undefined)
                      .slice(0, 8)
                      .map((s) => (
                        <div key={s.key} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-2 text-fg-2">
                            <span className="size-2 rounded-full" style={{ background: s.color }} />
                            {s.label}
                          </span>
                          <span className="k-num font-medium text-fg">{format(s.values[hover]!)}</span>
                        </div>
                      ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="relative mt-2 h-4">
            {labels.map((l, i) =>
              (i % Math.max(1, Math.ceil(n / 12)) === 0 && n - 1 - i >= Math.ceil(n / 12)) || i === n - 1 ? (
                <span key={i} className={cn("k-num absolute whitespace-nowrap text-[10.5px] text-fg-3", i === 0 ? "" : i === n - 1 ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${x(i)}%` }}>
                  {l}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
