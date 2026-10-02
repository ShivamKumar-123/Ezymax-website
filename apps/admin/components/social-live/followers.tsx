"use client";

/**
 * Back Office → Social & Algo → Followers: every copy subscription across masters, with the copy-trading dashboard
 * on top (copied AUM, followers, skip rate and its reasons, copy fees, follower P&L by master, execution quality).
 * Reads /api/social/admin/copy-dashboard?days= and /api/social/admin/subscriptions; "Stop copying" posts
 * /api/social/admin/subscriptions/{id}/stop (social.write, note required, closes the copied trades).
 */
import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, HandCoins, RefreshCw, Square, Timer, Users, Wallet } from "lucide-react";
import { Button, Card, CardHeader, Chip, DataTable, EmptyState, KpiCard, Money, PageHeader, Reveal, Segmented, Skeleton, Toggle, cn, formatNumber, type ChipTone, type Column } from "@kalks/ui";
import { MiniStat } from "@/components/config/kit";
import { FilterSelect, TableSkeleton, ago, day, useApi, useNow, when } from "@/components/live/kit";
import { PERIOD_LABEL, Pct, ReadOnlyNote, SocialError, SocialStatus, int, socialWrite, useNoteAction, useSocialCan, usd, usdK, type NoteAction, type Sizing, type SubscriptionView } from "./kit";

/* ------------------------------------------------------------------ */
/* Engine shapes                                                        */
/* ------------------------------------------------------------------ */

/** Admin subscription row (GET admin/subscriptions); the newer fields are optional so an older engine still renders. */
type FollowerSub = Omit<SubscriptionView, "master" | "balance"> & {
  master: (SubscriptionView["master"] & { house?: boolean }) | null;
  balance: number | null;
  lastFeeAt?: string | null;
  autoSlPips?: number | null;
  /** "terms": paused until the follower accepts the master's new fee terms */
  pauseReason?: string | null;
  /** "master_stopped": the master stopped trading / was suspended while this follower still copies */
  attention?: string | null;
  pendingTerms?: { perfFeePct: number; feePeriod: string; deadline: string } | null;
  trial?: boolean;
  trialEndsAt?: string | null;
};

type Counted = { count: number; amount: number };
type FeeState = "pending" | "approved" | "paid" | "rejected" | "failed";
type SkipReason = { reason: string; label: string; status: "skipped" | "failed"; count: number };
type MasterRow = {
  masterId: number;
  nickname: string;
  followers: number;
  followersTotal: number;
  aum: number;
  netDeposits: number;
  pnl: number;
  returnPct: number | null;
  feesPending: number;
  feesPaid: number;
  skipped: number;
  avgDelayMs: number | null;
};
type CopyDashboard = {
  days: number;
  aum: number;
  followers: { active: number; paused: number; stopped: number; copying: number; attention: number; pendingTerms: number };
  masters: number;
  steps: { total: number; done: number; skipped: number; failed: number; skipRatePct: number };
  skipReasons: SkipReason[];
  fees: Partial<Record<FeeState, Counted>>;
  byMaster: MasterRow[];
  execution: { trades: number; avgDelayMs: number | null; avgSlippagePips: number | null };
};
type StopResult = { result?: { closed?: unknown[]; failed?: unknown[]; returned?: number | null; returnError?: string | null } };

type Win = "7" | "30" | "90";
type StatusTab = "all" | "active" | "paused" | "stopped";

/* ------------------------------------------------------------------ */
/* Formatting                                                           */
/* ------------------------------------------------------------------ */

const STOP_REASON: Record<string, string> = {
  client: "Stopped by the client",
  equity_stop: "Equity stop reached",
  max_dd: "Max drawdown reached",
  admin: "Stopped by staff",
  master: "Master no longer active",
};
const stopReasonText = (r: string | null | undefined) => (r ? (STOP_REASON[r] ?? r.replace(/_/g, " ")) : "");

