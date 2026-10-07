"use client";

import * as React from "react";
import { getInstrument, priceFeed, type DepthBook } from "@kalks/mock";
import { cn, useQuote } from "@kalks/ui";
import { useTerminal } from "@/lib/store";
import { useMarketOpen } from "@/lib/market-hours";
import { fmtPrice, fmtVol, pipSize } from "@/lib/trading";
import { Stepper } from "@/components/ui/primitives";
import { useT } from "@kalks/i18n/react";

/** The market-data depth stream for `symbol` (null until the first book, or while the service is unreachable). */
function useDepth(symbol: string): DepthBook | null {
  const [book, setBook] = React.useState<DepthBook | null>(null);
  React.useEffect(() => {
    setBook(null);
    return priceFeed().subscribeDepth(symbol, setBook);
  }, [symbol]);
  return book?.symbol === symbol ? book : null;
}

/**
 * Depth-of-market ladder with click-to-trade (D97): a limit order at the clicked level, market orders from the
 * buttons, through the same order path and settings as the order ticket (one-click trading on = instant,
 * off = the prefilled order dialog). Levels come from market-data: provider depth when the feed carries it,
 * otherwise an indicative ladder derived from the live bid/ask with the account group's spread, labelled so.
 */
export function DomLadder({ symbol }: { symbol: string }) {
  const T = useTerminal();
  const t = useT();
  const book = useDepth(symbol);
  const sized = !!book;
  const q = useQuote(symbol);
  const marketOpen = useMarketOpen(symbol);
  const inst = getInstrument(symbol);
  const pip = pipSize(inst);
  const stepPx = inst.assetClass === "crypto" && pip === 1 ? 5 : inst.assetClass === "indices" ? 0.5 : inst.symbol === "XAUUSD" ? 0.1 : pip / 2;
  const [vol, setVol] = React.useState(T.ws.lot.toFixed(2));
  const v = Math.max(0.01, parseFloat(vol) || 0.01);
  const LEVELS = 10;
  // best ask at the bottom of the ask block, best bid at the top of the bid block
  const asks = book
    ? book.asks.slice(0, LEVELS).map(([px, size]) => ({ px, size })).reverse()
    : Array.from({ length: LEVELS }, (_, i) => ({ px: q.ask + (LEVELS - 1 - i) * stepPx, size: 0 }));
  const bids = book ? book.bids.slice(0, LEVELS).map(([px, size]) => ({ px, size })) : Array.from({ length: LEVELS }, (_, i) => ({ px: q.bid - i * stepPx, size: 0 }));
  const max = Math.max(0.01, ...asks.map((a) => a.size), ...bids.map((b) => b.size));
  const bidTotal = bids.reduce((s, b) => s + b.size, 0);
  const askTotal = asks.reduce((s, a) => s + a.size, 0);
  const bidPct = bidTotal + askTotal > 0 ? (bidTotal / (bidTotal + askTotal)) * 100 : 50;
  const mine = new Map<string, string>();
  for (const o of T.pendings.filter((p) => p.symbol === symbol)) mine.set(fmtPrice(symbol, o.price), `${o.side === "buy" ? "B" : "S"}${o.type === "limit" ? "L" : "S"} ${fmtVol(o.volume)}`);

  const trade = (side: "buy" | "sell", px: number, market = false) => {
    if (T.readOnly || !marketOpen) return;
    if (market) {
      if (T.ws.oneClick) T.quickTrade(symbol, side, v);
      else T.openNewOrder({ symbol, side, type: "market" });
      return;
    }
    if (T.ws.oneClick) T.placeOrder({ symbol, side, type: "limit", volume: v, price: px });
    else T.openNewOrder({ symbol, side, type: "limit", price: px });
  };

  const Row = ({ px, size, side, best }: { px: number; size: number; side: "ask" | "bid"; best?: boolean }) => {
    const key = fmtPrice(symbol, px);
    const my = mine.get(key);
    return (
      <div className={cn("grid h-[24px] grid-cols-[1fr_92px_1fr] items-center font-mono text-[12px]", best && "bg-surface-2/70")}>
        <button
          disabled={T.readOnly || side === "ask"}
          onClick={() => trade("buy", px)}
          aria-label={t("order.dom.buyLimitAt", { price: px })}
          title={side === "bid" ? t("order.dom.buyLimitTitle", { volume: fmtVol(v), price: key }) : undefined}
          className={cn("relative h-full pe-2 text-end", side === "bid" ? "hover:bg-up/15" : "cursor-default")}
        >
          {side === "bid" && sized && (
            <>
              <span className="absolute inset-y-[3px] end-0 rounded-s-[2px] bg-up/15 transition-[width] duration-300" style={{ width: `${(size / max) * 100}%` }} />
              <span className="k-num relative text-fg-2">{size.toFixed(2)}</span>
            </>
          )}
        </button>
        <div className={cn("k-num relative text-center font-medium", side === "ask" ? "text-down" : "text-up")}>
          {key}
          {my && <span className="absolute -end-1 top-1/2 -translate-y-1/2 rounded-[3px] bg-gold px-0.5 text-[9.5px] leading-3 text-[#1a1204]">{my}</span>}
        </div>
        <button
          disabled={T.readOnly || side === "bid"}
          onClick={() => trade("sell", px)}
          aria-label={t("order.dom.sellLimitAt", { price: px })}
          title={side === "ask" ? t("order.dom.sellLimitTitle", { volume: fmtVol(v), price: key }) : undefined}
          className={cn("relative h-full ps-2 text-start", side === "ask" ? "hover:bg-down/15" : "cursor-default")}
        >
          {side === "ask" && sized && (
            <>
              <span className="absolute inset-y-[3px] start-0 rounded-e-[2px] bg-down/15 transition-[width] duration-300" style={{ width: `${(size / max) * 100}%` }} />
              <span className="k-num relative text-fg-2">{size.toFixed(2)}</span>
            </>
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid h-8 shrink-0 grid-cols-[1fr_92px_1fr] items-center border-b border-line bg-panel-2 text-[12px] font-medium text-fg-3">
        <span className="pe-2 text-end">{sized ? t("order.dom.bidVol") : t("order.dom.buyLimit")}</span>
        <span className="text-center">{t("order.dom.price")}</span>
        <span className="ps-2">{sized ? t("order.dom.askVol") : t("order.dom.sellLimit")}</span>
      </div>
      <div className="t-scroll min-h-0 flex-1 overflow-y-auto py-0.5">
        {asks.map((a, i) => (
          <Row key={`a${i}`} px={a.px} size={a.size} side="ask" best={i === asks.length - 1} />
        ))}
        <div className="my-0.5 flex h-7 items-center justify-between border-y border-line bg-panel-2 px-2.5 font-mono text-[12px]">
          <span className="text-fg-3">{t("order.dom.spread")}</span>
          <span className="k-num text-fg">{t("order.unit.pts", { n: Math.round((q.ask - q.bid) * 10 ** inst.digits) })}</span>
          <span className="k-num text-fg-3">{t("order.dom.mid", { price: fmtPrice(symbol, (q.ask + q.bid) / 2) })}</span>
        </div>
        {bids.map((b, i) => (
          <Row key={`b${i}`} px={b.px} size={b.size} side="bid" best={i === 0} />
        ))}
      </div>
      <div className="shrink-0 space-y-2.5 border-t border-line p-3">
        {book?.src === "feed" ? (
          <div data-testid="dom-source" data-src="feed">
            <div className="mb-1 flex justify-between text-[11.5px]">
              <span className="k-num text-up">{t("order.dom.bids", { pct: bidPct.toFixed(0) })}</span>
              <span className="text-fg-3">{t("order.dom.feed")}</span>
              <span className="k-num text-down">{t("order.dom.asks", { pct: (100 - bidPct).toFixed(0) })}</span>
            </div>
            <div className="flex h-1 overflow-hidden rounded-full bg-surface-3">
              <span className="h-full bg-up transition-[width] duration-300" style={{ width: `${bidPct}%` }} />
              <span className="h-full flex-1 bg-down" />
            </div>
          </div>
        ) : (
          <div data-testid="dom-source" data-src={book ? "indicative" : "none"} title={book ? t("order.dom.indicativeTitle") : undefined} className="flex items-center justify-center gap-1.5 text-[11.5px] text-fg-3">
            {book && <span className="rounded-[3px] border border-line px-1 text-[9px] font-semibold uppercase tracking-[0.06em] text-fg-2">{t("order.dom.indicative")}</span>}
            <span>{book ? t("order.dom.indicativeNote") : t("order.dom.unavailable")}</span>
          </div>
        )}
        {!T.readOnly && (
          <div className="grid grid-cols-[1fr_104px_1fr] gap-1.5">
            <button onClick={() => trade("sell", q.bid, true)} disabled={!marketOpen} title={marketOpen ? undefined : t("order.ticket.marketClosed")} aria-label={t("order.dom.sellMarketAria")} className="h-9 rounded-[8px] bg-sell-fill text-[13px] font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-fg-3 disabled:hover:brightness-100">
              {marketOpen ? t("order.dom.sellMkt") : t("order.dom.closed")}
            </button>
            <Stepper size="md" className="h-9" ariaLabel={t("order.dom.volume")} value={vol} onChange={setVol} step={0.01} min={0.01} decimals={2} />
            <button onClick={() => trade("buy", q.ask, true)} disabled={!marketOpen} title={marketOpen ? undefined : t("order.ticket.marketClosed")} aria-label={t("order.dom.buyMarketAria")} className="h-9 rounded-[8px] bg-buy-fill text-[13px] font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-fg-3 disabled:hover:brightness-100">
              {marketOpen ? t("order.dom.buyMkt") : t("order.dom.closed")}
            </button>
          </div>
        )}
        <div className="text-center text-[11.5px] leading-[16px] text-fg-3">{T.readOnly ? t("order.dom.readOnly") : T.ws.oneClick ? t("order.dom.hintOneClick") : t("order.dom.hintDialog")}</div>
      </div>
    </div>
  );
}
