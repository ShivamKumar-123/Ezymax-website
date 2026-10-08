"use client";

/**
 * Options › Audit: every Back Office change to options (who, when, the reason, before / after), newest first.
 * Ezymex staff can include every broker's entries.
 *
 *   GET /api/options/audit?limit=&before=&all=
 */
import * as React from "react";
import { ChevronDown, Download, RefreshCw, ScrollText, Search } from "lucide-react";
import { Button, Card, Chip, EmptyState, PageHeader, Reveal, Segmented, cn, type ChipTone } from "@ezymex/ui";
import { ErrorState, TableSkeleton, ago, downloadCsv, useNow, when } from "@/components/live/kit";
import type { AuditEntry } from "./types";
import { useOpt, useOptPerms } from "./kit";
import { IS_DEMO } from "@ezymex/mock/mode";
import { mockOptionsRequest } from "@ezymex/mock/admin-options";

const ACTION: Record<string, { label: string; tone: ChipTone }> = {
  "underlying.update": { label: "Underlying changed", tone: "info" },
  "rate.update": { label: "Rate changed", tone: "info" },
  "holiday.upsert": { label: "Holiday saved", tone: "info" },
  "holiday.disable": { label: "Holiday removed", tone: "warn" },
  "surface.publish": { label: "Surface published", tone: "ember" },
  "tenant.update": { label: "Broker switch", tone: "down" },
  "group.upsert": { label: "Pricing saved", tone: "gold" },
  "group.delete": { label: "Pricing deleted", tone: "warn" },
  "control.add": { label: "Control set", tone: "down" },
  "control.clear": { label: "Control cleared", tone: "up" },
  "limit.upsert": { label: "Client limit saved", tone: "gold" },
  "limit.delete": { label: "Client limit removed", tone: "warn" },
  "fixing.manual": { label: "Manual fixing", tone: "down" },
  "fixing.recompute": { label: "Fixing recomputed", tone: "warn" },
  "settlement.rerun": { label: "Settlement re-run", tone: "down" },
  "trade.void": { label: "Trade voided", tone: "down" },
};
const AREAS: { value: string; label: string; match: (a: string) => boolean }[] = [
  { value: "all", label: "All", match: () => true },
  { value: "config", label: "Config", match: (a) => /^(underlying|rate|holiday|surface)\./.test(a) },
  { value: "pricing", label: "Pricing", match: (a) => a.startsWith("group.") },
  { value: "dealing", label: "Dealing", match: (a) => /^(control|limit|trade)\./.test(a) },
  { value: "settle", label: "Settlement", match: (a) => /^(fixing|settlement)\./.test(a) },
  { value: "brokers", label: "Brokers", match: (a) => a.startsWith("tenant.") },
];

