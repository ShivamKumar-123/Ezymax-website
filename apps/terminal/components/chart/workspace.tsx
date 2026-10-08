"use client";

// Chart card (docs/TERMINAL-DESIGN.md §2.2), TradingView / broker-terminal style. Row 1: every open chart as a tab with
// its flags (scrolls sideways, "Open charts" lists them all when they don't fit) and + New chart. Row 2, the toolbar:
// symbol search · timeframe favourites 1m 30m 1h 4h D (+ the current one) and the rest in a menu · chart type ·
// indicators · templates · layout · undo / redo · New order · zoom | save layout · alert · picture · full chart · full
// screen. Left: the drawing rail (tools, magnet, lock, hide, delete all). Under the charts: date
// range presets 5y … 1d and the server clock. The plot itself carries only the legend, the Buy / Sell box and the K mark.
import * as React from "react";
import { toast } from "@/lib/notify";
import { AreaChart, BarChart3, Bell, Brush, Camera, CandlestickChart, ChevronDown, CirclePlus, Crosshair, Expand, Eye, EyeOff, FileStack, LayoutPanelLeft, LineChart, Lock, LockOpen, Magnet, Maximize2, Minimize2, Minus, MousePointer2, Plus, Redo2, Ruler, Save, Scan, ShoppingCart, Shrink, Spline, Square, Trash2, TrendingUp, Type, Undo2, X, ZoomIn, ZoomOut } from "lucide-react";
import { SymbolAvatar, cn } from "@ezymex/ui";
import { getInstrument } from "@ezymex/mock";
import { useTerminal, type ChartTab, type DrawTool } from "@/lib/store";
import { useT } from "@ezymex/i18n/react";
import type { MessageKey } from "@ezymex/i18n";
import { CHART_TYPES, TIMEFRAMES, serverTime, serverZone, type ChartType, type Timeframe } from "@/lib/trading";
import { DropMenu } from "@/components/ui/menu";
import { CountBadge, IconButton, Tip } from "@/components/ui/kit";
import { useLayoutItems, openActivity, saveLayout, toggleFullChart, toggleFullscreen } from "@/components/shell/commands";
import { ChartView } from "./chart-view";
import { chartRegistry, pendingRanges } from "./engine";
import { clearDrawings, redoDrawings, setDrawPrefs, undoDrawings, useDrawPrefs, useDrawingHistory } from "./drawings";
import { BUILTIN_TEMPLATES, applyTemplate, deleteTemplate, openIndicatorList, openSaveTemplate, templateMatches, useUserTemplates } from "./indicators/state";

const TYPE_ICON: Record<ChartType, React.ReactNode> = {
  candles: <CandlestickChart />,
  bars: <BarChart3 />,
  line: <LineChart />,
  area: <AreaChart />,
};

/** Short timeframe labels as TradingView shows them (MT5 codes stay in menus and the legend). */
export const TF_SHORT: Record<Timeframe, string> = { M1: "1m", M5: "5m", M15: "15m", M30: "30m", H1: "1h", H4: "4h", D1: "D", W1: "W", MN: "M" };
/** Timeframes always on the toolbar; the current one joins them when it isn't one. */
const TF_FAVOURITES: Timeframe[] = ["M1", "M30", "H1", "H4", "D1"];

/** "EUR/JPY", "XAU/USD", "BTC/USD"; other markets keep their symbol. */
export function marketLabel(symbol: string) {
  const inst = getInstrument(symbol);
  const pair = inst.assetClass === "forex" || inst.assetClass === "metals" || (inst.assetClass === "crypto" && /^[A-Z]{3,5}USD$/.test(symbol));
  return pair && /^[A-Z]{6,8}$/.test(symbol) ? `${symbol.slice(0, -3)}/${symbol.slice(-3)}` : symbol;
}

