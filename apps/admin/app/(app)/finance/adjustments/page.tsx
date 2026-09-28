"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Clock3, Download, FileText, Minus, Plus, ShieldCheck, TrendingDown, TrendingUp, UserCheck, X } from "lucide-react";
import { Avatar, Button, Card, CardHeader, Chip, DataTable, KpiCard, Money, PageHeader, Reveal, Segmented, StatusChip, Tooltip, cn, type Column } from "@kalks/ui";
import { FIN_ADJUSTMENTS, FIN_ADJ_REASONS, FIN_ADJ_THRESHOLD, FIN_STAFF, finAgo, finTime, type FinAdjustment } from "@kalks/mock/admin-finance";
import { PersonCell, auditToast, useReason } from "@/components/config/kit";
import { AdjustmentCreate, type NewAdjustment } from "@/components/finance/adjustment-create";
import { ShareBars, usd } from "@/components/finance/shared";

const ME = FIN_STAFF[0]!; // Priya Nair — signed-in Risk Manager

function Signed({ a }: { a: FinAdjustment }) {
  return (
    <span className={cn("k-num whitespace-nowrap font-medium", a.direction === "add" ? "text-up" : "text-down")}>
      {a.direction === "add" ? "+" : "-"}
      {usd(a.amount)}
    </span>
  );
}

