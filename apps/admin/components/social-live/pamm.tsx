"use client";

import * as React from "react";
import { Camera, Eye, MoreHorizontal, PlayCircle, RefreshCw, RotateCw, Snowflake, Timer, Users, Wallet } from "lucide-react";
import { Button, Card, Chip, CopyButton, DataTable, Dialog, EmptyState, EquityChart, IconButton, KpiCard, Menu, PageHeader, Reveal, cn, formatNumber, type Column } from "@kalks/ui";
import { MiniStat, Section } from "@/components/config/kit";
import { TableSkeleton, day, useApi, useNow, when } from "@/components/live/kit";
import { Checkbox } from "@/components/trading-desk/kit";
import { PERIOD_LABEL, Pct, SocialError, SocialStatus, int, pendingCount, socialWrite, useNoteAction, useSocialCan, usd, usdK, type FundDetail, type FundView, type RequestView } from "./kit";

/** Countdown to an instant, re-rendered by the caller's clock. */
function Countdown({ to, now, className }: { to: string | null | undefined; now: number; className?: string }) {
  if (!to) return <span className={cn("text-fg-3", className)}>—</span>;
  const s = Math.max(0, Math.floor((Date.parse(to) - now) / 1000));
  const d = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <span className={cn("k-num font-mono", className)} title={when(to)}>
      {d > 0 && <>{d}d </>}
      {hh}:{mm}:{ss}
    </span>
  );
}

/** Drawdown from the NAV peak against the fund's max-DD freeze level. */
function DdBar({ dd, max }: { dd: number; max: number }) {
  const ratio = max > 0 ? Math.min(1, dd / max) : 0;
  const tone = ratio >= 0.8 ? "down" : ratio >= 0.5 ? "warn" : "up";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-3">
        <span className={cn("block h-full rounded-full", tone === "down" ? "bg-down" : tone === "warn" ? "bg-warn" : "bg-up")} style={{ width: `${Math.max(4, ratio * 100)}%` }} />
      </span>
      <span className={cn("k-num w-20 text-right font-mono text-[12px]", tone === "down" ? "text-down" : tone === "warn" ? "text-warn" : "text-fg-2")}>
        {dd.toFixed(1)}% / {max}%
      </span>
    </span>
  );
}

/** A checkbox row whose value lives in a mutable box read by the dialog's run(). */
function OptionRow({ box, label, hint, danger, initial = false }: { box: { current: boolean }; label: string; hint: string; danger?: boolean; initial?: boolean }) {
  const [on, setOn] = React.useState(initial);
  const set = (v: boolean) => {
    box.current = v;
    setOn(v);
  };
  return (
    <div onClick={() => set(!on)} className={cn("flex cursor-pointer items-start gap-3 rounded-[12px] border px-3.5 py-2.5 transition-colors", on ? (danger ? "border-down/40 bg-down-soft" : "border-ember/30 bg-ember-soft/50") : "border-line bg-surface-2")}>
      <span className="pt-0.5">
        <Checkbox checked={on} onChange={set} label={label} />
      </span>
      <span>
        <span className={cn("block text-[13px] font-medium", on && danger && "text-down")}>{label}</span>
        <span className="block text-[11.5px] text-fg-3">{hint}</span>
      </span>
    </div>
  );
}