function sizingText(s: Sizing) {
  if (s.mode === "equity") return "Equity proportional";
  if (s.mode === "fixed_lot") return `Fixed ${formatNumber(s.value, 2)} lot`;
  if (s.mode === "multiplier") return `Multiplier ${s.value}×`;
  if (s.mode === "allocation") return `Allocation ${usd(s.value, 0)}`;
  return String(s.mode).replace(/_/g, " ");
}

const ms = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v >= 1000 ? `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)} s` : `${Math.round(v)} ms`);
const delayTone = (v: number | null | undefined): ChipTone => (v === null || v === undefined ? "neutral" : v > 3000 ? "down" : v > 1000 ? "warn" : "up");
const pips = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${formatNumber(v, 2)} pips`);
const signedUsd = (v: number) => `${v > 0 ? "+" : ""}${usd(v)}`;
const pnlClass = (v: number) => (v > 0 ? "text-up" : v < 0 ? "text-down" : "text-fg-2");
const label = (s: string | null | undefined) => (s ? s.replace(/_/g, " ") : "");

/** Paused for new terms, master stopped, or terms waiting for the follower's answer. Stopped subscriptions are done. */
const needsAttention = (s: FollowerSub) => s.status !== "stopped" && !!(s.attention || s.pendingTerms || s.pauseReason);

/** Status flags as text (CSV, search). */
function flags(s: FollowerSub) {
  const out: string[] = [];
  if (s.pauseReason) out.push(s.pauseReason === "terms" ? "paused: new terms" : `paused: ${label(s.pauseReason)}`);
  if (s.attention) out.push(s.attention === "master_stopped" ? "master stopped" : label(s.attention));
  if (s.pendingTerms) out.push(`terms pending until ${day(s.pendingTerms.deadline)}`);
  if (s.trial) out.push("trial");
  return out;
}

/* ------------------------------------------------------------------ */
/* Cells                                                                */
/* ------------------------------------------------------------------ */

function StatusCell({ s }: { s: FollowerSub }) {
  const t = s.pendingTerms;
  return (
    <span className="flex max-w-[240px] flex-wrap items-center gap-1">
      <SocialStatus status={s.status} />
      {s.pauseReason && (
        <Chip size="sm" tone="warn">
          {s.pauseReason === "terms" ? "Paused: new terms" : `Paused: ${label(s.pauseReason)}`}
        </Chip>
      )}
      {s.attention && (
        <Chip size="sm" tone="down">
          {s.attention === "master_stopped" ? "Master stopped" : label(s.attention)}
        </Chip>
      )}
      {t && (
        <span title={`New terms: ${t.perfFeePct}% ${(PERIOD_LABEL[t.feePeriod] ?? t.feePeriod).toLowerCase()} (now ${s.perfFeePct}% ${(PERIOD_LABEL[s.feePeriod] ?? s.feePeriod).toLowerCase()}) · answer due ${when(t.deadline)}`}>
          <Chip size="sm" tone="info">
            Terms pending until {day(t.deadline)}
          </Chip>
        </span>
      )}
      {s.trial && (
        <span title={s.trialEndsAt ? `Free trial until ${when(s.trialEndsAt)}` : "Free trial"}>
          <Chip size="sm" tone="gold">
            Trial
          </Chip>
        </span>
      )}
    </span>
  );
}

function ExecutionChip({ e }: { e: CopyDashboard["execution"] }) {
  if (!e.trades) return <Chip size="sm">No copied trades in this window</Chip>;
  return (
    <span title={`${int(e.trades)} copied trades · average time from the master's fill to the follower's fill, and the average price difference`}>
      <Chip tone={delayTone(e.avgDelayMs)}>
        <Timer className="size-3" />
        {ms(e.avgDelayMs)} avg delay · {pips(e.avgSlippagePips)} slippage
      </Chip>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Copy dashboard                                                       */
/* ------------------------------------------------------------------ */

function DashboardSkeleton() {
  return (
    <div className="mt-4 space-y-4">
      <Card className="p-4 sm:p-6">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="mt-4 h-2 w-full rounded-full" />
        <div className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[62px] w-full rounded-[14px]" />
          ))}
        </div>
      </Card>
      <Card className="p-4 sm:p-6">
        <TableSkeleton rows={4} />
      </Card>
    </div>
  );
}

function SkipReasonsCard({ d }: { d: CopyDashboard }) {
  const { total, done, skipped, failed } = d.steps;
  const missed = skipped + failed;
  const reasons = [...d.skipReasons].sort((a, b) => b.count - a.count);
  const reasonTotal = missed || reasons.reduce((n, r) => n + r.count, 0);
  const max = Math.max(1, ...reasons.map((r) => r.count));
  const w = (n: number) => `${total ? (n / total) * 100 : 0}%`;
  return (
    <Card>
      <CardHeader title="Skipped & failed copies by reason" subtitle={`Copy log of the last ${d.days} days: master opens, pending orders and adds`} action={<ExecutionChip e={d.execution} />} />
      <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
        <div className="flex h-2 overflow-hidden rounded-full bg-surface-3" aria-hidden>
          <span className="h-full bg-up" style={{ width: w(done) }} />
          <span className="h-full bg-warn" style={{ width: w(skipped) }} />
          <span className="h-full bg-down" style={{ width: w(failed) }} />
        </div>
        <div className="k-num mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-fg-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-up" /> Copied <span className="text-fg-2">{int(done)}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-warn" /> Skipped <span className="text-fg-2">{int(skipped)}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-down" /> Failed <span className="text-fg-2">{int(failed)}</span>
          </span>
          <span className="ml-auto">{int(total)} copy steps</span>
        </div>
        {reasons.length === 0 ? (
          <div className="mt-4 rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-[12.5px] text-fg-3">
            {total ? `Every copy step of the last ${d.days} days went through.` : `No master trades were copied in the last ${d.days} days.`}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-2">
            {reasons.map((r) => (
              <div key={`${r.status}-${r.reason}`} className="k-row px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[13px] font-medium" title={r.reason}>
                      {r.label || label(r.reason)}
                    </span>
                    <Chip size="sm" tone={r.status === "failed" ? "down" : "warn"}>
                      {r.status === "failed" ? "Failed" : "Skipped"}
                    </Chip>
                  </span>
                  <span className="k-num shrink-0 text-[13px] font-medium">
                    {int(r.count)}
                    <span className="ml-1.5 text-[11.5px] font-normal text-fg-3">{reasonTotal ? `${((r.count / reasonTotal) * 100).toFixed(1)}%` : "—"}</span>
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div className={cn("h-full rounded-full", r.status === "failed" ? "bg-down" : "bg-warn")} style={{ width: `${(r.count / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function ByMasterCard({ d, onMaster }: { d: CopyDashboard; onMaster: (id: number) => void }) {
  const cols: Column<MasterRow>[] = [
    {
      key: "m",
      header: "Master",
      sort: (m) => m.nickname,
      csv: (m) => m.nickname,
      cell: (m) => (
        <span className="text-[13px] font-medium">
          {m.nickname}
          <span className="block font-mono text-[11px] font-normal text-fg-3">#{m.masterId}</span>
        </span>
      ),
    },
    {
      key: "f",
      header: "Followers",
      align: "right",
      sort: (m) => m.followers,
      csv: (m) => m.followers,
      cell: (m) => (
        <span className="k-num">
          {int(m.followers)}
          <span className="block text-[11px] text-fg-3">of {int(m.followersTotal)}</span>
        </span>
      ),
    },
    { key: "a", header: "AUM", align: "right", sort: (m) => m.aum, csv: (m) => m.aum, cell: (m) => <span className="k-num font-medium">{usdK(m.aum)}</span> },
    { key: "nd", header: "Net deposits", align: "right", hideOn: "md", sort: (m) => m.netDeposits, csv: (m) => m.netDeposits, cell: (m) => <span className="k-num text-fg-2">{usdK(m.netDeposits)}</span> },
    { key: "p", header: "P&L", align: "right", sort: (m) => m.pnl, csv: (m) => m.pnl, cell: (m) => <span className={cn("k-num font-medium", pnlClass(m.pnl))}>{signedUsd(m.pnl)}</span> },
    { key: "r", header: "Return", align: "right", sort: (m) => m.returnPct ?? -1e9, csv: (m) => m.returnPct ?? "", cell: (m) => <Pct value={m.returnPct} /> },
    { key: "fp", header: "Fees pending", align: "right", hideOn: "lg", sort: (m) => m.feesPending, csv: (m) => m.feesPending, cell: (m) => <span className={cn("k-num", m.feesPending ? "text-fg" : "text-fg-3")}>{usd(m.feesPending)}</span> },
    { key: "fd", header: "Fees paid", align: "right", hideOn: "lg", sort: (m) => m.feesPaid, csv: (m) => m.feesPaid, cell: (m) => <span className="k-num text-fg-2">{usd(m.feesPaid)}</span> },
    { key: "s", header: "Skipped", align: "right", hideOn: "md", sort: (m) => m.skipped, csv: (m) => m.skipped, cell: (m) => <span className={cn("k-num", m.skipped ? "text-warn" : "text-fg-3")}>{int(m.skipped)}</span> },
    {
      key: "dl",
      header: "Avg delay",
      align: "right",
      hideOn: "sm",
      sort: (m) => m.avgDelayMs ?? -1,
      csv: (m) => m.avgDelayMs ?? "",
      cell: (m) => (m.avgDelayMs === null ? <span className="text-fg-3">—</span> : <Chip size="sm" tone={delayTone(m.avgDelayMs)}>{ms(m.avgDelayMs)}</Chip>),
    },
  ];
  return (
    <Card>
      <CardHeader title="Follower P&L by master" subtitle={`${int(d.masters)} masters with followers copying now · fees are copy fees only · click a master to list its followers`} />
      <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
        <DataTable
          columns={cols}
          rows={d.byMaster}
          dense
          pageSize={10}
          rowKey={(m) => String(m.masterId)}
          onRowClick={(m) => onMaster(m.masterId)}
          search={(m) => `${m.nickname} ${m.masterId}`}
          searchPlaceholder="Master…"
          exportName={`copy-pnl-by-master-${d.days}d`}
          empty={<EmptyState illustration="busts_in_silhouette" title="No masters with followers" text="Masters appear here once someone copies them." />}
        />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function LiveFollowersPage() {
  const now = useNow();
  const canWrite = useSocialCan("social.write");
  const [win, setWin] = React.useState<Win>("30");
  const [tab, setTab] = React.useState<StatusTab>("all");
  const [master, setMaster] = React.useState("all");
  const [attention, setAttention] = React.useState(false);
  const tableRef = React.useRef<HTMLDivElement>(null);
  const dash = useApi<CopyDashboard>(`/api/social/admin/copy-dashboard?days=${win}`, { refreshMs: 60_000 });
  const subs = useApi<{ items: FollowerSub[] }>("/api/social/admin/subscriptions", { refreshMs: 30_000 });
  const act = useNoteAction();
  const reload = React.useCallback(() => {
    dash.reload();
    subs.reload();
  }, [dash.reload, subs.reload]);

  const d = dash.data;
  const stale = !!d && d.days !== Number(win);
  const items = React.useMemo(() => subs.data?.items ?? [], [subs.data]);

  // filters: master → status → needs attention (counts follow the master filter)
  const byMaster = master === "all" ? items : items.filter((s) => String(s.masterId) === master);
  const count = (t: StatusTab) => (t === "all" ? byMaster.length : byMaster.filter((s) => s.status === t).length);
  const byStatus = tab === "all" ? byMaster : byMaster.filter((s) => s.status === tab);
  const attentionCount = byStatus.filter(needsAttention).length;
  const rows = attention ? byStatus.filter(needsAttention) : byStatus;

  const masterOptions = React.useMemo(() => {
    const m = new Map<string, { label: string; n: number }>();
    for (const s of items) {
      const k = String(s.masterId);
      const cur = m.get(k);
      if (cur) cur.n += 1;
      else m.set(k, { label: s.master?.nickname ?? `Master #${s.masterId}`, n: 1 });
    }
    if (master !== "all" && !m.has(master)) m.set(master, { label: d?.byMaster.find((x) => String(x.masterId) === master)?.nickname ?? `Master #${master}`, n: 0 });
    return [{ value: "all", label: "All masters" }, ...[...m.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label)).map(([value, x]) => ({ value, label: `${x.label} (${x.n})` }))];
  }, [items, master, d]);

  const showMaster = (id: number) => {
    setMaster(String(id));
    setTab("all");
    setAttention(false);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const showAttention = () => {
    setMaster("all");
    setTab("all");
    setAttention(true);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const stop = (s: FollowerSub) => {
    const name = s.master?.nickname ?? `master #${s.masterId}`;
    const open = s.positions + s.orders;
    const action: NoteAction = {
      title: `Stop copying · subscription #${s.id}`,
      description: `Copy account ${s.login} stops following ${name}. ${open ? `Its ${open} copied trade${open === 1 ? "" : "s"} (positions and pending orders) are closed at market now.` : "It has no copied trades open."} This can't be undone; the client would have to follow again.`,
      confirmLabel: "Stop copying",
      confirmVariant: "sell",
      notePlaceholder: "Why is this subscription being stopped? Written to the audit log.",
      body: (
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Equity" value={usd(s.equity)} />
          <MiniStat label="Open trades" value={int(open)} sub={`${s.positions} positions · ${s.orders} orders`} tone={open ? "warn" : undefined} />
          <MiniStat label="P&L" value={signedUsd(s.profit)} tone={s.profit < 0 ? "down" : s.profit > 0 ? "up" : undefined} />
        </div>
      ),
      success: `Subscription #${s.id} stopped`,
      run: async (note) => {
        const r = await socialWrite<StopResult>(`admin/subscriptions/${s.id}/stop`, { note });
        if (r.ok) {
          const closed = r.data?.result?.closed?.length ?? 0;
          const failed = r.data?.result?.failed?.length ?? 0;
          if (closed) action.success = `Subscription #${s.id} stopped · ${closed} copied trade${closed === 1 ? "" : "s"} closed`;
          if (failed) toast.warning(`${failed} copied trade${failed === 1 ? "" : "s"} couldn't be closed`, { description: `Check account ${s.login}: they are still open.` });
        }
        return r;
      },
      onDone: reload,
    };
    act.ask(action);
  };

  const cols: Column<FollowerSub>[] = [
    { key: "id", header: "Subscription", sort: (s) => s.id, csv: (s) => s.id, cell: (s) => <span className="font-mono text-[12px]">#{s.id}</span> },
    { key: "u", header: "User", hideOn: "md", csv: (s) => s.userId ?? "", cell: (s) => <span className="font-mono text-[12px] text-fg-2">{s.userId ? `#${s.userId}` : "—"}</span> },
    { key: "l", header: "Copy login", sort: (s) => String(s.login), csv: (s) => s.login, cell: (s) => <span className="font-mono text-[12.5px]">{s.login}</span> },
    {
      key: "m",
      header: "Master",
      sort: (s) => s.master?.nickname ?? "",
      csv: (s) => s.master?.nickname ?? `#${s.masterId}`,
      cell: (s) => (
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium">
            {s.master?.nickname ?? "—"}
            {s.master?.house && (
              <Chip size="sm" tone="info">
                House
              </Chip>
            )}
            {s.master?.frozen && (
              <Chip size="sm" tone="down">
                Frozen
              </Chip>
            )}
          </span>
          <span className="block font-mono text-[11px] text-fg-3">#{s.masterId}</span>
        </span>
      ),
    },
    { key: "s", header: "Status", sort: (s) => s.status, csv: (s) => [s.status, ...flags(s)].join("; "), cell: (s) => <StatusCell s={s} /> },
    {
      key: "z",
      header: "Sizing",
      hideOn: "lg",
      csv: (s) => sizingText(s.sizing),
      cell: (s) => (
        <span className="whitespace-nowrap text-[12.5px] text-fg-2">
          {sizingText(s.sizing)}
          {(s.maxLot !== null || s.excludedSymbols.length > 0) && (
            <span className="k-num block text-[11px] text-fg-3">
              {[s.maxLot !== null ? `max ${formatNumber(s.maxLot, 2)} lot` : "", s.excludedSymbols.length ? `${s.excludedSymbols.length} excluded` : ""].filter(Boolean).join(" · ")}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "al",
      header: "Allocation / net deposits",
      align: "right",
      hideOn: "xl",
      sort: (s) => s.allocation,
      csv: (s) => `${s.allocation} / ${s.netDeposits}`,
      cell: (s) => (
        <span className="k-num whitespace-nowrap">
          {usd(s.allocation, 0)}
          <span className="block text-[11px] text-fg-3">net {usd(s.netDeposits)}</span>
        </span>
      ),
    },
    { key: "e", header: "Equity", align: "right", sort: (s) => s.equity, csv: (s) => s.equity, cell: (s) => <Money value={s.equity} countUp={false} className="text-[13px] font-medium" /> },
    {
      key: "p",
      header: "P&L / return",
      align: "right",
      sort: (s) => s.profit,
      csv: (s) => `${s.profit} / ${s.returnPct}%`,
      cell: (s) => (
        <span className="whitespace-nowrap">
          <span className={cn("k-num block font-medium", pnlClass(s.profit))}>{signedUsd(s.profit)}</span>
          <Pct value={s.returnPct} className="text-[11px]" />
        </span>
      ),
    },
    {
      key: "f",
      header: "Fee",
      hideOn: "lg",
      sort: (s) => s.perfFeePct,
      csv: (s) => `${s.perfFeePct}% ${s.feePeriod}`,
      cell: (s) => (
        <span className="k-num whitespace-nowrap text-[12.5px]">
          {s.perfFeePct}%<span className="block text-[11px] text-fg-3">{PERIOD_LABEL[s.feePeriod] ?? s.feePeriod}</span>
        </span>
      ),
    },
    {
      key: "fp",
      header: "Fees pending",
      align: "right",
      hideOn: "xl",
      sort: (s) => s.feesPending,
      csv: (s) => s.feesPending,
      cell: (s) => (
        <span className={cn("k-num whitespace-nowrap", s.feesPending ? "text-fg" : "text-fg-3")} title={s.nextFeeAt ? `Next settlement ${when(s.nextFeeAt)}` : undefined}>
          {usd(s.feesPending)}
          {s.status !== "stopped" && s.nextFeeAt && <span className="block text-[11px] text-fg-3">next {ago(s.nextFeeAt, now)}</span>}
        </span>
      ),
    },
    { key: "sl", header: "Auto SL", align: "right", hideOn: "xl", sort: (s) => s.autoSlPips ?? -1, csv: (s) => s.autoSlPips ?? "", cell: (s) => <span className={cn("k-num whitespace-nowrap", s.autoSlPips ? "text-fg-2" : "text-fg-3")}>{s.autoSlPips ? `${formatNumber(s.autoSlPips, s.autoSlPips % 1 ? 1 : 0)} pips` : "—"}</span> },
    {
      key: "o",
      header: "Open",
      align: "right",
      hideOn: "md",
      sort: (s) => s.positions + s.orders,
      csv: (s) => s.positions,
      cell: (s) => (
        <span className={cn("k-num", s.positions + s.orders ? "text-fg" : "text-fg-3")} title={`${s.positions} positions · ${s.orders} pending orders`}>
          {s.positions}
          {s.orders ? <span className="text-fg-3"> + {s.orders}</span> : null}
        </span>
      ),
    },
    {
      key: "t",
      header: "Since",
      align: "right",
      hideOn: "lg",
      sort: (s) => Date.parse(s.createdAt),
      csv: (s) => s.createdAt,
      cell: (s) => (
        <span className="whitespace-nowrap text-[12px] text-fg-2" title={when(s.createdAt)}>
          {day(s.createdAt)}
          {s.stoppedAt && <span className="block text-[11px] text-fg-3">stopped {day(s.stoppedAt)}</span>}
        </span>
      ),
    },
    { key: "r", header: "Stop reason", hideOn: "xl", csv: (s) => stopReasonText(s.stopReason), cell: (s) => <span className="line-clamp-2 max-w-44 text-[12px] text-fg-3">{stopReasonText(s.stopReason) || "—"}</span> },
    ...(canWrite
      ? [
          {
            key: "x",
            header: "",
            align: "right" as const,
            cell: (s: FollowerSub) =>
              s.status !== "stopped" ? (
                <span onClick={(e) => e.stopPropagation()}>
                  <Button size="xs" variant="down-outline" onClick={() => stop(s)}>
                    <Square /> Stop copying
                  </Button>
                </span>
              ) : null,
          },
        ]
      : []),
  ];

  const f = d?.followers;
  const fee = (k: FeeState) => d?.fees[k] ?? { count: 0, amount: 0 };
  const flagged = f ? f.attention + f.pendingTerms : 0;
  const skipRate = d?.steps.skipRatePct ?? 0;
  const bothDown = !!(dash.error && !d && subs.error && !subs.data);

  return (
    <div className="pb-16">
      <PageHeader
        title="Followers"
        subtitle="All copy subscriptions across masters, with copy-trading health: assets copied, skipped copies, fees and follower P&L"
        actions={
          <>
            {!canWrite && <ReadOnlyNote what="stop subscriptions" />}
            <Segmented
              size="sm"
              value={win}
              onChange={setWin}
              options={[
                { value: "7", label: "7d" },
                { value: "30", label: "30d" },
                { value: "90", label: "90d" },
              ]}
            />
            <Button variant="surface" onClick={reload}>
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />

      {bothDown ? (
        <SocialError error={dash.error!} onRetry={reload} />
      ) : (
        <>
          {dash.error && !d ? (
            <SocialError error={dash.error} onRetry={dash.reload} />
          ) : (
            <div className={cn("transition-opacity", stale && "opacity-60")}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Copied AUM" icon={<Wallet />} value={d ? <Money value={d.aum} decimals={0} /> : <span className="k-num">—</span>} chip={d ? `Equity of copy accounts · ${int(d.masters)} masters` : "Loading"} />
                <KpiCard
                  label="Copying followers"
                  icon={<Users />}
                  value={<span className="k-num">{f ? int(f.copying) : "—"}</span>}
                  footer={
                    f ? (
                      <div className="flex flex-wrap gap-1.5">
                        <Chip size="sm">+{int(f.paused)} paused</Chip>
                        {flagged > 0 ? (
                          <button type="button" onClick={showAttention} className="rounded-full" aria-label="Show followers that need attention">
                            <Chip size="sm" tone="warn">
                              {int(flagged)} need attention
                            </Chip>
                          </button>
                        ) : (
                          <Chip size="sm">{int(f.stopped)} stopped</Chip>
                        )}
                      </div>
                    ) : undefined
                  }
                  chip={f ? undefined : "Loading"}
                  delay={0.05}
                />
                <KpiCard
                  label={`Skip rate · ${win}d`}
                  icon={<AlertTriangle />}
                  value={<span className="k-num">{d ? `${formatNumber(skipRate, 1)}%` : "—"}</span>}
                  chip={d ? `${int(d.steps.skipped + d.steps.failed)} of ${int(d.steps.total)} copies not placed` : "Loading"}
                  chipTone={d && skipRate > 10 ? "down" : d && skipRate > 3 ? "warn" : "neutral"}
                  delay={0.1}
                />
                <KpiCard
                  label="Copy fees pending"
                  icon={<HandCoins />}
                  value={<span className="k-num">{d ? usd(fee("pending").amount) : "—"}</span>}
                  chip={d ? `${int(fee("pending").count)} pending · ${usd(fee("approved").amount)} approved` : "Loading"}
                  chipTone={d && fee("pending").count ? "warn" : "neutral"}
                  href="/social/payouts"
                  delay={0.15}
                />
              </div>

              {!d ? (
                <DashboardSkeleton />
              ) : (
                <>
                  <Reveal delay={0.1} className="mt-4">
                    <SkipReasonsCard d={d} />
                  </Reveal>
                  <Reveal delay={0.15} className="mt-4">
                    <ByMasterCard d={d} onMaster={showMaster} />
                  </Reveal>
                </>
              )}
            </div>
          )}

          <Reveal delay={0.2} className="mt-4">
            <div ref={tableRef} className="scroll-mt-20">
              <Card>
                <CardHeader
                  title="Copy subscriptions"
                  subtitle="Every follower of every master. Stopping a subscription closes the trades it copied."
                  action={
                    subs.data ? (
                      <Chip size="sm">
                        {int(rows.length)} of {int(items.length)}
                      </Chip>
                    ) : undefined
                  }
                />
                <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
                  {subs.error && !subs.data ? (
                    <SocialError error={subs.error} onRetry={subs.reload} className="border-0 shadow-none" />
                  ) : !subs.data ? (
                    <TableSkeleton />
                  ) : (
                    <DataTable
                      columns={cols}
                      rows={rows}
                      dense
                      pageSize={25}
                      rowKey={(s) => String(s.id)}
                      search={(s) => `${s.id} ${s.userId ?? ""} ${s.login} ${s.master?.nickname ?? ""} ${s.masterId} ${s.status} ${flags(s).join(" ")} ${stopReasonText(s.stopReason)}`}
                      searchPlaceholder="Subscription, user, login, master…"
                      exportName="followers"
                      empty={
                        <EmptyState
                          illustration="busts_in_silhouette"
                          title={items.length ? "No followers match" : "No copy subscriptions yet"}
                          text={items.length ? "Try another master, status or turn off Needs attention." : "Subscriptions appear here once clients follow a master in the Client Area."}
                        />
                      }
                      toolbar={
                        <div className="flex flex-wrap items-center gap-2">
                          <FilterSelect label="Master" value={master} onChange={setMaster} options={masterOptions} />
                          <Segmented
                            size="xs"
                            value={tab}
                            onChange={setTab}
                            options={(["all", "active", "paused", "stopped"] as const).map((t) => ({
                              value: t,
                              label: (
                                <>
                                  {t === "all" ? "All" : t[0].toUpperCase() + t.slice(1)}
                                  <span className="k-num text-fg-3">{count(t)}</span>
                                </>
                              ),
                            }))}
                          />
                          <label className={cn("flex h-9 cursor-pointer items-center gap-2 rounded-full border bg-surface-2 pl-3.5 pr-1.5 text-[12.5px]", attention ? "border-warn/40 text-fg" : "border-line text-fg-3")}>
                            Needs attention
                            {attentionCount > 0 && (
                              <Chip size="sm" tone="warn">
                                {attentionCount}
                              </Chip>
                            )}
                            <Toggle checked={attention} onChange={setAttention} label="Needs attention" />
                          </label>
                        </div>
                      }
                    />
                  )}
                </div>
              </Card>
            </div>
          </Reveal>
        </>
      )}
      {act.node}
    </div>
  );
}
