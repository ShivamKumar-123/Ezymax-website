"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightLeft, ArrowUpFromLine, Banknote, CalendarClock, Check, CircleDollarSign, Clock, FileText, Gavel, Layers, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  CapsuleBars,
  Card,
  CardHeader,
  Chip,
  DataTable,
  Icon3D,
  KpiCard,
  Money,
  PageHeader,
  Reveal,
  Starfield,
  StatusChip,
  cn,
  formatDateTime,
  formatMoney,
  type Column,
} from "@/components/kit";
import { WALLET } from "@kalks/mock";
import { PARTNER, PAYOUT_BATCHES, PAYOUT_SCHEDULE, type PayoutBatch } from "@kalks/mock/partner";
import { fmtDT } from "@/components/partner/partner-bits";
import { IS_DEMO } from "@kalks/mock/mode";
import { LivePartnerPayouts } from "@/components/partner/live/payouts";

function useCountdown(target: string) {
  const [left, setLeft] = React.useState<number | null>(null);
  React.useEffect(() => {
    const t = Date.parse(target);
    const tick = () => setLeft(Math.max(0, t - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return left;
}

function Countdown({ target }: { target: string }) {
  const left = useCountdown(target);
  const parts = left === null ? ["--", "--", "--", "--"] : [Math.floor(left / 86400000), Math.floor(left / 3600000) % 24, Math.floor(left / 60000) % 60, Math.floor(left / 1000) % 60].map((v) => String(v).padStart(2, "0"));
  return (
    <div className="flex items-center gap-1.5">
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center">
            <span className="k-num min-w-[46px] rounded-[12px] border border-white/10 light:border-line bg-black/35 light:bg-white/70 px-2 py-2 text-center font-mono text-[22px] font-semibold leading-none">{p}</span>
            <span className="mt-1 text-[11px] text-fg-3">{["days", "hrs", "min", "sec"][i]}</span>
          </div>
          {i < 3 && <span className="-mt-4 font-mono text-fg-3">:</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

function Hero() {
  const cur = PAYOUT_BATCHES[0]!;
  const pending = PARTNER.pendingCommission;
  const approved = PARTNER.approvedCommission;
  const total = cur.amount;
  return (
    <Card hot className="h-full overflow-hidden">
      <Starfield density={60} />
      <div className="relative flex h-full flex-col gap-6 p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="k-label text-ember">Current batch · {cur.id}</div>
            <Money value={total} className="mt-2 block text-[40px] font-semibold leading-none tracking-tight" />
            <div className="mt-2 text-[13px] text-fg-2">
              Accruing for {cur.period} · {cur.events} qualifying events incl. {formatMoney(cur.cpa, "USD", 0)} CPA
            </div>
          </div>
          <Chip tone="warn" dot>
            Awaiting approval
          </Chip>
        </div>

        <div className="max-w-xl">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-info" style={{ width: `${(approved / total) * 100}%` }} />
            <div className="h-full bg-warn" style={{ width: `${(pending / total) * 100}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px]">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-info" /> Approved <span className="k-num font-medium">{formatMoney(approved)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-warn" /> Pending review <span className="k-num font-medium">{formatMoney(pending)}</span>
            </span>
            {cur.cpa > 0 && (
              <span className="flex items-center gap-1.5 text-fg-3">
                <Sparkles className="size-3 text-gold" /> CPA included
              </span>
            )}
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-end gap-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[12.5px] text-fg-2">
              <CalendarClock className="size-4 text-ember" /> Next payout · Mon 28 Sep, 12:00 GMT+3
            </div>
            <Countdown target={PAYOUT_SCHEDULE.nextBatch} />
          </div>
          <div className="text-[12px] text-fg-3">
            Minimum payout {formatMoney(PAYOUT_SCHEDULE.minPayout, "USD", 0)} · below that, the balance rolls into next week
          </div>
        </div>
      </div>
    </Card>
  );
}

function WalletNote() {
  const usdt = WALLET.assets[0]!;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Where payouts go" subtitle="Straight to your Kalks wallet" icon={<Wallet />} />
      <div className="flex flex-1 flex-col gap-4 px-4 pb-5 pt-4 sm:px-6">
        <div className="k-row flex items-center gap-3 px-4 py-3">
          <img src="/assets/coins/usdt.svg" alt="USDT" className="size-9 rounded-full" />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] text-fg-3">Wallet · USDT (TRC20)</div>
            <Money value={usdt.balance} className="text-[18px] font-semibold" />
          </div>
          <Chip size="sm" tone="up">
            Instant credit
          </Chip>
        </div>
        <ol className="space-y-3">
          {[
            { icon: <Banknote />, t: "Batch is credited to your wallet in USDT", s: "No fees, no minimum hold" },
            { icon: <ArrowRightLeft />, t: "Transfer to any trading account", s: "Internal transfers are instant" },
            { icon: <ArrowUpFromLine />, t: "Or withdraw to your TRC20 address", s: "$1 network fee · usually under 10 minutes" },
          ].map((x, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-2 [&_svg]:size-3.5">{x.icon}</span>
              <div>
                <div className="text-[13px] font-medium">{x.t}</div>
                <div className="text-[12px] text-fg-3">{x.s}</div>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-auto grid grid-cols-2 gap-2">
          <Link href="/wallet">
            <Button variant="surface" size="sm" className="w-full">
              <Wallet /> Open wallet
            </Button>
          </Link>
          <Link href="/wallet">
            <Button variant="ember" size="sm" className="w-full">
              <ArrowRightLeft /> Transfer
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

function ScheduleCard() {
  const steps = [
    { icon: <Layers />, t: "Commission accrues", s: "Mon 00:00 → Sun 23:59 GMT+3", state: "done" },
    { icon: <Clock />, t: "Weekly cut-off", s: PAYOUT_SCHEDULE.cutoff, state: "current" },
    { icon: <Gavel />, t: "Admin approval", s: PAYOUT_SCHEDULE.approval, state: "next" },
    { icon: <Wallet />, t: "Credited to wallet", s: "Monday by 12:00 GMT+3", state: "next" },
  ];
  return (
    <Card className="h-full">
      <CardHeader title="Payout schedule" subtitle={`${PAYOUT_SCHEDULE.frequency} · after admin approval`} icon={<CalendarClock />} />
      <ol className="relative px-6 pb-6 pt-5">
        {steps.map((st, i) => (
          <li key={st.t} className="relative flex gap-4 pb-5 last:pb-0">
            {i < steps.length - 1 && <span className={cn("absolute left-[17px] top-9 h-[calc(100%-28px)] w-px", st.state === "done" ? "bg-up/50" : "bg-line")} />}
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full border [&_svg]:size-4",
                st.state === "done" && "border-up/40 bg-up-soft text-up",
                st.state === "current" && "border-ember/50 bg-ember-soft text-ember shadow-[0_0_20px_-4px_color-mix(in_oklab,var(--k-ember)_70%,transparent)]",
                st.state === "next" && "border-line bg-surface-2 text-fg-3",
              )}
            >
              {st.state === "done" ? <Check /> : st.icon}
            </span>
            <div className="pt-1">
              <div className="flex items-center gap-2 text-[13.5px] font-medium">
                {st.t}
                {st.state === "current" && (
                  <Chip size="sm" tone="ember">
                    Next
                  </Chip>
                )}
              </div>
              <div className="text-[12px] text-fg-3">{st.s}</div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function HistoryChart() {
  const data = [...PAYOUT_BATCHES].slice(1, 13).reverse();
  const avg = data.reduce((s, b) => s + b.amount, 0) / data.length;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Last 12 payouts" subtitle={`Average ${formatMoney(avg)} per week`} action={<Chip tone="up">All paid on time</Chip>} />
      <div className="flex-1 px-4 pb-5 pt-8 sm:px-6">
        <CapsuleBars data={data.map((b) => ({ label: b.period.slice(-6).replace(" ", " "), value: b.amount }))} height={220} format={(v) => formatMoney(v, "USD", 0)} className="gap-1.5 sm:gap-3 [&>div>span]:whitespace-nowrap [&>div>span]:text-[10px]" />
      </div>
    </Card>
  );
}

function DemoPartnerPayoutsPage() {
  const paid = PAYOUT_BATCHES.filter((b) => b.status === "completed");
  const last = paid[0]!;
  const avg = paid.slice(0, 12).reduce((s, b) => s + b.amount, 0) / 12;
  const cpaTotal = paid.reduce((s, b) => s + b.cpa, 0);
  const allTotal = paid.reduce((s, b) => s + b.amount, 0);

  const columns: Column<PayoutBatch>[] = [
    {
      key: "id",
      header: "Batch",
      cell: (b) => (
        <span className="block">
          <span className="font-mono text-[12.5px]">{b.id}</span>
          <span className="block text-[11.5px] text-fg-3">{b.period}</span>
        </span>
      ),
      sort: (b) => b.periodEnd,
    },
    { key: "events", header: "Events", align: "right", cell: (b) => <span className="k-num text-fg-2">{b.events}</span>, hideOn: "md" },
    { key: "lot", header: "Lot commission", align: "right", cell: (b) => <span className="k-num">{formatMoney(b.lotCommission)}</span>, sort: (b) => b.lotCommission },
    { key: "cpa", header: "CPA", align: "right", cell: (b) => (b.cpa ? <span className="k-num text-gold">{formatMoney(b.cpa, "USD", 0)}</span> : <span className="text-fg-3">—</span>), hideOn: "sm" },
    { key: "adj", header: "Adjustments", align: "right", cell: (b) => (b.adjustments ? <span className="k-num text-down">{formatMoney(b.adjustments)}</span> : <span className="text-fg-3">—</span>), hideOn: "lg" },
    { key: "amount", header: "Amount", align: "right", cell: (b) => <Money value={b.amount} countUp={false} className="font-semibold" />, sort: (b) => b.amount },
    { key: "status", header: "Status", cell: (b) => (b.status === "pending" ? <StatusChip status="pending" label="Accruing" /> : <StatusChip status={b.status} label={b.status === "completed" ? "Paid" : undefined} />) },
    { key: "paid", header: "Paid at", cell: (b) => <span className="k-num text-fg-2">{b.paidAt ? fmtDT(b.paidAt) : "Mon 28 Sep"}</span>, hideOn: "md" },
    {
      key: "tx",
      header: "Wallet tx",
      align: "right",
      cell: (b) =>
        b.walletTx ? (
          <Link href="/wallet" className="font-mono text-[12px] text-fg-2 underline decoration-line underline-offset-4 hover:text-fg">
            {b.walletTx}
          </Link>
        ) : (
          <span className="text-fg-3">—</span>
        ),
    },
  ];

  return (
    <div className="pb-24">
      <PageHeader
        title="Payouts"
        subtitle="Commission is paid weekly in batches, after admin approval, into your wallet."
        actions={
          <Button variant="surface" size="lg" onClick={() => toast.success("Payout statement generated", { description: "kalks-ib-payouts-2026.pdf" })}>
            <FileText /> Annual statement
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-8">
          <Hero />
        </Reveal>
        <Reveal delay={0.05} className="xl:col-span-4">
          <WalletNote />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Paid all-time" icon={<CircleDollarSign />} value={<Money value={PARTNER.paidAllTime} />} chip="since Mar 2024" />
        <KpiCard label="Last payout" icon={<Banknote />} value={<Money value={last.amount} />} chip={fmtDT(last.paidAt!)} chipTone="up" delay={0.04} />
        <KpiCard label="Average week" icon={<TrendingUp />} value={<Money value={avg} />} chip="last 12 batches" delay={0.08} />
        <KpiCard label="CPA share" icon={<Sparkles />} value={<span className="k-num">{((cpaTotal / allTotal) * 100).toFixed(1)}%</span>} chip={`${formatMoney(cpaTotal, "USD", 0)} in bonuses`} chipTone="gold" delay={0.12} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-4">
          <ScheduleCard />
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-8">
          <HistoryChart />
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4 block">
        <Card>
          <CardHeader title="Batch history" subtitle="Every weekly batch and where it was credited" />
          <div className="px-4 pb-5 pt-4 sm:px-6">
            <DataTable columns={columns} rows={PAYOUT_BATCHES} rowKey={(b) => b.id} pageSize={10} exportName="kalks-ib-payouts" />
          </div>
        </Card>
      </Reveal>
    </div>
  );
}

export default function Page() {
  return IS_DEMO ? <DemoPartnerPayoutsPage /> : <LivePartnerPayouts />;
}
