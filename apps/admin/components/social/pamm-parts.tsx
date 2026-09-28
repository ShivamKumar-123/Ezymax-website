"use client";

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, Check, OctagonAlert, PauseCircle, PlayCircle, RefreshCw, X } from "lucide-react";
import { Avatar, Button, Chip, Dialog, Delta, EquityChart, Flag, Money, Segmented, StatusChip, cn } from "@kalks/ui";
import { navSeries, type PammFund, type PammRequest } from "@kalks/mock/admin-partners";
import { MiniStat, Section, auditToast, useReason } from "@/components/config/kit";
import { fmtDT, ago } from "@/components/partners/common";
import { STATUS_LABEL } from "./common";

const START = Date.parse("2026-09-24T14:32:00+03:00");

/** Ticking countdown that starts from the fixed mock clock (SSR-safe). */
export function useClock() {
  const [now, setNow] = React.useState(START);
  React.useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setNow(START + (Date.now() - t0)), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function Countdown({ to, now, className }: { to: string; now: number; className?: string }) {
  const s = Math.max(0, Math.floor((Date.parse(to) - now) / 1000));
  const d = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <span className={cn("k-num font-mono", className)}>
      {d > 0 && <>{d}d </>}
      {hh}:{mm}:{ss}
    </span>
  );
}

export function RequestRow({ r, onDecide, compact }: { r: PammRequest; onDecide: (r: PammRequest, ok: boolean) => void; compact?: boolean }) {
  const dep = r.kind === "deposit";
  return (
    <div className={cn("k-row flex items-center gap-3 px-3.5 py-2.5", r.status !== "pending" && "opacity-55")}>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", dep ? "bg-up-soft text-up" : "bg-down-soft text-down")}>{dep ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}</span>
      <Avatar src={r.photo} name={r.investor} size={28} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 truncate text-[13px] font-medium">
          {r.investor}
          <Flag country={r.country} className="size-3.5" />
        </div>
        <div className="truncate text-[11.5px] text-fg-3">
          {!compact && <>{r.fund} · </>}
          <span className="font-mono">{r.id}</span> · {ago(r.created)}
          {r.note && <span className="text-warn"> · {r.note}</span>}
        </div>
      </div>
      <div className="text-right">
        <Money value={dep ? r.amount : -r.amount} decimals={0} countUp={false} tone={dep ? "up" : "down"} signed className="text-[13px] font-medium" />
        <div className="k-num text-[11px] text-fg-3">{r.units.toLocaleString()} units</div>
      </div>
      {r.status === "pending" ? (
        <span className="flex gap-1">
          <button type="button" onClick={() => onDecide(r, false)} className="grid size-7 place-items-center rounded-full border border-line text-fg-3 hover:border-down/40 hover:bg-down-soft hover:text-down" aria-label="Reject">
            <X className="size-3.5" />
          </button>
          <button type="button" onClick={() => onDecide(r, true)} className="grid size-7 place-items-center rounded-full border border-up/40 bg-up-soft text-up hover:bg-up/20" aria-label="Approve">
            <Check className="size-3.5" />
          </button>
        </span>
      ) : (
        <StatusChip status={r.status} />
      )}
    </div>
  );
}

const RANGES = { "1M": 30, "3M": 90, "6M": 180 } as const;

