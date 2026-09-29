"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, BarChart3, FileText, Layers, PieChart, Users, Copy as CopyIcon, Handshake, FlaskConical } from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  DataTable,
  Delta,
  Donut,
  DivergingBar,
  EquityChart,
  Icon3D,
  Money,
  PageHeader,
  Progress,
  Reveal,
  Segmented,
  Starfield,
  SymbolAvatar,
  CHART_COLORS,
  cn,
  formatCompact,
  formatMoney,
  type Column,
  type SeriesPoint,
} from "@kalks/ui";
import { accountUsd, equitySeries } from "@kalks/mock";
import {
  ASSET_ALLOCATION,
  COPY_SUBSCRIPTIONS,
  DEMO_ACCOUNTS,
  EXPOSURE,
  IB_EARNINGS,
  LIVE_ACCOUNTS,
  PAMM_INVESTMENTS,
  PORTFOLIO_TOTALS as T,
} from "@kalks/mock/portfolio-extra";
import { IS_DEMO as DEMO_BUILD } from "@kalks/mock/mode";
import { LivePortfolio } from "@/components/trading/portfolio";
import { TERMINAL_URL } from "@/lib/live";

const SOURCES = [
  { key: "live", label: "Live accounts", value: T.live, color: CHART_COLORS[0]!, icon: "bar_chart", href: "/accounts", sub: `${LIVE_ACCOUNTS.length} accounts` },
  { key: "pamm", label: "PAMM investments", value: T.pamm, color: CHART_COLORS[1]!, icon: "bank", href: "/social/pamm", sub: `${PAMM_INVESTMENTS.length} funds` },
  { key: "copy", label: "Copy trading", value: T.copy, color: CHART_COLORS[2]!, icon: "rocket", href: "/social/copy", sub: `${COPY_SUBSCRIPTIONS.length} masters` },
  { key: "ib", label: "IB earnings", value: T.ib, color: CHART_COLORS[3]!, icon: "money_bag", href: "/partner", sub: "available + pending" },
];

/* ------------------------------------------------------------------ */

