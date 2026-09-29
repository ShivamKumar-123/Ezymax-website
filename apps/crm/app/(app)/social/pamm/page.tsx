"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, Coins, LayoutGrid, Lock, Rows3, ShieldAlert, Snowflake, TrendingUp, Users, Wallet } from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  DataTable,
  Delta,
  KpiCard,
  PageHeader,
  Reveal,
  Segmented,
  Sparkline,
  cn,
  formatCompact,
  type Column,
} from "@kalks/ui";
import { PAMM_FUNDS, masterById, masterSpark, type PammFund, type Rollover } from "@kalks/mock/social";
import { RiskBadge } from "@/components/social/master-bits";
import { InvestDialog } from "@/components/social/invest-dialog";
import { IS_DEMO as DEMO_BUILD } from "@kalks/mock/mode";
import { LivePammPage } from "@/components/social-live/funds";

type RollF = "all" | Rollover;
type RiskF = "all" | "low" | "med" | "high";

const EXPLAIN = [
  { icon: <Coins />, t: "NAV units", s: "You own units of a pooled account; value = units × NAV." },
  { icon: <CalendarClock />, t: "Rollover queue", s: "Invest and redeem requests execute at the next rollover." },
  { icon: <TrendingUp />, t: "High-water mark", s: "Performance fee only on new profits above your previous peak." },
  { icon: <ShieldAlert />, t: "Investor stop-loss", s: "Auto-redeem if your investment drops by your chosen %." },
  { icon: <Snowflake />, t: "Drawdown freeze", s: "Fund trading freezes if it breaches its max drawdown." },
];

