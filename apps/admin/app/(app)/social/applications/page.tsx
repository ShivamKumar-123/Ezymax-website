"use client";

import * as React from "react";
import Link from "next/link";
import { Check, CheckCircle2, Download, MessageSquare, Settings2, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, CopyButton, Delta, EquityChart, Flag, Money, PageHeader, Reveal, Segmented, StatusChip, SymbolAvatar, cn } from "@kalks/ui";
import { APPLICATIONS, SOCIAL_SETTINGS, type MasterApplication } from "@kalks/mock/admin-partners";
import { MiniStat, SegBar, auditToast, useReason } from "@/components/config/kit";
import { ago, fmtDT } from "@/components/partners/common";
import { TypeChip } from "@/components/social/common";
import { equityPoints } from "@/components/social/master-drawer";
import { IS_DEMO } from "@kalks/mock/mode";
import { LiveApplicationsPage } from "@/components/social-live/applications";

function checks(a: MasterApplication) {
  const L = SOCIAL_SETTINGS.leaderboard;
  return [
    { label: "KYC verified", ok: a.kyc, value: a.kyc ? "Level 2 · verified" : "Pending proof of address" },
    { label: `${L.minDays}+ days track record`, ok: a.trackDays >= L.minDays, value: `${a.trackDays} days` },
    { label: `Min equity $${L.minEquity.toLocaleString()}`, ok: a.equity >= L.minEquity, value: `$${a.equity.toLocaleString()}` },
    { label: `Max drawdown < ${L.maxDD}%`, ok: a.maxDD < L.maxDD, value: `${a.maxDD}%` },
    { label: `Min ${L.minTrades} trades`, ok: a.trades >= L.minTrades, value: a.trades.toLocaleString() },
    { label: "No violations", ok: a.violations === 0, value: a.violations ? `${a.violations} flagged (martingale / arbitrage)` : "Clean history" },
  ];
}

const passCount = (a: MasterApplication) => checks(a).filter((c) => c.ok).length;

