"use client";

/**
 * Options › Clearing & liquidations (docs/OPTIONS-EXCHANGE.md §1 clearing, §8 liquidation, §9 settlement). Every book
 * fill moves premium through the expiry's clearing account `house:options_clearing.{UNDERLYING}.{YYYYMMDD}:USD` (buyer
 * −P / clearing +P, seller +P / clearing −P), so each account MUST be 0 once the outbox is empty; after settlement any
 * rounding residue is swept to `house:options_rounding`. The liquidation log lists every step of a stop-out run: book
 * first within a band, combos by RFQ, then the Kalks backstop at mark ∓ the liquidation fee.
 *
 *   GET /api/trading/admin/options/clearing?kind=live|demo&expiry=YYYY-MM-DD&u=SYMBOL
 *       { items: [{ account, underlying, expiry, balanceUsd, pendingOutbox, fills, lastFillAt, swept?: {amountUsd, at} }] }
 *   GET /api/trading/admin/options/liquidations?kind=&from=YYYY-MM-DD&to=YYYY-MM-DD&login=&limit=
 *       { items: [{ id, at, login, userId?, step, unit: option|combo|cfd, series?, qty, price?, route: book|rfq|backstop|cfd,
 *         marginLevelBefore, marginLevelAfter, freedMarginUsd, status: done|partial|failed, note? }] }
 *       (margin levels in percent)
 *   GET /api/options/expiries?limit=600   the expiry filter
 *   + the four-eyes fill bust and pending approvals (fill-bust.tsx)
 */
import * as React from "react";
import { CircleCheck, Flame, Landmark, RefreshCw, Scale, ShieldAlert, TriangleAlert } from "lucide-react";
import { Button, Card, CardHeader, Chip, DataTable, EmptyState, Input, KpiCard, PageHeader, Reveal, Segmented, Tooltip, cn, formatNumber, type ChipTone, type Column } from "@kalks/ui";
import { ErrorState, TableSkeleton, ago, useDebounced, useNow, when } from "@/components/live/kit";
import type { AdminExpiry, ClearingRow, Liquidation } from "./types";
import { EnginePending, KIND_OPTIONS, LoginLink, UnderlyingCell, enginePending, kindLabel, usd, useKind, useOpt } from "./kit";
import { ApprovalsPanel, BustFillCard } from "./fill-bust";

