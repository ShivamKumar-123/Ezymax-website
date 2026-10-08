"use client";

// Analytics → Regulatory exports and Scheduled reports (D120, D145) on the reports service.

import * as React from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Download, FileSpreadsheet, FileText, History, Mail, Pencil, Play, Plus, ShieldCheck, Trash2, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, Dialog, Field, IconButton, Input, KpiCard, PageHeader, Reveal, Segmented, Toggle, cn, formatDateTime, type Column } from "@ezymex/ui";
import { useCan } from "@/components/staff-session";
import { ReportFailed, ReportLoading, download, reportsApi, useReport } from "./common";
import { useConfirm } from "@/components/confirm";

const SELECT = "h-11 w-full rounded-[14px] border border-line bg-surface-2 px-3 text-sm text-fg outline-none transition-colors focus:border-ember/50";

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const addDay = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/* ------------------------------------------------------------------ */
/* Regulatory exports                                                  */
/* ------------------------------------------------------------------ */

type AuditItem = { id: number; at: string; actor: string; actorName: string; actorRole: string; action: string; target: string | null; detail: Record<string, unknown> | null };

const REG = [
  { key: "transactions", title: "Transactions report", icon: <FileText />, text: "Every deposit, withdrawal, transfer, adjustment, credit and bonus with the client's identity, country, status and reference.", period: true },
  { key: "clients", title: "Client list", icon: <Users />, text: "All clients with country, KYC status, referral, live and demo accounts, first deposit and lifetime deposits / withdrawals.", period: false },
  { key: "trades", title: "Deals report", icon: <FileSpreadsheet />, text: "Every entry and exit deal on live accounts: client, group, symbol, volume, price, P&L, swap, commission and book.", period: true },
  { key: "aml", title: "AML review list", icon: <AlertTriangle />, text: "Large single movements, deposits withdrawn within 72 hours with little trading, and open IB fraud flags.", period: true },
] as const;

