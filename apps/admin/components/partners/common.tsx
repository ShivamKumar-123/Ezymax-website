"use client";

import * as React from "react";
import { Chip, Icon3D, cn, formatDateTime } from "@kalks/ui";
import { LEVEL_MAP, LEVELS, type LevelKey } from "@kalks/mock/admin-partners";

export const LEVEL_COLOR: Record<LevelKey, string> = {
  bronze: "color-mix(in oklab, var(--k-ember) 55%, var(--k-fg-3))",
  silver: "var(--k-fg-2)",
  gold: "var(--k-gold)",
  platinum: "var(--k-info)",
  diamond: "var(--k-ember)",
};

export function LevelChip({ level, size = "sm", icon = true }: { level: LevelKey; size?: "sm" | "md"; icon?: boolean }) {
  const L = LEVEL_MAP[level];
  return (
    <Chip size={size} tone={L.tone}>
      {icon && <Icon3D name={L.icon} size={size === "sm" ? 12 : 14} className="drop-shadow-none" />}
      {L.name}
    </Chip>
  );
}

export function nextLevel(level: LevelKey) {
  const i = LEVELS.findIndex((l) => l.key === level);
  return LEVELS[i + 1] ?? null;
}

export const fmtLots = (v: number, d = 1) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtInt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
export const fmtUsd0 = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
export const fmtUsdK = (v: number) => (Math.abs(v) >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(v >= 100_000 ? 0 : 1)}k` : `$${v.toFixed(0)}`);
export const fmtDate = (s: string) => formatDateTime(s, { day: "2-digit", month: "short", year: "numeric" });
export const fmtDT = (s: string) => formatDateTime(s);
export const fmtTime = (s: string) => formatDateTime(s, { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3, hour12: false });

/** Relative "3h ago" from the fixed mock clock (deterministic for SSR). */
export function ago(isoStr: string, now = Date.parse("2026-09-24T14:32:00+03:00")) {
  const s = Math.max(0, Math.round((now - Date.parse(isoStr)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/** Small label/value line used in dense cards. */
export function Line({ k, v, className }: { k: React.ReactNode; v: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-2 text-[13px]", className)}>
      <span className="text-fg-3">{k}</span>
      <span className="k-num text-right font-medium text-fg">{v}</span>
    </div>
  );
}

/** Segmented horizontal share bar with legend. */
export function ShareBar({ parts, className }: { parts: { label: string; value: number; color: string }[]; className?: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className={className}>
      <div className="flex h-2 gap-[2px] overflow-hidden rounded-full">
        {parts.map((p) => (
          <span key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} className="h-full first:rounded-l-full last:rounded-r-full" />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-fg-3">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            {p.label} <span className="k-num text-fg-2">{((p.value / total) * 100).toFixed(0)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}
