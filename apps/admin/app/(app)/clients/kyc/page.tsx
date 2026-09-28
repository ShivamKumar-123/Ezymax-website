"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Building2, CheckCircle2, Clock, FileCheck2, RefreshCw, ScanFace, Timer, UserCheck, XCircle, Check as CheckIcon, FileClock } from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  DataTable,
  Dialog,
  DialogClose,
  Flag,
  Gauge,
  KpiCard,
  PageHeader,
  Reveal,
  Segmented,
  Tabs,
  cn,
  type Column,
} from "@kalks/ui";
import { CORPORATE_KYC, KYC_QUEUE, REASON_CODES, getClient, timeAgo, type KycApplication, type KycCheck } from "@kalks/mock/admin-clients";
import { ClientCell, KycChip, ReasonDialog, SlaTimer } from "@/components/command/kit";
import { IdCard } from "@/components/clients/profile-tabs";

const STATUS_TONE = { pending: "warn", review: "info", resubmit: "neutral", approved: "up", rejected: "down" } as const;

function scoreClass(s: number) {
  return s >= 85 ? "text-up" : s >= 65 ? "text-warn" : "text-down";
}

function CheckIconFor({ r }: { r: KycCheck["result"] }) {
  return r === "pass" ? <CheckCircle2 className="size-4 text-up" /> : r === "warn" ? <AlertTriangle className="size-4 text-warn" /> : <XCircle className="size-4 text-down" />;
}

