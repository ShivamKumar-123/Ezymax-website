"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@ezymex/ui";

export interface ActivityPoint {
  hour: string;
  logins: number;
  failed: number;
  flagged: number;
}

/** Hourly logins (capsule bars) with failed-login caps and a flagged-session line. */
export function ActivityChart({ data, height = 240 }: { data: ActivityPoint[]; height?: number }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.logins)) * 1.12;
  const maxFlag = Math.max(...data.map((d) => d.flagged)) * 1.25;
  const sel = hover ?? data.length - 1;
  const d = data[sel]!;
  const pts = data.map((p, i) => [((i + 0.5) / data.length) * 100, 100 - (p.flagged / maxFlag) * 100] as const);
  const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px]">
        <span className="flex items-center gap-1.5 text-fg-2">
          <span className="size-2 rounded-sm bg-gold" /> Logins
        </span>
        <span className="flex items-center gap-1.5 text-fg-2">
          <span className="size-2 rounded-sm bg-down" /> Failed
        </span>
        <span className="flex items-center gap-1.5 text-fg-2">
          <span className="h-0.5 w-3 rounded bg-ember" /> Flagged sessions
        </span>
        <span className="ml-auto font-mono text-[11.5px] text-fg-3">
          {d.hour} GMT+3 · <span className="text-fg">{d.logins.toLocaleString("en-US")}</span> logins · <span className="text-down">{d.failed}</span> failed · <span className="text-ember">{d.flagged}</span> flagged
        </span>
      </div>
      <div className="relative" style={{ height }}>
        {/* dotted grid */}
        <div className="absolute inset-0 bg-[radial-gradient(var(--k-border-top)_1px,transparent_1px)] [background-size:16px_16px] opacity-60" />
        <div className="relative flex h-full items-end gap-[3px] sm:gap-1.5">
          {data.map((p, i) => {
            const on = i === sel;
            return (
              <div key={p.hour} className="relative flex h-full flex-1 flex-col justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(p.logins / max) * 100}%` }}
                  transition={{ duration: 0.7, delay: i * 0.02, ease: [0.16, 1, 0.3, 1] }}
                  className={cn(
                    "relative w-full overflow-hidden rounded-t-[10px] rounded-b-md border",
                    on ? "border-gold/60 bg-gradient-to-b from-gold/70 to-gold/20 shadow-[0_0_24px_-6px_var(--k-gold)]" : "border-line bg-[repeating-linear-gradient(135deg,rgba(233,185,73,0.22)_0_2px,transparent_2px_5px)]",
                  )}
                >
                  <span className="absolute inset-x-0 top-0 bg-down/80" style={{ height: `max(3px, ${(p.failed / p.logins) * 100}%)` }} />
                </motion.div>
              </div>
            );
          })}
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full overflow-visible">
          <motion.path d={path} fill="none" stroke="var(--k-ember)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }} style={{ filter: "drop-shadow(0 0 4px rgba(255,90,31,.6))" }} />
        </svg>
        <span
          className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-ember shadow-[0_0_10px_var(--k-ember)]"
          style={{ left: `${pts[sel]![0]}%`, top: `${pts[sel]![1]}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10.5px] text-fg-3">
        {data.map((p, i) => (
          <span key={p.hour} className={cn("flex-1 text-center", i % 3 !== 0 && "invisible", i === sel && "!visible text-fg")}>
            {p.hour.slice(0, 2)}
          </span>
        ))}
      </div>
    </div>
  );
}
