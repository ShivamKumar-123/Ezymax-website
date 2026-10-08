"use client";

import * as React from "react";
import { OctagonAlert } from "lucide-react";
import { Button, Chip, Dialog, Money, cn } from "@ezymex/ui";
import { Checkbox, MiniField, Select, TextArea, TextInput, auditToast } from "@/components/config/kit";

export function TypeChip({ type }: { type: "copy" | "pamm" | "signal" }) {
  return (
    <Chip size="sm" tone={type === "pamm" ? "gold" : type === "signal" ? "info" : "neutral"}>
      {type === "pamm" ? "PAMM" : type === "signal" ? "Signal" : "Copy"}
    </Chip>
  );
}

export const STATUS_LABEL: Record<string, string> = { suspended: "Suspended", review: "In review", paused: "Paused", active: "Active", killed: "Killed", throttled: "Throttled" };

export type StopTarget = {
  kind: "master" | "fund" | "strategy" | "key";
  id: string;
  name: string;
  followers: number;
  aum: number;
  openPositions: number;
};

export type StopOptions = { freezeSubs: boolean; closeAll: boolean; pauseSignal: boolean; freezeFunds: boolean; notify: boolean };

/** Guarded emergency stop — options, impact summary and typed confirmation. */
export function EmergencyStopDialog({ target, open, onOpenChange, onConfirm }: { target: StopTarget | null; open: boolean; onOpenChange: (o: boolean) => void; onConfirm?: (o: StopOptions) => void }) {
  const [o, setO] = React.useState<StopOptions>({ freezeSubs: true, closeAll: false, pauseSignal: true, freezeFunds: false, notify: true });
  const [reason, setReason] = React.useState("Abnormal drawdown");
  const [note, setNote] = React.useState("");
  const [typed, setTyped] = React.useState("");
  React.useEffect(() => {
    if (open) {
      setO({ freezeSubs: true, closeAll: false, pauseSignal: true, freezeFunds: target?.kind === "fund", notify: true });
      setTyped("");
      setNote("");
    }
  }, [open, target]);
  if (!target) return null;
  const opts: { k: keyof StopOptions; label: string; hint: string; danger?: boolean; show?: boolean }[] = [
    { k: "freezeSubs", label: "Freeze new subscriptions", hint: "No new followers or investors can join" },
    { k: "pauseSignal", label: "Pause signal", hint: "Stop copying new trades to followers" },
    { k: "closeAll", label: "Close all follower positions", hint: `Market-close ${target.openPositions.toLocaleString()} open positions at current prices`, danger: true },
    { k: "freezeFunds", label: "Freeze deposits & withdrawals", hint: "Hold all pending PAMM requests and skip next rollover", show: target.kind === "fund" || target.kind === "master" },
    { k: "notify", label: "Notify followers", hint: "Email + in-app notice with a neutral message" },
  ];
  const ok = typed.trim().toUpperCase() === "STOP";
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={560}
      title={
        <span className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-full border border-down/30 bg-down-soft text-down"><OctagonAlert className="size-4.5" /></span>
          Emergency stop · {target.name}
        </span>
      }
      description={`${target.kind === "fund" ? "PAMM fund" : target.kind === "strategy" ? "Strategy" : "Master"} ${target.id} · takes effect immediately on all trade servers`}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="sell"
            size="sm"
            disabled={!ok}
            onClick={() => {
              onConfirm?.(o);
              onOpenChange(false);
              const acts = [o.freezeSubs && "subscriptions frozen", o.pauseSignal && "signal paused", o.closeAll && `${target.openPositions} positions closed`, o.freezeFunds && "funds frozen"].filter(Boolean).join(" · ");
              auditToast(`Emergency stop executed on ${target.name}`, `${reason}${acts ? " — " + acts : ""}`);
            }}
          >
            Execute emergency stop
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="k-row px-3 py-2.5">
            <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Followers</div>
            <div className="k-num mt-0.5 text-[15px] font-medium">{target.followers.toLocaleString()}</div>
          </div>
          <div className="k-row px-3 py-2.5">
            <div className="text-[10.5px] uppercase tracking-wider text-fg-3">AUM affected</div>
            <Money value={target.aum} decimals={0} countUp={false} className="mt-0.5 block text-[15px] font-medium" />
          </div>
          <div className="k-row px-3 py-2.5">
            <div className="text-[10.5px] uppercase tracking-wider text-fg-3">Open positions</div>
            <div className="k-num mt-0.5 text-[15px] font-medium">{target.openPositions.toLocaleString()}</div>
          </div>
        </div>
        <div className="space-y-1.5">
          {opts
            .filter((x) => x.show !== false)
            .map((x) => (
              <div key={x.k} onClick={() => setO((s) => ({ ...s, [x.k]: !s[x.k] }))} className={cn("flex cursor-pointer items-start gap-3 rounded-[12px] border px-3.5 py-2.5 transition-colors", o[x.k] ? (x.danger ? "border-down/40 bg-down-soft" : "border-ember/30 bg-ember-soft/50") : "border-line bg-surface-2")}>
                <span className="pt-0.5"><Checkbox checked={o[x.k]} onChange={(v) => setO((s) => ({ ...s, [x.k]: v }))} label={x.label} /></span>
                <span>
                  <span className={cn("block text-[13px] font-medium", x.danger && "text-down")}>{x.label}</span>
                  <span className="block text-[11.5px] text-fg-3">{x.hint}</span>
                </span>
              </div>
            ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MiniField label="Reason code">
            <Select value={reason} onChange={setReason} options={["Abnormal drawdown", "Suspected account takeover", "Martingale / grid escalation", "Regulatory instruction", "Liquidity provider incident", "Master request"]} />
          </MiniField>
          <MiniField label='Type "STOP" to confirm'>
            <TextInput value={typed} onChange={setTyped} placeholder="STOP" mono className={ok ? "border-down/50" : undefined} />
          </MiniField>
        </div>
        <MiniField label="Internal note">
          <TextArea rows={2} value={note} onChange={setNote} placeholder="What triggered this stop?" />
        </MiniField>
      </div>
    </Dialog>
  );
}
