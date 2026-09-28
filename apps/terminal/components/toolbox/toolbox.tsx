"use client";

import * as React from "react";
import { BarChart3, ChevronDown, ChevronsDown, History, Layers, Maximize2, Minimize2, PieChart } from "lucide-react";
import { cn } from "@kalks/ui";
import { useTerminal, type ToolboxTab } from "@/lib/store";
import { PanelTabs } from "@/components/ui/panel";
import { TIcon } from "@/components/ui/primitives";
import { DropMenu } from "@/components/ui/menu";
import { TradeTab, bulkMenu } from "./trade-tab";
import { AlertsTab, CalendarTab, ExposureTab, HistoryTab, JournalTab, NewsTab } from "./tabs";
import { AiTraderTab, useAi } from "./ai-trader";
import { ShareControls } from "@/components/share/share-dialogs";
import { GuestNotice } from "@/components/shell/guest";

/** Guest mode: account-only tabs explain what they show once a trading account is logged in. */
const GUEST_TABS: Partial<Record<ToolboxTab, { icon: React.ReactNode; text: string }>> = {
  trade: { icon: <BarChart3 />, text: "Open positions, pending orders, balance, equity and margin appear here once you log in to a trading account. Charts, quotes and alerts work now." },
  history: { icon: <History />, text: "Your closed trades and performance stats are listed here once you log in to a trading account." },
  exposure: { icon: <PieChart />, text: "Net exposure by currency and asset is calculated from your open positions once you log in to a trading account." },
};

export function Toolbox({ onCollapse, onMaximize, maximized }: { onCollapse?: () => void; onMaximize?: () => void; maximized?: boolean }) {
  const T = useTerminal();
  const tab = T.ws.toolboxTab;
  const ai = useAi();
  const tabs: { value: ToolboxTab; label: string; count?: number }[] = [
    { value: "trade", label: "Trade", count: T.positions.length + T.pendings.length },
    { value: "history", label: "History" },
    { value: "exposure", label: "Exposure" },
    // news and calendar are sample content: shown in demo builds only
    ...(T.live ? [] : ([{ value: "news", label: "News", count: 3 }, { value: "calendar", label: "Calendar" }] as const)),
    { value: "alerts", label: "Alerts", count: T.alerts.filter((a) => a.active).length },
    { value: "journal", label: "Journal" },
    { value: "ai", label: "AI Trader", count: ai.records.filter((r) => r.status === "active").length },
  ];
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[8px] border border-line bg-panel">
      <header className="flex h-8 shrink-0 items-stretch gap-1 border-b border-line bg-panel-2 pl-2.5 pr-1">
        <span className="flex items-center gap-1.5 pr-2 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-fg-2">
          <Layers className="size-3.5 text-fg-3" />
          Toolbox
        </span>
        <PanelTabs value={tab} onChange={(v) => T.setWs({ toolboxTab: v })} tabs={tabs} className="min-w-0 flex-1" />
        <div className="flex shrink-0 items-center gap-0.5">
          {!T.guest && (tab === "trade" || tab === "history") && <ShareControls />}
          {!T.readOnly && !T.guest && tab === "trade" && (
            <DropMenu
              align="end"
              width={230}
              items={bulkMenu(T)}
              trigger={({ toggle, open }) => (
                <button onClick={toggle} className={cn("mr-1 flex h-6 items-center gap-1 rounded-[5px] border border-line px-2 text-[11px] font-medium", open ? "bg-surface-3 text-fg" : "text-fg-2 hover:bg-surface-3 hover:text-fg")}>
                  Bulk close <ChevronDown className="size-3" />
                </button>
              )}
            />
          )}
          {onMaximize && (
            <TIcon label={maximized ? "Restore" : "Maximise"} onClick={onMaximize}>
              {maximized ? <Minimize2 /> : <Maximize2 />}
            </TIcon>
          )}
          {onCollapse && (
            <TIcon label="Hide Toolbox (Ctrl+T)" onClick={onCollapse}>
              <ChevronsDown />
            </TIcon>
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1">
        {T.guest && GUEST_TABS[tab] ? (
          <GuestNotice icon={GUEST_TABS[tab]!.icon} text={GUEST_TABS[tab]!.text} />
        ) : (
          <ToolboxBody tab={T.live && (tab === "news" || tab === "calendar") ? "journal" : tab} />
        )}
      </div>
    </section>
  );
}

function ToolboxBody({ tab }: { tab: ToolboxTab }) {
  return (
    <>
        {tab === "trade" && <TradeTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "exposure" && <ExposureTab />}
        {tab === "news" && <NewsTab />}
        {tab === "calendar" && <CalendarTab />}
        {tab === "alerts" && <AlertsTab />}
        {tab === "journal" && <JournalTab />}
        {tab === "ai" && <AiTraderTab />}
    </>
  );
}
