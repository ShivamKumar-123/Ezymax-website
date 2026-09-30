"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownLeft, ArrowUpRight, CandlestickChart, Coins, Moon, Receipt, Ruler, X } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  DataTable,
  Dialog,
  EmptyState,
  Money,
  PriceText,
  Reveal,
  Segmented,
  SymbolAvatar,
  SymbolCell,
  cn,
  formatDateTime,
  formatNumber,
  type Column,
  useQuotes,
} from "@kalks/ui";
import { getInstrument, positionProfit, type ClosedTrade, type Position, type TradingAccount } from "@kalks/mock";
import { accountLedger, spreadCost, type LedgerEntry } from "@kalks/mock/accounts-extra";
import { curOf, multOf } from "./detail-overview";
import { Trans, useT } from "@kalks/i18n/react";
import type { MessageKey } from "@kalks/i18n";
import { TERMINAL_URL } from "@/lib/live";

const signed = (v: number, cur: string) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${cur}${formatNumber(Math.abs(v))}`;

/* ------------------------------------------------------------------ */
/* Positions                                                           */
/* ------------------------------------------------------------------ */

export function PositionsTab({ a, positions, onClose }: { a: TradingAccount; positions: Position[]; onClose: (tickets: string[]) => void }) {
  const t = useT();
  const cur = curOf(a);
  const mult = multOf(a);
  const qs = useQuotes(positions.length ? positions.map((p) => p.symbol) : ["EURUSD"]);
  const [confirm, setConfirm] = React.useState<Position | "all" | null>(null);
  const [filter, setFilter] = React.useState<"all" | "profit" | "loss">("all");
  const rows = positions.map((p) => ({ p, pnl: positionProfit(p, qs[p.symbol]!.bid, qs[p.symbol]!.ask) * mult }));
  const view = rows.filter((r) => (filter === "all" ? true : filter === "profit" ? r.pnl >= 0 : r.pnl < 0));
  const total = rows.reduce((s, r) => s + r.pnl, 0);

  if (positions.length === 0)
    return (
      <Card>
        <EmptyState
          art="emptyPosition"
          title={t("accountDetail.positions.noneTitle")}
          text={t("accountDetail.positions.noneText")}
          action={
            <Link target="_blank" rel="noopener" href={`${TERMINAL_URL}/?account=${a.login}`}>
              <Button variant="ember">
                <CandlestickChart /> {t("accountDetail.positions.openTerminal")}
              </Button>
            </Link>
          }
        />
      </Card>
    );

  const doClose = () => {
    if (!confirm) return;
    const list = confirm === "all" ? positions : [confirm];
    const pnl = list.reduce((s, p) => s + positionProfit(p, qs[p.symbol]!.bid, qs[p.symbol]!.ask) * mult, 0);
    onClose(list.map((p) => p.ticket));
    toast.success(confirm === "all" ? t("accountDetail.close.toastAll", { count: list.length }) : t("accountDetail.close.toastOne", { ticket: confirm.ticket, symbol: confirm.symbol }), { description: t("accountDetail.close.realised", { amount: signed(pnl, cur) }) });
    setConfirm(null);
  };

  return (
    <Reveal>
      <Card>
        <CardHeader
          title={t("accountDetail.overview.openPositions")}
          subtitle={
            <span>
              <Trans k="accountDetail.positions.subtitle" vars={{ count: positions.length, amount: signed(total, cur) }} tags={{ pnl: (c) => <span className={cn("k-num font-medium", total >= 0 ? "text-up" : "text-down")}>{c}</span> }} />
            </span>
          }
          action={
            <>
              <Segmented size="xs" value={filter} onChange={setFilter} options={[{ value: "all", label: t("common.all") }, { value: "profit", label: t("common.profit") }, { value: "loss", label: t("common.loss") }]} />
              <Button size="sm" variant="down-outline" onClick={() => setConfirm("all")}>
                {t("accountDetail.close.all")}
              </Button>
            </>
          }
        />
        <div className="mt-4 overflow-x-auto px-4 pb-5 sm:px-6">
          <table className="w-full min-w-[860px] border-separate border-spacing-y-2 text-[13.5px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-fg-3">
                <th className="px-4 text-start font-medium">{t("accountDetail.col.symbol")}</th>
                <th className="px-3 text-start font-medium">{t("accountDetail.col.ticket")}</th>
                <th className="px-3 text-end font-medium">{t("accountDetail.col.volume")}</th>
                <th className="px-3 text-end font-medium">{t("accountDetail.col.open")}</th>
                <th className="px-3 text-end font-medium">{t("accountDetail.col.current")}</th>
                <th className="px-3 text-end font-medium">{t("accountDetail.col.slTp")}</th>
                <th className="px-3 text-end font-medium">{t("accountDetail.col.swap")}</th>
                <th className="px-3 text-end font-medium">{t("accountDetail.col.pnl")}</th>
                <th className="px-4" />
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {view.map(({ p, pnl }) => {
                  const q = qs[p.symbol]!;
                  const inst = getInstrument(p.symbol);
                  return (
                    <motion.tr key={p.ticket} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: 30 }} className="bg-surface-2">
                      <td className="rounded-s-[14px] border-y border-s border-line px-4 py-3">
                        <div className="flex items-center gap-3">
                          <SymbolAvatar symbol={p.symbol} size={26} />
                          <div>
                            <div className="flex items-center gap-2 font-medium">
                              {p.symbol}
                              <Chip size="sm" tone={p.side === "buy" ? "up" : "down"}>
                                {p.side === "buy" ? t("accountDetail.side.buy") : t("accountDetail.side.sell")}
                              </Chip>
                            </div>
                            <div className="text-[11px] text-fg-3">
                              {formatDateTime(p.openTime)} · {p.source}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="border-y border-line px-3 font-mono text-[12px] text-fg-3">#{p.ticket}</td>
                      <td className="k-num border-y border-line px-3 text-end">{p.volume.toFixed(2)}</td>
                      <td className="k-num border-y border-line px-3 text-end font-mono text-fg-2">{formatNumber(p.openPrice, inst.digits)}</td>
                      <td className="border-y border-line px-3 text-end">
                        <PriceText symbol={p.symbol} value={p.side === "buy" ? q.bid : q.ask} dir={q.dir} className="text-[13px]" />
                      </td>
                      <td className="k-num border-y border-line px-3 text-end font-mono text-[12px] text-fg-3">
                        <span className="text-down/80">{p.sl ? formatNumber(p.sl, inst.digits) : "—"}</span> / <span className="text-up/80">{p.tp ? formatNumber(p.tp, inst.digits) : "—"}</span>
                      </td>
                      <td className={cn("k-num border-y border-line px-3 text-end text-[12.5px]", p.swap < 0 ? "text-down" : "text-fg-2")}>{formatNumber(p.swap * mult)}</td>
                      <td className={cn("k-num border-y border-line px-3 text-end text-[14px] font-semibold", pnl >= 0 ? "text-up" : "text-down")}>{signed(pnl, cur)}</td>
                      <td className="rounded-e-[14px] border-y border-e border-line px-4 text-end">
                        <Button size="xs" variant="surface" onClick={() => setConfirm(p)}>
                          <X /> {t("common.close")}
                        </Button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </Card>
      <Dialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === "all" ? t("accountDetail.close.confirmAll", { count: positions.length }) : confirm ? t("accountDetail.close.confirmOne", { symbol: confirm.symbol, ticket: confirm.ticket }) : ""}
        description={t("accountDetail.close.description")}
        width={440}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="sell" onClick={doClose}>
              {t("accountDetail.close.atMarket")}
            </Button>
          </>
        }
      >
        {confirm && (
          <div className="space-y-2">
            {(confirm === "all" ? positions : [confirm]).map((p) => {
              const q = qs[p.symbol]!;
              const pnl = positionProfit(p, q.bid, q.ask) * mult;
              return (
                <div key={p.ticket} className="k-row flex items-center gap-3 px-4 py-2.5">
                  <SymbolAvatar symbol={p.symbol} size={22} />
                  <div className="flex-1 text-[13px] font-medium">
                    {p.symbol} <span className="text-fg-3">{p.side === "buy" ? t("accountDetail.side.buy") : t("accountDetail.side.sell")} {p.volume}</span>
                  </div>
                  <span className={cn("k-num text-[13px] font-semibold", pnl >= 0 ? "text-up" : "text-down")}>{signed(pnl, cur)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Dialog>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

export function HistoryTab({ a, trades }: { a: TradingAccount; trades: ClosedTrade[] }) {
  const tt = useT();
  const cur = curOf(a);
  const mult = multOf(a);
  const [side, setSide] = React.useState<"all" | "buy" | "sell">("all");
  const rows = trades.filter((t) => side === "all" || t.side === side);
  const cols: Column<ClosedTrade>[] = [
    { key: "sym", header: tt("accountDetail.col.symbol"), cell: (t) => <SymbolCell symbol={t.symbol} size={24} sub={<span className="font-mono">#{t.ticket}</span>} />, sort: (t) => t.symbol },
    { key: "side", header: tt("accountDetail.col.side"), cell: (t) => <Chip size="sm" tone={t.side === "buy" ? "up" : "down"}>{t.side === "buy" ? tt("accountDetail.side.buy") : tt("accountDetail.side.sell")}</Chip> },
    { key: "vol", header: tt("accountDetail.col.volume"), align: "right", cell: (t) => <span className="k-num">{t.volume.toFixed(2)}</span>, sort: (t) => t.volume },
    { key: "open", header: tt("accountDetail.col.open"), align: "right", hideOn: "md", cell: (t) => <span className="k-num font-mono text-fg-2">{formatNumber(t.openPrice, getInstrument(t.symbol).digits)}</span> },
    { key: "close", header: tt("accountDetail.col.close"), align: "right", hideOn: "md", cell: (t) => <span className="k-num font-mono">{formatNumber(t.closePrice, getInstrument(t.symbol).digits)}</span> },
    { key: "time", header: tt("accountDetail.col.closed"), hideOn: "lg", cell: (t) => <span className="k-num text-[12.5px] text-fg-2">{formatDateTime(t.closeTime)}</span>, sort: (t) => t.closeTime },
    { key: "swap", header: tt("accountDetail.col.swap"), align: "right", hideOn: "lg", cell: (t) => <span className="k-num text-[12.5px] text-fg-3">{formatNumber(t.swap * mult)}</span> },
    { key: "comm", header: tt("accountDetail.col.comm"), align: "right", hideOn: "lg", cell: (t) => <span className="k-num text-[12.5px] text-fg-3">{formatNumber(-t.commission * mult)}</span> },
    { key: "pnl", header: tt("common.profit"), align: "right", cell: (t) => <span className={cn("k-num font-semibold", t.profit >= 0 ? "text-up" : "text-down")}>{signed(t.profit * mult, cur)}</span>, sort: (t) => t.profit },
  ];
  const net = rows.reduce((s, t) => s + t.profit, 0) * mult;
  return (
    <Reveal>
      <Card>
        <CardHeader title={tt("accountDetail.history.title")} subtitle={<span><Trans k="accountDetail.history.closedSummary" vars={{ count: rows.length, amount: signed(net, cur) }} tags={{ net: (c) => <span className={cn("k-num font-medium", net >= 0 ? "text-up" : "text-down")}>{c}</span> }} /></span>} />
        <div className="px-4 pb-5 pt-4 sm:px-6">
          <DataTable
            columns={cols}
            rows={rows}
            rowKey={(t) => t.ticket}
            pageSize={12}
            search={(t) => `${t.symbol} ${t.ticket}`}
            searchPlaceholder={tt("accountDetail.history.searchPlaceholder")}
            exportName={`kalks-${a.login}-history`}
            toolbar={<Segmented size="xs" value={side} onChange={setSide} options={[{ value: "all", label: tt("common.all") }, { value: "buy", label: tt("common.buy") }, { value: "sell", label: tt("common.sell") }]} />}
          />
        </div>
      </Card>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* Charges                                                             */
/* ------------------------------------------------------------------ */

export function ChargesTab({ a, trades }: { a: TradingAccount; trades: ClosedTrade[] }) {
  const tt = useT();
  const cur = curOf(a);
  const mult = multOf(a);
  const rows = trades.map((t) => ({ t, spread: spreadCost(t) * mult, comm: t.commission * mult, swap: -t.swap * mult }));
  const tot = rows.reduce((s, r) => ({ spread: s.spread + r.spread, comm: s.comm + r.comm, swap: s.swap + r.swap }), { spread: 0, comm: 0, swap: 0 });
  const fees = a.swapFree ? 0 : 0;
  const all = tot.spread + tot.comm + tot.swap + fees;
  const bySym = React.useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.t.symbol, (m.get(r.t.symbol) ?? 0) + r.spread + r.comm + r.swap));
    return [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8);
  }, [rows]);
  const maxSym = bySym[0]?.[1] ?? 1;
  const tiles = [
    { label: tt("accountDetail.col.commission"), v: tot.comm, icon: <Receipt />, note: a.group === "ECN" ? tt("accountDetail.charges.ecnNote") : tt("accountDetail.charges.rawNote") },
    { label: tt("accountDetail.col.swap"), v: tot.swap, icon: <Moon />, note: a.swapFree ? tt("accountDetail.charges.swapFreeNote") : tt("accountDetail.charges.overnight") },
    { label: tt("accountDetail.charges.spreadCost"), v: tot.spread, icon: <Ruler />, note: tt("accountDetail.charges.estimated") },
    { label: tt("accountDetail.charges.fees"), v: fees, icon: <Coins />, note: tt("accountDetail.charges.noFees") },
  ];
  const cols: Column<(typeof rows)[number]>[] = [
    { key: "sym", header: tt("accountDetail.col.trade"), cell: (r) => <SymbolCell symbol={r.t.symbol} size={22} sub={<span className="font-mono">#{r.t.ticket}</span>} /> },
    { key: "time", header: tt("accountDetail.col.closed"), hideOn: "md", cell: (r) => <span className="k-num text-[12.5px] text-fg-2">{formatDateTime(r.t.closeTime)}</span> },
    { key: "vol", header: tt("accountDetail.col.lots"), align: "right", cell: (r) => <span className="k-num">{r.t.volume.toFixed(2)}</span> },
    { key: "spread", header: tt("accountDetail.col.spread"), align: "right", cell: (r) => <span className="k-num text-fg-2">{formatNumber(r.spread)}</span>, sort: (r) => r.spread },
    { key: "comm", header: tt("accountDetail.col.commission"), align: "right", cell: (r) => <span className="k-num text-fg-2">{formatNumber(r.comm)}</span>, sort: (r) => r.comm },
    { key: "swap", header: tt("accountDetail.col.swap"), align: "right", cell: (r) => <span className={cn("k-num", r.swap < 0 ? "text-up" : "text-fg-2")}>{formatNumber(r.swap)}</span>, sort: (r) => r.swap },
    { key: "tot", header: tt("accountDetail.col.totalCost"), align: "right", cell: (r) => <span className="k-num font-semibold">{cur}{formatNumber(r.spread + r.comm + r.swap)}</span>, sort: (r) => r.spread + r.comm + r.swap },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {tiles.map((t, i) => (
          <Reveal key={t.label} delay={i * 0.05}>
            <Card className="h-full px-5 py-5">
              <div className="flex items-start justify-between">
                <span className="k-label">{t.label}</span>
                <span className="grid size-9 place-items-center rounded-full border border-line bg-surface-2 text-fg-2 [&_svg]:size-4">{t.icon}</span>
              </div>
              <Money value={t.v} currency={cur} className="mt-3 block text-[24px] font-semibold tracking-tight" />
              <div className="mt-1 text-[12px] text-fg-3">{t.note}</div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-3">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-ember to-gold" initial={{ width: 0 }} animate={{ width: `${all ? (t.v / all) * 100 : 0}%` }} transition={{ duration: 0.8, delay: 0.2 + i * 0.05 }} />
              </div>
            </Card>
          </Reveal>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Reveal delay={0.1} className="xl:col-span-4">
          <Card className="h-full">
            <CardHeader title={tt("accountDetail.charges.bySymbol")} subtitle={<span><Trans k="accountDetail.charges.totalCost" vars={{ amount: `${cur}${formatNumber(all)}` }} tags={{ v: (c) => <span className="k-num font-medium text-fg">{c}</span> }} /></span>} />
            <div className="space-y-3 px-6 pb-6 pt-5">
              {bySym.map(([s, v]) => (
                <div key={s}>
                  <div className="mb-1.5 flex items-center gap-2 text-[13px]">
                    <SymbolAvatar symbol={s} size={18} />
                    <span className="flex-1 font-medium">{s}</span>
                    <span className="k-num text-fg-2">{cur}{formatNumber(v)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <motion.div className="h-full rounded-full bg-gold" initial={{ width: 0 }} animate={{ width: `${(v / maxSym) * 100}%` }} transition={{ duration: 0.7 }} />
                  </div>
                </div>
              ))}
              <div className="k-row mt-4 px-4 py-3 text-[12.5px] text-fg-3">
                {tt("accountDetail.charges.costPerLot")} <span className="k-num float-end font-medium text-fg">{cur}{formatNumber(all / (trades.reduce((s, t) => s + t.volume, 0) || 1))}</span>
              </div>
            </div>
          </Card>
        </Reveal>
        <Reveal delay={0.15} className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader title={tt("accountDetail.charges.perTrade")} subtitle={tt("accountDetail.charges.perTradeSub")} />
            <div className="px-4 pb-5 pt-4 sm:px-6">
              <DataTable columns={cols} rows={rows} rowKey={(r) => r.t.ticket} pageSize={7} exportName={`kalks-${a.login}-charges`} search={(r) => r.t.symbol} searchPlaceholder={tt("accountDetail.col.symbol")} />
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ledger                                                              */
/* ------------------------------------------------------------------ */

const LEDGER_KIND = {
  deposit: { label: "accountDetail.ledgerKind.deposit", tone: "up" },
  withdrawal: { label: "accountDetail.ledgerKind.withdrawal", tone: "down" },
  "transfer-in": { label: "accountDetail.ledgerKind.transferIn", tone: "up" },
  "transfer-out": { label: "accountDetail.ledgerKind.transferOut", tone: "down" },
  trade: { label: "accountDetail.ledgerKind.trade", tone: "ember" },
  swap: { label: "accountDetail.ledgerKind.swap", tone: "neutral" },
  commission: { label: "accountDetail.ledgerKind.commission", tone: "neutral" },
  credit: { label: "accountDetail.ledgerKind.credit", tone: "gold" },
  refill: { label: "accountDetail.ledgerKind.refill", tone: "gold" },
} as const satisfies Record<LedgerEntry["kind"], { label: MessageKey; tone: "up" | "down" | "ember" | "gold" | "info" | "neutral" }>;

export function LedgerTab({ a }: { a: TradingAccount }) {
  const t = useT();
  const cur = curOf(a);
  const entries = React.useMemo(() => accountLedger(a), [a]);
  const [kind, setKind] = React.useState<"all" | "funding" | "trading">("all");
  const rows = entries.filter((e) => kind === "all" || (kind === "funding" ? ["deposit", "withdrawal", "transfer-in", "transfer-out", "credit", "refill"].includes(e.kind) : ["trade", "swap", "commission"].includes(e.kind)));
  const inflow = entries.filter((e) => ["deposit", "transfer-in", "refill"].includes(e.kind)).reduce((s, e) => s + e.amount, 0);
  const outflow = entries.filter((e) => ["withdrawal", "transfer-out"].includes(e.kind)).reduce((s, e) => s + e.amount, 0);
  const trading = entries.filter((e) => ["trade", "swap", "commission"].includes(e.kind)).reduce((s, e) => s + e.amount, 0);
  const cols: Column<LedgerEntry>[] = [
    { key: "time", header: t("common.date"), cell: (e) => <span className="k-num text-[12.5px] text-fg-2">{formatDateTime(e.time, { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>, sort: (e) => e.time },
    { key: "kind", header: t("common.type"), cell: (e) => <Chip size="sm" tone={LEDGER_KIND[e.kind].tone}>{t(LEDGER_KIND[e.kind].label)}</Chip> },
    { key: "desc", header: t("accountDetail.col.description"), hideOn: "md", cell: (e) => <span className="text-fg-2">{e.description}</span> },
    {
      key: "amt",
      header: t("common.amount"),
      align: "right",
      cell: (e) => (
        <span className={cn("k-num inline-flex items-center gap-1 font-medium", e.amount > 0 ? "text-up" : e.amount < 0 ? "text-down" : "text-fg-3")}>
          {e.amount > 0 ? <ArrowDownLeft className="size-3.5" /> : e.amount < 0 ? <ArrowUpRight className="size-3.5" /> : null}
          {signed(e.amount, cur)}
        </span>
      ),
      sort: (e) => e.amount,
    },
    { key: "bal", header: t("common.balance"), align: "right", cell: (e) => <span className="k-num font-semibold">{cur}{formatNumber(e.balance)}</span> },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { l: t("accountDetail.ledger.fundsIn"), v: inflow, tone: "up" as const },
          { l: t("accountDetail.ledger.fundsOut"), v: outflow, tone: "down" as const },
          { l: t("accountDetail.ledger.tradingResult"), v: trading, tone: trading >= 0 ? ("up" as const) : ("down" as const) },
        ].map((x, i) => (
          <Reveal key={x.l} delay={i * 0.05}>
            <Card className="px-5 py-4">
              <div className="k-label">{x.l}</div>
              <Money value={x.v} currency={cur} signed tone={x.tone} className="mt-2 block text-[22px] font-semibold" />
            </Card>
          </Reveal>
        ))}
      </div>
      <Reveal delay={0.1}>
        <Card>
          <CardHeader title={t("accountDetail.ledger.title")} subtitle={<span><Trans k="accountDetail.ledger.runningBalance" vars={{ balance: `${cur}${formatNumber(a.balance)}` }} tags={{ bal: (c) => <span className="k-num font-medium text-fg">{c}</span> }} /></span>} />
          <div className="px-4 pb-5 pt-4 sm:px-6">
            <DataTable
              columns={cols}
              rows={rows}
              rowKey={(e) => e.id}
              pageSize={12}
              dense
              exportName={`kalks-${a.login}-ledger`}
              search={(e) => `${e.description} ${t(LEDGER_KIND[e.kind].label)}`}
              toolbar={<Segmented size="xs" value={kind} onChange={setKind} options={[{ value: "all", label: t("common.all") }, { value: "funding", label: t("accountDetail.ledger.funding") }, { value: "trading", label: t("accountDetail.ledger.trading") }]} />}
            />
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
