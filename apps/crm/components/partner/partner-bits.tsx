"use client";

import * as React from "react";
import { Avatar, Chip, Flag, cn } from "@/components/kit";
import { REFERRED_CLIENTS, type CommissionStatus, type ReferredClient } from "@kalks/mock/partner";

export function TierChip({ tier, className }: { tier: 1 | 2 | 3; className?: string }) {
  return (
    <Chip size="sm" tone={tier === 1 ? "ember" : tier === 2 ? "gold" : "neutral"} className={cn("font-semibold", className)}>
      L{tier}
    </Chip>
  );
}

export function ClientCell({ c, size = 32, sub }: { c: Pick<ReferredClient, "name" | "photo" | "country"> & { email?: string }; size?: number; sub?: React.ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="relative shrink-0">
        <Avatar src={c.photo} name={c.name} size={size} />
        <Flag country={c.country} className="absolute -bottom-0.5 -right-1 size-3.5 ring-2 ring-surface" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-medium text-fg">{c.name}</span>
        {(sub ?? c.email) && <span className="block truncate text-[11.5px] text-fg-3">{sub ?? c.email}</span>}
      </span>
    </span>
  );
}

const STATUS_MAP: Record<CommissionStatus, { s: string; label: string }> = {
  pending: { s: "pending", label: "Pending" },
  approved: { s: "processing", label: "Approved" },
  paid: { s: "completed", label: "Paid" },
  rejected: { s: "rejected", label: "Rejected" },
};
export function CommissionStatusChip({ status }: { status: CommissionStatus }) {
  const m = STATUS_MAP[status];
  return (
    <Chip size="sm" dot tone={status === "pending" ? "warn" : status === "approved" ? "info" : status === "paid" ? "up" : "down"}>
      {m.label}
    </Chip>
  );
}

export function subIbName(parentId: string | null) {
  if (!parentId) return null;
  return REFERRED_CLIENTS.find((c) => c.id === parentId)?.name ?? null;
}

export function relTime(iso: string | null, now = Date.parse("2026-09-24T15:45:00Z")) {
  if (!iso) return "—";
  const m = Math.round((now - Date.parse(iso)) / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 45) return `${d}d ago`;
  return `${Math.round(d / 30)}mo ago`;
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Istanbul" });
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "21 Sep, 13:21" in server time (GMT+3). Avoids en-GB's "Sept". */
export function fmtDT(iso: string, withTime = true) {
  const d = new Date(Date.parse(iso) + 3 * 3600000);
  const base = `${String(d.getUTCDate()).padStart(2, "0")} ${MON[d.getUTCMonth()]}`;
  return withTime ? `${base}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}` : base;
}
