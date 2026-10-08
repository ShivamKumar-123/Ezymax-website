"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@ezymex/ui";

const GRAD: Record<string, string> = {
  ember: "linear-gradient(90deg, rgba(255,90,31,.35), var(--k-ember))",
  gold: "linear-gradient(90deg, rgba(233,185,73,.3), var(--k-gold))",
  up: "linear-gradient(90deg, rgba(34,197,94,.3), var(--k-up))",
  down: "linear-gradient(90deg, rgba(240,68,56,.3), var(--k-down))",
  info: "linear-gradient(90deg, rgba(56,189,248,.3), var(--k-info))",
  mix: "linear-gradient(90deg, var(--k-ember), var(--k-gold))",
};

/** Thin gradient heat bar with a glowing tip. */
export function Meter({ value, max, tone = "ember", className, height = 6, delay = 0 }: { value: number; max: number; tone?: keyof typeof GRAD; className?: string; height?: number; delay?: number }) {
  const pct = Math.max(0, Math.min(100, (Math.abs(value) / (max || 1)) * 100));
  return (
    <div className={cn("relative w-full overflow-hidden rounded-full bg-surface-3", className)} style={{ height }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: GRAD[tone] }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

/** Two-sided bar centred on zero (e.g. broker P&L per symbol). */
export function SplitMeter({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = Math.min(50, (Math.abs(value) / (max || 1)) * 50);
  const pos = value >= 0;
  return (
    <div className={cn("relative h-1.5 w-full rounded-full bg-surface-3", className)}>
      <span className="absolute left-1/2 top-[-3px] h-3 w-px bg-fg-3/70" />
      <motion.span
        className={cn("absolute top-0 h-full rounded-full", pos ? "bg-gradient-to-r from-up/40 to-up" : "bg-gradient-to-l from-down/40 to-down")}
        style={pos ? { left: "50%" } : { right: "50%" }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}

/** Small label/value tile used inside cards. */
export function MiniStat({ label, value, sub, className }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("k-row min-w-0 px-4 py-3", className)}>
      <div className="truncate text-[11px] uppercase tracking-wider text-fg-3">{label}</div>
      <div className="k-num mt-1 truncate text-[16px] font-medium text-fg">{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11.5px] text-fg-3">{sub}</div>}
    </div>
  );
}

/** Colour for a 0..1 intensity on the ember→gold ramp (heatmaps). */
export function heat(t: number) {
  const c = Math.max(0, Math.min(1, t));
  return `color-mix(in oklab, color-mix(in oklab, var(--k-gold) ${Math.round(c * 100)}%, var(--k-ember)) ${Math.round(12 + c * 78)}%, var(--k-surface-2))`;
}
