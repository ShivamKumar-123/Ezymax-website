"use client";

import * as React from "react";
import { CheckCircle2, Clock, Download, HandCoins, RotateCcw, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, IconButton, KpiCard, Money, PageHeader, Reveal, StatusChip, Tabs, Tooltip, type Column } from "@kalks/ui";
import { Checkbox, ColumnChart, PersonCell, auditToast, useReason } from "@/components/config/kit";
import { MONTHLY, PAYOUTS, TODAY, fmtAgo, fmtDate, type PayoutRequest } from "@/components/prop/data";
import { CheckIcons, PayoutDrawer, payoutTotal } from "@/components/prop/payout-parts";

const APPROVE_REASONS = ["All checks passed", "Manual review cleared", "Consistency exception approved", "VIP / retention"];
const REJECT_REASONS = ["Consistency rule not met", "Open violation", "KYC incomplete / expired", "Banned strategy detected", "IP / device mismatch", "Duplicate request"];
const $ = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PayoutsPage() {
  const [rows, setRows] = React.useState<PayoutRequest[]>(PAYOUTS);
  const [tab, setTab] = React.useState<"pending" | "history">("pending");
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [selId, setSelId] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const reason = useReason();

  const pending = rows.filter((p) => p.status === "pending" || p.status === "review");
  const history = rows.filter((p) => !(p.status === "pending" || p.status === "review"));
  const view = tab === "pending" ? pending : history;
  const sel = rows.find((p) => p.id === selId) ?? null;
  const pickable = pending.filter((p) => p.checks.every((c) => c.pass));

  const decide = (ids: string[], status: "approved" | "rejected") => {
    setRows((rs) => rs.map((p) => (ids.includes(p.id) ? { ...p, status, decidedBy: "You", decidedAt: TODAY } : p)));
    setPicked(new Set());
    setOpen(false);
  };
  const approve = (p: PayoutRequest) =>
    reason.ask({
      title: `Approve ${p.id}`,
      description: `${$(payoutTotal(p))} to ${p.account.trader.name} via ${p.method}${p.refund ? ` (incl. ${$(p.refund)} fee refund)` : ""}.`,
      reasons: p.checks.every((c) => c.pass) ? APPROVE_REASONS : ["Manual review cleared", "Consistency exception approved", "VIP / retention"],
      confirmLabel: "Approve payout",
      tone: "buy",
      body: p.checks.some((c) => !c.pass) ? <div className="rounded-[12px] border border-down/30 bg-down-soft px-3 py-2.5 text-[12.5px] text-down">Overriding {p.checks.filter((c) => !c.pass).length} failing check(s). Requires a second approver above $5,000.</div> : undefined,
      onConfirm: (r) => {
        decide([p.id], "approved");
        auditToast(`${p.id} approved · ${$(payoutTotal(p))}`, r);
      },
    });
  const reject = (p: PayoutRequest) =>
    reason.ask({
      title: `Reject ${p.id}`,
      description: `The trader is notified with the reason. Profit stays on the account.`,
      reasons: REJECT_REASONS,
      confirmLabel: "Reject payout",
      tone: "sell",
      onConfirm: (r) => {
        decide([p.id], "rejected");
        auditToast(`${p.id} rejected`, r);
      },
    });
  const batch = () => {
    const list = pending.filter((p) => picked.has(p.id));
    const total = list.reduce((s, p) => s + payoutTotal(p), 0);
    reason.ask({
      title: `Batch approve ${list.length} payouts`,
      description: `${$(total)} total. Only requests with all risk checks passing can be batch-approved.`,
      reasons: ["All checks passed", "Weekly payout run"],
      confirmLabel: `Approve ${list.length}`,
      tone: "buy",
      onConfirm: (r) => {
        decide(list.map((p) => p.id), "approved");
        auditToast(`${list.length} payouts approved · ${$(total)}`, r);
      },
    });
  };

  const allPicked = pickable.length > 0 && pickable.every((p) => picked.has(p.id));
  const pickCol: Column<PayoutRequest> = {
    key: "pick",
    width: "44px",
    header: <Checkbox checked={allPicked} indeterminate={!allPicked && picked.size > 0} onChange={(v) => setPicked(v ? new Set(pickable.map((p) => p.id)) : new Set())} label="Select all" />,
    cell: (p) =>
      p.checks.every((c) => c.pass) ? (
        <Checkbox
          checked={picked.has(p.id)}
          onChange={(v) =>
            setPicked((s) => {
              const n = new Set(s);
              if (v) n.add(p.id);
              else n.delete(p.id);
              return n;
            })
          }
        />
      ) : (
        <Tooltip content="Failing checks: review individually">
          <span className="grid size-[18px] place-items-center text-down" onClick={(e) => e.stopPropagation()}>
            <ShieldAlert className="size-3.5" />
          </span>
        </Tooltip>
      ),
  };
  const columns: Column<PayoutRequest>[] = [
    ...(tab === "pending" ? [pickCol] : []),
    { key: "trader", header: "Trader", cell: (p) => <PersonCell name={p.account.trader.name} photo={p.account.trader.photo} sub={<span className="font-mono">#{p.account.login}</span>} verified={p.account.kyc} />, sort: (p) => p.account.trader.name },
    {
      key: "req",
      header: "Request",
      cell: (p) => (
        <div>
          <div className="font-mono text-[12px]">{p.id}</div>
          <div className="text-[11.5px] text-fg-3">{tab === "pending" ? fmtAgo(p.requested) : fmtDate(p.requested)} · cycle {p.cycle}</div>
        </div>
      ),
      sort: (p) => p.requested,
      hideOn: "md",
    },
    { key: "profit", header: "Profit", align: "right", cell: (p) => <span className="k-num">{$(p.profit)}</span>, sort: (p) => p.profit },
    { key: "split", header: "Split", align: "right", cell: (p) => <span className="k-num text-gold">{p.split}%</span>, hideOn: "lg" },
    { key: "trader$", header: "Trader share", align: "right", cell: (p) => <span className="k-num font-medium text-up">{$(p.traderShare)}</span>, sort: (p) => p.traderShare },
    { key: "firm$", header: "Firm share", align: "right", cell: (p) => <span className="k-num text-fg-2">{$(p.firmShare)}</span>, hideOn: "lg" },
    { key: "refund", header: "Fee refund", align: "right", cell: (p) => (p.refund ? <span className="k-num text-gold">+${p.refund}</span> : <span className="text-fg-3">-</span>), hideOn: "md" },
    { key: "checks", header: "Risk checks", cell: (p) => <CheckIcons p={p} /> },
    { key: "status", header: "Status", cell: (p) => <StatusChip status={p.status} /> },
    ...(tab === "pending"
      ? [
          {
            key: "act",
            header: "",
            align: "right" as const,
            cell: (p: PayoutRequest) => (
              <span className="inline-flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                <IconButton size="sm" aria-label="Reject" onClick={() => reject(p)} className="hover:text-down">
                  <XCircle />
                </IconButton>
                <IconButton size="sm" aria-label="Approve" onClick={() => approve(p)} className="hover:text-up">
                  <CheckCircle2 />
                </IconButton>
              </span>
            ),
          },
        ]
      : []),
  ];

  const pendingTotal = pending.reduce((s, p) => s + payoutTotal(p), 0);
  const refunds = rows.filter((p) => p.status === "completed" || p.status === "approved").reduce((s, p) => s + p.refund, 0);

  return (
    <div className="pb-24">
      <PageHeader
        title="Payouts"
        subtitle="Profit-split payouts for funded traders. Every approval runs consistency, min-days, violation, KYC and IP checks."
        actions={
          <>
            <Button size="sm" variant="surface" onClick={() => toast.success("Payout ledger exported", { description: "prop-payouts-sep-2026.csv" })}>
              <Download /> Ledger
            </Button>
            <Button size="sm" variant="buy" disabled={!picked.size} onClick={batch}>
              <CheckCircle2 /> Batch approve{picked.size ? ` (${picked.size})` : ""}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Pending payouts" icon={<Clock />} value={<Money value={pendingTotal} />} chip={`${pending.length} requests · ${pending.filter((p) => p.status === "review").length} need review`} chipTone="warn" delay={0} />
        <KpiCard label="Paid · 30 days" icon={<HandCoins />} value={<Money value={MONTHLY[11].payouts} decimals={0} />} chip="412 payouts" chipTone="up" delay={0.05} />
        <KpiCard label="Avg. processing" icon={<RotateCcw />} value={<span className="k-num">6.4h</span>} chip="SLA 24h · 99.2% met" chipTone="up" delay={0.1} />
        <KpiCard label="Fee refunds" icon={<CheckCircle2 />} value={<Money value={12558 + refunds} decimals={0} />} chip="MTD · returned on 1st payout" chipTone="gold" illustration="money_with_wings" delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <Reveal delay={0.1}>
          <Card>
            <div className="flex flex-wrap items-end justify-between gap-3 px-6 pt-5">
              <Tabs
                value={tab}
                onChange={(t) => {
                  setTab(t);
                  setPicked(new Set());
                }}
                tabs={[
                  { value: "pending", label: "Approval queue", count: pending.length },
                  { value: "history", label: "History", count: history.length },
                ]}
              />
              {tab === "pending" && picked.size > 0 && (
                <div className="flex items-center gap-2 pb-2">
                  <Chip tone="up">{picked.size} selected</Chip>
                  <Button size="xs" variant="ghost" onClick={() => setPicked(new Set())}>
                    Clear
                  </Button>
                  <Button size="xs" variant="buy" onClick={batch}>
                    Approve selected
                  </Button>
                </div>
              )}
            </div>
            <div className="px-4 pb-6 pt-4 sm:px-6">
              <DataTable
                key={tab}
                columns={columns}
                rows={view}
                pageSize={10}
                dense
                rowKey={(p) => p.id}
                exportName={tab === "pending" ? "payout-queue" : "payout-history"}
                search={(p) => `${p.account.trader.name} ${p.account.login} ${p.id}`}
                searchPlaceholder="Trader, login, ID…"
                onRowClick={(p) => {
                  setSelId(p.id);
                  setOpen(true);
                }}
                toolbar={<span className="text-[12.5px] text-fg-3">{tab === "pending" ? "Only requests with all checks passing can be batch-approved." : "Decisions from the last 60 days."}</span>}
              />
            </div>
          </Card>
        </Reveal>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Reveal delay={0.15} className="xl:col-span-8">
            <Card>
              <CardHeader title="Payouts by month" subtitle="Trader share paid vs firm share retained" />
              <div className="px-4 pb-5 pt-4 sm:px-6">
                <ColumnChart
                  height={200}
                  data={MONTHLY.map((m) => ({ label: m.label, values: [Math.round(m.payouts), Math.round(m.payouts * 0.22)] }))}
                  series={[
                    { label: "Trader share", tone: "up" },
                    { label: "Firm share", tone: "gold" },
                  ]}
                  format={(v) => (v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${v}`)}
                />
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.2} className="xl:col-span-4">
            <Card className="h-full">
              <CardHeader title="Rejection reasons" subtitle="Last 90 days" />
              <div className="space-y-3 px-4 pb-6 pt-4 sm:px-6">
                {[
                  ["Consistency rule not met", 41],
                  ["Open violation", 23],
                  ["KYC incomplete / expired", 17],
                  ["Banned strategy detected", 12],
                  ["IP / device mismatch", 7],
                ].map(([k, v]) => (
                  <div key={k as string}>
                    <div className="mb-1 flex justify-between text-[12.5px]">
                      <span className="text-fg-2">{k}</span>
                      <span className="k-num font-medium">{v}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-down/80" style={{ width: `${((v as number) / 41) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>
        </div>
      </div>

      <PayoutDrawer p={sel} open={open} onOpenChange={setOpen} onApprove={approve} onReject={reject} />
      {reason.node}
    </div>
  );
}
