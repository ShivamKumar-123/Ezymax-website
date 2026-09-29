"use client";

/**
 * Finance → Adjustments: every manual balance / credit adjustment (wallet and trading accounts), the four-eyes
 * queue (approve / reject; the requester can cancel), filters (client, staff, reason, operation, target, status,
 * dates), totals in USD, CSV export and the four-eyes threshold (finance.settings). Wallet service
 * GET /api/wallet/adjustments; each row opens its before → after, comment, statement note and decision.
 */
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Check, Clock3, Download, Plus, ShieldCheck, TrendingDown, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, Dialog, EmptyState, Input, KpiCard, PageHeader, cn, type Column } from "@kalks/ui";
import { ErrorState, FilterSelect, Pager, TableSkeleton, ago, downloadCsv, qs, useApi, useDebounced, useNow, when } from "@/components/live/kit";
import { useCan, useStaff } from "@/components/staff-session";
import { MiniField } from "@/components/config/kit";
import { AdjustDialog, CATEGORY_LABEL, OP_LABEL, fmt, type Adjustment } from "@/components/clients/adjust-dialog";
import { AdjStatus, SignedAmount } from "@/components/clients/balance-card";
import { ClientCell, Row, walletWrite } from "./kit";

const PER = 50;

type ListResp = {
  items: Adjustment[];
  page: number;
  limit: number;
  total: number;
  totals: {
    added_usd: string;
    deducted_usd: string;
    credit_in_usd: string;
    credit_out_usd: string;
    net_balance_usd: string;
    net_credit_usd: string;
    external_deposits_usd: string;
    external_withdrawals_usd: string;
    applied: number;
    pending: number;
    pending_usd: string;
    declined: number;
    failed: number;
  };
  staff: { id: string; name: string }[];
  threshold_usd: string | null;
};

const STATUS_OPTS = [
  { value: "all", label: "Any" },
  { value: "applied", label: "Applied" },
  { value: "pending", label: "Awaiting approval" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "failed", label: "Failed" },
  { value: "processing", label: "Processing" },
];

function targetText(a: Adjustment) {
  return a.target === "wallet" ? "Wallet" : `${a.login} · ${a.account_type === "demo" ? "demo" : "live"}`;
}

