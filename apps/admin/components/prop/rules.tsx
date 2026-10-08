"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, MinusCircle, XCircle } from "lucide-react";
import { Chip, Tooltip, cn, type ChipTone } from "@ezymex/ui";
import type { PlanType, RuleCheck, RuleState, Violation } from "./data";

export const RULE_TONE: Record<RuleState, ChipTone> = { ok: "up", warn: "warn", breach: "down", pending: "neutral", off: "neutral" };
const RULE_BG: Record<RuleState, string> = { ok: "bg-up", warn: "bg-warn", breach: "bg-down", pending: "bg-fg-3/40", off: "bg-surface-3" };
const RULE_TEXT: Record<RuleState, string> = { ok: "text-up", warn: "text-warn", breach: "text-down", pending: "text-fg-3", off: "text-fg-3" };
const RULE_LABEL: Record<RuleState, string> = { ok: "OK", warn: "Near limit", breach: "Breached", pending: "In progress", off: "Not enforced" };
const SHORT: Record<RuleCheck["key"], string> = { daily: "DL", maxdd: "DD", days: "MD", consistency: "CR" };

/** Compact live rule status: 4 small coloured segments with tooltips. */
export function RuleStatusBar({ rules, className }: { rules: RuleCheck[]; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {rules.map((r) => (
        <Tooltip
          key={r.key}
          content={
            <div className="min-w-44">
              <div className="flex items-center justify-between gap-3">
                <span>{r.label}</span>
                <span className={RULE_TEXT[r.state]}>{RULE_LABEL[r.state]}</span>
              </div>
              <div className="mt-0.5 font-normal text-fg-3">{r.detail}</div>
            </div>
          }
        >
          <span className="flex cursor-help flex-col items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <span className={cn("h-1.5 w-6 rounded-full", RULE_BG[r.state], r.state === "breach" && "shadow-[0_0_8px_var(--k-down)]")} />
            <span className={cn("font-mono text-[9px] leading-none", r.state === "ok" ? "text-fg-3" : RULE_TEXT[r.state])}>{SHORT[r.key]}</span>
          </span>
        </Tooltip>
      ))}
    </div>
  );
}

/** Drawer meter: how much of a limit is used and how much headroom remains. */
export function RuleMeter({ rule, headroom }: { rule: RuleCheck; headroom?: string }) {
  const Icon = rule.state === "ok" ? CheckCircle2 : rule.state === "warn" ? AlertTriangle : rule.state === "breach" ? XCircle : rule.state === "off" ? MinusCircle : CircleDashed;
  const pct = Math.min(100, rule.used);
  return (
    <div className="k-row px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] font-medium">
          <Icon className={cn("size-4", RULE_TEXT[rule.state])} />
          {rule.label}
        </span>
        <Chip size="sm" tone={RULE_TONE[rule.state]}>
          {rule.state === "off" ? "Off" : rule.key === "days" ? `${Math.round(rule.used)}%` : `${rule.used.toFixed(0)}% used`}
        </Chip>
      </div>
      <div className="relative mt-2.5 h-2 overflow-hidden rounded-full bg-surface-3">
        <div className={cn("h-full rounded-full transition-[width] duration-700", RULE_BG[rule.state])} style={{ width: `${pct}%` }} />
        {rule.key !== "days" && <span className="absolute inset-y-0 left-[70%] w-px bg-fg-3/60" />}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11.5px] text-fg-3">
        <span className="truncate">{rule.detail}</span>
        {headroom && <span className="k-num shrink-0 text-fg-2">{headroom}</span>}
      </div>
    </div>
  );
}

/** Profit vs target progress bar with target tick. */
export function TargetProgress({ profitPct, targetPct, className }: { profitPct: number; targetPct: number; className?: string }) {
  const pos = Math.max(0, Math.min(100, (profitPct / targetPct) * 100));
  const neg = profitPct < 0 ? Math.min(100, (-profitPct / targetPct) * 100) : 0;
  return (
    <div className={cn("w-32", className)}>
      <div className="flex items-baseline justify-between text-[11.5px]">
        <span className={cn("k-num font-medium", profitPct >= 0 ? "text-up" : "text-down")}>
          {profitPct >= 0 ? "+" : ""}
          {profitPct.toFixed(2)}%
        </span>
        <span className="k-num text-fg-3">/ {targetPct}%</span>
      </div>
      <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
        {profitPct >= 0 ? (
          <div className={cn("h-full rounded-full", pos >= 100 ? "bg-up" : "bg-gradient-to-r from-[#b8330f] to-ember")} style={{ width: `${pos}%` }} />
        ) : (
          <div className="h-full rounded-full bg-down/70" style={{ width: `${neg}%` }} />
        )}
      </div>
    </div>
  );
}

export function PlanTypeChip({ type }: { type: PlanType }) {
  return (
    <Chip size="sm" tone={type === "instant" ? "gold" : type === "1-step" ? "ember" : "neutral"}>
      {type === "instant" ? "Instant" : type === "1-step" ? "1-Step" : "2-Step"}
    </Chip>
  );
}

export const SEVERITY_TONE: Record<Violation["severity"], ChipTone> = { critical: "down", high: "ember", medium: "warn", low: "neutral" };
export function SeverityChip({ severity }: { severity: Violation["severity"] }) {
  return (
    <Chip size="sm" tone={SEVERITY_TONE[severity]} dot>
      {severity[0].toUpperCase() + severity.slice(1)}
    </Chip>
  );
}

/** Filter pill with a count (used in table toolbars). */
export function FilterPills<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors",
            o.value === value ? "border-ember/35 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-2 hover:text-fg",
          )}
        >
          {o.label}
          {o.count !== undefined && <span className={cn("k-num rounded-full px-1.5 text-[10.5px]", o.value === value ? "bg-ember/20" : "bg-surface-3 text-fg-3")}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
