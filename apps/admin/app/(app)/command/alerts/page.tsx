"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Activity, ArrowUpRight, BellRing, Check, CheckCheck, Database, Landmark, Plus, Radio, ShieldAlert, UserPlus, Wallet, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, Dialog, DialogClose, Field, Input, Menu, PageHeader, Reveal, Segmented, Toggle, cn } from "@kalks/ui";
import { STAFF_MEMBERS, serverTime, staff, timeAgo } from "@kalks/mock/admin-clients";
import { ALERTS, ALERT_RULES, type AlertSeverity, type AlertType, type OpsAlert } from "@kalks/mock/admin-ops";
import { SEVERITY_BAR, SeverityChip } from "@/components/command/kit";

const TYPE_META: Record<AlertType, { label: string; icon: React.ReactNode }> = {
  feed: { label: "Feed", icon: <Radio /> },
  exposure: { label: "Exposure", icon: <Activity /> },
  finance: { label: "Finance", icon: <Landmark /> },
  aml: { label: "AML", icon: <ShieldAlert /> },
  wallet: { label: "Wallet", icon: <Wallet /> },
  system: { label: "System", icon: <Database /> },
};
const STATUS_TONE = { new: "ember", acknowledged: "info", assigned: "gold", resolved: "up" } as const;
const SEV_ICON: Record<AlertSeverity, string> = { critical: "border-down/30 bg-down-soft text-down", high: "border-ember/30 bg-ember-soft text-ember", medium: "border-warn/30 bg-warn-soft text-warn", low: "border-info/30 bg-info-soft text-info" };
const SEVS: AlertSeverity[] = ["critical", "high", "medium", "low"];

