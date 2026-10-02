"use client";

import * as React from "react";
import { toast } from "@/lib/notify";
import { Bell, BellOff, Copy, Newspaper, Pencil, Plus, Trash2 } from "lucide-react";
import { CALENDAR, INSTRUMENTS, NEWS, getInstrument, priceFeed } from "@kalks/mock";
import { Flag, SymbolAvatar, cn, useQuote, useQuotes } from "@kalks/ui";
import { journalTime, useTerminal, type JournalLine } from "@/lib/store";
import { accCcy, accMoney, fmtPrice, fmtServer, fmtVol, splitSymbol } from "@/lib/trading";
import { Td, Th } from "@/components/ui/panel";
import { PickBox } from "@/components/share/share-dialogs";
import { shareUi, useShareUi } from "@/lib/share";
import { useContextMenu } from "@/components/ui/menu";
import { Share2 } from "lucide-react";
import { Badge, Empty, Pnl, Stepper, TButton, TInput, TSelect } from "@/components/ui/primitives";
import { useLocale, useT } from "@kalks/i18n/react";
import { loadOptionHistory, useOptionBook, type OptClosed } from "@/lib/options/book";
import type { TClosed } from "@/lib/trading";
import { sideLabel } from "./trade-tab";

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

const PERIODS = [
  { value: "today", labelKey: "toolbox.history.period.today", days: 1 },
  { value: "3d", labelKey: "toolbox.history.period.3d", days: 3 },
  { value: "week", labelKey: "toolbox.history.period.week", days: 7 },
  { value: "month", labelKey: "toolbox.history.period.month", days: 30 },
  { value: "3m", labelKey: "toolbox.history.period.3m", days: 90 },
  { value: "all", labelKey: "toolbox.history.period.all", days: 99999 },
] as const;
type Period = (typeof PERIODS)[number]["value"];

