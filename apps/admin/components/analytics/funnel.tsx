"use client";

import * as React from "react";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { cn, formatNumber } from "@ezymex/ui";

export interface FunnelStage {
  key: string;
  label: string;
  hint?: string;
  value: number;
  prev?: number;
}

const VW = 1000;
const VH = 220;

/** Premium tapered funnel ribbon with stage totals, step conversion and drop-offs. */
export function FunnelViz({ stages, className }: { stages: FunnelStage[]; className?: string }) {
  const id = React.useId().replace(/:/g, "");
  const [hover, setHover] = React.useState<number | null>(null);
  const n = stages.length;
  const max = stages[0]!.value;
  const min = stages[n - 1]!.value;
  const floor = Math.log(min * 0.45);
  const hOf = (v: number) => 34 + (VH - 44) * ((Math.log(v) - floor) / (Math.log(max) - floor));
  const col = VW / n;
  const hs = stages.map((s) => hOf(s.value));

  const fx = (i: number) => i * col + col * (i === n - 1 ? 1 : 0.62); // end of flat part
  const tp = (i: number) => (VH - hs[i]!) / 2;
  const bt = (i: number) => (VH + hs[i]!) / 2;
  let d = `M0,${tp(0)}`;
  for (let i = 0; i < n; i++) {
    d += ` L${fx(i)},${tp(i)}`;
    if (i < n - 1) {
      const nx = (i + 1) * col;
      const mid = (fx(i) + nx) / 2;
      d += ` C${mid},${tp(i)} ${mid},${tp(i + 1)} ${nx},${tp(i + 1)}`;
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    d += ` L${fx(i)},${bt(i)} L${i * col},${bt(i)}`;
    if (i > 0) {
      const mid = (fx(i - 1) + i * col) / 2;
      d += ` C${mid},${bt(i)} ${mid},${bt(i - 1)} ${fx(i - 1)},${bt(i - 1)}`;
    }
  }
  d += " Z";

  return (
    <div className={cn("w-full", className)}>
      {/* stage headers */}
      <div className="grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {stages.map((s, i) => {
          const delta = s.prev ? ((s.value - s.prev) / s.prev) * 100 : null;
          return (
            <div key={s.key} className={cn("min-w-0 pr-3 transition-opacity", hover !== null && hover !== i && "opacity-50")} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <div className="flex items-center gap-2">
                <span className="grid size-5 place-items-center rounded-full border border-line bg-surface-2 text-[10px] font-semibold text-fg-2 k-num">{i + 1}</span>
                <span className="k-label truncate">{s.label}</span>
              </div>
              <div className="k-num mt-2 text-[22px] font-semibold leading-none tracking-tight text-fg sm:text-[28px]">{formatNumber(s.value, 0)}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]">
                <span className="k-num text-fg-3">{i === 0 ? "100%" : `${((s.value / max) * 100).toFixed(2)}%`} of visits</span>
                {delta !== null && <span className={cn("k-num", delta >= 0 ? "text-up" : "text-down")}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)}%</span>}
              </div>
              {s.hint && <div className="mt-0.5 hidden truncate text-[11px] text-fg-3 md:block">{s.hint}</div>}
            </div>
          );
        })}
      </div>

      {/* ribbon */}
      <div className="relative mt-5">
        <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" className="block h-[200px] w-full sm:h-[220px]">
          <defs>
            <linearGradient id={`${id}-g`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#ff5a1f" stopOpacity="0.95" />
              <stop offset="0.55" stopColor="#ff8a3d" stopOpacity="0.9" />
              <stop offset="1" stopColor="#e9b949" stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id={`${id}-s`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.25" />
            </linearGradient>
            <filter id={`${id}-b`} x="-10%" y="-40%" width="120%" height="180%">
              <feGaussianBlur stdDeviation="18" />
            </filter>
            <clipPath id={`${id}-c`}>
              <motion.rect x="0" y="0" height={VH} initial={{ width: 0 }} animate={{ width: VW }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${id}-c)`}>
            <path d={d} fill={`url(#${id}-g)`} opacity={0.35} filter={`url(#${id}-b)`} />
            <path d={d} fill={`url(#${id}-g)`} />
            <path d={d} fill={`url(#${id}-s)`} />
            {stages.map((_, i) =>
              i > 0 ? <line key={i} x1={i * col} x2={i * col} y1={0} y2={VH} stroke="var(--k-bg)" strokeOpacity={0.55} strokeWidth={2} vectorEffect="non-scaling-stroke" /> : null,
            )}
            {hover !== null && <rect x={hover * col} y={0} width={col} height={VH} fill="#fff" opacity={0.06} />}
          </g>
        </svg>
        {/* step conversion pills on the boundaries */}
        {stages.slice(1).map((s, i) => {
          const conv = (s.value / stages[i]!.value) * 100;
          return (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${((i + 1) / n) * 100}%` }}
            >
              <div className="flex items-center gap-1 rounded-full border border-[var(--k-border-top)] bg-bg/85 px-2.5 py-1 text-[11.5px] font-semibold text-fg shadow-[0_8px_24px_-6px_rgba(0,0,0,0.8)] backdrop-blur k-num">
                {conv.toFixed(1)}%
                <ChevronRight className="size-3 text-fg-3" />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* drop-offs */}
      <div className="mt-4 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {stages.map((s, i) => {
          const next = stages[i + 1];
          return (
            <div key={s.key} className="min-w-0 pr-3">
              {next ? (
                <div className="k-row px-3 py-2">
                  <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Drop-off</div>
                  <div className="k-num mt-0.5 truncate text-[13px] font-medium text-down">−{formatNumber(s.value - next.value, 0)}</div>
                  <div className="k-num text-[11px] text-fg-3">{(((s.value - next.value) / s.value) * 100).toFixed(1)}% lost</div>
                </div>
              ) : (
                <div className="k-row border-up/25 bg-up-soft px-3 py-2">
                  <div className="text-[10.5px] uppercase tracking-wider text-up/80">Overall</div>
                  <div className="k-num mt-0.5 text-[13px] font-medium text-up">{((s.value / max) * 100).toFixed(2)}%</div>
                  <div className="text-[11px] text-fg-3">visit → active</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
