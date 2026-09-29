"use client";

import * as React from "react";
import Link from "next/link";
import { Check, CheckCircle2, RefreshCw, Settings2, X, XCircle } from "lucide-react";
import { Button, Card, CardHeader, Chip, CopyButton, EmptyState, PageHeader, Reveal, Segmented, Sparkline, cn } from "@kalks/ui";
import { MiniStat, SegBar } from "@/components/config/kit";
import { TableSkeleton, ago, day, useApi, useNow, when } from "@/components/live/kit";
import { PERIOD_LABEL, Pct, ProgramChip, ReadOnlyNote, SocialError, SocialStatus, int, socialWrite, useNoteAction, useSocialCan, usd, type MasterView, type Overview, type SocialSettings } from "./kit";

type Check = { label: string; ok: boolean; value: string };

function checks(a: MasterView, s: Partial<SocialSettings> | undefined): Check[] {
  const eq = a.stats?.equity ?? null;
  const days = a.ageDays ?? null;
  const out: Check[] = [{ label: "KYC verified", ok: !!a.kycVerified, value: a.kycVerified ? "Verified" : "Not verified" }];
  if (s?.minTrackDays !== undefined) out.push({ label: `${s.minTrackDays}+ days track record`, ok: days !== null && days >= s.minTrackDays, value: days === null ? "Unknown" : `${days} days` });
  if (s?.minMasterEquity !== undefined) out.push({ label: `Equity at least ${usd(s.minMasterEquity, 0)}`, ok: eq !== null && eq >= s.minMasterEquity, value: usd(eq, 2) });
  if (s?.feeMinPct !== undefined && s?.feeMaxPct !== undefined) out.push({ label: `Fee within ${s.feeMinPct}–${s.feeMaxPct}%`, ok: a.perfFeePct >= s.feeMinPct && a.perfFeePct <= s.feeMaxPct, value: `${a.perfFeePct}%` });
  return out;
}