/** "1.1" → "1.1", 3925 → "3925": a strike with the ladder's decimals (trailing zeros trimmed). */
const strikeLabel = (k: number) => (Number.isInteger(k) ? String(k) : String(+k.toFixed(6)));
const usd2 = (v: number) => (Number.isFinite(v) ? v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—");

/** A closed option trade in the History tab: the series, contracts, open / close premium in USD per contract. */
function OptionHistoryRow({ o, picking }: { o: OptClosed; picking: boolean }) {
  const T = useTerminal();
  const t = useT();
  const { locale } = useLocale();
  const a = T.account;
  const k = o.usdPerUnit;
  let expiry = o.option.expiry;
  try {
    expiry = new Date(`${o.option.expiry}T12:00:00Z`).toLocaleDateString(locale, { day: "2-digit", month: "short", timeZone: "UTC" });
  } catch {
    /* keep YYYY-MM-DD */
  }
  const reasonTone = o.reason === "stop_out" || o.reason === "liquidation" || o.reason === "knocked_out" ? "down" : o.reason === "expired" ? "info" : o.reason === "sl" ? "down" : o.reason === "tp" ? "up" : "neutral";
  return (
    <tr className="hover:bg-surface-2/70">
      {picking && <Td className="w-7 ps-3" />}
      <Td mono className={cn("text-fg-3", !picking && "ps-3")}>
        {o.openTime ? fmtServer(o.openTime) : "—"}
      </Td>
      <Td mono className="text-fg-3">
        {o.ticket}
      </Td>
      <Td>
        <span className="flex items-center gap-1.5 font-medium" title={o.option.series}>
          <span className="rounded-[3px] bg-ember-soft px-1 text-[9px] font-bold text-ember">{t("trader.opt.hist.tag")}</span>
          {o.option.underlying}
          <span className="font-mono">{strikeLabel(o.option.strike)}</span>
          <span className={cn("rounded-[3px] px-1 font-mono text-[9.5px] font-semibold", o.option.right === "call" ? "bg-up-soft text-up" : "bg-down-soft text-down")}>{o.option.right === "call" ? t("trader.opt.call") : t("trader.opt.put")}</span>
          <span className="text-[11px] font-normal text-fg-3">{expiry}</span>
        </span>
      </Td>
      <Td>
        <span className={o.side === "buy" ? "text-up" : "text-down"}>{sideLabel(t, o.side)}</span>
      </Td>
      <Td right mono>
        <span title={t("trader.opt.hist.contracts")}>{o.contracts}</span>
      </Td>
      <Td right mono className="text-fg-2">
        <span title={t("trader.opt.hist.premiumHint")}>{k > 0 ? usd2(o.openPrice * k) : "—"}</span>
      </Td>
      <Td right mono className="text-fg-3">
        —
      </Td>
      <Td right mono className="text-fg-3">
        —
      </Td>
      <Td mono className="text-fg-3">
        {o.closeTime ? fmtServer(o.closeTime) : "—"}
      </Td>
      <Td right mono className="text-fg-2">
        <span title={t("trader.opt.hist.premiumHint")}>{k > 0 ? usd2(o.closePrice * k) : "—"}</span>
      </Td>
      <Td right mono className="text-fg-2">
        <span dir="ltr">{accMoney(a, o.swap)}</span>
      </Td>
      <Td right mono className="text-fg-2">
        <span dir="ltr">{accMoney(a, -o.commission)}</span>
      </Td>
      <Td right className="font-semibold">
        <span dir="ltr">
          <Pnl value={o.profit} text={accMoney(a, o.profit)} />
        </span>
      </Td>
      <Td className="text-fg-3">
        {o.reason === "closed" ? <span className="text-[11px]">{t("trader.opt.hist.reason.closed")}</span> : <Badge tone={reasonTone}>{t.dyn(`trader.opt.hist.reason.${o.reason}`, o.rawReason || o.reason)}</Badge>}
      </Td>
    </tr>
  );
}

/** What the History tab lists: every closed trade, CFDs only, or options only. */
type HistKind = "all" | "cfd" | "options";
type HistItem = { k: "cfd"; h: TClosed } | { k: "opt"; o: OptClosed };
const closeTimeOf = (x: HistItem) => Date.parse(x.k === "cfd" ? x.h.closeTime : x.o.closeTime);

export function HistoryTab() {
  const T = useTerminal();
  const t = useT();
  const a = T.account;
  const [period, setPeriod] = React.useState<Period>("month");
  const [sym, setSym] = React.useState("all");
  const [kind, setKind] = React.useState<HistKind>("all");
  const days = PERIODS.find((p) => p.value === period)!.days;
  const now = Date.now();
  const since = period === "today" ? new Date(new Date(now + 3 * 3600e3).toISOString().slice(0, 10) + "T00:00:00Z").getTime() - 3 * 3600e3 : now - days * 86400e3;
  // closed option trades (manual closes, stop-outs, expiry settlements, knock-outs) are kept by the option book
  const optClosed = useOptionBook(T.guest ? null : a.login).closed;
  React.useEffect(() => {
    // live: the engine's older history (the state carries only the latest deals)
    if (!T.engine || T.guest || kind === "cfd") return;
    void loadOptionHistory(a.login, !!a.cent, Math.min(365, Math.max(90, days)));
  }, [T.engine, T.guest, a.login, a.cent, kind, days]);
  const cfdRows = kind === "options" ? [] : T.history.filter((h) => Date.parse(h.closeTime) >= since && (sym === "all" || h.symbol === sym));
  const optRows = kind === "cfd" ? [] : optClosed.filter((o) => Date.parse(o.closeTime) >= since && (sym === "all" || o.option.underlying === sym));
  const rows: { profit: number }[] = [...cfdRows, ...optRows];
  const items: HistItem[] = [...cfdRows.map((h) => ({ k: "cfd" as const, h })), ...optRows.map((o) => ({ k: "opt" as const, o }))].sort((x, y) => closeTimeOf(y) - closeTimeOf(x));
  const syms = [...new Set([...(kind === "options" ? [] : T.history.map((h) => h.symbol)), ...(kind === "cfd" ? [] : optClosed.map((o) => o.option.underlying))])].sort();
  const wins = rows.filter((r) => r.profit > 0);
  const losses = rows.filter((r) => r.profit < 0);
  const gp = wins.reduce((s, r) => s + r.profit, 0);
  const gl = losses.reduce((s, r) => s + r.profit, 0);
  const net = gp + gl;
  const pf = gl !== 0 ? gp / Math.abs(gl) : Infinity;
  const shown = items.slice(0, 300);
  const picking = useShareUi().selecting;
  const cm = useContextMenu(210);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line px-2">
        <div className="flex items-center gap-0.5">
          {PERIODS.map((p) => (
            <button key={p.value} onClick={() => setPeriod(p.value)} className={cn("h-6 rounded-[5px] px-2 text-[11px]", period === p.value ? "bg-surface-3 text-fg" : "text-fg-3 hover:text-fg-2")}>
              {t(p.labelKey)}
            </button>
          ))}
        </div>
        <TSelect ariaLabel={t("toolbox.history.symbolFilter")} value={sym} onChange={setSym} options={[{ value: "all", label: t("toolbox.history.allSymbols") }, ...syms.map((s) => ({ value: s, label: s }))]} className="h-6 w-[130px] text-[11px]" />
        {/* All / CFD / Options: option trades close as contracts of a series (premiums in USD per contract) */}
        <div role="radiogroup" aria-label={t("trader.opt.hist.kind")} className="flex items-center gap-0.5 rounded-[6px] border border-line p-0.5">
          {(["all", "cfd", "options"] as const).map((k) => (
            <button key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={cn("h-5 rounded-[4px] px-2 text-[11px]", kind === k ? "bg-surface-3 text-fg" : "text-fg-3 hover:text-fg-2")}>
              {t(`trader.opt.hist.${k}`)}
              {k === "options" && optClosed.length > 0 && <span className="ms-1 font-mono text-[9.5px] text-fg-3">{optClosed.filter((o) => Date.parse(o.closeTime) >= since).length}</span>}
            </button>
          ))}
        </div>
        <div className="ms-auto flex items-center gap-3 font-mono text-[11px] text-fg-3">
          <span>
            {t("toolbox.history.trades")} <span className="text-fg">{rows.length}</span>
          </span>
          <span>
            {t("toolbox.history.winRate")} <span dir="ltr" className="text-fg">{rows.length ? ((wins.length / rows.length) * 100).toFixed(1) : "0.0"}%</span>
          </span>
          <span className="hidden xl:inline">
            {t("toolbox.history.gross")} <span dir="ltr"><span className="text-up">{accMoney(a, gp)}</span> / <span className="text-down">{accMoney(a, gl)}</span></span>
          </span>
          <span>
            {t("toolbox.history.pf")} <span className="text-fg">{Number.isFinite(pf) ? pf.toFixed(2) : "∞"}</span>
          </span>
          <TButton size="xs" variant="outline" onClick={() => toast.success(t("toolbox.history.reportExported"), { description: t("toolbox.history.reportExportedDesc", { file: `ReportHistory-${a.login}.html`, count: rows.length }) })}>
            {t("toolbox.history.report")}
          </TButton>
        </div>
      </div>
      <div className="t-scroll min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1080px] border-separate border-spacing-0">
          <thead>
            <tr>
              {picking && <Th className="w-7 ps-3" />}
              <Th className={picking ? undefined : "ps-3"}>{t("toolbox.col.openTime")}</Th>
              <Th>{t("toolbox.col.ticket")}</Th>
              <Th>{t("toolbox.col.symbol")}</Th>
              <Th>{t("toolbox.col.type")}</Th>
              <Th right>{t("toolbox.col.volume")}</Th>
              <Th right>{t("toolbox.col.price")}</Th>
              <Th right>{t("toolbox.col.sl")}</Th>
              <Th right>{t("toolbox.col.tp")}</Th>
              <Th>{t("toolbox.col.closeTime")}</Th>
              <Th right>{t("toolbox.col.price")}</Th>
              <Th right>{t("toolbox.col.swap")}</Th>
              <Th right>{t("toolbox.col.commission")}</Th>
              <Th right>{t("toolbox.col.profit")}</Th>
              <Th>{t("toolbox.col.reason")}</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((it) => {
              if (it.k === "opt") return <OptionHistoryRow key={`o-${it.o.deal}`} o={it.o} picking={picking} />;
              const h = it.h;
              const d = getInstrument(h.symbol).digits;
              return (
                <tr
                  key={`${h.ticket}-${h.closeTime}`}
                  onClick={picking ? () => shareUi.toggle(h.ticket) : undefined}
                  onContextMenu={(e) => cm.open(e, [{ label: t("toolbox.menu.shareTrade"), icon: <Share2 />, onSelect: () => shareUi.shareOne(h.ticket) }, { label: t("toolbox.menu.copyTicket"), onSelect: () => (navigator.clipboard?.writeText(h.ticket).catch(() => {}), toast(t("toolbox.toast.ticketCopied"), { description: `#${h.ticket}` })) }], `#${h.ticket} ${sideLabel(t, h.side)} ${fmtVol(h.volume)} ${h.symbol}`)}
                  className="hover:bg-surface-2/70"
                >
                  {picking && (
                    <Td className="w-7 ps-3">
                      <PickBox ticket={h.ticket} />
                    </Td>
                  )}
                  <Td mono className={cn("text-fg-3", !picking && "ps-3")}>
                    {fmtServer(h.openTime)}
                  </Td>
                  <Td mono className="text-fg-3">
                    {h.ticket}
                  </Td>
                  <Td>
                    <span className="flex items-center gap-1.5 font-medium">
                      <SymbolAvatar symbol={h.symbol} size={13} />
                      {h.symbol}
                    </span>
                  </Td>
                  <Td>
                    <span className={h.side === "buy" ? "text-up" : "text-down"}>{sideLabel(t, h.side)}</span>
                  </Td>
                  <Td right mono>
                    {fmtVol(h.volume)}
                  </Td>
                  <Td right mono className="text-fg-2">
                    {h.openPrice.toFixed(d)}
                  </Td>
                  <Td right mono className="text-fg-3">
                    {h.sl !== undefined ? h.sl.toFixed(d) : "—"}
                  </Td>
                  <Td right mono className="text-fg-3">
                    {h.tp !== undefined ? h.tp.toFixed(d) : "—"}
                  </Td>
                  <Td mono className="text-fg-3">
                    {fmtServer(h.closeTime)}
                  </Td>
                  <Td right mono className="text-fg-2">
                    {h.closePrice.toFixed(d)}
                  </Td>
                  <Td right mono className="text-fg-2">
                    <span dir="ltr">{accMoney(a, h.swap)}</span>
                  </Td>
                  <Td right mono className="text-fg-2">
                    <span dir="ltr">{accMoney(a, -h.commission)}</span>
                  </Td>
                  <Td right className="font-semibold">
                    <span dir="ltr"><Pnl value={h.profit} text={accMoney(a, h.profit)} /></span>
                  </Td>
                  <Td className="text-fg-3">
                    <span className="flex items-center gap-1" title={h.comment}>
                      {h.source === "ai" && <Badge tone="ember">AI</Badge>}
                      {h.reason === "sl" ? <Badge tone="down">SL</Badge> : h.reason === "tp" ? <Badge tone="up">TP</Badge> : <span className="text-[11px]">{h.reason ?? h.source}</span>}
                      {h.source === "ai" && h.comment && <span className="max-w-[160px] truncate text-[11px]">{h.comment}</span>}
                    </span>
                  </Td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={picking ? 15 : 14} className="h-12 text-center text-[12px] text-fg-3">
                  {t("toolbox.history.empty")}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="[&>td]:sticky [&>td]:bottom-0 [&>td]:border-t [&>td]:border-line [&>td]:bg-panel-2">
              <td colSpan={picking ? 13 : 12} className="h-[28px] whitespace-nowrap ps-3 font-mono text-[12px] text-fg-2">
                <span className="flex gap-4">
                  <span>
                    <span className="font-sans text-fg-3">{t("toolbox.history.profit")}:</span> <span dir="ltr" className={net >= 0 ? "text-up" : "text-down"}>{accMoney(a, net)}</span>
                  </span>
                  <span>
                    <span className="font-sans text-fg-3">{t("toolbox.history.credit")}:</span> <span dir="ltr">{accMoney(a, a.cent ? a.credit / 100 : a.credit)}</span>
                  </span>
                  {/* deposits / withdrawals live in the Client Area ledger; the engine history here is trades only */}
                  {!T.engine && (
                    <>
                      <span>
                        <span className="font-sans text-fg-3">{t("toolbox.history.deposit")}:</span> <span dir="ltr">{accMoney(a, a.cent ? a.balance / 100 : a.balance)}</span>
                      </span>
                      <span>
                        <span className="font-sans text-fg-3">{t("toolbox.history.withdrawal")}:</span> 0.00
                      </span>
                    </>
                  )}
                  <span>
                    <span className="font-sans text-fg-3">{t("toolbox.history.balance")}:</span> <span dir="ltr" className="text-fg">{accMoney(a, T.balances[a.login] ?? 0)} {accCcy(a)}</span>
                  </span>
                  {items.length > shown.length && <span className="font-sans text-fg-3">{t("toolbox.history.showingLatest", { shown: shown.length, total: items.length })}</span>}
                </span>
              </td>
              <td dir="ltr" className="px-2 text-end text-[12px] font-semibold">
                <Pnl value={net} text={accMoney(a, net)} />
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {cm.node}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Exposure                                                            */
/* ------------------------------------------------------------------ */

export function ExposureTab() {
  const T = useTerminal();
  const t = useT();
  const a = T.account;
  const syms = [...new Set(T.positions.map((p) => p.symbol))];
  const qs = useQuotes(syms.length ? syms : ["EURUSD"]);
  const assets = new Map<string, { vol: number; usd: number; rate: number }>();
  const add = (asset: string, vol: number, usd: number, rate: number) => {
    const cur = assets.get(asset) ?? { vol: 0, usd: 0, rate };
    assets.set(asset, { vol: cur.vol + vol, usd: cur.usd + usd, rate });
  };
  for (const p of T.positions) {
    const q = qs[p.symbol] ?? priceFeed().snapshot(p.symbol)!;
    const inst = getInstrument(p.symbol);
    const { base, quote } = splitSymbol(p.symbol);
    const units = p.volume * inst.contractSize * (p.side === "buy" ? 1 : -1);
    const px = (q.bid + q.ask) / 2;
    const quoteUsd = quote === "USD" ? 1 : base === "USD" ? 1 / px : 1 / (priceFeed().snapshot(`USD${quote}`)?.bid ?? px);
    add(base, units, units * px * quoteUsd, base === "USD" ? 1 : px * quoteUsd);
    add(quote, -units * px, -units * px * quoteUsd, quoteUsd);
  }
  const list = [...assets.entries()].sort((x, y) => Math.abs(y[1].usd) - Math.abs(x[1].usd));
  const max = Math.max(1, ...list.map(([, v]) => Math.abs(v.usd)));
  if (!list.length) return <Empty title={t("toolbox.exposure.empty")} sub={t("toolbox.exposure.emptySub")} />;
  return (
    <div className="t-scroll h-full overflow-auto">
      <table className="w-full min-w-[720px] border-separate border-spacing-0">
        <thead>
          <tr>
            <Th className="ps-3">{t("toolbox.col.asset")}</Th>
            <Th right>{t("toolbox.col.volume")}</Th>
            <Th right>{t("toolbox.col.rate")}</Th>
            <Th right>USD</Th>
            <Th className="w-[40%]">{t("toolbox.col.graph")}</Th>
          </tr>
        </thead>
        <tbody>
          {list.map(([asset, v]) => (
            <tr key={asset} className="hover:bg-surface-2/70">
              <Td className="ps-3 font-medium">{asset}</Td>
              <Td right mono className={v.vol >= 0 ? "text-up" : "text-down"}>
                <span dir="ltr">{v.vol.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
              </Td>
              <Td right mono className="text-fg-2">
                {v.rate.toFixed(v.rate > 100 ? 2 : 5)}
              </Td>
              <Td right mono className={v.usd >= 0 ? "text-up" : "text-down"}>
                <span dir="ltr">{v.usd.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</span>
              </Td>
              <Td>
                <div className="relative h-2.5">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
                  <span className={cn("absolute inset-y-0 rounded-[2px]", v.usd >= 0 ? "left-1/2 bg-up/70" : "right-1/2 bg-down/70")} style={{ width: `${(Math.abs(v.usd) / max) * 50}%` }} />
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 text-[11px] text-fg-3">{t("toolbox.exposure.footer", { ccy: accCcy(a) === "USC" ? t("toolbox.exposure.usdCent") : "USD" })}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* News                                                                */
/* ------------------------------------------------------------------ */

export function NewsTab() {
  const T = useTerminal();
  const t = useT();
  return (
    <div className="t-scroll h-full overflow-auto p-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {NEWS.map((n) => (
          <button
            key={n.id}
            onClick={() => {
              const s = n.symbols.find((x) => INSTRUMENTS.some((i) => i.symbol === x));
              if (s) T.openSymbol(s);
              toast(n.title, { description: t("toolbox.news.minAgo", { source: n.source, count: n.minutesAgo }) });
            }}
            className="group flex gap-2.5 rounded-[7px] border border-line bg-surface-2/40 p-1.5 text-start transition-colors hover:border-line-top hover:bg-surface-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={n.image} alt="" className="h-[62px] w-[88px] shrink-0 rounded-[5px] object-cover opacity-90 group-hover:opacity-100" />
            <div className="min-w-0 py-0.5">
              <div className="flex items-center gap-1.5 text-[10px] text-fg-3">
                <Flag country={n.country} className="size-3" />
                <span>{n.source}</span>
                <span>· {t("toolbox.news.minShort", { count: n.minutesAgo })}</span>
                <Badge tone={n.sentiment === "bullish" ? "up" : n.sentiment === "bearish" ? "down" : "neutral"} className="ms-auto h-4 text-[8.5px]">
                  {t.dyn(`toolbox.sentiment.${n.sentiment}`, n.sentiment)}
                </Badge>
              </div>
              <div className="mt-1 line-clamp-2 text-[12px] font-medium leading-[1.3] text-fg">{n.title}</div>
              <div className="mt-1 flex gap-1">
                {n.symbols.slice(0, 3).map((s) => (
                  <span key={s} className="rounded-[3px] bg-surface-3 px-1 font-mono text-[9.5px] text-fg-2">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

export function CalendarTab() {
  const t = useT();
  const sorted = [...CALENDAR].sort((a, b) => ((a.time < "06:00" ? "3" : "") + a.time).localeCompare((b.time < "06:00" ? "3" : "") + b.time));
  return (
    <div className="t-scroll h-full overflow-auto">
      <table className="w-full min-w-[760px] border-separate border-spacing-0">
        <thead>
          <tr>
            <Th className="ps-3">{t("toolbox.col.time")}</Th>
            <Th>{t("toolbox.col.ccy")}</Th>
            <Th>{t("toolbox.col.impact")}</Th>
            <Th>{t("toolbox.col.event")}</Th>
            <Th right>{t("toolbox.col.actual")}</Th>
            <Th right>{t("toolbox.col.forecast")}</Th>
            <Th right>{t("toolbox.col.previous")}</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) => (
            <tr key={e.id} className="hover:bg-surface-2/70">
              <Td mono className={cn("ps-3", e.impact === 3 ? "shadow-[inset_3px_0_0_var(--k-down)]" : e.impact === 2 ? "shadow-[inset_3px_0_0_var(--k-warn)]" : "shadow-[inset_3px_0_0_var(--k-surface-3)]")}>
                {e.time}
              </Td>
              <Td>
                <span className="flex items-center gap-1.5">
                  <Flag country={e.country} className="size-3.5" />
                  <span className="font-mono text-[11px]">{e.currency}</span>
                </span>
              </Td>
              <Td>
                <span className="flex gap-0.5">
                  {[1, 2, 3].map((i) => (
                    <span key={i} className={cn("h-2.5 w-1 rounded-[1px]", i <= e.impact ? (e.impact === 3 ? "bg-down" : e.impact === 2 ? "bg-warn" : "bg-fg-3") : "bg-surface-3")} />
                  ))}
                </span>
              </Td>
              <Td className="font-medium">{e.title}</Td>
              <Td right mono className={e.actual ? "text-fg" : "text-fg-3"}>
                {e.actual ?? "—"}
              </Td>
              <Td right mono className="text-fg-2">
                {e.forecast}
              </Td>
              <Td right mono className="text-fg-3">
                {e.previous}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Alerts                                                              */
/* ------------------------------------------------------------------ */

export function AlertsTab() {
  const T = useTerminal();
  const t = useT();
  const [symbol, setSymbol] = React.useState(T.activeSymbol);
  const q = useQuote(symbol);
  const [cond, setCond] = React.useState<"above" | "below">("above");
  const [price, setPrice] = React.useState("");
  const [note, setNote] = React.useState("");
  const [edit, setEdit] = React.useState<string | null>(null);
  const d = getInstrument(symbol).digits;
  const submit = () => {
    const p = parseFloat(price) || q.bid;
    if (edit) {
      T.updateAlert(edit, { symbol, cond, price: p, note: note || undefined, active: true, triggeredAt: undefined });
      toast.success(t("toolbox.alerts.updated"));
      setEdit(null);
    } else T.addAlert({ symbol, cond, price: p, note: note || undefined });
    setPrice("");
    setNote("");
  };
  return (
    <div className="flex h-full min-h-0">
      <div className="w-[250px] shrink-0 space-y-2 border-e border-line p-2.5">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">{edit ? t("toolbox.alerts.edit") : t("toolbox.alerts.new")}</div>
        <TSelect ariaLabel={t("toolbox.alerts.symbolAria")} value={symbol} onChange={setSymbol} options={INSTRUMENTS.map((i) => i.symbol)} />
        <div className="grid grid-cols-2 gap-1.5">
          <TSelect ariaLabel={t("toolbox.alerts.condition")} value={cond} onChange={setCond} options={[{ value: "above", label: t("toolbox.alerts.bidAbove") }, { value: "below", label: t("toolbox.alerts.bidBelow") }]} />
          <Stepper ariaLabel={t("toolbox.alerts.priceAria")} value={price} onChange={setPrice} step={1 / 10 ** d} placeholder={fmtPrice(symbol, q.bid)} decimals={d} />
        </div>
        <TInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("toolbox.alerts.notePlaceholder")} />
        <div className="flex gap-1.5">
          <TButton variant="ember" className="flex-1" onClick={submit}>
            <Plus /> {edit ? t("common.save") : t("toolbox.alerts.create")}
          </TButton>
          {edit && (
            <TButton variant="ghost" onClick={() => (setEdit(null), setPrice(""), setNote(""))}>
              {t("common.cancel")}
            </TButton>
          )}
        </div>
        <p className="text-[10.5px] leading-snug text-fg-3">{T.guest ? t("toolbox.alerts.helpGuest") : t("toolbox.alerts.helpServer")} {t("toolbox.alerts.helpChart")}</p>
      </div>
      <div className="t-scroll min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[600px] border-separate border-spacing-0">
          <thead>
            <tr>
              <Th className="ps-3">{t("toolbox.col.symbol")}</Th>
              <Th>{t("toolbox.col.condition")}</Th>
              <Th right>{t("toolbox.col.price")}</Th>
              <Th right>{t("toolbox.col.current")}</Th>
              <Th>{t("toolbox.col.note")}</Th>
              <Th>{t("toolbox.col.status")}</Th>
              <Th>{t("toolbox.col.created")}</Th>
              <Th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {T.alerts.map((a) => (
              <AlertRow
                key={a.id}
                a={a}
                onEdit={() => {
                  setEdit(a.id);
                  setSymbol(a.symbol);
                  setCond(a.cond);
                  setPrice(fmtPrice(a.symbol, a.price));
                  setNote(a.note ?? "");
                }}
              />
            ))}
            {!T.alerts.length && (
              <tr>
                <td colSpan={8} className="h-12 text-center text-[12px] text-fg-3">
                  {t("toolbox.alerts.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlertRow({ a, onEdit }: { a: ReturnType<typeof useTerminal>["alerts"][number]; onEdit: () => void }) {
  const T = useTerminal();
  const t = useT();
  const q = useQuote(a.symbol);
  return (
    <tr className="group hover:bg-surface-2/70">
      <Td className="ps-3">
        <span className="flex items-center gap-1.5 font-medium">
          <SymbolAvatar symbol={a.symbol} size={13} />
          {a.symbol}
        </span>
      </Td>
      <Td className="text-fg-2">{a.cond === "above" ? t("toolbox.alerts.bidAbove") : t("toolbox.alerts.bidBelow")}</Td>
      <Td right mono className="text-warn">
        {fmtPrice(a.symbol, a.price)}
      </Td>
      <Td right mono>
        {fmtPrice(a.symbol, q.bid)}
      </Td>
      <Td className="max-w-[180px] truncate text-fg-3">{a.note ?? "—"}</Td>
      <Td>{a.active ? <Badge tone="ember">{t("common.active")}</Badge> : a.triggeredAt ? <Badge tone="up">{t("toolbox.alerts.triggered", { time: fmtServer(a.triggeredAt, false).slice(11) })}</Badge> : <Badge>{t("common.off")}</Badge>}</Td>
      <Td mono className="text-fg-3">
        {fmtServer(a.created, false)}
      </Td>
      <Td className="pe-2">
        <span className="flex justify-end gap-0.5">
          <button title={a.active ? t("toolbox.alerts.disable") : t("toolbox.alerts.enable")} onClick={() => T.updateAlert(a.id, { active: !a.active, triggeredAt: undefined })} className="grid size-5 place-items-center rounded-[4px] text-fg-3 hover:bg-surface-3 hover:text-fg">
            {a.active ? <BellOff className="size-3.5" /> : <Bell className="size-3.5" />}
          </button>
          <button title={t("common.edit")} onClick={onEdit} className="grid size-5 place-items-center rounded-[4px] text-fg-3 hover:bg-surface-3 hover:text-fg">
            <Pencil className="size-3.5" />
          </button>
          <button title={t("common.delete")} onClick={() => T.removeAlert(a.id)} className="grid size-5 place-items-center rounded-[4px] text-fg-3 hover:bg-down-soft hover:text-down">
            <Trash2 className="size-3.5" />
          </button>
        </span>
      </Td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

export function JournalTab() {
  const T = useTerminal();
  const t = useT();
  const [src, setSrc] = React.useState<"all" | JournalLine["src"]>("all");
  const [q, setQ] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);
  const lines = T.journal.filter((l) => (src === "all" || l.src === src) && (!q || l.text.toLowerCase().includes(q.toLowerCase())));
  React.useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines.length]);
  const text = (l: JournalLine) => `${journalTime(l.ts)}\t${l.src}\t${l.text}`;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line px-2">
        {(["all", "Trade", "Network", "Terminal", "Alerts", "Experts", "Account"] as const).map((s) => (
          <button key={s} onClick={() => setSrc(s)} className={cn("h-6 rounded-[5px] px-2 text-[11px]", src === s ? "bg-surface-3 text-fg" : "text-fg-3 hover:text-fg-2")}>
            {s === "all" ? t("common.all") : t.dyn(`toolbox.journal.src.${s.toLowerCase()}`, s)}
          </button>
        ))}
        <TInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("toolbox.journal.filter")} className="ms-auto h-6 w-[180px] text-[11px]" />
        <TButton
          size="xs"
          variant="ghost"
          onClick={() => {
            navigator.clipboard?.writeText(lines.map(text).join("\n")).catch(() => {});
            toast(t("toolbox.journal.copied"), { description: t("toolbox.journal.lines", { count: lines.length }) });
          }}
        >
          <Copy /> {t("common.copy")}
        </TButton>
        <TButton size="xs" variant="ghost" onClick={() => T.clearJournal()}>
          <Trash2 /> {t("toolbox.journal.clear")}
        </TButton>
      </div>
      <div ref={ref} className="t-scroll min-h-0 flex-1 overflow-auto py-1 font-mono text-[11.5px] leading-[20px]">
        {lines.map((l) => (
          <div key={l.id} className={cn("flex gap-3 whitespace-nowrap px-3 hover:bg-surface-2/60", l.level === "error" ? "text-down" : l.level === "warn" ? "text-warn" : "text-fg-2")}>
            <span className="text-fg-3">{journalTime(l.ts)}</span>
            <span className={cn("w-16 shrink-0", l.src === "Trade" ? "text-ember" : l.src === "Network" ? "text-up/80" : "text-fg-3")}>{t.dyn(`toolbox.journal.src.${l.src.toLowerCase()}`, l.src)}</span>
            <span>{l.text}</span>
          </div>
        ))}
        {!lines.length && <Empty icon={<Newspaper />} title={t("toolbox.journal.empty")} />}
      </div>
    </div>
  );
}