export default function AdjustmentsPage() {
  const [rows, setRows] = React.useState<FinAdjustment[]>(FIN_ADJUSTMENTS);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [kind, setKind] = React.useState<"all" | "balance" | "credit">("all");
  const [seq, setSeq] = React.useState(4411);
  const reason = useReason();

  const pending = rows.filter((r) => r.status === "pending");
  const approved = rows.filter((r) => r.status === "approved");
  const added = approved.filter((r) => r.direction === "add").reduce((s, r) => s + r.amount, 0);
  const deducted = approved.filter((r) => r.direction === "deduct").reduce((s, r) => s + r.amount, 0);
  const view = rows.filter((r) => r.status !== "pending" && (kind === "all" || r.kind === kind));

  const byReason = FIN_ADJ_REASONS.map((rs) => ({ label: rs, n: rows.filter((r) => r.reason === rs).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);

  const create = (a: NewAdjustment) => {
    const needs = a.amount > FIN_ADJ_THRESHOLD;
    const item: FinAdjustment = { ...a, id: `ADJ-${seq}`, maker: ME, status: needs ? "pending" : "approved", minutesAgo: 0, ticket: `SUP-${48000 + seq}`, checker: undefined };
    setSeq((s) => s + 1);
    setRows((r) => [item, ...r]);
    if (needs) toast.message(`${item.id} submitted for second approval`, { description: `${usd(a.amount)} ${a.direction === "add" ? "to" : "from"} ${a.client.person.name} · above ${usd(FIN_ADJ_THRESHOLD, 0)} maker-checker threshold` });
    else auditToast(`${a.direction === "add" ? "Credited" : "Deducted"} ${usd(a.amount)} ${a.direction === "add" ? "to" : "from"} ${a.client.person.name}`, a.reason);
  };

  const decide = (a: FinAdjustment, d: "approved" | "rejected") =>
    reason.ask({
      title: `${d === "approved" ? "Approve" : "Reject"} ${a.id}`,
      description: `${a.direction === "add" ? "+" : "-"}${usd(a.amount)} ${a.kind} · ${a.client.person.name} · maker ${a.maker.name}`,
      reasons: d === "approved" ? ["Evidence verified", "Matches support ticket", "Finance lead instruction", "Within compensation policy"] : ["Insufficient evidence", "Amount exceeds policy", "Duplicate request", "Wrong account"],
      confirmLabel: d === "approved" ? "Approve & post" : "Reject",
      tone: d === "approved" ? "buy" : "sell",
      onConfirm: (r) => {
        setRows((list) => list.map((x) => (x.id === a.id ? { ...x, status: d, checker: ME, minutesAgo: 0 } : x)));
        auditToast(`${a.id} ${d} by checker`, r);
      },
    });

  const cols: Column<FinAdjustment>[] = [
    { key: "id", header: "Adjustment", cell: (a) => <div><div className="font-mono text-[12.5px] text-fg">{a.id}</div><div className="text-[11px] text-fg-3">{finTime(a.minutesAgo)}</div></div>, sort: (a) => -a.minutesAgo },
    { key: "client", header: "Client", cell: (a) => <PersonCell name={a.client.person.name} photo={a.client.person.photo} sub={<span className="font-mono">{a.account}</span>} size={28} />, sort: (a) => a.client.person.name },
    { key: "kind", header: "Type", cell: (a) => <Chip size="sm" tone={a.kind === "credit" ? "gold" : "neutral"}>{a.kind === "credit" ? "Credit" : "Balance"}</Chip>, hideOn: "md" },
    { key: "amount", header: "Amount", align: "right", cell: (a) => <Signed a={a} />, sort: (a) => (a.direction === "add" ? a.amount : -a.amount) },
    {
      key: "reason",
      header: "Reason",
      cell: (a) => (
        <div className="max-w-56">
          <div className="truncate text-[13px]">{a.reason}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-fg-3">
            <span className="font-mono">{a.ticket}</span>
            {a.attachment && (
              <Tooltip content={a.attachment}>
                <span className="inline-flex items-center gap-0.5 text-fg-2">
                  <FileText className="size-3" /> 1
                </span>
              </Tooltip>
            )}
          </div>
        </div>
      ),
      hideOn: "sm",
    },
    {
      key: "mc",
      header: "Maker → checker",
      cell: (a) => (
        <span className="flex items-center gap-1.5 text-[12px]">
          <Tooltip content={`Maker · ${a.maker.name}`}>
            <span>
              <Avatar src={a.maker.photo} name={a.maker.name} size={24} />
            </span>
          </Tooltip>
          <span className="text-fg-3">→</span>
          {a.checker ? (
            <Tooltip content={`Checker · ${a.checker.name}`}>
              <span>
                <Avatar src={a.checker.photo} name={a.checker.name} size={24} />
              </span>
            </Tooltip>
          ) : (
            <span className="rounded-full border border-line px-2 py-0.5 text-[10.5px] text-fg-3">Auto · &lt; $5K</span>
          )}
        </span>
      ),
      hideOn: "lg",
    },
    { key: "status", header: "Status", align: "right", cell: (a) => <StatusChip status={a.status} /> },
  ];

  return (
    <div className="pb-24">
      <PageHeader
        title="Manual adjustments"
        subtitle={`Balance & credit corrections with reason codes · maker-checker above ${usd(FIN_ADJ_THRESHOLD, 0)}`}
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("adjustments-sep-2026.csv exported", { description: `${rows.length} adjustments with maker/checker trail` })}>
              <Download /> Export
            </Button>
            <Button variant="ember" onClick={() => setCreateOpen(true)}>
              <Plus /> New adjustment
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Awaiting checker" icon={<Clock3 />} value={<span className="k-num">{pending.length}</span>} hot={pending.length > 0} illustration="receipt" chip={`${usd(pending.reduce((s, r) => s + r.amount, 0), 0)} held`} chipTone="warn" />
        <KpiCard label="Credited · 30d" icon={<TrendingUp />} value={<Money value={added} />} chip={`${approved.filter((r) => r.direction === "add").length} adjustments`} chipTone="up" delay={0.05} />
        <KpiCard label="Deducted · 30d" icon={<TrendingDown />} value={<Money value={deducted} />} chip={`${approved.filter((r) => r.direction === "deduct").length} adjustments`} chipTone="down" delay={0.1} />
        <KpiCard label="Rejected by checker" icon={<ShieldCheck />} value={<span className="k-num">{rows.filter((r) => r.status === "rejected").length}</span>} chip="4-eyes principle enforced" chipTone="neutral" delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="min-w-0 xl:col-span-8">
          <Card className="h-full">
            <CardHeader title="Pending second approval" subtitle="You can approve requests created by other staff only" icon={<UserCheck />} action={<Chip tone={pending.length ? "warn" : "up"} dot>{pending.length}</Chip>} />
            <div className="mt-4 space-y-2 px-4 pb-5 sm:px-6">
              {pending.length === 0 && <div className="k-row px-4 py-8 text-center text-[13px] text-fg-3">No adjustments waiting for approval.</div>}
              {pending.map((a) => {
                const own = a.maker.id === ME.id;
                return (
                  <div key={a.id} className="k-row flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", a.direction === "add" ? "bg-up-soft text-up" : "bg-down-soft text-down")}>{a.direction === "add" ? <Plus className="size-4" /> : <Minus className="size-4" />}</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">
                          <Signed a={a} />
                          <span className="text-fg-3">·</span>
                          <span className="truncate">{a.client.person.name}</span>
                          <Chip size="sm" tone={a.kind === "credit" ? "gold" : "neutral"}>{a.kind}</Chip>
                        </div>
                        <div className="mt-0.5 truncate text-[12px] text-fg-3">
                          {a.reason} · <span className="font-mono">{a.account}</span> · {a.note}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="flex items-center gap-2 text-[11.5px] text-fg-3">
                        <Avatar src={a.maker.photo} name={a.maker.name} size={22} />
                        <span>
                          {a.maker.name.split(" ")[0]} · {finAgo(a.minutesAgo)}
                        </span>
                      </span>
                      {own ? (
                        <Chip size="sm">Your request</Chip>
                      ) : (
                        <>
                          <Button size="xs" variant="down-outline" onClick={() => decide(a, "rejected")}>
                            <X /> Reject
                          </Button>
                          <Button size="xs" variant="up-outline" onClick={() => decide(a, "approved")}>
                            <Check /> Approve
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="min-w-0 xl:col-span-4">
          <Card className="h-full">
            <CardHeader title="By reason code" subtitle="Last 30 days" />
            <div className="px-6 pb-6 pt-5">
              <ShareBars items={byReason.map((b) => ({ label: b.label, value: (b.n / rows.length) * 100, sub: `${b.n}×` }))} />
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader title="History" subtitle="Posted and rejected adjustments" action={<Segmented size="xs" value={kind} onChange={setKind} options={[{ value: "all", label: "All" }, { value: "balance", label: "Balance" }, { value: "credit", label: "Credit" }]} />} />
          <div className="px-4 pb-5 pt-4 sm:px-6">
            <DataTable columns={cols} rows={view} rowKey={(a) => a.id} pageSize={10} dense search={(a) => `${a.id} ${a.client.person.name} ${a.account} ${a.reason} ${a.ticket} ${a.maker.name}`} searchPlaceholder="ID, client, reason, ticket…" exportName="adjustments" onRowClick={(a) => toast.message(`${a.id} · ${a.reason}`, { description: `${a.note}${a.attachment ? ` · ${a.attachment}` : ""}` })} />
          </div>
        </Card>
      </Reveal>

      <AdjustmentCreate open={createOpen} onOpenChange={setCreateOpen} onCreate={create} />
      {reason.node}
    </div>
  );
}
