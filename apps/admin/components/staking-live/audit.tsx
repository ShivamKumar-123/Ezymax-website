"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Button, Card, Chip, DataTable, Dialog, PageHeader, Reveal, Segmented, type ChipTone, type Column } from "@ezymex/ui";
import { MiniStat } from "@/components/config/kit";
import { Pager, TableSkeleton, ago, qs, useApi, useNow, when } from "@/components/live/kit";
import { S, type AuditDoc, type AuditEntry } from "./api";
import { EmptyNote, StakingError, int, useUrlParam } from "./kit";

const PER = 50;

/** Action filters: the service matches a prefix of the action code. */
const FILTERS = [
  { value: "all", label: "All" },
  { value: "plan.", label: "Plans" },
  { value: "rate.", label: "Rates" },
  { value: "settlement.", label: "Settlements" },
  { value: "line.", label: "Transfers" },
  { value: "position.", label: "Positions" },
  { value: "positions.export", label: "Exports" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

const ACTION_LABEL: Record<string, string> = {
  "plan.create": "Plan created",
  "plan.update": "Plan changed",
  "rate.set": "Monthly rate set",
  "settlement.create": "Settlement created",
  "settlement.approve": "Settlement approved",
  "settlement.reject": "Settlement rejected",
  "settlement.retry": "Transfers retried",
  "settlement.paid": "Settlement paid",
  "settlement.partially_paid": "Settlement partly paid",
  "line.failed": "Return transfer refused",
  "position.subscribe": "Client subscribed",
  "position.activate": "Position paid and active",
  "position.payment_failed": "Subscription payment failed",
  "position.matured": "Principal returned",
  "position.redeem_deferred": "Principal return deferred",
  "positions.export": "Positions exported",
};

export const actionLabel = (a: string) => ACTION_LABEL[a] ?? a;

function tone(action: string): ChipTone {
  if (/failed|reject|deferred/.test(action)) return "down";
  if (/approve|paid$|activate|matured/.test(action)) return "up";
  if (/^rate\./.test(action)) return "gold";
  if (/^settlement\./.test(action)) return "ember";
  if (/export/.test(action)) return "warn";
  return "neutral";
}

/** "staff:12" → "Staff #12", "user:4" → "Client #4", "system" → "System". */
function actorText(a: AuditEntry) {
  const [kind, id] = a.actor.split(":");
  const who = kind === "staff" ? `Staff #${id}` : kind === "user" ? `Client #${id}` : kind === "system" ? "System" : a.actor;
  return { name: a.actorName || who, sub: a.actorName ? who : "" };
}

/** "settlement:12" → "Settlement #12", "plan:3:2026-09" → "Plan #3 · 2026-09". */
function targetText(t: string | null) {
  if (!t) return "—";
  const [kind, id, ...rest] = t.split(":");
  if (!kind || !id) return t;
  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)} #${id}${rest.length ? ` · ${rest.join(":")}` : ""}`;
}

const fmt = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Top-level fields that differ between before and after (every field when there is no before). */
function changes(a: AuditEntry): { k: string; from: unknown; to: unknown }[] {
  const b = obj(a.before);
  const f = obj(a.after);
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(f)])).filter((k) => !["stats", "updatedAt", "updatedBy", "createdAt", "createdBy", "version", "capacityLeft"].includes(k));
  return keys.filter((k) => JSON.stringify(b[k]) !== JSON.stringify(f[k])).map((k) => ({ k, from: b[k], to: f[k] }));
}

