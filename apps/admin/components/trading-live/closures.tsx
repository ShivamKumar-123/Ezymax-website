"use client";

/**
 * Trading › Closures (B12, C2, C3, C5, C11, C12): the closure queue with live checks, four-eyes approvals,
 * client-facing reason templates, reopen requests (Super Admin, always four-eyes), the exit-reasons report and the
 * per-broker account policy (demo auto-archive, dormancy, four-eyes threshold, retention).
 *
 *   GET  /api/trading/admin/closures?status&kind&q&page&limit
 *   GET  /api/trading/admin/closures/{id}                 (live checks)
 *   POST /api/trading/admin/closures/{id}/approve         {note}
 *   POST /api/trading/admin/closures/{id}/reject          {clientReason, clientMessage, note}
 *   GET  /api/trading/admin/closures/report?days
 *   GET|PUT /api/trading/admin/account-policy
 */
import * as React from "react";
import Link from "next/link";
import { Check, CircleCheck, CircleX, Clock, Gavel, ListChecks, RefreshCw, Search, ShieldCheck, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, Dialog, EmptyState, Field, Input, KpiCard, PageHeader, Reveal, Segmented, Tabs, Toggle, cn, formatNumber, type Column } from "@ezymex/ui";
import { ErrorState, Pager, TableSkeleton, ago, qs, sendJson, useApi, useDebounced, useNow, when } from "@/components/live/kit";
import { useCan, useStaff } from "@/components/staff-session";
import { MiniClient } from "@/components/trading/shared";
import { MetaTile } from "@/components/trading-desk/kit";
import { money2 } from "./kit";

type Check = { key: string; ok: boolean; label: string; detail: string };
type Template = { key: string; on: "approve" | "reject"; text: string };
type Closure = {
  id: number;
  login: number;
  userId: number;
  kind: "close" | "reopen";
  source: "client" | "staff";
  status: "pending" | "approved" | "rejected" | "cancelled";
  reasonCode: string;
  survey: { reasons?: string[]; comment?: string };
  note: string;
  balanceUsd: number;
  fourEyes: boolean;
  requestedBy: string;
  requestedByName: string;
  firstApprovalBy: string | null;
  firstApprovalName: string | null;
  firstApprovalAt: string | null;
  decidedBy: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  clientReason: string | null;
  clientMessage: string | null;
  decisionNote: string | null;
  checks: Check[] | null;
  createdAt: string;
  account?: { login: number; type: string; groupName: string; status: string; balance: number; credit: number; bonus: number; positions: number; orders: number; currency: string; name?: string } | null;
  liveChecks?: Check[];
  checksPassed?: boolean;
  history?: Closure[];
};
type Policy = { demoArchiveDays: number; dormantDays: number; dormantAutoArchive: boolean; closeFourEyesUsd: number; retentionYears: number };
type ListResp = { items: Closure[]; page: number; limit: number; total: number; counts: Record<string, number>; templates: Template[]; surveyReasons: string[]; policy: Policy; me: { id: string; role: string; superAdmin: boolean } };
type Report = {
  days: number;
  total: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  byReason: { reason: string; count: number; pct: number; balanceUsd: number }[];
  surveyReasons: { reason: string; count: number }[];
  byMonth: { month: string; requested: number; approved: number }[];
  avgDecisionHours: number | null;
  comments: { id: number; login: number; reason: string; comment: string | null; at: string }[];
};

export const SURVEY_LABEL: Record<string, string> = {
  costs: "Fees or spreads too high",
  platform: "Platform or tools",
  performance: "Trading results",
  other_broker: "Moving to another broker",
  stop_trading: "Stopping trading",
  too_many_accounts: "Too many accounts",
  service: "Support or service",
  other: "Something else",
};
const reasonLabel = (r: string) => SURVEY_LABEL[r] ?? r;
const STATUS_TONE: Record<Closure["status"], "warn" | "up" | "down" | "neutral"> = { pending: "warn", approved: "up", rejected: "down", cancelled: "neutral" };
const TEMPLATE_LABEL: Record<string, string> = {
  closed_as_requested: "Closed as requested",
  closed_by_broker: "Closed by the broker",
  open_positions: "Open trades or orders",
  balance_remaining: "Balance still on the account",
  pending_operations: "Transfer or adjustment in progress",
  linked_services: "Linked to copy / PAMM / MAM / prop",
  compliance_review: "Compliance review in progress",
  other: "Other (write the message)",
};

