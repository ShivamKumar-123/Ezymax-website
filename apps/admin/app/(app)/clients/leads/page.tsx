"use client";

import * as React from "react";
import { motion } from "motion/react";
import { CalendarClock, Mail, MessageCircle, Phone, Plus, Target, Timer, TrendingUp, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  Card,
  Chip,
  Dialog,
  Field,
  Flag,
  Input,
  KpiCard,
  Menu,
  Money,
  PageHeader,
  Reveal,
  Segmented,
  cn,
  formatMoney,
} from "@ezymex/ui";
import { ADMIN_NOW, DESKS, LEADS, LEAD_STAGES, LEAD_STAGE_LABEL, SALES_AGENTS, serverTime, staff, timeAgo, type Lead, type LeadStage } from "@ezymex/mock/admin-clients";
import { ReasonDialog } from "@/components/command/kit";

const STAGE_ACCENT: Record<LeadStage, string> = {
  new: "bg-info",
  contacted: "bg-fg-2",
  qualified: "bg-gold",
  deposit_pending: "bg-ember",
  ftd: "bg-up",
  lost: "bg-down",
};

function followUp(iso: string) {
  const d = Date.parse(iso) - ADMIN_NOW;
  const overdue = d < 0;
  return { overdue, soon: !overdue && d < 3 * 3600_000, label: overdue ? `Overdue ${timeAgo(iso).replace(" ago", "")}` : timeAgo(iso) };
}

function LeadCard({ l, onOpen, onDragStart }: { l: Lead; onOpen: () => void; onDragStart: (e: React.DragEvent) => void }) {
  const a = staff(l.agentId);
  const f = followUp(l.nextFollowUp);
  return (
    <motion.div layout layoutId={l.id} transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}>
      <div
        draggable
        onDragStart={onDragStart}
        onClick={onOpen}
        className="k-row cursor-grab px-3.5 py-3 transition-colors hover:border-[var(--k-border-top)] hover:bg-surface-3/60 active:cursor-grabbing"
      >
        <div className="flex items-start gap-2.5">
          <Avatar src={l.photo} name={l.name} size={32} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-medium">{l.name}</span>
              <Flag country={l.country} className="size-3.5" />
            </div>
            <div className="truncate text-[11px] text-fg-3">{l.source}</div>
          </div>
          <span className={cn("k-num rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-semibold", l.score >= 70 ? "bg-up-soft text-up" : l.score >= 45 ? "bg-warn-soft text-warn" : "bg-surface-3 text-fg-3")}>{l.score}</span>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="truncate rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[10.5px] text-fg-2">utm:{l.utm}</span>
          <Money value={l.value} decimals={0} countUp={false} className="text-[13px] font-semibold" />
        </div>
        <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5">
          <span className={cn("flex items-center gap-1 text-[11px]", l.stage === "ftd" || l.stage === "lost" ? "text-fg-3" : f.overdue ? "text-down" : f.soon ? "text-warn" : "text-fg-3")}>
            <CalendarClock className="size-3" />
            {l.stage === "lost" ? l.lostReason : l.stage === "ftd" ? "Converted" : f.label}
          </span>
          <Avatar src={a.photo} name={a.name} size={20} />
        </div>
      </div>
    </motion.div>
  );
}

