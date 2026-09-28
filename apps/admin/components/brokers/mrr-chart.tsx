"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn, formatNumber } from "@kalks/ui";

/** Stacked monthly bars: licence (gold) + revenue share (ember), with hover tooltip. */
export function MrrChart({ data, height = 260 }: { data: { month: string; licence: number; revShare: number; tenants: number }[]; height?: number }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.licence + d.revShare)) * 1.12;
  const sel = hover ?? data.length - 1;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  return (
    <div className="relative" style={{ height }}>
      {/* grid */}
      <div className="absolute inset-0 bottom-6 left-12">
        {ticks.map((t, i) => (
          <div key={i} className="absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="k-num absolute -left-12 -translate-y-1/2 text-[10.5px] text-fg-3">${formatNumber(t / 1000, 0)}K</span>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 left-12 flex items-end gap-2 sm:gap-3">
        {data.map((d, i) => {
          const total = d.licence + d.revShare;
          const on = i === sel;
          return (
            <div key={d.month} className="relative flex h-full flex-1 flex-col items-center justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {on && (
                <div className={cn("absolute z-10 w-max -translate-y-2 rounded-xl", i >= data.length - 2 ? "right-0" : i < 2 ? "left-0" : "left-1/2 -translate-x-1/2")} style={{ bottom: `calc(24px + ${total / max} * (${height}px - 24px))` }}>
<div className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-[11.5px] shadow-xl">
                  <div className="font-medium text-fg">{d.month} · <span className="k-num">${formatNumber(total, 0)}</span></div>
                  <div className="k-num mt-1 flex items-center gap-1.5 text-fg-3">
                    <span className="size-1.5 rounded-full bg-gold" /> Licence ${formatNumber(d.licence, 0)}
                  </div>
                  <div className="k-num flex items-center gap-1.5 text-fg-3">
                    <span className="size-1.5 rounded-full bg-ember" /> Rev-share ${formatNumber(d.revShare, 0)}
                  </div>
                </div>
                </div>
              )}
              <div className="flex w-full max-w-11 flex-1 flex-col justify-end pb-6">
                <motion.div
                  className={cn("flex w-full flex-col overflow-hidden rounded-[10px] border transition-shadow", on ? "border-ember/40 shadow-[0_0_30px_-6px_rgba(255,90,31,.6)]" : "border-line opacity-80")}
                  initial={{ height: 0 }}
                  animate={{ height: `${(total / max) * 100}%` }}
                  transition={{ duration: 0.8, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className={cn("w-full flex-1", on ? "bg-gradient-to-b from-ember-2 to-[#b8330f]" : "bg-gradient-to-b from-surface-3 to-surface-2")} />
                  <div className={cn("w-full", on ? "bg-gold" : "bg-gold/40")} style={{ height: `${Math.max(6, (d.licence / total) * 100)}%` }} />
                </motion.div>
              </div>
              <span className={cn("absolute bottom-0 text-[10.5px]", on ? "text-fg" : "text-fg-3")}>{d.month}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