function stage(c: Closure) {
  if (c.status !== "pending") return null;
  if (c.fourEyes && c.firstApprovalBy) return "Awaiting 2nd approver";
  if (c.fourEyes) return "Four-eyes · 1st approval";
  return "Awaiting approval";
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LiveClosuresPage() {
  const [tab, setTab] = React.useState<"queue" | "report" | "policy">("queue");
  const [status, setStatus] = React.useState<"pending" | "approved" | "rejected" | "cancelled" | "all">("pending");
  const [kind, setKind] = React.useState<"all" | "close" | "reopen">("all");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [open, setOpen] = React.useState<number | null>(null);
  const dq = useDebounced(q.trim(), 300);
  const now = useNow();
  React.useEffect(() => setPage(1), [status, kind, dq]);
  const list = useApi<ListResp>(`/api/trading/admin/closures${qs({ status, kind, q: dq, page, limit: 50 })}`, { refreshMs: 10_000 });
  const counts = list.data?.counts ?? {};
  const pendingSecond = (list.data?.items ?? []).filter((c) => c.status === "pending" && c.fourEyes && c.firstApprovalBy).length;

  const cols: Column<Closure>[] = [
    { key: "id", header: "Request", cell: (r) => <span className="font-mono text-[12px] text-fg-2">#{r.id}</span> },
    {
      key: "l",
      header: "Account",
      cell: (r) => (
        <span className="flex flex-col">
          <span className="font-mono text-[12.5px] font-medium">{r.login}</span>
          <span className="text-[10.5px] text-fg-3">{r.account?.groupName ?? "—"}</span>
        </span>
      ),
    },
    { key: "c", header: "Client", cell: (r) => <MiniClient clientId={String(r.userId)} login={`#${r.userId}`} /> },
    {
      key: "k",
      header: "Type",
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-1">
          <Chip size="sm" tone={r.kind === "reopen" ? "info" : "neutral"}>{r.kind === "reopen" ? "Reopen" : "Close"}</Chip>
          <Chip size="sm">{r.source === "client" ? "Client" : "Staff"}</Chip>
        </span>
      ),
    },
    { key: "r", header: "Reason", cell: (r) => <span className="block max-w-[200px] truncate text-[12.5px]" title={r.survey?.comment || r.note}>{r.kind === "close" && r.source === "client" ? reasonLabel(r.reasonCode) : r.reasonCode}</span> },
    { key: "b", header: "Balance at request", align: "right", cell: (r) => <span className="k-num font-mono text-[12.5px]">{money2(r.balanceUsd)}</span> },
    {
      key: "s",
      header: "Status",
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-1">
          <Chip size="sm" tone={STATUS_TONE[r.status]}>{r.status[0]!.toUpperCase() + r.status.slice(1)}</Chip>
          {r.fourEyes && <Chip size="sm" tone="gold">4-eyes</Chip>}
          {stage(r) && <span className="text-[11px] text-fg-3">{stage(r)}</span>}
        </span>
      ),
    },
    { key: "t", header: "Requested", align: "right", cell: (r) => <span className="whitespace-nowrap text-[11.5px] text-fg-3" title={when(r.createdAt)}>{ago(r.createdAt, now)}</span> },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="Account closures"
        subtitle="Close-permanently requests from clients and staff. Approve stays locked until every check passes; large balances need two approvers."
        actions={
          <Button variant="surface" size="lg" onClick={list.reload}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Pending" icon={<Clock />} value={<span className="k-num">{counts.pending ?? 0}</span>} chip={pendingSecond ? `${pendingSecond} need a 2nd approver` : "In the queue"} chipTone="warn" />
        <KpiCard label="Approved" icon={<CircleCheck />} value={<span className="k-num">{counts.approved ?? 0}</span>} chip="Closed / reopened" chipTone="up" delay={0.04} />
        <KpiCard label="Rejected" icon={<CircleX />} value={<span className="k-num">{counts.rejected ?? 0}</span>} chip="Client told why" delay={0.08} />
        <KpiCard label="Four-eyes above" icon={<ShieldCheck />} value={<span className="k-num">{list.data ? money2(list.data.policy.closeFourEyesUsd) : "—"}</span>} chip="Balance at request" delay={0.12} />
      </div>

      <div className="mt-4">
        <Tabs
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
          tabs={[
            { value: "queue", label: "Queue", count: counts.pending ?? 0 },
            { value: "report", label: "Exit reasons" },
            { value: "policy", label: "Account policy" },
          ]}
        />
      </div>

      {tab === "queue" && (
        <Reveal delay={0.05} className="mt-4">
          <Card className="px-4 py-5 sm:px-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="flex h-9 w-full min-w-0 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 sm:w-auto sm:max-w-xs sm:flex-1">
                <Search className="size-3.5 shrink-0 text-fg-3" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Login or client ID" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-3" aria-label="Search requests" />
              </div>
              <Segmented size="xs" value={status} onChange={setStatus} options={[{ value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }, { value: "cancelled", label: "Cancelled" }, { value: "all", label: "All" }]} />
              <Segmented size="xs" value={kind} onChange={setKind} options={[{ value: "all", label: "Close + reopen" }, { value: "close", label: "Close" }, { value: "reopen", label: "Reopen" }]} />
            </div>
            {list.error ? (
              <ErrorState error={list.error} onRetry={list.reload} />
            ) : !list.data ? (
              <TableSkeleton />
            ) : (
              <>
                <DataTable
                  columns={cols}
                  rows={list.data.items}
                  dense
                  pageSize={50}
                  rowKey={(r) => String(r.id)}
                  onRowClick={(r) => setOpen(r.id)}
                  exportName="account-closures"
                  empty={<EmptyState title={status === "pending" ? "Nothing waiting" : "No requests"} text={status === "pending" ? "New close-permanently requests from the Client Area and from staff appear here." : "Try another status."} illustration="check_mark_button" />}
                />
                <Pager page={list.data.page} perPage={list.data.limit} total={list.data.total} onPage={setPage} />
              </>
            )}
          </Card>
        </Reveal>
      )}
      {tab === "report" && <ReportTab />}
      {tab === "policy" && <PolicyTab />}
      <ClosureDrawer id={open} templates={list.data?.templates ?? []} me={list.data?.me} onClose={() => setOpen(null)} onDone={list.reload} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Request drawer: checks, survey, approve / reject                    */
/* ------------------------------------------------------------------ */

function ClosureDrawer({ id, templates, me, onClose, onDone }: { id: number | null; templates: Template[]; me?: ListResp["me"]; onClose: () => void; onDone: () => void }) {
  const { data, error, reload } = useApi<{ data: Closure }>(id ? `/api/trading/admin/closures/${id}` : null, { refreshMs: 8000 });
  const canApprove = useCan("accounts.close.approve");
  const staff = useStaff();
  const c = data?.data && data.data.id === id ? data.data : null;
  const [note, setNote] = React.useState("");
  const [rejecting, setRejecting] = React.useState(false);
  const [tpl, setTpl] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [approveTpl, setApproveTpl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    setNote("");
    setRejecting(false);
    setTpl("");
    setMsg("");
    setApproveTpl("");
  }, [id]);
  const meId = me?.id ?? `staff:${staff.id}`;
  const superAdmin = me?.superAdmin ?? ["super_admin", "platform_owner"].includes(staff.role);
  const mayDecide = c ? (c.kind === "reopen" ? superAdmin : canApprove) : false;
  const fourEyesBlock = c && c.status === "pending" && c.fourEyes ? (c.requestedBy === meId ? "You requested this: someone else must approve" : c.firstApprovalBy === meId ? "You gave the first approval: a second, different approver is needed" : null) : null;
  const checks = c?.liveChecks ?? c?.checks ?? [];
  const checksOk = c?.kind === "reopen" || c?.checksPassed === true;
  const rejectTemplates = templates.filter((t) => t.on === "reject");
  const approveTemplates = templates.filter((t) => t.on === "approve");
  const preview = (key: string) => (templates.find((t) => t.key === key)?.text ?? "").replace("{login}", String(c?.login ?? "")).replace("{message}", msg.trim()).trim();

  const act = async (what: "approve" | "reject") => {
    if (!c) return;
    setBusy(true);
    const body = what === "approve" ? { note, clientReason: approveTpl || undefined, clientMessage: msg || undefined } : { note, clientReason: tpl, clientMessage: msg || undefined };
    const r = await sendJson<{ data: Closure; stage?: string; error?: { message: string; checks?: Check[] } }>(`/api/trading/admin/closures/${c.id}/${what}`, body);
    setBusy(false);
    if (!r.ok) {
      toast.error(what === "approve" ? "Not approved" : "Not rejected", { description: r.error.message });
      reload();
      return;
    }
    if (what === "approve") toast.success(r.data.stage === "first_approval" ? "First approval recorded" : c.kind === "reopen" ? `#${c.login} reopened` : `#${c.login} closed permanently`, { description: r.data.stage === "first_approval" ? "A second, different approver must now approve." : "The client is notified with the client-facing reason." });
    else toast.success("Request rejected", { description: "The client sees the reason template you picked; your note stays internal." });
    onDone();
    reload();
    if (r.data.stage !== "first_approval") onClose();
  };

  return (
    <Dialog
      open={id !== null}
      onOpenChange={(o) => !o && onClose()}
      side="right"
      width={560}
      title={c ? `${c.kind === "reopen" ? "Reopen" : "Close permanently"} · #${c.login}` : "Request"}
      description={c ? `Request #${c.id} · ${c.source === "client" ? "asked by the client" : `opened by ${c.requestedByName || c.requestedBy}`} · ${when(c.createdAt)}` : undefined}
      footer={
        c && c.status === "pending" && mayDecide ? (
          rejecting ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>
                Back
              </Button>
              <Button variant="sell" size="sm" disabled={busy || !tpl || (tpl === "other" && !msg.trim())} onClick={() => void act("reject")}>
                <X /> Reject request
              </Button>
            </>
          ) : (
            <>
              <span className="mr-auto text-[11.5px] text-fg-3">{fourEyesBlock ?? (!checksOk ? "Approve unlocks when every check passes" : stage(c))}</span>
              <Button variant="surface" size="sm" disabled={busy} onClick={() => setRejecting(true)}>
                Reject…
              </Button>
              <Button variant="buy" size="sm" disabled={busy || !checksOk || !!fourEyesBlock} onClick={() => void act("approve")}>
                <Check /> {c.fourEyes && !c.firstApprovalBy ? "Approve (1 of 2)" : c.kind === "reopen" ? "Approve reopen" : "Approve & close"}
              </Button>
            </>
          )
        ) : undefined
      }
    >
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !c ? (
        <TableSkeleton rows={5} />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone={STATUS_TONE[c.status]}>{c.status[0]!.toUpperCase() + c.status.slice(1)}</Chip>
            {c.fourEyes && <Chip tone="gold">Four-eyes</Chip>}
            {c.firstApprovalBy && <Chip tone="info">1st approval: {c.firstApprovalName ?? c.firstApprovalBy}</Chip>}
            <Link href={`/trading/accounts?login=${c.login}`} className="ml-auto text-[12px] text-ember hover:underline">
              Open account
            </Link>
          </div>
          {c.account && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MetaTile label="Status" value={c.account.status} />
              <MetaTile label="Balance" value={money2(c.account.balance, c.account.currency)} tone={c.account.balance ? "warn" : undefined} />
              <MetaTile label="Credit · bonus" value={`${money2(c.account.credit, c.account.currency)} · ${money2(c.account.bonus, c.account.currency)}`} />
              <MetaTile label="Open" value={`${c.account.positions} · ${c.account.orders}`} tone={c.account.positions || c.account.orders ? "warn" : undefined} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <MetaTile label="Client" value={<MiniClient clientId={String(c.userId)} login={`#${c.userId}`} />} />
            <MetaTile label="Balance at request" value={money2(c.balanceUsd)} />
          </div>

          {c.kind === "close" && (
            <section>
              <div className="mb-2 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-fg-3">
                <ListChecks className="size-3.5" /> {c.status === "pending" ? "Live checks" : "Checks at decision"}
              </div>
              <ul className="space-y-1.5">
                {checks.map((k) => (
                  <li key={k.key} className={cn("flex items-start gap-2.5 rounded-[12px] border px-3 py-2", k.ok ? "border-up/20 bg-up-soft/40" : "border-down/25 bg-down-soft/60")}>
                    <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", k.ok ? "bg-up/15 text-up" : "bg-down/15 text-down")}>{k.ok ? <Check className="size-3" /> : <X className="size-3" />}</span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-medium">{k.label}</span>
                      <span className="block text-[11.5px] text-fg-3">{k.detail}</span>
                    </span>
                  </li>
                ))}
                {checks.length === 0 && <li className="text-[12px] text-fg-3">No checks recorded.</li>}
              </ul>
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-fg-3">
              <Users className="size-3.5" /> {c.source === "client" ? "Exit survey" : "Reason"}
            </div>
            {c.source === "client" ? (
              <div className="k-row space-y-2 p-3">
                <div className="flex flex-wrap gap-1.5">
                  {(c.survey?.reasons ?? [c.reasonCode]).map((r, i) => (
                    <Chip key={r} size="sm" tone={i === 0 ? "ember" : "neutral"}>
                      {reasonLabel(r)}
                    </Chip>
                  ))}
                </div>
                {c.survey?.comment ? <p className="text-[12.5px] text-fg-2">“{c.survey.comment}”</p> : <p className="text-[12px] text-fg-3">No comment.</p>}
              </div>
            ) : (
              <div className="k-row p-3 text-[12.5px]">
                <span className="font-mono text-ember">{c.reasonCode}</span>
                {c.note && <p className="mt-1 text-fg-2">“{c.note}”</p>}
              </div>
            )}
          </section>

          {c.status !== "pending" && (
            <section className="k-row space-y-1 p-3 text-[12.5px]">
              <div>
                Decided by <span className="font-medium">{c.decidedByName ?? c.decidedBy ?? "—"}</span> · {when(c.decidedAt)}
              </div>
              {c.clientReason && <div className="text-fg-3">Client saw: “{preview(c.clientReason) || TEMPLATE_LABEL[c.clientReason]}”</div>}
              {c.decisionNote && <div className="text-fg-3">Internal note: “{c.decisionNote}”</div>}
            </section>
          )}

          {c.status === "pending" && mayDecide && !rejecting && c.kind === "close" && (
            <section className="space-y-3">
              <Field label="Message to the client (on approval)">
                <select value={approveTpl} onChange={(e) => setApproveTpl(e.target.value)} className="h-10 w-full rounded-[12px] border border-line bg-surface-2 px-3 text-[13px]">
                  <option value="">Default ({c.source === "client" ? "closed as requested" : "closed by the broker"})</option>
                  {approveTemplates.map((t) => (
                    <option key={t.key} value={t.key}>
                      {TEMPLATE_LABEL[t.key] ?? t.key}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Internal note (optional, never shown to the client)">
                <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="e.g. checked with finance" />
              </Field>
            </section>
          )}
          {c.status === "pending" && mayDecide && rejecting && (
            <section className="space-y-3">
              <Field label="Reason the client sees">
                <select value={tpl} onChange={(e) => setTpl(e.target.value)} className="h-10 w-full rounded-[12px] border border-line bg-surface-2 px-3 text-[13px]">
                  <option value="">Choose a template…</option>
                  {rejectTemplates.map((t) => (
                    <option key={t.key} value={t.key}>
                      {TEMPLATE_LABEL[t.key] ?? t.key}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={tpl === "other" ? "Message to the client (required)" : "Extra message to the client (optional)"}>
                <Input value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={500} />
              </Field>
              {tpl && <div className="rounded-[12px] border border-info/25 bg-info-soft px-3 py-2 text-[12.5px] text-fg-2">Email + bell: “{preview(tpl)}”</div>}
              <Field label="Internal note (never shown to the client)">
                <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
              </Field>
            </section>
          )}
          {c.status === "pending" && !mayDecide && <p className="text-[12px] text-fg-3">{c.kind === "reopen" ? "Only a Super Admin can approve reopening an account." : "You can't decide closure requests (accounts.close.approve)."}</p>}

          {(c.history ?? []).length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-fg-3">
                <Gavel className="size-3.5" /> Earlier requests
              </div>
              <ul className="space-y-1.5">
                {c.history!.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 rounded-[12px] border border-line px-3 py-2 text-[12px]">
                    <span>
                      #{h.id} · {h.kind} · <span className="text-fg-3">{when(h.createdAt)}</span>
                    </span>
                    <Chip size="sm" tone={STATUS_TONE[h.status]}>{h.status}</Chip>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Exit reasons report (C11)                                           */
/* ------------------------------------------------------------------ */

function ReportTab() {
  const [days, setDays] = React.useState<"30" | "90" | "365">("90");
  const { data, error, reload } = useApi<{ data: Report }>(`/api/trading/admin/closures/report?days=${days}`, { refreshMs: 60_000 });
  const r = data?.data;
  const maxReason = Math.max(1, ...(r?.byReason.map((x) => x.count) ?? [1]));
  const maxSurvey = Math.max(1, ...(r?.surveyReasons.map((x) => x.count) ?? [1]));
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
      {error ? (
        <Card className="xl:col-span-12">
          <ErrorState error={error} onRetry={reload} />
        </Card>
      ) : (
        <>
          <Reveal className="xl:col-span-7">
            <Card className="h-full">
              <CardHeader title="Why clients close" subtitle={r ? `${r.total} close request(s) in the last ${r.days} days · main reason` : "Loading…"} action={<Segmented size="xs" value={days} onChange={setDays} options={[{ value: "30", label: "30d" }, { value: "90", label: "90d" }, { value: "365", label: "1y" }]} />} />
              <div className="space-y-2.5 px-4 pb-6 pt-3 sm:px-6">
                {!r && <TableSkeleton rows={4} />}
                {r && r.byReason.length === 0 && <EmptyState title="No closures yet" text="Exit reasons appear here once clients ask to close accounts." illustration="bar_chart" />}
                {r?.byReason.map((x) => (
                  <div key={x.reason}>
                    <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
                      <span>{reasonLabel(x.reason)}</span>
                      <span className="k-num font-mono text-fg-2">
                        {x.count} · {x.pct}% <span className="text-fg-3">· {money2(x.balanceUsd)}</span>
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-ember" style={{ width: `${(x.count / maxReason) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.05} className="xl:col-span-5">
            <Card className="h-full">
              <CardHeader title="Outcomes" subtitle="Requests by status and source" />
              <div className="grid grid-cols-2 gap-2 px-4 pb-4 pt-3 sm:px-6">
                {(["pending", "approved", "rejected", "cancelled"] as const).map((s) => (
                  <MetaTile key={s} label={s} value={formatNumber(r?.byStatus[s] ?? 0, 0)} tone={s === "approved" ? "up" : s === "rejected" ? "down" : undefined} />
                ))}
                <MetaTile label="From clients" value={formatNumber(r?.bySource.client ?? 0, 0)} />
                <MetaTile label="From staff" value={formatNumber(r?.bySource.staff ?? 0, 0)} />
                <MetaTile label="Avg. time to decide" value={r?.avgDecisionHours != null ? `${formatNumber(r.avgDecisionHours, 1)} h` : "—"} className="col-span-2" />
              </div>
              <div className="px-4 pb-6 sm:px-6">
                <div className="mb-2 text-[11px] uppercase tracking-wider text-fg-3">All reasons ticked</div>
                <div className="space-y-1.5">
                  {r?.surveyReasons.map((x) => (
                    <div key={x.reason} className="flex items-center gap-2 text-[12px]">
                      <span className="w-40 shrink-0 truncate">{reasonLabel(x.reason)}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <div className="h-full rounded-full bg-gold" style={{ width: `${(x.count / maxSurvey) * 100}%` }} />
                      </div>
                      <span className="k-num w-8 text-right font-mono text-fg-2">{x.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.08} className="xl:col-span-5">
            <Card className="h-full">
              <CardHeader title="By month" subtitle="Requested vs approved" />
              <div className="px-4 pb-6 pt-2 sm:px-6">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-fg-3">
                      <th className="py-1.5 font-medium">Month</th>
                      <th className="py-1.5 text-right font-medium">Requested</th>
                      <th className="py-1.5 text-right font-medium">Approved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r?.byMonth.map((m) => (
                      <tr key={m.month} className="border-t border-line">
                        <td className="py-1.5 font-mono">{m.month}</td>
                        <td className="k-num py-1.5 text-right font-mono">{m.requested}</td>
                        <td className="k-num py-1.5 text-right font-mono text-up">{m.approved}</td>
                      </tr>
                    ))}
                    {r && r.byMonth.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-3 text-center text-fg-3">
                          No data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.1} className="xl:col-span-7">
            <Card className="h-full">
              <CardHeader title="What clients wrote" subtitle="Latest exit-survey comments" />
              <ul className="space-y-2 px-4 pb-6 pt-2 sm:px-6">
                {r?.comments.map((x) => (
                  <li key={x.id} className="k-row p-3">
                    <div className="flex items-center justify-between gap-2 text-[11.5px] text-fg-3">
                      <span>
                        <span className="font-mono">#{x.login}</span> · {reasonLabel(x.reason)}
                      </span>
                      <span>{when(x.at)}</span>
                    </div>
                    <p className="mt-1 text-[12.5px] text-fg-2">“{x.comment}”</p>
                  </li>
                ))}
                {r && r.comments.length === 0 && <li className="py-6 text-center text-[12.5px] text-fg-3">No comments in this period.</li>}
              </ul>
            </Card>
          </Reveal>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Account policy                                                      */
/* ------------------------------------------------------------------ */

const POLICY_REASONS = ["POL-01 · Policy review", "POL-02 · Regulatory requirement", "POL-03 · Risk decision", "POL-99 · Other"] as const;

function PolicyTab() {
  const { data, error, reload } = useApi<{ data: Policy }>("/api/trading/admin/account-policy");
  const canEdit = useCan("dealing.policy");
  const [p, setP] = React.useState<Policy | null>(null);
  const [code, setCode] = React.useState<string>(POLICY_REASONS[0]);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (data?.data) setP(data.data);
  }, [data]);
  const num = (k: keyof Policy) => (v: string) => setP((x) => (x ? { ...x, [k]: Number(v.replace(/[^\d.]/g, "")) || 0 } : x));
  const save = async () => {
    if (!p) return;
    setBusy(true);
    const r = await sendJson<{ data: Policy }>("/api/trading/admin/account-policy", { ...p, reasonCode: code, note: "" }, "PUT");
    setBusy(false);
    if (!r.ok) return void toast.error("Not saved", { description: r.error.message });
    toast.success("Account policy saved", { description: "Applies from the next hourly run of the account jobs." });
    reload();
  };
  const dirty = !!p && !!data?.data && JSON.stringify(p) !== JSON.stringify(data.data);
  return (
    <Reveal delay={0.05} className="mt-4 block">
      <Card>
        <CardHeader title="Account policy" subtitle="Applies to every client of this broker. The jobs run hourly; every change is audited." />
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : !p ? (
          <TableSkeleton rows={4} />
        ) : (
          <div className="grid grid-cols-1 gap-4 px-4 pb-6 pt-3 sm:grid-cols-2 sm:px-6 xl:grid-cols-3">
            <Field label="Archive expired demos after (days)" hint="0 = never">
              <Input inputMode="numeric" value={String(p.demoArchiveDays)} onChange={(e) => num("demoArchiveDays")(e.target.value)} disabled={!canEdit} />
            </Field>
            <Field label="Flag live accounts dormant after (days)" hint="0 = never · no fee is charged">
              <Input inputMode="numeric" value={String(p.dormantDays)} onChange={(e) => num("dormantDays")(e.target.value)} disabled={!canEdit} />
            </Field>
            <label className="flex items-start justify-between gap-3 rounded-[12px] border border-line bg-surface-2/60 px-3 py-2.5 text-[12.5px]">
              <span>
                <span className="block font-medium">Auto-archive empty dormant accounts</span>
                <span className="block text-[11.5px] text-fg-3">Flat, no balance, credit or bonus; never copy / PAMM / MAM / prop. Client-restorable.</span>
              </span>
              <Toggle checked={p.dormantAutoArchive} onChange={(v) => canEdit && setP({ ...p, dormantAutoArchive: v })} label="Auto-archive empty dormant accounts" />
            </label>
            <Field label="Four-eyes for closures above (USD)" hint="Balance + credit + bonus at request time">
              <Input inputMode="decimal" value={String(p.closeFourEyesUsd)} onChange={(e) => num("closeFourEyesUsd")(e.target.value)} leading="$" disabled={!canEdit} />
            </Field>
            <Field label="Anonymise closed accounts after (years)" hint="Trades and ledger are kept">
              <Input inputMode="numeric" value={String(p.retentionYears)} onChange={(e) => num("retentionYears")(e.target.value)} disabled={!canEdit} />
            </Field>
            {canEdit && (
              <div className="flex flex-col justify-end gap-2">
                <Field label="Reason">
                  <select value={code} onChange={(e) => setCode(e.target.value)} className="h-10 w-full rounded-[12px] border border-line bg-surface-2 px-3 text-[13px]">
                    {POLICY_REASONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
                <Button variant="ember" disabled={!dirty || busy} onClick={() => void save()}>
                  {busy ? "Saving…" : "Save policy"}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </Reveal>
  );
}
