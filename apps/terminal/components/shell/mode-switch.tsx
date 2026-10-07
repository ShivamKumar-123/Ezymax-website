"use client";

// CFD | Options switch in the terminal header (desktop title bar and mobile header). Same session, account, charts
// and toolbox; Options mode swaps the trading area for the options workspace (loaded on demand) and puts the
// Options / Settlements tabs first in the toolbox.
import * as React from "react";
import { cn } from "@kalks/ui";
import { Tip } from "@/components/ui/kit";
import { useT } from "@kalks/i18n/react";
import { useTerminal, type ToolboxTab } from "@/lib/store";
import { setTradeMode, useTradeMode, type TradeMode } from "@/lib/options/mode";

const CFD_ONLY: ToolboxTab[] = ["positions", "pending", "trade", "history", "exposure"];

export function useSwitchMode() {
  const T = useTerminal();
  return React.useCallback(
    (m: TradeMode) => {
      setTradeMode(m);
      const tab = T.ws.toolboxTab;
      if (m === "options" && CFD_ONLY.includes(tab)) T.setWs({ toolboxTab: "options" });
      if (m === "cfd" && (tab === "settlements" || tab === "closed")) T.setWs({ toolboxTab: "positions" });
    },
    [T],
  );
}

export function ModeSwitch({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
  const t = useT();
  const mode = useTradeMode();
  const sw = useSwitchMode();
  const md = size === "md";
  if (md)
    // iOS-style segmented control: a frosted thumb slides under the active mode
    return (
      <div role="tablist" aria-label={t("trader.opt.mode.label")} data-tour="mode" className={cn("relative grid h-7 shrink-0 grid-cols-2 rounded-[9px] border border-line bg-panel-2/80 p-[2px]", className)}>
        <span
          aria-hidden
          className="t-glass-strong absolute inset-y-[2px] start-[2px] w-[calc(50%-2px)] rounded-[7px] border border-[var(--t-glass-edge)] shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200 ease-out"
          style={{ transform: mode === "options" ? "translateX(100%)" : "translateX(0)" }}
        />
        {(["cfd", "options"] as const).map((m) => (
          <Tip key={m} content={m === "cfd" ? t("trader.opt.mode.cfdHint") : t("trader.opt.mode.optionsHint")} side="bottom">
            <button
              role="tab"
              aria-selected={mode === m}
              onClick={() => sw(m)}
              className={cn("relative z-[1] flex items-center justify-center gap-1 px-2.5 text-[12px] font-semibold transition-colors duration-200", mode === m ? "text-fg" : "text-fg-3 hover:text-fg-2")}
            >
              {m === "cfd" ? t("trader.opt.mode.cfd") : t("trader.opt.mode.options")}
              {m === "options" && mode !== "options" && <span className="size-1.5 rounded-full bg-ember" aria-hidden />}
            </button>
          </Tip>
        ))}
      </div>
    );
  return (
    <div role="tablist" aria-label={t("trader.opt.mode.label")} className={cn("flex shrink-0 items-center rounded-[7px] border border-line bg-surface-2 p-0.5", className)}>
      {(["cfd", "options"] as const).map((m) => (
        <button
          key={m}
          role="tab"
          aria-selected={mode === m}
          onClick={() => sw(m)}
          title={m === "cfd" ? t("trader.opt.mode.cfdHint") : t("trader.opt.mode.optionsHint")}
          className={cn("flex h-6 items-center gap-1 rounded-[5px] px-2 text-[11px] font-semibold transition-colors", mode === m ? "bg-surface-3 text-fg shadow-[inset_0_1px_0_var(--k-border-top)]" : "text-fg-3 hover:text-fg-2")}
        >
          {m === "cfd" ? t("trader.opt.mode.cfd") : t("trader.opt.mode.options")}
          {m === "options" && mode !== "options" && <span className="size-1.5 rounded-full bg-ember" aria-hidden />}
        </button>
      ))}
    </div>
  );
}
