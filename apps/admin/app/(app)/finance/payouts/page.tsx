"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, Check, Download, Handshake, ListChecks, Plus, Repeat, Send, Trophy } from "lucide-react";
import { Avatar, Button, Card, CardHeader, Chip, DataTable, Icon3D, KpiCard, Money, PageHeader, Reveal, Segmented, cn, type Column } from "@kalks/ui";
import { FIN_PAYOUT_BATCHES, FIN_PAYOUT_KIND_LABEL, FIN_PAYOUT_REASONS, finAgo, type FinPayoutBatch, type FinPayoutKind } from "@kalks/mock/admin-finance";
import { auditToast, useReason } from "@/components/config/kit";
import { BATCH_STATUS, PayoutLinesDrawer, batchFlags, batchTotal } from "@/components/finance/payout-lines";
import { usd } from "@/components/finance/shared";

const KIND_ICON: Record<FinPayoutKind, React.ReactNode> = { ib: <Handshake />, copy: <Repeat />, prop: <Trophy /> };
const KIND_3D: Record<FinPayoutKind, string> = { ib: "handshake", copy: "coin", prop: "trophy" };
const ME = "Priya Nair";

export default function PayoutsPage() {
  const [batches, setBatches] = React.useState<FinPayoutBatch[]>(FIN_PAYOUT_BATCHES);
  const [kind, setKind] = React.useState<"all" | FinPayoutKind>("all");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const reason = useReason();

  const open = batches.find((b) => b.id === openId) ?? null;
  const active = batches.filter((b) => b.status !== "paid" && (kind === "all" || b.kind === kind));
  const history = batches.filter((b) => kind === "all" || b.kind === kind);
  const due = batches.filter((b) => b.status === "pending" || b.status === "approved");
  const paidByKind = (k: FinPayoutKind) => batches.filter((b) => b.kind === k && b.status === "paid").reduce((s, b) => s + batchTotal(b), 0);

  const update = (id: string, patch: (b: FinPayoutBatch) => Partial<FinPayoutBatch>) => setBatches((list) => list.map((b) => (b.id === id ? { ...b, ...patch(b) } : b)));

  const approve = (b: FinPayoutBatch) =>
    reason.ask({
      title: `Approve ${b.id}`,
      description: `${b.lines.filter((l) => !l.excluded).length} lines · ${usd(batchTotal(b))} · ${batchFlags(b)} flagged line${batchFlags(b) === 1 ? "" : "s"} included`,
      reasons: FIN_PAYOUT_REASONS,
      confirmLabel: "Approve batch",
      tone: "buy",
      onConfirm: (r) => {
        update(b.id, () => ({ status: "approved", approvedBy: ME, scheduled: b.scheduled === "Not scheduled" ? "25 Sep, 18:00" : b.scheduled }));
        setOpenId(null);
        auditToast(`${b.id} approved · pays ${b.scheduled === "Not scheduled" ? "25 Sep, 18:00" : b.scheduled}`, r);
      },
    });

  const payNow = (b: FinPayoutBatch) =>
    reason.ask({
      title: `Pay ${b.id} now`,
      description: `Sends ${b.lines.filter((l) => !l.excluded).length} USDT-TRC20 transfers (${usd(batchTotal(b))}) from the hot wallet immediately instead of at ${b.scheduled}.`,
      reasons: ["Partner request – early payout", "Scheduled window missed", "Finance lead instruction"],
      confirmLabel: "Sign & send",
      onConfirm: (r) => {
        update(b.id, () => ({ status: "paid" }));
        auditToast(`${b.id} paid · ${usd(batchTotal(b))}`, r);
      },
    });

  const toggleLine = (batchId: string, lineId: string) => update(batchId, (b) => ({ lines: b.lines.map((l) => (l.id === lineId ? { ...l, excluded: !l.excluded } : l)) }));

  const cols: Column<FinPayoutBatch>[] = [
    { key: "id", header: "Batch", cell: (b) => <div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-full bg-surface-3 text-fg-2 [&_svg]:size-3.5">{KIND_ICON[b.kind]}</span><div><div className="text-[13.5px] font-medium">{b.title}</div><div className="font-mono text-[11px] text-fg-3">{b.id}</div></div></div> },
    { key: "period", header: "Period", cell: (b) => <span className="text-[12.5px] text-fg-2">{b.period}</span>, hideOn: "md" },
    { key: "lines", header: "Lines", align: "right", cell: (b) => <span className="k-num">{b.lines.filter((l) => !l.excluded).length}</span> },
    { key: "total", header: "Total", align: "right", cell: (b) => <span className="k-num font-medium">{usd(batchTotal(b))}</span>, sort: (b) => batchTotal(b) },
    { key: "by", header: "Approved by", cell: (b) => <span className="text-[12.5px] text-fg-2">{b.approvedBy ?? "—"}</span>, hideOn: "lg" },
    { key: "status", header: "Status", align: "right", cell: (b) => BATCH_STATUS[b.status] },
  ];

  return (
    <div className="pb-24">
      <PageHeader
        title="Payouts"
        subtitle="IB commissions, copy / PAMM performance fees and prop-firm profit splits — paid in batches after approval"
        actions={
          <>
            <Segmented value={kind} onChange={setKind} options={[{ value: "all", label: "All" }, { value: "ib", label: "IB" }, { value: "copy", label: "Copy / PAMM" }, { value: "prop", label: "Prop" }]} />
            <Button variant="ember" onClick={() => toast.success("Draft batch generated", { description: "IB commissions 22 – 28 Sep will be calculated at period close (Mon 00:00 GMT+3)" })}>
              <Plus /> Generate batch
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Due for payout" icon={<CalendarClock />} value={<Money value={due.reduce((s, b) => s + batchTotal(b), 0)} />} chip={`${due.length} batches · next 18:00`} chipTone="warn" hot illustration="money_with_wings" />
        <KpiCard label="IB paid · Sep" icon={<Handshake />} value={<Money value={paidByKind("ib")} />} chip={`${batches.filter((b) => b.kind === "ib" && b.status === "paid").length} weekly batches`} chipTone="gold" delay={0.05} />
        <KpiCard label="Copy / PAMM fees · Sep" icon={<Repeat />} value={<Money value={paidByKind("copy") + 21_406.5} />} chip="HWM-based performance fees" chipTone="neutral" delay={0.1} />
        <KpiCard label="Prop payouts · Sep" icon={<Trophy />} value={<Money value={paidByKind("prop")} />} chip="Profit split 80–90%" chipTone="up" delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {active.length === 0 && (
          <Card className="lg:col-span-2 2xl:col-span-3">
            <div className="flex flex-col items-center py-12 text-center">
              <Icon3D name="check_mark_button" size={64} />
              <div className="mt-3 text-[15px] font-medium">No open batches</div>
              <div className="text-[13px] text-fg-3">Everything in this category has been paid.</div>
            </div>
          </Card>
        )}
        {active.map((b, i) => {
          const total = batchTotal(b);
          const flags = batchFlags(b);
          const lines = b.lines.filter((l) => !l.excluded);
          return (
            <Reveal key={b.id} delay={0.05 + i * 0.04}>
              <Card className="relative flex h-full flex-col overflow-hidden">
                <Icon3D name={KIND_3D[b.kind]} size={56} className="absolute right-4 top-4 opacity-95" />
                <div className="px-6 pt-5">
                  <div className="flex items-center gap-2">
                    <Chip size="sm" tone={b.kind === "ib" ? "gold" : b.kind === "copy" ? "ember" : "up"}>{FIN_PAYOUT_KIND_LABEL[b.kind]}</Chip>
                    <span className="font-mono text-[11.5px] text-fg-3">{b.id}</span>
                  </div>
                  <h3 className="mt-2 pr-16 text-[17px] font-medium tracking-tight">{b.title}</h3>
                  <div className="text-[12.5px] text-fg-3">{b.period}</div>
                </div>
                <div className="flex-1 px-6 pt-4">
                  <Money value={total} className="text-[28px] font-semibold tracking-tight" />
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                    <div className="k-row px-3 py-2">
                      <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Lines</div>
                      <div className="k-num mt-0.5 font-medium">{lines.length}{lines.length !== b.lines.length && <span className="text-fg-3">/{b.lines.length}</span>}</div>
                    </div>
                    <div className="k-row px-3 py-2">
                      <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Flagged</div>
                      <div className={cn("k-num mt-0.5 font-medium", flags ? "text-warn" : "text-up")}>{flags}</div>
                    </div>
                    <div className="k-row px-3 py-2">
                      <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Pays</div>
                      <div className="mt-0.5 truncate font-medium">{b.scheduled}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex -space-x-1.5">
                      {lines.slice(0, 6).map((l) => (
                        <Avatar key={l.id} src={l.person.photo} name={l.person.name} size={24} className="rounded-full ring-2 ring-surface" />
                      ))}
                      {lines.length > 6 && <span className="grid size-6 place-items-center rounded-full bg-surface-3 text-[10px] text-fg-2 ring-2 ring-surface">+{lines.length - 6}</span>}
                    </div>
                    {BATCH_STATUS[b.status]}
                  </div>
                  {flags > 0 && b.status !== "approved" && (
                    <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-warn/25 bg-warn-soft px-3 py-2 text-[12px] text-warn">
                      <AlertTriangle className="size-3.5 shrink-0" /> {flags} line{flags > 1 ? "s" : ""} flagged — review before approving
                    </div>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-line bg-black/15 px-6 py-3.5">
                  <span className="text-[11.5px] text-fg-3">{b.approvedBy ? `Approved by ${b.approvedBy}` : `Created ${finAgo(b.createdMinutesAgo)}`}</span>
                  <div className="flex gap-2">
                    <Button size="xs" variant="surface" onClick={() => setOpenId(b.id)}>
                      <ListChecks /> Lines
                    </Button>
                    {b.status === "approved" ? (
                      <Button size="xs" variant="ember" onClick={() => payNow(b)}>
                        <Send /> Pay now
                      </Button>
                    ) : (
                      <Button size="xs" variant="ember" onClick={() => approve(b)}>
                        <Check /> {b.status === "draft" ? "Submit & approve" : "Approve"}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </Reveal>
          );
        })}
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader title="All batches" subtitle="Click a batch to see its lines" action={<Button size="sm" variant="surface" onClick={() => toast.success("payout-batches-sep-2026.csv exported", { description: `${history.length} batches` })}><Download /> Export</Button>} />
          <div className="px-4 pb-5 pt-4 sm:px-6">
            <DataTable columns={cols} rows={history} rowKey={(b) => b.id} pageSize={8} dense onRowClick={(b) => setOpenId(b.id)} />
          </div>
        </Card>
      </Reveal>

      <PayoutLinesDrawer batch={open} onOpenChange={(o) => !o && setOpenId(null)} onToggleLine={toggleLine} onApprove={approve} />
      {reason.node}
    </div>
  );
}
