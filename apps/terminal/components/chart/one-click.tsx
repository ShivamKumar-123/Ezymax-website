"use client";

// One-click trading on the chart (docs/TERMINAL-DESIGN.md §2.2 and §2.5): the floating Sell · lot · Buy box on the plot
// and the compact Sell | spread | Buy pair at the right end of the chart toolbar. Both send a market order at once with
// one-click trading on (the box's lot, also the toolbar's), or open the order form with the side chosen when it's off.
// Buy is the chart's blue (--t-buy), Sell red. Each one subscribes to the quote itself: a tick re-renders only them.
import * as React from "react";
import { ChevronUp, Zap } from "lucide-react";
import { getInstrument } from "@ezymex/mock";
import { PriceText, cn, useQuote } from "@ezymex/ui";
import { useT } from "@ezymex/i18n/react";
import { useTerminal } from "@/lib/store";
import { fmtVol } from "@/lib/trading";
import { useMarketOpen } from "@/lib/market-hours";
import { Tip } from "@/components/ui/kit";

/** Quote, spread (points), market state and the Sell / Buy action shared by the box and the toolbar pair. */
export function useQuickTrade(symbol: string, volume: () => number) {
  const T = useTerminal();
  const t = useT();
  const { bid, ask, dir, delayed } = useQuote(symbol);
  const spread = Math.round((ask - bid) * 10 ** getInstrument(symbol).digits);
  const open = useMarketOpen(symbol);
  // a delayed snapshot (not streaming yet): prices shown, Sell / Buy off with the reason
  const blocked = delayed ? t("desk.side.delayedTip") : null;
  const go = (side: "buy" | "sell") => {
    if (!open || blocked) return;
    if (T.guest) return void T.quickTrade(symbol, side, volume()); // explains: no trading account yet
    if (T.ws.oneClick) T.quickTrade(symbol, side, volume());
    else T.openNewOrder({ symbol, side, type: "market" });
  };
  /** why Sell / Buy are off, or the guest note; undefined when they just work */
  const note = blocked ?? (open ? (T.guest ? t("trader.guest.title") : undefined) : t("chart.oneClick.marketClosed"));
  return { bid, ask, dir, delayed, spread, open, blocked, go, note, instant: T.ws.oneClick && !T.guest };
}

/** The floating Sell · lot · Buy box under the chart legend (collapsible to a small pill). */
export function OneClickPanel({ symbol, compact, top, left }: { symbol: string; compact?: boolean; top: number; left?: number }) {
  const T = useTerminal();
  const t = useT();
  const [lot, setLot] = React.useState(String(T.ws.lot.toFixed(2)));
  React.useEffect(() => {
    setLot(T.ws.lot.toFixed(2));
  }, [T.ws.lot]);
  const vol = Math.max(0.01, parseFloat(lot) || 0.01);
  const q = useQuickTrade(symbol, () => vol);
  const commitLot = () => {
    const v = Math.max(0.01, Math.round(vol * 100) / 100);
    T.setWs({ lot: v });
    setLot(v.toFixed(2));
  };
  const step = (d: number) => {
    const inc = vol >= 10 ? 1 : vol >= 1 ? 0.1 : 0.01;
    const v = Math.max(0.01, +(vol + d * inc).toFixed(2));
    setLot(v.toFixed(2));
    T.setWs({ lot: v });
  };
  const [collapsed, setCollapsed] = React.useState(false);
  if (collapsed)
    return (
      <button
        className="absolute left-2 z-[6] flex h-8 items-center gap-1.5 rounded-[8px] border border-line-top bg-panel-2/95 px-2.5 text-[12px] font-semibold text-fg-2 shadow-[0_6px_20px_-8px_rgba(0,0,0,0.6)] hover:text-fg"
        style={{ top, left }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setCollapsed(false)}
        aria-label={t("chart.oneClick.show")}
      >
        <span className="size-1.5 rounded-full bg-down" />
        <span className="size-1.5 rounded-full bg-buy" />
        {t("chart.oneClick.collapsed")}
      </button>
    );
  return (
    <div data-tour="oneclick" className="absolute left-2 z-[6] flex items-stretch overflow-hidden rounded-[9px] border border-line-top bg-panel-2 shadow-[0_6px_20px_-8px_rgba(0,0,0,0.6)]" style={{ top, left }} onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
      <button onClick={() => q.go("sell")} disabled={!q.open || !!q.blocked} title={q.note} className={cn("group flex flex-col items-start bg-down/12 px-2 py-1 text-left transition-colors hover:bg-down/25 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-60", compact ? "min-w-[74px]" : "min-w-[92px]")} aria-label={t(q.open ? "chart.oneClick.sellAria" : "chart.oneClick.sellClosedAria", { symbol })}>
        <span className="flex items-center gap-1 text-[11px] font-semibold text-down">{q.instant && <Zap className="size-3 fill-current" aria-hidden />}{t("common.sell")}</span>
        <PriceText symbol={symbol} value={q.bid} dir={q.dir} className={compact ? "text-[12px]" : "text-[14px]"} />
      </button>
      <div className="flex w-[84px] flex-col items-center justify-center border-x border-line bg-panel px-0.5">
        <div className="flex w-full items-center">
          <button onClick={() => step(-1)} className="grid size-5 shrink-0 place-items-center rounded text-[13px] leading-none text-fg-3 hover:bg-surface-3 hover:text-fg" aria-label={t("chart.oneClick.decrease")}>−</button>
          <input
            aria-label={t("chart.oneClick.lot")}
            value={lot}
            onChange={(e) => setLot(e.target.value.replace(/[^0-9.]/g, ""))}
            onBlur={commitLot}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            onWheel={(e) => {
              const v = Math.max(0.01, +(vol + (e.deltaY < 0 ? 0.01 : -0.01)).toFixed(2));
              setLot(v.toFixed(2));
              T.setWs({ lot: v });
            }}
            className="k-num w-full min-w-0 bg-transparent text-center font-mono text-[12px] font-medium text-fg outline-none"
          />
          <button onClick={() => step(1)} className="grid size-5 shrink-0 place-items-center rounded text-[13px] leading-none text-fg-3 hover:bg-surface-3 hover:text-fg" aria-label={t("chart.oneClick.increase")}>+</button>
        </div>
        {!q.open ? <span className="whitespace-nowrap text-[10px] font-semibold text-warn">{t("chart.oneClick.marketClosed")}</span> : q.delayed ? <span className="whitespace-nowrap text-[10px] font-semibold text-warn">{t("desk.side.delayed")}</span> : <span className="font-mono text-[10.5px] text-fg-3">{q.spread}</span>}
      </div>
      <button onClick={() => q.go("buy")} disabled={!q.open || !!q.blocked} title={q.note} className={cn("flex flex-col items-end bg-buy/12 px-2 py-1 text-right transition-colors hover:bg-buy/25 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-60", compact ? "min-w-[74px]" : "min-w-[92px]")} aria-label={t(q.open ? "chart.oneClick.buyAria" : "chart.oneClick.buyClosedAria", { symbol })}>
        <span className="flex items-center gap-1 text-[11px] font-semibold text-buy">{t("common.buy")}{q.instant && <Zap className="size-3 fill-current" aria-hidden />}</span>
        <PriceText symbol={symbol} value={q.ask} dir={q.dir} className={cn("justify-end", compact ? "text-[12px]" : "text-[14px]")} />
      </button>
      <button onClick={() => setCollapsed(true)} className="grid w-6 place-items-center border-l border-line bg-panel text-fg-3 hover:text-fg" aria-label={t("chart.oneClick.hide")} title={t("chart.oneClick.hideShort")}>
        <ChevronUp className="size-3.5" />
      </button>
    </div>
  );
}

