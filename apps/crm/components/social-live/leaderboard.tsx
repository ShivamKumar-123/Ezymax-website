"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Crown, Landmark, LineChart, Repeat, ShieldCheck, Trophy, Users, Wallet } from "lucide-react";
import { Button, Card, CardHeader, Chip, DataTable, EmptyState, Menu, PageHeader, Segmented, Skeleton, Sparkline, cn, type Column } from "@kalks/ui";
import { compactUsd, formatAge, pct, useSocial, type Leaderboard, type MasterView } from "./api";
import { MasterIdentity, RiskBadge, SocialError } from "./bits";
import { FollowDialog } from "./follow-dialog";
import { InvestDialog } from "./invest-dialog";

type Period = "1m" | "3m" | "1y" | "all";
type SortKey = "return" | "dd" | "aum" | "followers" | "age";
type ProgramF = "all" | "copy" | "pamm";
type RiskF = "all" | "low" | "med" | "high";

const PERIOD_LABEL: Record<Period, string> = { "1m": "1M", "3m": "3M", "1y": "1Y", all: "All" };
const retOf = (m: MasterView, p: Period) => (p === "1m" ? m.stats.return1m : p === "3m" ? m.stats.return3m : p === "1y" ? m.stats.return1y : m.stats.returnAll);
const TRACK = [
  { v: 0, label: "Any track record" },
  { v: 30, label: "30 days+" },
  { v: 90, label: "90 days+" },
  { v: 180, label: "180 days+" },
  { v: 365, label: "1 year+" },
];

