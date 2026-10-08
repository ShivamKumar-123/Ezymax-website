"use client";

// Analytics → Deposits & FTDs, Funnel, Cohorts & LTV, Accounts & activity, Partners (D120, D145) on the reports
// service. Money is USD; days are server days.

import * as React from "react";
import Link from "next/link";
import { Activity, ArrowDownLeft, ArrowUpRight, BarChart3, Clock, Coins, Filter, Globe2, Handshake, Landmark, Layers, Megaphone, PiggyBank, Scale, ShieldCheck, TrendingUp, Trophy, UserPlus, Users, Wallet } from "lucide-react";
import { Button, Card, CardHeader, Chip, DataTable, Delta, Flag, KpiCard, Money, PageHeader, Reveal, Segmented, cn, formatNumber, type Column } from "@ezymex/ui";
import { StackedBars, compactMoney } from "@/components/analytics/stacked-bars";
import { LineChart } from "@/components/analytics/line-chart";
import { CohortHeatmap } from "@/components/analytics/cohort-heatmap";
import { dayLabel, weekday } from "@/components/analytics/common";
import { Meter, MiniStat } from "@/components/analytics/meter";
import { ExportMenu, PeriodPicker, ReportFailed, ReportLoading, countryName, periodRange, useReport, type Period } from "./common";

function Shell<T>({ title, subtitle, report, name, period, setPeriod, state, children, hidePeriod }: {
  title: string;
  subtitle: string;
  report: string;
  name: string;
  period: Period;
  setPeriod: (p: Period) => void;
  state: { data: T | null; error: string | null; loading: boolean; reload: () => void };
  children: (d: T) => React.ReactNode;
  hidePeriod?: boolean;
}) {
  const r = periodRange(period);
  return (
    <div className="pb-16">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {!hidePeriod && <PeriodPicker value={period} onChange={setPeriod} />}
            <ExportMenu report={report} name={name} from={r.from} to={r.to} />
          </>
        }
      />
      {state.loading && !state.data ? <ReportLoading /> : state.error && !state.data ? <ReportFailed message={state.error} onRetry={state.reload} /> : state.data ? <div className={cn("transition-opacity", state.loading && "opacity-60")}>{children(state.data)}</div> : null}
    </div>
  );
}

