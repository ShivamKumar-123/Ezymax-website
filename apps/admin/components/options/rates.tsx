"use client";

/**
 * Options › Rates (O14): the annual interest rate per currency (policy rates; lease rates for XAU / XAG) that the
 * pricer uses for carry, with the full change history.
 *
 *   GET /api/options/rates     PUT /api/options/rates/{ccy} {rate (decimal), kind, source, asOf, reason}
 *   GET /api/options/rates/{ccy}/history
 */
import * as React from "react";
import { History, Landmark, Pencil, Plus, RefreshCw } from "lucide-react";
import { Button, Card, Chip, DataTable, Dialog, EmptyState, Field, Input, KpiCard, PageHeader, Reveal, Segmented, cn, formatNumber, type Column } from "@kalks/ui";
import { ErrorState, TableSkeleton, ago, day, useNow, when } from "@/components/live/kit";
import type { Rate, RateHistory, Underlying } from "./types";
import { NumInput, ReadOnlyHint, REASONS, ReasonDialog, optSend, parseNum, pct, platformBlock, useOpt, useOptPerms } from "./kit";

const bp = (d: number) => `${d > 0 ? "+" : d < 0 ? "−" : ""}${formatNumber(Math.abs(d * 10_000), 1)} bp`;

export function RatesPage() {
  const perms = useOptPerms();
  const block = platformBlock(perms);
  const now = useNow();
  const { data, error, reload } = useOpt<{ rates: Rate[] }>("/api/options/rates", { refreshMs: 60_000 });
  const unders = useOpt<{ underlyings: Underlying[] }>("/api/options/underlyings");
  const [edit, setEdit] = React.useState<{ rate: Rate | null } | null>(null);
  const [hist, setHist] = React.useState<string | null>(null);
  const rates = React.useMemo(() => [...(data?.rates ?? [])].sort((a, b) => (a.kind === b.kind ? a.ccy.localeCompare(b.ccy) : a.kind === "policy" ? -1 : 1)), [data]);
  const usedBy = (ccy: string) => (unders.data?.underlyings ?? []).filter((u) => u.baseCcy === ccy || u.quoteCcy === ccy).map((u) => u.symbol);
  const newest = rates.reduce<Rate | null>((m, r) => (!m || r.updatedAt > m.updatedAt ? r : m), null);

  const cols: Column<Rate>[] = [
    {
      key: "c",
      header: "Currency",
      cell: (r) => (
        <span className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full border border-line bg-surface-2 font-mono text-[11px] font-semibold">{r.ccy}</span>
          <span className="flex flex-col">
            <span className="font-medium">{r.ccy}</span>
            <span className="text-[10.5px] text-fg-3">{usedBy(r.ccy).join(" · ") || "not used by an underlying"}</span>
          </span>
        </span>
      ),
      sort: (r) => r.ccy,
      csv: (r) => r.ccy,
    },
    { key: "r", header: "Rate", align: "right", cell: (r) => <span className="k-num font-mono text-[14px] font-medium">{pct(r.rate, 3)}</span>, sort: (r) => r.rate, csv: (r) => r.rate },
    { key: "k", header: "Kind", cell: (r) => <Chip size="sm" tone={r.kind === "lease" ? "gold" : "info"}>{r.kind}</Chip>, sort: (r) => r.kind, csv: (r) => r.kind },
    { key: "s", header: "Source", cell: (r) => <span className="block max-w-[260px] truncate text-[12.5px] text-fg-2" title={r.source}>{r.source || "—"}</span>, csv: (r) => r.source, hideOn: "md" },
    { key: "a", header: "As of", cell: (r) => <span className="whitespace-nowrap text-[12.5px]">{day(r.asOf)}</span>, sort: (r) => r.asOf, csv: (r) => r.asOf },
    {
      key: "u",
      header: "Updated",
      cell: (r) => (
        <span className="flex flex-col text-[11.5px]">
          <span className="text-fg-2" title={when(r.updatedAt)}>
            {ago(r.updatedAt, now)}
          </span>
          <span className="truncate text-fg-3">{r.updatedBy}</span>
        </span>
      ),
      sort: (r) => r.updatedAt,
      csv: (r) => r.updatedAt,
      hideOn: "lg",
    },
    {
      key: "x",
      header: "",
      align: "right",
      cell: (r) => (
        <span className="inline-flex gap-1">
          <Button size="xs" variant="ghost" onClick={(e) => (e.stopPropagation(), setHist(r.ccy))}>
            <History /> History
          </Button>
          {!block && (
            <Button size="xs" variant="surface" onClick={(e) => (e.stopPropagation(), setEdit({ rate: r }))}>
              <Pencil /> Edit
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="Rates"
        subtitle="Annual rates per currency for carry in Garman-Kohlhagen and Black-Scholes (r for the quote currency, q for the base). Metals use a lease rate; oil (Black-76) needs only USD."
        actions={
          <>
            <Button variant="surface" size="lg" onClick={reload}>
              <RefreshCw /> Refresh
            </Button>
            {!block && (
              <Button variant="ember" size="lg" onClick={() => setEdit({ rate: null })}>
                <Plus /> Add currency
              </Button>
            )}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Currencies" icon={<Landmark />} value={<span className="k-num">{rates.length}</span>} chip={`${rates.filter((r) => r.kind === "lease").length} lease rates`} />
        <KpiCard label="USD" icon={<Landmark />} value={<span className="k-num">{pct(rates.find((r) => r.ccy === "USD")?.rate, 3)}</span>} chip="discounting for every premium" delay={0.04} />
        <KpiCard label="Highest" icon={<Landmark />} value={<span className="k-num">{rates.length ? pct(Math.max(...rates.map((r) => r.rate)), 2) : "—"}</span>} chip={rates.length ? rates.reduce((m, r) => (r.rate > m.rate ? r : m)).ccy : "—"} delay={0.08} />
        <KpiCard label="Last change" icon={<History />} value={<span className="k-num text-[22px]">{newest ? newest.ccy : "—"}</span>} chip={newest ? ago(newest.updatedAt, now) : "—"} delay={0.12} />
      </div>
      <Reveal delay={0.05} className="mt-4">
        <Card className="px-4 py-5 sm:px-6">
          <div className="mb-3 flex justify-end">
            <ReadOnlyHint text={block} />
          </div>
          {error ? <ErrorState error={error} onRetry={reload} /> : !data ? <TableSkeleton /> : <DataTable columns={cols} rows={rates} dense pageSize={30} rowKey={(r) => r.ccy} onRowClick={(r) => setHist(r.ccy)} exportName="options-rates" />}
        </Card>
      </Reveal>
      <RateEditor edit={edit} known={rates.map((r) => r.ccy)} onClose={() => setEdit(null)} onSaved={reload} />
      <HistoryDrawer ccy={hist} current={rates.find((r) => r.ccy === hist) ?? null} now={now} onClose={() => setHist(null)} />
    </div>
  );
}

function RateEditor({ edit, known, onClose, onSaved }: { edit: { rate: Rate | null } | null; known: string[]; onClose: () => void; onSaved: () => void }) {
  const cur = edit?.rate ?? null;
  const [ccy, setCcy] = React.useState("");
  const [rate, setRate] = React.useState("");
  const [kind, setKind] = React.useState("policy");
  const [source, setSource] = React.useState("");
  const [asOf, setAsOf] = React.useState("");
  React.useEffect(() => {
    if (!edit) return;
    setCcy(cur?.ccy ?? "");
    setRate(cur ? String(+(cur.rate * 100).toFixed(4)) : "");
    setKind(cur?.kind ?? "policy");
    setSource(cur?.source ?? "");
    setAsOf(cur?.asOf ?? new Date().toISOString().slice(0, 10));
  }, [edit, cur]);
  // a new rate is as of today unless the user picks another date
  const onRate = (v: string) => {
    setRate(v);
    if (cur && asOf === cur.asOf) setAsOf(new Date().toISOString().slice(0, 10));
  };
  const n = parseNum(rate);
  const dec = n === null || Number.isNaN(n) ? null : n / 100;
  const invalid = !/^[A-Z]{3,4}$/.test(ccy)
    ? "Currency: 3–4 letters"
    : !cur && known.includes(ccy)
      ? `${ccy} already has a rate: edit it instead`
      : dec === null
        ? "Enter the rate in percent"
        : dec <= -0.2 || dec >= 0.5
          ? "Rate must be between −20 % and 50 %"
          : !/^\d{4}-\d{2}-\d{2}$/.test(asOf)
            ? "As-of date is YYYY-MM-DD"
            : cur && Math.abs(dec - cur.rate) < 1e-12 && kind === cur.kind && source === cur.source && asOf === cur.asOf
              ? "Nothing changed yet"
              : null;
  return (
    <ReasonDialog
      open={!!edit}
      onOpenChange={(o) => !o && onClose()}
      title={cur ? `Edit ${cur.ccy} rate` : "Add a currency rate"}
      description="Applies to new prices at once. Open positions are re-marked with it; every change is kept in the history."
      codes={REASONS.rate}
      confirmLabel="Save rate"
      disabled={invalid}
      onConfirm={async (reason) => {
        const r = await optSend("PUT", `/api/options/rates/${ccy}`, { rate: dec, kind, source: source.trim(), asOf, reason });
        if (r.ok) onSaved();
        return r;
      }}
      success={`${ccy} rate saved`}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Currency">
          <Input value={ccy} disabled={!!cur} onChange={(e) => setCcy(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))} className="font-mono" aria-label="Currency" placeholder="EUR" />
        </Field>
        <Field label="Rate" hint={cur && dec !== null ? `${pct(cur.rate, 3)} → ${pct(dec, 3)} (${bp(dec - cur.rate)})` : "annual, in percent"}>
          <NumInput value={rate} onChange={onRate} label="Rate" suffix="%" invalid={Number.isNaN(n ?? 0)} />
        </Field>
        <Field label="Kind">
          <Segmented size="sm" value={kind} onChange={setKind} options={[{ value: "policy", label: "Policy" }, { value: "lease", label: "Lease" }, { value: "market", label: "Market" }]} />
        </Field>
        <Field label="As of">
          <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} aria-label="As of" />
        </Field>
        <Field label="Source" className="col-span-2">
          <Input value={source} onChange={(e) => setSource(e.target.value)} maxLength={120} aria-label="Source" placeholder="e.g. ECB deposit facility" />
        </Field>
      </div>
    </ReasonDialog>
  );
}

function HistoryDrawer({ ccy, current, now, onClose }: { ccy: string | null; current: Rate | null; now: number; onClose: () => void }) {
  const { data, error, reload } = useOpt<{ ccy: string; history: RateHistory[] }>(ccy ? `/api/options/rates/${ccy}/history` : null);
  const list = data && data.ccy === ccy ? data.history : null;
  return (
    <Dialog open={!!ccy} onOpenChange={(o) => !o && onClose()} side="right" title={`${ccy ?? ""} rate history`} description={current ? `Now ${pct(current.rate, 3)} (${current.kind}) · ${current.source || "no source"}` : undefined}>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !list ? (
        <TableSkeleton rows={5} />
      ) : !list.length ? (
        <EmptyState title="No changes yet" illustration="bank" />
      ) : (
        <ol className="relative space-y-3 border-l border-line pl-5">
          {list.map((h, i) => {
            const d = h.prevRate === null ? null : h.rate - h.prevRate;
            return (
              <li key={`${h.changedAt}-${i}`} className="relative">
                <span className={cn("absolute -left-[26px] top-1.5 size-2.5 rounded-full ring-4 ring-surface", i === 0 ? "bg-ember" : "bg-fg-3")} />
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="k-num font-mono text-[15px] font-medium">{pct(h.rate, 3)}</span>
                  {d !== null && <span className={cn("k-num font-mono text-[12px]", d > 0 ? "text-up" : d < 0 ? "text-down" : "text-fg-3")}>{bp(d)}</span>}
                  {h.prevRate !== null && <span className="text-[11.5px] text-fg-3">from {pct(h.prevRate, 3)}</span>}
                  <span className="ml-auto text-[11.5px] text-fg-3">as of {day(h.asOf)}</span>
                </div>
                <div className="mt-1 text-[12.5px] text-fg-2">{h.reason}</div>
                <div className="mt-0.5 text-[11px] text-fg-3" title={when(h.changedAt)}>
                  {h.changedBy} · {ago(h.changedAt, now)}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Dialog>
  );
}
