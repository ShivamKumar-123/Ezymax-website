"use client";

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Download, RotateCw } from "lucide-react";
import { Button, Card, CardHeader, Chip, EmptyState, IconButton, Input, Reveal, Segmented, Skeleton, SymbolAvatar, cn } from "@kalks/ui";
import {
  REASON_LABEL,
  curOf,
  downloadExport,
  fmtAmount,
  fmtPrice,
  isoDay,
  ledgerKind,
  serverTime,
  usePoll,
  type EngineAccount,
  type EngineDeal,
  type HistoryPage,
  type LedgerPage,
} from "./api";

/* ------------------------------------------------------------------ */
/* Date range                                                          */
/* ------------------------------------------------------------------ */

export type Preset = "7d" | "30d" | "90d" | "all" | "custom";
export type Range = { preset: Preset; from?: string; to?: string };

/** `to` in the engine is exclusive; the UI date is inclusive. */
function nextDay(day: string) {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return isoDay(d);
}

export function rangeQuery(r: Range): { from?: string; to?: string } {
  if (r.preset === "all") return {};
  if (r.preset === "custom") return { from: r.from || undefined, to: r.to ? nextDay(r.to) : undefined };
  const days = r.preset === "7d" ? 7 : r.preset === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days + 1);
  return { from: isoDay(d) };
}

export function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        size="xs"
        value={value.preset}
        onChange={(p) => onChange(p === "custom" ? { preset: p, from: value.from ?? isoDay(new Date(Date.now() - 29 * 86400000)), to: value.to ?? isoDay(new Date()) } : { preset: p })}
        options={[
          { value: "7d", label: "7D" },
          { value: "30d", label: "30D" },
          { value: "90d", label: "90D" },
          { value: "all", label: "All" },
          { value: "custom", label: "Custom" },
        ]}
      />
      {value.preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input type="date" aria-label="From date" className="h-8 w-[150px]" inputClassName="text-[12.5px]" value={value.from ?? ""} max={value.to} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <span className="text-fg-3">–</span>
          <Input type="date" aria-label="To date" className="h-8 w-[150px]" inputClassName="text-[12.5px]" value={value.to ?? ""} min={value.from} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </div>
      )}
    </div>
  );
}

function Pager({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-[12.5px] text-fg-3">
      <span className="k-num">
        {(page - 1) * limit + 1}–{Math.min(total, page * limit)} of {total}
      </span>
      <div className="flex items-center gap-1.5">
        <IconButton size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft />
        </IconButton>
        <span className="k-num px-2">
          {page} / {pages}
        </span>
        <IconButton size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight />
        </IconButton>
      </div>
    </div>
  );
}

function qs(o: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => v !== undefined && v !== "" && p.set(k, String(v)));
  return p.toString();
}

const TH = "bg-surface-2 px-4 py-3 text-[11.5px] font-medium uppercase tracking-[0.05em] text-fg-3 border-y border-line first:rounded-l-[14px] first:border-l last:rounded-r-[14px] last:border-r";
const TD = "border-b border-line px-4 py-3";

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full rounded-[12px]" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Deals (trade history)                                               */
/* ------------------------------------------------------------------ */

