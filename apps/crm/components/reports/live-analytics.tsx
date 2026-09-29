"use client";

// Live Portfolio → Analytics (D91) and the account page's Analytics tab, on the reports service
// (/api/reports/analytics). All amounts are USD (cent accounts converted); times are server time.

import * as React from "react";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Clock3, Download, FileText, Gauge as GaugeIcon, Percent, RefreshCw, Scale, ShieldCheck, Target, TrendingDown, Trophy, Zap } from "lucide-react";
import { Button, Card, CardHeader, Chip, Donut, EmptyState, KpiCard, Menu, Money, PageHeader, Reveal, Segmented, Skeleton, SymbolAvatar, cn, formatMoney } from "@kalks/ui";
import { ColumnBars, DrawdownChart, HourHeatmap, MultiLineChart, PnlBars, Waterfall } from "@/components/portfolio/charts";
import { tr, useT } from "@kalks/i18n/react";

/* ------------------------------------------------------------------ */
/* Shapes (services/reports/README.md, GET /v1/me/analytics)            */
/* ------------------------------------------------------------------ */

type TradeRef = { deal: number; ticket: number; login: number; symbol: string; side: string; volume: number; net: number; closeTime: string } | null;
export type Stats = {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  grossProfit: number;
  grossLoss: number;
  net: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number | null;
  expectancy: number;
  rewardRisk: number | null;
  avgHoldSecs: number;
  avgHoldWinSecs: number;
  avgHoldLossSecs: number;
  lots: number;
  commission: number;
  swap: number;
  profit: number;
  maxConsecWins: number;
  maxConsecLosses: number;
  best: TradeRef;
  worst: TradeRef;
};
type Group = { key: string; trades: number; wins: number; winRate: number; net: number; lots: number };
type Insight = { id: string; tone: "up" | "down" | "warn" | "info"; title: string; stat: string; text: string; tip: string };
export type Analytics = {
  scope: "account" | "live";
  from: string;
  to: string;
  accounts: { login: number; type: "live" | "demo"; group: string; groupName: string; currency: string; cent: boolean; equity: number; balance: number }[];
  curve: {
    points: { day: string; balance: number; equity: number; flow: number; index: number; drawdown: number }[];
    maxDrawdown: number;
    currentDrawdown: number;
    returnPct: number;
    sharpe: number | null;
    sortino: number | null;
    volatility: number | null;
  };
  stats: Stats;
  long: Stats;
  short: Stats;
  bySymbol: Group[];
  byWeekday: Group[];
  bySession: { session: string; hours: string; trades: number; net: number; winRate: number }[];
  hourHeatmap: number[][];
  hourTrades: number[][];
  moneyFlow: { deposits: number; withdrawals: number; tradingPnl: number; commission: number; performanceFees: number; bonus: number; adjustments: number; earnings: number; equityNow: number };
  charges: { commission: number; swapPaid: number; swapEarned: number; performanceFees: number; walletFees: number; spreadEstimate: number };
  behaviour: {
    overtradingDays: number;
    revengeTrades: number;
    avgRiskPct: number;
    maxRiskPct: number;
    stopOuts: number;
    closedBySl: number;
    closedByTp: number;
    insights: Insight[];
  };
};

const PERIODS = ["7D", "30D", "90D", "1Y", "ALL"] as const;
type Period = (typeof PERIODS)[number];
const PERIOD_DAYS: Record<Period, number> = { "7D": 7, "30D": 30, "90D": 90, "1Y": 365, ALL: 3650 };
const DAYS = ["portfolio.an.day.mon", "portfolio.an.day.tue", "portfolio.an.day.wed", "portfolio.an.day.thu", "portfolio.an.day.fri", "portfolio.an.day.sat", "portfolio.an.day.sun"] as const;

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function periodRange(p: Period) {
  const to = new Date();
  to.setDate(to.getDate() + 1);
  const from = new Date();
  from.setDate(from.getDate() - PERIOD_DAYS[p] + 1);
  return { from: isoDay(from), to: isoDay(to) };
}

export function fmtHold(secs: number) {
  if (!secs) return "—";
  const m = Math.round(secs / 60);
  if (m >= 1440) return tr("portfolio.an.hold.dh", { d: Math.floor(m / 1440), h: Math.floor((m % 1440) / 60) });
  if (m >= 60) return tr("portfolio.an.hold.hm", { h: Math.floor(m / 60), m: m % 60 });
  return m ? tr("portfolio.an.hold.m", { m }) : tr("portfolio.an.hold.s", { s: Math.round(secs) });
}

