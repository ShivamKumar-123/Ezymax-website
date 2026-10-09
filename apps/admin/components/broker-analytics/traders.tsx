"use client";

// Analytics → Traders: who wins and who loses against the book, by day, week or month. Live builds read the
// reports service (GET /api/reports/traders → /v1/admin/traders); demo builds compute the same report from the
// mock book (@ezymex/mock/admin-broker-analytics).

import * as React from "react";
import Link from "next/link";
import { CalendarRange, Coins, Flame, PieChart, RefreshCw, RotateCcw, Scale, Sigma, TrendingDown, TrendingUp, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, DataTable, Donut, Input, KpiCard, Money, PageHeader, Reveal, Segmented, cn, formatNumber, type Column } from "@ezymex/ui";
import { ANL_TODAY } from "@ezymex/mock/admin-growth-analytics";
import { baDefaultRange, baTraders, type TraderPeriod, type TraderRow, type TradersReport } from "@ezymex/mock/admin-broker-analytics";
import { StackedBars } from "@/components/analytics/stacked-bars";
import { LineChart } from "@/components/analytics/line-chart";
import { ExportActions } from "@/components/analytics/common";
import { MiniStat } from "@/components/analytics/meter";
import { ExportMenu, ReportFailed, ReportLoading, reportsApi, useReport } from "@/components/reports/common";
import { ClientCell, CountBars, FlagChips, HintChip, SelectBox, addDays, bucketLabel, compactMoney, countFmt, countryName, defaultRange, holdLabel, isoDay, pct1 } from "./kit";

export type TradersQuery = { period: TraderPeriod; from: string; to: string; group: string; country: string; book: "" | "A" | "B" };

