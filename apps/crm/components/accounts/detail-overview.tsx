"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  Button,
  CHART_COLORS,
  Card,
  CardHeader,
  Chip,
  DivergingBar,
  Donut,
  EquityChart,
  Gauge,
  KeyValue,
  Money,
  Reveal,
  Segmented,
  SymbolAvatar,
  cn,
  formatDateTime,
  formatNumber,
  type SeriesPoint,
} from "@/components/kit";
import { ASSET_CLASS_LABEL, equitySeries, freeMargin, getInstrument, hashString, marginLevel, type ClosedTrade, type TradingAccount } from "@kalks/mock";
import { PnlCalendar } from "./pnl-calendar";
import { useFormat, useT } from "@kalks/i18n/react";

export const curOf = (a: TradingAccount) => (a.cent ? "USC " : "$");
export const multOf = (a: TradingAccount) => (a.cent ? 100 : 1);

const RANGES = ["1W", "1M", "3M", "6M", "1Y"] as const;
const RANGE_DAYS: Record<(typeof RANGES)[number], number> = { "1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365 };

function StatTile({ label, children, tone, sub }: { label: string; children: React.ReactNode; tone?: "up" | "down" | "warn"; sub?: React.ReactNode }) {
  return (
    <div className="k-row min-w-0 px-4 py-3">
      <div className="text-[12px] text-fg-3">{label}</div>
      <div className={cn("k-num mt-1 break-words text-[14px] font-semibold leading-snug sm:truncate sm:text-[16px]", tone === "up" && "text-up", tone === "down" && "text-down", tone === "warn" && "text-warn")}>{children}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-fg-3">{sub}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export function OverviewTab({ a, openPnl, trades, onTab }: { a: TradingAccount; openPnl: number; trades: ClosedTrade[]; onTab: (t: string) => void }) {
  const t = useT();
  const f = useFormat();
  const cur = curOf(a);
  const mult = multOf(a);
  const isDemo = a.type === "demo";
  const [range, setRange] = React.useState<(typeof RANGES)[number]>(isDemo ? "1W" : "3M");
  const all = React.useMemo(() => equitySeries(isDemo ? 30 : 365, a.equity, hashString(a.login) % 997), [a.equity, a.login, isDemo]);
  const data = React.useMemo(() => all.slice(-RANGE_DAYS[range]), [all, range]);
  const [hover, setHover] = React.useState<SeriesPoint | null>(null);
  const onHover = React.useCallback((p: SeriesPoint | null) => setHover(p), []);
  const first = data[0]!.value;
  const shown = hover?.value ?? a.equity;
  const diff = shown - first;
  const ml = marginLevel(a);
  const fm = freeMargin(a);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-8">
          <Card className="h-full">
            <div className="flex flex-col gap-4 px-6 pt-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="k-label">{t("accountDetail.equity.title")}</div>
                <div className="mt-2 flex flex-wrap items-baseline gap-3">
                  <Money value={shown} currency={cur} countUp={!hover} className="text-[28px] font-semibold tracking-tight" />
                  <Chip tone={diff >= 0 ? "up" : "down"}>
                    {diff >= 0 ? "+" : "-"}
                    {cur}
                    {formatNumber(Math.abs(diff))} ({((diff / first) * 100).toFixed(2)}%)
                  </Chip>
                </div>
                <div className="mt-1 text-xs text-fg-3">{hover ? f.date(hover.time * 1000, { day: "2-digit", month: "short", year: "numeric" }) : t("accountDetail.equity.changeOver", { range })}</div>
              </div>
              <Segmented size="xs" value={range} onChange={setRange} options={isDemo ? (["1W", "1M"] as const) : RANGES} />
            </div>
            <div className="px-3 pb-4 pt-2">
              <EquityChart data={data} height={300} onHover={onHover} />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.05} className="xl:col-span-4">
          <Card className="h-full">
            <CardHeader title={t("accountDetail.keyStats.title")} subtitle={t("accountDetail.keyStats.subtitle")} action={<Chip tone={ml > 500 ? "up" : ml > 200 ? "warn" : "down"} dot>{ml > 500 ? t("accountDetail.health.healthy") : ml > 200 ? t("accountDetail.health.watch") : t("accountDetail.health.atRisk")}</Chip>} />
            <div className="flex justify-center py-2">
              <Gauge value={Number.isFinite(ml) ? Math.min(ml, 3000) : 0} max={3000} size={190} display={Number.isFinite(ml) ? `${Math.round(ml).toLocaleString()}%` : "—"} label={t("accountDetail.stat.marginLevel")} />
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 pb-5 sm:px-6">
              <StatTile label={t("common.balance")}>
                <Money value={a.balance} currency={cur} />
              </StatTile>
              <StatTile label={t("common.equity")}>
                <Money value={a.equity} currency={cur} />
              </StatTile>
              <StatTile label={t("accountDetail.stat.credit")}>
                <Money value={a.credit} currency={cur} countUp={false} />
              </StatTile>
              <StatTile label={t("accountDetail.stat.margin")}>
                <Money value={a.margin} currency={cur} />
              </StatTile>
              <StatTile label={t("accountDetail.stat.freeMargin")}>
                <Money value={fm} currency={cur} />
              </StatTile>
              <StatTile label={t("accountDetail.stat.openPnl")} tone={openPnl >= 0 ? "up" : "down"}>
                <Money value={openPnl} currency={cur} signed countUp={false} />
              </StatTile>
            </div>
          </Card>
        </Reveal>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.08} className="xl:col-span-7">
          <Card className="h-full">
            <CardHeader
              title={t("accountDetail.recentTrades.title")}
              subtitle={t("accountDetail.recentTrades.count", { count: trades.length })}
              action={
                <Button size="sm" variant="surface" onClick={() => onTab("history")}>
                  {t("accountDetail.overview.fullHistory")}
                </Button>
              }
            />
            <div className="k-fade-bottom mt-4 space-y-2 px-4 pb-5 sm:px-6">
              {trades.slice(0, 5).map((tr) => (
                <div key={tr.ticket} className="k-row flex items-center gap-3 px-4 py-2.5">
                  <SymbolAvatar symbol={tr.symbol} size={24} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13.5px] font-medium">
                      {tr.symbol}
                      <Chip size="sm" tone={tr.side === "buy" ? "up" : "down"}>
                        {tr.side === "buy" ? t("accountDetail.side.buy") : t("accountDetail.side.sell")} {tr.volume}
                      </Chip>
                    </div>
                    <div className="k-num mt-0.5 truncate font-mono text-[11px] text-fg-3">
                      {tr.openPrice} → {tr.closePrice} · {formatDateTime(tr.closeTime)}
                    </div>
                  </div>
                  <Money value={tr.profit * mult} currency={cur} signed tone="auto" countUp={false} className="text-[14px] font-semibold" />
                </div>
              ))}
              {trades.length === 0 && <div className="py-8 text-center text-[13px] text-fg-3">{t("accountDetail.recentTrades.none")}</div>}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.12} className="xl:col-span-5">
          <Card className="h-full">
            <CardHeader title={t("accountDetail.info.title")} />
            <div className="px-6 pb-4 pt-1">
              <KeyValue
                rows={[
                  [t("common.type"), <span key="t">{a.type === "live" ? t("common.live") : t("common.demo")} · {a.group}</span>],
                  [t("accountDetail.info.positionMode"), a.mode === "hedging" ? t("accountDetail.info.hedging") : t("accountDetail.info.netting")],
                  [t("common.currency"), a.cent ? t("accountDetail.info.uscCents") : "USD"],
                  [t("accountDetail.info.leverage"), `1:${a.leverage.toLocaleString()}`],
                  [t("accountDetail.header.swapFree"), a.swapFree ? <Chip key="s" size="sm" tone="info">{t("accountDetail.info.islamic")}</Chip> : t("common.no")],
                  [t("accountDetail.info.server"), <span key="sv" className="font-mono">{a.server}</span>],
                  [t("accountDetail.info.opened"), f.date(a.createdAt, { day: "2-digit", month: "short", year: "numeric" })],
                ]}
              />
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Portfolio                                                           */
/* ------------------------------------------------------------------ */

