"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Check, Eye, FileClock, FileSignature, FileText, GitCompare, History, Info, MoreHorizontal, Scale, ShieldCheck, Upload, Users } from "lucide-react";
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
  IconButton,
  KpiCard,
  Menu,
  PageHeader,
  Progress,
  Reveal,
  Segmented,
  Toggle,
  cn,
  formatNumber,
  type Column,
} from "@kalks/ui";
import { PEOPLE } from "@kalks/mock";
import { serverTime } from "@kalks/mock/admin-clients";
import { CNT_ACCEPTANCE_LOG, CNT_LEGAL_DOCS, CNT_TENANTS, type CntAcceptance, type CntLegalDoc, type CntTenantId } from "@kalks/mock/admin-growth-content";

const BASE_CLIENTS: Record<CntTenantId, number> = { kalks: 48210, aurum: 12840, nova: 6420, dunes: 3180 };

function bump(v: string, major: boolean) {
  const [a, b] = v.slice(1).split(".").map(Number) as [number, number];
  return major ? `v${a + 1}.0` : `v${a}.${b + 1}`;
}

function PublishDialog({
  open,
  onOpenChange,
  docs,
  initial,
  tenant,
  onPublish,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  docs: CntLegalDoc[];
  initial: string;
  tenant: CntTenantId;
  onPublish: (docId: string, version: string, summary: string, reaccept: boolean) => void;
}) {
  const [docId, setDocId] = React.useState(initial);
  const [kind, setKind] = React.useState<"minor" | "major">("minor");
  const [summary, setSummary] = React.useState("");
  const [reaccept, setReaccept] = React.useState(true);
  const [notify, setNotify] = React.useState(true);
  const [grace, setGrace] = React.useState<"now" | "7d" | "14d">("7d");
  React.useEffect(() => {
    if (open) {
      setDocId(initial);
      setSummary("");
      setKind("minor");
      setReaccept(true);
    }
  }, [open, initial]);
  const doc = docs.find((d) => d.id === docId) ?? docs[0]!;
  const next = bump(doc.version, kind === "major");
  const affected = BASE_CLIENTS[tenant];
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={640}
      title="Publish new version"
      description={`${CNT_TENANTS.find((t) => t.id === tenant)!.name} · versions are immutable once published`}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">Cancel</Button>
          </DialogClose>
          <Button variant="surface" size="sm" onClick={() => toast.success("Preview opened", { description: `${doc.name} ${next} · redline vs ${doc.version}` })}>
            <Eye /> Preview
          </Button>
          <Button
            variant="ember"
            size="sm"
            onClick={() => {
              if (summary.trim().length < 10) return toast.error("Add a change summary (min 10 characters)", { description: "It is shown to clients in the re-acceptance modal" });
              onPublish(doc.id, next, summary.trim(), reaccept);
              onOpenChange(false);
            }}
          >
            <Upload /> Publish {next}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Document</div>
          <div className="flex flex-wrap gap-1.5">
            {docs.map((d) => (
              <button key={d.id} onClick={() => setDocId(d.id)} className={cn("rounded-full border px-3 py-1 text-[12.5px] transition-colors", d.id === docId ? "border-ember/40 bg-ember-soft text-ember" : "border-line bg-surface-2 text-fg-2 hover:text-fg")}>
                {d.name}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-[12.5px] font-medium text-fg-2">Change type</div>
            <Segmented size="sm" value={kind} onChange={setKind} options={[{ value: "minor", label: "Minor" }, { value: "major", label: "Major" }]} />
          </div>
          <div className="k-row flex items-center justify-between px-4 py-2.5">
            <span className="text-[12px] text-fg-3">Version</span>
            <span className="flex items-center gap-2 font-mono text-[13px]">
              <span className="text-fg-3">{doc.version}</span>→<span className="text-ember">{next}</span>
            </span>
          </div>
        </div>
        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-[12.5px] font-medium text-fg-2">
            Change summary <span className="font-normal text-fg-3">Shown to clients · translated to {doc.languages} languages</span>
          </span>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="e.g. Updated leverage caps for EU-referred clients and clarified stop-out levels in section 9."
            className="w-full resize-none rounded-[14px] border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-fg outline-none placeholder:text-fg-3 focus:border-ember/50 focus:ring-4 focus:ring-ember/10"
          />
        </label>
        <button onClick={() => toast.info("Upload the signed PDF", { description: "PDF or DOCX · a hash is stored with the version" })} className="flex w-full items-center gap-3 rounded-[14px] border border-dashed border-line bg-surface-2/50 px-4 py-3 text-left hover:border-fg-3">
          <FileText className="size-5 text-fg-3" />
          <span className="flex-1 text-[12.5px]">
            <span className="block font-medium text-fg">{doc.slug}-{next}.pdf</span>
            <span className="text-fg-3">Drop the final document or click to upload</span>
          </span>
          <Chip size="sm">PDF</Chip>
        </button>
        <div className="space-y-3 rounded-[16px] border border-line bg-surface-2/60 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[13.5px] font-medium">Requires re-acceptance</div>
              <div className="text-[12px] text-fg-3">Clients must accept before trading, depositing or withdrawing</div>
            </div>
            <Toggle checked={reaccept} onChange={setReaccept} label="Requires re-acceptance" />
          </div>
          {reaccept && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[12.5px] text-fg-2">Grace period before blocking</span>
                <Segmented size="xs" value={grace} onChange={setGrace} options={[{ value: "now", label: "Immediate" }, { value: "7d", label: "7 days" }, { value: "14d", label: "14 days" }]} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[12.5px] text-fg-2">Notify by email + in-app</span>
                <Toggle checked={notify} onChange={setNotify} label="Notify" />
              </div>
            </>
          )}
        </div>
        <div className={cn("flex items-start gap-2.5 rounded-[14px] border px-3.5 py-3 text-[12.5px]", reaccept ? "border-warn/30 bg-warn-soft text-warn" : "border-info/25 bg-info-soft text-info")}>
          <Info className="mt-0.5 size-4 shrink-0" />
          {reaccept ? (
            <span>
              <b className="k-num">{formatNumber(affected, 0)}</b> clients will see a blocking modal on next login{grace !== "now" ? `; access is restricted after ${grace === "7d" ? "7" : "14"} days if not accepted` : ""}.
            </span>
          ) : (
            <span>Silent update: clients are notified but existing acceptances stay valid.</span>
          )}
        </div>
      </div>
    </Dialog>
  );
}

export default function LegalDocumentsPage() {
  const [tenant, setTenant] = React.useState<CntTenantId>("kalks");
  const [docs, setDocs] = React.useState<CntLegalDoc[]>(CNT_LEGAL_DOCS);
  const [sel, setSel] = React.useState("kalks-client-agreement");
  const [pub, setPub] = React.useState(false);
  const [docFilter, setDocFilter] = React.useState("All");
  const tDocs = docs.filter((d) => d.tenant === tenant);
  const doc = tDocs.find((d) => d.id === sel) ?? tDocs[0]!;
  const t = CNT_TENANTS.find((x) => x.id === tenant)!;
  const pending = tDocs.reduce((s, d) => s + d.pending, 0);
  const avg = tDocs.reduce((s, d) => s + d.acceptance, 0) / tDocs.length;

  const log = CNT_ACCEPTANCE_LOG.filter((a) => a.tenant === tenant || tenant === "kalks").filter((a) => docFilter === "All" || a.doc === docFilter);

  const cols: Column<CntAcceptance>[] = [
    {
      key: "client",
      header: "Client",
      cell: (a) => (
        <div className="flex items-center gap-2.5">
          <Avatar src={a.client.photo} name={a.client.name} size={30} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[13px] font-medium">
              {a.client.name}
              <Flag country={a.client.country} className="size-3.5" />
            </div>
            <div className="font-mono text-[11px] text-fg-3">{a.login}</div>
          </div>
        </div>
      ),
      sort: (a) => a.client.name,
    },
    { key: "doc", header: "Document", cell: (a) => <span className="text-fg-2">{a.doc}</span>, sort: (a) => a.doc },
    { key: "ver", header: "Version", cell: (a) => <span className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[11.5px]">{a.version}</span> },
    { key: "at", header: "Accepted at", cell: (a) => <span className="k-num font-mono text-[12px] text-fg-2">{serverTime(a.at)}</span>, sort: (a) => a.at },
    { key: "ip", header: "IP", hideOn: "md", cell: (a) => <span className="font-mono text-[12px] text-fg-3">{a.ip}</span> },
    { key: "device", header: "Device", hideOn: "lg", cell: (a) => <span className="text-[12px] text-fg-3">{a.device}</span> },
    { key: "m", header: "Method", align: "right", cell: (a) => <Chip size="sm" tone={a.method === "modal" ? "ember" : a.method === "signup" ? "up" : "neutral"}>{a.method === "modal" ? "Re-accept modal" : a.method === "signup" ? "Sign-up" : "Checkbox"}</Chip> },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="Legal documents"
        subtitle="Versioned per tenant. Publishing a version that requires re-acceptance blocks clients until they accept."
        actions={
          <>
            <Menu
              width={240}
              align="end"
              header={<div className="text-[11px] uppercase tracking-wider text-fg-3">Tenant</div>}
              items={CNT_TENANTS.map((x) => ({
                label: x.name,
                icon: <span className="grid size-5 place-items-center rounded-md text-[10px] font-bold text-black" style={{ background: x.color }}>{x.name[0]}</span>,
                hint: x.id === tenant ? <Check className="size-3.5 text-ember" /> : undefined,
                onSelect: () => { setTenant(x.id); setSel(`${x.id}-client-agreement`); },
              }))}
              trigger={
                <button className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface-2 pl-1.5 pr-4 text-[13px] font-medium hover:bg-surface-3">
                  <span className="grid size-7 place-items-center rounded-full text-[11px] font-bold text-black" style={{ background: t.color }}>{t.name[0]}</span>
                  {t.name}
                </button>
              }
            />
            <Button variant="ember" onClick={() => setPub(true)}>
              <Upload /> Publish new version
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Documents" value={<span className="k-num">{tDocs.length}</span>} icon={<FileText />} chip={`${t.languages} languages`} />
        <KpiCard label="Avg. acceptance" value={<span className="k-num">{avg.toFixed(1)}<span className="text-fg-3">%</span></span>} icon={<FileSignature />} chip="current versions" chipTone="up" delay={0.05} />
        <KpiCard label="Pending re-acceptance" value={<span className="k-num">{formatNumber(pending, 0)}</span>} icon={<Users />} chip="clients blocked at login" chipTone="warn" delay={0.1} hot illustration="identification_card" />
        <KpiCard label="Last published" value={<span className="k-num text-[26px]">{[...tDocs].sort((a, b) => (a.lastPublished < b.lastPublished ? 1 : -1))[0]!.lastPublished}</span>} icon={<FileClock />} chip="by Priya Nair" delay={0.15} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader title="Documents" subtitle={`${t.name} · ${t.domain}/legal`} icon={<Scale />} />
            <div className="mt-4 overflow-x-auto px-4 pb-5 sm:px-6">
              <div className="min-w-[680px] space-y-2">
                {tDocs.map((d) => {
                  const on = d.id === doc.id;
                  return (
                    <div
                      key={d.id}
                      onClick={() => setSel(d.id)}
                      className={cn("k-row grid cursor-pointer grid-cols-[minmax(0,1.5fr)_90px_minmax(0,1.3fr)_110px_36px] items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-3/60", on && "border-ember/35 bg-ember/[0.05]")}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl border", on ? "border-ember/40 bg-ember-soft text-ember" : "border-line bg-surface-3 text-fg-3")}>
                          <FileText className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-[13.5px] font-medium">{d.name}</div>
                          <div className="text-[11.5px] text-fg-3">
                            {d.lastPublished} · {d.required === "signup" ? "at sign-up" : "per product"}
                          </div>
                        </div>
                      </div>
                      <span className="w-fit rounded-lg border border-line bg-surface-3 px-2 py-0.5 font-mono text-[12.5px] text-fg">{d.version}</span>
                      <div>
                        <div className="flex justify-between text-[11.5px]">
                          <span className="text-fg-3">Accepted</span>
                          <span className={cn("k-num font-medium", d.acceptance >= 95 ? "text-up" : d.acceptance >= 85 ? "text-fg" : "text-warn")}>{d.acceptance.toFixed(1)}%</span>
                        </div>
                        <Progress value={d.acceptance} tone={d.acceptance >= 95 ? "up" : d.acceptance >= 85 ? "gold" : "warn"} className="mt-1.5" />
                      </div>
                      <div className="text-right">
                        <div className={cn("k-num text-[13.5px] font-medium", d.pending > 1000 ? "text-warn" : "text-fg")}>{formatNumber(d.pending, 0)}</div>
                        <div className="text-[11px] text-fg-3">pending</div>
                      </div>
                      <Menu
                        width={210}
                        trigger={
                          <IconButton size="sm" aria-label="Actions" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal />
                          </IconButton>
                        }
                        items={[
                          { label: "Publish new version", icon: <Upload />, onSelect: () => { setSel(d.id); setPub(true); } },
                          { label: "View current PDF", icon: <Eye />, onSelect: () => toast.info(`${d.slug}-${d.version}.pdf`, { description: "SHA-256 7f3a…c91e" }) },
                          { label: "Compare versions", icon: <GitCompare />, onSelect: () => toast.info("Redline view", { description: `${d.version} vs ${d.history[1]?.version ?? "—"}` }) },
                          { label: "Send reminder to pending", icon: <Users />, onSelect: () => toast.success("Reminder queued", { description: `${formatNumber(d.pending, 0)} clients · email + in-app` }) },
                        ]}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.1} className="xl:col-span-4">
          <Card className="flex h-full flex-col">
            <CardHeader title="Version history" subtitle={doc.name} icon={<History />} action={<Button size="sm" variant="surface" onClick={() => setPub(true)}>New</Button>} />
            <div className="relative mt-5 flex-1 px-6 pb-6">
              <span className="absolute bottom-8 left-[35px] top-2 w-px bg-gradient-to-b from-ember/60 via-line to-transparent" />
              <div className="space-y-5">
                {doc.history.map((h, i) => (
                  <motion.div key={h.version + i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="relative flex gap-4">
                    <span className={cn("relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border", i === 0 ? "border-ember/50 bg-ember-soft shadow-[0_0_16px_-2px_rgba(255,90,31,0.7)]" : "border-line bg-surface-2")}>
                      <span className={cn("size-2 rounded-full", i === 0 ? "bg-ember" : "bg-fg-3")} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("font-mono text-[13px] font-medium", i === 0 && "text-ember")}>{h.version}</span>
                        {i === 0 && <Chip size="sm" tone="ember">Current</Chip>}
                        {h.reaccept && <Chip size="sm" tone="warn">Re-accept</Chip>}
                        <span className="ml-auto text-[11px] text-fg-3">{h.publishedAt}</span>
                      </div>
                      <p className="mt-1 text-[12.5px] leading-snug text-fg-2">{h.summary}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-fg-3">
                        <Avatar src={h.publishedBy.photo} name={h.publishedBy.name} size={16} />
                        {h.publishedBy.name}
                        {i === 0 && <span className="ml-auto k-num text-fg-2">{h.acceptance.toFixed(1)}% accepted</span>}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={0.05} className="mt-4 block">
        <Card>
          <CardHeader title="Acceptance log" subtitle="Immutable record of every acceptance with IP and device · GMT+3" icon={<ShieldCheck />} />
          <div className="mt-4 px-4 pb-6 sm:px-6">
            <DataTable
              columns={cols}
              rows={log}
              pageSize={8}
              dense
              rowKey={(a) => a.id}
              search={(a) => `${a.client.name} ${a.login} ${a.ip} ${a.doc}`}
              searchPlaceholder="Client, login, IP…"
              exportName="legal-acceptance-log"
              toolbar={
                <div className="-mx-1 max-w-full overflow-x-auto px-1 [scrollbar-width:none]">
                  <Segmented size="xs" value={docFilter} onChange={setDocFilter} options={["All", ...tDocs.map((d) => d.name)]} />
                </div>
              }
            />
          </div>
        </Card>
      </Reveal>

      <PublishDialog
        open={pub}
        onOpenChange={setPub}
        docs={tDocs}
        initial={doc.id}
        tenant={tenant}
        onPublish={(id, version, summary, reaccept) => {
          setDocs((ds) =>
            ds.map((d) =>
              d.id === id
                ? {
                    ...d,
                    version,
                    lastPublished: "24 Sep 2026",
                    acceptance: reaccept ? 0 : d.acceptance,
                    pending: reaccept ? BASE_CLIENTS[tenant] : d.pending,
                    history: [{ version, publishedAt: "24 Sep 2026", publishedBy: PEOPLE[4]!, summary, reaccept, acceptance: reaccept ? 0 : d.acceptance }, ...d.history.map((h, i) => (i === 0 ? { ...h, acceptance: 100 } : h))],
                  }
                : d,
            ),
          );
          setSel(id);
          toast.success(`${docs.find((d) => d.id === id)!.name} ${version} published`, {
            description: reaccept ? `${formatNumber(BASE_CLIENTS[tenant], 0)} clients asked to re-accept` : "No re-acceptance required",
          });
        }}
      />
    </div>
  );
}
