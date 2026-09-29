"use client";

// Analytics → Broker P&L (D120): B-book result plus spread / commission / swap revenue and IB costs, by day,
// symbol, group and client. Reports service GET /v1/admin/pnl (live accounts, prop groups excluded, USD).

import * as React from "react";
import Link from "next/link";
import { ArrowLeftRight, BookOpen, Coins, Handshake, Layers, Percent, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import { Button, Card, CardHeader, Chip, DataTable, Delta, Donut, EquityChart, Flag, KpiCard, Money, PageHeader, Reveal, Segmented, SymbolCell, cn, formatNumber, type Column } from "@kalks/ui";
import { StackedBars, compactMoney } from "@/components/analytics/stacked-bars";
import { dayLabel, weekday } from "@/components/analytics/common";
import { Meter, MiniStat, SplitMeter } from "@/components/analytics/meter";
import { ExportMenu, PeriodPicker, ReportFailed, ReportLoading, chg, periodRange, reportsApi, useReport, type Period } from "./common";
import { toast } from "sonner";

type Rev = { bbook: number; swap: number; commission: number; spread: number; spreadA: number; ibCost: number; net: number; lots: number; lotsA: number; trades: number; abookClientPnl: number };
type Pnl = {
  from: string;
  to: string;
  totals: Rev;
  previous: Rev;
  activeTraders: number;
  book: { aLots: number; bLots: number; bbookPnl: number; abookClientPnl: number; spreadA: number; spreadB: number };
  daily: (Rev & { date: string })[];
  bySymbol: (Rev & { symbol: string; bookAPct: number })[];
  byGroup: (Rev & { group: string; accounts: number; fees: number })[];
  clients: { userId: number; name: string; email: string; country: string; logins: number[]; lots: number; trades: number; brokerPnl: number; bbook: number; bookAPct: number }[];
};

const SOURCES = [
  { key: "bbook", label: "B-book P&L", color: "var(--k-ember)" },
  { key: "commission", label: "Commission", color: "var(--k-gold)" },
  { key: "swap", label: "Swap", color: "var(--k-info)" },
  { key: "spreadA", label: "A-book markup", color: "color-mix(in oklab, var(--k-up) 70%, var(--k-surface-3))" },
  { key: "ibCost", label: "IB costs", color: "color-mix(in oklab, var(--k-down) 70%, var(--k-surface-3))" },
];

function RevenueChart({ rows }: { rows: Pnl["daily"] }) {
  const [mode, setMode] = React.useState<"daily" | "cumulative">("daily");
  const weekly = rows.length > 100;
  const buckets = React.useMemo(() => {
    if (!weekly) return rows.map((d) => ({ label: dayLabel(d.date), title: `${weekday(d.date)}, ${dayLabel(d.date, true)}`, items: [d] }));
    const out: { label: string; title: string; items: Pnl["daily"] }[] = [];
    for (let i = rows.length; i > 0; i -= 7) {
      const items = rows.slice(Math.max(0, i - 7), i);
      out.unshift({ label: dayLabel(items[0]!.date), title: `Week of ${dayLabel(items[0]!.date, true)}`, items });
    }
    return out;
  }, [rows, weekly]);
  const data = buckets.map((b) => {
    const s = (k: keyof Rev) => b.items.reduce((a, d) => a + (d[k] as number), 0);
    return { label: b.label, title: b.title, values: { bbook: s("bbook"), commission: s("commission"), swap: s("swap"), spreadA: s("spreadA"), ibCost: -s("ibCost") }, net: s("net") };
  });
  const cum = React.useMemo(() => {
    let acc = 0;
    return rows.map((d) => {
      acc += d.net;
      return { time: Math.floor(Date.parse(`${d.date}T12:00:00Z`) / 1000), value: Math.round(acc * 100) / 100, volume: Math.max(0, d.net) };
    });
  }, [rows]);
  return (
    <Card className="h-full">
      <CardHeader
        title={mode === "daily" ? (weekly ? "Weekly revenue by source" : "Daily revenue by source") : "Cumulative net revenue"}
        subtitle={mode === "daily" ? "Stacked by source · IB costs below zero · line = net revenue" : "Running total · server time"}
        icon={<Layers />}
        action={<Segmented size="xs" value={mode} onChange={setMode} options={[{ value: "daily", label: weekly ? "Weekly" : "Daily" }, { value: "cumulative", label: "Cumulative" }]} />}
      />
      <div className="px-4 pb-5 pt-5 sm:px-6">
        {mode === "daily" ? (
          <StackedBars data={data} series={SOURCES} height={300} line={{ key: "net", label: "Net revenue", color: "var(--k-fg)", values: data.map((d) => d.net) }} />
        ) : cum.length > 1 ? (
          <div className="pt-2">
            <EquityChart data={cum} height={330} color="gold" />
          </div>
        ) : (
          <div className="py-10 text-center text-[13px] text-fg-3">Not enough days for a cumulative curve.</div>
        )}
      </div>
    </Card>
  );
}

function BookSplit({ p }: { p: Pnl }) {
  const total = p.book.aLots + p.book.bLots;
  const bPct = total ? Math.round((p.book.bLots / total) * 1000) / 10 : 0;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="A-book vs B-book" subtitle="Share of traded lots · revenue attribution" icon={<ArrowLeftRight />} action={<Link href="/trading/routing"><Button size="sm" variant="surface">Routing</Button></Link>} />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-6 sm:flex-row">
        <Donut
          size={184}
          thickness={20}
          data={total ? [{ label: "B-book", value: p.book.bLots, color: "var(--k-ember)" }, { label: "A-book", value: p.book.aLots, color: "var(--k-gold)" }] : [{ label: "No volume", value: 1, color: "var(--k-surface-3)" }]}
          center={
            <div>
              <div className="k-num text-[26px] font-semibold leading-none">{total ? `${bPct}%` : "—"}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-fg-3">internalised</div>
            </div>
          }
        />
        <div className="w-full flex-1 space-y-3">
          <div className="k-row px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[12.5px] text-fg-2"><span className="size-2.5 rounded-[3px] bg-ember" />B-book P&amp;L</span>
              <span className="k-num text-[11.5px] text-fg-3">{formatNumber(p.book.bLots, 2)} lots</span>
            </div>
            <Money value={p.book.bbookPnl} decimals={0} tone="auto" className="mt-1 block text-[20px] font-semibold" />
          </div>
          <div className="k-row px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[12.5px] text-fg-2"><span className="size-2.5 rounded-[3px] bg-gold" />A-book markup</span>
              <span className="k-num text-[11.5px] text-fg-3">{formatNumber(p.book.aLots, 2)} lots</span>
            </div>
            <Money value={p.book.spreadA} decimals={0} className="mt-1 block text-[20px] font-semibold" />
          </div>
        </div>
      </div>
      <div className="mx-6 mb-6 space-y-2.5 border-t border-line pt-4 text-[12.5px]">
        <div className="flex items-center justify-between"><span className="text-fg-3">Spread markup inside B-book P&amp;L</span><span className="k-num text-fg">{compactMoney(p.book.spreadB)}</span></div>
        <div className="flex items-center justify-between"><span className="text-fg-3">A-book clients' own P&amp;L</span><span className="k-num text-fg">{compactMoney(p.book.abookClientPnl)}</span></div>
        <div className="flex items-center justify-between"><span className="text-fg-3">Liquidity provider</span><span className="text-fg-2">Not connected: A-book fills execute internally</span></div>
      </div>
    </Card>
  );
}

