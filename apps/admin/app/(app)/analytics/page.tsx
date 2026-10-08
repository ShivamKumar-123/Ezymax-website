"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftRight, BookOpen, Coins, Handshake, Layers, Percent, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  DataTable,
  Delta,
  Donut,
  EquityChart,
  Flag,
  KpiCard,
  Money,
  PageHeader,
  Reveal,
  Segmented,
  Starfield,
  SymbolCell,
  cn,
  formatNumber,
  type Column,
} from "@ezymex/ui";
import { ANL_BOOK_SPLIT, ANL_CLIENT_PNL, ANL_PNL_DAILY, ANL_PNL_GROUPS, ANL_PNL_SOURCES, ANL_PNL_SYMBOLS, type AnlClientPnl } from "@ezymex/mock/admin-growth-analytics";
import { StackedBars, compactMoney } from "@/components/analytics/stacked-bars";
import { ExportActions, RANGE_DAYS, RANGES, dayLabel, weekday, type Range } from "@/components/analytics/common";
import { Meter, MiniStat, SplitMeter } from "@/components/analytics/meter";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LiveBrokerPnl } from "@/components/reports/live-pnl";

type Totals = { spread: number; commission: number; swap: number; bbook: number; ibCost: number; net: number; lots: number };
const sum = (rows: typeof ANL_PNL_DAILY): Totals =>
  rows.reduce<Totals>(
    (a, d) => ({ spread: a.spread + d.spread, commission: a.commission + d.commission, swap: a.swap + d.swap, bbook: a.bbook + d.bbook, ibCost: a.ibCost + d.ibCost, net: a.net + d.net, lots: a.lots + d.lots }),
    { spread: 0, commission: 0, swap: 0, bbook: 0, ibCost: 0, net: 0, lots: 0 },
  );
const chg = (a: number, b: number) => (b ? ((a - b) / Math.abs(b)) * 100 : 0);

const NET_30 = sum(ANL_PNL_DAILY.slice(-30)).net;

/* ------------------------------------------------------------------ */

function RevenueChart({ rows, range }: { rows: typeof ANL_PNL_DAILY; range: Range }) {
  const [mode, setMode] = React.useState<"daily" | "cumulative">("daily");
  const weekly = rows.length > 100;
  // aggregate YTD into weeks so bars stay readable
  const buckets = React.useMemo(() => {
    if (!weekly) return rows.map((d) => ({ label: dayLabel(d.date), title: `${weekday(d.date)}, ${dayLabel(d.date, true)}`, items: [d] }));
    const out: { label: string; title: string; items: typeof rows }[] = [];
    for (let i = rows.length; i > 0; i -= 7) {
      const items = rows.slice(Math.max(0, i - 7), i);
      out.unshift({ label: dayLabel(items[0]!.date), title: `Week of ${dayLabel(items[0]!.date, true)}`, items });
    }
    return out;
  }, [rows, weekly]);
  const data = buckets.map((b) => {
    const t = sum(b.items);
    return { label: b.label, title: b.title, values: { spread: t.spread, commission: t.commission, swap: t.swap, bbook: t.bbook, ibCost: -t.ibCost }, net: t.net };
  });
  const cum = React.useMemo(() => {
    let acc = 0;
    return rows.map((d) => {
      acc += d.net;
      return { time: d.time, value: Math.round(acc), volume: Math.max(0, d.net) };
    });
  }, [rows]);
  const series = [...ANL_PNL_SOURCES, { key: "ibCost", label: "IB costs", color: "color-mix(in oklab, var(--k-down) 70%, var(--k-surface-3))" }];
  return (
    <Card className="h-full">
      <CardHeader
        title={mode === "daily" ? (weekly ? "Weekly revenue by source" : "Daily revenue by source") : "Cumulative net revenue"}
        subtitle={mode === "daily" ? "Stacked by source · IB costs below zero · line = net revenue" : `Running total over ${range} · server time GMT+3`}
        icon={<Layers />}
        action={<Segmented size="xs" value={mode} onChange={setMode} options={[{ value: "daily", label: weekly ? "Weekly" : "Daily" }, { value: "cumulative", label: "Cumulative" }]} />}
      />
      <div className="px-4 pb-5 pt-5 sm:px-6">
        {mode === "daily" ? (
          <StackedBars data={data} series={series} height={300} line={{ key: "net", label: "Net revenue", color: "var(--k-fg)", values: data.map((d) => d.net) }} />
        ) : (
          <div className="pt-2">
            <EquityChart data={cum} height={330} color="gold" />
          </div>
        )}
      </div>
    </Card>
  );
}

