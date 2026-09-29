"use client";

import * as React from "react";
import Link from "next/link";
import { Ban, Eye, EyeOff, HandCoins, MoreHorizontal, OctagonAlert, PlayCircle, RefreshCw, ShieldCheck, Snowflake, Square, Users, Wallet } from "lucide-react";
import { Button, Card, CardHeader, Chip, CopyButton, DataTable, Dialog, DialogClose, EmptyState, EquityChart, IconButton, KpiCard, ListRow, Menu, PageHeader, Reveal, Segmented, Sparkline, cn, type Column } from "@kalks/ui";
import { MiniStat, Section } from "@/components/config/kit";
import { TableSkeleton, ago, day, useApi, useNow, when } from "@/components/live/kit";
import { AuditNotice, Checkbox, ErrorBanner } from "@/components/trading-desk/kit";
import { toast } from "sonner";
import { PERIOD_LABEL, Pct, ProgramChip, Risk10, SocialError, SocialStatus, ddTone, int, socialWrite, useNoteAction, useSocialCan, usd, usdK, type MasterDetail, type MasterView, type Overview, type SubscriptionView } from "./kit";

type StatusTab = "all" | "approved" | "pending" | "suspended" | "rejected" | "hidden" | "frozen";
const SERVER_STATUS: StatusTab[] = ["approved", "pending", "suspended", "rejected"];

const st = (m: MasterView) => m.stats ?? {};

/* ------------------------------------------------------------------ */
/* Actions shared by the table menu and the drawer                     */
/* ------------------------------------------------------------------ */

function useMasterActions(reload: () => void) {
  const act = useNoteAction();
  const [emergency, setEmergency] = React.useState<MasterView | null>(null);

  const status = (m: MasterView, action: "suspend" | "reinstate" | "hide" | "unhide") => {
    const copy = {
      suspend: { title: `Suspend ${m.nickname}`, description: "The master is removed from the leaderboard and can't take new followers or investors. Existing subscriptions are not stopped — use Emergency stop for that.", label: "Suspend master", variant: "sell" as const, done: "suspended" },
      reinstate: { title: `Reinstate ${m.nickname}`, description: "The master becomes approved again and is listed on the leaderboard unless hidden.", label: "Reinstate", variant: "buy" as const, done: "reinstated" },
      hide: { title: `Hide ${m.nickname} from the leaderboard`, description: "Existing followers keep copying; the master is removed from rankings and search.", label: "Hide", variant: "ember" as const, done: "hidden from the leaderboard" },
      unhide: { title: `Show ${m.nickname} on the leaderboard`, description: "The master is listed again in rankings and search.", label: "Show", variant: "ember" as const, done: "shown on the leaderboard" },
    }[action];
    act.ask({
      title: copy.title,
      description: copy.description,
      confirmLabel: copy.label,
      confirmVariant: copy.variant,
      run: (note) => socialWrite(`admin/masters/${m.id}/status`, { action, note }),
      success: `${m.nickname} ${copy.done}`,
      onDone: reload,
    });
  };

  const unfreeze = (m: MasterView) =>
    act.ask({
      title: `Resume mirroring for ${m.nickname}`,
      description: "Copying restarts for every active follower. Positions closed by the emergency stop are not reopened; new master trades are mirrored from now on.",
      confirmLabel: "Unfreeze",
      confirmVariant: "buy",
      run: (note) => socialWrite(`admin/masters/${m.id}/emergency`, { freeze: false, note }),
      success: `${m.nickname} unfrozen`,
      onDone: reload,
    });

  const node = (
    <>
      {act.node}
      <EmergencyStopDialog m={emergency} open={!!emergency} onOpenChange={(o) => !o && setEmergency(null)} onDone={reload} />
    </>
  );
  return { status, unfreeze, emergency: setEmergency, node, ask: act.ask };
}

