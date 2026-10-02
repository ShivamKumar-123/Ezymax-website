"use client";

/**
 * Options › Overview & risk desk (O38): live house Greeks by underlying and hedge status (trading engine option
 * book), a spot × vol scenario P&L matrix computed here from those Greeks, top clients / toxic flow, upcoming expiries
 * with TWAP progress and the options service's health. Refreshes every 5 seconds.
 *
 *   GET /api/trading/admin/options/book?kind=live|demo|all   {underlyings[], topClients[], settlements[], snapshot}
 *   GET /api/options/underlyings          spot, contract size, quote currency (turn delta / gamma into USD)
 *   GET /api/options/expiries?…           settlement monitor rows (TWAP samples so far)
 *   GET /api/options/overview             snapshot version, feed, job heartbeats
 */
import * as React from "react";
import Link from "next/link";
import { Activity, ChartSpline, Clock, Flame, Gauge, RefreshCw, ShieldAlert, Sigma, Timer, TrendingDown } from "lucide-react";
import { Button, Card, CardHeader, Chip, DataTable, DivergingBar, EmptyState, KpiCard, PageHeader, Progress, Reveal, Segmented,  Tooltip, cn, formatNumber, type Column } from "@kalks/ui";
import { ErrorState, TableSkeleton, ago, useNow, when } from "@/components/live/kit";
import type { AdminExpiry, Book, BookClient, BookUnderlying, Overview, Underlying } from "./types";
import { EnginePending, ExpiryStatusChip, UnderlyingCell, countdown, enginePending, signedUsd, signedUsdCompact, useOpt, useOptPerms } from "./kit";

const SPOT_SHOCKS = [-5, -3, -2, -1, -0.5, 0, 0.5, 1, 2, 3, 5];
const VOL_SHOCKS = [5, 2, 1, 0, -1, -2, -5];

/** A book row with delta and gamma in USD: `deltaUsd` = house P&L for +1 % spot, `gammaUsd` = change of that for a
 *  further +1 % (null when the underlying has no price, so it can't be converted). */
export type RiskRow = BookUnderlying & { deltaUsd: number | null; gammaUsd: number | null; spot: number | null; hedgedPct: number | null };

/** USD value of one unit of `quote` from the underlyings' spots (USDJPY → JPY, GBPUSD → GBP …). */
function usdPer(quote: string, us: Underlying[]): number | null {
  if (quote === "USD") return 1;
  const direct = us.find((u) => u.symbol === `${quote}USD`)?.spot?.mid;
  if (direct) return direct;
  const inverse = us.find((u) => u.symbol === `USD${quote}`)?.spot?.mid;
  return inverse ? 1 / inverse : null;
}

/**
 * Engine units → USD. Delta in units of the underlying D (= netDelta × contract size) is worth D·S·1 % per 1 % move;
 * gamma per 1 % (G, in contract deltas) is G·size·S·1 % per 1 %², so a move of x % is worth Δ$·x + ½·Γ$·x².
 */
export function toRiskRows(rows: BookUnderlying[], us: Underlying[]): RiskRow[] {
  return rows.map((r) => {
    const u = us.find((x) => x.symbol === r.symbol);
    const s = u?.spot?.mid ?? null;
    const q = u ? usdPer(u.quoteCcy, us) : null;
    const size = u?.contractSize ?? null;
    const units = r.netDeltaUnits ?? (size !== null ? r.netDelta * size : null);
    const ok = s !== null && q !== null && size !== null && units !== null;
    const hedge = r.hedgeUnits ?? null;
    const after = r.deltaAfterHedgeUnits ?? (units !== null && hedge !== null ? units + hedge : null);
    return {
      ...r,
      spot: s,
      deltaUsd: ok ? units! * s! * 0.01 * q! : null,
      gammaUsd: ok ? r.gamma * size! * s! * 0.01 * q! : null,
      hedgedPct: units && after !== null && Math.abs(units) > 1e-9 ? Math.max(0, Math.min(1, 1 - Math.abs(after) / Math.abs(units))) : null,
    };
  });
}

