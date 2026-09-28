"use client";

import { Chip, cn, type ChipTone } from "@kalks/ui";
import type { CaseStatus, Sla } from "./types";

export const STATUS: Record<CaseStatus, { tone: ChipTone; label: string }> = {
  draft: { tone: "neutral", label: "Draft" },
  submitted: { tone: "warn", label: "Waiting" },
  in_review: { tone: "info", label: "In review" },
  more_info: { tone: "neutral", label: "More info requested" },
  approved: { tone: "up", label: "Approved" },
  rejected: { tone: "down", label: "Rejected" },
};

export function CaseStatusChip({ status }: { status: CaseStatus }) {
  const s = STATUS[status];
  return (
    <Chip size="sm" tone={s.tone} dot>
      {s.label}
    </Chip>
  );
}

/** "2h 14m" from seconds. */
export function dur(secs: number) {
  const s = Math.abs(Math.round(secs));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}

/** Time in queue against the SLA, recomputed against `now` so it ticks without refetching. */
export function SlaBadge({ sla, submittedAt, now, className }: { sla: Sla; submittedAt: string | null; now: number; className?: string }) {
  if (!sla || !submittedAt) return <span className="text-fg-3">—</span>;
  const age = (now - Date.parse(submittedAt)) / 1000;
  const total = sla.hours * 3600;
  const left = total - age;
  const pct = Math.min(100, Math.max(0, (age / total) * 100));
  const tone = left < 0 ? "bg-down" : pct > 75 ? "bg-warn" : "bg-up";
  return (
    <span className={cn("inline-flex min-w-[118px] flex-col gap-1", className)} title={`SLA ${sla.hours}h`}>
      <span className={cn("k-num text-[12px]", left < 0 ? "text-down" : pct > 75 ? "text-warn" : "text-fg-2")}>{left < 0 ? `Overdue ${dur(-left)}` : `${dur(left)} left`}</span>
      <span className="h-1 w-full overflow-hidden rounded-full bg-surface-3">
        <span className={cn("block h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}

export function idTypeLabel(t: string | null) {
  return t === "passport" ? "Passport" : t === "national_id" ? "National ID" : t === "driving_licence" ? "Driving licence" : "—";
}
