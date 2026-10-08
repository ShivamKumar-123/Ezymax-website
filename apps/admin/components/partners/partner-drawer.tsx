"use client";

import * as React from "react";
import { Ban, ChevronDown, LogIn, MessageSquare, PlayCircle, Save, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Chip, CopyButton, Dialog, Flag, Menu, Money, Progress, Segmented, StatusChip, cn } from "@ezymex/ui";
import { LEVELS, LEVEL_MAP, PLANS, SYMBOL_GROUPS, partnerCommissions, type CustomDeal, type LevelKey, type Partner } from "@ezymex/mock/admin-partners";
import { MiniField, MiniStat, NumInput, Section, Select, TextArea, auditToast, useReason } from "@/components/config/kit";
import { LEVEL_COLOR, LevelChip, fmtDT, fmtDate, fmtInt, fmtLots, nextLevel } from "./common";

const EXPIRY = ["30 days", "90 days", "180 days", "12 months", "No expiry"] as const;

function CriteriaBar({ label, value, target, fmt }: { label: string; value: number; target: number; fmt: (v: number) => string }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 100;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[12px]">
        <span className="text-fg-3">{label}</span>
        <span className="k-num text-fg-2">
          <span className={cn("font-medium", pct >= 100 ? "text-up" : "text-fg")}>{fmt(value)}</span> / {fmt(target)}
        </span>
      </div>
      <Progress value={pct} tone={pct >= 100 ? "up" : "gold"} />
    </div>
  );
}

