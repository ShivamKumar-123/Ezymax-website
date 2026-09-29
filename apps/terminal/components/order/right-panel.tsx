"use client";

import * as React from "react";
import { ChevronsRight, Clock, Info, Layers3, ShoppingCart } from "lucide-react";
import { getInstrument } from "@kalks/mock";
import { PriceText, SymbolAvatar, cn, useQuote } from "@kalks/ui";
import { useTerminal } from "@/lib/store";
import { getRange, getTicks, useMarketClock } from "@/lib/market";
import { contractSpec, fmtPrice, pipSize } from "@/lib/trading";
import { PanelHeader, PanelTabs } from "@/components/ui/panel";
import { KV, TIcon } from "@/components/ui/primitives";
import { OrderTicket } from "./order-ticket";
import { DomLadder } from "./dom-ladder";
import { useT } from "@kalks/i18n/react";

export function RightPanel({ onCollapse }: { onCollapse?: () => void }) {
  const T = useTerminal();
  const t = useT();
  const symbol = T.activeSymbol;
  // guests have no trading account, so no depth ladder with one-click trading
  const tab = T.guest && T.ws.rightTab === "depth" ? "info" : T.ws.rightTab;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        icon={<ShoppingCart />}
        title={
          <span className="flex items-center gap-1.5">
            {t("order.panel.order")}
            <span className="font-normal normal-case tracking-normal text-fg-3">· {symbol}</span>
          </span>
        }
      >
        {onCollapse && (
          <TIcon label={t("order.panel.collapse")} onClick={onCollapse}>
            <ChevronsRight className="rtl:-scale-x-100" />
          </TIcon>
        )}
      </PanelHeader>
      <div className="flex h-8 shrink-0 items-stretch border-b border-line px-1">
        <PanelTabs
          value={tab}
          onChange={(v) => T.setWs({ rightTab: v })}
          tabs={[{ value: "order", label: t("order.panel.tabOrder") }, ...(T.guest ? [] : [{ value: "depth" as const, label: t("order.panel.tabDepth") }]), { value: "info", label: t("order.panel.tabInfo") }]}
        />
      </div>
      <div className="t-scroll min-h-0 flex-1 overflow-y-auto">
        {tab === "order" && <OrderTicket key={symbol} symbol={symbol} />}
        {tab === "depth" && <DomLadder symbol={symbol} />}
        {tab === "info" && <SymbolInfo symbol={symbol} />}
      </div>
    </div>
  );
}

