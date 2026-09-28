"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowUpRight, Building2, Check, CheckCircle2, ClipboardCheck, Clock, FileQuestion, History, Info, MessageSquare, ShieldAlert, UserRound, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Button, Card, CardHeader, Chip, Dialog, DialogClose, EmptyState, Flag, KeyValue, PageHeader, Reveal, Skeleton, Toggle, buttonVariants, cn } from "@kalks/ui";
import { ErrorState, Mono, ago, countryName, day, sendJson, useApi, useNow, when } from "@/components/live/kit";
import type { CaseDetail, CaseDoc, ClientChecks, ServerChecks, Slot } from "./types";
import { CaseStatusChip, SlaBadge, idTypeLabel } from "./ui";
import { DocumentViewer } from "./viewer";

function age(dob: string) {
  const d = new Date(dob + "T00:00:00Z");
  const n = new Date();
  let a = n.getUTCFullYear() - d.getUTCFullYear();
  if (n.getUTCMonth() < d.getUTCMonth() || (n.getUTCMonth() === d.getUTCMonth() && n.getUTCDate() < d.getUTCDate())) a -= 1;
  return a;
}

function Section({ title, icon, children, action, className }: { title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title={title} icon={icon} action={action} />
      <div className="px-4 pb-5 pt-3 sm:px-6">{children}</div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Automatic checks per document                                        */
/* ------------------------------------------------------------------ */

type Cell = { state: "ok" | "warn" | "fail" | "na"; text: string; title?: string };

function cells(d: CaseDoc): Record<string, Cell> {
  const c: ClientChecks = d.checks.client ?? {};
  const s: ServerChecks = d.checks.server ?? {};
  const na: Cell = { state: "na", text: "—" };
  return {
    format: s.format ? { state: s.format.matches_declared ? "ok" : "warn", text: s.format.detected.replace("image/", "").replace("application/", "").toUpperCase(), title: s.format.matches_declared ? "Content matches the declared type" : `Declared ${s.format.declared}` } : na,
    resolution: s.resolution?.width ? { state: s.resolution.ok === false ? "fail" : "ok", text: `${s.resolution.width}×${s.resolution.height}`, title: `Minimum ${s.resolution.min_side}px` } : na,
    sharpness: c.blur ? { state: c.blur.ok ? "ok" : "warn", text: c.blur.ok ? "Sharp" : "Blurry", title: `Laplacian variance ${c.blur.score}` } : na,
    glare: c.glare ? { state: c.glare.ok ? "ok" : "warn", text: `${c.glare.pct}%`, title: "Share of clipped highlights" } : na,
    lighting: c.brightness ? { state: c.brightness.ok ? "ok" : "warn", text: String(c.brightness.mean), title: "Mean luminance (0-255)" } : na,
    framing: c.fill ? { state: c.fill.ok ? "ok" : "warn", text: `${Math.round(c.fill.ratio * 100)}%`, title: "Document area in the image" } : na,
    mrz: c.mrz ? { state: c.mrz.found ? "ok" : "warn", text: c.mrz.found ? `${c.mrz.lines} lines` : "Not found" } : na,
    face: c.face ? { state: c.face.found ? "ok" : "warn", text: c.face.found ? "Found" : "Not found", title: c.face.method === "face_detector" ? "Browser face detector" : "Brightness / contrast heuristic" } : na,
    date: s.issue_date?.date ? { state: s.issue_date.ok ? "ok" : "fail", text: day(s.issue_date.date) } : na,
    duplicate: { state: (s.duplicate_other_clients ?? 0) > 0 ? "fail" : "ok", text: (s.duplicate_other_clients ?? 0) > 0 ? `Seen ×${s.duplicate_other_clients}` : "Unique", title: (s.duplicate_other_clients ?? 0) > 0 ? `Identical file uploaded by ${s.duplicate_other_clients} other client(s)` : undefined },
  };
}

const CELL_TONE = { ok: "text-up", warn: "text-warn", fail: "text-down", na: "text-fg-3" };
const COLS = [
  ["format", "Type"],
  ["resolution", "Resolution"],
  ["sharpness", "Sharpness"],
  ["glare", "Glare"],
  ["lighting", "Lighting"],
  ["framing", "Framing"],
  ["mrz", "MRZ"],
  ["face", "Face"],
  ["date", "Issued"],
  ["duplicate", "Duplicate"],
] as const;

function ChecksTable({ docs }: { docs: CaseDoc[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-[12.5px]" data-testid="checks-table">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-fg-3">
            <th className="py-2 pr-3 font-medium">Document</th>
            {COLS.map(([k, l]) => (
              <th key={k} className="px-2 py-2 font-medium">
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => {
            const c = cells(d);
            return (
              <tr key={d.id} className="border-b border-line/60 last:border-0">
                <td className="py-2.5 pr-3">
                  <div className="font-medium">{d.label}</div>
                  <div className="text-[11px] text-fg-3">
                    {d.checks.client?.source === "camera" ? "Camera capture" : d.checks.client?.skipped ? "File · checked by reviewer" : "File upload"} · {ago(d.created_at, Date.now())}
                  </div>
                </td>
                {COLS.map(([k]) => (
                  <td key={k} className={cn("px-2 py-2.5", CELL_TONE[c[k]!.state])} title={c[k]!.title}>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      {c[k]!.state === "ok" ? <Check className="size-3.5" /> : c[k]!.state === "warn" ? <AlertTriangle className="size-3.5" /> : c[k]!.state === "fail" ? <X className="size-3.5" /> : null}
                      {c[k]!.text}
                    </span>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-fg-3">Sharpness, glare, lighting, framing, MRZ and face are measured in the client&apos;s browser before upload; type, resolution, dates and duplicates are verified by the gateway.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Decision                                                            */
/* ------------------------------------------------------------------ */

function RejectDialog({ d, open, onClose, onDone }: { d: CaseDetail; open: boolean; onClose: () => void; onDone: () => void }) {
  const [code, setCode] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [resubmit, setResubmit] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  async function go() {
    setBusy(true);
    const r = await sendJson(`/api/admin/kyc/cases/${d.case.id}/reject`, { reason_code: code, message, allow_resubmit: resubmit });
    setBusy(false);
    if (!r.ok) return toast.error(r.error.message);
    toast.success("Verification rejected", { description: `${d.user.name} has been emailed the reason.` });
    onDone();
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Reject verification"
      description={`${d.user.name} · ${d.case.reference}. The client is emailed the reason and your message.`}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button variant="down-outline" disabled={!code || busy || (code === "other" && message.trim().length < 5)} onClick={() => void go()} data-testid="confirm-reject">
            <XCircle /> Reject
          </Button>
        </>
      }
    >
      <div className="space-y-2" role="radiogroup" aria-label="Reason">
        {d.reasons.map((r) => (
          <label key={r.code} className={cn("flex cursor-pointer items-center gap-3 rounded-[12px] border px-3 py-2.5 text-[13px]", code === r.code ? "border-down/50 bg-down-soft" : "border-line hover:border-fg-3")}>
            <input type="radio" name="reason" value={r.code} checked={code === r.code} onChange={() => setCode(r.code)} className="accent-[var(--k-down)]" />
            {r.label}
          </label>
        ))}
      </div>
      <label className="mt-4 block text-[12.5px] font-medium text-fg-2">
        Message to the client {code === "other" ? "(required)" : "(optional)"}
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000} className="mt-1.5 w-full rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-ember/50" aria-label="Message to the client" />
      </label>
      <div className="mt-3 flex items-center justify-between gap-3 text-[13px]">
        <span>
          Allow the client to start again
          <span className="block text-[11.5px] text-fg-3">Turn off for fraud or restricted countries.</span>
        </span>
        <Toggle checked={resubmit} onChange={setResubmit} label="Allow resubmission" />
      </div>
    </Dialog>
  );
}

function MoreInfoDialog({ d, open, onClose, onDone }: { d: CaseDetail; open: boolean; onClose: () => void; onDone: () => void }) {
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const key = (s: Slot) => `${s.kind}|${s.side}|${s.party ?? ""}`;
  async function go() {
    setBusy(true);
    const items = d.required.filter((r) => sel.has(key(r))).map((r) => ({ kind: r.kind, side: r.side, party: r.party ?? null }));
    const r = await sendJson(`/api/admin/kyc/cases/${d.case.id}/request-info`, { items, message });
    setBusy(false);
    if (!r.ok) return toast.error(r.error.message);
    toast.success("More information requested", { description: `${d.user.name} has been emailed the list.` });
    onDone();
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Request more information"
      description="The client uploads only the documents you pick; everything else is kept."
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button variant="ember" disabled={!sel.size || busy} onClick={() => void go()} data-testid="confirm-request">
            <FileQuestion /> Send request
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        {d.required.map((r) => {
          const k = key(r);
          return (
            <label key={k} className={cn("flex cursor-pointer items-center gap-3 rounded-[12px] border px-3 py-2.5 text-[13px]", sel.has(k) ? "border-ember/50 bg-ember-soft/40" : "border-line hover:border-fg-3")}>
              <input
                type="checkbox"
                checked={sel.has(k)}
                onChange={() =>
                  setSel((s) => {
                    const n = new Set(s);
                    if (n.has(k)) n.delete(k);
                    else n.add(k);
                    return n;
                  })
                }
                className="size-4 accent-[var(--k-ember)]"
                aria-label={r.label}
              />
              {r.label}
            </label>
          );
        })}
      </div>
      <label className="mt-4 block text-[12.5px] font-medium text-fg-2">
        What should the client fix?
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000} placeholder="e.g. The statement must show your full name and be less than 3 months old." className="mt-1.5 w-full rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-[13px] outline-none placeholder:text-fg-3 focus:border-ember/50" aria-label="Message to the client" />
      </label>
    </Dialog>
  );
}

function DecisionCard({ d, onChanged }: { d: CaseDetail; onChanged: () => void }) {
  const open = d.case.status === "submitted" || d.case.status === "in_review";
  const [ticks, setTicks] = React.useState<Record<string, boolean>>(() => ({ ...d.case.checklist }));
  const [risk, setRisk] = React.useState<string>(d.case.risk_level ?? "low");
  const [busy, setBusy] = React.useState(false);
  const [dlg, setDlg] = React.useState<"reject" | "info" | null>(null);
  const all = d.checklist.every((c) => ticks[c.key]);
  const canAct = d.can_review && open;

  async function approve() {
    setBusy(true);
    const r = await sendJson(`/api/admin/kyc/cases/${d.case.id}/approve`, { checklist: ticks, risk_level: risk });
    setBusy(false);
    if (!r.ok) return toast.error(r.error.message);
    toast.success("Identity verified", { description: `${d.user.name} can now withdraw. Name and date of birth are locked.` });
    onChanged();
  }

  return (
    <Section title="Review" icon={<ClipboardCheck />} action={<CaseStatusChip status={d.case.status} />}>
      {d.case.status === "approved" ? (
        <div className="flex items-start gap-3 rounded-[14px] border border-up/30 bg-up-soft px-4 py-3 text-[13px]">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-up" />
          <div>
            Approved {when(d.case.decided_at)} by {d.case.reviewer?.name ?? "staff"}. Level {d.case.level} · risk {d.case.risk_level ?? "—"}.
          </div>
        </div>
      ) : d.case.status === "rejected" ? (
        <div className="rounded-[14px] border border-down/30 bg-down-soft px-4 py-3 text-[13px]">
          <div className="font-medium text-down">Rejected: {d.case.decision?.label}</div>
          {d.case.decision?.message && <div className="mt-1 text-fg-2">&ldquo;{d.case.decision.message}&rdquo;</div>}
          <div className="mt-1 text-[11.5px] text-fg-3">
            {when(d.case.decided_at)} · {d.case.allow_resubmit ? "Client may start again" : "Resubmission blocked"}
          </div>
        </div>
      ) : d.case.status === "more_info" ? (
        <div className="rounded-[14px] border border-warn/40 bg-warn-soft px-4 py-3 text-[13px]">
          <div className="font-medium">Waiting for the client</div>
          <ul className="mt-1 list-inside list-disc text-fg-2">
            {d.case.requested_labels.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          {d.case.request_message && <div className="mt-1 text-[12px] text-fg-3">&ldquo;{d.case.request_message}&rdquo;</div>}
        </div>
      ) : null}

      {open && (
        <>
          <div className="space-y-1.5" data-testid="checklist">
            {d.checklist.map((c) => (
              <label key={c.key} className={cn("flex cursor-pointer items-start gap-3 rounded-[12px] border px-3 py-2.5 text-[13px] transition-colors", ticks[c.key] ? "border-up/40 bg-up-soft/50" : "border-line hover:border-fg-3", !canAct && "pointer-events-none opacity-60")}>
                <input type="checkbox" checked={!!ticks[c.key]} onChange={(e) => setTicks((t) => ({ ...t, [c.key]: e.target.checked }))} className="mt-0.5 size-4 accent-[var(--k-up)]" aria-label={c.label} />
                {c.label}
              </label>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-[13px]">
            <span className="text-fg-2">Risk rating</span>
            <select value={risk} onChange={(e) => setRisk(e.target.value)} disabled={!canAct} className="h-9 rounded-full border border-line bg-surface-2 px-3 text-[12.5px] outline-none" aria-label="Risk rating">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          {d.missing && (
            <div className="mt-3 flex items-start gap-2 rounded-[12px] border border-warn/40 bg-warn-soft px-3 py-2 text-[12.5px]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" /> {d.missing.message}
            </div>
          )}
          <div className="mt-4 grid grid-cols-1 gap-2">
            <Button variant="buy" disabled={!canAct || !all || busy || !!d.missing} onClick={() => void approve()} data-testid="approve">
              <Check /> {all ? "Approve" : `Approve · tick ${d.checklist.filter((c) => !ticks[c.key]).length} more`}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="surface" disabled={!canAct} onClick={() => setDlg("info")} data-testid="request-info">
                <FileQuestion /> More info
              </Button>
              <Button variant="down-outline" disabled={!canAct} onClick={() => setDlg("reject")} data-testid="reject">
                <XCircle /> Reject
              </Button>
            </div>
          </div>
          {!d.can_review && <p className="mt-2 text-[11.5px] text-fg-3">Your role can view KYC cases but not decide them.</p>}
        </>
      )}
      {d.case.status === "more_info" && d.can_review && (
        <Button variant="down-outline" size="sm" className="mt-3 w-full" onClick={() => setDlg("reject")}>
          <XCircle /> Reject instead
        </Button>
      )}
      <RejectDialog d={d} open={dlg === "reject"} onClose={() => setDlg(null)} onDone={() => { setDlg(null); onChanged(); }} />
      <MoreInfoDialog d={d} open={dlg === "info"} onClose={() => setDlg(null)} onDone={() => { setDlg(null); onChanged(); }} />
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Details, notes, timeline                                             */
/* ------------------------------------------------------------------ */

function Details({ d }: { d: CaseDetail }) {
  const c = d.case;
  const a = c.details.address;
  const co = c.details.company;
  const fmtAddr = (x: { line1: string; line2: string; city: string; postcode: string; country: string }) => [x.line1, x.line2, x.city, x.postcode, countryName(x.country)].filter(Boolean).join(", ");
  return (
    <Section title={c.kind === "corporate" ? "Company and people" : "Client details"} icon={c.kind === "corporate" ? <Building2 /> : <UserRound />}>
      <KeyValue
        rows={[
          ["Legal name", <span key="n" className="font-medium">{d.user.name}</span>],
          ["Date of birth", `${day(d.user.date_of_birth)} · ${age(d.user.date_of_birth)} years`],
          ["Country", <span key="c" className="inline-flex items-center gap-2"><Flag country={d.user.country} className="size-4" />{countryName(d.user.country)}</span>],
          ...(c.kind === "individual"
            ? ([
                ["ID document", idTypeLabel(c.id_doc_type)],
                ["Address", a ? <span key="a" className="text-right">{fmtAddr(a)}</span> : "—"],
              ] as [React.ReactNode, React.ReactNode][])
            : []),
          ["Name / DOB lock", d.user.identity_locked_at ? `Locked ${day(d.user.identity_locked_at)}` : "Not locked"],
        ]}
      />
      {co && (
        <div className="mt-4 rounded-[14px] border border-line p-3">
          <div className="text-[13.5px] font-medium">{co.name}</div>
          <div className="mt-0.5 text-[12px] text-fg-3">
            Reg. <Mono className="text-[12px]">{co.reg_number}</Mono> · {countryName(co.country)} · incorporated {day(co.incorporated_on)}
          </div>
          {co.business && <div className="mt-1 text-[12px] text-fg-2">{co.business}</div>}
          <div className="mt-1 text-[12px] text-fg-2">{fmtAddr(co.address)}</div>
          <div className="mt-3 space-y-1.5">
            {(c.details.parties ?? []).map((p) => (
              <div key={p.key} className="flex items-center justify-between gap-2 text-[12.5px]">
                <span>
                  {p.first_name} {p.last_name} <span className="text-fg-3">· {day(p.date_of_birth)} · {p.nationality.toUpperCase()}</span>
                </span>
                <span className="flex gap-1">
                  {p.roles.map((r) => (
                    <Chip key={r} size="sm" tone={r === "ubo" ? "gold" : "neutral"}>
                      {r === "ubo" ? `UBO ${p.ownership ?? 0}%` : "Director"}
                    </Chip>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}

function Notes({ d, onChanged }: { d: CaseDetail; onChanged: () => void }) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  async function add() {
    setBusy(true);
    const r = await sendJson(`/api/admin/kyc/cases/${d.case.id}/notes`, { body: text });
    setBusy(false);
    if (!r.ok) return toast.error(r.error.message);
    setText("");
    toast.success("Note added");
    onChanged();
  }
  return (
    <Section title="Internal notes" icon={<MessageSquare />}>
      {d.can_review && (
        <div className="mb-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000} placeholder="Visible to staff only" className="w-full rounded-[12px] border border-line bg-surface-2 px-3 py-2 text-[13px] outline-none placeholder:text-fg-3 focus:border-ember/50" aria-label="Internal note" />
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="surface" disabled={!text.trim() || busy} onClick={() => void add()}>
              Add note
            </Button>
          </div>
        </div>
      )}
      {d.notes.length === 0 ? (
        <p className="text-[12.5px] text-fg-3">No notes yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {d.notes.map((n) => (
            <li key={n.id} className="text-[12.5px]">
              <div className="text-fg">{n.body}</div>
              <div className="mt-0.5 text-[11px] text-fg-3">
                {n.staff.name} · {when(n.at)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

const EVENT_LABEL: Record<string, string> = {
  started: "Client started verification",
  submitted: "Documents submitted",
  resubmitted: "Requested documents resubmitted",
  review_started: "Review started",
  more_info_requested: "More information requested",
  approved: "Approved",
  rejected: "Rejected",
};

function Timeline({ d }: { d: CaseDetail }) {
  const tick = useNow();
  const now = Math.max(tick, Date.now());
  return (
    <Section title="Timeline" icon={<Clock />}>
      <ol className="relative space-y-3 border-l border-line pl-5">
        {d.timeline
          .slice()
          .reverse()
          .map((e) => (
            <li key={e.id} className="relative">
              <span className={cn("absolute -left-[25px] top-1.5 size-2.5 rounded-full ring-4 ring-surface", e.kind === "approved" ? "bg-up" : e.kind === "rejected" ? "bg-down" : e.kind === "more_info_requested" ? "bg-warn" : "bg-fg-3")} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-medium">{EVENT_LABEL[e.kind] ?? e.kind}</span>
                <span className="text-[11.5px] text-fg-3" title={when(e.at, true)}>
                  {ago(e.at, now)}
                </span>
              </div>
              {e.kind === "more_info_requested" && Array.isArray(e.meta.labels) && <div className="mt-0.5 text-[11.5px] text-fg-3">{(e.meta.labels as string[]).join(", ")}</div>}
              {e.kind === "rejected" && typeof e.meta.reason === "string" && <div className="mt-0.5 text-[11.5px] text-fg-3">{e.meta.reason}</div>}
            </li>
          ))}
      </ol>
      {d.history.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-fg-2">
            <History className="size-3.5" /> Earlier cases
          </div>
          {d.history.map((h) => (
            <Link key={h.id} href={`/clients/kyc/${h.id}`} className="flex items-center justify-between py-1 text-[12px] hover:text-fg">
              <Mono className="text-[12px] text-fg-2">{h.reference}</Mono>
              <span className="text-fg-3">
                {h.status} {h.decision_label ? `· ${h.decision_label}` : ""}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function KycCaseView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = /^\d{1,18}$/.test(params.id ?? "") ? Number(params.id) : null;
  const { data: d, error, reload } = useApi<CaseDetail>(id ? `/api/admin/kyc/cases/${id}` : null);
  const now = useNow(15_000);
  const claimed = React.useRef(false);

  // opening a waiting case takes it for review (the client's tracker switches to "In review")
  React.useEffect(() => {
    if (!d || claimed.current || !d.can_review || d.case.status !== "submitted") return;
    claimed.current = true;
    void sendJson(`/api/admin/kyc/cases/${d.case.id}/claim`, {}).then((r) => r.ok && reload());
  }, [d, reload]);

  const back = (
    <Link href="/clients/kyc" className={buttonVariants({ variant: "surface" })}>
      <ArrowLeft /> Queue
    </Link>
  );
  if (!id) return <EmptyState title="Case not found" illustration="magnifying_glass_tilted_left" action={back} />;
  if (error) return <div className="pt-6"><ErrorState error={error} onRetry={reload} /></div>;
  if (!d)
    return (
      <div className="space-y-4 pt-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-[520px] w-full" />
      </div>
    );
  const docs = d.documents;
  const dupes = d.flags.duplicate_documents;
  return (
    <div className="pb-10">
      <PageHeader
        title="KYC case"
        subtitle={`${d.case.reference} · ${d.case.kind === "corporate" ? "Corporate" : "Individual"}${d.case.submissions > 1 ? ` · submission ${d.case.submissions}` : ""}`}
        actions={
          <>
            {back}
            <Link href={`/clients/${d.user.id}`} className={buttonVariants({ variant: "surface" })}>
              Client profile <ArrowUpRight />
            </Link>
          </>
        }
      />
      <Reveal>
        <Card className="mb-4 flex flex-wrap items-center gap-4 px-6 py-5">
          <Avatar name={d.user.name} size={52} verified={d.user.kyc_status === "verified"} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-[20px] font-medium tracking-tight">{d.user.name}</span>
              <Flag country={d.user.country} />
              <CaseStatusChip status={d.case.status} />
              {d.case.risk_level && (
                <Chip size="sm" tone={d.case.risk_level === "high" ? "down" : d.case.risk_level === "medium" ? "warn" : "up"}>
                  Risk {d.case.risk_level}
                </Chip>
              )}
            </div>
            <div className="mt-0.5 text-[12.5px] text-fg-3">
              {d.user.email} · <Mono className="text-[12px]">ID {d.user.id}</Mono> · registered {day(d.user.created_at)} · reviewer {d.case.reviewer?.name ?? "unassigned"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-fg-3">Submitted</div>
            <div className="text-[13px]">{d.case.submitted_at ? when(d.case.submitted_at) : "—"}</div>
            {d.case.sla && <SlaBadge sla={d.case.sla} submittedAt={d.case.submitted_at} now={now} className="mt-1" />}
          </div>
        </Card>
      </Reveal>

      {(dupes.length > 0 || d.flags.same_identity.length > 0) && (
        <Reveal>
          <div className="mb-4 flex items-start gap-3 rounded-[16px] border border-down/40 bg-down-soft px-5 py-4 text-[13px]" data-testid="flags">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-down" />
            <div className="space-y-1">
              {Object.values(
                dupes.reduce<Record<number, { user_id: number; name: string; email: string; files: number }>>((acc, x) => {
                  acc[x.user_id] ??= { user_id: x.user_id, name: x.name, email: x.email, files: 0 };
                  acc[x.user_id]!.files++;
                  return acc;
                }, {}),
              )
                .slice(0, 6)
                .map((x) => (
                  <div key={x.user_id}>
                    {x.files === 1 ? "An identical file was" : `${x.files} identical files were`} also uploaded by{" "}
                    <Link href={`/clients/${x.user_id}`} className="font-medium text-down underline">
                      {x.name} ({x.email})
                    </Link>
                    .
                  </div>
                ))}
              {d.flags.same_identity.slice(0, 6).map((x) => (
                <div key={x.id}>
                  Another account has the same name and date of birth:{" "}
                  <Link href={`/clients/${x.id}`} className="font-medium text-down underline">
                    {x.email}
                  </Link>{" "}
                  (KYC {x.kyc_status}).
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <Reveal delay={0.03}>
            <Section title="Documents" icon={<Info />}>
              <DocumentViewer docs={docs} />
            </Section>
          </Reveal>
          <Reveal delay={0.06}>
            <Section title="Automatic checks" icon={<ClipboardCheck />}>
              {docs.length ? <ChecksTable docs={docs} /> : <p className="text-[12.5px] text-fg-3">No documents yet.</p>}
            </Section>
          </Reveal>
          {d.superseded.length > 0 && (
            <p className="px-1 text-[11.5px] text-fg-3">
              {d.superseded.length} earlier upload{d.superseded.length === 1 ? " was" : "s were"} replaced by the client before submission.
            </p>
          )}
        </div>
        <div className="space-y-4 xl:col-span-4">
          <Reveal delay={0.04}>
            <DecisionCard key={d.case.id} d={d} onChanged={() => { reload(); router.refresh(); }} />
          </Reveal>
          <Reveal delay={0.07}>
            <Details d={d} />
          </Reveal>
          <Reveal delay={0.1}>
            <Notes d={d} onChanged={reload} />
          </Reveal>
          <Reveal delay={0.12}>
            <Timeline d={d} />
          </Reveal>
        </div>
      </div>
    </div>
  );
}
