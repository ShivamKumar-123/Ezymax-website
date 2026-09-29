"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

export const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ember/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        ember: "k-ember-btn hover:brightness-110 active:brightness-95",
        surface: "bg-surface-2 text-fg border border-line shadow-[inset_0_1px_0_var(--k-border-top)] hover:bg-surface-3",
        ghost: "text-fg-2 hover:text-fg hover:bg-surface-3",
        outline: "border border-line text-fg hover:border-fg-3 hover:bg-surface-2",
        buy: "bg-up text-white hover:brightness-110 shadow-[0_8px_20px_-10px_var(--k-up)]",
        sell: "bg-down text-white hover:brightness-110 shadow-[0_8px_20px_-10px_var(--k-down)]",
        "up-outline": "border border-up/40 text-up bg-up-soft hover:bg-up/20",
        "down-outline": "border border-down/40 text-down bg-down-soft hover:bg-down/20",
        gold: "bg-gradient-to-br from-[#f3cf6b] to-[#c9971f] text-[#1a1204] hover:brightness-110",
      },
      size: {
        xs: "h-7 px-3 text-xs",
        sm: "h-8 px-3.5 text-[13px]",
        md: "h-10 px-4.5 text-sm",
        lg: "h-11 px-6 text-sm",
        xl: "h-13 px-7 text-[15px]",
      },
    },
    defaultVariants: { variant: "surface", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Accepted for compatibility; renders nothing (the UI has no decorative looping motion). */
  shimmer?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, shimmer: _shimmer, children, ...props },
  ref,
) {
  return (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </button>
  );
});

/* ------------------------------------------------------------------ */
/* Round icon button                                                   */
/* ------------------------------------------------------------------ */

export const IconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: "sm" | "md" | "lg"; active?: boolean; dot?: boolean }
>(function IconButton({ className, size = "md", active, dot, children, ...props }, ref) {
  const s = size === "sm" ? "size-8 [&_svg]:size-3.5" : size === "lg" ? "size-11 [&_svg]:size-[18px]" : "size-10 [&_svg]:size-4";
  return (
    <button
      ref={ref}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-surface/70 text-fg-2 shadow-[inset_0_1px_0_var(--k-border-top)] transition-colors hover:bg-surface-3 hover:text-fg focus-visible:ring-2 focus-visible:ring-ember/50 outline-none",
        active && "border-ember/30 bg-ember-soft text-ember",
        s,
        className,
      )}
      {...props}
    >
      {children}
      {dot && <span className="absolute right-2 top-2 size-2 rounded-full bg-ember ring-2 ring-bg" />}
    </button>
  );
});

/* ------------------------------------------------------------------ */
/* Pills / chips                                                       */
/* ------------------------------------------------------------------ */

const chipTone = {
  neutral: "bg-surface-3 text-fg-2 border-line",
  up: "bg-up-soft text-up border-up/25",
  down: "bg-down-soft text-down border-down/25",
  ember: "bg-ember-soft text-ember border-ember/30",
  gold: "bg-gold-soft text-gold border-gold/30",
  warn: "bg-warn-soft text-warn border-warn/25",
  info: "bg-info-soft text-info border-info/25",
  solid: "bg-fg text-bg border-transparent",
} as const;
export type ChipTone = keyof typeof chipTone;

export function Chip({
  tone = "neutral",
  dot,
  className,
  children,
  size = "md",
}: {
  tone?: ChipTone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap k-num",
        size === "sm" ? "h-5 px-2 text-[10.5px]" : "h-6 px-2.5 text-[11.5px]",
        chipTone[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const STATUS: Record<string, { tone: ChipTone; label: string }> = {
  completed: { tone: "up", label: "Completed" },
  approved: { tone: "up", label: "Approved" },
  verified: { tone: "up", label: "Verified" },
  active: { tone: "up", label: "Active" },
  passed: { tone: "up", label: "Passed" },
  pending: { tone: "warn", label: "Pending" },
  review: { tone: "warn", label: "In review" },
  processing: { tone: "info", label: "Processing" },
  running: { tone: "ember", label: "Running" },
  rejected: { tone: "down", label: "Rejected" },
  failed: { tone: "down", label: "Failed" },
  expired: { tone: "neutral", label: "Expired" },
  draft: { tone: "neutral", label: "Draft" },
  paused: { tone: "neutral", label: "Paused" },
  paid: { tone: "up", label: "Paid" },
  accruing: { tone: "gold", label: "Accruing" },
  stopped: { tone: "down", label: "Stopped" },
  scheduled: { tone: "info", label: "Scheduled" },
  suspended: { tone: "down", label: "Suspended" },
  open: { tone: "warn", label: "Open" },
  resolved: { tone: "up", label: "Resolved" },
};

export function StatusChip({ status, label }: { status: string; label?: string }) {
  const s = STATUS[status] ?? { tone: "neutral" as ChipTone, label: status };
  return (
    <Chip tone={s.tone} dot>
      {label ?? s.label}
    </Chip>
  );
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

export function Card({
  className,
  hot,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hot?: boolean }) {
  return (
    <div className={cn(hot ? "k-hot-card relative rounded-[20px]" : "k-card", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-6 pt-5", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-2 [&_svg]:size-4">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-[17px] font-medium tracking-tight text-fg">{title}</h3>
          {subtitle && <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-fg-3">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form controls                                                       */
/* ------------------------------------------------------------------ */

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { leading?: React.ReactNode; trailing?: React.ReactNode; inputClassName?: string }
>(function Input({ className, leading, trailing, inputClassName, ...props }, ref) {
  return (
    <div
      className={cn(
        "flex h-11 items-center gap-2 rounded-[14px] border border-line bg-surface-2 px-3.5 text-sm transition-colors focus-within:border-ember/50 focus-within:ring-4 focus-within:ring-ember/10",
        className,
      )}
    >
      {leading && <span className="flex shrink-0 items-center text-fg-3 [&_svg]:size-4">{leading}</span>}
      <input
        ref={ref}
        className={cn("h-full min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-3", inputClassName)}
        {...props}
      />
      {trailing && <span className="flex shrink-0 items-center gap-2 text-fg-3">{trailing}</span>}
    </div>
  );
});

export function Field({ label, hint, error, children, className }: { label: string; hint?: React.ReactNode; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-col gap-1.5", className)}>
      <span className="flex items-center justify-between text-[12.5px] font-medium text-fg-2">
        {label}
        {hint && <span className="text-fg-3 font-normal">{hint}</span>}
      </span>
      {children}
      {error && <span className="text-xs text-down">{error}</span>}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md border border-line bg-surface-3 px-1.5 py-0.5 font-mono text-[10.5px] text-fg-2">{children}</kbd>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-3", className)} />;
}

export function Divider({ className, vertical }: { className?: string; vertical?: boolean }) {
  return <div className={cn(vertical ? "w-px self-stretch bg-line" : "h-px w-full bg-line", className)} />;
}

export function Progress({ value, tone = "ember", className }: { value: number; tone?: "ember" | "up" | "down" | "gold" | "warn"; className?: string }) {
  const bg = { ember: "bg-ember", up: "bg-up", down: "bg-down", gold: "bg-gold", warn: "bg-warn" }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-300", bg)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-10 rounded-full border border-line transition-colors", checked ? "bg-ember" : "bg-surface-3")}
    >
      <span className={cn("absolute top-0.5 size-[18px] rounded-full bg-white shadow transition-all", checked ? "left-[19px]" : "left-0.5")} />
    </button>
  );
}
