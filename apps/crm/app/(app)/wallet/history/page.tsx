"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Clock, Download, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, DataTable, KpiCard, Money, PageHeader, Reveal, Segmented, StatusChip, formatDateTime, formatNumber, type Column } from "@kalks/ui";
import { WALLET_TXS, type WalletTx } from "@kalks/mock";
import { TX_TYPE_LABEL, fullHash, txDirection } from "@kalks/mock/wallet-extra";
import { HashLink, TxAmount, TxDetailDrawer, TxIcon, txCounterparty } from "@/components/wallet/wallet-ui";

type TypeF = "all" | "deposit" | "withdrawal" | "transfer" | "other";
type StatusF = "all" | "completed" | "pending" | "rejected";
type RangeF = "7D" | "30D" | "ALL";

const NOW = Date.parse("2026-09-24T21:00:00Z");

function downloadCsv(rows: WalletTx[]) {
  const head = ["id", "date_gmt3", "type", "status", "direction", "amount", "asset", "fee", "from", "to", "tx_hash"];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = rows.map((t) => [t.id, formatDateTime(t.createdAt, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }), TX_TYPE_LABEL[t.type], t.status, txDirection(t), t.amount.toFixed(2), t.asset, t.fee.toFixed(2), t.from, t.to, fullHash(t.hash)].map(esc).join(","));
  const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kalks-wallet-history-${new Date(NOW).toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("CSV exported", { description: `${rows.length} transactions` });
}

export default function WalletHistoryPage() {
  const [type, setType] = React.useState<TypeF>("all");
  const [status, setStatus] = React.useState<StatusF>("all");
  const [range, setRange] = React.useState<RangeF>("30D");
  const [tx, setTx] = React.useState<WalletTx | null>(null);

  const rows = React.useMemo(
    () =>
      WALLET_TXS.filter((t) => {
        if (range !== "ALL" && NOW - Date.parse(t.createdAt) > (range === "7D" ? 7 : 30) * 86400000) return false;
        if (type === "other" ? ["deposit", "withdrawal", "transfer"].includes(t.type) : type !== "all" && t.type !== type) return false;
        if (status === "pending" ? !(t.status === "pending" || t.status === "processing") : status !== "all" && t.status !== status) return false;
        return true;
      }),
    [type, status, range],
  );
  const ok = rows.filter((t) => t.status !== "rejected");
  const totalIn = ok.filter((t) => txDirection(t) === "in").reduce((s, t) => s + t.amount, 0);
  const totalOut = ok.filter((t) => txDirection(t) === "out").reduce((s, t) => s + t.amount, 0);
  const pending = rows.filter((t) => t.status === "pending" || t.status === "processing").length;
  const fees = ok.reduce((s, t) => s + t.fee, 0);

  const cols: Column<WalletTx>[] = [
    {
      key: "date",
      header: "Date",
      width: "130px",
      cell: (t) => (
        <div>
          <div className="k-num text-[13px] text-fg">{formatDateTime(t.createdAt, { day: "2-digit", month: "short", year: "numeric" })}</div>
          <div className="k-num text-[11.5px] text-fg-3">{formatDateTime(t.createdAt, { hour: "2-digit", minute: "2-digit" })} GMT+3</div>
        </div>
      ),
      sort: (t) => t.createdAt,
    },
    {
      key: "type",
      header: "Type",
      cell: (t) => (
        <div className="flex items-center gap-3">
          <TxIcon tx={t} size={32} />
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium">{TX_TYPE_LABEL[t.type]}</div>
            <div className="font-mono text-[11px] text-fg-3">{t.id}</div>
          </div>
        </div>
      ),
      sort: (t) => t.type,
    },
    { key: "party", header: "Details", hideOn: "lg", cell: (t) => <span className="text-[12.5px] text-fg-2">{txCounterparty(t)}</span> },
    { key: "amount", header: "Amount", align: "right", cell: (t) => <TxAmount tx={t} className="text-[14px]" />, sort: (t) => (txDirection(t) === "in" ? t.amount : -t.amount) },
    { key: "fee", header: "Fee", align: "right", hideOn: "md", cell: (t) => <span className="k-num text-[12.5px] text-fg-3">{t.fee ? formatNumber(t.fee) : "—"}</span> },
    { key: "hash", header: "Tx hash", hideOn: "sm", cell: (t) => <HashLink hash={t.hash} /> },
    { key: "status", header: "Status", align: "right", cell: (t) => <StatusChip status={t.status} label={t.status === "processing" && t.confirmations ? `${t.confirmations}/20 conf.` : undefined} /> },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="Wallet history"
        subtitle="Every deposit, withdrawal, transfer and payout on your wallet. Times in server time (GMT+3)."
        actions={
          <>
            <Segmented size="sm" value={range} onChange={setRange} options={[{ value: "7D", label: "7 days" }, { value: "30D", label: "30 days" }, { value: "ALL", label: "All" }]} />
            <Button variant="surface" onClick={() => downloadCsv(rows)}>
              <Download /> Export CSV
            </Button>
            <Link href="/wallet">
              <Button variant="ghost">
                <ArrowLeft /> Wallet
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Money in" icon={<ArrowDownLeft />} value={<Money value={totalIn} tone="up" />} chip={`${ok.filter((t) => txDirection(t) === "in").length} transactions`} chipTone="up" />
        <KpiCard label="Money out" icon={<ArrowUpRight />} value={<Money value={totalOut} />} chip={`${ok.filter((t) => txDirection(t) === "out").length} transactions`} delay={0.05} />
        <KpiCard label="In progress" icon={<Clock />} value={<span className="k-num">{pending}</span>} chip={pending ? "Awaiting confirmation or approval" : "All settled"} chipTone={pending ? "warn" : "up"} delay={0.1} />
        <KpiCard label="Fees paid" icon={<Receipt />} value={<Money value={fees} />} chip="Deposits & transfers are free" delay={0.15} />
      </div>

      <Reveal delay={0.1} className="mt-4 block">
        <Card className="px-4 pb-5 pt-5 sm:px-6">
          <DataTable
            columns={cols}
            rows={rows}
            rowKey={(t) => t.id}
            pageSize={12}
            onRowClick={setTx}
            search={(t) => `${t.id} ${t.hash ?? ""} ${t.from} ${t.to} ${TX_TYPE_LABEL[t.type]} ${t.amount}`}
            searchPlaceholder="ID, hash, account…"
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  size="xs"
                  value={type}
                  onChange={setType}
                  options={[
                    { value: "all", label: "All types" },
                    { value: "deposit", label: "Deposits" },
                    { value: "withdrawal", label: "Withdrawals" },
                    { value: "transfer", label: "Transfers" },
                    { value: "other", label: "Other" },
                  ]}
                />
                <Segmented
                  size="xs"
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: "all", label: "Any status" },
                    { value: "completed", label: "Completed" },
                    { value: "pending", label: "Pending" },
                    { value: "rejected", label: "Rejected" },
                  ]}
                />
              </div>
            }
          />
        </Card>
      </Reveal>

      <TxDetailDrawer tx={tx} onOpenChange={(o) => !o && setTx(null)} />
    </div>
  );
}
