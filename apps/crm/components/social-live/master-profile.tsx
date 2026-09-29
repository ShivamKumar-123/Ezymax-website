"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarClock, Clock, Copy as CopyIcon, Landmark, Lock, Snowflake, Users } from "lucide-react";
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
import { fmtDate, fmtPrice, serverTime } from "@/components/trading/api";
import { PERIOD_LABEL, compactUsd, formatAge, nav4, pct, riskLabel, usd, useSocial, type MasterProfile } from "./api";
import { InfoBox, ProgramTags, RiskBadge, SocialError } from "./bits";
import { FollowDialog } from "./follow-dialog";
import { InvestDialog } from "./invest-dialog";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const RANGES = { "1M": 31, "3M": 92, "1Y": 366, All: 1e9 } as const;

type Trade = MasterProfile["trades"][number];

function EquityCard({ points }: { points: MasterProfile["equity"] }) {
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
        <CardHeader title="Growth of $10,000" subtitle="Time-weighted, deposits and withdrawals removed" />
        <EmptyState illustration="chart_increasing" title="Not enough history yet" text="The growth curve appears after the first end-of-day snapshots of this master's account." />
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
          <div className="k-label">Growth of $10,000</div>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <Money value={shown} countUp={false} className="text-[30px] font-semibold tracking-tight" />
            <Chip tone={g >= 0 ? "up" : "down"}>
              {pct(g)} · {range}
            </Chip>
          </div>
          <div className="mt-1 text-xs text-fg-3">{hover ? fmtDate(new Date(hover.time * 1000).toISOString()) : "Time-weighted from end-of-day equity · deposits and withdrawals removed"}</div>
        </div>
        <Segmented size="xs" value={range} onChange={setRange} options={Object.keys(RANGES) as (keyof typeof RANGES)[]} />
      </div>
      <div className="px-3 pb-4 pt-2">
        <EquityChart data={data} height={380} onHover={onHover} showVolume={false} />
      </div>
    </Card>
  );
}

