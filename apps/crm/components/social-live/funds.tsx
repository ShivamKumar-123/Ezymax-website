"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, Coins, Crown, LayoutGrid, Lock, Rows3, ShieldAlert, Snowflake, TrendingUp, Users, Wallet } from "lucide-react";
import { Avatar, Button, Card, CardHeader, Chip, DataTable, Dialog, EmptyState, EquityChart, KeyValue, KpiCard, PageHeader, Segmented, cn, type Column, type SeriesPoint } from "@kalks/ui";
import { fmtDate, serverTime } from "@/components/trading/api";
import { PERIOD_LABEL, compactUsd, nav4, pct, usd, useSocial, type FeePeriod, type FundDetail, type FundView } from "./api";
import { BlockSkeleton, InfoBox, MasterIdentity, SocialError, Tile } from "./bits";
import { InvestDialog } from "./invest-dialog";

type Rollover = FundDetail["rollovers"][number];

export function FundStatusChip({ status }: { status: FundView["status"] }) {
  if (status === "active") return <Chip size="sm" tone="up" dot>Active</Chip>;
  if (status === "frozen")
    return (
      <Chip size="sm" tone="down">
        <Snowflake className="size-3" /> Frozen
      </Chip>
    );
  return <Chip size="sm">Closed</Chip>;
}

/* ------------------------------------------------------------------ */
/* Fund detail drawer (NAV history + rollovers)                        */
/* ------------------------------------------------------------------ */

