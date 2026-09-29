"use client";

import * as React from "react";
import { getInstrument, hashString } from "@kalks/mock";
import { cn, useQuote } from "@kalks/ui";
import { useTerminal } from "@/lib/store";
import { useMarketOpen } from "@/lib/market-hours";
import { fmtPrice, fmtVol, pipSize } from "@/lib/trading";
import { Stepper } from "@/components/ui/primitives";
import { useT } from "@kalks/i18n/react";

function levelSize(symbol: string, px: number, t: number, i: number) {
  const h = hashString(`${symbol}:${px.toFixed(6)}:${Math.floor(t / 1500)}`);
  const base = (h % 1000) / 1000;
  return +(0.3 + base * 8 + (i < 2 ? 2.5 : 0)).toFixed(2);
}

/**
 * Depth-of-market ladder with click-to-trade (limit at the clicked level). Demo builds show synthetic
 * volumes; live builds have no depth feed, so the ladder is prices + one-click orders only.
 */
export function DomLadder({ symbol }: { symbol: string }) {
  const T = useTerminal();
  const t = useT();
  const synth = !T.live;
  const q = useQuote(symbol);
  const marketOpen = useMarketOpen(symbol);
  const inst = getInstrument(symbol);
  const pip = pipSize(inst);
  const stepPx = inst.assetClass === "crypto" && pip === 1 ? 5 : inst.assetClass === "indices" ? 0.5 : inst.symbol === "XAUUSD" ? 0.1 : pip / 2;
  const [vol, setVol] = React.useState(T.ws.lot.toFixed(2));
  const v = Math.max(0.01, parseFloat(vol) || 0.01);
  const LEVELS = 10;
  const asks = Array.from({ length: LEVELS }, (_, i) => {
    const px = q.ask + (LEVELS - 1 - i) * stepPx;
    return { px, size: levelSize(symbol, px, q.time, LEVELS - 1 - i) };
  });
  const bids = Array.from({ length: LEVELS }, (_, i) => {
    const px = q.bid - i * stepPx;
    return { px, size: levelSize(symbol, px, q.time + 7, i) };
  });
  const max = Math.max(...asks.map((a) => a.size), ...bids.map((b) => b.size));
  const bidTotal = bids.reduce((s, b) => s + b.size, 0);
  const askTotal = asks.reduce((s, a) => s + a.size, 0);
  const bidPct = (bidTotal / (bidTotal + askTotal)) * 100;
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
      <div className={cn("grid h-[22px] grid-cols-[1fr_88px_1fr] items-center font-mono text-[11px]", best && "bg-surface-2/70")}>
        <button
          disabled={T.readOnly || side === "ask"}
          onClick={() => trade("buy", px)}
          aria-label={t("order.dom.buyLimitAt", { price: px })}
          title={side === "bid" ? t("order.dom.buyLimitTitle", { volume: fmtVol(v), price: key }) : undefined}
          className={cn("relative h-full pe-2 text-end", side === "bid" ? "hover:bg-up/15" : "cursor-default")}
        >
          {side === "bid" && synth && (
            <>
              <span className="absolute inset-y-[3px] end-0 rounded-s-[2px] bg-up/15 transition-[width] duration-300" style={{ width: `${(size / max) * 100}%` }} />
              <span className="k-num relative text-fg-2">{size.toFixed(2)}</span>
            </>
          )}
        </button>
        <div className={cn("k-num relative text-center font-medium", side === "ask" ? "text-down" : "text-up")}>
          {key}
          {my && <span className="absolute -end-1 top-1/2 -translate-y-1/2 rounded-[3px] bg-gold px-0.5 text-[8.5px] leading-3 text-[#1a1204]">{my}</span>}
        </div>
        <button
          disabled={T.readOnly || side === "bid"}
          onClick={() => trade("sell", px)}
          aria-label={t("order.dom.sellLimitAt", { price: px })}
          title={side === "ask" ? t("order.dom.sellLimitTitle", { volume: fmtVol(v), price: key }) : undefined}
          className={cn("relative h-full ps-2 text-start", side === "ask" ? "hover:bg-down/15" : "cursor-default")}
        >
          {side === "ask" && synth && (
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
      <div className="grid h-6 shrink-0 grid-cols-[1fr_88px_1fr] items-center border-b border-line bg-panel-2 text-[9.5px] font-medium uppercase tracking-[0.06em] text-fg-3">
        <span className="pe-2 text-end">{synth ? t("order.dom.bidVol") : t("order.dom.buyLimit")}</span>
        <span className="text-center">{t("order.dom.price")}</span>
        <span className="ps-2">{synth ? t("order.dom.askVol") : t("order.dom.sellLimit")}</span>
      </div>
      <div className="t-scroll min-h-0 flex-1 overflow-y-auto py-0.5">
        {asks.map((a, i) => (
          <Row key={`a${i}`} px={a.px} size={a.size} side="ask" best={i === LEVELS - 1} />
        ))}
        <div className="my-0.5 flex h-6 items-center justify-between border-y border-line bg-panel-2 px-2 font-mono text-[10.5px]">
          <span className="text-fg-3">{t("order.dom.spread")}</span>
          <span className="k-num text-fg">{t("order.unit.pts", { n: Math.round((q.ask - q.bid) * 10 ** inst.digits) })}</span>
          <span className="k-num text-fg-3">{t("order.dom.mid", { price: fmtPrice(symbol, (q.ask + q.bid) / 2) })}</span>
        </div>
        {bids.map((b, i) => (
          <Row key={`b${i}`} px={b.px} size={b.size} side="bid" best={i === 0} />
        ))}
      </div>
      <div className="shrink-0 space-y-2 border-t border-line p-2">
        {synth && <div>
          <div className="mb-1 flex justify-between text-[10px]">
            <span className="k-num text-up">{t("order.dom.bids", { pct: bidPct.toFixed(0) })}</span>
            <span className="text-fg-3">{t("order.dom.synthetic")}</span>
            <span className="k-num text-down">{t("order.dom.asks", { pct: (100 - bidPct).toFixed(0) })}</span>
          </div>
          <div className="flex h-1 overflow-hidden rounded-full bg-surface-3">
            <span className="h-full bg-up transition-[width] duration-300" style={{ width: `${bidPct}%` }} />
            <span className="h-full flex-1 bg-down" />
          </div>
        </div>}
        {!T.readOnly && (
          <div className="grid grid-cols-[1fr_84px_1fr] gap-1.5">
            <button onClick={() => trade("sell", q.bid, true)} disabled={!marketOpen} title={marketOpen ? undefined : t("order.ticket.marketClosed")} aria-label={t("order.dom.sellMarketAria")} className="h-7 rounded-[6px] bg-down text-[11.5px] font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-fg-3 disabled:hover:brightness-100">
              {marketOpen ? t("order.dom.sellMkt") : t("order.dom.closed")}
            </button>
            <Stepper ariaLabel={t("order.dom.volume")} value={vol} onChange={setVol} step={0.01} min={0.01} decimals={2} />
            <button onClick={() => trade("buy", q.ask, true)} disabled={!marketOpen} title={marketOpen ? undefined : t("order.ticket.marketClosed")} aria-label={t("order.dom.buyMarketAria")} className="h-7 rounded-[6px] bg-up text-[11.5px] font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-fg-3 disabled:hover:brightness-100">
              {marketOpen ? t("order.dom.buyMkt") : t("order.dom.closed")}
            </button>
          </div>
        )}
        <div className="text-center text-[10px] text-fg-3">{T.readOnly ? t("order.dom.readOnly") : T.ws.oneClick ? t("order.dom.hintOneClick") : t("order.dom.hintDialog")}</div>
      </div>
    </div>
  );
}
