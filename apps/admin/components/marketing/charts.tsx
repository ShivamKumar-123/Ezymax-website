"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@kalks/ui";

/**
 * Bars (series A) with either paired bars or a smooth line (series B) over a
 * dotted grid, hover column with a tooltip pill. Pure divs + SVG with tokens.
 */
export function ComboChart({
  data,
  aLabel,
  bLabel,
  mode = "bars",
  height = 220,
  format = (v: number) => v.toLocaleString("en-US"),
  className,
  labelEvery = 1,
}: {
  data: { label: string; a: number; b: number }[];
  aLabel: string;
  bLabel: string;
  mode?: "bars" | "bar-line";
  height?: number;
  format?: (v: number) => string;
  className?: string;
  labelEvery?: number;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const max = Math.max(...data.flatMap((d) => [d.a, d.b])) * 1.12;
  const n = data.length;
  const pts = data.map((d, i) => [((i + 0.5) / n) * 100, 100 - (d.b / max) * 100] as const);
  const line = pts.map(([x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = pts[i - 1]!;
    const cx = (px + x) / 2;
    return `C${cx},${py} ${cx},${y} ${x},${y}`;
  }).join(" ");
  const sel = hover ?? n - 1;
  const d = data[sel]!;
  const ticks = [0.25, 0.5, 0.75, 1];
  return (
    <div className={cn("select-none", className)}>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[12px] text-fg-3">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-gradient-to-b from-[#ff8a3d] to-[#c4381a]" /> {aLabel}
        </span>
        <span className="flex items-center gap-1.5">
          {mode === "bars" ? <span className="size-2.5 rounded-[3px] bg-gold" /> : <span className="h-0.5 w-3.5 rounded-full bg-gold" />} {bLabel}
        </span>
        <span className="ml-auto rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[11.5px] text-fg-2">
          <span className="text-fg-3">{d.label} · </span>
          <span className="k-num text-ember">{format(d.a)}</span>
          <span className="text-fg-3"> / </span>
          <span className="k-num text-gold">{format(d.b)}</span>
        </span>
      </div>
      <div className="relative k-dotgrid rounded-xl" style={{ height }}>
        {ticks.map((t) => (
          <div key={t} className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-line" style={{ bottom: `${(t / 1.12) * 100}%` }}>
            <span className="k-num absolute -top-2 right-0 z-10 rounded bg-surface/90 px-1 text-[10px] text-fg-3">{format((max / 1.12) * t)}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end">
          {data.map((x, i) => (
            <div key={x.label} className="relative flex h-full flex-1 items-end justify-center gap-[2px]" style={{ paddingInline: `${14 / n}%` }} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {i === sel && <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 border-l border-dashed border-fg-3/50" />}
              <motion.div
                className={cn("w-full max-w-[18px] rounded-t-[5px]", i === sel ? "bg-gradient-to-b from-[#ff8a3d] to-[#c4381a] shadow-[0_0_24px_-6px_rgba(255,90,31,0.8)]" : "bg-gradient-to-b from-ember/70 to-ember/20")}
                initial={{ height: 0 }}
                animate={{ height: `${(x.a / max) * 100}%` }}
                transition={{ duration: 0.7, delay: i * 0.02, ease: [0.16, 1, 0.3, 1] }}
              />
              {mode === "bars" && (
                <motion.div
                  className={cn("w-full max-w-[18px] rounded-t-[5px]", i === sel ? "bg-gold" : "bg-gold/55")}
                  initial={{ height: 0 }}
                  animate={{ height: `${(x.b / max) * 100}%` }}
                  transition={{ duration: 0.7, delay: i * 0.02 + 0.05, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
            </div>
          ))}
        </div>
        {mode === "bar-line" && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full overflow-visible">
            <defs>
              <linearGradient id="mkt-combo-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="var(--k-gold)" stopOpacity="0.25" />
                <stop offset="1" stopColor="var(--k-gold)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${line} L${pts[n - 1]![0]},100 L${pts[0]![0]},100 Z`} fill="url(#mkt-combo-fill)" />
            <motion.path d={line} fill="none" stroke="var(--k-gold)" strokeWidth={2} vectorEffect="non-scaling-stroke" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
          </svg>
        )}
        {mode === "bar-line" && (
          <div className="pointer-events-none absolute size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-gold bg-bg shadow-[0_0_12px_var(--k-gold)]" style={{ left: `${pts[sel]![0]}%`, bottom: `${100 - pts[sel]![1]}%` }} />
        )}
      </div>
      <div className="relative mt-2 h-4">
        {data.map((x, i) =>
          i % labelEvery === 0 || i === sel ? (
            <span key={x.label} className={cn("absolute -translate-x-1/2 whitespace-nowrap text-[10.5px]", i === sel ? "text-fg" : "text-fg-3", i !== sel && Math.abs(i - sel) < labelEvery / 1.5 && "hidden")} style={{ left: `${((i + 0.5) / n) * 100}%` }}>
              {x.label}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}
