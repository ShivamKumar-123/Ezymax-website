"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, Coins, Loader2, Percent, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { T } from "@ezymex/i18n";
import { useT } from "@ezymex/i18n/react";
import { Button, Card, CardHeader, Chip, DataTable, KpiCard, Money, PageHeader, Reveal,  cn, type Column } from "@/components/kit";
// engine symbols include Ezymex FX Options series codes, which @ezymex/ui SymbolAvatar / SymbolCell (static list) throw on
import { TradeSymbolCell as SymbolCell } from "@/components/trading/instrument";
import { BannerSlot } from "./banner-slot";
import { errorToast, fmtDate, fmtDateTime, fmtDay, fmtLots, fmtUsd, growthApi, titleCase, useGrowth, type CashbackAccrual, type CashbackMe, type CashbackPayout, type CashbackProgramme } from "./api";
import { CardEmpty, DayBars, GrowthStatus, PageFallback } from "./ui";

function scope(p: CashbackProgramme, t: T) {
  const parts = [...p.assetClasses.map(titleCase), ...p.symbols];
  const what = parts.length ? parts.join(", ") : t("rewards.cashback.allInstruments");
  return p.accountGroups.length ? `${what} · ${p.accountGroups.join(", ")}` : what;
}

function ProgrammeRow({ p, onEnrolled }: { p: CashbackProgramme; onEnrolled: () => void }) {
  const t = useT();
  const [busy, setBusy] = React.useState(false);
  const cap = p.maxPerMonth;
  const capPct = cap ? Math.min(100, (p.earnedMonth / cap) * 100) : null;
  const enrol = async () => {
    setBusy(true);
    try {
      await growthApi(`cashback/${p.id}/enrol`, { body: {} });
      toast.success(t("rewards.cashback.toastEnrolled", { name: p.name }), { description: t("rewards.cashback.toastEnrolledText", { amount: fmtUsd(p.usdPerLot) }) });
      onEnrolled();
    } catch (e) {
      errorToast(t("rewards.cashback.enrolError"), e);
    } finally {
      setBusy(false);
    }
  };
  const active = !p.optIn || p.enrolled;
  return (
    <div className={cn("k-row px-4 py-3.5", active && "border-gold/25")} data-testid={`cashback-programme-${p.id}`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
            {p.name}
            {p.optIn ? (
              p.enrolled ? (
                <Chip size="sm" tone="up">
                  {t("rewards.cashback.enrolled")}
                </Chip>
              ) : (
                <Chip size="sm" tone="warn">
                  {t("rewards.cashback.optIn")}
                </Chip>
              )
            ) : (
              <Chip size="sm">{t("rewards.cashback.automatic")}</Chip>
            )}
          </div>
          <div className="truncate text-[11.5px] text-fg-3">{scope(p, t)}</div>
        </div>
        <div className="text-end">
          <div className="k-num text-[18px] font-semibold">{fmtUsd(p.usdPerLot)}</div>
          <div className="text-[10.5px] text-fg-3">{t("rewards.unit.perLot")}</div>
        </div>
      </div>
      {p.description && <p className="mt-2 text-[12px] leading-snug text-fg-3">{p.description}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-fg-3">
        <span>
          {t("rewards.cashback.thisMonth")} <span className="k-num font-medium text-up">{fmtUsd(p.earnedMonth)}</span> · <span className="k-num text-fg-2">{t("rewards.value.lots", { lots: fmtLots(p.lotsMonth) })}</span>
        </span>
        {p.endsAt && <span>{t("rewards.cashback.ends", { date: fmtDate(p.endsAt) })}</span>}
      </div>
      {capPct !== null && (
        <div className="mt-2">
          <div className="mb-1 flex justify-between text-[11px] text-fg-3">
            <span>{t("rewards.cashback.monthlyCap")}</span>
            <span className="k-num">
              {fmtUsd(p.earnedMonth)} / {fmtUsd(cap!)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className={cn("h-full rounded-full", capPct >= 100 ? "bg-warn" : "bg-gold")} style={{ width: `${capPct}%` }} />
          </div>
        </div>
      )}
      {p.optIn && !p.enrolled && (
        <Button size="sm" variant="ember" className="mt-3 w-full" disabled={busy} onClick={enrol} data-testid={`cashback-enrol-${p.id}`}>
          {busy && <Loader2 className="animate-spin" />} {t("rewards.cashback.enrol")}
        </Button>
      )}
    </div>
  );
}

export function LiveCashbackPage() {
  const t = useT();
  const { data, error, reload } = useGrowth<CashbackMe>("cashback", 60_000);
  const title = t("rewards.cashback.title");
  const subtitle = t("rewards.cashback.subtitle");
  if (!data) return <PageFallback title={title} subtitle={subtitle} error={error} onRetry={reload} top={<BannerSlot placement="rewards" />} rows={[{ cols: "sm:grid-cols-2 xl:grid-cols-4", h: "h-[150px]", n: 4 }, { cols: "xl:grid-cols-2", h: "h-[320px]", n: 2 }]} />;

  const { totals, programmes, accruals, payouts } = data;
  const series = data.series.map((d) => ({ label: fmtDay(d.day), value: d.amount }));
  const total30 = data.series.reduce((s, d) => s + d.amount, 0);
  const best = data.series.reduce<{ day: string; amount: number } | null>((m, d) => (!m || d.amount > m.amount ? d : m), null);
  const lotsMonth = programmes.reduce((s, p) => s + p.lotsMonth, 0);

  const accrualCols: Column<CashbackAccrual>[] = [
    { key: "date", header: t("common.date"), cell: (r) => <span className="k-num text-fg-2">{fmtDateTime(r.createdAt)}</span>, sort: (r) => r.createdAt, csv: (r) => r.createdAt, width: "150px" },
    { key: "deal", header: t("rewards.cashback.colDeal"), hideOn: "lg", cell: (r) => <span className="font-mono text-[12.5px] text-fg-3">#{r.dealId}</span>, csv: (r) => r.dealId },
    { key: "sym", header: t("rewards.cashback.colSymbol"), cell: (r) => <SymbolCell symbol={r.symbol} size={22} sub={<span className="font-mono">#{r.login}</span>} />, csv: (r) => r.symbol },
    { key: "prog", header: t("rewards.cashback.colProgramme"), hideOn: "md", cell: (r) => <span className="text-fg-2">{r.programme}</span>, csv: (r) => r.programme },
    { key: "lots", header: t("rewards.cashback.colLots"), align: "right", cell: (r) => <span className="k-num">{fmtLots(r.lots)}</span>, sort: (r) => r.lots, csv: (r) => r.lots },
    { key: "amt", header: t("rewards.cashback.colCashback"), align: "right", cell: (r) => <span className="k-num font-semibold text-up">+{fmtUsd(r.amount)}</span>, sort: (r) => r.amount, csv: (r) => r.amount },
    { key: "st", header: t("common.status"), align: "right", cell: (r) => <GrowthStatus status={r.status} />, csv: (r) => r.status },
  ];
  const payoutCols: Column<CashbackPayout>[] = [
    { key: "date", header: t("rewards.cashback.colCreated"), cell: (r) => <span className="k-num text-fg-2">{fmtDateTime(r.createdAt)}</span>, sort: (r) => r.createdAt },
    { key: "paid", header: t("rewards.cashback.colPaid"), hideOn: "sm", cell: (r) => <span className="k-num text-fg-2">{r.paidAt ? fmtDateTime(r.paidAt) : "—"}</span> },
    { key: "amt", header: t("common.amount"), align: "right", cell: (r) => <span className="k-num font-semibold">{fmtUsd(r.amount)}</span>, sort: (r) => r.amount },
    { key: "st", header: t("common.status"), align: "right", cell: (r) => <GrowthStatus status={r.status} /> },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Link href="/wallet">
            <Button variant="surface" size="lg">
              <Wallet /> {t("rewards.cashback.wallet")}
            </Button>
          </Link>
        }
      />
      <BannerSlot placement="rewards" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("rewards.cashback.kpiPending")} value={<Money value={totals.accrued} countUp={false} />} hot illustration="money_with_wings" chip={t("rewards.cashback.kpiPendingChip")} chipTone="ember" />
        <KpiCard label={t("rewards.cashback.kpiMonth")} icon={<TrendingUp />} value={<Money value={totals.month} countUp={false} />} chip={t("rewards.value.lots", { lots: fmtLots(lotsMonth) })} chipTone="up" delay={0.05} />
        <KpiCard label={t("rewards.cashback.kpiPaid")} icon={<CalendarClock />} value={<Money value={totals.paid} countUp={false} />} chip={payouts[0] ? t("rewards.cashback.kpiLast", { date: fmtDate(payouts[0].paidAt ?? payouts[0].createdAt, false) }) : t("rewards.cashback.kpiNoPayouts")} delay={0.1} href="/wallet" />
        <KpiCard label={t("rewards.cashback.kpiLifetime")} icon={<Coins />} value={<Money value={totals.lifetime} countUp={false} />} chip={t("rewards.cashback.programmesCount", { count: programmes.length })} delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader title={t("rewards.cashback.dailyTitle")} subtitle={t("rewards.cashback.dailySubtitle")} action={<Chip tone="ember">{t("rewards.cashback.in30", { amount: fmtUsd(total30) })}</Chip>} />
            <div className="px-4 pb-6 pt-6 sm:px-6">
              {series.length === 0 || total30 === 0 ? (
                <CardEmpty title={t("rewards.cashback.dailyEmptyTitle")} text={t("rewards.cashback.dailyEmptyText")} className="h-[240px]" />
              ) : (
                <DayBars data={series} height={220} format={(v) => fmtUsd(v)} label={(i) => series[i]!.label} />
              )}
            </div>
            <div className="grid grid-cols-3 border-t border-line">
              {[
                [t("rewards.cashback.avgDay"), fmtUsd(total30 / Math.max(1, data.series.length))],
                [best && best.amount > 0 ? t("rewards.cashback.bestDayOn", { day: fmtDay(best.day) }) : t("rewards.cashback.bestDay"), best && best.amount > 0 ? fmtUsd(best.amount) : "—"],
                [t("rewards.cashback.lotsMonth"), fmtLots(lotsMonth)],
              ].map(([k, v], i) => (
                <div key={k} className={cn("px-4 py-4 sm:px-6", i > 0 && "border-s border-line")}>
                  <div className="truncate text-[12px] text-fg-3">{k}</div>
                  <div className="k-num mt-1 text-[15px] font-medium">{v}</div>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-4">
          <Card className="flex h-full flex-col">
            <CardHeader title={t("rewards.cashback.programmesTitle")} subtitle={t("rewards.cashback.programmesSubtitle")} icon={<Percent />} />
            <div className="mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
              {programmes.length === 0 ? <CardEmpty title={t("rewards.cashback.programmesEmptyTitle")} text={t("rewards.cashback.programmesEmptyText")} /> : programmes.map((p) => <ProgrammeRow key={String(p.id)} p={p} onEnrolled={reload} />)}
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader title={t("rewards.cashback.historyTitle")} subtitle={t("rewards.cashback.historySubtitle")} />
          <div className="px-4 pb-6 pt-4 sm:px-6">
            <DataTable
              columns={accrualCols}
              rows={accruals}
              pageSize={10}
              rowKey={(r) => String(r.id)}
              search={(r) => `${r.symbol} ${r.login} ${r.dealId} ${r.programme}`}
              searchPlaceholder={t("rewards.cashback.search")}
              exportName="ezymex-cashback"
              dense
              empty={<CardEmpty title={t("rewards.cashback.historyEmptyTitle")} text={t("rewards.cashback.historyEmptyText")} />}
            />
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader title={t("rewards.cashback.payoutsTitle")} subtitle={t("rewards.cashback.payoutsSubtitle")} />
          <div className="px-4 pb-6 pt-4 sm:px-6">
            <DataTable columns={payoutCols} rows={payouts} pageSize={8} rowKey={(r) => String(r.id)} dense empty={<CardEmpty title={t("rewards.cashback.kpiNoPayouts")} text={t("rewards.cashback.payoutsEmptyText")} />} />
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
