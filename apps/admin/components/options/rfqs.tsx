"use client";

/**
 * Options › Combo RFQs (docs/OPTIONS-EXCHANGE.md §5, decision O49): strategies traded by request for quote. A client
 * sends the legs and a size (open 30 s); the Kalks market maker always answers with a firm net bid / ask per strategy
 * unit (valid a few seconds, refreshed after that) and reserves for its worst side; accepting fills every leg at once
 * in one journal entry, or nothing. Live every 5 seconds: the open requests with the MM's current quote, and the
 * recent ones with their outcome.
 *
 *   GET /api/trading/admin/options/rfqs?kind=live|demo
 *       { open: [{ id, login, kind, underlying, legs: [{series, side, ratio}], qty, status, expiresAt, createdAt,
 *                  quotes: [{quoteId, responder, bid, ask, qty, validUntil}], note? }],
 *         recent: [{ id, kind, underlying, login, legs, qty, status, expiresAt, createdAt, updatedAt,
 *                    data?: { filled?: {net, side, fills}, rejected? } }],
 *         stats: { recent, filled } }
 *       (nets per unit of the underlying in the quote currency)
 */
import * as React from "react";
import { Clock, Layers, MessagesSquare, RefreshCw, Sigma, Timer } from "lucide-react";
import { Button, Card, CardHeader, Chip, DataTable, EmptyState, KpiCard, PageHeader, Reveal, Segmented, cn, formatNumber, type ChipTone, type Column } from "@kalks/ui";
import { ErrorState, TableSkeleton, ago, useNow, when } from "@/components/live/kit";
import { EnginePending, KIND_OPTIONS, LoginLink, UnderlyingCell, enginePending, useKind, useOpt } from "./kit";

type RfqLeg = { series: string; side: "buy" | "sell" | string; ratio: number };
type RfqQuote = { quoteId: string; responder: string; bid: number | null; ask: number | null; qty: number; validUntil: string };
type OpenRfq = { id: string; login: number; kind: string; underlying: string; legs: RfqLeg[]; qty: number; status: string; expiresAt: string; createdAt?: string | null; quotes?: RfqQuote[] | null; note?: string | null };
type RecentRfq = {
  id: string;
  kind: string;
  underlying: string;
  login: number;
  legs: RfqLeg[];
  qty: number;
  status: string;
  expiresAt: string;
  createdAt: string;
  updatedAt?: string | null;
  data?: { filled?: { net?: number | null; side?: string; fills?: number } | null; rejected?: string | null; reduceOnly?: boolean } | null;
};
type RfqMonitor = { open?: OpenRfq[] | null; recent?: RecentRfq[] | null; stats?: { recent: number; filled: number } | null };

const STATUS: Record<string, { label: string; tone: ChipTone }> = {
  open: { label: "Open", tone: "info" },
  filled: { label: "Filled", tone: "up" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  expired: { label: "Expired", tone: "warn" },
};

function StatusChip({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: "neutral" as ChipTone };
  return (
    <Chip size="sm" tone={s.tone} dot>
      {s.label}
    </Chip>
  );
}

/** "B 1× 1.1650 C · S 1× 1.1700 C" from the series codes (SYMBOL-YYYYMMDD-STRIKE-C|P). */
function Legs({ legs }: { legs: RfqLeg[] }) {
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5">
      {legs.map((l) => {
        const p = l.series.split("-");
        return (
          <span key={l.series} className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-[11.5px]" title={l.series}>
            <span className={cn("rounded-[3px] px-1 text-[9.5px] font-bold uppercase", l.side === "buy" ? "bg-up-soft text-up" : "bg-down-soft text-down")}>{l.side === "buy" ? "B" : "S"}</span>
            <span className="text-fg-3">{l.ratio}×</span>
            <span>{p.length >= 4 ? `${p[1]?.slice(4)} ${p[2]} ${p[3]}` : l.series}</span>
          </span>
        );
      })}
    </span>
  );
}

const net = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : formatNumber(v, 6).replace(/0+$/, "").replace(/\.$/, ""));

