"use client";

import * as React from "react";
import { toast } from "@/lib/notify";
import { useTerminal, type Layout } from "@/lib/store";
import { chartRegistry } from "@/components/chart/engine";
import { toggleFullscreen } from "./title-bar";
import { openIndicatorList } from "@/components/chart/indicators/state";
import { guestNotice } from "@/lib/guest";

/** Global terminal keyboard shortcuts (MT5-compatible where possible). */
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
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        t.setUi({ search: !t.ui.search });
        return;
      }
      if (mod && e.key.toLowerCase() === "i") {
        e.preventDefault();
        openIndicatorList(t.activeTab.id); // MT5: Ctrl+I = indicators list
        return;
      }
      if (e.key === "F9") {
        e.preventDefault();
        t.openNewOrder();
        return;
      }
      if (e.key === "F10") {
        e.preventDefault();
        if (t.readOnly) return;
        if (t.guest) return void guestNotice("One-click trading");
        const v = !t.ws.oneClick;
        t.setWs({ oneClick: v });
        toast(v ? "One-click trading enabled" : "One-click trading disabled", { description: v ? "Chart and DOM orders execute instantly." : "Chart and DOM buttons open the order window." });
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
      if (e.altKey && /^Digit[1-4]$/.test(e.code)) {
        e.preventDefault();
        const n = e.code.slice(5);
        const l: Layout = n === "1" ? "1" : n === "2" ? "2h" : n === "3" ? "2v" : "4";
        t.setLayout(l);
        return;
      }
      if (mod && e.key.toLowerCase() === "m") {
        e.preventDefault();
        t.togglePanel("watch");
        return;
      }
      if (mod && e.key.toLowerCase() === "t") {
        e.preventDefault();
        t.togglePanel("toolbox");
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        t.togglePanel("right");
        return;
      }
      if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        t.setDrawTool(t.drawTool === "crosshair" ? "cursor" : "crosshair");
        return;
      }
      if (typing) return;
      if (e.key === "Escape") {
        if (t.drawTool !== "cursor") t.setDrawTool("cursor");
        if (t.selectedDrawing) t.selectDrawing(null);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && t.selectedDrawing) {
        e.preventDefault();
        t.deleteSelectedDrawing();
        return;
      }
      if (e.key === "+" || e.key === "=") chartRegistry.get(t.ws.activeId)?.zoom(1);
      if (e.key === "-" || e.key === "_") chartRegistry.get(t.ws.activeId)?.zoom(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