function AlertRow({ a, onChange }: { a: OpsAlert; onChange: (p: Partial<OpsAlert>) => void }) {
  const [open, setOpen] = React.useState(false);
  const who = a.assigneeId ? staff(a.assigneeId) : null;
  const resolved = a.status === "resolved";
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("k-row relative overflow-hidden", resolved && "opacity-60")}>
      <span className={cn("absolute inset-y-0 left-0 w-1", SEVERITY_BAR[a.severity], a.severity === "critical" && !resolved && "shadow-[0_0_14px_var(--k-down)]")} />
      <div className="flex flex-col gap-3 py-3 pl-5 pr-4 md:flex-row md:items-center">
        <span className={cn("hidden size-9 shrink-0 place-items-center rounded-full border md:grid [&_svg]:size-4", SEV_ICON[a.severity])}>{TYPE_META[a.type].icon}</span>
        <button className="min-w-0 flex-1 text-left" onClick={() => setOpen((o) => !o)}>
          <div className="flex flex-wrap items-center gap-2">
            <SeverityChip severity={a.severity} />
            <span className="text-[13.5px] font-medium">{a.title}</span>
            {a.severity === "critical" && a.status === "new" && <span className="size-2 animate-pulse-dot rounded-full bg-down text-down" />}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-fg-3">
            <span>{a.id}</span>·<span>{serverTime(a.time)}</span>·<span>{timeAgo(a.time)}</span>·<span className="uppercase">{a.type}</span>·<span>{a.source}</span>
          </div>
          <AnimatePresence>
            {open && (
              <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pt-2 text-[12.5px] text-fg-2">
                {a.detail}
              </motion.p>
            )}
          </AnimatePresence>
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <Chip size="sm" tone={STATUS_TONE[a.status]} dot className="capitalize">
            {a.status}
          </Chip>
          <Menu
            width={250}
            header={<div className="text-[11px] uppercase tracking-wider text-fg-3">Assign to</div>}
            items={STAFF_MEMBERS.slice(6).concat(STAFF_MEMBERS.slice(4, 6)).map((s) => ({
              label: s.name,
              hint: s.role.split(" ")[0],
              icon: <Avatar src={s.photo} name={s.name} size={20} />,
              onSelect: () => {
                onChange({ assigneeId: s.id, status: a.status === "resolved" ? "resolved" : "assigned" });
                toast.success(`Assigned to ${s.name}`, { description: a.title });
              },
            }))}
            trigger={
              who ? (
                <button className="flex items-center gap-1.5 rounded-full border border-line bg-surface-3/60 py-0.5 pl-0.5 pr-2.5 text-[12px] text-fg-2 hover:text-fg">
                  <Avatar src={who.photo} name={who.name} size={22} /> {who.name.split(" ")[0]}
                </button>
              ) : (
                <Button size="xs" variant="ghost">
                  <UserPlus /> Assign
                </Button>
              )
            }
          />
          {a.status === "new" && (
            <Button
              size="xs"
              variant="surface"
              onClick={() => {
                onChange({ status: "acknowledged" });
                toast.success("Acknowledged", { description: a.title });
              }}
            >
              <Check /> Ack
            </Button>
          )}
          {!resolved ? (
            <Button
              size="xs"
              variant="up-outline"
              onClick={() => {
                onChange({ status: "resolved" });
                toast.success("Alert resolved", { description: `${a.id} · resolution logged` });
              }}
            >
              Resolve
            </Button>
          ) : (
            <Button size="xs" variant="ghost" onClick={() => { onChange({ status: "new" }); toast("Alert re-opened"); }}>
              Re-open
            </Button>
          )}
          {a.href && (
            <Link href={a.href} className="grid size-7 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg" aria-label="Open source">
              <ArrowUpRight className="size-4" />
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function NewRuleDialog() {
  const [type, setType] = React.useState<AlertType>("exposure");
  const [sev, setSev] = React.useState<AlertSeverity>("high");
  return (
    <Dialog
      title="New alert rule"
      description="Rules evaluate every second against live platform metrics."
      trigger={
        <Button size="sm" variant="surface">
          <Plus /> New rule
        </Button>
      }
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="ember" size="sm" onClick={() => toast.success("Alert rule created", { description: `${TYPE_META[type].label} · ${sev}` })}>
              Create rule
            </Button>
          </DialogClose>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input defaultValue="NAS100 exposure warning" />
        </Field>
        <div>
          <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Type</div>
          <Segmented size="xs" value={type} onChange={setType} options={(Object.keys(TYPE_META) as AlertType[]).map((t) => ({ value: t, label: TYPE_META[t].label }))} />
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <Field label="Metric"><Input defaultValue="net_notional_pct(NAS100)" className="font-mono text-[13px]" /></Field>
          <span className="pb-3 font-mono text-fg-2">≥</span>
          <Field label="Threshold"><Input defaultValue="75" trailing="%" className="font-mono" /></Field>
        </div>
        <div>
          <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Severity</div>
          <Segmented size="xs" value={sev} onChange={setSev} options={SEVS.map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) }))} />
        </div>
        <Field label="Action"><Input defaultValue="Notify dealing desk · suggest 50% A-book hedge" /></Field>
      </div>
    </Dialog>
  );
}

