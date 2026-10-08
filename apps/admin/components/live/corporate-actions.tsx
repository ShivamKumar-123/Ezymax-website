"use client";

/**
 * Trading › Corporate actions (live): stock splits and cash dividends from the trading engine
 * (services/trading api/corporate.rs). Actions are proposed by hand or by the daily EODHD import ("Refresh" runs it
 * now), approved (four-eyes for splits and dividends of 2 % of the price or more), and applied by the engine at
 * 00:00 exchange time on the ex-date to every account holding the stock. The Infoway adjustment factors confirm
 * them afterwards. Changes are made by platform staff; everything is audited with its reason.
 */
import * as React from "react";
import { CalendarDays, CheckCircle2, Coins, Pencil, Plus, RefreshCw, Scissors, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, Dialog, EmptyState, PageHeader, Reveal, Segmented, Skeleton, cn, type ChipTone, type Column } from "@ezymex/ui";
import { MiniField, MiniStat, NumInput, Select, TextArea, TextInput } from "@/components/config/kit";
import { ErrorState, ago, sendJson, useApi, useNow, when } from "./kit";

type Action = {
  id: number;
  symbol: string;
  kind: "split" | "dividend";
  exDate: string;
  applyAt: string;
  ratioFrom: number | null;
  ratioTo: number | null;
  amount: number | null;
  currency: string | null;
  withholdingPct: number;
  recordDate: string | null;
  payDate: string | null;
  refPrice: number | null;
  fourEyes: boolean;
  status: "proposed" | "approved" | "applying" | "applied" | "rejected" | "cancelled";
  source: string;
  sourceRef: string | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
  approvedBy: string | null;
  appliedAt: string | null;
  report: { accounts?: number; cashBooked?: Record<string, number>; failed?: unknown[] } | null;
  check: { status: "ok" | "mismatch" | "no_data" | null; detail: Record<string, unknown> | null };
  label: string | null;
  openInterest?: number;
};
type ListResp = { actions: Action[]; canPropose: boolean; canApprove: boolean; staffId: string; eodhd: { configured: boolean; message: string | null; lastRun: { startedAt: string; finishedAt: string | null; report: Record<string, unknown> | null } | null } };
type Preview = { login: number; kind: string; tenant?: string; applied: boolean; positions: Record<string, unknown>[]; orders: Record<string, unknown>[] };
type DetailResp = { action: Action; accounts: Preview[]; runs: { login: number; appliedAt: string; result: Record<string, unknown> }[]; audit: { at: string; actor: string; event: string; reason: string | null }[] };

