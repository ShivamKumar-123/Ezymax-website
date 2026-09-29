"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn, formatCompact, formatMoney } from "@kalks/ui";
import { tr } from "@kalks/i18n/react";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const fmtDate = (t: number) => new Date(t * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" });

function niceTicks(min: number, max: number, n = 4) {
  const span = max - min || 1;
  return Array.from({ length: n + 1 }, (_, i) => min + (span * i) / n);
}

/* ------------------------------------------------------------------ */
/* Multi-line chart (equity vs balance)                                */
/* ------------------------------------------------------------------ */

export interface LineSeries {
  key: string;
  label: string;
  color: string; // css color / var
  dashed?: boolean;
  fill?: boolean;
  values: number[];
}

export function MultiLineChart({ times, series, height = 280, className, format = (v: number) => formatMoney(v, "USD", 0) }: { times: number[]; series: LineSeries[]; height?: number; className?: string; format?: (v: number) => string }) {
  const id = React.useId().replace(/:/g, "");
  const [hover, setHover] = React.useState<number | null>(null);
  const all = series.flatMap((s) => s.values);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo) * 0.08;
  const min = lo - pad;
  const max = hi + pad;
  const W = 1000;
  const H = 100;
  const n = times.length;
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const ticks = niceTicks(min, max, 4);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  return (
    <div className={cn("relative select-none", className)} style={{ height }}>
      <div className="k-dotgrid absolute inset-0 right-14 rounded-xl opacity-70" />
      <div className="absolute inset-y-0 left-0 right-14" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-x-0 top-3 bottom-6 h-[calc(100%-36px)] w-full overflow-visible">
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${id}${s.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity="0.22" />
                <stop offset="1" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((t) => (
            <line key={t} x1={0} x2={W} y1={y(t)} y2={y(t)} stroke="var(--k-border)" vectorEffect="non-scaling-stroke" />
          ))}
          {series.map((s) => {
            const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(2)}`).join(" ");
            return (
              <g key={s.key}>
                {s.fill && <path d={`${d} L${W},${H} L0,${H} Z`} fill={`url(#${id}${s.key})`} />}
                <motion.path
                  d={d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.dashed ? 1.4 : 2}
                  strokeDasharray={s.dashed ? "5 4" : undefined}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.1, ease: "easeOut" }}
                />
              </g>
            );
          })}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="var(--k-fg-2)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
        </svg>
        {hover !== null && (
          <>
            {series.map((s) => (
              <span
                key={s.key}
                className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-bg"
                style={{ left: `${(hover / (n - 1)) * 100}%`, top: `calc(12px + (100% - 36px) * ${(y(s.values[hover]!) / H).toFixed(4)})`, borderColor: s.color }}
              />
            ))}
            <div
              className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-xl border border-line bg-surface-3/95 px-3 py-2 text-xs shadow-xl backdrop-blur"
              style={hover / (n - 1) > 0.6 ? { right: `${(1 - hover / (n - 1)) * 100 + 2}%` } : { left: `${(hover / (n - 1)) * 100 + 2}%` }}
            >
              <div className="mb-1 font-mono text-[11px] text-fg-3">{fmtDate(times[hover]!)}</div>
              {series.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-fg-2">
                    <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                    {s.label}
                  </span>
                  <span className="k-num font-medium text-fg">{format(s.values[hover]!)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 top-3 bottom-6 w-14">
        {ticks.map((t) => (
          <span key={t} className="k-num absolute right-0 -translate-y-1/2 font-mono text-[10.5px] text-fg-3" style={{ top: `${(y(t) / H) * 100}%` }}>
            {formatCompact(t)}
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 right-14 flex justify-between font-mono text-[10.5px] text-fg-3">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <span key={f}>{fmtDate(times[Math.round(f * (n - 1))]!)}</span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Drawdown (red area hanging from 0)                                  */
/* ------------------------------------------------------------------ */

export function DrawdownChart({ times, values, height = 160, className }: { times: number[]; values: number[]; height?: number; className?: string }) {
  const id = React.useId().replace(/:/g, "");
  const [hover, setHover] = React.useState<number | null>(null);
  const W = 1000;
  const H = 100;
  const n = values.length;
  const min = Math.min(...values, -1) * 1.1;
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => (v / min) * H;
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(2)}`).join(" ");
  const worst = values.indexOf(Math.min(...values));
  const ticks = [0, min / 2, min];
  return (
    <div className={cn("relative select-none", className)} style={{ height }}>
      <div
        className="absolute inset-y-0 left-0 right-12"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
        }}
        onMouseLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-x-0 top-1 bottom-5 h-[calc(100%-24px)] w-full overflow-visible">
          <defs>
            <linearGradient id={`dd${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--k-down)" stopOpacity="0.05" />
              <stop offset="1" stopColor="var(--k-down)" stopOpacity="0.45" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <line key={t} x1={0} x2={W} y1={y(t)} y2={y(t)} stroke="var(--k-border)" vectorEffect="non-scaling-stroke" />
          ))}
          <motion.path d={`${d} L${W},0 L0,0 Z`} fill={`url(#dd${id})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
          <motion.path d={d} fill="none" stroke="var(--k-down)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: "easeOut" }} />
          <line x1={x(hover ?? worst)} x2={x(hover ?? worst)} y1={0} y2={H} stroke={hover === null ? "var(--k-down)" : "var(--k-fg-2)"} strokeOpacity={hover === null ? 0.5 : 1} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
        </svg>
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-line bg-surface-3/95 px-2.5 py-1.5 text-[11px] shadow-xl"
          style={{ top: `${Math.min(52, (y(values[hover ?? worst]!) / H) * 100)}%`, ...((hover ?? worst) / (n - 1) > 0.6 ? { right: `${(1 - (hover ?? worst) / (n - 1)) * 100 + 1.5}%` } : { left: `${((hover ?? worst) / (n - 1)) * 100 + 1.5}%` }) }}
        >
          <div className="font-mono text-fg-3">{hover === null ? tr("portfolio.an.kpi.maxDrawdown") : fmtDate(times[hover]!)}</div>
          <div className="k-num font-semibold text-down">{values[hover ?? worst]!.toFixed(2)}%</div>
        </div>
      </div>
      <div className="pointer-events-none absolute right-0 top-1 bottom-5 w-12">
        {ticks.map((t) => (
          <span key={t} className="k-num absolute right-0 -translate-y-1/2 font-mono text-[10.5px] text-fg-3" style={{ top: `${(y(t) / H) * 100}%` }}>
            {t.toFixed(1)}%
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 right-12 flex justify-between font-mono text-[10.5px] text-fg-3">
        {[0, 0.5, 1].map((f) => (
          <span key={f}>{fmtDate(times[Math.round(f * (n - 1))]!)}</span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Horizontal P&L bars (by symbol)                                     */
/* ------------------------------------------------------------------ */

export function PnlBars({ rows, className }: { rows: { label: React.ReactNode; key: string; value: number; sub?: React.ReactNode }[]; className?: string }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <div className={cn("space-y-2", className)}>
      {rows.map((r, i) => {
        const pct = (Math.abs(r.value) / max) * 50;
        const up = r.value >= 0;
        return (
          <div key={r.key} className="grid grid-cols-[minmax(0,130px)_1fr_76px] items-center gap-3 sm:grid-cols-[minmax(0,160px)_1fr_90px]">
            <div className="min-w-0">{r.label}</div>
            <div className="relative h-6">
              <span className="absolute left-1/2 top-0 h-full w-px bg-line" />
              <motion.span
                className={cn("absolute top-1 h-4 rounded-full", up ? "bg-gradient-to-r from-up/40 to-up" : "bg-gradient-to-l from-down/40 to-down")}
                style={up ? { left: "50%" } : { right: "50%" }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <div className={cn("k-num text-right text-[13px] font-medium", up ? "text-up" : "text-down")}>
              {up ? "+" : "-"}
              {formatMoney(Math.abs(r.value), "USD", 0).replace("-", "")}
              {r.sub && <div className="text-[10.5px] font-normal text-fg-3">{r.sub}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vertical +/- columns (by weekday / release history)                 */
/* ------------------------------------------------------------------ */

export function ColumnBars({
  data,
  height = 180,
  className,
  format = (v: number) => formatMoney(v, "USD", 0),
  tone,
  fit,
}: {
  data: { label: string; value: number; sub?: string }[];
  height?: number;
  className?: string;
  format?: (v: number) => string;
  tone?: "gold" | "sign";
  /** Scale bars to the data range instead of from zero (when all values share a sign). */
  fit?: boolean;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const vals = data.map((d) => d.value);
  const allPos = vals.every((v) => v > 0);
  const floor = fit && allPos ? Math.min(...vals) - (Math.max(...vals) - Math.min(...vals) || Math.max(...vals)) * 0.35 : 0;
  const shown = data.map((d) => ({ ...d, raw: d.value, value: d.value - floor }));
  const max = Math.max(...shown.map((d) => Math.max(0, d.value)), 0);
  const min = Math.min(...shown.map((d) => Math.min(0, d.value)), 0);
  const span = max - min || 1;
  const zero = (max / span) * 100;
  return (
    <div className={cn("relative", className)} style={{ height }}>
      <div className="absolute inset-x-0 top-5 bottom-6">
        <span className="absolute inset-x-0 h-px bg-line" style={{ top: `${zero}%` }} />
        <div className="absolute inset-0 flex items-stretch gap-2">
          {shown.map((d, i) => {
            const h = (Math.abs(d.value) / span) * 100;
            const up = d.value >= 0;
            const on = hover === i;
            const color = tone === "gold" ? (i === data.length - 1 ? "bg-gradient-to-b from-[#ff8a3d] to-[#c2360f]" : "bg-gradient-to-b from-gold/80 to-gold/30") : up ? "bg-gradient-to-b from-up to-up/35" : "bg-gradient-to-t from-down to-down/35";
            return (
              <div key={d.label + i} className="relative flex-1" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <motion.span
                  className={cn("absolute inset-x-[12%] mx-auto max-w-10 rounded-md", up ? "rounded-b-sm" : "rounded-t-sm", color, on && "brightness-125")}
                  style={up ? { bottom: `${100 - zero}%` } : { top: `${zero}%` }}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(h, 1.5)}%` }}
                  transition={{ duration: 0.7, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                />
                {on && (
                  <span
                    className="k-num pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-line bg-surface-3 px-2 py-0.5 text-[11px] font-medium shadow-lg"
                    style={up ? { bottom: `calc(${100 - zero + h}% + 4px)` } : { top: `calc(${zero + h}% + 4px)` }}
                  >
                    {format(d.raw)}
                    {d.sub && <span className="ml-1 text-fg-3">{d.sub}</span>}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex gap-2">
        {data.map((d, i) => (
          <span key={d.label + i} className={cn("flex-1 truncate text-center text-[11px]", hover === i ? "text-fg" : "text-fg-3")}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Weekday × hour heatmap                                              */
/* ------------------------------------------------------------------ */

export function HourHeatmap({ rows, className }: { rows: { day: string; cells: { pnl: number; trades: number }[] }[]; className?: string }) {
  const [hover, setHover] = React.useState<{ d: number; h: number } | null>(null);
  const max = Math.max(...rows.flatMap((r) => r.cells.map((c) => Math.abs(c.pnl))), 1);
  const cell = hover ? rows[hover.d]!.cells[hover.h]! : null;
  return (
    <div className={cn("min-w-0", className)}>
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-[3px]">
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="k-num text-center font-mono text-[9.5px] text-fg-3">
                {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
              </span>
            ))}
            {rows.map((r, d) => (
              <React.Fragment key={r.day}>
                <span className="self-center text-[11px] text-fg-3">{r.day}</span>
                {r.cells.map((c, h) => {
                  const a = Math.min(1, Math.abs(c.pnl) / max);
                  const bg = c.trades === 0 ? "var(--k-surface-2)" : c.pnl >= 0 ? `color-mix(in oklab, var(--k-up) ${Math.round(12 + a * 78)}%, var(--k-surface-2))` : `color-mix(in oklab, var(--k-down) ${Math.round(12 + a * 78)}%, var(--k-surface-2))`;
                  const on = hover?.d === d && hover?.h === h;
                  return (
                    <motion.span
                      key={h}
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: (d * 24 + h) * 0.0025 }}
                      onMouseEnter={() => setHover({ d, h })}
                      onMouseLeave={() => setHover(null)}
                      className={cn("aspect-square cursor-crosshair rounded-[5px] border border-line/60", on && "ring-2 ring-fg/60")}
                      style={{ background: bg }}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11.5px] text-fg-3">
        <div className="k-num h-5">
          {hover && cell ? (
            <span>
              <span className="text-fg-2">{rows[hover.d]!.day} {String(hover.h).padStart(2, "0")}:00–{String(hover.h + 1).padStart(2, "0")}:00</span> · {tr("portfolio.trades", { count: cell.trades })} ·{" "}
              <span className={cell.pnl >= 0 ? "text-up" : "text-down"}>{cell.pnl >= 0 ? "+" : "-"}{formatMoney(Math.abs(cell.pnl))}</span>
            </span>
          ) : (
            tr("portfolio.chart.hoverHint")
          )}
        </div>
        <div className="flex items-center gap-2">
          <span>{tr("common.loss")}</span>
          <span className="h-2 w-24 rounded-full" style={{ background: "linear-gradient(90deg, var(--k-down), var(--k-surface-3), var(--k-up))" }} />
          <span>{tr("common.profit")}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Money-flow waterfall                                                */
/* ------------------------------------------------------------------ */

export function Waterfall({ steps, height = 240, className }: { steps: { label: string; value: number; total?: boolean }[]; height?: number; className?: string }) {
  let run = 0;
  const bars = steps.map((s) => {
    if (s.total) {
      const b = { ...s, from: 0, to: run };
      return b;
    }
    const from = run;
    run += s.value;
    return { ...s, from, to: run };
  });
  const max = Math.max(...bars.map((b) => Math.max(b.from, b.to)));
  return (
    <div className={cn("relative", className)} style={{ height }}>
      <div className="absolute inset-x-0 top-6 bottom-10 flex gap-2 sm:gap-3">
        {bars.map((b, i) => {
          const lo = Math.min(b.from, b.to);
          const hi = Math.max(b.from, b.to);
          const up = b.total || b.to >= b.from;
          return (
            <div key={b.label} className="relative flex-1">
              {i > 0 && <span className="absolute -left-2 h-px w-2 border-t border-dashed border-fg-3/50 sm:-left-3 sm:w-3" style={{ bottom: `${(b.from / max) * 100}%` }} />}
              <motion.div
                className={cn(
                  "absolute inset-x-0 mx-auto max-w-16 rounded-lg border",
                  b.total ? "border-gold/40 bg-gradient-to-b from-gold to-gold/40 shadow-[0_0_30px_-8px_var(--k-gold)]" : up ? "border-up/30 bg-gradient-to-b from-up to-up/40" : "border-down/30 bg-gradient-to-t from-down to-down/40",
                )}
                style={{ bottom: `${(lo / max) * 100}%` }}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: `${Math.max(((hi - lo) / max) * 100, 1)}%`, opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.1 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              />
              <span className={cn("k-num absolute inset-x-[-6px] text-center text-[9.5px] font-semibold sm:text-[11.5px]", b.total ? "text-gold" : up ? "text-up" : "text-down")} style={{ bottom: `calc(${(hi / max) * 100}% + 4px)` }}>
                {b.total ? "" : b.value >= 0 ? "+" : "-"}${formatCompact(Math.abs(b.total ? b.to : b.value))}
              </span>
            </div>
          );
        })}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex h-9 gap-2 sm:gap-3">
        {bars.map((b) => (
          <span key={b.label} className="flex-1 text-center text-[11px] leading-tight text-fg-3">
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
