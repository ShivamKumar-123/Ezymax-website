"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CheckCheck, Clock, Download, Hourglass, Inbox, TimerOff, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, Chip, KpiCard, Menu, PageHeader, Reveal, Tabs, Tooltip, cn, formatNumber } from "@ezymex/ui";
import { getClient, REASON_CODES, STAFF_MEMBERS, staff, timeAgo } from "@ezymex/mock/admin-clients";
import { QUEUE_KYC, QUEUE_MASTERS, QUEUE_PAYOUTS, QUEUE_PROP, QUEUE_WITHDRAWALS, WITHDRAWAL_QUEUE, type QueueItem } from "@ezymex/mock/admin-ops";
import { Check, ClientCell, ReasonDialog, SlaTimer } from "@/components/command/kit";
import { RiskChecks } from "@/components/command/overview";

type QKey = "kyc" | "withdrawals" | "payouts" | "masters" | "prop";

const QUEUES: Record<QKey, { label: string; items: QueueItem[]; approve: string; reject: readonly string[]; owner: string; href: string }> = {
  kyc: { label: "KYC", items: QUEUE_KYC, approve: "Approve", reject: REASON_CODES.reject, owner: "Compliance", href: "/clients/kyc" },
  withdrawals: { label: "Withdrawals", items: QUEUE_WITHDRAWALS, approve: "Approve & sign", reject: REASON_CODES.withdrawal, owner: "Finance", href: "/finance/withdrawals" },
  payouts: { label: "IB payouts", items: QUEUE_PAYOUTS, approve: "Pay out", reject: ["PAY-01 · Fraud flag on sub-clients", "PAY-02 · Wash trading detected", "PAY-03 · Plan mismatch"], owner: "Partners", href: "/finance/payouts" },
  masters: { label: "Master applications", items: QUEUE_MASTERS, approve: "Approve master", reject: ["MST-01 · Track record too short", "MST-02 · Drawdown above policy", "MST-03 · Martingale / grid detected", "MST-04 · KYC level insufficient"], owner: "Social desk", href: "/social/applications" },
  prop: { label: "Prop payouts", items: QUEUE_PROP, approve: "Approve payout", reject: ["PRP-01 · Rule violation", "PRP-02 · Consistency rule failed", "PRP-03 · Copy-trading across accounts", "PRP-04 · News-trading breach"], owner: "Prop desk", href: "/prop/payouts" },
};

const PRIORITY_TONE = { urgent: "down", high: "warn", normal: "neutral" } as const;

function assigneeFor(id: string) {
  const pool = STAFF_MEMBERS.slice(4);
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 4 === 0 ? null : pool[h % pool.length]!;
}

