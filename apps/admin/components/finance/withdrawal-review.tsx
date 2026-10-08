"use client";

import * as React from "react";
import { AlertTriangle, Check, Fingerprint, MapPin, MonitorSmartphone, ShieldAlert, X } from "lucide-react";
import { Avatar, Button, Chip, Dialog, Flag, Money, StatusChip, cn } from "@ezymex/ui";
import { FIN_WITHDRAW_REASONS, finAgo, finTime, type FinCheck, type FinWithdrawal } from "@ezymex/mock/admin-finance";
import { Addr, MiniStat, RiskScore, Section, TxHash, auditToast, useReason } from "@/components/config/kit";
import { CHECK_META, NetworkChip, usd } from "./shared";

export function checkDetail(w: FinWithdrawal, key: keyof FinWithdrawal["checks"]): string {
  switch (key) {
    case "kyc":
      return w.client.kycLevel >= 2 ? `Level ${w.client.kycLevel} verified · ID + proof of address` : `Level ${w.client.kycLevel} only — withdrawals require Level 2`;
    case "bonus":
      return w.checks.bonus === "ok" ? "No active bonus or turnover met" : "Active $500 welcome bonus · turnover 38% of 20 lots";
    case "recentDeposit":
      return w.lastDepositHoursAgo < 24 ? `Deposit ${Math.round(w.lastDepositHoursAgo)}h ago — minimal trading since` : `Last deposit ${Math.round(w.lastDepositHoursAgo / 24)} days ago`;
    case "ipMatch":
      return w.checks.ipMatch === "ok" ? `Same IP & device as last 5 logins (${w.ip})` : w.checks.ipMatch === "warn" ? `New device · ${w.device}` : `IP ${w.ip} differs from registration country · VPN suspected`;
    case "pnl":
      return w.checks.pnl === "ok" ? `P&L ${usd(w.pnl)} consistent with history` : `Profit ${usd(w.pnl)} in 6 days — 91% from 3 trades at news`;
  }
}

