"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Check, FilePlus2, Lock, RefreshCw, RotateCw, ShieldAlert, Wallet, X } from "lucide-react";
import { Button, Card, DataTable, Dialog, Money, PageHeader, Reveal, Segmented, Skeleton, Tooltip, type Column } from "@ezymex/ui";
import { MiniStat, Section } from "@/components/config/kit";
import { Pager, TableSkeleton, ago, useApi, useNow, when } from "@/components/live/kit";
import { S, stakingSend, type Overview, type PlanSum, type Preview, type PreviewLine, type Settlement, type SettlementDetail, type SettlementLine, type SettlementStatus, type SettlementsDoc } from "./api";
import {
  Amount,
  ClientLink,
  EmptyNote,
  LINE_STATUS,
  LinkButton,
  Note,
  ReadOnlyNote,
  SETTLEMENT_STATUS,
  StakingError,
  StatusPill,
  amt,
  money,
  int,
  isPeriod,
  monthName,
  pct,
  periodOf,
  shiftPeriod,
  usePerms,
  useReasonAction,
  useUrlParam,
} from "./kit";

type Tab = "all" | SettlementStatus;
const TABS: Tab[] = ["all", "pending_approval", "approved", "paid", "partially_paid", "rejected"];
const PER = 25;

type Perms = ReturnType<typeof usePerms>;

/* ------------------------------------------------------------------ */
/* Shared tables                                                        */
/* ------------------------------------------------------------------ */

function PlanTable({ plans, currency }: { plans: PlanSum[]; currency: string }) {
  const cols: Column<PlanSum>[] = [
    { key: "n", header: "Plan", cell: (p) => <span className="text-[13px] font-medium">{p.name}</span>, csv: (p) => p.name },
    { key: "r", header: "Rate", align: "right", cell: (p) => (p.ratePct === null ? <span className="text-[12px] text-warn">Not set</span> : <span className="k-num">{pct(p.ratePct)}</span>), csv: (p) => p.ratePct ?? "" },
    { key: "l", header: "Lines", align: "right", cell: (p) => <span className="k-num">{int(p.lines)}</span>, csv: (p) => p.lines },
    { key: "p", header: "Principal", align: "right", hideOn: "sm", cell: (p) => <Amount value={p.principal} currency={currency} className="text-[12.5px] text-fg-2" />, csv: (p) => p.principal },
    { key: "a", header: "Returns", align: "right", cell: (p) => <Amount value={p.amount} currency={currency} className="text-[13px] font-medium" />, csv: (p) => p.amount },
  ];
  return <DataTable columns={cols} rows={plans} pageSize={20} dense rowKey={(p) => String(p.planId)} empty={<EmptyNote title="No plans" />} />;
}

function lineCols<L extends PreviewLine>(extra: Column<L>[] = []): Column<L>[] {
  return [
    { key: "c", header: "Client", cell: (l) => <ClientLink id={l.userId} name={l.userName} sub={`pos ${l.positionId}`} className="max-w-48" />, csv: (l) => `${l.userName} #${l.userId}`, sort: (l) => l.userName.toLowerCase() },
    { key: "p", header: "Plan", hideOn: "md", cell: (l) => <span className="text-[12.5px] text-fg-2">{l.planName}<span className="k-num block text-[10.5px] text-fg-3">{pct(l.ratePct)}</span></span>, csv: (l) => l.planName },
    { key: "pr", header: "Principal", align: "right", hideOn: "sm", cell: (l) => <Amount value={l.principal} currency={l.currency} className="text-[12.5px] text-fg-2" />, csv: (l) => l.principal, sort: (l) => l.principal },
    { key: "d", header: "Days", align: "right", hideOn: "lg", cell: (l) => <span className="k-num text-[12.5px] text-fg-2">{l.daysActive}/{l.daysInMonth}</span>, csv: (l) => `${l.daysActive}/${l.daysInMonth}` },
    { key: "a", header: "Return", align: "right", cell: (l) => <Amount value={l.amount} currency={l.currency} className="text-[13px] font-medium" />, csv: (l) => l.amount, sort: (l) => l.amount },
    ...extra,
  ];
}

