"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeCheck, Clock, Download, ExternalLink, ImageIcon, Inbox, Loader2, RefreshCw, Search, Settings2, TriangleAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CopyButton, DataTable, Dialog, EmptyState, Field, Input, KpiCard, PageHeader, Tabs, buttonVariants, cn, type Column } from "@ezymex/ui";
import { ErrorState, FilterSelect, Pager, TableSkeleton, ago, useDebounced, useNow, when } from "@/components/live/kit";
import { useCan } from "@/components/staff-session";
import { Row, Status, usd, usd2 } from "./kit";
import { KindChip, MANUAL_STATUS, ManualClient, manualAction, money, rateLines, short, type ManualDeposit, type ManualDepositDetail } from "./manual-kit";
import { announceManualChange, approveDeposit, exportDeposits, rejectDeposit, sameAmount, useManualDeposit, useManualDeposits, useManualMethods } from "./manual-data";

const PER = 50;
type Tab = "pending" | "approved" | "rejected" | "cancelled" | "all";
const AMOUNT = /^\d+(\.\d{1,6})?$/;

function MethodCell({ d }: { d: ManualDeposit }) {
  const m = d.method;
  return (
    <div className="min-w-0 max-w-[200px]">
      <div className="truncate text-[13px]">{m.name}</div>
      <div className="truncate text-[11px] text-fg-3">{d.kind === "crypto" ? `${m.network ?? "—"} · ${m.token ?? ""}` : m.upi_id && !m.account_number ? "UPI" : (m.bank_name ?? "Bank transfer")}</div>
    </div>
  );
}

