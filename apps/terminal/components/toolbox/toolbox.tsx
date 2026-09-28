"use client";

import * as React from "react";
import { ChevronDown, ChevronsDown, Layers, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@kalks/ui";
import { useTerminal, type ToolboxTab } from "@/lib/store";
import { PanelTabs } from "@/components/ui/panel";
import { TIcon } from "@/components/ui/primitives";
import { DropMenu } from "@/components/ui/menu";
import { TradeTab, bulkMenu } from "./trade-tab";
import { AlertsTab, CalendarTab, ExposureTab, HistoryTab, JournalTab, NewsTab } from "./tabs";
import { AiTraderTab, useAi } from "./ai-trader";
import { ShareControls } from "@/components/share/share-dialogs";

export function Toolbox({ onCollapse, onMaximize, maximized }: { onCollapse?: () => void; onMaximize?: () => void; maximized?: boolean }) {
  const T = useTerminal();
  const tab = T.ws.toolboxTab;
  const ai = useAi();
  const tabs: { value: ToolboxTab; label: string; count?: number }[] = [
    { value: "trade", label: "Trade", count: T.positions.length + T.pendings.length },
    { value: "history", label: "History" },
    { value: "exposure", label: "Exposure" },
    { value: "news", label: "News", count: 3 },
    { value: "calendar", label: "Calendar" },
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
          {(tab === "trade" || tab === "history") && <ShareControls />}
          {!T.readOnly && tab === "trade" && (
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
        {tab === "trade" && <TradeTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "exposure" && <ExposureTab />}
        {tab === "news" && <NewsTab />}
        {tab === "calendar" && <CalendarTab />}
        {tab === "alerts" && <AlertsTab />}
        {tab === "journal" && <JournalTab />}
        {tab === "ai" && <AiTraderTab />}
      </div>
    </section>
  );
}
