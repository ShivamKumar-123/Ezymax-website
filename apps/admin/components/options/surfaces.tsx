"use client";

/**
 * Options › Vol surfaces (O12, O13, O37): the tenor × pillar grid (ATM, 25Δ / 10Δ risk reversal and butterfly) and the
 * realized-vol blend weight per underlying, edited as a draft with a diff against the published version, previews of
 * the smile and term structure, and a versioned publish with a reason. The service rejects a calendar arbitrage or a
 * non-positive wing; the same check runs here first (crates/optmath term.rs `calendar_violations`, mirrored).
 *
 *   GET  /api/options/surfaces/{symbol}            {current, versions[], realized[], realizedUsed}
 *   GET  /api/options/surfaces/{symbol}/{version}
 *   POST /api/options/surfaces/{symbol}            {pillars[], blendWeight, reason}  → version + 1
 *   GET  /api/options/smile?u=&expiry=             the published smile of a listed expiry (client API)
 */
import * as React from "react";
import { AlertTriangle, ChartSpline, History, Plus, RefreshCw, RotateCcw, Send, Upload, X } from "lucide-react";
import { IS_DEMO } from "@kalks/mock/mode";
import { mockOptionsRequest } from "@kalks/mock/admin-options";
import { Button, Card, CardHeader, Chip, EmptyState, IconButton, KpiCard, PageHeader, Reveal, Segmented, cn, formatNumber } from "@kalks/ui";
import { ErrorState, TableSkeleton, useNow, ago, when } from "@/components/live/kit";
import { LineChart } from "@/components/analytics/line-chart";
import type { AdminExpiry, Pillar, Smile, SurfaceResp, Underlying } from "./types";
import { ReadOnlyHint, REASONS, ReasonDialog, optSend, parseNum, pct, platformBlock, signedVolPts, useOpt, useOptPerms } from "./kit";

type Row = { key: string; tenor: string; days: string; atm: string; rr25: string; bf25: string; rr10: string; bf10: string };
type Q = "atm" | "rr25" | "bf25" | "rr10" | "bf10";
const QS: { key: Q; label: string; hint: string }[] = [
  { key: "atm", label: "ATM", hint: "at-the-money vol" },
  { key: "rr25", label: "RR 25Δ", hint: "25Δ call − put" },
  { key: "bf25", label: "BF 25Δ", hint: "25Δ wings − ATM" },
  { key: "rr10", label: "RR 10Δ", hint: "optional" },
  { key: "bf10", label: "BF 10Δ", hint: "optional" },
];
const ESTIMATOR: Record<string, string> = { yang_zhang: "Yang-Zhang", garman_klass: "Garman-Klass", close_to_close: "Close-to-close", ewma: "EWMA λ 0.94" };

let seq = 0;
const k = () => `r${++seq}`;
const p2 = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(+(v * 100).toFixed(4)));

function toRows(pillars: Pillar[]): Row[] {
  return [...pillars].sort((a, b) => a.days - b.days).map((p) => ({ key: k(), tenor: p.tenor, days: String(p.days), atm: p2(p.atm), rr25: p2(p.rr25), bf25: p2(p.bf25), rr10: p2(p.rr10), bf10: p2(p.bf10) }));
}

/** Draft rows → service pillars (decimals), or the first input problem. */
function toPillars(rows: Row[]): { pillars: Pillar[]; error: string | null; cells: Set<string> } {
  const cells = new Set<string>();
  let error: string | null = null;
  const pillars = rows.map((r, i) => {
    const name = r.tenor.trim() || `row ${i + 1}`;
    const n = (f: keyof Row, optional = false) => {
      const v = parseNum(r[f]);
      if (v === null && optional) return null;
      if (v === null || Number.isNaN(v)) {
        cells.add(`${r.key}:${f}`);
        error ??= `${name}: ${f === "days" ? "days" : QS.find((q) => q.key === f)?.label ?? f} is missing or not a number`;
        return 0;
      }
      return v;
    };
    if (!r.tenor.trim()) {
      cells.add(`${r.key}:tenor`);
      error ??= `Row ${i + 1}: enter a tenor label (e.g. 1W)`;
    }
    const days = n("days") ?? 0;
    const rr10 = n("rr10", true);
    const bf10 = n("bf10", true);
    if ((rr10 === null) !== (bf10 === null)) {
      cells.add(`${r.key}:${rr10 === null ? "rr10" : "bf10"}`);
      error ??= `${name}: give both RR 10Δ and BF 10Δ or neither`;
    }
    return { tenor: r.tenor.trim(), days, atm: (n("atm") ?? 0) / 100, rr25: (n("rr25") ?? 0) / 100, bf25: (n("bf25") ?? 0) / 100, ...(rr10 !== null && bf10 !== null ? { rr10: rr10 / 100, bf10: bf10 / 100 } : {}) };
  });
  return { pillars, error, cells };
}

