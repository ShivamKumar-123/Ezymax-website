"use client";

// Live Portfolio → Analytics (D91) and the account page's Analytics tab, on the reports service
// (/api/reports/analytics). All amounts are USD (cent accounts converted); times are server time.

import * as React from "react";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Clock3, Download, FileText, Gauge as GaugeIcon, Percent, RefreshCw, Scale, ShieldCheck, Target, TrendingDown, Trophy, Zap } from "lucide-react";
import { Button, Card, CardHeader, Chip, Donut, EmptyState, KpiCard, Menu, Money, PageHeader, Reveal, Segmented, Skeleton, SymbolAvatar, cn, formatMoney } from "@kalks/ui";
import { ColumnBars, DrawdownChart, HourHeatmap, MultiLineChart, PnlBars, Waterfall } from "@/components/portfolio/charts";

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
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
  if (m >= 1440) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return m ? `${m}m` : `${Math.round(secs)}s`;
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
        if (!r.ok) throw new Error(j?.error?.message ?? "Analytics are unavailable right now.");
        setData(j as Analytics);
        setError(null);
      })
      .catch((e) => {
        if (!ctl.signal.aborted) setError(e instanceof Error ? e.message : "Analytics are unavailable right now.");
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
  return (
    <Card className="h-full">
      <CardHeader
        title="Equity vs balance"
        subtitle={`${label} · end of each server day, USD`}
        action={
          <div className="hidden items-center gap-3 text-[12px] text-fg-2 sm:flex">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full bg-gold" /> Equity
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0 w-4 border-t border-dashed border-fg-2" /> Balance
            </span>
          </div>
        }
      />
      {pts.length < 2 ? (
        <div className="px-6 pb-8 pt-6 text-[13px] text-fg-3">The curve builds up from daily snapshots; it appears after the account's second day.</div>
      ) : (
        <>
          <div className="px-4 pt-4 sm:px-6">
            <MultiLineChart
              times={times}
              height={260}
              series={[
                { key: "eq", label: "Equity", color: "var(--k-gold)", values: pts.map((p) => p.equity), fill: true },
                { key: "bal", label: "Balance", color: "var(--k-fg-2)", values: pts.map((p) => p.balance), dashed: true },
              ]}
            />
          </div>
          <div className="mt-2 flex items-center justify-between px-6 pt-3">
            <div className="k-label">Drawdown from peak · deposits and withdrawals removed</div>
            <Chip size="sm" tone="down">
              Max {d.curve.maxDrawdown.toFixed(2)}%
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
  const rows: [string, React.ReactNode][] = [
    ["Net profit", <Money key="n" value={s.net} countUp={false} signed tone="auto" />],
    ["Average win", <span key="aw" className="text-up">+{formatMoney(s.avgWin)}</span>],
    ["Average loss", <span key="al" className="text-down">-{formatMoney(s.avgLoss)}</span>],
    ["Expectancy / trade", formatMoney(s.expectancy)],
    ["Commission + swap", <span key="c" className={s.swap - s.commission < 0 ? "text-down" : ""}>{formatMoney(s.swap - s.commission)}</span>],
    ["Holding time: winners / losers", `${fmtHold(s.avgHoldWinSecs)} / ${fmtHold(s.avgHoldLossSecs)}`],
    ["Streaks: wins / losses", `${s.maxConsecWins} / ${s.maxConsecLosses}`],
    ["Sharpe · Sortino", `${curve.sharpe?.toFixed(2) ?? "—"} · ${curve.sortino?.toFixed(2) ?? "—"}`],
    ["Return (time-weighted)", <span key="r" className={curve.returnPct >= 0 ? "text-up" : "text-down"}>{curve.returnPct >= 0 ? "+" : ""}{curve.returnPct.toFixed(2)}%</span>],
  ];
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Trade statistics" subtitle={`${s.trades} closed trade${s.trades === 1 ? "" : "s"}`} />
      <div className="grid grid-cols-2 gap-3 px-6 pt-4">
        <div className="k-row px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-fg-3">Gross profit</div>
          <Money value={s.grossProfit} countUp={false} className="mt-1 block text-[16px] font-semibold text-up" />
        </div>
        <div className="k-row px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-fg-3">Gross loss</div>
          <Money value={-s.grossLoss} countUp={false} className="mt-1 block text-[16px] font-semibold text-down" />
        </div>
      </div>
      <div className="mt-2 flex-1 divide-y divide-line px-6">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
            <span className="text-fg-3">{k}</span>
            <span className="k-num text-right font-medium">{v}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 px-6 pb-6 pt-3">
        {[
          { t: s.best, label: "Best trade", icon: <ArrowUpRight className="size-3.5 text-up" /> },
          { t: s.worst, label: "Worst trade", icon: <ArrowDownRight className="size-3.5 text-down" /> },
        ].map(({ t, label, icon }) => (
          <div key={label} className="k-row px-3.5 py-3">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-fg-3">
              {icon}
              {label}
            </div>
            {t ? (
              <>
                <div className="mt-2 flex items-center gap-2">
                  <SymbolAvatar symbol={t.symbol} size={20} />
                  <span className="text-[13px] font-medium">{t.symbol}</span>
                </div>
                <div className={cn("k-num mt-1 text-[15px] font-semibold", t.net >= 0 ? "text-up" : "text-down")}>
                  {t.net >= 0 ? "+" : "-"}
                  {formatMoney(Math.abs(t.net))}
                </div>
                <div className="font-mono text-[10.5px] text-fg-3">
                  #{t.ticket} · {t.login}
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
  return (
    <Card>
      <CardHeader title="Behaviour insights" subtitle={`Patterns in your closed trades · ${period}`} action={<Chip tone="ember">{b.insights.length} insight{b.insights.length === 1 ? "" : "s"}</Chip>} />
      {b.insights.length === 0 ? (
        <div className="px-6 pb-6 pt-4 text-[13px] text-fg-3">Close a few more trades to see patterns such as overtrading, revenge trades and risk per trade.</div>
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
  const byDay = DAYS.map((name, i) => {
    const g = d.byWeekday.find((x) => x.key === String(i));
    return { label: name, value: g?.net ?? 0, sub: g ? `${g.trades} tr` : undefined };
  });
  const heat = DAYS.map((day, i) => ({ day, cells: (d.hourHeatmap[i] ?? []).map((pnl, h) => ({ pnl, trades: d.hourTrades?.[i]?.[h] ?? 0 })) }));
  let best = { d: 0, h: 0, v: -Infinity };
  d.hourHeatmap.forEach((r, i) => r.forEach((v, h) => (d.hourTrades?.[i]?.[h] ?? 0) > 0 && v > best.v && (best = { d: i, h, v })));
  const sessions = [...d.bySession].sort((a, b) => b.net - a.net);
  const mf = d.moneyFlow;
  const ch = d.charges;
  const chargeRows = [
    { label: "Commission", value: ch.commission, note: "Round turn per lot", color: "var(--k-ember)" },
    { label: "Swap paid", value: ch.swapPaid, note: `Overnight financing${ch.swapEarned ? ` · ${formatMoney(ch.swapEarned)} earned` : ""}`, color: "var(--k-gold)" },
    { label: "Performance fees", value: ch.performanceFees, note: "Copy trading and PAMM", color: "var(--k-info)" },
    { label: "Wallet fees", value: ch.walletFees, note: "Withdrawal network and service fees", color: "var(--k-fg-3)" },
  ].filter((c) => c.value > 0);
  const chargesTotal = chargeRows.reduce((a, c) => a + c.value, 0);
  const longs = d.long;
  const shorts = d.short;

  if (s.trades === 0 && d.curve.points.length < 2) {
    return (
      <Card>
        <EmptyState illustration="bar_chart" title="No trading activity in this period" text="Analytics appear once the account has closed trades or a few days of history. Try a longer period." />
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Win rate" icon={<Target />} value={<span className="k-num">{s.winRate.toFixed(1)}<span className="opacity-40">%</span></span>} chip={`${s.wins}W · ${s.losses}L`} chipTone={s.winRate >= 50 ? "up" : "neutral"} />
        <KpiCard
          label="Profit factor"
          icon={<Scale />}
          value={<span className="k-num">{s.profitFactor === null ? (s.wins ? "∞" : "—") : s.profitFactor.toFixed(2)}</span>}
          chip={s.profitFactor === null ? (s.wins ? "No losing trades" : "No trades") : s.profitFactor >= 1.5 ? "Strong edge" : s.profitFactor >= 1 ? "Thin edge" : "Losing edge"}
          chipTone={s.profitFactor === null || s.profitFactor >= 1.5 ? "up" : s.profitFactor >= 1 ? "warn" : "down"}
          delay={0.04}
        />
        <KpiCard label="Avg R:R" icon={<Percent />} value={<span className="k-num">1 : {s.rewardRisk?.toFixed(2) ?? "—"}</span>} chip={`Exp. ${formatMoney(s.expectancy)}/trade`} chipTone={s.expectancy >= 0 ? "up" : "down"} delay={0.08} />
        <KpiCard label="Max drawdown" icon={<TrendingDown />} value={<span className="k-num text-down">{d.curve.maxDrawdown.toFixed(2)}%</span>} chip={`Now ${d.curve.currentDrawdown.toFixed(2)}%`} chipTone="neutral" delay={0.12} />
        <KpiCard label="Avg hold time" icon={<Clock3 />} value={<span className="k-num">{fmtHold(s.avgHoldSecs)}</span>} chip={s.avgHoldSecs < 86400 ? "Intraday" : "Multi-day"} chipTone="neutral" delay={0.16} />
        <KpiCard label="Trades" icon={<Activity />} value={<span className="k-num">{s.trades}</span>} chip={`${s.lots.toFixed(2)} lots`} chipTone="ember" delay={0.2} />
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
            <CardHeader title="Performance by symbol" subtitle="Net P&L after charges" />
            <div className="px-4 pb-6 pt-4 sm:px-6">
              {d.bySymbol.length ? (
                <PnlBars
                  rows={d.bySymbol.slice(0, 9).map((g) => ({
                    key: g.key,
                    value: g.net,
                    sub: `${g.trades} tr · ${Math.round(g.winRate)}%`,
                    label: (
                      <span className="flex items-center gap-2">
                        <SymbolAvatar symbol={g.key} size={20} />
                        <span className="truncate text-[13px] font-medium">{g.key}</span>
                      </span>
                    ),
                  }))}
                />
              ) : (
                <div className="py-6 text-center text-[13px] text-fg-3">No closed trades.</div>
              )}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-4">
          <Card className="h-full">
            <CardHeader title="By weekday" subtitle="Close time, server time" />
            <div className="px-4 pb-6 pt-4 sm:px-6">
              <ColumnBars data={byDay} height={250} />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="lg:col-span-2 xl:col-span-3">
          <Card className="h-full">
            <CardHeader title="Long vs short" />
            <div className="px-6 pb-6 pt-4">
              <div className="flex h-3 overflow-hidden rounded-full bg-surface-3">
                <span className="bg-up" style={{ width: `${(longs.trades / Math.max(1, s.trades)) * 100}%` }} />
                <span className="border-l-2 border-bg bg-down" style={{ width: `${(shorts.trades / Math.max(1, s.trades)) * 100}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-[11.5px] text-fg-3">
                <span className="k-num">{Math.round((longs.trades / Math.max(1, s.trades)) * 100)}% long</span>
                <span className="k-num">{Math.round((shorts.trades / Math.max(1, s.trades)) * 100)}% short</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-1">
                {[
                  { k: "Long", st: longs, tone: "up" as const },
                  { k: "Short", st: shorts, tone: "down" as const },
                ].map(({ k, st, tone }) => (
                  <div key={k} className="k-row px-4 py-3">
                    <div className="flex items-center justify-between">
                      <Chip size="sm" tone={tone}>
                        {k.toUpperCase()}
                      </Chip>
                      <span className="k-num text-[11.5px] text-fg-3">{st.trades} trades</span>
                    </div>
                    <Money value={st.net} countUp={false} signed tone="auto" className="mt-2 block text-[17px] font-semibold" />
                    <div className="k-num mt-0.5 text-[11.5px] text-fg-3">
                      Win {st.winRate.toFixed(0)}% · PF {st.profitFactor?.toFixed(2) ?? (st.wins ? "∞" : "—")}
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
              title="By hour of day"
              subtitle="P&L heatmap · weekday × hour of the close (server time)"
              action={best.v > 0 ? <Chip tone="up">Best: {DAYS[best.d]} {String(best.h).padStart(2, "0")}:00</Chip> : undefined}
            />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <HourHeatmap rows={heat} />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-4">
          <Card className="h-full">
            <CardHeader title="By session" subtitle="Session of the open time" />
            <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
              {sessions.map((x, i) => (
                <div key={x.session} className={cn("k-row flex items-center gap-3 px-4 py-3", i === 0 && x.net > 0 && "border-up/30 bg-up-soft/40")}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13.5px] font-medium">
                      {x.session}
                      {i === 0 && x.net > 0 && <Trophy className="size-3.5 text-gold" />}
                    </div>
                    <div className="k-num font-mono text-[11px] text-fg-3">
                      {x.hours} · {x.trades} trades
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn("k-num text-[14px] font-semibold", x.net > 0 ? "text-up" : x.net < 0 ? "text-down" : "text-fg-3")}>
                      {x.net >= 0 ? "+" : "-"}
                      {formatMoney(Math.abs(x.net))}
                    </div>
                    <div className="k-num text-[11px] text-fg-3">{x.trades ? `${Math.round(x.winRate)}% win` : "—"}</div>
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
            <CardHeader title="Money flow" subtitle={`${periodLabel} · deposits → P&L → charges → withdrawals`} action={<Chip tone="gold">Equity now {formatMoney(mf.equityNow)}</Chip>} />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <Waterfall
                height={270}
                steps={[
                  { label: "Deposits", value: mf.deposits },
                  { label: "Trading P&L", value: mf.tradingPnl },
                  ...(mf.bonus ? [{ label: "Credit & bonus", value: mf.bonus }] : []),
                  ...(mf.earnings ? [{ label: "IB earnings", value: mf.earnings }] : []),
                  { label: "Charges", value: mf.commission + mf.performanceFees },
                  ...(mf.adjustments ? [{ label: "Adjustments", value: mf.adjustments }] : []),
                  { label: "Withdrawals", value: mf.withdrawals },
                  { label: "Net", value: 0, total: true },
                ]}
              />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-5">
          <Card className="h-full">
            <CardHeader title="Charges" subtitle="Commission, swap and fees paid" />
            {chargeRows.length ? (
              <div className="flex flex-col items-center gap-5 px-6 pb-4 pt-4 sm:flex-row">
                <Donut
                  size={150}
                  thickness={16}
                  data={chargeRows.map((c) => ({ label: c.label, value: c.value, color: c.color }))}
                  center={
                    <div>
                      <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Total</div>
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
                          <span className="k-num">{formatMoney(c.value)}</span>
                        </div>
                        <div className="truncate text-[11.5px] text-fg-3">{c.note}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-6 pb-4 pt-4 text-[13px] text-fg-3">No charges in this period.</div>
            )}
            <div className="mx-6 mb-6 flex items-center justify-between rounded-[14px] border border-dashed border-line px-4 py-3 text-[12.5px]">
              <span className="text-fg-3">
                Spread cost <span className="text-fg-2">(estimate, already in prices)</span>
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
  return (
    <Card>
      <EmptyState
        illustration="bar_chart"
        title="Analytics couldn't be loaded"
        text={message}
        action={
          <Button variant="surface" onClick={onRetry}>
            <RefreshCw /> Try again
          </Button>
        }
      />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

export function statementUrl(login: number, from: string, to: string, format: "pdf" | "csv" | "xlsx") {
  return `/api/reports/accounts/${login}/statement?from=${from}&to=${to}&format=${format}`;
}

export function LiveAnalyticsPage() {
  const [account, setAccount] = React.useState<number | "all">("all");
  const [period, setPeriod] = React.useState<Period>("90D");
  const { data, error, loading, reload } = useAnalytics(account, period);
  const accounts = data?.accounts ?? [];
  const label = account === "all" ? "All live accounts" : `#${account}`;
  const range = periodRange(period);
  const periodLabel = period === "ALL" ? "All time" : `Last ${period.replace("D", " days").replace("1Y", "12 months")}`;
  return (
    <div className="pb-24">
      <PageHeader
        title="Analytics"
        subtitle="How you trade: performance, risk, money flow and behaviour. USD, server time."
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
                { label: "All live accounts", onSelect: () => setAccount("all") },
                "sep",
                ...accounts.map((a) => ({ label: <span className="font-mono">#{a.login}</span>, hint: `${a.type === "demo" ? "Demo · " : ""}${a.groupName}`, onSelect: () => setAccount(a.login) })),
              ]}
            />
            <Segmented value={period} onChange={setPeriod} options={PERIODS} />
            {account === "all" ? (
              <Link href="/portfolio/statements">
                <Button variant="ember">
                  <FileText /> Statements
                </Button>
              </Link>
            ) : (
              <Menu
                align="end"
                trigger={
                  <Button variant="ember">
                    <Download /> Export
                  </Button>
                }
                items={(["pdf", "xlsx", "csv"] as const).map((f) => ({ label: `Statement (${f.toUpperCase()})`, href: statementUrl(account, range.from, range.to, f) }))}
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
              title="No trading accounts yet"
              text="Open an account and trade; your analytics appear here."
              action={
                <Link href="/accounts/new">
                  <Button variant="ember">Open account</Button>
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
  const periodLabel = period === "ALL" ? "All time" : `Last ${period.replace("D", " days").replace("1Y", "12 months")}`;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented value={period} onChange={setPeriod} options={PERIODS} />
        <div className="flex items-center gap-2">
          <a href={statementUrl(login, range.from, range.to, "pdf")}>
            <Button size="sm" variant="surface">
              <Download /> PDF statement
            </Button>
          </a>
          <Link href="/portfolio/analytics">
            <Button size="sm" variant="ghost">
              <GaugeIcon /> All accounts
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


