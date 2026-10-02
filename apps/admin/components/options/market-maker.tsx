"use client";

/**
 * Options › Market maker (docs/OPTIONS-EXCHANGE.md §4, decision O49): the Kalks MM bot that quotes every listed series
 * both sides on the order book, under the same rules as clients. Live status every 5 seconds (quoting state, uptime,
 * in-process latency, quote coverage, its account), its Greeks against the limits per underlying, pauses (cancel-all
 * of its quotes per scope) and the quoting parameters (`mm_settings` in the options service; most specific row wins:
 * broker + kind + underlying > … > `*, *, *`).
 *
 *   GET  /api/trading/admin/options/mm?kind=live|demo
 *        { kind, status: quoting|paused|degraded|stopped, startedAt, uptimeSecs, uptimePct?, latency?: {p50Us, p99Us},
 *          coveragePct, quotesLive, lastQuoteAt, account?: {login, equity, cash, margin},
 *          greeks: {delta, gamma, vega, theta}, pauses: [{scope, target, reason, by, at}],
 *          underlyings: [{ symbol, status, coveragePct, seriesQuoted, seriesTotal, inventoryContracts, netDelta, gamma,
 *            vega, theta, limits: {maxNetDelta, maxGamma, maxVega, maxContractsPerSeries}, withdrawnSides,
 *            lastRequoteAt }] }
 *        (coverage / uptime in percent 0–100; delta in delta-weighted contracts, gamma = contract-delta change per 1 %
 *        spot, vega USD per vol point, theta USD per day)
 *   POST /api/trading/admin/options/mm/pause|resume {kind, scope: all|underlying|expiry, target, reason}
 *        (target: `*`, `EURUSD` or `EURUSD:2026-10-09`; resuming `all` clears every pause of the kind)
 *   GET  /api/options/mm-settings     { settings: MmSettings[] }
 *   PUT  /api/options/mm-settings/{tenant|*}/{live|demo|*}/{underlying|*} {…fields, enabled, reason}
 *   DELETE /api/options/mm-settings/{tenant}/{kind}/{underlying} {reason}       (not `*, *, *`)
 */
import * as React from "react";
import { Activity, Bot, ChartSpline, Clock, Gauge, Pause, Pencil, Play, Plus, RefreshCw, Scale, ShieldCheck, Sigma, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Chip, DataTable, EmptyState, Field, IconButton, KpiCard, PageHeader, Progress, Reveal, Segmented, Toggle, Tooltip, cn, formatNumber, type ChipTone, type Column } from "@kalks/ui";
import { ErrorState, TableSkeleton, ago, useNow, when } from "@/components/live/kit";
import type { AdminExpiry, MmPause, MmSettings, MmState, MmUnderlying, TenantSettings, Underlying } from "./types";
import { EnginePending, KIND_OPTIONS, LoginLink, NumInput, REASONS, ReadOnlyHint, ReasonDialog, Select, UnderlyingCell, agoSecs, duration, enginePending, kindLabel, optSend, parseNum, signedNum, signedUsdCompact, tenantLabel, usd, useKind, useOpt, useOptPerms, volPts } from "./kit";

