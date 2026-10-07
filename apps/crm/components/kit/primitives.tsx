"use client";

// Client Area versions of the shared primitives (@kalks/ui), in the pastel "frosted card" language: rounded-rect
// buttons (accent fill, outline, near-black "ink" for money actions, soft accent tint), borderless soft chips and
// cards with an 18px display-font title. Same props as @kalks/ui, plus the extra variants; every colour comes from
// the design tokens, so a broker's brand colour (--k-ember) drives them.

import * as React from "react";
import { cn } from "@kalks/ui";

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

const BTN_BASE =
  "k-hit relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold tracking-[-0.005em] transition-[background-color,border-color,color,box-shadow,filter,transform] duration-200 outline-none focus-visible:ring-4 focus-visible:ring-ember/20 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

const BTN_VARIANT = {
  ember: "k-accent-btn",
  ink: "k-ink-btn",
  soft: "bg-ember-soft text-ember hover:bg-[color-mix(in_oklab,var(--k-ember)_18%,transparent)]",
  surface: "k-surface-btn text-fg",
  ghost: "text-fg-2 hover:bg-surface-3 hover:text-fg",
  outline: "border border-ember/45 bg-transparent text-ember hover:border-ember hover:bg-ember-soft",
  buy: "bg-up text-white shadow-[0_10px_24px_-14px_var(--k-up)] hover:brightness-105",
  sell: "bg-down text-white shadow-[0_10px_24px_-14px_var(--k-down)] hover:brightness-105",
  "up-outline": "border border-up/35 bg-up-soft text-up hover:bg-up/15",
  "down-outline": "border border-down/35 bg-down-soft text-down hover:bg-down/15",
  gold: "bg-gradient-to-br from-[color-mix(in_oklab,var(--k-gold)_70%,#fff)] to-gold text-[#1a1204] hover:brightness-105",
} as const;

// one compact scale (the founder's rule: no oversized buttons); phones still get a 44px touch target (.k-hit)
const BTN_SIZE = {
  xs: "h-7 rounded-[10px] px-2.5 text-xs",
  sm: "h-[34px] rounded-[11px] px-3.5 text-[13px]",
  md: "h-[38px] rounded-[12px] px-4 text-[13.5px]",
  lg: "h-[42px] rounded-[13px] px-5 text-sm",
  xl: "h-11 rounded-[14px] px-6 text-[14.5px]",
} as const;

export type ButtonVariant = keyof typeof BTN_VARIANT;
export type ButtonSize = keyof typeof BTN_SIZE;

/** Class list of a button (for links styled as buttons). */
export function buttonVariants({ variant, size }: { variant?: ButtonVariant | null; size?: ButtonSize | null } = {}) {
  return cn(BTN_BASE, BTN_VARIANT[variant ?? "surface"], BTN_SIZE[size ?? "md"]);
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant | null;
  size?: ButtonSize | null;
  /** Accepted for compatibility; renders nothing. */
  shimmer?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant, size, shimmer: _shimmer, children, ...props }, ref) {
  return (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </button>
  );
});

/* ------------------------------------------------------------------ */
/* Round icon button                                                   */
/* ------------------------------------------------------------------ */

export const IconButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: "sm" | "md" | "lg"; active?: boolean; dot?: boolean }>(function IconButton(
  { className, size = "md", active, dot, children, ...props },
  ref,
) {
  const s = size === "sm" ? "size-8 [&_svg]:size-3.5" : size === "lg" ? "size-11 [&_svg]:size-[18px]" : "size-10 [&_svg]:size-4";
  return (
    <button
      ref={ref}
      className={cn(
        "k-hit k-surface-btn relative inline-flex shrink-0 items-center justify-center rounded-full text-fg-2 outline-none transition-colors hover:text-fg focus-visible:ring-4 focus-visible:ring-ember/20",
        active && "!bg-ember-soft !text-ember",
        s,
        className,
      )}
      {...props}
    >
      {children}
      {dot && <span className="absolute end-2 top-2 size-2 rounded-full bg-ember ring-2 ring-surface" />}
    </button>
  );
});

/* ------------------------------------------------------------------ */
/* Chips                                                               */
/* ------------------------------------------------------------------ */

const chipTone = {
  neutral: "bg-surface-3 text-fg-2",
  up: "bg-up-soft text-up",
  down: "bg-down-soft text-down",
  ember: "bg-ember-soft text-ember",
  gold: "bg-gold-soft text-gold",
  warn: "bg-warn-soft text-warn",
  info: "bg-info-soft text-info",
  solid: "bg-[var(--k-ink)] text-[var(--k-ink-fg)]",
} as const;
export type ChipTone = keyof typeof chipTone;

export function Chip({ tone = "neutral", dot, className, children, size = "md" }: { tone?: ChipTone; dot?: boolean; className?: string; children: React.ReactNode; size?: "sm" | "md" }) {
  return (
    <span className={cn("k-num inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold", size === "sm" ? "h-5 px-2 text-[10.5px]" : "h-6 px-2.5 text-[11.5px]", chipTone[tone], className)}>
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

export function Card({ className, hot, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { hot?: boolean }) {
  return (
    <div className={cn("k-card", hot && "k-card-hot", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, icon, action, className }: { title: React.ReactNode; subtitle?: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 pt-5 sm:px-6 sm:pt-6", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && <span className="k-tile k-tile-accent size-10 shrink-0 rounded-[13px] [&_svg]:size-[18px]">{icon}</span>}
        <div className="min-w-0">
          <h3 className="k-display truncate text-[18px] font-semibold tracking-[-0.015em] text-fg">{title}</h3>
          {subtitle && <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-fg-3">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

/** Pastel icon tile (yellow / coral / pink / lavender / mint / sky; "accent" follows the brand colour). */
export type TileTone = "accent" | "amber" | "coral" | "pink" | "lavender" | "mint" | "sky" | "neutral";
export function IconTile({ tone = "accent", size = 44, className, children }: { tone?: TileTone; size?: number; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("k-tile shrink-0", `k-tile-${tone}`, className)} style={{ width: size, height: size, borderRadius: Math.round(size * 0.32) }}>
      {children}
    </span>
  );
}
