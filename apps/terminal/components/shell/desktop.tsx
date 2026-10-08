"use client";

// Desktop layout (docs/TERMINAL-DESIGN.md §2.2): chart-first, MT5 web clean, Delta Exchange full-page scroll.
//
//   ┌ top bar (sticky): ☰ · brand · search · account (LIVE · CFD / OPTIONS) · Deposit · bell · profile ────────┐
//   │ chart card (one toolbar row, drawing rail, Buy / Sell box on the plot)        │ Instruments | Order book │
//   │                                                                               │ (collapsible column)     │
//   └ account health · connection · server time · [Positions (3) ↓] ──────────────────────────────────────────┘
//   ── page scrolls ──
//   positions · orders · history · alerts · news … full width
//
// The order form is a centred popup (Buy / Sell on the chart, New order, F9). "Full chart" covers the window with the
// chart; an edge arrow slides the instruments back in. An Options account (the account's product decides, never a
// switch: lib/options/mode.ts) uses the same frame with the options workspace in place of the CFD chart: the
// underlying's chart, the option chain, analytics and the book, the same column and a popup option ticket.
import * as React from "react";
import dynamic from "next/dynamic";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ChevronsLeft } from "lucide-react";
import { cn } from "@ezymex/ui";
import { useTerminal } from "@/lib/store";
import { useT } from "@ezymex/i18n/react";
import { Tip } from "@/components/ui/kit";
import { ChartWorkspace } from "@/components/chart/workspace";
import { Toolbox } from "@/components/toolbox/toolbox";
import { TitleBar } from "./title-bar";
import { ScreenBar } from "./status-bar";
import { SideColumn } from "./side-column";
import { Tour } from "./tour";
import { ACTIVITY_ID, scrollToChart, showSide } from "./commands";
import { useTradeMode } from "@/lib/options/mode";

// Options workspace: its own chunk, downloaded the first time an Options account opens (CFD accounts never load it).
const OptionsMain = dynamic(() => import("@/components/options/desktop").then((m) => m.OptionsMain), { ssr: false, loading: () => <div className="h-full animate-pulse rounded-[14px] border border-line bg-panel" /> });
const OptionsTicketPopup = dynamic(() => import("@/components/options/desktop").then((m) => m.OptionsTicketPopup), { ssr: false });

/** Slim edge button that brings the hidden column back (and, in Full chart, slides it in over the chart). */
function EdgeTab({ label, shortcut, onClick, className }: { label: string; shortcut?: string; onClick: () => void; className?: string }) {
  const t = useT();
  return (
    <Tip content={label} shortcut={shortcut} side="left">
      <button onClick={onClick} aria-label={label} data-tour="edge" className={cn("t-glass flex w-8 shrink-0 flex-col items-center gap-2 rounded-[12px] border border-line py-2.5 text-fg-2 transition-colors hover:border-ember/40 hover:text-fg", className)}>
        <ChevronsLeft className="size-4 rtl:-scale-x-100" />
        <span className="text-[12px] font-medium [writing-mode:vertical-rl]">{t("desk.side.instruments")}</span>
      </button>
    </Tip>
  );
}

