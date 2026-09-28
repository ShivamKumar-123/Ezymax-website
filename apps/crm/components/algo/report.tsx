"use client";

// Backtest report (D86): KPIs, equity + drawdown, metrics, monthly returns, trades, data coverage and costs.

import * as React from "react";
import { Info } from "lucide-react";
import { Card, CardHeader, Chip, DataTable, EquityChart, Tabs, cn, type Column } from "@kalks/ui";
import { fmtDate, fmtDateTime, fmtMoney, fmtNum, fmtPct, fmtSigned, type BacktestDetail, type Trade } from "./api";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Kpi({ label, value, tone, sub }: { label: string; value: string; tone?: "up" | "down" | "fg"; sub?: string }) {
  return (
    <div className="rounded-[14px] border border-line bg-surface-2/50 px-4 py-3">
      <div className="text-[10.5px] uppercase tracking-[0.06em] text-fg-3">{label}</div>
      <div className={cn("k-num mt-1 text-[20px] font-semibold", tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-fg")}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-fg-3">{sub}</div>}
    </div>
  );
}

function heat(v: number | null) {
  if (v === null) return "text-fg-3";
  const a = Math.min(1, Math.abs(v) / 6);
  return v >= 0 ? (a > 0.5 ? "bg-up/35 text-up" : a > 0.15 ? "bg-up/20 text-up" : "bg-up/10 text-up") : a > 0.5 ? "bg-down/35 text-down" : a > 0.15 ? "bg-down/20 text-down" : "bg-down/10 text-down";
}

export function BacktestReport({ bt }: { bt: BacktestDetail }) {
  const r = bt.report!;
  const m = r.metrics;
  const [tab, setTab] = React.useState<"trades" | "metrics" | "data">("trades");
  const eq = React.useMemo(() => r.equity.map((p) => ({ time: p.t, value: p.equity })), [r.equity]);
  const dd = React.useMemo(() => r.equity.map((p) => ({ time: p.t, value: p.dd })), [r.equity]);
  const cols: Column<Trade>[] = [
    { key: "id", header: "#", cell: (t) => <span className="font-mono text-fg-3">{t.id}</span>, sort: (t) => t.id, width: "56px" },
    { key: "side", header: "Side", cell: (t) => <Chip size="sm" tone={t.side === "buy" ? "up" : "down"}>{t.side.toUpperCase()}</Chip>, sort: (t) => t.side },
    { key: "vol", header: "Lots", cell: (t) => <span className="k-num">{t.volume}</span>, align: "right", sort: (t) => t.volume },
    { key: "open", header: "Open", cell: (t) => <span className="k-num text-fg-2">{fmtDateTime(t.openTime)}</span>, sort: (t) => t.openTime, csv: (t) => new Date(t.openTime * 1000).toISOString() },
    { key: "op", header: "Price", cell: (t) => <span className="k-num">{t.openPrice}</span>, align: "right", hideOn: "md" },
    { key: "close", header: "Close", cell: (t) => <span className="k-num text-fg-2">{fmtDateTime(t.closeTime)}</span>, sort: (t) => t.closeTime, hideOn: "sm", csv: (t) => new Date(t.closeTime * 1000).toISOString() },
    { key: "cp", header: "Price", cell: (t) => <span className="k-num">{t.closePrice}</span>, align: "right", hideOn: "md" },
    { key: "reason", header: "Exit", cell: (t) => <span className="text-fg-2">{t.reason.replace(/_/g, " ")}</span>, sort: (t) => t.reason, hideOn: "lg" },
    { key: "swap", header: "Swap", cell: (t) => <span className="k-num text-fg-3">{fmtSigned(t.swap)}</span>, align: "right", hideOn: "xl", sort: (t) => t.swap },
    { key: "net", header: "Net", cell: (t) => <span className={cn("k-num font-medium", t.net >= 0 ? "text-up" : "text-down")}>{fmtSigned(t.net)}</span>, align: "right", sort: (t) => t.net },
  ];
  const rows: [string, React.ReactNode][] = [
    ["Initial / final balance", `${fmtMoney(m.initialBalance)} → ${fmtMoney(m.finalBalance)}`],
    ["Gross profit / loss", `${fmtMoney(m.grossProfit)} / ${fmtMoney(m.grossLoss)}`],
    ["CAGR", fmtPct(m.cagrPct, 2)],
    ["Expectancy per trade", fmtMoney(m.expectancy)],
    ["Average win / loss", `${fmtMoney(m.avgWin)} / ${fmtMoney(m.avgLoss)}`],
    ["Largest win / loss", `${fmtMoney(m.largestWin)} / ${fmtMoney(m.largestLoss)}`],
    ["Payoff ratio", fmtNum(m.payoffRatio)],
    ["Long trades (win rate)", `${m.longTrades} (${fmtNum(m.longWinRate, 1)}%)`],
    ["Short trades (win rate)", `${m.shortTrades} (${fmtNum(m.shortWinRate, 1)}%)`],
    ["Max consecutive wins / losses", `${m.maxConsecutiveWins} / ${m.maxConsecutiveLosses}`],
    ["Max drawdown", `${fmtMoney(m.maxDrawdown)} (${fmtNum(m.maxDrawdownPct)}%)`],
    ["Recovery factor", fmtNum(m.recoveryFactor)],
    ["Sharpe / Sortino (daily, annualised)", `${fmtNum(m.sharpe)} / ${fmtNum(m.sortino)}`],
    ["Average bars held", fmtNum(m.avgBarsHeld, 1)],
    ["Time in market", `${fmtNum(m.exposurePct, 1)}%`],
    ["Commission / swap / spread cost", `${fmtMoney(m.totalCommission)} / ${fmtMoney(m.totalSwap)} / ${fmtMoney(m.spreadCost)}`],
    ["Bars tested", m.barsTested.toLocaleString("en-US")],
  ];
  const c = r.coverage;
  return (
    <div className="space-y-5" data-testid="backtest-report">
      {r.notes.length > 0 && (
        <div className="space-y-1 rounded-[14px] border border-warn/30 bg-warn-soft px-4 py-3 text-[12.5px] text-warn">
          {r.notes.map((n) => (
            <div key={n} className="flex items-start gap-2">
              <Info className="mt-0.5 size-3.5 shrink-0" /> {n}
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <Kpi label="Net profit" value={fmtMoney(m.netProfit)} tone={m.netProfit >= 0 ? "up" : "down"} sub={fmtPct(m.returnPct, 2)} />
        <Kpi label="Profit factor" value={fmtNum(m.profitFactor)} tone={(m.profitFactor ?? 0) >= 1 ? "fg" : "down"} />
        <Kpi label="Win rate" value={`${fmtNum(m.winRate, 1)}%`} sub={`${m.wins} / ${m.trades}`} />
        <Kpi label="Max drawdown" value={`${fmtNum(m.maxDrawdownPct)}%`} tone="down" sub={fmtMoney(m.maxDrawdown)} />
        <Kpi label="Sharpe" value={fmtNum(m.sharpe)} sub={`Sortino ${fmtNum(m.sortino)}`} />
        <Kpi label="Trades" value={String(m.trades)} sub={`${m.longTrades} long · ${m.shortTrades} short`} />
        <Kpi label="Expectancy" value={fmtMoney(m.expectancy)} tone={m.expectancy >= 0 ? "up" : "down"} sub="per trade" />
      </div>
      <Card className="overflow-hidden">
        <CardHeader title="Equity curve" subtitle={`${fmtDate(r.firstBar)} → ${fmtDate(r.lastBar)} · ${r.model}`} />
        <div className="px-3 pb-2 pt-3">
          {eq.length > 1 ? <EquityChart data={eq} height={280} showVolume={false} intraday color={m.netProfit >= 0 ? "gold" : "down"} lines={[{ price: m.initialBalance, label: "Start", tone: "fg-3" }]} /> : <div className="p-8 text-center text-fg-3">No equity points</div>}
        </div>
        <div className="border-t border-line px-3 pb-3 pt-2">
          <div className="px-3 pt-1 text-[11px] uppercase tracking-wider text-fg-3">Drawdown %</div>
          {dd.length > 1 && <EquityChart data={dd} height={110} showVolume={false} intraday color="down" />}
        </div>
      </Card>
      <Card>
        <CardHeader title="Monthly returns" subtitle="% of equity at the start of each month (server time)" />
        <div className="overflow-x-auto px-6 pb-5 pt-4">
          <table className="w-full min-w-[760px] text-[12px]">
            <thead>
              <tr className="text-fg-3">
                <th className="py-1.5 text-left font-medium">Year</th>
                {MONTHS.map((mo) => (
                  <th key={mo} className="py-1.5 text-center font-medium">
                    {mo}
                  </th>
                ))}
                <th className="py-1.5 text-right font-medium">Year</th>
              </tr>
            </thead>
            <tbody>
              {r.monthly.map((y) => (
                <tr key={y.year}>
                  <td className="py-1 font-mono text-fg-2">{y.year}</td>
                  {y.months.map((v, i) => (
                    <td key={i} className="p-0.5">
                      <div className={cn("k-num rounded-md py-1.5 text-center", heat(v))}>{v === null ? "·" : fmtNum(v, 1)}</div>
                    </td>
                  ))}
                  <td className={cn("k-num py-1 text-right font-semibold", y.total >= 0 ? "text-up" : "text-down")}>{fmtPct(y.total, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <div className="px-6 pt-4">
          <Tabs value={tab} onChange={setTab} tabs={[{ value: "trades", label: "Trades", count: m.trades }, { value: "metrics", label: "All metrics" }, { value: "data", label: "Data & costs" }]} />
        </div>
        <div className="px-6 pb-6 pt-4">
          {tab === "trades" && <DataTable columns={cols} rows={r.trades} pageSize={15} dense exportName={`backtest-${bt.id}-trades`} rowKey={(t) => String(t.id)} empty={<div className="py-8 text-center text-fg-3">No trades in this range</div>} />}
          {tab === "metrics" && (
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-line/60 py-2 text-[13px]">
                  <span className="text-fg-3">{k}</span>
                  <span className="k-num text-fg">{v}</span>
                </div>
              ))}
            </div>
          )}
          {tab === "data" && (
            <div className="grid grid-cols-1 gap-6 text-[13px] md:grid-cols-2">
              <div>
                <div className="k-label mb-2">History used</div>
                {c.segments.map((s, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-line/60 py-2">
                    <span className="text-fg-2">
                      {s.tf} · {s.source}
                    </span>
                    <span className="k-num text-fg-3">
                      {fmtDate(s.from)} → {fmtDate(s.to)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-b border-line/60 py-2">
                  <span className="text-fg-2">M1 bars for the intrabar model</span>
                  <span className="k-num text-fg-3">
                    {c.m1Bars.toLocaleString("en-US")}
                    {c.m1From ? ` from ${fmtDate(c.m1From)}` : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-fg-2">Signals (buy / sell / exits)</span>
                  <span className="k-num text-fg-3">
                    {r.signals.buy} / {r.signals.sell} / {r.signals.exitBuy + r.signals.exitSell}
                  </span>
                </div>
                {r.skipped.length > 0 && (
                  <div className="mt-2 text-[12px] text-fg-3">
                    Skipped signals: {r.skipped.map((s) => `${s.reason} (${s.count})`).join(" · ")}
                  </div>
                )}
              </div>
              <div>
                <div className="k-label mb-2">Costs modelled</div>
                {(
                  [
                    ["Account group", c.costs.group],
                    ["Spread", `${fmtNum(c.costs.spreadPoints, 1)} points (${c.costs.spreadSource})`],
                    ["Commission (round turn)", `${fmtMoney(c.costs.commissionPerLot)} per lot`],
                    ["Swaps", c.costs.swaps ? "charged at rollover (triple day included)" : "off (swap-free)"],
                    ["P&L conversion", c.costs.usdBase ? "1 / price (USD base)" : c.costs.quoteToUsd === 1 ? "USD quoted" : `× ${fmtNum(c.costs.quoteToUsd, 5)} (current rate)`],
                    ["Execution", "next bar open after the signal bar closes"],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between border-b border-line/60 py-2">
                    <span className="text-fg-2">{k}</span>
                    <span className="text-right text-fg-3">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
