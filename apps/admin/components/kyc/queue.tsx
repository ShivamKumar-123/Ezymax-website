"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Building2, Clock, FileCheck2, RefreshCw, Search, Timer, UserCheck } from "lucide-react";
import { Avatar, Button, Card, Chip, DataTable, EmptyState, Flag, PageHeader, Reveal, Segmented, type Column } from "@ezymex/ui";
import { ErrorState, Mono, Pager, TableSkeleton, ago, qs, useApi, useDebounced, useNow, when } from "@/components/live/kit";
import type { QueueItem, QueuePage } from "./types";
import { CaseStatusChip, SlaBadge, idTypeLabel } from "./ui";

type Filter = "queue" | "more_info" | "decided" | "all";
const PER = 25;

export function KycQueue() {
  const router = useRouter();
  const params = useSearchParams();
  const now = useNow(15_000);
  const [filter, setFilter] = React.useState<Filter>((params.get("status") as Filter) || "queue");
  const [kind, setKind] = React.useState<"all" | "individual" | "corporate">("all");
  const [q, setQ] = React.useState(params.get("q") ?? "");
  const [page, setPage] = React.useState(1);
  const dq = useDebounced(q.trim(), 300);
  React.useEffect(() => setPage(1), [dq, filter, kind]);
  // keep filters in the URL without a router navigation (a row click may be navigating away at the same time)
  React.useEffect(() => {
    const target = `/clients/kyc${qs({ status: filter === "queue" ? "" : filter, q: dq })}`;
    if (window.location.pathname === "/clients/kyc" && window.location.pathname + window.location.search !== target) window.history.replaceState(window.history.state, "", target);
  }, [filter, dq]);

  const { data, error, loading, reload } = useApi<QueuePage>(`/api/admin/kyc/cases${qs({ status: filter, kind, q: dq, page, per_page: PER })}`, { refreshMs: 30_000 });
  const c = data?.counts;

  const columns: Column<QueueItem>[] = [
    {
      key: "client",
      header: "Client",
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={r.user.name} size={34} />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 truncate font-medium">
              {r.user.name}
              <Flag country={r.user.country} className="size-3.5" />
            </span>
            <span className="block truncate text-[12px] text-fg-3">{r.user.email}</span>
          </span>
        </span>
      ),
    },
    { key: "ref", header: "Case", cell: (r) => <Mono className="text-fg-2">{r.reference}</Mono>, hideOn: "md" },
    {
      key: "type",
      header: "Type",
      cell: (r) =>
        r.kind === "corporate" ? (
          <span className="inline-flex items-center gap-1.5 text-fg-2">
            <Building2 className="size-3.5 text-fg-3" /> {r.company ?? "Company"}
          </span>
        ) : (
          <span className="text-fg-2">{idTypeLabel(r.id_doc_type)}</span>
        ),
      hideOn: "lg",
    },
    {
      key: "submitted",
      header: "Submitted",
      cell: (r) => (
        <span className="text-fg-2" title={when(r.submitted_at)}>
          {r.submitted_at ? ago(r.submitted_at, now) : "—"}
          {r.submissions > 1 && <span className="ml-1.5 text-[11px] text-fg-3">· resubmission</span>}
        </span>
      ),
      hideOn: "sm",
    },
    { key: "sla", header: "SLA", cell: (r) => (r.sla ? <SlaBadge sla={r.sla} submittedAt={r.submitted_at} now={now} /> : r.decided_at ? <span className="text-[12px] text-fg-3">Decided {ago(r.decided_at, now)}</span> : <span className="text-fg-3">—</span>) },
    {
      key: "flags",
      header: "Checks",
      cell: (r) =>
        r.flags.duplicate_documents > 0 ? (
          <Chip size="sm" tone="down">
            <AlertTriangle className="size-3" /> Duplicate file
          </Chip>
        ) : (
          <span className="text-[12px] text-fg-3">{r.documents} docs</span>
        ),
      hideOn: "md",
    },
    { key: "reviewer", header: "Reviewer", cell: (r) => <span className="text-[12.5px] text-fg-2">{r.reviewer?.name ?? <span className="text-fg-3">Unassigned</span>}</span>, hideOn: "xl" },
    { key: "status", header: "Status", align: "right", cell: (r) => <CaseStatusChip status={r.status} /> },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="KYC review"
        subtitle={data ? `Oldest first by SLA (${data.sla_hours}h target) · typical review ${data.typical_hours}h` : "Identity verification queue"}
        actions={
          <Button variant="surface" onClick={reload}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      <Reveal>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Waiting", value: c ? c.submitted : undefined, sub: "Submitted, not yet picked up", icon: <Clock /> },
            { label: "In review", value: c?.in_review, sub: "Claimed by a reviewer", icon: <UserCheck /> },
            { label: "Past SLA", value: c?.breached, sub: data ? `Older than ${data.sla_hours}h` : "—", icon: <Timer />, warn: (c?.breached ?? 0) > 0 },
            { label: "Decided · 7 days", value: c ? c.approved_7d + c.rejected_7d : undefined, sub: c ? `${c.approved_7d} approved · ${c.rejected_7d} rejected · ${c.more_info} awaiting client` : "—", icon: <FileCheck2 /> },
          ].map((x) => (
            <div key={x.label} className="k-row flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-[11px] uppercase tracking-wider text-fg-3">{x.label}</div>
                <div className={`k-num mt-1 text-[20px] font-medium ${x.warn ? "text-down" : ""}`}>{x.value?.toLocaleString("en-US") ?? "—"}</div>
                <div className="truncate text-[11.5px] text-fg-3">{x.sub}</div>
              </div>
              <span className="hidden size-8 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-3 sm:grid [&_svg]:size-4">{x.icon}</span>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal delay={0.05}>
        <Card className="px-4 pb-5 pt-5 sm:px-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex h-9 w-full min-w-0 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 sm:w-auto sm:max-w-sm sm:flex-1">
              <Search className="size-3.5 shrink-0 text-fg-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, client ID or KYC reference" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-3" aria-label="Search cases" />
            </div>
            <Segmented
              size="xs"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "queue", label: `Queue${c ? ` · ${c.submitted + c.in_review}` : ""}` },
                { value: "more_info", label: `Awaiting client${c ? ` · ${c.more_info}` : ""}` },
                { value: "decided", label: "Decided" },
                { value: "all", label: "All" },
              ]}
            />
            <Segmented size="xs" value={kind} onChange={setKind} options={[{ value: "all", label: "All types" }, { value: "individual", label: "Individual" }, { value: "corporate", label: "Corporate" }]} />
          </div>
          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : !data ? (
            <TableSkeleton />
          ) : (
            <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
              <DataTable
                rows={data.items}
                pageSize={PER}
                columns={columns}
                rowKey={(r) => String(r.id)}
                onRowClick={(r) => router.push(`/clients/kyc/${r.id}`)}
                empty={
                  filter === "queue" ? (
                    <EmptyState title="Queue is clear" text="New submissions appear here the moment a client submits their documents." illustration="check_mark_button" />
                  ) : (
                    <EmptyState title="No cases" text="Try another filter." illustration="magnifying_glass_tilted_left" />
                  )
                }
              />
              <Pager page={data.page} perPage={data.per_page} total={data.total} onPage={setPage} />
            </div>
          )}
        </Card>
      </Reveal>
    </div>
  );
}