export function ChartWorkspace() {
  const T = useTerminal();
  const slots = T.ws.slots.map((id) => T.ws.tabs.find((t) => t.id === id)!).filter(Boolean);
  const layout = T.ws.layout;
  const grid = layout === "1" ? "grid-cols-1 grid-rows-1" : layout === "2h" ? "grid-cols-2 grid-rows-1" : layout === "2v" ? "grid-cols-1 grid-rows-2" : "grid-cols-2 grid-rows-2";
  return (
    <section data-tour="chart" className="t-glass flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[14px] border border-line">
      <ChartTabs />
      <ChartBar />
      <div className="flex min-h-0 flex-1">
        <DrawingBar />
        <div className={cn("grid min-h-0 min-w-0 flex-1 gap-1.5 pb-1.5 pe-1.5", grid)}>
          {slots.map((tab) => (
            <ChartView key={tab.id} tab={tab} active={tab.id === T.ws.activeId && slots.length > 0} highlight={tab.id === T.ws.activeId && slots.length > 1} onActivate={() => T.ws.activeId !== tab.id && T.activateTab(tab.id)} compact={layout === "4"} />
          ))}
        </div>
      </div>
      <RangeBar />
    </section>
  );
}

function Sep({ className }: { className?: string }) {
  return <span className={cn("mx-1 h-6 w-px shrink-0 bg-line", className)} aria-hidden />;
}

/* ------------------------------------------------------------------ */
/* Row 1: open charts                                                  */
/* ------------------------------------------------------------------ */

/** Every open chart as a tab (flags, market, timeframe); × closes, middle-click too. Scrolls sideways when they don't fit. */
function ChartTabs() {
  const T = useTerminal();
  const t = useT();
  const scroller = React.useRef<HTMLDivElement>(null);
  const [edge, setEdge] = React.useState({ left: false, right: false });
  React.useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const f = () => setEdge((e) => {
      const left = el.scrollLeft > 2;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      return e.left === left && e.right === right ? e : { left, right };
    });
    f();
    const ro = new ResizeObserver(f);
    ro.observe(el);
    el.addEventListener("scroll", f, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", f);
    };
  }, [T.ws.tabs.length]);
  // keep the active tab in view (scrolls the strip only, never the page)
  React.useEffect(() => {
    const el = scroller.current;
    const tab = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !tab) return;
    const r = tab.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    if (r.left < box.left) el.scrollLeft -= box.left - r.left + 8;
    else if (r.right > box.right) el.scrollLeft += r.right - box.right + 8;
  }, [T.ws.activeId, T.ws.tabs.length]);
  const fade = edge.left && edge.right ? "[mask-image:linear-gradient(to_right,transparent,#000_24px,#000_calc(100%-24px),transparent)]" : edge.right ? "[mask-image:linear-gradient(to_right,#000_calc(100%-24px),transparent)]" : edge.left ? "[mask-image:linear-gradient(to_right,transparent,#000_24px)]" : "";
  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b border-line px-1.5">
      <div
        ref={scroller}
        role="tablist"
        aria-label={t("desk.ch.openCharts")}
        onWheel={(e) => {
          // a mouse wheel scrolls the strip sideways
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && scroller.current) scroller.current.scrollLeft += e.deltaY;
        }}
        className={cn("flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", fade)}
      >
        {T.ws.tabs.map((ct) => {
          const on = ct.id === T.ws.activeId;
          const shown = T.ws.slots.includes(ct.id);
          return (
            <div
              key={ct.id}
              role="tab"
              tabIndex={on ? 0 : -1}
              aria-selected={on}
              onClick={() => T.activateTab(ct.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && T.activateTab(ct.id)}
              onAuxClick={(e) => e.button === 1 && T.closeTab(ct.id)}
              title={`${ct.symbol}, ${ct.tf} · ${getInstrument(ct.symbol).name}`}
              className={cn("group flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-[8px] border ps-1.5 pe-0.5 text-[12.5px] transition-colors", on ? "border-line-top bg-surface-3 text-fg" : "border-transparent text-fg-2 hover:bg-surface-3/50 hover:text-fg")}
            >
              <SymbolAvatar symbol={ct.symbol} size={16} />
              <span className="font-semibold">{marketLabel(ct.symbol)}</span>
              <span className="font-mono text-[11px] text-fg-3">{TF_SHORT[ct.tf]}</span>
              {shown && !on && <span className="size-1.5 rounded-full bg-fg-3" title={t("chart.tab.visibleInGrid")} />}
              <button
                aria-label={t("chart.tab.close", { symbol: ct.symbol })}
                title={t("chart.tab.close", { symbol: ct.symbol })}
                onClick={(e) => {
                  e.stopPropagation();
                  T.closeTab(ct.id);
                }}
                className={cn("grid size-5 place-items-center overflow-hidden rounded-[5px] text-fg-3 hover:bg-panel hover:text-fg", on ? "opacity-100" : "w-0 opacity-0 focus-visible:w-5 focus-visible:opacity-100 group-hover:w-5 group-hover:opacity-100")}
              >
                <X className="size-3" />
              </button>
            </div>
          );
        })}
      </div>
      <IconButton label={t("desk.ch.newChart")} size="sm" onClick={() => T.addTab()}>
        <Plus />
      </IconButton>
      {(edge.left || edge.right) && <OpenChartsMenu />}
    </div>
  );
}

