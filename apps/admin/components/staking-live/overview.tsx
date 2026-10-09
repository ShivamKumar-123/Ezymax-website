"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, Coins, Cpu, Landmark, Percent, RefreshCw, Users } from "lucide-react";
import { Button, Card, CardHeader, Chip, DataTable, KpiCard, ListRow, PageHeader, Progress, Reveal, Skeleton, Stepper, cn, type Column } from "@ezymex/ui";
import { ColumnChart, MiniStat } from "@/components/config/kit";
import { ago, useApi, useNow, when } from "@/components/live/kit";
import { S, type Overview, type Plan } from "./api";
import { Amount, EmptyNote, LinkButton, Note, PLAN_STATUS, SETTLEMENT_STATUS, StakingError, StatusPill, amt, money, amtK, int, monthName, pct, shiftPeriod } from "./kit";

/* ------------------------------------------------------------------ */
/* Last closed month                                                    */
/* ------------------------------------------------------------------ */

const STEPS = ["Rates set", "Settlement created", "Approved", "Paid"];

function LastMonthCard({ ov, cur }: { ov: Overview; cur: string }) {
  const lp = ov.lastPeriod;
  const ex = lp.existing;
  const missing = lp.ratesMissing;
  const step = ex ? (ex.status === "pending_approval" ? 2 : ex.status === "approved" ? 3 : ex.status === "rejected" ? 1 : 4) : missing.length ? 0 : 1;
  const nothing = !ex && !missing.length && lp.totals.lines === 0;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        icon={<CalendarClock />}
        title={`${monthName(lp.period)} settlement`}
        subtitle="Last closed month in server time: set each plan's rate, then create the settlement for a second staff member to approve"
        action={ex ? <StatusPill map={SETTLEMENT_STATUS} status={ex.status} /> : nothing ? <Chip tone="neutral">Nothing to settle</Chip> : <Chip tone={missing.length ? "warn" : "info"}>{missing.length ? "Rates missing" : "Ready to settle"}</Chip>}
      />
      <div className="flex-1 space-y-4 px-4 pb-5 pt-5 sm:px-6">
        {!nothing && <Stepper steps={STEPS} current={step} />}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <MiniStat label="Returns" value={money(lp.totals.amount, cur)} tone="gold" sub={ex ? "In the settlement" : "Estimated from the rates set"} />
          <MiniStat label="Investors" value={int(lp.totals.investors)} sub={`${int(lp.totals.lines)} line${lp.totals.lines === 1 ? "" : "s"}`} />
          <MiniStat label="Principal earning" value={money(lp.totals.principal, cur)} />
          <MiniStat label="Zero lines" value={int(lp.totals.zeroLines)} sub="0 % or below a cent" />
        </div>
        {ex ? (
          <Note tone={ex.status === "pending_approval" ? "warn" : ex.status === "partially_paid" ? "down" : ex.status === "rejected" ? "neutral" : "up"}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Settlement <span className="font-mono">#{ex.id}</span> is {SETTLEMENT_STATUS[ex.status]?.label.toLowerCase() ?? ex.status}.
                {ex.status === "pending_approval" && " A staff member other than its creator approves it."}
                {ex.status === "partially_paid" && " Some transfers were refused by the wallet: retry them from the settlement."}
              </span>
              <LinkButton href={`/staking/settlements?settlement=${ex.id}`}>
                Open settlement <ArrowUpRight />
              </LinkButton>
            </div>
          </Note>
        ) : missing.length ? (
          <Note tone="warn" icon={<AlertTriangle />}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Set the {monthName(lp.period)} rate for <b className="font-medium">{missing.map((m) => m.name).join(", ")}</b> before the month can be settled.
              </span>
              <LinkButton href={`/staking/rates?period=${lp.period}`} variant="ember">
                <Percent /> Set rates
              </LinkButton>
            </div>
          </Note>
        ) : nothing ? (
          <EmptyNote title={`No returns to settle for ${monthName(lp.period)}`} text="No position earned a return in that month (no active positions, or every rate was 0 %)." />
        ) : (
          <Note tone="up" icon={<CheckCircle2 />}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Every plan has its {monthName(lp.period)} rate. Preview the lines and create the settlement for approval.</span>
              <LinkButton href={`/staking/settlements?new=${lp.period}`} variant="ember">
                Preview and create <ArrowUpRight />
              </LinkButton>
            </div>
          </Note>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[12px] text-fg-3">
          <span>
            {monthName(ov.currentPeriod)} is in progress: its rates can be set from the 1st and changed until its settlement is created.
          </span>
          <Link href={`/staking/rates?period=${ov.currentPeriod}`} className="text-fg-2 hover:text-ember">
            {monthName(ov.currentPeriod, "short")} rates →
          </Link>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Needs attention                                                      */
/* ------------------------------------------------------------------ */

function AttentionCard({ ov }: { ov: Overview }) {
  const now = useNow();
  const a = ov.attention;
  const rows: { n: number; label: string; sub: string; href: string; tone: "warn" | "down" | "info" }[] = [
    { n: a.pendingApproval, label: "Settlements awaiting approval", sub: "Four-eyes: approved by someone other than the creator", href: "/staking/settlements?status=pending_approval", tone: "warn" },
    { n: a.failedLines, label: "Return transfers refused", sub: "The wallet refused the credit; retry from the settlement", href: "/staking/settlements?status=partially_paid", tone: "down" },
    { n: a.pendingLines, label: "Return transfers waiting", sub: "Approved, queued or retrying with backoff", href: "/staking/settlements?status=approved", tone: "info" },
    { n: a.overdueMaturities, label: "Matured, principal not returned", sub: "Past maturity, waiting for the wallet credit", href: "/staking/positions?status=active", tone: "down" },
    { n: a.redeemWaiting, label: "Principal returns retrying", sub: "The wallet was unreachable; retried automatically", href: "/staking/positions?status=active", tone: "warn" },
    { n: ov.lastPeriod.ratesMissing.length, label: `${monthName(ov.lastPeriod.period, "short")} rates missing`, sub: ov.lastPeriod.ratesMissing.map((m) => m.name).join(", ") || "Every plan has its rate", href: `/staking/rates?period=${ov.lastPeriod.period}`, tone: "warn" },
  ];
  const open = rows.filter((r) => r.n > 0);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader icon={<AlertTriangle />} title="Needs attention" subtitle={open.length ? `${open.length} item${open.length === 1 ? "" : "s"} to look at` : "Nothing waiting on you"} />
      <div className="mt-4 flex-1 space-y-2 px-4 sm:px-6">
        {open.length === 0 ? (
          <EmptyNote className="py-8" title="All clear" text="No settlement waits for approval, every transfer is credited and every matured position is paid out." />
        ) : (
          open.map((r) => (
            <ListRow key={r.label} href={r.href} className="relative overflow-hidden py-2.5 pl-5">
              <span className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r-full", r.tone === "down" ? "bg-down" : r.tone === "warn" ? "bg-warn" : "bg-info")} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{r.label}</div>
                <div className="truncate text-[11.5px] text-fg-3">{r.sub}</div>
              </div>
              <Chip size="sm" tone={r.tone}>
                {int(r.n)}
              </Chip>
            </ListRow>
          ))
        )}
      </div>
      <div className="mt-4 flex items-center gap-2.5 border-t border-line px-4 py-3.5 text-[12px] text-fg-3 sm:px-6">
        <Cpu className="size-3.5 shrink-0 text-fg-2" />
        {ov.workers.enabled ? (
          <span>
            Background workers on · last run <span className="text-fg-2" title={when(ov.workers.lastRun, true)}>{ago(ov.workers.lastRun, now)}</span>
          </span>
        ) : (
          <span className="text-warn">Background workers are off: transfers, maturities and payment checks don&apos;t run.</span>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Monthly returns paid                                                 */
/* ------------------------------------------------------------------ */

function MonthlyCard({ ov, cur }: { ov: Overview; cur: string }) {
  // the 12 months up to the last closed one, oldest first; months without a paid settlement show as 0
  const last = ov.lastPeriod.period;
  const months = Array.from({ length: 12 }, (_, i) => shiftPeriod(last, i - 11));
  const by = new Map(ov.monthly.map((m) => [m.period, m]));
  const data = months.map((m) => ({ label: monthName(m, "tiny"), values: [by.get(m)?.amount ?? 0] }));
  const total = ov.monthly.reduce((s, m) => s + m.amount, 0);
  return (
    <Card className="h-full">
      <CardHeader title="Monthly returns paid" subtitle={`Approved and paid settlements, last 12 months · ${cur}`} action={<LinkButton href="/staking/settlements">Settlements</LinkButton>} />
      <div className="px-4 pb-5 pt-4 sm:px-6">
        {ov.monthly.length === 0 ? (
          <EmptyNote className="h-[240px]" title="No returns paid yet" text="Once a month's settlement is approved, its total shows here." />
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2.5">
              <MiniStat label="12-month total" value={money(total, cur)} tone="gold" />
              <MiniStat label="Latest" value={money(ov.monthly.at(-1)?.amount ?? 0, cur)} sub={monthName(ov.monthly.at(-1)?.period)} />
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[420px]">
                <ColumnChart data={data} series={[{ label: `Returns (${cur})`, tone: "gold" }]} height={210} format={amtK} />
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Plans                                                                */
/* ------------------------------------------------------------------ */

function PlansCard({ ov }: { ov: Overview }) {
  const router = useRouter();
  const cols: Column<Plan>[] = [
    {
      key: "n",
      header: "Plan",
      cell: (p) => (
        <span className="block min-w-0">
          <span className="block truncate text-[13px] font-medium">{p.name}</span>
          <span className="block text-[11px] text-fg-3">
            {p.termMonths} month{p.termMonths === 1 ? "" : "s"} · ceiling {pct(p.maxMonthlyRatePct)}/mo
          </span>
        </span>
      ),
    },
    { key: "s", header: "Status", cell: (p) => <StatusPill map={PLAN_STATUS} status={p.status} /> },
    { key: "a", header: "Active principal", align: "right", cell: (p) => <Amount value={p.stats.activePrincipal} currency={p.currency} className="text-[13px] font-medium" /> },
    { key: "i", header: "Investors", align: "right", hideOn: "md", cell: (p) => <span className="k-num">{int(p.stats.investors)}<span className="block text-[10.5px] text-fg-3">{int(p.stats.activePositions)} active</span></span> },
    {
      key: "c",
      header: "Capacity",
      hideOn: "lg",
      cell: (p) =>
        p.capacity === null ? (
          <span className="text-[12px] text-fg-3">Unlimited</span>
        ) : (
          <span className="block w-32">
            <Progress value={((p.capacity - (p.capacityLeft ?? 0)) / p.capacity) * 100} tone={(p.capacityLeft ?? 0) <= 0 ? "down" : "gold"} />
            <span className="mt-1 block text-[10.5px] text-fg-3">{amtK(p.capacityLeft ?? 0)} left of {amtK(p.capacity)}</span>
          </span>
        ),
    },
  ];
  return (
    <Card className="h-full">
      <CardHeader title="Plans" subtitle={`${int(ov.plans.filter((p) => p.status === "active").length)} on sale · ${int(ov.plans.length)} in total`} action={<LinkButton href="/staking/plans">Manage plans</LinkButton>} />
      <div className="px-4 pb-5 pt-4 sm:px-6">
        <DataTable
          columns={cols}
          rows={ov.plans}
          dense
          pageSize={8}
          rowKey={(p) => String(p.id)}
          onRowClick={(p) => router.push(`/staking/plans?plan=${p.id}`)}
          empty={<EmptyNote className="mt-3" title="No plans yet" text="Create a plan with its term, limits, rate ceiling and risk disclosure, then put it on sale." action={<LinkButton href="/staking/plans" variant="ember">Create a plan</LinkButton>} />}
        />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function LiveStakingOverview() {
  const { data: ov, error, reload } = useApi<Overview>(S("overview"), { refreshMs: 60_000 });
  const cur = ov?.currencies[0] ?? "USDT";
  const latest = ov?.monthly.at(-1);

  return (
    <div className="pb-16">
      <PageHeader
        title="Staking"
        subtitle="Client positions, monthly returns and settlements. Rates are set month by month and never promised in advance."
        actions={
          <>
            <Button variant="surface" onClick={reload}>
              <RefreshCw /> Refresh
            </Button>
            <Link href="/staking/rates">
              <Button variant="surface">
                <Percent /> Monthly rates
              </Button>
            </Link>
            <Link href="/staking/settlements">
              <Button variant="ember">
                Settlements <ArrowUpRight />
              </Button>
            </Link>
          </>
        }
      />

      {error && !ov ? (
        <StakingError error={error} onRetry={reload} />
      ) : !ov ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-[20px]" />
            ))}
          </div>
          <Skeleton className="h-80 w-full rounded-[20px]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Liability"
              icon={<Landmark />}
              value={<Amount value={ov.liability} currency={cur} />}
              chip={ov.pendingPayment > 0 ? `+ ${amt(ov.pendingPayment, cur)} awaiting payment` : "Principal owed back to clients"}
              chipTone={ov.pendingPayment > 0 ? "warn" : "neutral"}
              href="/staking/positions?status=active"
            />
            <KpiCard
              label="Investors"
              icon={<Users />}
              value={<span className="k-num">{int(ov.investors)}</span>}
              chip={`${int(ov.activePositions)} active · ${int(ov.maturedPositions)} matured`}
              href="/staking/positions"
              delay={0.05}
            />
            <KpiCard
              label="Returns paid"
              icon={<Coins />}
              value={<Amount value={ov.returnsPaid} currency={cur} />}
              chip={latest ? `${monthName(latest.period, "short")}: ${amt(latest.amount, cur)}` : "No settlement paid yet"}
              chipTone={latest ? "gold" : "neutral"}
              href="/staking/settlements"
              delay={0.1}
            />
            <KpiCard
              label="Maturing in 30 days"
              icon={<CalendarClock />}
              value={<Amount value={ov.maturing30d.principal} currency={cur} />}
              chip={`${int(ov.maturing30d.count)} position${ov.maturing30d.count === 1 ? "" : "s"} · returned automatically`}
              href="/staking/positions?status=active"
              delay={0.15}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Reveal delay={0.05} className="min-w-0 xl:col-span-8">
              <LastMonthCard ov={ov} cur={cur} />
            </Reveal>
            <Reveal delay={0.1} className="min-w-0 xl:col-span-4">
              <AttentionCard ov={ov} />
            </Reveal>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12 xl:items-start">
            <Reveal delay={0.05} className="min-w-0 xl:col-span-7">
              <PlansCard ov={ov} />
            </Reveal>
            <Reveal delay={0.1} className="min-w-0 xl:col-span-5">
              <MonthlyCard ov={ov} cur={cur} />
            </Reveal>
          </div>
        </>
      )}
    </div>
  );
}