export function SymbolInfo({ symbol }: { symbol: string }) {
  useMarketClock();
  const t = useT();
  const q = useQuote(symbol);
  const inst = getInstrument(symbol);
  const spec = contractSpec(symbol);
  const r = getRange(symbol);
  const pip = pipSize(inst);
  const pct = Math.max(0, Math.min(100, ((q.bid - r.low) / Math.max(1e-9, r.high - r.low)) * 100));
  return (
    <div className="space-y-3 p-2.5">
      <div className="flex items-center gap-2.5">
        <SymbolAvatar symbol={symbol} size={26} />
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold">{symbol}</div>
          <div className="truncate text-[11px] text-fg-3">
            {inst.name} · {t.dyn(`order.assetClass.${inst.assetClass}`, inst.assetClass)}
          </div>
        </div>
        <div className="ms-auto text-end">
          <PriceText symbol={symbol} value={q.bid} dir={q.dir} className="text-[15px]" />
          <div className={cn("k-num font-mono text-[10.5px]", q.change >= 0 ? "text-up" : "text-down")} dir="ltr">
            {q.change >= 0 ? "+" : ""}
            {q.change.toFixed(2)}%
          </div>
        </div>
      </div>

      <Section icon={<Clock />} title={t("order.info.today")}>
        <div className="mb-1.5 flex justify-between font-mono text-[10.5px] text-fg-3">
          <span>
            {t("order.tick.low")} <span className="text-down">{fmtPrice(symbol, r.low)}</span>
          </span>
          <span>
            {t("order.tick.high")} <span className="text-up">{fmtPrice(symbol, r.high)}</span>
          </span>
        </div>
        <div className="relative h-1.5 rounded-full bg-gradient-to-r from-down/50 via-surface-3 to-up/50">
          <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel bg-fg" style={{ left: `${pct}%` }} />
        </div>
        <KV k={t("order.info.open")} v={fmtPrice(symbol, r.open)} className="mt-1.5" />
        <KV k={t("order.info.range")} v={t("order.unit.pips", { n: ((r.high - r.low) / pip).toFixed(1) })} />
        <KV k={t("order.tick.spread")} v={t("order.unit.pts", { n: Math.round((q.ask - q.bid) * 10 ** inst.digits) })} />
        <TickSpark symbol={symbol} />
      </Section>

      <Section icon={<Layers3 />} title={t("order.info.contract")}>
        <KV k={t("order.info.contractSize")} v={spec.contractSize.toLocaleString("en-US")} />
        <KV k={t("order.info.digitsPip")} v={`${spec.digits} · ${spec.pip}`} />
        <KV k={t("order.info.tickSize")} v={spec.tickSize} />
        <KV k={t("order.info.volumeMinMaxStep")} v={<span dir="ltr">{`${spec.minVolume} / ${spec.maxVolume} / ${spec.step}`}</span>} />
        <KV k={t("order.info.marginProfitCcy")} v={`${spec.marginCcy} · ${spec.profitCcy}`} />
        <KV k={t("order.info.stopsLevel")} v={t("order.unit.pts", { n: spec.stopsLevel })} />
        <KV k={t("order.info.execution")} v={spec.execution === "Market" ? t("order.info.executionMarket") : spec.execution} />
        <KV k={t("order.info.expiration")} v={t("order.info.expirationValue")} />
      </Section>

      <Section icon={<Info />} title={t("order.info.swapsSessions")}>
        <KV k={t("order.info.swapLong")} v={<span className="text-down">{t("order.unit.pts", { n: spec.swapLong.toFixed(2) })}</span>} />
        <KV k={t("order.info.swapShort")} v={<span className={spec.swapShort >= 0 ? "text-up" : "text-down"}>{t("order.unit.pts", { n: spec.swapShort.toFixed(2) })}</span>} />
        <KV k={t("order.info.tripleSwap")} v={t.dyn(`order.info.tripleSwapDay.${spec.tripleSwap}`, spec.tripleSwap)} />
        <KV k={t("order.info.tradingSession")} v={<span className="whitespace-normal text-[11px]" dir="ltr">{spec.sessions}</span>} />
        <KV k={t("order.info.serverTime")} v={<span dir="ltr">GMT+3</span>} />
      </Section>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[7px] border border-line bg-surface-2/35 px-2.5 py-2">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-3 [&>svg]:size-3">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

/** Small tick chart of the latest bids (MT5 order-window style). */
export function TickSpark({ symbol, height = 44, className }: { symbol: string; height?: number; className?: string }) {
  useMarketClock();
  const q = useQuote(symbol);
  const ticks = [...getTicks(symbol)];
  if (ticks[ticks.length - 1] !== q.bid) ticks.push(q.bid);
  const n = ticks.length;
  if (n < 2) return <div style={{ height }} className={className} />;
  const lo = Math.min(...ticks);
  const hi = Math.max(...ticks);
  const W = 240;
  const pts = ticks.map((v, i) => `${(i / (n - 1)) * W},${height - 3 - ((v - lo) / Math.max(1e-9, hi - lo)) * (height - 6)}`).join(" ");
  const up = ticks[n - 1]! >= ticks[0]!;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className={cn("mt-1.5 w-full", className)} style={{ height }}>
      <polyline points={pts} fill="none" stroke={up ? "var(--k-up)" : "var(--k-down)"} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