export function RfqsPage() {
  const now = useNow(1000);
  const [kind, setKind] = useKind();
  const mon = useOpt<RfqMonitor>(`/api/trading/admin/options/rfqs?kind=${kind}`, { refreshMs: 5000 });
  const pending = enginePending(mon.error);
  const open = (mon.data?.open ?? []).filter((r) => r.status === "open");
  const recent = mon.data?.recent ?? [];
  const live = open.filter((r) => (r.quotes ?? []).some((q) => Date.parse(q.validUntil) > now)).length;
  const filled = recent.filter((r) => r.status === "filled").length;
  const decided = recent.filter((r) => r.status !== "open").length;
  const unanswered = open.filter((r) => !(r.quotes ?? []).length).length;

  return (
    <div className="pb-10">
      <PageHeader
        title="Combo RFQs"
        subtitle="Strategies on the order book trade by request for quote: the Kalks market maker answers every request with a firm net price, and an accept fills every leg at once or nothing."
        actions={
          <>
            <Segmented size="sm" value={kind} onChange={setKind} options={KIND_OPTIONS} />
            <Button variant="surface" size="lg" onClick={() => mon.reload()}>
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Open requests" icon={<MessagesSquare />} value={mon.data && !pending ? <span className="k-num">{formatNumber(open.length, 0)}</span> : "—"} chip={unanswered ? `${unanswered} without a quote` : "all answered"} chipTone={!mon.data || pending ? "neutral" : unanswered ? "warn" : "up"} />
        <KpiCard label="Live MM quotes" icon={<Timer />} value={mon.data && !pending ? <span className="k-num">{formatNumber(live, 0)}</span> : "—"} chip="firm for the quote lifetime" chipTone="neutral" delay={0.04} />
        <KpiCard label="Filled (recent)" icon={<Layers />} value={mon.data && !pending ? <span className="k-num">{formatNumber(filled, 0)}</span> : "—"} chip={`of the last ${formatNumber(recent.length, 0)} requests`} chipTone={filled ? "up" : "neutral"} delay={0.08} />
        <KpiCard label="Fill rate" icon={<Sigma />} value={mon.data && !pending && decided ? <span className="k-num">{formatNumber((100 * filled) / decided, 0)}%</span> : "—"} chip="filled / decided" chipTone="neutral" delay={0.12} />
      </div>

      <Reveal delay={0.05} className="mt-4">
        <Card className="pb-5">
          <CardHeader title="Open requests" subtitle="Each request lives 30 seconds. The market maker's quote is firm until it lapses; a lapsed quote is replaced on the client's next read. The MM reserves margin for its worst side while the quote stands." icon={<MessagesSquare />} />
          <div className="mt-4 px-4 sm:px-6">
            {pending ? <EnginePending what="Combo RFQs" /> : mon.error ? <ErrorState error={mon.error} onRetry={mon.reload} /> : !mon.data ? <TableSkeleton rows={4} /> : <OpenTable rows={open} now={now} />}
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.08} className="mt-4">
        <Card className="pb-5">
          <CardHeader title="Recent requests" subtitle="The last 200 requests with their outcome. A filled request is one combo id on the tape: its legs (kind RFQ) and one combo print; the outright books are not touched." icon={<Clock />} />
          <div className="mt-4 px-4 sm:px-6">{pending ? <EnginePending what="Combo RFQs" /> : mon.error ? null : !mon.data ? <TableSkeleton rows={6} /> : <RecentTable rows={recent} now={now} kind={kind} />}</div>
        </Card>
      </Reveal>
    </div>
  );
}

