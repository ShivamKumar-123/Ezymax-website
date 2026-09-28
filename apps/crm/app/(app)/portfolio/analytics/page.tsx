"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Activity, ArrowDownRight, ArrowUpRight, Clock3, Download, Percent, Scale, Sparkles, Target, TrendingDown, Trophy } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  Donut,
  Icon3D,
  KpiCard,
  Menu,
  Money,
  PageHeader,
  Reveal,
  Segmented,
  Starfield,
  SymbolAvatar,
  cn,
  formatMoney,
} from "@kalks/ui";
import { HISTORY, equitySeries, seeded } from "@kalks/mock";
import {
  CHARGES_BREAKDOWN,
  HOUR_HEATMAP,
  INSIGHTS,
  LIVE_ACCOUNTS,
  MONEY_FLOW,
  PORTFOLIO_NOW,
  SESSIONS_PERF,
  SPREAD_COST_INFO,
  groupPnl,
  serverParts,
  tradeStats,
} from "@kalks/mock/portfolio-extra";
import { ColumnBars, DrawdownChart, HourHeatmap, MultiLineChart, PnlBars, Waterfall } from "@/components/portfolio/charts";

const PERIODS = ["7D", "30D", "90D", "ALL"] as const;
const PERIOD_DAYS: Record<(typeof PERIODS)[number], number> = { "7D": 7, "30D": 30, "90D": 90, ALL: 100000 };

