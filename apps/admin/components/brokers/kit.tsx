"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Button, Chip, Dialog, DialogClose, cn, type ChipTone } from "@ezymex/ui";
import { BRK_PLAN_LABEL, brkTenant, type BrkPlan, type BrkTenant, type BrkTenantStatus } from "@ezymex/mock/admin-platform-brokers";

/* ------------------------------------------------------------------ */
/* Tenant logo square                                                  */
/* ------------------------------------------------------------------ */

export function TenantLogo({ color, mark, size = 36, src, className }: { color: string; mark: string; size?: number; src?: string; className?: string }) {
  return (
    <span
      className={cn("relative grid shrink-0 place-items-center overflow-hidden font-semibold text-white", className)}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: src ? "var(--k-surface-2)" : `linear-gradient(140deg, ${color} 0%, color-mix(in oklab, ${color} 55%, #000) 100%)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.28), 0 6px 18px -8px ${color}`,
        fontSize: size * 0.44,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-contain p-1" />
      ) : (
        <>
          <span aria-hidden className="absolute -right-1/4 -top-1/4 size-3/4 rounded-full bg-white/15 blur-[6px]" />
          <span className="relative tracking-tight drop-shadow-[0_1px_1px_rgba(0,0,0,.35)]">{mark}</span>
        </>
      )}
    </span>
  );
}

export function TenantCell({ t, size = 34, sub }: { t: BrkTenant; size?: number; sub?: React.ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <TenantLogo color={t.color} mark={t.mark} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-medium text-fg">{t.name}</span>
        <span className="block truncate text-[12px] text-fg-3">{sub ?? t.legalName}</span>
      </span>
    </span>
  );
}

export function TenantMini({ id, size = 22 }: { id: string; size?: number }) {
  const t = brkTenant(id);
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <TenantLogo color={t.color} mark={t.mark} size={size} />
      <span className="truncate text-[13px] text-fg">{t.name}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Chips                                                               */
/* ------------------------------------------------------------------ */

const PLAN_TONE: Record<BrkPlan, ChipTone> = { starter: "neutral", growth: "info", enterprise: "gold", owner: "ember" };
export function PlanChip({ plan, size }: { plan: BrkPlan; size?: "sm" | "md" }) {
  return (
    <Chip tone={PLAN_TONE[plan]} size={size}>
      {BRK_PLAN_LABEL[plan]}
    </Chip>
  );
}

const STATUS_TONE: Record<BrkTenantStatus, ChipTone> = { active: "up", trial: "gold", suspended: "down", onboarding: "info" };
export function TenantStatus({ status }: { status: BrkTenantStatus }) {
  return (
    <Chip tone={STATUS_TONE[status]} dot>
      {status[0]!.toUpperCase() + status.slice(1)}
    </Chip>
  );
}

/* ------------------------------------------------------------------ */
/* Form bits                                                           */
/* ------------------------------------------------------------------ */

export function Select({ value, onChange, options, className, leading }: { value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[]; className?: string; leading?: React.ReactNode }) {
  return (
    <div className={cn("relative flex h-11 items-center gap-2 rounded-[14px] border border-line bg-surface-2 pl-3.5 pr-9 text-sm transition-colors focus-within:border-ember/50 focus-within:ring-4 focus-within:ring-ember/10", className)}>
      {leading && <span className="flex shrink-0 items-center text-fg-3 [&_svg]:size-4">{leading}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-full min-w-0 flex-1 appearance-none bg-transparent text-fg outline-none [&>option]:bg-surface-2">
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
      <ChevronDown className="pointer-events-none absolute right-3 size-4 text-fg-3" />
    </div>
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("min-h-24 w-full resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-3 text-sm text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-ember/50 focus:ring-4 focus:ring-ember/10", props.className)} />;
}

/** Ember range slider with a filled track and glowing thumb. */
export function RangeSlider({ value, onChange, min = 0, max = 100, step = 5, className, disabled }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; className?: string; disabled?: boolean }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={cn("relative h-5 w-full", disabled && "opacity-40", className)}>
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-3" />
      <div className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#b8330f] via-ember to-ember-2 shadow-[0_0_12px_-2px_rgba(255,90,31,.7)]" style={{ width: `${pct}%` }} />
      <div className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ember shadow-[0_0_0_4px_rgba(255,90,31,.18),0_2px_8px_rgba(0,0,0,.5)]" style={{ left: `${pct}%` }} />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full cursor-pointer opacity-0"
        aria-label="Rollout percentage"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Confirm dialog                                                      */
/* ------------------------------------------------------------------ */

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  danger,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      width={480}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            variant={danger ? "sell" : "ember"}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children ?? <p className="text-sm text-fg-2">This action is logged in the audit trail with your staff ID.</p>}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function SectionLabel({ children, className, action }: { children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <div className={cn("mb-2.5 flex items-center justify-between gap-2", className)}>
      <span className="k-label">{children}</span>
      {action}
    </div>
  );
}

export function compactUsd(v: number) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

export function timeAgo(iso: string) {
  const now = Date.parse("2026-09-24T09:00:00Z");
  const m = Math.round((now - Date.parse(iso)) / 60000);
  if (m < 0) {
    const f = -m;
    if (f < 60) return `in ${f}m`;
    if (f < 60 * 24) return `in ${Math.round(f / 60)}h`;
    return `in ${Math.round(f / 1440)}d`;
  }
  if (m < 60) return `${m}m ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}