/** House P&L for a spot move of `ds` % and a vol move of `dv` vol points (+ `days` of theta): Δ·ΔS + ½Γ·ΔS² + vega·Δσ. */
export function scenarioPnl(rows: RiskRow[], ds: number, dv: number, days = 0) {
  return rows.reduce((s, r) => s + (r.deltaUsd ?? 0) * ds + 0.5 * (r.gammaUsd ?? 0) * ds * ds + r.vega * dv + r.theta * days, 0);
}

export function RiskDeskPage() {
  const now = useNow(1000);
  const perms = useOptPerms();
  const [kind, setKind] = React.useState<"live" | "demo" | "all">("live");
  const book = useOpt<Book>(`/api/trading/admin/options/book?kind=${kind}`, { refreshMs: 5000 });
  const unders = useOpt<{ underlyings: Underlying[] }>("/api/options/underlyings", { refreshMs: 15_000 });
  const overview = useOpt<Overview>("/api/options/overview", { refreshMs: 5000 });
  const expiries = useOpt<{ expiries: AdminExpiry[] }>("/api/options/expiries?limit=600", { refreshMs: 5000 });
  const pending = enginePending(book.error);
  const rows = React.useMemo(() => toRiskRows(book.data?.underlyings ?? [], unders.data?.underlyings ?? []).sort((a, b) => Math.abs(b.deltaUsd ?? 0) - Math.abs(a.deltaUsd ?? 0)), [book.data, unders.data]);
  const unpriced = rows.filter((r) => r.deltaUsd === null).map((r) => r.symbol);
  const tot = rows.reduce((s, r) => ({ d: s.d + (r.deltaUsd ?? 0), g: s.g + (r.gammaUsd ?? 0), v: s.v + r.vega, t: s.t + r.theta }), { d: 0, g: 0, v: 0, t: 0 });
  const reload = () => {
    book.reload();
    unders.reload();
    overview.reload();
    expiries.reload();
  };

  return (
    <div className="pb-10">
      <PageHeader
        title="Options risk desk"
        subtitle="House Greeks, hedges and scenario P&L across Kalks FX Options, with the settlement pipeline. Updates every 5 seconds."
        actions={
          <>
            <Segmented size="sm" value={kind} onChange={setKind} options={[{ value: "live", label: "Live" }, { value: "demo", label: "Demo" }, { value: "all", label: "All" }]} />
            <Chip tone={book.error && !pending ? "down" : book.data?.snapshot?.stale ? "warn" : "up"} dot>
              {book.error && !pending ? "Book unavailable" : book.data?.snapshot?.stale ? "Snapshot stale" : "Live · 5 s"}
            </Chip>
            <Button variant="surface" size="lg" onClick={reload}>
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Net delta" icon={<Sigma />} value={pending || !book.data ? "—" : <span className={cn("k-num", tot.d >= 0 ? "text-up" : "text-down")}>{signedUsdCompact(tot.d)}</span>} chip="house P&L per +1 % spot" />
        <KpiCard label="Gamma" icon={<Activity />} value={pending || !book.data ? "—" : <span className={cn("k-num", tot.g >= 0 ? "text-up" : "text-down")}>{signedUsdCompact(tot.g)}</span>} chip="delta change per 1 %" chipTone={tot.g < 0 ? "warn" : "neutral"} delay={0.04} />
        <KpiCard label="Vega" icon={<ChartSpline />} value={pending || !book.data ? "—" : <span className={cn("k-num", tot.v >= 0 ? "text-up" : "text-down")}>{signedUsdCompact(tot.v)}</span>} chip="per +1 vol point" delay={0.08} />
        <KpiCard label="Theta" icon={<Clock />} value={pending || !book.data ? "—" : <span className={cn("k-num", tot.t >= 0 ? "text-up" : "text-down")}>{signedUsdCompact(tot.t)}</span>} chip="per calendar day" chipTone={tot.t > 0 ? "up" : "neutral"} hot delay={0.12} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.05} className="xl:col-span-8">
          <Card className="h-full pb-5">
            <CardHeader title="Greeks by underlying" subtitle={`House side of ${kind === "all" ? "live and demo" : kind} accounts (the house holds the opposite of every client). Delta and gamma in USD at the current spot; hedges are spot CFD positions on the house hedge account.`} icon={<Gauge />} />
            <div className="mt-4 px-4 sm:px-6">
              {pending ? (
                <EnginePending what="Live Greeks and hedge status" />
              ) : book.error ? (
                <ErrorState error={book.error} onRetry={book.reload} />
              ) : !book.data ? (
                <TableSkeleton rows={6} />
              ) : (
                <>
                  <GreeksTable rows={rows} />
                  {unpriced.length > 0 && <div className="mt-2 text-[11.5px] text-warn">No price for {unpriced.join(", ")}: delta and gamma in USD are left out of the totals and the scenarios.</div>}
                </>
              )}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.08} className="xl:col-span-4">
          <ServiceCard overview={overview.data} error={overview.error} now={now} engine={book.data?.snapshot ?? null} />
        </Reveal>
      </div>

      <Reveal delay={0.1} className="mt-4">
        <ScenarioCard rows={rows} pending={pending} loaded={!!book.data} />
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.12} className="xl:col-span-6">
          <TopClients clients={book.data?.topClients ?? []} pending={pending} loaded={!!book.data} canLimit={perms.dealing} />
        </Reveal>
        <Reveal delay={0.14} className="xl:col-span-6">
          <UpcomingExpiries list={expiries.data?.expiries ?? null} error={expiries.error} now={now} />
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function hedgeStatus(r: RiskRow): { label: string; tone: "up" | "warn" | "neutral" | "info"; text: string } {
  const residual = r.deltaAfterHedgeUnits !== undefined ? ` · residual delta ${formatNumber(r.deltaAfterHedgeUnits, 2)} units` : "";
  if (r.hedgeContracts !== 0) {
    const pct = r.hedgedPct !== null ? `${Math.round(r.hedgedPct * 100)}%` : "Hedged";
    return { label: r.hedgedPct !== null ? `Hedged ${pct}` : "Hedged", tone: r.hedgedPct !== null && r.hedgedPct < 0.5 ? "warn" : "up", text: `${r.hedgeContracts > 0 ? "Long" : "Short"} ${formatNumber(Math.abs(r.hedgeContracts), 2)} contracts of spot on the hedge account${residual}` };
  }
  if (Math.abs(r.netDelta) < 0.5) return { label: "Flat", tone: "neutral", text: "Net delta under half a contract: no hedge needed" };
  return { label: "Unhedged", tone: "warn", text: `Below the auto-hedge limit, or hedging is off for this underlying${residual}` };
}

