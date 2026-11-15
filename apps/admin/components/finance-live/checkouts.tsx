"use client";

/**
 * Finance → Crypto checkouts: the OxaPay invoices clients opened, and what became of them.
 *
 * There is nothing to approve here — a paid checkout credits the wallet by itself (services/wallet
 * ops::oxapay) — so this page is a record, plus one action: **Recheck** asks OxaPay again about a single
 * checkout. That is the fix for a callback that never arrived; it credits the wallet if OxaPay says the
 * invoice was paid, and is safe to press as often as you like because crediting is idempotent.
 *
 * **Payments to closed addresses**: OxaPay gives every checkout its own address and books money to it only
 * while the checkout is open. A client who pays a saved address from an earlier deposit has sent money OxaPay
 * holds but attributes to nothing. The wallet watches the addresses of paid checkouts (services/wallet
 * ops::oxapay scan_strays) and lists such payments here; staff recover them through OxaPay support, credit the
 * client by a wallet adjustment, and then mark the row resolved with a note.
 *
 * Live only. The showcase has no payment provider behind it, so demo builds show the empty state.
 */

import * as React from "react";
import { ArrowUpRight, CircleAlert, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, DataTable, EmptyState, Input, KpiCard, PageHeader, type Column } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { ErrorState, FilterSelect, Pager, TableSkeleton, ago, qs, useApi, useDebounced, useNow } from "@/components/live/kit";
import { useCan } from "@/components/staff-session";
import { ClientCell, Status, usd2, walletWrite } from "./kit";

export interface Checkout {
  id: number;
  user_id: number;
  order_id: string;
  track_id: string | null;
  amount: string;
  currency: string;
  status: string;
  credited: string | null;
  paid_amount: string | null;
  paid_currency: string | null;
  tx_hash: string | null;
  network: string | null;
  ledger_txn_id: number | null;
  expires_at: string | null;
  credited_at: string | null;
  created_at: string;
}

interface Resp {
  items: Checkout[];
  page: number;
  limit: number;
  total: number;
  counts: Record<string, number>;
  credited_total: string;
  enabled: boolean;
}

const STATUS = {
  credited: { tone: "up" as const, label: "Credited" },
  paying: { tone: "ember" as const, label: "Confirming" },
  waiting: { tone: "neutral" as const, label: "Awaiting payment" },
  new: { tone: "neutral" as const, label: "Opening" },
  expired: { tone: "neutral" as const, label: "Expired" },
  failed: { tone: "down" as const, label: "Failed" },
  cancelled: { tone: "neutral" as const, label: "Cancelled" },
};

