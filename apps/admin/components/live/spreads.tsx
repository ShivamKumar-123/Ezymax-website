"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, History, Info, Pencil, RefreshCw, Save, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Dialog, EmptyState, PageHeader, Reveal, Segmented, Skeleton, SymbolAvatar, cn } from "@kalks/ui";
import { ASSET_CLASS_LABEL } from "@kalks/mock";
import { MiniField, MiniStat, NumInput, TextArea } from "@/components/config/kit";
import { useCan } from "@/components/staff-session";
import { ErrorState, ago, sendJson, useApi, useNow, when } from "./kit";
import type { AuditPage } from "./types";

type Markup = { group_code: string; symbol: string; markup_points: number; min_spread_points: number };
type Inst = { symbol: string; asset_class: string; digits: number };
type Quote = { bid: number; ask: number; t: number };
type SpreadsResp = { groups: string[]; markups: Markup[]; instruments: Inst[]; quotes: Record<string, Quote>; can_edit: boolean };

const GROUP_LABEL: Record<string, string> = { standard: "Standard", pro: "Pro", ecn: "ECN", cent: "Cent" };
const ALL = "*";

function classLabel(c: string) {
  return (ASSET_CLASS_LABEL as Record<string, string>)[c] ?? c.charAt(0).toUpperCase() + c.slice(1);
}

/** Raw spread in points (1 point = 10^-digits). */
function rawPoints(q: Quote | undefined, digits: number) {
  if (!q) return null;
  return Math.max(0, Math.round((q.ask - q.bid) * Math.pow(10, digits)));
}

function resolve(markups: Markup[], group: string, symbol: string): { m: Markup | null; inherited: boolean } {
  const own = markups.find((x) => x.group_code === group && x.symbol === symbol);
  if (own) return { m: own, inherited: false };
  const def = markups.find((x) => x.group_code === group && x.symbol === ALL);
  return { m: def ?? null, inherited: true };
}

function clientPoints(raw: number | null, m: Markup | null) {
  if (raw === null) return null;
  return Math.max(raw + (m?.markup_points ?? 0), m?.min_spread_points ?? 0);
}

type Editing = { group: string; symbol: string; digits: number | null; current: Markup | null; inherited: boolean };

