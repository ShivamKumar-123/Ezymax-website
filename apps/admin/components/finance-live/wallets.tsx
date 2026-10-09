"use client";

import * as React from "react";
import { Coins, Lock, RefreshCw, Search, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, DataTable, Dialog, EmptyState, Field, Input, KpiCard, PageHeader, Segmented, Tabs, cn, type Column } from "@ezymex/ui";
import { ErrorState, Pager, TableSkeleton, ago, qs, useApi, useDebounced, useNow, when } from "@/components/live/kit";
import { useCan } from "@/components/staff-session";
import { AdjustDialog } from "@/components/clients/adjust-dialog";
import { ClientCell, DEP_STATUS, Status, TxLink, WD_STATUS, usd, usd2, walletWrite, type Deposit, type Paged, type Summary, type Withdrawal } from "./kit";

const PER = 50;

type WalletRow = { user_id: number; currency: string; available: string; locked: string; total: string; deposited: string; withdrawn: string; updated_at: string };
type LedgerRow = { txn_id: number; kind: string; amount: string; available_delta: string; locked_delta: string; ref: string | null; note: string | null; actor: string; created_at: string };
type Transfer = { id: number; login: number; direction: string; amount: string; status: string; error_message: string | null; created_at: string };
type WalletDetail = { user_id: number; balances: { currency: string; available: string; locked: string }[]; ledger: LedgerRow[]; deposits: Deposit[]; withdrawals: Withdrawal[]; transfers: Transfer[] };

const KIND: Record<string, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal paid",
  withdrawal_lock: "Withdrawal requested",
  withdrawal_unlock: "Withdrawal released",
  to_trading: "To trading account",
  from_trading: "From trading account",
  trading_reserve: "Transfer reserved",
  trading_release: "Transfer released",
  commission: "Commission",
  ib_payout: "IB payout",
  prop_purchase: "Prop purchase",
  prop_payout: "Prop payout",
  pamm_invest: "PAMM invest",
  pamm_redeem: "PAMM redeem",
  copy_fee: "Copy fee",
  staking_subscribe: "Staking subscription",
  staking_reward: "Staking return",
  staking_redeem: "Staking principal back",
  adjustment: "Adjustment",
  adjustment_in: "Adjustment (added)",
  adjustment_out: "Adjustment (deducted)",
  manual_deposit: "Deposit (external)",
  manual_withdrawal: "Withdrawal (external)",
  refund: "Refund",
};

/** Opens Balance & credit on the wallet (limits, four-eyes, client notice: components/clients/adjust-dialog). */
function Adjust({ userId, onDone }: { userId: number; onDone: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] border border-line bg-surface-2 px-4 py-3">
      <div>
        <div className="text-[13.5px] font-medium">Manual adjustment</div>
        <div className="text-[11.5px] text-fg-3">Add or deduct funds with a reason; audited, four-eyes above the threshold.</div>
      </div>
      <Button variant="surface" size="sm" onClick={() => setOpen(true)}>
        <Coins /> Balance &amp; credit
      </Button>
      <AdjustDialog open={open} onOpenChange={setOpen} userId={userId} preset={{ target: "wallet" }} onDone={onDone} />
    </div>
  );
}

