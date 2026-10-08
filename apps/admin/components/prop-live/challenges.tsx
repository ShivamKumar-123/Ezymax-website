"use client";

import * as React from "react";
import { Activity, AlertTriangle, ShieldAlert, Trophy } from "lucide-react";
import { Card, CardHeader, Chip, DataTable, KpiCard, PageHeader, Reveal, cn, type Column } from "@ezymex/ui";
import { FilterSelect, Pager, TableSkeleton, qs, useApi, useDebounced } from "@/components/live/kit";
import { FilterPills } from "@/components/prop/rules";
import { ChallengeDrawer } from "./challenge-drawer";
import { PlanTypeChip, PropError, PropStatus, TargetBar, TraderCell, UsageBar, int, usd, useClientNames, type Challenge, type LiveRules, type Overview, type PlanRow } from "./kit";

type StatusF = "all" | "active" | "funded" | "failed" | "provisioning" | "closed";
const LIMIT = 50;

const rulesOf = (c: Challenge) => (c.current?.rules ?? {}) as Partial<LiveRules>;
const atRisk = (c: Challenge) => {
  const r = rulesOf(c);
  return (!!r.dailyLimit && (r.dailyUsed ?? 0) / r.dailyLimit >= 0.7) || (!!r.ddLimit && (r.ddUsed ?? 0) / r.ddLimit >= 0.7);
};

export function challengeColumns(names: ReturnType<typeof useClientNames>, opts: { funded?: boolean } = {}): Column<Challenge>[] {
  return [
    { key: "trader", header: "Trader", cell: (c) => <TraderCell name={c.traderName} userId={c.userId} names={names} />, sort: (c) => c.traderName, csv: (c) => `${c.traderName} #${c.userId}` },
    {
      key: "plan",
      header: "Plan",
      hideOn: "md",
      cell: (c) => (
        <span className="flex flex-col gap-1">
          <span className="truncate text-[13px]">{c.planName}</span>
          <span className="flex items-center gap-1.5">
            <PlanTypeChip type={c.type} />
            <span className="text-[11.5px] text-fg-3">{c.current?.phase ?? "—"}</span>
          </span>
        </span>
      ),
      csv: (c) => c.planName,
    },
    { key: "size", header: "Size", align: "right", cell: (c) => <span className="k-num font-medium">{usd(c.size, 0)}</span>, sort: (c) => c.size, csv: (c) => c.size },
    { key: "login", header: "Login", hideOn: "lg", cell: (c) => <span className="font-mono text-[12px]">{c.current?.login ?? "—"}</span>, csv: (c) => c.current?.login ?? "" },
    { key: "status", header: "Status", cell: (c) => <PropStatus status={c.status} />, sort: (c) => c.status, csv: (c) => c.status },
    {
      key: "equity",
      header: "Equity",
      align: "right",
      cell: (c) => {
        const a = c.current;
        if (!a || a.equity === null) return <span className="text-fg-3">—</span>;
        return <span className={cn("k-num font-medium", a.equity >= a.initialBalance ? "text-up" : "text-down")}>{usd(a.equity)}</span>;
      },
      sort: (c) => (c.current?.equity ?? 0) - (c.current?.initialBalance ?? 0),
      csv: (c) => c.current?.equity ?? "",
    },
    { key: "dl", header: "Daily loss", cell: (c) => <UsageBar used={rulesOf(c).dailyUsed} limit={rulesOf(c).dailyLimit} />, sort: (c) => (rulesOf(c).dailyLimit ? (rulesOf(c).dailyUsed ?? 0) / rulesOf(c).dailyLimit! : 0) },
    { key: "dd", header: "Max DD", cell: (c) => <UsageBar used={rulesOf(c).ddUsed} limit={rulesOf(c).ddLimit} />, sort: (c) => (rulesOf(c).ddLimit ? (rulesOf(c).ddUsed ?? 0) / rulesOf(c).ddLimit! : 0) },
    ...(opts.funded
      ? []
      : [
          { key: "target", header: "Profit vs target", cell: (c: Challenge) => <TargetBar profit={rulesOf(c).profit} target={c.current?.funded ? null : rulesOf(c).targetAmount} />, sort: (c: Challenge) => (rulesOf(c).targetAmount ? (rulesOf(c).profit ?? 0) / rulesOf(c).targetAmount! : 0) },
          {
            key: "days",
            header: "Days",
            align: "right" as const,
            hideOn: "sm" as const,
            cell: (c: Challenge) => {
              const a = c.current;
              if (!a) return <span className="text-fg-3">—</span>;
              return (
                <span className="k-num text-[12.5px]">
                  <span className={a.tradingDays >= a.minDays ? "text-up" : "text-fg"}>{a.tradingDays}</span>
                  <span className="text-fg-3"> / {a.minDays}</span>
                </span>
              );
            },
            sort: (c: Challenge) => c.current?.tradingDays ?? 0,
          },
        ]),
    {
      key: "flags",
      header: "Flags",
      align: "right",
      cell: (c) =>
        c.flags ? (
          <Chip size="sm" tone="warn">
            {c.flags} open
          </Chip>
        ) : (
          <span className="text-fg-3">—</span>
        ),
      sort: (c) => c.flags ?? 0,
      csv: (c) => c.flags ?? 0,
    },
  ];
}

