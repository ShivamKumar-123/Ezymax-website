"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, X } from "lucide-react";
import { cn, useRolling, useTick, useTickGlow } from "@kalks/ui";

/* ------------------------------------------------------------------ */
/* Dense modal dialog (Esc closes)                                     */
/* ------------------------------------------------------------------ */

export function TDialog({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  width = 520,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  className?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center p-3" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] animate-[t-fade_.12s_ease-out]" onMouseDown={onClose} />
      <div
        className={cn("t-pop relative flex max-h-[calc(100dvh-24px)] w-full flex-col overflow-hidden rounded-[10px] border border-line-top bg-panel shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]", className)}
        style={{ maxWidth: width }}
      >
        <div className="flex h-10 shrink-0 items-center gap-2.5 border-b border-line bg-panel-2 pl-3.5 pr-1.5">
          {icon && <span className="grid size-5 place-items-center text-ember [&>svg]:size-4">{icon}</span>}
          <div className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">
            {title}
            {subtitle && <span className="ml-2 font-normal text-fg-3">{subtitle}</span>}
          </div>
          <button onClick={onClose} aria-label="Close" className="grid size-7 place-items-center rounded-md text-fg-3 hover:bg-surface-3 hover:text-fg">
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-panel-2 px-3.5 py-2.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

export const TButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "ember" | "surface" | "ghost" | "buy" | "sell" | "outline"; size?: "xs" | "sm" | "md" }
>(function TButton({ className, variant = "surface", size = "sm", ...p }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ember/40 disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-3.5 [&_svg]:shrink-0",
        size === "xs" && "h-6 px-2 text-[11.5px]",
        size === "sm" && "h-7 px-2.5 text-[12px]",
        size === "md" && "h-9 px-3.5 text-[13px]",
        variant === "ember" && "bg-ember text-white hover:brightness-110",
        variant === "surface" && "border border-line bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg",
        variant === "outline" && "border border-line text-fg-2 hover:border-fg-3/50 hover:text-fg",
        variant === "ghost" && "text-fg-2 hover:bg-surface-3 hover:text-fg",
        variant === "buy" && "bg-up text-white hover:brightness-110",
        variant === "sell" && "bg-down text-white hover:brightness-110",
        className,
      )}
      {...p}
    />
  );
});

export function TIcon({
  className,
  active,
  label,
  children,
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-[5px] text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg [&_svg]:size-3.5",
        active && "bg-ember-soft text-ember hover:bg-ember-soft hover:text-ember",
        className,
      )}
      {...p}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export function TInput({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-7 w-full min-w-0 rounded-[6px] border border-line bg-surface-2 px-2 text-[12px] text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-ember/60",
        className,
      )}
      {...p}
    />
  );
}

export function Stepper({
  value,
  onChange,
  step,
  placeholder,
  className,
  tone,
  min,
  ariaLabel,
  decimals,
}: {
  value: string;
  onChange: (v: string) => void;
  step: number;
  placeholder?: string;
  className?: string;
  tone?: "up" | "down";
  min?: number;
  ariaLabel?: string;
  decimals?: number;
}) {
  const bump = (d: number) => {
    const n = parseFloat(value || placeholder || "0") || 0;
    let v = n + d * step;
    if (min !== undefined) v = Math.max(min, v);
    const dec = decimals ?? Math.max(0, Math.ceil(-Math.log10(step)));
    onChange(v.toFixed(dec));
  };
  return (
    <div
      className={cn(
        "flex h-7 items-center rounded-[6px] border border-line bg-surface-2 transition-colors focus-within:border-ember/60",
        tone === "up" && "focus-within:border-up/60",
        tone === "down" && "focus-within:border-down/60",
        className,
      )}
    >
      <button type="button" tabIndex={-1} onClick={() => bump(-1)} className="grid h-full w-6 shrink-0 place-items-center text-fg-3 hover:text-fg" aria-label="Decrease">
        <Minus className="size-3" />
      </button>
      <input
        aria-label={ariaLabel}
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        onWheel={(e) => {
          if (document.activeElement !== e.currentTarget) return;
          bump(e.deltaY < 0 ? 1 : -1);
        }}
        className="k-num h-full w-full min-w-0 bg-transparent text-center font-mono text-[12px] text-fg outline-none placeholder:text-fg-3/70"
      />
      <button type="button" tabIndex={-1} onClick={() => bump(1)} className="grid h-full w-6 shrink-0 place-items-center text-fg-3 hover:text-fg" aria-label="Increase">
        <Plus className="size-3" />
      </button>
    </div>
  );
}