function QueueTable({ qk, items, onRemove }: { qk: QKey; items: QueueItem[]; onRemove: (ids: string[]) => void }) {
  const cfg = QUEUES[qk];
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [reject, setReject] = React.useState<string[] | null>(null);
  const [assigned, setAssigned] = React.useState<Record<string, string>>({});
  React.useEffect(() => setSel(new Set()), [qk]);
  const all = items.length > 0 && items.every((i) => sel.has(i.id));
  const some = !all && items.some((i) => sel.has(i.id));
  const toggle = (id: string) => setSel((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const selected = items.filter((i) => sel.has(i.id));
  const selAmount = selected.reduce((s, i) => s + (i.amount ?? 0), 0);

  const approve = (ids: string[]) => {
    toast.success(ids.length > 1 ? `${ids.length} items approved` : `${ids[0]} approved`, { description: `${cfg.label} · logged to audit trail` });
    onRemove(ids);
    setSel(new Set());
  };
  const assign = (ids: string[], staffId: string) => {
    setAssigned((a) => ({ ...a, ...Object.fromEntries(ids.map((i) => [i, staffId])) }));
    toast.success(`Assigned ${ids.length} item${ids.length > 1 ? "s" : ""} to ${staff(staffId).name}`);
  };
  const staffMenu = (ids: string[]) =>
    STAFF_MEMBERS.slice(4).map((s) => ({ label: s.name, icon: <Avatar src={s.photo} name={s.name} size={20} />, hint: s.desk, onSelect: () => assign(ids, s.id) }));

  return (
    <div>
      <AnimatePresence>
        {sel.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -6, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -6, height: 0 }} className="overflow-hidden">
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[14px] border border-ember/30 bg-ember-soft px-4 py-2.5">
              <span className="text-[13px] font-medium">
                {sel.size} selected{selAmount > 0 && <span className="k-num text-fg-2"> · {formatNumber(selAmount, 2)} USDT</span>}
              </span>
              <div className="ml-auto flex flex-wrap gap-2">
                <Menu width={240} items={staffMenu([...sel])} trigger={<Button size="xs" variant="surface"><UserPlus /> Assign</Button>} />
                <Button size="xs" variant="down-outline" onClick={() => setReject([...sel])}>
                  <X /> Reject
                </Button>
                <Button size="xs" variant="up-outline" onClick={() => approve([...sel])}>
                  <CheckCheck /> {cfg.approve} ({sel.size})
                </Button>
                <button onClick={() => setSel(new Set())} className="px-1 text-[12px] text-fg-3 hover:text-fg">
                  Clear
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.05em] text-fg-3">
              <th className="w-10 rounded-l-[14px] border-y border-l border-line bg-surface-2 py-2.5 pl-4 pr-2 text-left">
                <Check checked={all} indeterminate={some} onChange={(v) => setSel(v ? new Set(items.map((i) => i.id)) : new Set())} label="Select all" />
              </th>
              {["Item", "Client", qk === "withdrawals" ? "Risk checks" : "Details", "Amount", "Priority", "Assignee", "Submitted", "SLA", ""].map((h, i) => (
                <th key={i} className={cn("border-y border-line bg-surface-2 px-3 py-2.5 text-left font-medium", i === 3 && "text-right", i === 8 && "text-right", i === 9 && "rounded-r-[14px] border-r")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {items.map((it) => {
                const c = getClient(it.clientId);
                const w = qk === "withdrawals" ? WITHDRAWAL_QUEUE.find((x) => x.id === it.id) : undefined;
                const who = assigned[it.id] ? staff(assigned[it.id]!) : assigneeFor(it.id);
                const on = sel.has(it.id);
                return (
                  <motion.tr key={it.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: 40 }} className={cn("group", on && "[&>td]:bg-ember-soft/40")} onClick={() => toggle(it.id)}>
                    <td className="border-b border-line py-2.5 pl-4 pr-2 group-hover:bg-surface-2/60">
                      <Check checked={on} onChange={() => toggle(it.id)} />
                    </td>
                    <td className="border-b border-line px-3 group-hover:bg-surface-2/60">
                      <div className="font-mono text-[12px] text-fg">{it.id}</div>
                      <div className="text-[11.5px] text-fg-3">{it.title}</div>
                    </td>
                    <td className="border-b border-line px-3 group-hover:bg-surface-2/60">
                      <ClientCell client={c} size={28} />
                    </td>
                    <td className="min-w-[330px] max-w-[340px] border-b border-line px-3 group-hover:bg-surface-2/60">
                      {w ? <RiskChecks checks={w.checks} /> : <span className="line-clamp-2 text-[12px] text-fg-2">{it.meta}</span>}
                    </td>
                    <td className="k-num border-b border-line px-3 text-right font-mono text-[12.5px] group-hover:bg-surface-2/60">
                      {it.amount !== undefined ? (
                        <>
                          {formatNumber(it.amount, 2)} <span className="text-fg-3">USDT</span>
                        </>
                      ) : (
                        <span className="text-fg-3">—</span>
                      )}
                    </td>
                    <td className="border-b border-line px-3 group-hover:bg-surface-2/60">
                      <Chip size="sm" tone={PRIORITY_TONE[it.priority]} dot className="capitalize">
                        {it.priority}
                      </Chip>
                    </td>
                    <td className="border-b border-line px-3 group-hover:bg-surface-2/60" onClick={(e) => e.stopPropagation()}>
                      <Menu
                        width={240}
                        items={staffMenu([it.id])}
                        trigger={
                          who ? (
                            <button className="flex items-center gap-2 rounded-full pr-2 hover:bg-surface-3">
                              <Avatar src={who.photo} name={who.name} size={24} />
                              <span className="text-[12px] text-fg-2">{who.name.split(" ")[0]}</span>
                            </button>
                          ) : (
                            <button className="flex h-6 items-center gap-1 rounded-full border border-dashed border-fg-3/50 px-2 text-[11.5px] text-fg-3 hover:border-ember hover:text-ember">
                              <UserPlus className="size-3" /> Assign
                            </button>
                          )
                        }
                      />
                    </td>
                    <td className="border-b border-line px-3 text-[12px] text-fg-3 group-hover:bg-surface-2/60">{timeAgo(it.submitted)}</td>
                    <td className="border-b border-line px-3 text-right group-hover:bg-surface-2/60">
                      <SlaTimer mins={it.slaMins} total={it.slaTotal} />
                    </td>
                    <td className="border-b border-line py-2 pl-3 pr-3 text-right group-hover:bg-surface-2/60" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1.5">
                        <Tooltip content="Reject with reason">
                          <button onClick={() => setReject([it.id])} className="grid size-7 place-items-center rounded-full border border-line text-fg-3 hover:border-down/40 hover:bg-down-soft hover:text-down" aria-label="Reject">
                            <X className="size-3.5" />
                          </button>
                        </Tooltip>
                        <Button size="xs" variant="up-outline" onClick={() => approve([it.id])}>
                          {cfg.approve}
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
        {items.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <Inbox className="size-8 text-fg-3" />
            <div className="mt-3 text-[14px] font-medium">Queue is clear</div>
            <div className="text-[12.5px] text-fg-3">New {cfg.label.toLowerCase()} will appear here in real time.</div>
          </div>
        )}
      </div>
      <ReasonDialog
        open={!!reject}
        onOpenChange={(o) => !o && setReject(null)}
        title={reject && reject.length > 1 ? `Reject ${reject.length} ${cfg.label.toLowerCase()}` : `Reject ${reject?.[0] ?? ""}`}
        description="The client is notified with the reason code's customer-facing text."
        codes={cfg.reject}
        confirmLabel="Reject"
        confirmVariant="sell"
        successMessage={(code) => `${reject?.length ?? 1} rejected · ${code.split(" · ")[1]}`}
        onConfirm={() => {
          onRemove(reject ?? []);
          setSel(new Set());
        }}
      />
    </div>
  );
}

export default function QueuesPage() {
  const [tab, setTab] = React.useState<QKey>("withdrawals");
  const [data, setData] = React.useState<Record<QKey, QueueItem[]>>(() => ({
    kyc: QUEUES.kyc.items,
    withdrawals: QUEUES.withdrawals.items,
    payouts: QUEUES.payouts.items,
    masters: QUEUES.masters.items,
    prop: QUEUES.prop.items,
  }));
  const [done, setDone] = React.useState(64);
  const total = Object.values(data).reduce((s, l) => s + l.length, 0);
  const breached = Object.values(data).flat().filter((i) => i.slaMins < 0).length;
  const urgent = Object.values(data).flat().filter((i) => i.priority === "urgent").length;
  const keys = Object.keys(QUEUES) as QKey[];

  return (
    <div className="pb-10">
      <PageHeader
        title="Queues"
        subtitle="Everything waiting on a human — KYC, withdrawals, payouts and applications — with SLA timers."
        actions={
          <>
            <Button variant="surface" size="lg" onClick={() => toast.success("queues.csv exported", { description: `${total} open items` })}>
              <Download /> Export
            </Button>
            <Link href={QUEUES[tab].href}>
              <Button variant="ember" size="lg">
                Open {QUEUES[tab].label}
              </Button>
            </Link>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Open items" icon={<Inbox />} value={<span className="k-num">{total}</span>} chip={`${urgent} urgent`} chipTone="ember" />
        <KpiCard label="SLA breached" icon={<TimerOff />} value={<span className={cn("k-num", breached && "text-down")}>{breached}</span>} chip={breached ? "Escalated to team leads" : "All within SLA"} chipTone={breached ? "down" : "up"} delay={0.05} />
        <KpiCard label="Avg handling time" icon={<Hourglass />} value={<span className="k-num">14m 20s</span>} chip="-3m vs last week" chipTone="up" delay={0.1} />
        <KpiCard label="Processed today" icon={<Clock />} value={<span className="k-num">{done}</span>} chip="92% within SLA" chipTone="up" delay={0.15} />
      </div>
      <Reveal delay={0.1} className="mt-4">
        <Card>
          <div className="px-4 pt-5 sm:px-6">
            <div className="overflow-x-auto [scrollbar-width:none]">
              <Tabs className="min-w-max" value={tab} onChange={setTab} tabs={keys.map((k) => ({ value: k, label: QUEUES[k].label, count: data[k].length }))} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[12.5px] text-fg-3">
              <span>
                Owner: <span className="text-fg-2">{QUEUES[tab].owner}</span>
              </span>
              <span>·</span>
              <span>SLA {Math.round(QUEUES[tab].items[0]?.slaTotal ?? 0) / 60}h</span>
              <span>·</span>
              <span>Sorted by SLA remaining</span>
              <span className="ml-auto">Tip: click rows to select · bulk actions appear above the table</span>
            </div>
          </div>
          <div className="mt-3 px-4 pb-5 sm:px-6">
            <QueueTable
              qk={tab}
              items={[...data[tab]].sort((a, b) => a.slaMins - b.slaMins)}
              onRemove={(ids) => {
                setData((d) => ({ ...d, [tab]: d[tab].filter((i) => !ids.includes(i.id)) }));
                setDone((n) => n + ids.length);
              }}
            />
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
