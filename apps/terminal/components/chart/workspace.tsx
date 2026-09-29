"use client";

import * as React from "react";
import { toast } from "@/lib/notify";
import {
  AreaChart,
  BarChart3,
  Camera,
  CandlestickChart,
  ChevronDown,
  Crosshair,
  FileStack,
  LineChart,
  Minus,
  MousePointer2,
  Plus,
  Ruler,
  Scan,
  Spline,
  Square,
  Trash2,
  TrendingUp,
  Type,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { SymbolAvatar, cn } from "@kalks/ui";
import { useTerminal, type DrawTool } from "@/lib/store";
import { useT } from "@kalks/i18n/react";
import type { MessageKey } from "@kalks/i18n";
import { CHART_TYPES, TIMEFRAMES, type ChartType } from "@/lib/trading";
import { DropMenu } from "@/components/ui/menu";
import { ChartView } from "./chart-view";
import { chartRegistry } from "./engine";
import { BUILTIN_TEMPLATES, applyTemplate, deleteTemplate, openIndicatorList, openSaveTemplate, shortList, templateMatches, useUserTemplates } from "./indicators/state";

const TYPE_ICON: Record<ChartType, React.ReactNode> = {
  candles: <CandlestickChart />,
  bars: <BarChart3 />,
  line: <LineChart />,
  area: <AreaChart />,
};

export function ChartWorkspace() {
  const T = useTerminal();
  const slots = T.ws.slots.map((id) => T.ws.tabs.find((t) => t.id === id)!).filter(Boolean);
  const layout = T.ws.layout;
  const grid = layout === "1" ? "grid-cols-1 grid-rows-1" : layout === "2h" ? "grid-cols-2 grid-rows-1" : layout === "2v" ? "grid-cols-1 grid-rows-2" : "grid-cols-2 grid-rows-2";
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[8px] border border-line bg-panel">
      <ChartTabs />
      <ChartToolbar />
      <div className="flex min-h-0 flex-1">
        <DrawingBar />
        <div className={cn("grid min-h-0 min-w-0 flex-1 gap-1 p-1 pl-0", grid)}>
          {slots.map((tab) => (
            <ChartView key={tab.id} tab={tab} active={tab.id === T.ws.activeId && slots.length > 0} onActivate={() => T.ws.activeId !== tab.id && T.activateTab(tab.id)} compact={layout === "4"} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

function ChartTabs() {
  const T = useTerminal();
  const t = useT();
  return (
    <div className="flex h-8 shrink-0 items-stretch border-b border-line bg-panel-2">
      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:none]">
        {T.ws.tabs.map((ct) => {
          const on = ct.id === T.ws.activeId;
          const shown = T.ws.slots.includes(ct.id);
          return (
            <div
              key={ct.id}
              role="tab"
              aria-selected={on}
              onClick={() => T.activateTab(ct.id)}
              onAuxClick={(e) => e.button === 1 && T.closeTab(ct.id)}
              className={cn(
                "group relative flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-line pl-2.5 pr-1 text-[11.5px] transition-colors",
                on ? "bg-panel text-fg" : "text-fg-3 hover:bg-panel hover:text-fg-2",
              )}
            >
              {on && <span className="absolute inset-x-0 top-0 h-[2px] bg-ember" />}
              <SymbolAvatar symbol={ct.symbol} size={13} />
              <span className="font-medium">{ct.symbol}</span>
              <span className="font-mono text-[10.5px] text-fg-3">,{ct.tf}</span>
              {shown && !on && <span className="size-1 rounded-full bg-fg-3" title={t("chart.tab.visibleInGrid")} />}
              <button
                aria-label={t("chart.tab.close", { symbol: ct.symbol })}
                onClick={(e) => {
                  e.stopPropagation();
                  T.closeTab(ct.id);
                }}
                className="ml-0.5 grid size-4 place-items-center rounded-[3px] text-fg-3 opacity-0 hover:bg-surface-3 hover:text-fg group-hover:opacity-100 aria-[selected=true]:opacity-100"
                style={on ? { opacity: 1 } : undefined}
              >
                <X className="size-3" />
              </button>
            </div>
          );
        })}
        <button onClick={() => T.addTab()} aria-label={t("chart.tab.new")} title={t("chart.tab.new")} className="grid w-8 shrink-0 place-items-center text-fg-3 hover:bg-panel hover:text-fg">
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toolbar                                                             */
/* ------------------------------------------------------------------ */

function Sep() {
  return <span className="mx-1 h-4 w-px shrink-0 bg-line" />;
}

function ChartToolbar() {
  const T = useTerminal();
  const t = useT();
  const tab = T.activeTab;
  const userTpl = useUserTemplates();
  const reg = () => chartRegistry.get(tab.id);
  return (
    <div className="@container flex h-8 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-line px-1.5 [scrollbar-width:none]">
      <DropMenu
        width={260}
        items={[{ header: t("chart.toolbar.symbol") }, ...["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "US30", "BTCUSD", "ETHUSD", "USOIL"].map((s) => ({ label: s, checked: s === tab.symbol, onSelect: () => T.openSymbol(s) })), "sep", { label: t("chart.toolbar.searchAll"), hint: "Ctrl+K", onSelect: () => T.setUi({ search: true }) }]}
        trigger={({ toggle }) => (
          <button onClick={toggle} className="flex h-6 shrink-0 items-center gap-1.5 rounded-[5px] px-1.5 text-[12px] font-semibold text-fg hover:bg-surface-3">
            <SymbolAvatar symbol={tab.symbol} size={14} />
            {tab.symbol}
            <ChevronDown className="size-3 text-fg-3" />
          </button>
        )}
      />
      <Sep />
      <div className="flex shrink-0 items-center">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => T.updateTab(tab.id, { tf, drawings: tab.tf === tf ? tab.drawings : [] })}
            className={cn("h-6 rounded-[5px] px-[7px] font-mono text-[11px] font-medium transition-colors", tab.tf === tf ? "bg-ember-soft text-ember" : "text-fg-3 hover:bg-surface-3 hover:text-fg")}
          >
            {tf}
          </button>
        ))}
      </div>
      <Sep />
      <div className="flex shrink-0 items-center">
        {CHART_TYPES.map((ct) => (
          <button key={ct} title={t(`trader.chartType.${ct}`)} aria-label={t(`trader.chartType.${ct}`)} onClick={() => T.updateTab(tab.id, { type: ct })} className={cn("grid size-6 place-items-center rounded-[5px] [&_svg]:size-3.5", tab.type === ct ? "bg-ember-soft text-ember" : "text-fg-3 hover:bg-surface-3 hover:text-fg")}>
            {TYPE_ICON[ct]}
          </button>
        ))}
      </div>
      <Sep />
      <button
        onClick={() => openIndicatorList(tab.id)}
        title={t("chart.toolbar.indicatorsTitle")}
        aria-haspopup="dialog"
        className="flex h-6 shrink-0 items-center gap-1 rounded-[5px] px-1.5 text-[11.5px] text-fg-2 hover:bg-surface-3 hover:text-fg"
      >
        <Spline className="size-3.5" />
        <span className="hidden @[620px]:inline">{t("chart.toolbar.indicators")}</span>
        {tab.indicators.length > 0 && <span className="k-num rounded-[3px] bg-ember-soft px-1 font-mono text-[10px] text-ember">{tab.indicators.length}</span>}
      </button>
      <DropMenu
        width={280}
        items={[
          { header: t("chart.toolbar.builtIn") },
          ...BUILTIN_TEMPLATES.map((tp) => ({ label: t.dyn(`chart.template.${tp.id}`, tp.name), checked: templateMatches(tp, tab), onSelect: () => applyTemplate(T, [tab.id], tp) })),
          { header: t("chart.toolbar.myTemplates") },
          ...(userTpl.length ? userTpl.map((tp) => ({ label: tp.name, hint: `${tp.indicators.length}`, checked: templateMatches(tp, tab), onSelect: () => applyTemplate(T, [tab.id], tp) })) : [{ label: t("chart.toolbar.noTemplates"), disabled: true }]),
          "sep",
          { label: t("chart.toolbar.saveTemplate"), onSelect: () => openSaveTemplate(tab.id) },
          { label: t("chart.toolbar.deleteTemplate"), disabled: !userTpl.length, items: userTpl.map((tp) => ({ label: tp.name, danger: true, onSelect: () => deleteTemplate(tp.id) })) },
          { label: t("chart.toolbar.applyToAll"), onSelect: () => applyTemplate(T, T.ws.tabs.map((x) => x.id), { id: "cur", name: `${tab.symbol} ${tab.tf}`, type: tab.type, indicators: tab.indicators }) },
        ]}
        trigger={({ toggle, open }) => (
          <button onClick={toggle} className={cn("flex h-6 shrink-0 items-center gap-1 rounded-[5px] px-1.5 text-[11.5px] hover:bg-surface-3 hover:text-fg", open ? "bg-surface-3 text-fg" : "text-fg-2")}>
            <FileStack className="size-3.5" />
            <span className="hidden @[620px]:inline">{t("chart.toolbar.templates")}</span>
            <ChevronDown className="size-3 text-fg-3" />
          </button>
        )}
      />
      <Sep />
      <ToolIcon label={t("chart.toolbar.crosshair")} active={T.drawTool === "crosshair"} onClick={() => T.setDrawTool(T.drawTool === "crosshair" ? "cursor" : "crosshair")}>
        <Crosshair />
      </ToolIcon>
      <ToolIcon label={t("chart.toolbar.zoomIn")} onClick={() => reg()?.zoom(1)}>
        <ZoomIn />
      </ToolIcon>
      <ToolIcon label={t("chart.toolbar.zoomOut")} onClick={() => reg()?.zoom(-1)}>
        <ZoomOut />
      </ToolIcon>
      <ToolIcon label={t("chart.toolbar.resetView")} onClick={() => reg()?.fit()}>
        <Scan />
      </ToolIcon>
      <ToolIcon label={t("chart.toolbar.screenshot")} onClick={() => reg()?.screenshot()}>
        <Camera />
      </ToolIcon>
      <div className="ml-auto hidden shrink-0 items-center gap-1.5 pl-2 font-mono text-[10.5px] text-fg-3 xl:flex">
        {tab.indicators.length > 0 && <span className="max-w-[320px] truncate">{shortList(tab).join(" · ")}</span>}
      </div>
    </div>
  );
}

function ToolIcon({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={label} aria-label={label} onClick={onClick} className={cn("grid size-6 shrink-0 place-items-center rounded-[5px] [&_svg]:size-3.5", active ? "bg-ember-soft text-ember" : "text-fg-3 hover:bg-surface-3 hover:text-fg")}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Left vertical drawing toolbar                                       */
/* ------------------------------------------------------------------ */

const TOOLS: { id: DrawTool; label: MessageKey; icon: React.ReactNode; soon?: boolean }[] = [
  { id: "cursor", label: "chart.tool.cursor", icon: <MousePointer2 /> },
  { id: "crosshair", label: "chart.tool.crosshair", icon: <Crosshair /> },
  { id: "hline", label: "chart.tool.hline", icon: <Minus /> },
  { id: "trend", label: "chart.tool.trend", icon: <TrendingUp /> },
  { id: "fib", label: "chart.tool.fib", icon: <FibIcon /> },
  { id: "rect", label: "chart.tool.rect", icon: <Square /> },
  { id: "text", label: "chart.tool.text", icon: <Type />, soon: true },
  { id: "ruler", label: "chart.tool.ruler", icon: <Ruler />, soon: true },
];

function FibIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M2 3h12M2 6.5h12M2 9.5h12M2 13h12" />
      <path d="M3 13L13 3" strokeDasharray="1.6 1.6" />
    </svg>
  );
}

function DrawingBar() {
  const T = useTerminal();
  const t = useT();
  const n = T.activeTab.drawings.length;
  return (
    <div className="flex w-9 shrink-0 flex-col items-center gap-0.5 py-1.5">
      {TOOLS.map((tl) => (
        <button
          key={tl.id}
          title={t(tl.label)}
          aria-label={t(tl.label)}
          onClick={() => {
            if (tl.soon) return void toast(t("chart.tool.coming", { tool: t(tl.label) }), { description: t("chart.tool.comingText") });
            T.setDrawTool(T.drawTool === tl.id && tl.id !== "cursor" ? "cursor" : tl.id);
          }}
          className={cn("grid size-7 place-items-center rounded-[6px] transition-colors [&_svg]:size-[15px]", T.drawTool === tl.id ? "bg-ember-soft text-ember" : "text-fg-3 hover:bg-surface-3 hover:text-fg")}
        >
          {tl.icon}
        </button>
      ))}
      <span className="my-1 h-px w-5 bg-line" />
      <button
        title={t("chart.tool.deleteAll")}
        aria-label={t("chart.tool.deleteAll")}
        onClick={() => {
          if (!n) return void toast(t("chart.tool.noObjects"));
          T.updateTab(T.activeTab.id, { drawings: [] });
          T.selectDrawing(null);
          toast(t("chart.tool.deleted", { count: n }), { description: `${T.activeTab.symbol}, ${T.activeTab.tf}` });
        }}
        className="relative grid size-7 place-items-center rounded-[6px] text-fg-3 hover:bg-down-soft hover:text-down [&_svg]:size-[15px]"
      >
        <Trash2 />
        {n > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-3 min-w-3 place-items-center rounded-full bg-ember px-0.5 font-mono text-[8px] text-white">{n}</span>}
      </button>
    </div>
  );
}
