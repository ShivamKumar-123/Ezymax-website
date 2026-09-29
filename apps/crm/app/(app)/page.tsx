"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  CandlestickChart,
  Check,
  ChevronRight,
  LineChart,
  Plus,
  TrendingUp,
  Wallet,
  Award,
  X,
} from "lucide-react";
import {
  AiPromptBar,
  BarcodeBars,
  Button,
  Card,
  CardHeader,
  Chip,
  Delta,
  EquityChart,
  Gauge,
  Icon3D,
  KpiCard,
  ListRow,
  MarketSessions,
  Money,
  PageHeader,
  PriceText,
  Progress,
  Reveal,
  Segmented,
  SymbolAvatar,
  Sparkline,
  Starfield,
  WorldMap,
  cn,
  formatMoney,
  useCloses,
  useFeedMode,
  useQuotes,
} from "@kalks/ui";
import {
  ACCOUNTS,
  CALENDAR,
  DASHBOARD,
  INSTRUMENTS,
  IS_DEMO,
  NEWS,
  ONBOARDING,
  POSITIONS,
  equitySeries,
  fetchCandles,
  positionProfit,
  sparkline,
  topMovers,
  type Quote,
} from "@kalks/mock";
import type { SeriesPoint } from "@kalks/ui";
import { AccountRow } from "@/components/account-row";
import { useSession } from "@/components/session";
import { LiveDashboard } from "@/components/dashboard/live-dashboard";
import { TERMINAL_URL } from "@/lib/live";
import { Trans, useFormat, useT } from "@kalks/i18n/react";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

/* ------------------------------------------------------------------ */

function OnboardingStrip() {
  const t = useT();
  const [hidden, setHidden] = React.useState(false);
  const done = ONBOARDING.filter((s) => s.done).length;
  if (hidden) return null;
  return (
    <Reveal>
      <Card hot className="mb-5 overflow-hidden">
        <Starfield density={40} />
        <div className="relative flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <Icon3D name="rocket" size={48} />
            <div>
              <div className="text-[15px] font-medium">{t("dashboard.onboarding.title")}</div>
              <div className="text-[13px] text-fg-2">{t("dashboard.onboarding.text")}</div>
            </div>
          </div>
          <ol className="flex flex-1 flex-wrap items-center gap-2 md:justify-center">
            {ONBOARDING.map((s) => (
              <li key={s.key} className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px]", s.done ? "border-up/25 bg-up-soft text-up" : "border-ember/40 bg-ember-soft text-ember")}>
                {s.done ? <Check className="size-3.5" /> : <span className="size-1.5 animate-pulse-dot rounded-full bg-ember" />}
                {s.label}
              </li>
            ))}
          </ol>
          <div className="flex items-center gap-3">
            <div className="w-28">
              <div className="mb-1 flex justify-between text-[11px] text-fg-3">
                <span>{t("dashboard.onboarding.progress")}</span>
                <span className="k-num">{Math.round((done / ONBOARDING.length) * 100)}%</span>
              </div>
              <Progress value={(done / ONBOARDING.length) * 100} />
            </div>
            <Link href="/profile/verification">
              <Button size="sm" variant="ember">
                {t("common.continue")} <ChevronRight className="rtl:-scale-x-100" />
              </Button>
            </Link>
            <button onClick={() => setHidden(true)} className="text-fg-3 hover:text-fg" aria-label={t("dashboard.onboarding.dismiss")}>
              <X className="size-4" />
            </button>
          </div>
        </div>
      </Card>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */

function AccountsCard() {
  const t = useT();
  const [tab, setTab] = React.useState<"live" | "demo">("live");
  const list = ACCOUNTS.filter((a) => a.type === tab);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={t("dashboard.accounts.myTitle")}
        action={
          <>
            <Segmented
              size="xs"
              value={tab}
              onChange={setTab}
              options={[
                { value: "live", label: <>{t("common.live")} <span className="text-fg-3">{ACCOUNTS.filter((a) => a.type === "live").length}</span></> },
                { value: "demo", label: <>{t("common.demo")} <span className="text-fg-3">{ACCOUNTS.filter((a) => a.type === "demo").length}</span></> },
              ]}
            />
            <Link href="/accounts/new">
              <Button size="sm" variant="surface">
                <Plus /> {t("dashboard.accounts.open")}
              </Button>
            </Link>
          </>
        }
      />
      <div className="relative mt-4 flex-1 space-y-3 px-4 pb-5 sm:px-6">
        {list.map((a) => (
          <AccountRowCompact key={a.login} login={a.login} />
        ))}
      </div>
    </Card>
  );
}

