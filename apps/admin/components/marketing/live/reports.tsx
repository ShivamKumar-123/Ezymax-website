"use client";

import * as React from "react";
import { Coins, Gift, HandCoins, RefreshCw, Trophy, Wallet } from "lucide-react";
import { Button, Card, CardHeader, DataTable, KpiCard, PageHeader, Reveal, Segmented, type Column } from "@kalks/ui";
import { TableSkeleton, qs, useApi } from "@/components/live/kit";
import { StackedBars } from "@/components/marketing/stacked-bars";
import { M, type Report } from "./api";
import { EmptyNote, MkError, Tile, int, num, usd, usdK } from "./kit";

const SERIES = [
  { key: "bonus" as const, label: "Bonus released", color: "var(--k-ember)" },
  { key: "cashback" as const, label: "Cashback", color: "var(--k-gold)" },
  { key: "prizes" as const, label: "Contest prizes", color: "var(--k-up)" },
  { key: "points" as const, label: "Points redeemed", color: "var(--k-info)" },
];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
};
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDay = (s: string) => {
  const [, m, d] = s.split("-");
  return `${Number(d)} ${MON[Number(m) - 1] ?? ""}`;
};

type Preset = "7" | "30" | "90" | "custom";

export function LiveReports() {
  const [preset, setPreset] = React.useState<Preset>("30");
  const [from, setFrom] = React.useState(daysAgo(29));
  const [to, setTo] = React.useState(daysAgo(0));
  const pick = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      setFrom(daysAgo(Number(p) - 1));
      setTo(daysAgo(0));
    }
  };
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;
  const { data, error, loading, reload } = useApi<Report>(valid ? `${M("reports")}${qs({ from, to })}` : null);
  const t = data?.totals;
  const series = (data?.series ?? []).map((s) => ({ label: shortDay(s.day), bonus: s.bonus || 0, cashback: s.cashback || 0, prizes: s.prizes || 0, points: s.points || 0 }));
  const hasSeries = series.some((s) => s.bonus + s.cashback + s.prizes + s.points > 0);

  const campCols: Column<Report["byCampaign"][number]>[] = [
    { key: "n", header: "Campaign", cell: (r) => <span className="font-medium">{r.name}</span>, sort: (r) => r.name, csv: (r) => r.name },
    { key: "c", header: "Claims", align: "right", cell: (r) => <span className="k-num">{int(r.claims)}</span>, sort: (r) => r.claims, csv: (r) => r.claims },
    { key: "i", header: "Issued", align: "right", cell: (r) => <span className="k-num text-fg-2">{usd(r.issued)}</span>, sort: (r) => r.issued, csv: (r) => r.issued },
    { key: "r", header: "Released (cost)", align: "right", cell: (r) => <span className="k-num font-medium text-ember">{usd(r.released)}</span>, sort: (r) => r.released, csv: (r) => r.released },
    { key: "f", header: "Forfeited", align: "right", cell: (r) => <span className="k-num text-fg-3">{usd(r.forfeited)}</span>, sort: (r) => r.forfeited, csv: (r) => r.forfeited },
  ];
  const progCols: Column<Report["byProgramme"][number]>[] = [
    { key: "n", header: "Programme", cell: (r) => <span className="font-medium">{r.name}</span>, sort: (r) => r.name, csv: (r) => r.name },
    { key: "l", header: "Lots", align: "right", cell: (r) => <span className="k-num">{num(r.lots)}</span>, sort: (r) => r.lots, csv: (r) => r.lots },
    { key: "a", header: "Accrued", align: "right", cell: (r) => <span className="k-num text-fg-2">{usd(r.accrued)}</span>, sort: (r) => r.accrued, csv: (r) => r.accrued },
    { key: "p", header: "Paid (cost)", align: "right", cell: (r) => <span className="k-num font-medium text-gold">{usd(r.paid)}</span>, sort: (r) => r.paid, csv: (r) => r.paid },
  ];
  const contCols: Column<Report["byContest"][number]>[] = [
    { key: "n", header: "Contest", cell: (r) => <span className="font-medium">{r.name}</span>, sort: (r) => r.name, csv: (r) => r.name },
    { key: "e", header: "Entrants", align: "right", cell: (r) => <span className="k-num">{int(r.entrants)}</span>, sort: (r) => r.entrants, csv: (r) => r.entrants },
    { key: "p", header: "Prizes paid", align: "right", cell: (r) => <span className="k-num font-medium text-up">{usd(r.prizes)}</span>, sort: (r) => r.prizes, csv: (r) => r.prizes },
  ];
  const dayCols: Column<Report["series"][number]>[] = [
    { key: "d", header: "Day", cell: (r) => <span className="k-num">{r.day}</span>, sort: (r) => r.day, csv: (r) => r.day },
    ...SERIES.map((s) => ({ key: s.key, header: s.label, align: "right" as const, cell: (r: Report["series"][number]) => <span className="k-num">{usd(r[s.key])}</span>, csv: (r: Report["series"][number]) => r[s.key] })),
    { key: "t", header: "Total", align: "right", cell: (r) => <span className="k-num font-medium">{usd(r.bonus + r.cashback + r.prizes + r.points)}</span>, csv: (r) => r.bonus + r.cashback + r.prizes + r.points },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="Promotion costs"
        subtitle="What bonuses, cashback, contest prizes and redeemed points cost the broker over a period. Issued bonus is shown separately: it is not cash until released."
        actions={
          <Button variant="surface" onClick={reload} disabled={!valid}>
            <RefreshCw /> Refresh
          </Button>
        }
      />

      <Card className="mb-4 flex flex-wrap items-end gap-3 px-5 py-4">
        <Segmented
          size="sm"
          value={preset}
          onChange={pick}
          options={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
            { value: "custom", label: "Custom" },
          ]}
        />
        <label className="flex flex-col gap-1 text-[12px] font-medium text-fg-2">
          From
          <input type="date" value={from} max={to} onChange={(e) => (setFrom(e.target.value), setPreset("custom"))} className="k-num h-9 rounded-[10px] border border-line bg-surface-2 px-2.5 text-[13px] text-fg outline-none [color-scheme:dark]" />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-medium text-fg-2">
          To
          <input type="date" value={to} min={from} onChange={(e) => (setTo(e.target.value), setPreset("custom"))} className="k-num h-9 rounded-[10px] border border-line bg-surface-2 px-2.5 text-[13px] text-fg outline-none [color-scheme:dark]" />
        </label>
        {!valid && <span className="text-[12px] text-down">From must be on or before To.</span>}
        {loading && data && <span className="text-[12px] text-fg-3">Updating…</span>}
      </Card>

      {error && !data ? (
        <MkError error={error} onRetry={reload} />
      ) : !data ? (
        <TableSkeleton rows={6} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Total cost" icon={<Wallet />} value={<span className="k-num">{usdK(t!.total)}</span>} chip="Released + cashback + prizes + points" chipTone="ember" />
            <KpiCard label="Bonus released" icon={<Gift />} value={<span className="k-num">{usdK(t!.bonusReleased)}</span>} chip={`Issued ${usdK(t!.bonusIssued)} · forfeited ${usdK(t!.bonusForfeited)}`} delay={0.05} />
            <KpiCard label="Cashback paid" icon={<HandCoins />} value={<span className="k-num">{usdK(t!.cashbackPaid)}</span>} chip={`Accrued ${usdK(t!.cashbackAccrued)}`} chipTone="gold" delay={0.1} />
            <KpiCard label="Prizes paid" icon={<Trophy />} value={<span className="k-num">{usdK(t!.prizesPaid)}</span>} chip={`Points ${usdK(t!.pointsRedeemedUsd)}`} chipTone="up" delay={0.15} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="Points redeemed (value)" value={usd(t!.pointsRedeemedUsd)} />
            <Tile label="Redemption cash paid" value={usd(t!.redemptionCashPaid)} />
            <Tile label="Promo redemptions" value={int(t!.promoRedemptions)} />
            <Tile label="Period" value={`${data.from.slice(0, 10)} → ${data.to.slice(0, 10)}`} />
          </div>

          <Reveal delay={0.05} className="mt-4">
            <Card>
              <CardHeader
                title="Daily cost"
                subtitle="Stacked by source"
                icon={<Coins />}
                action={
                  <div className="flex flex-wrap items-center gap-3 text-[12px] text-fg-2">
                    {SERIES.map((s) => (
                      <span key={s.key} className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full" style={{ background: s.color }} />
                        {s.label}
                      </span>
                    ))}
                  </div>
                }
              />
              <div className="px-4 pb-6 pt-5 sm:px-6">
                {hasSeries ? <StackedBars data={series} series={SERIES} height={260} labelEvery={Math.max(1, Math.round(series.length / 8))} format={(v) => usd(v, 0)} /> : <EmptyNote title="No promotion costs in this period" />}
              </div>
            </Card>
          </Reveal>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Reveal delay={0.05}>
              <Card className="h-full">
                <CardHeader title="By bonus campaign" />
                <div className="mt-4 px-4 pb-5 sm:px-6">
                  <DataTable columns={campCols} rows={data.byCampaign} pageSize={10} dense rowKey={(r) => String(r.id)} exportName={`promo-cost-campaigns-${from}-${to}`} empty={<EmptyNote className="mt-3" title="No bonus activity" />} />
                </div>
              </Card>
            </Reveal>
            <Reveal delay={0.1}>
              <Card className="h-full">
                <CardHeader title="By cashback programme" />
                <div className="mt-4 px-4 pb-5 sm:px-6">
                  <DataTable columns={progCols} rows={data.byProgramme} pageSize={10} dense rowKey={(r) => String(r.id)} exportName={`promo-cost-cashback-${from}-${to}`} empty={<EmptyNote className="mt-3" title="No cashback activity" />} />
                </div>
              </Card>
            </Reveal>
            <Reveal delay={0.1}>
              <Card className="h-full">
                <CardHeader title="By contest" />
                <div className="mt-4 px-4 pb-5 sm:px-6">
                  <DataTable columns={contCols} rows={data.byContest} pageSize={10} dense rowKey={(r) => String(r.id)} exportName={`promo-cost-contests-${from}-${to}`} empty={<EmptyNote className="mt-3" title="No prizes paid" />} />
                </div>
              </Card>
            </Reveal>
            <Reveal delay={0.15}>
              <Card className="h-full">
                <CardHeader title="By day" />
                <div className="mt-4 px-4 pb-5 sm:px-6">
                  <DataTable columns={dayCols} rows={[...data.series].reverse()} pageSize={10} dense rowKey={(r) => r.day} exportName={`promo-cost-daily-${from}-${to}`} empty={<EmptyNote className="mt-3" title="No days in range" />} />
                </div>
              </Card>
            </Reveal>
          </div>
        </>
      )}
    </div>
  );
}
