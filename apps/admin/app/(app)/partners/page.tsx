"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, BarChart3, Download, Handshake, Layers, ShieldAlert, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, Donut, Flag, KpiCard, ListRow, Money, PageHeader, Reveal, Segmented, Sparkline, StatusChip, cn } from "@kalks/ui";
import { COMMISSION_MONTHS, FRAUD_FLAGS, FRAUD_LABEL, IB_KPIS, LEVELS, PARTNERS, PAYOUT_BATCHES, type PayoutBatch } from "@kalks/mock/admin-partners";
import { ColumnChart, FunnelBars, MiniStat } from "@/components/config/kit";
import { LEVEL_COLOR, LevelChip, ago, fmtInt, fmtLots, fmtUsdK } from "@/components/partners/common";
import { BatchLinesDialog, PendingBatchCard } from "@/components/partners/payout-batch";

function CommissionsCard() {
  const [by, setBy] = React.useState<"tier" | "product" | "cpa">("tier");
  const data = COMMISSION_MONTHS.map((m) => ({ label: m.label, values: by === "tier" ? [...m.tier] : by === "product" ? [...m.product] : [m.tier[0] + m.tier[1] + m.tier[2], m.cpa] }));
  const series =
    by === "tier"
      ? ([{ label: "Tier 1", tone: "ember" }, { label: "Tier 2", tone: "gold" }, { label: "Tier 3", tone: "fg3" }] as const)
      : by === "product"
        ? ([{ label: "Forex", tone: "ember" }, { label: "Metals", tone: "gold" }, { label: "Indices", tone: "info" }, { label: "Crypto", tone: "up" }, { label: "Other", tone: "fg3" }] as const)
        : ([{ label: "Rebates", tone: "ember" }, { label: "CPA", tone: "gold" }] as const);
  const last = COMMISSION_MONTHS[11]!;
  const prev = COMMISSION_MONTHS[10]!;
  const tot = (m: typeof last) => m.tier[0] + m.tier[1] + m.tier[2] + m.cpa;
  const ch = ((tot(last) - tot(prev)) / tot(prev)) * 100;
  return (
    <Card className="h-full">
      <CardHeader
        title="Network commissions"
        subtitle="Accrued per month · last 12 months"
        action={<Segmented size="xs" value={by} onChange={setBy} options={[{ value: "tier", label: "By tier" }, { value: "product", label: "By product" }, { value: "cpa", label: "Rebate vs CPA" }]} />}
      />
      <div className="grid grid-cols-2 gap-3 px-4 pt-4 sm:grid-cols-4 sm:px-6">
        <MiniStat label="Sep accrued" value={<Money value={tot(last)} countUp={false} />} sub={<span className={ch >= 0 ? "text-up" : "text-down"}>{ch >= 0 ? "+" : ""}{ch.toFixed(1)}% MoM</span>} />
        <MiniStat label="Network lots" value={fmtInt(last.lots)} sub="Sep, all tiers" />
        <MiniStat label="Avg $/lot" value={`$${(tot(last) / last.lots).toFixed(2)}`} sub="Blended incl. CPA" />
        <MiniStat label="Rev share" value={`${IB_KPIS.ibShareOfVolume}%`} sub="of total volume via IBs" tone="gold" />
      </div>
      <div className="px-4 pb-5 pt-5 sm:px-6">
        <ColumnChart data={data} series={[...series]} height={250} format={fmtUsdK} />
      </div>
    </Card>
  );
}