function CheckLine({ state, label, detail }: { state: FinCheck; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border", state === "ok" ? "border-up/25 bg-up-soft text-up" : state === "warn" ? "border-warn/30 bg-warn-soft text-warn" : "border-down/30 bg-down-soft text-down")}>
        {state === "ok" ? <Check className="size-3.5" strokeWidth={3} /> : state === "warn" ? <AlertTriangle className="size-3.5" /> : <X className="size-3.5" strokeWidth={3} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-[13.5px] font-medium">
          {label}
          <span className={cn("text-[11px] font-medium uppercase tracking-wider", state === "ok" ? "text-up" : state === "warn" ? "text-warn" : "text-down")}>{state === "ok" ? "Pass" : state === "warn" ? "Review" : "Fail"}</span>
        </div>
        <div className="mt-0.5 text-[12px] text-fg-3">{detail}</div>
      </div>
    </div>
  );
}

export function WithdrawalReview({
  w,
  onOpenChange,
  onDecision,
}: {
  w: FinWithdrawal | null;
  onOpenChange: (o: boolean) => void;
  onDecision: (w: FinWithdrawal, decision: "approved" | "rejected", reason: string) => void;
}) {
  const reason = useReason();
  const decide = (d: "approved" | "rejected") => {
    if (!w) return;
    reason.ask({
      title: d === "approved" ? `Approve ${w.id}` : `Reject ${w.id}`,
      description: `${usd(w.amount)} USDT to ${w.client.person.name} · ${w.address.slice(0, 8)}…${w.address.slice(-6)}`,
      reasons: d === "approved" ? FIN_WITHDRAW_REASONS.approve : FIN_WITHDRAW_REASONS.reject,
      confirmLabel: d === "approved" ? "Approve withdrawal" : "Reject withdrawal",
      tone: d === "approved" ? "buy" : "sell",
      onConfirm: (r) => {
        onDecision(w, d, r);
        onOpenChange(false);
        auditToast(d === "approved" ? `${w.id} approved · queued for next batch` : `${w.id} rejected · funds returned to wallet`, r);
      },
    });
  };
  const failing = w ? Object.values(w.checks).filter((c) => c !== "ok").length : 0;

  return (
    <>
      <Dialog
        open={!!w}
        onOpenChange={onOpenChange}
        side="right"
        title={w ? `Withdrawal ${w.id}` : ""}
        description={w ? `Requested ${finTime(w.minutesAgo)} · ${finAgo(w.minutesAgo)} · from ${w.source}` : undefined}
        footer={
          w?.status === "pending" ? (
            <>
              <Button variant="down-outline" size="sm" onClick={() => decide("rejected")}>
                <X /> Reject
              </Button>
              <Button variant="buy" size="sm" onClick={() => decide("approved")}>
                <Check /> Approve
              </Button>
            </>
          ) : w ? (
            <Button variant="surface" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          ) : null
        }
      >
        {w && (
          <div>
            <Section title="Client">
              <div className="flex items-center gap-3">
                <Avatar src={w.client.person.photo} name={w.client.person.name} size={48} verified={w.client.kycLevel >= 2} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[16px] font-medium">
                    {w.client.person.name}
                    <Flag country={w.client.person.country} className="size-4" />
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-fg-3">
                    <span className="font-mono">{w.client.login}</span>·<span>{w.client.group}</span>
                  </div>
                </div>
                <Chip tone={w.client.kycLevel >= 2 ? "up" : "down"}>KYC L{w.client.kycLevel}</Chip>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MiniStat label="Lifetime deposits" value={usd(w.lifetimeDeposits)} />
                <MiniStat label="Lifetime withdrawals" value={usd(w.lifetimeWithdrawals)} />
                <MiniStat label="Trading P&L" value={`${w.pnl >= 0 ? "+" : ""}${usd(w.pnl)}`} tone={w.pnl >= 0 ? "up" : "down"} />
                <MiniStat label="Net deposits" value={usd(w.lifetimeDeposits - w.lifetimeWithdrawals)} />
              </div>
            </Section>

            <Section title="Request" action={<StatusChip status={w.status === "sent" ? "completed" : w.status} label={w.status === "sent" ? "Sent" : undefined} />}>
              <div className="k-row flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-fg-3">Amount</div>
                  <Money value={w.amount} currency="" className="mt-1 block text-[26px] font-semibold" />
                  <div className="mt-0.5 text-[12px] text-fg-3">
                    USDT · fee {w.fee.toFixed(2)} · client receives <span className="k-num text-fg-2">{usd(w.amount - w.fee)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <NetworkChip network={w.network} />
                  <RiskScore score={w.risk} />
                </div>
              </div>
              {w.hash && (
                <div className="mt-2 flex items-center justify-between rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-[12.5px]">
                  <span className="text-fg-3">Broadcast tx · approved by {w.approvedBy}</span>
                  <TxHash hash={w.hash} />
                </div>
              )}
              {w.rejectReason && (
                <div className="mt-2 rounded-[12px] border border-down/25 bg-down-soft px-3 py-2 text-[12.5px] text-down">Rejected · {w.rejectReason}</div>
              )}
            </Section>

            <Section title="Risk checklist" hint={failing ? `${failing} item${failing > 1 ? "s" : ""} need attention` : "All automated checks passed"}>
              <div className="divide-y divide-line">
                {(Object.keys(w.checks) as (keyof FinWithdrawal["checks"])[]).map((k) => (
                  <CheckLine key={k} state={w.checks[k]} label={CHECK_META[k]!} detail={checkDetail(w, k)} />
                ))}
              </div>
            </Section>

            <Section title="Destination address">
              <div className="k-row p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <Addr value={w.address} head={10} tail={8} className="text-[12.5px]" />
                  <Chip size="sm" tone={w.addressHistory[0]?.whitelisted ? "up" : "warn"}>{w.addressHistory[0]?.whitelisted ? "Whitelisted" : "New address"}</Chip>
                </div>
                {w.addressReuse > 0 ? (
                  <div className="mt-3 flex items-start gap-2 rounded-[10px] border border-down/25 bg-down-soft px-3 py-2 text-[12.5px] text-down">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                    <span>
                      Address also used by <b>{w.addressReuse} other account{w.addressReuse > 1 ? "s" : ""}</b> (logins {Array.from({ length: w.addressReuse }, (_, i) => String(80_512_004 + i * 3_117 + w.client.login.length * 7)).join(", ")}). Possible multi-accounting.
                    </span>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2 text-[12px] text-up">
                    <Check className="size-3.5" /> Address-reuse check: not linked to any other account
                  </div>
                )}
              </div>
              <div className="mt-3 text-[11px] uppercase tracking-wider text-fg-3">Address history</div>
              <div className="mt-2 space-y-1.5">
                {w.addressHistory.map((a) => (
                  <div key={a.address} className="flex items-center justify-between gap-3 rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[12px]">
                    <Addr value={a.address} head={8} tail={6} />
                    <span className="text-fg-3">
                      {a.uses} withdrawal{a.uses > 1 ? "s" : ""} · last {finAgo(a.lastMinutesAgo)}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Session">
              <div className="grid grid-cols-1 gap-2 text-[12.5px] sm:grid-cols-3">
                <div className="k-row flex items-center gap-2 px-3 py-2.5"><MapPin className="size-4 text-fg-3" /><span className="font-mono">{w.ip}</span></div>
                <div className="k-row flex items-center gap-2 px-3 py-2.5 sm:col-span-2"><MonitorSmartphone className="size-4 text-fg-3" />{w.device}</div>
                <div className="k-row flex items-center gap-2 px-3 py-2.5 sm:col-span-3"><Fingerprint className="size-4 text-fg-3" />2FA confirmed by client via authenticator app · {finTime(w.minutesAgo, "time")}</div>
              </div>
            </Section>
          </div>
        )}
      </Dialog>
      {reason.node}
    </>
  );
}