function EditDialog({ editing, raw, onClose, onSaved }: { editing: Editing | null; raw: number | null; onClose: () => void; onSaved: () => void }) {
  const [markup, setMarkup] = React.useState(0);
  const [min, setMin] = React.useState(0);
  const [reason, setReason] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    setMarkup(editing?.current?.markup_points ?? 0);
    setMin(editing?.current?.min_spread_points ?? 0);
    setReason("");
    setErr(null);
  }, [editing]);
  if (!editing) return null;
  const isDefault = editing.symbol === ALL;
  const preview = clientPoints(raw, { group_code: editing.group, symbol: editing.symbol, markup_points: markup, min_spread_points: min });
  const unchanged = !editing.inherited && editing.current?.markup_points === markup && editing.current?.min_spread_points === min;

  async function save() {
    if (!editing) return;
    if (reason.trim().length < 3) return setErr("Give a reason for the audit log (at least 3 characters).");
    setBusy(true);
    setErr(null);
    const r = await sendJson<{ ok: boolean; audited: boolean }>("/api/admin/spreads", { group_code: editing.group, symbol: editing.symbol, markup_points: markup, min_spread_points: min, reason: reason.trim() }, "PUT");
    setBusy(false);
    if (!r.ok) return setErr(r.error.message);
    toast.success(`${GROUP_LABEL[editing.group] ?? editing.group} · ${isDefault ? "all symbols" : editing.symbol} updated`, {
      description: `Markup ${markup} pts, minimum ${min} pts · live on the next quote${r.data.audited ? " · logged to the audit trail" : ""}`,
    });
    onSaved();
    onClose();
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${GROUP_LABEL[editing.group] ?? editing.group} · ${isDefault ? "All symbols" : editing.symbol}`}
      description={isDefault ? "Group default: applies to every symbol without its own override." : editing.inherited ? "This symbol uses the group default. Saving creates an override for it." : "Symbol override for this group."}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="ember" onClick={save} disabled={busy || unchanged}>
            <Save /> {busy ? "Saving…" : "Save change"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <MiniField label="Markup" hint="points">
            <NumInput value={markup} onChange={(v) => setMarkup(Math.round(v))} min={0} max={100000} step={1} suffix="pts" stepper />
          </MiniField>
          <MiniField label="Minimum spread" hint="points">
            <NumInput value={min} onChange={(v) => setMin(Math.round(v))} min={0} max={100000} step={1} suffix="pts" stepper />
          </MiniField>
        </div>
        {!isDefault && (
          <div className="k-row grid grid-cols-3 gap-3 px-4 py-3 text-[12.5px]">
            <div>
              <div className="text-fg-3">Raw now</div>
              <div className="k-num font-mono text-fg">{raw ?? "—"} pts</div>
            </div>
            <div>
              <div className="text-fg-3">Client spread</div>
              <div className="k-num font-mono text-ember">{preview ?? "—"} pts</div>
            </div>
            <div>
              <div className="text-fg-3">Was</div>
              <div className="k-num font-mono text-fg-2">{clientPoints(raw, editing.current) ?? "—"} pts</div>
            </div>
          </div>
        )}
        <p className="flex gap-2 text-[12px] text-fg-3">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Client spread = max(minimum, raw + markup), widened evenly around mid. 1 point is the last price digit (10 points = 1 pip on 5-digit FX). Raw prices, candles and charts are never changed.
        </p>
        <MiniField label="Reason" hint="saved in the audit log">
          <TextArea value={reason} onChange={setReason} rows={2} placeholder="e.g. Widen Pro during news, align ECN with LP pricing" />
        </MiniField>
        {err && <div className="rounded-[12px] border border-down/25 bg-down-soft px-3 py-2 text-[12.5px] text-down">{err}</div>}
      </div>
    </Dialog>
  );
}

function RecentChanges({ version }: { version: number }) {
  const now = useNow();
  const { data, error, reload } = useApi<AuditPage>(`/api/admin/audit?action=spreads.update&per_page=8&v=${version}`);
  return (
    <Card>
      <CardHeader
        title="Recent changes"
        subtitle="From the audit log"
        icon={<History />}
        action={
          <Link href="/security?action=spreads.update" className="inline-flex items-center gap-1 text-[12.5px] text-fg-3 hover:text-fg">
            All <ArrowUpRight className="size-3.5" />
          </Link>
        }
      />
      <div className="px-4 pb-5 pt-3 sm:px-6">
        {error && <ErrorState error={error} onRetry={reload} className="py-6" />}
        {!data && !error && <Skeleton className="h-32 w-full" />}
        {data && data.items.length === 0 && <EmptyState title="No changes yet" text="Every markup change is recorded here with its reason." illustration="calendar" className="py-6" />}
        <div className="divide-y divide-line">
          {data?.items.map((e) => {
            const m = e.meta as { group_code?: string; symbol?: string; reason?: string; before?: { markup_points: number; min_spread_points: number } | null; after?: { markup_points: number; min_spread_points: number } };
            return (
              <div key={e.id} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium">
                    {GROUP_LABEL[m.group_code ?? ""] ?? m.group_code} · {m.symbol === ALL ? "All symbols" : m.symbol}
                  </span>
                  <span className="text-[11.5px] text-fg-3" title={when(e.created_at, true)}>
                    {ago(e.created_at, now)}
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-[12px] text-fg-2">
                  {m.before ? `${m.before.markup_points}/${m.before.min_spread_points}` : "none"} → {m.after ? `${m.after.markup_points}/${m.after.min_spread_points}` : "?"} pts
                </div>
                <div className="mt-0.5 truncate text-[12px] text-fg-3">
                  {e.actor.name ?? "Staff"} · {m.reason}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

export function LiveSpreads() {
  const canAudit = useCan("audit.read");
  const { data, error, reload } = useApi<SpreadsResp>("/api/admin/spreads");
  const live = useApi<{ quotes: Record<string, Quote> }>(data ? "/api/admin/spreads?only=quotes" : null, { refreshMs: 3000 });
  const [cls, setCls] = React.useState("all");
  const [editing, setEditing] = React.useState<Editing | null>(null);
  const [version, setVersion] = React.useState(0);
  const quotes = live.data?.quotes ?? data?.quotes ?? {};

  if (error)
    return (
      <div className="pb-10">
        <PageHeader title="Spread markups" subtitle="Markup over the raw feed per account group and symbol" />
        <Card>
          <ErrorState error={error} onRetry={reload} />
        </Card>
      </div>
    );

  const groups = data?.groups ?? [];
  const markups = data?.markups ?? [];
  const classes = Array.from(new Set((data?.instruments ?? []).map((i) => i.asset_class)));
  const rows = (data?.instruments ?? []).filter((i) => cls === "all" || i.asset_class === cls);
  const overrides = markups.filter((m) => m.symbol !== ALL).length;
  const ticking = (data?.instruments ?? []).filter((i) => quotes[i.symbol] && Date.now() - quotes[i.symbol]!.t < 60_000).length;
  const canEdit = data?.can_edit ?? false;
  const edit = (group: string, symbol: string, digits: number | null) => {
    if (!canEdit) return toast("Your role can view spreads but not change them");
    const r = resolve(markups, group, symbol);
    setEditing({ group, symbol, digits, current: symbol === ALL ? markups.find((m) => m.group_code === group && m.symbol === ALL) ?? null : r.m, inherited: symbol !== ALL && r.inherited });
  };
  const editingRaw = editing && editing.symbol !== ALL && editing.digits !== null ? rawPoints(quotes[editing.symbol], editing.digits) : null;

  return (
    <div className="pb-16">
      <PageHeader
        title="Spread markups"
        subtitle="Markup over the raw Infoway feed per account group, applied to client quotes only. Values in points."
        actions={
          <Button variant="surface" onClick={() => (reload(), setVersion((v) => v + 1))}>
            <RefreshCw /> Refresh
          </Button>
        }
      />

      <Reveal>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat label="Group defaults" value={data && groups.length ? groups.map((g) => `${resolve(markups, g, ALL).m?.markup_points ?? 0}`).join(" · ") : "—"} sub={groups.map((g) => GROUP_LABEL[g] ?? g).join(" · ") + " (pts)"} />
          <MiniStat label="Symbol overrides" value={data ? overrides : "—"} sub="Symbols with their own markup" />
          <MiniStat label="Live symbols" value={data ? `${ticking} / ${data.instruments.length}` : "—"} sub="Quoted in the last minute" tone={data && ticking < data.instruments.length / 2 ? "warn" : undefined} />
          <MiniStat label="Your access" value={canEdit ? "Can edit" : "View only"} sub="Every change needs a reason" tone={canEdit ? "up" : undefined} />
        </div>
      </Reveal>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-12">
        <Reveal delay={0.05} className="2xl:col-span-9">
          <Card>
            <CardHeader
              title="Markup matrix"
              subtitle="Click a cell to change it · markup and the resulting client spread, in points"
              icon={<SlidersHorizontal />}
              action={<Segmented size="xs" value={cls} onChange={setCls} options={[{ value: "all", label: "All" }, ...classes.map((c) => ({ value: c, label: classLabel(c) }))]} />}
            />
            <div className="mt-4 overflow-x-auto px-4 pb-5 sm:px-6">
              {!data ? (
                <Skeleton className="h-96 w-full" />
              ) : !groups.length ? (
                <EmptyState title="No account groups yet" text="Spread markups apply per account group. Create an account group first; its spread group then appears here." />
              ) : (
                <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[12.5px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-fg-3">
                      <th className="sticky left-0 z-10 rounded-l-[14px] border-y border-l border-line bg-surface-2 px-4 py-3 text-left font-medium">Symbol</th>
                      <th className="border-y border-line bg-surface-2 px-3 py-3 text-right font-medium">Raw now</th>
                      {groups.map((g, i) => (
                        <th key={g} className={cn("border-y border-line bg-surface-2 px-3 py-3 text-left font-medium", i === groups.length - 1 && "rounded-r-[14px] border-r")}>
                          {GROUP_LABEL[g] ?? g}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="group">
                      <td className="sticky left-0 z-10 border-b border-line bg-surface px-4 py-2.5 group-hover:bg-surface-2">
                        <span className="font-medium">All symbols</span>
                        <span className="ml-2 text-[10.5px] text-fg-3">group default</span>
                      </td>
                      <td className="border-b border-line px-3 py-2.5 text-right text-fg-3">—</td>
                      {groups.map((g) => {
                        const m = resolve(markups, g, ALL).m;
                        return (
                          <td key={g} className="border-b border-line px-2 py-2">
                            <button onClick={() => edit(g, ALL, null)} className="flex w-full items-center justify-between gap-2 rounded-[10px] border border-line bg-surface-2 px-2.5 py-1.5 text-left hover:border-ember/50" aria-label={`Edit ${g} default`}>
                              <span className="k-num font-mono font-medium">+{m?.markup_points ?? 0}</span>
                              <span className="text-[10.5px] text-fg-3">{m?.min_spread_points ? `min ${m.min_spread_points}` : "no min"}</span>
                              {canEdit && <Pencil className="size-3 text-fg-3" />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                    {rows.map((i) => {
                      const raw = rawPoints(quotes[i.symbol], i.digits);
                      return (
                        <tr key={i.symbol} className="group">
                          <td className="sticky left-0 z-10 border-b border-line bg-surface px-4 py-2 group-hover:bg-surface-2">
                            <span className="flex items-center gap-2.5">
                              <SymbolAvatar symbol={i.symbol} size={20} />
                              <span className="font-medium">{i.symbol}</span>
                              <span className="hidden text-[10.5px] text-fg-3 sm:inline">{classLabel(i.asset_class)}</span>
                            </span>
                          </td>
                          <td className="border-b border-line px-3 py-2 text-right">
                            <span className="k-num font-mono">{raw ?? "—"}</span>
                          </td>
                          {groups.map((g) => {
                            const r = resolve(markups, g, i.symbol);
                            const client = clientPoints(raw, r.m);
                            const floored = raw !== null && r.m && raw + r.m.markup_points < r.m.min_spread_points;
                            return (
                              <td key={g} className="border-b border-line px-2 py-1.5">
                                <button
                                  onClick={() => edit(g, i.symbol, i.digits)}
                                  className={cn("flex w-full items-center justify-between gap-2 rounded-[10px] border px-2.5 py-1 text-left transition-colors hover:border-ember/50", r.inherited ? "border-transparent" : "border-ember/35 bg-ember-soft")}
                                  aria-label={`Edit ${g} ${i.symbol}`}
                                  title={r.inherited ? "Group default" : "Symbol override"}
                                >
                                  <span className={cn("k-num font-mono", r.inherited ? "text-fg-3" : "font-medium text-fg")}>+{r.m?.markup_points ?? 0}</span>
                                  <span className={cn("k-num font-mono text-[11.5px]", floored ? "text-warn" : "text-fg-2")}>{client ?? "—"}</span>
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-fg-3">
                <span className="inline-flex items-center gap-1.5">
                  <Info className="size-3.5" /> Each cell: markup (left) and resulting client spread now (right), in points
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-ember" /> Symbol override
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-warn" /> Minimum applied
                </span>
                <Chip size="sm">Raw feed group has no markup</Chip>
              </div>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.1} className="2xl:col-span-3">
          {canAudit ? (
            <RecentChanges version={version} />
          ) : (
            <Card className="px-6 py-5 text-[12.5px] text-fg-3">Every change is written to the audit log with the staff member, before and after values and the reason.</Card>
          )}
        </Reveal>
      </div>

      <EditDialog
        editing={editing}
        raw={editingRaw}
        onClose={() => setEditing(null)}
        onSaved={() => {
          reload();
          setVersion((v) => v + 1);
        }}
      />
    </div>
  );
}
