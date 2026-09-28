"use client";

import * as React from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Activity, Box, Cpu, Database, FileText, HardDrive, MoreHorizontal, Radio, RotateCw, Server, Trash2, Wallet, Zap, type LucideIcon } from "lucide-react";
import { Chip, IconButton, Menu, Sparkline, Tooltip, cn, formatDateTime } from "@kalks/ui";
import type { BrkIncident, BrkService, BrkSvcStatus } from "@kalks/mock/admin-platform-brokers";
import { ConfirmDialog } from "./kit";

export const SVC_ICON: Record<string, LucideIcon> = {
  api: Server,
  ws: Radio,
  feed: Activity,
  matching: Zap,
  tron: Wallet,
  workers: Cpu,
  postgres: Database,
  redis: Box,
  storage: HardDrive,
};

export const SVC_TONE: Record<BrkSvcStatus, "up" | "warn" | "down" | "info"> = { operational: "up", degraded: "warn", down: "down", maintenance: "info" };
export const SVC_LABEL: Record<BrkSvcStatus, string> = { operational: "Operational", degraded: "Degraded", down: "Outage", maintenance: "Maintenance" };

export function UptimeBars({ bars, className }: { bars: number[]; className?: string }) {
  return (
    <div className={cn("flex h-6 items-stretch gap-[2px]", className)}>
      {bars.map((b, i) => (
        <Tooltip key={i} content={`${30 - i}d ago · ${b === 0 ? "No incidents" : b === 1 ? "Degraded performance" : "Partial outage"}`}>
          <motion.span
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.4, delay: i * 0.012 }}
            className={cn("flex-1 origin-bottom rounded-[2px]", b === 0 ? "bg-up/70" : b === 1 ? "bg-warn" : "bg-down")}
          />
        </Tooltip>
      ))}
    </div>
  );
}

type Action = { kind: "restart" | "flush" | "drain"; svc: BrkService } | null;

export function ServiceCard({ s }: { s: BrkService }) {
  const Icon = SVC_ICON[s.key] ?? Server;
  const [action, setAction] = React.useState<Action>(null);
  const tone = SVC_TONE[s.status];
  const fmt = (v: number) => (v < 10 ? v.toFixed(1) : Math.round(v).toString());
  const items = [
    { label: "Restart service", icon: <RotateCw />, onSelect: () => setAction({ kind: "restart", svc: s }) },
    ...(s.key === "redis" ? [{ label: "Flush cache", icon: <Trash2 />, danger: true, onSelect: () => setAction({ kind: "flush", svc: s }) }] : []),
    ...(s.key === "workers" || s.key === "ws" ? [{ label: "Drain & roll", icon: <RotateCw />, onSelect: () => setAction({ kind: "drain", svc: s }) }] : []),
    { label: "View logs", icon: <FileText />, onSelect: () => toast.message(`Streaming logs · ${s.name}`, { description: `kubectl logs -f deploy/${s.key} --since=15m` }) },
  ];
  return (
    <div className={cn("k-card relative overflow-hidden p-5 transition-colors hover:border-[var(--k-border-top)]", s.status === "degraded" && "border-warn/30")}>
      {s.status !== "operational" && <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-warn/15 blur-3xl" />}
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-full border", tone === "up" ? "border-line bg-surface-2 text-fg-2" : "border-warn/30 bg-warn-soft text-warn")}>
            <Icon className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[14.5px] font-medium">{s.name}</div>
            <div className="truncate text-[11.5px] text-fg-3">{s.host}</div>
          </div>
        </div>
        <Menu
          trigger={
            <IconButton size="sm" aria-label="Service actions">
              <MoreHorizontal />
            </IconButton>
          }
          items={items}
        />
      </div>
      <div className="relative mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="k-num text-[26px] font-semibold leading-none tracking-tight">
            {fmt(s.latency)}
            <span className="ml-1 text-[12px] font-normal text-fg-3">{s.unit}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Chip size="sm" tone={tone} dot>
              {SVC_LABEL[s.status]}
            </Chip>
            <span className="k-num text-[11.5px] text-fg-3">{s.metric}</span>
          </div>
        </div>
        <Sparkline data={s.series} width={120} height={40} tone={tone === "up" ? "up" : "ember"} />
      </div>
      <div className="relative mt-4">
        <UptimeBars bars={s.bars} className="h-5" />
        <div className="k-num mt-1.5 flex justify-between text-[11px] text-fg-3">
          <span>30d</span>
          <span>
            <span className={s.uptime >= 99.95 ? "text-up" : "text-warn"}>{s.uptime.toFixed(2)}%</span> uptime · {s.instances} · <span className="font-mono">{s.version}</span>
          </span>
        </div>
      </div>
      <ConfirmDialog
        open={!!action}
        onOpenChange={(o) => !o && setAction(null)}
        danger={action?.kind === "flush"}
        title={action?.kind === "flush" ? `Flush ${s.name} cache?` : action?.kind === "drain" ? `Drain & roll ${s.name}?` : `Restart ${s.name}?`}
        description={
          action?.kind === "flush"
            ? "All cached quotes, sessions and rate-limit counters are cleared. Users may be logged out; expect a brief latency spike across every tenant."
            : "Pods restart one at a time (rolling). Connections are drained gracefully; no downtime expected."
        }
        confirmLabel={action?.kind === "flush" ? "Flush cache" : action?.kind === "drain" ? "Drain & roll" : "Restart"}
        onConfirm={() =>
          toast.success(action?.kind === "flush" ? "Redis cache flushed" : `${s.name} ${action?.kind === "drain" ? "rolling restart" : "restart"} started`, {
            description: action?.kind === "flush" ? "38.2 GB released · warming from Postgres" : `${s.instances} · ETA 90s · logged to audit trail`,
          })
        }
      />
    </div>
  );
}

const SEV_TONE = { minor: "warn", major: "down", critical: "down", maintenance: "info" } as const;
const STATUS_TONE: Record<BrkIncident["status"], "warn" | "info" | "ember" | "up" | "neutral"> = { investigating: "warn", identified: "ember", monitoring: "info", resolved: "up", scheduled: "neutral" };

export function IncidentItem({ inc, compact }: { inc: BrkIncident; compact?: boolean }) {
  return (
    <div className="k-row p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip size="sm" tone={SEV_TONE[inc.severity]}>
          {inc.severity}
        </Chip>
        <Chip size="sm" tone={STATUS_TONE[inc.status]} dot>
          {inc.status}
        </Chip>
        <span className="ml-auto font-mono text-[11px] text-fg-3">{inc.id}</span>
      </div>
      <div className="mt-2 text-[14px] font-medium leading-snug">{inc.title}</div>
      <div className="mt-1 text-[12px] text-fg-3">
        {inc.components.join(", ")} · {formatDateTime(inc.startedAt)} GMT+3
      </div>
      {!compact && (
        <ol className="mt-3 space-y-2.5 border-l border-line pl-4">
          {inc.updates.map((u, i) => (
            <li key={i} className="relative">
              <span className={cn("absolute -left-[21px] top-1.5 size-2 rounded-full ring-4 ring-surface-2", i === 0 ? "bg-ember" : "bg-fg-3")} />
              <div className="text-[11.5px] text-fg-3">
                <span className="font-medium text-fg-2">{u.status}</span> · {formatDateTime(u.at)}
              </div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-2">{u.text}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