export function FundDrawer({ f, open, onOpenChange, onChange, requests, onDecide, onStop }: { f: PammFund | null; open: boolean; onOpenChange: (o: boolean) => void; onChange: (f: PammFund) => void; requests: PammRequest[]; onDecide: (r: PammRequest, ok: boolean) => void; onStop: (f: PammFund) => void }) {
  const reason = useReason();
  const now = useClock();
  const [range, setRange] = React.useState<keyof typeof RANGES>("6M");
  const all = React.useMemo(() => (f ? navSeries(f.id, 180) : []), [f]);
  if (!f) return null;
  const data = all.slice(-RANGES[range]);
  const reqs = requests.filter((r) => r.fundId === f.id);
  const inflow = reqs.filter((r) => r.status === "pending" && r.kind === "deposit").reduce((s, r) => s + r.amount, 0);
  const outflow = reqs.filter((r) => r.status === "pending" && r.kind === "withdrawal").reduce((s, r) => s + r.amount, 0);
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        side="right"
        title={
          <span className="flex items-center gap-3">
            <Avatar src={f.photo} name={f.manager} size={44} />
            <span>
              <span className="flex items-center gap-2">{f.name}<StatusChip status={f.status} label={STATUS_LABEL[f.status]} /></span>
              <span className="block text-[12px] font-normal text-fg-3">
                Managed by {f.manager} · <span className="font-mono">{f.id}</span>
              </span>
            </span>
          </span>
        }
        footer={
          <div className="flex w-full flex-wrap items-center gap-2">
            <Button
              variant="surface"
              size="sm"
              onClick={() => reason.ask({ title: `Force rollover · ${f.name}`, description: "Recalculates NAV, charges fees above HWM and executes all approved requests now.", reasons: ["Month-end alignment", "Manager request", "Recovery after incident"], confirmLabel: "Run rollover", onConfirm: (r) => auditToast(`Rollover executed for ${f.name}`, r) })}
            >
              <RefreshCw /> Force rollover
            </Button>
            {f.status === "paused" ? (
              <Button variant="up-outline" size="sm" onClick={() => reason.ask({ title: `Resume ${f.name}`, reasons: ["Incident resolved", "Manager remediated"], confirmLabel: "Resume", tone: "buy", onConfirm: (r) => { onChange({ ...f, status: "active" }); auditToast(`${f.name} resumed`, r); } })}>
                <PlayCircle /> Resume
              </Button>
            ) : (
              <Button variant="surface" size="sm" onClick={() => reason.ask({ title: `Pause ${f.name}`, description: "Blocks new deposits; the manager can keep trading existing capital.", reasons: ["Drawdown review", "Manager on leave", "Compliance review"], confirmLabel: "Pause fund", tone: "sell", onConfirm: (r) => { onChange({ ...f, status: "paused" }); auditToast(`${f.name} paused`, r); } })}>
                <PauseCircle /> Pause
              </Button>
            )}
            <span className="flex-1" />
            <Button variant="sell" size="sm" onClick={() => onStop(f)}>
              <OctagonAlert /> Emergency stop
            </Button>
          </div>
        }
      >
        <Section title="NAV per unit" action={<Segmented size="xs" value={range} onChange={setRange} options={["1M", "3M", "6M"] as const} />}>
          <div className="flex items-baseline gap-3">
            <span className="k-num text-[28px] font-semibold tracking-tight">{f.nav.toFixed(4)}</span>
            <Delta value={f.navChange30d} chip />
            <span className="text-[12px] text-fg-3">HWM {f.hwm.toFixed(4)}</span>
          </div>
          <div className="-mx-2 mt-2">
            <EquityChart data={data} height={210} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <MiniStat label="AUM" value={<Money value={f.aum} decimals={0} countUp={false} />} />
            <MiniStat label="Units outstanding" value={f.units.toLocaleString()} />
            <MiniStat label="Investors" value={f.investors} />
            <MiniStat label="Return 12m" value={<Delta value={f.return12m} decimals={1} />} />
            <MiniStat label="Max drawdown" value={`${f.maxDD}%`} tone={f.maxDD > 20 ? "warn" : undefined} />
            <MiniStat label="Manager capital" value={<Money value={f.managerCapital} decimals={0} countUp={false} />} sub={`${((f.managerCapital / f.aum) * 100).toFixed(1)}% skin in the game`} />
          </div>
        </Section>
        <Section title="Rollover" hint={`${f.rollover} · requests execute at the NAV of the next rollover`}>
          <div className="grid grid-cols-2 gap-2.5">
            <MiniStat label="Next rollover" value={<Countdown to={f.nextRollover} now={now} />} sub={`${fmtDT(f.nextRollover)} GMT+3`} tone="ember" />
            <MiniStat label="Net flow queued" value={<Money value={inflow - outflow} decimals={0} signed countUp={false} tone="auto" />} sub={<>In ${inflow.toLocaleString()} · out ${outflow.toLocaleString()}</>} />
            <MiniStat label="Fees" value={`${f.perfFee}% perf · ${f.mgmtFee}% mgmt`} sub="High-water mark applied" />
            <MiniStat label="Min / lock-up" value={`$${f.minInvestment} · ${f.lockupDays ? `${f.lockupDays}d` : "none"}`} />
          </div>
        </Section>
        <Section title="Pending requests" hint={reqs.length ? `${reqs.filter((r) => r.status === "pending").length} awaiting approval` : "Nothing queued"}>
          <div className="space-y-2">
            {reqs.map((r) => (
              <RequestRow key={r.id} r={r} onDecide={onDecide} compact />
            ))}
            {reqs.length === 0 && <Chip>No requests for the next rollover</Chip>}
          </div>
        </Section>
      </Dialog>
      {reason.node}
    </>
  );
}