function useViewportWidth() {
  const [w, setW] = React.useState(() => (typeof window === "undefined" ? 1600 : window.innerWidth));
  React.useEffect(() => {
    const f = () => setW(window.innerWidth);
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return w;
}

export function DesktopTerminal() {
  const T = useTerminal();
  const t = useT();
  // the active account's product: an Options account shows the options workspace, a CFD account the chart workspace
  const options = useTradeMode() === "options";
  const full = T.ui.fullChart;
  const split = T.ws.posLayout === "split";
  const open = T.ws.panels.watch;
  const [peek, setPeek] = React.useState(false);
  React.useEffect(() => {
    setPeek(false);
  }, [full]);
  // Esc closes the slid-in column first (then a second Esc leaves Full chart)
  React.useEffect(() => {
    if (!peek) return;
    const k = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector("[role=dialog]")) return;
      e.stopImmediatePropagation();
      setPeek(false);
    };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [peek]);
  const vw = useViewportWidth();
  const center = React.useRef<HTMLDivElement>(null);
  // the column: ~320 px, resizable between ~280 and ~440
  const pct = (px: number) => Math.min(45, Math.max(10, (px / Math.max(vw - 16, 1)) * 100));
  const main = options ? <OptionsMain /> : <ChartWorkspace />;
  // dir="ltr": the workspace keeps its arrangement (chart left, column right, prices left-to-right) in
  // Arabic/Urdu/Persian too; only the text is translated. Portaled layers (dialogs, menus) repeat this.
  return (
    <div dir="ltr" className="t-backdrop min-h-dvh">
      {!full && (
        <div className="sticky top-0 z-30">
          <TitleBar />
        </div>
      )}
      {/* the first screen: the chart fills it (split mode: the positions panel shares it, under the chart) */}
      <section className={cn("flex flex-col gap-2", full ? "t-backdrop fixed inset-0 z-40 p-1.5" : "h-[calc(100dvh-48px)] px-2 pb-2 pt-2")}>
        {/* one tree for every state, so the chart never remounts when the column, the positions panel or Full chart toggle */}
        <PanelGroup direction="vertical" autoSaveId="ezymex.terminal5.v" className="min-h-0 flex-1">
          <Panel id="top" order={1} minSize={35}>
            <div className="relative flex h-full min-h-0 gap-2">
              <PanelGroup direction="horizontal" autoSaveId="ezymex.terminal4.h" className="min-w-0 flex-1">
                <Panel id="main" order={1} minSize={40}>
                  <div ref={center} className="h-full min-w-0">
                    {main}
                  </div>
                </Panel>
                {open && !full && (
                  <>
                    <PanelResizeHandle className="t-handle" />
                    <Panel id="side" order={2} defaultSize={pct(344)} minSize={pct(288)} maxSize={pct(480)}>
                      <SideColumn options={options} onClose={() => T.togglePanel("watch", false)} />
                    </Panel>
                  </>
                )}
              </PanelGroup>
              {!open && !full && <EdgeTab label={t("desk.side.show")} shortcut="Ctrl+M" onClick={() => showSide(T, T.ws.side === "navigator" && options ? "instruments" : T.ws.side)} />}
              {full && !peek && <EdgeTab label={t("desk.side.show")} onClick={() => setPeek(true)} className="absolute end-1 top-1/2 z-[5] -translate-y-1/2 shadow-[var(--t-shadow-pop)]" />}
              {full && peek && (
                // below the chart's toolbar row (it keeps Exit full chart reachable), opaque over the live chart
                <div className="t-pop absolute bottom-0 end-0 top-[46px] z-[5] w-[344px] rounded-[14px] bg-panel shadow-[var(--t-shadow-pop)]">
                  <SideColumn options={options} onClose={() => setPeek(false)} />
                </div>
              )}
            </div>
          </Panel>
          {split && !full && T.ws.panels.toolbox && (
            <>
              <PanelResizeHandle className="t-handle" />
              <Panel id="positions" order={2} defaultSize={40} minSize={18} maxSize={65}>
                <Toolbox health={false} />
              </Panel>
            </>
          )}
        </PanelGroup>
        {!full && <ScreenBar />}
      </section>
      {/* full page mode: positions, orders, history… full width below the first screen; the page scrolls down to them */}
      {!full && !split && (
        <section id={ACTIVITY_ID} aria-label={t("desk.panel.activity")} className="scroll-mt-14 px-2 pb-2">
          <div className="h-[calc(100dvh-64px)] min-h-[420px]">
            <Toolbox onTop={scrollToChart} />
          </div>
        </section>
      )}
      {options && <OptionsTicketPopup />}
      <Tour />
    </div>
  );
}
