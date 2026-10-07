"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Clock, Download, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, DataTable, KpiCard, Money, PageHeader, Reveal, Segmented, StatusChip, formatDateTime, formatNumber, type Column } from "@/components/kit";
import { tr, useT } from "@kalks/i18n/react";
import { WALLET_TXS, type WalletTx } from "@kalks/mock";
import { TX_TYPE_LABEL, fullHash, txDirection } from "@kalks/mock/wallet-extra";
import { HashLink, TxAmount, TxDetailDrawer, TxIcon, txCounterparty, txStatusLabel, txTypeLabel } from "@/components/wallet/wallet-ui";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveHistoryPage } from "@/components/wallet-live/history-page";

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
  toast.success(tr("wallet.demo.csvExported"), { description: tr("wallet.demo.transactionsCount", { count: rows.length }) });
}

function DemoWalletHistoryPage() {
  const t = useT();
  const [type, setType] = React.useState<TypeF>("all");
  const [status, setStatus] = React.useState<StatusF>("all");
  const [range, setRange] = React.useState<RangeF>("30D");
  const [tx, setTx] = React.useState<WalletTx | null>(null);

  const rows = React.useMemo(
    () =>
      WALLET_TXS.filter((x) => {
        if (range !== "ALL" && NOW - Date.parse(x.createdAt) > (range === "7D" ? 7 : 30) * 86400000) return false;
        if (type === "other" ? ["deposit", "withdrawal", "transfer"].includes(x.type) : type !== "all" && x.type !== type) return false;
        if (status === "pending" ? !(x.status === "pending" || x.status === "processing") : status !== "all" && x.status !== status) return false;
        return true;
      }),
    [type, status, range],
  );
  const ok = rows.filter((x) => x.status !== "rejected");
  const totalIn = ok.filter((x) => txDirection(x) === "in").reduce((s, x) => s + x.amount, 0);
  const totalOut = ok.filter((x) => txDirection(x) === "out").reduce((s, x) => s + x.amount, 0);
  const pending = rows.filter((x) => x.status === "pending" || x.status === "processing").length;
  const fees = ok.reduce((s, x) => s + x.fee, 0);

  const cols: Column<WalletTx>[] = [
    {
      key: "date",
      header: t("common.date"),
      width: "130px",
      cell: (x) => (
        <div>
          <div className="k-num text-[13px] text-fg">{formatDateTime(x.createdAt, { day: "2-digit", month: "short", year: "numeric" })}</div>
          <div className="k-num text-[11.5px] text-fg-3">{formatDateTime(x.createdAt, { hour: "2-digit", minute: "2-digit" })} GMT+3</div>
        </div>
      ),
      sort: (x) => x.createdAt,
    },
    {
      key: "type",
      header: t("common.type"),
      cell: (x) => (
        <div className="flex items-center gap-3">
          <TxIcon tx={x} size={32} />
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium">{txTypeLabel(t, x.type)}</div>
            <div className="font-mono text-[11px] text-fg-3">{x.id}</div>
          </div>
        </div>
      ),
      sort: (x) => x.type,
    },
    { key: "party", header: t("wallet.demo.details"), hideOn: "lg", cell: (x) => <span className="text-[12.5px] text-fg-2">{txCounterparty(x, t)}</span> },
    { key: "amount", header: t("common.amount"), align: "right", cell: (x) => <TxAmount tx={x} className="text-[14px]" />, sort: (x) => (txDirection(x) === "in" ? x.amount : -x.amount) },
    { key: "fee", header: t("wallet.fee"), align: "right", hideOn: "md", cell: (x) => <span className="k-num text-[12.5px] text-fg-3">{x.fee ? formatNumber(x.fee) : "—"}</span> },
    { key: "hash", header: t("wallet.demo.txHash"), hideOn: "sm", cell: (x) => <HashLink hash={x.hash} /> },
    { key: "status", header: t("common.status"), align: "right", cell: (x) => <StatusChip status={x.status} label={x.status === "processing" && x.confirmations ? t("wallet.demo.confShort", { done: x.confirmations }) : txStatusLabel(t, x.status)} /> },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title={t("wallet.history.title")}
        subtitle={t("wallet.demo.historySubtitle")}
        actions={
          <>
            <Segmented size="sm" value={range} onChange={setRange} options={[{ value: "7D", label: t("wallet.demo.days7") }, { value: "30D", label: t("wallet.demo.days30") }, { value: "ALL", label: t("common.all") }]} />
            <Button variant="surface" onClick={() => downloadCsv(rows)}>
              <Download /> {t("wallet.demo.exportCsv")}
            </Button>
            <Link href="/wallet">
              <Button variant="ghost">
                <ArrowLeft className="rtl:-scale-x-100" /> {t("wallet.wallet")}
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("wallet.demo.moneyIn")} icon={<ArrowDownLeft />} value={<Money value={totalIn} tone="up" />} chip={t("wallet.demo.transactionsCount", { count: ok.filter((x) => txDirection(x) === "in").length })} chipTone="up" />
        <KpiCard label={t("wallet.demo.moneyOut")} icon={<ArrowUpRight />} value={<Money value={totalOut} />} chip={t("wallet.demo.transactionsCount", { count: ok.filter((x) => txDirection(x) === "out").length })} delay={0.05} />
        <KpiCard label={t("wallet.inProgress")} icon={<Clock />} value={<span className="k-num">{pending}</span>} chip={pending ? t("wallet.demo.awaiting") : t("wallet.demo.allSettled")} chipTone={pending ? "warn" : "up"} delay={0.1} />
        <KpiCard label={t("wallet.demo.feesPaid")} icon={<Receipt />} value={<Money value={fees} />} chip={t("wallet.demo.depositsFree")} delay={0.15} />
      </div>

      <Reveal delay={0.1} className="mt-4 block">
        <Card className="px-4 pb-5 pt-5 sm:px-6">
          <DataTable
            columns={cols}
            rows={rows}
            rowKey={(x) => x.id}
            pageSize={12}
            onRowClick={setTx}
            search={(x) => `${x.id} ${x.hash ?? ""} ${x.from} ${x.to} ${TX_TYPE_LABEL[x.type]} ${txTypeLabel(t, x.type)} ${x.amount}`}
            searchPlaceholder={t("wallet.demo.searchPlaceholder")}
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  size="xs"
                  value={type}
                  onChange={setType}
                  options={[
                    { value: "all", label: t("wallet.demo.allTypes") },
                    { value: "deposit", label: t("wallet.tab.deposits") },
                    { value: "withdrawal", label: t("wallet.tab.withdrawals") },
                    { value: "transfer", label: t("wallet.tab.transfers") },
                    { value: "other", label: t("wallet.tab.other") },
                  ]}
                />
                <Segmented
                  size="xs"
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: "all", label: t("wallet.demo.anyStatus") },
                    { value: "completed", label: t("common.completed") },
                    { value: "pending", label: t("common.pending") },
                    { value: "rejected", label: t("common.rejected") },
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

/** Live builds: the real wallet (services/wallet). Demo builds: the mock showcase above. */
export default function WalletHistoryPage() {
  return IS_DEMO ? <DemoWalletHistoryPage /> : <LiveHistoryPage />;
}
