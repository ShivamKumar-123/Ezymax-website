"use client";

import * as React from "react";
import { Check, CheckCircle2, X, XCircle } from "lucide-react";
import { Button, Chip, Dialog, StatusChip, Tooltip, cn } from "@ezymex/ui";
import { Addr, MiniStat, PersonCell, TxHash } from "@/components/config/kit";
import { fmtDate, fmtDateTime, type PayoutRequest } from "./data";

const $ = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Row of 5 check icons (consistency / min days / violations / KYC / IP). */
export function CheckIcons({ p }: { p: PayoutRequest }) {
  return (
    <div className="flex items-center gap-1">
      {p.checks.map((c) => (
        <Tooltip
          key={c.key}
          content={
            <div>
              <div className={c.pass ? "text-up" : "text-down"}>
                {c.label}: {c.pass ? "pass" : "fail"}
              </div>
              <div className="font-normal text-fg-3">{c.detail}</div>
            </div>
          }
        >
          <span onClick={(e) => e.stopPropagation()} className={cn("grid size-5 cursor-help place-items-center rounded-full border", c.pass ? "border-up/25 bg-up-soft text-up" : "border-down/30 bg-down-soft text-down")}>
            {c.pass ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
          </span>
        </Tooltip>
      ))}
    </div>
  );
}

export function payoutTotal(p: PayoutRequest) {
  return p.traderShare + p.refund;
}

export function PayoutDrawer({ p, open, onOpenChange, onApprove, onReject }: { p: PayoutRequest | null; open: boolean; onOpenChange: (o: boolean) => void; onApprove: (p: PayoutRequest) => void; onReject: (p: PayoutRequest) => void }) {
  if (!p) return null;
  const failing = p.checks.filter((c) => !c.pass);
  const pending = p.status === "pending" || p.status === "review";
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      title={
        <span className="flex items-center gap-2">
          Payout <span className="font-mono text-fg-2">{p.id}</span>
        </span>
      }
      description={`Cycle ${p.cycle} · requested ${fmtDateTime(p.requested)} GMT+3 · account #${p.account.login}`}
      footer={
        pending ? (
          <>
            <Button size="sm" variant="down-outline" onClick={() => onReject(p)}>
              <XCircle /> Reject
            </Button>
            <Button size="sm" variant="buy" onClick={() => onApprove(p)}>
              <CheckCircle2 /> Approve {$(payoutTotal(p))}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="surface" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        )
      }
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <PersonCell name={p.account.trader.name} photo={p.account.trader.photo} country={p.account.trader.country} sub={`${p.account.planName} · $${p.account.size.toLocaleString()}`} size={40} verified={p.account.kyc} />
          <StatusChip status={p.status} />
        </div>

        {failing.length > 0 && pending && (
          <div className="rounded-[14px] border border-down/30 bg-down-soft px-4 py-3 text-[12.5px]">
            <div className="font-medium text-down">{failing.length} risk check{failing.length > 1 ? "s" : ""} failing</div>
            <div className="mt-0.5 text-fg-2">{failing.map((f) => f.detail).join(" · ")}</div>
          </div>
        )}

        <div>
          <div className="k-label mb-2">Calculation</div>
          <div className="k-row divide-y divide-line px-4">
            {[
              ["Cycle profit", $(p.profit), ""],
              [`Trader share (${p.split}%)`, $(p.traderShare), "text-up"],
              [`Firm share (${100 - p.split}%)`, $(p.firmShare), "text-fg-2"],
              ["Challenge fee refund", p.refund ? `+${$(p.refund)}` : "Not applicable", p.refund ? "text-gold" : "text-fg-3"],
            ].map(([k, v, t]) => (
              <div key={k} className="flex items-center justify-between py-2.5 text-[13px]">
                <span className="text-fg-3">{k}</span>
                <span className={cn("k-num font-medium", t)}>{v}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-3 text-[14px]">
              <span className="font-medium">Total to trader</span>
              <span className="k-num text-[18px] font-semibold">{$(payoutTotal(p))}</span>
            </div>
          </div>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full">
            <span className="bg-up" style={{ width: `${p.split}%` }} />
            <span className="bg-fg-3/40" style={{ width: `${100 - p.split}%` }} />
          </div>
        </div>

        <div>
          <div className="k-label mb-2">Risk checks</div>
          <div className="space-y-1.5">
            {p.checks.map((c) => (
              <div key={c.key} className="k-row flex items-center gap-3 px-4 py-2.5">
                {c.pass ? <CheckCircle2 className="size-4 shrink-0 text-up" /> : <XCircle className="size-4 shrink-0 text-down" />}
                <span className="w-32 shrink-0 text-[13px] font-medium">{c.label}</span>
                <span className="truncate text-[12px] text-fg-3">{c.detail}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="Method" value={p.method} />
          <MiniStat label="Lifetime paid" value={`$${p.account.paidTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}`} sub={`${p.account.payouts} payouts`} />
        </div>
        <div className="k-row flex items-center justify-between gap-3 px-4 py-3 text-[12.5px]">
          <span className="text-fg-3">Destination</span>
          {p.method === "USDT TRC20" ? <Addr value={p.address} head={6} tail={6} /> : <span className="font-mono text-fg-2">{p.address}</span>}
        </div>
        {p.hash && (
          <div className="k-row flex items-center justify-between gap-3 px-4 py-3 text-[12.5px]">
            <span className="text-fg-3">Tx hash</span>
            <TxHash hash={p.hash} />
          </div>
        )}
        {p.decidedBy && (
          <div className="text-[12px] text-fg-3">
            Decision by <span className="text-fg-2">{p.decidedBy}</span> on {fmtDate(p.decidedAt!)}
          </div>
        )}
        {p.refund > 0 && (
          <Chip tone="gold" size="sm">
            First payout: fee refund included
          </Chip>
        )}
      </div>
    </Dialog>
  );
}
