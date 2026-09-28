"use client";

import * as React from "react";
import { cn } from "@kalks/ui";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** Ticking countdown, rendered client-side only to avoid hydration drift. */
export function Countdown({ to, className, compact }: { to: string; className?: string; compact?: boolean }) {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const p = now === null ? null : parts(Date.parse(to) - now);
  const cells: [string, number | undefined][] = [
    ["Days", p?.d],
    ["Hrs", p?.h],
    ["Min", p?.m],
    ["Sec", p?.s],
  ];
  if (compact)
    return (
      <span className={cn("k-num font-mono", className)}>
        {p ? `${p.d}d ${String(p.h).padStart(2, "0")}:${String(p.m).padStart(2, "0")}:${String(p.s).padStart(2, "0")}` : "--d --:--:--"}
      </span>
    );
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {cells.map(([l, v], i) => (
        <React.Fragment key={l}>
          <div className="flex min-w-[52px] flex-col items-center rounded-[14px] border border-white/10 bg-black/35 px-2.5 py-2 backdrop-blur-sm">
            <span className="k-num font-mono text-[22px] font-semibold leading-none text-fg">{v === undefined ? "--" : String(v).padStart(2, "0")}</span>
            <span className="mt-1 text-[9.5px] uppercase tracking-[0.08em] text-fg-3">{l}</span>
          </div>
          {i < 3 && <span className="font-mono text-fg-3">:</span>}
        </React.Fragment>
      ))}
    </div>
  );
}
