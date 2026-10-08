"use client";

import * as React from "react";
import { AlertTriangle, Check } from "lucide-react";
import { Button, Chip, DataTable, Dialog, Segmented, StatusChip, Tooltip, cn, type Column } from "@ezymex/ui";
import { FIN_PAYOUT_KIND_LABEL, type FinBatchStatus, type FinPayoutBatch, type FinPayoutLine } from "@ezymex/mock/admin-finance";
import { Addr, Checkbox, PersonCell } from "@/components/config/kit";
import { num, usd } from "./shared";

export const batchTotal = (b: FinPayoutBatch) => b.lines.filter((l) => !l.excluded).reduce((s, l) => s + l.amount, 0);
export const batchFlags = (b: FinPayoutBatch) => b.lines.filter((l) => l.flags.length && !l.excluded).length;

export const BATCH_STATUS: Record<FinBatchStatus, React.ReactNode> = {
  draft: <StatusChip status="draft" />,
  pending: <StatusChip status="pending" label="Awaiting approval" />,
  approved: <StatusChip status="approved" label="Approved · scheduled" />,
  paid: <StatusChip status="completed" label="Paid" />,
};

export function PayoutLinesDrawer({
  batch,
  onOpenChange,
  onToggleLine,
  onApprove,
}: {
  batch: FinPayoutBatch | null;
  onOpenChange: (o: boolean) => void;
  onToggleLine: (batchId: string, lineId: string) => void;
  onApprove: (b: FinPayoutBatch) => void;
}) {
  const [filter, setFilter] = React.useState<"all" | "flagged" | "excluded">("all");
  React.useEffect(() => setFilter("all"), [batch?.id]);
  const editable = batch?.status === "pending" || batch?.status === "draft";
  const rows = batch ? batch.lines.filter((l) => (filter === "all" ? true : filter === "flagged" ? l.flags.length > 0 : l.excluded)) : [];

  const cols: Column<FinPayoutLine>[] = [
    ...(editable
      ? [
          {
            key: "inc",
            header: "Pay",
            width: "44px",
            cell: (l: FinPayoutLine) => <Checkbox checked={!l.excluded} onChange={() => batch && onToggleLine(batch.id, l.id)} label={`Include ${l.person.name}`} />,
          } satisfies Column<FinPayoutLine>,
        ]
      : []),
    {
      key: "who",
      header: batch?.kind === "ib" ? "Partner" : batch?.kind === "copy" ? "Strategy provider" : "Funded trader",
      cell: (l) => (
        <div className={cn(l.excluded && "opacity-45")}>
          <PersonCell name={l.person.name} photo={l.person.photo} country={l.person.country} sub={<span><span className="font-mono">{l.ref}</span> · {l.detail}</span>} size={28} />
        </div>
      ),
    },
    {
      key: "flags",
      header: "Flags",
      cell: (l) =>
        l.flags.length ? (
          <Tooltip content={l.flags.join(" · ")}>
            <span>
              <Chip size="sm" tone="warn">
                <AlertTriangle className="size-3" /> Flag
              </Chip>
            </span>
          </Tooltip>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11.5px] text-up">
            <Check className="size-3" /> Clean
          </span>
        ),
    },
    { key: "amt", header: "Amount", align: "right", cell: (l) => (
        <div className="whitespace-nowrap">
          <div className={cn("k-num font-medium", l.excluded && "text-fg-3 line-through")}>{usd(l.amount)}</div>
          <Addr value={l.wallet} copy={false} className="text-[11px] text-fg-3" />
        </div>
      ),
      sort: (l) => l.amount },
  ];

  return (
    <Dialog
      open={!!batch}
      onOpenChange={onOpenChange}
      side="right"
      title={batch ? `${batch.title}` : ""}
      description={batch ? `${batch.id} · ${batch.period} · ${FIN_PAYOUT_KIND_LABEL[batch.kind]}` : undefined}
      footer={
        batch && (
          <>
            <span className="mr-auto text-[12.5px] text-fg-3">
              {batch.lines.filter((l) => !l.excluded).length}/{batch.lines.length} lines · <span className="k-num font-medium text-fg">{usd(batchTotal(batch))}</span>
            </span>
            <Button variant="surface" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {editable && (
              <Button variant="ember" size="sm" onClick={() => onApprove(batch)}>
                <Check /> {batch.status === "draft" ? "Submit & approve" : "Approve batch"}
              </Button>
            )}
          </>
        )
      }
    >
      {batch && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="k-row px-3.5 py-3">
              <div className="text-[11px] uppercase tracking-wider text-fg-3">Total</div>
              <div className="k-num mt-1 truncate text-[17px] font-semibold">{usd(batchTotal(batch))}</div>
            </div>
            <div className="k-row px-3.5 py-3">
              <div className="text-[11px] uppercase tracking-wider text-fg-3">Flagged</div>
              <div className={cn("k-num mt-1 text-[17px] font-semibold", batchFlags(batch) ? "text-warn" : "text-up")}>{batchFlags(batch)}</div>
            </div>
            <div className="k-row px-3.5 py-3">
              <div className="text-[11px] uppercase tracking-wider text-fg-3">Status</div>
              <div className="mt-1.5">{BATCH_STATUS[batch.status]}</div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Segmented
              size="xs"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: `All ${batch.lines.length}` },
                { value: "flagged", label: `Flagged ${batch.lines.filter((l) => l.flags.length).length}` },
                { value: "excluded", label: `Excluded ${batch.lines.filter((l) => l.excluded).length}` },
              ]}
            />
            {editable && <span className="text-[11.5px] text-fg-3">Untick a line to exclude it</span>}
          </div>
          <div className="-mx-2">
            <DataTable columns={cols} rows={rows} rowKey={(l) => l.id} pageSize={10} dense className="[&_table]:min-w-[460px]" />
          </div>
          <div className="text-[11.5px] text-fg-3">
            Paid in USDT-TRC20 from the hot wallet · network fees absorbed by the broker · avg line {usd(batchTotal(batch) / Math.max(1, batch.lines.filter((l) => !l.excluded).length))} · {num(batch.lines.length, 0)} recipients
          </div>
        </div>
      )}
    </Dialog>
  );
}