function OpenTable({ rows, now }: { rows: OpenRfq[]; now: number }) {
  const cols: Column<OpenRfq>[] = [
    { key: "id", header: "Request", cell: (r) => <span className="font-mono text-[12px]">#{r.id}</span>, sort: (r) => r.id, csv: (r) => r.id },
    { key: "a", header: "Account", cell: (r) => <LoginLink login={r.login} />, sort: (r) => String(r.login), csv: (r) => r.login },
    { key: "u", header: "Strategy", cell: (r) => <UnderlyingCell symbol={r.underlying} sub={<Legs legs={r.legs} />} />, sort: (r) => r.underlying, csv: (r) => `${r.underlying} ${r.legs.map((l) => `${l.side} ${l.ratio}x ${l.series}`).join(" / ")}` },
    { key: "q", header: "Size", align: "right", cell: (r) => <span className="k-num font-mono text-[12.5px]">{formatNumber(r.qty, 0)}</span>, sort: (r) => r.qty, csv: (r) => r.qty },
    {
      key: "p",
      header: "MM bid / ask",
      align: "right",
      cell: (r) => {
        const q = (r.quotes ?? [])[0];
        if (!q) return <span className="text-[11.5px] text-fg-3">{r.note ?? "waiting"}</span>;
        const left = Math.max(0, Date.parse(q.validUntil) - now);
        return (
          <span className="flex flex-col items-end">
            <span className="k-num font-mono text-[12.5px]">
              <span className="text-down">{net(q.bid)}</span> / <span className="text-up">{net(q.ask)}</span>
            </span>
            <span className={cn("text-[10.5px]", left > 1500 ? "text-fg-3" : "text-warn")}>{left > 0 ? `firm ${(left / 1000).toFixed(1)} s` : "lapsed"}</span>
          </span>
        );
      },
      sort: (r) => (r.quotes ?? [])[0]?.ask ?? 0,
      csv: (r) => `${(r.quotes ?? [])[0]?.bid ?? ""} / ${(r.quotes ?? [])[0]?.ask ?? ""}`,
    },
    {
      key: "e",
      header: "Open for",
      align: "right",
      cell: (r) => <span className="k-num font-mono text-[12px]">{Math.max(0, Math.ceil((Date.parse(r.expiresAt) - now) / 1000))} s</span>,
      sort: (r) => r.expiresAt,
      csv: (r) => r.expiresAt,
      hideOn: "md",
    },
  ];
  return <DataTable columns={cols} rows={rows} dense pageSize={20} rowKey={(r) => r.id} exportName="options-rfqs-open" empty={<EmptyState title="No open requests" text="Requests appear here while a client is asking for a strategy price." illustration="speech_balloon" />} />;
}

function RecentTable({ rows, now, kind }: { rows: RecentRfq[]; now: number; kind: string }) {
  const cols: Column<RecentRfq>[] = [
    {
      key: "t",
      header: "Time",
      cell: (r) => (
        <span className="flex flex-col">
          <span className="whitespace-nowrap text-[12px]">{when(r.createdAt, true)}</span>
          <span className="text-[10.5px] text-fg-3">{ago(r.createdAt, now)}</span>
        </span>
      ),
      sort: (r) => r.createdAt,
      csv: (r) => r.createdAt,
    },
    { key: "id", header: "Request", cell: (r) => <span className="font-mono text-[12px]">#{r.id}</span>, sort: (r) => r.id, csv: (r) => r.id, hideOn: "md" },
    { key: "a", header: "Account", cell: (r) => <LoginLink login={r.login} />, sort: (r) => String(r.login), csv: (r) => r.login },
    { key: "u", header: "Strategy", cell: (r) => <UnderlyingCell symbol={r.underlying} sub={<Legs legs={r.legs} />} />, sort: (r) => r.underlying, csv: (r) => `${r.underlying} ${r.legs.map((l) => `${l.side} ${l.ratio}x ${l.series}`).join(" / ")}` },
    { key: "q", header: "Size", align: "right", cell: (r) => <span className="k-num font-mono text-[12.5px]">{formatNumber(r.qty, 0)}</span>, sort: (r) => r.qty, csv: (r) => r.qty },
    {
      key: "n",
      header: "Traded net",
      align: "right",
      cell: (r) =>
        r.data?.filled ? (
          <span className="flex flex-col items-end">
            <span className="k-num font-mono text-[12.5px]">{net(r.data.filled.net)}</span>
            <span className="text-[10.5px] text-fg-3">client {r.data.filled.side === "sell" ? "sold" : "bought"}</span>
          </span>
        ) : (
          <span className="text-[11.5px] text-fg-3">{r.data?.rejected ? `refused: ${r.data.rejected}` : "—"}</span>
        ),
      sort: (r) => r.data?.filled?.net ?? 0,
      csv: (r) => r.data?.filled?.net ?? "",
    },
    { key: "s", header: "Status", cell: (r) => <StatusChip status={r.status} />, sort: (r) => r.status, csv: (r) => r.status },
  ];
  return <DataTable columns={cols} rows={rows} dense pageSize={25} rowKey={(r) => r.id} search={(r) => `${r.id} ${r.login} ${r.underlying} ${r.legs.map((l) => l.series).join(" ")}`} searchPlaceholder="Search request, account, series…" exportName={`options-rfqs-${kind}`} empty={<EmptyState title="No requests yet" text="Combo RFQs show up here once clients price strategies on the order book." illustration="speech_balloon" />} />;
}
