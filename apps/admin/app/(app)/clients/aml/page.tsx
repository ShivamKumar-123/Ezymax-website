"use client";

import * as React from "react";
import { AlertTriangle, FileWarning, Gavel, Plus, Radar, RefreshCw, Scale, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  CopyButton,
  DataTable,
  Dialog,
  DialogClose,
  Field,
  Input,
  KpiCard,
  Menu,
  PageHeader,
  Reveal,
  Segmented,
  Stepper,
  Toggle,
  cn,
  formatMoney,
  shortHash,
  type Column,
} from "@ezymex/ui";
import { AML_CASES, AML_RULES, COMPLIANCE_STAFF, getClient, serverTime, staff, timeAgo, type AmlCase } from "@ezymex/mock/admin-clients";
import { ClientCell, ReasonDialog } from "@/components/command/kit";

const RISK_TONE = { low: "info", medium: "warn", high: "ember", critical: "down" } as const;
const STATUS_TONE = { open: "warn", investigating: "info", escalated: "ember", sar_filed: "down", closed: "up" } as const;
const STATUS_LABEL = { open: "Open", investigating: "Investigating", escalated: "Escalated · MLRO", sar_filed: "SAR filed", closed: "Closed" } as const;
const SAR_LABEL = { not_required: "Not required", pending: "Pending decision", drafting: "Drafting", filed: "Filed" } as const;
const SAR_STEP = { not_required: 0, pending: 0, drafting: 1, filed: 3 } as const;