/** Every open chart in a menu (shown when the tabs don't all fit). */
function OpenChartsMenu() {
  const T = useTerminal();
  const t = useT();
  return (
    <DropMenu
      width={240}
      align="end"
      items={[
        { header: t("desk.ch.openCharts") },
        ...T.ws.tabs.map((ct) => ({ label: `${marketLabel(ct.symbol)}, ${ct.tf}`, icon: <SymbolAvatar symbol={ct.symbol} size={14} />, checked: ct.id === T.ws.activeId, onSelect: () => T.activateTab(ct.id) })),
        "sep",
        { label: t("desk.ch.newChart"), icon: <Plus />, onSelect: () => T.addTab() },
        { label: t("trader.menu.closeChart"), icon: <X />, disabled: T.ws.tabs.length <= 1, onSelect: () => T.closeTab(T.activeTab.id) },
      ]}
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-expanded={open} aria-label={t("desk.ch.openCharts")} title={t("desk.ch.openCharts")} className={cn("ms-auto flex h-6 shrink-0 items-center gap-0.5 rounded-[6px] px-1.5 font-mono text-[11px] transition-colors", open ? "bg-surface-3 text-fg" : "text-fg-2 hover:bg-surface-3 hover:text-fg")}>
          {T.ws.tabs.length}
          <ChevronDown className="size-3.5" />
        </button>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Row 2: the toolbar                                                  */
/* ------------------------------------------------------------------ */

const changeTf = (T: ReturnType<typeof useTerminal>, tab: ChartTab, tf: Timeframe) => T.updateTab(tab.id, { tf, drawings: tab.tf === tf ? tab.drawings : [] });

/** 1m 30m 1h 4h D (+ the current timeframe) and a menu with all nine; narrow cards keep only the menu. */
function Timeframes() {
  const T = useTerminal();
  const t = useT();
  const tab = T.activeTab;
  const shown = TIMEFRAMES.filter((tf) => TF_FAVOURITES.includes(tf) || tf === tab.tf);
  return (
    <>
      <div role="radiogroup" aria-label={t("trader.menu.timeframes")} className="hidden shrink-0 items-center @[600px]:flex">
        {shown.map((tf) => (
          <Tip key={tf} content={`${t(`chart.tf.${tf}`)} · ${tf}`} side="bottom">
            <button
              role="radio"
              aria-checked={tab.tf === tf}
              aria-label={t(`chart.tf.${tf}`)}
              onClick={() => changeTf(T, tab, tf)}
              className={cn("h-9 min-w-[36px] rounded-[6px] px-1.5 text-[14px] font-medium transition-colors", tab.tf === tf ? "bg-surface-3 font-semibold text-buy" : "text-fg-2 hover:bg-surface-3/60 hover:text-fg")}
            >
              {TF_SHORT[tf]}
            </button>
          </Tip>
        ))}
      </div>
      <DropMenu
        width={200}
        items={[{ header: t("trader.menu.timeframes") }, ...TIMEFRAMES.map((tf) => ({ label: t(`chart.tf.${tf}`), hint: tf, checked: tab.tf === tf, onSelect: () => changeTf(T, tab, tf) }))]}
        trigger={({ toggle, open }) => (
          <Tip content={t("chart.toolbar.moreTimeframes")} side="bottom">
            <button onClick={toggle} aria-expanded={open} aria-label={`${t("chart.toolbar.moreTimeframes")}: ${t(`chart.tf.${tab.tf}`)}`} className={cn("flex h-9 shrink-0 items-center gap-0.5 rounded-[6px] px-1.5 text-[14px] font-medium transition-colors", open ? "bg-surface-3 text-fg" : "text-fg-2 hover:bg-surface-3 hover:text-fg")}>
              <span className="@[600px]:hidden">{TF_SHORT[tab.tf]}</span>
              <ChevronDown className="size-4 text-fg-3" />
            </button>
          </Tip>
        )}
      />
    </>
  );
}

/** A toolbar icon button at TradingView's size: 36 px, a 19 px thin-line icon. */
function ToolbarButton({ className, ...p }: React.ComponentProps<typeof IconButton>) {
  return <IconButton {...p} className={cn("size-9 rounded-[6px] [&_svg]:size-[19px] [&_svg]:stroke-[1.6]", className)} />;
}

function ChartBar() {
  const T = useTerminal();
  const t = useT();
  const tab = T.activeTab;
  const userTpl = useUserTemplates();
  const layoutItems = useLayoutItems();
  const history = useDrawingHistory(tab);
  const reg = () => chartRegistry.get(tab.id);
  const full = T.ui.fullChart;
  const btn = (open?: boolean) => cn("flex h-9 shrink-0 items-center gap-1.5 rounded-[6px] px-2 text-[14px] font-medium transition-colors [&>svg]:size-[19px] [&>svg]:stroke-[1.6]", open ? "bg-surface-3 text-fg" : "text-fg-2 hover:bg-surface-3 hover:text-fg");
  return (
    <div role="toolbar" aria-label={t("desk.ch.toolbar")} className="@container flex h-[42px] shrink-0 items-center gap-0.5 border-b border-line px-1.5">
      <ToolbarButton label={t("chart.toolbar.symbolSearch")} shortcut="Ctrl+K" onClick={() => T.setUi({ search: true })}>
        <CirclePlus />
      </ToolbarButton>
      <Sep />
      <Timeframes />
      <Sep />
      <DropMenu
        width={220}
        items={[{ header: t("desk.ch.type") }, ...CHART_TYPES.map((ct) => ({ label: t(`trader.chartType.${ct}`), icon: TYPE_ICON[ct], checked: tab.type === ct, onSelect: () => T.updateTab(tab.id, { type: ct }) }))]}
        trigger={({ toggle, open }) => (
          <Tip content={t("desk.ch.type")} side="bottom">
            <button onClick={toggle} aria-label={`${t("desk.ch.type")}: ${t(`trader.chartType.${tab.type}`)}`} className={cn(btn(open), "gap-0.5 px-1")}>
              {TYPE_ICON[tab.type]}
              <ChevronDown className="!size-3.5 text-fg-3" />
            </button>
          </Tip>
        )}
      />
      <Tip content={t("chart.toolbar.indicatorsTitle")} shortcut="Ctrl+I" side="bottom">
        <button onClick={() => openIndicatorList(tab.id)} aria-haspopup="dialog" aria-label={t("chart.toolbar.indicators")} className={btn()}>
          <Spline />
          <span className="hidden @[1280px]:inline">{t("chart.toolbar.indicators")}</span>
          {tab.indicators.length > 0 && <CountBadge n={tab.indicators.length} tone="accent" />}
        </button>
      </Tip>
      <DropMenu
        width={292}
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
          <Tip content={t("chart.toolbar.templates")} side="bottom">
            <button onClick={toggle} aria-label={t("chart.toolbar.templates")} className={btn(open)}>
              <FileStack />
            </button>
          </Tip>
        )}
      />
      <DropMenu
        align="end"
        width={272}
        items={layoutItems}
        trigger={({ toggle, open }) => (
          <Tip content={t("desk.ch.layout")} side="bottom">
            <button onClick={toggle} aria-expanded={open} aria-label={t("desk.ch.layout")} className={btn(open)}>
              <LayoutPanelLeft />
            </button>
          </Tip>
        )}
      />
      <Sep className="hidden @[560px]:block" />
      <ToolbarButton label={t("chart.toolbar.undo")} shortcut="Ctrl+Z" disabled={!history.canUndo} onClick={() => undoDrawings(T, tab.id)} className="hidden @[560px]:inline-grid">
        <Undo2 />
      </ToolbarButton>
      <ToolbarButton label={t("chart.toolbar.redo")} shortcut="Ctrl+Shift+Z" disabled={!history.canRedo} onClick={() => redoDrawings(T, tab.id)} className="hidden @[560px]:inline-grid">
        <Redo2 />
      </ToolbarButton>
      <Sep />
      <Tip content={t("trader.newOrder")} shortcut="F9" side="bottom">
        <button onClick={() => T.openNewOrder({ symbol: tab.symbol })} disabled={T.readOnly} data-tour="new-order" className="flex h-9 shrink-0 items-center gap-1.5 rounded-[6px] border border-line px-2.5 text-[14px] font-semibold text-fg transition-colors hover:border-ember/50 hover:bg-ember-soft/40 disabled:opacity-45 [&>svg]:size-[18px]">
          <ShoppingCart className="text-accent-text" />
          <span className="hidden @[700px]:inline">{t("trader.newOrder")}</span>
        </button>
      </Tip>
      <ToolbarButton label={t("desk.ch.zoomIn")} shortcut="+" onClick={() => reg()?.zoom(1)} className="hidden @[760px]:inline-grid">
        <ZoomIn />
      </ToolbarButton>
      <ToolbarButton label={t("desk.ch.zoomOut")} shortcut="−" onClick={() => reg()?.zoom(-1)} className="hidden @[760px]:inline-grid">
        <ZoomOut />
      </ToolbarButton>
      <ToolbarButton label={t("desk.ch.fit")} onClick={() => reg()?.fit()} className="hidden @[1240px]:inline-grid">
        <Scan />
      </ToolbarButton>
      <div className="ms-auto flex shrink-0 items-center gap-0.5">
        <ToolbarButton label={t("chart.toolbar.saveLayout")} onClick={() => saveLayout(T)} className="hidden @[1000px]:inline-grid">
          <Save />
        </ToolbarButton>
        <ToolbarButton label={t("desk.ch.alertTip", { symbol: tab.symbol })} onClick={() => openActivity(T, "alerts")} className="hidden @[640px]:inline-grid">
          <Bell />
        </ToolbarButton>
        <ToolbarButton label={t("desk.ch.screenshot")} onClick={() => reg()?.screenshot()}>
          <Camera />
        </ToolbarButton>
        <ToolbarButton label={full ? t("desk.ch.exitFullChart") : t("desk.ch.fullChart")} shortcut="Shift+F" active={full} onClick={() => toggleFullChart(T)} data-tour="full-chart">
          {full ? <Minimize2 /> : <Maximize2 />}
        </ToolbarButton>
        <ToolbarButton label={t("desk.set.fullScreen")} shortcut="F11" onClick={toggleFullscreen}>
          <FullscreenIcon />
        </ToolbarButton>
      </div>
    </div>
  );
}