function usePammActions(reload: () => void) {
  const act = useNoteAction();
  const freeze = (f: FundView, on: boolean) => {
    const close = { current: false };
    act.ask({
      title: on ? `Freeze ${f.name}` : `Unfreeze ${f.name}`,
      description: on
        ? "The fund account becomes close-only and new investments are refused. Redemptions still run at rollover."
        : "The fund account can trade again and accepts new investments from the next rollover.",
      confirmLabel: on ? "Freeze fund" : "Unfreeze fund",
      confirmVariant: on ? "sell" : "buy",
      body: on ? <OptionRow box={close} label="Close all positions and orders" hint={`Market-closes everything on fund account ${f.login ?? ""}`} danger /> : undefined,
      run: (note) => socialWrite(`admin/funds/${f.id}/freeze`, on ? { freeze: true, closePositions: close.current, note } : { freeze: false, note }),
      success: `${f.name} ${on ? "frozen" : "unfrozen"}`,
      onDone: reload,
    });
  };
  const rollover = (f: FundView) =>
    act.ask({
      title: `Run rollover now · ${f.name}`,
      description: "Values the fund at the current NAV, charges performance fees above each investor's high-water mark and executes every pending invest and redeem request.",
      confirmLabel: "Run rollover",
      run: (note) => socialWrite(`admin/funds/${f.id}/rollover`, { note }),
      success: `Rollover executed for ${f.name}`,
      onDone: reload,
    });
  const rolloverAll = () => {
    const force = { current: false };
    act.ask({
      title: "Run due rollovers",
      description: "Runs every PAMM rollover and copy-trading fee settlement whose period has ended. Normally this happens automatically at the server-day rollover.",
      confirmLabel: "Run rollovers",
      body: <OptionRow box={force} label="Force all" hint="Also run funds and subscriptions whose period hasn't ended yet" danger />,
      run: (note) => socialWrite("admin/rollover", { note, force: force.current }),
      success: "Rollovers executed",
      onDone: reload,
    });
  };
  const snapshots = () =>
    act.ask({
      title: "Write statistics snapshots",
      description: "Writes today's end-of-day equity and net flow for every master and fund account. Leaderboard statistics and risk scores use these snapshots.",
      confirmLabel: "Write snapshots",
      run: (note) => socialWrite("admin/snapshots", { note }),
      success: "Snapshots written",
      onDone: reload,
    });
  return { freeze, rollover, rolloverAll, snapshots, node: act.node };
}