function fmtHold(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** Equity (daily) + balance (steps on realised days) + drawdown, for one account or all live accounts. */
function useCurves(account: string, days: number) {
  return React.useMemo(() => {
    const endEq = account === "all" ? LIVE_ACCOUNTS.reduce((s, a) => s + (a.cent ? a.equity / 100 : a.equity), 0) : (() => {
      const a = LIVE_ACCOUNTS.find((x) => x.login === account)!;
      return a.cent ? a.equity / 100 : a.equity;
    })();
    const seed = account === "all" ? 11 : Number(account.slice(-3));
    const n = Math.min(days, 365);
    const eq = equitySeries(Math.max(n, 7), endEq, seed);
    const r = seeded(seed + 7);
    let bal = eq[0]!.value;
    const balance = eq.map((p, i) => {
      if (i === 0 || r.bool(0.35)) bal = p.value * (1 + (r.next() - 0.5) * 0.006);
      return +bal.toFixed(2);
    });
    let peak = -Infinity;
    const dd = eq.map((p) => {
      peak = Math.max(peak, p.value);
      return +(((p.value - peak) / peak) * 100).toFixed(2);
    });
    return { times: eq.map((p) => p.time), equity: eq.map((p) => p.value), balance, dd, maxDd: Math.min(...dd) };
  }, [account, days]);
}

/* ------------------------------------------------------------------ */

export default function AnalyticsPage() {
  const [account, setAccount] = React.useState("all");
  const [period, setPeriod] = React.useState<(typeof PERIODS)[number]>("90D");
  const days = PERIOD_DAYS[period];
  const trades = React.useMemo(
    () => HISTORY.filter((t) => (account === "all" || t.login === account) && Date.parse(t.closeTime) >= PORTFOLIO_NOW - days * 86400_000),
    [account, days],
  );
  const s = React.useMemo(() => tradeStats(trades), [trades]);
  const curves = useCurves(account, period === "ALL" ? 365 : days);

  const bySymbol = React.useMemo(() => groupPnl(trades, (t) => t.symbol).sort((a, b) => b.pnl - a.pnl), [trades]);
  const byDay = React.useMemo(() => {
    const g = groupPnl(trades, (t) => serverParts(t.closeTime).dow);
    return [1, 2, 3, 4, 5, 6, 0].map((d) => {
      const e = g.find((x) => x.key === d);
      return { label: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]!, value: e?.pnl ?? 0, sub: e ? `${e.trades} tr` : undefined };
    });
  }, [trades]);
  const longs = React.useMemo(() => tradeStats(trades.filter((t) => t.side === "buy")), [trades]);
  const shorts = React.useMemo(() => tradeStats(trades.filter((t) => t.side === "sell")), [trades]);

  const accountLabel = account === "all" ? "All live accounts" : `#${account}`;

  return (
    <div className="pb-24">
      <PageHeader
        title="Analytics"
        subtitle="How you trade: performance, risk, money flow and behaviour. Server time GMT+3."
        actions={
          <>
            <Menu
              align="end"
              trigger={
                <Button variant="surface">
                  <span className="font-mono text-[13px]">{accountLabel}</span>
                </Button>
              }
              items={[
                { label: "All live accounts", onSelect: () => setAccount("all") },
                "sep",
                ...LIVE_ACCOUNTS.map((a) => ({ label: <span className="font-mono">#{a.login}</span>, hint: a.group, onSelect: () => setAccount(a.login) })),
              ]}
            />
            <Segmented value={period} onChange={setPeriod} options={PERIODS} />
            <Button variant="ember" onClick={() => toast.success("Analytics report is being prepared", { description: `${accountLabel} · ${period} · PDF will be ready in a few seconds` })}>
              <Download /> Export
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Win rate" icon={<Target />} value={<span className="k-num">{s.winRate.toFixed(1)}<span className="opacity-40">%</span></span>} chip={`${s.wins}W · ${s.losses}L`} chipTone="up" />
        <KpiCard label="Profit factor" icon={<Scale />} value={<span className="k-num">{s.profitFactor.toFixed(2)}</span>} chip={s.profitFactor >= 1.5 ? "Strong edge" : "Thin edge"} chipTone={s.profitFactor >= 1.5 ? "up" : "warn"} delay={0.04} />
        <KpiCard label="Avg R:R" icon={<Percent />} value={<span className="k-num">1 : {s.rr.toFixed(2)}</span>} chip={`Exp. ${formatMoney(s.expectancy)}/trade`} chipTone={s.expectancy >= 0 ? "up" : "down"} delay={0.08} />
        <KpiCard label="Max drawdown" icon={<TrendingDown />} value={<span className="k-num text-down">{curves.maxDd.toFixed(2)}%</span>} chip="Within 20% limit" chipTone="neutral" delay={0.12} />
        <KpiCard label="Avg hold time" icon={<Clock3 />} value={<span className="k-num">{fmtHold(s.avgHoldMin)}</span>} chip="Intraday" chipTone="neutral" delay={0.16} />
        <KpiCard label="Trades" icon={<Activity />} value={<span className="k-num">{s.trades}</span>} chip={`${s.lots.toFixed(2)} lots`} chipTone="ember" delay={0.2} hot />
      </div>

      {/* Curves + stats */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader
              title="Equity vs balance"
              subtitle={`${accountLabel} · ${period === "ALL" ? "last 12 months" : period}`}
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
            <div className="px-4 pt-4 sm:px-6">
              <MultiLineChart
                times={curves.times}
                height={260}
                series={[
                  { key: "eq", label: "Equity", color: "var(--k-gold)", values: curves.equity, fill: true },
                  { key: "bal", label: "Balance", color: "var(--k-fg-2)", values: curves.balance, dashed: true },
                ]}
              />
            </div>
            <div className="mt-2 flex items-center justify-between px-6 pt-3">
              <div className="k-label">Drawdown from peak</div>
              <Chip size="sm" tone="down">
                Max {curves.maxDd.toFixed(2)}%
              </Chip>
            </div>
            <div className="px-4 pb-5 pt-2 sm:px-6">
              <DrawdownChart times={curves.times} values={curves.dd} height={140} />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-4">
          <Card className="flex h-full flex-col">
            <CardHeader title="Trade statistics" subtitle={`${s.trades} closed trades`} />
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
              {[
                ["Net profit", <Money key="n" value={s.net} countUp={false} signed tone="auto" />],
                ["Average win", <span key="aw" className="text-up">+{formatMoney(s.avgWin)}</span>],
                ["Average loss", <span key="al" className="text-down">-{formatMoney(s.avgLoss)}</span>],
                ["Expectancy / trade", formatMoney(s.expectancy)],
                ["Commission + swap", <span key="c" className="text-down">{formatMoney(-(s.commission - s.swap))}</span>],
                ["Lots traded", s.lots.toFixed(2)],
              ].map(([k, v], i) => (
                <div key={i} className="flex items-center justify-between py-2.5 text-[13px]">
                  <span className="text-fg-3">{k}</span>
                  <span className="k-num font-medium">{v}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 px-6 pb-6 pt-3">
              {[
                { t: s.best, label: "Best trade", icon: <ArrowUpRight className="size-3.5 text-up" /> },
                { t: s.worst, label: "Worst trade", icon: <ArrowDownRight className="size-3.5 text-down" /> },
              ].map(({ t, label, icon }) =>
                t ? (
                  <div key={label} className="k-row px-3.5 py-3">
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-fg-3">
                      {icon}
                      {label}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <SymbolAvatar symbol={t.symbol} size={20} />
                      <span className="text-[13px] font-medium">{t.symbol}</span>
                    </div>
                    <div className={cn("k-num mt-1 text-[15px] font-semibold", t.profit >= 0 ? "text-up" : "text-down")}>
                      {t.profit >= 0 ? "+" : "-"}
                      {formatMoney(Math.abs(t.profit))}
                    </div>
                    <div className="font-mono text-[10.5px] text-fg-3">#{t.ticket}</div>
                  </div>
                ) : null,
              )}
            </div>
          </Card>
        </Reveal>
      </div>

      {/* Symbol / weekday / long-short */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-5">
          <Card className="h-full">
            <CardHeader title="Performance by symbol" subtitle="Net P&L after charges" />
            <div className="px-4 pb-6 pt-4 sm:px-6">
              <PnlBars
                rows={bySymbol.slice(0, 9).map((g) => ({
                  key: g.key,
                  value: g.pnl,
                  sub: `${g.trades} tr · ${Math.round((g.wins / g.trades) * 100)}%`,
                  label: (
                    <Link target="_blank" rel="noopener" href={`/trade?symbol=${g.key}`} className="flex items-center gap-2 hover:text-ember">
                      <SymbolAvatar symbol={g.key} size={20} />
                      <span className="truncate text-[13px] font-medium">{g.key}</span>
                    </Link>
                  ),
                }))}
              />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-4">
          <Card className="h-full">
            <CardHeader title="By weekday" subtitle="Close time, GMT+3" />
            <div className="px-4 pb-6 pt-4 sm:px-6">
              <ColumnBars data={byDay} height={250} />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="lg:col-span-2 xl:col-span-3">
          <Card className="h-full">
            <CardHeader title="Long vs short" />
            <div className="px-6 pb-6 pt-4">
              <div className="flex h-3 overflow-hidden rounded-full">
                <span className="bg-gradient-to-r from-up/60 to-up" style={{ width: `${(longs.trades / Math.max(1, s.trades)) * 100}%` }} />
                <span className="border-l-2 border-bg bg-gradient-to-r from-down to-down/60" style={{ width: `${(shorts.trades / Math.max(1, s.trades)) * 100}%` }} />
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
                      Win {st.winRate.toFixed(0)}% · PF {st.profitFactor.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Reveal>
      </div>

      {/* Heatmap + sessions */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader title="By hour of day" subtitle="P&L heatmap · weekday × hour (GMT+3)" action={<Chip tone="up">Best: Tue 11:00</Chip>} />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <HourHeatmap rows={HOUR_HEATMAP} />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-4">
          <Card className="h-full">
            <CardHeader title="By session" subtitle="Where your edge lives" />
            <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
              {SESSIONS_PERF.map((x, i) => (
                <div key={x.session} className={cn("k-row flex items-center gap-3 px-4 py-3", i === 0 && "border-up/30 bg-up-soft/40")}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13.5px] font-medium">
                      {x.session}
                      {i === 0 && <Trophy className="size-3.5 text-gold" />}
                    </div>
                    <div className="k-num font-mono text-[11px] text-fg-3">
                      {x.hours} · {x.trades} trades
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn("k-num text-[14px] font-semibold", x.pnl >= 0 ? "text-up" : "text-down")}>
                      {x.pnl >= 0 ? "+" : "-"}
                      {formatMoney(Math.abs(x.pnl), "USD", 0)}
                    </div>
                    <div className="k-num text-[11px] text-fg-3">{x.winRate}% win</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>

      {/* Money flow + charges */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-7">
          <Card className="h-full">
            <CardHeader title="Money flow" subtitle="Lifetime · deposits → P&L → charges → withdrawals" action={<Chip tone="gold">Net ${((Object.values(MONEY_FLOW).reduce((a, b) => a + b, 0)) / 1000).toFixed(1)}K</Chip>} />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <Waterfall
                height={270}
                steps={[
                  { label: "Deposits", value: MONEY_FLOW.deposits },
                  { label: "Trading P&L", value: MONEY_FLOW.tradingPnl },
                  { label: "Earnings (IB/PAMM)", value: MONEY_FLOW.earnings },
                  { label: "Charges", value: MONEY_FLOW.charges },
                  { label: "Withdrawals", value: MONEY_FLOW.withdrawals },
                  { label: "Current value", value: 0, total: true },
                ]}
              />
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-5">
          <Card className="h-full">
            <CardHeader title="Charges" subtitle="Commission, swap and fees paid" />
            <div className="flex flex-col items-center gap-5 px-6 pb-4 pt-4 sm:flex-row">
              <Donut
                size={150}
                thickness={16}
                data={CHARGES_BREAKDOWN.map((c, i) => ({ label: c.label, value: c.value, color: ["var(--k-ember)", "var(--k-gold)", "var(--k-fg-3)"][i] }))}
                center={
                  <div>
                    <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Total</div>
                    <div className="k-num text-[17px] font-semibold">${(CHARGES_BREAKDOWN.reduce((a, c) => a + c.value, 0) / 1000).toFixed(2)}K</div>
                  </div>
                }
              />
              <div className="w-full flex-1 space-y-2">
                {CHARGES_BREAKDOWN.map((c, i) => (
                  <div key={c.label} className="flex items-start gap-2.5">
                    <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: ["var(--k-ember)", "var(--k-gold)", "var(--k-fg-3)"][i] }} />
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
            <div className="mx-6 mb-6 flex items-center justify-between rounded-[14px] border border-dashed border-line px-4 py-3 text-[12.5px]">
              <span className="text-fg-3">
                Spread cost <span className="text-fg-2">(informational, already in prices)</span>
              </span>
              <span className="k-num font-medium text-fg-2">{formatMoney(SPREAD_COST_INFO)}</span>
            </div>
          </Card>
        </Reveal>
      </div>

      {/* Insights */}
      <Reveal delay={0.05} className="mt-4">
        <Card>
          <CardHeader title="Behaviour insights" subtitle="Patterns our AI found in your last 90 days of trading" action={<Chip tone="ember" dot>6 insights</Chip>} />
          <div className="grid grid-cols-1 gap-3 px-4 pb-6 pt-4 sm:px-6 md:grid-cols-2 xl:grid-cols-3">
            {INSIGHTS.map((ins) => (
              <div key={ins.id} className="k-row group relative overflow-hidden p-5 transition-colors hover:bg-surface-3/60">
                <div className={cn("absolute inset-x-0 top-0 h-px", ins.tone === "up" ? "bg-up/50" : ins.tone === "down" ? "bg-down/50" : ins.tone === "warn" ? "bg-warn/50" : "bg-gold/50")} />
                <div className="flex items-start gap-4">
                  <Icon3D name={ins.icon} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[14.5px] font-medium leading-snug">{ins.title}</div>
                      <span className={cn("k-num shrink-0 text-[18px] font-semibold", ins.tone === "up" ? "text-up" : ins.tone === "down" ? "text-down" : ins.tone === "warn" ? "text-warn" : "text-gold")}>{ins.stat}</span>
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-2">{ins.text}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-fg-3">
                    <Sparkles className="size-3.5 shrink-0 text-ember" />
                    <span className="truncate">{ins.tip}</span>
                  </span>
                  <button className="shrink-0 text-[12px] font-medium text-ember hover:underline" onClick={() => toast.success("Rule saved", { description: ins.tip })}>
                    Apply
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.1} className="mt-4">
        <Card hot className="relative overflow-hidden">
          <Starfield density={40} />
          <div className="relative flex flex-col gap-5 p-6 md:flex-row md:items-center">
            <Icon3D name="robot" size={72} />
            <div className="flex-1">
              <h3 className="text-xl font-medium tracking-tight">Turn these numbers into a plan</h3>
              <p className="mt-1 text-[13.5px] text-fg-2">Your AI coach reviews every trade, spots habits like revenge trading and builds a weekly improvement plan.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Why do I lose on Fridays?", "Review my XAUUSD trades", "Set a daily loss limit"].map((q) => (
                  <Link key={q} href={`/academy/coach?q=${encodeURIComponent(q)}`} className="rounded-full border border-line bg-surface-2/70 px-3 py-1 text-[12px] text-fg-2 transition-colors hover:border-ember/40 hover:text-fg">
                    {q}
                  </Link>
                ))}
              </div>
            </div>
            <Link href="/academy/coach">
              <Button variant="ember" size="lg" shimmer>
                <Sparkles /> Ask AI coach
              </Button>
            </Link>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
