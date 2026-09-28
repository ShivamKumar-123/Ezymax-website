"use client";

import * as React from "react";
import { ArrowUpCircle, Ban, Pause, Percent, Play } from "lucide-react";
import { Button, Chip, CopyButton, Dialog, EquityChart, Menu, Progress, StatusChip, cn } from "@kalks/ui";
import { MiniStat, PersonCell, SegBar, Slider, auditToast, type useReason } from "@/components/config/kit";
import { PAYOUTS, TODAY, equityPath, fmtDate, planById, type FundedAccount } from "./data";

export const FUNDED_STATUS: Record<FundedAccount["status"], { status: string; label: string }> = {
  active: { status: "active", label: "Active" },
  paused: { status: "paused", label: "Paused" },
  review: { status: "review", label: "In review" },
};

export function eligibility(a: FundedAccount) {
  const d = Math.ceil((a.eligibleOn - TODAY) / 86400);
  return d <= 0 ? { now: true, text: "Eligible now" } : { now: false, text: `in ${d}d · ${fmtDate(a.eligibleOn, false)}` };
}

function SplitBody({ valueRef, min, max }: { valueRef: React.MutableRefObject<number>; min: number; max: number }) {
  const [v, setV] = React.useState(valueRef.current);
  return (
    <div className="rounded-[12px] border border-line bg-surface-2 px-4 py-3">
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-fg-2">New trader split</span>
        <span className="k-num font-semibold text-gold">{v}%</span>
      </div>
      <Slider
        className="mt-2"
        value={v}
        min={min}
        max={max}
        step={5}
        onChange={(n) => {
          setV(n);
          valueRef.current = n;
        }}
      />
    </div>
  );
}

