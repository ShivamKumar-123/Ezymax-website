"use client";

import * as React from "react";
import { Ban, Fingerprint, Globe, Home, Lock, Snowflake, Undo2, Wallet, XCircle, CreditCard } from "lucide-react";
import { Button, Chip, CopyButton, Dialog, Money, cn } from "@kalks/ui";
import { FRAUD_LABEL, type FraudFlag } from "@kalks/mock/admin-partners";
import { MiniStat, PersonCell, RiskScore, Section, auditToast, useReason } from "@/components/config/kit";
import { fmtDT, fmtTime } from "./common";

export const SEV_TONE = { critical: "down", high: "ember", medium: "warn", low: "neutral" } as const;
export const FRAUD_STATUS: Record<FraudFlag["status"], { tone: "down" | "warn" | "up" | "neutral"; label: string }> = {
  open: { tone: "down", label: "Open" },
  investigating: { tone: "warn", label: "Investigating" },
  resolved: { tone: "up", label: "Actioned" },
  dismissed: { tone: "neutral", label: "Dismissed" },
};

const KIND_ICON = { ip: Globe, device: Fingerprint, wallet: Wallet, card: CreditCard, address: Home } as const;

export function FraudDrawer({ flag, open, onOpenChange, onChange }: { flag: FraudFlag | null; open: boolean; onOpenChange: (o: boolean) => void; onChange: (f: FraudFlag) => void }) {
  const reason = useReason();
  if (!flag) return null;
  const f = flag;
  const act = (status: FraudFlag["status"], title: string, reasons: string[], confirmLabel: string, tone: "ember" | "sell" | "buy", toastTitle: string, description?: React.ReactNode) =>
    reason.ask({ title, description, reasons, confirmLabel, tone, onConfirm: (r) => { onChange({ ...f, status }); auditToast(toastTitle, r); } });
  const net = f.pairs.reduce((s, p) => s + p.pnlA + p.pnlB, 0);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        side="right"
        title={
          <span className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2">
              {FRAUD_LABEL[f.type]}
              <Chip size="sm" tone={SEV_TONE[f.severity]} dot>{f.severity}</Chip>
            </span>
            <span className="flex items-center gap-1.5 text-[12px] font-normal text-fg-3">
              <span className="font-mono">{f.id}</span>
              <CopyButton value={f.id} label="Case ID" />· detected {fmtDT(f.detected)} GMT+3
            </span>
          </span>
        }
        footer={
          <div className="flex w-full flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => act("dismissed", `Dismiss ${f.id}`, ["False positive — shared office network", "Family accounts, disclosed", "Legitimate hedging strategy", "Insufficient evidence"], "Dismiss case", "ember", `${f.id} dismissed`)}>
              <XCircle /> Dismiss
            </Button>
            <span className="flex-1" />
            <Button
              variant="surface"
              size="sm"
              onClick={() => act("investigating", `Freeze payouts for ${f.partnerName}`, ["Pending investigation", "Evidence under review", "Compliance request"], "Freeze payouts", "ember", `Payouts frozen for ${f.partnerName}`, "Pending and future commission lines are held until the freeze is lifted.")}
            >
              <Snowflake /> Freeze payouts
            </Button>
            <Button
              variant="down-outline"
              size="sm"
              onClick={() =>
                act("resolved", `Claw back commission`, ["Wash trading confirmed", "Cross-client hedging confirmed", "Self-referral confirmed", "Partner agreement §7.2 breach"], "Claw back", "sell", `$${f.affectedCommission.toLocaleString("en-US", { minimumFractionDigits: 2 })} clawed back from ${f.partnerName}`, (
                  <span>Reverses <span className="k-num text-fg">${f.affectedCommission.toFixed(2)}</span> on <span className="k-num text-fg">{f.affectedLots}</span> lots. Negative balance is netted from the next batch.</span>
                ))
              }
            >
              <Undo2 /> Claw back
            </Button>
            <Button variant="sell" size="sm" onClick={() => act("resolved", `Ban ${f.partnerName}`, ["Confirmed fraud — terminate agreement", "Repeat offence", "Regulatory instruction"], "Ban partner", "sell", `${f.partnerName} banned`, "Terminates the partner agreement, disables referral links and freezes all payouts.")}>
              <Ban /> Ban
            </Button>
          </div>
        }
      >
        <Section title="Case">
          <div className="mb-3 flex items-center justify-between gap-3">
            <PersonCell name={f.partnerName} photo={f.partnerPhoto} country={f.country} sub={<span className="font-mono">{f.partnerId}</span>} size={36} />
            <Chip tone={FRAUD_STATUS[f.status].tone} dot>{FRAUD_STATUS[f.status].label}</Chip>
          </div>
          <p className="text-[13.5px] text-fg-2">{f.summary}.</p>
          <div className="mt-2 font-mono text-[11.5px] text-fg-3">{f.rule}</div>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <MiniStat label="Risk score" value={<RiskScore score={f.score} />} />
            <MiniStat label="Commission" value={<Money value={f.affectedCommission} countUp={false} />} tone="down" />
            <MiniStat label="Lots" value={f.affectedLots.toLocaleString()} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] text-fg-3">Linked accounts</span>
            {f.accounts.map((a) => (
              <span key={a} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-0.5 pl-2.5 pr-1 font-mono text-[11.5px] text-fg-2">
                {a}
                <CopyButton value={a} label="Login" className="size-5" />
              </span>
            ))}
          </div>
        </Section>

        {f.pairs.length > 0 && (
          <Section title={f.type === "wash" ? "Opposing trade pairs" : "Mirrored positions"} hint={<>Net P/L across pairs <span className={cn("k-num", net >= 0 ? "text-up" : "text-down")}>{net >= 0 ? "+" : "-"}${Math.abs(net).toFixed(2)}</span> — commission was the only real gain</>}>
            <div className="overflow-x-auto rounded-[14px] border border-line">
              <table className="w-full min-w-[480px] text-[12px]">
                <thead>
                  <tr className="bg-surface-2 text-left text-[10.5px] uppercase tracking-wider text-fg-3">
                    <th className="px-3 py-2 font-medium">Symbol</th>
                    <th className="px-3 py-2 font-medium">Account A</th>
                    <th className="px-3 py-2 font-medium">Account B</th>
                    <th className="px-3 py-2 text-right font-medium">Δ time</th>
                    <th className="px-3 py-2 text-right font-medium">P/L A · B</th>
                  </tr>
                </thead>
                <tbody>
                  {f.pairs.map((p, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="px-3 py-2">
                        <div className="font-medium text-fg">{p.symbol}</div>
                        <div className="k-num text-[11px] text-fg-3">{p.a.lots.toFixed(2)} lots</div>
                      </td>
                      <td className="px-3 py-2">
                        <Chip size="sm" tone={p.a.side === "buy" ? "up" : "down"}>{p.a.side.toUpperCase()}</Chip>
                        <div className="mt-0.5 font-mono text-[10.5px] text-fg-3">#{p.a.ticket}</div><div className="font-mono text-[10.5px] text-fg-2">{fmtTime(p.a.time)}</div>
                      </td>
                      <td className="px-3 py-2">
                        <Chip size="sm" tone={p.b.side === "buy" ? "up" : "down"}>{p.b.side.toUpperCase()}</Chip>
                        <div className="mt-0.5 font-mono text-[10.5px] text-fg-3">#{p.b.ticket}</div><div className="font-mono text-[10.5px] text-fg-2">{fmtTime(p.b.time)}</div>
                      </td>
                      <td className={cn("k-num px-3 py-2 text-right font-medium", p.deltaMs < 1000 ? "text-down" : "text-warn")}>{p.deltaMs < 1000 ? `${p.deltaMs}ms` : `${(p.deltaMs / 1000).toFixed(1)}s`}</td>
                      <td className="k-num px-3 py-2 text-right">
                        <span className={p.pnlA >= 0 ? "text-up" : "text-down"}>{p.pnlA >= 0 ? "+" : ""}{p.pnlA.toFixed(2)}</span>
                        <br />
                        <span className={p.pnlB >= 0 ? "text-up" : "text-down"}>{p.pnlB >= 0 ? "+" : ""}{p.pnlB.toFixed(2)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        <Section title="Shared identifiers" hint="Signals linking the accounts to each other or to the partner">
          <div className="space-y-2">
            {f.shared.map((s) => {
              const Icon = KIND_ICON[s.kind];
              return (
                <div key={s.kind + s.value} className="k-row flex items-center gap-3 px-3.5 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border border-down/25 bg-down-soft text-down"><Icon className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] uppercase tracking-wider text-fg-3">{s.kind === "ip" ? "IP address" : s.kind === "device" ? "Device fingerprint" : s.kind === "wallet" ? "Payment wallet" : s.kind === "card" ? "Card" : "Address"}</span>
                    </div>
                    <div className="flex items-center gap-1 truncate font-mono text-[12.5px] text-fg">{s.value}<CopyButton value={s.value} label="Identifier" /></div>
                    {s.note && <div className="truncate text-[11.5px] text-fg-3">{s.note}</div>}
                  </div>
                  <Chip size="sm" tone="down">{s.accounts} accounts</Chip>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Activity">
          <ol className="relative ml-2 space-y-3 border-l border-line pl-4 text-[12.5px]">
            <li><span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-down" /><span className="text-fg">Rule {f.rule.split(" ")[0]} fired</span><div className="text-fg-3">{fmtDT(f.detected)} · automated</div></li>
            <li><span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-warn" /><span className="text-fg">Commission lines auto-held</span><div className="text-fg-3">{fmtDT(f.detected)} · {f.affectedLots} lots</div></li>
            {f.status !== "open" && <li><span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-fg-3" /><span className="text-fg">Assigned to Anika Sharma (Risk)</span><div className="text-fg-3">Case status: {FRAUD_STATUS[f.status].label}</div></li>}
          </ol>
          <Button variant="ghost" size="xs" className="mt-3" onClick={() => auditToast(`${f.id} escalated to Compliance`, "MLRO notified")}>
            <Lock /> Escalate to compliance
          </Button>
        </Section>
      </Dialog>
      {reason.node}
    </>
  );
}
