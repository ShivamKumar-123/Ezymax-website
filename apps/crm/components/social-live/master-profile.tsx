"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, CalendarClock, Clock, Copy as CopyIcon, Landmark, Lock, Snowflake, Users } from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  CHART_COLORS,
  Chip,
  DataTable,
  Donut,
  EmptyState,
  EquityChart,
  Gauge,
  KeyValue,
  Money,
  Segmented,
  Skeleton,
  SymbolAvatar,
  SymbolCell,
  Tooltip,
  cn,
  type Column,
  type SeriesPoint,
} from "@kalks/ui";
import { useFormat, useT } from "@kalks/i18n/react";
import { fmtDate, fmtPrice, serverTime } from "@/components/trading/api";
import { PERIOD_LABEL, compactUsd, formatAge, nav4, pct, riskLabel, usd, useSocial, type MasterProfile } from "./api";
import { HouseBadge, InfoBox, ProgramTags, RiskBadge, SocialError } from "./bits";
import { FollowDialog } from "./follow-dialog";
import { InvestDialog } from "./invest-dialog";

// Month columns; names come from the reader's locale at render (useMonthName)
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const RANGES = { "1M": 31, "3M": 92, "1Y": 366, All: 1e9 } as const;
const RANGE_LABEL = { "1M": "social.lb.period.1m", "3M": "social.lb.period.3m", "1Y": "social.lb.period.1y", All: "common.all" } as const;

function useMonthName() {
  const fmt = useFormat();
  return (mo: number) => fmt.date(Date.UTC(2000, mo, 15), { month: "short" });
}

type Trade = MasterProfile["trades"][number];