export function useAnalytics(login: number | "all", period: Period) {
  const [data, setData] = React.useState<Analytics | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [nonce, setNonce] = React.useState(0);
  React.useEffect(() => {
    const ctl = new AbortController();
    const { from, to } = periodRange(period);
    setLoading(true);
    fetch(`/api/reports/analytics?login=${login}&from=${from}&to=${to}`, { signal: ctl.signal, cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error?.message ?? tr("portfolio.an.unavailable"));
        setData(j as Analytics);
        setError(null);
      })
      .catch((e) => {
        if (!ctl.signal.aborted) setError(e instanceof Error && e.message ? e.message : tr("portfolio.an.unavailable"));
      })
      .finally(() => !ctl.signal.aborted && setLoading(false));
    return () => ctl.abort();
  }, [login, period, nonce]);
  return { data, error, loading, reload: () => setNonce((n) => n + 1) };
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function Curves({ d, label }: { d: Analytics; label: string }) {
  const pts = d.curve.points;
  const times = pts.map((p) => Date.parse(`${p.day}T12:00:00Z`));
  const t = useT();
  return (
    <Card className="h-full">
      <CardHeader
        title={t("portfolio.an.curves.title")}
        subtitle={t("portfolio.an.curves.subtitle", { label })}
        action={
          <div className="hidden items-center gap-3 text-[12px] text-fg-2 sm:flex">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full bg-gold" /> {t("common.equity")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0 w-4 border-t border-dashed border-fg-2" /> {t("common.balance")}
            </span>
          </div>
        }
      />
      {pts.length < 2 ? (
        <div className="px-6 pb-8 pt-6 text-[13px] text-fg-3">{t("portfolio.an.curves.empty")}</div>
      ) : (
        <>
          <div className="px-4 pt-4 sm:px-6">
            <MultiLineChart
              times={times}
              height={260}
              series={[
                { key: "eq", label: t("common.equity"), color: "var(--k-gold)", values: pts.map((p) => p.equity), fill: true },
                { key: "bal", label: t("common.balance"), color: "var(--k-fg-2)", values: pts.map((p) => p.balance), dashed: true },
              ]}
            />
          </div>
          <div className="mt-2 flex items-center justify-between px-6 pt-3">
            <div className="k-label">{t("portfolio.an.curves.drawdown")}</div>
            <Chip size="sm" tone="down">
              {t("portfolio.an.curves.max", { value: d.curve.maxDrawdown.toFixed(2) })}
            </Chip>
          </div>
          <div className="px-4 pb-5 pt-2 sm:px-6">
            <DrawdownChart times={times} values={pts.map((p) => p.drawdown)} height={140} />
          </div>
        </>
      )}
    </Card>
  );
}