function Detail({ a, onDecide }: { a: MasterApplication; onDecide: (a: MasterApplication, s: MasterApplication["status"]) => void }) {
  const reason = useReason();
  const list = checks(a);
  const pass = list.filter((c) => c.ok).length;
  const allOk = pass === list.length;
  const data = React.useMemo(() => equityPoints(a.equityCurve, a.equity), [a]);
  const feeOk = a.requestedPerfFee <= SOCIAL_SETTINGS.perfFeeMax && a.requestedMgmtFee <= SOCIAL_SETTINGS.mgmtFeeMax;
  const decided = a.status === "approved" || a.status === "rejected";
  return (
    <Card className="h-full">
      <div className="flex flex-col gap-4 border-b border-line px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <Avatar src={a.photo} name={a.name} size={52} verified={a.kyc} />
          <div>
            <div className="flex items-center gap-2 text-[18px] font-medium tracking-tight">
              {a.strategy}
              <TypeChip type={a.type} />
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-fg-3">
              {a.name} <Flag country={a.country} className="size-3.5" /> · <span className="font-mono">{a.login}</span>
              <CopyButton value={a.login} label="Login" /> · submitted {fmtDT(a.submitted)}
            </div>
          </div>
        </div>
        <StatusChip status={a.status} />
      </div>
      <div className="grid grid-cols-1 gap-6 px-6 py-5 lg:grid-cols-2">
        <div>
          <div className="k-label mb-2">Strategy</div>
          <p className="text-[13.5px] leading-relaxed text-fg-2">{a.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {a.instruments.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-0.5 pl-1 pr-2.5 text-[12px]">
                <SymbolAvatar symbol={s} size={16} />
                {s}
              </span>
            ))}
          </div>
          <div className="-mx-2 mt-3">
            <EquityChart data={data} height={170} color={a.return90d >= 0 ? "gold" : "down"} showVolume={false} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniStat label="Return 90d" value={<Delta value={a.return90d} decimals={1} />} />
            <MiniStat label="Equity" value={<Money value={a.equity} decimals={0} countUp={false} />} />
            <MiniStat label="Fees asked" value={`${a.requestedPerfFee}%${a.requestedMgmtFee ? ` + ${a.requestedMgmtFee}%` : ""}`} tone={feeOk ? undefined : "down"} sub={feeOk ? "Within caps" : "Exceeds caps"} />
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="k-label">Requirements</span>
            <span className={cn("k-num text-[12px] font-medium", allOk ? "text-up" : "text-warn")}>{pass} / {list.length} passed</span>
          </div>
          <SegBar value={pass} total={list.length} tone={allOk ? "up" : pass >= 4 ? "warn" : "down"} className="mb-3" />
          <div className="space-y-1.5">
            {list.map((c) => (
              <div key={c.label} className={cn("flex items-center gap-3 rounded-[12px] border px-3.5 py-2.5", c.ok ? "border-line bg-surface-2" : "border-down/30 bg-down-soft")}>
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", c.ok ? "bg-up-soft text-up" : "bg-down/20 text-down")}>{c.ok ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}</span>
                <span className="flex-1 text-[13px] text-fg">{c.label}</span>
                <span className={cn("k-num text-[12px]", c.ok ? "text-fg-3" : "text-down")}>{c.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button
              variant={allOk ? "buy" : "surface"}
              size="sm"
              disabled={decided}
              onClick={() =>
                reason.ask({
                  title: allOk ? `Approve ${a.strategy}` : `Approve ${a.strategy} with exception`,
                  description: allOk ? "Master profile goes live and becomes eligible for the leaderboard." : `${list.length - pass} requirement(s) failed. An exception is logged and the master stays hidden from the leaderboard.`,
                  reasons: allOk ? ["All requirements met", "Manual review passed"] : ["Exception — strong verified track record elsewhere", "Exception — institutional manager", "Exception — management decision"],
                  confirmLabel: "Approve",
                  tone: "buy",
                  onConfirm: (r) => {
                    onDecide(a, "approved");
                    auditToast(`${a.strategy} approved`, r);
                  },
                })
              }
            >
              <CheckCircle2 /> {allOk ? "Approve" : "Approve with exception"}
            </Button>
            <Button
              variant="down-outline"
              size="sm"
              disabled={decided}
              onClick={() =>
                reason.ask({
                  title: `Reject ${a.strategy}`,
                  description: "Applicant is notified and may re-apply after 30 days.",
                  reasons: [...list.filter((c) => !c.ok).map((c) => `Failed: ${c.label}`), "Strategy not suitable for retail followers", "Incomplete application"],
                  confirmLabel: "Reject",
                  tone: "sell",
                  onConfirm: (r) => {
                    onDecide(a, "rejected");
                    auditToast(`${a.strategy} rejected`, r);
                  },
                })
              }
            >
              <XCircle /> Reject
            </Button>
            <Button variant="ghost" size="sm" disabled={decided} onClick={() => { onDecide(a, "review"); toast.success(`Info requested from ${a.name}`, { description: "Application moved to In review" }); }}>
              <MessageSquare /> Request info
            </Button>
          </div>
        </div>
      </div>
      {reason.node}
    </Card>
  );
}

function DemoApplicationsPage() {
  const [rows, setRows] = React.useState(APPLICATIONS);
  const [sel, setSel] = React.useState(APPLICATIONS[0]!.id);
  const [tab, setTab] = React.useState<"open" | "decided">("open");
  const open = (a: MasterApplication) => a.status === "pending" || a.status === "review";
  const view = rows.filter((a) => (tab === "open" ? open(a) : !open(a)));
  const a = rows.find((x) => x.id === sel) ?? rows[0]!;
  const decide = (x: MasterApplication, s: MasterApplication["status"]) => setRows((rs) => rs.map((r) => (r.id === x.id ? { ...r, status: s } : r)));

  return (
    <div className="pb-16">
      <PageHeader
        title="Master applications"
        subtitle="Traders applying to become copy, PAMM or signal masters"
        actions={
          <>
            <Link href="/social/settings">
              <Button variant="surface"><Settings2 /> Eligibility rules</Button>
            </Link>
            <Button variant="surface" onClick={() => toast.success("applications.csv exported", { description: `${rows.length} applications` })}>
              <Download /> Export
            </Button>
          </>
        }
      />
      <Reveal>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat label="Awaiting decision" value={rows.filter(open).length} sub={`${rows.filter((r) => open(r) && passCount(r) === 6).length} pass all checks`} />
          <MiniStat label="Median review time" value="6h 40m" sub="SLA 24h" />
          <MiniStat label="Approval rate · 30d" value="61.8%" sub="34 of 55 applications" tone="up" />
          <MiniStat label="Auto-rejected · 30d" value="112" sub="Failed hard requirements" />
        </div>
      </Reveal>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-4">
          <Card className="flex h-full flex-col">
            <CardHeader title="Queue" action={<Segmented size="xs" value={tab} onChange={setTab} options={[{ value: "open", label: `Open ${rows.filter(open).length}` }, { value: "decided", label: "Decided" }]} />} />
            <div className="mt-4 flex-1 space-y-2 px-4 pb-5 sm:px-6">
              {view.map((x) => {
                const p = passCount(x);
                return (
                  <button key={x.id} type="button" onClick={() => setSel(x.id)} className={cn("k-row flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-3/60", x.id === a.id && "border-ember/40 bg-ember-soft/40")}>
                    <Avatar src={x.photo} name={x.name} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate text-[13px] font-medium">{x.strategy}</div>
                      <div className="truncate text-[11.5px] text-fg-3">{x.name} · {ago(x.submitted)}</div>
                      <SegBar value={p} total={6} tone={p === 6 ? "up" : p >= 4 ? "warn" : "down"} className="mt-1.5 w-24" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <TypeChip type={x.type} />
                      {x.status === "review" ? <Chip size="sm" tone="warn">Info req.</Chip> : x.status !== "pending" ? <StatusChip status={x.status} /> : <span className="k-num text-[11px] text-fg-3">{p}/6</span>}
                    </div>
                  </button>
                );
              })}
              {view.length === 0 && <div className="py-10 text-center text-[13px] text-fg-3">No applications here.</div>}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="xl:col-span-8">
          <Detail key={a.id} a={a} onDecide={decide} />
        </Reveal>
      </div>
    </div>
  );
}

export default function ApplicationsPage() {
  return IS_DEMO ? <DemoApplicationsPage /> : <LiveApplicationsPage />;
}
