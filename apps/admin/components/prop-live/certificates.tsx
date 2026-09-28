"use client";

import * as React from "react";
import { Award, Ban, ExternalLink } from "lucide-react";
import { Button, Card, CardHeader, Chip, CopyButton, DataTable, Dialog, KeyValue, KpiCard, PageHeader, Reveal, type Column } from "@kalks/ui";
import { TableSkeleton, ago, useApi, useNow, when } from "@/components/live/kit";
import { FilterPills } from "@/components/prop/rules";
import { PropError, ReadOnlyNote, TraderCell, propWrite, reasonText, usd, useAction, useClientNames, usePropCan, type Certificate } from "./kit";

const KIND: Record<Certificate["kind"], { label: string; tone: "up" | "gold" | "ember" }> = {
  pass: { label: "Phase passed", tone: "up" },
  funded: { label: "Funded trader", tone: "gold" },
  payout: { label: "Payout", tone: "ember" },
};
const REVOKE_REASONS = ["Challenge overturned (banned strategy)", "Payout reversed", "Issued in error", "Fraud / chargeback", "Trader request"];

export function LiveCertificatesPage() {
  const now = useNow();
  const canWrite = usePropCan("prop.write");
  const { data, error, reload } = useApi<{ certificates: Certificate[] }>("/api/prop/certificates", { refreshMs: 30_000 });
  const all = data?.certificates ?? [];
  const [kind, setKind] = React.useState<"all" | Certificate["kind"] | "revoked">("all");
  const rows = all.filter((c) => (kind === "all" ? true : kind === "revoked" ? c.revoked : c.kind === kind));
  const names = useClientNames(rows.map((c) => c.userId));
  const [sel, setSel] = React.useState<Certificate | null>(null);
  const act = useAction();

  const revoke = (c: Certificate) =>
    act.ask({
      title: `Revoke certificate ${c.code}`,
      description: "The public verify page shows it as revoked from now on. This can't be undone.",
      reasons: REVOKE_REASONS,
      note: "optional",
      confirmLabel: "Revoke certificate",
      confirmVariant: "sell",
      run: (v) => propWrite(`certificates/${encodeURIComponent(c.code)}/revoke`, { reason: reasonText(v) }),
      success: `${c.code} revoked`,
      onDone: () => {
        setSel(null);
        reload();
      },
    });

  const columns: Column<Certificate>[] = [
    { key: "code", header: "Code", sort: (c) => c.code, csv: (c) => c.code, cell: (c) => <span className="font-mono text-[12.5px]">{c.code}</span> },
    { key: "kind", header: "Kind", sort: (c) => c.kind, csv: (c) => c.kind, cell: (c) => <Chip size="sm" tone={KIND[c.kind]?.tone ?? "neutral"}>{KIND[c.kind]?.label ?? c.kind}</Chip> },
    { key: "trader", header: "Trader", csv: (c) => c.traderName, cell: (c) => <TraderCell name={c.traderName} userId={c.userId} names={names} sub={<>Public name: {c.traderName}</>} /> },
    { key: "plan", header: "Plan", hideOn: "md", csv: (c) => c.planName, cell: (c) => <span className="text-[12.5px]">{c.planName}{c.phase && <span className="block text-[11px] text-fg-3">{c.phase}</span>}</span> },
    { key: "amt", header: "Size / amount", align: "right", sort: (c) => c.amount ?? c.size, csv: (c) => c.amount ?? c.size, cell: (c) => <span className="k-num text-[12.5px]">{usd(c.size, 0)}{c.amount !== null && <span className="block text-gold">{usd(c.amount)}</span>}</span> },
    { key: "at", header: "Issued", sort: (c) => Date.parse(c.issuedAt), csv: (c) => c.issuedAt, cell: (c) => <span className="text-[12px] text-fg-3" title={when(c.issuedAt)}>{ago(c.issuedAt, now)}</span> },
    { key: "rev", header: "Status", sort: (c) => (c.revoked ? 1 : 0), csv: (c) => (c.revoked ? "revoked" : "valid"), cell: (c) => <Chip size="sm" dot tone={c.revoked ? "down" : "up"}>{c.revoked ? "Revoked" : "Valid"}</Chip> },
  ];

  return (
    <div className="pb-24">
      <PageHeader title="Certificates" subtitle="Pass, funded and payout certificates issued by the prop service, each with a public verify link." actions={!canWrite ? <ReadOnlyNote what="revoke certificates" /> : undefined} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Issued" icon={<Award />} value={<span className="k-num">{all.length}</span>} chip={`${all.filter((c) => !c.revoked).length} valid`} />
        <KpiCard label="Phase passed" icon={<Award />} value={<span className="k-num">{all.filter((c) => c.kind === "pass").length}</span>} delay={0.04} />
        <KpiCard label="Funded" icon={<Award />} value={<span className="k-num">{all.filter((c) => c.kind === "funded").length}</span>} chipTone="gold" delay={0.08} />
        <KpiCard label="Revoked" icon={<Ban />} value={<span className="k-num">{all.filter((c) => c.revoked).length}</span>} delay={0.12} />
      </div>
      <Reveal delay={0.08} className="mt-4">
        <Card>
          <CardHeader title="All certificates" subtitle="Click a row to preview the certificate image" />
          <div className="px-4 pb-6 pt-4 sm:px-6">
            {error && !data ? (
              <PropError error={error} onRetry={reload} />
            ) : !data ? (
              <TableSkeleton />
            ) : (
              <DataTable
                columns={columns}
                rows={rows}
                pageSize={20}
                dense
                rowKey={(c) => c.code}
                exportName="prop-certificates"
                search={(c) => `${c.code} ${c.traderName} ${c.planName} ${names[String(c.userId)]?.name ?? ""} ${names[String(c.userId)]?.email ?? ""}`}
                searchPlaceholder="Code, trader, plan"
                onRowClick={setSel}
                toolbar={<FilterPills value={kind} onChange={setKind} options={[{ value: "all", label: "All" }, { value: "pass", label: "Passed" }, { value: "funded", label: "Funded" }, { value: "payout", label: "Payout" }, { value: "revoked", label: "Revoked" }]} />}
                empty={<div className="py-10 text-center text-[13px] text-fg-3">No certificates yet.</div>}
              />
            )}
          </div>
        </Card>
      </Reveal>

      <Dialog
        open={!!sel}
        onOpenChange={(o) => !o && setSel(null)}
        width={760}
        title={sel ? `${sel.title || KIND[sel.kind]?.label} · ${sel.code}` : ""}
        description={sel ? `Issued ${when(sel.issuedAt)} for challenge #${sel.challengeId}` : undefined}
        footer={
          sel ? (
            <>
              <a href={sel.verifyUrl} target="_blank" rel="noreferrer" className="mr-auto inline-flex items-center gap-1.5 text-[12.5px] text-fg-3 hover:text-fg">
                Public verify link <ExternalLink className="size-3.5" />
              </a>
              {canWrite && !sel.revoked && (
                <Button size="sm" variant="down-outline" onClick={() => revoke(sel)}>
                  <Ban /> Revoke
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {sel && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[14px] border border-line bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/prop/public/certificates/${encodeURIComponent(sel.code)}/image.svg`} alt={`Certificate ${sel.code}`} className="block aspect-[16/9] w-full" />
            </div>
            <KeyValue
              rows={[
                ["Status", <Chip key="s" size="sm" dot tone={sel.revoked ? "down" : "up"}>{sel.revoked ? "Revoked" : "Valid"}</Chip>],
                ["Public name", sel.traderName],
                ["Plan", `${sel.planName}${sel.phase ? ` · ${sel.phase}` : ""}`],
                ["Account size", usd(sel.size, 0)],
                ["Amount", sel.amount === null ? "—" : usd(sel.amount)],
                [
                  "Verify URL",
                  <span key="u" className="inline-flex items-center gap-1 font-mono text-[12px]">
                    {sel.verifyUrl}
                    <CopyButton value={sel.verifyUrl} label="Verify URL" />
                  </span>,
                ],
              ]}
            />
          </div>
        )}
      </Dialog>
      {act.node}
    </div>
  );
}