/** Emergency stop (D125): freeze mirroring for every follower, optionally close copied positions. Typed confirmation. */
function EmergencyStopDialog({ m, open, onOpenChange, onDone }: { m: MasterView | null; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [close, setClose] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setClose(false);
      setTyped("");
      setNote("");
      setError(null);
      setBusy(false);
    }
  }, [open]);
  if (!m) return null;
  const s = st(m);
  const ok = typed.trim().toUpperCase() === "STOP" && !!note.trim();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={560}
      title={
        <span className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-full border border-down/30 bg-down-soft text-down">
            <OctagonAlert className="size-4.5" />
          </span>
          Emergency stop · {m.nickname}
        </span>
      }
      description={`Master #${m.id} · takes effect immediately`}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="sell"
            size="sm"
            disabled={!ok || busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const r = await socialWrite<{ closed?: unknown[]; failed?: unknown[] }>(`admin/masters/${m.id}/emergency`, { freeze: true, closePositions: close, note: note.trim() });
              setBusy(false);
              if (!r.ok) {
                setError(r.error);
                toast.error("Rejected", { description: r.error });
                return;
              }
              const closed = Array.isArray(r.data?.closed) ? r.data.closed.length : 0;
              const failed = Array.isArray(r.data?.failed) ? r.data.failed.length : 0;
              toast.success(`Emergency stop executed on ${m.nickname}`, { description: close ? `${closed} copied positions closed${failed ? ` · ${failed} failed` : ""}` : "Mirroring frozen for every follower" });
              onDone();
              onOpenChange(false);
            }}
          >
            {busy ? "Working…" : "Execute emergency stop"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Followers" value={int(s.followers ?? 0)} />
          <MiniStat label="Investors" value={int(s.investors ?? 0)} />
          <MiniStat label="AUM affected" value={usdK(s.aum ?? 0)} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-start gap-3 rounded-[12px] border border-ember/30 bg-ember-soft/50 px-3.5 py-2.5">
            <span className="pt-0.5">
              <Checkbox checked onChange={() => {}} label="Freeze mirroring" />
            </span>
            <span>
              <span className="block text-[13px] font-medium">Freeze mirroring</span>
              <span className="block text-[11.5px] text-fg-3">No new master trade is copied to any follower until the master is unfrozen</span>
            </span>
          </div>
          <div onClick={() => setClose((v) => !v)} className={cn("flex cursor-pointer items-start gap-3 rounded-[12px] border px-3.5 py-2.5 transition-colors", close ? "border-down/40 bg-down-soft" : "border-line bg-surface-2")}>
            <span className="pt-0.5">
              <Checkbox checked={close} onChange={setClose} label="Close all copied positions" />
            </span>
            <span>
              <span className={cn("block text-[13px] font-medium", close && "text-down")}>Close all copied positions</span>
              <span className="block text-[11.5px] text-fg-3">Market-closes every follower position and order copied from this master</span>
            </span>
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
            Reason <span className="text-[11px] font-normal text-down">Required</span>
          </span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} aria-label="Reason" placeholder="What triggered this stop?" className="w-full resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] text-fg outline-none placeholder:text-fg-3 focus:border-ember/50 focus:ring-4 focus:ring-ember/10" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-fg-2">Type STOP to confirm</span>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="STOP" aria-label="Type STOP to confirm" className={cn("h-10 w-full rounded-[14px] border bg-surface-2 px-3.5 font-mono text-[13px] text-fg outline-none placeholder:text-fg-3", typed.trim().toUpperCase() === "STOP" ? "border-down/50" : "border-line")} />
        </label>
        <ErrorBanner error={error} />
        <AuditNotice />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LiveMastersPage() {
  const canWrite = useSocialCan("social.write");
  const canApprove = useSocialCan("social.approve");
  const [tab, setTab] = React.useState<StatusTab>("all");
  const [sel, setSel] = React.useState<number | null>(null);
  const serverStatus = SERVER_STATUS.includes(tab) ? tab : "";
  const ov = useApi<Overview>("/api/social/admin/overview", { refreshMs: 30_000 });
  const list = useApi<{ items: MasterView[] }>(`/api/social/admin/masters${serverStatus ? `?status=${serverStatus}` : ""}`, { refreshMs: 30_000 });
  const reload = React.useCallback(() => {
    ov.reload();
    list.reload();
  }, [ov.reload, list.reload]);
  const acts = useMasterActions(reload);

  const rows = (list.data?.items ?? []).filter((m) => (tab === "hidden" ? m.hidden : tab === "frozen" ? m.frozen : true));
  const master = (list.data?.items ?? []).find((m) => m.id === sel) ?? null;
  const o = ov.data;

  const cols: Column<MasterView>[] = [
    {
      key: "m",
      header: "Master",
      sort: (m) => m.nickname,
      csv: (m) => m.nickname,
      cell: (m) => (
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 truncate text-[13.5px] font-medium text-fg">
            {m.nickname}
            {m.house && (
              <Chip size="sm" tone="info">
                House
              </Chip>
            )}
          </span>
          <span className="block truncate text-[11.5px] text-fg-3">
            {m.strategy || "—"} · <span className="font-mono">#{m.id}</span>
          </span>
        </span>
      ),
    },
    {
      key: "u",
      header: "User · login",
      csv: (m) => `${m.userId ?? ""} ${m.login ?? ""}`,
      cell: (m) => (
        <span className="whitespace-nowrap font-mono text-[12px]">
          {m.userId ? `#${m.userId}` : "—"}
          <span className="block text-[11px] text-fg-3">{m.login ?? "—"}</span>
        </span>
      ),
    },
    { key: "p", header: "Program", cell: (m) => <ProgramChip program={m.program} /> },
    {
      key: "s",
      header: "Status",
      csv: (m) => m.status,
      cell: (m) => (
        <span className="flex flex-wrap items-center gap-1">
          <SocialStatus status={m.status} />
          {m.hidden && (
            <Chip size="sm" tone="warn">
              Hidden
            </Chip>
          )}
          {m.frozen && (
            <Chip size="sm" tone="down">
              Frozen
            </Chip>
          )}
        </span>
      ),
    },
    { key: "rs", header: "Risk", hideOn: "lg", sort: (m) => st(m).riskScore ?? 0, cell: (m) => <Risk10 score={st(m).riskScore} /> },
    {
      key: "r",
      header: "Return 1y",
      align: "right",
      sort: (m) => st(m).return1y ?? -1e9,
      csv: (m) => st(m).return1y ?? "",
      cell: (m) => (
        <span className="inline-flex items-center gap-2">
          {(st(m).spark?.length ?? 0) > 1 && <Sparkline data={st(m).spark!} width={56} height={20} fill={false} className="hidden xl:block" />}
          <Pct value={st(m).return1y} decimals={1} />
        </span>
      ),
    },
    { key: "all", header: "All time", align: "right", hideOn: "xl", sort: (m) => st(m).returnAll ?? -1e9, cell: (m) => <Pct value={st(m).returnAll} decimals={1} /> },
    { key: "dd", header: "Max DD", align: "right", hideOn: "md", sort: (m) => st(m).maxDd ?? 0, cell: (m) => <span className={cn("k-num", ddTone(st(m).maxDd))}>{st(m).maxDd === null || st(m).maxDd === undefined ? "—" : `${st(m).maxDd!.toFixed(1)}%`}</span> },
    { key: "a", header: "AUM", align: "right", sort: (m) => st(m).aum ?? 0, csv: (m) => st(m).aum ?? 0, cell: (m) => <span className="k-num font-medium">{usdK(st(m).aum ?? 0)}</span> },
    { key: "f", header: "Followers", align: "right", sort: (m) => st(m).followers ?? 0, cell: (m) => <span className="k-num">{int(st(m).followers ?? 0)}</span> },
    { key: "i", header: "Investors", align: "right", hideOn: "md", sort: (m) => st(m).investors ?? 0, cell: (m) => <span className="k-num">{int(st(m).investors ?? 0)}</span> },
    {
      key: "x",
      header: "",
      align: "right",
      width: "52px",
      cell: (m) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Menu
            trigger={
              <IconButton size="sm" aria-label="Actions">
                <MoreHorizontal />
              </IconButton>
            }
            items={[
              { label: "Open details", icon: <Eye />, onSelect: () => setSel(m.id) },
              ...(canWrite && (m.status === "approved" || m.status === "suspended")
                ? ([
                    { label: m.hidden ? "Show on leaderboard" : "Hide from leaderboard", icon: m.hidden ? <Eye /> : <EyeOff />, onSelect: () => acts.status(m, m.hidden ? "unhide" : "hide") },
                    { label: m.status === "suspended" ? "Reinstate" : "Suspend", icon: m.status === "suspended" ? <PlayCircle /> : <Ban />, onSelect: () => acts.status(m, m.status === "suspended" ? "reinstate" : "suspend") },
                    "sep",
                    m.frozen ? { label: "Unfreeze mirroring", icon: <Snowflake />, onSelect: () => acts.unfreeze(m) } : { label: "Emergency stop", icon: <OctagonAlert />, danger: true, onSelect: () => acts.emergency(m) },
                  ] satisfies React.ComponentProps<typeof Menu>["items"])
                : []),
            ]}
          />
        </span>
      ),
    },
  ];

  const watch = (list.data?.items ?? [])
    .filter((m) => m.status === "approved" && (st(m).riskScore ?? 0) > 0)
    .sort((a, b) => (st(b).riskScore ?? 0) - (st(a).riskScore ?? 0) || (st(b).currentDd ?? 0) - (st(a).currentDd ?? 0))
    .slice(0, 5);

  return (
    <div className="pb-16">
      <PageHeader
        title="Masters"
        subtitle="Copy-trading and PAMM masters, their followers and investors — on the trading engine"
        actions={
          <>
            <Button variant="surface" onClick={reload}>
              <RefreshCw /> Refresh
            </Button>
            <Link href="/social/payouts">
              <Button variant="surface">
                <HandCoins /> Fee payouts
              </Button>
            </Link>
            {canApprove && (
              <Link href="/social/applications">
                <Button variant="ember">
                  Review applications
                  {o && o.masters.pending > 0 && (
                    <Chip size="sm" tone="solid">
                      {o.masters.pending}
                    </Chip>
                  )}
                </Button>
              </Link>
            )}
          </>
        }
      />

      {ov.error && !o ? (
        <SocialError error={ov.error} onRetry={reload} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Masters" icon={<Users />} value={<span className="k-num">{o ? int(o.masters.approved) : "—"}</span>} chip={o ? `${o.masters.pending} pending · ${o.masters.suspended} suspended` : "Loading"} chipTone={o && o.masters.pending ? "warn" : "neutral"} href="/social/applications" />
          <KpiCard label="Copy subscriptions" icon={<Users />} value={<span className="k-num">{o ? int(o.subscriptions.active) : "—"}</span>} chip={o ? `${int(o.subscriptions.stopped)} stopped` : "Loading"} delay={0.05} />
          <KpiCard
            label="Assets under copy & PAMM"
            icon={<Wallet />}
            value={<span className="k-num">{o ? usd(o.aum, 0) : "—"}</span>}
            footer={
              o ? (
                <div className="flex gap-1.5">
                  <Chip size="sm" tone="gold">
                    {o.funds.active} funds active
                  </Chip>
                  {o.funds.frozen > 0 && (
                    <Chip size="sm" tone="down">
                      {o.funds.frozen} frozen
                    </Chip>
                  )}
                </div>
              ) : undefined
            }
            href="/social/pamm"
            delay={0.1}
          />
          <KpiCard label="Fees awaiting approval" icon={<HandCoins />} value={<span className="k-num">{o ? usd(o.feesPending.amount) : "—"}</span>} chip={o ? `${o.feesPending.count} payouts pending` : "Loading"} chipTone={o && o.feesPending.count ? "ember" : "neutral"} href="/social/payouts" delay={0.15} />
        </div>
      )}

      {!(ov.error && !o && list.error) && (
        <Reveal delay={0.1}>
          <Card className="mt-4 p-4 sm:p-6">
            {list.error ? (
              <SocialError error={list.error} onRetry={reload} className="border-0 shadow-none" />
            ) : !list.data ? (
              <TableSkeleton />
            ) : (
              <DataTable
                columns={cols}
                rows={rows}
                dense
                pageSize={15}
                rowKey={(m) => String(m.id)}
                onRowClick={(m) => setSel(m.id)}
                search={(m) => `${m.nickname} ${m.strategy} ${m.id} ${m.login ?? ""} ${m.userId ?? ""}`}
                searchPlaceholder="Nickname, strategy, login, user id…"
                exportName="masters"
                empty={<EmptyState illustration="busts_in_silhouette" title="No masters here" text={tab === "all" ? "Approved masters and applications appear here." : "Nothing matches this filter."} />}
                toolbar={
                  <Segmented
                    size="xs"
                    value={tab}
                    onChange={setTab}
                    options={[
                      { value: "all", label: "All" },
                      { value: "approved", label: "Approved" },
                      { value: "pending", label: "Pending" },
                      { value: "suspended", label: "Suspended" },
                      { value: "rejected", label: "Rejected" },
                      { value: "hidden", label: "Hidden" },
                      { value: "frozen", label: "Frozen" },
                    ]}
                  />
                }
              />
            )}
          </Card>
        </Reveal>
      )}

      {watch.length > 0 && (
        <Reveal delay={0.15}>
          <Card className="mt-4">
            <CardHeader title="Risk watch" subtitle="Approved masters with the highest risk score (1–10: drawdown and volatility)" action={<Chip tone={watch.some((m) => (st(m).riskScore ?? 0) >= 7) ? "down" : "neutral"}>{watch.filter((m) => (st(m).riskScore ?? 0) >= 7).length} at 7 or above</Chip>} />
            <div className="mt-4 grid grid-cols-1 gap-2 px-4 pb-5 sm:px-6 xl:grid-cols-2">
              {watch.map((m) => (
                <ListRow key={m.id} onClick={() => setSel(m.id)} className="py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                      {m.nickname}
                      {m.frozen && (
                        <Chip size="sm" tone="down">
                          Frozen
                        </Chip>
                      )}
                    </div>
                    <div className="k-num truncate text-[11.5px] text-fg-3">
                      Max DD {st(m).maxDd?.toFixed(1) ?? "—"}% · now {st(m).currentDd?.toFixed(1) ?? "—"}% · {int(st(m).followers ?? 0)} followers · {usdK(st(m).aum ?? 0)}
                    </div>
                  </div>
                  <Risk10 score={st(m).riskScore} />
                  {canWrite && !m.frozen && (
                    <Button
                      size="xs"
                      variant="down-outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        acts.emergency(m);
                      }}
                    >
                      <OctagonAlert /> Stop
                    </Button>
                  )}
                </ListRow>
              ))}
            </div>
          </Card>
        </Reveal>
      )}

      <LiveMasterDrawer m={master} open={!!master} onOpenChange={(o) => !o && setSel(null)} acts={acts} canWrite={canWrite} />
      {acts.node}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Drawer                                                              */
