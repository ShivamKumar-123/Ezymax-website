"use client";

/**
 * Options › Settlements (O6, O38, O39): the settlement monitor. Per expiry: the TWAP window and its live sample
 * coverage, the fixing (source, run, coverage, longest gap), the engine's settlement run, and the two corrections
 * allowed within 1 hour of the first fixing (Kalks staff, options.settle): re-fix the price and re-run the settlement.
 *
 *   GET  /api/options/expiries?u=&status=&limit=                     options service
 *   POST /api/options/expiries/{id}/refix {price?, reason}           re-fix (recompute from samples, or a manual price)
 *   GET  /api/trading/admin/options/book                             engine settlement runs (`settlements[]`)
 *   POST /api/trading/admin/options/settlements/{SYMBOL:YYYY-MM-DD}/rerun {reason}
 */
import * as React from "react";
import { CircleCheck, Gauge, Hourglass, RefreshCw, RotateCcw, Timer, TriangleAlert } from "lucide-react";
import { Button, Card, Chip, DataTable, Dialog, EmptyState, Field, KpiCard, PageHeader, Progress, Reveal, Segmented, cn, formatNumber, type Column } from "@kalks/ui";
import { ErrorState, TableSkeleton, ago, useNow, when } from "@/components/live/kit";
import type { AdminExpiry, Book, BookSettlement, Underlying } from "./types";
import { EnginePending, ExpiryStatusChip, NumInput, REASONS, ReasonDialog, countdown, enginePending, optSend, parseNum, signedUsd, useOpt, useOptPerms } from "./kit";
import { twapProgress } from "./risk-desk";

const WINDOW_MS = 60 * 60_000;
const SOURCE: Record<string, { label: string; tone: "up" | "warn" | "gold" | "neutral" }> = { twap: { label: "TWAP", tone: "up" }, m1_fallback: { label: "M1 fallback", tone: "warn" }, manual: { label: "Manual", tone: "gold" } };

/** End of the 1-hour correction window (first fixing + 1 h; the first fixing is at the cut, or the fixedAt of run 1). */
export function refixDeadline(e: AdminExpiry) {
  const first = e.run <= 1 && e.fixedAt ? Date.parse(e.fixedAt) : Date.parse(e.cutAt);
  return first + WINDOW_MS;
}

/** The engine's key of an expiry (settlement runs, re-run route). */
export const expiryKey = (e: { symbol: string; date: string }) => `${e.symbol}:${e.date}`;

/** Latest engine settlement run of an expiry (runs come newest first). */
function settlementOf(e: AdminExpiry, book: Book | null): BookSettlement | null {
  if (!book) return null;
  return book.settlements.find((s) => s.expiry === expiryKey(e) || (s.symbol === e.symbol && String(s.date).slice(0, 10) === e.date)) ?? null;
}

const RUN_TONE: Record<string, "up" | "warn" | "down"> = { done: "up", running: "warn", failed: "down" };
const RUN_LABEL: Record<string, string> = { done: "settled", running: "settling", failed: "failed" };

