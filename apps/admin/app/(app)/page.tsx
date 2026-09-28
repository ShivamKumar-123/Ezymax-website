"use client";

import { IS_DEMO } from "@kalks/mock/mode";
import { LiveCommandCenter } from "@/components/live/command-center";

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, Download, FileSpreadsheet, FileText, Plus, Scale, TrendingUp, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, KpiCard, Menu, Money, PageHeader, Reveal, cn } from "@kalks/ui";
import { OPS_KPIS } from "@kalks/mock/admin-ops";
import { useServerClock } from "@/components/command/kit";
import { AdjustmentDialog } from "@/components/command/adjustment-dialog";
import {
  AlertsCard,
  BookPnlCard,
  BookRiskCard,
  ExposureCard,
  KycQueueCard,
  RevenueCard,
  ToxicFlowCard,
  WalletsCard,
  WithdrawalQueueCard,
} from "@/components/command/overview";

function Num({ v, className }: { v: number; className?: string }) {
  return <span className={cn("k-num", className)}>{v.toLocaleString("en-US")}</span>;
}

function DemoCommandCenterPage() {
  const clock = useServerClock();
  const k = OPS_KPIS;
  return (
    <div className="pb-10">
      <PageHeader
        title="Command Center"
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2">
            {clock ? clock.date : "—"}
            <span className="text-fg-3">·</span>
            Server time <span className="k-num font-mono text-fg">{clock?.time ?? "--:--:--"}</span> GMT+3
            <Chip size="sm" tone="up" dot className="ml-1">
              All desks online
            </Chip>
          </span>
        }
        actions={
          <>
            <Menu
              width={230}
              items={[
                { label: "Snapshot as CSV", icon: <FileSpreadsheet />, onSelect: () => toast.success("command-center-2026-09-24.csv exported", { description: "KPIs, exposure, queues" }) },
                { label: "Daily ops report (PDF)", icon: <FileText />, onSelect: () => toast.success("Ops report generating…", { description: "We'll email it to you in ~1 min" }) },
              ]}
              trigger={
                <Button variant="surface" size="lg">
                  <Download /> Export
                </Button>
              }
            />
            <AdjustmentDialog
              trigger={
                <Button variant="ember" size="lg" shimmer>
                  <Plus /> Create adjustment
                </Button>
              }
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiCard label="Deposits today" icon={<ArrowDownLeft />} value={<Money value={k.depositsToday} />} chip={`+${k.depositsDelta}% · ${k.depositsCount} txs`} chipTone="up" href="/finance" />
        <KpiCard label="Withdrawals" icon={<ArrowUpRight />} value={<Money value={k.withdrawalsToday} />} chip={`${k.withdrawalsPending} pending`} chipTone="warn" href="/finance/withdrawals" delay={0.04} />
        <KpiCard label="Net deposits" icon={<Scale />} value={<Money value={k.netDeposits} />} chip={`+${k.netDelta}% vs 7d avg`} chipTone="up" href="/analytics/deposits" delay={0.08} />
        <KpiCard label="FTDs today" icon={<UserPlus />} value={<Num v={k.ftds} />} chip={`+${k.ftdsDelta} vs yesterday`} chipTone="up" href="/analytics/funnel" delay={0.12} />
        <KpiCard label="Active traders" icon={<Users />} value={<Num v={k.activeTraders} />} chip={<><span className="size-1.5 animate-pulse-dot rounded-full bg-up text-up" /> {k.online} online</>} chipTone="up" href="/clients" delay={0.16} />
        <KpiCard
          label="Book P&L today"
          icon={<TrendingUp />}
          value={<Money value={k.bookPnlToday} signed />}
          hot
          chip={`B-book ${k.bBookShare}% of flow`}
          chipTone="ember"
          href="/analytics"
          delay={0.2}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <ExposureCard />
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-4">
          <BookRiskCard />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <BookPnlCard />
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-4">
          <RevenueCard />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Reveal delay={0.05}>
          <WithdrawalQueueCard />
        </Reveal>
        <Reveal delay={0.1}>
          <KycQueueCard />
        </Reveal>
        <Reveal delay={0.15} className="lg:col-span-2 xl:col-span-1">
          <AlertsCard />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-8">
          <ToxicFlowCard />
        </Reveal>
        <Reveal delay={0.05} className="xl:col-span-4">
          <WalletsCard />
        </Reveal>
      </div>
    </div>
  );
}

/** Live builds: real data from the gateway / market-data. Demo builds: the mock showcase above. */
export default function Page() {
  return IS_DEMO ? <DemoCommandCenterPage /> : <LiveCommandCenter />;
}