export function LiveChallengesPage() {
  const [status, setStatus] = React.useState<StatusF>("all");
  const [plan, setPlan] = React.useState("all");
  const [q, setQ] = React.useState("");
  const dq = useDebounced(q.trim(), 300);
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [status, plan, dq]);
  const [sel, setSel] = React.useState<number | null>(null);
  const [open, setOpen] = React.useState(false);

  const { data, error, reload } = useApi<{ items: Challenge[]; page: number; limit: number; total: number }>(`/api/prop/challenges${qs({ status, plan, q: dq, page, limit: LIMIT })}`, { refreshMs: 3000 });
  const ov = useApi<Overview>("/api/prop/overview", { refreshMs: 15_000 });
  const plans = useApi<{ plans: PlanRow[] }>("/api/prop/plans");
  const rows = data?.items ?? [];
  const names = useClientNames(rows.map((r) => r.userId));
  const columns = React.useMemo(() => challengeColumns(names), [names]);
  const risky = rows.filter((c) => c.status === "active" && atRisk(c)).length;

  return (
    <div className="pb-24">
      <PageHeader title="Challenges" subtitle="Every evaluation and funded account with its live rule state from the prop risk engine. Refreshes every 3 seconds." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active challenges" icon={<Activity />} value={<span className="k-num">{int(ov.data?.activeChallenges)}</span>} chip={`${int(ov.data?.sold30d)} sold in 30 days`} />
        <KpiCard label="Near a limit (page)" icon={<AlertTriangle />} value={<span className={cn("k-num", risky > 0 && "text-warn")}>{risky}</span>} chip="≥ 70% of daily loss or max DD" chipTone={risky ? "warn" : "neutral"} delay={0.04} />
        <KpiCard label="Funded" icon={<Trophy />} value={<span className="k-num">{int(ov.data?.funded)}</span>} chip="Simulated funded accounts" chipTone="gold" href="/prop/funded" delay={0.08} />
        <KpiCard label="Breaches · 24h" icon={<ShieldAlert />} value={<span className={cn("k-num", (ov.data?.breaches24h ?? 0) > 0 && "text-down")}>{int(ov.data?.breaches24h)}</span>} chip={`${int(ov.data?.failed)} failed in total`} chipTone={(ov.data?.breaches24h ?? 0) > 0 ? "down" : "neutral"} href="/prop/violations" delay={0.12} />
      </div>

      <Reveal delay={0.08} className="mt-4">
        <Card>
          <CardHeader title="All challenges" subtitle={data ? `${int(data.total)} challenges · click a row for rules, events and actions` : "Loading…"} />
          <div className="px-4 pb-6 pt-4 sm:px-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <FilterPills
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all", label: "All" },
                  { value: "active", label: "Active" },
                  { value: "funded", label: "Funded" },
                  { value: "failed", label: "Failed" },
                  { value: "provisioning", label: "Provisioning" },
                  { value: "closed", label: "Closed" },
                ]}
              />
              <FilterSelect label="Plan" value={plan} onChange={setPlan} options={[{ value: "all", label: "All plans" }, ...(plans.data?.plans ?? []).map((p) => ({ value: p.id, label: p.name }))]} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Trader, client id, challenge id, login"
                aria-label="Search challenges"
                className="ml-auto h-9 w-72 max-w-full rounded-full border border-line bg-surface-2 px-3.5 text-[12.5px] text-fg outline-none placeholder:text-fg-3 focus:border-ember/50"
              />
            </div>
            {error && !data ? (
              <PropError error={error} onRetry={reload} />
            ) : !data ? (
              <TableSkeleton />
            ) : (
              <>
                <DataTable columns={columns} rows={rows} pageSize={LIMIT} dense rowKey={(c) => String(c.id)} exportName="prop-challenges" onRowClick={(c) => { setSel(c.id); setOpen(true); }} empty={<div className="py-10 text-center text-[13px] text-fg-3">No challenges match these filters.</div>} />
                <Pager page={page} perPage={LIMIT} total={data.total} onPage={setPage} />
              </>
            )}
          </div>
        </Card>
      </Reveal>

      <ChallengeDrawer id={sel} open={open} onOpenChange={setOpen} onChanged={reload} />
    </div>
  );
}
