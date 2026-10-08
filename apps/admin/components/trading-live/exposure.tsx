"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Gauge as GaugeIcon, Layers, Scale } from "lucide-react";
import { Card, CardHeader, Chip, DataTable, EmptyState, KpiCard, PageHeader, Reveal, Segmented, SymbolCell, cn, formatNumber, type Column } from "@ezymex/ui";
import { PnlText, usdCompact } from "@/components/command/kit";
import { DeskStatusChip } from "@/components/trading-desk/status";
import { currentPriceOf, groupLabel, notionalUsd, positionPnl, useDesk, useLiveDirectory } from "@/lib/trading-desk";

type Row = { symbol: string; buyLots: number; sellLots: number; netLots: number; netUsd: number; aNetUsd: number; bNetUsd: number; clientPnl: number; bookPnl: number; positions: number; accounts: number };

const Q0 = { bid: 0, ask: 0 };

/** Live exposure: net client exposure per symbol from the engine's open positions (dealing stream). */
export function LiveExposurePage() {
  const { state } = useDesk();
  useLiveDirectory();
  const [book, setBook] = React.useState<"all" | "A" | "B">("B");
  const [view, setView] = React.useState<"usd" | "lots">("usd");

  const positions = state.positions.filter((p) => book === "all" || p.route === book);
  const rows: Row[] = React.useMemo(() => {
    const m = new Map<string, Row & { logins: Set<string> }>();
    for (const p of state.positions) {
      const r = m.get(p.symbol) ?? { symbol: p.symbol, buyLots: 0, sellLots: 0, netLots: 0, netUsd: 0, aNetUsd: 0, bNetUsd: 0, clientPnl: 0, bookPnl: 0, positions: 0, accounts: 0, logins: new Set<string>() };
      const px = currentPriceOf(p, Q0) || p.openPrice;
      const usd = (p.side === "buy" ? 1 : -1) * notionalUsd(p.symbol, p.volume, px);
      if (p.route === "A") r.aNetUsd += usd;
      else r.bNetUsd += usd;
      if (book === "all" || p.route === book) {
        if (p.side === "buy") r.buyLots += p.volume;
        else r.sellLots += p.volume;
        r.netLots += p.side === "buy" ? p.volume : -p.volume;
        r.netUsd += usd;
        const pnl = positionPnl(p, Q0);
        r.clientPnl += pnl;
        if (p.route === "B") r.bookPnl -= pnl;
        r.positions++;
        r.logins.add(p.login);
      }
      m.set(p.symbol, r);
    }
    return [...m.values()].filter((r) => r.positions > 0).map(({ logins, ...r }) => ({ ...r, accounts: logins.size })).sort((a, b) => Math.abs(b.netUsd) - Math.abs(a.netUsd));
  }, [state.positions, book]);

  const gross = rows.reduce((s, r) => s + Math.abs(r.netUsd), 0);
  const long = rows.filter((r) => r.netUsd > 0).reduce((s, r) => s + r.netUsd, 0);
  const short = rows.filter((r) => r.netUsd < 0).reduce((s, r) => s + r.netUsd, 0);
  const bookPnl = rows.reduce((s, r) => s + r.bookPnl, 0);
  const max = Math.max(1, ...rows.map((r) => Math.abs(view === "usd" ? r.netUsd : r.netLots)));

  const groups = React.useMemo(() => {
    const m = new Map<string, { net: number; lots: number; n: number }>();
    for (const p of positions) {
      const g = m.get(p.group) ?? { net: 0, lots: 0, n: 0 };
      const px = currentPriceOf(p, Q0) || p.openPrice;
      g.net += (p.side === "buy" ? 1 : -1) * notionalUsd(p.symbol, p.volume, px);
      g.lots += p.volume;
      g.n++;
      m.set(p.group, g);
    }
    return [...m.entries()].sort((a, b) => Math.abs(b[1].net) - Math.abs(a[1].net));
  }, [positions]);
  const gmax = Math.max(1, ...groups.map(([, g]) => Math.abs(g.net)));

  const cols: Column<Row>[] = [
    { key: "s", header: "Symbol", cell: (r) => <SymbolCell symbol={r.symbol} size={24} sub={<span className="text-[11px] text-fg-3">{r.positions} pos · {r.accounts} accounts</span>} />, sort: (r) => r.symbol },
    { key: "b", header: "Buy lots", align: "right", cell: (r) => <span className="k-num font-mono text-[12px] text-up">{formatNumber(r.buyLots, 2)}</span>, sort: (r) => r.buyLots },
    { key: "se", header: "Sell lots", align: "right", cell: (r) => <span className="k-num font-mono text-[12px] text-down">{formatNumber(r.sellLots, 2)}</span>, sort: (r) => r.sellLots },
    {
      key: "n",
      header: view === "usd" ? "Client net (USD)" : "Client net (lots)",
      cell: (r) => {
        const v = view === "usd" ? r.netUsd : r.netLots;
        const w = (Math.abs(v) / max) * 50;
        return (
          <span className="flex items-center gap-2">
            <span className="relative h-2 w-40 rounded-full bg-surface-3">
              <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
              <span className={cn("absolute inset-y-0 rounded-full", v >= 0 ? "left-1/2 bg-up" : "right-1/2 bg-down")} style={{ width: `${w}%` }} />
            </span>
            <span className={cn("k-num w-20 text-right font-mono text-[12px]", v >= 0 ? "text-up" : "text-down")}>{view === "usd" ? usdCompact(v, 1) : formatNumber(v, 2)}</span>
          </span>
        );
      },
      sort: (r) => (view === "usd" ? r.netUsd : r.netLots),
      csv: (r) => (view === "usd" ? r.netUsd.toFixed(0) : r.netLots.toFixed(2)),
    },
    { key: "bb", header: "Broker B-book net", align: "right", cell: (r) => <span className={cn("k-num font-mono text-[12px]", -r.bNetUsd >= 0 ? "text-fg-2" : "text-fg-2")}>{usdCompact(-r.bNetUsd, 1)}</span>, sort: (r) => -r.bNetUsd, csv: (r) => (-r.bNetUsd).toFixed(0) },
    { key: "aa", header: "A-book net", align: "right", hideOn: "lg", cell: (r) => <span className="k-num font-mono text-[12px] text-info">{usdCompact(r.aNetUsd, 1)}</span>, sort: (r) => r.aNetUsd },
    { key: "cp", header: "Client floating", align: "right", cell: (r) => <PnlText value={r.clientPnl} className="font-mono text-[12px]" />, sort: (r) => r.clientPnl, csv: (r) => r.clientPnl.toFixed(2) },
    { key: "bp", header: "Book floating", align: "right", cell: (r) => <PnlText value={r.bookPnl} className="font-mono text-[12px]" />, sort: (r) => r.bookPnl, csv: (r) => r.bookPnl.toFixed(2) },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="Exposure"
        subtitle={<span className="inline-flex flex-wrap items-center gap-2">Net client exposure per symbol from open positions on the trading engine. The broker holds the opposite side of the B-book. <DeskStatusChip /></span>}
        actions={
          <div className="flex flex-wrap gap-2">
            <Segmented size="md" value={book} onChange={setBook} options={[{ value: "B", label: "B-book" }, { value: "A", label: "A-book" }, { value: "all", label: "A + B" }]} />
            <Segmented size="md" value={view} onChange={setView} options={[{ value: "usd", label: "Net USD" }, { value: "lots", label: "Net lots" }]} />
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Gross exposure" icon={<Scale />} value={<span className="k-num">{usdCompact(gross, 1)}</span>} chip={`${rows.length} symbols`} />
        <KpiCard label="Clients net long" icon={<ArrowUpRight />} value={<span className="k-num text-up">{usdCompact(long, 1)}</span>} chip={book === "B" ? "Book short" : "Client side"} chipTone="up" delay={0.04} />
        <KpiCard label="Clients net short" icon={<ArrowDownRight />} value={<span className="k-num text-down">{usdCompact(short, 1)}</span>} chip={book === "B" ? "Book long" : "Client side"} chipTone="down" delay={0.08} />
        <KpiCard label="B-book floating" icon={<GaugeIcon />} value={<PnlText value={bookPnl} />} hot chip="Broker view · live" chipTone="ember" delay={0.12} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.06} className="xl:col-span-8">
          <Card className="px-4 py-5 sm:px-6">
            <DataTable
              columns={cols}
              rows={rows}
              dense
              pageSize={20}
              rowKey={(r) => r.symbol}
              exportName="exposure"
              empty={<EmptyState title="No open exposure" text="Net exposure appears as soon as positions are open on this book." illustration="chart_increasing" />}
            />
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-4">
          <Card className="h-full">
            <CardHeader title="By group" subtitle="Client net USD per account group" icon={<Layers />} />
            <div className="space-y-2.5 px-6 pb-6 pt-4">
              {groups.length === 0 && <div className="text-[12.5px] text-fg-3">No open positions.</div>}
              {groups.map(([code, g]) => (
                <div key={code} className="text-[12.5px]">
                  <div className="flex items-center justify-between">
                    <span>{groupLabel(code)}</span>
                    <span className={cn("k-num font-mono", g.net >= 0 ? "text-up" : "text-down")}>{usdCompact(g.net, 1)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className={cn("h-full rounded-full", g.net >= 0 ? "bg-up" : "bg-down")} style={{ width: `${(Math.abs(g.net) / gmax) * 100}%` }} />
                  </div>
                  <div className="mt-0.5 text-[11px] text-fg-3">
                    {g.n} positions · {formatNumber(g.lots, 2)} lots
                  </div>
                </div>
              ))}
              <div className="pt-2">
                <Chip size="sm" tone="neutral">Limits and alerts come with the risk module</Chip>
              </div>
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