const PERIODS: { value: TraderPeriod; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

const SEG_COLOR = { profitable: "var(--k-up)", breakEven: "color-mix(in oklab, var(--k-fg-3) 55%, var(--k-surface-3))", losing: "var(--k-down)" } as const;
const SEG_LABEL = { profitable: "Profitable", breakEven: "Break-even", losing: "Losing" } as const;

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

function FilterBar({ q, set, options, today, onReset }: { q: TradersQuery; set: (p: Partial<TradersQuery>) => void; options: TradersReport["options"] | undefined; today: string; onReset: () => void }) {
  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-end gap-3 px-4 py-4 sm:px-6">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-fg-3">From</span>
          <Input type="date" value={q.from} max={q.to} onChange={(e) => e.target.value && set({ from: e.target.value })} className="h-10 w-[160px]" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-fg-3">To</span>
          <Input type="date" value={q.to} min={q.from} max={today} onChange={(e) => e.target.value && set({ to: e.target.value })} className="h-10 w-[160px]" />
        </label>
        <SelectBox label="Group" value={q.group} onChange={(group) => set({ group })} options={[{ value: "", label: "All groups" }, ...(options?.groups ?? []).map((g) => ({ value: g, label: g }))]} className="min-w-[140px]" />
        <SelectBox label="Country" value={q.country} onChange={(country) => set({ country })} options={[{ value: "", label: "All countries" }, ...(options?.countries ?? []).map((c) => ({ value: c, label: countryName(c) }))]} className="min-w-[160px]" />
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-fg-3">Book</span>
          <Segmented size="sm" value={q.book || "all"} onChange={(b) => set({ book: b === "all" ? "" : (b as "A" | "B") })} options={[{ value: "all", label: "All" }, { value: "A", label: "A-book" }, { value: "B", label: "B-book" }]} className="h-10" />
        </div>
        <Button variant="ghost" size="md" onClick={onReset} className="ml-auto">
          <RotateCcw /> Reset
        </Button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

function SegmentCard({ r }: { r: TradersReport }) {
  const total = r.totals.traders;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Profitable vs losing" subtitle={`Realised net per client · break-even within ±$${r.definitions.breakEvenUsd}`} icon={<PieChart />} />
      <div className="flex flex-1 flex-col items-center gap-6 px-6 py-6 sm:flex-row xl:flex-col 2xl:flex-row">
        <Donut
          size={176}
          thickness={20}
          data={total ? r.segments.map((s) => ({ label: SEG_LABEL[s.key], value: s.clients, color: SEG_COLOR[s.key] })) : [{ label: "No traders", value: 1, color: "var(--k-surface-3)" }]}
          center={
            <div>
              <div className="k-num text-[26px] font-semibold leading-none">{formatNumber(total, 0)}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-fg-3">traders</div>
            </div>
          }
        />
        <div className="w-full flex-1 space-y-2">
          {r.segments.map((s) => (
            <div key={s.key} className="k-row px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[12.5px] text-fg-2">
                  <span className="size-2.5 rounded-[3px]" style={{ background: SEG_COLOR[s.key] }} />
                  {SEG_LABEL[s.key]}
                </span>
                <span className="k-num text-[12px] text-fg-3">
                  {formatNumber(s.clients, 0)} · {pct1(s.pctClients)}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <Money value={s.net} decimals={0} signed tone="auto" countUp={false} className="text-[17px] font-semibold" />
                <span className="k-num text-[11.5px] text-fg-3">{pct1(s.pctVolume)} of volume</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function TrendCard({ r }: { r: TradersReport }) {
  const [mode, setMode] = React.useState<"traders" | "pnl">("traders");
  const labels = r.series.map((b) => bucketLabel(b.start, r.period));
  const unit = r.period === "day" ? "day" : r.period === "week" ? "week" : "month";
  return (
    <Card className="h-full">
      <CardHeader
        title={mode === "traders" ? `Profitable vs losing traders per ${unit}` : `Client P&L vs broker revenue per ${unit}`}
        subtitle={mode === "traders" ? "Each client classified on its own realised net in the period · losing below zero" : "Realised client net and broker net revenue (after IB cost)"}
        icon={<CalendarRange />}
        action={<Segmented size="xs" value={mode} onChange={setMode} options={[{ value: "traders", label: "Traders" }, { value: "pnl", label: "P&L" }]} />}
      />
      <div className="px-4 pb-5 pt-5 sm:px-6">
        {r.series.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-fg-3">No periods in this range.</div>
        ) : mode === "traders" ? (
          <StackedBars
            height={270}
            format={countFmt}
            data={r.series.map((b, i) => ({ label: labels[i]!.label, title: labels[i]!.title, values: { profitable: b.profitable, breakEven: b.breakEven, losing: -b.losing } }))}
            series={[
              { key: "profitable", label: "Profitable", color: SEG_COLOR.profitable },
              { key: "breakEven", label: "Break-even", color: SEG_COLOR.breakEven },
              { key: "losing", label: "Losing", color: SEG_COLOR.losing },
            ]}
          />
        ) : (
          <LineChart
            height={270}
            minZero={false}
            labels={labels.map((l) => l.label)}
            series={[
              { key: "client", label: "Client realised net", color: "var(--k-info)", values: r.series.map((b) => b.clientNet), area: true },
              { key: "broker", label: "Broker net revenue", color: "var(--k-gold)", values: r.series.map((b) => b.brokerRevenue) },
            ]}
          />
        )}
      </div>
    </Card>
  );
}

function DistributionCard({ r }: { r: TradersReport }) {
  const color = (k: string) => (k === "be" ? SEG_COLOR.breakEven : ["lt10k", "10k1k", "1k100", "100be"].includes(k) ? SEG_COLOR.losing : SEG_COLOR.profitable);
  return (
    <Card className="h-full">
      <CardHeader title="P&L distribution" subtitle="Clients by realised net in the period" icon={<Sigma />} />
      <div className="px-4 pb-5 pt-6 sm:px-6">
        <CountBars
          height={170}
          rows={r.distribution.map((d) => ({ key: d.key, label: d.label, value: d.clients, color: color(d.key), hint: <span className="k-num">{d.clients} clients · net {compactMoney(d.net)}</span> }))}
        />
      </div>
    </Card>
  );
}

function FlagsCard({ r }: { r: TradersReport }) {
  const t = r.totals;
  const d = r.definitions;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Edge and routing" subtitle="Flags on this period's traders and the A/B-book hint" icon={<Flame />} action={<Link href="/trading/routing"><Button size="sm" variant="surface">Routing</Button></Link>} />
      <div className="grid flex-1 grid-cols-2 gap-2.5 px-4 pb-4 pt-4 sm:px-6">
        <MiniStat label="Consistent winners" value={formatNumber(t.flagged.consistent, 0)} sub={`Profitable ≥ ⅔ of last ${d.consistencyWindow} periods`} />
        <MiniStat label="Scalping" value={formatNumber(t.flagged.scalper, 0)} sub={`Median hold < ${d.scalpSecs / 60} min`} />
        <MiniStat label="High win rate" value={formatNumber(t.flagged.highWinRate, 0)} sub={`≥ ${d.highWinRate}% over 10+ trades`} />
        <MiniStat label="Large vs equity" value={formatNumber(t.flagged.largeSize, 0)} sub={`Avg trade ≥ ${d.largeSizeX}× equity`} />
      </div>
      <div className="mx-4 mb-5 grid grid-cols-3 gap-2 rounded-[16px] border border-line bg-surface-2/60 p-3 sm:mx-6">
        {(
          [
            ["A", "A-book candidates", "text-down"],
            ["review", "Review", "text-info"],
            ["B", "Keep B-book", "text-fg"],
          ] as const
        ).map(([k, l, c]) => (
          <div key={k} className="text-center">
            <div className={cn("k-num text-[20px] font-semibold", c)}>{formatNumber(t.hints[k], 0)}</div>
            <div className="text-[11px] text-fg-3">{l}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

type Tab = "winners" | "losers" | "flagged" | "all";

function ClientsCard({ r, exportName }: { r: TradersReport; exportName: string }) {
  const [tab, setTab] = React.useState<Tab>("winners");
  const rows = React.useMemo(() => {
    if (tab === "winners") return r.clients.filter((c) => c.segment === "profitable");
    if (tab === "losers") return [...r.clients].filter((c) => c.segment === "losing").sort((a, b) => a.net - b.net);
    if (tab === "flagged") return r.clients.filter((c) => c.routeHint !== "B" || Object.values(c.flags).some(Boolean));
    return r.clients;
  }, [r.clients, tab]);
  const cols: Column<TraderRow>[] = [
    { key: "client", header: "Client", cell: (c) => <ClientCell name={c.name} userId={c.userId} country={c.country} logins={c.logins} sub={c.groups.join(", ")} />, csv: (c) => c.name },
    { key: "net", header: "Realised", align: "right", sort: (c) => c.net, csv: (c) => c.net, cell: (c) => <Money value={c.net} signed tone="auto" decimals={2} countUp={false} className="text-[13.5px] font-semibold" /> },
    { key: "floating", header: "Floating", align: "right", sort: (c) => c.floating, csv: (c) => c.floating, hideOn: "md", cell: (c) => <Money value={c.floating} signed tone="auto" decimals={0} countUp={false} className="text-[12.5px]" /> },
    { key: "ret", header: "Return", align: "right", sort: (c) => c.returnPct ?? -1e9, csv: (c) => c.returnPct ?? "", hideOn: "lg", cell: (c) => <span className={cn("k-num text-[12.5px]", (c.returnPct ?? 0) > 0 ? "text-up" : (c.returnPct ?? 0) < 0 ? "text-down" : "text-fg-3")}>{c.returnPct === null ? "—" : `${c.returnPct > 0 ? "+" : ""}${c.returnPct.toFixed(1)}%`}</span> },
    {
      key: "trades",
      header: "Trades · win",
      align: "right",
      sort: (c) => c.trades,
      csv: (c) => c.trades,
      hideOn: "sm",
      cell: (c) => (
        <span className="k-num text-[12.5px] text-fg-2">
          {formatNumber(c.trades, 0)} · <span className={c.winRate >= 80 ? "text-warn" : undefined}>{c.winRate.toFixed(0)}%</span>
        </span>
      ),
    },
    { key: "pf", header: "PF", align: "right", sort: (c) => c.profitFactor ?? 1e9, csv: (c) => c.profitFactor ?? "", hideOn: "lg", cell: (c) => <span className="k-num text-[12.5px] text-fg-2">{c.profitFactor === null ? "∞" : c.profitFactor.toFixed(2)}</span> },
    { key: "hold", header: "Median hold", align: "right", sort: (c) => c.medianHoldSecs, csv: (c) => c.medianHoldSecs, hideOn: "xl", cell: (c) => <span className={cn("k-num text-[12.5px]", c.flags.scalper ? "text-warn" : "text-fg-2")}>{holdLabel(c.medianHoldSecs)}</span> },
    { key: "lots", header: "Lots", align: "right", sort: (c) => c.lots, csv: (c) => c.lots, hideOn: "md", cell: (c) => <span className="k-num text-[12.5px] text-fg-2">{formatNumber(c.lots, 2)}</span> },
    { key: "flags", header: "Flags", hideOn: "lg", cell: (c) => <FlagChips flags={c.flags} />, csv: (c) => Object.entries(c.flags).filter(([, v]) => v).map(([k]) => k).join(" ") },
    { key: "hint", header: "Routing", cell: (c) => <HintChip hint={c.routeHint} reasons={c.reasons} book={c.book} />, csv: (c) => c.routeHint },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (c) => (
        <Link href={`/clients/${c.userId}`} onClick={(e) => e.stopPropagation()}>
          <Button size="xs" variant={c.routeHint === "A" ? "down-outline" : "ghost"}>
            View
          </Button>
        </Link>
      ),
    },
  ];
  const subtitle: Record<Tab, string> = {
    winners: "Clients who made money against the book in this period, largest first",
    losers: "Clients who lost the most in this period",
    flagged: "Consistent, scalping, high win rate or large size, and every routing hint other than B-book",
    all: "Every client with a closed trade in this period",
  };
  return (
    <Card>
      <CardHeader
        title="Traders"
        subtitle={subtitle[tab]}
        icon={<Users />}
        action={
          <Segmented
            size="xs"
            value={tab}
            onChange={setTab}
            options={[
              { value: "winners", label: `Winners ${r.totals.profitable}` },
              { value: "losers", label: `Losers ${r.totals.losing}` },
              { value: "flagged", label: "Flagged" },
              { value: "all", label: "All" },
            ]}
          />
        }
      />
      <div className="mt-4 px-4 pb-5 sm:px-6">
        <DataTable
          columns={cols}
          rows={rows}
          pageSize={10}
          search={(c) => `${c.name} ${c.email} ${c.logins.join(" ")} ${c.userId}`}
          searchPlaceholder="Search name, email or login…"
          exportName={`${exportName}-${tab}`}
          rowKey={(c) => String(c.userId)}
          empty={<div className="py-8 text-center text-[13px] text-fg-3">No clients in this list.</div>}
        />
      </div>
    </Card>
  );
}

function TopList({ title, rows, tone }: { title: string; rows: TraderRow[]; tone: "up" | "down" }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
  return (
    <Card className="h-full">
      <CardHeader title={title} subtitle="Realised net · link opens the client 360" icon={tone === "up" ? <Trophy /> : <TrendingDown />} />
      <div className="mt-3 space-y-1.5 px-4 pb-5 sm:px-6">
        {rows.length === 0 && <div className="py-6 text-center text-[13px] text-fg-3">Nobody in this period.</div>}
        {rows.slice(0, 6).map((c, i) => (
          <Link key={c.userId} href={`/clients/${c.userId}`} className="k-row flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-surface-2">
            <span className="k-num w-5 text-[12px] text-fg-3">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <ClientCell name={c.name} userId={c.userId} country={c.country} logins={c.logins} />
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
                <div className={cn("h-full rounded-full", tone === "up" ? "bg-up" : "bg-down")} style={{ width: `${(Math.abs(c.net) / max) * 100}%` }} />
              </div>
            </div>
            <div className="text-right">
              <Money value={c.net} signed tone="auto" decimals={0} countUp={false} className="text-[14px] font-semibold" />
              <div className="mt-0.5">
                <HintChip hint={c.routeHint} reasons={c.reasons} book={c.book} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export function TradersView({ r, loading, actions, filters }: { r: TradersReport; loading?: boolean; actions?: React.ReactNode; filters: React.ReactNode }) {
  const t = r.totals;
  return (
    <div className="pb-16">
      <PageHeader title="Traders" subtitle="Who wins and who loses against the book · realised P&L by day, week or month · USD · server time" actions={actions} />
      {filters}
      <div className={cn("transition-opacity", loading && "opacity-60")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Profitable clients"
            icon={<TrendingUp />}
            value={<span className="k-num text-up">{pct1(t.profitablePct)}</span>}
            footer={<span className="text-[11.5px] text-fg-3"><span className="k-num text-fg-2">{formatNumber(t.profitable, 0)}</span> of {formatNumber(t.traders, 0)} traders</span>}
          />
          <KpiCard
            label="Losing clients"
            icon={<TrendingDown />}
            value={<span className="k-num text-down">{pct1(t.losingPct)}</span>}
            footer={<span className="text-[11.5px] text-fg-3"><span className="k-num text-fg-2">{formatNumber(t.losing, 0)}</span> losing · {formatNumber(t.breakEven, 0)} break-even</span>}
            delay={0.05}
          />
          <KpiCard
            label="Net client P&L"
            icon={<Scale />}
            value={<Money value={t.clientNet} decimals={0} signed tone="auto" />}
            footer={<span className="flex items-center gap-1.5 text-[11.5px] text-fg-3">Floating <Money value={t.clientFloating} decimals={0} signed tone="auto" countUp={false} className="font-medium" /></span>}
            delay={0.08}
          />
          <KpiCard
            label="Broker revenue"
            icon={<Coins />}
            value={<Money value={t.brokerRevenue} decimals={0} tone="auto" />}
            footer={<span className="text-[11.5px] text-fg-3">B-book {compactMoney(t.bbook)} · IB {compactMoney(-t.ibCost)}</span>}
            href="/analytics"
            delay={0.11}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Reveal delay={0.08} className="xl:col-span-4">
            <SegmentCard r={r} />
          </Reveal>
          <Reveal delay={0.12} className="xl:col-span-8">
            <TrendCard r={r} />
          </Reveal>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MiniStat label="Trades · win rate" value={`${formatNumber(t.trades, 0)} · ${pct1(t.winRate)}`} sub={`Profit factor ${t.profitFactor === null ? "∞" : t.profitFactor.toFixed(2)}`} />
          <MiniStat label="Volume" value={`${formatNumber(t.lots, 2)} lots`} sub={`${compactMoney(t.notional)} notional`} />
          <MiniStat label="Holding time" value={`${holdLabel(t.medianHoldSecs)} median`} sub={`${holdLabel(t.avgHoldSecs)} average`} />
          <MiniStat label="Floating source" value={r.floatingSource === "engine" ? "Live engine" : "Last mirror"} sub="Open positions of these traders" />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Reveal delay={0.08} className="xl:col-span-7">
            <DistributionCard r={r} />
          </Reveal>
          <Reveal delay={0.12} className="xl:col-span-5">
            <FlagsCard r={r} />
          </Reveal>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Reveal delay={0.08}>
            <TopList title="Top winners" rows={r.topWinners} tone="up" />
          </Reveal>
          <Reveal delay={0.12}>
            <TopList title="Top losers" rows={r.topLosers} tone="down" />
          </Reveal>
        </div>

        <Reveal delay={0.1} className="mt-4">
          <ClientsCard r={r} exportName={`traders-${r.period}`} />
        </Reveal>
      </div>
    </div>
  );
}

function useQuery(today: string, initial?: Partial<TradersQuery>) {
  const [q, setQ] = React.useState<TradersQuery>(() => ({ period: "day", ...defaultRange("day", today), group: "", country: "", book: "", ...initial }));
  const set = (p: Partial<TradersQuery>) =>
    setQ((cur) => {
      const next = { ...cur, ...p };
      // a new granularity starts from its default range
      if (p.period && p.period !== cur.period && !p.from) Object.assign(next, defaultRange(p.period, today));
      if (next.from > next.to) next.from = next.to;
      return next;
    });
  const reset = () => setQ({ period: q.period, ...defaultRange(q.period, today), group: "", country: "", book: "" });
  return { q, set, reset };
}

const periodPicker = (q: TradersQuery, set: (p: Partial<TradersQuery>) => void) => <Segmented value={q.period} onChange={(period) => set({ period })} options={PERIODS} />;

/** Live builds: the reports service. */
export function LiveTraders() {
  const today = isoDay(new Date());
  const { q, set, reset } = useQuery(today);
  const params = new URLSearchParams({ period: q.period, from: q.from, to: addDays(q.to, 1) });
  if (q.group) params.set("group", q.group);
  if (q.country) params.set("country", q.country);
  if (q.book) params.set("book", q.book);
  const { data, error, loading, reload } = useReport<TradersReport>(`traders?${params}`);
  const [syncing, setSyncing] = React.useState(false);
  const sync = async () => {
    setSyncing(true);
    try {
      await reportsApi("sync", { method: "POST" });
      reload();
      toast.success("Trader data refreshed from the engine");
    } catch (e) {
      toast.error("Refresh failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSyncing(false);
    }
  };
  const actions = (
    <>
      <Button variant="ghost" size="md" onClick={sync} disabled={syncing}>
        <RefreshCw className={cn(syncing && "animate-spin")} /> Refresh
      </Button>
      {periodPicker(q, set)}
      <ExportMenu report="traders" name="Traders" from={q.from} to={addDays(q.to, 1)} query={{ period: q.period, group: q.group, country: q.country, book: q.book }} />
    </>
  );
  const filters = <FilterBar q={q} set={set} options={data?.options} today={today} onReset={reset} />;
  if (loading && !data)
    return (
      <div className="pb-16">
        <PageHeader title="Traders" subtitle="Who wins and who loses against the book" actions={actions} />
        {filters}
        <ReportLoading />
      </div>
    );
  if (error && !data)
    return (
      <div className="pb-16">
        <PageHeader title="Traders" subtitle="Who wins and who loses against the book" actions={actions} />
        {filters}
        <ReportFailed message={error} onRetry={reload} />
      </div>
    );
  return data ? <TradersView r={data} loading={loading} actions={actions} filters={filters} /> : null;
}

/** Demo builds: the same report computed from the mock book. */
export function DemoTraders() {
  const today = new Date(ANL_TODAY).toISOString().slice(0, 10);
  const { q, set, reset } = useQuery(today, baDefaultRange("day"));
  const data = React.useMemo(() => baTraders({ period: q.period, from: q.from, to: q.to, group: q.group || null, country: q.country || null, book: q.book || null }), [q]);
  const actions = (
    <>
      {periodPicker(q, set)}
      <ExportActions name="Traders" />
    </>
  );
  return <TradersView r={data} actions={actions} filters={<FilterBar q={q} set={set} options={data.options} today={today} onReset={reset} />} />;
}