function WalletDrawer({ userId, onClose, onChanged }: { userId: number | null; onClose: () => void; onChanged: () => void }) {
  const { data, error, reload } = useApi<WalletDetail>(userId ? `/api/wallet/wallets/${userId}` : null, { refreshMs: 15_000 });
  const canAdjust = useCan("finance.adjust");
  const canCredit = useCan("finance.credit");
  const [tab, setTab] = React.useState<"ledger" | "deposits" | "withdrawals" | "transfers">("ledger");
  const b = data?.balances.find((x) => x.currency === "USDT");
  return (
    <Dialog side="right" open={userId !== null} onOpenChange={(o) => !o && onClose()} title={userId ? `Wallet · client #${userId}` : "Wallet"} description="USDT wallet: ledger, deposits, withdrawals and transfers">
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <TableSkeleton rows={4} />
      ) : (
        <div className="space-y-5">
          <ClientCell id={data.user_id} />
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Available", b?.available],
              ["Locked", b?.locked],
              ["Total", String(Number(b?.available ?? 0) + Number(b?.locked ?? 0))],
            ].map(([k, v]) => (
              <div key={k} className="k-row px-3 py-2.5">
                <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{k}</div>
                <div className="k-num mt-0.5 text-[14px] font-semibold">{usd(v)}</div>
              </div>
            ))}
          </div>
          {(canAdjust || canCredit) && <Adjust userId={data.user_id} onDone={() => (reload(), onChanged())} />}
          <Tabs value={tab} onChange={setTab} tabs={[{ value: "ledger", label: "Ledger" }, { value: "deposits", label: "Deposits", count: data.deposits.length }, { value: "withdrawals", label: "Withdrawals", count: data.withdrawals.length }, { value: "transfers", label: "Transfers", count: data.transfers.length }]} />
          <div className="space-y-1.5">
            {tab === "ledger" &&
              (data.ledger.length ? (
                data.ledger.map((l) => (
                  <div key={l.txn_id} className="k-row flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-medium">{KIND[l.kind] ?? l.kind}</div>
                      <div className="truncate text-[11px] text-fg-3">
                        {when(l.created_at)} · txn {l.txn_id} · {l.actor}
                        {l.note ? ` · ${l.note}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn("k-num font-mono text-[12.5px]", Number(l.available_delta) > 0 ? "text-up" : Number(l.available_delta) < 0 ? "text-fg" : "text-fg-3")}>
                        {Number(l.available_delta) > 0 ? "+" : ""}
                        {usd(l.available_delta)}
                      </div>
                      {Number(l.locked_delta) !== 0 && <div className="k-num font-mono text-[10.5px] text-fg-3">locked {Number(l.locked_delta) > 0 ? "+" : ""}{usd(l.locked_delta)}</div>}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[12.5px] text-fg-3">No ledger entries.</div>
              ))}
            {tab === "deposits" &&
              data.deposits.map((d) => (
                <div key={d.id} className="k-row flex items-center gap-3 px-3 py-2 text-[12.5px]">
                  <span className="font-mono text-fg-3">#{d.id}</span>
                  <TxLink hash={d.tx_hash} url={d.explorer_url} />
                  <Status map={DEP_STATUS} s={d.status} />
                  <span className="k-num ml-auto font-mono">{usd(d.amount ?? d.expected_amount)}</span>
                </div>
              ))}
            {tab === "withdrawals" &&
              data.withdrawals.map((w) => (
                <div key={w.id} className="k-row flex items-center gap-3 px-3 py-2 text-[12.5px]">
                  <span className="font-mono text-fg-3">#{w.id}</span>
                  <span className="text-fg-3">{when(w.created_at)}</span>
                  <Status map={WD_STATUS} s={w.status} />
                  <span className="k-num ml-auto font-mono">{usd(w.amount)}</span>
                </div>
              ))}
            {tab === "transfers" &&
              data.transfers.map((t) => (
                <div key={t.id} className="k-row flex items-center gap-3 px-3 py-2 text-[12.5px]">
                  <span>{t.direction === "to_trading" ? `To #${t.login}` : `From #${t.login}`}</span>
                  <span className="text-fg-3">{when(t.created_at)}</span>
                  <span className={cn("text-[11.5px]", t.status === "failed" ? "text-down" : t.status === "pending" ? "text-warn" : "text-fg-3")}>{t.status}</span>
                  <span className="k-num ml-auto font-mono">{usd(t.amount)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function LiveWalletsPage() {
  const now = useNow();
  const [q, setQ] = React.useState("");
  const [funded, setFunded] = React.useState<"funded" | "all">("funded");
  const [page, setPage] = React.useState(1);
  const [open, setOpen] = React.useState<number | null>(null);
  const dq = useDebounced(q.trim(), 350);
  React.useEffect(() => setPage(1), [dq, funded]);
  // a search term is resolved to client ids by the gateway (name, email, phone or #id)
  const users = useApi<{ items: { id: number }[] }>(dq ? `/api/admin/users${qs({ q: dq, per_page: 100 })}` : null);
  const ids = dq ? (users.data?.items ?? []).map((u) => u.id).join(",") || "0" : undefined;
  const ready = !dq || !!users.data || !!users.error;
  const { data, error, loading, reload } = useApi<Paged<WalletRow>>(ready ? `/api/wallet/wallets${qs({ user_ids: ids, min_balance: funded === "funded" && !dq ? "0.000001" : undefined, page, limit: PER })}` : null, { refreshMs: 20_000 });
  const sum = useApi<Summary>("/api/wallet/summary", { refreshMs: 20_000 });

  const cols: Column<WalletRow>[] = [
    { key: "c", header: "Client", cell: (r) => <ClientCell id={r.user_id} /> },
    { key: "a", header: "Available", align: "right", cell: (r) => <span className="k-num font-mono text-[12.5px] font-medium">{usd(r.available)}</span> },
    { key: "l", header: "Locked", align: "right", cell: (r) => <span className="k-num font-mono text-[12px] text-fg-3">{Number(r.locked) ? usd(r.locked) : "—"}</span> },
    { key: "t", header: "Total", align: "right", cell: (r) => <span className="k-num font-mono text-[12.5px]">{usd(r.total)}</span> },
    { key: "d", header: "Deposited", align: "right", hideOn: "lg", cell: (r) => <span className="k-num font-mono text-[12px] text-fg-2">{usd(r.deposited)}</span> },
    { key: "w", header: "Withdrawn", align: "right", hideOn: "lg", cell: (r) => <span className="k-num font-mono text-[12px] text-fg-2">{usd(r.withdrawn)}</span> },
    { key: "u", header: "Last change", align: "right", cell: (r) => <span className="text-[11.5px] text-fg-3" title={when(r.updated_at)}>{ago(r.updated_at, now)}</span> },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="Client wallets"
        subtitle="USDT balances of every client wallet, their ledger and manual adjustments (audited)."
        actions={
          <Button variant="surface" size="lg" onClick={() => (reload(), sum.reload())}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Client money" icon={<Wallet />} value={<span className="k-num">{sum.data ? `$${usd2(sum.data.wallets.liabilities)}` : "—"}</span>} chip="Available + locked" />
        <KpiCard label="Funded wallets" icon={<Users />} value={<span className="k-num">{sum.data?.wallets.funded ?? "—"}</span>} chip="Balance above zero" delay={0.04} />
        <KpiCard label="Locked in withdrawals" icon={<Lock />} value={<span className="k-num">{sum.data ? `$${usd2(sum.data.withdrawals.open_amount)}` : "—"}</span>} chip="Requested, approved, paid" delay={0.08} />
        <KpiCard label="Transfers in flight" icon={<Coins />} value={<span className="k-num">{sum.data?.trading_transfers_pending ?? "—"}</span>} chip="Wallet ↔ trading" delay={0.12} />
      </div>
      <Card className="mt-4 px-4 py-5 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex h-9 w-full items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 sm:w-auto sm:min-w-72">
            <Search className="size-3.5 text-fg-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Client name, email or #ID" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-3" aria-label="Search wallets" />
          </div>
          {!dq && <Segmented size="xs" value={funded} onChange={setFunded} options={[{ value: "funded", label: "With balance" }, { value: "all", label: "All" }]} />}
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
              rowKey={(r) => `${r.user_id}-${r.currency}`}
              onRowClick={(r) => setOpen(r.user_id)}
              exportName="client-wallets"
              empty={
                <EmptyState
                  title="No wallets"
                  text={dq ? "No wallet for these clients yet." : "Wallets appear once a client has had funds."}
                  illustration="bank"
                  action={
                    /^#?\d{1,18}$/.test(dq) ? (
                      <Button variant="surface" size="sm" onClick={() => setOpen(Number(dq.replace("#", "")))}>
                        Open wallet of client {dq.startsWith("#") ? dq : `#${dq}`}
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
            <Pager page={data.page} perPage={data.limit} total={data.total} onPage={setPage} />
          </div>
        )}
      </Card>
      <WalletDrawer userId={open} onClose={() => setOpen(null)} onChanged={() => (reload(), sum.reload())} />
    </div>
  );
}
