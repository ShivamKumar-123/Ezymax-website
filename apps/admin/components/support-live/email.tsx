"use client";

// Content -> Email (live): what the platform emailed and whether it arrived, a retry for what did not, the
// switches, and the templates - an admin's own wording for a kind, previewed and test-sent before it is used.
// Everything comes from services/support (/v1/notifications/admin/email/…) through /api/support/email/….

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, Eye, Mail, MailX, RefreshCw, RotateCcw, Save, Search, Send, Settings2, SlidersHorizontal } from "lucide-react";
import { Button, Card, CardHeader, Chip, Dialog, EmptyState, Field, Input, KpiCard, Segmented, Tabs, Toggle, type ChipTone } from "@ezymex/ui";
import { TextArea } from "@/components/config/kit";
import { useConfirm } from "@/components/confirm";
import { ago, errMsg, sapi, usePerms } from "./common";

type Stats = {
  total: number; sent: number; failed: number; pending: number; logged: number; today: number; todaySent: number; todayFailed: number; week: number; birthdayMonth: number;
  successRate: number; smtp: boolean; enabled: boolean;
  relayPaused?: boolean; relaySince?: string | null; relayError?: string | null;
  byKind: { kind: string; n: number; sent: number; failed: number }[];
  byDay: { day: string; sent: number; failed: number }[];
};
type Log = { id: number; to: string; userId: number | null; kind: string; subject: string; status: "pending" | "sent" | "failed" | "logged"; attempts: number; error: string | null; providerMessageId: string | null; createdAt: string; sentAt: string | null; text?: string; html?: string };
type Override = { subject: string; title: string; body: string; enabled: boolean; updatedBy: string | null; updatedAt: string };
type Template = { kind: string; label: string; category: string; categoryLabel: string; sent30d: number; sample: { subject: string; text: string; sentAt: string | null } | null; override: Override | null };
type Settings = { enabled: boolean; offCategories: string[]; categories: { key: string; label: string; hint: string; locked: boolean; emailDefault: boolean }[]; smtp: boolean; from: string };
type Tab = "overview" | "logs" | "templates" | "settings";

const STATUS_TONE: Record<Log["status"], ChipTone> = { sent: "up", failed: "down", pending: "warn", logged: "neutral" };
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

export function LiveEmail() {
  const { can, loaded } = usePerms();
  const [tab, setTab] = React.useState<Tab>("overview");
  const write = can("notifications.write");
  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "logs", label: "Log" },
          { value: "templates", label: "Templates" },
          { value: "settings", label: "Switches" },
        ]}
      />
      {tab === "overview" && <Overview />}
      {tab === "logs" && <Logs write={write} />}
      {tab === "templates" && <Templates write={write} />}
      {tab === "settings" && <SettingsPane write={write} loaded={loaded} />}
    </div>
  );
}

/* ---------------- overview ---------------- */

