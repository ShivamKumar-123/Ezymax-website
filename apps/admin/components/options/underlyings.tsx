"use client";

/**
 * Options › Underlyings & series (O5, O7, O17, O37): per-underlying series setup (model, contract size, strike
 * ladder, cut, expiry cycles, session windows, margin scan, limits), the listing run, and the listed series of an
 * expiry with live marks.
 *
 *   GET  /api/options/underlyings            PUT /api/options/underlyings/{symbol} {…partial, reason}
 *   POST /api/options/listing/run            GET /api/options/expiries?u=&status=listed
 *   GET  /api/options/chain?u=&expiry=       (the broker's default group)
 */
import * as React from "react";
import { CalendarClock, Layers, ListChecks, Pencil, Play, RefreshCw, Rows3 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, DataTable, EmptyState, Field, Input, KpiCard, PageHeader, Reveal, Segmented,  Toggle, cn, formatNumber, type Column } from "@kalks/ui";
import { ErrorState, TableSkeleton, ago, useNow, when } from "@/components/live/kit";
import { useConfirm } from "@/components/confirm";
import type { AdminExpiry, Chain, ExpiryKind, Overview, Underlying } from "./types";
import { MODEL_LABEL, MODEL_SHORT, NumInput, ReadOnlyHint, REASONS, ReasonDialog, Select, TradeStateChip, UnderlyingCell, fmtPrice, optSend, parseNum, pct, platformBlock, useOpt, useOptPerms } from "./kit";

const ZONES = ["America/New_York", "Europe/London", "Asia/Tokyo", "UTC"];
const KINDS: ExpiryKind[] = ["daily", "weekly", "monthly"];

