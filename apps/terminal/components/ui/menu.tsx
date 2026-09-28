"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@kalks/ui";

/* Dense MT5-style menus: dropdowns, context menus and nested submenus. */

export type MenuItem =
  | "sep"
  | { header: string }
  | {
      label: React.ReactNode;
      icon?: React.ReactNode;
      hint?: React.ReactNode;
      onSelect?: () => void;
      checked?: boolean;
      danger?: boolean;
      disabled?: boolean;
      tone?: "up" | "down" | "ember";
      items?: MenuItem[];
      keepOpen?: boolean;
    };

export function MenuList({ items, onClose, width = 232, className }: { items: MenuItem[]; onClose: () => void; width?: number; className?: string }) {
  const [sub, setSub] = React.useState<number | null>(null);
  const refs = React.useRef<(HTMLDivElement | null)[]>([]);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <div
      role="menu"
      className={cn("t-menu relative z-[80] rounded-[9px] border border-line-top bg-panel-2 py-1 text-[12.5px] shadow-[0_18px_48px_-12px_rgba(0,0,0,0.55),0_2px_6px_rgba(0,0,0,0.25)]", className)}
      style={{ width }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) => {
        if (it === "sep") return <div key={i} className="mx-2 my-1 h-px bg-line" />;
        if ("header" in it)
          return (
            <div key={i} className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-3">
              {it.header}
            </div>
          );
        const hasSub = !!it.items?.length;
        return (
          <div
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="menuitem"
            aria-disabled={it.disabled}
            onMouseEnter={() => {
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => setSub(hasSub ? i : null), hasSub ? 60 : 120);
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (it.disabled) return;
              if (hasSub) return setSub(i);
              it.onSelect?.();
              if (!it.keepOpen) onClose();
            }}
            className={cn(
              "relative mx-1 flex h-[26px] cursor-default select-none items-center gap-2 rounded-[5px] pl-2 pr-2 [&>svg]:size-3.5 [&>svg]:shrink-0",
              it.disabled ? "text-fg-3/60" : "text-fg-2 hover:bg-surface-3 hover:text-fg",
              sub === i && "bg-surface-3 text-fg",
              it.danger && !it.disabled && "text-down hover:text-down",
              it.tone === "up" && !it.disabled && "text-up hover:text-up",
              it.tone === "down" && !it.disabled && "text-down hover:text-down",
              it.tone === "ember" && !it.disabled && "text-ember hover:text-ember",
            )}
          >
            <span className="grid w-4 shrink-0 place-items-center [&>svg]:size-3.5">{it.checked ? <Check className="text-ember" /> : it.icon}</span>
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
            {it.hint && <span className="shrink-0 pl-3 font-mono text-[10.5px] text-fg-3">{it.hint}</span>}
            {hasSub && <ChevronRight className="size-3 text-fg-3" />}
            {hasSub && sub === i && (
              <div className="absolute left-full top-[-5px] pl-0.5" onMouseEnter={() => timer.current && clearTimeout(timer.current)}>
                <MenuList items={it.items!} onClose={onClose} width={width - 20} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Positioned floating layer with outside-click + Escape dismissal. */
export function Floating({ x, y, onClose, children, flipX = true }: { x: number; y: number; onClose: () => void; children: React.ReactNode; flipX?: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState({ x, y, ready: false });
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (flipX && nx + r.width > window.innerWidth - 6) nx = Math.max(6, window.innerWidth - r.width - 6);
    if (ny + r.height > window.innerHeight - 6) ny = Math.max(6, window.innerHeight - r.height - 6);
    setPos({ x: nx, y: ny, ready: true });
  }, [x, y, flipX]);
  React.useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const t = setTimeout(() => {
      window.addEventListener("mousedown", down);
      window.addEventListener("contextmenu", down);
    }, 0);
    window.addEventListener("keydown", key);
    window.addEventListener("blur", onClose);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousedown", down);
      window.removeEventListener("contextmenu", down);
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);
  return createPortal(
    <div ref={ref} className="fixed z-[80]" style={{ left: pos.x, top: pos.y, visibility: pos.ready ? "visible" : "hidden" }}>
      {children}
    </div>,
    document.body,
  );
}

export interface CtxState {
  x: number;
  y: number;
  items: MenuItem[];
  title?: React.ReactNode;
}

/** Hook for right-click menus: `const cm = useContextMenu(); onContextMenu={e => cm.open(e, items)}` + `{cm.node}` */
export function useContextMenu(width = 232) {
  const [st, setSt] = React.useState<CtxState | null>(null);
  const close = React.useCallback(() => setSt(null), []);
  const open = React.useCallback((e: React.MouseEvent | { clientX: number; clientY: number; preventDefault?: () => void }, items: MenuItem[], title?: React.ReactNode) => {
    e.preventDefault?.();
    setSt({ x: e.clientX, y: e.clientY, items, title });
  }, []);
  const node = st ? (
    <Floating x={st.x} y={st.y} onClose={close}>
      {st.title ? (
        <div className="rounded-[9px] border border-line-top bg-panel-2 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.55)]" style={{ width }}>
          <div className="border-b border-line px-3 py-1.5 font-mono text-[11px] text-fg-3">{st.title}</div>
          <MenuList items={st.items} onClose={close} width={width} className="border-0 shadow-none" />
        </div>
      ) : (
        <MenuList items={st.items} onClose={close} width={width} />
      )}
    </Floating>
  ) : null;
  return { open, close, node, isOpen: !!st };
}

/** Button-anchored dropdown. */
export function DropMenu({
  trigger,
  items,
  width = 232,
  align = "start",
  children,
}: {
  trigger: (p: { open: boolean; toggle: (e: React.MouseEvent) => void }) => React.ReactNode;
  items?: MenuItem[];
  width?: number;
  align?: "start" | "end";
  children?: (close: () => void) => React.ReactNode;
}) {
  const [at, setAt] = React.useState<{ x: number; y: number } | null>(null);
  const close = React.useCallback(() => setAt(null), []);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (at) return setAt(null);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAt({ x: align === "end" ? r.right - width : r.left, y: r.bottom + 4 });
  };
  return (
    <>
      {trigger({ open: !!at, toggle })}
      {at && (
        <Floating x={at.x} y={at.y} onClose={close}>
          {children ? (
            <div className="rounded-[9px] border border-line-top bg-panel-2 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.55)]" style={{ width }}>
              {children(close)}
            </div>
          ) : (
            <MenuList items={items ?? []} onClose={close} width={width} />
          )}
        </Floating>
      )}
    </>
  );
}