/** Browser full screen: Expand, or Shrink while the page is full screen. */
function FullscreenIcon() {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    const f = () => setOn(!!document.fullscreenElement);
    f();
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  return on ? <Shrink /> : <Expand />;
}

/* ------------------------------------------------------------------ */
/* Left vertical drawing rail                                          */
/* ------------------------------------------------------------------ */

export const DRAW_TOOLS: { id: DrawTool; label: MessageKey; icon: React.ReactNode; shortcut?: string }[] = [
  { id: "cursor", label: "chart.tool.cursor", icon: <MousePointer2 />, shortcut: "Esc" },
  { id: "crosshair", label: "chart.tool.crosshair", icon: <Crosshair />, shortcut: "Ctrl+F" },
  { id: "trend", label: "chart.tool.trend", icon: <TrendingUp /> },
  { id: "hline", label: "chart.tool.hline", icon: <Minus /> },
  { id: "fib", label: "chart.tool.fib", icon: <FibIcon /> },
  { id: "rect", label: "chart.tool.rect", icon: <Square /> },
  { id: "brush", label: "chart.tool.brush", icon: <Brush /> },
  { id: "text", label: "chart.tool.text", icon: <Type /> },
  { id: "ruler", label: "chart.tool.ruler", icon: <Ruler /> },
];

function FibIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 4.5h18M3 9.75h18M3 14.25h18M3 19.5h18" />
      <path d="M4.5 19.5L19.5 4.5" strokeDasharray="2.4 2.4" />
    </svg>
  );
}

/** The rail's groups, top to bottom (TradingView order): pointers · lines · Fibonacci · shapes · text · measure. */
const RAIL_GROUPS: DrawTool[][] = [["cursor", "crosshair"], ["trend", "hline"], ["fib"], ["rect", "brush"], ["text"], ["ruler"]];
const RAIL_BTN = "size-10 rounded-[6px] [&_svg]:size-[23px] [&_svg]:stroke-[1.4]";
const RAIL_ON = "bg-buy/15 text-buy hover:bg-buy/20 hover:text-buy";

function RailSep() {
  return <span className="my-1 h-px w-8 shrink-0 bg-line" aria-hidden />;
}

function DrawingBar() {
  const T = useTerminal();
  const t = useT();
  const prefs = useDrawPrefs();
  const n = T.activeTab.drawings.length;
  const tools = new Map(DRAW_TOOLS.map((tl) => [tl.id, tl]));
  return (
    <div role="toolbar" aria-label={t("desk.ch.drawings")} aria-orientation="vertical" className="flex w-[52px] shrink-0 flex-col items-center gap-[2px] overflow-y-auto border-e border-line py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {RAIL_GROUPS.map((group, gi) => (
        <React.Fragment key={group.join("-")}>
          {gi > 0 && <RailSep />}
          {group.map((id) => {
            const tl = tools.get(id)!;
            const on = T.drawTool === tl.id;
            return (
              <IconButton key={tl.id} label={t(tl.label)} shortcut={tl.shortcut} tipSide="right" active={on} onClick={() => T.setDrawTool(on && tl.id !== "cursor" ? "cursor" : tl.id)} className={cn(RAIL_BTN, on && RAIL_ON)}>
                {tl.icon}
              </IconButton>
            );
          })}
        </React.Fragment>
      ))}
      <RailSep />
      <IconButton label={t("chart.tool.magnet")} tipSide="right" active={prefs.magnet} onClick={() => setDrawPrefs({ magnet: !prefs.magnet })} className={cn(RAIL_BTN, prefs.magnet && RAIL_ON)}>
        <Magnet />
      </IconButton>
      <IconButton label={t(prefs.locked ? "chart.tool.unlock" : "chart.tool.lock")} tipSide="right" active={prefs.locked} onClick={() => setDrawPrefs({ locked: !prefs.locked })} className={cn(RAIL_BTN, prefs.locked && RAIL_ON)}>
        {prefs.locked ? <Lock /> : <LockOpen />}
      </IconButton>
      <IconButton label={t(prefs.hidden ? "chart.tool.show" : "chart.tool.hide")} tipSide="right" active={prefs.hidden} onClick={() => setDrawPrefs({ hidden: !prefs.hidden })} className={cn(RAIL_BTN, prefs.hidden && RAIL_ON)}>
        {prefs.hidden ? <EyeOff /> : <Eye />}
      </IconButton>
      <RailSep />
      <IconButton
        label={t("desk.ch.deleteDrawings")}
        tipSide="right"
        onClick={() => {
          if (!n) return void toast(t("chart.tool.noObjects"));
          clearDrawings(T, T.activeTab.id);
          toast(t("chart.tool.deleted", { count: n }), { description: `${T.activeTab.symbol}, ${T.activeTab.tf}` });
        }}
        className={cn(RAIL_BTN, "hover:bg-down-soft hover:text-down")}
        badge={n > 0 ? <span className="absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-ember px-1 font-mono text-[10px] text-white">{n}</span> : undefined}
      >
        <Trash2 />
      </IconButton>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Under the charts: date range presets and the server clock           */