function CaseDrawer({ c, onClose, onUpdate }: { c: AmlCase | null; onClose: () => void; onUpdate: (id: string, p: Partial<AmlCase>) => void }) {
  const [note, setNote] = React.useState("");
  const [dlg, setDlg] = React.useState<"escalate" | "sar" | "close" | null>(null);
  if (!c) return null;
  const cl = getClient(c.clientId);
  const who = staff(c.assigneeId);
  const addEvent = (text: string, p: Partial<AmlCase> = {}) => onUpdate(c.id, { ...p, timeline: [...c.timeline, { time: new Date().toISOString(), who: "Priya Nair", text }] });
  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()} side="right" title={`${c.id} · ${c.rule}`} description={`Rule ${c.ruleId} · opened ${timeAgo(c.opened)} · ${formatMoney(c.amount)}`}>
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <ClientCell client={cl} size={40} sub={`#${cl.id} · ${cl.countryName} · net dep. ${formatMoney(cl.net, "USD", 0)}`} />
            <div className="flex gap-1.5">
              <Chip tone={RISK_TONE[c.risk]} className="capitalize">{c.risk} risk</Chip>
              <Chip tone={STATUS_TONE[c.status]} dot>{STATUS_LABEL[c.status]}</Chip>
            </div>
          </div>
          <div className="k-row px-4 py-3.5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-fg-2">SAR filing</span>
              <Chip size="sm" tone={c.sar === "filed" ? "down" : c.sar === "drafting" ? "warn" : "neutral"}>{SAR_LABEL[c.sar]}</Chip>
            </div>
            <Stepper steps={["Draft", "MLRO review", "Filed with FIU"]} current={SAR_STEP[c.sar]} />
          </div>
          <div>
            <div className="mb-2 text-[12.5px] font-medium text-fg-2">Linked transactions</div>
            <div className="space-y-1.5">
              {c.txs.map((t) => (
                <div key={t.id} className="k-row flex items-center gap-3 px-3.5 py-2">
                  <Chip size="sm" tone={t.type === "Deposit" ? "up" : "down"}>{t.type}</Chip>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 font-mono text-[11.5px] text-fg-2">
                      {shortHash(t.hash, 8, 6)} <CopyButton value={t.hash} label="Hash" />
                    </div>
                    <div className="truncate font-mono text-[10.5px] text-fg-3">{t.type === "Deposit" ? "from" : "to"} {shortHash(t.counterparty, 6, 6)}</div>
                  </div>
                  <div className="text-right">
                    <div className="k-num font-mono text-[12.5px]">{formatMoney(t.amount)}</div>
                    <div className="text-[10.5px] text-fg-3">{serverTime(t.time)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[12.5px] font-medium text-fg-2">Timeline</div>
            <ol className="relative space-y-3 pl-5 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-line">
              {c.timeline.map((e, i) => (
                <li key={i} className="relative">
                  <span className={cn("absolute -left-5 top-1.5 size-[11px] rounded-full border-2 border-surface", e.who === "System" ? "bg-fg-3" : "bg-ember")} />
                  <div className="text-[12.5px]">{e.text}</div>
                  <div className="font-mono text-[10.5px] text-fg-3">{serverTime(e.time)} · {e.who}</div>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <div className="mb-2 text-[12.5px] font-medium text-fg-2">Notes</div>
            <ul className="mb-2 space-y-1.5">
              {c.notes.map((n, i) => (
                <li key={i} className="rounded-[12px] bg-surface-2 px-3 py-2 text-[12.5px] text-fg-2">{n}</li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add investigation note…" className="h-9 flex-1" />
              <Button size="sm" variant="surface" disabled={!note.trim()} onClick={() => { onUpdate(c.id, { notes: [...c.notes, note] }); setNote(""); toast.success("Note added to case"); }}>
                <Send /> Add
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <Menu
              width={240}
              items={COMPLIANCE_STAFF.map((s) => ({ label: s.name, hint: s.role, icon: <Avatar src={s.photo} name={s.name} size={20} />, onSelect: () => { addEvent(`Re-assigned to ${s.name}`, { assigneeId: s.id }); toast.success(`Case assigned to ${s.name}`); } }))}
              trigger={
                <Button size="sm" variant="surface">
                  <Avatar src={who.photo} name={who.name} size={18} /> {who.name.split(" ")[0]}
                </Button>
              }
            />
            <Button size="sm" variant="surface" onClick={() => setDlg("escalate")}>
              <Scale /> Escalate to MLRO
            </Button>
            <Button size="sm" variant="ember" onClick={() => setDlg("sar")}>
              <Gavel /> File SAR
            </Button>
            <Button size="sm" variant="up-outline" className="ml-auto" onClick={() => setDlg("close")}>
              Close case
            </Button>
          </div>
        </div>
      </Dialog>
      <ReasonDialog open={dlg === "escalate"} onOpenChange={(o) => !o && setDlg(null)} title="Escalate to MLRO" codes={["ESC-01 · Source of funds unclear", "ESC-02 · Pattern across linked accounts", "ESC-03 · Sanctions / PEP exposure", "ESC-04 · Client uncooperative"]} confirmLabel="Escalate" successMessage="Escalated to MLRO (Noura Khalid)" onConfirm={() => addEvent("Escalated to MLRO", { status: "escalated", sar: c.sar === "not_required" ? "pending" : c.sar })} />
      <ReasonDialog open={dlg === "sar"} onOpenChange={(o) => !o && setDlg(null)} title="File Suspicious Activity Report" description="Submitted to the FIU via goAML. Tipping-off rules apply — do not inform the client." codes={["SAR-01 · Structuring", "SAR-02 · Unexplained source of funds", "SAR-03 · Third-party funding", "SAR-04 · Sanctions evasion suspected"]} confirmLabel="File SAR" confirmVariant="sell" successMessage="SAR filed · ref FIU-26-08902" onConfirm={() => addEvent("SAR filed with FIU (ref FIU-26-08902)", { status: "sar_filed", sar: "filed" })} />
      <ReasonDialog open={dlg === "close"} onOpenChange={(o) => !o && setDlg(null)} title="Close case" codes={["CLS-01 · Explained · documents satisfactory", "CLS-02 · False positive", "CLS-03 · Account offboarded", "CLS-04 · SAR filed · monitoring"]} confirmLabel="Close case" confirmVariant="buy" successMessage="Case closed · withdrawal hold released" onConfirm={() => addEvent("Case closed", { status: "closed" })} />
    </>
  );
}

function AddRuleDialog() {
  const [sev, setSev] = React.useState<"low" | "medium" | "high" | "critical">("high");
  return (
    <Dialog
      title="New monitoring rule"
      description="Evaluated on every deposit, withdrawal and transfer in real time."
      trigger={<Button size="sm" variant="surface"><Plus /> Add rule</Button>}
      footer={
        <>
          <DialogClose asChild><Button size="sm" variant="ghost">Cancel</Button></DialogClose>
          <DialogClose asChild><Button size="sm" variant="ember" onClick={() => toast.success("AML rule R-109 created", { description: "Runs in shadow mode for 7 days before alerting" })}>Create rule</Button></DialogClose>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Rule name"><Input defaultValue="Velocity — 5+ deposits in 24h" /></Field>
        <div className="rounded-[14px] border border-line bg-surface-2 p-3">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-fg-3">Conditions (all)</div>
          <div className="flex flex-wrap gap-1.5">
            {["count(deposits, 24h) ≥ 5", "sum(deposits, 24h) ≥ $5,000", "lots_traded(24h) < 1"].map((c) => (
              <span key={c} className="rounded-full border border-ember/30 bg-ember-soft px-3 py-1 font-mono text-[11.5px]">{c}</span>
            ))}
            <button onClick={() => toast("Condition builder", { description: "Pick a metric, operator and threshold" })} className="rounded-full border border-dashed border-fg-3/50 px-3 py-1 text-[11.5px] text-fg-3 hover:text-fg">+ condition</button>
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Severity</div>
          <Segmented size="xs" value={sev} onChange={setSev} options={["low", "medium", "high", "critical"] as const} />
        </div>
        <Field label="Action"><Input defaultValue="Open case · hold withdrawals · notify compliance" /></Field>
      </div>
    </Dialog>
  );
}

export default function AmlPage() {
  const [cases, setCases] = React.useState(AML_CASES);
  const [rules, setRules] = React.useState(AML_RULES.map((r) => ({ id: r.id as string, name: r.name as string, desc: r.desc as string, severity: r.severity as "low" | "medium" | "high" | "critical", enabled: r.enabled as boolean, hits: r.hits as number })));
  const [filter, setFilter] = React.useState<"active" | "all" | "closed">("active");
  const [open, setOpen] = React.useState<string | null>(null);
  const [screening, setScreening] = React.useState(false);
  const rows = cases.filter((c) => filter === "all" || (filter === "closed" ? c.status === "closed" : c.status !== "closed"));
  const update = (id: string, p: Partial<AmlCase>) => setCases((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const active = cases.filter((c) => c.status !== "closed");

  const cols: Column<AmlCase>[] = [
    { key: "id", header: "Case", cell: (r) => <span className="whitespace-nowrap font-mono text-[12px]">{r.id}</span> },
    { key: "c", header: "Client", cell: (r) => <ClientCell client={getClient(r.clientId)} size={28} /> },
    { key: "rule", header: "Rule triggered", cell: (r) => <span className="whitespace-nowrap text-[12.5px]">{r.rule}<span className="block font-mono text-[10.5px] text-fg-3">{r.ruleId}</span></span> },
    { key: "amt", header: "Amount", align: "right", cell: (r) => <span className="k-num font-mono text-[12.5px]">{formatMoney(r.amount)}</span>, sort: (r) => r.amount },
    { key: "risk", header: "Risk", cell: (r) => <Chip size="sm" tone={RISK_TONE[r.risk]} className="capitalize">{r.risk}</Chip>, sort: (r) => ["low", "medium", "high", "critical"].indexOf(r.risk) },
    { key: "st", header: "Status", cell: (r) => <Chip size="sm" tone={STATUS_TONE[r.status]} dot>{STATUS_LABEL[r.status]}</Chip> },
    { key: "as", header: "Assignee", cell: (r) => { const s = staff(r.assigneeId); return <span className="flex items-center gap-2"><Avatar src={s.photo} name={s.name} size={22} /><span className="text-[12px]">{s.name.split(" ")[0]}</span></span>; } },
    { key: "op", header: "Opened", cell: (r) => <span className="text-[12px] text-fg-3">{timeAgo(r.opened)}</span>, sort: (r) => r.opened },
    { key: "sar", header: "SAR", cell: (r) => <span className={cn("text-[12px]", r.sar === "filed" ? "text-down" : r.sar === "drafting" ? "text-warn" : "text-fg-3")}>{SAR_LABEL[r.sar]}</span> },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="AML cases"
        subtitle="Transaction monitoring, sanctions & PEP re-screening and case management."
        actions={
          <Button variant="ember" size="lg" onClick={() => toast.success("Manual case opened", { description: "AML-3391 · assign a client to continue" })}>
            <Plus /> Open case
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Active cases" icon={<ShieldAlert />} value={<span className="k-num">{active.length}</span>} chip={`${active.filter((c) => c.risk === "high" || c.risk === "critical").length} high / critical`} chipTone="ember" />
        <KpiCard label="Funds on hold" icon={<FileWarning />} value={<span className="k-num">{formatMoney(active.reduce((s, c) => s + c.amount, 0), "USD", 0)}</span>} chip="Withdrawals auto-held" chipTone="warn" delay={0.04} />
        <KpiCard label="SARs filed (YTD)" icon={<Gavel />} value={<span className="k-num">{7 + cases.filter((c) => c.sar === "filed").length}</span>} chip="goAML · FIU" delay={0.08} />
        <KpiCard label="Avg time to close" icon={<Radar />} value={<span className="k-num">2.4d</span>} chip="SLA 5 days" chipTone="up" delay={0.12} />
      </div>

      <Reveal delay={0.1} className="mt-4">
          <Card className="px-4 py-5 sm:px-6">
            <DataTable
              columns={cols}
              rows={rows}
              dense
              pageSize={10}
              rowKey={(r) => r.id}
              onRowClick={(r) => setOpen(r.id)}
              exportName="aml-cases"
              search={(r) => `${r.id} ${r.rule} ${getClient(r.clientId).name}`}
              toolbar={<Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: "active", label: `Active ${active.length}` }, { value: "closed", label: "Closed" }, { value: "all", label: "All" }]} />}
            />
          </Card>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-8">
        <Card>
          <CardHeader title="Transaction monitoring rules" subtitle={`${rules.filter((r) => r.enabled).length} of ${rules.length} enabled · hits over 30 days`} action={<AddRuleDialog />} />
          <div className="mt-4 grid grid-cols-1 gap-2 px-4 pb-5 sm:px-6">
            {rules.map((r) => (
              <div key={r.id} className={cn("k-row flex items-start gap-3 px-4 py-3", !r.enabled && "opacity-60")}>
                <span className="mt-0.5 font-mono text-[11px] text-fg-3">{r.id}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">{r.name}</span>
                    <Chip size="sm" tone={RISK_TONE[r.severity]} className="capitalize">{r.severity}</Chip>
                  </div>
                  <div className="mt-0.5 text-[12px] leading-snug text-fg-3">{r.desc}</div>
                </div>
                <div className="text-right">
                  <div className="k-num font-mono text-[14px] font-semibold">{r.hits}</div>
                  <div className="text-[10px] text-fg-3">hits</div>
                </div>
                <Toggle
                  checked={r.enabled}
                  label={`Toggle ${r.name}`}
                  onChange={(v) => {
                    setRules((xs) => xs.map((x) => (x.id === r.id ? { ...x, enabled: v } : x)));
                    toast.success(`${r.id} ${v ? "enabled" : "disabled"}`, { description: "Change recorded in audit log" });
                  }}
                />
              </div>
            ))}
          </div>
        </Card>
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-4">
          <Card className="h-full">
            <CardHeader title="Sanctions & PEP re-screening" subtitle="Nightly at 02:00 GMT+3 · 1,400+ lists" icon={<Radar />} />
            <div className="grid grid-cols-2 gap-2 px-6 pt-4">
              {[
                ["Last run", "Today 02:00"],
                ["Clients screened", "11,604"],
                ["New matches", "1 PEP"],
                ["False positives cleared", "38"],
              ].map(([k, v]) => (
                <div key={k} className="k-row px-3.5 py-2.5">
                  <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{k}</div>
                  <div className={cn("k-num mt-0.5 text-[14px] font-medium", v.includes("PEP") && "text-warn")}>{v}</div>
                </div>
              ))}
            </div>
            <div className="mx-6 mt-3 flex items-start gap-2 rounded-[12px] border border-warn/30 bg-warn-soft px-3 py-2.5 text-[12px] text-fg-2">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" /> Hassan Karimi matched PEP Tier 2 — linked to KYB-2044 (Meridian Capital).
            </div>
            <div className="px-6 pb-6 pt-4">
              <Button
                className="w-full"
                variant="surface"
                disabled={screening}
                onClick={() => {
                  setScreening(true);
                  toast("Re-screening 11,604 clients…");
                  setTimeout(() => {
                    setScreening(false);
                    toast.success("Re-screen complete", { description: "0 new matches · 3 list updates applied" });
                  }, 1800);
                }}
              >
                <RefreshCw className={cn(screening && "animate-spin")} /> {screening ? "Screening…" : "Run re-screen now"}
              </Button>
            </div>
          </Card>
        </Reveal>
      </div>
      <CaseDrawer c={cases.find((c) => c.id === open) ?? null} onClose={() => setOpen(null)} onUpdate={update} />
    </div>
  );
}
