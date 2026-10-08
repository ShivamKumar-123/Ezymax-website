"use client";

import * as React from "react";
import { CalendarClock, CheckCheck, Download, Timer, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, Delta, KpiCard, Money, PageHeader, Reveal, Segmented, StatusChip, type Column } from "@ezymex/ui";
import { PAMM_FUNDS, PAMM_REQUESTS, type PammFund, type PammRequest } from "@ezymex/mock/admin-partners";
import { PersonCell, auditToast, useReason } from "@/components/config/kit";
import { fmtInt, fmtUsdK } from "@/components/partners/common";
import { EmergencyStopDialog, STATUS_LABEL, type StopTarget } from "@/components/social/common";
import { Countdown, FundDrawer, RequestRow, useClock } from "@/components/social/pamm-parts";
import { IS_DEMO } from "@ezymex/mock/mode";
import { LivePammPage } from "@/components/social-live/pamm";

function DemoPammPage() {
  const [funds, setFunds] = React.useState(PAMM_FUNDS);
  const [reqs, setReqs] = React.useState(PAMM_REQUESTS);
  const [sel, setSel] = React.useState<string | null>(null);
  const [stop, setStop] = React.useState<StopTarget | null>(null);
  const [kind, setKind] = React.useState<"all" | PammRequest["kind"]>("all");
  const reason = useReason();
  const now = useClock();

  const fund = funds.find((f) => f.id === sel) ?? null;
  const pending = reqs.filter((r) => r.status === "pending");
  const dep = pending.filter((r) => r.kind === "deposit").reduce((s, r) => s + r.amount, 0);
  const wd = pending.filter((r) => r.kind === "withdrawal").reduce((s, r) => s + r.amount, 0);
  const next = [...funds].sort((a, b) => Date.parse(a.nextRollover) - Date.parse(b.nextRollover))[0]!;
  const aum = funds.reduce((s, f) => s + f.aum, 0);

  const decide = (r: PammRequest, ok: boolean) => {
    if (ok && r.amount < 25_000) {
      setReqs((xs) => xs.map((x) => (x.id === r.id ? { ...x, status: "approved" } : x)));
      toast.success(`${r.kind === "deposit" ? "Deposit" : "Withdrawal"} approved`, { description: `${r.investor} · $${r.amount.toLocaleString()} · executes at next rollover` });
      return;
    }
    reason.ask({
      title: `${ok ? "Approve" : "Reject"} ${r.kind} ${r.id}`,
      description: `${r.investor} · ${r.fund} · $${r.amount.toLocaleString()}${r.note ? ` · ${r.note}` : ""}`,
      reasons: ok ? ["Source of funds verified", "Within investor limits", "Manager consent received"] : ["Insufficient funds", "Inside lock-up period", "Compliance hold", "Investor request"],
      confirmLabel: ok ? "Approve" : "Reject",
      tone: ok ? "buy" : "sell",
      onConfirm: (why) => {
        setReqs((xs) => xs.map((x) => (x.id === r.id ? { ...x, status: ok ? "approved" : "rejected" } : x)));
        auditToast(`${r.id} ${ok ? "approved" : "rejected"}`, why);
      },
    });
  };

  const stopFund = (f: PammFund) => setStop({ kind: "fund", id: f.id, name: f.name, followers: f.investors, aum: f.aum, openPositions: 12 + (f.investors % 40) });

  const cols: Column<PammFund>[] = [
    { key: "f", header: "Fund", sort: (f) => f.name, cell: (f) => <PersonCell name={f.name} photo={f.photo} sub={<>{f.manager} · <span className="font-mono">{f.id}</span></>} /> },
    { key: "nav", header: "NAV / unit", align: "right", sort: (f) => f.nav, cell: (f) => <span><span className="k-num block font-medium">{f.nav.toFixed(4)}</span><Delta value={f.navChange30d} className="text-[11px]" /></span> },
    { key: "u", header: "Units", align: "right", hideOn: "lg", sort: (f) => f.units, cell: (f) => <span className="k-num text-fg-2">{fmtInt(f.units)}</span> },
    { key: "a", header: "AUM", align: "right", sort: (f) => f.aum, cell: (f) => <span className="k-num font-medium">{fmtUsdK(f.aum)}</span> },
    { key: "i", header: "Investors", align: "right", hideOn: "md", sort: (f) => f.investors, cell: (f) => <span className="k-num">{f.investors}</span> },
    { key: "r", header: "Rollover", sort: (f) => Date.parse(f.nextRollover), cell: (f) => <span className="flex items-center gap-2"><Chip size="sm">{f.rollover}</Chip><Countdown to={f.nextRollover} now={now} className="text-[11.5px] text-fg-3" /></span> },
    { key: "q", header: "Queue", align: "right", hideOn: "md", cell: (f) => { const n = pending.filter((r) => r.fundId === f.id).length; return n ? <Chip size="sm" tone="warn">{n} pending</Chip> : <span className="text-fg-3">—</span>; } },
    { key: "fee", header: "Fees", align: "right", hideOn: "lg", cell: (f) => <span className="k-num text-fg-2">{f.perfFee}% · {f.mgmtFee}%</span> },
    { key: "s", header: "Status", cell: (f) => <StatusChip status={f.status} label={STATUS_LABEL[f.status]} /> },
  ];

  const queue = reqs.filter((r) => kind === "all" || r.kind === kind);

  return (
    <div className="pb-16">
      <PageHeader
        title="PAMM funds"
        subtitle="Pooled accounts, NAV per unit, rollover schedule and investor request queue"
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("pamm-funds.csv exported", { description: `${funds.length} funds · NAV history attached` })}>
              <Download /> Export
            </Button>
            <Button variant="surface" onClick={() => toast.success("Rollover calendar", { description: "Daily 00:00 · Weekly Mon 00:00 · Monthly 1st 00:00 (GMT+3)" })}>
              <CalendarClock /> Calendar
            </Button>
            <Button
              variant="ember"
              disabled={!pending.length}
              onClick={() => {
                const ok = pending.filter((r) => !r.note);
                reason.ask({
                  title: `Approve ${ok.length} clean requests`,
                  description: `Requests without warnings only. ${pending.length - ok.length} flagged requests stay in the queue.`,
                  reasons: ["Routine pre-rollover approval", "Batch verified"],
                  confirmLabel: "Approve all",
                  tone: "buy",
                  onConfirm: (why) => {
                    setReqs((xs) => xs.map((x) => (x.status === "pending" && !x.note ? { ...x, status: "approved" } : x)));
                    auditToast(`${ok.length} PAMM requests approved`, why);
                  },
                });
              }}
            >
              <CheckCheck /> Approve clean
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="PAMM AUM" icon={<Wallet />} value={<Money value={aum} decimals={0} />} chip={`${funds.length} funds · ${funds.filter((f) => f.status === "active").length} open`} />
        <KpiCard label="Investors" icon={<Users />} value={<span className="k-num">{fmtInt(funds.reduce((s, f) => s + f.investors, 0))}</span>} chip="+146 this month" chipTone="up" delay={0.05} />
        <KpiCard label="Pending flows" value={<Money value={dep - wd} decimals={0} signed />} footer={<div className="flex gap-1.5"><Chip size="sm" tone="up">In {fmtUsdK(dep)}</Chip><Chip size="sm" tone="down">Out {fmtUsdK(wd)}</Chip></div>} delay={0.1} />
        <KpiCard label="Next rollover" icon={<Timer />} hot value={<Countdown to={next.nextRollover} now={now} />} chip={`${next.name} · ${next.rollover}`} chipTone="ember" delay={0.15} />
      </div>

      <Reveal delay={0.1}>
        <Card className="mt-4 p-4 sm:p-6">
          <DataTable columns={cols} rows={funds} dense rowKey={(f) => f.id} onRowClick={(f) => setSel(f.id)} search={(f) => `${f.name} ${f.manager} ${f.id}`} searchPlaceholder="Fund, manager…" exportName="pamm-funds" />
        </Card>
      </Reveal>

      <Reveal delay={0.15}>
        <Card className="mt-4">
          <CardHeader
            title="Deposit & withdrawal queue"
            subtitle={`${pending.length} pending · executes at each fund's next rollover NAV`}
            action={<Segmented size="xs" value={kind} onChange={setKind} options={[{ value: "all", label: "All" }, { value: "deposit", label: "Deposits" }, { value: "withdrawal", label: "Withdrawals" }]} />}
          />
          <div className="grid grid-cols-1 gap-2 px-4 pb-5 pt-4 sm:px-6 xl:grid-cols-2">
            {queue.map((r) => (
              <RequestRow key={r.id} r={r} onDecide={decide} />
            ))}
          </div>
        </Card>
      </Reveal>

      <FundDrawer f={fund} open={!!fund} onOpenChange={(o) => !o && setSel(null)} onChange={(n) => setFunds((fs) => fs.map((x) => (x.id === n.id ? n : x)))} requests={reqs} onDecide={decide} onStop={stopFund} />
      <EmergencyStopDialog
        target={stop}
        open={!!stop}
        onOpenChange={(o) => !o && setStop(null)}
        onConfirm={() => setFunds((fs) => fs.map((x) => (x.id === stop?.id ? { ...x, status: "paused" } : x)))}
      />
      {reason.node}
    </div>
  );
}

export default function PammPage() {
  return IS_DEMO ? <DemoPammPage /> : <LivePammPage />;
}