/** Sell price | spread | Buy price at the right end of the chart toolbar, trading the box's lot (TradingView style). */
export function QuotePair({ symbol }: { symbol: string }) {
  const T = useTerminal();
  const t = useT();
  const q = useQuickTrade(symbol, () => T.ws.lot);
  const tip = q.note ?? (q.instant ? t("chart.toolbar.quoteTipOn", { lot: fmtVol(T.ws.lot) }) : t("chart.toolbar.quoteTipOff"));
  const side = "flex h-full items-center gap-1.5 px-2 transition-colors disabled:cursor-not-allowed disabled:opacity-55";
  return (
    <div className="flex h-7 shrink-0 items-stretch overflow-hidden rounded-[7px] border border-line">
      <Tip content={tip} side="bottom">
        <button onClick={() => q.go("sell")} disabled={!q.open || !!q.blocked} aria-label={t(q.open ? "chart.oneClick.sellAria" : "chart.oneClick.sellClosedAria", { symbol })} className={cn(side, "bg-down/12 hover:bg-down/22")}>
          <span className="flex items-center gap-0.5 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-down">
            {q.instant && <Zap className="size-2.5 fill-current" aria-hidden />}
            {t("common.sell")}
          </span>
          <PriceText symbol={symbol} value={q.bid} dir={q.dir} className="text-[12.5px]" />
        </button>
      </Tip>
      <Tip content={t("chart.toolbar.spread")} side="bottom">
        <span tabIndex={0} className="grid min-w-[28px] place-items-center border-x border-line bg-panel px-1 font-mono text-[10.5px] text-fg-3">
          {q.spread}
        </span>
      </Tip>
      <Tip content={tip} side="bottom">
        <button onClick={() => q.go("buy")} disabled={!q.open || !!q.blocked} aria-label={t(q.open ? "chart.oneClick.buyAria" : "chart.oneClick.buyClosedAria", { symbol })} className={cn(side, "bg-buy/12 hover:bg-buy/22")}>
          <PriceText symbol={symbol} value={q.ask} dir={q.dir} className="text-[12.5px]" />
          <span className="flex items-center gap-0.5 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-buy">
            {t("common.buy")}
            {q.instant && <Zap className="size-2.5 fill-current" aria-hidden />}
          </span>
        </button>
      </Tip>
    </div>
  );
}