/** Transfer state of one line, stated plainly. */
function TransferState({ l, now }: { l: SettlementLine; now: number }) {
  if (l.status === "paid")
    return (
      <span className="block text-[11px] text-fg-3">
        Credited {l.paidAt ? ago(l.paidAt, now) : ""}
        {l.walletTxn && <span className="block max-w-44 truncate font-mono">txn {l.walletTxn}</span>}
      </span>
    );
  if (l.status === "transfer_pending")
    return (
      <span className="block text-[11px] text-fg-3">
        {l.attempts > 0 ? (
          <>
            Wallet unavailable, retrying · attempt {l.attempts}
            {l.nextAttemptAt ? `, next ${ago(l.nextAttemptAt, now)}` : ""}
            {l.lastError && (
              <span className="block max-w-56 truncate text-warn" title={l.lastError}>
                {l.lastError}
              </span>
            )}
          </>
        ) : (
          "Queued for the wallet"
        )}
      </span>
    );
  if (l.status === "failed")
    return (
      <span className="block max-w-56 text-[11px] text-down" title={l.lastError ?? undefined}>
        Wallet refused after {l.attempts} attempt{l.attempts === 1 ? "" : "s"}
        {l.lastError ? `: ${l.lastError}` : ""}
      </span>
    );
  return null;
}

/* ------------------------------------------------------------------ */
/* Settlement drawer                                                    */
/* ------------------------------------------------------------------ */