function FundCard({ f, onInvest }: { f: PammFund; onInvest: () => void }) {
  const m = masterById(f.masterId)!;
  const spark = React.useMemo(() => masterSpark(m, 40), [m]);
  return (
    <div className="k-card flex h-full flex-col overflow-hidden transition-colors hover:border-[var(--k-border-top)]">
      <div className="px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/social/masters/${m.id}`} className="flex min-w-0 items-center gap-3">
            <Avatar src={m.person.photo} name={m.person.name} size={44} verified={m.verified} />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-medium">{f.name}</div>
              <div className="truncate text-[12px] text-fg-3">by {m.person.name}</div>
            </div>
          </Link>
          <RiskBadge risk={f.risk} />
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-fg-3">NAV per unit</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="k-num text-[26px] font-semibold leading-none tracking-tight">{f.navPerUnit.toFixed(4)}</span>
              <Delta value={f.navChange24h} className="text-[12px]" />
            </div>
          </div>
          <Sparkline data={spark} width={110} height={40} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-[12px]">
          {[
            ["AUM", `$${formatCompact(f.aum)}`],
            ["Investors", f.investors.toLocaleString()],
            ["Return 1Y", <span key="r" className="text-up">+{f.return1y.toFixed(1)}%</span>],
            ["Max DD", <span key="d" className="text-down">-{f.maxDD.toFixed(1)}%</span>],
            ["Perf. fee", `${f.perfFee}% HWM`],
            ["Min", `$${f.minInvestment.toLocaleString()}`],
          ].map(([k, v], i) => (
            <div key={i} className="k-row px-2.5 py-2">
              <div className="text-fg-3">{k}</div>
              <div className="k-num mt-0.5 font-medium">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip size="sm" tone="ember">
            <CalendarClock className="size-3" /> <span className="capitalize">{f.rollover}</span> · {f.nextRolloverLabel}
          </Chip>
          {f.lockInDays > 0 ? (
            <Chip size="sm" tone="warn">
              <Lock className="size-3" /> {f.lockInDays}d lock-in
            </Chip>
          ) : (
            <Chip size="sm">No lock-in</Chip>
          )}
          <Chip size="sm">
            <Snowflake className="size-3" /> Freeze -{f.ddFreeze}%
          </Chip>
        </div>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2 px-5 pb-5 pt-4">
        <Link href={`/social/masters/${m.id}`}>
          <Button size="sm" variant="surface" className="w-full">
            Profile <ArrowUpRight />
          </Button>
        </Link>
        <Button size="sm" variant="ember" onClick={onInvest}>
          <Wallet /> Invest
        </Button>
      </div>
    </div>
  );
}

function DemoPammPage() {
  const [view, setView] = React.useState<"cards" | "table">("cards");
  const [roll, setRoll] = React.useState<RollF>("all");
  const [risk, setRisk] = React.useState<RiskF>("all");
  const [sel, setSel] = React.useState<PammFund | null>(null);

  const funds = PAMM_FUNDS.filter((f) => (roll === "all" || f.rollover === roll) && (risk === "all" || (risk === "low" ? f.risk <= 3 : risk === "med" ? f.risk >= 4 && f.risk <= 6 : f.risk >= 7))).sort((a, b) => b.aum - a.aum);
  const aum = PAMM_FUNDS.reduce((s, f) => s + f.aum, 0);
  const investors = PAMM_FUNDS.reduce((s, f) => s + f.investors, 0);

  const columns: Column<PammFund>[] = [
    {
      key: "fund",
      header: "Fund",
      cell: (f) => {
        const m = masterById(f.masterId)!;
        return (
          <Link href={`/social/masters/${m.id}`} className="flex min-w-0 items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <Avatar src={m.person.photo} name={m.person.name} size={34} verified={m.verified} />
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-medium">{f.name}</span>
              <span className="block truncate text-[11.5px] text-fg-3">{m.person.name}</span>
            </span>
          </Link>
        );
      },
      width: "240px",
    },
    {
      key: "nav",
      header: "NAV / unit",
      align: "right",
      cell: (f) => (
        <span className="block">
          <span className="k-num font-medium">{f.navPerUnit.toFixed(4)}</span>
          <Delta value={f.navChange24h} className="block text-[11px]" />
        </span>
      ),
      sort: (f) => f.navPerUnit,
    },
    { key: "aum", header: "AUM", align: "right", cell: (f) => <span className="k-num">${formatCompact(f.aum)}</span>, sort: (f) => f.aum },
    { key: "inv", header: "Investors", align: "right", cell: (f) => <span className="k-num text-fg-2">{f.investors.toLocaleString()}</span>, sort: (f) => f.investors, hideOn: "md" },
    { key: "ret", header: "Return 1Y", align: "right", cell: (f) => <span className="k-num font-semibold text-up">+{f.return1y.toFixed(1)}%</span>, sort: (f) => f.return1y },
    { key: "dd", header: "Max DD", align: "right", cell: (f) => <span className="k-num text-down">-{f.maxDD.toFixed(1)}%</span>, sort: (f) => -f.maxDD },
    { key: "roll", header: "Rollover", cell: (f) => <span className="block"><span className="capitalize">{f.rollover}</span><span className="block text-[11px] text-fg-3">{f.nextRolloverLabel}</span></span>, hideOn: "lg" },
    { key: "fee", header: "Fee", align: "right", cell: (f) => <span className="k-num">{f.perfFee}%</span>, sort: (f) => f.perfFee },
    { key: "min", header: "Min · lock", align: "right", cell: (f) => <span className="k-num text-fg-2">${f.minInvestment} · {f.lockInDays ? `${f.lockInDays}d` : "none"}</span>, hideOn: "md" },
    { key: "risk", header: "Risk", align: "center", cell: (f) => <RiskBadge risk={f.risk} /> },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (f) => (
        <Button size="xs" variant="ember" onClick={(e) => { e.stopPropagation(); setSel(f); }}>
          Invest
        </Button>
      ),
    },
  ];

  return (
    <div className="pb-24">
      <PageHeader
        title="PAMM funds"
        subtitle="Pooled accounts run by verified masters. Invest by buying units at the next rollover NAV."
        actions={
          <Link href="/social/investments">
            <Button variant="surface" size="lg">
              My holdings <ArrowUpRight />
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Open funds" icon={<LayoutGrid />} value={<span className="k-num">{PAMM_FUNDS.length}</span>} chip="All masters verified" chipTone="up" />
        <KpiCard label="Total AUM" icon={<Wallet />} value={<span className="k-num">${formatCompact(aum)}</span>} chip="+4.2% this month" chipTone="up" delay={0.04} />
        <KpiCard label="Investors" icon={<Users />} value={<span className="k-num">{investors.toLocaleString()}</span>} chip="across all funds" delay={0.08} />
        <KpiCard label="Next rollover" icon={<CalendarClock />} value={<span className="text-[24px]">Fri 00:00</span>} chip="Daily funds · weekly on Mon" chipTone="ember" hot delay={0.12} />
      </div>

      <Reveal delay={0.06} className="mt-4 block">
        <Card className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
          {EXPLAIN.map((x) => (
            <div key={x.t} className="flex gap-3 px-5 py-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-gold/30 bg-gold-soft text-gold [&_svg]:size-4">{x.icon}</span>
              <div>
                <div className="text-[13px] font-medium">{x.t}</div>
                <div className="mt-0.5 text-[11.5px] leading-snug text-fg-3">{x.s}</div>
              </div>
            </div>
          ))}
        </Card>
      </Reveal>

      <Reveal delay={0.1} className="mt-6 block">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-[18px] font-medium tracking-tight">
            {funds.length} funds <span className="text-fg-3">· sorted by AUM</span>
          </h2>
          <Segmented
            size="xs"
            value={roll}
            onChange={setRoll}
            options={[
              { value: "all", label: "Any rollover" },
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
            ]}
          />
          <Segmented
            size="xs"
            value={risk}
            onChange={setRisk}
            options={[
              { value: "all", label: "Any risk" },
              { value: "low", label: "Low" },
              { value: "med", label: "Medium" },
              { value: "high", label: "High" },
            ]}
          />
          <Segmented
            size="xs"
            value={view}
            onChange={setView}
            options={[
              { value: "cards", label: <LayoutGrid className="size-3.5" /> },
              { value: "table", label: <Rows3 className="size-3.5" /> },
            ]}
          />
        </div>
        {view === "cards" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {funds.map((f) => (
              <FundCard key={f.id} f={f} onInvest={() => setSel(f)} />
            ))}
            {funds.length > 0 && funds.length % 3 !== 0 && (
              <Link href="/social/master" className="k-hot-card group relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-[20px] p-6">
                <img src="/assets/photos/skyscrapers.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-25 transition-opacity group-hover:opacity-35" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                <div className="relative">
                  <Chip tone="gold">For masters</Chip>
                  <div className="mt-3 text-[20px] font-medium leading-tight">Launch your own PAMM fund</div>
                  <p className="mt-2 max-w-xs text-[13px] text-fg-2">Earn up to 50% performance fees above the high-water mark. 90-day track record and 10% own capital required.</p>
                </div>
                <span className="relative inline-flex items-center gap-1.5 text-[13px] font-medium text-ember">
                  Become a master <ArrowUpRight className="size-4" />
                </span>
              </Link>
            )}
            {funds.length === 0 && <div className="k-card col-span-full px-6 py-12 text-center text-[13px] text-fg-3">No funds match these filters.</div>}
          </div>
        ) : (
          <Card>
            <CardHeader title="All PAMM funds" subtitle="Click a fund to invest" />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <DataTable columns={columns} rows={funds} rowKey={(f) => f.id} onRowClick={setSel} search={(f) => `${f.name} ${masterById(f.masterId)!.person.name}`} exportName="kalks-pamm-funds" />
            </div>
          </Card>
        )}
      </Reveal>

      <p className={cn("mt-6 text-[12px] leading-relaxed text-fg-3")}>
        PAMM investing involves risk; past performance is not a guarantee of future results. Units are issued and redeemed at the NAV calculated at rollover (server time GMT+3). Masters keep at least 10% of their own capital in each fund.
      </p>

      <InvestDialog fund={sel} open={!!sel} onOpenChange={(o) => !o && setSel(null)} />
    </div>
  );
}

export default function PammPage() {
  return DEMO_BUILD ? <DemoPammPage /> : <LivePammPage />;
}
