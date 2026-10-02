"use client";

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Download, RotateCw } from "lucide-react";
import { Button, Card, CardHeader, Chip, EmptyState, IconButton, Input, Reveal, Segmented, Skeleton, cn } from "@kalks/ui";
import {
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
import { SharePeriodButton, ShareTradeButton } from "@/components/growth/share-dialog";
import { Trans, useT } from "@kalks/i18n/react";
import { OptionPremium as Premium, OptionTag, TradeSymbolAvatar, fmtContracts, optionLabel, reasonLabel } from "./instrument";
import { dealPremiumsUsd, isOptionTrade, optionTerms, usdFactorOf, type InstrumentFilter } from "./option-deal";

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
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        size="xs"
        value={value.preset}
        onChange={(p) => onChange(p === "custom" ? { preset: p, from: value.from ?? isoDay(new Date(Date.now() - 29 * 86400000)), to: value.to ?? isoDay(new Date()) } : { preset: p })}
        options={[
          { value: "7d", label: t("accountDetail.range.7d") },
          { value: "30d", label: t("accountDetail.range.30d") },
          { value: "90d", label: t("accountDetail.range.90d") },
          { value: "all", label: t("common.all") },
          { value: "custom", label: t("accountDetail.range.custom") },
        ]}
      />
      {value.preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input type="date" aria-label={t("accountDetail.range.from")} className="h-8 w-[150px]" inputClassName="text-[12.5px]" value={value.from ?? ""} max={value.to} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <span className="text-fg-3">–</span>
          <Input type="date" aria-label={t("accountDetail.range.to")} className="h-8 w-[150px]" inputClassName="text-[12.5px]" value={value.to ?? ""} min={value.from} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </div>
      )}
    </div>
  );
}

function Pager({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (p: number) => void }) {
  const t = useT();
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-[12.5px] text-fg-3">
      <span className="k-num">
        {t("accountDetail.pager.range", { from: (page - 1) * limit + 1, to: Math.min(total, page * limit), total })}
      </span>
      <div className="flex items-center gap-1.5">
        <IconButton size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t("accountDetail.pager.prev")}>
          <ChevronLeft className="rtl:-scale-x-100" />
        </IconButton>
        <span className="k-num px-2">
          {page} / {pages}
        </span>
        <IconButton size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={t("accountDetail.pager.next")}>
          <ChevronRight className="rtl:-scale-x-100" />
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

const TH = "bg-surface-2 px-4 py-3 text-[11.5px] font-medium uppercase tracking-[0.05em] text-fg-3 border-y border-line first:rounded-s-[14px] first:border-s last:rounded-e-[14px] last:border-e";
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

