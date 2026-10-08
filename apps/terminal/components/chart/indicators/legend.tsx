"use client";

import * as React from "react";
import { Eye, EyeOff, Settings2, X } from "lucide-react";
import { cn } from "@ezymex/ui";
import { useT } from "@ezymex/i18n/react";
import type { IndLegendRow } from "./layer";

/**
 * One indicator row in a chart legend: name + params, live values, and eye / settings / remove controls
 * (revealed on hover or keyboard focus; double-click opens settings).
 */
export function IndicatorLegendRow({ row, onToggle, onSettings, onRemove, readOnlyValues }: { row: IndLegendRow; onToggle: () => void; onSettings: () => void; onRemove: () => void; readOnlyValues?: boolean }) {
  const t = useT();
  return (
    <div
      className="group pointer-events-auto flex h-4 max-w-full items-center gap-x-1.5 font-mono text-[10px] leading-4"
      onDoubleClick={(e) => {
        e.stopPropagation();
        onSettings();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <span className={cn("shrink-0 cursor-default truncate", row.visible ? "text-fg-2" : "text-fg-3 line-through decoration-fg-3/60")} title={t("chart.legend.settingsHint", { label: row.label })}>
        {row.label}
      </span>
      {!readOnlyValues &&
        row.values.map((v, i) => (
          <span key={i} className="k-num shrink-0" style={{ color: v.color }} title={v.label}>
            {v.text}
          </span>
        ))}
      <span className="flex shrink-0 items-center opacity-0 transition-opacity duration-100 focus-within:opacity-100 group-hover:opacity-100">
        <LegendBtn label={t(row.visible ? "chart.legend.hide" : "chart.legend.show", { label: row.label })} onClick={onToggle}>
          {row.visible ? <Eye /> : <EyeOff />}
        </LegendBtn>
        <LegendBtn label={t("chart.legend.settings", { label: row.label })} onClick={onSettings}>
          <Settings2 />
        </LegendBtn>
        <LegendBtn label={t("chart.legend.remove", { label: row.label })} onClick={onRemove} danger>
          <X />
        </LegendBtn>
      </span>
    </div>
  );
}

function LegendBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "grid size-4 place-items-center rounded-[3px] bg-[var(--t-chart-bg)] text-fg-3 outline-none focus-visible:ring-1 focus-visible:ring-ember/60 [&_svg]:size-3",
        danger ? "hover:bg-down-soft hover:text-down" : "hover:bg-surface-3 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