function RegCard({ r, canExport }: { r: (typeof REG)[number]; canExport: boolean }) {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = React.useState(isoDay(monthStart));
  const [to, setTo] = React.useState(isoDay(today));
  const [large, setLarge] = React.useState("10000");
  const valid = !r.period || (from && to && from <= to);
  const go = (f: "csv" | "xlsx") => {
    const q = new URLSearchParams({ format: f });
    if (r.period) {
      q.set("from", from);
      q.set("to", addDay(to));
    }
    if (r.key === "aml" && /^\d+$/.test(large)) q.set("large", large);
    download(`/api/reports/export/${r.key}?${q}`, `${r.title} · ${f.toUpperCase()}`);
  };
  return (
    <Card className="flex h-full flex-col">
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 text-fg-2 [&_svg]:size-[18px]">{r.icon}</span>
          <div className="min-w-0">
            <div className="text-[15px] font-medium">{r.title}</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-fg-3">{r.text}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {r.period ? (
            <>
              <Field label="From">
                <Input type="date" value={from} max={isoDay(today)} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="To">
                <Input type="date" value={to} max={isoDay(today)} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </>
          ) : (
            <div className="col-span-2 rounded-[14px] border border-dashed border-line px-4 py-3 text-[12.5px] text-fg-3">Current state of every client, generated now.</div>
          )}
          {r.key === "aml" && (
            <Field label="Large movement from (USD)" className="col-span-2">
              <Input inputMode="numeric" value={large} onChange={(e) => setLarge(e.target.value.replace(/\D/g, ""))} />
            </Field>
          )}
        </div>
        <div className="mt-auto flex items-center justify-end gap-2 pt-4">
          <Button size="sm" variant="surface" disabled={!canExport || !valid} onClick={() => go("csv")}>
            <Download /> CSV
          </Button>
          <Button size="sm" variant="ember" disabled={!canExport || !valid} onClick={() => go("xlsx")}>
            <Download /> Excel
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function LiveRegulatory() {
  const canExport = useCan("reports.export");
  const audit = useReport<{ items: AuditItem[] }>("audit?limit=200");
  const exports = (audit.data?.items ?? []).filter((a) => a.action === "report.export" || a.action === "statement.download");
  const cols: Column<AuditItem>[] = [
    { key: "at", header: "When", sort: (a) => a.at, cell: (a) => <span className="k-num text-fg-2">{formatDateTime(a.at)}</span> },
    { key: "what", header: "Export", cell: (a) => <span className="font-medium">{a.action === "statement.download" ? `Statement #${a.target}` : (REG.find((r) => r.key === a.target)?.title ?? a.target)}</span> },
    { key: "fmt", header: "Format", cell: (a) => <Chip size="sm">{String(a.detail?.format ?? "").toUpperCase() || "—"}</Chip> },
    { key: "rows", header: "Rows", align: "right", cell: (a) => <span className="k-num text-fg-2">{a.detail?.rows !== undefined ? String(a.detail.rows) : "—"}</span>, hideOn: "md" },
    { key: "who", header: "By", cell: (a) => <span className="text-fg-2">{a.actorName || a.actor}</span> },
  ];
  return (
    <div className="pb-16">
      <PageHeader title="Regulatory exports" subtitle="Transactions, client list, deals and AML review list as CSV or Excel · every export is written to the audit log" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Exports (latest 200 audit rows)" icon={<History />} value={<span className="k-num">{exports.length}</span>} chip="Audited" chipTone="neutral" />
        <KpiCard label="Your access" icon={<ShieldCheck />} value={<span className="text-[18px] font-semibold">{canExport ? "Export" : "View only"}</span>} chip={canExport ? "reports.export" : "Needs reports.export"} chipTone={canExport ? "up" : "warn"} delay={0.05} />
        <KpiCard label="Times" icon={<CalendarClock />} value={<span className="text-[18px] font-semibold">Server time</span>} chip="GMT+3 in US DST, else GMT+2" chipTone="neutral" delay={0.1} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {REG.map((r, i) => (
          <Reveal key={r.key} delay={0.04 * i}>
            <RegCard r={r} canExport={canExport} />
          </Reveal>
        ))}
      </div>
      <Reveal delay={0.1} className="mt-4">
        <Card>
          <CardHeader title="Export history" subtitle="Report exports and statement downloads by staff and clients" icon={<History />} />
          <div className="mt-4 px-4 pb-5 sm:px-6">
            {audit.error && !audit.data ? (
              <div className="py-6 text-[13px] text-fg-3">{audit.error}</div>
            ) : (
              <DataTable columns={cols} rows={exports} pageSize={10} rowKey={(a) => String(a.id)} empty={<div className="py-8 text-center text-[13px] text-fg-3">No exports yet.</div>} />
            )}
          </div>
        </Card>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scheduled reports                                                   */
/* ------------------------------------------------------------------ */

type Schedule = {
  id: number;
  name: string;
  report: string;
  reportLabel: string;
  format: "xlsx" | "csv";
  frequency: "daily" | "weekly" | "monthly";
  weekday: number;
  monthDay: number;
  hour: number;
  recipients: string[];
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  nextRunAt: string;
};
type Run = { id: number; scheduleId: number; name: string; at: string; trigger: string; status: string; from: string; to: string; recipients: string[]; bytes: number; error: string | null };
type SchedulesR = { items: Schedule[]; runs: Run[]; reports: { key: string; label: string }[]; email: boolean };
type Draft = Omit<Schedule, "id" | "reportLabel" | "createdBy" | "createdAt" | "updatedBy" | "lastRunAt" | "lastStatus" | "nextRunAt"> & { id?: number };

/** Server day (GMT+3 approximation, as the periods start at server midnight) of a period bound; `end` = exclusive end. */
const serverDay = (iso: string, end = false) => new Date(Date.parse(iso) + 3 * 3600_000 - (end ? 1 : 0)).toISOString().slice(0, 10);
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FREQ_TONE = { daily: "ember", weekly: "gold", monthly: "info" } as const;
const EMPTY: Draft = { name: "", report: "pnl", format: "xlsx", frequency: "daily", weekday: 1, monthDay: 1, hour: 7, recipients: [], enabled: true };

function when(s: Pick<Schedule, "frequency" | "weekday" | "monthDay" | "hour">) {
  const t = `${String(s.hour).padStart(2, "0")}:00`;
  if (s.frequency === "weekly") return `Weekly · ${DOW[s.weekday - 1]} ${t}`;
  if (s.frequency === "monthly") return `Monthly · day ${s.monthDay} ${t}`;
  return `Daily · ${t}`;
}

function ScheduleForm({ draft, reports, onClose, onSaved }: { draft: Draft; reports: SchedulesR["reports"]; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = React.useState<Draft>(draft);
  const [recipients, setRecipients] = React.useState(draft.recipients.join(", "));
  const [busy, setBusy] = React.useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const list = recipients.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  const bad = list.filter((x) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
  const save = async () => {
    setBusy(true);
    try {
      const body = { ...d, recipients: list };
      delete (body as { id?: number }).id;
      await reportsApi(d.id ? `schedules/${d.id}` : "schedules", { method: d.id ? "PUT" : "POST", body });
      toast.success(d.id ? "Schedule updated" : "Schedule created", { description: `${d.name} · ${when(d)}` });
      onSaved();
      onClose();
    } catch (e) {
      toast.error("Couldn't save the schedule", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      width={560}
      title={d.id ? "Edit scheduled report" : "New scheduled report"}
      description="Emailed as an attachment with a summary of the totals. Times are server time."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="ember" onClick={save} disabled={busy || d.name.trim().length < 2 || list.length === 0 || bad.length > 0}>
            {busy ? "Saving…" : "Save schedule"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input value={d.name} maxLength={80} placeholder="Daily broker P&L" onChange={(e) => set("name", e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Report">
            <select className={SELECT} value={d.report} onChange={(e) => set("report", e.target.value)}>
              {reports.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Format">
            <Segmented value={d.format} onChange={(v) => set("format", v)} options={[{ value: "xlsx", label: "Excel" }, { value: "csv", label: "CSV" }]} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Frequency">
            <select className={SELECT} value={d.frequency} onChange={(e) => set("frequency", e.target.value as Draft["frequency"])}>
              <option value="daily">Daily (previous day)</option>
              <option value="weekly">Weekly (previous 7 days)</option>
              <option value="monthly">Monthly (previous month)</option>
            </select>
          </Field>
          {d.frequency === "weekly" ? (
            <Field label="Day">
              <select className={SELECT} value={d.weekday} onChange={(e) => set("weekday", Number(e.target.value))}>
                {DOW.map((x, i) => <option key={x} value={i + 1}>{x}</option>)}
              </select>
            </Field>
          ) : d.frequency === "monthly" ? (
            <Field label="Day of month">
              <select className={SELECT} value={d.monthDay} onChange={(e) => set("monthDay", Number(e.target.value))}>
                {Array.from({ length: 28 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
              </select>
            </Field>
          ) : (
            <div />
          )}
          <Field label="Time (server)">
            <select className={SELECT} value={d.hour} onChange={(e) => set("hour", Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
            </select>
          </Field>
        </div>
        <Field label="Recipients" hint="Up to 20 email addresses, separated by commas" error={bad.length ? `Not an email address: ${bad.join(", ")}` : undefined}>
          <textarea className="min-h-[80px] w-full rounded-[14px] border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-fg outline-none transition-colors focus:border-ember/50" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="finance@ezymex.com, ceo@ezymex.com" />
        </Field>
        <div className="flex items-center justify-between rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-[13px] text-fg-2">
          Enabled
          <Toggle checked={d.enabled} onChange={(v) => set("enabled", v)} label="Enabled" />
        </div>
      </div>
    </Dialog>
  );
}

export function LiveScheduled() {
  const [ask, confirmDialog] = useConfirm();
  const can = useCan("reports.export");
  const { data, error, loading, reload } = useReport<SchedulesR>("schedules");
  const [editing, setEditing] = React.useState<Draft | null>(null);
  const [busy, setBusy] = React.useState<number | null>(null);
  const act = async (s: Schedule, what: "run" | "delete" | "toggle") => {
    setBusy(s.id);
    try {
      if (what === "run") {
        const r = await reportsApi<{ run: { status: string; error: string | null } }>(`schedules/${s.id}/run`, { method: "POST" });
        if (r.run.status === "failed") toast.error("Report run failed", { description: r.run.error ?? undefined });
        else toast.success(r.run.status === "sent" ? "Report sent" : "Report generated", { description: r.run.status === "sent" ? s.recipients.join(", ") : "Email is not configured: the run is logged" });
      } else if (what === "delete") {
        await reportsApi(`schedules/${s.id}`, { method: "DELETE" });
        toast.success("Schedule deleted", { description: s.name });
      } else {
        const { id: _i, reportLabel: _r, createdBy: _c, createdAt: _ca, updatedBy: _u, lastRunAt: _l, lastStatus: _ls, nextRunAt: _n, ...rest } = s;
        await reportsApi(`schedules/${s.id}`, { method: "PUT", body: { ...rest, enabled: !s.enabled } });
        toast.success(s.enabled ? "Schedule paused" : "Schedule enabled", { description: s.name });
      }
      reload();
    } catch (e) {
      toast.error("Action failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  };
  const cols: Column<Schedule>[] = [
    {
      key: "name",
      header: "Report",
      cell: (s) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13.5px] font-medium">
            <span className="truncate">{s.name}</span>
            {!s.enabled && <Chip size="sm">Paused</Chip>}
          </div>
          <div className="truncate text-[11.5px] text-fg-3">{s.reportLabel} · {s.format.toUpperCase()}</div>
        </div>
      ),
    },
    { key: "when", header: "Schedule", cell: (s) => <Chip size="sm" tone={FREQ_TONE[s.frequency]}>{when(s)}</Chip> },
    { key: "to", header: "Recipients", cell: (s) => <span className="flex items-center gap-1.5 text-[12.5px] text-fg-2"><Mail className="size-3.5" />{s.recipients.length === 1 ? s.recipients[0] : `${s.recipients[0]} +${s.recipients.length - 1}`}</span>, hideOn: "md" },
    {
      key: "last",
      header: "Last run",
      cell: (s) =>
        s.lastRunAt ? (
          <span className="flex items-center gap-1.5 text-[12.5px]">
            {s.lastStatus === "failed" ? <XCircle className="size-3.5 text-down" /> : <CheckCircle2 className="size-3.5 text-up" />}
            <span className="text-fg-2">{formatDateTime(s.lastRunAt)}</span>
          </span>
        ) : (
          <span className="text-[12.5px] text-fg-3">Never</span>
        ),
      hideOn: "lg",
    },
    { key: "next", header: "Next run", sort: (s) => s.nextRunAt, cell: (s) => <span className="k-num text-[12.5px] text-fg-2">{s.enabled ? formatDateTime(s.nextRunAt) : "—"}</span> },
    {
      key: "act",
      header: "",
      align: "right",
      cell: (s) =>
        can ? (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Toggle checked={s.enabled} onChange={() => act(s, "toggle")} label="Enabled" />
            <IconButton aria-label="Send now" disabled={busy === s.id} onClick={() => act(s, "run")}><Play /></IconButton>
            <IconButton aria-label="Edit" onClick={() => setEditing({ id: s.id, name: s.name, report: s.report, format: s.format, frequency: s.frequency, weekday: s.weekday, monthDay: s.monthDay, hour: s.hour, recipients: s.recipients, enabled: s.enabled })}><Pencil /></IconButton>
            <IconButton aria-label="Delete" disabled={busy === s.id} onClick={() => void ask({ title: `Delete “${s.name}”?`, text: "The schedule stops and its history stays.", confirm: "Delete", tone: "danger" }).then((ok) => { if (ok) void act(s, "delete"); })}><Trash2 /></IconButton>
          </div>
        ) : null,
    },
  ];
  const runCols: Column<Run>[] = [
    { key: "at", header: "When", sort: (r) => r.at, cell: (r) => <span className="k-num text-fg-2">{formatDateTime(r.at)}</span> },
    { key: "n", header: "Schedule", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "p", header: "Period", cell: (r) => <span className="k-num text-[12.5px] text-fg-2">{serverDay(r.from)} → {serverDay(r.to, true)}</span>, hideOn: "md" },
    { key: "t", header: "Trigger", cell: (r) => <Chip size="sm">{r.trigger}</Chip>, hideOn: "lg" },
    { key: "s", header: "Status", cell: (r) => <Chip size="sm" tone={r.status === "sent" ? "up" : r.status === "failed" ? "down" : "gold"}>{r.status}</Chip> },
    { key: "e", header: "Detail", cell: (r) => <span className={cn("text-[12px]", r.error ? "text-down" : "text-fg-3")}>{r.error ?? `${(r.bytes / 1024).toFixed(1)} KB · ${r.recipients.length} recipient${r.recipients.length === 1 ? "" : "s"}`}</span> },
  ];
  return (
    <div className="pb-16">
      {confirmDialog}
      <PageHeader
        title="Scheduled reports"
        subtitle="Daily, weekly and monthly reports emailed to staff as Excel or CSV · times in server time"
        actions={
          can ? (
            <Button variant="ember" onClick={() => setEditing({ ...EMPTY })}>
              <Plus /> New schedule
            </Button>
          ) : undefined
        }
      />
      {loading && !data ? <ReportLoading /> : error && !data ? <ReportFailed message={error} onRetry={reload} /> : data ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard label="Active schedules" icon={<CalendarClock />} value={<span className="k-num">{data.items.filter((s) => s.enabled).length}</span>} chip={`${data.items.length} total`} chipTone="ember" />
            <KpiCard label="Runs (latest 50)" icon={<History />} value={<span className="k-num">{data.runs.length}</span>} chip={`${data.runs.filter((r) => r.status === "failed").length} failed`} chipTone={data.runs.some((r) => r.status === "failed") ? "down" : "up"} delay={0.05} />
            <KpiCard label="Email delivery" icon={<Mail />} value={<span className="text-[18px] font-semibold">{data.email ? "SMTP relay" : "Not configured"}</span>} chip={data.email ? "Reports are emailed" : "Runs are logged only"} chipTone={data.email ? "up" : "warn"} delay={0.1} />
          </div>
          <Reveal delay={0.05} className="mt-4">
            <Card>
              <CardHeader title="Schedules" subtitle={can ? "Toggle, send now, edit or delete" : "View only: changes need reports.export"} icon={<CalendarClock />} />
              <div className="mt-4 px-4 pb-5 sm:px-6">
                <DataTable columns={cols} rows={data.items} pageSize={10} rowKey={(s) => String(s.id)} empty={<div className="py-8 text-center text-[13px] text-fg-3">No scheduled reports yet.</div>} />
              </div>
            </Card>
          </Reveal>
          <Reveal delay={0.1} className="mt-4">
            <Card>
              <CardHeader title="Delivery log" subtitle="Latest 50 runs" icon={<History />} />
              <div className="mt-4 px-4 pb-5 sm:px-6">
                <DataTable columns={runCols} rows={data.runs} pageSize={10} rowKey={(r) => String(r.id)} empty={<div className="py-8 text-center text-[13px] text-fg-3">No runs yet.</div>} />
              </div>
            </Card>
          </Reveal>
          {editing && <ScheduleForm draft={editing} reports={data.reports} onClose={() => setEditing(null)} onSaved={reload} />}
        </>
      ) : null}
    </div>
  );
}