function SymbolRevenue({ rows }: { rows: Pnl["bySymbol"] }) {
  const list = [...rows].sort((a, b) => b.net - a.net).slice(0, 12);
  const maxFee = Math.max(1, ...list.map((r) => r.commission + Math.max(0, r.swap) + r.spread));
  const maxBB = Math.max(1, ...list.map((r) => Math.abs(r.bbook)));
  return (
    <Card className="h-full">
      <CardHeader title="Revenue by symbol" subtitle="Spread markup · commission · swap mix and B-book result" icon={<Coins />} action={<Link href="/config/symbols"><Button size="sm" variant="surface">Symbols</Button></Link>} />
      {list.length === 0 ? (
        <div className="px-6 pb-8 pt-6 text-[13px] text-fg-3">No live trading in this period.</div>
      ) : (
        <div className="mt-4 overflow-x-auto px-4 pb-5 sm:px-6">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[1.4fr_0.8fr_1.6fr_1.1fr_1fr] items-center gap-4 rounded-[14px] border border-line bg-surface-2 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.05em] text-fg-3">
              <span>Symbol</span>
              <span className="text-right">Lots</span>
              <span>Revenue mix</span>
              <span className="text-center">B-book P&amp;L</span>
              <span className="text-right">Net</span>
            </div>
            <div className="divide-y divide-line">
              {list.map((s, i) => {
                const parts = [s.spread, s.commission, Math.max(0, s.swap)];
                const fee = parts.reduce((a, b) => a + b, 0);
                return (
                  <div key={s.symbol} className="grid grid-cols-[1.4fr_0.8fr_1.6fr_1.1fr_1fr] items-center gap-4 px-4 py-2.5 transition-colors hover:bg-surface-2/60">
                    <SymbolCell symbol={s.symbol} size={26} sub={`${s.bookAPct}% A-booked · ${s.trades} closes`} />
                    <span className="k-num text-right text-[13px] text-fg-2">{formatNumber(s.lots, 2)}</span>
                    <div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-surface-3" style={{ width: `${Math.max(12, (fee / maxFee) * 100)}%` }}>
                        {fee > 0 && (
                          <>
                            <span style={{ width: `${(parts[0]! / fee) * 100}%`, background: "var(--k-ember)" }} />
                            <span style={{ width: `${(parts[1]! / fee) * 100}%`, background: "var(--k-gold)" }} />
                            <span style={{ width: `${(parts[2]! / fee) * 100}%`, background: "var(--k-info)" }} />
                          </>
                        )}
                      </div>
                      <div className="k-num mt-1 text-[11px] text-fg-3">{compactMoney(fee)} fees</div>
                    </div>
                    <div>
                      <SplitMeter value={s.bbook} max={maxBB} />
                      <div className={cn("k-num mt-1 text-center text-[11px]", s.bbook >= 0 ? "text-up" : "text-down")}>{s.bbook >= 0 ? "+" : ""}{compactMoney(s.bbook)}</div>
                    </div>
                    <div className="text-right">
                      <Money value={s.net} decimals={0} countUp={false} tone="auto" className="text-[14px] font-semibold" />
                      <div className="k-num text-[11px] text-fg-3">#{i + 1}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function GroupRevenue({ rows }: { rows: Pnl["byGroup"] }) {
  const total = rows.reduce((s, g) => s + g.net, 0);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="By account group" subtitle="Net = fees + B-book − IB costs" icon={<BookOpen />} action={<Link href="/config"><Button size="sm" variant="surface">Groups</Button></Link>} />
      <div className="mt-4 flex-1 space-y-2.5 px-4 pb-5 sm:px-6">
        {rows.length === 0 && <div className="py-4 text-[13px] text-fg-3">No live trading in this period.</div>}
        {[...rows].sort((a, b) => b.net - a.net).map((g, i) => (
          <div key={g.group} className="k-row px-4 py-3.5">
            <div className="flex items-center gap-3">
              <Chip tone={i === 0 ? "ember" : "neutral"} className="min-w-[84px] justify-center">{g.group}</Chip>
              <div className="min-w-0 flex-1 truncate text-[12px] text-fg-3"><span className="k-num">{formatNumber(g.accounts, 0)}</span> live accounts · {formatNumber(g.lots, 2)} lots</div>
              <Money value={g.net} decimals={0} countUp={false} tone="auto" className="text-[15px] font-semibold" />
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              <Meter value={Math.abs(g.net)} max={max} tone={g.net >= 0 ? "ember" : "down"} delay={i * 0.05} />
              <span className="k-num w-12 shrink-0 text-right text-[11.5px] text-fg-2">{total ? `${((g.net / total) * 100).toFixed(1)}%` : "—"}</span>
            </div>
            <div className="k-num mt-2 grid grid-cols-3 gap-2 text-[11.5px] text-fg-3">
              <span>Fees <span className="text-fg-2">{compactMoney(g.fees)}</span></span>
              <span>B-book <span className={g.bbook > 0 ? "text-up" : g.bbook < 0 ? "text-down" : "text-fg-2"}>{compactMoney(g.bbook)}</span></span>
              <span className="text-right">IB <span className="text-fg-2">{compactMoney(-g.ibCost)}</span></span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ClientsTable({ rows }: { rows: Pnl["clients"] }) {
  const [side, setSide] = React.useState<"losing" | "winning">("losing");
  const list = React.useMemo(() => rows.filter((c) => (side === "losing" ? c.brokerPnl < 0 : c.brokerPnl >= 0)).sort((a, b) => (side === "losing" ? a.brokerPnl - b.brokerPnl : b.brokerPnl - a.brokerPnl)), [rows, side]);
  const max = Math.max(1, ...list.map((r) => Math.abs(r.brokerPnl)));
  const cols: Column<Pnl["clients"][number]>[] = [
    {
      key: "client",
      header: "Client",
      cell: (c) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[13.5px] font-medium">
            <span className="truncate">{c.name || `Client ${c.userId}`}</span>
            {c.country && <Flag country={c.country.toLowerCase()} className="size-3.5" />}
          </div>
          <div className="font-mono text-[11.5px] text-fg-3">{c.logins.map((l) => `#${l}`).join(" · ")}</div>
        </div>
      ),
    },
    { key: "lots", header: "Lots", align: "right", sort: (c) => c.lots, cell: (c) => <span className="k-num">{formatNumber(c.lots, 2)}</span> },
    { key: "trades", header: "Closes", align: "right", sort: (c) => c.trades, cell: (c) => <span className="k-num text-fg-2">{formatNumber(c.trades, 0)}</span>, hideOn: "md" },
    { key: "a", header: "A-book", align: "right", sort: (c) => c.bookAPct, cell: (c) => <span className="k-num text-fg-2">{c.bookAPct}%</span>, hideOn: "lg" },
    {
      key: "pnl",
      header: "Broker P&L",
      align: "right",
      sort: (c) => c.brokerPnl,
      cell: (c) => (
        <div className="flex items-center justify-end gap-3">
          <div className="hidden w-24 xl:block"><Meter value={Math.abs(c.brokerPnl)} max={max} tone={c.brokerPnl >= 0 ? "up" : "down"} height={4} /></div>
          <Money value={c.brokerPnl} signed tone="auto" decimals={2} countUp={false} className="text-[14px] font-semibold" />
        </div>
      ),
    },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (c) => (
        <Link href={`/clients/${c.userId}`} onClick={(e) => e.stopPropagation()}>
          <Button size="xs" variant={c.brokerPnl < 0 ? "down-outline" : "ghost"}>View</Button>
        </Link>
      ),
    },
  ];
  return (
    <Card>
      <CardHeader
        title="Clients by broker P&L"
        subtitle={side === "losing" ? "Clients winning against the book: candidates for A-book routing" : "Clients the broker earns the most from"}
        icon={<Wallet />}
        action={<Segmented size="xs" value={side} onChange={setSide} options={[{ value: "losing", label: "Broker losing" }, { value: "winning", label: "Broker winning" }]} />}
      />
      <div className="mt-4 px-4 pb-5 sm:px-6">
        <DataTable columns={cols} rows={list} pageSize={8} search={(c) => `${c.name} ${c.email} ${c.logins.join(" ")}`} exportName={`broker-pnl-${side}-clients`} rowKey={(c) => String(c.userId)} empty={<div className="py-8 text-center text-[13px] text-fg-3">No clients on this side.</div>} />
      </div>
    </Card>
  );
}

export function LiveBrokerPnl() {
  const [period, setPeriod] = React.useState<Period>("30D");
  const r = periodRange(period);
  const { data: p, error, loading, reload } = useReport<Pnl>(`pnl?from=${r.from}&to=${r.to}`);
  const [syncing, setSyncing] = React.useState(false);
  const sync = async () => {
    setSyncing(true);
    try {
      await reportsApi("sync", { method: "POST" });
      reload();
      toast.success("Report data refreshed from the engine, wallet and IB service");
    } catch (e) {
      toast.error("Refresh failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSyncing(false);
    }
  };
  return (
    <div className="pb-16">
      <PageHeader
        title="Broker P&L"
        subtitle="Net revenue from B-book, spread markup, commission and swap, less IB costs · live accounts · USD · server time"
        actions={
          <>
            <Button variant="ghost" size="md" onClick={sync} disabled={syncing}>
              <RefreshCw className={cn(syncing && "animate-spin")} /> Refresh
            </Button>
            <PeriodPicker value={period} onChange={setPeriod} />
            <ExportMenu report="pnl" name="Broker P&L" from={r.from} to={r.to} />
          </>
        }
      />
      {loading && !p ? <ReportLoading /> : error && !p ? <ReportFailed message={error} onRetry={reload} /> : p ? (
        <div className={cn("transition-opacity", loading && "opacity-60")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <Card className="sm:col-span-2">
              <div className="flex h-full flex-col px-6 pb-5 pt-6">
                <div className="flex items-start justify-between">
                  <span className="k-label">Net revenue · {period}</span>
                  {p.previous.net !== 0 && <Chip tone={chg(p.totals.net, p.previous.net) >= 0 ? "up" : "down"}><Delta value={chg(p.totals.net, p.previous.net)} className="text-[11.5px]" /> vs prev</Chip>}
                </div>
                <Money value={p.totals.net} decimals={0} tone="auto" className="mt-4 block text-[40px] font-semibold leading-none tracking-[-0.02em]" />
                <div className="mt-auto grid grid-cols-3 gap-3 pt-5 text-[12px]">
                  <div><div className="text-fg-3">Per lot</div><div className="k-num mt-0.5 font-medium">{p.totals.lots ? `$${(p.totals.net / p.totals.lots).toFixed(2)}` : "—"}</div></div>
                  <div><div className="text-fg-3">Lots</div><div className="k-num mt-0.5 font-medium">{formatNumber(p.totals.lots, 2)}</div></div>
                  <div><div className="text-fg-3">Traders</div><div className="k-num mt-0.5 font-medium">{formatNumber(p.activeTraders, 0)}</div></div>
                </div>
              </div>
            </Card>
            <KpiCard label="B-book P&L" icon={<TrendingUp />} value={<Money value={p.totals.bbook} decimals={0} tone="auto" />} footer={p.previous.bbook ? <Delta value={chg(p.totals.bbook, p.previous.bbook)} chip /> : <span className="text-[11.5px] text-fg-3">No trading in the previous period</span>} href="/trading/exposure" delay={0.05} />
            <KpiCard label="Spread markup" icon={<Percent />} value={<Money value={p.totals.spread} decimals={0} />} footer={<span className="text-[11.5px] text-fg-3">Estimate · A-book {compactMoney(p.totals.spreadA)}</span>} delay={0.08} />
            <KpiCard label="Commission" icon={<Coins />} value={<Money value={p.totals.commission} decimals={0} />} footer={p.previous.commission ? <Delta value={chg(p.totals.commission, p.previous.commission)} chip /> : <span className="text-[11.5px] text-fg-3">Entry-deal commission</span>} delay={0.11} />
            <KpiCard
              label="Swap · IB costs"
              icon={<Handshake />}
              value={<Money value={p.totals.swap} decimals={0} tone="auto" />}
              footer={<span className="flex items-center gap-2 text-[11.5px] text-fg-3">IB <Money value={-p.totals.ibCost} decimals={0} countUp={false} className="font-medium text-down" /></span>}
              href="/partners"
              delay={0.14}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Reveal delay={0.1} className="xl:col-span-8">
              <RevenueChart rows={p.daily} />
            </Reveal>
            <Reveal delay={0.15} className="xl:col-span-4">
              <BookSplit p={p} />
            </Reveal>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Reveal delay={0.1} className="xl:col-span-7">
              <SymbolRevenue rows={p.bySymbol} />
            </Reveal>
            <Reveal delay={0.15} className="xl:col-span-5">
              <GroupRevenue rows={p.byGroup} />
            </Reveal>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat label="Revenue per active trader" value={<Money value={p.activeTraders ? p.totals.net / p.activeTraders : 0} countUp={false} />} sub={`${formatNumber(p.activeTraders, 0)} live traders in the period`} />
            <MiniStat label="Closed trades" value={formatNumber(p.totals.trades, 0)} sub="Exit deals on live accounts" />
            <MiniStat label="Previous period net" value={<Money value={p.previous.net} countUp={false} tone="auto" />} sub="Same length, immediately before" />
            <MiniStat label="IB cost share" value={p.totals.bbook + p.totals.commission + p.totals.swap > 0 ? `${((p.totals.ibCost / (p.totals.bbook + p.totals.commission + p.totals.swap + p.totals.spreadA)) * 100).toFixed(1)}%` : "—"} sub={<Link href="/analytics/partners" className="hover:text-fg">of gross revenue · Partners</Link>} />
          </div>

          <Reveal delay={0.1} className="mt-4">
            <ClientsTable rows={p.clients} />
          </Reveal>
        </div>
      ) : null}
    </div>
  );
}
