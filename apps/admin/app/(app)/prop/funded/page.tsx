"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpCircle, CalendarCheck, CircleDollarSign, Download, Landmark, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, KpiCard, Money, PageHeader, Progress, Reveal, StatusChip, cn, type Column } from "@ezymex/ui";
import { PersonCell, SegBar, auditToast, useReason } from "@/components/config/kit";
import { FUNDED, PLANS, type FundedAccount } from "@/components/prop/data";
import { FUNDED_STATUS, FundedDrawer, eligibility } from "@/components/prop/funded-drawer";
import { FilterPills } from "@/components/prop/rules";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveFundedPage } from "@/components/prop-live/funded";

export default function FundedPage() {
  return IS_DEMO ? <DemoFundedPage /> : <LiveFundedPage />;
}

type F = "all" | "eligible" | "scaling" | "review" | "paused";

function DemoFundedPage() {
  const [rows, setRows] = React.useState<FundedAccount[]>(FUNDED);
  const [f, setF] = React.useState<F>("all");
  const [selId, setSelId] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const reason = useReason();

  const scalingDue = (a: FundedAccount) => {
    const p = PLANS.find((x) => x.id === a.planId)!;
    return a.profitPct >= p.scalingProfit * 0.7 && a.scalingLevel < 4;
  };
  const match = (a: FundedAccount, k: F) => (k === "all" ? true : k === "eligible" ? eligibility(a).now && a.profit > 0 : k === "scaling" ? scalingDue(a) : a.status === k);
  const filtered = rows.filter((a) => match(a, f));
  const sel = rows.find((a) => a.id === selId) ?? null;
  const capital = rows.reduce((s, a) => s + a.size, 0);
  const cycleProfit = rows.reduce((s, a) => s + Math.max(0, a.profit), 0);
  const eligibleShare = rows.filter((a) => match(a, "eligible")).reduce((s, a) => s + (a.profit * a.split) / 100, 0);

  const columns: Column<FundedAccount>[] = [
    { key: "trader", header: "Trader", cell: (a) => <PersonCell name={a.trader.name} photo={a.trader.photo} country={a.trader.country} sub={<span className="font-mono">#{a.login}</span>} verified={a.kyc} />, sort: (a) => a.trader.name },
    { key: "plan", header: "Plan", cell: (a) => <span className="whitespace-nowrap text-[12.5px] text-fg-2">{a.planName.replace("Ezymex ", "")}</span>, hideOn: "lg" },
    {
      key: "size",
      header: "Size",
      align: "right",
      cell: (a) => (
        <div>
          <div className="k-num font-medium">${a.size.toLocaleString()}</div>
          {a.size !== a.initialSize && <div className="k-num text-[11px] text-up">from ${(a.initialSize / 1000).toFixed(0)}K</div>}
        </div>
      ),
      sort: (a) => a.size,
    },
    { key: "split", header: "Split", align: "right", cell: (a) => <span className="k-num font-medium text-gold">{a.split}%</span>, sort: (a) => a.split, hideOn: "sm" },
    {
      key: "profit",
      header: "Profit",
      align: "right",
      cell: (a) => (
        <div>
          <Money value={a.profit} signed tone="auto" countUp={false} className="block text-[13.5px] font-medium" />
          <div className={cn("k-num text-[11px]", a.profitPct >= 0 ? "text-up/80" : "text-down/80")}>{a.profitPct.toFixed(2)}%</div>
        </div>
      ),
      sort: (a) => a.profit,
    },
    {
      key: "eligible",
      header: "Eligible",
      cell: (a) => {
        const e = eligibility(a);
        return e.now ? (
          <Chip size="sm" tone={a.profit > 0 ? "up" : "neutral"} dot>
            {a.profit > 0 ? "Eligible now" : "No profit"}
          </Chip>
        ) : (
          <span className="k-num text-[12.5px] text-fg-2">{e.text}</span>
        );
      },
      sort: (a) => a.eligibleOn,
    },
    {
      key: "scaling",
      header: "Scaling",
      cell: (a) => (
        <div className="w-24">
          <div className="mb-1 flex justify-between text-[11px]">
            <span className="text-fg-2">L{a.scalingLevel}</span>
            {scalingDue(a) && <span className="text-gold">due</span>}
          </div>
          <SegBar value={a.scalingLevel + 1} total={5} tone="gold" />
        </div>
      ),
      sort: (a) => a.scalingLevel,
      hideOn: "md",
    },
    {
      key: "consistency",
      header: "Consistency",
      cell: (a) => (
        <div className="flex w-24 items-center gap-2">
          <Progress value={a.consistency} tone={a.consistency >= 70 ? "up" : a.consistency >= 50 ? "warn" : "down"} />
          <span className="k-num w-6 text-right text-[12px]">{a.consistency}</span>
        </div>
      ),
      sort: (a) => a.consistency,
      hideOn: "md",
    },
    { key: "status", header: "Status", cell: (a) => <StatusChip status={FUNDED_STATUS[a.status].status} label={FUNDED_STATUS[a.status].label} /> },
  ];

  const top = [...rows].sort((a, b) => b.paidTotal - a.paidTotal).slice(0, 5);

  return (
    <div className="pb-24">
      <PageHeader
        title="Funded traders"
        subtitle="Simulated funded accounts: profit split, scaling and payout readiness."
        actions={
          <>
            <Button size="sm" variant="surface" onClick={() => toast.success("Funded book exported", { description: `${rows.length} accounts · funded-traders.csv` })}>
              <Download /> Export
            </Button>
            <Button
              size="sm"
              variant="ember"
              onClick={() => {
                const due = rows.filter(scalingDue);
                reason.ask({
                  title: "Run scaling review",
                  description: `${due.length} accounts meet ≥70% of the scaling profit requirement. Eligible accounts are promoted one level.`,
                  reasons: ["Scheduled quarterly review", "Ad-hoc review"],
                  confirmLabel: "Run review",
                  onConfirm: (r) => auditToast(`Scaling review queued for ${due.length} accounts`, r),
                });
              }}
            >
              <ArrowUpCircle /> Scaling review
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Funded accounts" icon={<Trophy />} value={<span className="k-num">318</span>} chip="+27 this month" chipTone="up" delay={0} />
        <KpiCard label="Simulated capital" icon={<Landmark />} value={<Money value={28_412_000} decimals={0} />} chip={`Sample: $${(capital / 1e6).toFixed(2)}M`} delay={0.05} />
        <KpiCard label="Cycle profit (open)" icon={<CircleDollarSign />} value={<Money value={cycleProfit * 11.4} decimals={0} />} chip="Unrealised trader + firm" chipTone="gold" delay={0.1} />
        <KpiCard label="Eligible payouts" icon={<CalendarCheck />} value={<Money value={eligibleShare * 11.4} decimals={0} />} chip="Trader share, due now" chipTone="up" href="/prop/payouts" illustration="money_bag" delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="min-w-0 xl:col-span-12">
          <Card>
            <CardHeader title="Funded accounts" subtitle={`${filtered.length} accounts · click for scaling, split and payout history`} />
            <div className="px-4 pb-6 pt-4 sm:px-6">
              <DataTable
                columns={columns}
                rows={filtered}
                pageSize={10}
                dense
                rowKey={(a) => a.id}
                exportName="funded-traders"
                search={(a) => `${a.trader.name} ${a.login} ${a.planName}`}
                searchPlaceholder="Name or login…"
                onRowClick={(a) => {
                  setSelId(a.id);
                  setOpen(true);
                }}
                toolbar={
                  <FilterPills
                    value={f}
                    onChange={setF}
                    options={(["all", "eligible", "scaling", "review", "paused"] as F[]).map((k) => ({ value: k, label: { all: "All", eligible: "Payout eligible", scaling: "Scaling due", review: "In review", paused: "Paused" }[k], count: rows.filter((a) => match(a, k)).length }))}
                  />
                }
              />
            </div>
          </Card>
        </Reveal>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:col-span-12">
          <Reveal delay={0.15}>
            <Card>
              <CardHeader title="Top earners" subtitle="Lifetime payouts" />
              <div className="space-y-2 px-4 pb-5 pt-4 sm:px-5">
                {top.map((a, i) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setSelId(a.id);
                      setOpen(true);
                    }}
                    className="k-row flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-3/60"
                  >
                    <span className={cn("k-num w-4 text-[12px] font-semibold", i === 0 ? "text-gold" : "text-fg-3")}>{i + 1}</span>
                    <PersonCell name={a.trader.name} photo={a.trader.photo} sub={`$${(a.size / 1000).toFixed(0)}K · ${a.split}%`} size={28} />
                    <Money value={a.paidTotal} decimals={0} countUp={false} className="ml-auto text-[13px] font-medium text-gold" />
                  </button>
                ))}
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.2}>
            <Card>
              <CardHeader title="Split distribution" subtitle="Funded accounts by trader share" />
              <div className="space-y-2.5 px-4 pb-5 pt-4 sm:px-5">
                {[70, 75, 80, 85, 90].map((s) => {
                  const n = rows.filter((a) => a.split === s).length;
                  return (
                    <div key={s} className="flex items-center gap-3 text-[12.5px]">
                      <span className="k-num w-9 text-fg-2">{s}%</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <div className="h-full rounded-full bg-gold" style={{ width: `${(n / rows.length) * 100}%` }} />
                      </div>
                      <span className="k-num w-5 text-right text-fg-3">{n}</span>
                    </div>
                  );
                })}
                <Link href="/prop/plans" className="block pt-1 text-[12px] text-fg-3 hover:text-ember">
                  Edit split rules in Plan builder →
                </Link>
              </div>
            </Card>
          </Reveal>
        </div>
      </div>

      <FundedDrawer a={sel} open={open} onOpenChange={setOpen} reason={reason} onUpdate={(n) => setRows((rs) => rs.map((a) => (a.id === n.id ? n : a)))} />
      {reason.node}
    </div>
  );
}