export function LiveStakingAudit() {
  const now = useNow();
  const [param, setParam] = useUrlParam("action");
  const filter: Filter = (FILTERS.map((f) => f.value) as string[]).includes(param ?? "") ? (param as Filter) : "all";
  const [page, setPage] = React.useState(1);
  const [open, setOpen] = React.useState<AuditEntry | null>(null);
  React.useEffect(() => setPage(1), [filter]);
  const { data, error, loading, reload } = useApi<AuditDoc>(`${S("audit")}${qs({ action: filter, page, limit: PER })}`, { refreshMs: 60_000 });

  const cols: Column<AuditEntry>[] = [
    {
      key: "at",
      header: "Time",
      csv: (a) => a.at,
      cell: (a) => (
        <span className="whitespace-nowrap text-[12px]" title={when(a.at, true)}>
          {when(a.at)}
          <span className="block text-[10.5px] text-fg-3">{ago(a.at, now)}</span>
        </span>
      ),
    },
    {
      key: "who",
      header: "Actor",
      csv: (a) => `${actorText(a).name} (${a.actor})`,
      cell: (a) => {
        const t = actorText(a);
        return (
          <span className="block max-w-40 text-[12.5px]">
            <span className="block truncate">{t.name}</span>
            {t.sub && <span className="block font-mono text-[10.5px] text-fg-3">{t.sub}</span>}
          </span>
        );
      },
    },
    { key: "ac", header: "Action", csv: (a) => a.action, cell: (a) => <Chip size="sm" tone={tone(a.action)}>{actionLabel(a.action)}</Chip> },
    { key: "t", header: "Target", hideOn: "md", csv: (a) => a.target ?? "", cell: (a) => <span className="whitespace-nowrap text-[12.5px] text-fg-2">{targetText(a.target)}</span> },
    { key: "r", header: "Reason", csv: (a) => a.reason ?? "", cell: (a) => <span className="line-clamp-2 max-w-72 text-[12.5px] text-fg-2">{a.reason || "—"}</span> },
    {
      key: "c",
      header: "Change",
      hideOn: "lg",
      csv: (a) => changes(a).map((c) => `${c.k}: ${fmt(c.from)} -> ${fmt(c.to)}`).join("; "),
      cell: (a) => {
        const cs = changes(a);
        if (!cs.length) return <span className="text-fg-3">—</span>;
        return (
          <span className="block max-w-80 space-y-0.5 font-mono text-[11px]">
            {cs.slice(0, 3).map((c) => (
              <span key={c.k} className="block truncate">
                <span className="text-fg-3">{c.k}</span> {a.before ? <>{fmt(c.from)} → </> : null}
                <span className="text-fg">{fmt(c.to)}</span>
              </span>
            ))}
            {cs.length > 3 && <span className="text-fg-3">+{cs.length - 3} more</span>}
          </span>
        );
      },
    },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="Staking audit"
        subtitle="Append-only log of plans, rates, settlements, exports and the money flows, with who did it and why."
        actions={
          <Button variant="surface" onClick={reload}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      {error && !data ? (
        <StakingError error={error} onRetry={reload} />
      ) : (
        <Reveal>
          <Card className="p-4 sm:p-6">
            <div className="mb-3 overflow-x-auto">
              <Segmented size="xs" value={filter} onChange={(v) => setParam(v === "all" ? null : v)} options={FILTERS.map((f) => ({ value: f.value, label: f.label }))} />
            </div>
            {!data ? (
              <TableSkeleton />
            ) : (
              <div className={loading ? "opacity-60 transition-opacity" : undefined}>
                <DataTable
                  columns={cols}
                  rows={data.items}
                  dense
                  pageSize={PER}
                  rowKey={(a) => String(a.id)}
                  onRowClick={setOpen}
                  exportName={`staking-audit${filter === "all" ? "" : `-${filter.replace(/\.$/, "")}`}-p${page}`}
                  empty={<EmptyNote className="mt-3" title="No entries" text="Plan changes, rates, settlements, transfers and exports are written here with the staff member and the reason." />}
                />
                <Pager page={page} perPage={PER} total={data.total} onPage={setPage} />
              </div>
            )}
          </Card>
        </Reveal>
      )}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)} width={720} title={open ? actionLabel(open.action) : ""} description={open ? `Entry #${open.id} · ${when(open.at, true)} · ${open.action}` : undefined}>
        {open && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <MiniStat label="Actor" value={actorText(open).name} sub={open.actor} />
              <MiniStat label="Target" value={targetText(open.target)} sub={open.target ?? undefined} />
            </div>
            <div>
              <div className="k-label mb-1.5">Reason</div>
              <p className="rounded-[12px] border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] text-fg-2">{open.reason || "—"}</p>
            </div>
            {changes(open).length > 0 && (
              <div>
                <div className="k-label mb-1.5">Changed fields · {int(changes(open).length)}</div>
                <div className="space-y-1 rounded-[12px] border border-line bg-surface-2 px-3.5 py-2.5 font-mono text-[11.5px]">
                  {changes(open).map((c) => (
                    <div key={c.k} className="break-all">
                      <span className="text-fg-3">{c.k}</span> {open.before ? <span className="text-fg-3">{fmt(c.from)} → </span> : null}
                      <span className="text-fg">{fmt(c.to)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(["before", "after"] as const).map((k) => (
                <details key={k} open className="group">
                  <summary className="k-label mb-1.5 cursor-pointer select-none">{k === "before" ? "Before" : "After"}</summary>
                  <pre className="max-h-80 overflow-auto rounded-[12px] border border-line bg-surface-2 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-fg-2">{open[k] !== null && open[k] !== undefined ? JSON.stringify(open[k], null, 2) : "—"}</pre>
                </details>
              ))}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