export function LiveAdjustmentsPage() {
  const now = useNow();
  const params = useSearchParams();
  const me = useStaff();
  const canApprove = useCan("finance.adjust_approve");
  const canSettings = useCan("finance.settings");
  const canAdjust = useCan("finance.adjust");
  const canCredit = useCan("finance.credit");
  const canCreate = canAdjust || canCredit;
  const [client, setClient] = React.useState(params.get("user_id") ?? "");
  const [staff, setStaff] = React.useState("all");
  const [category, setCategory] = React.useState("all");
  const [op, setOp] = React.useState("all");
  const [target, setTarget] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [open, setOpen] = React.useState<Adjustment | null>(null);
  const [newFor, setNewFor] = React.useState<number | null>(null);
  const [pick, setPick] = React.useState(false);
  const [threshold, setThreshold] = React.useState(false);
  const dClient = useDebounced(client.trim(), 300);
  React.useEffect(() => setPage(1), [dClient, staff, category, op, target, status, from, to]);

  // `to` is inclusive in the UI (a whole day); the service takes an exclusive bound
  const toExcl = to ? new Date(Date.parse(to + "T00:00:00Z") + 86_400_000).toISOString().slice(0, 10) : "";
  const filters = { user_id: /^\d+$/.test(dClient) ? dClient : undefined, staff, category, op, target, status, from, to: toExcl };
  const { data, error, loading, reload } = useApi<ListResp>(`/api/wallet/adjustments${qs({ ...filters, page, limit: PER })}`, { refreshMs: 20_000 });
  const pending = useApi<ListResp>(`/api/wallet/adjustments${qs({ status: "pending", limit: 100 })}`, { refreshMs: 15_000 });
  const refresh = () => (reload(), pending.reload());

  async function exportCsv() {
    const r = await fetch(`/api/wallet/adjustments${qs({ ...filters, page: 1, limit: 2000 })}`, { cache: "no-store" });
    if (!r.ok) return toast.error("Export failed");
    const d = (await r.json()) as ListResp;
    downloadCsv(
      `adjustments-${new Date().toISOString().slice(0, 10)}`,
      ["ID", "Created (UTC)", "Applied (UTC)", "Client ID", "Target", "Account", "Account type", "Operation", "Reason", "Amount", "Currency", "USD", "Status", "Requested by", "Decided by", "Decision note", "Comment", "Statement note", "Notified", "Forced", "Ledger kind", "Txn", "Before", "After", "Error"],
      d.items.map((a) => [
        a.id,
        a.created_at,
        a.applied_at ?? "",
        a.user_id,
        a.target,
        a.login ?? "",
        a.account_type ?? "",
        OP_LABEL[a.op],
        a.category_label,
        (a.op === "add" || a.op === "credit_in" ? "" : "-") + a.amount,
        a.currency,
        (a.op === "add" || a.op === "credit_in" ? "" : "-") + a.amount_usd,
        a.status,
        a.requested_by.name,
        a.decided_by?.name ?? "",
        a.decision_note ?? "",
        a.comment,
        a.client_note ?? "",
        a.notify ? "yes" : "no",
        a.force ? "yes" : "no",
        a.ledger_kind ?? "",
        a.txn_id ?? "",
        a.before ? JSON.stringify(a.before) : "",
        a.after ? JSON.stringify(a.after) : "",
        a.error?.message ?? "",
      ]),
    );
  }

  const t = data?.totals;
  const cols: Column<Adjustment>[] = [
    {
      key: "id",
      header: "Adjustment",
      cell: (a) => (
        <div className="whitespace-nowrap">
          <div className="font-mono text-[12.5px]">#{a.id}</div>
          <div className="text-[11px] text-fg-3" title={when(a.created_at, true)}>
            {ago(a.created_at, now)}
          </div>
        </div>
      ),
      sort: (a) => a.id,
    },
    { key: "client", header: "Client", cell: (a) => <ClientCell id={a.user_id} /> },
    { key: "target", header: "Target", cell: (a) => <span className="whitespace-nowrap font-mono text-[12.5px]">{targetText(a)}</span>, hideOn: "sm" },
    {
      key: "op",
      header: "Operation",
      cell: (a) => (
        <Chip size="sm" tone={a.op.startsWith("credit") ? "gold" : "neutral"}>
          {OP_LABEL[a.op]}
        </Chip>
      ),
    },
    { key: "amount", header: "Amount", align: "right", cell: (a) => <SignedAmount a={a} className="text-[12.5px]" />, sort: (a) => Number(a.amount_usd) },
    { key: "reason", header: "Reason", cell: (a) => <span className="block max-w-44 truncate text-[12.5px]" title={a.category_label}>{a.category_label}</span>, hideOn: "lg" },
    {
      key: "staff",
      header: "Staff",
      cell: (a) => (
        <div className="whitespace-nowrap text-[12px]">
          <div>{a.requested_by.name}</div>
          {a.decided_by && <div className="text-[11px] text-fg-3">→ {a.decided_by.name}</div>}
        </div>
      ),
      hideOn: "lg",
    },
    { key: "status", header: "Status", align: "right", cell: (a) => <AdjStatus s={a.status} /> },
  ];

  return (
    <div className="pb-24">
      <PageHeader
        title="Adjustments"
        subtitle={
          <span>
            Manual balance and credit adjustments of wallets and trading accounts, with reason, comment and before → after.{" "}
            {data && (data.threshold_usd !== null ? `Four-eyes above $${fmt(data.threshold_usd)}.` : "Four-eyes approval is off.")}
          </span>
        }
        actions={
          <>
            {canSettings && (
              <Button variant="surface" onClick={() => setThreshold(true)}>
                <ShieldCheck /> Four-eyes
              </Button>
            )}
            <Button variant="surface" onClick={exportCsv} disabled={!data}>
              <Download /> Export CSV
            </Button>
            {canCreate && (
              <Button variant="ember" onClick={() => setPick(true)}>
                <Plus /> New adjustment
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Funds added" icon={<TrendingUp />} value={<span className="k-num">${fmt(t?.added_usd ?? 0)}</span>} chip={`external deposits $${fmt(t?.external_deposits_usd ?? 0)}`} chipTone="up" />
        <KpiCard label="Funds deducted" icon={<TrendingDown />} value={<span className="k-num">${fmt(t?.deducted_usd ?? 0)}</span>} chip={`paid out externally $${fmt(t?.external_withdrawals_usd ?? 0)}`} chipTone="down" />
        <KpiCard label="Credit given" icon={<ShieldCheck />} value={<span className="k-num">${fmt(t?.credit_in_usd ?? 0)}</span>} chip={`taken back $${fmt(t?.credit_out_usd ?? 0)} · net $${fmt(t?.net_credit_usd ?? 0)}`} chipTone="neutral" />
        <KpiCard label="Awaiting approval" icon={<Clock3 />} value={<span className="k-num">{pending.data?.total ?? "—"}</span>} hot={(pending.data?.total ?? 0) > 0} chip={`$${fmt(pending.data?.totals.pending_usd ?? 0)} held`} chipTone="warn" />
      </div>

      {(pending.data?.items.length ?? 0) > 0 && (
        <Card className="mt-4">
          <CardHeader title="Waiting for a second approval" subtitle="Another staff member with approval rights books or rejects each request; the requester can cancel it" icon={<ShieldCheck />} />
          <div className="space-y-2 px-4 pb-5 pt-4 sm:px-6">
            {pending.data!.items.map((a) => {
              const own = a.requested_by.id === String(me.id);
              return (
                <div key={a.id} className="k-row flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center" data-testid={`pending-${a.id}`}>
                  <button type="button" onClick={() => setOpen(a)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <SignedAmount a={a} className="text-[14px] font-medium" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px]">
                        {OP_LABEL[a.op]} · {targetText(a)} · client #{a.user_id} · {a.category_label}
                      </span>
                      <span className="block truncate text-[11.5px] text-fg-3">
                        {a.requested_by.name} · {ago(a.created_at, now)} · {a.comment}
                      </span>
                    </span>
                  </button>
                  <Decide a={a} own={own} canApprove={canApprove} onDone={refresh} />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-5 sm:px-6">
          <Input value={client} onChange={(e) => setClient(e.target.value.replace(/\D/g, ""))} placeholder="Client ID" aria-label="Client ID" className="h-9 w-32 rounded-full" />
          <FilterSelect label="Staff" value={staff} onChange={setStaff} options={[{ value: "all", label: "Anyone" }, ...(data?.staff ?? []).map((s) => ({ value: s.id, label: s.name }))]} />
          <FilterSelect label="Reason" value={category} onChange={setCategory} options={[{ value: "all", label: "Any" }, ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))]} />
          <FilterSelect label="Operation" value={op} onChange={setOp} options={[{ value: "all", label: "Any" }, ...Object.entries(OP_LABEL).map(([value, label]) => ({ value, label }))]} />
          <FilterSelect label="Target" value={target} onChange={setTarget} options={[{ value: "all", label: "Any" }, { value: "wallet", label: "Wallet" }, { value: "trading", label: "Trading account" }]} />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTS} />
          <label className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 text-[12.5px] text-fg-3">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-transparent text-fg outline-none" aria-label="From date" />
          </label>
          <label className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 text-[12.5px] text-fg-3">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-transparent text-fg outline-none" aria-label="To date" />
          </label>
        </div>
        {t && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 pt-3 text-[12px] text-fg-3 sm:px-6" data-testid="adj-totals">
            <span>
              Rows <span className="k-num text-fg">{data!.total}</span>
            </span>
            <span>
              Applied <span className="k-num text-fg">{t.applied}</span>
            </span>
            <span>
              Net balance <span className={cn("k-num", Number(t.net_balance_usd) >= 0 ? "text-up" : "text-down")}>${fmt(t.net_balance_usd)}</span>
            </span>
            <span>
              Net credit <span className="k-num text-fg">${fmt(t.net_credit_usd)}</span>
            </span>
            <span>
              Rejected / cancelled <span className="k-num text-fg">{t.declined}</span>
            </span>
            {t.failed > 0 && (
              <span>
                Failed / processing <span className="k-num text-warn">{t.failed}</span>
              </span>
            )}
          </div>
        )}
        <div className="px-4 pb-5 pt-4 sm:px-6">
          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : loading && !data ? (
            <TableSkeleton />
          ) : (
            <>
              <DataTable
                columns={cols}
                rows={data?.items ?? []}
                rowKey={(a) => String(a.id)}
                dense
                pageSize={PER}
                onRowClick={setOpen}
                empty={<EmptyState title="No adjustments" text="Manual adjustments made with Balance & credit appear here." illustration="receipt" />}
              />
              {data && <Pager page={data.page} perPage={data.limit} total={data.total} onPage={setPage} />}
            </>
          )}
        </div>
      </Card>

      <DetailDrawer a={open} onClose={() => setOpen(null)} canApprove={canApprove} meId={String(me.id)} onDone={refresh} />
      <ClientPicker open={pick} onClose={() => setPick(false)} onPick={(id) => (setPick(false), setNewFor(id))} />
      <AdjustDialog open={newFor !== null} onOpenChange={(o) => !o && setNewFor(null)} userId={newFor} onDone={refresh} />
      {canSettings && <ThresholdDialog open={threshold} onClose={() => setThreshold(false)} current={data?.threshold_usd ?? null} onDone={refresh} />}
    </div>
  );
}

function Decide({ a, own, canApprove, onDone }: { a: Adjustment; own: boolean; canApprove: boolean; onDone: () => void }) {
  const [mode, setMode] = React.useState<"reject" | null>(null);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  async function run(action: "approve" | "reject" | "cancel") {
    if (busy) return;
    setBusy(true);
    const r = await walletWrite<{ adjustment: Adjustment }>(`adjustments/${a.id}/${action}`, action === "reject" ? { reason } : {});
    setBusy(false);
    if (!r.ok) return toast.error(r.error.message);
    const s = r.data.adjustment.status;
    toast.success(action === "approve" ? (s === "applied" ? `#${a.id} approved and booked` : `#${a.id}: ${s}`) : action === "reject" ? `#${a.id} rejected` : `#${a.id} cancelled`);
    setMode(null);
    onDone();
  }
  if (own)
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Chip size="sm">Your request</Chip>
        <Button size="xs" variant="ghost" disabled={busy} onClick={() => run("cancel")}>
          Cancel request
        </Button>
      </div>
    );
  if (!canApprove) return <Chip size="sm">Needs an approver</Chip>;
  if (mode === "reject")
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for rejecting" aria-label="Rejection reason" className="h-8 w-56" />
        <Button size="xs" variant="down-outline" disabled={busy || reason.trim().length < 3} onClick={() => run("reject")}>
          Reject
        </Button>
        <Button size="xs" variant="ghost" onClick={() => setMode(null)}>
          Back
        </Button>
      </div>
    );
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button size="xs" variant="down-outline" disabled={busy} onClick={() => setMode("reject")}>
        <X /> Reject
      </Button>
      <Button size="xs" variant="up-outline" disabled={busy} onClick={() => run("approve")} data-testid={`approve-${a.id}`}>
        <Check /> {busy ? "Booking…" : "Approve"}
      </Button>
    </div>
  );
}

const SNAP_LABEL: Record<string, string> = {
  balance: "Balance",
  credit: "Credit",
  equity: "Equity",
  freeMargin: "Free margin",
  withdrawable: "Withdrawable",
  marginLevel: "Margin level %",
  available: "Available",
  locked: "Locked",
};

function Snapshot({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const keys = Object.keys(SNAP_LABEL).filter((k) => (before && k in before) || (after && k in after));
  if (!keys.length) return <span className="text-fg-3">—</span>;
  return (
    <table className="w-full text-[12.5px]">
      <thead className="text-[10.5px] uppercase tracking-wider text-fg-3">
        <tr>
          <th className="py-1 text-left font-medium" />
          <th className="py-1 text-right font-medium">Before</th>
          <th className="py-1 text-right font-medium">After</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((k) => (
          <tr key={k} className="border-t border-line">
            <td className="py-1.5 text-fg-3">{SNAP_LABEL[k]}</td>
            <td className="k-num py-1.5 text-right font-mono">{fmt(before?.[k])}</td>
            <td className="k-num py-1.5 text-right font-mono">{fmt(after?.[k])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DetailDrawer({ a, onClose, canApprove, meId, onDone }: { a: Adjustment | null; onClose: () => void; canApprove: boolean; meId: string; onDone: () => void }) {
  return (
    <Dialog side="right" open={!!a} onOpenChange={(o) => !o && onClose()} title={a ? `Adjustment #${a.id}` : "Adjustment"} description={a ? `${OP_LABEL[a.op]} · ${a.target === "wallet" ? "wallet" : `account ${a.login}`}` : undefined}>
      {a && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <SignedAmount a={a} className="text-[18px] font-medium" />
            {a.currency === "USC" && <span className="text-[12px] text-fg-3">= ${fmt(a.amount_usd)}</span>}
            <AdjStatus s={a.status} />
            {a.force && (
              <Chip size="sm" tone="warn">
                Forced
              </Chip>
            )}
          </div>
          {a.status === "pending" && (
            <div className="k-row flex items-center justify-between gap-3 px-3.5 py-2.5">
              <span className="text-[12.5px] text-fg-2">Waiting for a second approval</span>
              <Decide a={a} own={a.requested_by.id === meId} canApprove={canApprove} onDone={() => (onDone(), onClose())} />
            </div>
          )}
          {a.error && (
            <div className="rounded-[12px] border border-down/35 bg-down-soft px-3.5 py-2.5 text-[12.5px]">
              {a.error.message ?? a.error.code}
            </div>
          )}
          <div>
            <Row k="Client" v={<ClientCell id={a.user_id} />} />
            <Row k="Target" v={<span className="font-mono">{targetText(a)}</span>} />
            <Row k="Reason" v={a.category_label} />
            <Row k="Comment (internal)" v={<span className="break-words">{a.comment}</span>} />
            <Row k="Statement note" v={a.client_note ?? <span className="text-fg-3">None</span>} />
            <Row k="Client notice" v={a.notify ? "Bell + email" : "None"} />
            <Row k="Requested" v={`${a.requested_by.name} (${a.requested_by.role}) · ${when(a.created_at, true)}`} />
            {a.decided_by && <Row k={a.status === "cancelled" ? "Cancelled" : a.status === "rejected" ? "Rejected" : "Approved"} v={`${a.decided_by.name ?? a.decided_by.id} · ${when(a.decided_at, true)}${a.decision_note ? ` · ${a.decision_note}` : ""}`} />}
            {a.applied_at && <Row k="Booked" v={`${when(a.applied_at, true)} · ${a.ledger_kind ?? ""} · txn ${a.txn_id ?? "—"}`} />}
          </div>
          <div>
            <div className="mb-1 text-[12px] font-medium text-fg-2">{a.status === "applied" ? "Before → after" : "Balances when requested"}</div>
            <Snapshot before={a.before} after={a.after} />
          </div>
        </div>
      )}
    </Dialog>
  );
}

function ClientPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (id: number) => void }) {
  const [id, setId] = React.useState("");
  React.useEffect(() => {
    if (open) setId("");
  }, [open]);
  const ok = /^\d{1,18}$/.test(id) && Number(id) > 0;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      width={420}
      title="New adjustment"
      description="Enter the client ID (shown on the client profile). You can also start from the client profile: Balance & credit."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="ember" disabled={!ok} onClick={() => onPick(Number(id))}>
            Continue
          </Button>
        </>
      }
    >
      <MiniField label="Client ID">
        <Input value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 42" aria-label="Client ID" className="h-10 font-mono" onKeyDown={(e) => e.key === "Enter" && ok && onPick(Number(id))} autoFocus />
      </MiniField>
    </Dialog>
  );
}

function ThresholdDialog({ open, onClose, current, onDone }: { open: boolean; onClose: () => void; current: string | null; onDone: () => void }) {
  const [on, setOn] = React.useState(current !== null);
  const [value, setValue] = React.useState(current ?? "1000");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    setOn(current !== null);
    setValue(current ?? "1000");
  }, [open, current]);
  const ok = !on || (/^\d+(\.\d{1,2})?$/.test(value) && Number(value) >= 0);
  async function save() {
    setBusy(true);
    const r = await walletWrite<{ approval_threshold_usd: string | null }>("adjustments/settings", { approval_threshold_usd: on ? value : null }, "PUT");
    setBusy(false);
    if (!r.ok) return toast.error(r.error.message);
    toast.success(r.data.approval_threshold_usd === null ? "Four-eyes approval turned off" : `Four-eyes above $${fmt(r.data.approval_threshold_usd)}`);
    onDone();
    onClose();
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      width={460}
      title="Four-eyes approval"
      description="Adjustments whose USD value is above the threshold wait for a second staff member with approval rights. At or below it they apply at once."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="ember" disabled={!ok || busy} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="k-row flex items-center justify-between px-3.5 py-2.5 text-[13px]">
          Require approval above a threshold
          <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="size-4 accent-[var(--k-ember)]" aria-label="Require approval" />
        </label>
        {on && (
          <MiniField label="Threshold (USD)">
            <Input value={value} onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Threshold" className="h-10 font-mono" />
          </MiniField>
        )}
        <p className="text-[12px] text-fg-3">Changes are audited and listed in the Finance → Settings history.</p>
      </div>
    </Dialog>
  );
}
