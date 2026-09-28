"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn, formatNumber } from "@kalks/ui";
import type { AnlCohort } from "@kalks/mock/admin-growth-analytics";
import { heat } from "./meter";

/** Triangular monthly cohort grid coloured on the ember→gold ramp. */
export function CohortHeatmap({ cohorts, mode }: { cohorts: AnlCohort[]; mode: "retention" | "ltv" }) {
  const [hover, setHover] = React.useState<{ r: number; c: number } | null>(null);
  const cols = Math.max(...cohorts.map((c) => c.retention.length));
  const allLtv = cohorts.flatMap((c) => c.ltv);
  const maxLtv = Math.max(...allLtv);
  const minLtv = Math.min(...allLtv);

  const avg = Array.from({ length: cols }, (_, m) => {
    const have = cohorts.filter((c) => c.retention.length > m);
    const w = have.reduce((s, c) => s + c.ftds, 0);
    const src = (c: AnlCohort) => (mode === "retention" ? c.retention[m]! : c.ltv[m]!);
    return w ? have.reduce((s, c) => s + src(c) * c.ftds, 0) / w : 0;
  });

  const cell = (v: number, m: number) => {
    const t = mode === "retention" ? (m === 0 ? 1 : Math.min(1, v / 60)) : (v - minLtv) / (maxLtv - minLtv || 1);
    return { bg: heat(t), dark: t > 0.62 };
  };
  const fmt = (v: number) => (mode === "retention" ? `${v.toFixed(v >= 99.5 ? 0 : 1)}%` : `$${formatNumber(v, 0)}`);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[980px]" onMouseLeave={() => setHover(null)}>
        <div className="grid gap-1" style={{ gridTemplateColumns: `112px 72px repeat(${cols}, minmax(0, 1fr))` }}>
          <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.05em] text-fg-3">Cohort</div>
          <div className="px-2 pb-2 text-right text-[11px] font-medium uppercase tracking-[0.05em] text-fg-3">FTDs</div>
          {Array.from({ length: cols }, (_, m) => (
            <div key={m} className={cn("pb-2 text-center text-[11px] font-medium uppercase tracking-[0.05em] transition-colors", hover?.c === m ? "text-fg" : "text-fg-3")}>
              M{m}
            </div>
          ))}
          {cohorts.map((c, r) => (
            <React.Fragment key={c.key}>
              <div className={cn("flex items-center px-2 text-[13px] font-medium transition-colors", hover?.r === r ? "text-fg" : "text-fg-2")}>{c.month}</div>
              <div className="k-num flex items-center justify-end px-2 text-[12.5px] text-fg-3">{formatNumber(c.ftds, 0)}</div>
              {Array.from({ length: cols }, (_, m) => {
                const has = m < c.retention.length;
                if (!has) return <div key={m} className="h-9 rounded-[9px] border border-dashed border-line/60" />;
                const v = mode === "retention" ? c.retention[m]! : c.ltv[m]!;
                const { bg, dark } = cell(v, m);
                const on = hover && (hover.r === r || hover.c === m);
                return (
                  <motion.div
                    key={m}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: (r + m) * 0.018 }}
                    onMouseEnter={() => setHover({ r, c: m })}
                    className={cn(
                      "k-num grid h-9 cursor-default place-items-center rounded-[9px] text-[11.5px] font-medium transition-[filter,box-shadow]",
                      dark ? "text-[#1a1204]" : "text-fg",
                      hover && !on && "brightness-[0.7]",
                      hover?.r === r && hover.c === m && "ring-1 ring-white/60 shadow-[0_0_24px_-4px_rgba(233,185,73,0.7)]",
                    )}
                    style={{ background: bg }}
                    title={`${c.month} · M${m}: ${fmt(v)}`}
                  >
                    {fmt(v)}
                  </motion.div>
                );
              })}
            </React.Fragment>
          ))}
          <div className="mt-2 flex items-center border-t border-line px-2 pt-3 text-[12px] font-semibold text-fg">Weighted avg</div>
          <div className="k-num mt-2 flex items-center justify-end border-t border-line px-2 pt-3 text-[12px] text-fg-2">{formatNumber(cohorts.reduce((s, c) => s + c.ftds, 0), 0)}</div>
          {avg.map((v, m) => (
            <div key={m} className="mt-2 border-t border-line pt-3">
              <div className="k-num grid h-8 place-items-center rounded-[9px] border border-line bg-surface-2 text-[11.5px] font-semibold text-gold">{fmt(v)}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-3 text-[11px] text-fg-3">
          <span>{mode === "retention" ? "Low retention" : "Low LTV"}</span>
          <div className="flex h-2 w-40 overflow-hidden rounded-full">
            {Array.from({ length: 20 }, (_, i) => (
              <span key={i} className="flex-1" style={{ background: heat(i / 19) }} />
            ))}
          </div>
          <span>{mode === "retention" ? "High" : "High"}</span>
        </div>
      </div>
    </div>
  );
}
