"use client";

import * as React from "react";
import { Activity, AlertTriangle, BadgeCheck, RefreshCw, SlidersHorizontal, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, KpiCard, PageHeader, Reveal, StatusChip, cn, type Column } from "@kalks/ui";
import { PersonCell, auditToast, useReason } from "@/components/config/kit";
import { CHALLENGES, challengeRules, type Challenge, type ChallengeStatus } from "@/components/prop/data";
import { ChallengeDrawer, CH_STATUS } from "@/components/prop/challenge-drawer";
import { FilterPills, PlanTypeChip, RuleStatusBar, TargetProgress } from "@/components/prop/rules";

type PhaseF = "all" | "Phase 1" | "Phase 2" | "Evaluation";
type StatusF = "all" | ChallengeStatus | "at-risk";

export default function ChallengesPage() {
  const [rows, setRows] = React.useState<Challenge[]>(CHALLENGES);
  const [phase, setPhase] = React.useState<PhaseF>("all");
  const [status, setStatus] = React.useState<StatusF>("all");
  const [selId, setSelId] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const reason = useReason();

  const atRisk = (c: Challenge) => c.status === "active" && challengeRules(c).some((r) => r.state === "warn");
  const filtered = rows.filter((c) => (phase === "all" || c.phase === phase) && (status === "all" || (status === "at-risk" ? atRisk(c) : c.status === status)));
  const sel = rows.find((c) => c.id === selId) ?? null;
  const count = (s: StatusF) => rows.filter((c) => (s === "all" ? true : s === "at-risk" ? atRisk(c) : c.status === s)).length;

  const columns: Column<Challenge>[] = [
    { key: "trader", header: "Trader", cell: (c) => <PersonCell name={c.trader.name} photo={c.trader.photo} sub={<span className="font-mono">#{c.login}</span>} size={30} />, sort: (c) => c.trader.name },
    {
      key: "plan",
      header: "Plan",
      cell: (c) => (
        <div className="flex flex-col gap-1">
          <span className="text-[13px]">{c.planName.replace("Kalks ", "")}</span>
          <span className="flex items-center gap-1.5">
            <PlanTypeChip type={c.planType} />
            <span className="text-[11.5px] text-fg-3">{c.phase}</span>
          </span>
        </div>
      ),
      hideOn: "md",
    },
    { key: "size", header: "Size", align: "right", cell: (c) => <span className="k-num font-medium">${(c.size / 1000).toFixed(0)}K</span>, sort: (c) => c.size },
    {
      key: "day",
      header: "Day",
      align: "right",
      cell: (c) => (
        <span className="k-num text-[12.5px]">
          <span className={cn(c.limit && c.day / c.limit > 0.8 ? "text-warn" : "text-fg")}>{c.day}</span>
          <span className="text-fg-3"> / {c.limit || "∞"}</span>
        </span>
      ),
      sort: (c) => c.day,
      hideOn: "sm",
    },
    { key: "profit", header: "Profit vs target", cell: (c) => <TargetProgress profitPct={c.profitPct} targetPct={c.targetPct} />, sort: (c) => c.profitPct / c.targetPct },
    { key: "rules", header: "Rules · live", cell: (c) => <RuleStatusBar rules={challengeRules(c)} />, sort: (c) => Math.max(...challengeRules(c).map((r) => (r.key === "days" ? 0 : r.used))) },
    { key: "equity", header: "Equity", align: "right", cell: (c) => <span className={cn("k-num font-medium", c.equity >= c.size ? "text-up" : "text-down")}>${c.equity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>, sort: (c) => c.equity, hideOn: "lg" },
    { key: "status", header: "Status", cell: (c) => <StatusChip status={CH_STATUS[c.status].status} label={CH_STATUS[c.status].label} />, sort: (c) => c.status },
  ];

  const active = rows.filter((c) => c.status === "active").length;

  return (
    <div className="pb-24">
      <PageHeader
        title="Challenges"
        subtitle="Every evaluation account with live rule status from the rule engine (tick-level, Kalks-Prop01/02)."
        actions={
          <>
            <Button size="sm" variant="surface" onClick={() => toast.success("Rule engine re-synced", { description: "2,132 accounts evaluated in 842 ms" })}>
              <RefreshCw /> Re-sync
            </Button>
            <Button
              size="sm"
              variant="ember"
              onClick={() =>
                reason.ask({
                  title: "Bulk extend time limits",
                  description: `Adds 3 days to every active challenge with a time limit (${rows.filter((c) => c.status === "active" && c.limit).length} accounts).`,
                  reasons: ["Server outage", "Feed incident", "Public holiday"],
                  confirmLabel: "Extend all",
                  onConfirm: (r) => {
                    setRows((rs) => rs.map((c) => (c.status === "active" && c.limit ? { ...c, limit: c.limit + 3 } : c)));
                    auditToast("Time limits extended by 3 days", r);
                  },
                })
              }
            >
              <SlidersHorizontal /> Bulk extend
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active challenges" icon={<Activity />} value={<span className="k-num">2,132</span>} chip={`${active} shown in sample`} delay={0} />
        <KpiCard label="Near a limit" icon={<AlertTriangle />} value={<span className="k-num text-warn">{rows.filter(atRisk).length * 21}</span>} chip="≥70% of daily loss or max DD" chipTone="warn" delay={0.05} />
        <KpiCard label="Passed today" icon={<BadgeCheck />} value={<span className="k-num text-up">38</span>} chip="+9 vs yesterday" chipTone="up" delay={0.1} />
        <KpiCard label="Breached 24h" icon={<XCircle />} value={<span className="k-num text-down">142</span>} chip="61% daily loss" chipTone="down" illustration="warning" delay={0.15} />
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader
            title="All challenges"
            subtitle={`${filtered.length} accounts · click a row for rule meters and actions`}
            action={
              <div className="hidden items-center gap-3 text-[11px] text-fg-3 md:flex">
                <span className="font-mono">DL</span> daily loss <span className="font-mono">DD</span> max DD <span className="font-mono">MD</span> min days <span className="font-mono">CR</span> consistency
                <Chip size="sm" tone="up" dot>
                  ok
                </Chip>
                <Chip size="sm" tone="warn" dot>
                  warn
                </Chip>
                <Chip size="sm" tone="down" dot>
                  breach
                </Chip>
              </div>
            }
          />
          <div className="px-4 pb-6 pt-4 sm:px-6">
            <DataTable
              columns={columns}
              rows={filtered}
              pageSize={12}
              dense
              rowKey={(c) => c.id}
              exportName="prop-challenges"
              search={(c) => `${c.trader.name} ${c.login} ${c.planName} ${c.id}`}
              searchPlaceholder="Name, login, plan…"
              onRowClick={(c) => {
                setSelId(c.id);
                setOpen(true);
              }}
              toolbar={
                <div className="flex flex-col gap-2">
                  <FilterPills
                    value={status}
                    onChange={setStatus}
                    options={[
                      { value: "all", label: "All", count: count("all") },
                      { value: "active", label: "Active", count: count("active") },
                      { value: "at-risk", label: "At risk", count: count("at-risk") },
                      { value: "passed", label: "Passed", count: count("passed") },
                      { value: "breached", label: "Breached", count: count("breached") },
                      { value: "expired", label: "Expired", count: count("expired") },
                    ]}
                  />
                  <FilterPills
                    value={phase}
                    onChange={setPhase}
                    options={[
                      { value: "all", label: "All phases" },
                      { value: "Phase 1", label: "Phase 1" },
                      { value: "Phase 2", label: "Phase 2" },
                      { value: "Evaluation", label: "1-Step evaluation" },
                    ]}
                  />
                </div>
              }
            />
          </div>
        </Card>
      </Reveal>

      <ChallengeDrawer c={sel} open={open} onOpenChange={setOpen} reason={reason} onUpdate={(n) => setRows((rs) => rs.map((c) => (c.id === n.id ? n : c)))} />
      {reason.node}
    </div>
  );
}
