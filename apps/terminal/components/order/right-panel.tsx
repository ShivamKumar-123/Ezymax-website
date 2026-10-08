"use client";

// Symbol specification (the Specification dialog) and the small tick sparkline (position dialog). The old permanent
// order panel is gone: the order form is a popup (components/order/new-order-dialog.tsx).
import * as React from "react";
import { Clock, Info, Layers3 } from "lucide-react";
import { getInstrument } from "@ezymex/mock";
import { PriceText, SymbolAvatar, cn, useQuote } from "@ezymex/ui";
import { getRange, getTicks, useMarketClock } from "@/lib/market";
import { contractSpec, fmtPrice, pipSize, serverZone, swapRateText } from "@/lib/trading";
import { KV } from "@/components/ui/primitives";
import { useT } from "@ezymex/i18n/react";

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
    <div className="space-y-3 p-3">
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
        {/* points per lot per night (core instruments) or a yearly % of the position value (catalogue) */}
        <KV k={t("order.info.swapLong")} v={<span className={spec.swapLong >= 0 ? "text-up" : "text-down"}>{swapRateText(t, spec.swapLong, spec.swapUnit)}</span>} />
        <KV k={t("order.info.swapShort")} v={<span className={spec.swapShort >= 0 ? "text-up" : "text-down"}>{swapRateText(t, spec.swapShort, spec.swapUnit)}</span>} />
        <KV k={t("order.info.tripleSwap")} v={spec.swapEveryNight || !spec.tripleSwap ? t("desk.sw.everyNight") : t.dyn(`order.info.tripleSwapDay.${spec.tripleSwap}`, spec.tripleSwap)} />
        <KV k={t("order.info.tradingSession")} v={<span className="whitespace-normal text-[11px]" dir="ltr">{spec.sessions}</span>} />
        <KV k={t("order.info.serverTime")} v={<span dir="ltr">{serverZone()}</span>} />
      </Section>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-line bg-panel-2/50 px-3 py-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-fg-2 [&>svg]:size-3.5">
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