const wings = (p: Pillar): [string, number][] => [
  ["ATM", p.atm],
  ["25Δ call", p.atm + p.bf25 + p.rr25 / 2],
  ["25Δ put", p.atm + p.bf25 - p.rr25 / 2],
  ...(p.rr10 != null && p.bf10 != null
    ? ([
        ["10Δ call", p.atm + p.bf10 + p.rr10 / 2],
        ["10Δ put", p.atm + p.bf10 - p.rr10 / 2],
      ] as [string, number][])
    : []),
];

/** The service's checks (services/options model.rs build_surface + optmath VolSurface::new). */
export function surfaceProblems(pillars: Pillar[]): string[] {
  const out: string[] = [];
  if (!pillars.length || pillars.length > 24) out.push("Give 1 to 24 tenors.");
  const ps = [...pillars].sort((a, b) => a.days - b.days);
  ps.forEach((p, i) => {
    if (!(p.days > 0 && p.days <= 3660)) out.push(`${p.tenor}: days must be between 0 and 3660.`);
    if (!(p.atm > 0.001 && p.atm < 3)) out.push(`${p.tenor}: ATM must be between 0.1 % and 300 %.`);
    for (const [w, v] of wings(p)) if (!(v > 0)) out.push(`${p.tenor}: the ${w} vol is ${formatNumber(v * 100, 2)} % (must be positive). Check RR / BF.`);
    if (i > 0 && p.days <= ps[i - 1]!.days) out.push(`${p.tenor}: days must be more than ${ps[i - 1]!.tenor}'s.`);
  });
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1]!;
    const b = ps[i]!;
    const wb = wings(b);
    for (const [w, va] of wings(a)) {
      const vb = wb.find(([x]) => x === w)?.[1];
      if (vb === undefined) continue;
      const w0 = (va * va * a.days) / 365;
      const w1 = (vb * vb * b.days) / 365;
      if (w1 < w0 - 1e-12) out.push(`Calendar arbitrage ${a.tenor} → ${b.tenor} (${w}): total variance falls from ${w0.toFixed(6)} to ${w1.toFixed(6)}. Raise ${b.tenor} or lower ${a.tenor}.`);
    }
  }
  return out;
}