function CountryCell({ code }: { code: string }) {
  const c = code && code !== "--" ? code.toLowerCase() : "";
  return (
    <span className="flex items-center gap-2">
      {c ? <Flag country={c} className="size-4" /> : <span className="size-4 rounded-full bg-surface-3" />}
      <span className="truncate">{countryName(code)}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Deposits & FTDs                                                     */
/* ------------------------------------------------------------------ */

type Agg = { deposits: number; withdrawals: number; net: number; ftds: number; ftdAmount: number; depositors: number; signups: number };
type Deposits = {
  totals: Agg & { withdrawalFees: number; avgFtd: number };
  daily: (Agg & { date: string })[];
  byCountry: (Agg & { country: string })[];
  byIb: (Agg & { ib: string; ibName: string })[];
  byCampaign: (Agg & { campaign: string })[];
  topDepositors: { userId: number; name: string; amount: number }[];
  ftdList: { userId: number; name: string; country: string; campaign: string; at: string; amount: number }[];
};

function aggCols<T extends Agg>(first: Column<T>): Column<T>[] {
  return [
    first,
    { key: "signups", header: "Sign-ups", align: "right", sort: (r) => r.signups, cell: (r) => <span className="k-num text-fg-2">{formatNumber(r.signups, 0)}</span>, hideOn: "md" },
    { key: "ftds", header: "FTDs", align: "right", sort: (r) => r.ftds, cell: (r) => <span className="k-num">{formatNumber(r.ftds, 0)}</span> },
    { key: "dep", header: "Deposits", align: "right", sort: (r) => r.deposits, cell: (r) => <Money value={r.deposits} decimals={0} countUp={false} /> },
    { key: "wd", header: "Withdrawals", align: "right", sort: (r) => r.withdrawals, cell: (r) => <Money value={r.withdrawals} decimals={0} countUp={false} className="text-fg-2" />, hideOn: "lg" },
    { key: "net", header: "Net", align: "right", sort: (r) => r.net, cell: (r) => <Money value={r.net} decimals={0} countUp={false} tone="auto" className="font-semibold" /> },
  ];
}

export function LiveDeposits() {
  const [period, setPeriod] = React.useState<Period>("30D");
  const r = periodRange(period);
  const state = useReport<Deposits>(`deposits?from=${r.from}&to=${r.to}`);
  const [split, setSplit] = React.useState<"country" | "ib" | "campaign">("country");
  return (
    <Shell title="Deposits & FTDs" subtitle="Money in and out, first-time deposits and net deposits by country, IB and campaign · wallet + desk · USD · server time" report="deposits" name="Deposits" period={period} setPeriod={setPeriod} state={state}>
      {(d) => {
        const t = d.totals;
        const bars = d.daily.map((x) => ({ label: dayLabel(x.date), title: `${weekday(x.date)}, ${dayLabel(x.date, true)}`, values: { dep: x.deposits, wd: x.withdrawals } }));
        return (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Net deposits" icon={<PiggyBank />} value={<Money value={t.net} decimals={0} tone="auto" />} chip={`${formatNumber(t.depositors, 0)} depositors`} chipTone="ember" />
              <KpiCard label="Deposits" icon={<ArrowDownLeft />} value={<Money value={t.deposits} decimals={0} />} chip={`Avg FTD ${compactMoney(t.avgFtd)}`} chipTone="neutral" delay={0.05} />
              <KpiCard label="Withdrawals" icon={<ArrowUpRight />} value={<Money value={-t.withdrawals} decimals={0} />} footer={<span className="k-num text-[11.5px] text-fg-3">{t.deposits ? `${((-t.withdrawals / t.deposits) * 100).toFixed(1)}% of deposits` : "—"} · fees {compactMoney(t.withdrawalFees)}</span>} delay={0.1} />
              <KpiCard label="First-time deposits" icon={<UserPlus />} value={<span className="k-num">{formatNumber(t.ftds, 0)}</span>} chip={`${formatNumber(t.signups, 0)} sign-ups · ${compactMoney(t.ftdAmount)}`} chipTone="up" href="/analytics/funnel" delay={0.15} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
              <Reveal delay={0.05} className="xl:col-span-8">
                <Card className="h-full">
                  <CardHeader title="Deposits vs withdrawals" subtitle={`Daily · ${period} · line = net deposits`} icon={<Landmark />} action={<Chip tone={t.net >= 0 ? "up" : "down"} dot>Net {compactMoney(t.net)}</Chip>} />
                  <div className="px-4 pb-5 pt-5 sm:px-6">
                    <StackedBars
                      data={bars}
                      series={[
                        { key: "dep", label: "Deposits", color: "var(--k-up)" },
                        { key: "wd", label: "Withdrawals", color: "color-mix(in oklab, var(--k-down) 75%, var(--k-surface-3))" },
                      ]}
                      height={290}
                      line={{ key: "net", label: "Net", color: "var(--k-fg)", values: d.daily.map((x) => x.net) }}
                    />
                  </div>
                </Card>
              </Reveal>
              <Reveal delay={0.1} className="xl:col-span-4">
                <Card className="h-full">
                  <CardHeader title="Top depositors" subtitle={`${period} · wallet and desk deposits`} icon={<Wallet />} />
                  <div className="space-y-1.5 px-4 pb-5 pt-4 sm:px-6">
                    {d.topDepositors.length === 0 && <div className="py-4 text-[13px] text-fg-3">No deposits in this period.</div>}
                    {d.topDepositors.slice(0, 8).map((x, i) => (
                      <Link key={x.userId} href={`/clients/${x.userId}`} className="k-row flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-surface-3/50">
                        <span className="k-num w-5 text-[12px] text-fg-3">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{x.name || `Client ${x.userId}`}</span>
                        <Money value={x.amount} decimals={0} countUp={false} className="text-[13px] font-semibold" />
                      </Link>
                    ))}
                  </div>
                </Card>
              </Reveal>
            </div>
            <Reveal delay={0.1} className="mt-4">
              <Card>
                <CardHeader
                  title={split === "country" ? "By country" : split === "ib" ? "By introducing broker" : "By campaign"}
                  subtitle="Sign-ups in the period, FTDs, deposits, withdrawals and net deposits"
                  icon={split === "country" ? <Globe2 /> : split === "ib" ? <Handshake /> : <Megaphone />}
                  action={<Segmented size="xs" value={split} onChange={setSplit} options={[{ value: "country", label: "Country" }, { value: "ib", label: "IB" }, { value: "campaign", label: "Campaign" }]} />}
                />
                <div className="mt-4 px-4 pb-5 sm:px-6">
                  {split === "country" && <DataTable columns={aggCols<Deposits["byCountry"][number]>({ key: "c", header: "Country", cell: (x) => <CountryCell code={x.country} /> })} rows={d.byCountry} pageSize={10} rowKey={(x) => x.country} exportName="deposits-by-country" />}
                  {split === "ib" && <DataTable columns={aggCols<Deposits["byIb"][number]>({ key: "ib", header: "IB", cell: (x) => (x.ib === "direct" ? <span className="text-fg-3">Direct (no IB)</span> : <Link className="hover:text-ember" href={`/clients/${x.ib}`}>{x.ibName || `Partner ${x.ib}`}</Link>) })} rows={d.byIb} pageSize={10} rowKey={(x) => x.ib} exportName="deposits-by-ib" />}
                  {split === "campaign" && <DataTable columns={aggCols<Deposits["byCampaign"][number]>({ key: "cp", header: "Campaign", cell: (x) => <span className="font-mono text-[12.5px]">{x.campaign}</span> })} rows={d.byCampaign} pageSize={10} rowKey={(x) => x.campaign} exportName="deposits-by-campaign" />}
                </div>
              </Card>
            </Reveal>
            <Reveal delay={0.1} className="mt-4">
              <Card>
                <CardHeader title="First-time deposits" subtitle={`${d.ftdList.length} in the period`} icon={<TrendingUp />} />
                <div className="mt-4 px-4 pb-5 sm:px-6">
                  <DataTable
                    columns={[
                      { key: "n", header: "Client", cell: (x) => <Link className="font-medium hover:text-ember" href={`/clients/${x.userId}`}>{x.name || `Client ${x.userId}`}</Link> },
                      { key: "c", header: "Country", cell: (x) => <CountryCell code={x.country} />, hideOn: "md" },
                      { key: "cp", header: "Campaign", cell: (x) => <span className="font-mono text-[12px] text-fg-2">{x.campaign}</span>, hideOn: "lg" },
                      { key: "at", header: "Date", sort: (x) => x.at, cell: (x) => <span className="k-num text-fg-2">{new Date(x.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span> },
                      { key: "a", header: "Amount", align: "right", sort: (x) => x.amount, cell: (x) => <Money value={x.amount} countUp={false} className="font-semibold" /> },
                    ]}
                    rows={[...d.ftdList].sort((a, b) => b.at.localeCompare(a.at))}
                    pageSize={8}
                    rowKey={(x) => String(x.userId)}
                    exportName="ftds"
                    empty={<div className="py-8 text-center text-[13px] text-fg-3">No first-time deposits in this period.</div>}
                  />
                </div>
              </Card>
            </Reveal>
          </>
        );
      }}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Funnel                                                              */
/* ------------------------------------------------------------------ */

type StageKey = "registered" | "emailVerified" | "kycVerified" | "liveAccount" | "funded" | "traded";
type StageRow = Record<StageKey, number> & { conversion: number };
type Funnel = {
  stages: { key: StageKey; count: number; pct: number }[];
  medianDaysToFtd: number | null;
  byCampaign: (StageRow & { campaign: string })[];
  byCountry: (StageRow & { country: string })[];
  daily: (StageRow & { date: string })[];
};
const STAGE_LABEL: Record<StageKey, string> = { registered: "Signed up", emailVerified: "Email verified", kycVerified: "KYC verified", liveAccount: "Live account", funded: "First deposit", traded: "Traded" };

function stageCols<T extends StageRow>(first: Column<T>): Column<T>[] {
  return [
    first,
    ...(["registered", "kycVerified", "funded", "traded"] as const).map((k) => ({ key: k, header: STAGE_LABEL[k], align: "right" as const, sort: (r: T) => r[k], cell: (r: T) => <span className="k-num">{formatNumber(r[k], 0)}</span> })),
    { key: "conv", header: "Sign-up → FTD", align: "right", sort: (r) => r.conversion, cell: (r) => <Chip size="sm" tone={r.conversion >= 20 ? "up" : r.conversion > 0 ? "gold" : "neutral"}>{r.conversion.toFixed(1)}%</Chip> },
  ];
}

export function LiveFunnel() {
  const [period, setPeriod] = React.useState<Period>("30D");
  const r = periodRange(period);
  const state = useReport<Funnel>(`funnel?from=${r.from}&to=${r.to}`);
  const [split, setSplit] = React.useState<"campaign" | "country">("campaign");
  return (
    <Shell title="Acquisition funnel" subtitle="Clients who signed up in the period: sign-up → email → KYC → live account → first deposit → first trade" report="funnel" name="Funnel" period={period} setPeriod={setPeriod} state={state}>
      {(d) => {
        const top = d.stages[0]?.count ?? 0;
        const get = (k: StageKey) => d.stages.find((s) => s.key === k)?.count ?? 0;
        return (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Sign-ups" icon={<UserPlus />} value={<span className="k-num">{formatNumber(top, 0)}</span>} chip={`${period}`} chipTone="neutral" />
              <KpiCard label="First deposits" icon={<TrendingUp />} value={<span className="k-num">{formatNumber(get("funded"), 0)}</span>} chip={top ? `${((get("funded") / top) * 100).toFixed(1)}% of sign-ups` : "—"} chipTone="up" delay={0.05} />
              <KpiCard label="KYC verified" icon={<ShieldCheck />} value={<span className="k-num">{formatNumber(get("kycVerified"), 0)}</span>} chip={top ? `${((get("kycVerified") / top) * 100).toFixed(1)}%` : "—"} chipTone="neutral" delay={0.1} />
              <KpiCard label="Time to first deposit" icon={<Clock />} value={<span className="k-num">{d.medianDaysToFtd === null ? "—" : d.medianDaysToFtd < 1 ? `${Math.round(d.medianDaysToFtd * 24)}h` : `${d.medianDaysToFtd.toFixed(1)}d`}</span>} chip="Median from sign-up" chipTone="gold" delay={0.15} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
              <Reveal delay={0.05} className="xl:col-span-7">
                <Card className="h-full">
                  <CardHeader title="Conversion funnel" subtitle="Share of sign-ups reaching each stage · step conversion on the right" icon={<Filter />} />
                  <div className="space-y-3 px-4 pb-6 pt-5 sm:px-6">
                    {d.stages.map((s, i) => {
                      const prev = i > 0 ? d.stages[i - 1]!.count : s.count;
                      return (
                        <div key={s.key}>
                          <div className="mb-1.5 flex items-center justify-between text-[13px]">
                            <span className="font-medium">{STAGE_LABEL[s.key]}</span>
                            <span className="k-num text-fg-2">
                              {formatNumber(s.count, 0)} <span className="text-fg-3">· {s.pct.toFixed(1)}%</span>
                              {i > 0 && <span className="ml-2 text-[11.5px] text-fg-3">step {prev ? ((s.count / prev) * 100).toFixed(0) : 0}%</span>}
                            </span>
                          </div>
                          <div className="h-7 overflow-hidden rounded-[10px] bg-surface-2">
                            <div className="h-full rounded-[10px]" style={{ width: `${Math.max(top ? (s.count / top) * 100 : 0, s.count ? 1.5 : 0)}%`, background: `color-mix(in oklab, var(--k-ember) ${100 - i * 12}%, var(--k-gold))` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </Reveal>
              <Reveal delay={0.1} className="xl:col-span-5">
                <Card className="h-full">
                  <CardHeader title="Daily sign-ups vs first deposits" subtitle="By sign-up day · server time" icon={<UserPlus />} />
                  <div className="px-4 pb-5 pt-4 sm:px-6">
                    <LineChart
                      labels={d.daily.map((x) => dayLabel(x.date))}
                      height={260}
                      format={(v) => formatNumber(v, 0)}
                      series={[
                        { key: "s", label: "Sign-ups", color: "var(--k-gold)", values: d.daily.map((x) => x.registered), area: true },
                        { key: "f", label: "Funded", color: "var(--k-ember)", values: d.daily.map((x) => x.funded) },
                      ]}
                    />
                  </div>
                </Card>
              </Reveal>
            </div>
            <Reveal delay={0.1} className="mt-4">
              <Card>
                <CardHeader title={split === "campaign" ? "By acquisition source" : "By country"} subtitle="IB campaign attribution from the partner link; direct = no referral" icon={split === "campaign" ? <Megaphone /> : <Globe2 />} action={<Segmented size="xs" value={split} onChange={setSplit} options={[{ value: "campaign", label: "Source" }, { value: "country", label: "Country" }]} />} />
                <div className="mt-4 px-4 pb-5 sm:px-6">
                  {split === "campaign" ? (
                    <DataTable columns={stageCols<Funnel["byCampaign"][number]>({ key: "c", header: "Source", cell: (x) => <span className="font-mono text-[12.5px]">{x.campaign}</span> })} rows={d.byCampaign} pageSize={10} rowKey={(x) => x.campaign} exportName="funnel-by-source" />
                  ) : (
                    <DataTable columns={stageCols<Funnel["byCountry"][number]>({ key: "c", header: "Country", cell: (x) => <CountryCell code={x.country} /> })} rows={d.byCountry} pageSize={10} rowKey={(x) => x.country} exportName="funnel-by-country" />
                  )}
                </div>
              </Card>
            </Reveal>
          </>
        );
      }}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Cohorts & LTV                                                       */
/* ------------------------------------------------------------------ */

type Cohorts = {
  months: number;
  cohorts: { cohort: string; clients: number; funded: number; retention: number[]; ltv: { month: number; revenue: number; netDeposits: number; revenuePerClient: number }[] }[];
  totals: { clients: number; revenue: number; netDeposits: number; ltvRevenue: number; ltvNetDeposits: number };
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthName = (k: string) => `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;

export function LiveCohorts() {
  const [months, setMonths] = React.useState<"6" | "12">("12");
  const [mode, setMode] = React.useState<"retention" | "ltv">("retention");
  const state = useReport<Cohorts>(`cohorts?months=${months}`);
  const r = periodRange("1Y");
  return (
    <div className="pb-16">
      <PageHeader
        title="Cohorts & LTV"
        subtitle="Monthly sign-up cohorts · retention = share with a live trade in the month · LTV = cumulative broker revenue per client"
        actions={
          <>
            <Segmented value={months} onChange={setMonths} options={[{ value: "6", label: "6 months" }, { value: "12", label: "12 months" }]} />
            <ExportMenu report="cohorts" name="Cohorts" from={r.from} to={r.to} />
          </>
        }
      />
      {state.loading && !state.data ? <ReportLoading /> : state.error && !state.data ? <ReportFailed message={state.error} onRetry={state.reload} /> : state.data ? (() => {
        const d = state.data;
        const hm = d.cohorts.map((c) => ({ month: monthName(c.cohort), key: c.cohort, ftds: Math.max(c.clients, 0), cac: 0, retention: c.retention, ltv: c.ltv.map((l) => l.revenuePerClient) }));
        const withClients = hm.filter((c) => c.ftds > 0);
        const m3 = d.cohorts.filter((c) => c.retention.length > 3 && c.clients > 0);
        const avgM3 = m3.length ? m3.reduce((a, c) => a + c.retention[3]! * c.clients, 0) / m3.reduce((a, c) => a + c.clients, 0) : null;
        const maxLen = Math.max(0, ...d.cohorts.map((c) => c.ltv.length));
        return (
          <div className={cn("transition-opacity", state.loading && "opacity-60")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="LTV (revenue / client)" icon={<Wallet />} value={<Money value={d.totals.ltvRevenue} decimals={2} />} chip={`${formatNumber(d.totals.clients, 0)} clients in cohorts`} chipTone="gold" />
              <KpiCard label="Net deposits / client" icon={<Coins />} value={<Money value={d.totals.ltvNetDeposits} decimals={2} />} chip="Deposits − withdrawals" chipTone="neutral" delay={0.05} />
              <KpiCard label="Broker revenue" icon={<Scale />} value={<Money value={d.totals.revenue} decimals={0} tone="auto" />} chip="From cohort clients" chipTone="neutral" delay={0.1} />
              <KpiCard label="M3 retention" icon={<Users />} value={<span className="k-num">{avgM3 === null ? "—" : `${avgM3.toFixed(1)}%`}</span>} chip="Traded in month 3" chipTone="ember" delay={0.15} />
            </div>
            <Reveal delay={0.05} className="mt-4">
              <Card>
                <CardHeader
                  title="Cohort retention"
                  subtitle={mode === "retention" ? "Share of each sign-up cohort trading N months later" : "Cumulative broker revenue per client, N months after sign-up"}
                  icon={<Layers />}
                  action={<Segmented size="xs" value={mode} onChange={setMode} options={[{ value: "retention", label: "Retention" }, { value: "ltv", label: "LTV" }]} />}
                />
                <div className="px-4 pb-5 pt-4 sm:px-6">
                  {withClients.length ? <CohortHeatmap cohorts={withClients} mode={mode} /> : <div className="py-8 text-center text-[13px] text-fg-3">No sign-ups in these months yet.</div>}
                </div>
              </Card>
            </Reveal>
            {maxLen > 1 && withClients.length > 0 && (
              <Reveal delay={0.1} className="mt-4">
                <Card>
                  <CardHeader title="LTV curves" subtitle="Cumulative revenue per client by cohort" icon={<TrendingUp />} />
                  <div className="px-4 pb-5 pt-4 sm:px-6">
                    <LineChart
                      labels={Array.from({ length: maxLen }, (_, i) => `M${i}`)}
                      height={280}
                      format={(v) => `$${v.toFixed(2)}`}
                      minZero={false}
                      series={d.cohorts
                        .filter((c) => c.clients > 0)
                        .slice(-6)
                        .map((c, i, arr) => ({ key: c.cohort, label: monthName(c.cohort), color: `color-mix(in oklab, var(--k-ember) ${Math.round(((i + 1) / arr.length) * 100)}%, var(--k-gold))`, values: Array.from({ length: maxLen }, (_, m) => c.ltv[m]?.revenuePerClient ?? null) }))}
                    />
                  </div>
                </Card>
              </Reveal>
            )}
          </div>
        );
      })() : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Accounts & activity                                                 */
/* ------------------------------------------------------------------ */

type ActivityR = {
  totals: { live: number; demo: number; funded: number; withPositions: number; activeLive: number; liveEquity: number };
  daily: { date: string; liveOpened: number; demoOpened: number; activeLive: number; activeDemo: number; trades: number; lots: number }[];
  byGroup: { group: string; accounts: number; funded: number; equity: number }[];
  topAccounts: { login: number; userId: number; type: string; group: string; trades: number; lots: number; lastTrade: string }[];
};

export function LiveActivity() {
  const [period, setPeriod] = React.useState<Period>("30D");
  const r = periodRange(period);
  const state = useReport<ActivityR>(`activity?from=${r.from}&to=${r.to}`);
  return (
    <Shell title="Accounts & activity" subtitle="Accounts opened, active traders, trades and volume · live and demo · server time" report="activity" name="Activity" period={period} setPeriod={setPeriod} state={state}>
      {(d) => {
        const t = d.totals;
        const maxEq = Math.max(1, ...d.byGroup.map((g) => g.equity));
        return (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Live accounts" icon={<Users />} value={<span className="k-num">{formatNumber(t.live, 0)}</span>} chip={`${formatNumber(t.funded, 0)} funded`} chipTone="ember" href="/trading/accounts" />
              <KpiCard label="Active live accounts" icon={<Activity />} value={<span className="k-num">{formatNumber(t.activeLive, 0)}</span>} chip={`Traded in ${period}`} chipTone="up" delay={0.05} />
              <KpiCard label="Live equity" icon={<Wallet />} value={<Money value={t.liveEquity} decimals={0} />} chip={`${formatNumber(t.withPositions, 0)} with open positions`} chipTone="neutral" delay={0.1} />
              <KpiCard label="Demo accounts" icon={<Layers />} value={<span className="k-num">{formatNumber(t.demo, 0)}</span>} chip="All time" chipTone="neutral" delay={0.15} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
              <Reveal delay={0.05} className="xl:col-span-8">
                <Card className="h-full">
                  <CardHeader title="Daily activity" subtitle="Accounts opened (bars) · active live accounts (line)" icon={<BarChart3 />} />
                  <div className="px-4 pb-5 pt-5 sm:px-6">
                    <StackedBars
                      data={d.daily.map((x) => ({ label: dayLabel(x.date), title: `${weekday(x.date)}, ${dayLabel(x.date, true)} · ${x.trades} trades · ${x.lots.toFixed(2)} lots`, values: { live: x.liveOpened, demo: x.demoOpened } }))}
                      series={[
                        { key: "live", label: "Live opened", color: "var(--k-ember)" },
                        { key: "demo", label: "Demo opened", color: "var(--k-gold)" },
                      ]}
                      height={280}
                      format={(v) => formatNumber(v, 0)}
                      line={{ key: "active", label: "Active live", color: "var(--k-fg)", values: d.daily.map((x) => x.activeLive) }}
                    />
                  </div>
                </Card>
              </Reveal>
              <Reveal delay={0.1} className="xl:col-span-4">
                <Card className="h-full">
                  <CardHeader title="Live accounts by group" subtitle="Accounts, funded and equity (USD)" icon={<Layers />} />
                  <div className="space-y-2.5 px-4 pb-5 pt-4 sm:px-6">
                    {d.byGroup.map((g, i) => (
                      <div key={g.group} className="k-row px-4 py-3">
                        <div className="flex items-center justify-between text-[13px]">
                          <Chip size="sm" tone={i === 0 ? "ember" : "neutral"}>{g.group}</Chip>
                          <Money value={g.equity} decimals={0} countUp={false} className="font-semibold" />
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <Meter value={g.equity} max={maxEq} tone="ember" delay={i * 0.05} />
                          <span className="k-num shrink-0 text-[11.5px] text-fg-3">{g.funded}/{g.accounts}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </Reveal>
            </div>
            <Reveal delay={0.1} className="mt-4">
              <Card>
                <CardHeader title="Most active accounts" subtitle={`By lots opened · ${period}`} icon={<Trophy />} />
                <div className="mt-4 px-4 pb-5 sm:px-6">
                  <DataTable
                    columns={[
                      { key: "l", header: "Account", cell: (x) => <Link className="font-mono font-medium hover:text-ember" href={`/trading/accounts/${x.login}`}>#{x.login}</Link> },
                      { key: "t", header: "Type", cell: (x) => <Chip size="sm" tone={x.type === "live" ? "ember" : "gold"}>{x.type.toUpperCase()}</Chip> },
                      { key: "g", header: "Group", cell: (x) => <span className="text-fg-2">{x.group}</span>, hideOn: "md" },
                      { key: "n", header: "Trades", align: "right", sort: (x) => x.trades, cell: (x) => <span className="k-num">{x.trades}</span> },
                      { key: "lots", header: "Lots", align: "right", sort: (x) => x.lots, cell: (x) => <span className="k-num">{x.lots.toFixed(2)}</span> },
                      { key: "last", header: "Last trade", align: "right", sort: (x) => x.lastTrade, cell: (x) => <span className="k-num text-fg-2">{new Date(x.lastTrade).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>, hideOn: "lg" },
                    ]}
                    rows={d.topAccounts}
                    pageSize={10}
                    rowKey={(x) => String(x.login)}
                    exportName="active-accounts"
                    empty={<div className="py-8 text-center text-[13px] text-fg-3">No trading in this period.</div>}
                  />
                </div>
              </Card>
            </Reveal>
          </>
        );
      }}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Partners (IB / PAMM / copy / prop)                                  */
/* ------------------------------------------------------------------ */

type Partners = {
  ib: {
    byKind: { kind: string; status: string; lines: number; amount: number; lots: number }[];
    topIbs: { userId: number; name: string | null; country: string | null; clients: number; amount: number; lots: number }[];
    referredSignups: number;
    overview: { kpis?: Record<string, number> } | null;
  };
  social: { overview: { masters?: Record<string, number>; subscriptions?: Record<string, number>; funds?: Record<string, number>; aum?: number; feesPending?: { count: number; amount: number } } | null; feeTotals: Record<string, number> | null };
  prop: Record<string, number> | null;
};

export function LivePartners() {
  const [period, setPeriod] = React.useState<Period>("30D");
  const r = periodRange(period);
  const state = useReport<Partners>(`partners?from=${r.from}&to=${r.to}`);
  return (
    <Shell title="Partner reports" subtitle="IB commission cost, top partners, copy trading / PAMM and prop programme summaries" report="partners" name="Partners" period={period} setPeriod={setPeriod} state={state}>
      {(d) => {
        const kinds = new Map<string, number>();
        for (const k of d.ib.byKind) if (k.status !== "rejected" && k.status !== "void") kinds.set(k.kind, (kinds.get(k.kind) ?? 0) + k.amount);
        const ibCost = [...kinds.values()].reduce((a, b) => a + b, 0);
        const so = d.social.overview;
        const pr = d.prop;
        const kpi = d.ib.overview?.kpis ?? {};
        return (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="IB commission cost" icon={<Handshake />} value={<Money value={ibCost} decimals={0} />} chip={`${formatNumber(d.ib.topIbs.length, 0)} earning IBs`} chipTone="ember" href="/partners/commissions" />
              <KpiCard label="Referred sign-ups" icon={<UserPlus />} value={<span className="k-num">{formatNumber(d.ib.referredSignups, 0)}</span>} chip={`${formatNumber(kpi.members ?? 0, 0)} partners`} chipTone="neutral" delay={0.05} />
              <KpiCard label="Copy / PAMM AUM" icon={<Wallet />} value={<Money value={so?.aum ?? 0} decimals={0} />} chip={`${so?.subscriptions?.active ?? 0} active copiers · ${so?.funds?.active ?? 0} funds`} chipTone="gold" href="/social" delay={0.1} />
              <KpiCard label="Prop fees (30 days)" icon={<Trophy />} value={<Money value={pr?.fees30d ?? 0} decimals={0} />} chip={`${pr?.activeChallenges ?? 0} active · ${pr?.funded ?? 0} funded`} chipTone="up" href="/prop" delay={0.15} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
              <Reveal delay={0.05} className="xl:col-span-5">
                <Card className="h-full">
                  <CardHeader title="IB cost by kind" subtitle={`${period} · excludes rejected and void lines`} icon={<Coins />} />
                  <div className="space-y-2.5 px-4 pb-5 pt-4 sm:px-6">
                    {kinds.size === 0 && <div className="py-4 text-[13px] text-fg-3">No IB commission in this period.</div>}
                    {[...kinds.entries()].sort((a, b) => b[1] - a[1]).map(([k, v], i) => (
                      <div key={k} className="k-row px-4 py-3">
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="font-medium capitalize">{k}</span>
                          <Money value={v} countUp={false} className="font-semibold" />
                        </div>
                        <Meter className="mt-2" value={Math.abs(v)} max={Math.max(...[...kinds.values()].map(Math.abs), 1)} tone={v >= 0 ? "ember" : "down"} delay={i * 0.05} />
                      </div>
                    ))}
                  </div>
                </Card>
              </Reveal>
              <Reveal delay={0.1} className="xl:col-span-7">
                <Card className="h-full">
                  <CardHeader title="Copy trading, PAMM and prop" subtitle="Current programme state" icon={<BarChart3 />} />
                  <div className="grid grid-cols-2 gap-3 px-4 pb-5 pt-4 sm:grid-cols-3 sm:px-6">
                    <MiniStat label="Approved masters" value={formatNumber(so?.masters?.approved ?? 0, 0)} sub={`${so?.masters?.pending ?? 0} pending`} />
                    <MiniStat label="Copy subscriptions" value={formatNumber(so?.subscriptions?.active ?? 0, 0)} sub={`${so?.subscriptions?.stopped ?? 0} stopped`} />
                    <MiniStat label="Performance fees pending" value={<Money value={so?.feesPending?.amount ?? 0} countUp={false} />} sub={`${so?.feesPending?.count ?? 0} fees`} />
                    <MiniStat label="Prop pass rate" value={pr?.passRate !== undefined ? `${Number(pr.passRate).toFixed(1)}%` : "—"} sub={`${pr?.failed ?? 0} failed`} />
                    <MiniStat label="Prop payouts (30 days)" value={<Money value={pr?.paid30d ?? 0} countUp={false} />} sub={`${pr?.payoutsPending ?? 0} pending`} />
                    <MiniStat label="Funded capital" value={<Money value={pr?.fundedCapital ?? 0} decimals={0} countUp={false} />} sub="Prop funded accounts" />
                  </div>
                </Card>
              </Reveal>
            </div>
            <Reveal delay={0.1} className="mt-4">
              <Card>
                <CardHeader title="IB leaderboard" subtitle={`By commission earned · ${period}`} icon={<Trophy />} />
                <div className="mt-4 px-4 pb-5 sm:px-6">
                  <DataTable
                    columns={[
                      { key: "n", header: "Partner", cell: (x) => <Link className="font-medium hover:text-ember" href={`/partners/list?partner=${x.userId}`}>{x.name || `Partner ${x.userId}`}</Link> },
                      { key: "c", header: "Country", cell: (x) => <CountryCell code={x.country ?? ""} />, hideOn: "md" },
                      { key: "cl", header: "Clients", align: "right", sort: (x) => x.clients, cell: (x) => <span className="k-num">{x.clients}</span> },
                      { key: "lots", header: "Lots", align: "right", sort: (x) => x.lots, cell: (x) => <span className="k-num">{x.lots.toFixed(2)}</span> },
                      { key: "a", header: "Commission", align: "right", sort: (x) => x.amount, cell: (x) => <Money value={x.amount} countUp={false} className="font-semibold" /> },
                    ]}
                    rows={d.ib.topIbs}
                    pageSize={10}
                    rowKey={(x) => String(x.userId)}
                    exportName="ib-leaderboard"
                    empty={<div className="py-8 text-center text-[13px] text-fg-3">No IB commission in this period.</div>}
                  />
                </div>
              </Card>
            </Reveal>
          </>
        );
      }}
    </Shell>
  );
}


