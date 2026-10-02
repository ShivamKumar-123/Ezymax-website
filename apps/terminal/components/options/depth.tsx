"use client";

// The order book of the selected option (the centre panel's "Book" tab while the broker's book is live): its top of
// book (best bid / offer with sizes, last trade, mark, theo, open interest, volume), the depth ladder (10 levels each
// side with sizes and the running total; the trader's own resting orders marked) and the trade tape (time, price, size,
// the taker's side). A click on a level fills the ticket with a limit order at that price: an offer → Buy, a bid →
// Sell. Depth and trades stream from the options service (WS `depth` / `tape`), or are polled while it reconnects.
// Times are server time, like the rest of the terminal.
import * as React from "react";
import { BookOpenText, MousePointerClick, Table2 } from "lucide-react";
import { parseSeriesCode } from "@kalks/mock/options";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { useTerminal } from "@/lib/store";
import { serverTime } from "@/lib/trading";
import { useBookOrders } from "@/lib/options/book-orders";
import { opt, useBookLive, useOpt, useSeriesQuote } from "@/lib/options-store";
import type { BookOrder, DepthLevel, TapeTrade } from "@/lib/options/types";
import { Flash, RightTag, StateBadge } from "./bits";
import { qty, useSeriesUnits } from "./book-bits";
import { expiryLabel, pct, usd } from "./format";
import { MmRulesLink } from "./mm-rules";

const EMPTY_LEVELS: DepthLevel[] = [];
const EMPTY_TAPE: TapeTrade[] = [];

/** The selected option's top of book in one line. */
export function SeriesBookHeader({ code, className }: { code: string; className?: string }) {
  const t = useT();
  const { locale } = useLocale();
  const q = useSeriesQuote(code);
  const p = parseSeriesCode(code);
  const u = useSeriesUnits(code);
  if (!p) return null;
  const spreadTicks = q && q.bid > 0 && q.ask > 0 && u.tick > 0 ? Math.round((q.ask - q.bid) / u.tick) : null;
  const Item = ({ label, children, title }: { label: string; children: React.ReactNode; title?: string }) => (
    <span className="flex shrink-0 items-baseline gap-1 whitespace-nowrap" title={title}>
      <span className="text-[9.5px] font-medium uppercase tracking-[0.07em] text-fg-3">{label}</span>
      <span className="k-num font-mono text-[11.5px] text-fg">{children}</span>
    </span>
  );
  return (
    <div className={cn("flex min-h-9 shrink-0 flex-wrap items-center gap-x-3.5 gap-y-1 border-b border-line bg-panel-2/60 px-2.5 py-1.5", className)}>
      <span className="flex shrink-0 items-center gap-1.5">
        <RightTag right={p.right} />
        <span className="font-mono text-[12.5px] font-semibold text-fg">
          {p.underlying} {p.strikeLabel}
        </span>
        <span className="text-[11px] text-fg-3">{expiryLabel(p.date, locale)}</span>
        {q && <StateBadge state={q.state} />}
      </span>
      <Item label={t("trader.opt.col.bid")} title={t("trader.opt.col.bidHint")}>
        <span className="text-down">{q && q.bid > 0 ? usd(q.bidUsd) : "—"}</span>
        {q?.bidQty ? <span className="ms-1 text-[10px] text-fg-3">×{qty(q.bidQty)}</span> : null}
      </Item>
      <Item label={t("trader.opt.col.ask")} title={t("trader.opt.col.askHint")}>
        <span className="text-up">{q && q.ask > 0 ? usd(q.askUsd) : "—"}</span>
        {q?.askQty ? <span className="ms-1 text-[10px] text-fg-3">×{qty(q.askQty)}</span> : null}
      </Item>
      {spreadTicks !== null && (
        <Item label={t("trader.opt.depth.spread")}>
          {usd((q!.askUsd - q!.bidUsd))} <span className="text-[10px] text-fg-3">· {t("trader.opt.depth.ticks", { count: spreadTicks })}</span>
        </Item>
      )}
      <Item label={t("trader.opt.col.last")} title={t("trader.opt.col.lastHint")}>
        {q?.lastUsd ? usd(q.lastUsd) : "—"}
        {q?.change !== null && q?.change !== undefined && <span className={cn("ms-1 text-[10px]", q.change >= 0 ? "text-up" : "text-down")}>{`${q.change >= 0 ? "+" : ""}${(q.change * 100).toFixed(1)}%`}</span>}
      </Item>
      <Item label={t("trader.opt.col.mark")} title={t("trader.opt.col.markBookHint")}>
        {q ? usd(q.markUsd) : "—"}
      </Item>
      <Item label={t("trader.opt.col.theo")} title={t("trader.opt.col.theoHint")}>
        {q?.theoUsd !== null && q?.theoUsd !== undefined ? usd(q.theoUsd) : "—"}
        {q?.theoIv ? <span className="ms-1 text-[10px] text-fg-3">{pct(q.theoIv, 1)}</span> : null}
      </Item>
      <Item label={t("trader.opt.col.oi")} title={t("trader.opt.col.oiHint")}>
        {qty(q?.oi)}
      </Item>
      <Item label={t("trader.opt.col.vol")} title={t("trader.opt.col.volHint")}>
        {qty(q?.volume)}
      </Item>
      <MmRulesLink className="ms-auto" />
    </div>
  );
}