function StatsCard({ s, curve }: { s: Stats; curve: Analytics["curve"] }) {
  const t = useT();
  const rows: [string, React.ReactNode][] = [
    [t("portfolio.an.stats.net"), <Money key="n" value={s.net} countUp={false} signed tone="auto" />],
    [t("portfolio.an.stats.avgWin"), <span key="aw" className="text-up">+{formatMoney(s.avgWin)}</span>],
    [t("portfolio.an.stats.avgLoss"), <span key="al" className="text-down">-{formatMoney(s.avgLoss)}</span>],
    [t("portfolio.an.stats.expectancy"), formatMoney(s.expectancy)],
    [t("portfolio.an.stats.commSwap"), <span key="c" className={s.swap - s.commission < 0 ? "text-down" : ""}>{formatMoney(s.swap - s.commission)}</span>],
    [t("portfolio.an.stats.holding"), `${fmtHold(s.avgHoldWinSecs)} / ${fmtHold(s.avgHoldLossSecs)}`],
    [t("portfolio.an.stats.streaks"), `${s.maxConsecWins} / ${s.maxConsecLosses}`],
    [t("portfolio.an.stats.sharpe"), `${curve.sharpe?.toFixed(2) ?? "—"} · ${curve.sortino?.toFixed(2) ?? "—"}`],
    [t("portfolio.an.stats.return"), <span key="r" className={curve.returnPct >= 0 ? "text-up" : "text-down"}>{curve.returnPct >= 0 ? "+" : ""}{curve.returnPct.toFixed(2)}%</span>],
  ];
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title={t("portfolio.an.stats.title")} subtitle={t("portfolio.closedTrades", { count: s.trades })} />
      <div className="grid grid-cols-2 gap-3 px-6 pt-4">
        <div className="k-row px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-fg-3">{t("portfolio.an.stats.grossProfit")}</div>
          <Money value={s.grossProfit} countUp={false} className="mt-1 block text-[16px] font-semibold text-up" />
        </div>
        <div className="k-row px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-fg-3">{t("portfolio.an.stats.grossLoss")}</div>
          <Money value={-s.grossLoss} countUp={false} className="mt-1 block text-[16px] font-semibold text-down" />
        </div>
      </div>
      <div className="mt-2 flex-1 divide-y divide-line px-6">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
            <span className="text-fg-3">{k}</span>
            <span className="k-num text-end font-medium tabular-nums">{v}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 px-6 pb-6 pt-3">
        {[
          { t: s.best, label: t("portfolio.an.stats.best"), icon: <ArrowUpRight className="size-3.5 text-up" /> },
          { t: s.worst, label: t("portfolio.an.stats.worst"), icon: <ArrowDownRight className="size-3.5 text-down" /> },
        ].map(({ t: tr, label, icon }) => (
          <div key={label} className="k-row px-3.5 py-3">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-fg-3">
              {icon}
              {label}
            </div>
            {tr ? (
              <>
                <div className="mt-2 flex items-center gap-2">
                  <SymbolAvatar symbol={tr.symbol} size={20} />
                  <span className="text-[13px] font-medium">{tr.symbol}</span>
                </div>
                <div className={cn("k-num mt-1 text-[15px] font-semibold", tr.net >= 0 ? "text-up" : "text-down")}>
                  {tr.net >= 0 ? "+" : "-"}
                  {formatMoney(Math.abs(tr.net))}
                </div>
                <div className="font-mono text-[10.5px] text-fg-3">
                  #{tr.ticket} · {tr.login}
                </div>
              </>
            ) : (
              <div className="mt-2 text-[12.5px] text-fg-3">—</div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

const TONE_CLASS = { up: "text-up", down: "text-down", warn: "text-warn", info: "text-gold" } as const;
const TONE_LINE = { up: "bg-up/50", down: "bg-down/50", warn: "bg-warn/50", info: "bg-gold/50" } as const;
const INSIGHT_ICON: Record<string, React.ReactNode> = {
  overtrading: <Zap />,
  revenge: <AlertTriangle />,
  risk: <ShieldCheck />,
  hold_losers: <Clock3 />,
  stop_out: <TrendingDown />,
  sl_tp: <Target />,
  session: <Trophy />,
};

function Insights({ b, period }: { b: Analytics["behaviour"]; period: string }) {
  const t = useT();
  return (
    <Card>
      <CardHeader title={t("portfolio.an.insights.title")} subtitle={t("portfolio.an.insights.subtitle", { period })} action={<Chip tone="ember">{t("portfolio.an.insights.count", { count: b.insights.length })}</Chip>} />
      {b.insights.length === 0 ? (
        <div className="px-6 pb-6 pt-4 text-[13px] text-fg-3">{t("portfolio.an.insights.empty")}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 px-4 pb-6 pt-4 sm:px-6 md:grid-cols-2 xl:grid-cols-3">
          {b.insights.map((ins) => (
            <div key={ins.id} className="k-row relative overflow-hidden p-5">
              <div className={cn("absolute inset-x-0 top-0 h-px", TONE_LINE[ins.tone])} />
              <div className="flex items-start gap-4">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 [&_svg]:size-[18px]", TONE_CLASS[ins.tone])}>{INSIGHT_ICON[ins.id] ?? <Activity />}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[14.5px] font-medium leading-snug">{ins.title}</div>
                    <span className={cn("k-num shrink-0 text-[17px] font-semibold", TONE_CLASS[ins.tone])}>{ins.stat}</span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-2">{ins.text}</p>
                </div>
              </div>
              <div className="mt-4 border-t border-line pt-3 text-[12px] text-fg-3">{ins.tip}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Everything below the header: used by the Analytics page and the account Analytics tab. */
export function AnalyticsBody({ d, label, periodLabel }: { d: Analytics; label: string; periodLabel: string }) {
  const s = d.stats;
  const t = useT();
  const byDay = DAYS.map((name, i) => {
    const g = d.byWeekday.find((x) => x.key === String(i));
    return { label: t(name), value: g?.net ?? 0, sub: g ? t("portfolio.an.weekday.sub", { count: g.trades }) : undefined };
  });
  const heat = DAYS.map((day, i) => ({ day: t(day), cells: (d.hourHeatmap[i] ?? []).map((pnl, h) => ({ pnl, trades: d.hourTrades?.[i]?.[h] ?? 0 })) }));
  let best = { d: 0, h: 0, v: -Infinity };
  d.hourHeatmap.forEach((r, i) => r.forEach((v, h) => (d.hourTrades?.[i]?.[h] ?? 0) > 0 && v > best.v && (best = { d: i, h, v })));
  const sessions = [...d.bySession].sort((a, b) => b.net - a.net);
  const mf = d.moneyFlow;
  const ch = d.charges;
  const chargeRows = [
    { label: t("portfolio.an.charges.commission"), value: ch.commission, note: t("portfolio.an.charges.commissionNote"), color: "var(--k-ember)" },
    { label: t("portfolio.an.charges.swapPaid"), value: ch.swapPaid, note: `${t("portfolio.an.charges.swapNote")}${ch.swapEarned ? ` · ${t("portfolio.an.charges.swapEarned", { amount: formatMoney(ch.swapEarned) })}` : ""}`, color: "var(--k-gold)" },
    { label: t("portfolio.an.charges.perfFees"), value: ch.performanceFees, note: t("portfolio.an.charges.perfNote"), color: "var(--k-info)" },
    { label: t("portfolio.an.charges.walletFees"), value: ch.walletFees, note: t("portfolio.an.charges.walletNote"), color: "var(--k-fg-3)" },
  ].filter((c) => c.value > 0);
  const chargesTotal = chargeRows.reduce((a, c) => a + c.value, 0);
  const longs = d.long;
  const shorts = d.short;

  if (s.trades === 0 && d.curve.points.length < 2) {
    return (
      <Card>
        <EmptyState illustration="bar_chart" title={t("portfolio.an.empty.title")} text={t("portfolio.an.empty.text")} />
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label={t("portfolio.an.kpi.winRate")} icon={<Target />} value={<span className="k-num">{s.winRate.toFixed(1)}<span className="opacity-40">%</span></span>} chip={t("portfolio.an.kpi.winsLosses", { wins: s.wins, losses: s.losses })} chipTone={s.winRate >= 50 ? "up" : "neutral"} />
        <KpiCard
          label={t("portfolio.an.kpi.profitFactor")}
          icon={<Scale />}
          value={<span className="k-num">{s.profitFactor === null ? (s.wins ? "∞" : "—") : s.profitFactor.toFixed(2)}</span>}
          chip={s.profitFactor === null ? (s.wins ? t("portfolio.an.kpi.noLosing") : t("portfolio.an.kpi.noTrades")) : s.profitFactor >= 1.5 ? t("portfolio.an.kpi.strongEdge") : s.profitFactor >= 1 ? t("portfolio.an.kpi.thinEdge") : t("portfolio.an.kpi.losingEdge")}
          chipTone={s.profitFactor === null || s.profitFactor >= 1.5 ? "up" : s.profitFactor >= 1 ? "warn" : "down"}
          delay={0.04}
        />
        <KpiCard label={t("portfolio.an.kpi.avgRR")} icon={<Percent />} value={<span className="k-num">1 : {s.rewardRisk?.toFixed(2) ?? "—"}</span>} chip={t("portfolio.an.kpi.expPerTrade", { amount: formatMoney(s.expectancy) })} chipTone={s.expectancy >= 0 ? "up" : "down"} delay={0.08} />
        <KpiCard label={t("portfolio.an.kpi.maxDrawdown")} icon={<TrendingDown />} value={<span className="k-num text-down">{d.curve.maxDrawdown.toFixed(2)}%</span>} chip={t("portfolio.an.kpi.nowDrawdown", { value: d.curve.currentDrawdown.toFixed(2) })} chipTone="neutral" delay={0.12} />
        <KpiCard label={t("portfolio.an.kpi.avgHold")} icon={<Clock3 />} value={<span className="k-num">{fmtHold(s.avgHoldSecs)}</span>} chip={s.avgHoldSecs < 86400 ? t("portfolio.an.kpi.intraday") : t("portfolio.an.kpi.multiDay")} chipTone="neutral" delay={0.16} />
        <KpiCard label={t("portfolio.an.kpi.trades")} icon={<Activity />} value={<span className="k-num">{s.trades}</span>} chip={t("portfolio.an.kpi.lots", { value: s.lots.toFixed(2) })} chipTone="ember" delay={0.2} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-8">
          <Curves d={d} label={label} />
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-4">
          <StatsCard s={s} curve={d.curve} />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-5">
          <Card className="h-full">
            <CardHeader title={t("portfolio.an.symbol.title")} subtitle={t("portfolio.an.symbol.subtitle")} />
            <div className="px-4 pb-6 pt-4 sm:px-6">
              {d.bySymbol.length ? (
                <PnlBars
                  rows={d.bySymbol.slice(0, 9).map((g) => ({
                    key: g.key,
                    value: g.net,
                    sub: t("portfolio.an.symbol.sub", { count: g.trades, rate: Math.round(g.winRate) }),
                    label: (
                      <span className="flex items-center gap-2">
                        <SymbolAvatar symbol={g.key} size={20} />
                        <span className="truncate text-[13px] font-medium">{g.key}</span>
                      </span>
                    ),
                  }))}
                />
              ) : (
                <div className="py-6 text-center text-[13px] text-fg-3">{t("portfolio.an.symbol.empty")}</div>
              )}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-4">
          <Card className="h-full">
            <CardHeader title={t("portfolio.an.weekday.title")} subtitle={t("portfolio.an.weekday.subtitle")} />
            <div className="px-4 pb-6 pt-4 sm:px-6">
              <ColumnBars data={byDay} height={250} />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="lg:col-span-2 xl:col-span-3">
          <Card className="h-full">
            <CardHeader title={t("portfolio.an.side.title")} />
            <div className="px-6 pb-6 pt-4">
              <div className="flex h-3 overflow-hidden rounded-full bg-surface-3">
                <span className="bg-up" style={{ width: `${(longs.trades / Math.max(1, s.trades)) * 100}%` }} />
                <span className="border-s-2 border-bg bg-down" style={{ width: `${(shorts.trades / Math.max(1, s.trades)) * 100}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[11.5px] text-fg-3">
                <span className="k-num">{t("portfolio.an.side.longPct", { value: Math.round((longs.trades / Math.max(1, s.trades)) * 100) })}</span>
                <span className="k-num">{t("portfolio.an.side.shortPct", { value: Math.round((shorts.trades / Math.max(1, s.trades)) * 100) })}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-1">
                {[
                  { k: t("portfolio.an.side.long"), st: longs, tone: "up" as const },
                  { k: t("portfolio.an.side.short"), st: shorts, tone: "down" as const },
                ].map(({ k, st, tone }) => (
                  <div key={k} className="k-row px-4 py-3">
                    <div className="flex items-center justify-between">
                      <Chip size="sm" tone={tone}>
                        {k.toUpperCase()}
                      </Chip>
                      <span className="k-num text-[11.5px] text-fg-3">{t("portfolio.trades", { count: st.trades })}</span>
                    </div>
                    <Money value={st.net} countUp={false} signed tone="auto" className="mt-2 block text-[17px] font-semibold" />
                    <div className="k-num mt-0.5 text-[11.5px] text-fg-3">
                      {t("portfolio.an.side.winPf", { rate: st.winRate.toFixed(0), pf: st.profitFactor?.toFixed(2) ?? (st.wins ? "∞" : "—") })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader
              title={t("portfolio.an.hour.title")}
              subtitle={t("portfolio.an.hour.subtitle")}
              action={best.v > 0 ? <Chip tone="up">{t("portfolio.an.hour.best", { day: t(DAYS[best.d]!), hour: String(best.h).padStart(2, "0") })}</Chip> : undefined}
            />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <HourHeatmap rows={heat} />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-4">
          <Card className="h-full">
            <CardHeader title={t("portfolio.an.session.title")} subtitle={t("portfolio.an.session.subtitle")} />
            <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
              {sessions.map((x, i) => (
                <div key={x.session} className={cn("k-row flex items-center gap-3 px-4 py-3", i === 0 && x.net > 0 && "border-up/30 bg-up-soft/40")}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13.5px] font-medium">
                      {x.session}
                      {i === 0 && x.net > 0 && <Trophy className="size-3.5 text-gold" />}
                    </div>
                    <div className="k-num font-mono text-[11px] text-fg-3">
                      {x.hours} · {t("portfolio.trades", { count: x.trades })}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className={cn("k-num text-[14px] font-semibold", x.net > 0 ? "text-up" : x.net < 0 ? "text-down" : "text-fg-3")}>
                      {x.net >= 0 ? "+" : "-"}
                      {formatMoney(Math.abs(x.net))}
                    </div>
                    <div className="k-num text-[11px] text-fg-3">{x.trades ? t("portfolio.an.session.win", { rate: Math.round(x.winRate) }) : "—"}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-7">
          <Card className="h-full">
            <CardHeader title={t("portfolio.an.flow.title")} subtitle={t("portfolio.an.flow.subtitle", { period: periodLabel })} action={<Chip tone="gold">{t("portfolio.an.flow.equityNow", { amount: formatMoney(mf.equityNow) })}</Chip>} />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <Waterfall
                height={270}
                steps={[
                  { label: t("portfolio.an.flow.deposits"), value: mf.deposits },
                  { label: t("portfolio.an.flow.tradingPnl"), value: mf.tradingPnl },
                  ...(mf.bonus ? [{ label: t("portfolio.an.flow.bonus"), value: mf.bonus }] : []),
                  ...(mf.earnings ? [{ label: t("portfolio.an.flow.earnings"), value: mf.earnings }] : []),
                  { label: t("portfolio.an.flow.charges"), value: mf.commission + mf.performanceFees },
                  ...(mf.adjustments ? [{ label: t("portfolio.an.flow.adjustments"), value: mf.adjustments }] : []),
                  { label: t("portfolio.an.flow.withdrawals"), value: mf.withdrawals },
                  { label: t("portfolio.an.flow.net"), value: 0, total: true },
                ]}
              />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-5">
          <Card className="h-full">
            <CardHeader title={t("portfolio.an.charges.title")} subtitle={t("portfolio.an.charges.subtitle")} />
            {chargeRows.length ? (
              <div className="flex flex-col items-center gap-5 px-6 pb-4 pt-4 sm:flex-row">
                <Donut
                  size={150}
                  thickness={16}
                  data={chargeRows.map((c) => ({ label: c.label, value: c.value, color: c.color }))}
                  center={
                    <div>
                      <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{t("common.total")}</div>
                      <div className="k-num text-[16px] font-semibold">{formatMoney(chargesTotal)}</div>
                    </div>
                  }
                />
                <div className="w-full flex-1 space-y-2">
                  {chargeRows.map((c) => (
                    <div key={c.label} className="flex items-start gap-2.5">
                      <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between text-[13px]">
                          <span className="font-medium">{c.label}</span>
                          <span className="k-num tabular-nums">{formatMoney(c.value)}</span>
                        </div>
                        <div className="truncate text-[11.5px] text-fg-3">{c.note}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-6 pb-4 pt-4 text-[13px] text-fg-3">{t("portfolio.an.charges.empty")}</div>
            )}
            <div className="mx-6 mb-6 flex items-center justify-between rounded-[14px] border border-dashed border-line px-4 py-3 text-[12.5px]">
              <span className="text-fg-3">
                {t("portfolio.an.charges.spread")} <span className="text-fg-2">{t("portfolio.an.charges.spreadNote")}</span>
              </span>
              <span className="k-num font-medium text-fg-2">{formatMoney(ch.spreadEstimate)}</span>
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.05} className="mt-4">
        <Insights b={d.behaviour} period={periodLabel} />
      </Reveal>
    </>
  );
}

function Loading() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[112px] rounded-[20px]" />
        ))}
      </div>
      <Skeleton className="h-[440px] w-full rounded-[20px]" />
    </div>
  );
}

function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useT();
  return (
    <Card>
      <EmptyState
        illustration="bar_chart"
        title={t("portfolio.an.failed")}
        text={message}
        action={
          <Button variant="surface" onClick={onRetry}>
            <RefreshCw /> {t("common.retry")}
          </Button>
        }
      />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

function usePeriodLabel(period: Period) {
  const t = useT();
  if (period === "ALL") return t("portfolio.an.period.allTime");
  if (period === "1Y") return t("portfolio.an.period.last12Months");
  return t("portfolio.an.period.lastDays", { count: PERIOD_DAYS[period] });
}

export function statementUrl(login: number, from: string, to: string, format: "pdf" | "csv" | "xlsx") {
  return `/api/reports/accounts/${login}/statement?from=${from}&to=${to}&format=${format}`;
}

export function LiveAnalyticsPage() {
  const [account, setAccount] = React.useState<number | "all">("all");
  const [period, setPeriod] = React.useState<Period>("90D");
  const { data, error, loading, reload } = useAnalytics(account, period);
  const accounts = data?.accounts ?? [];
  const t = useT();
  const label = account === "all" ? t("portfolio.an.allLive") : `#${account}`;
  const range = periodRange(period);
  const periodLabel = usePeriodLabel(period);
  return (
    <div className="pb-24">
      <PageHeader
        title={t("portfolio.an.title")}
        subtitle={t("portfolio.an.subtitle")}
        actions={
          <>
            <Menu
              align="end"
              trigger={
                <Button variant="surface">
                  <span className="font-mono text-[13px]">{label}</span>
                </Button>
              }
              items={[
                { label: t("portfolio.an.allLive"), onSelect: () => setAccount("all") },
                "sep",
                ...accounts.map((a) => ({ label: <span className="font-mono">#{a.login}</span>, hint: `${a.type === "demo" ? `${t("common.demo")} · ` : ""}${a.groupName}`, onSelect: () => setAccount(a.login) })),
              ]}
            />
            <Segmented value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: t(`portfolio.an.period.${p}`) }))} />
            {account === "all" ? (
              <Link href="/portfolio/statements">
                <Button variant="ember">
                  <FileText /> {t("portfolio.st.title")}
                </Button>
              </Link>
            ) : (
              <Menu
                align="end"
                trigger={
                  <Button variant="ember">
                    <Download /> {t("common.export")}
                  </Button>
                }
                items={(["pdf", "xlsx", "csv"] as const).map((f) => ({ label: t("portfolio.an.statementFormat", { format: f.toUpperCase() }), href: statementUrl(account, range.from, range.to, f) }))}
              />
            )}
          </>
        }
      />
      {loading && !data ? <Loading /> : error && !data ? <Failed message={error} onRetry={reload} /> : data ? (
        data.accounts.length === 0 ? (
          <Card>
            <EmptyState
              illustration="bar_chart"
              title={t("portfolio.noAccounts.title")}
              text={t("portfolio.an.noAccountsText")}
              action={
                <Link href="/accounts/new">
                  <Button variant="ember">{t("portfolio.openAccount")}</Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <div className={cn("transition-opacity", loading && "opacity-60")}>
            <AnalyticsBody d={data} label={label} periodLabel={periodLabel} />
          </div>
        )
      ) : null}
    </div>
  );
}

/** Account page → Analytics tab. */
export function AccountAnalyticsPanel({ login }: { login: number }) {
  const [period, setPeriod] = React.useState<Period>("90D");
  const { data, error, loading, reload } = useAnalytics(login, period);
  const range = periodRange(period);
  const periodLabel = usePeriodLabel(period);
  const t = useT();
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: t(`portfolio.an.period.${p}`) }))} />
        <div className="flex items-center gap-2">
          <a href={statementUrl(login, range.from, range.to, "pdf")}>
            <Button size="sm" variant="surface">
              <Download /> {t("portfolio.an.pdfStatement")}
            </Button>
          </a>
          <Link href="/portfolio/analytics">
            <Button size="sm" variant="ghost">
              <GaugeIcon /> {t("portfolio.an.allAccounts")}
            </Button>
          </Link>
        </div>
      </div>
      {loading && !data ? <Loading /> : error && !data ? <Failed message={error} onRetry={reload} /> : data ? (
        <div className={cn("transition-opacity", loading && "opacity-60")}>
          <AnalyticsBody d={data} label={`#${login}`} periodLabel={periodLabel} />
        </div>
      ) : null}
    </div>
  );
}


