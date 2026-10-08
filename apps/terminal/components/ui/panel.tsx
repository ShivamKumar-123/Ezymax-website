"use client";

import * as React from "react";
import { cn } from "@ezymex/ui";
import { CountBadge } from "./kit";

/** Terminal card: frosted material, 14 px radius, 1 px subtle line (docs/TERMINAL-DESIGN.md §2.4 Panels). */
export function TPanel({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section className={cn("t-glass flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[14px] border border-line", className)} {...p}>
      {children}
    </section>
  );
}

/** The title of a single-widget card, drawn as the active pill of a pill-tab header. */
export function TitlePill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("flex h-7 min-w-0 items-center gap-1.5 truncate rounded-[8px] bg-surface-3 px-2.5 text-[13px] font-medium text-fg", className)}>{children}</h2>;
}

/** Card header (40 px): pill tabs or a title pill on the left, small ghost icon buttons on the right. */
export function PanelHeader({ icon, title, children, className, extra }: { icon?: React.ReactNode; title: React.ReactNode; children?: React.ReactNode; className?: string; extra?: React.ReactNode }) {
  return (
    <header className={cn("flex h-10 shrink-0 items-center gap-1.5 px-1.5", className)}>
      <TitlePill>
        {icon && <span className="text-fg-3 [&>svg]:size-3.5">{icon}</span>}
        {title}
      </TitlePill>
      {extra}
      <div className="ms-auto flex shrink-0 items-center gap-0.5">{children}</div>
    </header>
  );
}

/** Pill tabs for card headers: the active tab is a filled grey pill; the others are plain text. */
export function PanelTabs<T extends string>({ tabs, value, onChange, className }: { tabs: readonly { value: T; label: React.ReactNode; count?: number; icon?: React.ReactNode; tone?: "accent" | "warn" }[]; value: T; onChange: (v: T) => void; className?: string; size?: "sm" | "md" }) {
  const refs = React.useRef(new Map<T, HTMLButtonElement>());
  const move = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((x) => x.value === value);
    const next = e.key === "ArrowRight" ? tabs[(i + 1) % tabs.length] : e.key === "ArrowLeft" ? tabs[(i - 1 + tabs.length) % tabs.length] : undefined;
    if (!next) return;
    e.preventDefault();
    onChange(next.value);
    refs.current.get(next.value)?.focus();
  };
  return (
    <div role="tablist" onKeyDown={move} className={cn("flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              if (el) refs.current.set(t.value, el);
              else refs.current.delete(t.value);
            }}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cn(
              "flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[8px] px-2.5 text-[13px] font-medium transition-colors [&>svg]:size-3.5",
              on ? "bg-surface-3 text-fg" : "text-fg-2 hover:bg-surface-3/50 hover:text-fg",
            )}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && t.count > 0 && <CountBadge n={t.count} tone={on ? "accent" : t.tone === "warn" ? "warn" : "neutral"} />}
          </button>
        );
      })}
    </div>
  );
}

/** Sticky table header cell (small grey caps) and data cell (12.5 px, 36 px rows). */
export function Th({ children, className, right }: { children?: React.ReactNode; className?: string; right?: boolean }) {
  return <th className={cn("sticky top-0 z-[1] h-8 whitespace-nowrap border-b border-line bg-panel px-2.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-3", right ? "text-right" : "text-left", className)}>{children}</th>;
}
export function Td({ children, className, right, mono }: { children?: React.ReactNode; className?: string; right?: boolean; mono?: boolean }) {
  return <td className={cn("h-9 whitespace-nowrap border-b border-line/60 px-2.5 text-[12.5px]", right && "text-right", mono && "k-num font-mono", className)}>{children}</td>;
}
