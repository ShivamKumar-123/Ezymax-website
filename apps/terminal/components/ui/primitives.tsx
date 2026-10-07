"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, X } from "lucide-react";
import { cn, useRolling, useTick, useTickGlow } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";

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
  actions,
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
  /** extra header buttons, left of the close button */
  actions?: React.ReactNode;
}) {
  const t = useT();
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
  // Portaled out of the terminal root, so it repeats dir="ltr": terminal dialogs keep the LTR layout in
  // Arabic/Urdu/Persian too (see desktop.tsx); translated text still shapes correctly inside.
  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center p-3" role="dialog" aria-modal dir="ltr">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-[t-fade_.12s_ease-out]" onMouseDown={onClose} />
      <div
        className={cn("t-pop t-glass-strong relative flex max-h-[calc(100dvh-24px)] w-full flex-col overflow-hidden rounded-[16px] border border-line-top shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]", className)}
        style={{ maxWidth: width }}
        aria-label={typeof title === "string" ? title : undefined}
      >
        <div className="flex min-h-11 shrink-0 items-center gap-2.5 border-b border-line ps-3.5 pe-1.5">
          {icon && <span className="grid size-7 shrink-0 place-items-center rounded-[7px] bg-ember-soft text-accent-text [&>svg]:size-3.5">{icon}</span>}
          <div className="min-w-0 flex-1 py-1.5">
            <div className="truncate text-[14px] font-semibold text-fg">{title}</div>
            {subtitle && <div className="truncate text-[12px] text-fg-3">{subtitle}</div>}
          </div>
          {actions}
          <button onClick={onClose} aria-label={t("common.close")} title={`${t("common.close")} (Esc)`} className="grid size-7 place-items-center rounded-[7px] text-fg-2 hover:bg-surface-3 hover:text-fg">
            <X className="size-4" />
          </button>
        </div>
        <div className="t-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-3.5 py-2.5">{footer}</div>}
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
        "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ember/50 disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-3.5 [&_svg]:shrink-0",
        size === "xs" && "h-6 px-2 text-[12px]",
        size === "sm" && "h-7 px-2.5 text-[12.5px]",
        size === "md" && "h-8 px-3 text-[13px]",
        variant === "ember" && "bg-accent-strong font-semibold text-white hover:brightness-110",
        variant === "surface" && "border border-line bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg",
        variant === "outline" && "border border-line text-fg-2 hover:border-fg-3/50 hover:text-fg",
        variant === "ghost" && "text-fg-2 hover:bg-surface-3 hover:text-fg",
        variant === "buy" && "bg-buy-fill text-white hover:brightness-110",
        variant === "sell" && "bg-sell-fill text-white hover:brightness-110",
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
        "grid size-7 shrink-0 place-items-center rounded-[7px] text-fg-2 transition-colors hover:bg-surface-3 hover:text-fg [&_svg]:size-4",
        active && "bg-ember-soft text-accent-text hover:bg-ember-soft hover:text-accent-text",
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
        "h-7 w-full min-w-0 rounded-[7px] border border-line bg-panel-2 px-2.5 text-[13px] text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-ember/60",
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
  size = "sm",
  id,
  onCommit,
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
  /** sm 28 px (dense, phone lists), md 32 px, lg 40 px (the order panel) */
  size?: "sm" | "md" | "lg";
  id?: string;
  /** Enter pressed in the field */
  onCommit?: () => void;
}) {
  const t = useT();
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
        "flex items-center border border-line transition-colors focus-within:border-ember/60",
        size === "lg" ? "h-8 rounded-[8px] bg-panel-2" : size === "md" ? "h-7 rounded-[7px] bg-panel-2" : "h-7 rounded-[6px] bg-surface-2",
        tone === "up" && "focus-within:border-up/60",
        tone === "down" && "focus-within:border-down/60",
        className,
      )}
    >
      <button type="button" tabIndex={-1} onClick={() => bump(-1)} className={cn("grid h-full shrink-0 place-items-center text-fg-3 hover:text-fg", size === "sm" ? "w-6" : "w-7 rounded-s-[7px] hover:bg-surface-3")} aria-label={t("trader.stepper.decrease")}>
        <Minus className={size === "sm" ? "size-3" : "size-3.5"} />
      </button>
      <input
        id={id}
        aria-label={ariaLabel}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            bump(e.key === "ArrowUp" ? 1 : -1);
          } else if (e.key === "Enter") onCommit?.();
        }}
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        onWheel={(e) => {
          if (document.activeElement !== e.currentTarget) return;
          bump(e.deltaY < 0 ? 1 : -1);
        }}
        className={cn("k-num h-full w-full min-w-0 text-ellipsis bg-transparent text-center font-mono text-fg outline-none placeholder:font-sans placeholder:text-fg-3", size === "lg" ? "text-[14px] font-medium placeholder:text-[12.5px]" : size === "md" ? "text-[13px] placeholder:text-[12.5px]" : "text-[12px] placeholder:text-[11px]")}
      />
      <button type="button" tabIndex={-1} onClick={() => bump(1)} className={cn("grid h-full shrink-0 place-items-center text-fg-3 hover:text-fg", size === "sm" ? "w-6" : "w-7 rounded-e-[7px] hover:bg-surface-3")} aria-label={t("trader.stepper.increase")}>
        <Plus className={size === "sm" ? "size-3" : "size-3.5"} />
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
      className={cn("t-select h-7 w-full min-w-0 rounded-[7px] border border-line bg-panel-2 ps-2.5 pe-7 text-[13px] text-fg outline-none focus:border-ember/60", className)}
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
  return <span className={cn("inline-flex h-[18px] shrink-0 items-center rounded-[5px] border px-1.5 text-[11px] font-semibold uppercase tracking-[0.04em]", t, className)}>{children}</span>;
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
        {icon && <div className="mx-auto mb-2.5 grid size-10 place-items-center rounded-full border border-line bg-panel-2 text-fg-3 [&>svg]:size-[18px]">{icon}</div>}
        <div className="text-[13.5px] font-medium text-fg">{title}</div>
        {sub && <div className="mt-1 text-[12.5px] leading-[18px] text-fg-3">{sub}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}
