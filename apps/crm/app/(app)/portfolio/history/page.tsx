"use client";

import * as React from "react";
import Link from "next/link";
import { Bot, Code2, Copy as CopyIcon, Download, Hand, Search, Workflow, X } from "lucide-react";
import { Button, Card, Chip, DataTable, Menu, Money, PageHeader, Reveal, Segmented, SymbolCell, cn, formatMoney, formatNumber, type Column } from "@/components/kit";
import { HISTORY, getInstrument, type ClosedTrade } from "@kalks/mock";
import { LIVE_ACCOUNTS, PORTFOLIO_NOW } from "@kalks/mock/portfolio-extra";
import { downloadCsv, serverTime } from "@/components/portfolio/export";
import { IS_DEMO as DEMO_BUILD } from "@kalks/mock/mode";
import { LiveHistoryPage } from "@/components/trading/portfolio";

const PRESETS = ["Today", "7D", "30D", "90D", "All"] as const;
type Preset = (typeof PRESETS)[number];

function since(p: Preset) {
  if (p === "All") return 0;
  if (p === "Today") return Date.parse("2026-09-23T21:00:00Z"); // 00:00 GMT+3
  return PORTFOLIO_NOW - { "7D": 7, "30D": 30, "90D": 90 }[p] * 86400_000;
}

const SOURCE: Record<ClosedTrade["source"], { label: string; tone: "neutral" | "gold" | "info" | "ember"; icon: React.ReactNode }> = {
  manual: { label: "Manual", tone: "neutral", icon: <Hand className="size-3" /> },
  copy: { label: "Copy", tone: "gold", icon: <CopyIcon className="size-3" /> },
  api: { label: "API", tone: "info", icon: <Code2 className="size-3" /> },
  strategy: { label: "Strategy", tone: "ember", icon: <Workflow className="size-3" /> },
};