export function PartnerDrawer({ partner, open, onOpenChange, onChange }: { partner: Partner | null; open: boolean; onOpenChange: (o: boolean) => void; onChange: (p: Partner) => void }) {
  const reason = useReason();
  const [msg, setMsg] = React.useState(false);
  const [msgText, setMsgText] = React.useState("");
  const [kind, setKind] = React.useState<CustomDeal["kind"]>("rate");
  const [group, setGroup] = React.useState<CustomDeal["group"]>("All groups");
  const [value, setValue] = React.useState(8);
  const [expiry, setExpiry] = React.useState<(typeof EXPIRY)[number]>("90 days");
  const [dealReason, setDealReason] = React.useState("");

  React.useEffect(() => {
    if (!partner) return;
    setKind(partner.customDeal?.kind ?? "rate");
    setGroup(partner.customDeal?.group ?? "All groups");
    setValue(partner.customDeal?.value ?? +(6.4 * LEVEL_MAP[partner.level].benefits.rateMultiplier + 1).toFixed(2));
    setDealReason(partner.customDeal?.reason ?? "");
  }, [partner]);

  if (!partner) return null;
  const p = partner;
  const L = LEVEL_MAP[p.level];
  const nxt = nextLevel(p.level);
  const plan = PLANS.find((x) => x.name === p.plan) ?? PLANS[0]!;
  const comms = partnerCommissions(p.id, 10);
  const treeTotal = p.tree.reduce((s, x) => s + x, 0);
  const lotsChange = ((p.lotsMtd - p.lotsPrev) / p.lotsPrev) * 100;

  const changeLevel = (lv: LevelKey) =>
    reason.ask({
      title: `Change level to ${LEVEL_MAP[lv].name}`,
      description: `${p.name} is currently ${L.name}. Manual overrides pause auto-evaluation for 90 days.`,
      reasons: ["Strategic partner exception", "Volume commitment signed", "Correction of evaluation error", "Compliance downgrade"],
      confirmLabel: "Change level",
      onConfirm: (r) => {
        onChange({ ...p, level: lv });
        auditToast(`${p.name} moved to ${LEVEL_MAP[lv].name}`, r);
      },
    });

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        side="right"
        title={
          <span className="flex items-center gap-3">
            <Avatar src={p.photo} name={p.name} size={44} verified={p.status === "active"} />
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="truncate">{p.name}</span>
                <Flag country={p.country} className="size-4" />
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[12px] font-normal text-fg-3">
                <span className="font-mono">{p.id}</span>
                <CopyButton value={p.id} label="Partner ID" />
                <span>· ref</span>
                <span className="font-mono text-fg-2">{p.refCode}</span>
              </span>
            </span>
          </span>
        }
        footer={
          <div className="flex w-full flex-wrap items-center gap-2">
            <Menu
              align="start"
              trigger={
                <Button variant="surface" size="sm">
                  <TrendingUp /> Change level <ChevronDown />
                </Button>
              }
              items={LEVELS.map((l) => ({ label: l.name, hint: l.key === p.level ? "Current" : `×${l.benefits.rateMultiplier.toFixed(2)}`, onSelect: () => l.key !== p.level && changeLevel(l.key) }))}
            />
            <Button variant="surface" size="sm" onClick={() => setMsg(true)}>
              <MessageSquare /> Message
            </Button>
            <Button variant="ghost" size="sm" onClick={() => toast.success(`Impersonation session opened`, { description: `Read-only partner portal as ${p.name} · 15 min` })}>
              <LogIn /> View as
            </Button>
            <span className="flex-1" />
            {p.status === "suspended" ? (
              <Button
                variant="up-outline"
                size="sm"
                onClick={() =>
                  reason.ask({ title: `Reinstate ${p.name}`, reasons: ["Investigation closed — no fault", "Clawback settled", "Management decision"], confirmLabel: "Reinstate", tone: "buy", onConfirm: (r) => { onChange({ ...p, status: "active" }); auditToast(`${p.name} reinstated`, r); } })
                }
              >
                <PlayCircle /> Reinstate
              </Button>
            ) : (
              <Button
                variant="down-outline"
                size="sm"
                onClick={() =>
                  reason.ask({
                    title: `Suspend ${p.name}`,
                    description: "Commission accrual stops and pending payouts are frozen. Referred clients keep trading.",
                    reasons: ["Fraud investigation", "Breach of partner agreement", "Marketing compliance violation", "KYC/KYB expired"],
                    confirmLabel: "Suspend partner",
                    tone: "sell",
                    onConfirm: (r) => { onChange({ ...p, status: "suspended" }); auditToast(`${p.name} suspended`, r); },
                  })
                }
              >
                <Ban /> Suspend
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-0">
          <Section title="Profile">
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <StatusChip status={p.status} label={p.status === "suspended" ? "Suspended" : undefined} />
              <LevelChip level={p.level} size="md" />
              <Chip>{p.plan}</Chip>
              {p.company && <Chip tone="info">Corporate IB</Chip>}
              {p.customDeal && <Chip tone="ember">Custom deal</Chip>}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <MiniStat label="Lots MTD" value={fmtLots(p.lotsMtd)} sub={<span className={lotsChange >= 0 ? "text-up" : "text-down"}>{lotsChange >= 0 ? "+" : ""}{lotsChange.toFixed(1)}% vs Aug</span>} />
              <MiniStat label="Commission MTD" value={<Money value={p.commissionMtd} countUp={false} />} sub={<>Pending <Money value={p.commissionPending} countUp={false} /></>} />
              <MiniStat label="Net deposits" value={<Money value={p.netDeposits} decimals={0} countUp={false} />} sub="Network, 90 days" />
              <MiniStat label="Lifetime paid" value={<Money value={p.commissionLifetime} countUp={false} />} sub={`Since ${fmtDate(p.joined)}`} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 text-[12.5px]">
              <div className="flex justify-between py-1.5"><span className="text-fg-3">Account manager</span><span className="text-fg-2">{p.manager}</span></div>
              <div className="flex justify-between py-1.5"><span className="text-fg-3">Sub-broker</span><span className="text-fg-2">{p.subBroker ?? "Direct"}</span></div>
              <div className="flex justify-between py-1.5"><span className="text-fg-3">Email</span><span className="truncate pl-2 text-fg-2">{p.email}</span></div>
              <div className="flex justify-between py-1.5"><span className="text-fg-3">Sub-IBs</span><span className="k-num text-fg-2">{p.subIbs}</span></div>
            </div>
          </Section>

          <Section title="Level progress" hint={nxt ? `Evaluated on a ${nxt.criteria.windowDays}-day window · next evaluation 01 Oct 00:05` : "Top level reached"} action={nxt && <LevelChip level={nxt.key} />}>
            {nxt ? (
              <div className="space-y-3.5">
                <CriteriaBar label="Active clients" value={p.clientsActive} target={nxt.criteria.activeClients} fmt={fmtInt} />
                <CriteriaBar label="Monthly lots" value={p.lotsMtd} target={nxt.criteria.monthlyLots} fmt={(v) => fmtInt(v)} />
                <CriteriaBar label="Net deposits" value={p.netDeposits} target={nxt.criteria.minNetDeposits} fmt={(v) => `$${(v / 1000).toFixed(0)}k`} />
              </div>
            ) : (
              <div className="k-row flex items-center gap-3 px-4 py-3 text-[13px] text-fg-2">
                <span className="size-2 rounded-full bg-ember" /> Diamond partner · ×{L.benefits.rateMultiplier.toFixed(2)} rate multiplier, daily payouts, ${fmtInt(L.benefits.marketingBudget)}/mo marketing budget.
              </div>
            )}
          </Section>

          <Section title="Referral tree" hint={`${fmtInt(treeTotal)} clients across ${p.tree.length} tier${p.tree.length > 1 ? "s" : ""}`}>
            <div className="space-y-2">
              {p.tree.map((n, i) => {
                const pct = plan.tiers[i] ?? 0;
                return (
                  <div key={i} className="k-row flex items-center gap-3 px-3.5 py-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line bg-surface-3 font-mono text-[11px] text-fg-2">T{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="text-fg-2"><span className="k-num font-medium text-fg">{fmtInt(n)}</span> clients</span>
                        <span className="k-num text-fg-3">{pct}% of rate</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                        <div className="h-full rounded-full" style={{ width: `${(n / p.tree[0]!) * 100}%`, background: LEVEL_COLOR[p.level] }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section
            title="Custom deal"
            hint={p.customDeal ? `Active · approved by ${p.customDeal.approvedBy} · expires ${fmtDate(p.customDeal.expires)}` : `Overrides ${p.plan} for this partner only`}
            action={
              p.customDeal && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => reason.ask({ title: "Remove custom deal", reasons: ["Deal expired", "Volume commitment not met", "Renegotiated"], confirmLabel: "Remove", tone: "sell", onConfirm: (r) => { onChange({ ...p, customDeal: null }); auditToast(`Custom deal removed for ${p.name}`, r); } })
                  }
                >
                  <Trash2 /> Remove
                </Button>
              )
            }
          >
            <div className="space-y-3">
              <Segmented size="xs" value={kind} onChange={setKind} options={[{ value: "rate", label: "Override $/lot" }, { value: "percent", label: "% bonus on plan" }]} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MiniField label="Symbol group">
                  <Select size="sm" value={group} onChange={setGroup} options={["All groups", ...SYMBOL_GROUPS] as const} />
                </MiniField>
                <MiniField label={kind === "rate" ? "Rate" : "Bonus"}>
                  <NumInput size="sm" value={value} onChange={setValue} step={kind === "rate" ? 0.25 : 1} min={0} max={kind === "rate" ? 40 : 100} prefix={kind === "rate" ? "$" : undefined} suffix={kind === "rate" ? "/lot" : "%"} decimals={kind === "rate" ? 2 : 0} />
                </MiniField>
                <MiniField label="Expires">
                  <Select size="sm" value={expiry} onChange={setExpiry} options={EXPIRY} />
                </MiniField>
              </div>
              <MiniField label="Business justification" hint="Required">
                <TextArea rows={2} value={dealReason} onChange={setDealReason} placeholder="e.g. Matching competitor offer, 5,000 lots/mo commitment" />
              </MiniField>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] text-fg-3">
                  Plan rate on {group === "All groups" ? "Forex majors" : group}: <span className="k-num text-fg-2">${plan.rates[group === "All groups" ? "Forex majors" : group][p.level].toFixed(2)}/lot</span>
                </span>
                <Button
                  size="sm"
                  variant="ember"
                  onClick={() => {
                    if (dealReason.trim().length < 6) {
                      toast.error("Add a business justification", { description: "Custom deals need a reason for the audit log." });
                      return;
                    }
                    const deal: CustomDeal = { kind, value, group, reason: dealReason, approvedBy: "You (Super Admin)", expires: "2026-12-23T00:00:00+03:00" };
                    onChange({ ...p, customDeal: deal });
                    auditToast(`Custom deal saved for ${p.name}`, `${kind === "rate" ? `$${value.toFixed(2)}/lot` : `+${value}%`} on ${group} · ${expiry}`);
                  }}
                >
                  <Save /> Save deal
                </Button>
              </div>
            </div>
          </Section>

          <Section title="Recent commissions" hint="Last 10 accruals">
            <div className="overflow-hidden rounded-[14px] border border-line">
              {comms.map((c) => (
                <div key={c.id} className="flex items-center gap-3 border-b border-line px-3.5 py-2.5 text-[12.5px] last:border-b-0">
                  <span className="w-24 shrink-0 font-mono text-[11px] text-fg-3">{fmtDT(c.time)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-fg">{c.client}</div>
                    <div className="font-mono text-[11px] text-fg-3">{c.login}</div>
                  </div>
                  {c.kind === "cpa" ? <Chip size="sm" tone="gold">CPA</Chip> : <span className="k-num text-fg-2">{c.symbol} · {c.lots.toFixed(2)}</span>}
                  <Chip size="sm">T{c.tier}</Chip>
                  <span className="k-num w-16 text-right font-medium text-up">+${c.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </Dialog>

      <Dialog
        open={msg}
        onOpenChange={setMsg}
        title={`Message ${p.name}`}
        description="Sent to the partner portal inbox and by email."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setMsg(false)}>Cancel</Button>
            <Button variant="ember" size="sm" onClick={() => { setMsg(false); setMsgText(""); toast.success(`Message sent to ${p.name}`, { description: p.email }); }}>Send</Button>
          </>
        }
      >
        <TextArea rows={5} value={msgText} onChange={setMsgText} placeholder={`Hi ${p.name.split(" ")[0]}, …`} />
      </Dialog>
      {reason.node}
    </>
  );
}