export function SurfacesPage() {
  const perms = useOptPerms();
  const block = platformBlock(perms);
  const now = useNow();
  const unders = useOpt<{ underlyings: Underlying[] }>("/api/options/underlyings");
  const us = React.useMemo(() => [...(unders.data?.underlyings ?? [])].sort((a, b) => a.sort - b.sort), [unders.data]);
  const [sym, setSym] = React.useState("");
  React.useEffect(() => {
    if (!sym && us.length) setSym(us.find((u) => u.enabled)?.symbol ?? us[0]!.symbol);
  }, [us, sym]);
  const surf = useOpt<SurfaceResp>(sym ? `/api/options/surfaces/${sym}` : null, { refreshMs: 60_000 });
  const data = surf.data && surf.data.symbol === sym ? surf.data : null;
  const current = data?.current ?? null;

  const [rows, setRows] = React.useState<Row[]>([]);
  const [blend, setBlend] = React.useState("70");
  const [loadedFrom, setLoadedFrom] = React.useState<number | null>(null);
  const [publishing, setPublishing] = React.useState(false);
  const [rejection, setRejection] = React.useState<string | null>(null);
  const baseKey = `${sym}:${current?.version ?? "none"}`;
  const [base, setBase] = React.useState("");
  React.useEffect(() => {
    if (!data || base === baseKey) return;
    setRows(toRows(current?.pillars ?? []));
    setBlend(String(Math.round((current?.blendWeight ?? 0.7) * 100)));
    setLoadedFrom(null);
    setRejection(null);
    setBase(baseKey);
  }, [data, current, base, baseKey]);

  const parsed = toPillars(rows);
  const blendNum = parseNum(blend);
  const blendErr = blendNum === null || Number.isNaN(blendNum) || blendNum < 0 || blendNum > 100 ? "Blend weight is 0–100 %" : null;
  const problems = parsed.error ? [] : surfaceProblems(parsed.pillars);
  const curByTenor = new Map((current?.pillars ?? []).map((p) => [p.tenor, p]));
  const diffs = diffList(current?.pillars ?? [], parsed.error ? [] : parsed.pillars);
  const blendChanged = !blendErr && current ? Math.abs((blendNum ?? 0) / 100 - current.blendWeight) > 1e-9 : false;
  const dirty = diffs.length > 0 || blendChanged;
  const realized = data?.realizedUsed?.value ?? null;

  const set = (key: string, f: keyof Row, v: string) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [f]: f === "tenor" ? v.toUpperCase().slice(0, 8) : v.replace(/[^0-9.\-]/g, "") } : r)));
  const shiftAtm = (d: number) =>
    setRows((rs) =>
      rs.map((r) => {
        const v = parseNum(r.atm);
        return v === null || Number.isNaN(v) ? r : { ...r, atm: String(+(v + d).toFixed(4)) };
      }),
    );
  const addRow = () => {
    const last = rows[rows.length - 1];
    const days = last ? Math.round((parseNum(last.days) || 30) * 2) : 30;
    setRows((rs) => [...rs, { key: k(), tenor: days >= 365 ? `${Math.round(days / 365)}Y` : days >= 28 ? `${Math.round(days / 30)}M` : `${Math.round(days / 7)}W`, days: String(days), atm: last?.atm ?? "", rr25: last?.rr25 ?? "0", bf25: last?.bf25 ?? "0", rr10: last?.rr10 ?? "", bf10: last?.bf10 ?? "" }]);
  };
  const loadVersion = async (v: number) => {
    const r = await fetchVersion(sym, v);
    if (r) {
      setRows(toRows(r.pillars));
      setBlend(String(Math.round(r.blendWeight * 100)));
      setLoadedFrom(v);
    }
  };
  const reset = () => {
    setRows(toRows(current?.pillars ?? []));
    setBlend(String(Math.round((current?.blendWeight ?? 0.7) * 100)));
    setLoadedFrom(null);
    setRejection(null);
  };
  const inputBlock = block ?? parsed.error ?? blendErr ?? (problems.length ? "Fix the arbitrage / wing problems first" : null) ?? (!dirty ? "Nothing changed yet" : null);

  return (
    <div className="pb-10">
      <PageHeader
        title="Vol surfaces"
        subtitle="ATM, risk reversals and butterflies per tenor, blended with our realized vol. Every publish is a new version, shared by all brokers."
        actions={
          <>
            <select value={sym} onChange={(e) => setSym(e.target.value)} aria-label="Underlying" className="h-11 rounded-full border border-line bg-surface-2 px-4 text-[13.5px] text-fg outline-none">
              {us.map((u) => (
                <option key={u.symbol} value={u.symbol}>
                  {u.symbol} · {u.name}
                </option>
              ))}
            </select>
            <Button variant="surface" size="lg" onClick={surf.reload}>
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />

      {surf.error ? (
        <Card>
          <ErrorState error={surf.error} onRetry={surf.reload} />
        </Card>
      ) : !data ? (
        <TableSkeleton rows={8} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <KpiCard label="Published" icon={<History />} value={<span className="k-num">{current ? `v${current.version}` : "none"}</span>} chip={current ? `${ago(current.publishedAt, now)} · ${current.publishedBy.split(" ")[0]}` : "no surface yet"} />
            <KpiCard label="Realized (used)" icon={<ChartSpline />} value={<span className="k-num">{pct(realized, 2)}</span>} chip={data.realizedUsed ? `${ESTIMATOR[data.realizedUsed.estimator] ?? data.realizedUsed.estimator} ${data.realizedUsed.windowBars}d` : "no candles yet"} delay={0.04} />
            <KpiCard label="Blend weight" icon={<ChartSpline />} value={<span className="k-num">{blendErr ? "—" : `${blendNum}%`}</span>} chip="surface share of ATM" chipTone={blendChanged ? "ember" : "neutral"} delay={0.08} />
            <KpiCard label="Draft" icon={<Upload />} value={<span className="k-num">{diffs.length + (blendChanged ? 1 : 0)}</span>} chip={problems.length ? `${problems.length} problem${problems.length === 1 ? "" : "s"}` : dirty ? "changes to publish" : "matches published"} chipTone={problems.length ? "down" : dirty ? "ember" : "up"} hot={dirty} delay={0.12} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 2xl:grid-cols-12">
            <Reveal delay={0.05} className="2xl:col-span-8">
              <Card className="pb-5">
                <CardHeader
                  title={`${sym} surface`}
                  subtitle={loadedFrom ? `Draft loaded from v${loadedFrom}: publishing it makes a new version (a rollback).` : "Vols in percent. Changed cells are highlighted with the move in vol points."}
                  action={
                    <>
                      <ReadOnlyHint text={block} />
                      {!block && (
                        <>
                          <span className="text-[12px] text-fg-3">ATM all</span>
                          {[-0.5, -0.1, 0.1, 0.5].map((d) => (
                            <Button key={d} size="xs" variant="surface" onClick={() => shiftAtm(d)}>
                              {d > 0 ? "+" : "−"}
                              {Math.abs(d)}
                            </Button>
                          ))}
                          <Button size="xs" variant="ghost" onClick={reset} disabled={!dirty && !loadedFrom}>
                            <RotateCcw /> Reset
                          </Button>
                        </>
                      )}
                    </>
                  }
                />
                <div className="mt-4 overflow-x-auto px-4 sm:px-6">
                  <table className="w-full min-w-[860px] border-separate border-spacing-0 text-[13px]">
                    <thead>
                      <tr className="text-[10.5px] uppercase tracking-[0.05em] text-fg-3">
                        <th className="rounded-l-[12px] border-y border-l border-line bg-surface-2 px-3 py-2 text-left font-medium">Tenor</th>
                        <th className="border-y border-line bg-surface-2 px-2 py-2 text-right font-medium">Days</th>
                        {QS.map((q) => (
                          <th key={q.key} className="border-y border-line bg-surface-2 px-2 py-2 text-right font-medium" title={q.hint}>
                            {q.label} %
                          </th>
                        ))}
                        <th className="border-y border-line bg-surface-2 px-2 py-2 text-right font-medium" title="w · ATM + (1 − w) · realized">
                          Blended
                        </th>
                        <th className="rounded-r-[12px] border-y border-r border-line bg-surface-2 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const p = parsed.pillars[i];
                        const was = curByTenor.get(r.tenor.trim());
                        const isNew = !!current && !was;
                        const blended = p && realized !== null && !blendErr ? ((blendNum ?? 0) / 100) * p.atm + (1 - (blendNum ?? 0) / 100) * realized : null;
                        return (
                          <tr key={r.key} className={cn(isNew && "bg-up-soft/30")}>
                            <td className="border-b border-line py-1.5 pl-3 pr-2">
                              <Cell value={r.tenor} onChange={(v) => set(r.key, "tenor", v)} disabled={!!block} bad={parsed.cells.has(`${r.key}:tenor`)} mono label={`Tenor ${i + 1}`} align="left" />
                              {isNew && <span className="ml-1 text-[10px] text-up">new</span>}
                            </td>
                            <td className="border-b border-line px-2 py-1.5 text-right">
                              <Cell value={r.days} onChange={(v) => set(r.key, "days", v)} disabled={!!block} bad={parsed.cells.has(`${r.key}:days`)} label={`${r.tenor} days`} />
                            </td>
                            {QS.map((q) => {
                              const cur = was ? (was[q.key] ?? null) : null;
                              const nv = p ? (p[q.key] ?? null) : null;
                              const delta = cur !== null && nv !== null ? nv - cur : null;
                              const changed = !!was && ((cur === null) !== (nv === null) || (delta !== null && Math.abs(delta) > 1e-9));
                              return (
                                <td key={q.key} className="border-b border-line px-2 py-1.5 text-right">
                                  <Cell value={r[q.key]} onChange={(v) => set(r.key, q.key, v)} disabled={!!block} bad={parsed.cells.has(`${r.key}:${q.key}`)} changed={changed} label={`${r.tenor} ${q.label}`} placeholder={q.key === "rr10" || q.key === "bf10" ? "—" : undefined} />
                                  {changed && <div className={cn("k-num mt-0.5 text-right font-mono text-[10px]", (delta ?? 0) > 0 ? "text-up" : (delta ?? 0) < 0 ? "text-down" : "text-fg-3")}>{delta !== null ? signedVolPts(delta) : cur === null ? "added" : "removed"}</div>}
                                </td>
                              );
                            })}
                            <td className="k-num border-b border-line px-2 py-1.5 text-right font-mono text-[12px] text-fg-3">{pct(blended, 2)}</td>
                            <td className="border-b border-line px-2 py-1.5 text-right">
                              {!block && (
                                <IconButton size="sm" aria-label={`Remove ${r.tenor}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} disabled={rows.length <= 1}>
                                  <X />
                                </IconButton>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {current &&
                        current.pillars
                          .filter((p) => !rows.some((r) => r.tenor.trim() === p.tenor))
                          .map((p) => (
                            <tr key={`gone-${p.tenor}`} className="text-fg-3 line-through decoration-down/60">
                              <td className="border-b border-line py-2 pl-3 font-mono text-[12.5px]">{p.tenor}</td>
                              <td className="border-b border-line px-2 text-right font-mono text-[12px]">{p.days}</td>
                              {QS.map((q) => (
                                <td key={q.key} className="k-num border-b border-line px-2 text-right font-mono text-[12px]">
                                  {p[q.key] != null ? formatNumber((p[q.key] as number) * 100, 2) : "—"}
                                </td>
                              ))}
                              <td className="border-b border-line px-2 text-right text-[10.5px] text-down no-underline" colSpan={2}>
                                removed
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {!block && (
                      <Button size="sm" variant="surface" onClick={addRow} disabled={rows.length >= 24}>
                        <Plus /> Add tenor
                      </Button>
                    )}
                    <label className="flex items-center gap-2 text-[12.5px] text-fg-3">
                      Blend weight
                      <span className={cn("flex h-8 w-24 items-center gap-1 rounded-[10px] border bg-surface-2 px-2", blendErr ? "border-down/60" : blendChanged ? "border-ember/50" : "border-line")}>
                        <input value={blend} disabled={!!block} onChange={(e) => setBlend(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Blend weight" className="k-num min-w-0 flex-1 bg-transparent text-right font-mono text-[12.5px] text-fg outline-none" />
                        <span className="text-[11px]">%</span>
                      </span>
                      <span className="text-[11.5px]">surface · {blendErr ? "—" : `${formatNumber(100 - (blendNum ?? 0), 0)} %`} realized</span>
                    </label>
                    <div className="ml-auto flex items-center gap-2">
                      {!block && (
                        <Button variant="ember" size="sm" onClick={() => setPublishing(true)} disabled={!!inputBlock}>
                          <Send /> Publish v{(current?.version ?? 0) + 1}
                        </Button>
                      )}
                    </div>
                  </div>
                  {(parsed.error || problems.length > 0 || rejection) && (
                    <div role="alert" className="mt-4 space-y-1.5 rounded-[14px] border border-down/30 bg-down-soft px-4 py-3 text-[12.5px] text-fg">
                      <div className="flex items-center gap-2 font-medium text-down">
                        <AlertTriangle className="size-4" /> {rejection ? "The options service rejected the last publish" : "This surface can't be published yet"}
                      </div>
                      {rejection && <div className="font-mono text-[12px]">{rejection}</div>}
                      {parsed.error && <div>{parsed.error}</div>}
                      {problems.map((p) => (
                        <div key={p}>• {p}</div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </Reveal>

            <div className="space-y-4 2xl:col-span-4">
              <Reveal delay={0.08}>
                <RealizedCard data={data} now={now} />
              </Reveal>
              <Reveal delay={0.1}>
                <VersionsCard data={data} now={now} onLoad={loadVersion} canLoad={!block} loadedFrom={loadedFrom} />
              </Reveal>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Reveal delay={0.12}>
              <DraftSmileCard current={current?.pillars ?? []} draft={parsed.error ? [] : parsed.pillars} />
            </Reveal>
            <Reveal delay={0.14}>
              <LiveSmileCard sym={sym} enabled={us.find((u) => u.symbol === sym)?.enabled ?? false} />
            </Reveal>
          </div>

          {diffs.length > 0 && (
            <Reveal delay={0.1} className="mt-4">
              <Card className="pb-5">
                <CardHeader title="Diff vs published" subtitle={`v${current?.version ?? 0} → draft`} />
                <div className="mt-3 flex flex-wrap gap-1.5 px-6">
                  {blendChanged && current && <Chip tone="ember">blend {Math.round(current.blendWeight * 100)}% → {blendNum}%</Chip>}
                  {diffs.map((d) => (
                    <Chip key={d.text} tone={d.kind === "added" ? "up" : d.kind === "removed" ? "down" : "neutral"}>
                      {d.text}
                    </Chip>
                  ))}
                </div>
              </Card>
            </Reveal>
          )}
        </>
      )}

      <ReasonDialog
        open={publishing}
        onOpenChange={setPublishing}
        title={`Publish ${sym} surface v${(current?.version ?? 0) + 1}`}
        description="Every broker prices from it within seconds. The previous version stays in the history."
        codes={REASONS.surface}
        confirmLabel="Publish"
        disabled={inputBlock}
        onConfirm={async (reason) => {
          const r = await optSend<{ version: number }>("POST", `/api/options/surfaces/${sym}`, { pillars: parsed.pillars, blendWeight: (blendNum ?? 70) / 100, reason });
          if (r.ok) {
            setRejection(null);
            setBase("");
            surf.reload();
          } else if (r.error.code === "validation") setRejection(r.error.message);
          return r;
        }}
        success={(d) => `${sym} surface v${d.version} published`}
      >
        <div className="space-y-1.5 rounded-[14px] border border-line bg-surface-2/60 px-3.5 py-3 text-[12.5px]">
          <div className="text-fg-2">{diffs.length + (blendChanged ? 1 : 0)} change(s)</div>
          <div className="flex flex-wrap gap-1.5">
            {blendChanged && current && <Chip size="sm" tone="ember">blend {Math.round(current.blendWeight * 100)}% → {blendNum}%</Chip>}
            {diffs.slice(0, 18).map((d) => (
              <Chip key={d.text} size="sm" tone={d.kind === "added" ? "up" : d.kind === "removed" ? "down" : "neutral"}>
                {d.text}
              </Chip>
            ))}
            {diffs.length > 18 && <span className="text-[11.5px] text-fg-3">+{diffs.length - 18} more</span>}
          </div>
        </div>
      </ReasonDialog>
    </div>
  );
}

async function fetchVersion(sym: string, v: number): Promise<{ pillars: Pillar[]; blendWeight: number } | null> {
  if (IS_DEMO) {
    const r = await mockOptionsRequest("GET", `/api/options/surfaces/${sym}/${v}`);
    return r.status === 200 ? (r.data as { pillars: Pillar[]; blendWeight: number }) : null;
  }
  try {
    const r = await fetch(`/api/options/surfaces/${sym}/${v}`, { cache: "no-store", credentials: "same-origin" });
    return r.ok ? ((await r.json()) as { pillars: Pillar[]; blendWeight: number }) : null;
  } catch {
    return null;
  }
}

function diffList(cur: Pillar[], next: Pillar[]) {
  const out: { kind: "added" | "removed" | "changed"; text: string }[] = [];
  const byT = new Map(cur.map((p) => [p.tenor, p]));
  for (const p of next) {
    const c = byT.get(p.tenor);
    if (!c) {
      out.push({ kind: "added", text: `+ ${p.tenor} (${p.days}d, ATM ${formatNumber(p.atm * 100, 2)}%)` });
      continue;
    }
    if (c.days !== p.days) out.push({ kind: "changed", text: `${p.tenor} days ${c.days} → ${p.days}` });
    for (const q of QS) {
      const a = c[q.key] ?? null;
      const b = p[q.key] ?? null;
      if (a === null && b === null) continue;
      if (a === null || b === null) out.push({ kind: "changed", text: `${p.tenor} ${q.label} ${a === null ? "added" : "removed"}` });
      else if (Math.abs(a - b) > 1e-9) out.push({ kind: "changed", text: `${p.tenor} ${q.label} ${formatNumber(a * 100, 2)} → ${formatNumber(b * 100, 2)} (${signedVolPts(b - a)})` });
    }
  }
  for (const c of cur) if (!next.some((p) => p.tenor === c.tenor)) out.push({ kind: "removed", text: `− ${c.tenor}` });
  return out;
}

function Cell({ value, onChange, disabled, bad, changed, label, mono = true, align = "right", placeholder }: { value: string; onChange: (v: string) => void; disabled?: boolean; bad?: boolean; changed?: boolean; label: string; mono?: boolean; align?: "left" | "right"; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={label}
      placeholder={placeholder}
      inputMode={align === "right" ? "decimal" : undefined}
      className={cn(
        "k-num h-8 w-[74px] rounded-[9px] border bg-surface-2 px-2 text-[12.5px] text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-ember/50 disabled:opacity-80",
        mono && "font-mono",
        align === "right" ? "text-right" : "w-16 text-left",
        bad ? "border-down/70 bg-down-soft" : changed ? "border-ember/50 bg-ember-soft/60" : "border-line",
      )}
    />
  );
}

/* ------------------------------------------------------------------ */

function RealizedCard({ data, now }: { data: SurfaceResp; now: number }) {
  const used = data.realizedUsed;
  return (
    <Card className="pb-5">
      <CardHeader title="Realized vol" subtitle="From our D1 candles every 15 minutes, annualized with 260 days. Pricing uses Yang-Zhang 20d." icon={<ChartSpline />} />
      <div className="mt-3 space-y-1.5 px-6">
        {!data.realized.length ? (
          <div className="text-[12.5px] text-fg-3">No candles yet: pricing uses the surface ATM only.</div>
        ) : (
          data.realized.map((r) => {
            const isUsed = used && used.estimator === r.estimator && used.windowBars === r.windowBars;
            return (
              <div key={`${r.estimator}-${r.windowBars}`} className={cn("flex items-center justify-between rounded-[10px] px-2.5 py-1.5 text-[12.5px]", isUsed && "bg-ember-soft/60")}>
                <span className="text-fg-2">
                  {ESTIMATOR[r.estimator] ?? r.estimator}
                  {r.windowBars ? ` ${r.windowBars}d` : ""}
                  {isUsed && (
                    <Chip size="sm" tone="ember" className="ml-2">
                      used
                    </Chip>
                  )}
                </span>
                <span className="k-num font-mono" title={when(r.computedAt)}>
                  {pct(r.value, 2)}
                </span>
              </div>
            );
          })
        )}
        {used && <div className="pt-1 text-[11.5px] text-fg-3">Computed {ago(used.computedAt, now)}</div>}
      </div>
    </Card>
  );
}

function VersionsCard({ data, now, onLoad, canLoad, loadedFrom }: { data: SurfaceResp; now: number; onLoad: (v: number) => void; canLoad: boolean; loadedFrom: number | null }) {
  return (
    <Card className="pb-4">
      <CardHeader title="Versions" subtitle="Append-only. Load an older one into the editor to roll back (it publishes as a new version)." icon={<History />} />
      <div className="mt-3 max-h-[320px] space-y-1 overflow-y-auto px-4">
        {data.versions.map((v, i) => (
          <div key={v.version} className={cn("k-row flex items-center gap-3 px-3 py-2", loadedFrom === v.version && "border-ember/40")}>
            <span className="font-mono text-[12.5px] font-medium">v{v.version}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] text-fg-2" title={v.reason}>
                {v.reason || "—"}
              </div>
              <div className="text-[10.5px] text-fg-3">
                {v.publishedBy} · {ago(v.publishedAt, now)} · blend {Math.round(v.blendWeight * 100)}%
              </div>
            </div>
            {i === 0 ? (
              <Chip size="sm" tone="up">
                live
              </Chip>
            ) : canLoad ? (
              <Button size="xs" variant="ghost" onClick={() => onLoad(v.version)}>
                Load
              </Button>
            ) : null}
          </div>
        ))}
        {!data.versions.length && <div className="px-2 text-[12.5px] text-fg-3">Never published.</div>}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Previews                                                             */
/* ------------------------------------------------------------------ */

const DELTAS = ["10Δ put", "25Δ put", "ATM", "25Δ call", "10Δ call"];
function deltaSmile(p: Pillar | undefined): (number | null)[] {
  if (!p) return DELTAS.map(() => null);
  const has10 = p.rr10 != null && p.bf10 != null;
  return [has10 ? p.atm + p.bf10! - p.rr10! / 2 : null, p.atm + p.bf25 - p.rr25 / 2, p.atm, p.atm + p.bf25 + p.rr25 / 2, has10 ? p.atm + p.bf10! + p.rr10! / 2 : null].map((v) => (v === null ? null : +(v * 100).toFixed(4)));
}

function DraftSmileCard({ current, draft }: { current: Pillar[]; draft: Pillar[] }) {
  const [view, setView] = React.useState<"smile" | "term">("smile");
  const tenors = Array.from(new Set([...draft, ...current].sort((a, b) => a.days - b.days).map((p) => p.tenor)));
  const [tenor, setTenor] = React.useState("");
  React.useEffect(() => {
    if (!tenors.includes(tenor) && tenors.length) setTenor(tenors.includes("1M") ? "1M" : tenors[0]!);
  }, [tenors, tenor]);
  const cur = current.find((p) => p.tenor === tenor);
  const nxt = draft.find((p) => p.tenor === tenor);
  const sortedD = [...draft].sort((a, b) => a.days - b.days);
  const labels = view === "smile" ? DELTAS : Array.from(new Set([...sortedD, ...current].sort((a, b) => a.days - b.days).map((p) => p.tenor)));
  const term = (ps: Pillar[]) => labels.map((t) => {
    const p = ps.find((x) => x.tenor === t);
    return p ? +(p.atm * 100).toFixed(4) : null;
  });
  const series =
    view === "smile"
      ? [
          { key: "cur", label: "Published", color: "#a1a1aa", values: deltaSmile(cur), dashed: true },
          { key: "draft", label: "Draft", color: "#ff5a1f", values: deltaSmile(nxt), area: true },
        ]
      : [
          { key: "cur", label: "Published ATM", color: "#a1a1aa", values: term(current), dashed: true },
          { key: "draft", label: "Draft ATM", color: "#ff5a1f", values: term(draft), area: true },
        ];
  const any = series.some((s) => s.values.some((v) => v !== null));
  return (
    <Card className="h-full pb-5">
      <CardHeader
        title={view === "smile" ? "Smile preview (delta space)" : "ATM term structure"}
        subtitle={view === "smile" ? "Pillar vols of one tenor: 25Δ = ATM + BF ± RR / 2 (10Δ the same with the 10Δ quotes)." : "ATM by tenor, published vs draft."}
        icon={<ChartSpline />}
        action={
          <>
            {view === "smile" && (
              <select value={tenor} onChange={(e) => setTenor(e.target.value)} aria-label="Tenor" className="h-8 rounded-full border border-line bg-surface-2 px-3 text-[12.5px] text-fg outline-none">
                {tenors.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
            <Segmented size="xs" value={view} onChange={setView} options={[{ value: "smile", label: "Smile" }, { value: "term", label: "Term" }]} />
          </>
        }
      />
      <div className="mt-4 px-6">{any ? <LineChart labels={labels} series={series} height={220} minZero={false} format={(v) => `${formatNumber(v, 1)}%`} /> : <EmptyState title="Nothing to draw" text="Enter vols for this tenor." illustration="chart_increasing" />}</div>
    </Card>
  );
}

function LiveSmileCard({ sym, enabled }: { sym: string; enabled: boolean }) {
  const exps = useOpt<{ expiries: AdminExpiry[] }>(sym && enabled ? `/api/options/expiries?u=${sym}&status=listed&limit=60` : null);
  const listed = React.useMemo(() => [...(exps.data?.expiries ?? [])].sort((a, b) => a.cutAt.localeCompare(b.cutAt)), [exps.data]);
  const [expiry, setExpiry] = React.useState("");
  React.useEffect(() => {
    if (listed.length && !listed.some((e) => e.date === expiry)) setExpiry(listed[Math.min(1, listed.length - 1)]!.date);
  }, [listed, expiry]);
  const smile = useOpt<Smile>(sym && expiry ? `/api/options/smile?u=${sym}&expiry=${expiry}` : null, { refreshMs: 30_000 });
  const s = smile.data && smile.data.underlying === sym && smile.data.expiry === expiry ? smile.data : null;
  const pts = s?.points ?? [];
  const step = Math.max(1, Math.ceil(pts.length / 25));
  const shown = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
  const digits = shown.length ? Math.min(5, Math.max(0, -Math.floor(Math.log10(Math.abs(shown[1] ? shown[1].strike - shown[0]!.strike : 1))) + 1)) : 2;
  return (
    <Card className="h-full pb-5">
      <CardHeader
        title="Live smile by strike"
        subtitle="What clients are priced from now for a listed expiry: the published surface blended with realized vol (and any manual vol)."
        icon={<ChartSpline />}
        action={
          <select value={expiry} onChange={(e) => setExpiry(e.target.value)} aria-label="Expiry" disabled={!listed.length} className="h-8 rounded-full border border-line bg-surface-2 px-3 text-[12.5px] text-fg outline-none">
            {listed.map((e) => (
              <option key={e.id} value={e.date}>
                {e.date} · {e.kinds.join("/")}
              </option>
            ))}
          </select>
        }
      />
      <div className="mt-4 px-6">
        {!enabled ? (
          <EmptyState title="Underlying disabled" text="Enable it under Underlyings & series to list expiries." illustration="locked" />
        ) : smile.error ? (
          smile.error.code === "options_disabled" ? (
            <EmptyState title="Options are off for this broker" text="The live smile uses the client API, which follows the broker's module switch." illustration="locked" />
          ) : smile.error.code === "no_price" ? (
            <EmptyState title="No price yet" text="The smile needs a live spot for this underlying." illustration="hourglass_not_done" />
          ) : (
            <ErrorState error={smile.error} onRetry={smile.reload} />
          )
        ) : !s ? (
          <TableSkeleton rows={5} />
        ) : !shown.length ? (
          <EmptyState title="No strikes listed" illustration="chart_increasing" />
        ) : (
          <>
            <LineChart labels={shown.map((p) => formatNumber(p.strike, digits))} series={[{ key: "iv", label: `IV · ${s.expiry}`, color: "#38bdf8", values: shown.map((p) => +(p.vol * 100).toFixed(3)), area: true }]} height={220} minZero={false} legend={false} format={(v) => `${formatNumber(v, 1)}%`} />
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-fg-3">
              <span>
                ATM <span className="k-num font-mono text-fg-2">{pct(s.atmVol, 2)}</span>
              </span>
              {s.inputs && (
                <>
                  <span>
                    Surface <span className="k-num font-mono text-fg-2">{pct(s.inputs.surfaceAtm, 2)}</span> v{s.inputs.surfaceVersion ?? "—"}
                  </span>
                  <span>
                    Realized <span className="k-num font-mono text-fg-2">{pct(s.inputs.realized, 2)}</span>
                  </span>
                  {s.inputs.manualVol !== null && <Chip size="sm" tone="gold">manual vol {pct(s.inputs.manualVol, 2)}</Chip>}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