function GreeksTable({ rows }: { rows: RiskRow[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.deltaUsd ?? 0)));
  const cols: Column<RiskRow>[] = [
    { key: "s", header: "Underlying", cell: (r) => <UnderlyingCell symbol={r.symbol} size={24} sub={`${r.clients} clients`} />, sort: (r) => r.symbol, csv: (r) => r.symbol },
    {
      key: "d",
      header: "Net Δ ($/1 %)",
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <DivergingBar value={r.deltaUsd ?? 0} max={max} className="w-16 shrink-0" />
          <span className="flex w-20 flex-col items-end">
            <span className={cn("k-num font-mono text-[12.5px]", r.deltaUsd === null ? "text-fg-3" : r.deltaUsd >= 0 ? "text-up" : "text-down")}>{r.deltaUsd === null ? "no price" : signedUsdCompact(r.deltaUsd)}</span>
            <span className="k-num font-mono text-[10.5px] text-fg-3" title="Delta-weighted contracts">
              {r.netDelta > 0 ? "+" : ""}
              {formatNumber(r.netDelta, 2)} ct
            </span>
          </span>
        </div>
      ),
      sort: (r) => r.deltaUsd ?? 0,
      csv: (r) => r.deltaUsd ?? "",
    },
    { key: "g", header: "Γ ($/1 %²)", align: "right", cell: (r) => (r.gammaUsd === null ? <span className="text-[12px] text-fg-3">—</span> : <Greek v={r.gammaUsd} />), sort: (r) => r.gammaUsd ?? 0, csv: (r) => r.gammaUsd ?? "" },
    { key: "v", header: "Vega ($/vol)", align: "right", cell: (r) => <Greek v={r.vega} />, sort: (r) => r.vega, csv: (r) => r.vega },
    { key: "t", header: "Θ ($/day)", align: "right", cell: (r) => <Greek v={r.theta} />, sort: (r) => r.theta, csv: (r) => r.theta, hideOn: "md" },
    {
      key: "ls",
      header: "Long / short",
      align: "right",
      cell: (r) => (
        <span className="k-num font-mono text-[12px] text-fg-2">
          {formatNumber(r.longContracts, 0)} / {formatNumber(r.shortContracts, 0)}
        </span>
      ),
      sort: (r) => r.longContracts + r.shortContracts,
      csv: (r) => `${r.longContracts}/${r.shortContracts}`,
      hideOn: "lg",
    },
    {
      key: "h",
      header: "Hedge",
      cell: (r) => {
        const h = hedgeStatus(r);
        return (
          <Tooltip content={h.text}>
            <span className="inline-flex items-center gap-1.5">
              <Chip size="sm" tone={h.tone} dot>
                {h.label}
              </Chip>

            </span>
          </Tooltip>
        );
      },
      sort: (r) => r.hedgeContracts,
      csv: (r) => r.hedgeContracts,
    },
  ];
  return <DataTable columns={cols} rows={rows} dense pageSize={20} rowKey={(r) => r.symbol} exportName="options-greeks" empty={<EmptyState title="No open options" text="The house has no option positions right now." illustration="check_mark_button" />} />;
}

