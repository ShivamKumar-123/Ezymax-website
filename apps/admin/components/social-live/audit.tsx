"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Button, Card, Chip, DataTable, Dialog, EmptyState, PageHeader, Reveal, type ChipTone, type Column } from "@ezymex/ui";
import { MiniStat } from "@/components/config/kit";
import { TableSkeleton, ago, useApi, useNow, when, type ApiErr } from "@/components/live/kit";
import { SocialError, type SocialAudit } from "./kit";

const PER = 100;

const staffName = (a: SocialAudit) => (typeof a.staff === "string" ? a.staff : a.staff?.name) || "System";
const staffRole = (a: SocialAudit) => (typeof a.staff === "object" && a.staff ? a.staff.role : "");
const idNum = (id: string) => Number(String(id).replace(/\D/g, "")) || null;

/** "social.master.emergency" → "Master · emergency". */
export function socialActionLabel(action: string) {
  const parts = action.replace(/^social\./, "").split(/[._]/);
  if (parts.length === 0) return action;
  const [head, ...rest] = parts;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return rest.length ? `${cap(head!)} · ${rest.join(" ")}` : cap(head!);
}

function actionTone(action: string): ChipTone {
  if (/emergency|suspend|freeze|reject|stop/.test(action) && !/unfreeze/.test(action)) return "down";
  if (/approve|reinstate|unfreeze|paid/.test(action)) return "up";
  if (/hide|settings/.test(action)) return "warn";
  if (/rollover|snapshot/.test(action)) return "ember";
  return "neutral";
}

const TARGET_KEYS = ["masterId", "fundId", "subscriptionId", "feeId", "nickname", "name"] as const;

/** Best-effort target of an entry: explicit ids in the before/after payloads, else login / tickets. */
function target(a: SocialAudit): string {
  const src = { ...(a.before ?? {}), ...(a.after ?? {}) } as Record<string, unknown>;
  const bits: string[] = [];
  if (src.masterId !== undefined) bits.push(`master #${src.masterId}`);
  if (src.fundId !== undefined) bits.push(`fund #${src.fundId}`);
  if (src.subscriptionId !== undefined) bits.push(`sub #${src.subscriptionId}`);
  if (src.feeId !== undefined) bits.push(`fee #${src.feeId}`);
  if (typeof src.nickname === "string") bits.unshift(src.nickname);
  else if (typeof src.name === "string") bits.unshift(src.name);
  if (a.login) bits.push(`login ${a.login}`);
  if (!bits.length && a.tickets?.length) bits.push(a.tickets.join(", "));
  return bits.join(" · ") || "—";
}

const fmt = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

function changes(a: SocialAudit): { k: string; from: unknown; to: unknown }[] {
  const b = (a.before ?? {}) as Record<string, unknown>;
  const f = (a.after ?? {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(f)])).filter((k) => !(TARGET_KEYS as readonly string[]).includes(k));
  return keys.filter((k) => JSON.stringify(b[k]) !== JSON.stringify(f[k])).map((k) => ({ k, from: b[k], to: f[k] }));
}

