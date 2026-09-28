"use client";

import * as React from "react";
import { Check, Clock3, FileSearch, PauseCircle, ShieldCheck } from "lucide-react";
import { Avatar, Button, Card, CardHeader, Chip, DataTable, Dialog, Icon3D, Money, StatusChip, cn, type Column } from "@kalks/ui";
import { PARTNERS, PAYOUT_BATCHES, type PayoutBatch } from "@kalks/mock/admin-partners";
import { auditToast, useReason } from "@/components/config/kit";
import { LevelChip, ShareBar, fmtDT, fmtLots } from "./common";

type Line = { id: string; name: string; photo?: string; level: (typeof PARTNERS)[number]["level"]; lots: number; amount: number; method: string; hold: boolean };

function batchLines(b: PayoutBatch): Line[] {
  const share = b.amount / PARTNERS.reduce((s, p) => s + p.commissionPending, 0);
  return PARTNERS.map((p, i) => ({
    id: p.id,
    name: p.name,
    photo: p.photo,
    level: p.level,
    lots: p.lotsMtd * 0.24,
    amount: +(p.commissionPending * share).toFixed(2),
    method: i % 5 === 0 ? "Bank wire" : i % 3 === 0 ? "Wallet" : "USDT TRC20",
    hold: p.flags > 0,
  }));
}

export function BatchLinesDialog({ batch, open, onOpenChange }: { batch: PayoutBatch; open: boolean; onOpenChange: (o: boolean) => void }) {
  const rows = React.useMemo(() => batchLines(batch), [batch]);
  const cols: Column<Line>[] = [
    { key: "p", header: "Partner", cell: (r) => <span className="flex items-center gap-2.5"><Avatar src={r.photo} name={r.name} size={26} /><span className="min-w-0"><span className="block truncate text-[13px] font-medium">{r.name}</span><span className="font-mono text-[11px] text-fg-3">{r.id}</span></span></span> },
    { key: "l", header: "Level", cell: (r) => <LevelChip level={r.level} /> },
    { key: "lots", header: "Lots", align: "right", sort: (r) => r.lots, cell: (r) => <span className="k-num">{fmtLots(r.lots)}</span> },
    { key: "m", header: "Method", hideOn: "md", cell: (r) => <span className="text-[12.5px] text-fg-2">{r.method}</span> },
    { key: "a", header: "Amount", align: "right", sort: (r) => r.amount, cell: (r) => (r.hold ? <Chip size="sm" tone="warn">Held · fraud review</Chip> : <Money value={r.amount} countUp={false} className="font-medium" />) },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`Batch ${batch.id}`} description={`${batch.period} · ${batch.frequency} · ${batch.partners} partners`} width={820}
      footer={<Button variant="surface" size="sm" onClick={() => onOpenChange(false)}>Close</Button>}>
      <DataTable columns={cols} rows={rows} pageSize={8} dense search={(r) => r.name + r.id} exportName={`payout-${batch.id}`} rowKey={(r) => r.id} />
    </Dialog>
  );
}

export function PendingBatchCard() {
  const [batch, setBatch] = React.useState(PAYOUT_BATCHES[0]!);
  const [lines, setLines] = React.useState(false);
  const reason = useReason();
  const done = batch.approvals.filter((a) => a.at).length;
  return (
    <Card hot className="flex h-full flex-col overflow-hidden">
      <CardHeader title="Next payout batch" subtitle={`${batch.id} · ${batch.period}`} action={<StatusChip status={batch.status} label={batch.status === "pending" ? "Awaiting approval" : undefined} />} />
      <div className="relative px-6 pt-4">
        <Icon3D name="money_bag" size={72} className="absolute right-5 top-5" />
        <div className="k-label">Total to pay</div>
        <Money value={batch.amount} className="mt-1 block text-[32px] font-semibold tracking-tight" />
        <div className="mt-1 text-[12.5px] text-fg-3">
          <span className="k-num text-fg-2">{batch.partners}</span> partners · <span className="k-num text-warn">{batch.held}</span> lines held for fraud review
        </div>
      </div>
      <div className="mt-5 space-y-2 px-4 sm:px-6">
        {batch.approvals.map((a, i) => (
          <div key={a.role} className="k-row flex items-center gap-3 px-3.5 py-2.5">
            <span className={cn("grid size-7 place-items-center rounded-full border text-[11px] font-semibold", a.at ? "border-up/40 bg-up-soft text-up" : "border-warn/40 bg-warn-soft text-warn")}>{a.at ? <Check className="size-3.5" /> : i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{a.name}</div>
              <div className="text-[11.5px] text-fg-3">{a.role}</div>
            </div>
            <span className="text-[11.5px] text-fg-3">{a.at ? fmtDT(a.at) : <span className="inline-flex items-center gap-1 text-warn"><Clock3 className="size-3" /> Waiting</span>}</span>
          </div>
        ))}
      </div>
      <div className="px-6 pt-4">
        <div className="mb-2 text-[11.5px] uppercase tracking-wider text-fg-3">Payout rails</div>
        <ShareBar parts={[{ label: "USDT TRC20", value: batch.method.usdt, color: "var(--k-up)" }, { label: "Bank", value: batch.method.bank, color: "var(--k-gold)" }, { label: "Kalks wallet", value: batch.method.wallet, color: "var(--k-ember)" }]} />
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2 px-6 pb-6 pt-5">
        <Button
          variant="ember"
          size="sm"
          disabled={done === batch.approvals.length}
          onClick={() =>
            reason.ask({
              title: `Approve ${batch.id}`,
              description: `Second approval releases ${batch.partners} payouts. Held lines stay excluded.`,
              reasons: ["Batch reconciled with commission ledger", "Spot-checked top 20 lines", "Finance sign-off"],
              confirmLabel: "Approve & release",
              tone: "buy",
              onConfirm: (r) => {
                setBatch((b) => ({ ...b, status: "approved", approvals: b.approvals.map((a) => (a.at ? a : { ...a, name: "You (Super Admin)", at: "2026-09-24T14:32:00+03:00" })) }));
                auditToast(`${batch.id} approved`, r);
              },
            })
          }
        >
          <ShieldCheck /> {done === batch.approvals.length ? "Approved" : "Approve batch"}
        </Button>
        <Button variant="surface" size="sm" onClick={() => setLines(true)}>
          <FileSearch /> Review lines
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            reason.ask({
              title: `Hold ${batch.id}`,
              description: "Batch will not be released until un-held by an IB manager.",
              reasons: ["Reconciliation mismatch", "Pending fraud review", "Treasury liquidity", "Regulatory request"],
              confirmLabel: "Hold batch",
              tone: "sell",
              onConfirm: (r) => {
                setBatch((b) => ({ ...b, status: "review" }));
                auditToast(`${batch.id} put on hold`, r);
              },
            })
          }
        >
          <PauseCircle /> Hold
        </Button>
      </div>
      <BatchLinesDialog batch={batch} open={lines} onOpenChange={setLines} />
      {reason.node}
    </Card>
  );
}
