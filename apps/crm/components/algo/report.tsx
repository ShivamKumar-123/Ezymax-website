"use client";

// Backtest report (D86): KPIs, equity + drawdown, metrics, monthly returns, trades, data coverage and costs.

import * as React from "react";
import { Info } from "lucide-react";
import { Card, CardHeader, Chip, DataTable, EquityChart, Tabs, cn, type Column } from "@kalks/ui";
import { useFormat, useT } from "@kalks/i18n/react";
import { fmtDate, fmtDateTime, fmtMoney, fmtNum, fmtPct, fmtSigned, type BacktestDetail, type Trade } from "./api";

const MONTHS = ["developer.month.jan", "developer.month.feb", "developer.month.mar", "developer.month.apr", "developer.month.may", "developer.month.jun", "developer.month.jul", "developer.month.aug", "developer.month.sep", "developer.month.oct", "developer.month.nov", "developer.month.dec"] as const;

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
  const t = useT();
  const f = useFormat();
  const r = bt.report!;
  const m = r.metrics;
  const [tab, setTab] = React.useState<"trades" | "metrics" | "data">("trades");
  const eq = React.useMemo(() => r.equity.map((p) => ({ time: p.t, value: p.equity })), [r.equity]);
  const dd = React.useMemo(() => r.equity.map((p) => ({ time: p.t, value: p.dd })), [r.equity]);
  const cols: Column<Trade>[] = [
    { key: "id", header: "#", cell: (x) => <span className="font-mono text-fg-3">{x.id}</span>, sort: (x) => x.id, width: "56px" },
    { key: "side", header: t("developer.col.side"), cell: (x) => <Chip size="sm" tone={x.side === "buy" ? "up" : "down"}>{(x.side === "buy" ? t("common.buy") : t("common.sell")).toUpperCase()}</Chip>, sort: (x) => x.side },
    { key: "vol", header: t("developer.col.lots"), cell: (x) => <span className="k-num tabular-nums">{x.volume}</span>, align: "right", sort: (x) => x.volume },
    { key: "open", header: t("developer.col.open"), cell: (x) => <span className="k-num text-fg-2">{fmtDateTime(x.openTime)}</span>, sort: (x) => x.openTime, csv: (x) => new Date(x.openTime * 1000).toISOString() },
    { key: "op", header: t("developer.col.price"), cell: (x) => <span className="k-num tabular-nums">{x.openPrice}</span>, align: "right", hideOn: "md" },
    { key: "close", header: t("developer.col.close"), cell: (x) => <span className="k-num text-fg-2">{fmtDateTime(x.closeTime)}</span>, sort: (x) => x.closeTime, hideOn: "sm", csv: (x) => new Date(x.closeTime * 1000).toISOString() },
    { key: "cp", header: t("developer.col.price"), cell: (x) => <span className="k-num tabular-nums">{x.closePrice}</span>, align: "right", hideOn: "md" },
    { key: "reason", header: t("developer.col.exit"), cell: (x) => <span className="text-fg-2">{t.dyn(`developer.exit.${x.reason}`, x.reason.replace(/_/g, " "))}</span>, sort: (x) => x.reason, hideOn: "lg" },
    { key: "swap", header: t("developer.col.swap"), cell: (x) => <span className="k-num tabular-nums text-fg-3">{fmtSigned(x.swap)}</span>, align: "right", hideOn: "xl", sort: (x) => x.swap },
    { key: "net", header: t("developer.col.net"), cell: (x) => <span className={cn("k-num tabular-nums font-medium", x.net >= 0 ? "text-up" : "text-down")}>{fmtSigned(x.net)}</span>, align: "right", sort: (x) => x.net },
  ];
  const rows: [string, React.ReactNode][] = [
    [t("developer.report.initialFinal"), `${fmtMoney(m.initialBalance)} → ${fmtMoney(m.finalBalance)}`],
    [t("developer.report.grossPl"), `${fmtMoney(m.grossProfit)} / ${fmtMoney(m.grossLoss)}`],
    [t("developer.report.cagr"), fmtPct(m.cagrPct, 2)],
    [t("developer.report.expectancyPerTrade"), fmtMoney(m.expectancy)],
    [t("developer.report.avgWinLoss"), `${fmtMoney(m.avgWin)} / ${fmtMoney(m.avgLoss)}`],
    [t("developer.report.largestWinLoss"), `${fmtMoney(m.largestWin)} / ${fmtMoney(m.largestLoss)}`],
    [t("developer.report.payoff"), fmtNum(m.payoffRatio)],
    [t("developer.report.longTrades"), `${m.longTrades} (${fmtNum(m.longWinRate, 1)}%)`],
    [t("developer.report.shortTrades"), `${m.shortTrades} (${fmtNum(m.shortWinRate, 1)}%)`],
    [t("developer.report.maxConsecutive"), `${m.maxConsecutiveWins} / ${m.maxConsecutiveLosses}`],
    [t("developer.report.maxDrawdown"), `${fmtMoney(m.maxDrawdown)} (${fmtNum(m.maxDrawdownPct)}%)`],
    [t("developer.report.recovery"), fmtNum(m.recoveryFactor)],
    [t("developer.report.sharpeSortino"), `${fmtNum(m.sharpe)} / ${fmtNum(m.sortino)}`],
    [t("developer.report.avgBars"), fmtNum(m.avgBarsHeld, 1)],
    [t("developer.report.timeInMarket"), `${fmtNum(m.exposurePct, 1)}%`],
    [t("developer.report.costs"), `${fmtMoney(m.totalCommission)} / ${fmtMoney(m.totalSwap)} / ${fmtMoney(m.spreadCost)}`],
    [t("developer.report.barsTested"), f.number(m.barsTested, 0)],
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
        <Kpi label={t("developer.report.netProfit")} value={fmtMoney(m.netProfit)} tone={m.netProfit >= 0 ? "up" : "down"} sub={fmtPct(m.returnPct, 2)} />
        <Kpi label={t("developer.report.profitFactor")} value={fmtNum(m.profitFactor)} tone={(m.profitFactor ?? 0) >= 1 ? "fg" : "down"} />
        <Kpi label={t("developer.dep.winRate")} value={`${fmtNum(m.winRate, 1)}%`} sub={`${m.wins} / ${m.trades}`} />
        <Kpi label={t("developer.report.maxDrawdown")} value={`${fmtNum(m.maxDrawdownPct)}%`} tone="down" sub={fmtMoney(m.maxDrawdown)} />
        <Kpi label={t("developer.report.sharpe")} value={fmtNum(m.sharpe)} sub={t("developer.report.sortino", { v: fmtNum(m.sortino) })} />
        <Kpi label={t("developer.market.trades")} value={String(m.trades)} sub={t("developer.report.longShort", { long: m.longTrades, short: m.shortTrades })} />
        <Kpi label={t("developer.report.expectancy")} value={fmtMoney(m.expectancy)} tone={m.expectancy >= 0 ? "up" : "down"} sub={t("developer.report.perTrade")} />
      </div>
      <Card className="overflow-hidden">
        <CardHeader title={t("developer.report.equityCurve")} subtitle={`${fmtDate(r.firstBar)} → ${fmtDate(r.lastBar)} · ${r.model}`} />
        <div className="px-3 pb-2 pt-3">
          {eq.length > 1 ? <EquityChart data={eq} height={280} showVolume={false} intraday color={m.netProfit >= 0 ? "gold" : "down"} lines={[{ price: m.initialBalance, label: t("developer.report.start"), tone: "fg-3" }]} /> : <div className="p-8 text-center text-fg-3">{t("developer.report.noEquity")}</div>}
        </div>
        <div className="border-t border-line px-3 pb-3 pt-2">
          <div className="px-3 pt-1 text-[11px] uppercase tracking-wider text-fg-3">{t("developer.report.drawdownPct")}</div>
          {dd.length > 1 && <EquityChart data={dd} height={110} showVolume={false} intraday color="down" />}
        </div>
      </Card>
      <Card>
        <CardHeader title={t("developer.report.monthly")} subtitle={t("developer.report.monthlySub")} />
        <div className="overflow-x-auto px-6 pb-5 pt-4">
          <table className="w-full min-w-[760px] text-[12px]">
            <thead>
              <tr className="text-fg-3">
                <th className="py-1.5 text-start font-medium">{t("developer.report.year")}</th>
                {MONTHS.map((mo) => (
                  <th key={mo} className="py-1.5 text-center font-medium">
                    {t(mo)}
                  </th>
                ))}
                <th className="py-1.5 text-end font-medium">{t("developer.report.year")}</th>
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
                  <td className={cn("k-num tabular-nums py-1 text-end font-semibold", y.total >= 0 ? "text-up" : "text-down")}>{fmtPct(y.total, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <div className="px-6 pt-4">
          <Tabs value={tab} onChange={setTab} tabs={[{ value: "trades", label: t("developer.market.trades"), count: m.trades }, { value: "metrics", label: t("developer.report.allMetrics") }, { value: "data", label: t("developer.report.dataCosts") }]} />
        </div>
        <div className="px-6 pb-6 pt-4">
          {tab === "trades" && <DataTable columns={cols} rows={r.trades} pageSize={15} dense exportName={`backtest-${bt.id}-trades`} rowKey={(x) => String(x.id)} empty={<div className="py-8 text-center text-fg-3">{t("developer.report.noTrades")}</div>} />}
          {tab === "metrics" && (
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-line/60 py-2 text-[13px]">
                  <span className="text-fg-3">{k}</span>
                  <span className="k-num tabular-nums text-fg">{v}</span>
                </div>
              ))}
            </div>
          )}
          {tab === "data" && (
            <div className="grid grid-cols-1 gap-6 text-[13px] md:grid-cols-2">
              <div>
                <div className="k-label mb-2">{t("developer.report.historyUsed")}</div>
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
                  <span className="text-fg-2">{t("developer.report.m1Bars")}</span>
                  <span className="k-num text-fg-3">
                    {f.number(c.m1Bars, 0)}
                    {c.m1From ? ` ${t("developer.report.fromDate", { date: fmtDate(c.m1From) })}` : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-fg-2">{t("developer.report.signals")}</span>
                  <span className="k-num text-fg-3">
                    {r.signals.buy} / {r.signals.sell} / {r.signals.exitBuy + r.signals.exitSell}
                  </span>
                </div>
                {r.skipped.length > 0 && (
                  <div className="mt-2 text-[12px] text-fg-3">
                    {t("developer.report.skipped")} {r.skipped.map((s) => `${s.reason} (${s.count})`).join(" · ")}
                  </div>
                )}
              </div>
              <div>
                <div className="k-label mb-2">{t("developer.report.costsModelled")}</div>
                {(
                  [
                    [t("developer.report.accountGroup"), c.costs.group],
                    [t("developer.bt.spread"), t("developer.report.spreadValue", { points: fmtNum(c.costs.spreadPoints, 1), source: c.costs.spreadSource })],
                    [t("developer.report.commission"), t("developer.report.perLot", { amount: fmtMoney(c.costs.commissionPerLot) })],
                    [t("developer.report.swaps"), c.costs.swaps ? t("developer.report.swapsOn") : t("developer.report.swapsOff")],
                    [t("developer.report.plConversion"), c.costs.usdBase ? t("developer.report.usdBase") : c.costs.quoteToUsd === 1 ? t("developer.report.usdQuoted") : t("developer.report.currentRate", { rate: fmtNum(c.costs.quoteToUsd, 5) })],
                    [t("developer.report.execution"), t("developer.report.executionValue")],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between border-b border-line/60 py-2">
                    <span className="text-fg-2">{k}</span>
                    <span className="text-end text-fg-3">{v}</span>
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