function StatsCard({ p }: { p: MasterProfile }) {
  const s = p.master.stats;
  const stats: [string, React.ReactNode][] = [
    ["Win rate", s.trades ? `${s.winRate.toFixed(1)}%` : "—"],
    ["Closed trades", s.trades.toLocaleString("en-US")],
    ["Max drawdown", <span key="dd" className="text-down">{s.maxDd > 0 ? `-${s.maxDd.toFixed(1)}%` : "0.0%"}</span>],
    ["Current DD", <span key="cdd" className={s.currentDd > 10 ? "text-down" : "text-fg"}>{s.currentDd > 0 ? `-${s.currentDd.toFixed(1)}%` : "0.0%"}</span>],
    ["Volatility", `${s.volatility.toFixed(1)}%`],
    ["Master equity", compactUsd(s.equity)],
  ];
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Risk & statistics" subtitle="Score from max drawdown and volatility" action={<RiskBadge risk={s.riskScore} showLabel />} />
      <div className="flex justify-center py-3">
        <Gauge value={s.riskScore} max={10} display={`${s.riskScore}/10`} label={`${riskLabel(s.riskScore)} risk`} size={180} />
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
  const parsed = monthly
    .map((m) => ({ year: Number(m.month.slice(0, 4)), month: Number(m.month.slice(5, 7)) - 1, ret: m.returnPct }))
    .filter((m) => Number.isFinite(m.year) && m.month >= 0 && m.month < 12 && Number.isFinite(m.ret));
  const years = Array.from(new Set(parsed.map((x) => x.year))).sort((a, b) => b - a);
  const cell = (y: number, mo: number) => parsed.find((x) => x.year === y && x.month === mo);
  return (
    <Card className="h-full">
      <CardHeader title="Monthly returns" subtitle="Time-weighted, in %" />
      {parsed.length === 0 ? (
        <EmptyState illustration="calendar" title="No full month yet" text="Monthly returns appear once the account has end-of-day history." />
      ) : (
        <div className="overflow-x-auto px-4 pb-5 pt-4 sm:px-6">
          <table className="w-full min-w-[720px] border-separate border-spacing-1 text-[12px]">
            <thead>
              <tr>
                <th className="w-12 text-left text-[11px] font-medium text-fg-3" />
                {MONTHS.map((mo) => (
                  <th key={mo} className="text-center text-[11px] font-medium text-fg-3">
                    {mo}
                  </th>
                ))}
                <th className="text-right text-[11px] font-medium text-fg-3">Year</th>
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
                          <Tooltip content={`${MONTHS[mo]} ${y}: ${pct(c.ret)}`}>
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
                  ["Best month", pct(best.ret, 1), `${MONTHS[best.month]} ${best.year}`, "text-up"],
                  ["Worst month", pct(worst.ret, 1), `${MONTHS[worst.month]} ${worst.year}`, "text-down"],
                  ["Positive months", `${Math.round((rets.filter((r) => r > 0).length / rets.length) * 100)}%`, `${rets.filter((r) => r > 0).length} of ${rets.length}`, "text-fg"],
                  ["Avg. month", pct(rets.reduce((a, b) => a + b, 0) / rets.length), "arithmetic mean", "text-fg"],
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
  const total = symbols.reduce((s, x) => s + (x.share || 0), 0) || 1;
  const rows = [...symbols].sort((a, b) => b.share - a.share);
  const top = rows.slice(0, 5);
  const rest = rows.slice(5).reduce((s, x) => s + x.share, 0);
  const slices = [...top.map((x) => ({ label: x.symbol, value: x.share })), ...(rest > 0 ? [{ label: "Other", value: rest }] : [])];
  return (
    <Card className="h-full">
      <CardHeader title="Instruments" subtitle="Share of closed trades" />
      {symbols.length === 0 ? (
        <EmptyState illustration="chart_increasing_with_yen" title="No closed trades yet" />
      ) : (
        <div className="flex flex-col items-center gap-5 px-6 pb-6 pt-4">
          <Donut
            data={slices.map((i, k) => ({ ...i, color: CHART_COLORS[k % CHART_COLORS.length] }))}
            size={170}
            thickness={20}
            center={
              <div>
                <div className="k-num text-[22px] font-semibold">{symbols.length}</div>
                <div className="text-[11px] text-fg-3">symbols</div>
              </div>
            }
          />
          <div className="w-full space-y-2">
            {slices.map((i, k) => (
              <div key={i.label} className="k-row flex items-center gap-3 px-3.5 py-2">
                <span className="size-2.5 rounded-full" style={{ background: CHART_COLORS[k % CHART_COLORS.length] }} />
                {i.label !== "Other" && <SymbolAvatar symbol={i.label} size={20} />}
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
  const t = p.terms;
  const f = p.master.fund;
  return (
    <Card className="h-full">
      <CardHeader title="Fee terms" subtitle="Charged only on new profit above the high-water mark" />
      <div className="px-6 pt-3">
        <div className="flex items-baseline gap-2">
          <span className="k-num text-[34px] font-semibold text-gold">{t.perfFeePct}%</span>
          <span className="text-[13px] text-fg-2">performance fee</span>
        </div>
      </div>
      <div className="px-6 pb-2">
        <KeyValue
          rows={[
            ["High-water mark", <Chip key="h" size="sm" tone={t.hwm ? "up" : "neutral"}>{t.hwm ? "Yes" : "No"}</Chip>],
            ["Fee settlement (copy)", PERIOD_LABEL[t.feePeriod]],
            ["Minimum allocation", usd(t.minAllocation, 0)],
            ...(f
              ? ([
                  ["PAMM fund", f.name],
                  ["NAV per unit", nav4(f.nav)],
                  ["Rollover", PERIOD_LABEL[f.period]],
                  ["Fund fee", `${f.perfFeePct}%`],
                  ["Lock-in", f.lockInDays ? <span key="l" className="inline-flex items-center gap-1"><Lock className="size-3.5 text-warn" />{f.lockInDays} days</span> : "None"],
                  ["Minimum investment", usd(f.minInvestment, 0)],
                ] as [string, React.ReactNode][])
              : []),
          ]}
        />
      </div>
      <p className="px-6 pb-4 text-[12px] leading-relaxed text-fg-3">
        Copy fees are taken from your copy account at the end of each {({ daily: "day", weekly: "week", monthly: "month" } as const)[t.feePeriod]} on profit above your high-water mark; your deposits and withdrawals move the mark, so only trading profit is charged. The rate is locked when you start copying.
      </p>
      {f && f.status === "active" && p.master.program !== "copy" && (
        <div className="px-6 pb-6">
          <Button variant="gold" className="w-full" onClick={onInvest}>
            <Landmark /> Invest in {f.name}
          </Button>
        </div>
      )}
    </Card>
  );
}

function TradesCard({ p }: { p: MasterProfile }) {
  const columns: Column<Trade>[] = [
    { key: "sym", header: "Symbol", cell: (t) => <SymbolCell symbol={t.symbol} size={24} /> },
    { key: "side", header: "Side", cell: (t) => <Chip size="sm" tone={t.side === "buy" ? "up" : "down"}>{t.side.toUpperCase()}</Chip> },
    { key: "lots", header: "Lots", align: "right", cell: (t) => <span className="k-num">{t.volume.toFixed(2)}</span>, hideOn: "sm" },
    { key: "px", header: "Open → close", align: "right", cell: (t) => <span className="k-num font-mono text-[12px] text-fg-2">{fmtPrice(t.openPrice)} → {fmtPrice(t.closePrice)}</span>, hideOn: "md" },
    { key: "open", header: "Opened", align: "right", cell: (t) => <span className="k-num whitespace-nowrap text-fg-2">{serverTime(t.openTime, false)}</span>, sort: (t) => t.openTime, hideOn: "lg" },
    { key: "time", header: "Closed", align: "right", cell: (t) => <span className="k-num whitespace-nowrap text-fg-2">{serverTime(t.closeTime, false)}</span>, sort: (t) => t.closeTime },
    { key: "pl", header: "Profit", align: "right", cell: (t) => <span className={cn("k-num font-semibold", t.profit > 0 ? "text-up" : t.profit < 0 ? "text-down" : "text-fg-2")}>{usd(t.profit, 2, true)}</span>, sort: (t) => t.profit },
  ];
  return (
    <Card className="h-full">
      <CardHeader
        title="Trade history"
        subtitle="Closed trades, profit in USD after costs"
        action={
          <Chip tone="warn">
            <Clock className="size-3" /> {p.tradeDelayMinutes} min delay
          </Chip>
        }
      />
      <div className="px-4 pb-5 pt-4 sm:px-6">
        {p.trades.length === 0 ? (
          <EmptyState illustration="hourglass_not_done" title="No closed trades to show yet" text={`Trades appear here ${p.tradeDelayMinutes} minutes after they close.`} />
        ) : (
          <DataTable columns={columns} rows={p.trades} pageSize={12} dense rowKey={(t) => String(t.id)} />
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function LiveMasterProfilePage() {
  const { id } = useParams<{ id: string }>();
  const valid = /^\d{1,12}$/.test(id ?? "");
  const { data: p, error, reload } = useSocial<MasterProfile>(valid ? `masters/${id}` : null, 60000);
  const [copy, setCopy] = React.useState(false);
  const [invest, setInvest] = React.useState(false);

  const back = (
    <Link href="/social" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-fg-2 hover:text-fg">
      <ArrowLeft className="size-4" /> Discover
    </Link>
  );

  if (!valid || (error && (error.status === 404 || error.status === 400) && !p)) {
    return (
      <div className="pb-24">
        {back}
        <Card>
          <EmptyState
            illustration="magnifying_glass_tilted_left"
            title="Master not found"
            text="This profile may have been unpublished or the link is incorrect."
            action={
              <Link href="/social">
                <Button variant="ember">Back to Discover</Button>
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
  const canCopy = m.program !== "pamm" && m.status === "approved" && !m.frozen;
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
              <Chip tone="up" size="sm">
                Approved master
              </Chip>
              {m.frozen && (
                <Chip tone="down" size="sm">
                  <Snowflake className="size-3" /> Copying paused by risk team
                </Chip>
              )}
            </div>
            <div className="mt-1 text-[16px] text-fg">{m.strategy}</div>
            {m.description && <p className="mt-3 max-w-3xl whitespace-pre-line text-[14px] leading-relaxed text-fg-2">{m.description}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <ProgramTags program={m.program} size="md" />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-fg-3">
              <span className="flex items-center gap-1">
                <CalendarClock className="size-3.5" /> Master since {fmtDate(m.since)} · track {formatAge(m.ageDays)}
              </span>
              <span className="flex items-center gap-1">
                <Users className="size-3.5" /> {s.followers.toLocaleString("en-US")} follower{s.followers === 1 ? "" : "s"}
                {m.fund ? ` · ${s.investors.toLocaleString("en-US")} investor${s.investors === 1 ? "" : "s"}` : ""}
              </span>
              <span>AUM {compactUsd(s.aum)}</span>
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[300px]">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["1M", s.return1m],
                  ["1Y", s.return1y],
                  ["All", s.returnAll],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="k-row px-3 py-2.5 text-center">
                  <div className="text-[11px] text-fg-3">Return {k}</div>
                  <div className={cn("k-num text-[16px] font-semibold", v > 0 ? "text-up" : v < 0 ? "text-down" : "text-fg-2")}>{pct(v, 1)}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              {m.program !== "pamm" && (
                <Button variant="ember" size="lg" className="flex-1" disabled={!canCopy} onClick={() => setCopy(true)}>
                  <CopyIcon /> Copy
                </Button>
              )}
              {canInvest && (
                <Button variant="gold" size="lg" className="flex-1" onClick={() => setInvest(true)}>
                  <Landmark /> Invest (PAMM)
                </Button>
              )}
            </div>
            <div className="text-[12px] text-fg-3">
              Fee {p.terms.perfFeePct}% above HWM · min {usd(p.terms.minAllocation, 0)}
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
        Past performance doesn&apos;t guarantee future results. Copied trades can&apos;t be closed one by one; to exit, stop copying and every copied position closes at market.
      </InfoBox>

      <FollowDialog master={m} open={copy} onOpenChange={setCopy} suggested={p.symbols.map((x) => x.symbol)} />
      <InvestDialog fundId={m.fund?.id ?? null} open={invest} onOpenChange={setInvest} />
    </div>
  );
}