const ROUTE: Record<string, { label: string; tone: ChipTone; text: string }> = {
  book: { label: "Book", tone: "info", text: "Reduce-only IOC on the book at mark × (1 ∓ liquidation band)" },
  rfq: { label: "RFQ", tone: "gold", text: "Combo closed by an RFQ to the market maker, auto-accepted" },
  backstop: { label: "Backstop", tone: "down", text: "The rest taken by the Kalks MM at mark ∓ the liquidation fee" },
  cfd: { label: "CFD", tone: "neutral", text: "A CFD position closed in the account shard" },
};
const STATUS: Record<string, { label: string; tone: ChipTone }> = { done: { label: "Done", tone: "up" }, partial: { label: "Partial", tone: "warn" }, failed: { label: "Failed", tone: "down" } };
const UNIT: Record<string, string> = { option: "Option", combo: "Combo", cfd: "CFD" };
const isZero = (v: number | null | undefined) => Math.abs(v ?? 0) < 0.005;
const pctTxt = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${formatNumber(v, 1)}%`);
const dayInput = (t: number) => new Date(t).toISOString().slice(0, 10);

export function ClearingPage() {
  const now = useNow(5000);
  const [kind, setKind] = useKind();
  const [expiry, setExpiry] = React.useState("all");
  const [sym, setSym] = React.useState("all");
  const [from, setFrom] = React.useState(() => dayInput(Date.now() - 7 * 86_400_000));
  const [to, setTo] = React.useState("");
  const [login, setLogin] = React.useState("");
  const [bustTick, setBustTick] = React.useState(0);
  const loginQ = useDebounced(login, 400);

  const cq = new URLSearchParams({ kind });
  if (expiry !== "all") cq.set("expiry", expiry);
  if (sym !== "all") cq.set("u", sym);
  const clearing = useOpt<{ items: ClearingRow[] }>(`/api/trading/admin/options/clearing?${cq}`, { refreshMs: 10_000 });
  const lq = new URLSearchParams({ kind, limit: "1000" });
  if (from) lq.set("from", from);
  if (to) lq.set("to", to);
  if (/^\d{1,18}$/.test(loginQ)) lq.set("login", loginQ);
  const liqs = useOpt<{ items: Liquidation[] }>(`/api/trading/admin/options/liquidations?${lq}`, { refreshMs: 30_000 });
  const exps = useOpt<{ expiries: AdminExpiry[] }>("/api/options/expiries?limit=600", { refreshMs: 120_000 });

  const cPending = enginePending(clearing.error);
  const lPending = enginePending(liqs.error);
  const rows = React.useMemo(() => [...(clearing.data?.items ?? [])].sort((a, b) => Number(isZero(a.balanceUsd)) - Number(isZero(b.balanceUsd)) || a.expiry.localeCompare(b.expiry) || a.underlying.localeCompare(b.underlying)), [clearing.data]);
  const off = rows.filter((r) => !isZero(r.balanceUsd));
  const net = rows.reduce((s, r) => s + Math.abs(r.balanceUsd ?? 0), 0);
  const items = liqs.data?.items ?? [];
  const runs = new Set(items.map((l) => String(l.login))).size;
  const freed = items.reduce((s, l) => s + (l.freedMarginUsd ?? 0), 0);
  const failed = items.filter((l) => l.status === "failed").length;
  const partial = items.filter((l) => l.status === "partial").length;
  const backstops = items.filter((l) => l.route === "backstop").length;

  // filter choices: expiry dates from a week back onwards (nearest first), underlyings seen there
  const dates = React.useMemo(() => {
    const cutoff = now - 7 * 86_400_000;
    const all = (exps.data?.expiries ?? []).filter((e) => Date.parse(e.cutAt) >= cutoff).map((e) => e.date);
    return Array.from(new Set(all)).sort();
  }, [exps.data, now]);
  const symbols = React.useMemo(() => Array.from(new Set((exps.data?.expiries ?? []).map((e) => e.symbol))).sort(), [exps.data]);

  return (
    <div className="pb-10">
      <PageHeader
        title="Clearing & liquidations"
        subtitle="Per-expiry clearing accounts of the order books (each must be 0 once the outbox is empty) and every step of the liquidation runs."
        actions={
          <>
            <Segmented size="sm" value={kind} onChange={setKind} options={KIND_OPTIONS} />
            <Button variant="surface" size="lg" onClick={() => (clearing.reload(), liqs.reload())}>
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Clearing accounts" icon={<Landmark />} value={clearing.data && !cPending ? <span className="k-num">{formatNumber(rows.length, 0)}</span> : "—"} chip={off.length ? `${off.length} not at 0` : "all balanced"} chipTone={!clearing.data || cPending ? "neutral" : off.length ? "down" : "up"} />
        <KpiCard label="Net clearing" icon={<Scale />} value={clearing.data && !cPending ? <span className={cn("k-num", off.length ? "text-down" : "text-up")}>{usd(net, 2)}</span> : "—"} chip="must be 0 once the outbox is empty" chipTone={off.length ? "down" : "up"} delay={0.04} />
        <KpiCard label="Liquidation steps" icon={<Flame />} value={liqs.data && !lPending ? <span className="k-num">{formatNumber(items.length, 0)}</span> : "—"} chip={`${runs} account${runs === 1 ? "" : "s"} · ${backstops} backstop`} chipTone={backstops ? "warn" : "neutral"} delay={0.08} />
        <KpiCard label="Margin freed" icon={<ShieldAlert />} value={liqs.data && !lPending ? <span className="k-num">{usd(freed)}</span> : "—"} chip={`${partial} partial · ${failed} failed`} chipTone={failed ? "down" : partial ? "warn" : "neutral"} delay={0.12} />
      </div>

      <Reveal delay={0.05} className="mt-4">
        <Card className="pb-5">
          <CardHeader
            title="Clearing accounts"
            subtitle="house:options_clearing.{UNDERLYING}.{YYYYMMDD}:USD. Each fill moves premium through it once per side; anything but 0 with an empty outbox is a ledger break."
            icon={<Landmark />}
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
                <select value={expiry} onChange={(e) => setExpiry(e.target.value)} aria-label="Expiry" className="h-8 rounded-full border border-line bg-surface-2 px-3 text-[12.5px] text-fg outline-none">
                  <option value="all">All expiries</option>
                  {dates.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </>
            }
          />
          <div className="mt-4 px-4 sm:px-6">
            {off.length > 0 && (
              <div className="mb-3 flex items-start gap-2.5 rounded-[14px] border border-down/40 bg-down-soft px-3.5 py-2.5 text-[12.5px]">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-down" />
                <span>
                  {off.length} clearing account{off.length === 1 ? " is" : "s are"} not at 0. With fills still in the outbox that is normal for a moment; with an empty outbox it is a ledger break: check the outbox on Order books and alert the engine on-call.
                </span>
              </div>
            )}
            {cPending ? (
              <EnginePending what="Clearing accounts" />
            ) : clearing.error ? (
              <ErrorState error={clearing.error} onRetry={clearing.reload} />
            ) : !clearing.data ? (
              <TableSkeleton rows={6} />
            ) : (
              <ClearingTable rows={rows} now={now} kind={kind} />
            )}
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.08} className="mt-4">
        <Card className="pb-5">
          <CardHeader
            title="Liquidation log"
            subtitle="Each step of a stop-out run: cancel the account's orders, close the unit that frees the most margin (book with a band, combo by RFQ, CFD in the shard), then the backstop. Repeats until the level is above stop-out."
            icon={<Flame />}
            action={
              <>
                <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From" className="h-8 rounded-full border border-line bg-surface-2 px-3 text-[12.5px] text-fg outline-none" />
                <span className="text-[12px] text-fg-3">to</span>
                <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To" className="h-8 rounded-full border border-line bg-surface-2 px-3 text-[12.5px] text-fg outline-none" />
                <Input value={login} onChange={(e) => setLogin(e.target.value.replace(/\D/g, "").slice(0, 18))} placeholder="Login" aria-label="Login" className="h-8 w-32 rounded-full px-3 text-[12.5px]" />
              </>
            }
          />
          <div className="mt-4 px-4 sm:px-6">
            {lPending ? (
              <EnginePending what="The liquidation log" />
            ) : liqs.error ? (
              <ErrorState error={liqs.error} onRetry={liqs.reload} />
            ) : !liqs.data ? (
              <TableSkeleton rows={8} />
            ) : (
              <LiquidationsTable rows={items} now={now} kind={kind} />
            )}
          </div>
        </Card>
      </Reveal>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-5">
          <BustFillCard className="h-full" onDone={() => setBustTick((n) => n + 1)} />
        </Reveal>
        <Reveal delay={0.12} className="xl:col-span-7">
          <ApprovalsPanel actions={["fill_bust"]} refreshKey={bustTick} className="h-full" />
        </Reveal>
      </div>
    </div>
  );
}

function ClearingTable({ rows, now, kind }: { rows: ClearingRow[]; now: number; kind: string }) {
  const cols: Column<ClearingRow>[] = [
    { key: "u", header: "Underlying", cell: (r) => <UnderlyingCell symbol={r.underlying} size={22} sub={r.expiry} />, sort: (r) => `${r.underlying}/${r.expiry}`, csv: (r) => r.underlying },
    { key: "a", header: "Account", cell: (r) => <span className="block max-w-[320px] truncate font-mono text-[11.5px] text-fg-2" title={r.account}>{r.account}</span>, sort: (r) => r.account, csv: (r) => r.account, hideOn: "lg" },
    { key: "e", header: "Expiry", cell: (r) => <span className="font-mono text-[12.5px]">{r.expiry}</span>, sort: (r) => r.expiry, csv: (r) => r.expiry, hideOn: "md" },
    {
      key: "b",
      header: "Balance",
      align: "right",
      cell: (r) =>
        isZero(r.balanceUsd) ? (
          <Chip size="sm" tone="up">
            <CircleCheck className="size-3" /> 0.00 balanced
          </Chip>
        ) : (
          <span className="flex flex-col items-end">
            <span className="k-num font-mono text-[13px] font-semibold text-down">{usd(r.balanceUsd, 2)}</span>
            <span className="text-[10.5px] text-down">
              must be 0 · {formatNumber(r.pendingOutbox ?? 0, 0)} pending in the outbox
            </span>
          </span>
        ),
      sort: (r) => Math.abs(r.balanceUsd ?? 0),
      csv: (r) => r.balanceUsd,
    },
    { key: "o", header: "Outbox", align: "right", cell: (r) => <span className={cn("k-num font-mono text-[12.5px]", r.pendingOutbox ? "text-warn" : "text-fg-3")}>{formatNumber(r.pendingOutbox ?? 0, 0)}</span>, sort: (r) => r.pendingOutbox ?? 0, csv: (r) => r.pendingOutbox ?? 0 },
    { key: "f", header: "Fills", align: "right", cell: (r) => <span className="k-num font-mono text-[12.5px]">{formatNumber(r.fills ?? 0, 0)}</span>, sort: (r) => r.fills ?? 0, csv: (r) => r.fills ?? 0 },
    { key: "l", header: "Last fill", cell: (r) => <span className="whitespace-nowrap text-[11.5px] text-fg-3" title={r.lastFillAt ? when(r.lastFillAt, true) : undefined}>{r.lastFillAt ? ago(r.lastFillAt, now) : "—"}</span>, sort: (r) => r.lastFillAt ?? "", hideOn: "lg" },
    {
      key: "s",
      header: "Swept",
      align: "right",
      cell: (r) =>
        r.swept ? (
          <Tooltip content={`Rounding residue swept to house:options_rounding · ${when(r.swept.at)}`}>
            <span className="k-num font-mono text-[11.5px] text-fg-2">{usd(r.swept.amountUsd, 3)}</span>
          </Tooltip>
        ) : (
          <span className="text-[11.5px] text-fg-3">{Date.parse(`${r.expiry}T23:59:59Z`) < now ? "—" : "after settlement"}</span>
        ),
      sort: (r) => r.swept?.amountUsd ?? 0,
      csv: (r) => r.swept?.amountUsd ?? "",
      hideOn: "md",
    },
  ];
  return <DataTable columns={cols} rows={rows} dense pageSize={25} rowKey={(r) => r.account} search={(r) => `${r.account} ${r.underlying} ${r.expiry}`} searchPlaceholder="Search account, underlying, expiry…" exportName={`options-clearing-${kind}`} empty={<EmptyState title="No clearing accounts" text="An expiry's account appears with its first book fill." illustration="bank" />} />;
}

function LiquidationsTable({ rows, now, kind }: { rows: Liquidation[]; now: number; kind: string }) {
  const cols: Column<Liquidation>[] = [
    {
      key: "t",
      header: "Time",
      cell: (l) => (
        <span className="flex flex-col">
          <span className="whitespace-nowrap text-[12px]">{when(l.at, true)}</span>
          <span className="text-[10.5px] text-fg-3">{ago(l.at, now)}</span>
        </span>
      ),
      sort: (l) => l.at,
      csv: (l) => l.at,
    },
    { key: "c", header: "Account", cell: (l) => <LoginLink login={l.login} userId={l.userId} />, sort: (l) => String(l.login), csv: (l) => l.login },
    { key: "s", header: "Step", align: "right", cell: (l) => <span className="k-num font-mono text-[12.5px]">#{l.step}</span>, sort: (l) => l.step, csv: (l) => l.step },
    {
      key: "u",
      header: "Unit",
      cell: (l) => (
        <span className="flex flex-col">
          <span className="text-[12.5px]">{UNIT[l.unit] ?? l.unit}</span>
          {l.series && (
            <span className="max-w-[220px] truncate font-mono text-[10.5px] text-fg-3" title={l.series}>
              {l.series}
            </span>
          )}
        </span>
      ),
      sort: (l) => `${l.unit}/${l.series ?? ""}`,
      csv: (l) => `${l.unit} ${l.series ?? ""}`,
    },
    {
      key: "q",
      header: "Qty · price",
      align: "right",
      cell: (l) => (
        <span className="flex flex-col items-end">
          <span className="k-num font-mono text-[12.5px]">{formatNumber(l.qty, l.unit === "cfd" ? 2 : 0)}</span>
          <span className="k-num font-mono text-[10.5px] text-fg-3">{l.price === null || l.price === undefined ? "—" : `@ ${l.price}`}</span>
        </span>
      ),
      sort: (l) => l.qty,
      csv: (l) => `${l.qty} @ ${l.price ?? ""}`,
      hideOn: "md",
    },
    {
      key: "r",
      header: "Route",
      cell: (l) => (
        <Tooltip content={ROUTE[l.route]?.text ?? l.route}>
          <span>
            <Chip size="sm" tone={ROUTE[l.route]?.tone ?? "neutral"}>
              {ROUTE[l.route]?.label ?? l.route}
            </Chip>
          </span>
        </Tooltip>
      ),
      sort: (l) => l.route,
      csv: (l) => l.route,
    },
    {
      key: "ml",
      header: "Margin level",
      align: "right",
      cell: (l) => (
        <span className="k-num whitespace-nowrap font-mono text-[12px]">
          <span className="text-down">{pctTxt(l.marginLevelBefore)}</span>
          <span className="text-fg-3"> → </span>
          <span className={(l.marginLevelAfter ?? 0) > (l.marginLevelBefore ?? 0) ? "text-up" : "text-fg-2"}>{pctTxt(l.marginLevelAfter)}</span>
        </span>
      ),
      sort: (l) => l.marginLevelAfter ?? 0,
      csv: (l) => `${l.marginLevelBefore ?? ""} -> ${l.marginLevelAfter ?? ""}`,
    },
    { key: "f", header: "Freed", align: "right", cell: (l) => <span className="k-num font-mono text-[12.5px]">{usd(l.freedMarginUsd)}</span>, sort: (l) => l.freedMarginUsd, csv: (l) => l.freedMarginUsd },
    {
      key: "st",
      header: "Status",
      cell: (l) => {
        const chip = (
          <Chip size="sm" tone={STATUS[l.status]?.tone ?? "neutral"} dot>
            {STATUS[l.status]?.label ?? l.status}
          </Chip>
        );
        return l.note ? (
          <Tooltip content={l.note}>
            <span>{chip}</span>
          </Tooltip>
        ) : (
          chip
        );
      },
      sort: (l) => l.status,
      csv: (l) => `${l.status}${l.note ? ` (${l.note})` : ""}`,
    },
  ];
  return (
    <DataTable
      columns={cols}
      rows={rows}
      dense
      pageSize={25}
      rowKey={(l) => String(l.id)}
      search={(l) => `${l.login} ${l.userId ?? ""} ${l.series ?? ""} ${l.route} ${l.status}`}
      searchPlaceholder="Search login, series, route…"
      exportName={`options-liquidations-${kind}`}
      empty={<EmptyState title={`No ${kindLabel(kind)} liquidations in this range`} text="Stop-outs on accounts with options are logged here step by step." illustration="check_mark_button" />}
    />
  );
}