export function AuditPage() {
  const perms = useOptPerms();
  const now = useNow();
  const [everyone, setEveryone] = React.useState(false);
  const [area, setArea] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState<number | null>(null);
  const url = `/api/options/audit?limit=200${everyone && perms.platform ? "&all=true" : ""}`;
  const first = useOpt<{ audit: AuditEntry[]; next: number | null }>(url, { refreshMs: 30_000 });
  const [more, setMore] = React.useState<AuditEntry[]>([]);
  const [next, setNext] = React.useState<number | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  React.useEffect(() => {
    setMore([]);
    setNext(first.data?.next ?? null);
  }, [first.data]);

  const loadMore = async () => {
    if (next === null) return;
    setLoadingMore(true);
    const u = `${url}&before=${next}`;
    let data: { audit: AuditEntry[]; next: number | null } | null = null;
    if (IS_DEMO) {
      const r = await mockOptionsRequest("GET", u);
      data = r.status === 200 ? (r.data as typeof data) : null;
    } else {
      const r = await fetch(u, { cache: "no-store", credentials: "same-origin" }).catch(() => null);
      data = r?.ok ? await r.json() : null;
    }
    setLoadingMore(false);
    if (data) {
      setMore((m) => [...m, ...data!.audit]);
      setNext(data.next);
    }
  };

  const all = [...(first.data?.audit ?? []), ...more];
  const match = AREAS.find((a) => a.value === area)!.match;
  const ql = q.trim().toLowerCase();
  const rows = all.filter((e) => match(e.action) && (!ql || `${e.actor} ${e.action} ${e.target} ${e.reason} ${e.tenant}`.toLowerCase().includes(ql)));

  return (
    <div className="pb-10">
      <PageHeader
        title="Options audit"
        subtitle="Every change made in the Options section: who, when, why, and the values before and after. Append-only."
        actions={
          <>
            <Button variant="surface" size="lg" onClick={() => downloadCsv("options-audit", ["id", "at", "tenant", "actor", "action", "target", "reason", "before", "after"], rows.map((e) => [e.id, e.at, e.tenant, e.actor, e.action, e.target, e.reason, JSON.stringify(e.before ?? null), JSON.stringify(e.after ?? null)]))} disabled={!rows.length}>
              <Download /> CSV
            </Button>
            <Button variant="surface" size="lg" onClick={first.reload}>
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />
      <Reveal delay={0.03}>
        <Card className="px-4 py-5 sm:px-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex h-9 w-full min-w-0 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 sm:w-auto sm:max-w-xs sm:flex-1">
              <Search className="size-3.5 shrink-0 text-fg-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Staff, target or reason" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-3" aria-label="Search the audit log" />
            </div>
            <Segmented size="xs" value={area} onChange={setArea} options={AREAS.map((a) => ({ value: a.value, label: a.label }))} />
            {perms.platform && <Segmented size="xs" value={everyone ? "all" : "own"} onChange={(v) => setEveryone(v === "all")} options={[{ value: "own", label: "Ezymex" }, { value: "all", label: "All brokers" }]} />}
          </div>
          {first.error ? (
            <ErrorState error={first.error} onRetry={first.reload} />
          ) : !first.data ? (
            <TableSkeleton rows={10} />
          ) : !rows.length ? (
            <EmptyState title="Nothing logged" text={ql || area !== "all" ? "Try another filter." : "Changes in the Options section appear here."} illustration="magnifying_glass_tilted_left" />
          ) : (
            <div className="space-y-1.5">
              {rows.map((e) => {
                const a = ACTION[e.action] ?? { label: e.action, tone: "neutral" as ChipTone };
                const expanded = open === e.id;
                const hasDiff = e.before != null || e.after != null;
                return (
                  <div key={e.id} className="k-row px-4 py-3">
                    <button type="button" className="grid w-full grid-cols-1 items-center gap-2 text-left md:grid-cols-[150px_170px_minmax(0,1fr)_minmax(0,1.4fr)_20px]" onClick={() => setOpen(expanded ? null : e.id)} aria-expanded={expanded}>
                      <span className="text-[12px] text-fg-3" title={when(e.at, true)}>
                        {ago(e.at, now)}
                        <span className="block text-[10.5px]">{when(e.at)}</span>
                      </span>
                      <span className="flex flex-wrap items-center gap-1">
                        <Chip size="sm" tone={a.tone}>
                          {a.label}
                        </Chip>
                        {e.tenant !== "ezymex" && <Chip size="sm">{e.tenant}</Chip>}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-[12.5px]">{e.target}</span>
                        <span className="block truncate text-[11px] text-fg-3">{e.actor}</span>
                      </span>
                      <span className="truncate text-[12.5px] text-fg-2" title={e.reason}>
                        {e.reason || <span className="text-fg-3">no reason</span>}
                      </span>
                      <ChevronDown className={cn("size-4 text-fg-3 transition-transform", expanded && "rotate-180", !hasDiff && "opacity-30")} />
                    </button>
                    {expanded && (
                      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                        <Diff title="Before" v={e.before} other={e.after} />
                        <Diff title="After" v={e.after} other={e.before} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {next !== null && rows.length > 0 && (
            <div className="mt-4 flex justify-center">
              <Button variant="surface" size="sm" onClick={loadMore} disabled={loadingMore}>
                <ScrollText /> {loadingMore ? "Loading…" : "Load older"}
              </Button>
            </div>
          )}
        </Card>
      </Reveal>
    </div>
  );
}

function Diff({ title, v, other }: { title: string; v: unknown; other: unknown }) {
  const flat = (x: unknown): [string, string][] => (x && typeof x === "object" && !Array.isArray(x) ? Object.entries(x as Record<string, unknown>).map(([k, val]) => [k, typeof val === "object" ? JSON.stringify(val) : String(val)]) : x == null ? [] : [["value", JSON.stringify(x)]]);
  const rows = flat(v);
  const o = new Map(flat(other));
  return (
    <div className="rounded-[12px] border border-line bg-surface-2/50 px-3 py-2">
      <div className="mb-1 text-[10.5px] uppercase tracking-wider text-fg-3">{title}</div>
      {!rows.length ? (
        <div className="text-[12px] text-fg-3">—</div>
      ) : (
        <div className="space-y-0.5">
          {rows.map(([k, val]) => (
            <div key={k} className="flex gap-2 font-mono text-[11.5px]">
              <span className="shrink-0 text-fg-3">{k}</span>
              <span className={cn("min-w-0 break-all", o.has(k) && o.get(k) !== val ? "text-ember" : "text-fg-2")}>{val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