export function FundDetailDrawer({ fundId, onClose, onInvest }: { fundId: number | null; onClose: () => void; onInvest?: (id: number) => void }) {
  const { data, error } = useSocial<FundDetail>(fundId ? `funds/${fundId}` : null, 30000);
  const d = data && data.fund.id === fundId ? data : null;
  const series = React.useMemo<SeriesPoint[]>(() => {
    if (!d) return [];
    return d.navHistory
      .map((p) => ({ time: Math.floor(Date.parse(p.at) / 1000), value: p.nav }))
      .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
      .sort((a, b) => a.time - b.time)
      .filter((p, i, arr) => i === 0 || p.time > arr[i - 1]!.time);
  }, [d]);
  const rollCols: Column<Rollover>[] = [
    { key: "at", header: "Rollover", cell: (r) => <span className="k-num whitespace-nowrap text-fg-2">{serverTime(r.at)}</span>, sort: (r) => r.at },
    { key: "nav", header: "NAV", align: "right", cell: (r) => <span className="k-num font-medium">{nav4(r.nav)}</span> },
    { key: "in", header: "In", align: "right", cell: (r) => <span className="k-num text-up">{usd(r.invested, 0)}</span>, hideOn: "sm" },
    { key: "out", header: "Out", align: "right", cell: (r) => <span className="k-num text-down">{usd(r.redeemed, 0)}</span>, hideOn: "sm" },
    { key: "fees", header: "Fees", align: "right", cell: (r) => <span className="k-num text-fg-2">{usd(r.fees)}</span> },
  ];
  const f = d?.fund;
  return (
    <Dialog open={fundId !== null} onOpenChange={(o) => !o && onClose()} side="right" title={f ? f.name : "PAMM fund"} description={f ? `Managed by ${f.master.nickname}` : undefined}>
      {!d || !f ? (
        error ? <InfoBox tone="down">{error.message}</InfoBox> : <BlockSkeleton n={3} h={100} />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FundStatusChip status={f.status} />
            <div className="flex gap-2">
              <Link href={`/social/masters/${f.masterId}`}>
                <Button size="sm" variant="surface">
                  Master profile <ArrowUpRight />
                </Button>
              </Link>
              {onInvest && f.status === "active" && (
                <Button size="sm" variant="ember" onClick={() => onInvest(f.id)}>
                  <Wallet /> Invest
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Tile label="NAV per unit">{nav4(f.nav)}</Tile>
            <Tile label="Return all">
              <span className={f.returnAll >= 0 ? "text-up" : "text-down"}>{pct(f.returnAll)}</span>
            </Tile>
            <Tile label="Return 1M">
              <span className={f.return1m >= 0 ? "text-up" : "text-down"}>{pct(f.return1m)}</span>
            </Tile>
            <Tile label="AUM">{compactUsd(f.aum)}</Tile>
            <Tile label="Investors">{f.investors.toLocaleString("en-US")}</Tile>
            <Tile label="Drawdown">{f.drawdownPct > 0 ? `-${f.drawdownPct.toFixed(1)}%` : "0.0%"}</Tile>
          </div>
          <div>
            <div className="mb-1 text-[12.5px] font-medium text-fg-2">NAV per unit</div>
            {series.length > 1 ? (
              <EquityChart data={series} height={240} showVolume={false} />
            ) : (
              <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">The NAV history starts after the first rollover.</div>
            )}
          </div>
          <KeyValue
            rows={[
              ["Rollover", `${PERIOD_LABEL[f.period]} · next ${serverTime(f.nextRolloverAt)}`],
              ["Last rollover", serverTime(f.lastRolloverAt)],
              ["Performance fee", `${f.perfFeePct}% above your high-water mark`],
              ["Lock-in", f.lockInDays ? `${f.lockInDays} days from your first investment` : "None"],
              ["Minimum investment", usd(f.minInvestment, 0)],
              ["Drawdown freeze", `-${f.maxDdPct}% from peak NAV (${nav4(f.navPeak)})`],
              ["Master's share", `${f.masterSharePct.toFixed(1)}% (min ${f.minOwnPct}%)`],
              ["Created", fmtDate(f.createdAt)],
            ]}
          />
          <div>
            <div className="mb-2 text-[12.5px] font-medium text-fg-2">Rollovers</div>
            {d.rollovers.length ? (
              <DataTable columns={rollCols} rows={[...d.rollovers].sort((a, b) => b.at.localeCompare(a.at))} dense pageSize={10} rowKey={(r) => r.at} />
            ) : (
              <div className="k-row px-4 py-6 text-center text-[13px] text-fg-3">No rollovers yet.</div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

const EXPLAIN = [
  { icon: <Coins />, t: "NAV units", s: "You own units of a pooled account; value = units × NAV." },
  { icon: <CalendarClock />, t: "Rollover queue", s: "Invest and redeem requests execute at the next rollover." },
  { icon: <TrendingUp />, t: "High-water mark", s: "Performance fee only on new profit above your previous peak." },
  { icon: <ShieldAlert />, t: "Investor stop-loss", s: "Redeems you if your value drops by your chosen %." },
  { icon: <Snowflake />, t: "Drawdown freeze", s: "Trading stops if the fund breaches its max drawdown." },
];

function FundCard({ f, onInvest, onOpen }: { f: FundView; onInvest: () => void; onOpen: () => void }) {
  return (
    <div className="k-card flex h-full flex-col overflow-hidden transition-colors hover:border-[var(--k-border-top)]">
      <div className="px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-3 text-left">
            <Avatar name={f.master.nickname} size={44} />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-medium">{f.name}</span>
              <span className="block truncate text-[12px] text-fg-3">by {f.master.nickname}</span>
            </span>
          </button>
          <FundStatusChip status={f.status} />
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-fg-3">NAV per unit</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="k-num text-[26px] font-semibold leading-none tracking-tight">{nav4(f.nav)}</span>
              <span className={cn("k-num text-[12px]", f.return1m >= 0 ? "text-up" : "text-down")}>{pct(f.return1m)} 1M</span>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-[12px]">
          {[
            ["AUM", compactUsd(f.aum)],
            ["Investors", f.investors.toLocaleString("en-US")],
            ["Return all", <span key="r" className={f.returnAll >= 0 ? "text-up" : "text-down"}>{pct(f.returnAll, 1)}</span>],
            ["Drawdown", <span key="d" className="text-down">{f.drawdownPct > 0 ? `-${f.drawdownPct.toFixed(1)}%` : "0.0%"}</span>],
            ["Perf. fee", `${f.perfFeePct}% HWM`],
            ["Min", usd(f.minInvestment, 0)],
          ].map(([k, v], i) => (
            <div key={i} className="k-row min-w-0 px-2.5 py-2">
              <div className="text-fg-3">{k}</div>
              <div className="k-num mt-0.5 truncate font-medium">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip size="sm" tone="ember">
            <CalendarClock className="size-3" /> {PERIOD_LABEL[f.period]} · {serverTime(f.nextRolloverAt, false)}
          </Chip>
          {f.lockInDays > 0 ? (
            <Chip size="sm" tone="warn">
              <Lock className="size-3" /> {f.lockInDays}d lock-in
            </Chip>
          ) : (
            <Chip size="sm">No lock-in</Chip>
          )}
          <Chip size="sm">
            <Snowflake className="size-3" /> Freeze -{f.maxDdPct}%
          </Chip>
        </div>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2 px-5 pb-5 pt-4">
        <Button size="sm" variant="surface" className="w-full" onClick={onOpen}>
          Details <ArrowUpRight />
        </Button>
        <Button size="sm" variant="ember" onClick={onInvest} disabled={f.status !== "active"}>
          <Wallet /> Invest
        </Button>
      </div>
    </div>
  );
}

export function LivePammPage() {
  const { data, error, loading, reload } = useSocial<{ items: FundView[] }>("funds", 30000);
  const [view, setView] = React.useState<"cards" | "table">("cards");
  const [roll, setRoll] = React.useState<"all" | FeePeriod>("all");
  const [invest, setInvest] = React.useState<number | null>(null);
  const [open, setOpen] = React.useState<number | null>(null);

  const all = data?.items ?? [];
  const funds = all.filter((f) => roll === "all" || f.period === roll).sort((a, b) => b.aum - a.aum);
  const aum = all.reduce((s, f) => s + f.aum, 0);
  const investors = all.reduce((s, f) => s + f.investors, 0);
  const nextRoll = all
    .filter((f) => f.status === "active" && f.nextRolloverAt)
    .map((f) => f.nextRolloverAt!)
    .sort()[0];

  const columns: Column<FundView>[] = [
    { key: "fund", header: "Fund", cell: (f) => <MasterIdentity nickname={f.master.nickname} size={34} sub={f.name} />, width: "240px" },
    { key: "nav", header: "NAV / unit", align: "right", cell: (f) => <span className="k-num font-medium">{nav4(f.nav)}</span>, sort: (f) => f.nav },
    { key: "ret", header: "Return all", align: "right", cell: (f) => <span className={cn("k-num font-semibold", f.returnAll >= 0 ? "text-up" : "text-down")}>{pct(f.returnAll, 1)}</span>, sort: (f) => f.returnAll },
    { key: "aum", header: "AUM", align: "right", cell: (f) => <span className="k-num">{compactUsd(f.aum)}</span>, sort: (f) => f.aum },
    { key: "inv", header: "Investors", align: "right", cell: (f) => <span className="k-num text-fg-2">{f.investors}</span>, sort: (f) => f.investors, hideOn: "md" },
    { key: "roll", header: "Rollover", cell: (f) => <span className="block"><span>{PERIOD_LABEL[f.period]}</span><span className="block text-[11px] text-fg-3">{serverTime(f.nextRolloverAt, false)}</span></span>, hideOn: "lg" },
    { key: "fee", header: "Fee", align: "right", cell: (f) => <span className="k-num">{f.perfFeePct}%</span>, sort: (f) => f.perfFeePct },
    { key: "min", header: "Min · lock", align: "right", cell: (f) => <span className="k-num text-fg-2">{usd(f.minInvestment, 0)} · {f.lockInDays ? `${f.lockInDays}d` : "none"}</span>, hideOn: "md" },
    { key: "st", header: "Status", align: "center", cell: (f) => <FundStatusChip status={f.status} /> },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (f) => (
        <Button
          size="xs"
          variant="ember"
          disabled={f.status !== "active"}
          onClick={(e) => {
            e.stopPropagation();
            setInvest(f.id);
          }}
        >
          Invest
        </Button>
      ),
    },
  ];

  return (
    <div className="pb-24">
      <PageHeader
        title="PAMM funds"
        subtitle="Pooled accounts run by approved masters. Invest by buying units at the next rollover NAV."
        actions={
          <Link href="/social/investments">
            <Button variant="surface" size="lg">
              My investments <ArrowUpRight />
            </Button>
          </Link>
        }
      />

      {error && !data ? (
        <SocialError onRetry={reload} message={error.message} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Funds" icon={<LayoutGrid />} value={<span className="k-num">{loading ? "—" : all.length}</span>} chip={`${all.filter((f) => f.status === "active").length} open for investment`} />
            <KpiCard label="Total AUM" icon={<Wallet />} value={<span className="k-num">{loading ? "—" : compactUsd(aum)}</span>} chip="Investor capital" delay={0.04} />
            <KpiCard label="Investors" icon={<Users />} value={<span className="k-num">{loading ? "—" : investors.toLocaleString("en-US")}</span>} chip="across all funds" delay={0.08} />
            <KpiCard label="Next rollover" icon={<CalendarClock />} value={<span className="text-[20px]">{nextRoll ? serverTime(nextRoll, false) : "—"}</span>} chip="Server time" chipTone="ember" delay={0.12} />
          </div>

          <Card className="mt-4 grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
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

          <div className="mt-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="mr-auto text-[18px] font-medium tracking-tight">
                {funds.length} fund{funds.length === 1 ? "" : "s"} <span className="text-fg-3">· sorted by AUM</span>
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
                value={view}
                onChange={setView}
                options={[
                  { value: "cards", label: <LayoutGrid className="size-3.5" /> },
                  { value: "table", label: <Rows3 className="size-3.5" /> },
                ]}
              />
            </div>
            {loading ? (
              <BlockSkeleton n={2} h={200} />
            ) : funds.length === 0 ? (
              <Card>
                <EmptyState
                  illustration="bank"
                  title={all.length ? "No funds with this rollover" : "No PAMM funds yet"}
                  text={all.length ? "Try another rollover period." : "Approved masters can open a PAMM fund from their master dashboard. Funds appear here as soon as they open."}
                  action={
                    !all.length ? (
                      <Link href="/social/master">
                        <Button variant="ember">
                          <Crown /> Become a master
                        </Button>
                      </Link>
                    ) : undefined
                  }
                />
              </Card>
            ) : view === "cards" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {funds.map((f) => (
                  <FundCard key={f.id} f={f} onInvest={() => setInvest(f.id)} onOpen={() => setOpen(f.id)} />
                ))}
              </div>
            ) : (
              <Card>
                <CardHeader title="All PAMM funds" subtitle="Click a fund for its NAV history and rollovers" />
                <div className="px-4 pb-5 pt-4 sm:px-6">
                  <DataTable columns={columns} rows={funds} rowKey={(f) => String(f.id)} onRowClick={(f) => setOpen(f.id)} search={(f) => `${f.name} ${f.master.nickname}`} />
                </div>
              </Card>
            )}
          </div>
        </>
      )}

      <p className="mt-6 text-[12px] leading-relaxed text-fg-3">
        PAMM investing involves risk; past performance doesn&apos;t guarantee future results. Units are issued and redeemed at the NAV calculated at rollover (00:00 server time). The wallet is debited when you invest; the request stays pending until the rollover.
      </p>

      <FundDetailDrawer
        fundId={open}
        onClose={() => setOpen(null)}
        onInvest={(id) => {
          setOpen(null);
          setInvest(id);
        }}
      />
      <InvestDialog fundId={invest} open={invest !== null} onOpenChange={(o) => !o && setInvest(null)} onDone={reload} />
    </div>
  );
}
