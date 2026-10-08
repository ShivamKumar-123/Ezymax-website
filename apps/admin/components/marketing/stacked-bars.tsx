"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@ezymex/ui";

/**
 * Stacked capsule columns over a dotted grid with a hover tooltip pill.
 * `series` order is bottom → top.
 */
export function StackedBars<K extends string>({
  data,
  series,
  height = 220,
  labelEvery = 5,
  format = (v: number) => v.toLocaleString("en-US"),
  className,
}: {
  data: ({ label: string } & Record<K, number>)[];
  series: { key: K; label: string; color: string }[];
  height?: number;
  labelEvery?: number;
  format?: (v: number) => string;
  className?: string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const totals = data.map((d) => series.reduce((s, x) => s + (d[x.key] as number), 0));
  const max = Math.max(...totals) * 1.42;
  const sel = hover ?? data.length - 1;
  const selRow = data[sel]!;
  return (
    <div className={cn("relative", className)}>
      <div className="relative" style={{ height }}>
        {/* dotted grid */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-t border-dashed border-line" />
          ))}
        </div>
        <div className="absolute inset-0 flex items-end gap-[3px] sm:gap-1">
          {data.map((d, i) => {
            const on = i === sel;
            return (
              <div key={d.label} className="relative flex h-full flex-1 flex-col justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <motion.div
                  className={cn("flex w-full flex-col-reverse overflow-hidden rounded-full transition-opacity", hover !== null && !on && "opacity-45")}
                  initial={{ height: 0 }}
                  animate={{ height: `${(totals[i]! / max) * 100}%` }}
                  transition={{ duration: 0.7, delay: i * 0.012, ease: [0.16, 1, 0.3, 1] }}
                >
                  {series.map((s) => (
                    <span key={s.key} style={{ height: `${((d[s.key] as number) / totals[i]!) * 100}%`, background: s.color }} className="block w-full" />
                  ))}
                </motion.div>
              </div>
            );
          })}
        </div>
        {/* tooltip */}
        <div
          className="pointer-events-none absolute top-0 z-10 min-w-[150px] -translate-x-1/2 whitespace-nowrap rounded-[12px] border border-line bg-surface-2/95 px-3 py-2 text-[11.5px] shadow-xl backdrop-blur"
          style={{ left: `${Math.min(88, Math.max(12, ((sel + 0.5) / data.length) * 100))}%` }}
        >
          <div className="mb-1 font-medium text-fg">{selRow.label}</div>
          {series
            .slice()
            .reverse()
            .map((s) => (
              <div key={s.key} className="flex items-center gap-2 text-fg-2">
                <span className="size-1.5 rounded-full" style={{ background: s.color }} />
                <span className="flex-1">{s.label}</span>
                <span className="k-num text-fg">{format(selRow[s.key] as number)}</span>
              </div>
            ))}
        </div>
      </div>
      <div className="mt-2 flex gap-[3px] sm:gap-1">
        {data.map((d, i) => (
          <span key={d.label} className={cn("flex-1 whitespace-nowrap text-center text-[10.5px]", i === sel ? "text-fg" : "text-fg-3")}>
            {i % labelEvery === 0 || i === sel ? d.label.split(" ")[0] : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
