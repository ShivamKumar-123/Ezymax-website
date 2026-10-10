"use client";

/**
 * Finance → Crypto checkouts: the OxaPay invoices clients opened, and what became of them.
 *
 * There is nothing to approve here — a paid checkout credits the wallet by itself (services/wallet
 * ops::oxapay) — so this page is a record, plus one action: **Recheck** asks OxaPay again about a single
 * checkout. That is the fix for a callback that never arrived; it credits the wallet if OxaPay says the
 * invoice was paid, and is safe to press as often as you like because crediting is idempotent.
 *
 * Live only. The showcase has no payment provider behind it, so demo builds show the empty state.
 */

import * as React from "react";
import { ArrowUpRight, Inbox, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, DataTable, EmptyState, Input, KpiCard, PageHeader, type Column } from "@ezymex/ui";
import { IS_DEMO } from "@ezymex/mock/mode";
import { ErrorState, FilterSelect, Pager, TableSkeleton, ago, qs, useApi, useDebounced } from "@/components/live/kit";
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
  const can = useCan();
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
    { key: "amount", header: "Asked", align: "end", cell: (r) => <span className="k-num">{usd2(r.amount)} USD</span> },
    { key: "credited", header: "Credited", align: "end", cell: (r) => <span className="k-num">{r.credited ? `${usd2(r.credited)} USDT` : "—"}</span> },
    { key: "paid", header: "Paid in", cell: (r) => (r.paid_currency ? <span className="text-[12.5px]">{r.paid_amount ? `${r.paid_amount} ` : ""}{r.paid_currency}{r.network ? ` · ${r.network}` : ""}</span> : <span className="text-fg-3">—</span>) },
    { key: "reference", header: "Reference", cell: (r) => <span className="font-mono text-[11.5px] text-fg-2">{r.order_id}</span> },
    { key: "status", header: "Status", cell: (r) => <Status map={STATUS} s={r.status} /> },
    { key: "created_at", header: "Opened", cell: (r) => <span className="text-[12.5px] text-fg-3">{ago(r.created_at)}</span> },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (r) => (r.status === "credited" || !can("finance.read") ? null : <RecheckButton id={r.id} onDone={reload} />),
    },
  ];

  const header = <PageHeader title="Crypto checkouts" subtitle="Deposits paid on the payment provider's hosted page. Credited automatically — nothing to approve." />;

  if (IS_DEMO) {
    return (
      <div className="pb-16">
        {header}
        <Card>
          <EmptyState icon={<Inbox />} title="Not in the showcase" text="Crypto checkouts need a live payment provider, so this page is empty in the demo build." />
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
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Credited" value={`${usd2(data?.credited_total ?? 0)} USDT`} icon={<ArrowUpRight />} />
        <KpiCard label="Credited checkouts" value={String(counts.credited ?? 0)} />
        <KpiCard label="Open" value={String(open)} chip={open ? "waiting" : undefined} chipTone="ember" />
        <KpiCard label="Expired or failed" value={String((counts.expired ?? 0) + (counts.failed ?? 0) + (counts.cancelled ?? 0))} />
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-2 px-4 pt-4 sm:px-5">
          <FilterSelect value={status} onChange={setStatus} options={FILTERS} />
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
          <EmptyState icon={<Inbox />} title="No checkouts" text="No crypto checkout matches this filter yet." />
        ) : (
          <>
            <DataTable columns={columns} rows={data.items} exportName="crypto-checkouts" />
            <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