const STATUS_TONE: Record<Action["status"], ChipTone> = { proposed: "warn", approved: "info", applying: "ember", applied: "up", rejected: "down", cancelled: "neutral" };
const CHECK_TONE: Record<string, ChipTone> = { ok: "up", mismatch: "down", no_data: "neutral" };
const fmtDay = (s: string | null) => (s ? new Date(`${s}T12:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const what = (a: Action) => (a.kind === "split" ? `${a.ratioTo}-for-${a.ratioFrom} split` : `${a.amount} ${a.currency} / share`);

/* ------------------------------------------------------------------ */
/* Propose / edit                                                      */
/* ------------------------------------------------------------------ */

type Form = { symbol: string; kind: "split" | "dividend"; exDate: string; ratioFrom: number; ratioTo: number; amount: number; currency: string; withholdingPct: number | null; recordDate: string; payDate: string; note: string; reason: string };
const EMPTY: Form = { symbol: "", kind: "dividend", exDate: "", ratioFrom: 1, ratioTo: 2, amount: 0, currency: "", withholdingPct: null, recordDate: "", payDate: "", note: "", reason: "" };

function ActionForm({ editing, open, onClose, onSaved }: { editing: Action | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = React.useState<Form>(EMPTY);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    setErr(null);
    setF(
      editing
        ? { symbol: editing.symbol, kind: editing.kind, exDate: editing.exDate, ratioFrom: editing.ratioFrom ?? 1, ratioTo: editing.ratioTo ?? 2, amount: editing.amount ?? 0, currency: editing.currency ?? "", withholdingPct: editing.withholdingPct, recordDate: editing.recordDate ?? "", payDate: editing.payDate ?? "", note: editing.note ?? "", reason: "" }
        : EMPTY,
    );
  }, [editing, open]);
  if (!open) return null;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  async function save() {
    if (f.reason.trim().length < 3) return setErr("Give a reason for the audit log (at least 3 characters).");
    setBusy(true);
    setErr(null);
    const body = {
      symbol: f.symbol.trim().toUpperCase(),
      kind: f.kind,
      exDate: f.exDate || undefined,
      ...(f.kind === "split" ? { ratioFrom: f.ratioFrom, ratioTo: f.ratioTo } : { amount: f.amount, currency: f.currency.trim().toUpperCase() || undefined, ...(f.withholdingPct !== null ? { withholdingPct: f.withholdingPct } : {}) }),
      recordDate: f.recordDate || undefined,
      payDate: f.payDate || undefined,
      note: f.note || undefined,
      reason: f.reason.trim(),
    };
    const r = editing ? await sendJson<Action>(`/api/trading/admin/corporate-actions/${editing.id}`, body, "PATCH") : await sendJson<Action>("/api/trading/admin/corporate-actions", body);
    setBusy(false);
    if (!r.ok) return setErr(r.error.message);
    toast.success(editing ? `Action #${editing.id} updated` : `${r.data.symbol}: ${what(r.data)} proposed`, { description: r.data.fourEyes ? "Needs a second person to approve" : "Ready for approval" });
    onSaved();
    onClose();
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={editing ? `Edit action #${editing.id}` : "New corporate action"}
      description="Applies at 00:00 exchange time on the ex-date to every account holding the stock, once approved. An approved action that is edited needs approval again."
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="ember" onClick={save} disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Propose"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <MiniField label="Stock" hint="symbol, e.g. AAPL, 00700.HK, 7203.JP">
            <TextInput value={f.symbol} onChange={(v) => set("symbol", v)} placeholder="AAPL" mono />
          </MiniField>
          <MiniField label="Type">
            <Select value={f.kind} onChange={(v) => set("kind", v)} options={[{ value: "dividend", label: "Cash dividend" }, { value: "split", label: "Split" }]} />
          </MiniField>
          <MiniField label="Ex-date" hint="YYYY-MM-DD">
            <TextInput value={f.exDate} onChange={(v) => set("exDate", v)} placeholder="2026-11-09" mono />
          </MiniField>
          {f.kind === "split" ? (
            <div className="grid grid-cols-2 gap-2">
              <MiniField label="Old shares">
                <NumInput value={f.ratioFrom} onChange={(v) => set("ratioFrom", v)} min={1} step={1} />
              </MiniField>
              <MiniField label="New shares">
                <NumInput value={f.ratioTo} onChange={(v) => set("ratioTo", v)} min={1} step={1} />
              </MiniField>
            </div>
          ) : (
            <MiniField label="Gross per share">
              <NumInput value={f.amount} onChange={(v) => set("amount", v)} min={0} step={0.01} decimals={4} />
            </MiniField>
          )}
          {f.kind === "dividend" && (
            <>
              <MiniField label="Currency" hint="default: the stock's">
                <TextInput value={f.currency} onChange={(v) => set("currency", v)} placeholder="USD" mono />
              </MiniField>
              <MiniField label="Withholding on longs" hint="% · default by listing: US 30, JP 15.315, HK 0">
                <NumInput value={f.withholdingPct ?? 0} onChange={(v) => set("withholdingPct", v)} min={0} max={100} step={0.5} suffix="%" />
              </MiniField>
              <MiniField label="Record date">
                <TextInput value={f.recordDate} onChange={(v) => set("recordDate", v)} placeholder="optional" mono />
              </MiniField>
              <MiniField label="Pay date">
                <TextInput value={f.payDate} onChange={(v) => set("payDate", v)} placeholder="optional" mono />
              </MiniField>
            </>
          )}
        </div>
        <MiniField label="Note">
          <TextInput value={f.note} onChange={(v) => set("note", v)} placeholder="Source, press release…" />
        </MiniField>
        <MiniField label="Reason" hint="saved in the audit log">
          <TextArea value={f.reason} onChange={(v) => set("reason", v)} rows={2} placeholder="e.g. Board declared a quarterly dividend" />
        </MiniField>
        {err && <div className="rounded-[12px] border border-down/25 bg-down-soft px-3 py-2 text-[12.5px] text-down">{err}</div>}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

function DetailDialog({ id, list, onClose, onChanged, onEdit }: { id: number | null; list: ListResp | null; onClose: () => void; onChanged: () => void; onEdit: (a: Action) => void }) {
  const now = useNow();
  const { data, error, reload } = useApi<DetailResp>(id ? `/api/trading/admin/corporate-actions/${id}` : null);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => {
    setReason("");
    setErr(null);
  }, [id]);
  if (!id) return null;
  const a = data?.action;
  const act = async (path: "approve" | "reject" | "check") => {
    if (path !== "check" && reason.trim().length < 3) return setErr("Give a reason (at least 3 characters).");
    setBusy(true);
    setErr(null);
    const r = await sendJson<Action | { status: string }>(`/api/trading/admin/corporate-actions/${id}/${path}`, path === "check" ? {} : { reason: reason.trim() });
    setBusy(false);
    if (!r.ok) return setErr(r.error.message);
    toast.success(path === "approve" ? "Approved: applies on the ex-date" : path === "reject" ? "Rejected" : `Provider check: ${(r.data as { status: string }).status}`);
    reload();
    onChanged();
  };
  const editable = a && (a.status === "proposed" || a.status === "approved");
  const affected = data?.accounts ?? [];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={a ? `#${a.id} · ${a.symbol} · ${what(a)}` : "Corporate action"} description={a ? `Ex-date ${fmtDay(a.exDate)} · applies ${when(a.applyAt)} · ${a.source === "eodhd" ? `EODHD ${a.sourceRef ?? ""}` : "manual entry"}` : undefined}>
      {error && <ErrorState error={error} onRetry={reload} />}
      {!data && !error && <Skeleton className="h-40 w-full" />}
      {a && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Chip size="sm" tone={STATUS_TONE[a.status]} dot className="capitalize">
              {a.status}
            </Chip>
            {a.fourEyes && <Chip size="sm" tone="warn">Four-eyes</Chip>}
            {a.check.status && <Chip size="sm" tone={CHECK_TONE[a.check.status] ?? "neutral"}>Provider check: {a.check.status.replace("_", " ")}</Chip>}
            {a.kind === "dividend" && <Chip size="sm">Withholding {a.withholdingPct}%</Chip>}
            {a.refPrice && <Chip size="sm">Price when proposed {a.refPrice}</Chip>}
          </div>
          <div className="text-[12.5px] text-fg-3">
            Proposed by {a.createdBy} · {ago(a.createdAt, now)}
            {a.approvedBy ? ` · approved by ${a.approvedBy}` : ""}
            {a.note ? ` · ${a.note}` : ""}
          </div>
          {a.report && (
            <div className="k-row px-4 py-3 text-[12.5px]">
              Applied to {a.report.accounts ?? 0} accounts{a.report.cashBooked && Object.keys(a.report.cashBooked).length ? ` · cash ${Object.entries(a.report.cashBooked).map(([c, v]) => `${v} ${c}`).join(", ")}` : ""}
              {a.report.failed && a.report.failed.length ? <span className="text-down"> · {a.report.failed.length} failed (retried every 20 s)</span> : null}
            </div>
          )}
          <div>
            <div className="mb-2 text-[12px] font-medium uppercase tracking-wider text-fg-3">{a.status === "applied" ? "Accounts" : "Affected positions and orders (preview)"}</div>
            {affected.length === 0 ? (
              <div className="text-[12.5px] text-fg-3">No account holds {a.symbol}.</div>
            ) : (
              <div className="max-h-[260px] overflow-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-[10.5px] uppercase tracking-wider text-fg-3">
                      <th className="py-1">Login</th>
                      <th className="py-1">Kind</th>
                      <th className="py-1">Positions</th>
                      <th className="py-1">Orders</th>
                      <th className="py-1 text-right">Done</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {affected.map((p) => (
                      <tr key={p.login}>
                        <td className="py-1.5 font-mono">{p.login}</td>
                        <td className="py-1.5">{p.kind}</td>
                        <td className="py-1.5 font-mono text-[11.5px]">
                          {p.positions.map((x, i) => (
                            <div key={i}>
                              #{String(x.ticket)} {String(x.side)} {String(x.volume)}
                              {x.newVolume !== undefined ? ` → ${String(x.newVolume)} @ ${String(x.newOpenPrice)}` : ""}
                              {x.cash !== undefined ? ` · ${String(x.cash)} ${String(x.currency)}${x.accountAmount !== null && x.accountAmount !== undefined ? ` (${String(x.accountAmount)})` : ""}` : ""}
                            </div>
                          ))}
                        </td>
                        <td className="py-1.5 font-mono text-[11.5px]">
                          {p.orders.map((x, i) => (
                            <div key={i}>
                              #{String(x.ticket)} {String(x.volume)} @ {String(x.price)} → {String(x.newVolume)} @ {String(x.newPrice)}
                            </div>
                          ))}
                        </td>
                        <td className="py-1.5 text-right">{p.applied ? <CheckCircle2 className="ml-auto size-3.5 text-up" /> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {(data?.audit.length ?? 0) > 0 && (
            <div>
              <div className="mb-1 text-[12px] font-medium uppercase tracking-wider text-fg-3">History</div>
              <div className="space-y-1 text-[12px]">
                {data!.audit.map((e, i) => (
                  <div key={i} className="flex justify-between gap-3">
                    <span>
                      <span className="font-medium capitalize">{e.event.replace("_", " ")}</span> · {e.actor}
                      {e.reason ? ` · ${e.reason}` : ""}
                    </span>
                    <span className="shrink-0 text-fg-3">{ago(e.at, now)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(editable || a.status === "applied") && (
            <div className="space-y-2 border-t border-line pt-3">
              {editable && (list?.canApprove || list?.canPropose) && (
                <MiniField label="Reason" hint="for approve / reject">
                  <TextArea value={reason} onChange={setReason} rows={2} placeholder="e.g. Matches the company's announcement" />
                </MiniField>
              )}
              {err && <div className="rounded-[12px] border border-down/25 bg-down-soft px-3 py-2 text-[12.5px] text-down">{err}</div>}
              <div className="flex flex-wrap justify-end gap-2">
                {a.status === "applied" && (
                  <Button size="sm" variant="surface" onClick={() => act("check")} disabled={busy}>
                    <ShieldCheck /> Check with the provider
                  </Button>
                )}
                {editable && list?.canPropose && (
                  <Button size="sm" variant="surface" onClick={() => onEdit(a)}>
                    <Pencil /> Edit
                  </Button>
                )}
                {editable && list?.canApprove && (
                  <Button size="sm" variant="sell" onClick={() => act("reject")} disabled={busy}>
                    <XCircle /> Reject
                  </Button>
                )}
                {a.status === "proposed" && list?.canApprove && (
                  <Button size="sm" variant="ember" onClick={() => act("approve")} disabled={busy || (a.fourEyes && list.staffId === "")}>
                    <CheckCircle2 /> Approve
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LiveCorporateActions() {
  const now = useNow();
  const [tab, setTab] = React.useState<"upcoming" | "past">("upcoming");
  const { data, error, reload } = useApi<ListResp>(`/api/trading/admin/corporate-actions?status=${tab}`);
  const [detail, setDetail] = React.useState<number | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Action | null>(null);
  const [importing, setImporting] = React.useState(false);

  if (error)
    return (
      <div className="pb-10">
        <PageHeader title="Corporate actions" subtitle="Stock splits and dividends" />
        <Card>
          <ErrorState error={error} onRetry={reload} />
        </Card>
      </div>
    );

  const rows = data?.actions ?? [];
  const pending = rows.filter((a) => a.status === "proposed").length;
  const refresh = async () => {
    setImporting(true);
    const r = await sendJson<{ status: string; found?: number; counts?: Record<string, number>; errorCount?: number }>("/api/trading/admin/corporate-actions/import", {});
    setImporting(false);
    if (!r.ok) return toast.error(r.error.message);
    toast.success(`EODHD import: ${r.data.status}`, { description: `${r.data.found ?? 0} upcoming actions · new ${r.data.counts?.new ?? 0}, updated ${r.data.counts?.updated ?? 0}${r.data.errorCount ? ` · ${r.data.errorCount} errors` : ""}` });
    reload();
  };
  const columns: Column<Action>[] = [
    {
      key: "symbol",
      header: "Stock",
      sort: (a) => a.symbol,
      cell: (a) => (
        <span className="flex flex-col">
          <span className="font-medium">{a.symbol}</span>
          <span className="text-[11px] text-fg-3">#{a.id}</span>
        </span>
      ),
    },
    { key: "kind", header: "Action", sort: (a) => a.kind, cell: (a) => <Chip size="sm" tone={a.kind === "split" ? "info" : "gold"}>{a.kind === "split" ? <Scissors className="size-3" /> : <Coins className="size-3" />} {what(a)}</Chip> },
    { key: "ex", header: "Ex-date", sort: (a) => a.exDate, cell: (a) => <span className="k-num">{fmtDay(a.exDate)}</span> },
    { key: "oi", header: "Open positions / orders", align: "right", hideOn: "md", sort: (a) => Number(a.openInterest ?? 0), cell: (a) => <span className="k-num">{a.status === "applied" ? (a.report?.accounts ?? 0) + " accounts" : (a.openInterest ?? 0)}</span> },
    { key: "src", header: "Source", hideOn: "lg", cell: (a) => <span className="text-[12px] text-fg-2">{a.source === "eodhd" ? "EODHD" : "Manual"}</span> },
    {
      key: "status",
      header: "Status",
      sort: (a) => a.status,
      cell: (a) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Chip size="sm" tone={STATUS_TONE[a.status]} dot className="capitalize">
            {a.status}
          </Chip>
          {a.fourEyes && a.status === "proposed" && <Chip size="sm" tone="warn">4-eyes</Chip>}
          {a.check.status === "mismatch" && (
            <Chip size="sm" tone="down">
              <ShieldAlert className="size-3" /> check
            </Chip>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        title="Corporate actions"
        subtitle="Stock splits and cash dividends. Approved actions apply at 00:00 exchange time on the ex-date to every account holding the stock: splits rescale positions and orders (value unchanged), dividends credit longs net and debit shorts gross."
        actions={
          <>
            <Button variant="surface" onClick={refresh} disabled={importing || !data?.eodhd.configured || !data?.canPropose} title={data?.eodhd.message ?? undefined}>
              <RefreshCw className={cn(importing && "animate-spin")} /> {importing ? "Importing…" : "Refresh from EODHD"}
            </Button>
            {data?.canPropose && (
              <Button
                variant="ember"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus /> New action
              </Button>
            )}
          </>
        }
      />
      {data && !data.eodhd.configured && (
        <div className="mb-4 flex items-center gap-2 rounded-[14px] border border-warn/30 bg-warn-soft px-4 py-3 text-[13px]">
          <ShieldAlert className="size-4 text-warn" /> EODHD not configured: add EODHD_API_KEY. Manual entry keeps working.
        </div>
      )}
      <Reveal>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat label="Upcoming" value={data && tab === "upcoming" ? rows.length : "—"} sub="Proposed, approved or applying" />
          <MiniStat label="Waiting for approval" value={data && tab === "upcoming" ? pending : "—"} sub="Splits and large dividends need two people" tone={pending ? "warn" : undefined} />
          <MiniStat label="Next ex-date" value={rows[0] && tab === "upcoming" ? fmtDay(rows[0].exDate) : "—"} sub={rows[0] && tab === "upcoming" ? `${rows[0].symbol} · ${what(rows[0])}` : undefined} />
          <MiniStat label="Last EODHD import" value={data?.eodhd.lastRun ? ago(data.eodhd.lastRun.startedAt, now) : "—"} sub={data?.eodhd.lastRun?.report ? String(data.eodhd.lastRun.report.status ?? "") : data?.eodhd.configured ? "Daily at 06:00 UTC" : "Not configured"} />
        </div>
      </Reveal>
      <Reveal delay={0.05}>
        <Card className="px-4 pb-5 pt-5 sm:px-6">
          <CardHeader title="Actions" subtitle="Click one to see the affected positions, approve or reject it" icon={<CalendarDays />} action={<Segmented size="xs" value={tab} onChange={setTab} options={[{ value: "upcoming" as const, label: "Upcoming" }, { value: "past" as const, label: "Past" }]} />} />
          <div className="mt-3">
            {!data ? (
              <Skeleton className="h-64 w-full" />
            ) : rows.length === 0 ? (
              <EmptyState title={tab === "upcoming" ? "Nothing upcoming" : "Nothing yet"} text={tab === "upcoming" ? "Propose an action, or refresh from EODHD." : "Applied and rejected actions show here."} illustration="calendar" />
            ) : (
              <DataTable columns={columns} rows={rows} pageSize={20} dense rowKey={(a) => String(a.id)} onRowClick={(a) => setDetail(a.id)} search={(a) => `${a.symbol} ${a.kind} ${a.exDate}`} searchPlaceholder="Search stock…" exportName="corporate-actions" />
            )}
          </div>
        </Card>
      </Reveal>
      <DetailDialog
        id={detail}
        list={data}
        onClose={() => setDetail(null)}
        onChanged={reload}
        onEdit={(a) => {
          setDetail(null);
          setEditing(a);
          setFormOpen(true);
        }}
      />
      <ActionForm editing={editing} open={formOpen} onClose={() => setFormOpen(false)} onSaved={reload} />
    </div>
  );
}
