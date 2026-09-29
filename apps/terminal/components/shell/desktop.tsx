"use client";

import * as React from "react";
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from "react-resizable-panels";
import { useTerminal } from "@/lib/store";
import { useT } from "@kalks/i18n/react";
import { TPanel } from "@/components/ui/panel";
import { MarketWatch } from "@/components/market/market-watch";
import { Navigator } from "@/components/market/navigator";
import { ChartWorkspace } from "@/components/chart/workspace";
import { RightPanel } from "@/components/order/right-panel";
import { Toolbox } from "@/components/toolbox/toolbox";
import { TitleBar } from "./title-bar";
import { StatusBar } from "./status-bar";

function Handle() {
  return <PanelResizeHandle className="t-handle" />;
}

/** Thin edge rail that re-opens a hidden panel. */
function Rail({ label, side, onClick }: { label: string; side: "left" | "right" | "bottom"; onClick: () => void }) {
  const t = useT();
  if (side === "bottom")
    return (
      <button onClick={onClick} className="mt-1 flex h-6 shrink-0 items-center justify-center gap-2 rounded-[6px] border border-line bg-panel text-[10.5px] font-semibold uppercase tracking-[0.09em] text-fg-3 hover:border-ember/40 hover:text-fg">
        {label} ▴
      </button>
    );
  return (
    <button onClick={onClick} className="flex w-6 shrink-0 items-center justify-center rounded-[6px] border border-line bg-panel text-fg-3 hover:border-ember/40 hover:text-fg" title={t("trader.rail.show", { label })}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] [writing-mode:vertical-rl]" style={side === "left" ? { transform: "rotate(180deg)" } : undefined}>
        {label}
      </span>
    </button>
  );
}

/** Panel sizes are percentages; convert pixel minimums so side panels never get cramped. */
function useViewportWidth() {
  const [w, setW] = React.useState(1600);
  React.useEffect(() => {
    const f = () => setW(window.innerWidth);
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return w;
}
/**
 * Toasts sit at the top-right of the chart area: below the chart tabs + toolbar and left of the
 * order panel, so they never cover the chart header or the ticket (see providers.tsx).
 */
function useToastPlacement(ref: React.RefObject<HTMLDivElement | null>) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement.style;
    const place = () => {
      const r = el.getBoundingClientRect();
      root.setProperty("--t-toast-top", `${Math.round(r.top + 74)}px`);
      root.setProperty("--t-toast-right", `${Math.round(window.innerWidth - r.right + 76)}px`);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
      root.removeProperty("--t-toast-top");
      root.removeProperty("--t-toast-right");
    };
  }, [ref]);
}

const pct = (px: number, w: number) => Math.min(45, Math.ceil((px / Math.max(w, 1)) * 100));

export function DesktopTerminal() {
  const T = useTerminal();
  const t = useT();
  const p = T.ws.panels;
  const vw = useViewportWidth();
  // Small laptops: start with Market Watch tucked into its rail so the chart and ticket get room.
  const autoTucked = React.useRef(false);
  React.useEffect(() => {
    if (autoTucked.current || vw === 1600) return;
    autoTucked.current = true;
    if (window.innerWidth < 1200 && p.watch) T.togglePanel("watch", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vw]);
  const leftMin = pct(230, vw);
  const rightMin = pct(268, vw);
  const toolboxRef = React.useRef<ImperativePanelHandle>(null);
  const center = React.useRef<HTMLDivElement>(null);
  useToastPlacement(center);
  const [maxed, setMaxed] = React.useState(false);
  // dir="ltr": the workspace keeps the MT5 arrangement (Market Watch left, order panel right, chart and
  // price columns left-to-right) in Arabic/Urdu/Persian as well. Only the text is translated; RTL scripts
  // still shape correctly inside an LTR container. Portaled layers (dialogs, menus) repeat this.
  return (
    <div dir="ltr" className="flex h-dvh flex-col overflow-hidden bg-page">
      <TitleBar />
      <div className="flex min-h-0 flex-1 flex-col p-1">
        <PanelGroup direction="vertical" autoSaveId="kalks.terminal.v" className="min-h-0 flex-1">
          <Panel id="main" order={1} minSize={30}>
            <div className="flex h-full min-h-0 gap-1">
              {!p.watch && <Rail label={t("trader.panel.marketWatch")} side="left" onClick={() => T.togglePanel("watch", true)} />}
              <PanelGroup direction="horizontal" autoSaveId="kalks.terminal.h" className="min-w-0 flex-1">
                {p.watch && (
                  <>
                    <Panel id="left" order={1} defaultSize={Math.max(19, leftMin)} minSize={leftMin} maxSize={Math.max(32, leftMin + 8)}>
                      {p.navigator ? (
                        <PanelGroup direction="vertical" autoSaveId="kalks.terminal.left">
                          <Panel id="mw" order={1} minSize={30} defaultSize={66}>
                            <TPanel>
                              <MarketWatch onCollapse={() => T.togglePanel("watch", false)} />
                            </TPanel>
                          </Panel>
                          <Handle />
                          <Panel id="nav" order={2} minSize={14} defaultSize={34}>
                            <TPanel>
                              <Navigator />
                            </TPanel>
                          </Panel>
                        </PanelGroup>
                      ) : (
                        <TPanel>
                          <MarketWatch onCollapse={() => T.togglePanel("watch", false)} />
                        </TPanel>
                      )}
                    </Panel>
                    <Handle />
                  </>
                )}
                <Panel id="center" order={2} minSize={30}>
                  <div ref={center} className="h-full min-h-0 min-w-0">
                    <ChartWorkspace />
                  </div>
                </Panel>
                {p.right && (
                  <>
                    <Handle />
                    <Panel id="right" order={3} defaultSize={Math.max(18, rightMin)} minSize={rightMin} maxSize={Math.max(32, rightMin + 8)}>
                      <TPanel>
                        <RightPanel onCollapse={() => T.togglePanel("right", false)} />
                      </TPanel>
                    </Panel>
                  </>
                )}
              </PanelGroup>
              {!p.right && <Rail label={T.guest ? t("trader.panel.orderInfo") : t("trader.panel.orderDom")} side="right" onClick={() => T.togglePanel("right", true)} />}
            </div>
          </Panel>
          {p.toolbox && (
            <>
              <Handle />
              <Panel id="toolbox" order={2} ref={toolboxRef} defaultSize={29} minSize={12} maxSize={75} onResize={(s) => setMaxed(s > 60)}>
                <Toolbox
                  onCollapse={() => T.togglePanel("toolbox", false)}
                  maximized={maxed}
                  onMaximize={() => {
                    const r = toolboxRef.current;
                    if (!r) return;
                    r.resize(maxed ? 29 : 72);
                  }}
                />
              </Panel>
            </>
          )}
        </PanelGroup>
        {!p.toolbox && <Rail label={t("trader.panel.toolbox")} side="bottom" onClick={() => T.togglePanel("toolbox", true)} />}
      </div>
      <StatusBar />
    </div>
  );
}
