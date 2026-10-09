"use client";

import * as React from "react";
import { useTerminal, type Layout } from "@/lib/store";
import { chartRegistry } from "@/components/chart/engine";
import { openActivity, showSide, toggleFullChart, toggleFullscreen, toggleOneClick } from "./commands";
import { openIndicatorList } from "@/components/chart/indicators/state";
import { deleteSelectedDrawing, redoDrawings, undoDrawings } from "@/components/chart/drawings";
import { getTradeMode } from "@/lib/options/mode";

/**
 * Global terminal keyboard shortcuts (MT5-compatible where possible). On an Options account the CFD chart's keys
 * (indicators, chart grid, crosshair, zoom) do nothing, and F9 / Ctrl+D / F10 say the account trades options only.
 * TradingView charts (chart/tv-chart.tsx) take the chart keys themselves: indicators, undo / redo and zoom go to the
 * library; with the focus inside a chart the library forwards the terminal's keys here.
 */
export function useHotkeys() {
  const T = useTerminal();
  const ref = React.useRef(T);
  ref.current = T;
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = ref.current;
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      const mod = e.metaKey || e.ctrlKey;
      const cfd = getTradeMode() === "cfd";
      const tv = chartRegistry.get(t.ws.activeId)?.tv;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        t.setUi({ search: !t.ui.search });
        return;
      }
      if (mod && e.key.toLowerCase() === "i" && cfd) {
        e.preventDefault();
        if (tv) tv.indicators();
        else openIndicatorList(t.activeTab.id); // MT5: Ctrl+I = indicators list
        return;
      }
      if (e.key === "F9") {
        e.preventDefault();
        t.openNewOrder();
        return;
      }
      if (e.key === "F10") {
        e.preventDefault();
        toggleOneClick(t);
        return;
      }
      if (e.key === "F1") {
        e.preventDefault();
        t.setUi({ shortcuts: true });
        return;
      }
      if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
      if (e.altKey && /^Digit[1-4]$/.test(e.code) && cfd) {
        e.preventDefault();
        const n = e.code.slice(5);
        const l: Layout = n === "1" ? "1" : n === "2" ? "2h" : n === "3" ? "2v" : "4";
        t.setLayout(l);
        return;
      }
      if (mod && e.key.toLowerCase() === "m") {
        e.preventDefault();
        showSide(t, "instruments", true);
        return;
      }
      if (mod && e.key.toLowerCase() === "t") {
        // full page: scroll down to the positions; split: show / hide the panel under the chart
        e.preventDefault();
        if (t.ws.posLayout === "split") t.togglePanel("toolbox");
        else openActivity(t, t.ws.toolboxTab);
        return;
      }
      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        showSide(t, "book", true);
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        // the order form is a popup now (F9 too)
        e.preventDefault();
        t.openNewOrder();
        return;
      }
      if (mod && e.key.toLowerCase() === "f" && cfd && !tv) {
        e.preventDefault();
        t.setDrawTool(t.drawTool === "crosshair" ? "cursor" : "crosshair");
        return;
      }
      if (typing) return;
      // drawings: Ctrl/⌘+Z undoes, Ctrl/⌘+Shift+Z or Ctrl+Y redoes (text fields keep their own undo above)
      if (mod && !e.altKey && (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")) {
        e.preventDefault();
        const redo = e.key.toLowerCase() === "y" || e.shiftKey;
        if (tv) (redo ? tv.redo : tv.undo)();
        else if (redo) redoDrawings(t);
        else undoDrawings(t);
        return;
      }
      if (e.key === "F" && e.shiftKey && !mod && !e.altKey) {
        e.preventDefault();
        toggleFullChart(t);
        return;
      }
      if (e.key === "Escape" && t.ui.fullChart && t.drawTool === "cursor" && !t.selectedDrawing && !document.querySelector("[role=dialog]")) {
        toggleFullChart(t, false);
        return;
      }
      if (e.key === "Escape") {
        if (t.drawTool !== "cursor") t.setDrawTool("cursor");
        if (t.selectedDrawing) t.selectDrawing(null);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && t.selectedDrawing) {
        e.preventDefault();
        deleteSelectedDrawing(t);
        return;
      }
      if (!cfd) return;
      if (e.key === "+" || e.key === "=") chartRegistry.get(t.ws.activeId)?.zoom(1);
      if (e.key === "-" || e.key === "_") chartRegistry.get(t.ws.activeId)?.zoom(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