function SettlementDrawer({ id, perms, onClose, onChanged }: { id: number | null; perms: Perms; onClose: () => void; onChanged: () => void }) {
  const now = useNow();
  const act = useReasonAction();
  const [live, setLive] = React.useState(false);
  const { data, error, reload } = useApi<SettlementDetail>(id !== null ? S(`settlements/${id}`) : null, { refreshMs: live ? 15_000 : 60_000 });
  const d = data && data.settlement.id === id ? data : null;
  const b = d?.settlement;
  const cur = d?.lines[0]?.currency ?? "USDT";
  const failed = d?.lines.filter((l) => l.status === "failed").length ?? 0;
  const waiting = d?.lines.filter((l) => l.status === "transfer_pending").length ?? 0;
  const paid = d?.lines.filter((l) => l.status === "paid").length ?? 0;
  const mine = !!b && !!perms.actorId && b.createdById === perms.actorId;
  React.useEffect(() => setLive(!!b && (b.status === "approved" || waiting > 0)), [b, waiting]);

  const done = () => {
    reload();
    onChanged();
  };

  const approve = () =>
    b &&
    act.ask<SettlementDetail>({
      title: `Approve the ${monthName(b.period)} settlement`,
      description: `Pays ${amt(b.total, cur)} to ${int(b.investors)} investor${b.investors === 1 ? "" : "s"}. Each return is credited to the client's wallet by the background worker; if the wallet is unreachable the transfer waits and retries automatically, and nobody is paid twice.`,
      body: (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Total" value={money(b.total, cur)} tone="gold" />
            <MiniStat label="Investors" value={int(b.investors)} />
            <MiniStat label="Lines" value={int(b.lines)} />
          </div>
          <div className="rounded-[14px] border border-line bg-surface-2/60 px-3.5 py-2.5 text-[12.5px]">
            {Object.values(b.rates).map((r) => (
              <div key={r.name} className="flex justify-between gap-3">
                <span className="text-fg-3">{r.name}</span>
                <span className="k-num">{pct(r.ratePct)}</span>
              </div>
            ))}
          </div>
        </div>
      ),
      confirmLabel: `Approve and pay ${amt(b.total, cur)}`,
      confirmVariant: "buy",
      placeholder: "Checked against the rates and the line totals…",
      run: (reason) => stakingSend<SettlementDetail>(`settlements/${b.id}/approve`, { reason }),
      success: `${monthName(b.period)} settlement approved`,
      failure: "Not approved",
      successDetail: (r) => `${int(r.lines.length)} return${r.lines.length === 1 ? "" : "s"} queued for the wallet · recorded in the staking audit log`,
      onDone: done,
    });

  const reject = () =>
    b &&
    act.ask<SettlementDetail>({
      title: `Reject the ${monthName(b.period)} settlement`,
      description: "Nothing is paid. The month's rates unlock so a rate can be corrected, and the month can be settled again.",
      confirmLabel: "Reject settlement",
      confirmVariant: "sell",
      placeholder: "What is wrong with it?",
      run: (reason) => stakingSend<SettlementDetail>(`settlements/${b.id}/reject`, { reason }),
      success: `${monthName(b.period)} settlement rejected`,
      failure: "Not rejected",
      successDetail: "Rates unlocked · recorded in the staking audit log",
      onDone: done,
    });

  const retry = () =>
    b &&
    act.ask<SettlementDetail>({
      title: `Retry transfers · ${monthName(b.period)}`,
      description: `${failed ? `${failed} refused` : ""}${failed && waiting ? " and " : ""}${waiting ? `${waiting} waiting` : ""} transfer${failed + waiting === 1 ? "" : "s"} go back to the wallet queue now. Credits are idempotent, so nobody is paid twice.`,
      confirmLabel: "Retry now",
      placeholder: "e.g. The client's wallet restriction was lifted",
      run: (reason) => stakingSend<SettlementDetail>(`settlements/${b.id}/retry`, { reason }),
      success: "Transfers queued again",
      failure: "Transfers not retried",
      successDetail: (r) => {
        const p = r.lines.filter((l) => l.status === "transfer_pending").length;
        return `${int(p)} line${p === 1 ? "" : "s"} waiting for the wallet · recorded in the staking audit log`;
      },
      onDone: done,
    });

  const cols = lineCols<SettlementLine>([
    {
      key: "s",
      header: "Transfer",
      cell: (l) => (
        <span className="flex flex-col items-start gap-0.5">
          <StatusPill map={LINE_STATUS} status={l.status} />
          <TransferState l={l} now={now} />
        </span>
      ),
      csv: (l) => l.status,
    },
  ]);

  const pending = b?.status === "pending_approval";
  const canRetry = !!b && (b.status === "approved" || b.status === "partially_paid") && failed + waiting > 0;

  return (
    <>
      <Dialog
        open={id !== null}
        onOpenChange={(o) => !o && onClose()}
        width={1000}
        title={b ? `${monthName(b.period)} settlement` : id !== null ? `Settlement #${id}` : ""}
        description={b ? `#${b.id} · created by ${b.createdBy || b.createdById} ${when(b.createdAt)}` : undefined}
        footer={
          b && perms.approve && (pending || canRetry) ? (
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              {pending ? (
                <>
                  {mine && <span className="mr-auto text-[11.5px] text-fg-3">You created this settlement: another staff member approves it.</span>}
                  <Button variant="down-outline" size="sm" onClick={reject}>
                    <X /> Reject
                  </Button>
                  {mine ? (
                    <Tooltip content="Four-eyes rule: a different staff member must approve the settlement you created.">
                      <span tabIndex={0}>
                        <Button variant="buy" size="sm" disabled>
                          <Lock /> Approve and pay
                        </Button>
                      </span>
                    </Tooltip>
                  ) : (
                    <Button variant="buy" size="sm" onClick={approve}>
                      <Check /> Approve and pay
                    </Button>
                  )}
                </>
              ) : (
                <Button variant="surface" size="sm" onClick={retry}>
                  <RotateCw /> Retry transfers
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        {error && !d ? (
          <StakingError error={error} onRetry={reload} />
        ) : !d || !b ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <div>
            <Section title="Summary" action={<StatusPill map={SETTLEMENT_STATUS} status={b.status} />}>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <MiniStat label="Total" value={money(b.total, cur)} tone="gold" />
                <MiniStat label="Investors" value={int(b.investors)} sub={`${int(b.lines)} line${b.lines === 1 ? "" : "s"}`} />
                <MiniStat label="Principal earning" value={money(b.principal, cur)} />
                <MiniStat
                  label="Credited"
                  value={`${int(paid)} of ${int(d.lines.length)}`}
                  sub={failed ? `${int(failed)} refused` : waiting ? `${int(waiting)} waiting` : pending ? "After approval" : b.status === "rejected" ? "Nothing paid" : "All credited"}
                  tone={failed ? "down" : b.status === "paid" ? "up" : waiting ? "warn" : undefined}
                />
              </div>

              {pending && mine && (
                <Note tone="warn" icon={<ShieldAlert />} className="mt-3">
                  You created this settlement, so you can&apos;t approve it. Four-eyes rule: a different staff member with approval rights checks the rates and the totals and approves it. You can still reject it, for example to correct a rate.
                </Note>
              )}
              {pending && !perms.approve && (
                <div className="mt-3">
                  <ReadOnlyNote what="approve settlements" />
                </div>
              )}
              {live && (
                <Note tone="info" icon={<Wallet />} className="mt-3">
                  Transferring: approved returns are credited to the clients&apos; wallets by the background worker. A line stays <b className="font-medium">pending transfer</b> while the wallet is unreachable and is retried with backoff. This view refreshes every 15 seconds.
                </Note>
              )}
              {b.status === "partially_paid" && (
                <Note tone="down" icon={<AlertTriangle />} className="mt-3">
                  The wallet refused {int(failed)} credit{failed === 1 ? "" : "s"} (for example a restricted or closed wallet). Fix the cause, then retry the transfers.
                </Note>
              )}

              <div className="mt-3 grid grid-cols-1 gap-2.5 text-[12.5px] sm:grid-cols-2">
                <div className="k-row px-3.5 py-2.5">
                  <div className="text-fg-3">
                    Created by <span className="font-medium text-fg-2">{b.createdBy || b.createdById}</span> {when(b.createdAt)}
                  </div>
                  <div className="mt-1 text-fg-2">“{b.createReason}”</div>
                </div>
                <div className="k-row px-3.5 py-2.5">
                  {b.decidedAt ? (
                    <>
                      <div className="text-fg-3">
                        {b.status === "rejected" ? "Rejected" : "Approved"} by <span className="font-medium text-fg-2">{b.decidedBy || b.decidedById}</span> {when(b.decidedAt)}
                      </div>
                      {b.decisionReason && <div className="mt-1 text-fg-2">“{b.decisionReason}”</div>}
                      {b.completedAt && <div className="mt-1 text-[11.5px] text-fg-3">Completed {when(b.completedAt)}</div>}
                    </>
                  ) : (
                    <div className="text-fg-3">Not decided yet. Approval pays every line; rejection unlocks the month&apos;s rates.</div>
                  )}
                </div>
              </div>
            </Section>
            <Section title="Per plan">
              <PlanTable plans={d.plans} currency={cur} />
            </Section>
            <Section title="Lines" hint="One line per position that earned in the month (0 % and sub-cent returns are left out).">
              <DataTable
                columns={cols}
                rows={d.lines}
                pageSize={25}
                dense
                rowKey={(l) => String(l.id)}
                search={(l) => `${l.userName} ${l.userId} ${l.positionId} ${l.planName}`}
                searchPlaceholder="Client, position or plan…"
                exportName={`staking-settlement-${b.period}-${b.id}`}
                empty={<EmptyNote title="No lines" />}
              />
            </Section>
          </div>
        )}
      </Dialog>
      {act.node}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* New settlement: pick a closed month → preview → create               */
/* ------------------------------------------------------------------ */

function NewSettlement({ period, current, perms, onPeriod, onClose, onCreated }: { period: string | null; current: string; perms: Perms; onPeriod: (p: string) => void; onClose: () => void; onCreated: (id: number) => void }) {
  const act = useReasonAction();
  const open = period !== null;
  const months = Array.from({ length: 12 }, (_, i) => shiftPeriod(current, -1 - i));
  const { data, error, loading, reload } = useApi<Preview>(open && period ? `${S("settlements/preview")}?period=${period}` : null);
  const pv = data && data.period === period ? data : null;
  const cur = pv?.lines[0]?.currency ?? "USDT";

  const create = () =>
    pv &&
    act.ask<SettlementDetail>({
      title: `Create the ${monthName(pv.period)} settlement`,
      description: "The month's rates lock as soon as it is created. A different staff member approves it; nothing is paid until then.",
      body: (
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Returns" value={money(pv.totals.amount, cur)} tone="gold" />
          <MiniStat label="Investors" value={int(pv.totals.investors)} />
          <MiniStat label="Lines" value={int(pv.totals.lines)} />
        </div>
      ),
      confirmLabel: "Create settlement",
      placeholder: `e.g. ${monthName(pv.period)} returns at the rates set on the Monthly rates page`,
      run: (reason) => stakingSend<SettlementDetail>("settlements", { period: pv.period, reason }),
      success: (r) => `Settlement #${r.settlement.id} created`,
      failure: "Settlement not created",
      successDetail: (r) => `${amt(r.settlement.total, cur)} to ${int(r.settlement.investors)} investors · awaiting approval by another staff member`,
      onDone: (r) => onCreated(r.settlement.id),
    });

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => !o && onClose()}
        width={1000}
        title="New settlement"
        description="Pick a closed month, check the preview, then create the settlement for approval."
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-[11.5px] text-fg-3">{!perms.write ? "Your role can't create settlements" : pv && !pv.canCreate ? "Resolve the blockers first" : ""}</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            {perms.write && (
              <Button variant="ember" size="sm" disabled={!pv?.canCreate} onClick={create}>
                <FilePlus2 /> Create settlement
              </Button>
            )}
          </div>
        }
      >
        <div>
          <Section title="Month">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={period ?? ""}
                onChange={(e) => onPeriod(e.target.value)}
                aria-label="Month to settle"
                className="h-10 min-w-48 cursor-pointer rounded-[12px] border border-line bg-surface-2 px-3 text-[13.5px] text-fg outline-none focus:border-ember/50"
              >
                {(period && !months.includes(period) ? [period, ...months] : months).map((m) => (
                  <option key={m} value={m} className="bg-surface text-fg">
                    {monthName(m)}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="ghost" onClick={reload}>
                <RefreshCw /> Recalculate
              </Button>
              {pv && <span className="text-[11.5px] text-fg-3">{pv.daysInMonth} days · {pv.closed ? "closed" : `closes ${when(pv.closesAt)}`}</span>}
            </div>
          </Section>

          {error && !pv ? (
            <StakingError error={error} onRetry={reload} />
          ) : !pv ? (
            <div className="space-y-3 pt-5">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <div className={loading ? "opacity-60 transition-opacity" : undefined}>
              <Section title="Preview" action={pv.canCreate ? <span className="text-[12px] text-up">Ready to create</span> : <span className="text-[12px] text-warn">Blocked</span>}>
                {pv.blockers.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {pv.blockers.map((bl) => (
                      <Note key={bl.code} tone={bl.code === "nothing_to_settle" ? "neutral" : bl.code === "period_open" ? "info" : "warn"} icon={<AlertTriangle />}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>{bl.message}</span>
                          {bl.code === "rates_missing" && (
                            <LinkButton href={`/staking/rates?period=${pv.period}`}>
                              Set rates <ArrowUpRight />
                            </LinkButton>
                          )}
                          {bl.code === "settlement_exists" && pv.existing && (
                            <Button size="sm" variant="surface" onClick={() => onCreated(pv.existing!.id)}>
                              Open #{pv.existing.id}
                            </Button>
                          )}
                        </div>
                      </Note>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <MiniStat label="Returns" value={money(pv.totals.amount, cur)} tone="gold" />
                  <MiniStat label="Investors" value={int(pv.totals.investors)} sub={`${int(pv.totals.lines)} line${pv.totals.lines === 1 ? "" : "s"}`} />
                  <MiniStat label="Principal earning" value={money(pv.totals.principal, cur)} />
                  <MiniStat label="Left out" value={int(pv.totals.zeroLines)} sub="0 % or below a cent" />
                </div>
              </Section>
              <Section title="Per plan">
                <PlanTable plans={pv.plans} currency={cur} />
              </Section>
              <Section title="Lines" hint={pv.truncated ? `Showing the first ${int(pv.lines.length)} of ${int(pv.totals.lines)} lines; the totals cover every line.` : undefined}>
                <DataTable
                  columns={lineCols<PreviewLine>()}
                  rows={pv.lines}
                  pageSize={25}
                  dense
                  rowKey={(l) => String(l.positionId)}
                  search={(l) => `${l.userName} ${l.userId} ${l.positionId} ${l.planName}`}
                  searchPlaceholder="Client, position or plan…"
                  exportName={`staking-preview-${pv.period}`}
                  empty={<EmptyNote title="No lines" text="No position earns a return for this month." />}
                />
              </Section>
            </div>
          )}
        </div>
      </Dialog>
      {act.node}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function LiveStakingSettlements() {
  const now = useNow();
  const perms = usePerms();
  const [statusParam, setStatusParam] = useUrlParam("status");
  const tab: Tab = (TABS as string[]).includes(statusParam ?? "") ? (statusParam as Tab) : "all";
  const [page, setPage] = React.useState(1);
  const [sel, setSel] = useUrlParam("settlement");
  const [newP, setNewP] = useUrlParam("new");
  React.useEffect(() => setPage(1), [tab]);
  const { data, error, loading, reload } = useApi<SettlementsDoc>(`${S("settlements")}?page=${page}&limit=${PER}${tab !== "all" ? `&status=${tab}` : ""}`, { refreshMs: 30_000 });
  const { data: ov, reload: reloadOv } = useApi<Overview>(S("overview"), { refreshMs: 60_000 });
  const selId = sel && /^\d+$/.test(sel) ? Number(sel) : null;
  const current = ov?.currentPeriod ?? periodOf();
  const lastClosed = shiftPeriod(current, -1);
  const newPeriod = newP === null ? null : isPeriod(newP) ? newP : lastClosed;
  const cur = ov?.currencies[0] ?? "USDT";
  const refresh = () => {
    reload();
    reloadOv();
  };

  const cols: Column<Settlement>[] = [
    {
      key: "m",
      header: "Month",
      cell: (b) => (
        <span>
          <span className="block text-[13px] font-medium">{monthName(b.period)}</span>
          <span className="font-mono text-[11px] text-fg-3">#{b.id}</span>
        </span>
      ),
      csv: (b) => b.period,
    },
    { key: "n", header: "Investors", align: "right", cell: (b) => <span className="k-num">{int(b.investors)}<span className="block text-[10.5px] text-fg-3">{int(b.lines)} line{b.lines === 1 ? "" : "s"}</span></span>, csv: (b) => b.investors },
    { key: "p", header: "Principal", align: "right", hideOn: "lg", cell: (b) => <Amount value={b.principal} currency={cur} className="text-[12.5px] text-fg-2" />, csv: (b) => b.principal },
    { key: "t", header: "Returns", align: "right", cell: (b) => <span className="block"><Money value={b.total} currency="" countUp={false} className="font-medium" /><span className="block text-[10.5px] text-fg-3">{cur}</span></span>, csv: (b) => b.total },
    {
      key: "tr",
      header: "Transfers",
      hideOn: "md",
      cell: (b) =>
        b.transfers && b.status !== "pending_approval" && b.status !== "rejected" ? (
          <span className="k-num text-[12px] text-fg-2">
            <span className="text-up">{b.transfers.paid} credited</span>
            {b.transfers.pending > 0 && <span className="text-info"> · {b.transfers.pending} waiting</span>}
            {b.transfers.failed > 0 && <span className="text-down"> · {b.transfers.failed} refused</span>}
          </span>
        ) : (
          <span className="text-[12px] text-fg-3">—</span>
        ),
    },
    {
      key: "s",
      header: "Status",
      cell: (b) => (
        <span className="flex flex-col items-start gap-0.5">
          <StatusPill map={SETTLEMENT_STATUS} status={b.status} />
          {b.status === "pending_approval" && perms.actorId && b.createdById === perms.actorId ? (
            <span className="text-[10.5px] text-warn">Created by you</span>
          ) : (
            b.decidedBy && <span className="max-w-36 truncate text-[10.5px] text-fg-3">{b.decidedBy}</span>
          )}
        </span>
      ),
      csv: (b) => b.status,
    },
    {
      key: "c",
      header: "Created",
      align: "right",
      hideOn: "md",
      cell: (b) => (
        <span className="whitespace-nowrap text-[11.5px] text-fg-3" title={when(b.createdAt)}>
          {ago(b.createdAt, now)}
          <span className="block max-w-32 truncate">{b.createdBy}</span>
        </span>
      ),
      csv: (b) => b.createdAt,
    },
  ];

  const lp = ov?.lastPeriod;

  return (
    <div className="pb-16">
      <PageHeader
        title="Monthly settlements"
        subtitle="One settlement per closed month pays every position's return. A second staff member approves it before anything is credited."
        actions={
          <>
            {perms.loaded && !perms.approve && <ReadOnlyNote what="approve settlements" />}
            <Button variant="surface" onClick={refresh}>
              <RefreshCw /> Refresh
            </Button>
            {perms.write && (
              <Button variant="ember" onClick={() => setNewP(lastClosed)}>
                <FilePlus2 /> New settlement
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Awaiting approval" value={ov ? int(ov.attention.pendingApproval) : "—"} sub="Four-eyes: not by their creator" tone={ov?.attention.pendingApproval ? "warn" : undefined} />
        <MiniStat label="Transfers waiting" value={ov ? int(ov.attention.pendingLines) : "—"} sub="Queued or retrying" tone={ov?.attention.pendingLines ? "warn" : undefined} />
        <MiniStat label="Transfers refused" value={ov ? int(ov.attention.failedLines) : "—"} sub="Retry from the settlement" tone={ov?.attention.failedLines ? "down" : undefined} />
        <button type="button" className="text-left" onClick={() => (lp?.existing ? setSel(String(lp.existing.id)) : lp && setNewP(lp.period))} disabled={!lp}>
          <MiniStat
            className="h-full hover:bg-surface-3/60"
            label={lp ? monthName(lp.period) : "Last closed month"}
            value={!lp ? "—" : lp.existing ? (SETTLEMENT_STATUS[lp.existing.status]?.label ?? lp.existing.status) : lp.ratesMissing.length ? "Rates missing" : lp.canCreate ? "Ready to settle" : "Nothing to settle"}
            sub={lp ? (lp.existing ? `Settlement #${lp.existing.id}` : `${amt(lp.totals.amount, cur)} estimated`) : undefined}
            tone={lp?.existing ? (lp.existing.status === "paid" ? "up" : "warn") : lp?.ratesMissing.length ? "warn" : lp?.canCreate ? "gold" : undefined}
          />
        </button>
      </div>

      <Reveal delay={0.05}>
        <Card className="mt-4 p-4 sm:p-6">
          <div className="mb-3 overflow-x-auto">
            <Segmented
              size="xs"
              value={tab}
              onChange={(v) => setStatusParam(v === "all" ? null : v)}
              options={[
                { value: "all", label: "All" },
                { value: "pending_approval", label: "Awaiting approval" },
                { value: "approved", label: "Transferring" },
                { value: "paid", label: "Paid" },
                { value: "partially_paid", label: "Partly paid" },
                { value: "rejected", label: "Rejected" },
              ]}
            />
          </div>
          {error && !data ? (
            <StakingError error={error} onRetry={reload} />
          ) : !data ? (
            <TableSkeleton />
          ) : (
            <div className={loading ? "opacity-60 transition-opacity" : undefined}>
              <DataTable
                columns={cols}
                rows={data.items}
                pageSize={PER}
                dense
                rowKey={(b) => String(b.id)}
                onRowClick={(b) => setSel(String(b.id))}
                empty={
                  <EmptyNote
                    className="mt-3"
                    title={tab === "all" ? "No settlements yet" : `No ${SETTLEMENT_STATUS[tab as SettlementStatus]?.label.toLowerCase() ?? ""} settlements`}
                    text={tab === "all" ? "Once a month is over and every earning plan has its rate, create the month's settlement here." : undefined}
                    action={
                      tab === "all" && perms.write ? (
                        <Button size="sm" variant="ember" onClick={() => setNewP(lastClosed)}>
                          <FilePlus2 /> New settlement
                        </Button>
                      ) : undefined
                    }
                  />
                }
              />
              <Pager page={page} perPage={PER} total={data.total} onPage={setPage} />
            </div>
          )}
        </Card>
      </Reveal>

      <div className="mt-3 text-[12px] text-fg-3">
        Rates come from{" "}
        <Link href="/staking/rates" className="text-fg-2 hover:text-ember">
          Monthly rates
        </Link>
        ; a month&apos;s rates lock while its settlement exists. Reject a settlement to change a rate.
      </div>

      <SettlementDrawer id={selId} perms={perms} onClose={() => setSel(null)} onChanged={refresh} />
      <NewSettlement
        period={newPeriod}
        current={current}
        perms={perms}
        onPeriod={(p) => setNewP(p)}
        onClose={() => setNewP(null)}
        onCreated={(id) => {
          setNewP(null);
          refresh();
          setSel(String(id));
        }}
      />
    </div>
  );
}