interface Stray {
  id: number;
  invoice_id: number;
  invoice_order_id: string | null;
  invoice_user_id: number | null;
  invoice_credited_at: string | null;
  chain: string;
  address: string;
  tx_hash: string;
  from_address: string | null;
  amount: string;
  block_time: string | null;
  status: "open" | "resolved";
  note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface StrayResp {
  items: Stray[];
  page: number;
  limit: number;
  total: number;
  open: number;
  watched_addresses: number;
}

const explorer = (chain: string, hash: string) => (chain === "tron" ? `https://tronscan.org/#/transaction/${hash}` : `https://bscscan.com/tx/${hash}`);

function ResolveButton({ id, onDone }: { id: number; onDone: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const go = async () => {
    const note = window.prompt("What was done about this payment? (recovered from OxaPay and credited by adjustment #…, or why nothing is owed)");
    if (!note || !note.trim()) return;
    setBusy(true);
    try {
      await walletWrite<{ stray: Stray }>(`/api/wallet/oxapay/strays/${id}/resolve`, { note: note.trim() });
      toast.success("Marked resolved");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not resolve");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="sm" variant="surface" onClick={go} disabled={busy}>
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : null} Resolve
    </Button>
  );
}

/** Payments that reached the address of a closed checkout (open ones first). */
function StrayPayments({ canApprove }: { canApprove: boolean }) {
  const now = useNow();
  const [all, setAll] = React.useState(false);
  const { data, error, loading, reload } = useApi<StrayResp>(`/api/wallet/oxapay/strays${qs({ status: all ? "all" : "open", limit: 50 })}`, { refreshMs: 30_000 });
  if (error && !data) return null;
  const items = data?.items ?? [];
  if (!loading && !items.length && !all) {
    return (
      <Card className="mb-4">
        <div className="flex items-center justify-between gap-3 px-5 py-4 text-[13px] text-fg-2">
          <span>
            No payments to closed checkout addresses. {data?.watched_addresses ?? 0} past addresses are watched.
          </span>
          <Button size="sm" variant="ghost" onClick={() => setAll(true)}>
            Show resolved
          </Button>
        </div>
      </Card>
    );
  }
  const columns: Column<Stray>[] = [
    { key: "when", header: "Paid", cell: (r) => <span className="text-[12.5px] text-fg-3">{ago(r.block_time ?? r.created_at, now)}</span> },
    { key: "amount", header: "Amount", align: "right", cell: (r) => <span className="k-num">{usd2(r.amount)} USDT</span> },
    { key: "chain", header: "Network", cell: (r) => <span className="text-[12.5px]">{r.chain === "tron" ? "TRC20" : "BEP20"}</span> },
    {
      key: "tx",
      header: "Transaction",
      cell: (r) => (
        <a href={explorer(r.chain, r.tx_hash)} target="_blank" rel="noopener noreferrer" className="font-mono text-[11.5px] text-ember underline-offset-2 hover:underline">
          {r.tx_hash.slice(0, 10)}…{r.tx_hash.slice(-6)}
        </a>
      ),
    },
    {
      key: "invoice",
      header: "Closed checkout",
      cell: (r) => (
        <span className="text-[12.5px]">
          <span className="font-mono text-[11.5px] text-fg-2">{r.invoice_order_id ?? r.invoice_id}</span>
          {r.invoice_credited_at ? <span className="text-fg-3"> · credited {ago(r.invoice_credited_at, now)}</span> : null}
        </span>
      ),
    },
    { key: "owner", header: "Its client", cell: (r) => (r.invoice_user_id ? <ClientCell id={r.invoice_user_id} /> : <span className="text-fg-3">—</span>) },
    {
      key: "status",
      header: "Status",
      cell: (r) => (r.status === "open" ? <Status map={{ open: { tone: "ember" as const, label: "Needs recovery" } }} s="open" /> : <span className="text-[12px] text-fg-3">Resolved by {r.resolved_by ?? "staff"}{r.note ? ` · ${r.note}` : ""}</span>),
    },
    { key: "actions", header: "", align: "right", cell: (r) => (r.status === "open" && canApprove ? <ResolveButton id={r.id} onDone={reload} /> : null) },
  ];
  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-start gap-3 px-4 pt-4 sm:px-5">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-ember" />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold">Payments to closed checkout addresses</div>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-3">
            Money sent to the address of a checkout that was already paid or expired. A hint, not a fact: OxaPay reassigns a closed address to other merchants, so a
            transfer here may be someone else's payment (15 Nov 2026: two TRON transfers were). Act only when a client of ours reports the payment: open a ticket with
            OxaPay quoting the transaction, credit the client by a wallet adjustment once it is recovered (OxaPay refunds to the sending wallet, less 5% and the network
            fee, never to the merchant balance), then mark the row resolved.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setAll((v) => !v)}>
          {all ? "Open only" : "Show resolved"}
        </Button>
      </div>
      {loading && !data ? <TableSkeleton rows={2} /> : <DataTable columns={columns} rows={items} exportName="oxapay-stray-payments" />}
    </Card>
  );
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "credited", label: "Credited" },
  { value: "paying", label: "Confirming" },
  { value: "waiting", label: "Awaiting payment" },
  { value: "expired", label: "Expired" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

function RecheckButton({ id, onDone }: { id: number; onDone: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const run = async () => {
    if (busy) return;
    setBusy(true);
    const r = await walletWrite<{ checkout: Checkout }>(`/api/wallet/oxapay/invoices/${id}/recheck`, {});
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error.message ?? "The provider could not be reached.");
      return;
    }
    const s = r.data.checkout.status;
    toast.success(s === "credited" ? `Checkout ${id} is paid and credited.` : `Checkout ${id} is ${STATUS[s as keyof typeof STATUS]?.label.toLowerCase() ?? s}.`);
    onDone();
  };
  return (
    <Button variant="ghost" size="xs" onClick={run} disabled={busy} title="Ask the provider about this checkout again">
      {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
    </Button>
  );
}

export function LiveCheckoutsPage() {
  const canRead = useCan("finance.read");
  const canApprove = useCan("finance.approve");
  const now = useNow();
  const [status, setStatus] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const search = useDebounced(q, 300);
  const limit = 25;
  const url = `/api/wallet/oxapay/invoices${qs({ status, q: search, page, limit })}`;
  const { data, error, loading, reload } = useApi<Resp>(IS_DEMO ? null : url, { refreshMs: 20_000 });

  React.useEffect(() => setPage(1), [status, search]);

  const columns: Column<Checkout>[] = [
    { key: "id", header: "ID", cell: (r) => <span className="font-mono text-[12.5px]">{r.id}</span> },
    { key: "client", header: "Client", cell: (r) => <ClientCell id={r.user_id} /> },
    { key: "amount", header: "Asked", align: "right", cell: (r) => <span className="k-num">{usd2(r.amount)} USD</span> },
    { key: "credited", header: "Credited", align: "right", cell: (r) => <span className="k-num">{r.credited ? `${usd2(r.credited)} USDT` : "—"}</span> },
    { key: "paid", header: "Paid in", cell: (r) => (r.paid_currency ? <span className="text-[12.5px]">{r.paid_amount ? `${r.paid_amount} ` : ""}{r.paid_currency}{r.network ? ` · ${r.network}` : ""}</span> : <span className="text-fg-3">—</span>) },
    { key: "reference", header: "Reference", cell: (r) => <span className="font-mono text-[11.5px] text-fg-2">{r.order_id}</span> },
    { key: "status", header: "Status", cell: (r) => <Status map={STATUS} s={r.status} /> },
    { key: "created_at", header: "Opened", cell: (r) => <span className="text-[12.5px] text-fg-3">{ago(r.created_at, now)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (r) => (r.status === "credited" || !canRead ? null : <RecheckButton id={r.id} onDone={reload} />),
    },
  ];

  const header = <PageHeader title="Crypto checkouts" subtitle="Deposits paid on the payment provider's hosted page. Credited automatically — nothing to approve." />;

  if (IS_DEMO) {
    return (
      <div className="pb-16">
        {header}
        <Card>
          <EmptyState illustration="bank" title="Not in the showcase" text="Crypto checkouts need a live payment provider, so this page is empty in the demo build." />
        </Card>
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="pb-16">
        {header}
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }

  const counts = data?.counts ?? {};
  const open = (counts.waiting ?? 0) + (counts.paying ?? 0) + (counts.new ?? 0);

  return (
    <div className="pb-16">
      {header}
      {data && !data.enabled && (
        <Card className="mb-4">
          <div className="p-5 text-[13.5px] text-fg-2">
            The crypto checkout is switched off: no provider key is configured, so clients do not see this option. Past checkouts stay listed.
          </div>
        </Card>
      )}
      <StrayPayments canApprove={canApprove} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Credited" value={`${usd2(data?.credited_total ?? 0)} USDT`} icon={<ArrowUpRight />} />
        <KpiCard label="Credited checkouts" value={String(counts.credited ?? 0)} />
        <KpiCard label="Open" value={String(open)} chip={open ? "waiting" : undefined} chipTone="ember" />
        <KpiCard label="Expired or failed" value={String((counts.expired ?? 0) + (counts.failed ?? 0) + (counts.cancelled ?? 0))} />
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-2 px-4 pt-4 sm:px-5">
          <FilterSelect label="Status" value={status} onChange={setStatus} options={FILTERS} />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Reference, provider id or transaction hash"
            leading={<Search className="size-4" />}
            className="w-full sm:w-[320px]"
            aria-label="Search checkouts"
          />
        </div>
        {loading && !data ? (
          <TableSkeleton rows={8} />
        ) : !data?.items.length ? (
          <EmptyState illustration="bank" title="No checkouts" text="No crypto checkout matches this filter yet." />
        ) : (
          <>
            <DataTable columns={columns} rows={data.items} exportName="crypto-checkouts" />
            <Pager page={data.page} perPage={data.limit} total={data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