export function UnderlyingsPage() {
  const perms = useOptPerms();
  const block = platformBlock(perms);
  const list = useOpt<{ underlyings: Underlying[] }>("/api/options/underlyings", { refreshMs: 15_000 });
  const overview = useOpt<Overview>("/api/options/overview", { refreshMs: 15_000 });
  const [edit, setEdit] = React.useState<Underlying | null>(null);
  const [seriesSym, setSeriesSym] = React.useState<string>("");
  const [ask, confirmDialog] = useConfirm();
  const [running, setRunning] = React.useState(false);
  const now = useNow();
  const us = React.useMemo(() => [...(list.data?.underlyings ?? [])].sort((a, b) => a.sort - b.sort || a.symbol.localeCompare(b.symbol)), [list.data]);
  React.useEffect(() => {
    if (!seriesSym && us.length) setSeriesSym(us.find((u) => u.enabled)?.symbol ?? us[0]!.symbol);
  }, [us, seriesSym]);

  const runListing = async () => {
    if (!(await ask({ title: "Run the listing now?", text: "Lists any missing expiries and extends strike ladders where spot has moved. It also runs on its own every 30 seconds; strikes are never removed.", confirm: "Run listing" }))) return;
    setRunning(true);
    const r = await optSend<{ report: { expiriesAdded: number; seriesAdded: number; skippedNoPrice: string[] } }>("POST", "/api/options/listing/run", {});
    setRunning(false);
    if (!r.ok) return void toast.error("Listing failed", { description: r.error.message });
    const rep = r.data.report;
    toast.success("Listing run finished", { description: `${rep.expiriesAdded} expiries and ${rep.seriesAdded} series added${rep.skippedNoPrice.length ? ` · no price yet: ${rep.skippedNoPrice.join(", ")}` : ""}` });
    list.reload();
    overview.reload();
  };

  const cols: Column<Underlying>[] = [
    { key: "s", header: "Underlying", cell: (u) => <UnderlyingCell symbol={u.symbol} sub={u.name} />, sort: (u) => u.symbol, csv: (u) => u.symbol },
    {
      key: "m",
      header: "Model",
      cell: (u) => (
        <span title={MODEL_LABEL[u.model]}>
          <Chip size="sm" tone={u.model === "gk" ? "info" : u.model === "bs" ? "gold" : "ember"}>
            {MODEL_SHORT[u.model] ?? u.model}
          </Chip>
        </span>
      ),
      sort: (u) => u.model,
      csv: (u) => u.model,
    },
    { key: "c", header: "Contract", cell: (u) => <span className="k-num whitespace-nowrap font-mono text-[12.5px]">{formatNumber(u.contractSize, 0)} {u.contractUnit}</span>, sort: (u) => u.contractSize, csv: (u) => `${u.contractSize} ${u.contractUnit}` },
    {
      key: "k",
      header: "Strikes",
      cell: (u) => (
        <span className="k-num whitespace-nowrap font-mono text-[12.5px]">
          {u.strikeStep} <span className="text-fg-3">× ±{u.strikesEachSide}</span>
        </span>
      ),
      csv: (u) => `${u.strikeStep} x ${u.strikesEachSide}`,
      hideOn: "md",
    },
    {
      key: "cut",
      header: "Cut",
      cell: (u) => (
        <span className="flex flex-col">
          <span className="k-num font-mono text-[12.5px]">{u.cutTime}</span>
          <span className="text-[10.5px] text-fg-3">{u.cutZone.replace("America/", "").replace("Europe/", "").replace("Asia/", "").replace("_", " ")}</span>
        </span>
      ),
      sort: (u) => u.cutTime,
      csv: (u) => `${u.cutTime} ${u.cutZone}`,
    },
    {
      key: "cy",
      header: "Cycles",
      cell: (u) => (
        <span className="flex flex-wrap gap-1">
          {KINDS.filter((k) => u.expiryKinds.includes(k)).map((k) => (
            <Chip key={k} size="sm">
              {k === "daily" ? `D${u.dailyCount}` : k === "weekly" ? `W${u.weeklyCount}` : `M${u.monthlyCount}`}
            </Chip>
          ))}
        </span>
      ),
      csv: (u) => u.expiryKinds.join("+"),
      hideOn: "lg",
    },
    { key: "sp", header: "Spot", align: "right", cell: (u) => <span className="k-num font-mono text-[12.5px]">{u.spot ? fmtPrice(u.spot.mid, u.digits) : <span className="text-fg-3">no price</span>}</span>, sort: (u) => u.spot?.mid ?? 0, csv: (u) => u.spot?.mid ?? "" },
    { key: "rv", header: "Realized", align: "right", cell: (u) => <span className="k-num font-mono text-[12.5px] text-fg-2" title={u.realizedVol ? `${u.realizedVol.estimator} ${u.realizedVol.windowBars}d · ${when(u.realizedVol.computedAt)}` : undefined}>{pct(u.realizedVol?.value, 1)}</span>, sort: (u) => u.realizedVol?.value ?? 0, csv: (u) => u.realizedVol?.value ?? "", hideOn: "lg" },
    { key: "v", header: "Surface", align: "right", cell: (u) => <span className="font-mono text-[12px] text-fg-3">{u.surfaceVersion ? `v${u.surfaceVersion}` : "—"}</span>, sort: (u) => u.surfaceVersion ?? 0, hideOn: "xl" },
    {
      key: "e",
      header: "Status",
      cell: (u) => (
        <Chip size="sm" tone={u.enabled ? "up" : "neutral"} dot>
          {u.enabled ? "Enabled" : "Disabled"}
        </Chip>
      ),
      sort: (u) => (u.enabled ? 1 : 0),
      csv: (u) => (u.enabled ? "enabled" : "disabled"),
    },
    {
      key: "a",
      header: "",
      align: "right",
      cell: (u) => (
        <Button size="xs" variant="ghost" onClick={(e) => (e.stopPropagation(), setEdit(u))}>
          <Pencil /> {block ? "View" : "Edit"}
        </Button>
      ),
    },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="Underlyings & series"
        subtitle="Series setup per underlying: pricing model, contract size, strike ladder, cut and expiry cycles. Changes apply to expiries listed afterwards; listed expiries keep their cut."
        actions={
          <>
            <Button variant="surface" size="lg" onClick={() => (list.reload(), overview.reload())}>
              <RefreshCw /> Refresh
            </Button>
            {!block && (
              <Button variant="ember" size="lg" onClick={runListing} disabled={running}>
                <Play /> {running ? "Listing…" : "Run listing"}
              </Button>
            )}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Underlyings" icon={<Layers />} value={<span className="k-num">{us.filter((u) => u.enabled).length}</span>} chip={`${us.length} configured`} chipTone="up" />
        <KpiCard label="Listed expiries" icon={<CalendarClock />} value={<span className="k-num">{overview.data?.expiries ?? "—"}</span>} chip="daily · weekly · monthly" delay={0.04} />
        <KpiCard label="Active series" icon={<Rows3 />} value={<span className="k-num">{overview.data ? formatNumber(overview.data.series, 0) : "—"}</span>} chip="calls + puts" delay={0.08} />
        <KpiCard label="Snapshot" icon={<ListChecks />} value={<span className="k-num">{overview.data ? `v${overview.data.version}` : "—"}</span>} chip={overview.data?.jobs.listing ? `listing ${ago(overview.data.jobs.listing, now)}` : "engine snapshot"} delay={0.12} />
      </div>

      <Reveal delay={0.05} className="mt-4">
        <Card className="px-4 py-5 sm:px-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[13px] text-fg-3">Platform-wide: every broker trades the same series. Brokers tune their own spreads, fees and limits.</div>
            <ReadOnlyHint text={block} />
          </div>
          {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <TableSkeleton /> : <DataTable columns={cols} rows={us} dense pageSize={20} rowKey={(u) => u.symbol} onRowClick={setEdit} exportName="options-underlyings" />}
        </Card>
      </Reveal>

      <Reveal delay={0.08} className="mt-4">
        <SeriesCard underlyings={us} symbol={seriesSym} onSymbol={setSeriesSym} />
      </Reveal>

      <UnderlyingEditor u={edit} block={block} onClose={() => setEdit(null)} onSaved={list.reload} />
      {confirmDialog}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Series of an expiry                                                  */
/* ------------------------------------------------------------------ */

function SeriesCard({ underlyings, symbol, onSymbol }: { underlyings: Underlying[]; symbol: string; onSymbol: (s: string) => void }) {
  const exps = useOpt<{ expiries: AdminExpiry[] }>(symbol ? `/api/options/expiries?u=${symbol}&status=listed&limit=60` : null, { refreshMs: 30_000 });
  const listed = React.useMemo(() => [...(exps.data?.expiries ?? [])].sort((a, b) => a.cutAt.localeCompare(b.cutAt)), [exps.data]);
  const [expiry, setExpiry] = React.useState("");
  React.useEffect(() => {
    if (listed.length && !listed.some((e) => e.date === expiry)) setExpiry(listed[0]!.date);
    if (!listed.length) setExpiry("");
  }, [listed, expiry]);
  const chain = useOpt<Chain>(symbol && expiry ? `/api/options/chain?u=${symbol}&expiry=${expiry}` : null, { refreshMs: 10_000 });
  const u = underlyings.find((x) => x.symbol === symbol);
  const ch = chain.data && chain.data.underlying === symbol && chain.data.expiry === expiry ? chain.data : null;
  const digits = (u?.digits ?? 5) + 1;
  const sel = listed.find((e) => e.date === expiry);

  return (
    <Card className="pb-5">
      <CardHeader
        title="Listed series"
        subtitle="Strikes of one expiry with the default group's marks. Strikes are added when spot nears an edge of the ladder and are never removed."
        icon={<Rows3 />}
        action={
          <>
            <select value={symbol} onChange={(e) => onSymbol(e.target.value)} aria-label="Underlying" className="h-8 rounded-full border border-line bg-surface-2 px-3 text-[12.5px] text-fg outline-none">
              {underlyings.map((x) => (
                <option key={x.symbol} value={x.symbol}>
                  {x.symbol}
                  {x.enabled ? "" : " (disabled)"}
                </option>
              ))}
            </select>
            <select value={expiry} onChange={(e) => setExpiry(e.target.value)} aria-label="Expiry" className="h-8 rounded-full border border-line bg-surface-2 px-3 text-[12.5px] text-fg outline-none" disabled={!listed.length}>
              {listed.map((e) => (
                <option key={e.id} value={e.date}>
                  {e.date} · {e.kinds.join("/")} · {e.series} series
                </option>
              ))}
            </select>
          </>
        }
      />
      <div className="mt-4 px-4 sm:px-6">
        {sel && (
          <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-fg-3">
            <span>
              Cut <span className="text-fg-2">{when(sel.cutAt)}</span>
            </span>
            <span>
              TWAP from <span className="text-fg-2">{when(sel.twapStart)}</span>
            </span>
            {ch?.spot && (
              <span>
                Spot <span className="k-num font-mono text-fg-2">{fmtPrice(ch.spot.mid, u?.digits ?? 5)}</span>
              </span>
            )}
            {ch && <TradeStateChip state={ch.state} />}
          </div>
        )}
        {exps.error ? (
          <ErrorState error={exps.error} onRetry={exps.reload} />
        ) : !exps.data ? (
          <TableSkeleton rows={6} />
        ) : !listed.length ? (
          <EmptyState title="No listed expiries" text={u?.enabled ? "Run the listing, or check the price feed for this underlying." : "This underlying is disabled."} illustration="calendar" />
        ) : chain.error ? (
          chain.error.code === "options_disabled" ? (
            <EmptyState title="Options are off for this broker" text="Series previews use the client API, which follows the broker's module switch (Brokers access)." illustration="locked" />
          ) : (
            <ErrorState error={chain.error} onRetry={chain.reload} />
          )
        ) : !ch ? (
          <TableSkeleton rows={8} />
        ) : (
          <div className="overflow-x-auto">
            {!ch.rows.length ? (
              <EmptyState title={ch.error?.code === "no_price" ? "Waiting for the first price" : "No strikes listed"} text={ch.error?.code === "no_price" ? `Strikes for ${symbol} are generated around spot once the price feed delivers a quote.` : "Run the listing to generate the strike ladder."} illustration="hourglass_not_done" />
            ) : (
            <>
            {ch.error?.code === "no_price" && <div className="mb-2 rounded-[12px] border border-warn/30 bg-warn-soft px-3 py-2 text-[12px]">No price for {symbol} right now: strikes are listed, quotes are not.</div>}
            <table className="w-full min-w-[860px] border-separate border-spacing-0 text-[12.5px]">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-[0.05em] text-fg-3">
                  {["Call", "State", "IV", "Δ", "Mark", "Strike", "Mark", "Δ", "IV", "State", "Put"].map((h, i) => (
                    <th key={i} className={cn("border-y border-line bg-surface-2 px-2.5 py-2 font-medium", i === 0 && "rounded-l-[12px] border-l text-left", i === 10 && "rounded-r-[12px] border-r text-right", i === 5 && "text-center text-fg-2", i > 0 && i < 5 && "text-right", i > 5 && i < 10 && "text-left")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ch.rows.map((r) => {
                  const atm = ch.atmStrike !== null && Math.abs(r.strike - ch.atmStrike) < 1e-9;
                  const itmCall = ch.spot ? r.strike < ch.spot.mid : false;
                  return (
                    <tr key={r.strike} className={cn(atm && "bg-ember-soft/40")}>
                      <td className={cn("border-b border-line px-2.5 py-1.5 font-mono text-[11px] text-fg-3", itmCall && "bg-surface-2/50")}>{r.call?.code ?? "—"}</td>
                      <td className={cn("border-b border-line px-2.5 py-1.5 text-right", itmCall && "bg-surface-2/50")}>{r.call && <TradeStateChip state={r.call.state} />}</td>
                      <td className={cn("k-num border-b border-line px-2.5 py-1.5 text-right font-mono", itmCall && "bg-surface-2/50")}>{pct(r.call?.iv, 2)}</td>
                      <td className={cn("k-num border-b border-line px-2.5 py-1.5 text-right font-mono text-fg-2", itmCall && "bg-surface-2/50")}>{r.call?.delta != null ? formatNumber(r.call.delta, 3) : "—"}</td>
                      <td className={cn("k-num border-b border-line px-2.5 py-1.5 text-right font-mono", itmCall && "bg-surface-2/50")}>{fmtPrice(r.call?.mark, digits)}</td>
                      <td className={cn("k-num border-b border-line px-3 py-1.5 text-center font-mono font-medium", atm && "text-ember")}>{r.strikeLabel}</td>
                      <td className={cn("k-num border-b border-line px-2.5 py-1.5 font-mono", !itmCall && "bg-surface-2/50")}>{fmtPrice(r.put?.mark, digits)}</td>
                      <td className={cn("k-num border-b border-line px-2.5 py-1.5 font-mono text-fg-2", !itmCall && "bg-surface-2/50")}>{r.put?.delta != null ? formatNumber(r.put.delta, 3) : "—"}</td>
                      <td className={cn("k-num border-b border-line px-2.5 py-1.5 font-mono", !itmCall && "bg-surface-2/50")}>{pct(r.put?.iv, 2)}</td>
                      <td className={cn("border-b border-line px-2.5 py-1.5", !itmCall && "bg-surface-2/50")}>{r.put && <TradeStateChip state={r.put.state} />}</td>
                      <td className={cn("border-b border-line px-2.5 py-1.5 text-right font-mono text-[11px] text-fg-3", !itmCall && "bg-surface-2/50")}>{r.put?.code ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-2 text-[11.5px] text-fg-3">
              Marks are model mids per unit in {u?.quoteCcy ?? "the quote currency"}; shaded cells are in the money. {ch.rows.length} strikes · {ch.rows.length * 2} series.
            </div>
            </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Editor                                                               */
/* ------------------------------------------------------------------ */

type NumKey =
  | "contractSize"
  | "digits"
  | "pipSize"
  | "strikeStep"
  | "strikesEachSide"
  | "extendThreshold"
  | "dailyCount"
  | "weeklyCount"
  | "monthlyCount"
  | "twapMinutes"
  | "noOpenMinutes"
  | "closeOnlyMinutes"
  | "weekendVolWeight"
  | "holidayVolWeight"
  | "priceScan"
  | "volScan"
  | "extremeMultiple"
  | "extremeCover"
  | "minContracts"
  | "maxContracts"
  | "contractStep"
  | "sort";
type NumSpec = { key: NumKey; label: string; int?: boolean; scale?: number; suffix?: string; hint?: string; min?: number; max?: number };

const GROUPS: { title: string; text: string; fields: NumSpec[] }[] = [
  {
    title: "Contract",
    text: "Size of one contract and the order limits per ticket.",
    fields: [
      { key: "contractSize", label: "Contract size", min: 0.0001 },
      { key: "digits", label: "Price digits", int: true, min: 0, max: 8 },
      { key: "pipSize", label: "Pip / point size", min: 0 },
      { key: "minContracts", label: "Min contracts", min: 0 },
      { key: "maxContracts", label: "Max contracts", hint: "per order", min: 0 },
      { key: "contractStep", label: "Contract step", min: 0 },
    ],
  },
  {
    title: "Strike ladder",
    text: "ATM ± max(configured, about 2.5 σ√t) steps, up to 40 per side. New strikes are added near the edges.",
    fields: [
      { key: "strikeStep", label: "Strike step", min: 0 },
      { key: "strikesEachSide", label: "Strikes each side", int: true, min: 1, max: 40 },
      { key: "extendThreshold", label: "Extend within", int: true, suffix: "steps", min: 0, max: 40 },
    ],
  },
  {
    title: "Expiry cycles & session",
    text: "How many daily / weekly / monthly expiries stay listed, and the windows before the cut.",
    fields: [
      { key: "dailyCount", label: "Daily expiries", int: true, min: 0, max: 30 },
      { key: "weeklyCount", label: "Weekly expiries", int: true, min: 0, max: 12 },
      { key: "monthlyCount", label: "Monthly expiries", int: true, min: 0, max: 12 },
      { key: "twapMinutes", label: "TWAP window", int: true, suffix: "min", min: 1, max: 240 },
      { key: "noOpenMinutes", label: "No new opens", int: true, suffix: "min", hint: "before the cut", min: 0 },
      { key: "closeOnlyMinutes", label: "Trading closes", int: true, suffix: "min", hint: "before the cut", min: 0 },
    ],
  },
  {
    title: "Vol clock & margin scan",
    text: "Business-time weights for weekends / holidays, and the SPAN-style scenario grid for short margin.",
    fields: [
      { key: "weekendVolWeight", label: "Weekend day weight", min: 0, max: 1 },
      { key: "holidayVolWeight", label: "Holiday weight", min: 0, max: 1 },
      { key: "priceScan", label: "Price scan", scale: 100, suffix: "%", min: 0 },
      { key: "volScan", label: "Vol scan", scale: 100, suffix: "vol pts", min: 0 },
      { key: "extremeMultiple", label: "Extreme move", suffix: "× scan", min: 0 },
      { key: "extremeCover", label: "Extreme cover", scale: 100, suffix: "%", min: 0, max: 100 },
    ],
  },
];

type Draft = Record<NumKey, string> & {
  name: string;
  notes: string;
  enabled: boolean;
  barriersEnabled: boolean;
  expiryKinds: ExpiryKind[];
  cutTime: string;
  cutZone: string;
  deltaConvention: string;
  calendars: string;
};

const ALL_NUM: NumSpec[] = [...GROUPS.flatMap((g) => g.fields), { key: "sort", label: "Sort", int: true }];

function toDraft(u: Underlying): Draft {
  const d = { name: u.name, notes: u.notes, enabled: u.enabled, barriersEnabled: u.barriersEnabled, expiryKinds: u.expiryKinds, cutTime: u.cutTime, cutZone: u.cutZone, deltaConvention: u.deltaConvention, calendars: u.calendars.join(", ") } as Draft;
  for (const f of ALL_NUM) d[f.key] = String(+((u[f.key] as number) * (f.scale ?? 1)).toPrecision(10));
  return d;
}

function UnderlyingEditor({ u, block, onClose, onSaved }: { u: Underlying | null; block: string | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = React.useState<Draft | null>(null);
  React.useEffect(() => setD(u ? toDraft(u) : null), [u]);
  if (!u || !d) return null;
  const set = (p: Partial<Draft>) => setD((x) => (x ? { ...x, ...p } : x));

  // patch = changed fields only, in service units
  const patch: Record<string, unknown> = {};
  let invalid: string | null = null;
  for (const f of ALL_NUM) {
    const n = parseNum(d[f.key]);
    if (n === null || Number.isNaN(n)) {
      invalid ??= `${f.label}: enter a number`;
      continue;
    }
    if (f.int && !Number.isInteger(n)) invalid ??= `${f.label}: whole number`;
    if (f.min !== undefined && n < f.min) invalid ??= `${f.label}: at least ${f.min}`;
    if (f.max !== undefined && n > f.max) invalid ??= `${f.label}: at most ${f.max}`;
    const v = f.scale ? n / f.scale : n;
    if (Math.abs(v - (u[f.key] as number)) > 1e-12) patch[f.key] = v;
  }
  if (d.name.trim() !== u.name) patch.name = d.name.trim();
  if (d.notes !== u.notes) patch.notes = d.notes;
  if (d.enabled !== u.enabled) patch.enabled = d.enabled;
  if (d.barriersEnabled !== u.barriersEnabled) patch.barriersEnabled = d.barriersEnabled;
  if (d.cutTime !== u.cutTime) patch.cutTime = d.cutTime;
  if (d.cutZone !== u.cutZone) patch.cutZone = d.cutZone;
  if (d.deltaConvention !== u.deltaConvention) patch.deltaConvention = d.deltaConvention;
  const kinds = KINDS.filter((k) => d.expiryKinds.includes(k));
  if (kinds.join() !== KINDS.filter((k) => u.expiryKinds.includes(k)).join()) patch.expiryKinds = kinds;
  const cals = d.calendars.split(/[\s,]+/).map((c) => c.trim().toUpperCase()).filter(Boolean);
  if (cals.join() !== u.calendars.join()) patch.calendars = cals;
  if (!d.name.trim()) invalid ??= "Enter a name";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.cutTime)) invalid ??= "Cut time is HH:MM";
  if (!kinds.length) invalid ??= "Choose at least one expiry cycle";
  if (!cals.length || cals.some((c) => !/^[A-Z0-9]{1,8}$/.test(c))) invalid ??= "Calendars: codes like EUR, USD";
  if (Number(d.noOpenMinutes) < Number(d.closeOnlyMinutes)) invalid ??= "“No new opens” must be at least “Trading closes”";
  if (Number(d.minContracts) > Number(d.maxContracts)) invalid ??= "Min contracts must not exceed max";
  const changed = Object.keys(patch);

  return (
    <ReasonDialog
      open
      onOpenChange={(o) => !o && onClose()}
      side="right"
      title={`${u.symbol} · ${u.name}`}
      description={`${MODEL_LABEL[u.model]} · ${u.baseCcy}/${u.quoteCcy} · updated ${when(u.updatedAt)} by ${u.updatedBy}`}
      codes={REASONS.config}
      confirmLabel={changed.length ? `Save ${changed.length} change${changed.length === 1 ? "" : "s"}` : "No changes"}
      disabled={block ?? invalid ?? (!changed.length ? "Nothing changed yet" : null)}
      onConfirm={async (reason) => {
        const r = await optSend("PUT", `/api/options/underlyings/${u.symbol}`, { ...patch, reason });
        if (r.ok) onSaved();
        return r;
      }}
      success={`${u.symbol} saved`}
    >
      <fieldset disabled={!!block} className="space-y-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Display name">
            <Input value={d.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} aria-label="Display name" />
          </Field>
          <Field label="Holiday calendars" hint="+ USD / New York always">
            <Input value={d.calendars} onChange={(e) => set({ calendars: e.target.value })} className="font-mono" aria-label="Holiday calendars" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-5 text-[12.5px]">
          <label className="flex items-center gap-2">
            <Toggle checked={d.enabled} onChange={(v) => set({ enabled: v })} label="Enabled" /> Enabled (listed and tradable)
          </label>
          <label className="flex items-center gap-2">
            <Toggle checked={d.barriersEnabled} onChange={(v) => set({ barriersEnabled: v })} label="Barriers" /> Barrier options
          </label>
        </div>
        <div>
          <SectionTitle title="Cut & cycles" text="Expiries must be a business day in every calendar and New York; otherwise they roll back a day." />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Cut time">
              <Input value={d.cutTime} onChange={(e) => set({ cutTime: e.target.value.replace(/[^0-9:]/g, "").slice(0, 5) })} className="font-mono" aria-label="Cut time" placeholder="10:00" />
            </Field>
            <Field label="Cut zone" className="sm:col-span-2">
              <Select value={d.cutZone} onChange={(v) => set({ cutZone: v })} options={ZONES.map((z) => ({ value: z, label: z }))} label="Cut zone" />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-fg-3">
            Cycles
            {KINDS.map((k) => {
              const on = d.expiryKinds.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ expiryKinds: on ? d.expiryKinds.filter((x) => x !== k) : [...d.expiryKinds, k] })}
                  className={cn("rounded-full border px-3 py-1 text-[12px] capitalize", on ? "border-ember/50 bg-ember-soft text-fg" : "border-line bg-surface-2 text-fg-3 hover:text-fg")}
                >
                  {k}
                </button>
              );
            })}
            <span className="ml-auto">Delta convention</span>
            <Segmented size="xs" value={d.deltaConvention === "forward" ? "forward" : "spot"} onChange={(v) => set({ deltaConvention: v })} options={[{ value: "spot", label: "Spot" }, { value: "forward", label: "Forward" }]} />
          </div>
        </div>
        {GROUPS.map((g) => (
          <div key={g.title}>
            <SectionTitle title={g.title} text={g.text} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {g.fields.map((f) => (
                <Field key={f.key} label={f.label} hint={f.hint}>
                  <NumInput value={d[f.key]} onChange={(v) => set({ [f.key]: v } as Partial<Draft>)} label={f.label} suffix={f.suffix} invalid={Number.isNaN(parseNum(d[f.key]) ?? 0)} />
                </Field>
              ))}
            </div>
          </div>
        ))}
        <Field label="Notes" hint="internal">
          <Input value={d.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={300} aria-label="Notes" />
        </Field>
        {changed.length > 0 && (
          <div className="rounded-[14px] border border-line bg-surface-2/60 px-3.5 py-2.5 text-[12px] text-fg-3">
            Changing: <span className="text-fg-2">{changed.join(", ")}</span>
          </div>
        )}
      </fieldset>
    </ReasonDialog>
  );
}

function SectionTitle({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-2.5">
      <div className="text-[13px] font-medium text-fg">{title}</div>
      <div className="text-[12px] text-fg-3">{text}</div>
    </div>
  );
}
