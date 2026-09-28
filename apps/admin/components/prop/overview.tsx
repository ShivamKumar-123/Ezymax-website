"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, CircleDollarSign, ShieldAlert, Trophy, XCircle } from "lucide-react";
import { Avatar, Button, Card, CardHeader, Chip, Donut, Money, Segmented, Sparkline, cn } from "@kalks/ui";
import { ColumnChart, FunnelBars } from "@/components/config/kit";
import { EVENTS, MONTHLY, OVERVIEW, PLANS, fmtAgo, type PropEvent } from "./data";
import { PlanTypeChip } from "./rules";

const fmtK = (v: number) => (v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${v}`);

export function FeesPayoutsCard() {
  const [range, setRange] = React.useState<"6M" | "12M">("12M");
  const rows = range === "6M" ? MONTHLY.slice(6) : MONTHLY;
  const fees = rows.reduce((s, m) => s + m.fees, 0);
  const payouts = rows.reduce((s, m) => s + m.payouts, 0);
  return (
    <Card className="h-full">
      <CardHeader title="Fees collected vs payouts" subtitle="Challenge fees (gross, after refunds) against trader payouts" action={<Segmented size="xs" value={range} onChange={setRange} options={["6M", "12M"] as const} />} />
      <div className="grid grid-cols-3 gap-3 px-4 pt-4 sm:px-6">
        <div className="k-row px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-fg-3">Fees</div>
          <Money value={fees} decimals={0} className="mt-1 block text-[17px] font-medium" />
        </div>
        <div className="k-row px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-fg-3">Payouts</div>
          <Money value={payouts} decimals={0} className="mt-1 block text-[17px] font-medium text-gold" />
        </div>
        <div className="k-row px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-fg-3">Payout ratio</div>
          <div className="k-num mt-1 text-[17px] font-medium">{((payouts / fees) * 100).toFixed(1)}%</div>
        </div>
      </div>
      <div className="px-4 pb-5 pt-5 sm:px-6">
        <ColumnChart
          mode="group"
          height={250}
          data={rows.map((m) => ({ label: m.label, values: [m.fees, m.payouts] }))}
          series={[
            { label: "Fees collected", tone: "ember" },
            { label: "Payouts", tone: "gold" },
          ]}
          format={fmtK}
        />
      </div>
    </Card>
  );
}

export function FunnelCard() {
  const f = OVERVIEW.funnel;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Trader funnel" subtitle="Last 90 days · all evaluation plans" action={<Chip tone="up">{((f[3].value / f[0].value) * 100).toFixed(1)}% to payout</Chip>} />
      <div className="px-4 pt-5 sm:px-6">
        <FunnelBars steps={f} />
      </div>
      <div className="flex-1 px-4 pt-5 sm:px-6">
        <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-fg-3">
          <span>Conversion by plan</span>
          <span>P1 → Funded</span>
        </div>
        <div className="divide-y divide-line">
          {[
            { name: "Classic 2-Step", p1: 5912, funded: 702, tone: "bg-ember" },
            { name: "Rapid 1-Step", p1: 3952, funded: 402, tone: "bg-gold" },
          ].map((r) => (
            <div key={r.name} className="flex items-center gap-3 py-2 text-[12.5px]">
              <span className={cn("size-2 rounded-full", r.tone)} />
              <span className="flex-1 text-fg-2">{r.name}</span>
              <span className="k-num text-fg-3">
                {r.p1.toLocaleString()} → {r.funded.toLocaleString()}
              </span>
              <span className="k-num w-12 text-right font-medium">{((r.funded / r.p1) * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 px-4 pb-6 sm:px-6">
        <div className="k-row px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-fg-3">Avg days to pass</div>
          <div className="k-num mt-1 text-[15px] font-medium">
            18.4 <span className="text-[12px] text-fg-3">P1</span> · 11.2 <span className="text-[12px] text-fg-3">P2</span>
          </div>
        </div>
        <div className="k-row px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-fg-3">Retry purchase rate</div>
          <div className="k-num mt-1 text-[15px] font-medium">
            38.6% <span className="text-[12px] text-up">+2.1pp</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

const MIX_COLORS = ["var(--k-ember)", "var(--k-gold)", "var(--k-up)", "var(--k-fg-3)"];

export function PlanMixCard() {
  const plans = PLANS.filter((p) => p.active > 0);
  const total = plans.reduce((s, p) => s + p.active, 0);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Plan mix"
        subtitle="Active accounts by plan"
        action={
          <Link href="/prop/plans">
            <Button size="sm" variant="surface">
              Plans
            </Button>
          </Link>
        }
      />
      <div className="flex flex-1 flex-col items-center gap-5 px-4 pb-6 pt-5 sm:px-6">
        <Donut
          size={168}
          thickness={20}
          data={plans.map((p, i) => ({ label: p.name, value: p.active, color: MIX_COLORS[i] }))}
          center={
            <div>
              <div className="k-num text-[22px] font-semibold">{total.toLocaleString()}</div>
              <div className="text-[11px] text-fg-3">accounts</div>
            </div>
          }
        />
        <div className="w-full min-w-0 flex-1 space-y-2">
          {plans.map((p, i) => (
            <Link key={p.id} href="/prop/plans" className="k-row flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-3/60">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: MIX_COLORS[i] }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{p.name.replace("Kalks ", "")}</div>
                <div className="k-num text-[11.5px] text-fg-3">
                  {p.sold30d} sold · 30d
                </div>
              </div>
              <div className="text-right">
                <div className="k-num text-[13px] font-medium">{((p.active / total) * 100).toFixed(1)}%</div>
                <div className="k-num text-[11px] text-fg-3">{fmtK(p.revenue30d)}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Card>
  );
}

const EVENT_META: Record<PropEvent["kind"], { icon: React.ReactNode; tone: string; label: string }> = {
  passed: { icon: <BadgeCheck className="size-3" />, tone: "bg-up text-white", label: "Passed" },
  breached: { icon: <XCircle className="size-3" />, tone: "bg-down text-white", label: "Breached" },
  funded: { icon: <Trophy className="size-3" />, tone: "bg-gold text-[#1a1204]", label: "Funded" },
  payout: { icon: <CircleDollarSign className="size-3" />, tone: "bg-ember text-white", label: "Payout" },
};

export function ActivityCard() {
  const [f, setF] = React.useState<"all" | "passed" | "breached">("all");
  const list = EVENTS.filter((e) => f === "all" || e.kind === f);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Recent passes & breaches"
        subtitle="Live · server time GMT+3"
        action={<Segmented size="xs" value={f} onChange={setF} options={[{ value: "all", label: "All" }, { value: "passed", label: "Passes" }, { value: "breached", label: "Breaches" }]} />}
      />
      <div className="k-fade-bottom mt-4 max-h-[372px] flex-1 space-y-2 overflow-hidden px-4 pb-5 sm:px-6">
        {list.map((e) => {
          const m = EVENT_META[e.kind];
          return (
            <Link key={e.id} href={e.kind === "payout" ? "/prop/payouts" : e.kind === "funded" ? "/prop/funded" : "/prop/challenges"} className="k-row flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-surface-3/60">
              <span className="relative">
                <Avatar src={e.trader.photo} name={e.trader.name} size={34} />
                <span className={cn("absolute -bottom-1 -right-1 grid size-[18px] place-items-center rounded-full ring-2 ring-surface-2", m.tone)}>{m.icon}</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 truncate text-[13px] font-medium">
                  {e.trader.name}
                  <span className="font-mono text-[11px] font-normal text-fg-3">#{e.login}</span>
                </div>
                <div className="truncate text-[11.5px] text-fg-3">{e.text}</div>
              </div>
              <div className="shrink-0 text-right">
                {e.amount !== undefined ? <Money value={e.amount} countUp={false} className={cn("block text-[12.5px] font-medium", e.kind === "payout" ? "text-gold" : "text-up")} /> : <Chip size="sm" tone={e.kind === "breached" ? "down" : "gold"}>{m.label}</Chip>}
                <div className="mt-0.5 text-[11px] text-fg-3">{fmtAgo(e.ts)}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

export function BreachReasonsCard() {
  const max = Math.max(...OVERVIEW.breachReasons.map((b) => b.value));
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Why challenges fail"
        subtitle="Share of 2,184 breaches · 30d"
        action={
          <Link href="/prop/violations">
            <Button size="sm" variant="surface">
              <ShieldAlert /> Violations
            </Button>
          </Link>
        }
      />
      <div className="flex-1 space-y-3 px-4 pb-4 pt-5 sm:px-6">
        {OVERVIEW.breachReasons.map((b, i) => (
          <div key={b.label}>
            <div className="mb-1 flex items-center justify-between text-[12.5px]">
              <span className="text-fg-2">{b.label}</span>
              <span className="k-num font-medium">{b.value}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-3">
              <div className={cn("h-full rounded-full", i === 0 ? "bg-down" : i === 1 ? "bg-down/70" : i === 4 ? "bg-ember" : "bg-fg-3/60")} style={{ width: `${(b.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mx-4 mb-5 flex items-center gap-3 rounded-[14px] border border-line bg-surface-2 px-4 py-3 sm:mx-6">
        <Sparkline data={[62, 58, 61, 55, 57, 52, 49, 51, 47, 46]} width={90} height={28} tone="up" />
        <div className="min-w-0 text-[12px] text-fg-3">
          Daily-loss breaches down <span className="text-up">-7.2pp</span> since equity-based basis on Rapid 1-Step.
        </div>
      </div>
    </Card>
  );
}

export function PlanPerformanceStrip() {
  return (
    <Card>
      <CardHeader
        title="Plan performance"
        subtitle="Sales trend (12 weeks), pass rate and revenue per plan"
        action={
          <Link href="/prop/plans">
            <Button size="sm" variant="surface">
              Open plan builder <ArrowUpRight />
            </Button>
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-3 px-4 pb-6 pt-4 sm:grid-cols-2 sm:px-6 xl:grid-cols-4">
        {PLANS.map((p) => (
          <Link key={p.id} href="/prop/plans" className="k-row flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-surface-3/60">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[13.5px] font-medium">{p.name}</span>
              <PlanTypeChip type={p.type} />
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="grid grid-cols-3 gap-3 text-[11px] text-fg-3">
                <div>
                  Active
                  <div className="k-num text-[13px] font-medium text-fg">{p.active.toLocaleString()}</div>
                </div>
                <div>
                  Pass
                  <div className="k-num text-[13px] font-medium text-fg">{p.type === "instant" ? "n/a" : p.passRate ? `${p.passRate}%` : "-"}</div>
                </div>
                <div>
                  Rev 30d
                  <div className="k-num text-[13px] font-medium text-fg">{p.revenue30d ? fmtK(p.revenue30d) : "-"}</div>
                </div>
              </div>
              {p.status === "active" ? <Sparkline data={p.trend} width={72} height={26} tone="ember" /> : <Chip size="sm">Draft</Chip>}
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