export function LivePammPage() {
  const now = useNow(1000);
  const canWrite = useSocialCan("social.write");
  const { data, error, reload } = useApi<{ items: FundView[] }>("/api/social/admin/funds", { refreshMs: 15_000 });
  const acts = usePammActions(reload);
  const [sel, setSel] = React.useState<number | null>(null);
  const funds = data?.items ?? [];
  const fund = funds.find((f) => f.id === sel) ?? null;
  const aum = funds.reduce((s, f) => s + (f.aum ?? 0), 0);
  const investors = funds.reduce((s, f) => s + (f.investors ?? 0), 0);
  const pending = funds.reduce((s, f) => s + pendingCount(f.pending), 0);
  const next = funds.filter((f) => f.status !== "closed" && f.nextRolloverAt).sort((a, b) => Date.parse(a.nextRolloverAt!) - Date.parse(b.nextRolloverAt!))[0];

  const cols: Column<FundView>[] = [
    {
      key: "f",
      header: "Fund",
      sort: (f) => f.name,
      csv: (f) => f.name,
      cell: (f) => (
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-medium text-fg">{f.name}</span>
          <span className="block truncate text-[11.5px] text-fg-3">
            {f.master?.nickname ?? `Master #${f.masterId}`} · <span className="font-mono">#{f.id}</span>
          </span>
        </span>
      ),
    },
    { key: "l", header: "Login", csv: (f) => f.login ?? "", cell: (f) => <span className="font-mono text-[12px]">{f.login ?? "—"}</span> },
    { key: "s", header: "Status", csv: (f) => f.status, cell: (f) => <SocialStatus status={f.status} /> },
    { key: "nav", header: "NAV / unit", align: "right", sort: (f) => f.nav, csv: (f) => f.nav, cell: (f) => <span><span className="k-num block font-medium">{f.nav.toFixed(4)}</span><Pct value={f.return1m} className="text-[11px]" /></span> },
    { key: "u", header: "Units", align: "right", hideOn: "xl", sort: (f) => f.units, cell: (f) => <span className="k-num text-fg-2">{formatNumber(f.units, 2)}</span> },
    { key: "e", header: "Equity", align: "right", hideOn: "lg", sort: (f) => f.equity, cell: (f) => <span className="k-num">{usdK(f.equity)}</span> },
    { key: "a", header: "AUM", align: "right", sort: (f) => f.aum, csv: (f) => f.aum, cell: (f) => <span className="k-num font-medium">{usdK(f.aum)}</span> },
    { key: "i", header: "Investors", align: "right", sort: (f) => f.investors, cell: (f) => <span className="k-num">{int(f.investors)}</span> },
    { key: "ms", header: "Master share", align: "right", hideOn: "lg", sort: (f) => f.masterSharePct, cell: (f) => <span className={cn("k-num", f.masterSharePct < f.minOwnPct ? "text-down" : "text-fg-2")}>{f.masterSharePct.toFixed(1)}%</span> },
    { key: "dd", header: "Drawdown / max", align: "right", hideOn: "md", sort: (f) => (f.maxDdPct ? f.drawdownPct / f.maxDdPct : 0), cell: (f) => <DdBar dd={f.drawdownPct} max={f.maxDdPct} /> },
    { key: "r", header: "Rollover", sort: (f) => Date.parse(f.nextRolloverAt ?? "") || 0, csv: (f) => f.nextRolloverAt ?? "", cell: (f) => <span className="flex items-center gap-2 whitespace-nowrap"><Chip size="sm">{PERIOD_LABEL[f.period] ?? f.period}</Chip><Countdown to={f.nextRolloverAt} now={now} className="text-[11.5px] text-fg-3" /></span> },
    { key: "q", header: "Requests", align: "right", sort: (f) => pendingCount(f.pending), cell: (f) => { const n = pendingCount(f.pending); return n ? <Chip size="sm" tone="warn">{n} pending</Chip> : <span className="text-fg-3">—</span>; } },
    {
      key: "x",
      header: "",
      align: "right",
      width: "52px",
      cell: (f) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Menu
            trigger={
              <IconButton size="sm" aria-label="Actions">
                <MoreHorizontal />
              </IconButton>
            }
            items={[
              { label: "Open details", icon: <Eye />, onSelect: () => setSel(f.id) },
              ...(canWrite && f.status !== "closed"
                ? ([
                    { label: "Run rollover now", icon: <RotateCw />, onSelect: () => acts.rollover(f) },
                    "sep",
                    f.status === "frozen" ? { label: "Unfreeze fund", icon: <PlayCircle />, onSelect: () => acts.freeze(f, false) } : { label: "Freeze fund", icon: <Snowflake />, danger: true, onSelect: () => acts.freeze(f, true) },
                  ] satisfies React.ComponentProps<typeof Menu>["items"])
                : []),
            ]}
          />
        </span>
      ),
    },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="PAMM funds"
        subtitle="Pooled master accounts: NAV per unit, drawdown protection, rollover schedule and pending investor requests"
        actions={
          <>
            <Button variant="surface" onClick={reload}>
              <RefreshCw /> Refresh
            </Button>
            {canWrite && (
              <>
                <Button variant="surface" onClick={acts.snapshots}>
                  <Camera /> Write snapshots
                </Button>
                <Button variant="ember" onClick={acts.rolloverAll}>
                  <RotateCw /> Run due rollovers
                </Button>
              </>
            )}
          </>
        }
      />

      {error && !data ? (
        <SocialError error={error} onRetry={reload} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="PAMM AUM" icon={<Wallet />} value={<span className="k-num">{data ? usd(aum, 0) : "—"}</span>} chip={data ? `${funds.filter((f) => f.status === "active").length} active · ${funds.filter((f) => f.status === "frozen").length} frozen` : "Loading"} chipTone={funds.some((f) => f.status === "frozen") ? "warn" : "neutral"} />
            <KpiCard label="Investors" icon={<Users />} value={<span className="k-num">{data ? int(investors) : "—"}</span>} chip={data ? `${funds.length} funds` : "Loading"} delay={0.05} />
            <KpiCard label="Pending requests" icon={<Timer />} value={<span className="k-num">{data ? int(pending) : "—"}</span>} chip="Execute at each fund's next rollover" delay={0.1} />
            <KpiCard label="Next rollover" icon={<RotateCw />} value={next ? <Countdown to={next.nextRolloverAt} now={now} /> : <span className="text-fg-3">—</span>} chip={next ? `${next.name} · ${PERIOD_LABEL[next.period] ?? next.period}` : "No scheduled rollover"} chipTone="ember" delay={0.15} />
          </div>
          <Reveal delay={0.1}>
            <Card className="mt-4 p-4 sm:p-6">
              {!data ? (
                <TableSkeleton />
              ) : (
                <DataTable
                  columns={cols}
                  rows={funds}
                  dense
                  pageSize={15}
                  rowKey={(f) => String(f.id)}
                  onRowClick={(f) => setSel(f.id)}
                  search={(f) => `${f.name} ${f.master?.nickname ?? ""} ${f.id} ${f.login ?? ""}`}
                  searchPlaceholder="Fund, master, login…"
                  exportName="pamm-funds"
                  empty={<EmptyState illustration="busts_in_silhouette" title="No PAMM funds yet" text="Approved masters on the PAMM program create funds from the Client Area." />}
                />
              )}
            </Card>
          </Reveal>
        </>
      )}

      <FundDrawer f={fund} open={!!fund} onOpenChange={(o) => !o && setSel(null)} now={now} canWrite={canWrite} acts={acts} />
      {acts.node}
    </div>
  );
}