export default function AlertsPage() {
  const [alerts, setAlerts] = React.useState(ALERTS);
  const [sev, setSev] = React.useState<"all" | AlertSeverity>("all");
  const [type, setType] = React.useState<"all" | AlertType>("all");
  const [status, setStatus] = React.useState<"open" | "resolved" | "all">("open");
  const [rules, setRules] = React.useState(ALERT_RULES);
  const [sound, setSound] = React.useState(true);

  const list = alerts.filter((a) => (sev === "all" || a.severity === sev) && (type === "all" || a.type === type) && (status === "all" || (status === "open" ? a.status !== "resolved" : a.status === "resolved")));
  const open = alerts.filter((a) => a.status !== "resolved");
  const update = (id: string, p: Partial<OpsAlert>) => setAlerts((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));

  return (
    <div className="pb-10">
      <PageHeader
        title="Alerts centre"
        subtitle="Feed, exposure, finance, AML, wallet and system alerts — acknowledge, assign, resolve."
        actions={
          <>
            <Button variant="surface" size="lg" onClick={() => { setSound((s) => !s); toast(sound ? "Sound alerts muted" : "Sound alerts on", { description: "Critical alerts always page on-call" }); }}>
              <Volume2 className={cn(!sound && "opacity-40")} /> {sound ? "Sound on" : "Muted"}
            </Button>
            <Button
              variant="ember"
              size="lg"
              onClick={() => {
                const n = alerts.filter((a) => a.status === "new").length;
                setAlerts((xs) => xs.map((x) => (x.status === "new" ? { ...x, status: "acknowledged" } : x)));
                toast.success(`${n} alerts acknowledged`);
              }}
            >
              <CheckCheck /> Acknowledge all new
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {SEVS.map((s, i) => {
          const n = open.filter((a) => a.severity === s).length;
          const on = sev === s;
          return (
            <Reveal key={s} delay={i * 0.04}>
              <button onClick={() => setSev(on ? "all" : s)} className={cn("k-card relative w-full overflow-hidden px-5 py-4 text-left transition-colors", on && "border-[var(--k-border-top)] bg-surface-3")}>
                <span className={cn("absolute inset-y-3 left-0 w-1 rounded-r-full", SEVERITY_BAR[s])} />
                <div className="k-label capitalize">{s}</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="k-num text-[30px] font-semibold leading-none">{n}</span>
                  <span className="text-[12px] text-fg-3">open</span>
                </div>
              </button>
            </Reveal>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
          <Card>
            <CardHeader title="Live alerts" subtitle={`${list.length} shown · ${open.length} open`} icon={<BellRing />} action={<Segmented size="xs" value={status} onChange={setStatus} options={[{ value: "open", label: "Open" }, { value: "resolved", label: "Resolved" }, { value: "all", label: "All" }]} />} />
            <div className="flex flex-wrap items-center gap-2 px-4 pt-4 sm:px-6">
              <Segmented size="xs" value={type} onChange={setType} options={[{ value: "all", label: "All types" }, ...(Object.keys(TYPE_META) as AlertType[]).map((t) => ({ value: t, label: TYPE_META[t].label }))]} />
              <Segmented size="xs" value={sev} onChange={setSev} options={[{ value: "all", label: "Any severity" }, ...SEVS.map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) }))]} />
            </div>
            <div className="mt-4 space-y-2 px-4 pb-5 sm:px-6">
              <AnimatePresence initial={false}>
                {list.map((a) => (
                  <AlertRow key={a.id} a={a} onChange={(p) => update(a.id, p)} />
                ))}
              </AnimatePresence>
              {list.length === 0 && <div className="py-14 text-center text-[13px] text-fg-3">No alerts match these filters.</div>}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.15} className="xl:col-span-4">
          <Card>
            <CardHeader title="Alert rules" subtitle={`${rules.filter((r) => r.enabled).length} of ${rules.length} active`} action={<NewRuleDialog />} />
            <div className="mt-4 space-y-2 px-4 pb-5 sm:px-6">
              {rules.map((r) => (
                <div key={r.id} className={cn("k-row px-4 py-3", !r.enabled && "opacity-60")}>
                  <div className="flex items-start gap-3">
                    <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-fg-2 [&_svg]:size-3.5")}>{TYPE_META[r.type].icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium">{r.name}</span>
                        <SeverityChip severity={r.severity} />
                      </div>
                      <div className="mt-1 text-[12px] leading-snug text-fg-2">{r.condition}</div>
                      <div className="mt-1 text-[11.5px] leading-snug text-fg-3">→ {r.action}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {r.channels.map((c) => (
                          <span key={c} className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10.5px] text-fg-2">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Toggle
                      checked={r.enabled}
                      label={`Toggle ${r.name}`}
                      onChange={(v) => {
                        setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, enabled: v } : x)));
                        toast.success(`${r.name} ${v ? "enabled" : "disabled"}`, { description: "Change recorded in audit log" });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