export function TSelect<T extends string>({ value, onChange, options, className, ariaLabel }: { value: T; onChange: (v: T) => void; options: readonly (T | { value: T; label: string })[]; className?: string; ariaLabel?: string }) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn("t-select h-7 w-full min-w-0 rounded-[6px] border border-line bg-surface-2 pl-2 pr-6 text-[12px] text-fg outline-none focus:border-ember/60", className)}
    >
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o : o.label;
        return (
          <option key={v} value={v}>
            {l}
          </option>
        );
      })}
    </select>
  );
}

export function Check({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex cursor-pointer select-none items-center gap-2 text-[12px] text-fg-2", className)}>
      <span
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), onChange(!checked))}
        onClick={(e) => {
          e.preventDefault();
          onChange(!checked);
        }}
        className={cn("grid size-3.5 shrink-0 place-items-center rounded-[3px] border transition-colors", checked ? "border-ember bg-ember" : "border-fg-3/60 bg-surface-2")}
      >
        {checked && (
          <svg viewBox="0 0 10 10" className="size-2.5 fill-none stroke-white stroke-[1.8]">
            <path d="M2 5.2l2 2 4-4.4" />
          </svg>
        )}
      </span>
      <span onClick={() => onChange(!checked)}>{label}</span>
    </label>
  );
}

export function MiniSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-4 w-7 shrink-0 rounded-full transition-colors", checked ? "bg-ember" : "bg-surface-3 ring-1 ring-inset ring-line")}
    >
      <span className={cn("absolute top-0.5 size-3 rounded-full bg-white shadow transition-all", checked ? "left-[13px]" : "left-0.5")} />
    </button>
  );
}

export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "ember" | "gold" | "up" | "down" | "warn" | "info"; children: React.ReactNode; className?: string }) {
  const t = {
    neutral: "border-line bg-surface-3 text-fg-2",
    ember: "border-ember/35 bg-ember-soft text-ember",
    gold: "border-gold/35 bg-gold-soft text-gold",
    up: "border-up/30 bg-up-soft text-up",
    down: "border-down/30 bg-down-soft text-down",
    warn: "border-warn/30 bg-warn-soft text-warn",
    info: "border-info/30 bg-info-soft text-info",
  }[tone];
  return <span className={cn("inline-flex h-[18px] shrink-0 items-center rounded-[4px] border px-1.5 text-[10px] font-semibold uppercase tracking-[0.05em]", t, className)}>{children}</span>;
}

/** Profit number, coloured, with dimmed decimals. */
/**
 * Live P&L: rolls smoothly to each new value (when `format` is given), with a soft green/red glow and an
 * optional ▲▼ arrow. Nothing remounts per tick, so rapid updates stay smooth instead of flickering.
 */
export function Pnl({ value, className, text, format, arrow }: { value: number; className?: string; text: string; format?: (v: number) => string; arrow?: boolean }) {
  const t = useTick(value);
  const rolled = useRolling(value, 260);
  const glow = useTickGlow<HTMLSpanElement>(value, { strength: 12, duration: 800 });
  const shown = format ? format(rolled) : text;
  const [int, dec] = shown.split(".");
  return (
    <span ref={glow} className={cn("k-num inline-flex items-center gap-0.5 rounded-[3px] font-mono transition-colors duration-300", value > 0 ? "text-up" : value < 0 ? "text-down" : "text-fg-2", className)}>
      {arrow && (
        <span aria-hidden className={cn("w-[0.8em] text-[0.7em] leading-none transition-colors duration-300", t.dir === 1 ? "text-up" : t.dir === -1 ? "text-down" : "text-transparent")}>
          {t.dir === -1 ? "▼" : "▲"}
        </span>
      )}
      <span>
        {int}
        {dec !== undefined && <span className="opacity-60">.{dec}</span>}
      </span>
    </span>
  );
}

/** Any live account figure (equity, balance…): rolls smoothly to the new value with a soft glow on change. */
export function LiveMoney({ value, format, className }: { value: number; format: (v: number) => string; className?: string }) {
  const rolled = useRolling(value, 260);
  const glow = useTickGlow<HTMLSpanElement>(value, { strength: 12, duration: 800 });
  return (
    <span ref={glow} className={cn("k-num rounded-[3px]", className)}>
      {format(rolled)}
    </span>
  );
}

export function KV({ k, v, className }: { k: React.ReactNode; v: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-[3px] text-[12px]", className)}>
      <span className="text-fg-3">{k}</span>
      <span className="k-num min-w-0 truncate text-right font-mono text-fg-2">{v}</span>
    </div>
  );
}

export function Empty({ icon, title, sub, action }: { icon?: React.ReactNode; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="grid h-full min-h-24 place-items-center p-4 text-center">
      <div>
        {icon && <div className="mx-auto mb-2 grid size-8 place-items-center rounded-full border border-line text-fg-3 [&>svg]:size-4">{icon}</div>}
        <div className="text-[12.5px] text-fg-2">{title}</div>
        {sub && <div className="mt-0.5 text-[11.5px] text-fg-3">{sub}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}
