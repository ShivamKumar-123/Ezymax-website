"use client";

// Client Area segmented control (selected option filled with the brand colour), underline text tabs and the
// wizard stepper, in the pastel dashboard language. Same props as the @ezymex/ui versions.

import * as React from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@ezymex/ui";

/** Segmented pill control: a soft white track, the selected option filled with the accent colour. */
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
  const h = size === "xs" ? "h-7 text-[11.5px] px-2.5 rounded-[9px]" : size === "md" ? "h-10 text-[13.5px] px-4 rounded-[12px]" : "h-8 text-[12.5px] px-3 rounded-[10px]";
  return (
    <div role="tablist" className={cn("k-seg inline-flex max-w-full items-center gap-0.5 overflow-x-auto p-1 [scrollbar-width:none]", size === "md" ? "rounded-[15px]" : "rounded-[13px]", className)}>
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(v)}
            className={cn("k-hit relative shrink-0 font-semibold whitespace-nowrap transition-colors", h, on ? "text-[var(--k-on-ember)]" : "text-fg-3 hover:text-fg")}
          >
            {on && <motion.span layoutId={`seg-${id}`} className={cn("k-seg-on absolute inset-0", h.split(" ").find((c) => c.startsWith("rounded")))} transition={{ type: "spring", bounce: 0.16, duration: 0.42 }} />}
            <span className="relative inline-flex items-center gap-1.5 [&_.text-fg-3]:opacity-70 [&_.text-fg-3]:!text-current">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Underline text tabs (Weekly · Monthly · Last year) for in-card sections. */
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
    <div role="tablist" className={cn("flex items-center gap-6 overflow-x-auto border-b border-line [scrollbar-width:none]", className)}>
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={cn("k-hit relative -mb-px flex shrink-0 items-center gap-2 whitespace-nowrap pb-3 pt-1 text-[14px] font-semibold transition-colors", on ? "text-fg" : "text-fg-3 hover:text-fg-2")}
          >
            {t.label}
            {t.count !== undefined && <span className={cn("k-num rounded-full px-1.5 text-[11px]", on ? "bg-ember-soft text-ember" : "bg-surface-3 text-fg-3")}>{t.count}</span>}
            {on && <motion.span layoutId={`tab-${id}`} className="absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-ember" />}
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
                "k-num grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors",
                done && "bg-up-soft text-up",
                on && "bg-ember text-[var(--k-on-ember)] shadow-[0_8px_20px_-8px_var(--k-ember)]",
                !done && !on && "bg-surface-3 text-fg-3",
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={2.5} /> : i + 1}
            </span>
            <span className={cn("hidden text-[13px] font-semibold md:inline", on ? "text-fg" : "text-fg-3")}>{s}</span>
            {i < steps.length - 1 && <span className={cn("h-0.5 flex-1 rounded-full", done ? "bg-up/40" : "bg-surface-3")} />}
          </li>
        );
      })}
    </ol>
  );
}