function LeaderboardCard() {
  const [metric, setMetric] = React.useState<"commission" | "lots" | "clients">("commission");
  const list = [...PARTNERS].sort((a, b) => (metric === "commission" ? b.commissionMtd - a.commissionMtd : metric === "lots" ? b.lotsMtd - a.lotsMtd : b.clientsActive - a.clientsActive)).slice(0, 8);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Top partners · September"
        subtitle="Ranked across the whole network"
        action={
          <>
            <Segmented size="xs" value={metric} onChange={setMetric} options={[{ value: "commission", label: "Commission" }, { value: "lots", label: "Lots" }, { value: "clients", label: "Clients" }]} />
            <Link href="/partners/list" className="hidden sm:block">
              <Button size="sm" variant="surface">All partners</Button>
            </Link>
          </>
        }
      />
      <div className="mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
        {list.map((p, i) => (
          <ListRow key={p.id} href={`/partners/list?partner=${p.id}`} className="gap-3 py-2.5">
            <span className={cn("k-num w-6 shrink-0 text-center text-[13px] font-semibold", i === 0 ? "text-gold" : i < 3 ? "text-fg" : "text-fg-3")}>{i + 1}</span>
            <Avatar src={p.photo} name={p.name} size={34} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[13.5px] font-medium">
                <span className="truncate">{p.name}</span>
                <Flag country={p.country} className="size-3.5" />
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-fg-3">
                <LevelChip level={p.level} />
                <span className="k-num hidden sm:inline">{p.clientsActive} active / {p.clientsTotal} clients</span>
              </div>
            </div>
            <Sparkline data={p.lotsSeries} width={72} height={26} tone="gold" className="hidden md:block" />
            <div className="hidden w-24 text-right sm:block">
              <div className="k-num text-[13px] font-medium">{fmtLots(p.lotsMtd)}</div>
              <div className="text-[11px] text-fg-3">lots MTD</div>
            </div>
            <div className="w-28 text-right">
              <Money value={p.commissionMtd} countUp={false} className="text-[14px] font-semibold" />
              <div className="text-[11px] text-fg-3">commission</div>
            </div>
          </ListRow>
        ))}
      </div>
    </Card>
  );
}