function RefCell({ v }: { v: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
      <span className="font-mono text-[12px] text-fg-2" title={v}>
        {v.length > 16 ? short(v, 8, 6) : v}
      </span>
      <CopyButton value={v} label="Reference" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Detail drawer                                                       */
/* ------------------------------------------------------------------ */

/** The client's other manual deposits in one line ("2 approved · 1,250.00 USDT credited · 1 rejected"). */
function HistoryLine({ h }: { h: ManualDepositDetail["client_history"] }) {
  const parts = [
    h.approved ? `${h.approved} approved · ${usd2(h.credited)} USDT credited` : null,
    h.rejected ? `${h.rejected} rejected` : null,
    h.pending ? `${h.pending} other pending` : null,
  ].filter(Boolean);
  if (!parts.length) return <span className="text-fg-3">First manual deposit</span>;
  return <span className={cn("text-[12.5px]", h.rejected && !h.approved && "text-warn")}>{parts.join(" · ")}</span>;
}

function History({ d, now }: { d: ManualDepositDetail; now: number }) {
  return (
    <div>
      <div className="k-label mb-2">History</div>
      <div className="space-y-1.5">
        <div className="flex justify-between gap-3 text-[12px]">
          <span>
            Submitted · {d.user_name ?? `client #${d.user_id}`}
            {d.ip ? <span className="text-fg-3"> · IP {d.ip}</span> : null}
          </span>
          <span className="shrink-0 text-fg-3" title={when(d.created_at)}>
            {ago(d.created_at, now)}
          </span>
        </div>
        {d.history.map((h) => (
          <div key={h.id} className="flex justify-between gap-3 text-[12px]">
            <span className="min-w-0">
              {manualAction(h.action)} · {h.actor_name ?? h.actor_kind}
              {h.reason ? <span className="text-fg-3"> · {h.reason}</span> : null}
            </span>
            <span className="shrink-0 text-fg-3" title={when(h.at)}>
              {ago(h.at, now)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DepositDrawer({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => void }) {
  const now = useNow();
  const { data, error, reload } = useManualDeposit(id);
  const canApprove = useCan("finance.approve");
  const [mode, setMode] = React.useState<"approve" | "reject" | null>(null);
  const [credit, setCredit] = React.useState("");
  const [note, setNote] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<{ field?: string; message: string } | null>(null);
  const d = data?.deposit;
  React.useEffect(() => {
    setMode(null);
    setErr(null);
    setNote("");
    setReason("");
  }, [id]);

  const openApprove = () => {
    if (!d) return;
    setMode("approve");
    setCredit(d.expected_credit);
    setNote("");
    setErr(null);
  };

  const creditOk = AMOUNT.test(credit.trim()) && Number(credit) > 0;
  const changed = !!d && creditOk && !sameAmount(credit.trim(), d.expected_credit);
  const noteMissing = changed && note.trim().length < 3;

  const done = (msg: string, desc: string) => {
    toast.success(msg, { description: desc });
    setMode(null);
    setErr(null);
    reload();
    onChanged();
    announceManualChange();
  };

  const approve = async () => {
    if (!d) return;
    setBusy(true);
    setErr(null);
    const r = await approveDeposit(d.id, changed ? { credit_amount: credit.trim(), note: note.trim() } : note.trim() ? { note: note.trim() } : {});
    setBusy(false);
    if (!r.ok) {
      setErr({ field: r.error.field, message: r.error.message });
      if (r.error.code === "invalid_state") reload();
      return;
    }
    done("Deposit approved", `#${d.id} · ${usd(r.data.deposit.credit_amount ?? d.expected_credit)} USDT credited to ${d.user_name ?? `client #${d.user_id}`}`);
  };

  const reject = async () => {
    if (!d) return;
    setBusy(true);
    setErr(null);
    const r = await rejectDeposit(d.id, reason.trim());
    setBusy(false);
    if (!r.ok) {
      setErr({ field: r.error.field, message: r.error.message });
      if (r.error.code === "invalid_state") reload();
      return;
    }
    done("Deposit rejected", `#${d.id} · the client sees your reason`);
  };

  const rate = d ? rateLines(d.rate, d.currency) : null;
  const earlier = d?.same_reference ?? [];
  const m = d?.method;

  return (
    <Dialog
      side="right"
      open={id !== null}
      onOpenChange={(o) => !o && onClose()}
      title={d ? `Manual deposit #${d.id}` : "Manual deposit"}
      description={d ? `${d.method.name} · sent ${when(d.created_at)}` : undefined}
      footer={
        d && d.status === "pending" && canApprove && !mode ? (
          <>
            <Button variant="down-outline" disabled={busy} onClick={() => (setMode("reject"), setReason(""), setErr(null))}>
              Reject
            </Button>
            <Button variant="ember" disabled={busy} onClick={openApprove}>
              Approve
            </Button>
          </>
        ) : undefined
      }
    >
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !d || !m ? (
        <TableSkeleton rows={5} />
      ) : (
        <div className="space-y-5">
          <div className="k-row flex items-center justify-between gap-3 px-4 py-4">
            <div className="min-w-0">
              <div className="k-num text-[24px] font-semibold leading-tight sm:text-[26px]">{money(d.amount, d.currency)}</div>
              <div className="mt-0.5 text-[12px] text-fg-3">
                {d.status === "approved" && d.credit_amount ? (
                  <>
                    Credited <span className="k-num text-fg-2">{usd(d.credit_amount)} USDT</span>
                    {!sameAmount(d.credit_amount, d.expected_credit) && <span className="text-warn"> (expected {usd(d.expected_credit)})</span>}
                  </>
                ) : (
                  <>
                    ≈ <span className="k-num text-fg-2">{usd(d.expected_credit)} USDT</span>
                    {d.currency !== "USDT" && rate ? ` at ${rate.fwd}` : ""}
                  </>
                )}
              </div>
            </div>
            <Status map={MANUAL_STATUS} s={d.status} />
          </div>

          {earlier.length > 0 && (
            <div className="flex gap-2 rounded-[14px] border border-warn/35 bg-warn-soft px-3.5 py-2.5 text-[12.5px]" data-testid="same-reference">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
              <div>
                This reference was used before:{" "}
                {earlier.map((s, i) => (
                  <span key={s.id}>
                    {i > 0 && ", "}
                    <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => window.dispatchEvent(new CustomEvent("ezymex:open-manual-deposit", { detail: s.id }))}>
                      #{s.id}
                    </button>{" "}
                    {MANUAL_STATUS[s.status]?.label.toLowerCase() ?? s.status}
                    {s.user_id !== d.user_id ? ` (client #${s.user_id})` : " (same client)"} · {ago(s.created_at, now)}
                  </span>
                ))}
                . Make sure the payment really arrived before approving.
              </div>
            </div>
          )}

          <div>
            <Row k="Client" v={<ManualClient id={d.user_id} name={d.user_name} email={d.user_email} />} />
            <Row
              k="Method"
              v={
                <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                  {m.name} <KindChip kind={d.kind} upi={d.kind === "bank" && !!m.upi_id && !m.account_number} />
                </span>
              }
            />
            {d.kind === "crypto" ? (
              <>
                <Row k="Network" v={`${m.network ?? "—"} · ${m.token ?? ""}`} />
                <Row k="Paid to" v={<span className="break-all font-mono text-[12px]">{m.destination ?? "—"}</span>} />
                {m.memo && <Row k="Memo / tag" v={<span className="font-mono text-[12px]">{m.memo}</span>} />}
              </>
            ) : (
              <>
                {m.bank_name && <Row k="Bank" v={`${m.bank_name}${m.ifsc ? ` · ${m.ifsc}` : ""}`} />}
                {m.account_number && <Row k="Account" v={<span className="font-mono text-[12px]">{m.account_number}</span>} />}
                {m.upi_id && <Row k="UPI ID" v={<span className="font-mono text-[12px]">{m.upi_id}</span>} />}
                {m.account_name && <Row k="Account holder" v={m.account_name} />}
              </>
            )}
            <Row k="Amount" v={<span className="k-num font-medium">{money(d.amount, d.currency)}</span>} />
            <Row k="Rate" v={<span className="k-num">{d.currency === "USDT" ? "1:1" : (rate?.fwd ?? d.rate)}</span>} />
            <Row k="Expected credit" v={<span className="k-num font-medium">{usd(d.expected_credit)} USDT</span>} />
            <Row
              k={d.kind === "crypto" ? "Transaction" : "UTR / reference"}
              v={
                <span className="inline-flex max-w-full items-start justify-end gap-1">
                  <span className="break-all text-right font-mono text-[12px]">{d.reference}</span>
                  <CopyButton value={d.reference} label="Reference" className="shrink-0" />
                  {d.explorer_url && (
                    <a href={d.explorer_url} target="_blank" rel="noreferrer" className="inline-grid size-6 shrink-0 place-items-center rounded-md text-fg-3 hover:bg-surface-3 hover:text-ember" aria-label="Open in the block explorer" title="Open in the block explorer">
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </span>
              }
            />
            {d.client_note && <Row k="Client note" v={<span className="italic text-fg-2">“{d.client_note}”</span>} />}
            <Row k="Sent" v={`${when(d.created_at)}${d.ip ? ` · IP ${d.ip}` : ""}`} />
            <Row k="Client history" v={<HistoryLine h={d.client_history} />} />
            {d.status !== "pending" && (
              <>
                <Row k={d.status === "cancelled" ? "Cancelled" : d.status === "approved" ? "Approved by" : "Rejected by"} v={`${d.status === "cancelled" ? "the client" : (d.decided_by?.name ?? "staff")}${d.decided_at ? ` · ${when(d.decided_at)}` : ""}`} />
                {d.status === "approved" && d.credit_amount && <Row k="Credited" v={<span className="k-num font-medium text-up">{usd(d.credit_amount)} USDT</span>} />}
                {d.decision_note && <Row k="Note" v={d.decision_note} />}
                {d.status === "rejected" && d.reason && <Row k="Reason (client sees it)" v={d.reason} />}
                {d.ledger_txn_id && <Row k="Ledger" v={<span className="font-mono text-[12px]">txn {d.ledger_txn_id}</span>} />}
              </>
            )}
          </div>

          <div>
            <div className="k-label mb-2">Payment proof</div>
            {d.proof_url ? (
              <a href={d.proof_url} target="_blank" rel="noreferrer" className="group block w-fit" title="Open full size">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.proof_url} alt="Payment screenshot" className="max-h-60 max-w-full rounded-[14px] border border-line object-contain transition-opacity group-hover:opacity-90" />
                <span className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-fg-3 group-hover:text-ember">
                  <ExternalLink className="size-3" /> Open full size
                </span>
              </a>
            ) : (
              <div className="k-row px-3.5 py-3 text-[12.5px] text-fg-3">No screenshot attached — check the {d.kind === "crypto" ? "transaction on the explorer" : "UTR in the bank statement"}.</div>
            )}
          </div>

          {mode && (
            <div className="space-y-3 rounded-[16px] border border-line bg-surface-2 p-4" data-testid="decision-panel">
              <div className="text-[13.5px] font-medium">{mode === "approve" ? "Approve and credit the wallet" : "Reject this request"}</div>
              {mode === "approve" ? (
                <>
                  <p className="text-[12.5px] text-fg-3">
                    Check that {money(d.amount, d.currency)} arrived with reference <span className="font-mono">{d.reference.length > 20 ? short(d.reference, 10, 8) : d.reference}</span>. The client&apos;s wallet is credited at once.
                  </p>
                  <Field label="Amount to credit (USDT)" hint={`Expected ${usd(d.expected_credit)}`} error={err?.field === "credit_amount" ? err.message : !creditOk && credit ? "Enter an amount above 0 with at most 6 decimals" : undefined}>
                    <Input value={credit} onChange={(e) => setCredit(e.target.value.replace(",", "."))} inputMode="decimal" trailing={<span className="text-[12px]">USDT</span>} inputClassName="k-num" aria-label="Amount to credit" />
                  </Field>
                  <Field label={changed ? "Note (required: why the amount differs)" : "Note (optional)"} error={err?.field === "note" ? err.message : noteMissing && note ? "Add at least a few words" : undefined}>
                    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={changed ? "Bank deducted a 250 INR charge" : "Checked in the statement"} aria-label="Note" />
                  </Field>
                  {changed && <div className="text-[12px] text-warn">You&apos;re crediting {usd(credit)} USDT instead of {usd(d.expected_credit)} USDT. The note is kept in the audit log.</div>}
                </>
              ) : (
                <Field label="Reason (shown to the client)" error={err?.field === "reason" ? err.message : undefined}>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="No payment with this UTR reached our account" aria-label="Reason" />
                </Field>
              )}
              {err && !["credit_amount", "note", "reason"].includes(err.field ?? "") && <div className="text-[12.5px] text-down">{err.message}</div>}
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => (setMode(null), setErr(null))}>
                  Cancel
                </Button>
                {mode === "approve" ? (
                  <Button variant="ember" disabled={busy || !creditOk || noteMissing} onClick={approve}>
                    {busy ? <Loader2 className="animate-spin" /> : <BadgeCheck />} Credit {creditOk ? usd(credit) : "—"} USDT
                  </Button>
                ) : (
                  <Button variant="down-outline" disabled={busy || reason.trim().length < 3} onClick={reject}>
                    {busy ? <Loader2 className="animate-spin" /> : <XCircle />} Reject request
                  </Button>
                )}
              </div>
            </div>
          )}

          <History d={d} now={now} />
        </div>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LiveManualDepositsPage() {
  const now = useNow();
  const canExport = useCan("finance.export");
  const [tab, setTab] = React.useState<Tab>("pending");
  const [kind, setKind] = React.useState("all");
  const [method, setMethod] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [open, setOpen] = React.useState<number | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const dq = useDebounced(q.trim(), 300);
  React.useEffect(() => setPage(1), [tab, kind, method, dq]);

  // ?method_id= (from Payment methods) and ?id= (a direct link to one request)
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const mid = p.get("method_id");
    if (mid && /^\d{1,18}$/.test(mid)) setMethod(mid);
    const id = p.get("id");
    if (id && /^\d{1,18}$/.test(id)) setOpen(Number(id));
    const onOpen = (e: Event) => setOpen(Number((e as CustomEvent).detail));
    window.addEventListener("ezymex:open-manual-deposit", onOpen);
    return () => window.removeEventListener("ezymex:open-manual-deposit", onOpen);
  }, []);

  const filters = { status: tab, kind, method_id: method, q: dq };
  const { data, error, loading, reload } = useManualDeposits({ ...filters, page, limit: PER });
  const methods = useManualMethods();
  const c = data?.counts;

  const doExport = async () => {
    setExporting(true);
    const r = await exportDeposits(filters);
    setExporting(false);
    if (!r.ok) toast.error("Export failed", { description: r.error.message });
    else if (r.data.rows === null) toast.success("Export downloaded", { description: "Manual deposits with the current filters (CSV)." });
  };

  const cols: Column<ManualDeposit>[] = [
    { key: "id", header: "ID", cell: (r) => <span className="font-mono text-[12px] text-fg-3">#{r.id}</span> },
    { key: "c", header: "Client", cell: (r) => <ManualClient id={r.user_id} name={r.user_name} email={r.user_email} /> },
    { key: "m", header: "Method", hideOn: "sm", cell: (r) => <MethodCell d={r} /> },
    { key: "a", header: "Amount", align: "right", cell: (r) => <span className="k-num whitespace-nowrap font-mono text-[12.5px] font-medium">{money(r.amount, r.currency)}</span> },
    {
      key: "u",
      header: "≈ USDT",
      align: "right",
      cell: (r) =>
        r.status === "approved" && r.credit_amount ? (
          <span className={`k-num whitespace-nowrap font-mono text-[12px] ${sameAmount(r.credit_amount, r.expected_credit) ? "text-up" : "text-warn"}`} title={sameAmount(r.credit_amount, r.expected_credit) ? "Credited" : `Credited instead of ${usd(r.expected_credit)}`}>
            {usd2(r.credit_amount)}
          </span>
        ) : (
          <span className="k-num whitespace-nowrap font-mono text-[12px] text-fg-2">{usd2(r.expected_credit)}</span>
        ),
    },
    { key: "r", header: "Reference", hideOn: "sm", cell: (r) => <RefCell v={r.reference} /> },
    {
      key: "p",
      header: "Proof",
      align: "center",
      hideOn: "md",
      cell: (r) =>
        r.proof_url ? (
          <a href={r.proof_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-grid size-7 place-items-center rounded-md text-fg-2 hover:bg-surface-3 hover:text-ember" aria-label="Open the payment screenshot">
            <ImageIcon className="size-4" />
          </a>
        ) : (
          <span className="text-fg-3">—</span>
        ),
    },
    { key: "s", header: "Status", cell: (r) => <Status map={MANUAL_STATUS} s={r.status} /> },
    { key: "t", header: "Sent", align: "right", cell: (r) => <span className="whitespace-nowrap text-[11.5px] text-fg-3" title={when(r.created_at)}>{ago(r.created_at, now)}</span> },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="Manual deposits"
        subtitle="Bank, UPI and crypto payments clients made outside the platform. Check each payment, then approve it to credit the wallet or reject it with a reason."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/finance/payment-methods" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "hidden xl:inline-flex")}>
              <Settings2 /> Payment methods
            </Link>
            <Button variant="surface" size="lg" onClick={reload}>
              <RefreshCw /> Refresh
            </Button>
            {canExport && (
              <Button variant="surface" size="lg" disabled={exporting} onClick={doExport}>
                {exporting ? <Loader2 className="animate-spin" /> : <Download />} Export CSV
              </Button>
            )}
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Pending" icon={<Clock />} value={<span className="k-num">{c?.pending ?? "—"}</span>} chip={c ? `≈ ${usd2(c.pending_usdt)} USDT` : "—"} chipTone={c?.pending ? "warn" : "neutral"} hot={!!c?.pending} />
        <KpiCard
          label="Pending by kind"
          icon={<Inbox />}
          value={
            <span className="k-num">
              {c?.pending_bank ?? "—"}
              <span className="mx-1.5 text-[22px] text-fg-3">/</span>
              {c?.pending_crypto ?? "—"}
            </span>
          }
          chip="Bank & UPI / crypto"
          delay={0.04}
        />
        <KpiCard label="Approved" icon={<BadgeCheck />} value={<span className="k-num">{c?.approved ?? "—"}</span>} chip="Credited to wallets" chipTone="up" delay={0.08} />
        <KpiCard label="Rejected" icon={<XCircle />} value={<span className="k-num">{c?.rejected ?? "—"}</span>} chip={c ? `${c.cancelled} cancelled by clients` : "—"} delay={0.12} />
      </div>
      <Card className="mt-4 px-4 py-5 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="-mx-1 max-w-full overflow-x-auto px-1">
            <Tabs
              className="w-max"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "pending", label: "Pending", count: c?.pending },
                { value: "approved", label: "Approved", count: c?.approved },
                { value: "rejected", label: "Rejected", count: c?.rejected },
                { value: "cancelled", label: "Cancelled", count: c?.cancelled },
                { value: "all", label: "All", count: c?.all },
              ]}
            />
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 lg:ml-auto lg:w-auto">
            <FilterSelect label="Kind" value={kind} onChange={setKind} options={[{ value: "all", label: "All" }, { value: "bank", label: "Bank & UPI" }, { value: "crypto", label: "Crypto" }]} />
            <FilterSelect label="Method" value={method} onChange={setMethod} options={[{ value: "all", label: "All methods" }, ...(methods.data?.methods ?? []).filter((m) => kind === "all" || m.kind === kind).map((m) => ({ value: String(m.id), label: m.name })), ...(method !== "all" && !methods.data?.methods.some((m) => String(m.id) === method) ? [{ value: method, label: `Method #${method}` }] : [])]} />
            <div className="flex h-9 w-full min-w-0 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 sm:w-auto">
              <Search className="size-3.5 shrink-0 text-fg-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Reference, client or ID" className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-fg-3 sm:w-48" aria-label="Search manual deposits" />
            </div>
          </div>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : !data ? (
          <TableSkeleton />
        ) : (
          <div className={loading ? "opacity-90" : undefined}>
            <DataTable
              columns={cols}
              rows={data.items}
              dense
              pageSize={PER}
              rowKey={(r) => String(r.id)}
              onRowClick={(r) => setOpen(r.id)}
              empty={
                <EmptyState
                  title={tab === "pending" ? "Nothing to review" : "No requests"}
                  text={tab === "pending" ? "Requests clients send after paying a bank account, UPI ID or crypto address appear here." : "Try another tab or clear the filters."}
                  illustration="inbox_tray"
                />
              }
            />
            <Pager page={data.page} perPage={data.limit} total={data.total} onPage={setPage} />
          </div>
        )}
      </Card>
      <DepositDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />
    </div>
  );
}