function Overview() {
  const [s, setS] = React.useState<Stats | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const load = React.useCallback(async () => {
    const r = await sapi<Stats>("email/stats");
    if (!r.ok) return setErr(errMsg(r.data));
    setErr(null);
    setS(r.data);
  }, []);
  React.useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);
  if (err) return <EmptyState illustration="locked" title="Couldn't load the email dashboard" text={err} action={<Button variant="surface" size="sm" onClick={() => void load()}><RefreshCw /> Try again</Button>} />;
  if (!s) return <div className="py-10 text-center text-[13px] text-fg-3">Loading…</div>;
  const max = Math.max(1, ...s.byDay.map((d) => d.sent + d.failed));
  return (
    <div className="space-y-4">
      {!s.smtp && (
        <div className="flex items-center gap-2 rounded-[12px] border border-warn/30 bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
          <AlertTriangle className="size-4 shrink-0" /> SMTP is not configured on this server: emails are only logged, nothing is delivered.
        </div>
      )}
      {!s.enabled && (
        <div className="flex items-center gap-2 rounded-[12px] border border-down/30 bg-down-soft px-3 py-2 text-[12.5px] text-down">
          <MailX className="size-4 shrink-0" /> Notification emails are switched off (Switches tab). Security notices still go.
        </div>
      )}
      {s.relayPaused && (
        <div className="flex items-start gap-2 rounded-[12px] border border-down/30 bg-down-soft px-3 py-2 text-[12.5px] text-down">
          <MailX className="mt-0.5 size-4 shrink-0" />
          <span>
            Sending is paused since {when(s.relaySince ?? null)}: the relay is refusing every message, so nothing is being dropped and the queue keeps growing. It tries again every
            five minutes. {s.relayError ? <span className="text-fg-2">Relay said: {s.relayError}</span> : null}
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Sent" value={s.sent.toLocaleString("en-US")} icon={<Mail />} footer={`${s.todaySent} today · ${s.week} this week`} />
        <KpiCard label="Delivered to the relay" value={`${s.successRate}%`} icon={<CheckCircle2 />} chip={s.failed ? `${s.failed} failed` : "no failures"} chipTone={s.failed ? "down" : "up"} />
        <KpiCard label="Pending" value={s.pending.toLocaleString("en-US")} icon={<Clock />} footer="in the outbox, sending" />
        <KpiCard label="Birthday greetings" value={s.birthdayMonth.toLocaleString("en-US")} icon={<Send />} footer="this month" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Last 14 days" subtitle="Sent and failed, per day" />
          <div className="px-4 pb-4 sm:px-6">
            <div className="flex h-36 items-end gap-1.5">
              {s.byDay.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${d.day}: ${d.sent} sent, ${d.failed} failed`}>
                  <div className="flex w-full flex-col justify-end" style={{ height: "120px" }}>
                    <div className="w-full rounded-t-[3px] bg-down" style={{ height: `${(d.failed / max) * 120}px` }} />
                    <div className="w-full rounded-b-[3px] bg-ember" style={{ height: `${(d.sent / max) * 120}px` }} />
                  </div>
                  <span className="text-[9px] text-fg-3">{d.day.slice(8)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="By kind" subtitle="Last 30 days" />
          <div className="px-4 pb-3 sm:px-6">
            {s.byKind.length === 0 && <div className="py-6 text-center text-[13px] text-fg-3">Nothing sent in the last 30 days.</div>}
            {s.byKind.map((k) => (
              <div key={k.kind} className="flex items-center justify-between gap-3 border-b border-line py-2 text-[13px] last:border-b-0">
                <span className="truncate font-mono text-[12px]">{k.kind}</span>
                <span className="shrink-0 text-fg-2">
                  {k.n} · <span className="text-up">{k.sent}</span>{k.failed ? <> · <span className="text-down">{k.failed} failed</span></> : null}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- logs ---------------- */

function Logs({ write }: { write: boolean }) {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"all" | Log["status"]>("all");
  const [kind, setKind] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<{ items: Log[]; total: number; perPage: number } | null>(null);
  const [open, setOpen] = React.useState<Log | null>(null);
  const [busy, setBusy] = React.useState<number | null>(null);
  const load = React.useCallback(async () => {
    const p = new URLSearchParams({ page: String(page), per_page: "50" });
    if (q.trim()) p.set("q", q.trim());
    if (status !== "all") p.set("status", status);
    if (kind.trim()) p.set("kind", kind.trim());
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const r = await sapi<{ items: Log[]; total: number; perPage: number }>(`email/logs?${p}`);
    if (!r.ok) return toast.error("Couldn't load the email log", { description: errMsg(r.data) });
    setData(r.data);
  }, [q, status, kind, from, to, page]);
  React.useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);
  const retry = async (l: Log) => {
    setBusy(l.id);
    const r = await sapi(`email/logs/${l.id}/retry`, { method: "POST", body: {} });
    setBusy(null);
    if (!r.ok) return toast.error("Couldn't queue it again", { description: errMsg(r.data) });
    toast.success(`Email #${l.id} queued again`);
    void load();
  };
  const preview = async (l: Log) => {
    const r = await sapi<Log>(`email/logs/${l.id}`);
    if (!r.ok) return toast.error("Couldn't open the email", { description: errMsg(r.data) });
    setOpen(r.data);
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;
  return (
    <Card className="px-4 pb-4 pt-4 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input leading={<Search className="size-3.5" />} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Recipient or subject" className="w-full sm:w-64" />
        <Segmented size="xs" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: "all", label: "All" }, { value: "sent", label: "Sent" }, { value: "failed", label: "Failed" }, { value: "pending", label: "Pending" }, { value: "logged", label: "Logged" }]} />
        <Input value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} placeholder="kind, e.g. wallet.deposit_credited" className="w-full sm:w-64" inputClassName="font-mono text-[12px]" />
        <label className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 text-[12.5px] text-fg-3">
          From <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="bg-transparent text-fg outline-none" />
          to <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="bg-transparent text-fg outline-none" />
        </label>
        <Button variant="surface" size="sm" onClick={() => void load()}><RefreshCw /> Refresh</Button>
        {data && <span className="ms-auto text-[12.5px] text-fg-3">{data.total.toLocaleString("en-US")} emails</span>}
      </div>
      {!data && <div className="py-10 text-center text-[13px] text-fg-3">Loading…</div>}
      {data && data.items.length === 0 && <EmptyState illustration="empty" title="No emails match" text="Try another status, kind or date range." />}
      {data && data.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-fg-3">
                <th className="py-2 pe-3 font-medium">When</th><th className="py-2 pe-3 font-medium">To</th><th className="py-2 pe-3 font-medium">Kind</th><th className="py-2 pe-3 font-medium">Subject</th><th className="py-2 pe-3 font-medium">Status</th><th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((l) => (
                <tr key={l.id} className="border-b border-line last:border-b-0">
                  <td className="whitespace-nowrap py-2.5 pe-3 text-fg-2" title={l.createdAt}>{when(l.createdAt)}</td>
                  <td className="max-w-[220px] truncate py-2.5 pe-3">{l.to}{l.userId ? <span className="text-fg-3"> · #{l.userId}</span> : null}</td>
                  <td className="whitespace-nowrap py-2.5 pe-3 font-mono text-[12px] text-fg-2">{l.kind}</td>
                  <td className="max-w-[320px] truncate py-2.5 pe-3">{l.subject}</td>
                  <td className="whitespace-nowrap py-2.5 pe-3">
                    <Chip tone={STATUS_TONE[l.status]}>{l.status}</Chip>
                    {l.attempts > 1 && <span className="ms-1 text-[11px] text-fg-3">×{l.attempts}</span>}
                    {l.error && <div className="mt-0.5 max-w-[260px] truncate text-[11px] text-down" title={l.error}>{l.error}</div>}
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-right">
                    <Button size="xs" variant="ghost" onClick={() => void preview(l)}><Eye /> Open</Button>
                    {write && l.status !== "sent" && <Button size="xs" variant="surface" disabled={busy === l.id} onClick={() => void retry(l)}><RotateCcw /> Retry</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-[12.5px] text-fg-3">
          <Button size="xs" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          Page {page} of {pages}
          <Button size="xs" variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)} title={open?.subject ?? ""} description={open ? `${open.kind} · to ${open.to} · ${open.status}${open.providerMessageId ? ` · relay: ${open.providerMessageId}` : ""}` : undefined} width={760}>
        {open?.html ? <iframe title="Email preview" srcDoc={open.html} sandbox="" className="h-[70vh] w-full rounded-[12px] border border-line bg-black" /> : <pre className="whitespace-pre-wrap text-[12.5px]">{open?.text}</pre>}
      </Dialog>
    </Card>
  );
}

/* ---------------- templates ---------------- */

function Templates({ write }: { write: boolean }) {
  const [confirm, confirmDialog] = useConfirm();
  const [items, setItems] = React.useState<Template[] | null>(null);
  const [vars, setVars] = React.useState<string[]>([]);
  const [filter, setFilter] = React.useState("");
  const [edit, setEdit] = React.useState<Template | null>(null);
  const [subject, setSubject] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [enabled, setEnabled] = React.useState(true);
  const [preview, setPreview] = React.useState<{ subject: string; html: string } | null>(null);
  const [testTo, setTestTo] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const load = React.useCallback(async () => {
    const r = await sapi<{ items: Template[]; variables: string[] }>("email/templates");
    if (!r.ok) return toast.error("Couldn't load the templates", { description: errMsg(r.data) });
    setItems(r.data.items);
    setVars(r.data.variables);
  }, []);
  React.useEffect(() => void load(), [load]);
  const openEdit = (t: Template) => {
    setEdit(t);
    setSubject(t.override?.subject ?? "{{title}}");
    setTitle(t.override?.title ?? "{{title}}");
    setBody(t.override?.body ?? "{{body}}");
    setEnabled(t.override?.enabled ?? true);
    setPreview(null);
  };
  const doPreview = async () => {
    if (!edit) return;
    const r = await sapi<{ subject: string; html: string }>(`email/templates/${edit.kind}/preview`, { method: "POST", body: { subject, title, body } });
    if (!r.ok) return toast.error("Couldn't render the preview", { description: errMsg(r.data) });
    setPreview(r.data);
  };
  const save = async () => {
    if (!edit) return;
    setBusy(true);
    const r = await sapi(`email/templates/${edit.kind}`, { method: "PUT", body: { subject, title, body, enabled } });
    setBusy(false);
    if (!r.ok) return toast.error("Not saved", { description: errMsg(r.data) });
    toast.success(`Template saved for ${edit.kind}`);
    setEdit(null);
    void load();
  };
  const reset = async (t: Template) => {
    if (!(await confirm({ title: "Restore the default wording?", text: `${t.kind} goes back to the words the platform writes itself.`, confirm: "Restore" }))) return;
    const r = await sapi(`email/templates/${t.kind}`, { method: "DELETE" });
    if (!r.ok) return toast.error("Not restored", { description: errMsg(r.data) });
    toast.success(`${t.kind} uses the default wording again`);
    setEdit(null);
    void load();
  };
  const test = async () => {
    if (!edit) return;
    if (!testTo.includes("@")) return toast.error("Enter the address to send the test to");
    setBusy(true);
    const r = await sapi(`email/templates/${edit.kind}/test`, { method: "POST", body: { to: testTo, subject, title, body } });
    setBusy(false);
    if (!r.ok) return toast.error("Test not sent", { description: errMsg(r.data) });
    toast.success(`Test email queued to ${testTo}`);
  };
  const shown = items?.filter((t) => !filter.trim() || `${t.kind} ${t.label} ${t.categoryLabel}`.toLowerCase().includes(filter.trim().toLowerCase())) ?? null;
  return (
    <Card className="px-4 pb-4 pt-4 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input leading={<Search className="size-3.5" />} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a kind" className="w-full sm:w-72" />
        <span className="text-[12.5px] text-fg-3">Variables: {vars.map((v) => <code key={v} className="me-1.5 rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px]">{v}</code>)}</span>
      </div>
      {!shown && <div className="py-10 text-center text-[13px] text-fg-3">Loading…</div>}
      {shown && (
        <div className="divide-y divide-line">
          {shown.map((t) => (
            <div key={t.kind} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">
                  {t.label}
                  <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-normal text-fg-2">{t.kind}</code>
                  <Chip tone="neutral">{t.categoryLabel || t.category}</Chip>
                  {t.override && <Chip tone={t.override.enabled ? "info" : "neutral"}>{t.override.enabled ? "custom wording" : "custom, off"}</Chip>}
                </div>
                <div className="mt-0.5 truncate text-[12.5px] text-fg-3">
                  {t.sample ? <>Last sent: "{t.sample.subject}"{t.sample.sentAt ? ` · ${ago(t.sample.sentAt)}` : ""}</> : "Not sent yet"} · {t.sent30d} in 30 days
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button size="xs" variant="surface" onClick={() => openEdit(t)}><SlidersHorizontal /> {write ? "Edit" : "View"}</Button>
                {write && t.override && <Button size="xs" variant="ghost" onClick={() => void reset(t)}><RotateCcw /> Restore</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit ? `${edit.label}` : ""} description={edit ? `${edit.kind} · the words {{title}} and {{body}} stand for what the platform writes itself; anything else you type replaces it.` : undefined} width={900}>
        {edit && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!write} /></Field>
              <Field label="Headline"><Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!write} /></Field>
              <Field label="Body" hint="Blank line between paragraphs."><TextArea value={body} onChange={setBody} rows={10} /></Field>
              <div className="flex items-center gap-3">
                <Toggle checked={enabled} onChange={setEnabled} label="Use this wording" />
                <span className="text-[12.5px] text-fg-2">Use this wording {enabled ? "(on)" : "(off - kept, not used)"}</span>
              </div>
              {edit.sample && (
                <details className="rounded-[10px] border border-line bg-surface-2 p-3 text-[12.5px]">
                  <summary className="cursor-pointer font-medium">The platform's own wording (last sent)</summary>
                  <pre className="mt-2 whitespace-pre-wrap text-fg-2">{edit.sample.text}</pre>
                </details>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="surface" size="sm" onClick={() => void doPreview()}><Eye /> Preview</Button>
                {write && <Button variant="ember" size="sm" disabled={busy} onClick={() => void save()}><Save /> Save</Button>}
              </div>
              {write && (
                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" className="w-64" />
                  <Button variant="surface" size="sm" disabled={busy} onClick={() => void test()}><Send /> Send a test</Button>
                  <span className="text-[12px] text-fg-3">Sent to that address only, never to a client.</span>
                </div>
              )}
            </div>
            <div className="min-h-[420px]">
              {preview ? (
                <>
                  <div className="mb-1 text-[12.5px] text-fg-3">Subject: <span className="text-fg">{preview.subject}</span></div>
                  <iframe title="Template preview" srcDoc={preview.html} sandbox="" className="h-[560px] w-full rounded-[12px] border border-line bg-black" />
                </>
              ) : (
                <div className="flex h-full items-center justify-center rounded-[12px] border border-dashed border-line text-[13px] text-fg-3">Press Preview to see the email with sample values.</div>
              )}
            </div>
          </div>
        )}
      </Dialog>
      {confirmDialog}
    </Card>
  );
}

/* ---------------- switches ---------------- */

function SettingsPane({ write, loaded }: { write: boolean; loaded: boolean }) {
  const [confirm, confirmDialog] = useConfirm();
  const [s, setS] = React.useState<Settings | null>(null);
  const load = React.useCallback(async () => {
    const r = await sapi<Settings>("email/settings");
    if (!r.ok) return toast.error("Couldn't load the switches", { description: errMsg(r.data) });
    setS(r.data);
  }, []);
  React.useEffect(() => void load(), [load]);
  const put = async (patch: { enabled?: boolean; offCategories?: string[] }) => {
    const r = await sapi<Settings>("email/settings", { method: "PUT", body: patch });
    if (!r.ok) return toast.error("Not saved", { description: errMsg(r.data) });
    setS(r.data);
    toast.success("Saved");
  };
  const toggleAll = async (v: boolean) => {
    if (!v && !(await confirm({ title: "Switch every notification email off?", text: "Deposit, withdrawal, trading, KYC and support emails stop for every client until this is switched back on. Security notices (new sign-in, password changes) still go.", confirm: "Switch off", tone: "danger" }))) return;
    void put({ enabled: v });
  };
  if (!s) return <div className="py-10 text-center text-[13px] text-fg-3">Loading…</div>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="All notification emails" subtitle={`Sent as ${s.from}${s.smtp ? "" : " · SMTP not configured"}`} />
        <div className="flex items-center justify-between gap-3 px-4 pb-4 sm:px-6">
          <div className="text-[13px] text-fg-2">Every email the platform sends from a notification. Codes (sign-in, verification, reset) and security notices are never affected.</div>
          <Toggle checked={s.enabled} onChange={(v) => write && void toggleAll(v)} label="All notification emails" />
        </div>
      </Card>
      <Card>
        <CardHeader title="Per category" subtitle="Off here = off for every client, whatever their own preference says" />
        <div className="px-4 pb-3 sm:px-6">
          {s.categories.map((c) => {
            const off = s.offCategories.includes(c.key);
            return (
              <div key={c.key} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[13.5px] font-medium">{c.label}{c.locked && <Chip tone="neutral">always on</Chip>}</div>
                  <div className="text-[12px] text-fg-3">{c.hint}</div>
                </div>
                {c.locked ? <span className="text-[12px] text-fg-3">Cannot be switched off</span> : <Toggle checked={!off} onChange={(v) => write && void put({ offCategories: v ? s.offCategories.filter((k) => k !== c.key) : [...s.offCategories, c.key] })} label={c.label} />}
              </div>
            );
          })}
        </div>
      </Card>
      {loaded && !write && <div className="text-[12.5px] text-fg-3 lg:col-span-2"><Settings2 className="me-1 inline size-3.5" /> Your role can see these switches but not change them.</div>}
      {confirmDialog}
    </div>
  );
}
