"use client";

/**
 * Options › Order books (docs/OPTIONS-EXCHANGE.md §1, §10, §12, decision O49): the engine's book actors per
 * underlying (one per broker × account kind × underlying). Monitor every 5 seconds (state, journal seq, resting
 * orders, MM coverage, spreads, OI, volume, outbox lag, clearing that must be 0, the nightly replay audit), the kill
 * switches (halt / cancel-only per series, expiry, underlying or everything) and an audited drill-down into one
 * series' depth WITH OWNERS and its recent fills (bust a fill from there: four-eyes).
 *
 *   GET    /api/trading/admin/options/books?kind=live|demo
 *          { kind, enabled, enabledAt?, replay?: {ok, at, mismatches}, books: [{ underlying, state: open|cancel_only|
 *            halted|closed, seq, restingOrders, restingContracts, clientOrders, mmCoveragePct, seriesQuoted, seriesTotal,
 *            avgSpreadTicks, oi, volume, volumeUsd?, outbox: {pending, failed, oldestMs}, clearingUsd, lastTradeAt }],
 *            halts: [{ id, scope, target, mode, reason, by, at }] }
 *   POST   /api/trading/admin/options/books/halt {kind, scope: all|underlying|expiry|series, target, mode: halt|cancel_only,
 *          reason} → { halt }       (target: `*`, `EURUSD`, `EURUSD:2026-10-09` or a series code)
 *   DELETE /api/trading/admin/options/books/halt/{id} {reason} → { ok }
 *   GET    /api/trading/admin/options/books/{series}?kind=   (options.dealing; the engine logs who looked at which series)
 *          { series, kind, seq, state, mark, theo, premiumTick, usdPerUnit?, bids: [{ price, qty, orders: [{ id, login,
 *            userId, name?, qty, left, at, flags: string[], mm }] }], asks: same, trades: [{ fillId, price, qty,
 *            takerSide, kind: book|rfq|liquidation|backstop|novation, at, maker: {login, mm}, taker: {login, mm},
 *            busted? }], audited: true }
 *          (prices per unit in the quote currency; × usdPerUnit = USD per contract)
 *   GET    /api/options/expiries?u=&status=listed, /api/options/chain?u=&expiry=   the series picker
 */
import * as React from "react";
import Link from "next/link";
import { ArrowRight, Ban, BookOpenCheck, Eye, Gavel, Layers, OctagonPause, RefreshCw, ScrollText, ShieldCheck, Timer, Undo2, Wallet } from "lucide-react";
import { Button, Card, CardHeader, Chip, DataTable, Dialog, DialogClose, EmptyState, Field, IconButton, Input, KpiCard, PageHeader, Progress, Reveal, Segmented, Tooltip, cn, formatNumber, type Column } from "@kalks/ui";
import { ErrorState, TableSkeleton, ago, useNow, when } from "@/components/live/kit";
import type { AdminExpiry, BookHalt, BookRow, BookTrade, BooksMonitor, Chain, DepthLevel, HaltScope, SeriesDepth, Underlying } from "./types";
import { BookStateChip, EnginePending, KIND_OPTIONS, LoginLink, REASONS, ReasonDialog, Select, UnderlyingCell, agoSecs, enginePending, kindLabel, optSend, usd, useKind, useOpt, useOptPerms } from "./kit";
import { ApprovalsPanel, Fact, FillBustDialog, FillKindChip, type BustTarget } from "./fill-bust";

const SERIES_RE = /^[A-Z0-9]{3,12}-\d{8}-[0-9.]{1,16}-[CP](-[A-Z0-9._]{1,24})?$/;
const SCOPE_LABEL: Record<string, string> = { all: "Everything", underlying: "Underlying", expiry: "Expiry", series: "Series" };
const HALT_MODE: Record<string, { label: string; tone: "down" | "warn"; text: string }> = {
  halt: { label: "Halt", tone: "down", text: "The book freezes as it is: no new orders, no amends or cancels, no matching. For a price or system error." },
  cancel_only: { label: "Cancel-only", tone: "warn", text: "Resting orders can be cancelled; nothing new is accepted and nothing matches. The gentler kill switch." },
};
const LAG_WARN_MS = 2000;

/** Digits a premium tick needs (0.00001 → 5, 0.0025 → 4). */
export function tickDigits(tick: number | null | undefined) {
  if (!tick || !Number.isFinite(tick) || tick <= 0) return 6;
  for (let d = 0; d <= 10; d++) if (Math.abs(Math.round(tick * 10 ** d) - tick * 10 ** d) < 1e-7) return d;
  return 10;
}

type HaltReq = { scope: HaltScope; target?: string; mode: "halt" | "cancel_only" };