/* ------------------------------------------------------------------ */

const DAY = 86400;
/** Each preset picks a timeframe that draws its range in a few hundred bars, then shows that much history. */
const RANGES: { id: string; tf: Timeframe; sec: number; tip: MessageKey }[] = [
  { id: "5y", tf: "W1", sec: 5 * 365 * DAY, tip: "chart.range.5y" },
  { id: "1y", tf: "D1", sec: 365 * DAY, tip: "chart.range.1y" },
  { id: "6m", tf: "H4", sec: 182 * DAY, tip: "chart.range.6m" },
  { id: "3m", tf: "H1", sec: 91 * DAY, tip: "chart.range.3m" },
  { id: "1m", tf: "M30", sec: 30 * DAY, tip: "chart.range.1m" },
  { id: "5d", tf: "M5", sec: 5 * DAY, tip: "chart.range.5d" },
  { id: "1d", tf: "M1", sec: DAY, tip: "chart.range.1d" },
];

function RangeBar() {
  const T = useTerminal();
  const t = useT();
  const tab = T.activeTab;
  const [picked, setPicked] = React.useState<{ tab: string; id: string } | null>(null);
  const pick = (r: (typeof RANGES)[number]) => {
    setPicked({ tab: tab.id, id: r.id });
    if (tab.tf === r.tf) return chartRegistry.get(tab.id)?.setRange(r.sec);
    // a new timeframe rebuilds the chart: it applies the range once its history is drawn
    pendingRanges.set(tab.id, r.sec);
    changeTf(T, tab, r.tf);
  };
  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 border-t border-line ps-[56px] pe-2">
      <div role="group" aria-label={t("chart.range.label")} className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {RANGES.map((r) => {
          const on = picked?.tab === tab.id && picked.id === r.id && tab.tf === r.tf;
          return (
            <Tip key={r.id} content={t(r.tip)} side="top">
              <button onClick={() => pick(r)} aria-pressed={on} aria-label={t(r.tip)} className={cn("h-7 shrink-0 rounded-[6px] px-2 text-[13px] font-medium transition-colors", on ? "bg-surface-3 font-semibold text-buy" : "text-fg-2 hover:bg-surface-3 hover:text-fg")}>
                {r.id}
              </button>
            </Tip>
          );
        })}
      </div>
      <ServerClock />
    </div>
  );
}

/** "14:32:05 UTC+3": broker server time with its real offset (DST-aware), the clock the chart's time axis uses. */
function ServerClock() {
  const t = useT();
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  if (now === null) return null;
  const d = new Date(now);
  const zone = serverZone(d);
  return (
    <Tip content={t("chart.clock.tip", { zone })} side="top">
      <span tabIndex={0} dir="ltr" className="ms-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap ps-2 font-mono text-[11.5px] text-fg-2">
        <span className="k-num">{serverTime(d).time}</span>
        <span className="text-fg-3">{zone}</span>
      </span>
    </Tip>
  );
}