export function LiveSocialAuditPage() {
  const now = useNow();
  const first = useApi<SocialAudit[]>(`/api/social/admin/audit?limit=${PER}`, { refreshMs: 30_000 });
  const [older, setOlder] = React.useState<SocialAudit[]>([]);
  const [more, setMore] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [moreErr, setMoreErr] = React.useState<ApiErr | null>(null);
  const [open, setOpen] = React.useState<SocialAudit | null>(null);
  const head = Array.isArray(first.data) ? first.data : [];
  const seen = new Set(head.map((a) => a.id));
  const rows = [...head, ...older.filter((a) => !seen.has(a.id))];
  React.useEffect(() => {
    if (first.data && Array.isArray(first.data) && first.data.length < PER && older.length === 0) setMore(false);
  }, [first.data, older.length]);

  const loadOlder = async () => {
    const last = rows.at(-1);
    const before = last ? idNum(last.id) : null;
    if (!before) return;
    setBusy(true);
    setMoreErr(null);
    try {
      const r = await fetch(`/api/social/admin/audit?limit=${PER}&before=${before}`, { cache: "no-store", credentials: "same-origin" });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) setMoreErr(body?.error ?? { code: "unknown", message: "Something went wrong." });
      else {
        const items = (Array.isArray(body) ? body : []) as SocialAudit[];
        setOlder((xs) => [...xs, ...items]);
        if (items.length < PER) setMore(false);
      }
    } catch {
      setMoreErr({ code: "network", message: "Can't reach the Back Office server." });
    }
    setBusy(false);
  };

  const cols: Column<SocialAudit>[] = [
    { key: "at", header: "Time", sort: (a) => Date.parse(a.at), csv: (a) => a.at, cell: (a) => <span className="whitespace-nowrap text-[12px]" title={when(a.at, true)}>{when(a.at)}<span className="block text-[10.5px] text-fg-3">{ago(a.at, now)}</span></span> },
    { key: "st", header: "Staff", csv: (a) => staffName(a), cell: (a) => <span className="text-[12.5px]">{staffName(a)}<span className="block text-[10.5px] text-fg-3">{staffRole(a).replace(/_/g, " ")}</span></span> },
    { key: "ac", header: "Action", csv: (a) => a.action, cell: (a) => <Chip size="sm" tone={actionTone(a.action)}>{socialActionLabel(a.action)}</Chip> },
    { key: "t", header: "Target", csv: (a) => target(a), cell: (a) => <span className="text-[12.5px] text-fg-2">{target(a)}</span> },
    { key: "n", header: "Note", csv: (a) => a.note ?? "", cell: (a) => <span className="line-clamp-2 max-w-72 text-[12.5px] text-fg-2">{a.note || "—"}</span> },
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
                <span className="text-fg-3">{c.k}</span> {fmt(c.from)} → <span className="text-fg">{fmt(c.to)}</span>
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
        title="Social audit"
        subtitle="Every Back Office action on masters, subscriptions, PAMM funds, fee payouts and social settings"
        actions={
          <Button variant="surface" onClick={first.reload}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      {first.error && !first.data ? (
        <SocialError error={first.error} onRetry={first.reload} />
      ) : (
        <Reveal>
          <Card className="p-4 sm:p-6">
            {!first.data ? (
              <TableSkeleton />
            ) : (
              <>
                <DataTable
                  columns={cols}
                  rows={rows}
                  dense
                  pageSize={25}
                  rowKey={(a) => a.id}
                  onRowClick={setOpen}
                  search={(a) => `${a.action} ${staffName(a)} ${target(a)} ${a.note ?? ""} ${a.id}`}
                  searchPlaceholder="Action, staff, target, note…"
                  exportName="social-audit"
                  empty={<EmptyState illustration="shield" title="No social actions yet" text="Approvals, suspensions, emergency stops, rollovers and settings changes are listed here." />}
                />
                {more && rows.length >= PER && (
                  <div className="mt-4 flex items-center justify-center gap-3">
                    {moreErr && <span className="text-[12px] text-down">{moreErr.message}</span>}
                    <Button variant="surface" size="sm" disabled={busy} onClick={loadOlder}>
                      {busy ? "Loading…" : "Load older entries"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </Card>
        </Reveal>
      )}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)} width={620} title={open ? socialActionLabel(open.action) : ""} description={open ? `${open.id} · ${when(open.at, true)}` : undefined}>
        {open && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <MiniStat label="Staff" value={staffName(open)} sub={staffRole(open).replace(/_/g, " ")} />
              <MiniStat label="Target" value={target(open)} />
            </div>
            <div>
              <div className="k-label mb-1.5">Note</div>
              <p className="rounded-[12px] border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] text-fg-2">{open.note || "—"}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(["before", "after"] as const).map((k) => (
                <div key={k}>
                  <div className="k-label mb-1.5">{k === "before" ? "Before" : "After"}</div>
                  <pre className="max-h-72 overflow-auto rounded-[12px] border border-line bg-surface-2 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-fg-2">{open[k] ? JSON.stringify(open[k], null, 2) : "—"}</pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