function FundDrawer({ f, open, onOpenChange, now, canWrite, acts }: { f: FundView | null; open: boolean; onOpenChange: (o: boolean) => void; now: number; canWrite: boolean; acts: ReturnType<typeof usePammActions> }) {
  const detail = useApi<FundDetail>(open && f ? `/api/social/funds/${f.id}` : null);
  const chart = React.useMemo(
    () =>
      (detail.data?.navHistory ?? [])
        .map((p) => ({ time: Math.floor(Date.parse(p.at) / 1000), value: p.nav }))
        .filter((p) => Number.isFinite(p.time))
        .sort((a, b) => a.time - b.time)
        .filter((p, i, xs) => i === 0 || p.time !== xs[i - 1]!.time),
    [detail.data],
  );
  if (!f) return null;
  const reqs: RequestView[] = Array.isArray(f.pending) ? f.pending : [];
  const rollovers = [...(detail.data?.rollovers ?? [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      title={
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            {f.name}
            <SocialStatus status={f.status} />
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[12px] font-normal text-fg-3">
            {f.master?.nickname ?? `Master #${f.masterId}`} · fund #{f.id} · login <span className="font-mono">{f.login ?? "—"}</span>
            {f.login ? <CopyButton value={String(f.login)} label="Login" /> : null}
          </span>
        </span>
      }
      footer={
        canWrite && f.status !== "closed" ? (
          <div className="flex w-full flex-wrap items-center gap-2">
            <Button variant="surface" size="sm" onClick={() => acts.rollover(f)}>
              <RotateCw /> Run rollover now
            </Button>
            <span className="flex-1" />
            {f.status === "frozen" ? (
              <Button variant="up-outline" size="sm" onClick={() => acts.freeze(f, false)}>
                <PlayCircle /> Unfreeze
              </Button>
            ) : (
              <Button variant="sell" size="sm" onClick={() => acts.freeze(f, true)}>
                <Snowflake /> Freeze fund
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      <Section title="NAV per unit">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="k-num text-[28px] font-semibold tracking-tight">{f.nav.toFixed(4)}</span>
          <Pct value={f.returnAll} />
          <span className="text-[12px] text-fg-3">Peak {f.navPeak.toFixed(4)}</span>
        </div>
        <div className="-mx-2 mt-2">
          {detail.loading && !detail.data ? (
            <div className="h-[200px] animate-pulse rounded-[16px] bg-surface-2" />
          ) : chart.length > 1 ? (
            <EquityChart data={chart} height={200} showVolume={false} lines={[{ price: f.navPeak * (1 - f.maxDdPct / 100), label: `Freeze at −${f.maxDdPct}%`, tone: "down" }]} />
          ) : (
            <div className="grid h-[110px] place-items-center rounded-[16px] border border-dashed border-line text-[12.5px] text-fg-3">{detail.error ? detail.error.message : "NAV history appears after the first rollovers"}</div>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <MiniStat label="Equity" value={usd(f.equity)} />
          <MiniStat label="AUM (investors)" value={usd(f.aum)} />
          <MiniStat label="Units" value={formatNumber(f.units, 4)} />
          <MiniStat label="Investors" value={int(f.investors)} />
          <MiniStat label="Master share" value={`${f.masterSharePct.toFixed(1)}%`} sub={`Minimum ${f.minOwnPct}%`} tone={f.masterSharePct < f.minOwnPct ? "down" : undefined} />
          <MiniStat label="Drawdown" value={`${f.drawdownPct.toFixed(1)}%`} sub={`Freezes at ${f.maxDdPct}%`} tone={f.maxDdPct && f.drawdownPct / f.maxDdPct >= 0.8 ? "down" : undefined} />
        </div>
      </Section>
      <Section title="Rollover" hint="Pending invest and redeem requests execute at the NAV of the next rollover">
        <div className="grid grid-cols-2 gap-2.5">
          <MiniStat label="Next rollover" value={<Countdown to={f.nextRolloverAt} now={now} />} sub={when(f.nextRolloverAt)} tone="ember" />
          <MiniStat label="Last rollover" value={f.lastRolloverAt ? day(f.lastRolloverAt) : "Never"} sub={PERIOD_LABEL[f.period] ?? f.period} />
          <MiniStat label="Performance fee" value={`${f.perfFeePct}%`} sub="Above each investor's high-water mark" />
          <MiniStat label="Min investment · lock-in" value={`${usd(f.minInvestment, 0)} · ${f.lockInDays ? `${f.lockInDays}d` : "none"}`} />
        </div>
        {reqs.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {reqs.map((r) => (
              <div key={r.id} className="k-row flex items-center justify-between gap-3 px-3.5 py-2 text-[12.5px]">
                <span>
                  <Chip size="sm" tone={r.kind === "invest" ? "up" : "down"}>{r.kind === "invest" ? "Invest" : "Redeem"}</Chip> <span className="font-mono text-fg-3">#{r.id}</span>
                </span>
                <span className="k-num">{r.all ? "All units" : r.amount !== null ? usd(r.amount) : r.units !== null ? `${formatNumber(r.units, 4)} units` : "—"}</span>
                <span className="text-fg-3">{day(r.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title="Rollover history">
        {detail.error ? (
          <div className="text-[12.5px] text-fg-3">{detail.error.message}</div>
        ) : !detail.data ? (
          <TableSkeleton rows={3} />
        ) : rollovers.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-line px-4 py-6 text-center text-[12.5px] text-fg-3">No rollovers yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-fg-3">
                  <th className="py-1.5 font-medium">Date</th>
                  <th className="py-1.5 text-right font-medium">NAV</th>
                  <th className="py-1.5 text-right font-medium">Invested</th>
                  <th className="py-1.5 text-right font-medium">Redeemed</th>
                  <th className="py-1.5 text-right font-medium">Fees</th>
                </tr>
              </thead>
              <tbody>
                {rollovers.map((r) => (
                  <tr key={r.at} className="border-t border-line">
                    <td className="py-1.5 text-fg-2" title={when(r.at)}>{day(r.at)}</td>
                    <td className="k-num py-1.5 text-right font-mono">{r.nav.toFixed(4)}</td>
                    <td className="k-num py-1.5 text-right">{r.invested ? usd(r.invested) : "—"}</td>
                    <td className="k-num py-1.5 text-right">{r.redeemed ? usd(r.redeemed) : "—"}</td>
                    <td className="k-num py-1.5 text-right">{r.fees ? usd(r.fees) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </Dialog>
  );
}