interface LevelRow extends DepthLevel {
  cum: number;
  mine: number;
}

function withCum(levels: DepthLevel[], mine: Map<number, number>, tick: number): LevelRow[] {
  let cum = 0;
  return levels.map((l) => {
    cum += l.qty;
    return { ...l, cum, mine: mine.get(Math.round(l.price / tick)) ?? 0 };
  });
}

/** Own working orders of a series per price (in ticks) and side. */
function mineOf(orders: BookOrder[], code: string, tick: number) {
  const bids = new Map<number, number>();
  const asks = new Map<number, number>();
  for (const o of orders) {
    if (o.series !== code || o.price === null || o.trigger || o.left <= 0) continue;
    const m = o.side === "buy" ? bids : asks;
    const k = Math.round(o.price / tick);
    m.set(k, (m.get(k) ?? 0) + o.left);
  }
  return { bids, asks };
}

function Ladder({ code, compact }: { code: string; compact?: boolean }) {
  const t = useT();
  const T = useTerminal();
  const live = useBookLive();
  const depth = useOpt((s) => s.depth[code]);
  const units = useSeriesUnits(code);
  const orders = useBookOrders(T.guest ? null : T.account.login, live);
  const interactive = useOpt((s) => !s.publicView && !s.ctx?.publicPage);
  const mine = React.useMemo(() => mineOf(orders.open, code, units.tick), [orders.open, code, units.tick]);
  const bids = withCum(depth?.bids ?? EMPTY_LEVELS, mine.bids, units.tick);
  const asks = withCum(depth?.asks ?? EMPTY_LEVELS, mine.asks, units.tick);
  const maxCum = Math.max(1, bids[bids.length - 1]?.cum ?? 0, asks[asks.length - 1]?.cum ?? 0);
  const rows = Math.max(compact ? 5 : 10, bids.length, asks.length);
  const pick = (side: "buy" | "sell", l: LevelRow) => interactive && opt.prefillLimit(code, side, l.price * units.k);
  const cell = "h-[24px] whitespace-nowrap px-1.5 font-mono text-[11.5px]";
  const head = "sticky top-0 z-[1] h-6 whitespace-nowrap border-b border-line bg-panel-2 px-1.5 text-[9.5px] font-medium uppercase tracking-[0.06em] text-fg-3";
  return (
    <div className="flex min-h-0 flex-col">
      {!depth && <div className="px-3 py-2 text-[11.5px] text-fg-3">{t("trader.opt.depth.loading")}</div>}
      <div className="grid min-h-0 grid-cols-2 gap-px bg-line">
        {(["bids", "asks"] as const).map((sideKey) => {
          const list = sideKey === "bids" ? bids : asks;
          const isBid = sideKey === "bids";
          return (
            <table key={sideKey} className="w-full border-separate border-spacing-0 bg-panel">
              <thead>
                <tr>
                  {isBid ? (
                    <>
                      {!compact && <th className={cn(head, "text-start")}>{t("trader.opt.depth.cum")}</th>}
                      <th className={cn(head, "text-end")}>{t("trader.opt.depth.size")}</th>
                      <th className={cn(head, "text-end text-down")}>{t("trader.opt.col.bid")}</th>
                    </>
                  ) : (
                    <>
                      <th className={cn(head, "text-start text-up")}>{t("trader.opt.col.ask")}</th>
                      <th className={cn(head, "text-start")}>{t("trader.opt.depth.size")}</th>
                      {!compact && <th className={cn(head, "text-end")}>{t("trader.opt.depth.cum")}</th>}
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rows }).map((_, i) => {
                  const l = list[i];
                  if (!l)
                    return (
                      <tr key={i} aria-hidden>
                        <td colSpan={compact ? 2 : 3} className={cn(cell, "text-center text-fg-3/40")}>
                          {i === 0 ? t(isBid ? "trader.opt.depth.noBids" : "trader.opt.depth.noAsks") : " "}
                        </td>
                      </tr>
                    );
                  const w = `${(l.cum / maxCum) * 100}%`;
                  const priceUsd = l.price * units.k;
                  const title = interactive ? t(isBid ? "trader.opt.depth.clickSell" : "trader.opt.depth.clickBuy", { price: usd(priceUsd) }) : undefined;
                  return (
                    <tr
                      key={`${l.price}`}
                      onClick={() => pick(isBid ? "sell" : "buy", l)}
                      title={title}
                      className={cn("group relative", interactive && "cursor-pointer")}
                      style={{ backgroundImage: `linear-gradient(${isBid ? "to left" : "to right"}, ${isBid ? "var(--k-up-soft)" : "var(--k-down-soft)"} ${w}, transparent ${w})` }}
                    >
                      {isBid ? (
                        <>
                          {!compact && <td className={cn(cell, "text-start text-fg-3 group-hover:bg-surface-3/40")}>{qty(l.cum)}</td>}
                          <td className={cn(cell, "text-end text-fg-2 group-hover:bg-surface-3/40")}>
                            {l.mine > 0 && (
                              <span className="me-1 rounded-[3px] bg-ember-soft px-1 font-sans text-[9px] font-semibold text-ember" title={t("trader.opt.depth.mineHint", { count: l.mine })}>
                                {t("trader.opt.depth.you")} {qty(l.mine)}
                              </span>
                            )}
                            <Flash value={l.qty}>{qty(l.qty)}</Flash>
                          </td>
                          <td className={cn(cell, "text-end font-semibold text-down group-hover:bg-surface-3/40", i === 0 && "text-[12px]")}>{usd(priceUsd)}</td>
                        </>
                      ) : (
                        <>
                          <td className={cn(cell, "text-start font-semibold text-up group-hover:bg-surface-3/40", i === 0 && "text-[12px]")}>{usd(priceUsd)}</td>
                          <td className={cn(cell, "text-start text-fg-2 group-hover:bg-surface-3/40")}>
                            <Flash value={l.qty}>{qty(l.qty)}</Flash>
                            {l.mine > 0 && (
                              <span className="ms-1 rounded-[3px] bg-ember-soft px-1 font-sans text-[9px] font-semibold text-ember" title={t("trader.opt.depth.mineHint", { count: l.mine })}>
                                {t("trader.opt.depth.you")} {qty(l.mine)}
                              </span>
                            )}
                          </td>
                          {!compact && <td className={cn(cell, "text-end text-fg-3 group-hover:bg-surface-3/40")}>{qty(l.cum)}</td>}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );
        })}
      </div>
    </div>
  );
}

/** The trade tape of a series: newest first; the taker's side colours the row. */
export function TradeTape({ code, className, limit = 60 }: { code: string; className?: string; limit?: number }) {
  const t = useT();
  const trades = useOpt((s) => s.tape[code] ?? EMPTY_TAPE);
  const units = useSeriesUnits(code);
  const shown = trades.slice(0, limit);
  const head = "sticky top-0 z-[1] h-6 whitespace-nowrap border-b border-line bg-panel-2 px-2 text-[9.5px] font-medium uppercase tracking-[0.06em] text-fg-3";
  return (
    <div className={cn("t-scroll min-h-0 overflow-y-auto", className)}>
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={cn(head, "text-start")}>{t("trader.opt.tape.time")}</th>
            <th className={cn(head, "text-end")}>{t("trader.opt.col.price")}</th>
            <th className={cn(head, "text-end")}>{t("trader.opt.depth.size")}</th>
            <th className={cn(head, "text-end")} title={t("trader.opt.tape.sideHint")}>
              {t("trader.opt.tape.side")}
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((x, i) => (
            <tr key={x.id} className={cn(i === 0 && Date.now() - x.t < 1500 && "animate-[t-fade_.6s_ease-out]")}>
              <td className="h-[22px] whitespace-nowrap px-2 font-mono text-[11px] text-fg-3">{serverTime(new Date(x.t)).time}</td>
              <td className={cn("h-[22px] whitespace-nowrap px-2 text-end font-mono text-[11.5px]", x.side === "buy" ? "text-up" : "text-down")}>{usd(x.price * units.k)}</td>
              <td className="h-[22px] whitespace-nowrap px-2 text-end font-mono text-[11.5px] text-fg-2">{qty(x.qty)}</td>
              <td className="h-[22px] whitespace-nowrap px-2 text-end text-[10.5px]">
                <span className={cn("font-semibold uppercase tracking-[0.05em]", x.side === "buy" ? "text-up" : "text-down")}>{x.side === "buy" ? t("common.buy") : t("common.sell")}</span>
                {x.kind && x.kind !== "book" && <span className="ms-1 rounded-[3px] bg-surface-3 px-1 text-[9px] text-fg-3">{t.dyn(`trader.opt.tape.kind.${x.kind}`, x.kind)}</span>}
              </td>
            </tr>
          ))}
          {!shown.length && (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-[11.5px] text-fg-3">
                {t("trader.opt.tape.empty")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** The centre panel's Book tab: the selected option's top of book, depth ladder and trades. */
export function BookPane({ compact }: { compact?: boolean }) {
  const t = useT();
  const sel = useOpt((s) => s.sel);
  if (!sel)
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div className="max-w-[300px]">
          <div className="mx-auto mb-2.5 grid size-10 place-items-center rounded-full border border-line text-fg-3">
            <BookOpenText className="size-4" />
          </div>
          <div className="text-[13px] font-semibold text-fg">{t("trader.opt.depth.emptyTitle")}</div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-fg-3">{t("trader.opt.depth.emptyText")}</p>
          <button onClick={() => opt.setCenter("chain")} className="mt-3 inline-flex h-7 items-center gap-1.5 rounded-[7px] bg-ember px-3 text-[12px] font-semibold text-white hover:brightness-110">
            <Table2 className="size-3.5" /> {t("trader.opt.chainTitle")}
          </button>
        </div>
      </div>
    );
  return (
    <div className="@container flex h-full min-h-0 flex-col">
      <SeriesBookHeader code={sel} />
      {/* wide: depth | trades side by side, each scrolling; narrow (phones): stacked, the pane scrolls */}
      <div className="t-scroll grid min-h-0 flex-1 grid-cols-1 content-start overflow-y-auto @[640px]:grid-cols-[minmax(0,1.4fr)_minmax(250px,1fr)] @[640px]:content-normal @[640px]:overflow-hidden">
        <div className="t-scroll border-line @[640px]:min-h-0 @[640px]:overflow-y-auto @[640px]:border-e">
          <div className="flex h-7 items-center gap-1.5 border-b border-line px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">
            {t("trader.opt.depth.title")}
            <span className="ms-auto flex items-center gap-1 font-normal normal-case tracking-normal">
              <MousePointerClick className="size-3 text-ember" /> {t("trader.opt.depth.hint")}
            </span>
          </div>
          <Ladder code={sel} compact={compact} />
        </div>
        <div className="flex min-h-[180px] flex-col border-t border-line @[640px]:min-h-0 @[640px]:border-t-0">
          <div className="flex h-7 shrink-0 items-center border-b border-line px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-3">{t("trader.opt.tape.title")}</div>
          <TradeTape code={sel} className="@[640px]:flex-1" limit={compact ? 30 : 60} />
        </div>
      </div>
    </div>
  );
}
