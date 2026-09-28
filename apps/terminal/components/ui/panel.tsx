"use client";

import * as React from "react";
import { cn } from "@kalks/ui";

/** Square-ish terminal panel with an uppercase micro-label header. */
export function TPanel({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section className={cn("flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[8px] border border-line bg-panel", className)} {...p}>
      {children}
    </section>
  );
}

export function PanelHeader({ icon, title, children, className, extra }: { icon?: React.ReactNode; title: React.ReactNode; children?: React.ReactNode; className?: string; extra?: React.ReactNode }) {
  return (
    <header className={cn("flex h-8 shrink-0 items-center gap-1.5 border-b border-line bg-panel-2 pl-2.5 pr-1", className)}>
      {icon && <span className="text-fg-3 [&>svg]:size-3.5">{icon}</span>}
      <h2 className="truncate text-[10.5px] font-semibold uppercase tracking-[0.09em] text-fg-2">{title}</h2>
      {extra}
      <div className="ml-auto flex items-center gap-0.5">{children}</div>
    </header>
  );
}

/** Compact underline tabs for panel headers. */
export function PanelTabs<T extends string>({ tabs, value, onChange, className }: { tabs: readonly { value: T; label: React.ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cn("flex h-full min-w-0 items-stretch gap-0.5 overflow-x-auto [scrollbar-width:none]", className)}>
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 text-[11.5px] font-medium transition-colors",
              on ? "text-fg" : "text-fg-3 hover:text-fg-2",
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && <span className={cn("k-num rounded-[4px] px-1 font-mono text-[10px]", on ? "bg-ember-soft text-ember" : "bg-surface-3 text-fg-3")}>{t.count}</span>}
            {on && <span className="absolute inset-x-1.5 bottom-0 h-[2px] rounded-full bg-ember" />}
          </button>
        );
      })}
    </div>
  );
}

/** Sticky table header cell + row helpers for dense data grids. */
export function Th({ children, className, right }: { children?: React.ReactNode; className?: string; right?: boolean }) {
  return <th className={cn("sticky top-0 z-[1] h-7 whitespace-nowrap border-b border-line bg-panel-2 px-2 text-[10.5px] font-medium uppercase tracking-[0.05em] text-fg-3", right ? "text-right" : "text-left", className)}>{children}</th>;
}
export function Td({ children, className, right, mono }: { children?: React.ReactNode; className?: string; right?: boolean; mono?: boolean }) {
  return <td className={cn("h-[28px] whitespace-nowrap border-b border-line/60 px-2 text-[12px]", right && "text-right", mono && "k-num font-mono", className)}>{children}</td>;
}