function BookSplit({ factor }: { factor: number }) {
  const { aBook, bBook } = ANL_BOOK_SPLIT;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="A-book vs B-book" subtitle="Share of traded volume · revenue attribution" icon={<ArrowLeftRight />} action={<Link href="/trading/routing"><Button size="sm" variant="surface">Routing</Button></Link>} />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-6 sm:flex-row">
        <Donut
          size={184}
          thickness={20}
          data={[
            { label: "B-book", value: bBook.volumePct, color: "var(--k-ember)" },
            { label: "A-book", value: aBook.volumePct, color: "var(--k-gold)" },
          ]}
          center={
            <div>
              <div className="k-num text-[26px] font-semibold leading-none">{bBook.volumePct}%</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-fg-3">internalised</div>
            </div>
          }
        />
        <div className="w-full flex-1 space-y-3">
          <div className="k-row px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[12.5px] text-fg-2"><span className="size-2.5 rounded-[3px] bg-ember" />B-book revenue</span>
              <span className="k-num text-[11.5px] text-fg-3">{bBook.volumePct}% vol</span>
            </div>
            <Money value={bBook.revenue * factor} decimals={0} className="mt-1 block text-[20px] font-semibold" />
          </div>
          <div className="k-row px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[12.5px] text-fg-2"><span className="size-2.5 rounded-[3px] bg-gold" />A-book revenue</span>
              <span className="k-num text-[11.5px] text-fg-3">{aBook.volumePct}% vol</span>
            </div>
            <Money value={aBook.revenue * factor} decimals={0} className="mt-1 block text-[20px] font-semibold" />
          </div>
        </div>
      </div>
      <div className="mx-6 mb-6 space-y-2.5 border-t border-line pt-4 text-[12.5px]">
        <div className="flex items-center justify-between"><span className="text-fg-3">Liquidity providers</span><span className="flex gap-1.5">{aBook.lps.map((l) => <Chip key={l} size="sm">{l}</Chip>)}</span></div>
        <div className="flex items-center justify-between"><span className="text-fg-3">A-book markup</span><span className="k-num text-fg">{aBook.markup} pips avg</span></div>
        <div className="flex items-center justify-between"><span className="text-fg-3">Toxic flow auto-hedged</span><span className="k-num text-fg">{formatNumber(bBook.clientsHedged, 0)} clients</span></div>
      </div>
    </Card>
  );
}

