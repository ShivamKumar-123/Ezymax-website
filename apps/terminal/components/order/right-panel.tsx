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

export function RightPanel({ onCollapse }: { onCollapse?: () => void }) {
  const T = useTerminal();
  const symbol = T.activeSymbol;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        icon={<ShoppingCart />}
        title={
          <span className="flex items-center gap-1.5">
            Order
            <span className="font-normal normal-case tracking-normal text-fg-3">· {symbol}</span>
          </span>
        }
      >
        {onCollapse && (
          <TIcon label="Collapse" onClick={onCollapse}>
            <ChevronsRight />
          </TIcon>
        )}
      </PanelHeader>
      <div className="flex h-8 shrink-0 items-stretch border-b border-line px-1">
        <PanelTabs
          value={T.ws.rightTab}
          onChange={(v) => T.setWs({ rightTab: v })}
          tabs={[
            { value: "order", label: "Order" },
            { value: "depth", label: "Depth" },
            { value: "info", label: "Info" },
          ]}
        />
      </div>
      <div className="t-scroll min-h-0 flex-1 overflow-y-auto">
        {T.ws.rightTab === "order" && <OrderTicket key={symbol} symbol={symbol} />}
        {T.ws.rightTab === "depth" && <DomLadder symbol={symbol} />}
        {T.ws.rightTab === "info" && <SymbolInfo symbol={symbol} />}
      </div>
    </div>
  );
}

export function SymbolInfo({ symbol }: { symbol: string }) {
  useMarketClock();
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
            {inst.name} · {inst.assetClass}
          </div>
        </div>
        <div className="ml-auto text-right">
          <PriceText symbol={symbol} value={q.bid} dir={q.dir} className="text-[15px]" />
          <div className={cn("k-num font-mono text-[10.5px]", q.change >= 0 ? "text-up" : "text-down")}>
            {q.change >= 0 ? "+" : ""}
            {q.change.toFixed(2)}%
          </div>
        </div>
      </div>

      <Section icon={<Clock />} title="Today">
        <div className="mb-1.5 flex justify-between font-mono text-[10.5px] text-fg-3">
          <span>
            Low <span className="text-down">{fmtPrice(symbol, r.low)}</span>
          </span>
          <span>
            High <span className="text-up">{fmtPrice(symbol, r.high)}</span>
          </span>
        </div>
        <div className="relative h-1.5 rounded-full bg-gradient-to-r from-down/50 via-surface-3 to-up/50">
          <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel bg-fg" style={{ left: `${pct}%` }} />
        </div>
        <KV k="Open" v={fmtPrice(symbol, r.open)} className="mt-1.5" />
        <KV k="Range" v={`${((r.high - r.low) / pip).toFixed(1)} pips`} />
        <KV k="Spread" v={`${Math.round((q.ask - q.bid) * 10 ** inst.digits)} pts`} />
        <TickSpark symbol={symbol} />
      </Section>

      <Section icon={<Layers3 />} title="Contract">
        <KV k="Contract size" v={spec.contractSize.toLocaleString("en-US")} />
        <KV k="Digits · pip" v={`${spec.digits} · ${spec.pip}`} />
        <KV k="Tick size" v={spec.tickSize} />
        <KV k="Volume min / max / step" v={`${spec.minVolume} / ${spec.maxVolume} / ${spec.step}`} />
        <KV k="Margin · profit ccy" v={`${spec.marginCcy} · ${spec.profitCcy}`} />
        <KV k="Stops level" v={`${spec.stopsLevel} pts`} />
        <KV k="Execution" v={spec.execution} />
        <KV k="Expiration" v="GTC · Today · Date" />
      </Section>

      <Section icon={<Info />} title="Swaps & sessions">
        <KV k="Swap long" v={<span className="text-down">{spec.swapLong.toFixed(2)} pts</span>} />
        <KV k="Swap short" v={<span className={spec.swapShort >= 0 ? "text-up" : "text-down"}>{spec.swapShort.toFixed(2)} pts</span>} />
        <KV k="3-day swap" v={spec.tripleSwap} />
        <KV k="Trading session" v={<span className="whitespace-normal text-[11px]">{spec.sessions}</span>} />
        <KV k="Server time" v="GMT+3" />
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