function ReviewDrawer({ app, onClose, onDecide }: { app: KycApplication | null; onClose: () => void; onDecide: (id: string, s: KycApplication["status"]) => void }) {
  const [reject, setReject] = React.useState(false);
  const [resub, setResub] = React.useState(false);
  const [docs, setDocs] = React.useState<Set<string>>(new Set(["ID front", "Selfie"]));
  if (!app) return null;
  const c = getClient(app.clientId);
  return (
    <>
      <Dialog open={!!app} onOpenChange={(o) => !o && onClose()} side="right" title={`Review ${app.id}`} description={`${c.name} · ${app.docType}${app.poa ? ` + ${app.poa}` : ""} · Level ${app.level} · submitted ${timeAgo(app.submitted)}`}>
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar src={c.photo} name={c.name} size={48} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[15px] font-medium">
                {c.name} <Flag country={c.country} className="size-4" />
              </div>
              <div className="font-mono text-[11.5px] text-fg-3">
                #{c.id} · {c.email}
              </div>
            </div>
            <div className="text-center">
              <div className={cn("k-num text-[28px] font-semibold leading-none", scoreClass(app.providerScore))}>{app.providerScore}</div>
              <div className="mt-1 text-[10.5px] uppercase tracking-wider text-fg-3">Provider score</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <IdCard label={`${app.docType} · front`} name={c.name} country={c.country} />
            <IdCard label={`${app.docType} · back`} back name={c.name} country={c.country} />
            <div>
              <div className="relative aspect-[1.58] overflow-hidden rounded-[14px] border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.photo} alt="" className="size-full object-cover" />
                <span className={cn("absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold text-white backdrop-blur", app.faceMatch >= 85 ? "bg-up/80" : "bg-warn/80")}>
                  <ScanFace className="size-3" /> {app.faceMatch}%
                </span>
              </div>
              <div className="mt-1.5 text-center text-[11.5px] text-fg-3">Selfie · face match</div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[12.5px] font-medium text-fg-2">Provider checks</div>
            <div className="divide-y divide-line rounded-[14px] border border-line bg-surface-2">
              {app.checks.map((k) => (
                <div key={k.label} className="flex items-center gap-3 px-3.5 py-2.5">
                  <CheckIconFor r={k.result} />
                  <span className="flex-1 text-[13px]">{k.label}</span>
                  <span className={cn("text-right text-[12px]", k.result === "pass" ? "text-fg-3" : k.result === "warn" ? "text-warn" : "text-down")}>{k.detail}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[12.5px] font-medium text-fg-2">Extracted data vs profile</div>
            <div className="overflow-hidden rounded-[14px] border border-line">
              <table className="w-full text-[12.5px]">
                <thead className="bg-surface-2 text-[10.5px] uppercase tracking-wider text-fg-3">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Field</th>
                    <th className="px-3 py-2 text-left font-medium">Document (OCR)</th>
                    <th className="px-3 py-2 text-left font-medium">Profile</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {app.extracted.map((e) => {
                    const same = e.profile === "—" || e.profile === "Same" || e.doc.toLowerCase() === e.profile.toLowerCase();
                    return (
                      <tr key={e.field} className={cn("border-t border-line", !same && "bg-warn-soft")}>
                        <td className="px-3 py-2 text-fg-3">{e.field}</td>
                        <td className="px-3 py-2 font-mono text-[12px]">{e.doc}</td>
                        <td className={cn("px-3 py-2 font-mono text-[12px]", !same && "text-warn")}>{e.profile}</td>
                        <td className="px-2">{same ? <CheckIcon className="size-3.5 text-up" /> : <AlertTriangle className="size-3.5 text-warn" />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Button size="sm" variant="down-outline" onClick={() => setReject(true)}>
              <XCircle /> Reject
            </Button>
            <Button size="sm" variant="surface" onClick={() => setResub(true)}>
              <RefreshCw /> Request resubmission
            </Button>
            <Button
              size="sm"
              variant="up-outline"
              className="ml-auto"
              onClick={() => {
                onDecide(app.id, "approved");
                toast.success(`${c.name} approved · Level ${app.level}`, { description: app.providerScore < 90 ? "Manual override of provider score recorded" : "Withdrawals and full limits unlocked" });
                onClose();
              }}
            >
              <CheckCircle2 /> Approve
            </Button>
          </div>
        </div>
      </Dialog>
      <ReasonDialog
        open={reject}
        onOpenChange={setReject}
        title={`Reject ${c.name}`}
        description="The client sees the customer-facing text for the chosen reason."
        codes={REASON_CODES.reject}
        confirmLabel="Reject application"
        confirmVariant="sell"
        successMessage="Application rejected — client notified"
        onConfirm={() => {
          onDecide(app.id, "rejected");
          onClose();
        }}
      />
      <Dialog
        open={resub}
        onOpenChange={setResub}
        title="Request resubmission"
        description={`${c.name} will get an email and an in-app task.`}
        footer={
          <>
            <DialogClose asChild>
              <Button size="sm" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              size="sm"
              variant="ember"
              disabled={!docs.size}
              onClick={() => {
                onDecide(app.id, "resubmit");
                toast.success(`Resubmission requested (${docs.size} document${docs.size > 1 ? "s" : ""})`);
                setResub(false);
                onClose();
              }}
            >
              Send request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {["ID front", "ID back", "Selfie", "Proof of address", "Source of funds"].map((d) => (
              <button
                key={d}
                onClick={() => setDocs((s) => { const n = new Set(s); if (n.has(d)) n.delete(d); else n.add(d); return n; })}
                className={cn("rounded-full border px-3 py-1.5 text-[12.5px]", docs.has(d) ? "border-ember/50 bg-ember-soft" : "border-line bg-surface-2 text-fg-2")}
              >
                {d}
              </button>
            ))}
          </div>
          <textarea rows={4} defaultValue="Your document photo is blurry around the date of birth. Please retake it in good light with all four corners visible." className="w-full resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] outline-none focus:border-ember/50" />
        </div>
      </Dialog>
    </>
  );
}

function CorporateKyc() {
  const k = CORPORATE_KYC;
  const [rej, setRej] = React.useState(false);
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-8">
        <CardHeader title={k.company} subtitle={`${k.id} · ${k.type} · Reg. ${k.regNo}`} icon={<Building2 />} action={<Chip tone="info" dot>In review</Chip>} />
        <div className="grid grid-cols-2 gap-3 px-6 pt-4 md:grid-cols-4">
          {[
            ["Jurisdiction", <span key="j" className="flex items-center gap-1.5"><Flag country={k.country} className="size-4" />{k.jurisdiction}</span>],
            ["Incorporated", k.incorporated],
            ["Provider score", <span key="s" className="text-warn">{k.providerScore} / 100</span>],
            ["Registered address", k.address],
          ].map(([a, b], i) => (
            <div key={i} className="k-row px-3.5 py-2.5">
              <div className="text-[10.5px] uppercase tracking-wider text-fg-3">{a}</div>
              <div className="mt-0.5 text-[12.5px] font-medium">{b}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 px-6 pb-6 pt-5 md:grid-cols-2">
          <div>
            <div className="mb-2 text-[12.5px] font-medium text-fg-2">Directors</div>
            <div className="space-y-2">
              {k.directors.map((d) => (
                <div key={d.name} className="k-row flex items-center gap-3 px-3.5 py-2.5">
                  <Avatar src={d.photo} name={d.name} size={30} />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium">{d.name} <Flag country={d.country} className="size-3.5" /></div>
                    <div className="text-[11.5px] text-fg-3">{d.role}</div>
                  </div>
                  <KycChip status={d.kyc} size="sm" />
                </div>
              ))}
            </div>
            <div className="mb-2 mt-5 text-[12.5px] font-medium text-fg-2">Documents</div>
            <div className="space-y-1.5">
              {k.documents.map((d) => (
                <div key={d.name} className="flex items-center gap-2.5 text-[12.5px]">
                  {d.status === "verified" ? <FileCheck2 className="size-4 text-up" /> : <FileClock className="size-4 text-warn" />}
                  <span className="flex-1">{d.name}</span>
                  <span className={d.status === "verified" ? "text-fg-3" : "text-warn"}>{d.status === "verified" ? "Verified" : "Pending"}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[12.5px] font-medium text-fg-2">Ultimate beneficial owners</div>
            <div className="mb-3 flex h-3 overflow-hidden rounded-full">
              {k.ubos.map((u, i) => (
                <span key={u.name} className={cn("h-full", ["bg-ember", "bg-gold", "bg-surface-3"][i])} style={{ width: `${u.share}%` }} />
              ))}
            </div>
            <div className="space-y-2">
              {k.ubos.map((u, i) => (
                <div key={u.name} className={cn("k-row flex items-center gap-3 px-3.5 py-2.5", u.pep && "border-warn/40")}>
                  {u.photo ? <Avatar src={u.photo} name={u.name} size={30} /> : <span className="grid size-[30px] place-items-center rounded-full bg-surface-3"><Building2 className="size-3.5 text-fg-3" /></span>}
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium">
                      <span className={cn("size-2 rounded-full", ["bg-ember", "bg-gold", "bg-fg-3"][i])} />
                      {u.name}
                      {u.pep && <Chip size="sm" tone="warn">PEP · Tier 2</Chip>}
                    </div>
                    <div className="text-[11.5px] text-fg-3">{u.photo ? <KycChip status={u.kyc} size="sm" /> : "Held by company"}</div>
                  </div>
                  <span className="k-num font-mono text-[15px] font-semibold">{u.share}%</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-[12px] border border-warn/30 bg-warn-soft px-3 py-2.5 text-[12px] text-fg-2">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" />
              UBO Hassan Karimi (30%) matched a PEP list on nightly re-screen — enhanced due diligence and MLRO sign-off required.
            </div>
          </div>
        </div>
      </Card>
      <Card className="xl:col-span-4">
        <CardHeader title="Decision" subtitle="Corporate accounts need 2 approvers" />
        <div className="flex justify-center pt-2">
          <Gauge value={k.providerScore} max={100} size={180} label="KYB score" />
        </div>
        <div className="space-y-2 px-6 pb-6">
          <Button className="w-full" variant="ember" onClick={() => toast.success("Escalated to MLRO", { description: "EDD checklist created for PEP UBO" })}>
            Escalate to MLRO (EDD)
          </Button>
          <Button className="w-full" variant="up-outline" onClick={() => toast.success("First approval recorded", { description: "Awaiting second approver (Compliance)" })}>
            Approve (1 of 2)
          </Button>
          <Button className="w-full" variant="down-outline" onClick={() => setRej(true)}>
            Reject
          </Button>
        </div>
      </Card>
      <ReasonDialog open={rej} onOpenChange={setRej} title={`Reject ${k.company}`} codes={REASON_CODES.reject} confirmLabel="Reject KYB" confirmVariant="sell" successMessage="Corporate application rejected" />
    </div>
  );
}

function KycQueueInner() {
  const params = useSearchParams();
  const [apps, setApps] = React.useState(KYC_QUEUE);
  const [open, setOpen] = React.useState<string | null>(params.get("id"));
  const [kind, setKind] = React.useState<"ind" | "corp">("ind");
  const [status, setStatus] = React.useState<"open" | "all">("open");
  const rows = apps.filter((a) => status === "all" || a.status === "pending" || a.status === "review");
  const decide = (id: string, s: KycApplication["status"]) => setApps((xs) => xs.map((x) => (x.id === id ? { ...x, status: s } : x)));

  const cols: Column<KycApplication>[] = [
    { key: "id", header: "Application", cell: (r) => <span className="font-mono text-[12px]">{r.id}</span> },
    { key: "c", header: "Client", cell: (r) => <ClientCell client={getClient(r.clientId)} size={28} /> },
    { key: "doc", header: "Documents", cell: (r) => <span className="text-[12.5px]">{r.docType}<span className="block text-[11px] text-fg-3">{r.poa ?? "No proof of address"}</span></span> },
    { key: "lvl", header: "Level", align: "center", cell: (r) => <Chip size="sm">L{r.level}</Chip> },
    { key: "score", header: "Score", align: "right", cell: (r) => <span className={cn("k-num font-mono text-[14px] font-semibold", scoreClass(r.providerScore))}>{r.providerScore}</span>, sort: (r) => r.providerScore },
    { key: "face", header: "Face match", align: "right", cell: (r) => <span className={cn("k-num font-mono text-[12.5px]", scoreClass(r.faceMatch))}>{r.faceMatch}%</span>, sort: (r) => r.faceMatch },
    { key: "aml", header: "AML / PEP", cell: (r) => (r.amlHit === "clear" ? <Chip size="sm" tone="up">Clear</Chip> : <Chip size="sm" tone="warn">{r.amlHit === "pep" ? "PEP hit" : r.amlHit === "adverse" ? "Adverse media" : "Sanctions"}</Chip>) },
    { key: "sub", header: "Submitted", cell: (r) => <span className="text-[12px] text-fg-3">{timeAgo(r.submitted)}</span>, sort: (r) => r.submitted },
    { key: "sla", header: "SLA", align: "right", cell: (r) => (r.status === "pending" || r.status === "review" ? <SlaTimer mins={r.slaMins} total={240} compact /> : <span className="text-fg-3">—</span>), sort: (r) => r.slaMins },
    { key: "st", header: "Status", cell: (r) => <Chip size="sm" tone={STATUS_TONE[r.status]} dot className="capitalize">{r.status === "resubmit" ? "Resubmit" : r.status === "review" ? "Manual review" : r.status}</Chip> },
    { key: "act", header: "", align: "right", cell: (r) => <Button size="xs" variant="surface" onClick={(e) => { e.stopPropagation(); setOpen(r.id); }}>Review</Button> },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="KYC queue"
        subtitle="Automated provider checks with human override. Auto-approve at score ≥ 90 with no AML hits."
        actions={
          <Button variant="ember" size="lg" onClick={() => { const first = rows[0]; if (first) setOpen(first.id); else toast("Queue is clear"); }}>
            <UserCheck /> Review next
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <KpiCard label="Pending" icon={<Clock />} value={<span className="k-num">{apps.filter((a) => a.status === "pending").length}</span>} chip="Oldest 10h" chipTone="warn" />
        <KpiCard label="Manual review" icon={<ScanFace />} value={<span className="k-num">{apps.filter((a) => a.status === "review").length}</span>} chip="Score < 60 or mismatch" delay={0.04} />
        <KpiCard label="SLA breached" icon={<Timer />} value={<span className="k-num text-down">{apps.filter((a) => a.slaMins < 0).length}</span>} chip="SLA 4h" chipTone="down" delay={0.08} />
        <KpiCard label="Avg decision" icon={<FileCheck2 />} value={<span className="k-num">6m 40s</span>} chip="-1m 12s WoW" chipTone="up" delay={0.12} />
        <KpiCard label="Auto-approve rate" icon={<CheckCircle2 />} value={<span className="k-num">71%</span>} chip="Last 7 days" chipTone="up" delay={0.16} className="col-span-2 xl:col-span-1" />
      </div>
      <Reveal delay={0.1} className="mt-5">
        <Tabs value={kind} onChange={setKind} tabs={[{ value: "ind", label: "Individuals", count: rows.length }, { value: "corp", label: "Corporate (KYB)", count: 1 }]} />
      </Reveal>
      <div className="mt-5">
        {kind === "ind" ? (
          <Reveal>
            <Card className="px-4 py-5 sm:px-6">
              <DataTable
                columns={cols}
                rows={rows}
                dense
                pageSize={12}
                rowKey={(r) => r.id}
                onRowClick={(r) => setOpen(r.id)}
                exportName="kyc-queue"
                search={(r) => `${r.id} ${getClient(r.clientId).name} ${r.docType}`}
                toolbar={<Segmented size="sm" value={status} onChange={setStatus} options={[{ value: "open", label: "Open" }, { value: "all", label: "All incl. decided" }]} />}
              />
            </Card>
          </Reveal>
        ) : (
          <Reveal>
            <CorporateKyc />
          </Reveal>
        )}
      </div>
      <ReviewDrawer app={apps.find((a) => a.id === open) ?? null} onClose={() => setOpen(null)} onDecide={decide} />
    </div>
  );
}

export default function KycQueuePage() {
  return (
    <React.Suspense fallback={null}>
      <KycQueueInner />
    </React.Suspense>
  );
}
