"use client";

import * as React from "react";
import { toast } from "sonner";
import { Activity, BadgeDollarSign, Download, FileDown, Settings2, SlidersHorizontal } from "lucide-react";
import { Avatar, Button, Card, CardHeader, Chip, KpiCard, PageHeader, Reveal, cn } from "@kalks/ui";
import { PEOPLE } from "@kalks/mock";
import { SEC_AUDIT, orgEmployee } from "@kalks/mock/admin-platform-security";
import { AuditLog } from "@/components/security/audit-log";
import { ChainCard } from "@/components/security/chain-card";

function TopActors() {
  const counts = new Map<number, number>();
  for (const e of SEC_AUDIT) counts.set(e.staff, (counts.get(e.staff) ?? 0) + 1);
  const list = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = list[0]![1];
  // scale sample counts to realistic day totals
  const scale = 38;
  return (
    <Card>
      <CardHeader title="Most active staff" subtitle="Actions in the last 7 days" />
      <div className="mt-3 space-y-2 px-4 pb-5 sm:px-5">
        {list.map(([idx, n], i) => {
          const p = PEOPLE[idx]!;
          return (
            <div key={idx} className="k-row flex items-center gap-3 px-3 py-2.5">
              <span className="k-num w-3 text-[11px] text-fg-3">{i + 1}</span>
              <Avatar src={p.photo} name={p.name} size={28} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium">{p.name}</span>
                  <span className="k-num text-[12.5px] font-medium">{(n * scale + (7 - i) * 11).toLocaleString("en-US")}</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
                  <div className={cn("h-full rounded-full", i === 0 ? "bg-ember" : "bg-fg-3/60")} style={{ width: `${(n / max) * 100}%` }} />
                </div>
                <div className="mt-1 truncate text-[10.5px] text-fg-3">{orgEmployee(idx).title}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ModuleMix() {
  const counts = new Map<string, number>();
  for (const e of SEC_AUDIT) counts.set(e.module, (counts.get(e.module) ?? 0) + 1);
  const list = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = SEC_AUDIT.length;
  const colors = ["bg-ember", "bg-gold", "bg-up", "bg-info", "bg-warn", "bg-fg-3"];
  return (
    <Card>
      <CardHeader title="By module" subtitle="Share of logged actions" />
      <div className="px-4 pb-5 pt-4 sm:px-5">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-3">
          {list.map(([m, n], i) => (
            <span key={m} className={cn("h-full border-r border-bg last:border-r-0", colors[Math.min(i, colors.length - 1)])} style={{ width: `${(n / total) * 100}%` }} />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
          {list.map(([m, n], i) => (
            <div key={m} className="flex items-center gap-2 text-[12px]">
              <span className={cn("size-2 rounded-full", colors[Math.min(i, colors.length - 1)])} />
              <span className="flex-1 truncate text-fg-2">{m}</span>
              <span className="k-num text-fg-3">{Math.round((n / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function AuditPage() {
  const exportRef = React.useRef<(() => void) | null>(null);
  return (
    <div className="pb-16">
      <PageHeaderBlock onExport={() => exportRef.current?.()} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Actions · today" icon={<Activity />} value={<span className="k-num">1,482</span>} chip="+12% vs 7-day avg" chipTone="neutral" delay={0} />
        <KpiCard label="Money-moving actions" icon={<BadgeDollarSign />} value={<span className="k-num">214</span>} chip="$1.84M approved" chipTone="up" delay={0.05} />
        <KpiCard label="Config & risk changes" icon={<SlidersHorizontal />} value={<span className="k-num">37</span>} chip="4 outside change window" chipTone="warn" delay={0.1} />
        <KpiCard label="Data exports" icon={<FileDown />} value={<span className="k-num">9</span>} chip="All with reason code" chipTone="up" delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="min-w-0 xl:col-span-9">
          <AuditLog onExportRef={exportRef} />
        </Reveal>
        <div className="flex flex-col gap-4 xl:col-span-3">
          <Reveal delay={0.15}>
            <ChainCard />
          </Reveal>
          <Reveal delay={0.2}>
            <TopActors />
          </Reveal>
          <Reveal delay={0.25}>
            <ModuleMix />
          </Reveal>
          <Reveal delay={0.3}>
            <Card className="px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="k-label">Retention</span>
                <Chip size="sm" tone="info">
                  CySEC · 7 years
                </Chip>
              </div>
              <p className="mt-2 text-[12.5px] leading-snug text-fg-3">Entries cannot be edited or deleted by any role, including Super Admin. Corrections are appended as new entries.</p>
              <Button size="xs" variant="surface" className="mt-3" onClick={() => toast.info("Retention policy is managed by the platform owner", { description: "Settings → Compliance → Data retention" })}>
                <Settings2 /> Policy
              </Button>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function PageHeaderBlock({ onExport }: { onExport: () => void }) {
  return (
    <PageHeader
      title="Admin audit log"
      subtitle="Every staff action with before/after values · immutable, hash-chained · server time GMT+3"
      actions={
        <>
          <Button variant="surface" onClick={() => toast.success("Alert rule created", { description: "You'll be notified when any staff edits leverage or spreads outside the change window." })}>
            Create alert
          </Button>
          <Button variant="ember" onClick={onExport}>
            <Download /> Export CSV
          </Button>
        </>
      }
    />
  );
}
