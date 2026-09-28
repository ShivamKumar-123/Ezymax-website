"use client";

import * as React from "react";
import { Check, CircleDollarSign, Clock, HandCoins, X } from "lucide-react";
import { Button, Card, CardHeader, DataTable, KpiCard, PageHeader, Reveal, Tabs, type Column } from "@kalks/ui";
import { MiniStat } from "@/components/config/kit";
import { TableSkeleton, ago, useApi, useNow, when } from "@/components/live/kit";
import { ChallengeDrawer } from "./challenge-drawer";
import { KycStatus, PropError, PropStatus, ReadOnlyNote, TraderCell, pct, propWrite, usd, useAction, useClientNames, usePropCan, type Overview, type Payout } from "./kit";

type Tab = "queue" | "history";
const OPEN = ["pending", "failed", "approved"];

export function LivePayoutsPage() {
  const now = useNow();
  const canApprove = usePropCan("prop.approve");
  const [tab, setTab] = React.useState<Tab>("queue");
  const { data, error, reload } = useApi<{ payouts: Payout[] }>("/api/prop/payouts", { refreshMs: 10_000 });
  const ov = useApi<Overview>("/api/prop/overview", { refreshMs: 15_000 });
  const all = data?.payouts ?? [];
  const queue = all.filter((p) => OPEN.includes(p.status)).sort((a, b) => (a.status === b.status ? Date.parse(a.requestedAt) - Date.parse(b.requestedAt) : a.status === "pending" ? -1 : b.status === "pending" ? 1 : 0));
  const history = all.filter((p) => !OPEN.includes(p.status));
  const rows = tab === "queue" ? queue : history;
  const names = useClientNames(all.map((p) => p.userId));
  const act = useAction();
  const [sel, setSel] = React.useState<number | null>(null);
  const [open, setOpen] = React.useState(false);

  const breakdown = (p: Payout) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <MiniStat label="Profit" value={usd(p.profit)} />
      <MiniStat label={`Trader ${pct(p.split, 0)}`} value={usd(p.traderAmount)} tone="up" />
      <MiniStat label="Fee refund" value={usd(p.feeRefund)} />
      <MiniStat label="Total credit" value={usd(p.total)} tone="gold" />
    </div>
  );

  const decide = (p: Payout, decision: "approve" | "reject") => {
    const who = names[String(p.userId)]?.name ?? p.traderName;
    act.ask({
      title: decision === "approve" ? `Approve payout #${p.id}` : `Reject payout #${p.id}`,
      description:
        decision === "approve"
          ? `Credits ${usd(p.total)} to ${who}'s USDT wallet${p.feeRefund ? ` (includes the ${usd(p.feeRefund)} fee refund)` : ""} and issues a payout certificate. This moves real money.`
          : `The ${usd(p.profit)} profit is put back on account ${p.login}. The trader is notified with your note.`,
      note: decision === "approve" ? "optional" : "required",
      noteLabel: decision === "approve" ? "Note" : "Reason for the trader",
      notePlaceholder: decision === "approve" ? "Optional note for the audit log" : "Why the payout is rejected (sent to the trader)",
      confirmLabel: decision === "approve" ? `Approve ${usd(p.total)}` : "Reject payout",
      confirmVariant: decision === "approve" ? "buy" : "sell",
      body: (
        <div className="space-y-3">
          {breakdown(p)}
          {decision === "approve" && (
            <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-line bg-surface-2 px-3 py-2.5 text-[12.5px] text-fg-2">
              KYC at request <KycStatus status={p.kycStatus} />
              <span className="text-fg-3">· the client&apos;s current KYC must be verified; it is checked again on approval.</span>
            </div>
          )}
        </div>
      ),
      run: (v) => propWrite(`payouts/${p.id}/${decision}`, v.note ? { note: v.note } : {}),
      success: decision === "approve" ? `Payout #${p.id} approved` : `Payout #${p.id} rejected`,
      onDone: reload,
    });
  };

  const columns: Column<Payout>[] = [
    { key: "id", header: "Payout", sort: (p) => p.id, csv: (p) => p.id, cell: (p) => <span className="font-mono text-[12px]">#{p.id}<span className="block text-[11px] text-fg-3">challenge #{p.challengeId}</span></span> },
    { key: "trader", header: "Trader", sort: (p) => p.traderName, csv: (p) => p.traderName, cell: (p) => <TraderCell name={p.traderName} userId={p.userId} names={names} /> },
    { key: "acc", header: "Account", hideOn: "lg", csv: (p) => `${p.planName} ${p.login}`, cell: (p) => <span className="text-[12.5px]">{p.planName}<span className="block font-mono text-[11px] text-fg-3">{p.login} · {usd(p.size, 0)}</span></span> },
    { key: "profit", header: "Profit", align: "right", sort: (p) => p.profit, csv: (p) => p.profit, cell: (p) => <span className="k-num">{usd(p.profit)}</span> },
    { key: "split", header: "Split", align: "right", hideOn: "md", csv: (p) => p.split, cell: (p) => <span className="k-num text-gold">{pct(p.split, 0)}</span> },
    { key: "trader$", header: "Trader amount", align: "right", sort: (p) => p.traderAmount, csv: (p) => p.traderAmount, cell: (p) => <span className="k-num font-medium text-up">{usd(p.traderAmount)}</span> },
    { key: "refund", header: "Fee refund", align: "right", hideOn: "md", csv: (p) => p.feeRefund, cell: (p) => (p.feeRefund ? <span className="k-num text-gold">+{usd(p.feeRefund)}</span> : <span className="text-fg-3">—</span>) },
    { key: "total", header: "Total", align: "right", sort: (p) => p.total, csv: (p) => p.total, cell: (p) => <span className="k-num font-semibold">{usd(p.total)}</span> },
    { key: "kyc", header: "KYC at request", hideOn: "lg", csv: (p) => p.kycStatus ?? "", cell: (p) => <KycStatus status={p.kycStatus} /> },
    { key: "req", header: tab === "queue" ? "Requested" : "Decided", sort: (p) => Date.parse(tab === "queue" ? p.requestedAt : (p.decidedAt ?? p.requestedAt)), csv: (p) => p.requestedAt, cell: (p) => <span className="whitespace-nowrap text-[11.5px] text-fg-3" title={when(p.requestedAt)}>{tab === "queue" ? ago(p.requestedAt, now) : p.decidedAt ? `${ago(p.decidedAt, now)}${p.decidedBy ? ` · ${p.decidedBy}` : ""}` : "—"}</span> },
    { key: "status", header: "Status", sort: (p) => p.status, csv: (p) => p.status, cell: (p) => <span className="flex flex-col items-start gap-0.5"><PropStatus status={p.status} />{(p.error || p.note) && <span className="max-w-44 truncate text-[10.5px] text-fg-3" title={p.error ?? p.note ?? ""}>{p.error ?? p.note}</span>}</span> },
    ...(tab === "queue" && canApprove
      ? [
          {
            key: "x",
            header: "",
            align: "right" as const,
            cell: (p: Payout) =>
              p.status === "pending" || p.status === "failed" || p.status === "approved" ? (
                <span className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <Button size="xs" variant="up-outline" onClick={() => decide(p, "approve")}>
                    <Check /> {p.status === "pending" ? "Approve" : "Retry credit"}
                  </Button>
                  {p.status === "pending" && (
                    <Button size="xs" variant="down-outline" onClick={() => decide(p, "reject")}>
                      <X /> Reject
                    </Button>
                  )}
                </span>
              ) : null,
          },
        ]
      : []),
  ];

  const pendingAmt = queue.filter((p) => p.status === "pending").reduce((s, p) => s + p.total, 0);

  return (
    <div className="pb-24">
      <PageHeader title="Payouts" subtitle="Funded-account payout requests. The profit is held off the account while in review; approval credits the trader's USDT wallet." actions={!canApprove ? <ReadOnlyNote what="approve payouts" /> : undefined} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Pending" icon={<Clock />} value={<span className="k-num">{queue.filter((p) => p.status === "pending").length}</span>} chip={usd(pendingAmt)} chipTone="warn" />
        <KpiCard label="Failed credits" icon={<HandCoins />} value={<span className="k-num">{queue.filter((p) => p.status === "failed").length}</span>} chip="Wallet credit not confirmed" chipTone={queue.some((p) => p.status === "failed") ? "down" : "neutral"} delay={0.04} />
        <KpiCard label="Paid · 30d" icon={<CircleDollarSign />} value={<span className="k-num">{usd(ov.data?.paid30d, 0)}</span>} chip={`vs ${usd(ov.data?.fees30d, 0)} fees`} delay={0.08} />
        <KpiCard label="Rejected" icon={<X />} value={<span className="k-num">{history.filter((p) => p.status === "rejected").length}</span>} chip="All time" delay={0.12} />
      </div>
      <Reveal delay={0.08} className="mt-4">
        <Card>
          <CardHeader
            title={tab === "queue" ? "Approval queue" : "History"}
            subtitle={tab === "queue" ? "Pending and failed first, oldest first" : "Paid and rejected payouts"}
            action={<Tabs value={tab} onChange={setTab} tabs={[{ value: "queue", label: "Queue", count: queue.length }, { value: "history", label: "History", count: history.length }]} />}
          />
          <div className="px-4 pb-6 pt-4 sm:px-6">
            {error && !data ? (
              <PropError error={error} onRetry={reload} />
            ) : !data ? (
              <TableSkeleton />
            ) : (
              <DataTable
                columns={columns}
                rows={rows}
                pageSize={20}
                dense
                rowKey={(p) => String(p.id)}
                exportName={`prop-payouts-${tab}`}
                search={(p) => `${p.id} ${p.traderName} ${p.login} ${p.planName} ${names[String(p.userId)]?.email ?? ""}`}
                searchPlaceholder="Trader, login, payout id"
                onRowClick={(p) => {
                  setSel(p.challengeId);
                  setOpen(true);
                }}
                empty={<div className="py-10 text-center text-[13px] text-fg-3">{tab === "queue" ? "Nothing waiting for approval." : "No decided payouts yet."}</div>}
              />
            )}
          </div>
        </Card>
      </Reveal>
      <ChallengeDrawer id={sel} open={open} onOpenChange={setOpen} onChanged={reload} funded />
      {act.node}
    </div>
  );
}