const MM_STATUS: Record<string, { label: string; tone: ChipTone }> = {
  quoting: { label: "Quoting", tone: "up" },
  paused: { label: "Paused", tone: "warn" },
  degraded: { label: "Degraded", tone: "warn" },
  stopped: { label: "Stopped", tone: "down" },
  halted: { label: "Book halted", tone: "down" },
  limited: { label: "At a limit", tone: "warn" },
  disabled: { label: "Disabled", tone: "neutral" },
  stale: { label: "Spot stale", tone: "warn" },
};
function MmStatusChip({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) {
  const s = MM_STATUS[status] ?? { label: status, tone: "neutral" as ChipTone };
  return (
    <Chip size={size} tone={s.tone} dot>
      {s.label}
    </Chip>
  );
}

const fmtUs = (us: number | null | undefined) => (us === null || us === undefined || !Number.isFinite(us) ? "—" : us < 1000 ? `${formatNumber(us, 0)} µs` : `${formatNumber(us / 1000, 2)} ms`);
const TONE_TEXT = { up: "text-up", warn: "text-warn", down: "text-down" } as const;
const pctTone = (p: number | null | undefined): "up" | "warn" | "down" => (p === null || p === undefined ? "warn" : p >= 95 ? "up" : p >= 80 ? "warn" : "down");
/** limit usage: warn above 80 %, down above 100 % */
const useTone = (u: number): "up" | "warn" | "down" => (u > 100 ? "down" : u > 80 ? "warn" : "up");
const usage = (v: number, lim: number | null | undefined) => (lim && lim > 0 ? (Math.abs(v) / lim) * 100 : null);
const scopeText = (p: { scope: string; target: string }) => (p.scope === "all" ? "All series" : p.scope === "expiry" ? p.target.replace(":", " · ") : p.target);

type PauseReq = { mode: "pause" | "resume"; scope?: "all" | "underlying" | "expiry"; target?: string; fixed?: boolean };

export function MarketMakerPage() {
  const perms = useOptPerms();
  const now = useNow(1000);
  const [kind, setKind] = useKind();
  const mm = useOpt<MmState>(`/api/trading/admin/options/mm?kind=${kind}`, { refreshMs: 5000 });
  const unders = useOpt<{ underlyings: Underlying[] }>("/api/options/underlyings");
  const [pause, setPause] = React.useState<PauseReq | null>(null);
  const pending = enginePending(mm.error);
  const d = mm.data && mm.data.kind === kind ? mm.data : mm.data && !mm.data.kind ? mm.data : null;
  const rows = React.useMemo(() => [...(d?.underlyings ?? [])].sort((a, b) => a.symbol.localeCompare(b.symbol)), [d]);
  const pauses = d?.pauses ?? [];
  const g = d?.greeks ?? null;
  const stopped = d?.status === "stopped";
  const loaded = !!d && !pending;

  return (
    <div className="pb-10">
      <PageHeader
        title="Market maker"
        subtitle="Kalks's market maker quotes every listed series on both sides from the model, under the same rules as clients. Status updates every 5 seconds."
        actions={
          <>
            <Segmented size="sm" value={kind} onChange={setKind} options={KIND_OPTIONS} />
            <Chip tone={mm.error && !pending ? "down" : d ? (MM_STATUS[d.status]?.tone ?? "neutral") : "neutral"} dot>
              {mm.error && !pending ? "Engine unavailable" : pending ? "Engine update pending" : d ? `${MM_STATUS[d.status]?.label ?? d.status} · 5 s` : "Loading…"}
            </Chip>
            <Button variant="surface" size="lg" onClick={() => (mm.reload(), unders.reload())}>
              <RefreshCw /> Refresh
            </Button>
            {perms.dealing && loaded && !stopped && (
              <>
                {pauses.length > 0 && (
                  <Button variant="surface" size="lg" onClick={() => setPause({ mode: "resume", scope: "all", target: "*", fixed: true })}>
                    <Play /> Resume all
                  </Button>
                )}
                <Button variant="sell" size="lg" onClick={() => setPause({ mode: "pause", scope: "all", target: "*" })}>
                  <Pause /> Pause…
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Net delta" icon={<Sigma />} value={loaded && g ? <span className={cn("k-num", g.delta >= 0 ? "text-up" : "text-down")}>{signedNum(g.delta, 1)}</span> : "—"} chip="delta-weighted contracts" />
        <KpiCard label="Gamma" icon={<Activity />} value={loaded && g ? <span className={cn("k-num", g.gamma >= 0 ? "text-up" : "text-down")}>{signedNum(g.gamma, 1)}</span> : "—"} chip="Δ change per 1 % spot" chipTone={g && g.gamma < 0 ? "warn" : "neutral"} delay={0.04} />
        <KpiCard label="Vega" icon={<ChartSpline />} value={loaded && g ? <span className={cn("k-num", g.vega >= 0 ? "text-up" : "text-down")}>{signedUsdCompact(g.vega)}</span> : "—"} chip="per +1 vol point" delay={0.08} />
        <KpiCard label="Theta" icon={<Clock />} value={loaded && g ? <span className={cn("k-num", g.theta >= 0 ? "text-up" : "text-down")}>{signedUsdCompact(g.theta)}</span> : "—"} chip="per calendar day" delay={0.12} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-4">
          <StatusCard d={d} error={pending ? null : mm.error} pending={pending} now={now} kind={kind} onRetry={mm.reload} />
        </Reveal>
        <Reveal delay={0.08} className="xl:col-span-8">
          <Card className="h-full pb-5">
            <CardHeader title="By underlying" subtitle="Quote coverage, inventory and Greeks against the limits that withdraw a side (bars: |value| / limit, amber above 80 %, red above 100 %)." icon={<Gauge />} />
            <div className="mt-4 px-4 sm:px-6">
              {pending ? (
                <EnginePending what="Market-maker status" />
              ) : mm.error ? (
                <ErrorState error={mm.error} onRetry={mm.reload} />
              ) : !d ? (
                <TableSkeleton rows={8} />
              ) : stopped && !rows.length ? (
                <EmptyState title={`Not running for ${kindLabel(kind)} accounts`} text="The market maker starts when the order book is enabled for this kind of account (Book rollout)." illustration="robot" />
              ) : (
                <UnderlyingsTable rows={rows} pauses={pauses} now={now} canDeal={perms.dealing} onPause={(sym) => setPause({ mode: "pause", scope: "underlying", target: sym })} onResume={(p) => setPause({ mode: "resume", scope: p.scope as PauseReq["scope"], target: p.target, fixed: true })} />
              )}
            </div>
          </Card>
        </Reveal>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-6">
          <PausesCard pauses={pauses} loaded={loaded} pending={pending} now={now} canDeal={perms.dealing && !stopped} onResume={(p) => setPause({ mode: "resume", scope: p.scope as PauseReq["scope"], target: p.target, fixed: true })} />
        </Reveal>
        <Reveal delay={0.12} className="xl:col-span-6">
          <RulesCard latency={d?.latency ?? null} />
        </Reveal>
      </div>

      <Reveal delay={0.14} className="mt-4">
        <SettingsCard underlyings={unders.data?.underlyings ?? []} />
      </Reveal>

      <PauseDialog req={pause} kind={kind} underlyings={unders.data?.underlyings ?? []} onClose={() => setPause(null)} onSaved={mm.reload} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StatusCard({ d, error, pending, now, kind, onRetry }: { d: MmState | null; error: { code: string; message: string } | null; pending: boolean; now: number; kind: string; onRetry: () => void }) {
  return (
    <Card className="h-full pb-5">
      <CardHeader title="Quoting engine" subtitle={`The ${kindLabel(kind)} MM account and its process.`} icon={<Bot />} action={d ? <MmStatusChip status={d.status} size="md" /> : undefined} />
      <div className="mt-4 space-y-3 px-6">
        {pending ? (
          <EnginePending what="The market maker" />
        ) : error ? (
          <ErrorState error={error} onRetry={onRetry} />
        ) : !d ? (
          <TableSkeleton rows={5} />
        ) : (
          <>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[12px]">
                <span className="text-fg-3">Quote coverage</span>
                <span className={cn("k-num font-mono", TONE_TEXT[pctTone(d.coveragePct)])}>{d.coveragePct === null || d.coveragePct === undefined ? "—" : `${formatNumber(d.coveragePct, 1)}%`}</span>
              </div>
              <Progress value={d.coveragePct ?? 0} tone={pctTone(d.coveragePct)} />
              <div className="mt-1 text-[11px] text-fg-3">Listed series with an MM quote on at least one side (halted books excluded).</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Tile label="Uptime" value={duration(d.uptimeSecs)} sub={d.startedAt ? `since ${when(d.startedAt)}` : undefined} />
              <Tile label="Availability" value={d.uptimePct !== null && d.uptimePct !== undefined ? `${formatNumber(d.uptimePct, 2)}%` : "—"} sub="30 days" />
              <Tile label="Latency p50" value={fmtUs(d.latency?.p50Us)} sub="in-process, published" />
              <Tile label="Latency p99" value={fmtUs(d.latency?.p99Us)} tone={(d.latency?.p99Us ?? 0) > 5000 ? "warn" : undefined} />
              <Tile label="Quotes live" value={d.quotesLive !== null && d.quotesLive !== undefined ? formatNumber(d.quotesLive, 0) : "—"} sub="sides on the books" />
              <Tile label="Last quote" value={agoSecs(d.lastQuoteAt, now)} tone={d.lastQuoteAt && now - Date.parse(d.lastQuoteAt) > 10_000 && d.status === "quoting" ? "warn" : undefined} />
            </div>
            {d.account && (
              <div className="rounded-[14px] border border-line bg-surface-2/60 px-3.5 py-3">
                <div className="mb-2 flex items-center justify-between text-[12px]">
                  <span className="text-fg-3">MM account</span>
                  <LoginLink login={d.account.login} mm />
                </div>
                <div className="grid grid-cols-3 gap-2 text-[12px]">
                  <Mini label="Equity" value={usd(d.account.equity)} />
                  <Mini label="Cash" value={usd(d.account.cash)} />
                  <Mini label="Margin" value={usd(d.account.margin)} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: "up" | "warn" | "down" }) {
  return (
    <div className="k-row min-w-0 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-fg-3">{label}</div>
      <div className={cn("k-num mt-0.5 truncate font-mono text-[13px]", tone === "up" && "text-up", tone === "warn" && "text-warn", tone === "down" && "text-down")}>{value}</div>
      {sub && <div className="truncate text-[10.5px] text-fg-3">{sub}</div>}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-fg-3">{label}</div>
      <div className="k-num truncate font-mono text-[12.5px]">{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LimitBar({ label, value, limit, fmt }: { label: string; value: number; limit: number | null | undefined; fmt: (v: number) => string }) {
  const u = usage(value, limit);
  return (
    <Tooltip content={u === null ? `${label}: no limit` : `${label}: ${fmt(value)} of ${fmt(limit!)} (${formatNumber(u, 0)}%)`}>
      <div className="flex items-center gap-1.5">
        <span className="w-3 text-[10px] text-fg-3">{label}</span>
        <Progress value={u ?? 0} tone={u === null ? "up" : useTone(u)} className="w-20" />
        <span className={cn("k-num w-9 text-right font-mono text-[10.5px]", u !== null && u > 100 ? "text-down" : u !== null && u > 80 ? "text-warn" : "text-fg-3")}>{u === null ? "—" : `${Math.round(u)}%`}</span>
      </div>
    </Tooltip>
  );
}

function UnderlyingsTable({ rows, pauses, now, canDeal, onPause, onResume }: { rows: MmUnderlying[]; pauses: MmPause[]; now: number; canDeal: boolean; onPause: (sym: string) => void; onResume: (p: MmPause) => void }) {
  const cols: Column<MmUnderlying>[] = [
    { key: "s", header: "Underlying", cell: (r) => <UnderlyingCell symbol={r.symbol} size={24} sub={`${formatNumber(r.seriesQuoted, 0)} / ${formatNumber(r.seriesTotal, 0)} series`} />, sort: (r) => r.symbol, csv: (r) => r.symbol },
    { key: "st", header: "Status", cell: (r) => <MmStatusChip status={r.status} />, sort: (r) => r.status, csv: (r) => r.status },
    {
      key: "cov",
      header: "Coverage",
      cell: (r) => (
        <div className="w-24">
          <Progress value={r.coveragePct} tone={pctTone(r.coveragePct)} />
          <div className="k-num mt-1 font-mono text-[10.5px] text-fg-3">{formatNumber(r.coveragePct, 1)}%</div>
        </div>
      ),
      sort: (r) => r.coveragePct,
      csv: (r) => r.coveragePct,
    },
    { key: "inv", header: "Inventory", align: "right", cell: (r) => <span className="k-num font-mono text-[12.5px]">{signedNum(r.inventoryContracts, 0)}</span>, sort: (r) => r.inventoryContracts, csv: (r) => r.inventoryContracts, hideOn: "md" },
    {
      key: "g",
      header: "Δ · Γ · Vega · Θ",
      align: "right",
      cell: (r) => (
        <span className="flex flex-col items-end font-mono text-[11.5px] leading-tight">
          <span className={cn("k-num", r.netDelta >= 0 ? "text-up" : "text-down")}>Δ {signedNum(r.netDelta, 1)}</span>
          <span className="k-num text-fg-2">Γ {signedNum(r.gamma, 1)}</span>
          <span className="k-num text-fg-3">
            V {signedUsdCompact(r.vega)} · Θ {signedUsdCompact(r.theta)}
          </span>
        </span>
      ),
      sort: (r) => Math.abs(r.netDelta),
      csv: (r) => `${r.netDelta}/${r.gamma}/${r.vega}/${r.theta}`,
    },
    {
      key: "lim",
      header: "Limits used",
      cell: (r) => (
        <div className="space-y-0.5">
          <LimitBar label="Δ" value={r.netDelta} limit={r.limits?.maxNetDelta} fmt={(v) => formatNumber(Math.abs(v), 0)} />
          <LimitBar label="Γ" value={r.gamma} limit={r.limits?.maxGamma} fmt={(v) => formatNumber(Math.abs(v), 0)} />
          <LimitBar label="V" value={r.vega} limit={r.limits?.maxVega} fmt={(v) => usd(Math.abs(v))} />
        </div>
      ),
      sort: (r) => Math.max(usage(r.netDelta, r.limits?.maxNetDelta) ?? 0, usage(r.gamma, r.limits?.maxGamma) ?? 0, usage(r.vega, r.limits?.maxVega) ?? 0),
      csv: (r) => `${usage(r.netDelta, r.limits?.maxNetDelta) ?? ""}/${usage(r.gamma, r.limits?.maxGamma) ?? ""}/${usage(r.vega, r.limits?.maxVega) ?? ""}`,
    },
    {
      key: "w",
      header: "Withdrawn",
      align: "right",
      cell: (r) => {
        const list = Array.isArray(r.withdrawnSides) ? r.withdrawnSides : null;
        const n = list ? list.length : typeof r.withdrawnSides === "number" ? r.withdrawnSides : null;
        if (n === null) return <span className="text-[12px] text-fg-3">—</span>;
        if (!n) return <span className="text-[12px] text-fg-3">none</span>;
        const chip = (
          <Chip size="sm" tone="warn">
            {formatNumber(n, 0)} side{n === 1 ? "" : "s"}
          </Chip>
        );
        return list ? <Tooltip content={<span className="font-mono text-[11px]">{list.slice(0, 12).join(", ")}{list.length > 12 ? ` +${list.length - 12}` : ""}</span>}>{chip}</Tooltip> : chip;
      },
      sort: (r) => (Array.isArray(r.withdrawnSides) ? r.withdrawnSides.length : (r.withdrawnSides ?? 0)),
      csv: (r) => (Array.isArray(r.withdrawnSides) ? r.withdrawnSides.length : (r.withdrawnSides ?? "")),
      hideOn: "lg",
    },
    { key: "rq", header: "Requote", cell: (r) => <span className="whitespace-nowrap text-[11.5px] text-fg-3">{agoSecs(r.lastRequoteAt, now)}</span>, sort: (r) => r.lastRequoteAt ?? "", hideOn: "xl" },
    {
      key: "x",
      header: "",
      align: "right",
      cell: (r) => {
        if (!canDeal) return null;
        const p = pauses.find((x) => x.scope === "underlying" && x.target === r.symbol);
        return p ? (
          <Tooltip content={`Resume quoting ${r.symbol}`}>
            <IconButton size="sm" aria-label={`Resume ${r.symbol}`} onClick={(e) => (e.stopPropagation(), onResume(p))}>
              <Play />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip content={`Pause quoting ${r.symbol}`}>
            <IconButton size="sm" aria-label={`Pause ${r.symbol}`} onClick={(e) => (e.stopPropagation(), onPause(r.symbol))}>
              <Pause />
            </IconButton>
          </Tooltip>
        );
      },
    },
  ];
  return <DataTable columns={cols} rows={rows} dense pageSize={20} rowKey={(r) => r.symbol} exportName="options-mm-underlyings" empty={<EmptyState title="Nothing to quote" text="No enabled underlying has listed series." illustration="check_mark_button" />} />;
}

/* ------------------------------------------------------------------ */

function PausesCard({ pauses, loaded, pending, now, canDeal, onResume }: { pauses: MmPause[]; loaded: boolean; pending: boolean; now: number; canDeal: boolean; onResume: (p: MmPause) => void }) {
  return (
    <Card className="h-full pb-5">
      <CardHeader title="Active pauses" subtitle="While paused the MM has no quotes in that scope (cancel-all); client orders are untouched." icon={<Pause />} action={pauses.length ? <Chip tone="warn">{pauses.length} active</Chip> : undefined} />
      <div className="mt-4 space-y-2 px-4 sm:px-6">
        {pending ? (
          <EnginePending what="Pauses" />
        ) : !loaded ? (
          <TableSkeleton rows={2} />
        ) : !pauses.length ? (
          <EmptyState title="No pauses" text="The market maker quotes everything it can within its limits." illustration="check_mark_button" />
        ) : (
          pauses.map((p, i) => (
            <div key={`${p.scope}:${p.target}:${i}`} className="k-row flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Chip size="sm" tone="warn">
                    {p.scope === "all" ? "Everything" : p.scope === "expiry" ? "Expiry" : "Underlying"}
                  </Chip>
                  <span className="font-mono text-[12.5px]">{scopeText(p)}</span>
                </div>
                <div className="mt-0.5 truncate text-[12px] text-fg-3" title={p.reason}>
                  {p.reason} · {p.by} · <span title={when(p.at)}>{ago(p.at, now)}</span>
                </div>
              </div>
              {canDeal && (
                <Button size="xs" variant="surface" onClick={() => onResume(p)}>
                  <Play /> Resume
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function RulesCard({ latency }: { latency: MmState["latency"] }) {
  const items = [
    "Quotes are post-only and firm: the MM never takes liquidity.",
    "No priority, no early view, no last look. Matching knows only price and time; the MM sees the public book and its own orders.",
    "It enters orders through the same path as clients, and every fill records the maker quote, which the nightly replay audit checks again.",
    "Disclosed exemption: as a liquidity provider it may keep quoting until cut − 1 min (clients can't open in the last 15 minutes).",
    `Its in-process latency is published${latency ? ` (now p50 ${fmtUs(latency.p50Us)}, p99 ${fmtUs(latency.p99Us)})` : ""}.`,
  ];
  return (
    <Card className="h-full pb-5">
      <CardHeader title="Same rules as clients" subtitle="What the public MM rules page discloses. Each rule is covered by an engine test." icon={<ShieldCheck />} />
      <ul className="mt-4 space-y-2 px-6 text-[12.5px] leading-relaxed text-fg-2">
        {items.map((t) => (
          <li key={t} className="flex gap-2.5">
            <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-up" />
            {t}
          </li>
        ))}
      </ul>
      <div className="mx-6 mt-3 rounded-[12px] border border-line bg-surface-2/60 px-3 py-2 text-[11.5px] text-fg-3">Kill switches: pause (here), widen (raise the spreads below), and halt / cancel-only on Order books.</div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function PauseDialog({ req, kind, underlyings, onClose, onSaved }: { req: PauseReq | null; kind: string; underlyings: Underlying[]; onClose: () => void; onSaved: () => void }) {
  const enabled = underlyings.filter((u) => u.enabled);
  const [scope, setScope] = React.useState<"all" | "underlying" | "expiry">("all");
  const [sym, setSym] = React.useState("");
  const [expiry, setExpiry] = React.useState("");
  React.useEffect(() => {
    if (!req) return;
    const sc = req.scope ?? "all";
    setScope(sc);
    const t = req.target ?? "";
    setSym(sc === "underlying" ? t : sc === "expiry" ? (t.split(":")[0] ?? "") : (enabled[0]?.symbol ?? ""));
    setExpiry(sc === "expiry" ? (t.split(":")[1] ?? "") : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);
  const exps = useOpt<{ expiries: AdminExpiry[] }>(req && !req.fixed && scope === "expiry" && sym ? `/api/options/expiries?u=${sym}&status=listed&limit=60` : null);
  const listed = React.useMemo(() => [...(exps.data?.expiries ?? [])].sort((a, b) => a.cutAt.localeCompare(b.cutAt)), [exps.data]);
  React.useEffect(() => {
    if (req && !req.fixed && scope === "expiry" && listed.length && !listed.some((e) => e.date === expiry)) setExpiry(listed[0]!.date);
  }, [listed, expiry, scope, req]);
  if (!req) return null;
  const resume = req.mode === "resume";
  const target = scope === "all" ? "*" : scope === "underlying" ? sym : `${sym}:${expiry}`;
  const invalid = scope !== "all" && !sym ? "Choose an underlying" : scope === "expiry" && !expiry ? "Choose an expiry" : null;
  const what = scope === "all" ? `all ${kindLabel(kind)} series` : scope === "underlying" ? sym : `${sym} ${expiry}`;
  return (
    <ReasonDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={resume ? (scope === "all" && req.fixed ? `Resume all ${kindLabel(kind)} quoting` : `Resume quoting · ${what}`) : `Pause the market maker · ${kindLabel(kind)}`}
      description={resume ? (scope === "all" ? "Clears every pause of this kind of account. Quotes come back on the next refresh (within 2 seconds)." : "Quotes in this scope come back on the next refresh (within 2 seconds).") : "The MM cancels all its quotes in the scope at once and stops requoting until resumed. Client orders stay; books in that scope lose their guaranteed two-sided quote."}
      codes={REASONS.mm}
      confirmLabel={resume ? "Resume quoting" : "Pause quoting"}
      confirmVariant={resume ? "ember" : "sell"}
      engine
      disabled={invalid}
      onConfirm={async (reason) => {
        const r = await optSend("POST", `/api/trading/admin/options/mm/${resume ? "resume" : "pause"}`, { kind, scope, target, reason });
        if (r.ok) onSaved();
        return r;
      }}
      success={resume ? `Quoting resumed · ${what}` : `Market maker paused · ${what}`}
    >
      {req.fixed ? (
        <div className="grid grid-cols-2 gap-2 text-[12.5px]">
          <div className="k-row px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-fg-3">Scope</div>
            <div className="mt-0.5 capitalize">{scope}</div>
          </div>
          <div className="k-row px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-fg-3">Applies to</div>
            <div className="mt-0.5 font-mono">{scope === "all" ? "Everything" : target}</div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Scope">
            <Segmented size="sm" value={scope} onChange={setScope} options={[{ value: "all", label: "Everything" }, { value: "underlying", label: "Underlying" }, { value: "expiry", label: "Expiry" }]} />
          </Field>
          {scope !== "all" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Underlying">
                <Select value={sym} onChange={(v) => (setSym(v), setExpiry(""))} label="Underlying" options={enabled.map((u) => ({ value: u.symbol, label: `${u.symbol} · ${u.name}` }))} />
              </Field>
              {scope === "expiry" && (
                <Field label="Expiry">
                  <Select value={expiry} onChange={setExpiry} label="Expiry" disabled={!listed.length} options={listed.length ? listed.map((e) => ({ value: e.date, label: `${e.date} · ${e.kinds.join("/")}` })) : [{ value: "", label: exps.data ? "No listed expiries" : "Loading…" }]} />
                </Field>
              )}
            </div>
          )}
          {scope === "all" && <div className="rounded-[14px] border border-down/30 bg-down-soft px-3.5 py-2.5 text-[12.5px]">Pausing everything leaves every {kindLabel(kind)} book without the MM. Prefer widening the spreads, or pausing one underlying or expiry.</div>}
        </div>
      )}
    </ReasonDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Settings                                                             */
/* ------------------------------------------------------------------ */

type NumKey = "spreadVol0dte" | "spreadVol7d" | "spreadVol30d" | "spreadVolLong" | "minSpreadTicks" | "skewVol" | "skewTicksPerContract" | "baseSize" | "maxNetDelta" | "maxGamma" | "maxVega" | "maxContractsPerSeries";
type Spec = { key: NumKey; label: string; hint: string; suffix: string; scale?: number; max?: number; int?: boolean; min1?: boolean; positive?: boolean };
const SPEC_GROUPS: { title: string; text: string; specs: Spec[] }[] = [
  {
    title: "Spread by tenor",
    text: "Bid at σ − s and ask at σ + s around the smile vol, per tenor bucket.",
    specs: [
      { key: "spreadVol0dte", label: "0DTE", hint: "expires today", suffix: "vol pts", scale: 100, max: 20 },
      { key: "spreadVol7d", label: "≤ 7 days", hint: "", suffix: "vol pts", scale: 100, max: 20 },
      { key: "spreadVol30d", label: "≤ 30 days", hint: "", suffix: "vol pts", scale: 100, max: 20 },
      { key: "spreadVolLong", label: "> 30 days", hint: "", suffix: "vol pts", scale: 100, max: 20 },
    ],
  },
  {
    title: "Quote shape",
    text: "Minimum width, skew against inventory, and the size shown at the top.",
    specs: [
      { key: "minSpreadTicks", label: "Min spread", hint: "bid to ask", suffix: "ticks", int: true, min1: true },
      { key: "skewVol", label: "Vega skew", hint: "× net vega / max vega", suffix: "vol pts", scale: 100, max: 20 },
      { key: "skewTicksPerContract", label: "Inventory skew", hint: "price shift", suffix: "ticks / ct" },
      { key: "baseSize", label: "Base size", hint: "per side, shrinks near limits", suffix: "contracts", int: true, min1: true },
    ],
  },
  {
    title: "Limits",
    text: "A side is withdrawn when filling it would breach one of these.",
    specs: [
      { key: "maxNetDelta", label: "Max net delta", hint: "delta-weighted", suffix: "contracts", positive: true },
      { key: "maxGamma", label: "Max gamma", hint: "Δ per 1 % spot", suffix: "contracts", positive: true },
      { key: "maxVega", label: "Max vega", hint: "per vol point", suffix: "USD", positive: true },
      { key: "maxContractsPerSeries", label: "Max per series", hint: "inventory", suffix: "contracts", positive: true },
    ],
  },
];
const ALL_SPECS = SPEC_GROUPS.flatMap((g) => g.specs);
const isDefault = (r: { tenant: string; kind: string; underlying: string }) => r.tenant === "*" && r.kind === "*" && r.underlying === "*";
const keyOf = (r: { tenant: string; kind: string; underlying: string }) => `${r.tenant}/${r.kind}/${r.underlying}`;
/** most specific first: broker 4, kind 2, underlying 1 */
const specificity = (r: MmSettings) => (r.tenant !== "*" ? 4 : 0) + (r.kind !== "*" ? 2 : 0) + (r.underlying !== "*" ? 1 : 0);

function SettingsCard({ underlyings }: { underlyings: Underlying[] }) {
  const perms = useOptPerms();
  const now = useNow();
  const list = useOpt<{ settings: MmSettings[] }>("/api/options/mm-settings", { refreshMs: 60_000 });
  const tenants = useOpt<{ tenants: TenantSettings[] }>(perms.platform ? "/api/options/tenants" : null);
  const [edit, setEdit] = React.useState<{ row: MmSettings | null } | null>(null);
  const [del, setDel] = React.useState<MmSettings | null>(null);
  const rows = React.useMemo(() => [...(list.data?.settings ?? [])].sort((a, b) => specificity(a) - specificity(b) || keyOf(a).localeCompare(keyOf(b))), [list.data]);
  const canEdit = (r: { tenant: string }) => perms.config && (perms.platform || r.tenant === perms.tenant);
  const block = !perms.config ? "Read-only for your role" : !perms.platform ? "Rows for all brokers are Kalks's; you can add rows for your broker" : null;
  const tenantChoices = React.useMemo(() => Array.from(new Set([perms.tenant, ...(tenants.data?.tenants ?? []).map((t) => t.tenant)])).sort(), [perms.tenant, tenants.data]);
  const def = rows.find(isDefault) ?? null;

  const cols: Column<MmSettings>[] = [
    {
      key: "k",
      header: "Broker · kind · underlying",
      cell: (r) => (
        <span className="flex flex-col">
          <span className="flex flex-wrap items-center gap-1.5 font-mono text-[12.5px]">
            <span className={cn(r.tenant === "*" && "text-ember")}>{tenantLabel(r.tenant)}</span>
            <span className="text-fg-3">·</span>
            <span>{r.kind === "*" ? "live + demo" : r.kind}</span>
            <span className="text-fg-3">·</span>
            <span>{r.underlying === "*" ? "all underlyings" : r.underlying}</span>
          </span>
          {isDefault(r) && <span className="text-[10.5px] text-fg-3">platform default</span>}
        </span>
      ),
      sort: (r) => keyOf(r),
      csv: (r) => keyOf(r),
    },
    {
      key: "sp",
      header: "Spread 0D · 7d · 30d · long",
      cell: (r) => (
        <span className="k-num whitespace-nowrap font-mono text-[12px]">
          ±{volPts(r.spreadVol0dte)} · {volPts(r.spreadVol7d)} · {volPts(r.spreadVol30d)} · {volPts(r.spreadVolLong)}
        </span>
      ),
      sort: (r) => r.spreadVol30d,
      csv: (r) => `${r.spreadVol0dte}/${r.spreadVol7d}/${r.spreadVol30d}/${r.spreadVolLong}`,
    },
    { key: "mt", header: "Min", align: "right", cell: (r) => <span className="k-num font-mono text-[12px]">{formatNumber(r.minSpreadTicks, 0)} t</span>, sort: (r) => r.minSpreadTicks, csv: (r) => r.minSpreadTicks, hideOn: "md" },
    {
      key: "sk",
      header: "Skew",
      align: "right",
      cell: (r) => (
        <span className="k-num whitespace-nowrap font-mono text-[11.5px] text-fg-2">
          {volPts(r.skewVol)} v · {formatNumber(r.skewTicksPerContract, 2)} t/ct
        </span>
      ),
      csv: (r) => `${r.skewVol}/${r.skewTicksPerContract}`,
      hideOn: "lg",
    },
    { key: "bs", header: "Size", align: "right", cell: (r) => <span className="k-num font-mono text-[12px]">{formatNumber(r.baseSize, 0)}</span>, sort: (r) => r.baseSize, csv: (r) => r.baseSize },
    {
      key: "lim",
      header: "Limits Δ · Γ · vega · series",
      cell: (r) => (
        <span className="k-num whitespace-nowrap font-mono text-[11.5px] text-fg-2">
          {formatNumber(r.maxNetDelta, 0)} · {formatNumber(r.maxGamma, 0)} · {usd(r.maxVega)} · {formatNumber(r.maxContractsPerSeries, 0)}
        </span>
      ),
      csv: (r) => `${r.maxNetDelta}/${r.maxGamma}/${r.maxVega}/${r.maxContractsPerSeries}`,
      hideOn: "md",
    },
    {
      key: "e",
      header: "Quoting",
      cell: (r) => (
        <Chip size="sm" tone={r.enabled ? "up" : "down"} dot>
          {r.enabled ? "On" : "Off"}
        </Chip>
      ),
      sort: (r) => (r.enabled ? 1 : 0),
      csv: (r) => (r.enabled ? "on" : "off"),
    },
    { key: "u", header: "Updated", cell: (r) => <span className="whitespace-nowrap text-[11.5px] text-fg-3" title={`${when(r.updatedAt)} · ${r.updatedBy}`}>{ago(r.updatedAt, now)}</span>, sort: (r) => r.updatedAt, hideOn: "xl" },
    {
      key: "x",
      header: "",
      align: "right",
      cell: (r) =>
        canEdit(r) ? (
          <span className="inline-flex gap-1">
            <Button size="xs" variant="surface" onClick={(e) => (e.stopPropagation(), setEdit({ row: r }))}>
              <Pencil /> Edit
            </Button>
            {!isDefault(r) && (
              <Button size="xs" variant="ghost" onClick={(e) => (e.stopPropagation(), setDel(r))} aria-label={`Delete ${keyOf(r)}`}>
                <Trash2 />
              </Button>
            )}
          </span>
        ) : null,
    },
  ];

  return (
    <Card className="pb-5">
      <CardHeader
        title="Quoting settings"
        subtitle="Spreads, skew, size and limits of the MM. The most specific row wins: broker + kind + underlying, …, then the platform default. Changes reach the MM with the next snapshot (seconds)."
        icon={<SlidersHorizontal />}
        action={
          perms.config && (
            <Button size="sm" variant="ember" onClick={() => setEdit({ row: null })}>
              <Plus /> Add override
            </Button>
          )
        }
      />
      <div className="mt-4 px-4 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-fg-3">
          <span className="inline-flex items-center gap-1.5">
            <Scale className="size-3.5" /> Spreads in vol points each side (0.40 = σ ± 0.40). Widening is a kill switch: it takes effect without stopping the MM.
          </span>
          <ReadOnlyHint text={block} />
        </div>
        {list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <TableSkeleton rows={4} />
        ) : (
          <DataTable columns={cols} rows={rows} dense pageSize={20} rowKey={keyOf} onRowClick={(r) => canEdit(r) && setEdit({ row: r })} exportName="options-mm-settings" empty={<EmptyState title="No settings yet" text="The options service seeds a platform default (*, *, *)." illustration="magnifying_glass_tilted_left" />} />
        )}
      </div>
      <SettingsEditor edit={edit} base={def} rows={rows} underlyings={underlyings} tenants={perms.platform ? ["*", ...tenantChoices] : [perms.tenant]} onClose={() => setEdit(null)} onSaved={list.reload} />
      <ReasonDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title={`Delete ${del ? `${tenantLabel(del.tenant)} · ${del.kind === "*" ? "live + demo" : del.kind} · ${del.underlying === "*" ? "all underlyings" : del.underlying}` : ""}`}
        description="The MM falls back to the next matching row at its next requote."
        codes={REASONS.config}
        confirmLabel="Delete override"
        confirmVariant="down-outline"
        onConfirm={async (reason) => {
          const r = await optSend("DELETE", `/api/options/mm-settings/${encodeURIComponent(del!.tenant)}/${encodeURIComponent(del!.kind)}/${encodeURIComponent(del!.underlying)}`, { reason });
          if (r.ok) list.reload();
          return r;
        }}
        success="Override deleted"
      />
    </Card>
  );
}

function SettingsEditor({ edit, base, rows, underlyings, tenants, onClose, onSaved }: { edit: { row: MmSettings | null } | null; base: MmSettings | null; rows: MmSettings[]; underlyings: Underlying[]; tenants: string[]; onClose: () => void; onSaved: () => void }) {
  const [tenant, setTenant] = React.useState("*");
  const [kind, setKind] = React.useState("*");
  const [sym, setSym] = React.useState("*");
  const [vals, setVals] = React.useState<Record<NumKey, string>>({} as Record<NumKey, string>);
  const [enabled, setEnabled] = React.useState(true);
  React.useEffect(() => {
    if (!edit) return;
    const src = edit.row ?? base;
    setTenant(edit.row?.tenant ?? tenants[0] ?? "*");
    setKind(edit.row?.kind ?? "*");
    setSym(edit.row?.underlying ?? "*");
    const v = {} as Record<NumKey, string>;
    for (const s of ALL_SPECS) v[s.key] = src && typeof src[s.key] === "number" ? String(+((src[s.key] as number) * (s.scale ?? 1)).toPrecision(10)) : "";
    setVals(v);
    setEnabled(src?.enabled ?? true);
  }, [edit, base, tenants]);
  if (!edit) return null;
  const isNew = !edit.row;
  const parsed: Partial<Record<NumKey, number>> = {};
  let invalid: string | null = null;
  for (const s of ALL_SPECS) {
    const n = parseNum(vals[s.key] ?? "");
    if (n === null || Number.isNaN(n)) invalid ??= `${s.label}: enter a number`;
    else if (n < 0) invalid ??= `${s.label}: 0 or more`;
    else if (s.max !== undefined && n > s.max) invalid ??= `${s.label}: at most ${s.max} ${s.suffix}`;
    else if (s.int && !Number.isInteger(n)) invalid ??= `${s.label}: a whole number`;
    else if (s.min1 && n < 1) invalid ??= `${s.label}: at least 1`;
    else if (s.positive && !(n > 0)) invalid ??= `${s.label}: above 0`;
    else parsed[s.key] = s.scale ? n / s.scale : n;
  }
  if (isNew && rows.some((r) => r.tenant === tenant && r.kind === kind && r.underlying === sym)) invalid ??= "That broker / kind / underlying already has a row: edit it instead";
  const changed = edit.row ? ALL_SPECS.filter((s) => parsed[s.key] !== undefined && Math.abs((parsed[s.key] as number) - (edit.row![s.key] as number)) > 1e-12).length + (enabled !== edit.row.enabled ? 1 : 0) : 1;
  if (!isNew && !changed) invalid ??= "Nothing changed yet";
  const syms = underlyings.filter((u) => u.enabled).map((u) => u.symbol);
  const title = `${tenantLabel(tenant)} · ${kind === "*" ? "live + demo" : kind} · ${sym === "*" ? "all underlyings" : sym}`;
  return (
    <ReasonDialog
      open
      onOpenChange={(o) => !o && onClose()}
      side="right"
      title={isNew ? "Add an MM override" : `Edit ${title}`}
      description={isNew ? "A new row starts from the platform default." : isDefault(edit.row!) ? "The platform default: every broker, kind and underlying without its own row." : "Applies at the MM's next requote."}
      codes={REASONS.config}
      confirmLabel={isNew ? "Add override" : "Save"}
      disabled={invalid}
      onConfirm={async (reason) => {
        const r = await optSend("PUT", `/api/options/mm-settings/${encodeURIComponent(tenant)}/${encodeURIComponent(kind)}/${encodeURIComponent(sym)}`, { ...parsed, enabled, reason });
        if (r.ok) onSaved();
        return r;
      }}
      success="Market-maker settings saved"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Broker">
            <Select value={tenant} onChange={setTenant} label="Broker" disabled={!isNew} options={tenants.map((t) => ({ value: t, label: tenantLabel(t) }))} />
          </Field>
          <Field label="Accounts">
            <Select value={kind} onChange={setKind} label="Account kind" disabled={!isNew} options={[{ value: "*", label: "Live + demo" }, { value: "live", label: "Live" }, { value: "demo", label: "Demo" }]} />
          </Field>
          <Field label="Underlying">
            <Select value={sym} onChange={setSym} label="Underlying" disabled={!isNew} options={[{ value: "*", label: "All" }, ...syms.map((s) => ({ value: s, label: s }))]} />
          </Field>
        </div>
        {SPEC_GROUPS.map((g) => (
          <div key={g.title}>
            <div className="mb-2.5">
              <div className="text-[13px] font-medium text-fg">{g.title}</div>
              <div className="text-[12px] text-fg-3">{g.text}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {g.specs.map((s) => (
                <Field key={s.key} label={s.label} hint={s.hint || undefined}>
                  <NumInput value={vals[s.key] ?? ""} onChange={(v) => setVals((x) => ({ ...x, [s.key]: v }))} label={s.label} suffix={s.suffix} invalid={Number.isNaN(parseNum(vals[s.key] ?? "") ?? 0)} />
                </Field>
              ))}
            </div>
          </div>
        ))}
        <label className="flex items-center gap-2 text-[12.5px]">
          <Toggle checked={enabled} onChange={setEnabled} label="Quoting enabled" /> Quoting enabled for this scope
        </label>
        {!enabled && <div className="rounded-[14px] border border-warn/30 bg-warn-soft px-3.5 py-2.5 text-[12.5px]">With quoting off the MM leaves these books to clients only. For a temporary stop use Pause instead (it shows on this page and is resumed in one click).</div>}
      </div>
    </ReasonDialog>
  );
}