function AccountRowCompact({ login }: { login: string }) {
  const a = ACCOUNTS.find((x) => x.login === login)!;
  return <AccountRow a={a} compact />;
}

/* ------------------------------------------------------------------ */

function MarginHealth() {
  const t = useT();
  const live = ACCOUNTS.filter((a) => a.type === "live" && !a.cent);
  const equity = live.reduce((s, a) => s + a.equity, 0);
  const margin = live.reduce((s, a) => s + a.margin, 0);
  const level = (equity / margin) * 100;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title={t("dashboard.margin.title")} subtitle={t("dashboard.margin.subtitle")} action={<Chip tone="up" dot>{t("dashboard.margin.healthy")}</Chip>} />
      <div className="flex flex-1 items-center justify-center py-4">
        <Gauge value={Math.min(level, 2000)} max={2000} display={`${Math.round(level).toLocaleString()}%`} label={t("dashboard.margin.level")} size={230} />
      </div>
      <div className="grid grid-cols-2 gap-3 px-6 pb-6">
        <div className="k-row px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-fg-3">{t("dashboard.margin.used")}</div>
          <Money value={margin} className="mt-1 block text-[15px] font-medium" />
        </div>
        <div className="k-row px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-fg-3">{t("dashboard.margin.free")}</div>
          <Money value={equity - margin} className="mt-1 block text-[15px] font-medium" />
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

const RANGES = ["1W", "1M", "3M", "YTD", "1Y", "ALL"] as const;
const RANGE_DAYS: Record<(typeof RANGES)[number], number> = { "1W": 7, "1M": 30, "3M": 90, YTD: 267, "1Y": 365, ALL: 540 };

function EquityCard() {
  const t = useT();
  const f = useFormat();
  const [range, setRange] = React.useState<(typeof RANGES)[number]>("3M");
  const all = React.useMemo(() => equitySeries(540, DASHBOARD.totalEquity), []);
  const data = React.useMemo(() => all.slice(-RANGE_DAYS[range]), [all, range]);
  const [hover, setHover] = React.useState<SeriesPoint | null>(null);
  const onHover = React.useCallback((p: SeriesPoint | null) => setHover(p), []);
  const first = data[0]!.value;
  const shown = hover?.value ?? DASHBOARD.totalEquity;
  const diff = shown - first;
  return (
    <Card className="h-full">
      <div className="flex flex-col gap-4 px-6 pt-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="k-label flex items-center gap-2">{t("dashboard.equity.title")}</div>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <Money value={shown} countUp={!hover} className="text-[34px] font-semibold tracking-tight" />
            <Chip tone={diff >= 0 ? "up" : "down"}>
              {diff >= 0 ? "+" : "-"}
              {formatMoney(Math.abs(diff))} ({((diff / first) * 100).toFixed(2)}%)
            </Chip>
          </div>
          <div className="mt-1 text-xs text-fg-3">{hover ? f.date(hover.time * 1000, { day: "2-digit", month: "short", year: "numeric" }) : t("dashboard.equity.changeOver", { range })}</div>
        </div>
        <Segmented size="xs" value={range} onChange={setRange} options={RANGES} />
      </div>
      <div className="px-3 pb-4 pt-2">
        <EquityChart data={data} height={300} onHover={onHover} />
      </div>
    </Card>
  );
}

function ProfitLossCard() {
  const t = useT();
  return (
    <Card className="flex h-full flex-col">
      <div className="px-6 pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="k-label">{t("dashboard.pnl.title")}</div>
            <Money value={DASHBOARD.monthPnl} signed className="mt-2 block text-[28px] font-semibold text-up" />
          </div>
          <Chip tone="up" dot>
            {t("dashboard.pnl.lowRisk")}
          </Chip>
        </div>
        <div className="mt-6 flex items-end justify-between text-xs">
          <div>
            <div className="text-fg-3">{t("common.loss")}</div>
            <div className="k-num text-base font-semibold text-down">{DASHBOARD.profitShare.lossPct}%</div>
          </div>
          <div className="text-end">
            <div className="text-fg-3">{t("common.profit")}</div>
            <div className="k-num text-base font-semibold text-up">{DASHBOARD.profitShare.profitPct}%</div>
          </div>
        </div>
        <BarcodeBars lossPct={DASHBOARD.profitShare.lossPct} className="mt-2" height={88} />
      </div>
      <div className="mt-4 flex-1 divide-y divide-line px-6 pb-4">
        {[
          [t("dashboard.pnl.winRate"), "64.2%"],
          [t("dashboard.pnl.trades"), "148"],
          [t("dashboard.pnl.avgWin"), "$212.40"],
          [t("dashboard.pnl.avgLoss"), "-$118.06"],
          [t("dashboard.pnl.charges"), "$96.30"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between py-2.5 text-[13px]">
            <span className="text-fg-3">{k}</span>
            <span dir="ltr" className={cn("k-num font-medium", v.startsWith("-") ? "text-down" : "text-fg")}>{v}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

/** One mover: real closes for the range (1D: M30, 1W: H4, 1M: D1); 1W/1M change is measured on them. */
function MoverRow({ symbol, name, range, q }: { symbol: string; name: string; range: "1D" | "1W" | "1M"; q: Quote }) {
  const [tf, n] = range === "1D" ? ["M30", 48] : range === "1W" ? ["H4", 42] : ["D1", 22];
  const real = useCloses(symbol, tf, n);
  // live: only real numbers (closes are raw last prices, so compare with the last price); the seeded
  // series is a fallback for the offline simulator only
  const sim = useFeedMode() !== "live";
  const px = q.last ?? q.bid;
  const ch = range === "1D" ? q.change : real ? ((px - real[0]!) / real[0]!) * 100 : sim ? q.change * (range === "1W" ? 2.4 : 5.1) : null;
  const data = React.useMemo(() => real ?? (sim ? sparkline(symbol + range, 24, (ch ?? 0) / 100 / 24) : null), [real, sim, symbol, range, ch]);
  return (
    <ListRow target="_blank" rel="noopener" href={`${TERMINAL_URL}/?symbol=${symbol}`} className="py-2.5">
      <SymbolAvatar symbol={symbol} size={26} />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium">{symbol}</div>
        <div className="truncate text-[11.5px] text-fg-3">{name}</div>
      </div>
      {data ? <Sparkline data={data} width={64} height={24} tone={data[data.length - 1]! >= data[0]! ? "up" : "down"} className="hidden sm:block" /> : <div className="hidden h-6 w-16 sm:block" />}
      <div className="w-24 text-end">
        <PriceText symbol={symbol} value={q.bid} dir={q.dir} className="text-[13px]" />
        <div className="mt-0.5">
          {ch === null ? <span className="text-[11.5px] text-fg-3">—</span> : <Delta value={ch} className="text-[11.5px]" />}
        </div>
      </div>
    </ListRow>
  );
}

const RANGE_BARS = { "1W": ["H4", 42], "1M": ["D1", 22] } as const;
const rangeCache = new Map<string, Promise<number | null>>();

/** % change over 1W / 1M for every listed symbol, from the same closes the rows draw (null until loaded). */
function useRangeChanges(range: "1D" | "1W" | "1M"): Record<string, number> | null {
  const mode = useFeedMode();
  const [v, setV] = React.useState<{ range: string; ch: Record<string, number> } | null>(null);
  React.useEffect(() => {
    if (range === "1D" || mode !== "live") return;
    let alive = true;
    const [tf, n] = RANGE_BARS[range];
    const symbols = INSTRUMENTS.map((i) => i.symbol);
    void Promise.all(
      symbols.map((s) => {
        const key = `${s}|${tf}|${n}`;
        let p = rangeCache.get(key);
        if (!p) {
          p = fetchCandles(s, tf, n).then((b) => (b && b.length > 1 ? ((b[b.length - 1]!.close - b[0]!.close) / b[0]!.close) * 100 : null));
          rangeCache.set(key, p);
        }
        return p;
      }),
    ).then((res) => {
      if (!alive) return;
      const ch: Record<string, number> = {};
      res.forEach((c, i) => c !== null && (ch[symbols[i]!] = c));
      setV({ range, ch });
    });
    return () => {
      alive = false;
    };
  }, [range, mode]);
  return v && v.range === range ? v.ch : null;
}

function MoversCard() {
  const [dir, setDir] = React.useState<"gainers" | "losers">("gainers");
  const [range, setRange] = React.useState<"1D" | "1W" | "1M">("1D");
  // 1D ranks by today's live change; 1W / 1M rank by the change over that range (not today's)
  const rangeCh = useRangeChanges(range);
  let list = topMovers(dir).slice(0, 6);
  if (range !== "1D" && rangeCh) {
    const ranked = INSTRUMENTS.filter((i) => rangeCh[i.symbol] !== undefined).sort((x, y) => rangeCh[y.symbol]! - rangeCh[x.symbol]!);
    list = (dir === "gainers" ? ranked : ranked.reverse()).slice(0, 6);
  }
  const t = useT();
  const qs = useQuotes(list.map((i) => i.symbol));
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={t("dashboard.movers.title")}
        action={<Segmented size="xs" value={range} onChange={setRange} options={["1D", "1W", "1M"] as const} />}
      />
      <div className="px-6 pt-3">
        <Segmented size="xs" value={dir} onChange={setDir} options={[{ value: "gainers", label: t("dashboard.movers.gainers") }, { value: "losers", label: t("dashboard.movers.losers") }]} />
      </div>
      <div className="k-fade-bottom mt-3 flex-1 space-y-2 px-4 pb-5 sm:px-6">
        {list.map((i) => (
          <MoverRow key={i.symbol} symbol={i.symbol} name={i.name} range={range} q={qs[i.symbol]!} />
        ))}
      </div>
    </Card>
  );
}

function CalendarCard() {
  const t = useT();
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={t("dashboard.calendar.title")}
        subtitle={t("dashboard.calendar.subtitle")}
        action={
          <Link href="/calendar">
            <Button size="sm" variant="surface">
              {t("common.viewAll")}
            </Button>
          </Link>
        }
      />
      <div className="k-fade-bottom mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
        {CALENDAR.slice(0, 5).map((e) => (
          <div key={e.id} className="k-row relative flex items-center gap-3 overflow-hidden py-3 ps-5 pe-4">
            <span className={cn("absolute inset-y-2 start-0 w-[3px] rounded-e-full", e.impact === 3 ? "bg-down" : e.impact === 2 ? "bg-warn" : "bg-fg-3")} />
            <div className="w-11 shrink-0 font-mono text-[12px] text-fg-3">{e.time}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-medium">{e.title}</div>
              <div className="k-num mt-0.5 text-[11.5px] text-fg-3">
                {e.actual ? <span className="text-fg-2">{t("dashboard.calendar.actual", { value: e.actual })}</span> : null}
                {t("dashboard.calendar.forecastPrevious", { forecast: e.forecast, previous: e.previous })}
              </div>
            </div>
            <Chip size="sm" tone={e.impact === 3 ? "down" : "neutral"}>
              <span className={`fi fis fi-${e.country} size-3 rounded-full`} />
              {e.currency}
            </Chip>
          </div>
        ))}
      </div>
    </Card>
  );
}

function NewsCard() {
  const t = useT();
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={t("dashboard.news.title")}
        action={
          <Link href="/news">
            <Button size="sm" variant="surface">
              {t("dashboard.news.all")}
            </Button>
          </Link>
        }
      />
      <div className="k-fade-bottom mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
        {NEWS.slice(0, 4).map((n) => (
          <ListRow key={n.id} href="/news" className="items-start gap-3.5 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={n.image} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11.5px] text-fg-3">
                {n.pinned && <Chip size="sm" tone="ember">{t("dashboard.news.pinned")}</Chip>}
                <span>{n.source}</span>·<span>{t("dashboard.time.minutesAgo", { count: n.minutesAgo })}</span>
              </div>
              <div className="mt-1 line-clamp-2 text-[13.5px] font-medium leading-snug">{n.title}</div>
              <div className="mt-1.5 flex gap-1.5">
                {n.symbols.map((s) => (
                  <span key={s} className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[10.5px] text-fg-2">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </ListRow>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function WorldCard() {
  const pins = [
    { country: "us", count: 18, label: "United States" },
    { country: "gb", count: 7, label: "United Kingdom" },
    { country: "de", count: 5, label: "Germany" },
    { country: "jp", count: 6, label: "Japan" },
    { country: "in", count: 4, label: "India" },
    { country: "sa", count: 3, label: "Saudi Arabia" },
    { country: "cn", count: 5, label: "China" },
    { country: "au", count: 2, label: "Australia" },
    { country: "br", count: 2, label: "Brazil" },
    { country: "sg", count: 2, label: "Singapore" },
  ];
  const t = useT();
  const heat = { us: 0.8, gb: 0.4, de: -0.6, jp: -0.3, au: 0.5, ch: -0.2, ca: -0.4, cn: 0.3 };
  return (
    <Card className="h-full">
      <CardHeader title={t("dashboard.world.title")} subtitle={t("dashboard.world.subtitle")} action={<Chip tone="ember" dot>{t("dashboard.world.stories", { count: 54 })}</Chip>} />
      <div className="px-4 pt-2 sm:px-6">
        <WorldMap pins={pins} heat={heat} />
      </div>
      <div className="px-6 pb-6 pt-2">
        <MarketSessions />
      </div>
    </Card>
  );
}

function PositionsCard() {
  const t = useT();
  const qs = useQuotes(POSITIONS.map((p) => p.symbol));
  const total = POSITIONS.reduce((s, p) => s + positionProfit(p, qs[p.symbol]!.bid, qs[p.symbol]!.ask), 0);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={t("dashboard.positions.title")}
        subtitle={
          <span>
            {t("dashboard.positions.summary", { count: POSITIONS.length })}{" "}
            <span className={cn("k-num font-medium", total >= 0 ? "text-up" : "text-down")}>
              {total >= 0 ? "+" : "-"}
              {formatMoney(Math.abs(total))}
            </span>
          </span>
        }
        action={
          <Link target="_blank" rel="noopener" href={TERMINAL_URL}>
            <Button size="sm" variant="surface">
              <CandlestickChart /> {t("dashboard.positions.terminal")}
            </Button>
          </Link>
        }
      />
      <div className="mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
        {POSITIONS.map((p) => {
          const q = qs[p.symbol]!;
          const pnl = positionProfit(p, q.bid, q.ask);
          return (
            <div key={p.ticket} className="k-row flex items-center gap-3 px-4 py-2.5">
              <SymbolAvatar symbol={p.symbol} size={24} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[13.5px] font-medium">
                  {p.symbol}
                  <Chip size="sm" tone={p.side === "buy" ? "up" : "down"}>
                    {t(p.side === "buy" ? "common.buy" : "common.sell").toUpperCase()} {p.volume}
                  </Chip>
                </div>
                <div className="k-num mt-0.5 font-mono text-[11px] text-fg-3">
                  {p.openPrice} → <PriceText symbol={p.symbol} value={p.side === "buy" ? q.bid : q.ask} dir={q.dir} className="text-[11px]" />
                </div>
              </div>
              <div dir="ltr" className={cn("k-num text-end text-[14px] font-semibold", pnl >= 0 ? "text-up" : "text-down")}>
                {pnl >= 0 ? "+" : "-"}
                {formatMoney(Math.abs(pnl))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function DemoDashboard() {
  const me = useSession();
  const t = useT();
  const [hour, setHour] = React.useState<string>("evening");
  React.useEffect(() => setHour(greeting()), []);
  const ib = DASHBOARD.earnings;
  return (
    <div className="pb-40">
      <PageHeader
        title={t.dyn(`dashboard.greeting.${hour}`, undefined, { name: me.first_name })}
        subtitle={t("dashboard.subtitle.demo")}
        actions={
          <Link target="_blank" rel="noopener" href={TERMINAL_URL}>
            <Button variant="ember" size="lg" shimmer>
              {t("dashboard.openTerminal")} <ArrowUpRight />
            </Button>
          </Link>
        }
      />

      <OnboardingStrip />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("dashboard.equity.title")}
          icon={<TrendingUp />}
          value={<Money value={DASHBOARD.totalEquity} />}
          chip={t("dashboard.kpi.today", { pct: DASHBOARD.equityChangeTodayPct })}
          chipTone="up"
          href="/portfolio"
        />
        <KpiCard
          label={t("dashboard.kpi.wallet")}
          icon={<Wallet />}
          value={<Money value={DASHBOARD.wallet} />}
          footer={
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {["usdt", "trx", "btc"].map((c) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={c} src={`/assets/coins/${c}.svg`} alt={c} className="size-5 rounded-full ring-2 ring-surface" />
                ))}
              </div>
              <span className="text-[11.5px] text-fg-3">USDT · TRC20</span>
            </div>
          }
          href="/wallet"
          delay={0.05}
        />
        <KpiCard
          label={t("dashboard.kpi.monthPnl")}
          icon={<LineChart />}
          value={<Money value={DASHBOARD.monthPnl} signed tone="up" />}
          chip={t("dashboard.kpi.vsLastMonth", { pct: DASHBOARD.monthPnlPct })}
          chipTone="up"
          href="/portfolio/analytics"
          delay={0.1}
        />
        <KpiCard
          label={t("dashboard.kpi.partnerEarnings")}
          icon={<Award />}
          value={<Money value={ib.total} />}
          hot
          illustration="money_bag"
          footer={
            <div className="flex items-center gap-1.5 text-[11.5px]">
              <Chip size="sm" tone="gold">IB ${ib.ib.toFixed(0)}</Chip>
              <Chip size="sm">{t("dashboard.kpi.copy", { amount: `$${ib.copy.toFixed(0)}` })}</Chip>
              <Chip size="sm">PAMM ${ib.pamm.toFixed(0)}</Chip>
            </div>
          }
          href="/partner"
          delay={0.15}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <AccountsCard />
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-4">
          <MarginHealth />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <EquityCard />
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-4">
          <ProfitLossCard />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Reveal delay={0.05}>
          <CalendarCard />
        </Reveal>
        <Reveal delay={0.1}>
          <MoversCard />
        </Reveal>
        <Reveal delay={0.15} className="lg:col-span-2 xl:col-span-1">
          <NewsCard />
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-7">
          <WorldCard />
        </Reveal>
        <Reveal delay={0.05} className="xl:col-span-5">
          <PositionsCard />
        </Reveal>
      </div>

      <div className="mt-4">
        <Card className="relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/photos/dubai.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-transparent" />
          <div className="relative flex flex-col gap-5 p-7 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <Chip tone="gold" className="mb-3">
                <BadgeCheck className="size-3.5" /> {t("dashboard.partner.chip")}
              </Chip>
              <h3 className="text-2xl font-medium tracking-tight">{t("dashboard.partner.title")}</h3>
              <p className="mt-2 text-sm text-fg-2">
                <Trans k="dashboard.partner.text" vars={{ url: `kalks.com/r/${me.referral_code}` }} tags={{ link: (c) => <span className="font-mono text-fg" dir="ltr">{c}</span> }} />
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Icon3D name="handshake" size={84} className="hidden md:block" />
              <Link href="/partner">
                <Button variant="ember" size="lg">
                  {t("dashboard.partner.open")} <ArrowUpRight />
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>

      <AiPromptBar
        suggestions={["Why is gold up today?", "Summarise my week", "Best time to trade EURUSD?", "What moves NAS100 today?"]}
        answer={(q) =>
          q.toLowerCase().includes("gold")
            ? "Gold (XAUUSD) is up 0.84% today at 2,654.30. Traders are pricing deeper Fed rate cuts after softer US data, and a weaker dollar is adding support. Key resistance sits near 2,670; support around 2,628 — close to the stop on your 0.50 lot buy in account #80412337."
            : q.toLowerCase().includes("week")
              ? `This week you closed 38 trades with a 66% win rate and +${formatMoney(2184.4)} net profit. Your best trade was XAUUSD (+$612.40). Most losses came from EURUSD shorts opened during the London open — consider waiting for the first 30 minutes to settle.`
              : q.toLowerCase().includes("eurusd")
                ? "EURUSD is most liquid during the London–New York overlap (15:00–19:00 server time), when spreads are tightest (from 0.3 pips on Pro). Today's NFP release at 15:30 may cause sharp moves — consider reducing size around it."
                : "NAS100 is up 1.24% led by chipmakers (NVDA +2.26%). Watch the ISM Services PMI at 17:00 server time — a strong print could lift yields and cap the rally."
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Demo builds: the full showcase on sample data. Live builds: only what is real for this client. */
export default function DashboardPage() {
  return IS_DEMO ? <DemoDashboard /> : <LiveDashboard movers={<MoversCard />} />;
}
