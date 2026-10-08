"use client";

// The right-hand column of the desktop terminal (docs/TERMINAL-DESIGN.md §2.2), MT5 web style: Instruments (search,
// asset classes, Symbol · Bid · Ask · Daily change), the Order book and its Ticks / Trades, and, when chosen in the
// Layout menu, the Navigator. Collapses to a slim edge button; in Full chart mode it slides in over the chart.
import * as React from "react";
import dynamic from "next/dynamic";
import { ChevronsRight } from "lucide-react";
import { useT } from "@ezymex/i18n/react";
import { useTerminal, type SideTab } from "@/lib/store";
import { PanelTabs } from "@/components/ui/panel";
import { IconButton } from "@/components/ui/kit";
import { InstrumentsPanel } from "@/components/market/instruments";
import { Navigator } from "@/components/market/navigator";
import { CfdOrderBook, TickTape } from "@/components/order/order-book";
import { showSide } from "./commands";

// the options column: its own chunk, like the rest of the options workspace
const OptionsSide = dynamic(() => import("@/components/options/side").then((m) => m.OptionsSide), { ssr: false, loading: () => <div className="h-full animate-pulse" /> });
const OptionsTradesLabel = dynamic(() => import("@/components/options/side").then((m) => m.OptionsTradesLabel), { ssr: false, loading: () => <span>…</span> });

export function SideColumn({ options, onClose }: { options: boolean; onClose: () => void }) {
  const T = useTerminal();
  const t = useT();
  const side: SideTab = options && T.ws.side === "navigator" ? "instruments" : T.ws.side;
  const tabs: { value: SideTab; label: React.ReactNode }[] = [
    { value: "instruments", label: options ? t("trader.opt.inst.title") : t("desk.side.instruments") },
    { value: "book", label: t("desk.ob.title") },
    { value: "ticks", label: options ? <OptionsTradesLabel /> : t("desk.ob.ticks") },
    ...(!options && side === "navigator" ? [{ value: "navigator" as const, label: t("desk.panel.navigator") }] : []),
  ];
  return (
    <section data-tour="column" aria-label={t("desk.side.title")} className="t-glass flex h-full min-h-0 flex-col overflow-hidden rounded-[14px] border border-line">
      <header className="flex h-10 shrink-0 items-center gap-1 px-1.5">
        <PanelTabs<SideTab> value={side} onChange={(v) => showSide(T, v)} tabs={tabs} className="min-w-0 flex-1" />
        <IconButton label={t("desk.side.hide")} shortcut="Ctrl+M" onClick={onClose}>
          <ChevronsRight className="rtl:-scale-x-100" />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1">
        {options ? (
          <OptionsSide tab={side === "navigator" ? "instruments" : side} />
        ) : side === "instruments" ? (
          <InstrumentsPanel />
        ) : side === "book" ? (
          <CfdOrderBook symbol={T.activeSymbol} />
        ) : side === "ticks" ? (
          <TickTape symbol={T.activeSymbol} />
        ) : (
          <Navigator />
        )}
      </div>
    </section>
  );
}