function NetWorthHero() {
  return (
    <Card hot className="relative h-full overflow-hidden">
      <Starfield density={50} />
      <div className="relative px-6 pb-6 pt-6">
        <div className="flex items-center gap-2">
          <span className="k-label">Net worth · all sources</span>
          <Chip size="sm" tone="ember" dot>
            Live
          </Chip>
        </div>
        <Money value={T.total} className="mt-3 block text-[40px] font-semibold leading-none tracking-[-0.03em] sm:text-[52px]" />
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]">
          <Chip tone="up">
            +{formatMoney(T.changeToday)} ({T.changeTodayPct}%) today
          </Chip>
          <Chip tone="neutral">
            <span className="text-up">+{formatMoney(T.changeMonth)}</span> this month
          </Chip>
          <span className="text-fg-3">Valued in USD · cent accounts converted</span>
        </div>

        <div className="mt-6 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
          {SOURCES.map((s, i) => (
            <span key={s.key} className={cn("h-full", i > 0 && "border-l-2 border-bg")} style={{ width: `${(s.value / T.total) * 100}%`, background: s.color }} />
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {SOURCES.map((s) => (
            <Link key={s.key} href={s.href} className="k-row group relative overflow-hidden px-4 py-3.5 transition-colors hover:bg-surface-3/70">
              <div className="flex items-center gap-2 text-[11.5px] text-fg-3">
                <span className="size-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </div>
              <Money value={s.value} className="mt-1.5 block text-[18px] font-semibold" />
              <div className="mt-0.5 flex items-center justify-between text-[11px] text-fg-3">
                <span>{s.sub}</span>
                <span className="k-num">{((s.value / T.total) * 100).toFixed(1)}%</span>
              </div>
              <ArrowUpRight className="absolute right-3 top-3 size-3.5 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </div>
    </Card>
  );
}

function AllocationCard() {
  const [by, setBy] = React.useState<"source" | "asset">("source");
  const data =
    by === "source"
      ? SOURCES.map((s) => ({ label: s.label, value: s.value, color: s.color }))
      : ASSET_ALLOCATION.map((a, i) => ({ label: a.label, value: a.value * T.total, color: i === ASSET_ALLOCATION.length - 1 ? "#63636e" : CHART_COLORS[i]! }));
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Allocation" subtitle="Share of net worth" action={<Segmented size="xs" value={by} onChange={setBy} options={[{ value: "source", label: "By source" }, { value: "asset", label: "By asset class" }]} />} />
      <div className="flex flex-1 flex-col items-center gap-6 px-6 pb-6 pt-5 sm:flex-row">
        <Donut
          key={by}
          data={data}
          size={188}
          thickness={20}
          center={
            <div>
              <div className="text-[11px] uppercase tracking-wider text-fg-3">{by === "source" ? "Sources" : "Classes"}</div>
              <div className="k-num mt-1 text-[22px] font-semibold">{data.length}</div>
              <div className="k-num text-[11px] text-fg-3">${formatCompact(T.total)}</div>
            </div>
          }
        />
        <div className="w-full min-w-0 flex-1 space-y-1.5">
          {data.map((d) => (
            <div key={d.label} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-[13px] hover:bg-surface-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="min-w-0 flex-1 truncate text-fg-2">{d.label}</span>
              <span className="k-num text-fg-3">{formatMoney(d.value, "USD", 0)}</span>
              <span className="k-num w-12 text-right font-medium">{((d.value / T.total) * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

const RANGES = ["1M", "3M", "6M", "YTD", "1Y", "ALL"] as const;
const RANGE_DAYS: Record<(typeof RANGES)[number], number> = { "1M": 30, "3M": 90, "6M": 180, YTD: 267, "1Y": 365, ALL: 720 };

function EquityCard() {
  const [mode, setMode] = React.useState<"live" | "demo">("live");
  const [range, setRange] = React.useState<(typeof RANGES)[number]>("6M");
  const liveAll = React.useMemo(() => equitySeries(720, T.total, 31), []);
  const demoAll = React.useMemo(() => equitySeries(36, T.demo, 44), []);
  const all = mode === "live" ? liveAll : demoAll;
  const data = React.useMemo(() => all.slice(-RANGE_DAYS[range]), [all, range]);
  const [hover, setHover] = React.useState<SeriesPoint | null>(null);
  const onHover = React.useCallback((p: SeriesPoint | null) => setHover(p), []);
  const first = data[0]!.value;
  const last = data[data.length - 1]!.value;
  const shown = hover?.value ?? last;
  const diff = shown - first;
  return (
    <Card className="h-full">
      <div className="flex flex-col gap-4 px-6 pt-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="k-label flex items-center gap-2">
            Combined equity
            {mode === "demo" && (
              <Chip size="sm" tone="gold">
                DEMO · not in net worth
              </Chip>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <Money value={shown} countUp={!hover} className="text-[30px] font-semibold tracking-tight" />
            <Chip tone={diff >= 0 ? "up" : "down"}>
              {diff >= 0 ? "+" : "-"}
              {formatMoney(Math.abs(diff))} ({((diff / first) * 100).toFixed(2)}%)
            </Chip>
          </div>
          <div className="mt-1 text-xs text-fg-3">
            {hover ? new Date(hover.time * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : mode === "live" ? `Live + PAMM + copy + IB · change over ${range}` : `${DEMO_ACCOUNTS.length} demo accounts · since opening`}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented size="xs" value={mode} onChange={setMode} options={[{ value: "live", label: "Live" }, { value: "demo", label: "Demo" }]} />
          <Segmented size="xs" value={range} onChange={setRange} options={RANGES} />
        </div>
      </div>
      <div className="px-3 pb-4 pt-2">
        <EquityChart data={data} height={300} onHover={onHover} color={mode === "live" ? "gold" : "ember"} />
      </div>
    </Card>
  );
}

function ExposureCard() {
  const rows = EXPOSURE.map((e) => ({ ...e, net: e.long - e.short })).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  const max = Math.max(...rows.map((r) => Math.abs(r.net)));
  const gross = rows.reduce((s, r) => s + r.long + r.short, 0);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Exposure by symbol" subtitle={`Gross $${formatCompact(gross)} notional · net long/short`} action={<Chip tone="up">Net long</Chip>} />
      <div className="mt-2 flex items-center justify-between px-6 text-[10.5px] uppercase tracking-wider text-fg-3">
        <span>◂ Short</span>
        <span>Long ▸</span>
      </div>
      <div className="mt-2 flex-1 space-y-1 px-4 pb-5 sm:px-6">
        {rows.map((r) => (
          <Link key={r.symbol} target="_blank" rel="noopener" href={`${TERMINAL_URL}/?symbol=${r.symbol}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2">
            <SymbolAvatar symbol={r.symbol} size={22} />
            <span className="w-16 shrink-0 text-[13px] font-medium">{r.symbol}</span>
            <DivergingBar value={r.net} max={max} className="flex-1" />
            <span className={cn("k-num w-16 shrink-0 text-right text-[12.5px] font-medium", r.net >= 0 ? "text-up" : "text-down")}>
              {r.net >= 0 ? "+" : "-"}${formatCompact(Math.abs(r.net))}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

type Row = {
  id: string;
  kind: "live" | "pamm" | "copy" | "ib";
  name: React.ReactNode;
  sub: string;
  base: number;
  value: number;
  pnl: number;
  month: number;
  href: string;
};

const ROWS: Row[] = [
  ...LIVE_ACCOUNTS.map<Row>((a) => ({
    id: a.login,
    kind: "live",
    name: a.nickname ?? `${a.group} account`,
    sub: `${a.group} · ${a.mode === "hedging" ? "Hedging" : "Netting"} · 1:${a.leverage}${a.cent ? " · USC" : ""}`,
    base: accountUsd(a, "balance"),
    value: accountUsd(a, "equity"),
    pnl: accountUsd(a, "equity") - accountUsd(a, "balance"),
    month: a.login === "80412337" ? 8.42 : a.login === "80412512" ? -1.37 : 4.06,
    href: "/accounts",
  })),
  ...PAMM_INVESTMENTS.map<Row>((p) => ({ id: p.id, kind: "pamm", name: p.fund, sub: `Manager ${p.manager.name} · ${p.sharePct}% share`, base: p.invested, value: p.value, pnl: p.value - p.invested, month: p.monthPct, href: "/social/pamm" })),
  ...COPY_SUBSCRIPTIONS.map<Row>((c) => ({ id: c.id, kind: "copy", name: c.strategy, sub: `Copying ${c.master.name} · ${c.feePct}% perf. fee`, base: c.allocated, value: c.equity, pnl: c.equity - c.allocated, month: c.monthPct, href: "/social/copy" })),
  { id: "IB-ARJUN24", kind: "ib", name: "Partner wallet", sub: "Silver Partner · daily payouts 00:05", base: IB_EARNINGS.available, value: T.ib, pnl: IB_EARNINGS.pending, month: 14.2, href: "/partner" },
];

const KIND: Record<Row["kind"], { label: string; tone: "ember" | "gold" | "up" | "info"; icon: React.ReactNode }> = {
  live: { label: "Live", tone: "ember", icon: <Layers /> },
  pamm: { label: "PAMM", tone: "gold", icon: <Users /> },
  copy: { label: "Copy", tone: "up", icon: <CopyIcon /> },
  ib: { label: "IB", tone: "info", icon: <Handshake /> },
};

function BreakdownCard() {
  const [filter, setFilter] = React.useState<"all" | Row["kind"]>("all");
  const rows = filter === "all" ? ROWS : ROWS.filter((r) => r.kind === filter);
  const cols: Column<Row>[] = [
    {
      key: "name",
      header: "Source",
      cell: (r) => (
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-2 [&_svg]:size-4">{KIND[r.kind].icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{r.name}</span>
              <Chip size="sm" tone={KIND[r.kind].tone}>
                {KIND[r.kind].label}
              </Chip>
            </div>
            <div className="truncate text-[11.5px] text-fg-3">
              <span className="font-mono text-fg-2">{r.id}</span> · {r.sub}
            </div>
          </div>
        </div>
      ),
      sort: (r) => r.kind,
    },
    { key: "base", header: "Balance / invested", align: "right", hideOn: "md", cell: (r) => <Money value={r.base} countUp={false} className="text-fg-2" />, sort: (r) => r.base },
    { key: "value", header: "Equity / value", align: "right", cell: (r) => <Money value={r.value} countUp={false} className="font-medium" />, sort: (r) => r.value },
    { key: "pnl", header: "Floating / P&L", align: "right", cell: (r) => <Money value={r.pnl} countUp={false} signed tone="auto" />, sort: (r) => r.pnl },
    { key: "month", header: "30D", align: "right", hideOn: "sm", cell: (r) => <Delta value={r.month} />, sort: (r) => r.month },
    {
      key: "share",
      header: "Share",
      width: "150px",
      hideOn: "lg",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Progress value={(r.value / T.total) * 100 * 2} tone={r.kind === "live" ? "ember" : r.kind === "pamm" ? "gold" : r.kind === "copy" ? "up" : "warn"} className="flex-1" />
          <span className="k-num w-11 text-right text-[12px] text-fg-2">{((r.value / T.total) * 100).toFixed(1)}%</span>
        </div>
      ),
      sort: (r) => r.value,
    },
    {
      key: "go",
      header: "",
      align: "right",
      width: "48px",
      cell: (r) => (
        <Link href={r.href} className="inline-grid size-8 place-items-center rounded-full border border-line text-fg-3 hover:bg-surface-3 hover:text-fg" aria-label="Open">
          <ArrowUpRight className="size-3.5" />
        </Link>
      ),
    },
  ];
  return (
    <Card>
      <CardHeader title="Breakdown by account" subtitle="Every source that makes up your net worth" />
      <div className="px-4 pb-5 pt-4 sm:px-6">
        <DataTable
          columns={cols}
          rows={rows}
          rowKey={(r) => r.id}
          exportName="kalks-portfolio-breakdown"
          toolbar={
            <Segmented
              size="xs"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "live", label: "Live" },
                { value: "pamm", label: "PAMM" },
                { value: "copy", label: "Copy" },
                { value: "ib", label: "IB" },
              ]}
            />
          }
        />
        <div className="mt-4 flex flex-col gap-3 rounded-[14px] border border-dashed border-gold/30 bg-gold-soft/40 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-[12.5px] text-fg-2">
            <FlaskConical className="size-4 text-gold" /> Demo accounts are tracked separately and excluded from net worth.
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
            {DEMO_ACCOUNTS.map((a) => (
              <span key={a.login} className="flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1 text-[12px]">
                <Chip size="sm" tone="gold">
                  DEMO
                </Chip>
                <span className="font-mono text-fg-2">{a.login}</span>
                <Money value={a.equity} countUp={false} className="font-medium" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function SourcesStrip() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <span className="k-label">PAMM funds</span>
          <Icon3D name="bank" size={34} />
        </div>
        <div className="mt-3 space-y-2">
          {PAMM_INVESTMENTS.map((p) => (
            <div key={p.id} className="k-row flex items-center gap-3 px-3 py-2.5">
              <Avatar src={p.manager.photo} name={p.manager.name} size={30} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{p.fund}</div>
                <div className="truncate text-[11px] text-fg-3">{p.manager.name}</div>
              </div>
              <div className="text-right">
                <Money value={p.value} countUp={false} className="text-[13px] font-medium" />
                <div>
                  <Delta value={p.monthPct} className="text-[11px]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <span className="k-label">Copy subscriptions</span>
          <Icon3D name="rocket" size={34} />
        </div>
        <div className="mt-3 space-y-2">
          {COPY_SUBSCRIPTIONS.slice(0, 2).map((c) => (
            <div key={c.id} className="k-row flex items-center gap-3 px-3 py-2.5">
              <Avatar src={c.master.photo} name={c.master.name} size={30} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{c.strategy}</div>
                <div className="truncate text-[11px] text-fg-3">{c.master.name}</div>
              </div>
              <div className="text-right">
                <Money value={c.equity} countUp={false} className="text-[13px] font-medium" />
                <div>
                  <Delta value={c.monthPct} className="text-[11px]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="relative overflow-hidden p-5">
        <div className="flex items-center justify-between">
          <span className="k-label">Partner earnings</span>
          <Icon3D name="money_bag" size={34} />
        </div>
        <Money value={IB_EARNINGS.lifetime} className="mt-3 block text-[26px] font-semibold" />
        <div className="text-[12px] text-fg-3">Lifetime IB commissions</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="k-row px-3 py-2">
            <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Available</div>
            <Money value={IB_EARNINGS.available} countUp={false} className="text-[13.5px] font-medium text-up" />
          </div>
          <div className="k-row px-3 py-2">
            <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Pending</div>
            <Money value={IB_EARNINGS.pending} countUp={false} className="text-[13.5px] font-medium text-warn" />
          </div>
        </div>
      </Card>
    </div>
  );
}

function DemoPortfolioPage() {
  return (
    <div className="pb-24">
      <PageHeader
        title="Portfolio"
        subtitle="Your live accounts, PAMM, copy trading and partner earnings in one view (USD)."
        actions={
          <>
            <Link href="/portfolio/statements">
              <Button variant="surface">
                <FileText /> Statements
              </Button>
            </Link>
            <Link href="/portfolio/analytics">
              <Button variant="ember" shimmer>
                <BarChart3 /> Analytics
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-7">
          <NetWorthHero />
        </Reveal>
        <Reveal delay={0.08} className="xl:col-span-5">
          <AllocationCard />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-8">
          <EquityCard />
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-4">
          <ExposureCard />
        </Reveal>
      </div>

      <Reveal delay={0.05} className="mt-4">
        <BreakdownCard />
      </Reveal>

      <Reveal delay={0.1} className="mt-4">
        <SourcesStrip />
      </Reveal>

      <Reveal delay={0.1} className="mt-4">
        <Card className="flex flex-col items-start gap-4 px-6 py-5 sm:flex-row sm:items-center">
          <span className="grid size-11 place-items-center rounded-full border border-ember/30 bg-ember-soft text-ember">
            <PieChart className="size-5" />
          </span>
          <div className="flex-1">
            <div className="text-[15px] font-medium">Want to know what's driving your returns?</div>
            <div className="text-[13px] text-fg-3">Win rate, best sessions, charges and behaviour insights are in Analytics.</div>
          </div>
          <Link href="/portfolio/analytics">
            <Button variant="surface">
              Open analytics <ArrowUpRight />
            </Button>
          </Link>
        </Card>
      </Reveal>
    </div>
  );
}

/** Live builds: real accounts from the trading engine (via /api/trading). Demo builds: mock data. */
export default function PortfolioPage() {
  return DEMO_BUILD ? <DemoPortfolioPage /> : <LivePortfolio />;
}