export function SettlementsPage() {
  const perms = useOptPerms();
  const now = useNow(1000);
  const [sym, setSym] = React.useState("all");
  const [status, setStatus] = React.useState<"all" | "listed" | "fixing" | "fixed" | "expired">("all");
  const [open, setOpen] = React.useState<AdminExpiry | null>(null);
  const [refix, setRefix] = React.useState<AdminExpiry | null>(null);
  const [rerun, setRerun] = React.useState<AdminExpiry | null>(null);
  const q = new URLSearchParams({ limit: "400" });
  if (sym !== "all") q.set("u", sym);
  if (status !== "all") q.set("status", status);
  const list = useOpt<{ expiries: AdminExpiry[] }>(`/api/options/expiries?${q}`, { refreshMs: 5000 });
  const unders = useOpt<{ underlyings: Underlying[] }>("/api/options/underlyings");
  const book = useOpt<Book>("/api/trading/admin/options/book", { refreshMs: 10_000 });
  const pending = enginePending(book.error);
  const canSettle = perms.settle && perms.platform;

  // the monitor's focus: running and recent cuts first, then the rest of the listing in time order
  const rows = React.useMemo(() => {
    const xs = list.data?.expiries ?? [];
    const horizon = now + 3 * 86_400_000;
    const filtered = status === "listed" || status === "all" ? xs.filter((e) => e.status !== "listed" || Date.parse(e.cutAt) < horizon || status === "listed") : xs;
    return [...filtered].sort((a, b) => Math.abs(Date.parse(a.cutAt) - now) - Math.abs(Date.parse(b.cutAt) - now));
  }, [list.data, now, status]);
  const all = list.data?.expiries ?? [];
  const running = all.filter((e) => e.status === "listed" && twapProgress(e, now).running);
  const awaiting = all.filter((e) => e.status === "fixing");
  const today = new Date(now).toISOString().slice(0, 10);
  const fixedToday = all.filter((e) => (e.status === "fixed" || e.status === "expired") && e.fixedAt?.startsWith(today));
  const lowCov = all.filter((e) => e.coverage !== null && e.coverage < 0.9 && Date.parse(e.cutAt) > now - 7 * 86_400_000);
  const windowOpen = all.filter((e) => e.status === "fixed" && refixDeadline(e) > now);

  const cols: Column<AdminExpiry>[] = [
    {
      key: "e",
      header: "Expiry",
      cell: (e) => (
        <span className="flex flex-col">
          <span className="flex items-center gap-1.5">
            <span className="font-mono text-[12.5px] font-medium">{e.symbol}</span>
            <span className="text-[12.5px]">{e.date}</span>
          </span>
          <span className="text-[10.5px] text-fg-3">
            {e.kinds.join(" · ")} · {e.series} series
          </span>
        </span>
      ),
      sort: (e) => e.cutAt,
      csv: (e) => `${e.symbol} ${e.date}`,
    },
    {
      key: "c",
      header: "Cut",
      cell: (e) => (
        <span className="flex flex-col">
          <span className="whitespace-nowrap text-[12px]">{when(e.cutAt)}</span>
          <span className={cn("k-num font-mono text-[10.5px]", Date.parse(e.cutAt) > now ? "text-warn" : "text-fg-3")}>{Date.parse(e.cutAt) > now ? `in ${countdown(e.cutAt, now)}` : ago(e.cutAt, now)}</span>
        </span>
      ),
      sort: (e) => e.cutAt,
      csv: (e) => e.cutAt,
    },
    { key: "s", header: "Status", cell: (e) => <ExpiryStatusChip status={e.status} running={twapProgress(e, now).running} />, sort: (e) => e.status, csv: (e) => e.status },
    {
      key: "f",
      header: "Fixing",
      align: "right",
      cell: (e) =>
        e.fixing !== null ? (
          <span className="flex flex-col items-end">
            <span className="k-num font-mono text-[13px] font-medium">{e.fixing}</span>
            <span className="flex items-center gap-1">
              {e.source && (
                <Chip size="sm" tone={SOURCE[e.source]?.tone ?? "neutral"}>
                  {SOURCE[e.source]?.label ?? e.source}
                </Chip>
              )}
              {e.run > 1 && <span className="text-[10.5px] text-gold">run {e.run}</span>}
            </span>
          </span>
        ) : e.error ? (
          <span className="text-[11.5px] text-down" title={e.error}>
            error
          </span>
        ) : (
          <span className="text-[12px] text-fg-3">—</span>
        ),
      sort: (e) => e.fixing ?? 0,
      csv: (e) => e.fixing ?? "",
    },
    {
      key: "cov",
      header: "Samples",
      cell: (e) => <Coverage e={e} now={now} />,
      sort: (e) => e.coverage ?? -1,
      csv: (e) => e.coverage ?? "",
    },
    {
      key: "st",
      header: "Settlement",
      cell: (e) => {
        if (e.status === "listed" || e.status === "fixing") return <span className="text-[11.5px] text-fg-3">after the fixing</span>;
        if (pending) return <span className="text-[11.5px] text-fg-3" title="Available after the engine update">engine update</span>;
        const s = settlementOf(e, book.data);
        if (!s) return <span className="text-[11.5px] text-fg-3">{book.data ? "no positions" : "…"}</span>;
        return (
          <span className="flex flex-col">
            <span className="flex items-center gap-1">
              <Chip size="sm" tone={RUN_TONE[s.status] ?? "warn"}>
                {RUN_LABEL[s.status] ?? s.status}
              </Chip>
              {(s.run ?? 1) > 1 && <span className="text-[10.5px] text-gold">run {s.run}</span>}
              {(s.failures ?? 0) > 0 && <span className="text-[10.5px] text-down">{s.failures} failed</span>}
            </span>
            {s.payoutUsd !== undefined && <span className="k-num font-mono text-[10.5px] text-fg-3">{s.positions ?? 0} pos · {signedUsd(s.payoutUsd)}</span>}
          </span>
        );
      },
      hideOn: "lg",
    },
    {
      key: "x",
      header: "",
      align: "right",
      cell: (e) => {
        const left = refixDeadline(e) - now;
        if (e.status !== "fixed" || left <= 0) return null;
        return (
          <span className="flex flex-col items-end gap-1">
            <span className="k-num font-mono text-[10.5px] text-warn">{countdown(new Date(refixDeadline(e)).toISOString(), now)} left</span>
            {canSettle && (
              <span className="flex gap-1">
                <Button size="xs" variant="surface" onClick={(ev) => (ev.stopPropagation(), setRefix(e))}>
                  Re-fix
                </Button>
                <Button size="xs" variant="ghost" onClick={(ev) => (ev.stopPropagation(), setRerun(e))}>
                  <RotateCcw /> Re-run
                </Button>
              </span>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="Settlements"
        subtitle="TWAP fixings (1-second mids over the 30 minutes before the cut, M1 candles below 50 % coverage) and settlement runs. Corrections are possible for 1 hour after the first fixing; clients are notified."
        actions={
          <>
            <select value={sym} onChange={(e) => setSym(e.target.value)} aria-label="Underlying" className="h-11 rounded-full border border-line bg-surface-2 px-4 text-[13.5px] text-fg outline-none">
              <option value="all">All underlyings</option>
              {(unders.data?.underlyings ?? []).map((u) => (
                <option key={u.symbol} value={u.symbol}>
                  {u.symbol}
                </option>
              ))}
            </select>
            <Button variant="surface" size="lg" onClick={() => (list.reload(), book.reload())}>
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="TWAP running" icon={<Timer />} value={<span className="k-num">{running.length}</span>} chip={running.length ? running.map((e) => e.symbol).slice(0, 3).join(" · ") : "no window open"} chipTone={running.length ? "ember" : "neutral"} hot={running.length > 0} />
        <KpiCard label="Awaiting fixing" icon={<Hourglass />} value={<span className="k-num">{awaiting.length}</span>} chip={awaiting.length ? "cut passed, no price yet" : "all fixed"} chipTone={awaiting.length ? "warn" : "up"} delay={0.04} />
        <KpiCard label="Fixed today" icon={<CircleCheck />} value={<span className="k-num">{fixedToday.length}</span>} chip={`${windowOpen.length} still correctable`} delay={0.08} />
        <KpiCard label="Low coverage (7 d)" icon={<TriangleAlert />} value={<span className="k-num">{lowCov.length}</span>} chip="below 90 % of samples" chipTone={lowCov.length ? "warn" : "neutral"} delay={0.12} />
      </div>
      <Reveal delay={0.05} className="mt-4">
        <Card className="px-4 py-5 sm:px-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Segmented size="xs" value={status} onChange={setStatus} options={[{ value: "all", label: "Monitor" }, { value: "listed", label: "Listed" }, { value: "fixing", label: "Fixing" }, { value: "fixed", label: "Fixed" }, { value: "expired", label: "Expired" }]} />
            <span className="text-[12px] text-fg-3">{status === "all" ? "Nearest cuts first (listed: next 3 days)." : ""}</span>
            {pending && <span className="ml-auto text-[12px] text-fg-3">Engine settlement runs: available after the engine update.</span>}
          </div>
          {list.error ? (
            <ErrorState error={list.error} onRetry={list.reload} />
          ) : !list.data ? (
            <TableSkeleton rows={8} />
          ) : (
            <DataTable columns={cols} rows={rows} dense pageSize={25} rowKey={(e) => String(e.id)} onRowClick={setOpen} exportName="options-settlements" empty={<EmptyState title="No expiries" text="Nothing matches this filter." illustration="calendar" />} />
          )}
        </Card>
      </Reveal>

      <ExpiryDrawer e={open} book={book.data} pending={pending} now={now} canSettle={canSettle} onRefix={() => (setRefix(open), setOpen(null))} onRerun={() => (setRerun(open), setOpen(null))} onClose={() => setOpen(null)} />
      <RefixDialog e={refix} now={now} onClose={() => setRefix(null)} onSaved={list.reload} />
      <ReasonDialog
        open={!!rerun}
        onOpenChange={(o) => !o && setRerun(null)}
        title={`Re-run the ${rerun?.symbol} ${rerun?.date} settlement`}
        description="The engine reverses the previous settlement of every position in this expiry and settles again at the current fixing. Withdrawals stay on hold until the window closes; clients get the corrected result."
        codes={REASONS.settle}
        confirmLabel="Re-run settlement"
        confirmVariant="sell"
        engine
        disabled={rerun && refixDeadline(rerun) <= now ? "The 1-hour window has closed" : null}
        onConfirm={async (reason) => {
          const r = await optSend("POST", `/api/trading/admin/options/settlements/${encodeURIComponent(expiryKey(rerun!))}/rerun`, { reason });
          if (r.ok) book.reload();
          return r;
        }}
        success="Settlement re-run started"
      >
        {rerun && (
          <div className="grid grid-cols-3 gap-2 text-[12.5px]">
            <Info label="Fixing" value={String(rerun.fixing ?? "—")} />
            <Info label="Source" value={rerun.source ? (SOURCE[rerun.source]?.label ?? rerun.source) : "—"} />
            <Info label="Window" value={`${countdown(new Date(refixDeadline(rerun)).toISOString(), now)} left`} />
          </div>
        )}
      </ReasonDialog>
    </div>
  );
}

function Coverage({ e, now }: { e: AdminExpiry; now: number }) {
  const t = twapProgress(e, now);
  if (e.status === "listed" && !t.running) return <span className="text-[11.5px] text-fg-3">from {when(e.twapStart).split(", ")[1] ?? when(e.twapStart)}</span>;
  if (e.status === "listed" || e.status === "fixing") {
    const cov = t.coverage;
    return (
      <div className="w-36">
        <Progress value={t.pct} tone={cov !== null && cov < 0.5 ? "down" : cov !== null && cov < 0.9 ? "warn" : "up"} />
        <div className="mt-1 flex justify-between font-mono text-[10.5px] text-fg-3">
          <span>{e.samplesSoFar}s</span>
          <span>{cov === null ? "—" : `${Math.round(cov * 100)}%`}</span>
        </div>
      </div>
    );
  }
  if (e.coverage === null) return <span className="text-[11.5px] text-fg-3">—</span>;
  return (
    <div className="w-36">
      <Progress value={e.coverage * 100} tone={e.coverage < 0.5 ? "down" : e.coverage < 0.9 ? "warn" : "up"} />
      <div className="mt-1 flex justify-between font-mono text-[10.5px] text-fg-3">
        <span>
          {e.samples ?? 0}/{e.expected ?? 0}
        </span>
        <span title="Longest gap">{e.maxGapMs !== null ? `gap ${formatNumber(e.maxGapMs / 1000, 0)}s` : ""}</span>
      </div>
    </div>
  );
}

function Info({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "up" | "warn" | "down" }) {
  return (
    <div className="k-row px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-fg-3">{label}</div>
      <div className={cn("k-num mt-0.5 truncate font-mono text-[13px]", tone === "up" && "text-up", tone === "warn" && "text-warn", tone === "down" && "text-down")}>{value}</div>
    </div>
  );
}

function ExpiryDrawer({ e, book, pending, now, canSettle, onRefix, onRerun, onClose }: { e: AdminExpiry | null; book: Book | null; pending: boolean; now: number; canSettle: boolean; onRefix: () => void; onRerun: () => void; onClose: () => void }) {
  const s = e ? settlementOf(e, book) : null;
  const deadline = e ? refixDeadline(e) : 0;
  const t = e ? twapProgress(e, now) : null;
  return (
    <Dialog
      open={!!e}
      onOpenChange={(o) => !o && onClose()}
      side="right"
      title={e ? `${e.symbol} · ${e.date}` : ""}
      description={e ? `${e.kinds.join(" · ")} expiry · cut ${when(e.cutAt)}` : undefined}
      footer={
        e && e.status === "fixed" && deadline > now && canSettle ? (
          <>
            <span className="mr-auto text-[11.5px] text-warn">{countdown(new Date(deadline).toISOString(), now)} left to correct</span>
            <Button size="sm" variant="surface" onClick={onRefix}>
              Re-fix price
            </Button>
            <Button size="sm" variant="ember" onClick={onRerun}>
              <RotateCcw /> Re-run settlement
            </Button>
          </>
        ) : undefined
      }
    >
      {e && t && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <ExpiryStatusChip status={e.status} running={t.running} />
            {e.source && <Chip tone={SOURCE[e.source]?.tone ?? "neutral"}>{SOURCE[e.source]?.label ?? e.source}</Chip>}
            {e.run > 1 && <Chip tone="gold">run {e.run}</Chip>}
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2 text-[13px] font-medium">
              <Gauge className="size-4 text-fg-3" /> Fixing window
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Info label="TWAP start" value={when(e.twapStart, true)} />
              <Info label="Cut" value={when(e.cutAt, true)} />
              <Info label="Samples" value={e.samples !== null ? `${e.samples} / ${e.expected ?? "—"}` : `${e.samplesSoFar} so far`} />
              <Info label="Coverage" value={e.coverage !== null ? `${formatNumber(e.coverage * 100, 1)}%` : t.coverage !== null ? `${formatNumber(t.coverage * 100, 1)}% (live)` : "—"} tone={(e.coverage ?? t.coverage ?? 1) < 0.5 ? "down" : (e.coverage ?? t.coverage ?? 1) < 0.9 ? "warn" : undefined} />
              <Info label="Longest gap" value={e.maxGapMs !== null ? `${formatNumber(e.maxGapMs / 1000, 1)} s` : "—"} />
              <Info label="Fixed at" value={e.fixedAt ? when(e.fixedAt, true) : "—"} />
            </div>
            {e.status === "listed" && t.running && <Progress value={t.pct} className="mt-3" />}
            {e.error && <div className="mt-3 rounded-[12px] border border-down/30 bg-down-soft px-3 py-2 text-[12.5px]">{e.error}</div>}
            {e.source === "m1_fallback" && <div className="mt-3 rounded-[12px] border border-warn/30 bg-warn-soft px-3 py-2 text-[12.5px]">Coverage was under 50 %, so the fixing used M1 candle closes over the window (90 s after the cut).</div>}
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2 text-[13px] font-medium">
              <CircleCheck className="size-4 text-fg-3" /> Settlement (trading engine)
            </div>
            {pending ? (
              <EnginePending what="The settlement run" />
            ) : e.status === "listed" || e.status === "fixing" ? (
              <div className="text-[12.5px] text-fg-3">Runs automatically once the expiry is fixed.</div>
            ) : !s ? (
              <div className="text-[12.5px] text-fg-3">{book ? "No open positions were settled in this expiry." : "Loading…"}</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Info label="Status" value={RUN_LABEL[s.status] ?? s.status} tone={RUN_TONE[s.status]} />
                <Info label="Run" value={`${s.run ?? 1}${s.kind === "rerun" ? " (re-run)" : ""}`} />
                <Info label="Fixing used" value={s.fixing !== undefined ? String(s.fixing) : "—"} />
                <Info label="Positions · accounts" value={`${formatNumber(s.positions ?? 0, 0)} · ${formatNumber(s.accounts ?? 0, 0)}`} />
                <Info label="Paid to clients" value={s.payoutUsd !== undefined ? signedUsd(s.payoutUsd) : "—"} />
                <Info label="Failures" value={String(s.failures ?? 0)} tone={(s.failures ?? 0) > 0 ? "down" : undefined} />
                <Info label="Finished" value={s.finishedAt ? when(s.finishedAt, true) : s.startedAt ? `started ${when(s.startedAt, true)}` : "—"} />
                <Info label="Correctable until" value={when(new Date(deadline).toISOString(), true)} />
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function RefixDialog({ e, now, onClose, onSaved }: { e: AdminExpiry | null; now: number; onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = React.useState<"recompute" | "manual">("recompute");
  const [price, setPrice] = React.useState("");
  React.useEffect(() => {
    if (!e) return;
    setMode("recompute");
    setPrice(e.fixing !== null ? String(e.fixing) : "");
  }, [e]);
  const p = parseNum(price);
  const closed = e ? refixDeadline(e) <= now : false;
  const invalid = closed ? "The 1-hour window has closed" : mode === "manual" && (p === null || Number.isNaN(p) || p <= 0) ? "Enter a positive price" : mode === "manual" && e && p === e.fixing ? "Same as the current fixing" : null;
  const moved = e && e.fixing && p && mode === "manual" ? ((p - e.fixing) / e.fixing) * 100 : null;
  return (
    <ReasonDialog
      open={!!e}
      onOpenChange={(o) => !o && onClose()}
      title={`Re-fix ${e?.symbol} ${e?.date}`}
      description="Writes a new fixing run. Then re-run the settlement so positions settle at the new price."
      codes={REASONS.settle}
      confirmLabel="Re-fix"
      confirmVariant="sell"
      disabled={invalid}
      onConfirm={async (reason) => {
        const r = await optSend("POST", `/api/options/expiries/${e!.id}/refix`, mode === "manual" ? { price: p, reason } : { reason });
        if (r.ok) onSaved();
        return r;
      }}
      success={`${e?.symbol} ${e?.date} re-fixed`}
    >
      {e && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-[12.5px]">
            <Info label="Current" value={String(e.fixing ?? "—")} />
            <Info label="Source · run" value={`${e.source ? (SOURCE[e.source]?.label ?? e.source) : "—"} · ${e.run}`} />
            <Info label="Window" value={closed ? "closed" : `${countdown(new Date(refixDeadline(e)).toISOString(), now)}`} tone={closed ? "down" : "warn"} />
          </div>
          <Field label="How">
            <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: "recompute", label: "Recompute from samples" }, { value: "manual", label: "Manual price" }]} />
          </Field>
          {mode === "manual" ? (
            <Field label="Fixing price" hint={moved !== null ? `${moved > 0 ? "+" : ""}${formatNumber(moved, 3)}% vs current` : undefined}>
              <NumInput value={price} onChange={setPrice} label="Fixing price" />
            </Field>
          ) : (
            <div className="rounded-[14px] border border-line bg-surface-2/60 px-3.5 py-2.5 text-[12.5px] text-fg-3">Recomputes the TWAP from the stored 1-second samples, or from M1 candles when coverage is below 50 %. Use after a feed backfill.</div>
          )}
        </div>
      )}
    </ReasonDialog>
  );
}