function Legend({ items, total }: { items: { label: string; value: number; color?: string }[]; total: number }) {
  return (
    <div className="w-full min-w-0 flex-1 space-y-1.5">
      {items.map((d, i) => (
        <div key={d.label} className="flex items-center gap-2.5 text-[12.5px]">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color ?? CHART_COLORS[i % CHART_COLORS.length] }} />
          <span className="min-w-0 flex-1 truncate text-fg-2">{d.label}</span>
          <span className="k-num font-medium">{((d.value / total) * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export function PortfolioTab({ a, trades }: { a: TradingAccount; trades: ClosedTrade[] }) {
  const t = useT();
  const cur = curOf(a);
  const mult = multOf(a);
  const bySymbol = React.useMemo(() => {
    const m = new Map<string, number>();
    trades.forEach((t) => m.set(t.symbol, (m.get(t.symbol) ?? 0) + t.volume));
    const arr = [...m.entries()].sort((x, y) => y[1] - x[1]);
    const top = arr.slice(0, 5).map(([label, value]) => ({ label, value: +value.toFixed(2) }));
    const rest = arr.slice(5).reduce((s, [, v]) => s + v, 0);
    return rest > 0 ? [...top, { label: t("accountDetail.split.other"), value: +rest.toFixed(2), color: "#63636e" }] : top;
  }, [trades, t]);
  const byClass = React.useMemo(() => {
    const m = new Map<string, number>();
    trades.forEach((tr) => {
      const c = ASSET_CLASS_LABEL[getInstrument(tr.symbol).assetClass];
      m.set(c, (m.get(c) ?? 0) + tr.volume);
    });
    return [...m.entries()].sort((x, y) => y[1] - x[1]).map(([label, value]) => ({ label, value: +value.toFixed(2) }));
  }, [trades]);
  const volTotal = trades.reduce((s, t) => s + t.volume, 0) || 1;
  const longs = trades.filter((t) => t.side === "buy");
  const shorts = trades.filter((t) => t.side === "sell");
  const lp = longs.reduce((s, t) => s + t.profit, 0) * mult;
  const sp = shorts.reduce((s, t) => s + t.profit, 0) * mult;
  const wins = trades.filter((t) => t.profit > 0);
  const losses = trades.filter((t) => t.profit <= 0);
  const gw = wins.reduce((s, t) => s + t.profit, 0);
  const gl = Math.abs(losses.reduce((s, t) => s + t.profit, 0));
  const holdMin = trades.length ? trades.reduce((s, t) => s + (Date.parse(t.closeTime) - Date.parse(t.openTime)) / 60000, 0) / trades.length : 0;
  const holdLabel = holdMin >= 60 ? t("accountDetail.perf.holdHm", { h: Math.floor(holdMin / 60), m: Math.round(holdMin % 60) }) : t("accountDetail.perf.holdM", { m: Math.round(holdMin) });
  const days = new Set(trades.map((t) => t.closeTime.slice(0, 10))).size;
  const best = trades.reduce<ClosedTrade | null>((b, t) => (!b || t.profit > b.profit ? t : b), null);
  const worst = trades.reduce<ClosedTrade | null>((b, t) => (!b || t.profit < b.profit ? t : b), null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader title={t("accountDetail.pnlCalendar.title")} subtitle={t("accountDetail.pnlCalendar.subtitle")} />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <PnlCalendar trades={trades} currency={cur} mult={mult} />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.05} className="xl:col-span-4">
          <Card className="h-full">
            <CardHeader title={t("accountDetail.perf.title")} subtitle={t("accountDetail.perf.subtitle")} />
            <div className="grid grid-cols-2 gap-2 px-4 pb-4 pt-4 sm:px-6">
              <StatTile label={t("accountDetail.perf.netProfit")} tone={gw - gl >= 0 ? "up" : "down"}>
                <Money value={(gw - gl) * mult} currency={cur} signed countUp={false} />
              </StatTile>
              <StatTile label={t("accountDetail.perf.winRate")} sub={t("accountDetail.perf.winsLosses", { wins: wins.length, losses: losses.length })}>
                {trades.length ? ((wins.length / trades.length) * 100).toFixed(1) : "0"}%
              </StatTile>
              <StatTile label={t("accountDetail.perf.profitFactor")}>{gl ? (gw / gl).toFixed(2) : "—"}</StatTile>
              <StatTile label={t("accountDetail.perf.trades")} sub={t("accountDetail.perf.lots", { value: formatNumber(volTotal) })}>
                {trades.length}
              </StatTile>
              <StatTile label={t("accountDetail.perf.avgWin")} tone="up">
                +{cur}
                {formatNumber(wins.length ? (gw / wins.length) * mult : 0)}
              </StatTile>
              <StatTile label={t("accountDetail.perf.avgLoss")} tone="down">
                -{cur}
                {formatNumber(losses.length ? (gl / losses.length) * mult : 0)}
              </StatTile>
              <StatTile label={t("accountDetail.perf.avgHold")}>{holdLabel}</StatTile>
              <StatTile label={t("accountDetail.perf.tradingDays")} sub={t("accountDetail.perf.tradesPerDay", { value: Math.round(((trades.length || 0) / (days || 1)) * 10) / 10 })}>
                {days}
              </StatTile>
            </div>
            <div className="space-y-2 px-4 pb-5 sm:px-6">
              {best && (
                <div className="k-row flex items-center gap-3 px-4 py-2.5">
                  <SymbolAvatar symbol={best.symbol} size={22} />
                  <div className="flex-1 text-[12.5px] text-fg-3">
                    {t("accountDetail.perf.bestTrade")} <span className="font-medium text-fg">{best.symbol}</span>
                  </div>
                  <Money value={best.profit * mult} currency={cur} signed tone="auto" countUp={false} className="text-[13px] font-semibold" />
                </div>
              )}
              {worst && (
                <div className="k-row flex items-center gap-3 px-4 py-2.5">
                  <SymbolAvatar symbol={worst.symbol} size={22} />
                  <div className="flex-1 text-[12.5px] text-fg-3">
                    {t("accountDetail.perf.worstTrade")} <span className="font-medium text-fg">{worst.symbol}</span>
                  </div>
                  <Money value={worst.profit * mult} currency={cur} signed tone="auto" countUp={false} className="text-[13px] font-semibold" />
                </div>
              )}
            </div>
          </Card>
        </Reveal>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Reveal delay={0.05}>
          <Card className="h-full">
            <CardHeader title={t("accountDetail.split.bySymbol")} subtitle={t("accountDetail.split.subtitle")} />
            <div className="flex flex-col items-center gap-5 px-6 pb-6 pt-4 sm:flex-row">
              <Donut data={bySymbol} size={150} thickness={16} center={<div className="text-center"><div className="k-num text-[18px] font-semibold">{bySymbol.length}</div><div className="text-[11.5px] text-fg-3">{t("accountDetail.split.symbols")}</div></div>} />
              <Legend items={bySymbol} total={volTotal} />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1}>
          <Card className="h-full">
            <CardHeader title={t("accountDetail.split.byClass")} subtitle={t("accountDetail.split.subtitle")} />
            <div className="flex flex-col items-center gap-5 px-6 pb-6 pt-4 sm:flex-row">
              <Donut data={byClass} size={150} thickness={16} center={<div className="text-center"><div className="k-num text-[18px] font-semibold">{formatNumber(volTotal, 1)}</div><div className="text-[11.5px] text-fg-3">{t("accountDetail.split.lots")}</div></div>} />
              <Legend items={byClass} total={volTotal} />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="lg:col-span-2 xl:col-span-1">
          <Card className="h-full">
            <CardHeader title={t("accountDetail.longShort.title")} subtitle={t("accountDetail.longShort.subtitle")} />
            <div className="px-6 pb-6 pt-5">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-up">{t("accountDetail.longShort.long")}</div>
                  <div className="k-num text-[26px] font-semibold">{trades.length ? Math.round((longs.length / trades.length) * 100) : 0}%</div>
                </div>
                <div className="text-end">
                  <div className="text-[11px] uppercase tracking-wider text-down">{t("accountDetail.longShort.short")}</div>
                  <div className="k-num text-[26px] font-semibold">{trades.length ? Math.round((shorts.length / trades.length) * 100) : 0}%</div>
                </div>
              </div>
              <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full bg-gradient-to-r from-up/60 to-up transition-all duration-700" style={{ width: `${(longs.length / (trades.length || 1)) * 100}%` }} />
                <div className="h-full flex-1 bg-gradient-to-r from-down to-down/60" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="k-row px-3 py-2.5">
                  <div className="text-[11px] text-fg-3">{t("accountDetail.longShort.buysPnl", { count: longs.length })}</div>
                  <Money value={lp} currency={cur} signed tone="auto" countUp={false} className="text-[14px] font-semibold" />
                </div>
                <div className="k-row px-3 py-2.5">
                  <div className="text-[11px] text-fg-3">{t("accountDetail.longShort.sellsPnl", { count: shorts.length })}</div>
                  <Money value={sp} currency={cur} signed tone="auto" countUp={false} className="text-[14px] font-semibold" />
                </div>
              </div>
              <div className="mt-5">
                <div className="mb-2 flex justify-between text-[11.5px] text-fg-3">
                  <span>{t("accountDetail.longShort.netBias")}</span>
                  <span className="k-num">
                    {t("accountDetail.perf.lots", { value: formatNumber(longs.reduce((s, x) => s + x.volume, 0) - shorts.reduce((s, x) => s + x.volume, 0)) })}
                  </span>
                </div>
                <DivergingBar value={longs.reduce((s, t) => s + t.volume, 0) - shorts.reduce((s, t) => s + t.volume, 0)} max={volTotal / 2} />
              </div>
              <Link href="/portfolio/analytics" className="mt-5 inline-flex items-center gap-1 text-[12.5px] text-fg-3 hover:text-ember">
                {t("accountDetail.longShort.deepAnalytics")} <ArrowUpRight className="size-3.5 rtl:-scale-x-100" />
              </Link>
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
