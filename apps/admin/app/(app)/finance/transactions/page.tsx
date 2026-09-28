"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Coins, FileSpreadsheet, Filter, Gift, HandCoins, Repeat, SlidersHorizontal, Trophy, Users } from "lucide-react";
import { Button, Card, Chip, DataTable, PageHeader, Reveal, Segmented, cn, type Column } from "@kalks/ui";
import { FIN_TXS, FIN_TX_TYPE_LABEL, finAgo, finTime, type FinTx, type FinTxType } from "@kalks/mock/admin-finance";
import { PersonCell, Select } from "@/components/config/kit";
import { TxDrawer, txStatusChip } from "@/components/finance/tx-drawer";
import { CoinAmount, usd } from "@/components/finance/shared";

const RANGES = { Today: 60 * 14.5, "7D": 7 * 1440, "30D": 30 * 1440, All: Infinity } as const;
type Range = keyof typeof RANGES;
type TypeFilter = "all" | "deposit" | "withdrawal" | "transfer" | "payouts" | "other";

const TYPE_ICON: Record<FinTxType, React.ReactNode> = {
  deposit: <ArrowDownLeft />,
  withdrawal: <ArrowUpRight />,
  transfer: <ArrowLeftRight />,
  adjustment: <SlidersHorizontal />,
  "ib-payout": <Users />,
  "copy-fee": <Repeat />,
  "prop-payout": <Trophy />,
  conversion: <Coins />,
};
const TYPE_TONE: Record<FinTxType, string> = {
  deposit: "bg-up-soft text-up",
  withdrawal: "bg-down-soft text-down",
  transfer: "bg-surface-3 text-fg-2",
  adjustment: "bg-warn-soft text-warn",
  "ib-payout": "bg-gold-soft text-gold",
  "copy-fee": "bg-gold-soft text-gold",
  "prop-payout": "bg-gold-soft text-gold",
  conversion: "bg-ember-soft text-ember",
};

function matchType(t: FinTxType, f: TypeFilter) {
  if (f === "all") return true;
  if (f === "payouts") return t === "ib-payout" || t === "copy-fee" || t === "prop-payout";
  if (f === "other") return t === "adjustment" || t === "conversion";
  return t === f;
}

