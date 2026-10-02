"use client";

// CFD | Options switch in the terminal header (desktop title bar and mobile header). Same session, account, charts
// and toolbox; Options mode swaps the trading area for the options workspace (loaded on demand) and puts the
// Options / Settlements tabs first in the toolbox.
import * as React from "react";
import { cn } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { useTerminal, type ToolboxTab } from "@/lib/store";
import { setTradeMode, useTradeMode, type TradeMode } from "@/lib/options/mode";

const CFD_ONLY: ToolboxTab[] = ["trade", "history", "exposure"];

export function useSwitchMode() {
  const T = useTerminal();
  return React.useCallback(
    (m: TradeMode) => {
      setTradeMode(m);
      const tab = T.ws.toolboxTab;
      if (m === "options" && CFD_ONLY.includes(tab)) T.setWs({ toolboxTab: "options" });
      if (m === "cfd" && tab === "settlements") T.setWs({ toolboxTab: "trade" });
    },
    [T],
  );
}

export function ModeSwitch({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
  const t = useT();
  const mode = useTradeMode();
  const sw = useSwitchMode();
  const h = size === "sm" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-[12px]";
  return (
    <div role="tablist" aria-label={t("trader.opt.mode.label")} className={cn("flex shrink-0 items-center rounded-[7px] border border-line bg-surface-2 p-0.5", className)}>
      {(["cfd", "options"] as const).map((m) => (
        <button
          key={m}
          role="tab"
          aria-selected={mode === m}
          onClick={() => sw(m)}
          title={m === "cfd" ? t("trader.opt.mode.cfdHint") : t("trader.opt.mode.optionsHint")}
          className={cn("flex items-center gap-1 rounded-[5px] font-semibold transition-colors", h, mode === m ? "bg-surface-3 text-fg shadow-[inset_0_1px_0_var(--k-border-top)]" : "text-fg-3 hover:text-fg-2")}
        >
          {m === "cfd" ? t("trader.opt.mode.cfd") : t("trader.opt.mode.options")}
          {m === "options" && mode !== "options" && <span className="size-1.5 rounded-full bg-ember" aria-hidden />}
        </button>
      ))}
    </div>
  );
}