function SymbolRevenue({ factor }: { factor: number }) {
  const rows = [...ANL_PNL_SYMBOLS].sort((a, b) => b.net - a.net).slice(0, 10);
  const maxNet = Math.max(...rows.map((r) => r.net));
  const maxBB = Math.max(...rows.map((r) => Math.abs(r.bbook)));
  return (
    <Card className="h-full">
      <CardHeader title="Revenue by symbol" subtitle="Spread · commission · swap mix and B-book result" icon={<Coins />} action={<Link href="/config/symbols"><Button size="sm" variant="surface">Symbols</Button></Link>} />
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
            {rows.map((s, i) => {
              const fee = s.spread + s.commission + s.swap;
              return (
                <div key={s.symbol} className="grid grid-cols-[1.4fr_0.8fr_1.6fr_1.1fr_1fr] items-center gap-4 px-4 py-2.5 transition-colors hover:bg-surface-2/60">
                  <SymbolCell symbol={s.symbol} size={26} sub={`${s.bookA}% A-booked`} />
                  <span className="k-num text-right text-[13px] text-fg-2">{formatNumber(s.lots * factor, 0)}</span>
                  <div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-3" style={{ width: `${Math.max(18, (fee / maxNet) * 100)}%` }}>
                      <span style={{ width: `${(s.spread / fee) * 100}%`, background: "var(--k-ember)" }} />
                      <span style={{ width: `${(s.commission / fee) * 100}%`, background: "var(--k-gold)" }} />
                      <span style={{ width: `${(s.swap / fee) * 100}%`, background: "var(--k-info)" }} />
                    </div>
                    <div className="k-num mt-1 text-[11px] text-fg-3">{compactMoney(fee * factor)} fees</div>
                  </div>
                  <div>
                    <SplitMeter value={s.bbook} max={maxBB} />
                    <div className={cn("k-num mt-1 text-center text-[11px]", s.bbook >= 0 ? "text-up" : "text-down")}>{s.bbook >= 0 ? "+" : ""}{compactMoney(s.bbook * factor)}</div>
                  </div>
                  <div className="text-right">
                    <Money value={s.net * factor} decimals={0} countUp={false} className="text-[14px] font-semibold" />
                    <div className="k-num text-[11px] text-fg-3">#{i + 1}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

const GROUP_TONE = { Standard: "neutral", Pro: "ember", Cent: "info", ECN: "gold", Prop: "up" } as const;

function GroupRevenue({ factor }: { factor: number }) {
  const rows = ANL_PNL_GROUPS.map((g) => ({ ...g, net: g.revenue + g.bbook - g.ibCost }));
  const total = rows.reduce((s, g) => s + g.net, 0);
  const max = Math.max(...rows.map((r) => r.net));
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="By account group" subtitle="Net = fees + B-book − IB costs" icon={<BookOpen />} action={<Link href="/config"><Button size="sm" variant="surface">Groups</Button></Link>} />
      <div className="mt-4 flex-1 space-y-2.5 px-4 pb-5 sm:px-6">
        {rows.map((g, i) => (
          <div key={g.group} className="k-row px-4 py-3.5">
            <div className="flex items-center gap-3">
              <Chip tone={GROUP_TONE[g.group]} className="w-[84px] justify-center">{g.group}</Chip>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] text-fg-3">{g.note} · <span className="k-num">{formatNumber(g.accounts, 0)}</span> accts</div>
              </div>
              <div className="text-right">
                <Money value={g.net * factor} decimals={0} countUp={false} className="text-[15px] font-semibold" />
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              <Meter value={g.net} max={max} tone={i === 0 ? "mix" : "ember"} delay={i * 0.05} />
              <span className="k-num w-12 shrink-0 text-right text-[11.5px] text-fg-2">{((g.net / total) * 100).toFixed(1)}%</span>
            </div>
            <div className="k-num mt-2 grid grid-cols-3 gap-2 text-[11.5px] text-fg-3">
              <span>Fees <span className="text-fg-2">{compactMoney(g.revenue * factor)}</span></span>
              <span>B-book <span className={g.bbook > 0 ? "text-up" : "text-fg-2"}>{g.bbook ? compactMoney(g.bbook * factor) : "—"}</span></span>
              <span className="text-right">A-book <span className="text-fg-2">{g.bookA}%</span></span>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 px-4 pb-5 sm:px-6">
        <MiniStat label="Accounts" value={formatNumber(rows.reduce((s, g) => s + g.accounts, 0), 0)} />
        <MiniStat label="Lots" value={formatNumber(rows.reduce((s, g) => s + g.lots, 0) * factor, 0)} />
        <MiniStat label="Net / account" value={<Money value={(total * factor) / rows.reduce((s, g) => s + g.accounts, 0)} countUp={false} />} />
      </div>
    </Card>
  );
}

function ClientsTable() {
  const [side, setSide] = React.useState<"losing" | "winning">("losing");
  const rows = React.useMemo(
    () => ANL_CLIENT_PNL.filter((c) => (side === "losing" ? c.brokerPnl < 0 : c.brokerPnl > 0)).sort((a, b) => (side === "losing" ? a.brokerPnl - b.brokerPnl : b.brokerPnl - a.brokerPnl)),
    [side],
  );
  const max = Math.max(...rows.map((r) => Math.abs(r.brokerPnl)));
  const cols: Column<AnlClientPnl>[] = [
    {
      key: "client",
      header: "Client",
      cell: (c) => (
        <div className="flex items-center gap-3">
          <Avatar src={c.person.photo} name={c.person.name} size={32} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[13.5px] font-medium"><span className="truncate">{c.person.name}</span><Flag country={c.person.country} className="size-3.5" /></div>
            <div className="font-mono text-[11.5px] text-fg-3">{c.login}</div>
          </div>
        </div>
      ),
    },
    { key: "group", header: "Group", cell: (c) => <Chip size="sm" tone={GROUP_TONE[c.group]}>{c.group}</Chip>, hideOn: "md" },
    { key: "book", header: "Book", align: "center", cell: (c) => <Chip size="sm" tone={c.book === "A" ? "gold" : "ember"}>{c.book}-book</Chip> },
    { key: "lots", header: "Lots", align: "right", sort: (c) => c.lots, cell: (c) => <span className="k-num">{formatNumber(c.lots, 2)}</span> },
    { key: "trades", header: "Trades", align: "right", sort: (c) => c.trades, cell: (c) => <span className="k-num text-fg-2">{formatNumber(c.trades, 0)}</span>, hideOn: "lg" },
    {
      key: "tox",
      header: "Toxicity",
      sort: (c) => c.toxicity,
      cell: (c) => (
        <div className="flex w-28 items-center gap-2">
          <Meter value={c.toxicity} max={100} tone={c.toxicity > 60 ? "down" : c.toxicity > 35 ? "gold" : "up"} height={4} />
          <span className="k-num w-7 text-right text-[11.5px] text-fg-2">{c.toxicity}</span>
        </div>
      ),
    },
    {
      key: "pnl",
      header: "Broker P&L",
      align: "right",
      sort: (c) => c.brokerPnl,
      cell: (c) => (
        <div className="flex items-center justify-end gap-3">
          <div className="hidden w-24 xl:block"><Meter value={c.brokerPnl} max={max} tone={c.brokerPnl >= 0 ? "up" : "down"} height={4} /></div>
          <Money value={c.brokerPnl} signed tone="auto" decimals={0} countUp={false} className="text-[14px] font-semibold" />
        </div>
      ),
    },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (c) => (
        <Button
          size="xs"
          variant={c.brokerPnl < 0 && c.book === "B" ? "down-outline" : "ghost"}
          onClick={(e) => {
            e.stopPropagation();
            if (c.brokerPnl < 0 && c.book === "B") toast.success(`${c.login} moved to A-book`, { description: `${c.person.name} · new orders routed to LMAX Digital` });
            else toast(`Opening ${c.person.name}`, { description: `Account ${c.login}` });
          }}
        >
          {c.brokerPnl < 0 && c.book === "B" ? "Move to A" : "View"}
        </Button>
      ),
    },
  ];
  return (
    <Card>
      <CardHeader
        title="Top clients by broker P&L"
        subtitle={side === "losing" ? "Clients winning against the book — candidates for A-book routing" : "Clients the broker earns the most from"}
        icon={<Wallet />}
        action={<Segmented size="xs" value={side} onChange={setSide} options={[{ value: "losing", label: "Broker losing" }, { value: "winning", label: "Broker winning" }]} />}
      />
      <div className="mt-4 px-4 pb-5 sm:px-6">
        <DataTable columns={cols} rows={rows} pageSize={8} search={(c) => `${c.person.name} ${c.login}`} exportName={`broker-pnl-${side}-clients`} rowKey={(c) => c.login} onRowClick={(c) => toast(`Opening ${c.person.name}`, { description: `Account ${c.login}` })} />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function DemoBrokerPnlPage() {
  const [range, setRange] = React.useState<Range>("30D");
  const days = RANGE_DAYS[range];
  const rows = React.useMemo(() => ANL_PNL_DAILY.slice(-days), [days]);
  const prev = React.useMemo(() => ANL_PNL_DAILY.slice(-days * 2, -days), [days]);
  const t = sum(rows);
  const p = sum(prev);
  const factor = t.net / NET_30;
  const margin = (t.net / (t.spread + t.commission + t.swap + Math.max(0, t.bbook))) * 100;

  return (
    <div className="pb-16">
      <PageHeader
        title="Broker P&L"
        subtitle="Net revenue across spread, commission, swap and B-book · all tenants · GMT+3"
        actions={
          <>
            <Segmented value={range} onChange={setRange} options={RANGES} />
            <ExportActions name="Broker P&L" />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <Card hot className="relative overflow-hidden sm:col-span-2 lg:col-span-1 2xl:col-span-2">
          <Starfield density={40} />
          <div className="relative flex h-full flex-col px-6 pb-5 pt-6">
            <div className="flex items-start justify-between">
              <span className="k-label">Net revenue · {range}</span>
              <Chip tone={chg(t.net, p.net) >= 0 ? "up" : "down"}><Delta value={chg(t.net, p.net)} className="text-[11.5px]" /> vs prev</Chip>
            </div>
            <Money value={t.net} decimals={0} className="mt-4 block text-[40px] font-semibold leading-none tracking-[-0.02em]" />
            <div className="mt-auto grid grid-cols-3 gap-3 pt-5 text-[12px]">
              <div><div className="text-fg-3">Margin</div><div className="k-num mt-0.5 font-medium">{margin.toFixed(1)}%</div></div>
              <div><div className="text-fg-3">Per lot</div><div className="k-num mt-0.5 font-medium">${(t.net / t.lots).toFixed(2)}</div></div>
              <div><div className="text-fg-3">Lots</div><div className="k-num mt-0.5 font-medium">{formatNumber(t.lots, 0)}</div></div>
            </div>
          </div>
        </Card>
        <KpiCard label="B-book P&L" icon={<TrendingUp />} value={<Money value={t.bbook} decimals={0} tone="auto" />} footer={<Delta value={chg(t.bbook, p.bbook)} chip />} href="/trading/exposure" delay={0.05} />
        <KpiCard label="Spread" icon={<Percent />} value={<Money value={t.spread} decimals={0} />} footer={<Delta value={chg(t.spread, p.spread)} chip />} delay={0.08} />
        <KpiCard label="Commission" icon={<Coins />} value={<Money value={t.commission} decimals={0} />} footer={<Delta value={chg(t.commission, p.commission)} chip />} delay={0.11} />
        <KpiCard
          label="Swap · IB costs"
          icon={<Handshake />}
          value={<Money value={t.swap} decimals={0} />}
          footer={
            <span className="flex items-center gap-2 text-[11.5px] text-fg-3">
              IB <Money value={-t.ibCost} decimals={0} countUp={false} className="font-medium text-down" />
            </span>
          }
          href="/partners"
          delay={0.14}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <RevenueChart rows={rows} range={range} />
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-4">
          <BookSplit factor={factor} />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-7">
          <SymbolRevenue factor={factor} />
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-5">
          <GroupRevenue factor={factor} />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Revenue per active client" value={<Money value={t.net / 12_840} countUp={false} />} sub="12,840 active traders" />
        <MiniStat label="Revenue per $1M volume" value={<Money value={(t.net / (t.lots * 108_000)) * 1e6} countUp={false} />} sub="Notional-weighted" />
        <MiniStat label="Swap-free (Islamic) cost" value={<Money value={-t.swap * 0.11} countUp={false} tone="down" />} sub="Admin fee offsets 64%" />
        <MiniStat label="Bonus & credit cost" value={<Money value={-t.net * 0.034} countUp={false} tone="down" />} sub={<Link href="/marketing" className="hover:text-fg">3.4% of net · Marketing</Link>} />
      </div>

      <Reveal delay={0.1} className="mt-4">
        <ClientsTable />
      </Reveal>
    </div>
  );
}

/** Live builds: the reports service (/api/reports). Demo builds: mock data. */
export default function BrokerPnlPage() {
  return IS_DEMO ? <DemoBrokerPnlPage /> : <LiveBrokerPnl />;
}