export default function TransactionsPage() {
  const [type, setType] = React.useState<TypeFilter>("all");
  const [status, setStatus] = React.useState<"all" | FinTx["status"]>("all");
  const [asset, setAsset] = React.useState<"all" | FinTx["asset"]>("all");
  const [range, setRange] = React.useState<Range>("30D");
  const [open, setOpen] = React.useState<FinTx | null>(null);

  const rows = FIN_TXS.filter((t) => matchType(t.type, type) && (status === "all" || t.status === status) && (asset === "all" || t.asset === asset) && t.minutesAgo <= RANGES[range]);
  const done = rows.filter((t) => t.status === "completed");
  const inflow = done.filter((t) => t.usd > 0 && (t.type === "deposit")).reduce((s, t) => s + t.usd, 0);
  const outflow = done.filter((t) => t.type === "withdrawal").reduce((s, t) => s + Math.abs(t.usd), 0);
  const payouts = done.filter((t) => matchType(t.type, "payouts")).reduce((s, t) => s + Math.abs(t.usd), 0);
  const fees = done.reduce((s, t) => s + t.fee, 0);
  const active = (type !== "all" ? 1 : 0) + (status !== "all" ? 1 : 0) + (asset !== "all" ? 1 : 0);

  const cols: Column<FinTx>[] = [
    {
      key: "id",
      header: "Transaction",
      cell: (t) => (
        <div className="flex items-center gap-2.5">
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-3.5", TYPE_TONE[t.type])}>{TYPE_ICON[t.type]}</span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium">{FIN_TX_TYPE_LABEL[t.type]}</div>
            <div className="font-mono text-[11px] text-fg-3">{t.id}</div>
          </div>
        </div>
      ),
    },
    { key: "client", header: "Client", cell: (t) => <PersonCell name={t.client.person.name} photo={t.client.person.photo} country={t.client.person.country} sub={<span className="font-mono">{t.client.login}</span>} size={28} />, sort: (t) => t.client.person.name },
    { key: "amount", header: "Amount", align: "right", cell: (t) => <CoinAmount amount={t.amount} asset={t.asset} usdValue={Math.abs(t.usd)} className="whitespace-nowrap" />, sort: (t) => t.usd },
    { key: "acct", header: "Account / note", cell: (t) => <div className="max-w-52"><div className="truncate font-mono text-[12px] text-fg-2">{t.account}</div>{t.note && <div className="truncate text-[11px] text-fg-3">{t.note}</div>}{!t.note && t.network && <div className="text-[11px] text-fg-3">{t.network}</div>}</div>, hideOn: "lg" },
    { key: "fee", header: "Fee", align: "right", cell: (t) => <span className="k-num text-[12.5px] text-fg-2">{t.fee ? usd(t.fee) : "—"}</span>, hideOn: "md" },
    { key: "status", header: "Status", cell: (t) => txStatusChip(t.status) },
    { key: "time", header: "Time", align: "right", cell: (t) => <div className="whitespace-nowrap"><div className="font-mono text-[12.5px]">{finTime(t.minutesAgo)}</div><div className="text-[11px] text-fg-3">{finAgo(t.minutesAgo)}</div></div>, sort: (t) => -t.minutesAgo },
  ];

  return (
    <div className="pb-24">
      <PageHeader
        title="Transactions"
        subtitle="Every money movement across wallets, trading accounts and partner balances"
        actions={
          <>
            <Segmented value={range} onChange={setRange} options={Object.keys(RANGES) as Range[]} />
            <Button variant="surface" onClick={() => toast.success("Scheduled export created", { description: "Daily CSV to finance@kalks.io at 07:00 GMT+3" })}>
              <FileSpreadsheet /> Schedule export
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Deposits in", value: usd(inflow), icon: <ArrowDownLeft />, tone: "text-up" },
          { label: "Withdrawals out", value: usd(outflow), icon: <ArrowUpRight />, tone: "text-down" },
          { label: "Partner payouts", value: usd(payouts), icon: <HandCoins />, tone: "text-gold" },
          { label: "Fees collected", value: usd(fees), icon: <Gift />, tone: "text-ember" },
        ].map((k, i) => (
          <Reveal key={k.label} delay={i * 0.04}>
            <Card className="flex items-center gap-3 px-5 py-4">
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-2 [&_svg]:size-4", k.tone)}>{k.icon}</span>
              <div className="min-w-0">
                <div className="k-label truncate">{k.label} · {range}</div>
                <div className="k-num mt-1 truncate text-[20px] font-semibold">{k.value}</div>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <div className="flex flex-col gap-3 px-6 pt-5 xl:flex-row xl:items-center xl:justify-between">
            <Segmented
              size="xs"
              value={type}
              onChange={setType}
              className="max-w-full overflow-x-auto"
              options={[
                { value: "all", label: "All" },
                { value: "deposit", label: "Deposits" },
                { value: "withdrawal", label: "Withdrawals" },
                { value: "transfer", label: "Transfers" },
                { value: "payouts", label: "Payouts" },
                { value: "other", label: "Adjustments & FX" },
              ]}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="size-3.5 text-fg-3" />
              <Select size="sm" className="w-36" value={status} onChange={setStatus} options={[{ value: "all", label: "Any status" }, { value: "completed", label: "Completed" }, { value: "pending", label: "Pending" }, { value: "processing", label: "Processing" }, { value: "rejected", label: "Rejected" }, { value: "failed", label: "Failed" }]} />
              <Select size="sm" className="w-32" value={asset} onChange={setAsset} options={[{ value: "all", label: "Any asset" }, "USDT", "USD", "BTC", "ETH", "TRX"]} />
              {active > 0 && (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setType("all");
                    setStatus("all");
                    setAsset("all");
                  }}
                >
                  Clear {active}
                </Button>
              )}
            </div>
          </div>
          <div className="px-4 pb-5 pt-4 sm:px-6">
            <DataTable
              columns={cols}
              rows={rows}
              rowKey={(t) => t.id}
              pageSize={15}
              dense
              search={(t) => `${t.id} ${t.client.person.name} ${t.client.login} ${t.hash ?? ""} ${t.address ?? ""} ${t.note}`}
              searchPlaceholder="ID, client, hash, address…"
              exportName={`transactions-${range.toLowerCase()}`}
              toolbar={
                <span className="text-[12.5px] text-fg-3">
                  <span className="k-num font-medium text-fg">{rows.length}</span> transactions
                  {active > 0 && (
                    <Chip size="sm" tone="ember" className="ml-2">
                      {active} filter{active > 1 ? "s" : ""}
                    </Chip>
                  )}
                </span>
              }
              onRowClick={setOpen}
            />
          </div>
        </Card>
      </Reveal>

      <TxDrawer tx={open} onOpenChange={(o) => !o && setOpen(null)} />
    </div>
  );
}