export function FundedDrawer({ a, open, onOpenChange, reason, onUpdate }: { a: FundedAccount | null; open: boolean; onOpenChange: (o: boolean) => void; reason: ReturnType<typeof useReason>; onUpdate: (a: FundedAccount) => void }) {
  const split = React.useRef(80);
  if (!a) return null;
  const plan = planById(a.planId);
  const days = Math.max(20, Math.round((TODAY - a.fundedOn) / 86400) % 60);
  const data = equityPath(a.login, a.size, a.size + a.profit, days, TODAY - days * 86400);
  const history = PAYOUTS.filter((p) => p.account.id === a.id);
  const el = eligibility(a);
  const nextSize = Math.round(a.size * (1 + plan.scalingIncrease / 100));
  const scaleProgress = Math.min(100, Math.max(0, (a.profitPct / plan.scalingProfit) * 100));

  const scale = () =>
    reason.ask({
      title: `Scale #${a.login} to $${nextSize.toLocaleString()}`,
      description: `Level ${a.scalingLevel} → ${a.scalingLevel + 1}. Balance +${plan.scalingIncrease}%, split +5% (max ${plan.splitMax}%).`,
      reasons: ["Scaling criteria met", "Early scaling (management)", "Retention offer"],
      confirmLabel: "Scale account",
      tone: "buy",
      onConfirm: (r) => {
        onUpdate({ ...a, size: nextSize, scalingLevel: a.scalingLevel + 1, split: Math.min(plan.splitMax, a.split + 5) });
        auditToast(`#${a.login} scaled to $${nextSize.toLocaleString()}`, r);
      },
    });
  const adjustSplit = () => {
    split.current = a.split;
    reason.ask({
      title: `Adjust profit split · #${a.login}`,
      description: `Current split ${a.split}%. Applies from the next payout cycle.`,
      reasons: ["Retention offer", "VIP programme", "Correction", "Contract amendment"],
      confirmLabel: "Update split",
      body: <SplitBody valueRef={split} min={50} max={100} />,
      onConfirm: (r) => {
        onUpdate({ ...a, split: split.current });
        auditToast(`#${a.login} split set to ${split.current}%`, r);
      },
    });
  };
  const pause = () =>
    reason.ask({
      title: `${a.status === "paused" ? "Resume" : "Pause"} trading · #${a.login}`,
      description: a.status === "paused" ? "Trader regains trading access." : "Open positions stay; new orders are rejected until resumed.",
      reasons: a.status === "paused" ? ["Review completed", "KYC updated"] : ["Under investigation", "KYC expired", "Trader request", "Payment dispute"],
      confirmLabel: a.status === "paused" ? "Resume" : "Pause trading",
      tone: a.status === "paused" ? "ember" : "sell",
      onConfirm: (r) => {
        onUpdate({ ...a, status: a.status === "paused" ? "active" : "paused" });
        auditToast(`#${a.login} ${a.status === "paused" ? "resumed" : "paused"}`, r);
      },
    });
  const revoke = () =>
    reason.ask({
      title: `Revoke funded account · #${a.login}`,
      description: "Account is closed, pending payouts are cancelled and the trader is notified.",
      reasons: ["Banned strategy confirmed", "Account sharing / pass service", "Hard breach", "Fraud / chargeback"],
      confirmLabel: "Revoke",
      tone: "sell",
      onConfirm: (r) => {
        onUpdate({ ...a, status: "paused" });
        auditToast(`#${a.login} revoked`, r);
      },
    });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      title={
        <span className="flex items-center gap-2">
          Funded <span className="font-mono text-fg-2">#{a.login}</span>
          <CopyButton value={a.login} label="Login" />
        </span>
      }
      description={`${a.id} · ${a.planName} · simulated account since ${fmtDate(a.fundedOn)}`}
      footer={
        <>
          <Menu
            align="start"
            trigger={
              <Button size="sm" variant="ghost" className="mr-auto">
                More
              </Button>
            }
            items={[
              { label: a.status === "paused" ? "Resume trading" : "Pause trading", icon: a.status === "paused" ? <Play /> : <Pause />, onSelect: pause },
              "sep",
              { label: "Revoke account", icon: <Ban />, danger: true, onSelect: revoke },
            ]}
          />
          <Button size="sm" variant="surface" onClick={adjustSplit}>
            <Percent /> Adjust split
          </Button>
          <Button size="sm" variant="ember" onClick={scale}>
            <ArrowUpCircle /> Scale up
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <PersonCell name={a.trader.name} photo={a.trader.photo} country={a.trader.country} sub={a.trader.email} size={40} verified={a.kyc} />
          <StatusChip status={FUNDED_STATUS[a.status].status} label={FUNDED_STATUS[a.status].label} />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat label="Account size" value={`$${a.size.toLocaleString()}`} sub={a.size !== a.initialSize ? `from $${a.initialSize.toLocaleString()}` : "initial"} />
          <MiniStat label="Cycle profit" value={`${a.profit >= 0 ? "+" : "-"}$${Math.abs(a.profit).toLocaleString("en-US", { maximumFractionDigits: 0 })}`} tone={a.profit >= 0 ? "up" : "down"} sub={`${a.profitPct.toFixed(2)}%`} />
          <MiniStat label="Split" value={`${a.split}%`} tone="gold" sub={`max ${plan.splitMax}%`} />
          <MiniStat label="Paid to date" value={`$${a.paidTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}`} sub={`${a.payouts} payouts`} />
        </div>

        <div className="k-row space-y-3 px-4 py-4">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium">Payout eligibility</span>
            <Chip size="sm" tone={el.now ? "up" : "neutral"}>
              {el.text}
            </Chip>
          </div>
          <div className="flex items-center justify-between text-[12px] text-fg-3">
            <span>Trader share if paid now</span>
            <span className="k-num text-fg">${Math.max(0, (a.profit * a.split) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between text-[12px] text-fg-3">
            <span>Drawdown used</span>
            <span className={cn("k-num", a.ddUsedPct > 70 ? "text-warn" : "text-fg")}>{a.ddUsedPct.toFixed(0)}%</span>
          </div>
          <Progress value={a.ddUsedPct} tone={a.ddUsedPct > 70 ? "warn" : "up"} />
        </div>

        <div className="k-row px-4 py-4">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium">Scaling plan</span>
            <span className="k-num text-fg-3">
              Level {a.scalingLevel} / 4 · next review {fmtDate(a.nextScaleOn)}
            </span>
          </div>
          <SegBar className="mt-3" value={a.scalingLevel + 1} total={5} tone="gold" />
          <div className="mt-3 flex items-center justify-between text-[12px] text-fg-3">
            <span>
              Profit toward +{plan.scalingIncrease}% (needs {plan.scalingProfit}%)
            </span>
            <span className="k-num text-fg">{scaleProgress.toFixed(0)}%</span>
          </div>
          <Progress className="mt-1.5" value={scaleProgress} tone="gold" />
        </div>

        <div className="k-row px-4 py-4">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium">Consistency score</span>
            <span className={cn("k-num font-semibold", a.consistency >= 70 ? "text-up" : a.consistency >= 50 ? "text-warn" : "text-down")}>{a.consistency} / 100</span>
          </div>
          <Progress className="mt-2" value={a.consistency} tone={a.consistency >= 70 ? "up" : a.consistency >= 50 ? "warn" : "down"} />
          <div className="mt-1.5 text-[11.5px] text-fg-3">Blends best-day share, lot-size variance and holding-time stability over the last 3 cycles.</div>
        </div>

        <div>
          <div className="k-label mb-1">Equity · current cycle</div>
          <EquityChart data={data} height={180} color={a.profit >= 0 ? "gold" : "down"} />
        </div>

        <div>
          <div className="k-label mb-2">Payout history</div>
          {history.length ? (
            <div className="space-y-1.5">
              {history.map((p) => (
                <div key={p.id} className="k-row flex items-center gap-3 px-3.5 py-2.5 text-[12.5px]">
                  <span className="font-mono text-fg-3">{p.id}</span>
                  <span className="flex-1 text-fg-3">{fmtDate(p.requested)}</span>
                  <span className="k-num font-medium">${p.traderShare.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                  <StatusChip status={p.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[12px] border border-dashed border-line px-3 py-3 text-center text-[12.5px] text-fg-3">No payouts requested yet</div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
