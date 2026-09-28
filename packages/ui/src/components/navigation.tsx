"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "../lib/cn";

/** Segmented pill control (1D / 1W / 1M …) with a sliding active background. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
  className,
}: {
  options: readonly (T | { value: T; label: React.ReactNode })[];
  value: T;
  onChange: (v: T) => void;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const id = React.useId();
  const h = size === "xs" ? "h-7 text-[11px] px-2.5" : size === "md" ? "h-10 text-sm px-4" : "h-8 text-xs px-3";
  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-full border border-line bg-surface-2 p-1", className)}>
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        const on = v === value;
        return (
          <button key={v} type="button" onClick={() => onChange(v)} className={cn("relative rounded-full font-medium transition-colors", h, on ? "text-fg" : "text-fg-3 hover:text-fg-2")}>
            {on && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full border border-line bg-surface-3 shadow-[inset_0_1px_0_var(--k-border-top)]" transition={{ type: "spring", bounce: 0.18, duration: 0.45 }} />}
            <span className="relative inline-flex items-center gap-1.5">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Underline tabs for in-card sections. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: readonly { value: T; label: React.ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const id = React.useId();
  return (
    <div className={cn("flex items-center gap-6 border-b border-line", className)}>
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button key={t.value} type="button" onClick={() => onChange(t.value)} className={cn("relative -mb-px flex items-center gap-2 pb-3 text-sm font-medium transition-colors", on ? "text-fg" : "text-fg-3 hover:text-fg-2")}>
            {t.label}
            {t.count !== undefined && <span className={cn("rounded-full px-1.5 text-[11px] k-num", on ? "bg-ember-soft text-ember" : "bg-surface-3 text-fg-3")}>{t.count}</span>}
            {on && <motion.span layoutId={`tab-${id}`} className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-ember" />}
          </button>
        );
      })}
    </div>
  );
}

/** Stepper for wizards (open account, KYC, withdrawal). */
export function Stepper({ steps, current, className }: { steps: string[]; current: number; className?: string }) {
  return (
    <ol className={cn("flex items-center gap-3", className)}>
      {steps.map((s, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <li key={s} className="flex flex-1 items-center gap-3">
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold k-num transition-colors",
                done && "border-up/40 bg-up-soft text-up",
                on && "border-ember/50 bg-ember-soft text-ember shadow-[0_0_20px_-4px_rgba(255,90,31,0.6)]",
                !done && !on && "border-line text-fg-3",
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={2.5} /> : i + 1}
            </span>
            <span className={cn("hidden text-[13px] font-medium md:inline", on ? "text-fg" : "text-fg-3")}>{s}</span>
            {i < steps.length - 1 && <span className={cn("h-px flex-1", done ? "bg-up/40" : "bg-line")} />}
          </li>
        );
      })}
    </ol>
  );
}
