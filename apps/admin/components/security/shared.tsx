"use client";

import * as React from "react";
import { Avatar, Chip, Tooltip, cn, formatDateTime } from "@ezymex/ui";
import { PEOPLE } from "@ezymex/mock";
import { ORG_TENANTS, SEC_NOW, orgEmployee, type OrgTenantKey } from "@ezymex/mock/admin-platform-security";

/** "14:27:08" in server time (GMT+3). */
export function timeGmt3(iso: string, seconds = true) {
  return formatDateTime(iso, { hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}), hour12: false });
}

/** "24 Sep" in server time. */
export function dayGmt3(iso: string) {
  return formatDateTime(iso, { day: "2-digit", month: "short" });
}

/** Relative to the fixed mock "now" (deterministic, hydration-safe). */
export function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.parse(SEC_NOW) - Date.parse(iso)) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60 ? `${m % 60}m ` : ""}ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function StaffCell({ idx, sub, size = 32, online }: { idx: number; sub?: React.ReactNode; size?: number; online?: boolean }) {
  const p = PEOPLE[idx]!;
  const e = orgEmployee(idx);
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar src={p.photo} name={p.name} size={size} online={online} />
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-medium text-fg">{p.name}</span>
        <span className="block truncate text-[11.5px] text-fg-3">{sub ?? e.title}</span>
      </span>
    </span>
  );
}

export function TenantDot({ tenant, withName, className }: { tenant: OrgTenantKey; withName?: boolean; className?: string }) {
  const t = ORG_TENANTS.find((x) => x.key === tenant)!;
  const dot = <span className="size-2 shrink-0 rounded-full" style={{ background: t.color, boxShadow: `0 0 8px ${t.color}80` }} />;
  if (!withName)
    return (
      <Tooltip content={t.name}>
        <span className={cn("inline-grid size-4 place-items-center", className)}>{dot}</span>
      </Tooltip>
    );
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] text-fg-2", className)}>
      {dot}
      {t.name}
    </span>
  );
}

export function TenantStack({ tenants }: { tenants: OrgTenantKey[] }) {
  return (
    <Tooltip content={tenants.map((k) => ORG_TENANTS.find((t) => t.key === k)!.name).join(" · ")}>
      <span className="inline-flex items-center -space-x-1">
        {tenants.map((k) => {
          const t = ORG_TENANTS.find((x) => x.key === k)!;
          return (
            <span key={k} className="grid size-5 place-items-center rounded-full text-[8px] font-bold text-black/80 ring-2 ring-surface" style={{ background: t.color }}>
              {t.short}
            </span>
          );
        })}
      </span>
    </Tooltip>
  );
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[12px] text-fg-2", className)}>{children}</span>;
}

export function ReasonChip({ code }: { code: string }) {
  return (
    <Chip size="sm" className="font-mono tracking-tight">
      {code}
    </Chip>
  );
}

/** Tiny stat block used in hero/info cards. */
export function MiniStat({ label, value, sub, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("k-row px-4 py-3", className)}>
      <div className="text-[11px] uppercase tracking-wider text-fg-3">{label}</div>
      <div className="k-num mt-1 text-[16px] font-semibold text-fg">{value}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-fg-3">{sub}</div>}
    </div>
  );
}