function EquityCard({ points }: { points: MasterProfile["equity"] }) {
  const t = useT();
  const all = React.useMemo<SeriesPoint[]>(
    () =>
      points
        .map((p) => ({ time: Math.floor(Date.parse(p.day.length === 10 ? `${p.day}T00:00:00Z` : p.day) / 1000), value: +(p.index * 10000).toFixed(2) }))
        .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
        .sort((a, b) => a.time - b.time)
        .filter((p, i, arr) => i === 0 || p.time > arr[i - 1]!.time),
    [points],
  );
  const [range, setRange] = React.useState<keyof typeof RANGES>("All");
  const data = React.useMemo(() => {
    if (!all.length) return all;
    const cut = all[all.length - 1]!.time - RANGES[range] * 86400;
    return all.filter((p) => p.time >= cut);
  }, [all, range]);
  const [hover, setHover] = React.useState<SeriesPoint | null>(null);
  const onHover = React.useCallback((p: SeriesPoint | null) => setHover(p), []);

  if (data.length < 2) {
    return (
      <Card className="h-full">
        <CardHeader title={t("social.profile.growth")} subtitle={t("social.profile.growthSub")} />
        <EmptyState illustration="chart_increasing" title={t("social.profile.growthEmptyTitle")} text={t("social.profile.growthEmptyText")} />
      </Card>
    );
  }
  const first = data[0]!.value;
  const shown = hover?.value ?? data[data.length - 1]!.value;
  const g = (shown / first - 1) * 100;
  return (
    <Card className="h-full">
      <div className="flex flex-col gap-4 px-6 pt-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="k-label">{t("social.profile.growth")}</div>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <Money value={shown} countUp={false} className="text-[30px] font-semibold tracking-tight" />
            <Chip tone={g >= 0 ? "up" : "down"}>
              {pct(g)} · {t(RANGE_LABEL[range])}
            </Chip>
          </div>
          <div className="mt-1 text-xs text-fg-3">{hover ? fmtDate(new Date(hover.time * 1000).toISOString()) : t("social.profile.growthHint")}</div>
        </div>
        <Segmented size="xs" value={range} onChange={setRange} options={(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((k) => ({ value: k, label: t(RANGE_LABEL[k]) }))} />
      </div>
      <div className="px-3 pb-4 pt-2">
        <EquityChart data={data} height={380} onHover={onHover} showVolume={false} />
      </div>
    </Card>
  );
}

function StatsCard({ p }: { p: MasterProfile }) {
  const t = useT();
  const fmt = useFormat();
  const s = p.master.stats;
  const stats: [string, React.ReactNode][] = [
    [t("social.profile.winRate"), s.trades ? `${s.winRate.toFixed(1)}%` : "—"],
    [t("social.profile.closedTrades"), fmt.number(s.trades, 0)],
    [t("social.follow.maxDrawdown"), <span key="dd" className={s.maxDd > 0 ? "text-down" : "text-fg-2"}>{s.maxDd > 0 ? `-${s.maxDd.toFixed(1)}%` : "0.0%"}</span>],
    [t("social.profile.currentDd"), <span key="cdd" className={s.currentDd > 10 ? "text-down" : "text-fg"}>{s.currentDd > 0 ? `-${s.currentDd.toFixed(1)}%` : "0.0%"}</span>],
    [t("social.profile.volatility"), `${s.volatility.toFixed(1)}%`],
    [t("social.profile.masterEquity"), compactUsd(s.equity)],
  ];
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title={t("social.profile.riskStats")} subtitle={t("social.profile.riskStatsSub")} action={<RiskBadge risk={s.riskScore} showLabel />} />
      <div className="flex justify-center py-3">
        <Gauge value={s.riskScore} max={10} display={`${s.riskScore}/10`} label={t("social.profile.riskLevel", { level: riskLabel(s.riskScore) })} size={180} />
      </div>
      <div className="grid grid-cols-2 gap-2 px-4 pb-5 sm:px-6">
        {stats.map(([k, v]) => (
          <div key={k} className="k-row px-3.5 py-2.5">
            <div className="text-[11px] uppercase tracking-wider text-fg-3">{k}</div>
            <div className="k-num mt-0.5 text-[14.5px] font-medium">{v}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MonthlyCard({ monthly }: { monthly: MasterProfile["monthly"] }) {
  const t = useT();
  const monthName = useMonthName();
  const parsed = monthly
    .map((m) => ({ year: Number(m.month.slice(0, 4)), month: Number(m.month.slice(5, 7)) - 1, ret: m.returnPct }))
    .filter((m) => Number.isFinite(m.year) && m.month >= 0 && m.month < 12 && Number.isFinite(m.ret));
  const years = Array.from(new Set(parsed.map((x) => x.year))).sort((a, b) => b - a);
  const cell = (y: number, mo: number) => parsed.find((x) => x.year === y && x.month === mo);
  return (
    <Card className="h-full">
      <CardHeader title={t("social.profile.monthly")} subtitle={t("social.profile.monthlySub")} />
      {parsed.length === 0 ? (
        <EmptyState illustration="calendar" title={t("social.profile.monthlyEmptyTitle")} text={t("social.profile.monthlyEmptyText")} />
      ) : (
        <div className="overflow-x-auto px-4 pb-5 pt-4 sm:px-6">
          <table dir="ltr" className="w-full min-w-[720px] border-separate border-spacing-1 text-[12px]">
            <thead>
              <tr>
                <th className="w-12 text-left text-[11px] font-medium text-fg-3" />
                {MONTHS.map((mo, i) => (
                  <th key={mo} className="text-center text-[11px] font-medium text-fg-3">
                    {monthName(i)}
                  </th>
                ))}
                <th className="text-right text-[11px] font-medium text-fg-3">{t("social.profile.year")}</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => {
                const yr = parsed.filter((x) => x.year === y).reduce((acc, x) => acc * (1 + x.ret / 100), 1);
                const ytd = (yr - 1) * 100;
                return (
                  <tr key={y}>
                    <td className="k-num font-mono text-[12px] text-fg-2">{y}</td>
                    {MONTHS.map((_, mo) => {
                      const c = cell(y, mo);
                      if (!c) return <td key={mo} className="h-9 rounded-lg bg-surface-2/50" />;
                      const a = Math.min(1, Math.abs(c.ret) / 8);
                      const tone = c.ret >= 0 ? "var(--k-up)" : "var(--k-down)";
                      return (
                        <td key={mo} className="k-num h-9 rounded-lg text-center font-medium" style={{ background: `color-mix(in oklab, ${tone} ${Math.round(10 + a * 55)}%, transparent)`, color: a > 0.55 ? "#fff" : tone }}>
                          <Tooltip content={`${monthName(mo)} ${y}: ${pct(c.ret)}`}>
                            <span className="block">{pct(c.ret, 1).replace("%", "")}</span>
                          </Tooltip>
                        </td>
                      );
                    })}
                    <td className={cn("k-num pl-2 text-right text-[13px] font-semibold", ytd >= 0 ? "text-up" : "text-down")}>{pct(ytd, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {parsed.length > 1 && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(() => {
                const rets = parsed.map((x) => x.ret);
                const best = parsed.reduce((a, b) => (b.ret > a.ret ? b : a));
                const worst = parsed.reduce((a, b) => (b.ret < a.ret ? b : a));
                return [
                  [t("social.profile.bestMonth"), pct(best.ret, 1), `${monthName(best.month)} ${best.year}`, "text-up"],
                  [t("social.profile.worstMonth"), pct(worst.ret, 1), `${monthName(worst.month)} ${worst.year}`, "text-down"],
                  [t("social.profile.positiveMonths"), `${Math.round((rets.filter((r) => r > 0).length / rets.length) * 100)}%`, t("social.profile.nOfTotal", { n: rets.filter((r) => r > 0).length, total: rets.length }), "text-fg"],
                  [t("social.profile.avgMonth"), pct(rets.reduce((a, b) => a + b, 0) / rets.length), t("social.profile.arithmeticMean"), "text-fg"],
                ].map(([k, v, sub, cls]) => (
                  <div key={k} className="k-row px-3.5 py-2.5">
                    <div className="text-[11px] uppercase tracking-wider text-fg-3">{k}</div>
                    <div className={cn("k-num mt-0.5 text-[16px] font-semibold", cls)}>{v}</div>
                    <div className="text-[11px] text-fg-3">{sub}</div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function SymbolsCard({ symbols }: { symbols: MasterProfile["symbols"] }) {
  const t = useT();
  const other = t("social.profile.other");
  const total = symbols.reduce((s, x) => s + (x.share || 0), 0) || 1;
  const rows = [...symbols].sort((a, b) => b.share - a.share);
  const top = rows.slice(0, 5);
  const rest = rows.slice(5).reduce((s, x) => s + x.share, 0);
  const slices = [...top.map((x) => ({ label: x.symbol, value: x.share })), ...(rest > 0 ? [{ label: other, value: rest }] : [])];
  return (
    <Card className="h-full">
      <CardHeader title={t("social.profile.instruments")} subtitle={t("social.profile.instrumentsSub")} />
      {symbols.length === 0 ? (
        <EmptyState illustration="chart_increasing_with_yen" title={t("social.profile.noClosedTrades")} />
      ) : (
        <div className="flex flex-col items-center gap-5 px-6 pb-6 pt-4">
          <Donut
            data={slices.map((i, k) => ({ ...i, color: CHART_COLORS[k % CHART_COLORS.length] }))}
            size={170}
            thickness={20}
            center={
              <div>
                <div className="k-num text-[22px] font-semibold">{symbols.length}</div>
                <div className="text-[11px] text-fg-3">{t("social.profile.symbols")}</div>
              </div>
            }
          />
          <div className="w-full space-y-2">
            {slices.map((i, k) => (
              <div key={i.label} className="k-row flex items-center gap-3 px-3.5 py-2">
                <span className="size-2.5 rounded-full" style={{ background: CHART_COLORS[k % CHART_COLORS.length] }} />
                {i.label !== other && <SymbolAvatar symbol={i.label} size={20} />}
                <span className="flex-1 text-[13px] font-medium">{i.label}</span>
                <span className="k-num text-[13px] text-fg-2">{((i.value / total) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function FeesCard({ p, onInvest }: { p: MasterProfile; onInvest: () => void }) {
  const tt = useT();
  const t = p.terms;
  const f = p.master.fund;
  return (
    <Card className="h-full">
      <CardHeader title={tt("social.profile.feeTerms")} subtitle={tt("social.profile.feeTermsSub")} />
      <div className="px-6 pt-3">
        <div className="flex items-baseline gap-2">
          <span className="k-num text-[34px] font-semibold text-gold">{t.perfFeePct}%</span>
          <span className="text-[13px] text-fg-2">{tt("social.profile.performanceFeeLower")}</span>
        </div>
      </div>
      <div className="px-6 pb-2">
        <KeyValue
          rows={[
            [tt("social.funds.explain.hwmT"), <Chip key="h" size="sm" tone={t.hwm ? "up" : "neutral"}>{t.hwm ? tt("common.yes") : tt("common.no")}</Chip>],
            [tt("social.profile.feeSettlement"), PERIOD_LABEL[t.feePeriod]],
            [tt("social.profile.minAllocation"), usd(t.minAllocation, 0)],
            ...(f
              ? ([
                  [tt("social.funds.pammFund"), f.name],
                  [tt("social.navPerUnit"), nav4(f.nav)],
                  [tt("social.rollover"), PERIOD_LABEL[f.period]],
                  [tt("social.profile.fundFee"), `${f.perfFeePct}%`],
                  [tt("social.lockIn"), f.lockInDays ? <span key="l" className="inline-flex items-center gap-1"><Lock className="size-3.5 text-warn" />{tt("social.profile.days", { count: f.lockInDays })}</span> : tt("common.none")],
                  [tt("social.funds.minInvestment"), usd(f.minInvestment, 0)],
                ] as [string, React.ReactNode][])
              : []),
          ]}
        />
      </div>
      <p className="px-6 pb-4 text-[12px] leading-relaxed text-fg-3">
        {tt.dyn(`social.profile.feeNote.${t.feePeriod}`, "")}
      </p>
      {f && f.status === "active" && p.master.program !== "copy" && (
        <div className="px-6 pb-6">
          <Button variant="gold" className="w-full" onClick={onInvest}>
            <Landmark /> {tt("social.invest.title", { name: f.name })}
          </Button>
        </div>
      )}
    </Card>
  );
}

function TradesCard({ p }: { p: MasterProfile }) {
  const tt = useT();
  const columns: Column<Trade>[] = [
    { key: "sym", header: tt("social.col.symbol"), cell: (t) => <SymbolCell symbol={t.symbol} size={24} /> },
    { key: "side", header: tt("social.col.side"), cell: (t) => <Chip size="sm" tone={t.side === "buy" ? "up" : "down"}>{tt.dyn(`common.${t.side}`, t.side).toUpperCase()}</Chip> },
    { key: "lots", header: tt("social.col.lots"), align: "right", cell: (t) => <span className="k-num">{t.volume.toFixed(2)}</span>, hideOn: "sm" },
    { key: "px", header: tt("social.profile.col.openClose"), align: "right", cell: (t) => <span className="k-num font-mono text-[12px] text-fg-2">{fmtPrice(t.openPrice)} → {fmtPrice(t.closePrice)}</span>, hideOn: "md" },
    { key: "open", header: tt("social.profile.col.opened"), align: "right", cell: (t) => <span className="k-num whitespace-nowrap text-fg-2">{serverTime(t.openTime, false)}</span>, sort: (t) => t.openTime, hideOn: "lg" },
    { key: "time", header: tt("social.profile.col.closed"), align: "right", cell: (t) => <span className="k-num whitespace-nowrap text-fg-2">{serverTime(t.closeTime, false)}</span>, sort: (t) => t.closeTime },
    { key: "pl", header: tt("social.profit"), align: "right", cell: (t) => <span className={cn("k-num font-semibold", t.profit > 0 ? "text-up" : t.profit < 0 ? "text-down" : "text-fg-2")}>{usd(t.profit, 2, true)}</span>, sort: (t) => t.profit },
  ];
  return (
    <Card className="h-full">
      <CardHeader
        title={tt("social.profile.tradeHistory")}
        subtitle={tt("social.profile.tradeHistorySub")}
        action={
          <Chip tone="warn">
            <Clock className="size-3" /> {tt("social.profile.delay", { n: p.tradeDelayMinutes })}
          </Chip>
        }
      />
      <div className="px-4 pb-5 pt-4 sm:px-6">
        {p.trades.length === 0 ? (
          <EmptyState illustration="hourglass_not_done" title={tt("social.profile.tradesEmptyTitle")} text={tt("social.profile.tradesEmptyText", { n: p.tradeDelayMinutes })} />
        ) : (
          <DataTable columns={columns} rows={p.trades} pageSize={12} dense rowKey={(t) => String(t.id)} />
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function LiveMasterProfilePage() {
  const t = useT();
  const fmt = useFormat();
  const { id } = useParams<{ id: string }>();
  const valid = /^\d{1,12}$/.test(id ?? "");
  const { data: p, error, reload } = useSocial<MasterProfile>(valid ? `masters/${id}` : null, 60000);
  const [copy, setCopy] = React.useState(false);
  const [invest, setInvest] = React.useState(false);

  const back = (
    <Link href="/social" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-fg-2 hover:text-fg">
      <ArrowLeft className="size-4 rtl:-scale-x-100" /> {t("social.profile.discover")}
    </Link>
  );

  if (!valid || (error && (error.status === 404 || error.status === 400) && !p)) {
    return (
      <div className="pb-24">
        {back}
        <Card>
          <EmptyState
            illustration="magnifying_glass_tilted_left"
            title={t("social.profile.notFoundTitle")}
            text={t("social.profile.notFoundText")}
            action={
              <Link href="/social">
                <Button variant="ember">{t("social.profile.backToDiscover")}</Button>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }
  if (error && !p) {
    return (
      <div className="pb-24">
        {back}
        <SocialError onRetry={reload} message={error.message} />
      </div>
    );
  }
  if (!p) {
    return (
      <div className="pb-24">
        {back}
        <Skeleton className="h-[220px] w-full rounded-[20px]" />
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Skeleton className="h-[460px] rounded-[20px] xl:col-span-8" />
          <Skeleton className="h-[460px] rounded-[20px] xl:col-span-4" />
        </div>
      </div>
    );
  }

  const m = p.master;
  const s = m.stats;
  const canCopy = m.program !== "pamm" && m.status === "approved" && !m.frozen && !(m.house && m.hidden);
  const canInvest = !!m.fund && m.program !== "copy" && m.fund.status === "active";

  return (
    <div className="pb-24">
      {back}

      <Card>
        <div className="flex flex-col gap-6 p-6 sm:p-7 lg:flex-row lg:items-start">
          <Avatar name={m.nickname} size={88} className="self-start" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[26px] font-medium leading-tight tracking-tight">{m.nickname}</h1>
              {m.house ? (
                <HouseBadge />
              ) : (
                <Chip tone="up" size="sm">
                  {t("social.profile.approved")}
                </Chip>
              )}
              {m.frozen && (
                <Chip tone="down" size="sm">
                  <Snowflake className="size-3" /> {t("social.profile.frozen")}
                </Chip>
              )}
            </div>
            <div className="mt-1 text-[16px] text-fg">{m.strategy}</div>
            {m.description && <p className="mt-3 max-w-3xl whitespace-pre-line text-[14px] leading-relaxed text-fg-2">{m.description}</p>}
            {m.house && (
              <InfoBox className="mt-3 max-w-3xl" icon={<Building2 />}>
                {t("social.house.disclosure")}
              </InfoBox>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <ProgramTags program={m.program} size="md" />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-fg-3">
              <span className="flex items-center gap-1">
                <CalendarClock className="size-3.5" /> {t("social.profile.since", { date: fmtDate(m.since), age: formatAge(m.ageDays) })}
              </span>
              <span className="flex items-center gap-1">
                <Users className="size-3.5" /> {t("social.profile.followersCount", { count: s.followers, n: fmt.number(s.followers, 0) })}
                {m.fund ? ` · ${t("social.profile.investorsCount", { count: s.investors, n: fmt.number(s.investors, 0) })}` : ""}
              </span>
              <span>{t("social.aum")} {compactUsd(s.aum)}</span>
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[300px]">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["social.lb.period.1m", s.return1m],
                  ["social.lb.period.1y", s.return1y],
                  ["common.all", s.returnAll],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="k-row px-3 py-2.5 text-center">
                  <div className="text-[11px] text-fg-3">{t("social.lb.col.return", { period: t(k) })}</div>
                  <div className={cn("k-num text-[16px] font-semibold", v > 0 ? "text-up" : v < 0 ? "text-down" : "text-fg-2")}>{pct(v, 1)}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              {m.program !== "pamm" && (
                <Button variant="ember" size="lg" className="flex-1" disabled={!canCopy} onClick={() => setCopy(true)}>
                  <CopyIcon /> {t("social.program.copy")}
                </Button>
              )}
              {canInvest && (
                <Button variant="gold" size="lg" className="flex-1" onClick={() => setInvest(true)}>
                  <Landmark /> {t("social.profile.investPamm")}
                </Button>
              )}
            </div>
            <div className="text-[12px] text-fg-3">
              {t("social.profile.feeLine", { fee: p.terms.perfFeePct, min: usd(p.terms.minAllocation, 0) })}
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <EquityCard points={p.equity} />
        </div>
        <div className="xl:col-span-4">
          <StatsCard p={p} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <MonthlyCard monthly={p.monthly} />
        </div>
        <div className="xl:col-span-4">
          <SymbolsCard symbols={p.symbols} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <TradesCard p={p} />
        </div>
        <div className="xl:col-span-4">
          <FeesCard p={p} onInvest={() => setInvest(true)} />
        </div>
      </div>

      <InfoBox className="mt-6">
        {t("social.profile.disclaimer")}
      </InfoBox>

      <FollowDialog master={m} open={copy} onOpenChange={setCopy} suggested={p.symbols.map((x) => x.symbol)} />
      <InvestDialog fundId={m.fund?.id ?? null} open={invest} onOpenChange={setInvest} />
    </div>
  );
}