/* ------------------------------------------------------------------ */

function LiveMasterDrawer({ m, open, onOpenChange, acts, canWrite }: { m: MasterView | null; open: boolean; onOpenChange: (o: boolean) => void; acts: ReturnType<typeof useMasterActions>; canWrite: boolean }) {
  const now = useNow();
  const approvedish = !!m && (m.status === "approved" || m.status === "suspended");
  const detail = useApi<MasterDetail>(open && m && approvedish ? `/api/social/masters/${m.id}` : null);
  const subs = useApi<{ items: SubscriptionView[] }>(open && m ? `/api/social/admin/subscriptions?masterId=${m.id}` : null, { refreshMs: 30_000 });
  const chart = React.useMemo(
    () =>
      (detail.data?.equity ?? [])
        .map((p) => ({ time: Math.floor(Date.parse(p.day) / 1000), value: +(p.index * 100).toFixed(2) }))
        .filter((p) => Number.isFinite(p.time))
        .sort((a, b) => a.time - b.time),
    [detail.data],
  );
  if (!m) return null;
  const s = st(m);
  const followers = subs.data?.items ?? [];
  const stopSub = (x: SubscriptionView) =>
    acts.ask({
      title: `Stop subscription #${x.id}`,
      description: `Copy account ${x.login} stops following ${m.nickname}. Every copied position and order on it is closed at market.`,
      confirmLabel: "Stop copying",
      confirmVariant: "sell",
      run: (note) => socialWrite(`admin/subscriptions/${x.id}/stop`, { note }),
      success: `Subscription #${x.id} stopped`,
      onDone: subs.reload,
    });
  const lastUp = (chart.at(-1)?.value ?? 100) >= 100;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      title={
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            {m.nickname}
            <ProgramChip program={m.program} />
            <SocialStatus status={m.status} />
            {m.hidden && (
              <Chip size="sm" tone="warn">
                Hidden
              </Chip>
            )}
            {m.frozen && (
              <Chip size="sm" tone="down">
                Frozen
              </Chip>
            )}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[12px] font-normal text-fg-3">
            Master #{m.id} · user {m.userId ? `#${m.userId}` : "—"} · login <span className="font-mono">{m.login ?? "—"}</span>
            {m.login ? <CopyButton value={String(m.login)} label="Login" /> : null}
          </span>
        </span>
      }
      footer={
        canWrite && approvedish ? (
          <div className="flex w-full flex-wrap items-center gap-2">
            <Button variant="surface" size="sm" onClick={() => acts.status(m, m.hidden ? "unhide" : "hide")}>
              {m.hidden ? <Eye /> : <EyeOff />} {m.hidden ? "Show on leaderboard" : "Hide from leaderboard"}
            </Button>
            {m.status === "suspended" ? (
              <Button variant="up-outline" size="sm" onClick={() => acts.status(m, "reinstate")}>
                <PlayCircle /> Reinstate
              </Button>
            ) : (
              <Button variant="down-outline" size="sm" onClick={() => acts.status(m, "suspend")}>
                <Ban /> Suspend
              </Button>
            )}
            <span className="flex-1" />
            {m.frozen ? (
              <Button variant="up-outline" size="sm" onClick={() => acts.unfreeze(m)}>
                <Snowflake /> Unfreeze mirroring
              </Button>
            ) : (
              <Button variant="sell" size="sm" onClick={() => acts.emergency(m)}>
                <OctagonAlert /> Emergency stop
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      <Section title="Performance" hint={approvedish ? "Time-weighted return index (100 = first snapshot), deposits and withdrawals removed" : "Statistics are published once the master is approved"}>
        {approvedish && (
          <div className="-mx-2 mb-3">
            {detail.loading && !detail.data ? (
              <div className="h-[190px] animate-pulse rounded-[16px] bg-surface-2" />
            ) : chart.length > 1 ? (
              <EquityChart data={chart} height={190} color={lastUp ? "gold" : "down"} showVolume={false} />
            ) : (
              <div className="grid h-[120px] place-items-center rounded-[16px] border border-dashed border-line text-[12.5px] text-fg-3">Not enough daily snapshots for a chart yet</div>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <MiniStat label="Equity" value={usd(s.equity ?? 0)} />
          <MiniStat label="AUM" value={usd(s.aum ?? 0, 0)} sub={`${int(s.followers ?? 0)} followers · ${int(s.investors ?? 0)} investors`} />
          <MiniStat
            label="Return 1y"
            value={<Pct value={s.return1y} decimals={1} />}
            sub={
              <>
                1m <Pct value={s.return1m} decimals={1} className="text-[11px]" /> · all <Pct value={s.returnAll} decimals={1} className="text-[11px]" />
              </>
            }
          />
          <MiniStat label="Max drawdown" value={s.maxDd === null || s.maxDd === undefined ? "—" : `${s.maxDd.toFixed(1)}%`} sub={s.currentDd !== null && s.currentDd !== undefined ? `Now ${s.currentDd.toFixed(1)}%` : undefined} tone={(s.maxDd ?? 0) > 30 ? "down" : (s.maxDd ?? 0) > 20 ? "warn" : undefined} />
          <MiniStat label="Win rate" value={s.winRate === null || s.winRate === undefined ? "—" : `${s.winRate.toFixed(1)}%`} sub={`${int(s.trades ?? 0)} trades`} />
          <MiniStat label="Risk score" value={<Risk10 score={s.riskScore} />} sub={s.volatility !== null && s.volatility !== undefined ? `Volatility ${s.volatility.toFixed(1)}%` : undefined} />
        </div>
        {detail.data && detail.data.monthly.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {detail.data.monthly.slice(-12).map((x) => (
              <span key={x.month} className="k-row inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px]">
                <span className="text-fg-3">{x.month}</span>
                <Pct value={x.returnPct} decimals={1} className="text-[11.5px]" />
              </span>
            ))}
          </div>
        )}
      </Section>

      <Section title="Terms & profile">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <MiniStat label="Performance fee" value={`${m.perfFeePct}%`} sub={`${PERIOD_LABEL[m.feePeriod] ?? m.feePeriod} · high-water mark`} />
          <MiniStat label="Min allocation" value={usd(m.minAllocation, 0)} />
          <MiniStat label="KYC" value={m.kycVerified ? "Verified" : "Not verified"} tone={m.kycVerified ? "up" : "warn"} />
          <MiniStat label={m.status === "pending" ? "Applied" : "Master since"} value={m.status === "pending" ? day(m.createdAt) : day(m.since)} sub={m.ageDays !== null && m.ageDays !== undefined ? `${m.ageDays} days` : undefined} />
          <MiniStat label="PAMM fund" value={m.fund ? m.fund.name : "None"} sub={m.fund ? `NAV ${m.fund.nav.toFixed(4)} · ${m.fund.status}` : undefined} />
          <MiniStat label="Reviewed by" value={m.reviewedBy || "—"} />
        </div>
        {m.description && <p className="mt-3 text-[13px] leading-relaxed text-fg-2">{m.description}</p>}
        {m.reviewNote && (
          <div className="mt-3 flex items-start gap-2 rounded-[12px] border border-line bg-surface-2 px-3 py-2.5 text-[12px] text-fg-3">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-fg-3" />
            Review note: {m.reviewNote}
          </div>
        )}
      </Section>

      <Section title="Followers" hint={subs.data ? `${followers.filter((x) => x.status !== "stopped").length} active or paused · ${followers.filter((x) => x.status === "stopped").length} stopped` : undefined}>
        {subs.error ? (
          <ErrorBanner error={subs.error.message} />
        ) : !subs.data ? (
          <TableSkeleton rows={3} />
        ) : followers.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-line px-4 py-6 text-center text-[12.5px] text-fg-3">No copy subscriptions for this master.</div>
        ) : (
          <div className="space-y-1.5">
            {followers.map((x) => (
              <div key={x.id} className={cn("k-row flex items-center gap-3 px-3.5 py-2.5", x.status === "stopped" && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[13px] font-medium">
                    <span className="font-mono">{x.login}</span>
                    <SocialStatus status={x.status} />
                  </div>
                  <div className="truncate text-[11.5px] text-fg-3">
                    #{x.id} · user {x.userId ? `#${x.userId}` : "—"} · {x.sizing.mode.replace("_", " ")} {x.sizing.mode === "equity" ? "" : x.sizing.value} · since {ago(x.createdAt, now)}
                    {x.stopReason ? ` · ${x.stopReason}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="k-num text-[13px] font-medium">{usd(x.equity)}</div>
                  <Pct value={x.returnPct} className="text-[11px]" />
                </div>
                {canWrite && x.status !== "stopped" && (
                  <Button size="xs" variant="down-outline" onClick={() => stopSub(x)}>
                    <Square /> Stop
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {detail.data && detail.data.trades.length > 0 && (
        <Section title="Recent closed trades" hint={`Shown with a ${detail.data.tradeDelayMinutes}-minute delay, like the public profile`}>
          <div className="space-y-1">
            {detail.data.trades.slice(0, 10).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 border-b border-line py-1.5 text-[12.5px] last:border-b-0">
                <span className="flex items-center gap-2">
                  <span className={cn("font-medium", t.side === "buy" ? "text-up" : "text-down")}>{t.side.toUpperCase()}</span>
                  <span className="font-medium">{t.symbol}</span>
                  <span className="k-num text-fg-3">{t.volume}</span>
                </span>
                <span className="k-num text-fg-3" title={when(t.closeTime)}>
                  {ago(t.closeTime, now)}
                </span>
                <span className={cn("k-num w-24 text-right font-medium", t.profit >= 0 ? "text-up" : "text-down")}>{usd(t.profit)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </Dialog>
  );
}
