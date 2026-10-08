"use client";

import * as React from "react";
import { Flag as FlagIcon, Lock, RefreshCw, Search } from "lucide-react";
import { Button, Card, DataTable, Flag, Money, PageHeader, Reveal, Segmented, Chip, type Column } from "@ezymex/ui";
import { MiniStat, Select } from "@/components/config/kit";
import { Pager, TableSkeleton, day, useApi, useDebounced } from "@/components/live/kit";
import { P, type Overview, type Paged, type PartnerRow } from "./api";
import { EmptyNote, LevelChip, PartnersError, int, useLevels, usePerms, useUrlParam } from "./kit";
import { PartnerDrawer } from "./partner-detail";

const PER = 25;

export function LivePartnersList() {
  const perms = usePerms();
  const { levels } = useLevels();
  const [sel, setSel] = useUrlParam("partner");
  const [q, setQ] = React.useState("");
  const dq = useDebounced(q.trim(), 300);
  const [level, setLevel] = React.useState("all");
  const [scope, setScope] = React.useState<"ibs" | "all">("ibs");
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [dq, level, scope]);

  const url = `${P("partners")}?scope=${scope}&page=${page}&limit=${PER}${level !== "all" ? `&level=${level}` : ""}${dq ? `&q=${encodeURIComponent(dq)}` : ""}`;
  const { data, error, loading, reload } = useApi<Paged<PartnerRow>>(url);
  const { data: ov, reload: reloadOv } = useApi<Overview>(P("overview"));
  const rows = data?.items ?? [];
  const selId = sel && /^\d+$/.test(sel) ? Number(sel) : null;

  const cols: Column<PartnerRow>[] = [
    {
      key: "p",
      header: "Member",
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-2.5">
          {r.country ? <Flag country={r.country.toLowerCase()} className="size-4" /> : <span className="size-4" />}
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-fg">{r.name}</span>
            <span className="block truncate font-mono text-[11px] text-fg-3">
              #{r.id} · {r.code}
            </span>
          </span>
        </span>
      ),
      csv: (r) => `${r.name} #${r.id}`,
    },
    {
      key: "lvl",
      header: "Level",
      cell: (r) => (
        <span className="inline-flex items-center gap-1">
          <LevelChip level={r.level} levels={levels} />
          {r.levelLocked && <Lock className="size-3 text-fg-3" aria-label="Level locked" />}
        </span>
      ),
      csv: (r) => r.level,
    },
    {
      key: "up",
      header: "Upline",
      hideOn: "lg",
      cell: (r) => (r.parentId ? <span className="block max-w-40 truncate text-[12.5px] text-fg-2">{r.parentName?.trim() || `#${r.parentId}`}<span className="ml-1 font-mono text-[10.5px] text-fg-3">#{r.parentId}</span></span> : <span className="text-[12px] text-fg-3">None</span>),
      csv: (r) => r.parentId ?? "",
    },
    {
      key: "cl",
      header: "Clients",
      align: "right",
      cell: (r) => (
        <span className="k-num">
          <span className="font-medium text-fg">{int(r.activeClients)}</span>
          <span className="text-fg-3"> / {int(r.clients)}</span>
        </span>
      ),
      csv: (r) => r.clients,
    },
    { key: "m", header: "This month", align: "right", cell: (r) => <Money value={r.commissionMonth} countUp={false} className="font-medium" />, csv: (r) => r.commissionMonth },
    { key: "pe", header: "Pending", align: "right", hideOn: "md", cell: (r) => <Money value={r.pending} countUp={false} className="text-fg-2" />, csv: (r) => r.pending },
    { key: "pa", header: "Paid", align: "right", hideOn: "xl", cell: (r) => <Money value={r.paid} countUp={false} className="text-fg-2" />, csv: (r) => r.paid },
    { key: "j", header: "Joined", hideOn: "xl", cell: (r) => <span className="whitespace-nowrap text-[12px] text-fg-3">{day(r.joinedAt)}</span>, csv: (r) => r.joinedAt },
    {
      key: "st",
      header: "Status",
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <Chip size="sm" dot tone={r.status === "active" ? "up" : "down"}>
            {r.status === "active" ? "Active" : "Suspended"}
          </Chip>
          {(r.openFlags > 0 || r.selfReferral) && <FlagIcon className="size-3.5 text-down" aria-label="Open fraud flags" />}
        </span>
      ),
      csv: (r) => r.status,
    },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="Partners"
        subtitle="Every client is an IB from sign-up. Open a member for its network, commissions and actions."
        actions={
          <Button
            variant="surface"
            onClick={() => {
              reload();
              reloadOv();
            }}
          >
            <RefreshCw /> Refresh
          </Button>
        }
      />

      <Reveal>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat label="Members" value={ov ? int(ov.kpis.members) : "—"} sub="All clients, all levels" />
          <MiniStat label="IBs with clients" value={ov ? int(ov.kpis.ibsWithClients) : "—"} sub={ov ? `${int(ov.kpis.earningIbs)} earning this month` : undefined} />
          <MiniStat label="Referred clients" value={ov ? int(ov.kpis.referredClients) : "—"} sub="Members with an upline" />
          <MiniStat label="Open flags" value={ov ? int(ov.kpis.openFlags) : "—"} sub="Fraud review queue" tone={ov?.kpis.openFlags ? "warn" : undefined} />
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <Card className="p-4 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Segmented
              size="xs"
              value={scope}
              onChange={setScope}
              options={[
                { value: "ibs", label: "IBs with clients" },
                { value: "all", label: "All clients" },
              ]}
            />
            <Select size="sm" className="w-36" value={level} onChange={setLevel} options={[{ value: "all", label: "All levels" }, ...levels.map((l) => ({ value: l.key, label: l.name }))]} />
            <div className="flex h-9 w-full items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 sm:ml-auto sm:w-72">
              <Search className="size-3.5 shrink-0 text-fg-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, code or #id" aria-label="Search partners" className="w-full bg-transparent text-[13px] outline-none placeholder:text-fg-3" />
            </div>
          </div>
          {scope === "ibs" && <div className="mb-3 text-[12px] text-fg-3">Members with at least one referred client, or above the entry level.</div>}
          {error && !data ? (
            <PartnersError error={error} onRetry={reload} />
          ) : !data ? (
            <TableSkeleton />
          ) : (
            <div className={loading ? "opacity-60 transition-opacity" : undefined}>
              <DataTable
                columns={cols}
                rows={rows}
                pageSize={PER}
                dense
                rowKey={(r) => String(r.id)}
                onRowClick={(r) => setSel(String(r.id))}
                empty={
                  <EmptyNote
                    className="mt-3"
                    title={dq || level !== "all" ? "No members match" : scope === "ibs" ? "No IBs with clients yet" : "No members yet"}
                    text={
                      dq || level !== "all"
                        ? "Try another search or level."
                        : scope === "ibs"
                          ? "A member shows up here once someone signs up with its link or code. Switch to “All clients” to see everyone."
                          : "Members are mirrored from the gateway as clients sign up."
                    }
                    action={
                      scope === "ibs" && !dq && level === "all" ? (
                        <Button size="sm" variant="surface" onClick={() => setScope("all")}>
                          Show all clients
                        </Button>
                      ) : undefined
                    }
                  />
                }
              />
              <Pager page={page} perPage={PER} total={data.total} onPage={setPage} />
            </div>
          )}
        </Card>
      </Reveal>

      <PartnerDrawer
        id={selId}
        levels={levels}
        canWrite={perms.write}
        onClose={() => setSel(null)}
        onOpen={(id) => setSel(String(id))}
        onChanged={() => {
          reload();
          reloadOv();
        }}
      />
    </div>
  );
}
