"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/components/kit";

/** Ember range slider with filled track and optional tick labels. Shared by partner + social modules. */
export function RangeSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  ticks,
  format,
  tone = "ember",
  className,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  ticks?: number[];
  format?: (v: number) => string;
  tone?: "ember" | "gold" | "up" | "down";
  className?: string;
  label?: string;
}) {
  const pct = ((value - min) / (max - min || 1)) * 100;
  const color = `var(--k-${tone})`;
  return (
    <div className={cn("w-full", className)}>
      <div className="relative h-6">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-3">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, color-mix(in oklab, ${color} 55%, transparent), ${color})` }} />
        </div>
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(+e.target.value)}
          className={cn(
            "relative z-10 block h-6 w-full cursor-pointer appearance-none bg-transparent outline-none",
            "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent",
            "[&::-webkit-slider-thumb]:-mt-[7px] [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[var(--thumb)] [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_color-mix(in_oklab,var(--k-ember)_18%,transparent),0_4px_12px_rgba(0,0,0,0.5)]",
            "[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[var(--thumb)]",
            "focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-ember/30",
          )}
          style={{ ["--thumb" as string]: color }}
        />
      </div>
      {ticks && (
        <div className="relative mt-1 h-4 text-[10.5px] text-fg-3 k-num">
          {ticks.map((t, i) => {
            const p = ((t - min) / (max - min || 1)) * 100;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onChange(t)}
                className={cn("absolute top-0 whitespace-nowrap hover:text-fg-2", t === value && "text-fg")}
                style={{ left: `${p}%`, transform: i === 0 && p < 5 ? "none" : i === ticks.length - 1 && p > 95 ? "translateX(-100%)" : "translateX(-50%)" }}
              >
                {format ? format(t) : t}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Checkbox({ checked, onChange, children, className }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 text-[13px] text-fg-2", className)}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-md border transition-colors",
          checked ? "border-ember bg-ember text-white" : "border-line bg-surface-2 hover:border-fg-3",
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </button>
      <span onClick={() => onChange(!checked)}>{children}</span>
    </label>
  );
}

/** Selectable card used for radio-style choices (sizing mode, program type…). */
export function RadioCard({
  selected,
  onSelect,
  title,
  text,
  icon,
  badge,
  children,
  className,
}: {
  selected: boolean;
  onSelect: () => void;
  title: React.ReactNode;
  text?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "relative flex w-full flex-col gap-1.5 rounded-[16px] border p-4 text-left transition-all",
        selected ? "border-ember/50 bg-ember-soft shadow-[0_0_0_4px_color-mix(in_oklab,var(--k-ember)_8%,transparent)]" : "border-line bg-surface-2 hover:border-[var(--k-border-top)] hover:bg-surface-3/60",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {icon && <span className={cn("grid size-9 shrink-0 place-items-center rounded-full border [&_svg]:size-4", selected ? "border-ember/40 bg-ember/15 text-ember" : "border-line bg-surface-3 text-fg-2")}>{icon}</span>}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[14px] font-medium text-fg">
            {title}
            {badge}
          </div>
          {text && <div className="mt-0.5 text-[12.5px] leading-snug text-fg-3">{text}</div>}
        </div>
        <span className={cn("mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border", selected ? "border-ember" : "border-fg-3/60")}>
          {selected && <span className="size-2.5 rounded-full bg-ember" />}
        </span>
      </div>
      {children}
    </button>
  );
}

/** Toggleable chip for multi-select (excluded symbols, filters). */
export function ToggleChip({ on, onClick, children, tone = "ember" }: { on: boolean; onClick: () => void; children: React.ReactNode; tone?: "ember" | "down" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors",
        on ? (tone === "down" ? "border-down/40 bg-down-soft text-down" : "border-ember/40 bg-ember-soft text-ember") : "border-line bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