function Greek({ v }: { v: number }) {
  return <span className={cn("k-num font-mono text-[12.5px]", v > 0 ? "text-up" : v < 0 ? "text-down" : "text-fg-3")}>{signedUsdCompact(v)}</span>;
}

/* ------------------------------------------------------------------ */

function ScenarioCard({ rows, pending, loaded }: { rows: RiskRow[]; pending: boolean; loaded: boolean }) {
  const [sym, setSym] = React.useState("all");
  const [horizon, setHorizon] = React.useState<"now" | "1d">("now");
  const sel = sym === "all" ? rows : rows.filter((r) => r.symbol === sym);
  const days = horizon === "1d" ? 1 : 0;
  const grid = VOL_SHOCKS.map((dv) => SPOT_SHOCKS.map((ds) => scenarioPnl(sel, ds, dv, days)));
  const max = Math.max(1, ...grid.flat().map(Math.abs));
  const worst = Math.min(...grid.flat());
  const best = Math.max(...grid.flat());
  const symbols = rows.map((r) => r.symbol);
  React.useEffect(() => {
    if (sym !== "all" && rows.length && !symbols.includes(sym)) setSym("all");
  }, [sym, rows.length, symbols]);

  return (
    <Card className="pb-5">
      <CardHeader
        title="Scenario P&L"
        subtitle="House P&L for a spot move (columns) and a parallel vol move (rows), from the live Greeks: Δ·ΔS + ½Γ·ΔS² + vega·Δσ. A second-order estimate: large moves and barriers need the full revaluation the margin engine runs."
        icon={<TrendingDown />}
        action={
          <>
            <select value={sym} onChange={(e) => setSym(e.target.value)} aria-label="Underlying" className="h-8 rounded-full border border-line bg-surface-2 px-3 text-[12.5px] text-fg outline-none">
              <option value="all">All underlyings</option>
              {symbols.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Segmented size="xs" value={horizon} onChange={setHorizon} options={[{ value: "now", label: "Now" }, { value: "1d", label: "+1 day (θ)" }]} />
          </>
        }
      />
      <div className="mt-4 px-4 sm:px-6">
        {pending ? (
          <EnginePending what="The scenario matrix" />
        ) : !loaded ? (
          <TableSkeleton rows={7} />
        ) : !sel.length ? (
          <EmptyState title="No open options" text="Nothing to stress." illustration="check_mark_button" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-separate border-spacing-1 text-[12px]">
                <thead>
                  <tr>
                    <th className="w-24 text-left text-[10.5px] font-medium uppercase tracking-[0.05em] text-fg-3">Vol ↓ · Spot →</th>
                    {SPOT_SHOCKS.map((ds) => (
                      <th key={ds} className={cn("k-num pb-1 text-center font-mono text-[11px] font-medium", ds === 0 ? "text-fg" : "text-fg-3")}>
                        {ds > 0 ? "+" : ""}
                        {ds}%
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {VOL_SHOCKS.map((dv, i) => (
                    <tr key={dv}>
                      <th className={cn("k-num pr-2 text-left font-mono text-[11px] font-medium", dv === 0 ? "text-fg" : "text-fg-3")}>
                        {dv > 0 ? "+" : ""}
                        {dv} vol
                      </th>
                      {SPOT_SHOCKS.map((ds, j) => {
                        const v = grid[i]![j]!;
                        const a = Math.round((Math.abs(v) / max) * 46);
                        const centre = ds === 0 && dv === 0;
                        return (
                          <td
                            key={ds}
                            title={`Spot ${ds > 0 ? "+" : ""}${ds}%, vol ${dv > 0 ? "+" : ""}${dv}: ${signedUsd(v)}`}
                            className={cn("k-num h-9 rounded-[8px] text-center font-mono text-[11.5px]", v > 0 ? "text-up" : v < 0 ? "text-down" : "text-fg-3", centre && "ring-1 ring-fg-3/50")}
                            style={{ background: v === 0 ? undefined : `color-mix(in srgb, var(${v > 0 ? "--k-up" : "--k-down"}) ${a}%, transparent)` }}
                          >
                            {signedUsdCompact(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-fg-3">
              <span>
                Worst <span className="k-num font-mono text-down">{signedUsd(worst)}</span>
              </span>
              <span>
                Best <span className={cn("k-num font-mono", best >= 0 ? "text-up" : "text-down")}>{signedUsd(best)}</span>
              </span>
              <span>Greeks in USD: delta per 1 % spot, gamma per 1 %², vega per vol point, theta per day.</span>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function TopClients({ clients, pending, loaded, canLimit }: { clients: BookClient[]; pending: boolean; loaded: boolean; canLimit: boolean }) {
  // toxic-flow flag: a winner whose P&L per contract is well above the desk's median, or winning big today
  const perC = clients.filter((c) => c.contracts > 0).map((c) => c.pnl / c.contracts).sort((a, b) => a - b);
  const median = perC.length ? perC[Math.floor(perC.length / 2)]! : 0;
  const flag = (c: BookClient) => c.pnl > 0 && c.contracts > 0 && (c.pnl / c.contracts > Math.max(40, 3 * Math.abs(median)) || c.todayPnl > Math.max(5000, c.pnl * 0.3));
  const cols: Column<BookClient>[] = [
    {
      key: "c",
      header: "Client",
      cell: (c) => (
        <span className="flex flex-col">
          <Link href={`/clients/${c.userId}`} className="font-mono text-[12.5px] font-medium hover:text-ember" onClick={(e) => e.stopPropagation()}>
            #{c.userId}
          </Link>
          <span className="font-mono text-[10.5px] text-fg-3">login {c.login}</span>
        </span>
      ),
      sort: (c) => c.userId,
      csv: (c) => c.userId,
    },
    { key: "p", header: "Client P&L", align: "right", cell: (c) => <span className={cn("k-num font-mono text-[12.5px]", c.pnl >= 0 ? "text-up" : "text-down")}>{signedUsd(c.pnl)}</span>, sort: (c) => c.pnl, csv: (c) => c.pnl },
    { key: "t", header: "Today", align: "right", cell: (c) => <span className={cn("k-num font-mono text-[12px]", c.todayPnl >= 0 ? "text-up" : "text-down")}>{signedUsd(c.todayPnl)}</span>, sort: (c) => c.todayPnl, csv: (c) => c.todayPnl },
    { key: "n", header: "Contracts", align: "right", cell: (c) => <span className="k-num font-mono text-[12px] text-fg-2">{formatNumber(c.contracts, 0)}</span>, sort: (c) => c.contracts, csv: (c) => c.contracts, hideOn: "sm" },
    {
      key: "f",
      header: "Flow",
      cell: (c) =>
        flag(c) ? (
          <span className="inline-flex items-center gap-1.5">
            <Chip size="sm" tone="down">
              <Flame className="size-3" /> Watch
            </Chip>
            {canLimit && (
              <Link href={`/options/controls?limit=${c.userId}`} className="text-[11.5px] text-fg-3 underline-offset-2 hover:text-ember hover:underline">
                Set limit
              </Link>
            )}
          </span>
        ) : (
          <span className="text-[11.5px] text-fg-3">Normal</span>
        ),
      sort: (c) => (flag(c) ? 1 : 0),
      csv: (c) => (flag(c) ? "watch" : "normal"),
    },
  ];
  return (
    <Card className="h-full pb-5">
      <CardHeader title="Top clients & toxic flow" subtitle="Biggest option P&L against the house. “Watch” = P&L per contract far above the desk median, or a large win today." icon={<ShieldAlert />} />
      <div className="mt-4 px-4 sm:px-6">
        {pending ? (
          <EnginePending what="Client P&L and toxic-flow flags" />
        ) : !loaded ? (
          <TableSkeleton rows={5} />
        ) : (
          <DataTable columns={cols} rows={clients} dense pageSize={10} rowKey={(c) => String(c.userId)} exportName="options-top-clients" empty={<EmptyState title="No client positions" illustration="check_mark_button" />} />
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function UpcomingExpiries({ list, error, now }: { list: AdminExpiry[] | null; error: { code: string; message: string } | null; now: number }) {
  const upcoming = React.useMemo(
    () =>
      (list ?? [])
        .filter((e) => e.status === "fixing" || (e.status === "listed" && Date.parse(e.cutAt) > now - 5 * 60_000))
        .sort((a, b) => a.cutAt.localeCompare(b.cutAt))
        .slice(0, 10),
    [list, now],
  );
  return (
    <Card className="h-full pb-5">
      <CardHeader
        title="Upcoming expiries"
        subtitle="Next cuts with the TWAP fixing window (1-second mids over the last 30 minutes)."
        icon={<Timer />}
        action={
          <Link href="/options/settlements" className="text-[12.5px] text-fg-3 hover:text-fg">
            Settlement monitor →
          </Link>
        }
      />
      <div className="mt-4 space-y-2 px-4 sm:px-6">
        {error ? (
          <ErrorState error={error} />
        ) : !list ? (
          <TableSkeleton rows={5} />
        ) : !upcoming.length ? (
          <EmptyState title="No expiries listed" text="Run the listing from Underlyings & series." illustration="calendar" />
        ) : (
          upcoming.map((e) => <ExpiryRow key={e.id} e={e} now={now} />)
        )}
      </div>
    </Card>
  );
}

export function twapProgress(e: AdminExpiry, now: number) {
  const start = Date.parse(e.twapStart);
  const cut = Date.parse(e.cutAt);
  const window = Math.max(1, (cut - start) / 1000);
  const elapsed = Math.max(0, Math.min(window, (now - start) / 1000));
  return { running: now >= start && now < cut, pct: (elapsed / window) * 100, coverage: elapsed > 5 ? Math.min(1, e.samplesSoFar / elapsed) : null, window };
}

function ExpiryRow({ e, now }: { e: AdminExpiry; now: number }) {
  const t = twapProgress(e, now);
  const cov = t.coverage;
  return (
    <div className="k-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[12.5px] font-medium">{e.symbol}</span>
          <span className="text-[12px] text-fg-2">{e.date}</span>
          {e.kinds.map((k) => (
            <Chip key={k} size="sm">
              {k}
            </Chip>
          ))}
          <ExpiryStatusChip status={e.status} running={t.running} />
        </div>
        {t.running || e.status === "fixing" ? (
          <div className="mt-2 flex items-center gap-2">
            <Progress value={t.pct} tone={cov !== null && cov < 0.5 ? "down" : cov !== null && cov < 0.9 ? "warn" : "up"} className="flex-1" />
            <span className="k-num w-28 text-right font-mono text-[11px] text-fg-3">
              {e.samplesSoFar} / {Math.round(t.window)} · {cov === null ? "—" : `${Math.round(cov * 100)}%`}
            </span>
          </div>
        ) : (
          <div className="mt-0.5 text-[11.5px] text-fg-3">
            TWAP from {when(e.twapStart)} · {e.series} series
          </div>
        )}
      </div>
      <div className="text-right">
        <div className={cn("k-num font-mono text-[12.5px]", Date.parse(e.cutAt) - now < 3600_000 ? "text-warn" : "text-fg-2")}>{Date.parse(e.cutAt) > now ? countdown(e.cutAt, now) : "cut passed"}</div>
        <div className="text-[10.5px] text-fg-3">to the cut</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const JOB_LABEL: Record<string, string> = { listing: "Listing", fixing: "Fixings & TWAP", marks_eod: "EOD marks", refdata: "Reference data", realized_vol: "Realized vol" };

function ServiceCard({ overview, error, now, engine }: { overview: Overview | null; error: { code: string; message: string } | null; now: number; engine: Book["snapshot"] | null }) {
  return (
    <Card className="h-full pb-5">
      <CardHeader title="Options service" subtitle="Reference data and fixings (services/options). The engine prices from its snapshot." icon={<Activity />} />
      <div className="mt-4 space-y-3 px-6">
        {error ? (
          <ErrorState error={error} />
        ) : !overview ? (
          <TableSkeleton rows={4} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Tile label="Snapshot" value={`v${overview.version}`} />
              <Tile label="Price feed" value={overview.feedConnected ? "Connected" : "Polling REST"} tone={overview.feedConnected ? "up" : "warn"} />
              <Tile label="Underlyings" value={String(overview.underlyings)} />
              <Tile label="Listed expiries" value={String(overview.expiries)} />
              <Tile label="Active series" value={formatNumber(overview.series, 0)} />
              <Tile label="Dealer controls" value={String(overview.controls)} tone={overview.controls ? "warn" : undefined} href="/options/controls" />
            </div>
            {engine && (
              <div className={cn("rounded-[12px] border px-3 py-2 text-[12px]", engine.stale ? "border-down/30 bg-down-soft" : engine.version !== overview.version ? "border-warn/30 bg-warn-soft" : "border-line bg-surface-2/60")}>
                Engine prices from snapshot <span className="font-mono">v{engine.version ?? "—"}</span>
                {engine.stale ? " · stale: options are close-only until it refreshes" : engine.version !== overview.version ? ` · catching up with v${overview.version}` : " · in sync"}
                {engine.lastOkAt && <span className="text-fg-3"> · fetched {ago(engine.lastOkAt, now)}</span>}
              </div>
            )}
            {overview.awaitingFixing > 0 && (
              <div className="rounded-[12px] border border-warn/30 bg-warn-soft px-3 py-2 text-[12px] text-fg">
                {overview.awaitingFixing} expir{overview.awaitingFixing === 1 ? "y is" : "ies are"} waiting for a fixing.
              </div>
            )}
            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-[0.05em] text-fg-3">Jobs</div>
              <div className="space-y-1">
                {Object.entries(overview.jobs).map(([k, at]) => (
                  <div key={k} className="flex items-center justify-between text-[12px]">
                    <span className="text-fg-2">{JOB_LABEL[k] ?? k}</span>
                    <span className="k-num text-fg-3" title={when(at, true)}>
                      {ago(at, now)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11.5px]">
              <Chip size="sm" tone={overview.tenant.enabledDemo ? "up" : "neutral"}>
                Demo {overview.tenant.enabledDemo ? "on" : "off"}
              </Chip>
              <Chip size="sm" tone={overview.tenant.enabledLive ? "down" : "neutral"}>
                Live {overview.tenant.enabledLive ? "on" : "off"}
              </Chip>
              <Chip size="sm" tone={overview.tenant.publicChain ? "info" : "neutral"}>
                Public chain {overview.tenant.publicChain ? "on" : "off"}
              </Chip>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function Tile({ label, value, tone, href }: { label: string; value: string; tone?: "up" | "warn" | "down"; href?: string }) {
  const body = (
    <div className={cn("k-row px-3 py-2", href && "transition-colors hover:bg-surface-3/60")}>
      <div className="text-[10px] uppercase tracking-wider text-fg-3">{label}</div>
      <div className={cn("k-num mt-0.5 truncate font-mono text-[13px]", tone === "up" && "text-up", tone === "warn" && "text-warn", tone === "down" && "text-down")}>{value}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