export function BooksPage() {
  const perms = useOptPerms();
  const now = useNow(1000);
  const [kind, setKind] = useKind();
  const mon = useOpt<BooksMonitor>(`/api/trading/admin/options/books?kind=${kind}`, { refreshMs: 5000 });
  const unders = useOpt<{ underlyings: Underlying[] }>("/api/options/underlyings");
  const [halt, setHalt] = React.useState<HaltReq | null>(null);
  const [clearing, setClearing] = React.useState<BookHalt | null>(null);
  const [depth, setDepth] = React.useState<{ underlying?: string; series?: string } | null>(null);
  const [bust, setBust] = React.useState<BustTarget | null>(null);
  const [bustTick, setBustTick] = React.useState(0);
  const pending = enginePending(mon.error);
  const d = mon.data && (mon.data.kind === kind || !mon.data.kind) ? mon.data : null;
  const books = React.useMemo(() => [...(d?.books ?? [])].sort((a, b) => a.underlying.localeCompare(b.underlying)), [d]);
  const halts = d?.halts ?? [];
  const enabled = d?.enabled ?? null;
  const loaded = !!d && !pending;

  const open = books.filter((b) => b.state === "open").length;
  const totalSeries = books.reduce((n, b) => n + (b.seriesTotal ?? 0), 0);
  const coverage = totalSeries ? books.reduce((n, b) => n + (b.mmCoveragePct ?? 0) * (b.seriesTotal ?? 0), 0) / totalSeries : null;
  const lagMax = Math.max(0, ...books.map((b) => b.outbox?.oldestMs ?? 0));
  const outPending = books.reduce((n, b) => n + (b.outbox?.pending ?? 0), 0);
  const outFailed = books.reduce((n, b) => n + (b.outbox?.failed ?? 0), 0);
  const clearingAbs = books.reduce((n, b) => n + Math.abs(b.clearingUsd ?? 0), 0);
  const clearingOff = books.filter((b) => Math.abs(b.clearingUsd ?? 0) >= 0.005);
  const replay = d?.replay ?? null;

  return (
    <div className="pb-10">
      <PageHeader
        title="Order books"
        subtitle="Every underlying's book actor: state, journal sequence, resting orders, market-maker coverage, outbox and clearing. Updates every 5 seconds."
        actions={
          <>
            <Segmented size="sm" value={kind} onChange={setKind} options={KIND_OPTIONS} />
            {replay && (
              <Tooltip content={replay.at ? `Nightly book-replay re-ran the journal byte for byte · ${when(replay.at)}` : "Nightly book-replay"}>
                <span>
                  <Chip tone={replay.ok && !replay.mismatches ? "up" : "down"} dot>
                    {replay.ok && !replay.mismatches ? "Replay audit OK" : `Replay mismatch · ${formatNumber(replay.mismatches ?? 0, 0)}`}
                  </Chip>
                </span>
              </Tooltip>
            )}
            <Chip tone={mon.error && !pending ? "down" : "up"} dot>
              {mon.error && !pending ? "Engine unavailable" : pending ? "Engine update pending" : "Live · 5 s"}
            </Chip>
            <Button variant="surface" size="lg" onClick={mon.reload}>
              <RefreshCw /> Refresh
            </Button>
            {perms.dealing && enabled && (
              <>
                <Button variant="surface" size="lg" onClick={() => setDepth({})}>
                  <Eye /> Depth & owners
                </Button>
                <Button variant="sell" size="lg" onClick={() => setHalt({ scope: "underlying", mode: "halt" })}>
                  <OctagonPause /> Halt…
                </Button>
              </>
            )}
          </>
        }
      />

      {enabled === false && !pending ? (
        <Reveal>
          <Card className="px-4 py-5 sm:px-6">
            <EmptyState
              title={`The order book isn't enabled for ${kindLabel(kind)} accounts`}
              text="Options on these accounts still trade against the house. The rollout (four-eyes, forward-only) starts the book actors and the market maker and novates open positions."
              illustration="rocket"
              action={
                <Link href={`/options/book-enable?kind=${kind}`}>
                  <Button variant="ember" size="sm">
                    Book rollout <ArrowRight />
                  </Button>
                </Link>
              }
            />
          </Card>
        </Reveal>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-5">
            <KpiCard label="Books open" icon={<BookOpenCheck />} value={loaded ? <span className="k-num">{`${open} / ${books.length}`}</span> : "—"} chip={loaded ? `${books.filter((b) => b.state === "halted").length} halted · ${books.filter((b) => b.state === "cancel_only").length} cancel-only` : "per underlying"} chipTone={loaded && open < books.length ? "warn" : "neutral"} />
            <KpiCard label="Resting orders" icon={<Layers />} value={loaded ? <span className="k-num">{formatNumber(books.reduce((n, b) => n + b.restingOrders, 0), 0)}</span> : "—"} chip={loaded ? `${formatNumber(books.reduce((n, b) => n + b.restingContracts, 0), 0)} contracts · ${formatNumber(books.reduce((n, b) => n + b.clientOrders, 0), 0)} client orders` : "orders on the books"} delay={0.04} />
            <KpiCard label="MM coverage" icon={<ShieldCheck />} value={loaded && coverage !== null ? <span className="k-num">{formatNumber(coverage, 1)}%</span> : "—"} chip="listed series quoted by the MM" chipTone={coverage === null ? "neutral" : coverage >= 95 ? "up" : coverage >= 80 ? "warn" : "down"} delay={0.08} />
            <KpiCard label="Outbox lag" icon={<Timer />} value={loaded ? <span className={cn("k-num", outFailed ? "text-down" : lagMax > LAG_WARN_MS ? "text-warn" : undefined)}>{lagMax ? `${formatNumber(lagMax, 0)} ms` : "0 ms"}</span> : "—"} chip={loaded ? `${outPending} pending · ${outFailed} failed` : "fills not yet applied"} chipTone={outFailed ? "down" : lagMax > LAG_WARN_MS ? "warn" : "up"} delay={0.12} />
            <KpiCard label="Clearing" icon={<Wallet />} value={loaded ? <span className={cn("k-num", clearingOff.length ? "text-down" : "text-up")}>{usd(clearingAbs, 2)}</span> : "—"} chip={clearingOff.length ? `must be 0 · ${clearingOff.length} off` : "must be 0 · balanced"} chipTone={clearingOff.length ? "down" : "up"} delay={0.16} />
          </div>

          <Reveal delay={0.05} className="mt-4">
            <Card className="px-4 py-5 sm:px-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[15px] font-medium">Books by underlying</div>
                <span className="text-[12px] text-fg-3">{d?.enabledAt ? `On the book since ${when(d.enabledAt)}` : ""}</span>
              </div>
              {pending ? (
                <EnginePending what="The order-book monitor" />
              ) : mon.error ? (
                <ErrorState error={mon.error} onRetry={mon.reload} />
              ) : !d ? (
                <TableSkeleton rows={8} />
              ) : (
                <BooksTable
                  rows={books}
                  now={now}
                  canDeal={perms.dealing}
                  onHalt={(u, mode) => setHalt({ scope: "underlying", target: u, mode })}
                  onDepth={(u) => setDepth({ underlying: u })}
                />
              )}
            </Card>
          </Reveal>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Reveal delay={0.08} className="xl:col-span-7">
              <HaltsCard halts={halts} loaded={loaded} pending={pending} now={now} canDeal={perms.dealing} onClear={setClearing} onNew={perms.dealing && enabled ? () => setHalt({ scope: "expiry", mode: "cancel_only" }) : undefined} />
            </Reveal>
            <Reveal delay={0.1} className="xl:col-span-5">
              <ApprovalsPanel actions={["fill_bust"]} refreshKey={bustTick} className="h-full" />
            </Reveal>
          </div>
        </>
      )}

      <HaltDialog req={halt} kind={kind} underlyings={unders.data?.underlyings ?? []} onClose={() => setHalt(null)} onSaved={mon.reload} />
      <ReasonDialog
        open={!!clearing}
        onOpenChange={(o) => !o && setClearing(null)}
        title={`Clear ${clearing ? (HALT_MODE[clearing.mode]?.label ?? clearing.mode).toLowerCase() : ""} · ${clearing ? (clearing.scope === "all" ? "everything" : clearing.target) : ""}`}
        description="Matching and order entry resume in this scope at once (other halts still apply). Resting orders outside the band against the current mark are cancelled by the open check."
        codes={REASONS.book}
        confirmLabel="Clear"
        engine
        onConfirm={async (reason) => {
          const r = await optSend("DELETE", `/api/trading/admin/options/books/halt/${clearing!.id}`, { reason });
          if (r.ok) mon.reload();
          return r;
        }}
        success="Kill switch cleared"
      />
      <DepthDialog
        req={depth}
        kind={kind}
        underlyings={unders.data?.underlyings ?? []}
        canBust={perms.settle}
        bustTick={bustTick}
        onClose={() => setDepth(null)}
        onBust={(t, series) => setBust({ fillId: t.fillId, trade: { ...t, series } })}
      />
      <FillBustDialog target={bust} onClose={() => setBust(null)} onDone={() => setBustTick((n) => n + 1)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function BooksTable({ rows, now, canDeal, onHalt, onDepth }: { rows: BookRow[]; now: number; canDeal: boolean; onHalt: (u: string, mode: "halt" | "cancel_only") => void; onDepth: (u: string) => void }) {
  const cols: Column<BookRow>[] = [
    { key: "u", header: "Underlying", cell: (b) => <UnderlyingCell symbol={b.underlying} size={24} sub={<span className="font-mono">seq {formatNumber(b.seq, 0)}</span>} />, sort: (b) => b.underlying, csv: (b) => b.underlying },
    { key: "st", header: "State", cell: (b) => <BookStateChip state={b.state} />, sort: (b) => b.state, csv: (b) => b.state },
    {
      key: "r",
      header: "Resting",
      align: "right",
      cell: (b) => (
        <span className="flex flex-col items-end">
          <span className="k-num font-mono text-[12.5px]">{formatNumber(b.restingOrders, 0)}</span>
          <span className="k-num font-mono text-[10.5px] text-fg-3">
            {formatNumber(b.restingContracts, 0)} ct · {formatNumber(b.clientOrders, 0)} client
          </span>
        </span>
      ),
      sort: (b) => b.restingOrders,
      csv: (b) => `${b.restingOrders} orders / ${b.restingContracts} ct / ${b.clientOrders} client`,
    },
    {
      key: "mm",
      header: "MM coverage",
      cell: (b) => (
        <div className="w-24">
          <Progress value={b.mmCoveragePct} tone={b.mmCoveragePct >= 95 ? "up" : b.mmCoveragePct >= 80 ? "warn" : "down"} />
          <div className="k-num mt-1 flex justify-between font-mono text-[10.5px] text-fg-3">
            <span>{formatNumber(b.mmCoveragePct, 1)}%</span>
            <span>
              {formatNumber(b.seriesQuoted, 0)}/{formatNumber(b.seriesTotal, 0)}
            </span>
          </div>
        </div>
      ),
      sort: (b) => b.mmCoveragePct,
      csv: (b) => b.mmCoveragePct,
    },
    { key: "sp", header: "Spread", align: "right", cell: (b) => <span className="k-num font-mono text-[12.5px]">{b.avgSpreadTicks === null || b.avgSpreadTicks === undefined ? "—" : `${formatNumber(b.avgSpreadTicks, 1)} t`}</span>, sort: (b) => b.avgSpreadTicks ?? 0, csv: (b) => b.avgSpreadTicks ?? "", hideOn: "md" },
    {
      key: "oi",
      header: "OI · volume",
      align: "right",
      cell: (b) => (
        <span className="flex flex-col items-end">
          <span className="k-num font-mono text-[12.5px]">{formatNumber(b.oi, 0)}</span>
          <span className="k-num font-mono text-[10.5px] text-fg-3">
            vol {formatNumber(b.volume, 0)}
            {b.volumeUsd !== null && b.volumeUsd !== undefined ? ` · ${usd(b.volumeUsd)}` : ""}
          </span>
        </span>
      ),
      sort: (b) => b.oi,
      csv: (b) => `${b.oi} oi / ${b.volume} vol`,
      hideOn: "lg",
    },
    {
      key: "ob",
      header: "Outbox",
      align: "right",
      cell: (b) => {
        const o = b.outbox;
        if (!o) return <span className="text-[12px] text-fg-3">—</span>;
        const lag = o.oldestMs ?? 0;
        return (
          <Tooltip content={`${o.pending} fills waiting to apply to accounts · oldest ${formatNumber(lag, 0)} ms · ${o.failed} failed (failed items put the underlying in cancel-only)`}>
            <span className="flex flex-col items-end">
              <span className={cn("k-num font-mono text-[12.5px]", o.failed ? "text-down" : lag > LAG_WARN_MS ? "text-warn" : "text-fg-2")}>{o.failed ? `${o.failed} failed` : `${formatNumber(lag, 0)} ms`}</span>
              <span className="k-num font-mono text-[10.5px] text-fg-3">{o.pending} pending</span>
            </span>
          </Tooltip>
        );
      },
      sort: (b) => (b.outbox?.failed ?? 0) * 1e9 + (b.outbox?.oldestMs ?? 0),
      csv: (b) => `${b.outbox?.pending ?? ""}/${b.outbox?.oldestMs ?? ""}ms/${b.outbox?.failed ?? ""}`,
    },
    {
      key: "cl",
      header: "Clearing",
      align: "right",
      cell: (b) => {
        const off = Math.abs(b.clearingUsd ?? 0) >= 0.005;
        return off ? (
          <Tooltip content="The expiry clearing accounts of this underlying must net to 0 once the outbox is empty">
            <span className="flex flex-col items-end">
              <span className="k-num font-mono text-[12.5px] font-medium text-down">{usd(b.clearingUsd, 2)}</span>
              <span className="text-[10.5px] text-down">must be 0</span>
            </span>
          </Tooltip>
        ) : (
          <span className="k-num font-mono text-[12.5px] text-up">0.00</span>
        );
      },
      sort: (b) => Math.abs(b.clearingUsd ?? 0),
      csv: (b) => b.clearingUsd,
    },
    { key: "lt", header: "Last trade", cell: (b) => <span className="whitespace-nowrap text-[11.5px] text-fg-3" title={b.lastTradeAt ? when(b.lastTradeAt, true) : undefined}>{b.lastTradeAt ? agoSecs(b.lastTradeAt, now) : "none yet"}</span>, sort: (b) => b.lastTradeAt ?? "", hideOn: "xl" },
    {
      key: "x",
      header: "",
      align: "right",
      cell: (b) =>
        canDeal ? (
          <span className="inline-flex gap-1">
            <Tooltip content={`Halt ${b.underlying}…`}>
              <IconButton size="sm" aria-label={`Halt ${b.underlying}`} onClick={(e) => (e.stopPropagation(), onHalt(b.underlying, "halt"))}>
                <OctagonPause />
              </IconButton>
            </Tooltip>
            <Tooltip content={`Cancel-only ${b.underlying}…`}>
              <IconButton size="sm" aria-label={`Cancel-only ${b.underlying}`} onClick={(e) => (e.stopPropagation(), onHalt(b.underlying, "cancel_only"))}>
                <Ban />
              </IconButton>
            </Tooltip>
            <Tooltip content="Depth with owners (audited)">
              <IconButton size="sm" aria-label={`Depth of ${b.underlying}`} onClick={(e) => (e.stopPropagation(), onDepth(b.underlying))}>
                <Eye />
              </IconButton>
            </Tooltip>
          </span>
        ) : null,
    },
  ];
  return <DataTable columns={cols} rows={rows} dense pageSize={25} rowKey={(b) => b.underlying} exportName="options-order-books" empty={<EmptyState title="No books running" text="Books start with the rollout for every enabled underlying." illustration="package" />} />;
}

/* ------------------------------------------------------------------ */

function HaltsCard({ halts, loaded, pending, now, canDeal, onClear, onNew }: { halts: BookHalt[]; loaded: boolean; pending: boolean; now: number; canDeal: boolean; onClear: (h: BookHalt) => void; onNew?: () => void }) {
  const cols: Column<BookHalt>[] = [
    {
      key: "m",
      header: "Kill switch",
      cell: (h) => (
        <Chip size="sm" tone={HALT_MODE[h.mode]?.tone ?? "neutral"} dot>
          {HALT_MODE[h.mode]?.label ?? h.mode}
        </Chip>
      ),
      sort: (h) => h.mode,
      csv: (h) => h.mode,
    },
    {
      key: "t",
      header: "Applies to",
      cell: (h) => (
        <span className="flex flex-col">
          <span className="text-[11px] text-fg-3">{SCOPE_LABEL[h.scope] ?? h.scope}</span>
          <span className="font-mono text-[12.5px]">{h.scope === "all" ? "Every book" : h.target}</span>
        </span>
      ),
      sort: (h) => h.target,
      csv: (h) => `${h.scope}:${h.target}`,
    },
    { key: "r", header: "Reason", cell: (h) => <span className="block max-w-[260px] truncate text-[12.5px] text-fg-2" title={h.reason}>{h.reason}</span>, csv: (h) => h.reason },
    {
      key: "by",
      header: "Set by",
      cell: (h) => (
        <span className="flex flex-col text-[11.5px]">
          <span className="truncate text-fg-2">{h.by}</span>
          <span className="text-fg-3" title={when(h.at)}>
            {ago(h.at, now)}
          </span>
        </span>
      ),
      sort: (h) => h.at,
      csv: (h) => `${h.by} ${h.at}`,
      hideOn: "md",
    },
    {
      key: "x",
      header: "",
      align: "right",
      cell: (h) =>
        canDeal ? (
          <Button size="xs" variant="surface" onClick={(e) => (e.stopPropagation(), onClear(h))}>
            <Undo2 /> Clear
          </Button>
        ) : null,
    },
  ];
  return (
    <Card className="h-full pb-5">
      <CardHeader
        title="Active kill switches"
        subtitle="Halts and cancel-only on the books (engine). Dealer controls on the options service still apply on top."
        icon={<OctagonPause />}
        action={
          onNew && (
            <Button size="sm" variant="surface" onClick={onNew}>
              <Ban /> New…
            </Button>
          )
        }
      />
      <div className="mt-4 px-4 sm:px-6">
        {pending ? (
          <EnginePending what="Book halts" />
        ) : !loaded ? (
          <TableSkeleton rows={3} />
        ) : (
          <DataTable columns={cols} rows={halts} dense pageSize={10} rowKey={(h) => String(h.id)} exportName="options-book-halts" empty={<EmptyState title="No kill switches on" text="Every book matches normally." illustration="check_mark_button" />} />
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Halt                                                                 */
/* ------------------------------------------------------------------ */

function HaltDialog({ req, kind, underlyings, onClose, onSaved }: { req: HaltReq | null; kind: string; underlyings: Underlying[]; onClose: () => void; onSaved: () => void }) {
  const enabled = underlyings.filter((u) => u.enabled);
  const [scope, setScope] = React.useState<HaltScope>("underlying");
  const [mode, setMode] = React.useState<"halt" | "cancel_only">("halt");
  const [sym, setSym] = React.useState("");
  const [expiry, setExpiry] = React.useState("");
  const [series, setSeries] = React.useState("");
  React.useEffect(() => {
    if (!req) return;
    setScope(req.scope);
    setMode(req.mode);
    setSym(req.scope === "underlying" && req.target ? req.target : (enabled[0]?.symbol ?? ""));
    setExpiry("");
    setSeries("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);
  React.useEffect(() => {
    if (req && !sym && enabled.length) setSym(enabled[0]!.symbol);
  }, [req, sym, enabled]);
  const needExpiry = scope === "expiry" || scope === "series";
  const exps = useOpt<{ expiries: AdminExpiry[] }>(req && sym && needExpiry ? `/api/options/expiries?u=${sym}&status=listed&limit=60` : null);
  const listed = React.useMemo(() => [...(exps.data?.expiries ?? [])].sort((a, b) => a.cutAt.localeCompare(b.cutAt)), [exps.data]);
  React.useEffect(() => {
    if (needExpiry && listed.length && !listed.some((e) => e.date === expiry)) setExpiry(listed[0]!.date);
  }, [listed, expiry, needExpiry]);
  const chain = useOpt<Chain>(req && scope === "series" && sym && expiry ? `/api/options/chain?u=${sym}&expiry=${expiry}` : null);
  const codes = (chain.data?.rows ?? []).flatMap((r) => [r.call?.code, r.put?.code]).filter((c): c is string => !!c);
  if (!req) return null;
  const target = scope === "all" ? "*" : scope === "underlying" ? sym : scope === "expiry" ? `${sym}:${expiry}` : series.trim();
  const invalid = scope !== "all" && !sym ? "Choose an underlying" : needExpiry && !expiry ? "Choose an expiry" : scope === "series" && !SERIES_RE.test(series.trim()) ? "Pick a series code (SYMBOL-YYYYMMDD-STRIKE-C/P)" : null;
  const what = scope === "all" ? `every ${kindLabel(kind)} book` : target;
  return (
    <ReasonDialog
      open
      onOpenChange={(o) => !o && onClose()}
      side="right"
      title={`${HALT_MODE[mode]!.label} · ${kindLabel(kind)} books`}
      description="Takes effect in the book actor at once. Clear it here when the problem is fixed; the open check then cancels resting orders that are out of band."
      codes={REASONS.book}
      confirmLabel={`Set ${HALT_MODE[mode]!.label.toLowerCase()}`}
      confirmVariant={mode === "halt" ? "sell" : "ember"}
      engine
      disabled={invalid}
      onConfirm={async (reason) => {
        const r = await optSend("POST", "/api/trading/admin/options/books/halt", { kind, scope, target, mode, reason });
        if (r.ok) onSaved();
        return r;
      }}
      success={`${HALT_MODE[mode]!.label} set on ${what}`}
    >
      <div className="space-y-4">
        <Field label="Scope">
          <Segmented size="sm" value={scope} onChange={setScope} options={(["all", "underlying", "expiry", "series"] as HaltScope[]).map((s) => ({ value: s, label: SCOPE_LABEL[s]! }))} />
        </Field>
        {scope !== "all" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Underlying">
              <Select value={sym} onChange={(v) => (setSym(v), setExpiry(""), setSeries(""))} label="Underlying" options={enabled.map((x) => ({ value: x.symbol, label: `${x.symbol} · ${x.name}` }))} />
            </Field>
            {needExpiry && (
              <Field label="Expiry">
                <Select value={expiry} onChange={(v) => (setExpiry(v), setSeries(""))} label="Expiry" disabled={!listed.length} options={listed.length ? listed.map((e) => ({ value: e.date, label: `${e.date} · ${e.kinds.join("/")}` })) : [{ value: "", label: exps.data ? "No listed expiries" : "Loading…" }]} />
              </Field>
            )}
            {scope === "series" && (
              <Field label="Series" className="col-span-2" hint={codes.length ? `${codes.length} listed` : undefined}>
                <Input value={series} onChange={(e) => setSeries(e.target.value.toUpperCase().replace(/\s/g, ""))} list="book-halt-series" className="font-mono" placeholder={`${sym}-${expiry.replace(/-/g, "")}-…-C`} aria-label="Series code" />
                <datalist id="book-halt-series">
                  {codes.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
            )}
          </div>
        )}
        <Field label="Mode">
          <div className="grid grid-cols-2 gap-2">
            {(["halt", "cancel_only"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn("rounded-[14px] border px-3 py-2.5 text-left transition-colors", mode === m ? "border-ember/50 bg-ember-soft" : "border-line bg-surface-2 hover:border-fg-3")}
              >
                <div className="flex items-center gap-2 text-[13px] font-medium">
                  {m === "halt" ? <OctagonPause className="size-4 text-down" /> : <Ban className="size-4 text-warn" />}
                  {HALT_MODE[m]!.label}
                </div>
                <div className="mt-0.5 text-[11.5px] text-fg-3">{HALT_MODE[m]!.text}</div>
              </button>
            ))}
          </div>
        </Field>
        {scope === "all" && <div className="rounded-[14px] border border-down/30 bg-down-soft px-3.5 py-2.5 text-[12.5px]">Every {kindLabel(kind)} book stops. Clients can&apos;t trade options until it&apos;s cleared.</div>}
      </div>
    </ReasonDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Depth with owners (audited)                                          */
/* ------------------------------------------------------------------ */

function DepthDialog({ req, kind, underlyings, canBust, bustTick, onClose, onBust }: { req: { underlying?: string; series?: string } | null; kind: string; underlyings: Underlying[]; canBust: boolean; bustTick: number; onClose: () => void; onBust: (t: BookTrade, series: string) => void }) {
  const enabled = underlyings.filter((u) => u.enabled);
  const [mode, setMode] = React.useState<"pick" | "type">("pick");
  const [sym, setSym] = React.useState("");
  const [expiry, setExpiry] = React.useState("");
  const [strike, setStrike] = React.useState("");
  const [cp, setCp] = React.useState<"C" | "P">("C");
  const [typed, setTyped] = React.useState("");
  const [phase, setPhase] = React.useState<"pick" | "confirm" | "view">("pick");
  const [viewing, setViewing] = React.useState("");
  const [nonce, setNonce] = React.useState(0);
  React.useEffect(() => {
    if (!req) return;
    setMode(req.series ? "type" : "pick");
    setSym(req.underlying ?? enabled[0]?.symbol ?? "");
    setExpiry("");
    setStrike("");
    setCp("C");
    setTyped(req.series ?? "");
    setPhase("pick");
    setViewing("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);
  React.useEffect(() => {
    if (req && !sym && enabled.length) setSym(enabled[0]!.symbol);
  }, [req, sym, enabled]);
  const exps = useOpt<{ expiries: AdminExpiry[] }>(req && mode === "pick" && sym ? `/api/options/expiries?u=${sym}&status=listed&limit=60` : null);
  const listed = React.useMemo(() => [...(exps.data?.expiries ?? [])].sort((a, b) => a.cutAt.localeCompare(b.cutAt)), [exps.data]);
  React.useEffect(() => {
    if (mode === "pick" && listed.length && !listed.some((e) => e.date === expiry)) setExpiry(listed[0]!.date);
  }, [listed, expiry, mode]);
  const chain = useOpt<Chain>(req && mode === "pick" && sym && expiry ? `/api/options/chain?u=${sym}&expiry=${expiry}` : null);
  const ch = chain.data && chain.data.underlying === sym && chain.data.expiry === expiry ? chain.data : null;
  React.useEffect(() => {
    if (!ch || !ch.rows.length) return;
    if (!ch.rows.some((r) => r.strikeLabel === strike)) {
      const atm = ch.rows.reduce((best, r) => (ch.atmStrike !== null && Math.abs(r.strike - ch.atmStrike) < Math.abs(best.strike - ch.atmStrike) ? r : best), ch.rows[Math.floor(ch.rows.length / 2)]!);
      setStrike(atm.strikeLabel);
    }
  }, [ch, strike]);
  const row = ch?.rows.find((r) => r.strikeLabel === strike);
  const picked = mode === "pick" ? ((cp === "C" ? row?.call?.code : row?.put?.code) ?? "") : typed.trim();
  const valid = SERIES_RE.test(picked);
  const url = phase === "view" && viewing ? `/api/trading/admin/options/books/${encodeURIComponent(viewing)}?kind=${kind}&n=${nonce}` : null;
  const depth = useOpt<SeriesDepth>(url);
  // a bust from this view: read the (audited) depth again so the print shows as busted
  React.useEffect(() => {
    if (bustTick && phase === "view") setNonce((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bustTick]);
  if (!req) return null;

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      width={1120}
      title={phase === "view" ? viewing : "Depth with owners"}
      description={phase === "view" ? `${kindLabel(kind)} book · audited view` : `Pick a ${kindLabel(kind)} series. Owners are personal data: opening the view is logged.`}
      footer={
        phase === "view" ? (
          <>
            <span className="mr-auto inline-flex items-center gap-1.5 text-[11.5px] text-fg-3">
              <ScrollText className="size-3.5" /> Logged with your name and the series. Reloading logs another view.
            </span>
            <Button variant="ghost" size="sm" onClick={() => setPhase("pick")}>
              Another series
            </Button>
            <Button variant="surface" size="sm" onClick={() => setNonce((n) => n + 1)}>
              <RefreshCw /> Reload
            </Button>
          </>
        ) : phase === "confirm" ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => setPhase("pick")}>
              Back
            </Button>
            <Button
              variant="ember"
              size="sm"
              onClick={() => {
                setViewing(picked);
                setNonce((n) => n + 1);
                setPhase("view");
              }}
            >
              <Eye /> Open audited view
            </Button>
          </>
        ) : (
          <>
            <DialogClose asChild>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button variant="ember" size="sm" disabled={!valid} onClick={() => setPhase("confirm")}>
              Show depth <ArrowRight />
            </Button>
          </>
        )
      }
    >
      {phase === "pick" ? (
        <div className="space-y-4">
          <Segmented size="xs" value={mode} onChange={setMode} options={[{ value: "pick", label: "Pick from the chain" }, { value: "type", label: "Type a code" }]} />
          {mode === "pick" ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field label="Underlying">
                <Select value={sym} onChange={(v) => (setSym(v), setExpiry(""), setStrike(""))} label="Underlying" options={enabled.map((u) => ({ value: u.symbol, label: u.symbol }))} />
              </Field>
              <Field label="Expiry">
                <Select value={expiry} onChange={(v) => (setExpiry(v), setStrike(""))} label="Expiry" disabled={!listed.length} options={listed.length ? listed.map((e) => ({ value: e.date, label: `${e.date} · ${e.kinds.join("/")}` })) : [{ value: "", label: exps.data ? "No listed expiries" : "Loading…" }]} />
              </Field>
              <Field label="Strike">
                <Select value={strike} onChange={setStrike} label="Strike" disabled={!ch?.rows.length} options={ch?.rows.length ? ch.rows.map((r) => ({ value: r.strikeLabel, label: `${r.strikeLabel}${ch.atmStrike !== null && Math.abs(r.strike - ch.atmStrike) < 1e-9 ? " · ATM" : ""}` })) : [{ value: "", label: chain.error ? "Chain unavailable" : "Loading…" }]} />
              </Field>
              <Field label="Type">
                <Segmented size="sm" value={cp} onChange={setCp} options={[{ value: "C", label: "Call" }, { value: "P", label: "Put" }]} />
              </Field>
            </div>
          ) : (
            <Field label="Series code" hint="SYMBOL-YYYYMMDD-STRIKE-C/P">
              <Input value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase().replace(/\s/g, ""))} className="font-mono" placeholder="EURUSD-20261009-1.0850-C" aria-label="Series code" autoFocus />
            </Field>
          )}
          {chain.error && mode === "pick" && <ErrorState error={chain.error} onRetry={chain.reload} />}
          <div className="k-row flex items-center justify-between px-4 py-3">
            <span className="text-[12px] text-fg-3">Series</span>
            <span className={cn("font-mono text-[13px]", valid ? "text-fg" : "text-fg-3")}>{picked || "—"}</span>
          </div>
        </div>
      ) : phase === "confirm" ? (
        <div className="mx-auto max-w-[560px] space-y-4 py-6 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full border border-warn/30 bg-warn-soft text-warn">
            <ShieldCheck className="size-5" />
          </div>
          <div className="text-[16px] font-medium">This view is audited</div>
          <div className="text-[13px] leading-relaxed text-fg-2">
            Your name and the series <span className="font-mono">{picked}</span> are logged. The depth shows who owns each resting order; use it for surveillance or a client question, not to trade on.
          </div>
        </div>
      ) : depth.error ? (
        enginePending(depth.error) ? <EnginePending what="Depth with owners" /> : <ErrorState error={depth.error} onRetry={() => setNonce((n) => n + 1)} />
      ) : !depth.data || depth.data.series !== viewing ? (
        <TableSkeleton rows={10} />
      ) : (
        <DepthView d={depth.data} canBust={canBust} onBust={(t) => onBust(t, depth.data!.series)} />
      )}
    </Dialog>
  );
}

function DepthView({ d, canBust, onBust }: { d: SeriesDepth; canBust: boolean; onBust: (t: BookTrade) => void }) {
  const now = useNow(1000);
  const digits = tickDigits(d.premiumTick);
  const px = (v: number | null | undefined) => (v === null || v === undefined ? "—" : formatNumber(v, digits));
  const perContract = (v: number | null | undefined) => (v === null || v === undefined || !d.usdPerUnit ? null : v * d.usdPerUnit);
  const bids = (d.bids ?? []).slice(0, 10);
  const asks = (d.asks ?? []).slice(0, 10);
  const spread = bids[0] && asks[0] && d.premiumTick ? Math.round((asks[0].price - bids[0].price) / d.premiumTick) : null;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <BookStateChip state={d.state} />
        {d.audited !== false && (
          <Chip size="sm" tone="info">
            <ScrollText className="size-3" /> Audited view
          </Chip>
        )}
        <span className="font-mono text-[11.5px] text-fg-3">seq {formatNumber(d.seq, 0)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Fact label="Mark" value={<span className="font-mono">{px(d.mark)}{perContract(d.mark) !== null ? <span className="text-fg-3"> · {usd(perContract(d.mark), 2)}</span> : null}</span>} />
        <Fact label="Model (theo)" value={<span className="font-mono">{px(d.theo)}</span>} />
        <Fact label="Tick" value={<span className="font-mono">{px(d.premiumTick)}{perContract(d.premiumTick) !== null ? <span className="text-fg-3"> · {usd(perContract(d.premiumTick), 2)}</span> : null}</span>} />
        <Fact label="Spread" value={spread === null ? "one-sided" : `${formatNumber(spread, 0)} ticks`} />
        <Fact label="USD / contract" value={d.usdPerUnit ? `× ${formatNumber(d.usdPerUnit, 2)}` : "—"} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Ladder side="bid" levels={bids} px={px} perContract={perContract} now={now} />
        <Ladder side="ask" levels={asks} px={px} perContract={perContract} now={now} />
      </div>
      <Trades trades={d.trades ?? []} px={px} canBust={canBust} onBust={onBust} />
    </div>
  );
}

const FLAG: Record<string, string> = { post_only: "post-only", reduce_only: "reduce-only", ephemeral: "ephemeral", POST_ONLY: "post-only", REDUCE_ONLY: "reduce-only", EPHEMERAL: "ephemeral" };

function Ladder({ side, levels, px, perContract, now }: { side: "bid" | "ask"; levels: DepthLevel[]; px: (v: number | null | undefined) => string; perContract: (v: number) => number | null; now: number }) {
  const bid = side === "bid";
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between">
        <span className={cn("text-[13px] font-medium", bid ? "text-up" : "text-down")}>{bid ? "Bids" : "Asks"}</span>
        <span className="text-[11px] text-fg-3">{levels.length} level{levels.length === 1 ? "" : "s"} · time priority within a level</span>
      </div>
      {!levels.length ? (
        <div className="k-row px-4 py-6 text-center text-[12.5px] text-fg-3">No {bid ? "bids" : "asks"}{bid ? " (the MM shows no bid under 1 tick)" : ""}</div>
      ) : (
        <div className="space-y-1.5">
          {levels.map((lv, i) => {
            const usdPx = perContract(lv.price);
            return (
              <div key={`${lv.price}-${i}`} className="k-row overflow-hidden">
                <div className={cn("flex items-center justify-between px-3 py-1.5", bid ? "bg-up-soft/50" : "bg-down-soft/50")}>
                  <span className="flex items-baseline gap-2">
                    <span className="w-4 text-[10px] text-fg-3">{i + 1}</span>
                    <span className={cn("k-num font-mono text-[13px] font-medium", bid ? "text-up" : "text-down")}>{px(lv.price)}</span>
                    {usdPx !== null && <span className="k-num font-mono text-[10.5px] text-fg-3">{usd(usdPx, 2)}/ct</span>}
                  </span>
                  <span className="k-num font-mono text-[12px]">{formatNumber(lv.qty, 0)}</span>
                </div>
                <div className="divide-y divide-line">
                  {(lv.orders ?? []).map((o, j) => (
                    <div key={String(o.id)} className="grid grid-cols-[22px_minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-1 text-[11.5px]">
                      <span className="font-mono text-[10px] text-fg-3" title="Time priority within the level">
                        #{j + 1}
                      </span>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <LoginLink login={o.login} userId={o.mm ? null : o.userId} mm={o.mm} />
                        {o.name && !o.mm && <span className="truncate text-fg-3">{o.name}</span>}
                        {(o.flags ?? []).map((f) => (
                          <Chip key={f} size="sm">
                            {FLAG[f] ?? f}
                          </Chip>
                        ))}
                      </span>
                      <span className="k-num font-mono text-fg-2" title={`left ${o.left} of ${o.qty}`}>
                        {formatNumber(o.left, 0)}
                        {o.left !== o.qty && <span className="text-fg-3">/{formatNumber(o.qty, 0)}</span>}
                      </span>
                      <span className="w-16 text-right text-[10.5px] text-fg-3" title={when(o.at, true)}>
                        {agoSecs(o.at, now)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Trades({ trades, px, canBust, onBust }: { trades: BookTrade[]; px: (v: number | null | undefined) => string; canBust: boolean; onBust: (t: BookTrade) => void }) {
  const cols: Column<BookTrade>[] = [
    { key: "t", header: "Time", cell: (t) => <span className="whitespace-nowrap text-[11.5px] text-fg-2">{when(t.at, true)}</span>, sort: (t) => t.at, csv: (t) => t.at },
    { key: "f", header: "Fill", cell: (t) => <span className="font-mono text-[12px]">#{t.fillId}</span>, sort: (t) => t.fillId, csv: (t) => t.fillId },
    { key: "k", header: "Kind", cell: (t) => <FillKindChip kind={t.kind} />, sort: (t) => t.kind, csv: (t) => t.kind },
    {
      key: "s",
      header: "Taker",
      cell: (t) => (
        <Chip size="sm" tone={t.takerSide === "buy" ? "up" : "down"}>
          {t.takerSide}
        </Chip>
      ),
      csv: (t) => t.takerSide,
    },
    { key: "p", header: "Price", align: "right", cell: (t) => <span className="k-num font-mono text-[12px]">{px(t.price)}</span>, sort: (t) => t.price, csv: (t) => t.price },
    { key: "q", header: "Qty", align: "right", cell: (t) => <span className="k-num font-mono text-[12px]">{formatNumber(t.qty, 0)}</span>, sort: (t) => t.qty, csv: (t) => t.qty },
    { key: "m", header: "Maker", cell: (t) => <LoginLink login={t.maker.login} userId={t.maker.mm ? null : t.maker.userId} mm={t.maker.mm} />, csv: (t) => t.maker.login },
    { key: "tk", header: "Taker", cell: (t) => <LoginLink login={t.taker.login} userId={t.taker.mm ? null : t.taker.userId} mm={t.taker.mm} />, csv: (t) => t.taker.login },
    {
      key: "x",
      header: "",
      align: "right",
      cell: (t) =>
        t.busted ? (
          <Chip size="sm" tone="down">
            Busted
          </Chip>
        ) : canBust ? (
          <Button size="xs" variant="ghost" onClick={(e) => (e.stopPropagation(), onBust(t))}>
            <Gavel /> Bust…
          </Button>
        ) : null,
    },
  ];
  return (
    <div>
      <div className="mb-2 text-[13px] font-medium">Recent fills</div>
      <DataTable columns={cols} rows={trades} dense pageSize={10} rowKey={(t) => String(t.fillId)} exportName="options-series-fills" empty={<EmptyState title="No fills yet" text="Prints appear here as the series trades." illustration="bar_chart" />} />
    </div>
  );
}
