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
import { LiveCalendarTab, LiveNewsTab } from "./news-live";
import { ShareControls } from "@/components/share/share-dialogs";
import { GuestNotice } from "@/components/shell/guest";
import { useT } from "@kalks/i18n/react";

/** Guest mode: account-only tabs explain what they show once a trading account is logged in. */
const GUEST_TABS: Partial<Record<ToolboxTab, { icon: React.ReactNode; textKey: "toolbox.guest.trade" | "toolbox.guest.history" | "toolbox.guest.exposure" }>> = {
  trade: { icon: <BarChart3 />, textKey: "toolbox.guest.trade" },
  history: { icon: <History />, textKey: "toolbox.guest.history" },
  exposure: { icon: <PieChart />, textKey: "toolbox.guest.exposure" },
};

export function Toolbox({ onCollapse, onMaximize, maximized }: { onCollapse?: () => void; onMaximize?: () => void; maximized?: boolean }) {
  const T = useTerminal();
  const t = useT();
  const tab = T.ws.toolboxTab;
  const ai = useAi();
  const tabs: { value: ToolboxTab; label: string; count?: number }[] = [
    { value: "trade", label: t("toolbox.tab.trade"), count: T.positions.length + T.pendings.length },
    { value: "history", label: t("toolbox.tab.history") },
    { value: "exposure", label: t("toolbox.tab.exposure") },
    // live builds: real headlines and calendar (services/news); demo builds: sample content
    ...(T.live ? [{ value: "news" as const, label: t("toolbox.tab.news") }, { value: "calendar" as const, label: t("toolbox.tab.calendar") }] : [{ value: "news" as const, label: t("toolbox.tab.news"), count: 3 }, { value: "calendar" as const, label: t("toolbox.tab.calendar") }]),
    { value: "alerts", label: t("toolbox.tab.alerts"), count: T.alerts.filter((a) => a.active).length },
    { value: "journal", label: t("toolbox.tab.journal") },
    { value: "ai", label: t("toolbox.tab.ai"), count: ai.records.filter((r) => r.status === "active").length },
  ];
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[8px] border border-line bg-panel">
      <header className="flex h-8 shrink-0 items-stretch gap-1 border-b border-line bg-panel-2 ps-2.5 pe-1">
        <span className="flex items-center gap-1.5 pe-2 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-fg-2">
          <Layers className="size-3.5 text-fg-3" />
          {t("toolbox.title")}
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
                <button onClick={toggle} className={cn("me-1 flex h-6 items-center gap-1 rounded-[5px] border border-line px-2 text-[11px] font-medium", open ? "bg-surface-3 text-fg" : "text-fg-2 hover:bg-surface-3 hover:text-fg")}>
                  {t("toolbox.bulkClose")} <ChevronDown className="size-3" />
                </button>
              )}
            />
          )}
          {onMaximize && (
            <TIcon label={maximized ? t("toolbox.restore") : t("toolbox.maximise")} onClick={onMaximize}>
              {maximized ? <Minimize2 /> : <Maximize2 />}
            </TIcon>
          )}
          {onCollapse && (
            <TIcon label={t("toolbox.hide")} onClick={onCollapse}>
              <ChevronsDown />
            </TIcon>
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1">
        {T.guest && GUEST_TABS[tab] ? (
          <GuestNotice icon={GUEST_TABS[tab]!.icon} text={t(GUEST_TABS[tab]!.textKey)} />
        ) : (
          <ToolboxBody tab={tab} live={T.live} />
        )}
      </div>
    </section>
  );
}

function ToolboxBody({ tab, live }: { tab: ToolboxTab; live: boolean }) {
  return (
    <>
        {tab === "trade" && <TradeTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "exposure" && <ExposureTab />}
        {tab === "news" && (live ? <LiveNewsTab /> : <NewsTab />)}
        {tab === "calendar" && (live ? <LiveCalendarTab /> : <CalendarTab />)}
        {tab === "alerts" && <AlertsTab />}
        {tab === "journal" && <JournalTab />}
        {tab === "ai" && <AiTraderTab />}
    </>
  );
}