function DemoTradeHistoryPage() {
  const [account, setAccount] = React.useState("all");
  const [preset, setPreset] = React.useState<Preset>("30D");
  const [q, setQ] = React.useState("");
  const [source, setSource] = React.useState<"all" | ClosedTrade["source"]>("all");

  const rows = React.useMemo(() => {
    const from = since(preset);
    const qq = q.trim().toUpperCase();
    return HISTORY.filter(
      (t) =>
        (account === "all" || t.login === account) &&
        Date.parse(t.closeTime) >= from &&
        (!qq || t.symbol.includes(qq) || t.ticket.includes(qq)) &&
        (source === "all" || t.source === source),
    );
  }, [account, preset, q, source]);

  const totals = React.useMemo(() => {
    const commission = rows.reduce((s, t) => s + t.commission, 0);
    const swap = rows.reduce((s, t) => s + t.swap, 0);
    const net = rows.reduce((s, t) => s + t.profit, 0);
    const gross = net - swap + commission;
    return { trades: rows.length, lots: rows.reduce((s, t) => s + t.volume, 0), gross, charges: commission - swap, net, wins: rows.filter((t) => t.profit > 0).length };
  }, [rows]);

  const cols: Column<ClosedTrade>[] = [
    { key: "ticket", header: "Ticket", cell: (t) => <span className="font-mono text-[12.5px] text-fg-2">#{t.ticket}</span>, sort: (t) => t.ticket },
    { key: "login", header: "Account", hideOn: "lg", cell: (t) => <span className="font-mono text-[12.5px] text-fg-3">{t.login}</span> },
    { key: "symbol", header: "Symbol", cell: (t) => <SymbolCell symbol={t.symbol} size={24} />, sort: (t) => t.symbol },
    {
      key: "side",
      header: "Side",
      cell: (t) => (
        <Chip size="sm" tone={t.side === "buy" ? "up" : "down"}>
          {t.side.toUpperCase()}
        </Chip>
      ),
    },
    { key: "vol", header: "Volume", align: "right", cell: (t) => <span className="k-num">{t.volume.toFixed(2)}</span>, sort: (t) => t.volume },
    {
      key: "price",
      header: "Open → close",
      align: "right",
      cell: (t) => {
        const d = getInstrument(t.symbol).digits;
        return (
          <div className="k-num font-mono text-[12.5px]">
            <div className="text-fg-3">{formatNumber(t.openPrice, d)}</div>
            <div>{formatNumber(t.closePrice, d)}</div>
          </div>
        );
      },
    },
    {
      key: "time",
      header: "Open / close time",
      hideOn: "md",
      cell: (t) => (
        <div className="k-num font-mono text-[11.5px] leading-5">
          <div className="text-fg-3">{serverTime(t.openTime)}</div>
          <div className="text-fg-2">{serverTime(t.closeTime)}</div>
        </div>
      ),
      sort: (t) => t.closeTime,
    },
    { key: "swap", header: "Swap", align: "right", hideOn: "lg", cell: (t) => <span className={cn("k-num text-[12.5px]", t.swap < 0 ? "text-down/80" : "text-fg-3")}>{t.swap ? formatNumber(t.swap, 2) : "0.00"}</span>, sort: (t) => t.swap },
    { key: "comm", header: "Comm.", align: "right", hideOn: "lg", cell: (t) => <span className={cn("k-num text-[12.5px]", t.commission ? "text-down/80" : "text-fg-3")}>{t.commission ? `-${formatNumber(t.commission, 2)}` : "0.00"}</span>, sort: (t) => t.commission },
    { key: "profit", header: "Profit", align: "right", cell: (t) => <Money value={t.profit} countUp={false} signed tone="auto" className="font-semibold" />, sort: (t) => t.profit },
    {
      key: "source",
      header: "Source",
      align: "right",
      hideOn: "sm",
      cell: (t) => (
        <Chip size="sm" tone={SOURCE[t.source].tone}>
          {SOURCE[t.source].icon}
          {SOURCE[t.source].label}
        </Chip>
      ),
    },
  ];

  const accountLabel = account === "all" ? "All accounts" : `#${account}`;

  const exportCsv = () =>
    downloadCsv(
      `kalks-trades-${preset.toLowerCase()}`,
      rows.map((t) => ({
        ticket: t.ticket,
        account: t.login,
        symbol: t.symbol,
        side: t.side,
        volume: t.volume,
        open_price: t.openPrice,
        close_price: t.closePrice,
        open_time: serverTime(t.openTime, true),
        close_time: serverTime(t.closeTime, true),
        swap: t.swap,
        commission: -t.commission,
        profit: t.profit,
        source: t.source,
      })),
    );

  return (
    <div className="pb-24">
      <PageHeader
        title="Trade history"
        subtitle="Every closed trade across your live accounts. Unlimited history, times in GMT+3."
        actions={
          <>
            <Link href="/portfolio/statements">
              <Button variant="surface">Statements</Button>
            </Link>
            <Button variant="ember" onClick={exportCsv}>
              <Download /> Export CSV
            </Button>
          </>
        }
      />

      <Reveal delay={0.08}>
        <Card className="px-4 pb-5 pt-5 sm:px-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Menu
              align="start"
              trigger={
                <Button size="sm" variant="surface">
                  <span className="font-mono">{accountLabel}</span>
                </Button>
              }
              items={[{ label: "All accounts", onSelect: () => setAccount("all") }, "sep", ...LIVE_ACCOUNTS.map((a) => ({ label: <span className="font-mono">#{a.login}</span>, hint: a.nickname ?? a.group, onSelect: () => setAccount(a.login) }))]}
            />
            <Segmented size="xs" value={preset} onChange={setPreset} options={PRESETS} />
            <Segmented
              size="xs"
              value={source}
              onChange={setSource}
              options={[
                { value: "all", label: "All sources" },
                { value: "manual", label: "Manual" },
                { value: "copy", label: "Copy" },
                { value: "api", label: "API" },
                { value: "strategy", label: <><Bot className="size-3" /> Strategy</> },
              ]}
            />
            <div className="ml-auto flex h-9 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5">
              <Search className="size-3.5 text-fg-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Symbol or ticket…" className="w-36 bg-transparent text-[13px] outline-none placeholder:text-fg-3 sm:w-44" />
              {q && (
                <button onClick={() => setQ("")} aria-label="Clear" className="text-fg-3 hover:text-fg">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
          <DataTable columns={cols} rows={rows} pageSize={12} dense rowKey={(t) => t.ticket} />
          <div className="k-hot-card mt-4 grid grid-cols-2 gap-3 rounded-[16px] px-5 py-4 text-[13px] sm:grid-cols-5">
            <div>
              <div className="text-[12px] text-fg-3">Trades</div>
              <div className="k-num mt-1 font-semibold">{totals.trades}</div>
            </div>
            <div>
              <div className="text-[12px] text-fg-3">Lots</div>
              <div className="k-num mt-1 font-semibold">{totals.lots.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[12px] text-fg-3">Gross P&L</div>
              <div className={cn("k-num mt-1 font-semibold", totals.gross >= 0 ? "text-up" : "text-down")}>{formatMoney(totals.gross)}</div>
            </div>
            <div>
              <div className="text-[12px] text-fg-3">Charges</div>
              <div className="k-num mt-1 font-semibold text-down">{formatMoney(-totals.charges)}</div>
            </div>
            <div className="col-span-2 sm:col-span-1 sm:text-right">
              <div className="text-[12px] text-fg-3">Net total</div>
              <div className={cn("k-num mt-1 text-[16px] font-semibold", totals.net >= 0 ? "text-up" : "text-down")}>{formatMoney(totals.net)}</div>
            </div>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}

/** Live builds: real accounts from the trading engine (via /api/trading). Demo builds: mock data. */
export default function TradeHistoryPage() {
  return DEMO_BUILD ? <DemoTradeHistoryPage /> : <LiveHistoryPage />;
}