function Detail({ a, settings, canApprove, onDone }: { a: MasterView; settings: Partial<SocialSettings> | undefined; canApprove: boolean; onDone: () => void }) {
  const act = useNoteAction();
  const list = checks(a, settings);
  const pass = list.filter((c) => c.ok).length;
  const allOk = pass === list.length;
  const pending = a.status === "pending";
  const spark = a.stats?.spark ?? [];
  const review = (decision: "approve" | "reject") =>
    act.ask({
      title: decision === "approve" ? (allOk ? `Approve ${a.nickname}` : `Approve ${a.nickname} with exception`) : `Reject ${a.nickname}`,
      description:
        decision === "approve"
          ? allOk
            ? "The master profile goes live on the leaderboard. Daily statistics are backfilled from the account's ledger."
            : `${list.length - pass} check(s) are not met. Approving anyway is logged with your reason.`
          : "The applicant sees the rejection with your reason and may apply again.",
      confirmLabel: decision === "approve" ? "Approve" : "Reject",
      confirmVariant: decision === "approve" ? "buy" : "sell",
      notePlaceholder: decision === "approve" ? "Why is this master approved?" : "Reason shown to the applicant",
      run: (note) => socialWrite(`admin/masters/${a.id}/review`, { decision, note }),
      success: `${a.nickname} ${decision === "approve" ? "approved" : "rejected"}`,
      onDone,
    });

  return (
    <Card className="h-full">
      <div className="flex flex-col gap-4 border-b border-line px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[18px] font-medium tracking-tight">
            {a.nickname}
            <ProgramChip program={a.program} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-fg-3">
            {a.strategy || "—"} · user {a.userId ? `#${a.userId}` : "—"} · login <span className="font-mono">{a.login ?? "—"}</span>
            {a.login ? <CopyButton value={String(a.login)} label="Login" /> : null} · applied {when(a.createdAt)}
          </div>
        </div>
        <SocialStatus status={a.status} />
      </div>
      <div className="grid grid-cols-1 gap-6 px-6 py-5 lg:grid-cols-2">
        <div>
          <div className="k-label mb-2">Strategy description</div>
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-fg-2">{a.description || "No description provided."}</p>
          {spark.length > 1 && (
            <div className="mt-4">
              <div className="k-label mb-1.5">Account equity trend</div>
              <Sparkline data={spark} width={320} height={64} tone={spark.at(-1)! >= spark[0]! ? "gold" : "down"} />
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MiniStat label="Equity" value={usd(a.stats?.equity ?? null)} />
            <MiniStat label="Track record" value={a.ageDays === null || a.ageDays === undefined ? "—" : `${a.ageDays} days`} />
            <MiniStat label="Trades" value={int(a.stats?.trades ?? null)} sub={a.stats?.winRate !== null && a.stats?.winRate !== undefined ? `${a.stats.winRate.toFixed(1)}% win rate` : undefined} />
            <MiniStat label="Performance fee" value={`${a.perfFeePct}%`} sub={`${PERIOD_LABEL[a.feePeriod] ?? a.feePeriod} settlement`} />
            <MiniStat label="Min allocation" value={usd(a.minAllocation, 0)} />
            <MiniStat label="Return (all)" value={<Pct value={a.stats?.returnAll ?? null} decimals={1} />} />
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="k-label">Requirements</span>
            <span className={cn("k-num text-[12px] font-medium", allOk ? "text-up" : "text-warn")}>
              {pass} / {list.length} met
            </span>
          </div>
          <SegBar value={pass} total={list.length} tone={allOk ? "up" : pass >= list.length - 1 ? "warn" : "down"} className="mb-3" />
          <div className="space-y-1.5">
            {list.map((c) => (
              <div key={c.label} className={cn("flex items-center gap-3 rounded-[12px] border px-3.5 py-2.5", c.ok ? "border-line bg-surface-2" : "border-down/30 bg-down-soft")}>
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", c.ok ? "bg-up-soft text-up" : "bg-down/20 text-down")}>{c.ok ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}</span>
                <span className="flex-1 text-[13px] text-fg">{c.label}</span>
                <span className={cn("k-num text-[12px]", c.ok ? "text-fg-3" : "text-down")}>{c.value}</span>
              </div>
            ))}
          </div>
          {!pending && (
            <div className="mt-4 rounded-[12px] border border-line bg-surface-2 px-3.5 py-2.5 text-[12.5px] text-fg-2">
              <span className="text-fg-3">Decision{a.reviewedBy ? ` by ${a.reviewedBy}` : ""}:</span> {a.reviewNote || "No note"}
            </div>
          )}
          {pending && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {canApprove ? (
                <>
                  <Button variant={allOk ? "buy" : "surface"} size="sm" onClick={() => review("approve")}>
                    <CheckCircle2 /> {allOk ? "Approve" : "Approve with exception"}
                  </Button>
                  <Button variant="down-outline" size="sm" onClick={() => review("reject")}>
                    <XCircle /> Reject
                  </Button>
                </>
              ) : (
                <ReadOnlyNote what="review applications" />
              )}
            </div>
          )}
        </div>
      </div>
      {act.node}
    </Card>
  );
}

export function LiveApplicationsPage() {
  const now = useNow();
  const canApprove = useSocialCan("social.approve");
  const { data, error, reload } = useApi<{ items: MasterView[] }>("/api/social/admin/masters", { refreshMs: 30_000 });
  const ov = useApi<Overview>("/api/social/admin/overview");
  const [tab, setTab] = React.useState<"open" | "decided">("open");
  const [sel, setSel] = React.useState<number | null>(null);
  const all = React.useMemo(() => [...(data?.items ?? [])].sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? "") || b.id - a.id), [data]);
  const open = all.filter((a) => a.status === "pending").sort((a, b) => Date.parse(a.createdAt ?? "") - Date.parse(b.createdAt ?? ""));
  const decided = all.filter((a) => a.status !== "pending");
  const view = tab === "open" ? open : decided;
  const a = view.find((x) => x.id === sel) ?? view[0] ?? null;
  const settings = ov.data?.settings;
  const passAll = open.filter((x) => checks(x, settings).every((c) => c.ok)).length;

  return (
    <div className="pb-16">
      <PageHeader
        title="Master applications"
        subtitle="Clients applying to become copy-trading or PAMM masters"
        actions={
          <>
            <Button variant="surface" onClick={reload}>
              <RefreshCw /> Refresh
            </Button>
            <Link href="/social/settings">
              <Button variant="surface">
                <Settings2 /> Requirements
              </Button>
            </Link>
          </>
        }
      />
      {error && !data ? (
        <SocialError error={error} onRetry={reload} />
      ) : (
        <>
          <Reveal>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MiniStat label="Awaiting decision" value={data ? open.length : "—"} sub={data ? `${passAll} meet every requirement` : undefined} />
              <MiniStat label="Approved" value={data ? all.filter((x) => x.status === "approved").length : "—"} tone="up" />
              <MiniStat label="Rejected" value={data ? all.filter((x) => x.status === "rejected").length : "—"} />
              <MiniStat label="Oldest waiting" value={open[0] ? ago(open[0].createdAt, now) : "—"} sub={open[0] ? day(open[0].createdAt) : undefined} />
            </div>
          </Reveal>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Reveal delay={0.05} className="xl:col-span-4">
              <Card className="flex h-full flex-col">
                <CardHeader title="Queue" action={<Segmented size="xs" value={tab} onChange={(v) => { setTab(v); setSel(null); }} options={[{ value: "open", label: `Open ${open.length}` }, { value: "decided", label: "History" }]} />} />
                <div className="mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
                  {!data ? (
                    <TableSkeleton rows={4} />
                  ) : (
                    view.map((x) => {
                      const c = checks(x, settings);
                      const p = c.filter((y) => y.ok).length;
                      return (
                        <button key={x.id} type="button" onClick={() => setSel(x.id)} className={cn("k-row flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-3/60", a?.id === x.id && "border-ember/40 bg-ember-soft/40")}>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-medium">{x.nickname}</div>
                            <div className="truncate text-[11.5px] text-fg-3">
                              <span className="font-mono">{x.login ?? "—"}</span> · {ago(x.createdAt, now)}
                            </div>
                            {x.status === "pending" && <SegBar value={p} total={c.length} tone={p === c.length ? "up" : p >= c.length - 1 ? "warn" : "down"} className="mt-1.5 w-24" />}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <ProgramChip program={x.program} />
                            {x.status === "pending" ? <span className="k-num text-[11px] text-fg-3">{p}/{c.length}</span> : <SocialStatus status={x.status} />}
                          </div>
                        </button>
                      );
                    })
                  )}
                  {data && view.length === 0 && <div className="py-10 text-center text-[13px] text-fg-3">{tab === "open" ? "No applications waiting." : "No decided applications yet."}</div>}
                </div>
              </Card>
            </Reveal>
            <Reveal delay={0.1} className="xl:col-span-8">
              {a ? (
                <Detail key={a.id} a={a} settings={settings} canApprove={canApprove} onDone={() => { reload(); ov.reload(); }} />
              ) : (
                <Card className="h-full">
                  <EmptyState illustration="magnifying_glass_tilted_left" title={data ? "Nothing selected" : "Loading applications"} text={data ? "Pick an application from the queue." : undefined} />
                </Card>
              )}
            </Reveal>
          </div>
          {!canApprove && (
            <div className="mt-4">
              <Chip tone="neutral">Approvals need Compliance, Admin or Super Admin</Chip>
            </div>
          )}
        </>
      )}
    </div>
  );
}
