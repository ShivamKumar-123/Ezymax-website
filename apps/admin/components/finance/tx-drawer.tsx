"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Circle, RotateCcw, UserRound } from "lucide-react";
import { Button, Chip, Dialog, StatusChip, cn } from "@ezymex/ui";
import { FIN_TX_TYPE_LABEL, finTime, type FinTx } from "@ezymex/mock/admin-finance";
import { Addr, PersonCell, Section, TxHash, auditToast, useReason } from "@/components/config/kit";
import { CoinAmount, Line, NetworkChip, usd } from "./shared";

export function txStatusChip(s: FinTx["status"]) {
  return <StatusChip status={s} />;
}

function timeline(tx: FinTx) {
  const t = tx.minutesAgo;
  const base =
    tx.type === "deposit"
      ? ["Detected on-chain", "20/20 confirmations", "Credited to wallet"]
      : tx.type === "withdrawal"
        ? ["Requested by client", "Approved by staff", "Broadcast from hot wallet", "Confirmed on-chain"]
        : tx.type === "conversion"
          ? ["Quote locked", "Converted at rate + markup", "Credited in USD"]
          : ["Created", "Posted to ledger", "Completed"];
  const doneN = tx.status === "completed" ? base.length : tx.status === "processing" ? base.length - 1 : tx.status === "pending" ? 1 : 1;
  return base.map((label, i) => ({ label, done: i < doneN, failed: (tx.status === "rejected" || tx.status === "failed") && i === doneN, at: finTime(Math.max(0, t - i * 2), "time") }));
}

export function TxDrawer({ tx, onOpenChange }: { tx: FinTx | null; onOpenChange: (o: boolean) => void }) {
  const reason = useReason();
  const inbound = tx ? tx.usd >= 0 : true;
  return (
    <>
      <Dialog
        open={!!tx}
        onOpenChange={onOpenChange}
        side="right"
        title={tx ? `${FIN_TX_TYPE_LABEL[tx.type]} ${tx.id}` : ""}
        description={tx ? `${finTime(tx.minutesAgo)} GMT+3` : undefined}
        footer={
          tx && (
            <>
              <Link href="/clients">
                <Button variant="ghost" size="sm">
                  <UserRound /> Client profile
                </Button>
              </Link>
              {tx.status === "completed" && tx.type !== "withdrawal" && (
                <Button
                  variant="down-outline"
                  size="sm"
                  onClick={() =>
                    reason.ask({
                      title: `Reverse ${tx.id}`,
                      description: `Posts an opposite ledger entry of ${usd(Math.abs(tx.usd))}. Requires second approval above $5,000.`,
                      reasons: ["Duplicate credit", "Chargeback", "Posted to wrong account", "Client request"],
                      confirmLabel: "Create reversal",
                      tone: "sell",
                      onConfirm: (r) => auditToast(`Reversal for ${tx.id} created`, r),
                    })
                  }
                >
                  <RotateCcw /> Reverse
                </Button>
              )}
              <Button variant="surface" size="sm" onClick={() => toast.success(`Receipt ${tx.id}.pdf generated`)}>
                Receipt
              </Button>
            </>
          )
        }
      >
        {tx && (
          <div>
            <Section title="Summary">
              <div className="k-row flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-fg-3">{inbound ? "Credit" : "Debit"}</div>
                  <div className={cn("k-num mt-1 text-[26px] font-semibold", inbound ? "text-up" : "text-fg")}>
                    {inbound ? "+" : "-"}
                    {usd(Math.abs(tx.usd)).replace("-", "")}
                  </div>
                  {tx.asset !== "USD" && tx.asset !== "USDT" && <CoinAmount amount={tx.amount} asset={tx.asset} className="mt-1 justify-start" />}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {txStatusChip(tx.status)}
                  {tx.network && <NetworkChip network={tx.network} />}
                </div>
              </div>
              <div className="mt-3">
                <PersonCell name={tx.client.person.name} photo={tx.client.person.photo} country={tx.client.person.country} sub={<span className="font-mono">{tx.client.login} · {tx.client.group}</span>} />
              </div>
            </Section>
            <Section title="Details">
              <div className="divide-y divide-line">
                <Line k="Type" v={FIN_TX_TYPE_LABEL[tx.type]} />
                <Line k="Account" v={tx.account} mono />
                <Line k="Fee" v={tx.fee ? usd(tx.fee) : "—"} />
                {tx.note && <Line k="Note" v={tx.note} />}
                {tx.address && <Line k={inbound ? "From address" : "To address"} v={<Addr value={tx.address} head={8} tail={6} />} />}
                {tx.hash && <Line k="Tx hash" v={<TxHash hash={tx.hash} chain={tx.network === "BTC" ? "btc" : "tron"} head={10} tail={8} />} />}
              </div>
            </Section>
            <Section title="Timeline">
              <ol className="space-y-0">
                {timeline(tx).map((s, i, arr) => (
                  <li key={s.label} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < arr.length - 1 && <span className={cn("absolute left-[11px] top-6 h-[calc(100%-20px)] w-px", s.done ? "bg-up/40" : "bg-line")} />}
                    <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border", s.done ? "border-up/30 bg-up-soft text-up" : s.failed ? "border-down/30 bg-down-soft text-down" : "border-line text-fg-3")}>
                      {s.done ? <Check className="size-3" strokeWidth={3} /> : <Circle className="size-2" />}
                    </span>
                    <div className="flex flex-1 items-center justify-between text-[13px]">
                      <span className={s.done ? "text-fg" : s.failed ? "text-down" : "text-fg-3"}>{s.failed ? `${s.label} — ${tx.status}` : s.label}</span>
                      <span className="font-mono text-[11.5px] text-fg-3">{s.done ? s.at : "—"}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
            <Section title="Ledger entries" hint="Double-entry postings">
              <div className="overflow-hidden rounded-[12px] border border-line text-[12.5px]">
                <div className="grid grid-cols-[1fr_90px_90px] gap-2 border-b border-line bg-surface-2 px-3 py-1.5 text-[10.5px] uppercase tracking-wider text-fg-3">
                  <span>Account</span>
                  <span className="text-right">Debit</span>
                  <span className="text-right">Credit</span>
                </div>
                {[
                  { acc: inbound ? `Client wallet ${tx.client.login}` : tx.type === "withdrawal" ? "Hot wallet · TRON" : "House · adjustments", dr: 0, cr: Math.abs(tx.usd) },
                  { acc: inbound ? (tx.type === "deposit" ? "Deposit addresses · TRON" : "House · payouts") : `Client wallet ${tx.client.login}`, dr: Math.abs(tx.usd), cr: 0 },
                ].map((e, i) => (
                  <div key={i} className="grid grid-cols-[1fr_90px_90px] gap-2 border-b border-line px-3 py-2 last:border-b-0">
                    <span className="truncate text-fg-2">{e.acc}</span>
                    <span className="k-num text-right">{e.dr ? usd(e.dr) : ""}</span>
                    <span className="k-num text-right">{e.cr ? usd(e.cr) : ""}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-end">
                <Chip size="sm" tone="up">Balanced</Chip>
              </div>
            </Section>
          </div>
        )}
      </Dialog>
      {reason.node}
    </>
  );
}