export function DealsTable({ deals, cur }: { deals: EngineDeal[]; cur: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] border-separate border-spacing-0 text-[13.5px]">
        <thead>
          <tr>
            <th className={cn(TH, "pl-5 text-left")}>Symbol</th>
            <th className={cn(TH, "text-left")}>Deal</th>
            <th className={cn(TH, "text-left")}>Direction</th>
            <th className={cn(TH, "text-right")}>Volume</th>
            <th className={cn(TH, "text-right")}>Price</th>
            <th className={cn(TH, "text-left")}>Time</th>
            <th className={cn(TH, "text-right")}>Commission</th>
            <th className={cn(TH, "text-right")}>Swap</th>
            <th className={cn(TH, "text-right")}>Profit</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d) => {
            const exit = d.entry !== "in";
            return (
              <tr key={d.id} className={cn("hover:bg-surface-2/60", d.reversed && "opacity-50")}>
                <td className={cn(TD, "pl-5")}>
                  <div className="flex items-center gap-2.5">
                    <SymbolAvatar symbol={d.symbol} size={24} />
                    <div>
                      <div className="flex items-center gap-2 font-medium">
                        {d.symbol}
                        <Chip size="sm" tone={d.side === "buy" ? "up" : "down"}>
                          {d.side.toUpperCase()}
                        </Chip>
                      </div>
                      <div className="font-mono text-[11px] text-fg-3">position #{d.positionTicket}</div>
                    </div>
                  </div>
                </td>
                <td className={cn(TD, "font-mono text-[12px] text-fg-3")}>#{d.id}</td>
                <td className={TD}>
                  <span className="text-[12.5px] text-fg-2">{exit ? "Out" : "In"}</span>
                  {exit && d.reason !== "client" && <span className="ml-1.5 text-[11.5px] text-fg-3">· {REASON_LABEL[d.reason] ?? d.reason}</span>}
                  {d.reversed && (
                    <Chip size="sm" className="ml-1.5">
                      Reversed
                    </Chip>
                  )}
                </td>
                <td className={cn(TD, "k-num text-right")}>{d.volume.toFixed(2)}</td>
                <td className={cn(TD, "k-num text-right font-mono text-fg-2")}>{fmtPrice(d.price)}</td>
                <td className={cn(TD, "k-num whitespace-nowrap text-[12.5px] text-fg-2")}>{serverTime(d.time)}</td>
                <td className={cn(TD, "k-num text-right text-[12.5px] text-fg-3")}>{d.commission ? fmtAmount(d.commission, "") : "—"}</td>
                <td className={cn(TD, "k-num text-right text-[12.5px] text-fg-3")}>{d.swap ? fmtAmount(d.swap, "") : "—"}</td>
                <td className={cn(TD, "k-num text-right font-semibold", !exit ? "text-fg-3" : d.profit > 0 ? "text-up" : d.profit < 0 ? "text-down" : "")}>{exit ? fmtAmount(d.profit, cur, true) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function HistoryPanel({ a, title = "Trade history" }: { a: Pick<EngineAccount, "login" | "cent" | "currency">; title?: string }) {
  const cur = curOf(a);
  const [range, setRange] = React.useState<Range>({ preset: "30d" });
  const [page, setPage] = React.useState(1);
  const limit = 25;
  const q = rangeQuery(range);
  const invalid = range.preset === "custom" && (!range.from || !range.to || range.from > range.to);
  const path = invalid ? null : `accounts/${a.login}/history?${qs({ ...q, page, limit })}`;
  const { data, error, loading, reload } = usePoll<HistoryPage>(path, 0);
  React.useEffect(() => setPage(1), [range.preset, range.from, range.to, a.login]);
  const net = data ? data.totals.profit + data.totals.swap + data.totals.commission : 0;

  return (
    <Reveal>
      <Card>
        <CardHeader
          title={title}
          subtitle={
            data ? (
              <span>
                {data.total} deals · net result <span className={cn("k-num font-medium", net > 0 ? "text-up" : net < 0 ? "text-down" : "text-fg")}>{fmtAmount(net, cur, true)}</span> (profit {fmtAmount(data.totals.profit, cur, true)} · swap {fmtAmount(data.totals.swap, cur, true)} · commission {fmtAmount(data.totals.commission, cur, true)})
              </span>
            ) : (
              "Every entry and exit deal, in server time"
            )
          }
          action={
            <Button size="sm" variant="surface" disabled={invalid} onClick={() => downloadExport(a.login, "history", q.from, q.to)}>
              <Download /> CSV
            </Button>
          }
        />
        <div className="px-4 pb-5 pt-4 sm:px-6">
          <div className="mb-3">
            <RangePicker value={range} onChange={setRange} />
          </div>
          {loading && <TableSkeleton />}
          {error && !data && (
            <EmptyState
              illustration="satellite_antenna"
              title="Couldn't load the history"
              text={error.message}
              action={
                <Button size="sm" variant="surface" onClick={reload}>
                  <RotateCw /> Try again
                </Button>
              }
            />
          )}
          {data && data.deals.length === 0 && <EmptyState illustration="chart_increasing" title="No deals in this period" text="Trades you place in Kalks Trader appear here with their entry and exit deals." />}
          {data && data.deals.length > 0 && (
            <>
              <DealsTable deals={data.deals} cur={cur} />
              <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
            </>
          )}
        </div>
      </Card>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* Ledger                                                              */
/* ------------------------------------------------------------------ */

export function LedgerPanel({ a, title = "Balance ledger" }: { a: Pick<EngineAccount, "login" | "cent" | "currency" | "balance">; title?: string }) {
  const cur = curOf(a);
  const [range, setRange] = React.useState<Range>({ preset: "all" });
  const [page, setPage] = React.useState(1);
  const limit = 25;
  const q = rangeQuery(range);
  const invalid = range.preset === "custom" && (!range.from || !range.to || range.from > range.to);
  const path = invalid ? null : `accounts/${a.login}/ledger?${qs({ ...q, page, limit })}`;
  const { data, error, loading, reload } = usePoll<LedgerPage>(path, 0);
  React.useEffect(() => setPage(1), [range.preset, range.from, range.to, a.login]);

  return (
    <Reveal>
      <Card>
        <CardHeader
          title={title}
          subtitle={
            <span>
              Every balance, credit and bonus movement · current balance <span className="k-num font-medium text-fg">{fmtAmount(a.balance, cur)}</span>
            </span>
          }
          action={
            <Button size="sm" variant="surface" disabled={invalid} onClick={() => downloadExport(a.login, "ledger", q.from, q.to)}>
              <Download /> CSV
            </Button>
          }
        />
        <div className="px-4 pb-5 pt-4 sm:px-6">
          <div className="mb-3">
            <RangePicker value={range} onChange={setRange} />
          </div>
          {loading && <TableSkeleton />}
          {error && !data && (
            <EmptyState
              illustration="satellite_antenna"
              title="Couldn't load the ledger"
              text={error.message}
              action={
                <Button size="sm" variant="surface" onClick={reload}>
                  <RotateCw /> Try again
                </Button>
              }
            />
          )}
          {data && data.items.length === 0 && <EmptyState illustration="receipt" title="No ledger entries in this period" text="Deposits, trade results, commissions and demo refills are booked here." />}
          {data && data.items.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[13.5px]">
                  <thead>
                    <tr>
                      <th className={cn(TH, "pl-5 text-left")}>Date</th>
                      <th className={cn(TH, "text-left")}>Type</th>
                      <th className={cn(TH, "text-left")}>Reference</th>
                      <th className={cn(TH, "text-left")}>Sub-ledger</th>
                      <th className={cn(TH, "text-right")}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((e, i) => {
                      const k = ledgerKind(e.kind);
                      const c = e.currency === "USC" ? "USC " : e.currency === "USD" ? "$" : `${e.currency} `;
                      return (
                        <tr key={`${e.txn}-${e.subLedger}-${i}`} className="hover:bg-surface-2/60">
                          <td className={cn(TD, "k-num whitespace-nowrap pl-5 text-[12.5px] text-fg-2")}>{serverTime(e.at)}</td>
                          <td className={TD}>
                            <Chip size="sm" tone={k.tone}>
                              {k.label}
                            </Chip>
                          </td>
                          <td className={cn(TD, "max-w-[260px] truncate text-[12.5px] text-fg-3")}>
                            <span className="font-mono">#{e.txn}</span>
                            {e.note ? ` · ${e.note}` : e.reference ? ` · ${e.reference}` : ""}
                          </td>
                          <td className={cn(TD, "text-[12.5px] capitalize text-fg-2")}>{e.subLedger}</td>
                          <td className={cn(TD, "text-right")}>
                            <span className={cn("k-num inline-flex items-center gap-1 font-medium", e.amount > 0 ? "text-up" : e.amount < 0 ? "text-down" : "text-fg-3")}>
                              {e.amount > 0 ? <ArrowDownLeft className="size-3.5" /> : e.amount < 0 ? <ArrowUpRight className="size-3.5" /> : null}
                              {fmtAmount(e.amount, c, true)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
            </>
          )}
        </div>
      </Card>
    </Reveal>
  );
}