export function DealsTable({ deals, cur, usdFactor }: { deals: EngineDeal[]; cur: string; usdFactor?: number }) {
  const t = useT();
  // cent accounts book money in US cents; option premiums are shown in USD per contract
  const k = usdFactor ?? usdFactorOf({ currency: cur.trim() });
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-separate border-spacing-0 text-[13.5px]">
        <thead>
          <tr>
            <th className={cn(TH, "ps-5 text-start")}>{t("accountDetail.col.symbol")}</th>
            <th className={cn(TH, "text-start")}>{t("accountDetail.col.deal")}</th>
            <th className={cn(TH, "text-start")}>{t("accountDetail.col.direction")}</th>
            <th className={cn(TH, "text-end")}>{t("accountDetail.col.volume")}</th>
            <th className={cn(TH, "text-end")}>{t("accountDetail.col.price")}</th>
            <th className={cn(TH, "text-start")}>{t("common.time")}</th>
            <th className={cn(TH, "text-end")}>{t("accountDetail.col.commission")}</th>
            <th className={cn(TH, "text-end")}>{t("accountDetail.col.swap")}</th>
            <th className={cn(TH, "text-end")}>{t("common.profit")}</th>
            <th className={cn(TH, "w-12 text-end")}>
              <span className="sr-only">{t("accountDetail.col.share")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d) => {
            const exit = d.entry !== "in";
            const opt = isOptionTrade(d) ? optionTerms(d.symbol, d.option) : null;
            const isOpt = isOptionTrade(d);
            const name = opt ? optionLabel(t, opt) : d.symbol;
            const prem = isOpt ? dealPremiumsUsd(d, k) : null;
            // an option exit always says how it ended (closed / expired / knocked out / stop-out); a CFD exit only when not closed by the client
            const reason = exit && (isOpt || d.reason !== "client") ? reasonLabel(t, d.reason) : null;
            return (
              <tr key={d.id} className={cn("hover:bg-surface-2/60", d.reversed && "opacity-50")}>
                <td className={cn(TD, "ps-5")}>
                  <div className="flex items-center gap-2.5">
                    <TradeSymbolAvatar symbol={opt?.series ?? d.symbol} size={24} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                        <span className="whitespace-nowrap" title={isOpt ? d.symbol : undefined}>
                          {name}
                        </span>
                        <Chip size="sm" tone={d.side === "buy" ? "up" : "down"}>
                          {d.side === "buy" ? t("accountDetail.side.buy") : t("accountDetail.side.sell")}
                        </Chip>
                        {isOpt && <OptionTag />}
                      </div>
                      <div className="font-mono text-[11px] text-fg-3">{t("accountDetail.deal.position", { ticket: d.positionTicket })}</div>
                    </div>
                  </div>
                </td>
                <td className={cn(TD, "font-mono text-[12px] text-fg-3")}>#{d.id}</td>
                <td className={TD}>
                  <span className="text-[12.5px] text-fg-2">{exit ? t("accountDetail.deal.out") : t("accountDetail.deal.in")}</span>
                  {reason && (
                    <span className={cn("ms-1.5 text-[11.5px]", d.reason === "stop_out" || d.reason === "knock_out" ? "text-down" : d.reason === "expiry" ? "text-gold" : "text-fg-3")}>· {reason}</span>
                  )}
                  {d.reversed && (
                    <Chip size="sm" className="ms-1.5">
                      {t("accountDetail.deal.reversed")}
                    </Chip>
                  )}
                </td>
                <td className={cn(TD, "k-num whitespace-nowrap text-end")}>{isOpt ? t("accounts.opt.contracts", { count: fmtContracts(d.volume) }) : d.volume.toFixed(2)}</td>
                <td className={cn(TD, "k-num text-end font-mono text-fg-2")}>
                  {prem ? (
                    <>
                      <Premium usd={prem.own} unit={d.price} currency={opt?.quoteCurrency} />
                      {exit && (prem.open !== null || d.openPrice !== null) && (
                        <div className="whitespace-nowrap font-sans text-[11px] text-fg-3">
                          {t("accounts.opt.openAt", { amount: prem.open !== null ? fmtAmount(prem.open, "$") : `${fmtPrice(d.openPrice)}${opt?.quoteCurrency ? ` ${opt.quoteCurrency}` : ""}` })}
                        </div>
                      )}
                    </>
                  ) : (
                    fmtPrice(d.price)
                  )}
                </td>
                <td className={cn(TD, "k-num whitespace-nowrap text-[12.5px] text-fg-2")}>{serverTime(d.time)}</td>
                <td className={cn(TD, "k-num text-end text-[12.5px] text-fg-3")}>{d.commission ? fmtAmount(-Math.abs(d.commission), "") : "—"}</td>
                <td className={cn(TD, "k-num text-end text-[12.5px] text-fg-3")}>{d.swap ? fmtAmount(d.swap, "") : "—"}</td>
                <td className={cn(TD, "k-num text-end font-semibold", !exit ? "text-fg-3" : d.profit > 0 ? "text-up" : d.profit < 0 ? "text-down" : "")}>{exit ? fmtAmount(d.profit, cur, true) : "—"}</td>
                <td className={cn(TD, "text-end")}>{exit && !d.reversed && <ShareTradeButton login={d.login} dealId={d.id} symbol={name} />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** All / CFD / Options: which deals the history lists (and exports). */
export function InstrumentPicker({ value, onChange }: { value: InstrumentFilter; onChange: (v: InstrumentFilter) => void }) {
  const t = useT();
  return (
    <Segmented
      size="xs"
      value={value}
      onChange={onChange}
      options={[
        { value: "all", label: t("accounts.opt.filter.all") },
        { value: "cfd", label: t("accounts.opt.filter.cfd") },
        { value: "option", label: t("accounts.opt.filter.options") },
      ]}
    />
  );
}

export function HistoryPanel({ a, title }: { a: Pick<EngineAccount, "login" | "cent" | "currency">; title?: string }) {
  const t = useT();
  const cur = curOf(a);
  const [range, setRange] = React.useState<Range>({ preset: "30d" });
  const [inst, setInst] = React.useState<InstrumentFilter>("all");
  const [page, setPage] = React.useState(1);
  const limit = 25;
  const q = rangeQuery(range);
  const invalid = range.preset === "custom" && (!range.from || !range.to || range.from > range.to);
  const path = invalid ? null : `accounts/${a.login}/history?${qs({ ...q, page, limit, instrument: inst === "all" ? undefined : inst })}`;
  const { data, error, loading, reload } = usePoll<HistoryPage>(path, 0);
  React.useEffect(() => setPage(1), [range.preset, range.from, range.to, a.login, inst]);
  // commission is a charge (positive in the engine): the net result takes it off
  const net = data ? data.totals.profit + data.totals.swap - Math.abs(data.totals.commission) : 0;
  const hasOptions = !!data?.deals.some(isOptionTrade);

  return (
    <Reveal>
      <Card>
        <CardHeader
          title={title ?? t("accountDetail.history.title")}
          subtitle={
            data ? (
              <span>
                <Trans
                  k="accountDetail.history.summary"
                  vars={{ count: data.total, net: fmtAmount(net, cur, true), profit: fmtAmount(data.totals.profit, cur, true), swap: fmtAmount(data.totals.swap, cur, true), commission: fmtAmount(-Math.abs(data.totals.commission), cur, true) }}
                  tags={{ net: (c) => <span className={cn("k-num font-medium", net > 0 ? "text-up" : net < 0 ? "text-down" : "text-fg")}>{c}</span> }}
                />
              </span>
            ) : (
              t("accountDetail.history.subtitle")
            )
          }
          action={
            <>
              {data && data.total > 0 && !invalid && <SharePeriodButton login={a.login} from={q.from ?? isoDay(new Date(Date.now() - 5 * 365 * 86400_000))} to={q.to ?? isoDay(new Date(Date.now() + 86400_000))} />}
              <Button size="sm" variant="surface" disabled={invalid} onClick={() => downloadExport(a.login, "history", q.from, q.to, inst)}>
                <Download /> CSV
              </Button>
            </>
          }
        />
        <div className="px-4 pb-5 pt-4 sm:px-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <InstrumentPicker value={inst} onChange={setInst} />
            <RangePicker value={range} onChange={setRange} />
          </div>
          {loading && <TableSkeleton />}
          {error && !data && (
            <EmptyState
              art="connectionLost"
              title={t("accountDetail.history.loadError")}
              text={error.message}
              action={
                <Button size="sm" variant="surface" onClick={reload}>
                  <RotateCw /> {t("common.retry")}
                </Button>
              }
            />
          )}
          {data && data.deals.length === 0 && (
            <EmptyState
              art="emptyHistory"
              title={inst === "option" ? t("accounts.opt.emptyOptions") : inst === "cfd" ? t("accounts.opt.emptyCfd") : t("accountDetail.history.emptyTitle")}
              text={inst === "option" ? t("accounts.opt.emptyOptionsText") : t("accountDetail.history.emptyText")}
            />
          )}
          {data && data.deals.length > 0 && (
            <>
              <DealsTable deals={data.deals} cur={cur} usdFactor={usdFactorOf(a)} />
              {hasOptions && <div className="mt-2 text-[11.5px] text-fg-3">{t("accounts.opt.premiumHint")}</div>}
              {data.truncated && <div className="mt-2 text-[11.5px] text-warn">{t("accounts.opt.truncated", { count: data.total })}</div>}
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

export function LedgerPanel({ a, title }: { a: Pick<EngineAccount, "login" | "cent" | "currency" | "balance">; title?: string }) {
  const t = useT();
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
          title={title ?? t("accountDetail.ledger.title")}
          subtitle={
            <span>
              <Trans k="accountDetail.ledger.subtitle" vars={{ balance: fmtAmount(a.balance, cur) }} tags={{ bal: (c) => <span className="k-num font-medium text-fg">{c}</span> }} />
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
              art="connectionLost"
              title={t("accountDetail.ledger.loadError")}
              text={error.message}
              action={
                <Button size="sm" variant="surface" onClick={reload}>
                  <RotateCw /> {t("common.retry")}
                </Button>
              }
            />
          )}
          {data && data.items.length === 0 && <EmptyState art="emptyHistory" title={t("accountDetail.ledger.emptyTitle")} text={t("accountDetail.ledger.emptyText")} />}
          {data && data.items.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[13.5px]">
                  <thead>
                    <tr>
                      <th className={cn(TH, "ps-5 text-start")}>{t("common.date")}</th>
                      <th className={cn(TH, "text-start")}>{t("common.type")}</th>
                      <th className={cn(TH, "text-start")}>{t("accountDetail.col.reference")}</th>
                      <th className={cn(TH, "text-start")}>{t("accountDetail.col.subLedger")}</th>
                      <th className={cn(TH, "text-end")}>{t("common.amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((e, i) => {
                      const k = ledgerKind(e.kind);
                      const kindLabel = t.dyn(`accounts.ledgerKind.${e.kind}`, k.label);
                      const c = e.currency === "USC" ? "USC " : e.currency === "USD" ? "$" : `${e.currency} `;
                      return (
                        <tr key={`${e.txn}-${e.subLedger}-${i}`} className="hover:bg-surface-2/60">
                          <td className={cn(TD, "k-num whitespace-nowrap ps-5 text-[12.5px] text-fg-2")}>{serverTime(e.at)}</td>
                          <td className={TD}>
                            <Chip size="sm" tone={k.tone}>
                              {kindLabel}
                            </Chip>
                          </td>
                          <td className={cn(TD, "max-w-[260px] truncate text-[12.5px] text-fg-3")}>
                            <span className="font-mono">#{e.txn}</span>
                            {e.note ? ` · ${e.note}` : e.reference ? ` · ${e.reference}` : ""}
                          </td>
                          <td className={cn(TD, "text-[12.5px] capitalize text-fg-2")}>{t.dyn(`accountDetail.subLedger.${e.subLedger}`, e.subLedger)}</td>
                          <td className={cn(TD, "text-end")}>
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