function LevelsCard() {
  const total = LEVELS.reduce((s, l) => s + l.partners, 0);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Level distribution" subtitle={`${fmtInt(total)} partners`} action={<Link href="/partners/levels"><Button size="sm" variant="surface">Levels</Button></Link>} />
      <div className="flex justify-center py-5">
        <Donut
          size={190}
          thickness={20}
          data={LEVELS.map((l) => ({ label: l.name, value: l.partners, color: LEVEL_COLOR[l.key] }))}
          center={
            <div>
              <div className="k-num text-[26px] font-semibold">{fmtInt(total)}</div>
              <div className="text-[11.5px] text-fg-3">partners</div>
            </div>
          }
        />
      </div>
      <div className="flex-1 space-y-1.5 px-4 pb-5 sm:px-6">
        {[...LEVELS].reverse().map((l) => (
          <div key={l.key} className="flex items-center gap-3 rounded-[12px] px-2 py-1.5 text-[13px] hover:bg-surface-2">
            <span className="size-2.5 rounded-full" style={{ background: LEVEL_COLOR[l.key] }} />
            <span className="flex-1 text-fg-2">{l.name}</span>
            <span className="k-num text-fg-3">×{l.benefits.rateMultiplier.toFixed(2)}</span>
            <span className="k-num w-12 text-right font-medium">{fmtInt(l.partners)}</span>
            <span className="k-num w-12 text-right text-fg-3">{((l.partners / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2 pt-3">
          <MiniStat label="Promoted · Sep" value={<span className="text-up">+23</span>} sub="auto-evaluated 01 Sep" />
          <MiniStat label="Demoted · Sep" value={<span className="text-down">-9</span>} sub="7-day grace applied" />
        </div>
      </div>
    </Card>
  );
}

function FunnelCard() {
  return (
    <Card className="h-full">
      <CardHeader title="Referral funnel" subtitle="Last 30 days · all partner links" action={<Chip tone="up">FTD 18.4%</Chip>} />
      <div className="px-4 pb-6 pt-5 sm:px-6">
        <FunnelBars
          steps={[
            { label: "Link clicks", value: 48_210 },
            { label: "Sign-ups", value: 9_866 },
            { label: "KYC passed", value: 6_402 },
            { label: "First deposit", value: 1_815 },
            { label: "Active traders", value: 1_342 },
          ]}
        />
      </div>
    </Card>
  );
}

function BatchesCard() {
  const [open, setOpen] = React.useState<PayoutBatch | null>(null);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Payout batches" subtitle="Click a batch to inspect its lines" action={<Button size="sm" variant="surface" onClick={() => toast.success("Batch schedule opened", { description: "Weekly batches cut Monday 00:05 GMT+3" })}>Schedule</Button>} />
      <div className="mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
        {PAYOUT_BATCHES.map((b) => (
          <ListRow key={b.id} onClick={() => setOpen(b)} className="py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[12.5px]">{b.id}</span>
                <Chip size="sm">{b.frequency}</Chip>
              </div>
              <div className="mt-0.5 truncate text-[11.5px] text-fg-3">{b.period} · <span className="k-num">{fmtInt(b.partners)}</span> partners</div>
            </div>
            <div className="text-right">
              <Money value={b.amount} countUp={false} className="text-[13px] font-medium" />
              <div className="mt-1"><StatusChip status={b.status} /></div>
            </div>
          </ListRow>
        ))}
      </div>
      {open && <BatchLinesDialog batch={open} open={!!open} onOpenChange={(o) => !o && setOpen(null)} />}
    </Card>
  );
}

function FraudWatchCard() {
  const open = FRAUD_FLAGS.filter((f) => f.status === "open" || f.status === "investigating").slice(0, 5);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Fraud watch" subtitle={`${open.length} open cases`} action={<Link href="/partners/fraud"><Button size="sm" variant="surface"><ShieldAlert /> Review</Button></Link>} />
      <div className="k-fade-bottom mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
        {open.map((f) => (
          <ListRow key={f.id} href={`/partners/fraud?flag=${f.id}`} className="relative overflow-hidden py-2.5 pl-5">
            <span className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r-full", f.severity === "critical" ? "bg-down" : f.severity === "high" ? "bg-ember" : "bg-warn")} />
            <Avatar src={f.partnerPhoto} name={f.partnerName} size={28} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{FRAUD_LABEL[f.type]}</div>
              <div className="truncate text-[11.5px] text-fg-3">{f.partnerName} · {ago(f.detected)}</div>
            </div>
            <Money value={f.affectedCommission} countUp={false} className="text-[12.5px] font-medium text-down" />
          </ListRow>
        ))}
      </div>
    </Card>
  );
}

export default function PartnersOverviewPage() {
  return (
    <div className="pb-16">
      <PageHeader
        title="IB overview"
        subtitle="Partner network performance, commissions and payouts · server time GMT+3"
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("IB performance report queued", { description: "September 2026 · PDF + CSV to your inbox" })}>
              <Download /> Export
            </Button>
            <Link href="/partners/plans">
              <Button variant="surface">
                <Layers /> Commission plans
              </Button>
            </Link>
            <Link href="/partners/list">
              <Button variant="ember" shimmer>
                Manage partners <ArrowUpRight />
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Partners" icon={<Handshake />} value={<span className="k-num">{fmtInt(IB_KPIS.partners)}</span>} chip={`+${IB_KPIS.newThisMonth} this month`} chipTone="up" href="/partners/list" />
        <KpiCard
          label="Active partners"
          icon={<Users />}
          value={<span className="k-num">{fmtInt(IB_KPIS.active)}</span>}
          chip={`${((IB_KPIS.active / IB_KPIS.partners) * 100).toFixed(1)}% with trading clients`}
          chipTone="neutral"
          href="/partners/list"
          delay={0.05}
        />
        <KpiCard label="Network lots MTD" icon={<BarChart3 />} value={<span className="k-num">{fmtLots(IB_KPIS.networkLotsMtd)}</span>} chip={`+${IB_KPIS.networkLotsDelta}% vs Aug pace`} chipTone="up" delay={0.1} />
        <KpiCard
          label="Commissions pending"
          icon={<Wallet />}
          value={<Money value={IB_KPIS.commissionPending} />}
          hot
          illustration="handshake"
          footer={
            <div className="flex items-center gap-1.5">
              <Chip size="sm" tone="up">Paid MTD {fmtUsdK(IB_KPIS.commissionPaidMtd)}</Chip>
              <Chip size="sm" tone="gold">CPA {fmtUsdK(IB_KPIS.cpaMtd)}</Chip>
            </div>
          }
          delay={0.15}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <CommissionsCard />
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-4">
          <PendingBatchCard />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <LeaderboardCard />
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-4">
          <LevelsCard />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Reveal delay={0.05}>
          <FunnelCard />
        </Reveal>
        <Reveal delay={0.1}>
          <BatchesCard />
        </Reveal>
        <Reveal delay={0.15} className="lg:col-span-2 xl:col-span-1">
          <FraudWatchCard />
        </Reveal>
      </div>
    </div>
  );
}