export function LiveDiscoverPage() {
  const router = useRouter();
  const [period, setPeriod] = React.useState<Period>("3m");
  const [sort, setSort] = React.useState<SortKey>("return");
  const [program, setProgram] = React.useState<ProgramF>("all");
  const [risk, setRisk] = React.useState<RiskF>("all");
  const [track, setTrack] = React.useState(0);
  const [copyM, setCopyM] = React.useState<MasterView | null>(null);
  const [investFund, setInvestFund] = React.useState<number | null>(null);

  const qs = new URLSearchParams({ period, program, sort, risk });
  if (track) qs.set("minDays", String(track));
  const { data, error, loading, reload } = useSocial<Leaderboard>(`leaderboard?${qs}`, 30000);
  const rows = data?.items ?? [];
  const totals = data?.totals;
  const filtered = program !== "all" || risk !== "all" || track > 0;

  const columns: Column<MasterView>[] = [
    {
      key: "rank",
      header: "#",
      cell: (_, i) => <span className={cn("font-mono text-[12px]", i < 3 && sort === "return" ? "text-gold" : "text-fg-3")}>{i + 1}</span>,
      width: "48px",
    },
    {
      key: "m",
      header: "Master",
      cell: (m) => (
        <MasterIdentity
          nickname={m.nickname}
          size={36}
          sub={
            <span className="flex items-center gap-1.5">
              <span className="truncate">{m.strategy}</span>
              {m.program === "both" && m.fund && (
                <Chip size="sm" tone="gold">
                  PAMM
                </Chip>
              )}
              {m.program === "pamm" && (
                <Chip size="sm" tone="gold">
                  PAMM only
                </Chip>
              )}
            </span>
          }
        />
      ),
      width: "260px",
    },
    {
      key: "ret",
      header: <span className="whitespace-nowrap">Return {PERIOD_LABEL[period]}</span>,
      align: "right",
      cell: (m) => {
        const r = retOf(m, period);
        return <span className={cn("k-num text-[14px] font-semibold", r > 0 ? "text-up" : r < 0 ? "text-down" : "text-fg-2")}>{pct(r, 1)}</span>;
      },
      sort: (m) => retOf(m, period),
    },
    {
      key: "spark",
      header: "Growth",
      align: "right",
      cell: (m) => (m.stats.spark?.length > 1 ? <Sparkline data={m.stats.spark} width={72} height={26} tone={m.stats.spark[m.stats.spark.length - 1]! >= m.stats.spark[0]! ? "up" : "down"} className="ml-auto" /> : <span className="text-fg-3">—</span>),
      hideOn: "lg",
    },
    { key: "dd", header: <span className="whitespace-nowrap">Max DD</span>, align: "right", cell: (m) => <span className="k-num text-down">{m.stats.maxDd > 0 ? `-${m.stats.maxDd.toFixed(1)}%` : "0.0%"}</span>, sort: (m) => -m.stats.maxDd },
    { key: "aum", header: "AUM", align: "right", cell: (m) => <span className="k-num">{compactUsd(m.stats.aum)}</span>, sort: (m) => m.stats.aum },
    { key: "fol", header: "Followers", align: "right", cell: (m) => <span className="k-num text-fg-2">{m.stats.followers.toLocaleString("en-US")}</span>, sort: (m) => m.stats.followers, hideOn: "md" },
    { key: "age", header: "Age", align: "right", cell: (m) => <span className="k-num whitespace-nowrap text-fg-2">{formatAge(m.ageDays)}</span>, sort: (m) => m.ageDays, hideOn: "sm" },
    { key: "risk", header: "Risk", align: "center", cell: (m) => <RiskBadge risk={m.stats.riskScore} />, sort: (m) => m.stats.riskScore },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (m) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {m.fund && m.program !== "copy" && m.fund.status === "active" && (
            <Button size="xs" variant="surface" onClick={() => setInvestFund(m.fund!.id)}>
              Invest
            </Button>
          )}
          {m.program !== "pamm" && !m.frozen && (
            <Button size="xs" variant="ember" onClick={() => setCopyM(m)}>
              Copy
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="pb-24">
      <PageHeader
        title="Discover masters"
        subtitle="Leaderboard of approved strategy providers for copy trading and PAMM."
        actions={
          <>
            <Link href="/social/copy">
              <Button variant="surface" size="lg">
                <Repeat /> My subscriptions
              </Button>
            </Link>
            <Link href="/social/master">
              <Button variant="ember" size="lg">
                <Crown /> Become a master
              </Button>
            </Link>
          </>
        }
      />

      <Card>
        <div className="grid grid-cols-1 gap-6 p-6 sm:p-7 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <Chip tone="ember" className="mb-3">
              <ShieldCheck className="size-3.5" /> Every master is identity-verified and approved by our risk team
            </Chip>
            <h2 className="text-[22px] font-medium leading-tight tracking-tight sm:text-[26px]">Copy a master&apos;s trades, or invest in their PAMM fund.</h2>
            <p className="mt-2 max-w-xl text-[14px] text-fg-2">Time-weighted returns with deposits and withdrawals removed, a system risk score from 1 to 10, and fees charged only above the high-water mark.</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { icon: <Crown />, k: "Masters", v: totals ? totals.masters.toLocaleString("en-US") : null },
              { icon: <Wallet />, k: "Assets under mgmt.", v: totals ? compactUsd(totals.aum) : null },
              { icon: <Users />, k: "Copy followers", v: totals ? totals.followers.toLocaleString("en-US") : null },
              { icon: <Landmark />, k: "PAMM investors", v: totals ? totals.investors.toLocaleString("en-US") : null },
            ].map((x) => (
              <div key={x.k} className="k-row px-4 py-3">
                <div className="flex items-center gap-1.5 text-[11.5px] text-fg-3 [&_svg]:size-3.5">
                  {x.icon}
                  {x.k}
                </div>
                <div className="k-num mt-1 text-[20px] font-semibold">{x.v ?? (error ? "—" : <Skeleton className="mt-1 h-6 w-16" />)}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="mt-4">
        {error && !data ? (
          <SocialError onRetry={reload} message={error.message} />
        ) : (
          <Card>
            <CardHeader
              title="Leaderboard"
              subtitle={data ? `${rows.length} master${rows.length === 1 ? "" : "s"} · returns after the master's trading costs, before your performance fee` : "Loading…"}
              icon={<Trophy />}
              action={<Segmented size="xs" value={period} onChange={setPeriod} options={(Object.keys(PERIOD_LABEL) as Period[]).map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />}
            />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Segmented
                  size="xs"
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: "return", label: "Top return" },
                    { value: "dd", label: "Lowest DD" },
                    { value: "aum", label: "AUM" },
                    { value: "followers", label: "Followers" },
                    { value: "age", label: "Oldest" },
                  ]}
                />
                <Segmented
                  size="xs"
                  value={program}
                  onChange={setProgram}
                  options={[
                    { value: "all", label: "All" },
                    { value: "copy", label: "Copy" },
                    { value: "pamm", label: "PAMM" },
                  ]}
                />
                <Segmented
                  size="xs"
                  value={risk}
                  onChange={setRisk}
                  options={[
                    { value: "all", label: "Any risk" },
                    { value: "low", label: "1–3" },
                    { value: "med", label: "4–6" },
                    { value: "high", label: "7–10" },
                  ]}
                />
                <Menu
                  align="start"
                  width={200}
                  trigger={
                    <Button size="sm" variant="surface">
                      {TRACK.find((t) => t.v === track)!.label} <ChevronDown className="opacity-60" />
                    </Button>
                  }
                  items={TRACK.map((t) => ({ label: t.label, onSelect: () => setTrack(t.v), hint: t.v === track ? "Selected" : undefined }))}
                />
              </div>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-[14px]" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <EmptyState
                  illustration="trophy"
                  title={filtered ? "No masters match these filters" : "No approved masters yet"}
                  text={filtered ? "Try a wider risk range or a shorter track record." : "Strategy providers appear here once our team approves them. Trade a live account and apply to be the first."}
                  action={
                    filtered ? (
                      <Button
                        variant="surface"
                        onClick={() => {
                          setProgram("all");
                          setRisk("all");
                          setTrack(0);
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : (
                      <Link href="/social/master">
                        <Button variant="ember">
                          <Crown /> Become a master
                        </Button>
                      </Link>
                    )
                  }
                />
              ) : (
                <DataTable
                  columns={columns}
                  rows={rows}
                  pageSize={15}
                  rowKey={(m) => String(m.id)}
                  onRowClick={(m) => router.push(`/social/masters/${m.id}`)}
                  search={(m) => `${m.nickname} ${m.strategy}`}
                  searchPlaceholder="Nickname or strategy…"
                />
              )}
            </div>
          </Card>
        )}
      </div>

      <p className="mt-6 flex items-start gap-2 text-[12px] leading-relaxed text-fg-3">
        <LineChart className="mt-0.5 size-3.5 shrink-0" />
        Returns are time-weighted from end-of-day equity with deposits and withdrawals removed. Past performance doesn&apos;t guarantee future results. Copy trading and PAMM investing carry risk of loss.
      </p>

      <FollowDialog master={copyM} open={!!copyM} onOpenChange={(o) => !o && setCopyM(null)} />
      <InvestDialog fundId={investFund} open={investFund !== null} onOpenChange={(o) => !o && setInvestFund(null)} />
    </div>
  );
}
