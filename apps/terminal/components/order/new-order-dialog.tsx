"use client";

import * as React from "react";
import { Activity, ShoppingCart } from "lucide-react";
import { getInstrument } from "@kalks/mock";
import { PriceText, SymbolAvatar, cn, useQuote } from "@kalks/ui";
import { useTerminal } from "@/lib/store";
import { getRange, getTicks, useMarketClock } from "@/lib/market";
import { fmtPrice } from "@/lib/trading";
import { TDialog } from "@/components/ui/primitives";
import { IconButton } from "@/components/ui/kit";
import { OrderTicket } from "./order-ticket";
import { useT } from "@kalks/i18n/react";

const TICKS_KEY = "kalks.order.ticks";

/**
 * The order form as a centred popup (docs/TERMINAL-DESIGN.md §2.2): Buy / Sell on the chart (one-click off), New
 * order, F9, a price in Instruments or a level in the order book open it with the side / price filled in. The
 * Exness-style form: side → type → volume → SL / TP → summary → one confirm button naming the trade. The MT5 tick
 * chart can be shown beside it (header button, remembered).
 */
export function NewOrderDialog() {
  const T = useTerminal();
  const t = useT();
  const pre = T.ui.newOrder;
  const [symbol, setSymbol] = React.useState(pre?.symbol ?? "EURUSD");
  const [ticks, setTicks] = React.useState(false);
  React.useEffect(() => {
    if (pre) setSymbol(pre.symbol);
  }, [pre]);
  React.useEffect(() => {
    try {
      setTicks(localStorage.getItem(TICKS_KEY) === "1");
    } catch {
      /* private mode */
    }
  }, []);
  const toggleTicks = () =>
    setTicks((v) => {
      try {
        localStorage.setItem(TICKS_KEY, v ? "0" : "1");
      } catch {
        /* private mode */
      }
      return !v;
    });
  const close = React.useCallback(() => T.setUi({ newOrder: null }), [T]);
  if (!pre) return null;
  return (
    <TDialog
      open
      onClose={close}
      width={ticks ? 860 : 440}
      icon={<ShoppingCart />}
      title={t("order.dialog.title")}
      subtitle={`${T.account.login} · ${T.account.server} · ${t.dyn(`order.mode.${T.account.mode}`, T.account.mode)}`}
      actions={
        <IconButton label={ticks ? t("desk.op.hideTicks") : t("desk.op.showTicks")} active={ticks} onClick={toggleTicks} className="hidden md:inline-grid">
          <Activity />
        </IconButton>
      }
    >
      <div className={cn(ticks && "grid md:grid-cols-[1fr_400px]")}>
        {ticks && <TickPanel symbol={symbol} />}
        <div className={cn("p-4", ticks && "border-t border-line md:border-s md:border-t-0")} data-tour="order-popup">
          <OrderTicket key={`${symbol}-${pre.side}-${pre.type}-${pre.price}`} symbol={symbol} onSymbol={setSymbol} prefill={{ side: pre.side, type: pre.type, price: pre.price }} variant="dialog" onDone={close} />
        </div>
      </div>
    </TDialog>
  );
}

function TickPanel({ symbol }: { symbol: string }) {
  useMarketClock();
  const t = useT();
  const q = useQuote(symbol);
  const inst = getInstrument(symbol);
  const r = getRange(symbol);
  const ticks = [...getTicks(symbol)];
  if (ticks[ticks.length - 1] !== q.bid) ticks.push(q.bid);
  const W = 400;
  const H = 300;
  const spread = q.ask - q.bid;
  const lo = Math.min(...ticks) - spread;
  const hi = Math.max(...ticks) + spread * 2;
  const y = (v: number) => H - 10 - ((v - lo) / Math.max(1e-9, hi - lo)) * (H - 20);
  const n = ticks.length;
  const x = (i: number) => (n <= 1 ? W : (i / (n - 1)) * (W - 60));
  const bidPts = ticks.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const askPts = ticks.map((v, i) => `${x(i)},${y(v + spread)}`).join(" ");
  return (
    <div className="flex min-w-0 flex-col bg-panel-2/30 p-4">
      <div className="flex items-center gap-2.5">
        <SymbolAvatar symbol={symbol} size={22} />
        <div>
          <div className="text-[14px] font-semibold">{symbol}</div>
          <div className="text-[12px] text-fg-3">{inst.name}</div>
        </div>
        <div className="ms-auto flex gap-4 text-end">
          <div>
            <div className="text-[12px] font-semibold text-down">{t("order.tick.bid")}</div>
            <PriceText symbol={symbol} value={q.bid} dir={q.dir} className="text-[18px]" />
          </div>
          <div>
            <div className="text-[12px] font-semibold text-up">{t("order.tick.ask")}</div>
            <PriceText symbol={symbol} value={q.ask} dir={q.dir} className="text-[18px]" />
          </div>
        </div>
      </div>
      <div className="relative mt-3 min-h-[240px] flex-1 overflow-hidden rounded-[10px] border border-line bg-[var(--t-chart-bg)]">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full">
          {[0.2, 0.4, 0.6, 0.8].map((f) => (
            <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="var(--t-grid)" />
          ))}
          <polyline points={askPts} fill="none" stroke="var(--k-down)" strokeOpacity={0.7} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
          <polyline points={bidPts} fill="none" stroke="var(--k-fg-2)" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
          <line x1={0} x2={W} y1={y(q.bid)} y2={y(q.bid)} stroke="var(--k-fg-3)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute right-1 rounded-[3px] bg-surface-3 px-1 font-mono text-[10px] text-fg" style={{ top: `calc(${(y(q.bid) / H) * 100}% - 8px)` }}>
          {fmtPrice(symbol, q.bid)}
        </span>
        <span className="absolute right-1 rounded-[3px] bg-down px-1 font-mono text-[10px] text-white" style={{ top: `calc(${(y(q.ask) / H) * 100}% - 8px)` }}>
          {fmtPrice(symbol, q.ask)}
        </span>
        <span className="absolute left-2 top-1.5 font-mono text-[11px] text-fg-3">{t("order.tick.chart", { n })}</span>
      </div>
      <div className="mt-2.5 grid grid-cols-4 gap-1.5 font-mono text-[12px]">
        {[
          [t("order.tick.low"), fmtPrice(symbol, r.low), "text-down"],
          [t("order.tick.high"), fmtPrice(symbol, r.high), "text-up"],
          [t("order.tick.spread"), t("order.unit.pts", { n: Math.round(spread * 10 ** inst.digits) }), "text-fg-2"],
          [t("order.tick.change"), `${q.change >= 0 ? "+" : ""}${q.change.toFixed(2)}%`, q.change >= 0 ? "text-up" : "text-down"],
        ].map(([k, v, c]) => (
          <div key={k} className="rounded-[8px] border border-line bg-panel px-2 py-1.5">
            <div className="font-sans text-[11.5px] text-fg-3">{k}</div>
            <div className={cn("k-num", c)} dir="ltr">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