function LeadDrawer({ l, onClose, onMove }: { l: Lead | null; onClose: () => void; onMove: (id: string, s: LeadStage) => void }) {
  const [lost, setLost] = React.useState(false);
  if (!l) return null;
  const a = staff(l.agentId);
  return (
    <>
      <Dialog open={!!l} onOpenChange={(o) => !o && onClose()} side="right" title={l.name} description={`${l.id} · ${LEAD_STAGE_LABEL[l.stage]} · created ${timeAgo(l.created)}`}>
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar src={l.photo} name={l.name} size={56} />
            <div className="min-w-0 flex-1 text-[13px]">
              <div className="flex items-center gap-2">
                <Flag country={l.country} className="size-4" /> {l.email}
              </div>
              <div className="mt-1 font-mono text-fg-2">{l.phone}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-fg-3">Expected FTD</div>
              <Money value={l.value} decimals={0} className="text-[20px] font-semibold" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" variant="surface" onClick={() => toast.success(`Calling ${l.phone}`, { description: "VoIP · call recorded to CRM" })}>
              <Phone /> Call
            </Button>
            <Button size="sm" variant="surface" onClick={() => toast.success("WhatsApp template sent")}>
              <MessageCircle /> WhatsApp
            </Button>
            <Button size="sm" variant="surface" onClick={() => toast.success("Email sent", { description: l.email })}>
              <Mail /> Email
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[12.5px]">
            {[
              ["Source", l.source],
              ["UTM campaign", l.utm],
              ["Desk", l.desk],
              ["Lead score", `${l.score} / 100`],
              ["Next follow-up", serverTime(l.nextFollowUp)],
              ["Agent", a.name],
            ].map(([k, v]) => (
              <div key={k} className="k-row px-3 py-2">
                <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{k}</div>
                <div className="mt-0.5 truncate font-medium">{v}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-2 text-[12.5px] font-medium text-fg-2">Move to stage</div>
            <div className="flex flex-wrap gap-1.5">
              {LEAD_STAGES.filter((s) => s !== "lost").map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onMove(l.id, s);
                    toast.success(`Moved to ${LEAD_STAGE_LABEL[s]}`);
                  }}
                  className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px]", l.stage === s ? "border-ember/50 bg-ember-soft" : "border-line bg-surface-2 text-fg-2 hover:text-fg")}
                >
                  <span className={cn("size-1.5 rounded-full", STAGE_ACCENT[s])} />
                  {LEAD_STAGE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[12.5px] font-medium text-fg-2">Activity</div>
            <ol className="space-y-2.5 text-[12.5px]">
              {[
                [timeAgo(l.created), "Lead created from " + l.source],
                ["2d ago", `Auto-assigned to ${a.name} (${l.desk})`],
                ["1d ago", "Opened welcome email · clicked “Open account”"],
                ["6h ago", "Call attempt — no answer, SMS sent"],
              ].map(([t, x], i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ember" />
                  <span className="flex-1 text-fg-2">{x}</span>
                  <span className="text-fg-3">{t}</span>
                </li>
              ))}
            </ol>
          </div>
          <Field label="Add note">
            <Input placeholder="Call summary, objections, next step…" onKeyDown={(e) => e.key === "Enter" && toast.success("Note saved")} />
          </Field>
          <div className="flex gap-2 border-t border-line pt-4">
            <Button size="sm" variant="down-outline" onClick={() => setLost(true)}>
              Mark lost
            </Button>
            <Button size="sm" variant="ember" className="ml-auto" onClick={() => { onMove(l.id, "ftd"); toast.success(`${l.name} converted to client`, { description: "Client profile created · FTD attributed to " + a.name }); onClose(); }}>
              <UserCheck /> Convert to client
            </Button>
          </div>
        </div>
      </Dialog>
      <ReasonDialog
        open={lost}
        onOpenChange={setLost}
        title={`Mark ${l.name} as lost`}
        codes={["LST-01 · No answer ×5", "LST-02 · Went with competitor", "LST-03 · Not eligible (jurisdiction)", "LST-04 · Budget too low", "LST-05 · Duplicate lead"]}
        confirmLabel="Mark lost"
        confirmVariant="sell"
        successMessage="Lead marked lost"
        onConfirm={() => {
          onMove(l.id, "lost");
          onClose();
        }}
      />
    </>
  );
}

export default function LeadsPage() {
  const [leads, setLeads] = React.useState(LEADS);
  const [desk, setDesk] = React.useState<string>("all");
  const [agent, setAgent] = React.useState<string>("all");
  const [open, setOpen] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<LeadStage | null>(null);
  const drag = React.useRef<string | null>(null);

  const view = leads.filter((l) => (desk === "all" || l.desk === desk) && (agent === "all" || l.agentId === agent));
  const move = (id: string, s: LeadStage) => setLeads((xs) => xs.map((x) => (x.id === id ? { ...x, stage: s } : x)));
  const by = (s: LeadStage) => view.filter((l) => l.stage === s);
  const contacted = view.filter((l) => l.stage !== "new").length;
  const qualifiedPlus = view.filter((l) => ["qualified", "deposit_pending", "ftd"].includes(l.stage)).length;
  const ftd = by("ftd");
  const funnel = [
    ["Leads", view.length],
    ["Contacted", contacted],
    ["Qualified", qualifiedPlus],
    ["FTD", ftd.length],
  ] as const;
  const salesDesks = DESKS.filter((d) => d.startsWith("Sales"));
  const agentObj = agent === "all" ? null : staff(agent);

  return (
    <div className="pb-10">
      <PageHeader
        title="Leads"
        subtitle="Sales pipeline across desks — drag cards between stages; every move is logged."
        actions={
          <>
            <Menu
              width={260}
              items={[
                { label: "All agents", onSelect: () => setAgent("all") },
                "sep",
                ...SALES_AGENTS.map((a) => ({ label: a.name, hint: a.desk.replace("Sales · ", "").replace("Retention · ", "Ret "), icon: <Avatar src={a.photo} name={a.name} size={20} />, onSelect: () => setAgent(a.id) })),
              ]}
              trigger={
                <Button variant="surface" size="lg">
                  {agentObj ? <Avatar src={agentObj.photo} name={agentObj.name} size={22} /> : <Users />}
                  {agentObj ? agentObj.name : "All agents"}
                </Button>
              }
            />
            <Button variant="ember" size="lg" onClick={() => toast.success("Lead created", { description: "Assigned by round-robin to Sales · EN" })}>
              <Plus /> New lead
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="grid grid-cols-2 gap-4 lg:col-span-8 xl:grid-cols-4">
          <KpiCard label="Open leads" icon={<Target />} value={<span className="k-num">{view.filter((l) => l.stage !== "ftd" && l.stage !== "lost").length}</span>} chip={`${view.filter((l) => followUp(l.nextFollowUp).overdue && !["ftd", "lost"].includes(l.stage)).length} follow-ups overdue`} chipTone="warn" />
          <KpiCard label="Contact rate" icon={<Phone />} value={<span className="k-num">{view.length ? Math.round((contacted / view.length) * 100) : 0}%</span>} chip="Target 85%" delay={0.04} />
          <KpiCard label="Qualified → FTD" icon={<TrendingUp />} value={<span className="k-num">{qualifiedPlus ? Math.round((ftd.length / qualifiedPlus) * 100) : 0}%</span>} chip="+4.1 pts MoM" chipTone="up" delay={0.08} />
          <KpiCard label="FTD value" icon={<Timer />} value={<Money value={ftd.reduce((s, l) => s + l.value, 0)} decimals={0} />} chip="Avg 3.2 days to FTD" chipTone="up" delay={0.12} />
        </div>
        <Reveal delay={0.1} className="lg:col-span-4">
          <Card className="h-full px-6 py-5">
            <div className="k-label">Conversion funnel</div>
            <div className="mt-4 space-y-2.5">
              {funnel.map(([k, v], i) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-20 text-[12px] text-fg-2">{k}</span>
                  <div className="h-6 flex-1 overflow-hidden rounded-lg bg-surface-2">
                    <motion.div
                      className="flex h-full items-center justify-end rounded-lg bg-gradient-to-r from-ember/30 to-ember px-2 text-[11px] font-semibold text-white"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(8, (v / (funnel[0][1] || 1)) * 100)}%` }}
                      transition={{ duration: 0.8, delay: i * 0.08 }}
                      style={{ opacity: 1 - i * 0.15 }}
                    >
                      <span className="k-num">{v}</span>
                    </motion.div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.12} className="mt-5 flex flex-wrap items-center gap-2">
        <Segmented size="sm" value={desk} onChange={setDesk} options={[{ value: "all", label: "All desks" }, ...salesDesks.map((d) => ({ value: d, label: d.replace("Sales · ", "") })), { value: "Retention · A", label: "Retention" }]} />
        <span className="ml-auto text-[12px] text-fg-3">{view.length} leads · pipeline {formatMoney(view.filter((l) => l.stage !== "lost").reduce((s, l) => s + l.value, 0), "USD", 0)}</span>
      </Reveal>

      <Reveal delay={0.15} className="mt-4 overflow-x-auto pb-2">
        <div className="grid min-w-[1320px] grid-cols-6 gap-3">
          {LEAD_STAGES.map((s) => {
            const list = by(s);
            const total = list.reduce((a, l) => a + l.value, 0);
            return (
              <div
                key={s}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(s);
                }}
                onDragLeave={() => setOver((o) => (o === s ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const id = drag.current;
                  if (!id) return;
                  const l = leads.find((x) => x.id === id);
                  if (l && l.stage !== s) {
                    move(id, s);
                    toast.success(`${l.name} → ${LEAD_STAGE_LABEL[s]}`, { description: s === "ftd" ? "FTD attributed to " + staff(l.agentId).name : "Stage change logged" });
                  }
                  drag.current = null;
                }}
                className={cn("k-card flex min-h-[560px] flex-col overflow-hidden transition-colors", over === s && "border-ember/50 bg-ember-soft")}
              >
                <span className={cn("h-[3px] w-full", STAGE_ACCENT[s])} />
                <div className="flex items-center justify-between px-3.5 pb-2 pt-3">
                  <span className="flex items-center gap-2 text-[13px] font-medium">
                    {LEAD_STAGE_LABEL[s]}
                    <span className="k-num rounded-full bg-surface-3 px-1.5 text-[11px] text-fg-2">{list.length}</span>
                  </span>
                  <span className="k-num font-mono text-[11.5px] text-fg-3">{formatMoney(total, "USD", 0)}</span>
                </div>
                <div className="flex-1 space-y-2 px-2.5 pb-3">
                  {list.map((l) => (
                    <LeadCard
                      key={l.id}
                      l={l}
                      onOpen={() => setOpen(l.id)}
                      onDragStart={(e) => {
                        drag.current = l.id;
                        e.dataTransfer.effectAllowed = "move";
                      }}
                    />
                  ))}
                  {list.length === 0 && <div className="grid h-24 place-items-center rounded-[14px] border border-dashed border-line text-[12px] text-fg-3">Drop leads here</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Reveal>
      <LeadDrawer l={leads.find((l) => l.id === open) ?? null} onClose={() => setOpen(null)} onMove={move} />
    </div>
  );
}
