"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@ezymex/ui";

/*
 * Dense MT5-style menus: dropdowns, context menus and nested submenus.
 * Every layer is viewport-aware: it flips up/left when there's no room below/right, stays 12px inside the
 * viewport and scrolls internally when taller than the space available. Submenus are portaled (so a
 * scrolling parent never clips them) and flip to the left edge when needed. On phones / narrow windows
 * menus open as a bottom sheet with drill-down submenus instead.
 */

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

/** Gap kept between a menu and the viewport edges. */
const PAD = 12;
/** Below this width menus open as a bottom sheet. */
const SHEET_MAX_W = 640;

/** Menus rendered inside a bottom sheet: full width, submenus drill down instead of flying out. */
const SheetCtx = React.createContext(false);

const isSheetViewport = () => typeof window !== "undefined" && window.innerWidth < SHEET_MAX_W;

/**
 * Every menu layer carries this attribute, so clicks in a (portaled) submenu don't count as "outside".
 * Layers are portaled to <body>, outside the terminal's dir="ltr" root, so they set it again: menus keep
 * the LTR layout (and fly-out direction) in Arabic/Urdu/Persian; the translated text still shapes correctly.
 */
const LAYER = { "data-kmenu": "", dir: "ltr" } as const;

export function MenuList({ items, onClose, width = 248, className }: { items: MenuItem[]; onClose: () => void; width?: number; className?: string }) {
  const sheet = React.useContext(SheetCtx);
  return sheet ? <SheetMenu items={items} onClose={onClose} className={className} /> : <PopMenu items={items} onClose={onClose} width={width} className={className} />;
}

function Row({ it, active, children, ...p }: { it: Exclude<MenuItem, "sep" | { header: string }>; active?: boolean; children?: React.ReactNode } & React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  const hasSub = !!it.items?.length;
  const sheet = React.useContext(SheetCtx);
  return (
    <div
      role="menuitem"
      aria-disabled={it.disabled}
      aria-haspopup={hasSub || undefined}
      tabIndex={it.disabled ? undefined : -1}
      {...p}
      className={cn(
        "relative mx-1 flex cursor-default select-none items-center gap-2 rounded-[6px] pl-2 pr-2 outline-none [&>svg]:size-4 [&>svg]:shrink-0",
        sheet ? "h-10 text-[13.5px]" : "h-7 text-[13px]",
        it.disabled ? "text-fg-3/70" : "text-fg hover:bg-surface-3 focus-visible:bg-surface-3",
        active && "bg-surface-3 text-fg",
        it.danger && !it.disabled && "text-down hover:text-down",
        it.tone === "up" && !it.disabled && "text-up hover:text-up",
        it.tone === "down" && !it.disabled && "text-down hover:text-down",
        it.tone === "ember" && !it.disabled && "text-ember hover:text-ember",
      )}
    >
      <span className="grid w-4 shrink-0 place-items-center text-fg-2 [&>svg]:size-3.5">{it.checked ? <Check className="text-accent-text" /> : it.icon}</span>
      <span className="min-w-0 flex-1 truncate">{it.label}</span>
      {/* keyboard shortcuts (F9, Ctrl+F…) mean nothing in the touch bottom sheet; other hints stay */}
      {it.hint && !(sheet && isKeyHint(it.hint)) && <span className="shrink-0 pl-3 font-mono text-[11px] text-fg-3">{it.hint}</span>}
      {hasSub && <ChevronRight className="size-3.5 text-fg-3" />}
      {children}
    </div>
  );
}

const isKeyHint = (h: React.ReactNode) => typeof h === "string" && /^(F\d{1,2}|(Ctrl|Alt|Shift|⌘)\+.*|[+−=-])$/.test(h);

function Header({ text }: { text: string }) {
  return <div className="px-3 pb-0.5 pt-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-3">{text}</div>;
}

const MENU_CLS = "t-menu t-glass-strong relative rounded-[12px] border border-line-top py-1 text-[13px] shadow-[var(--t-shadow-pop)]";

/** Desktop menu list with fly-out submenus. */
function PopMenu({ items, onClose, width, className }: { items: MenuItem[]; onClose: () => void; width: number; className?: string }) {
  const [sub, setSub] = React.useState<number | null>(null);
  const refs = React.useRef<(HTMLDivElement | null)[]>([]);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const focusable = () => refs.current.filter((el): el is HTMLDivElement => !!el && el.getAttribute("aria-disabled") !== "true");
  return (
    <div
      role="menu"
      className={cn(MENU_CLS, className)}
      style={{ width }}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        const list = focusable();
        const i = list.indexOf(document.activeElement as HTMLDivElement);
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          list[(i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus();
        } else if (e.key === "Enter" || e.key === " ") {
          if (i < 0) return;
          e.preventDefault();
          e.stopPropagation();
          list[i]!.click();
        }
      }}
    >
      {items.map((it, i) => {
        if (it === "sep") return <div key={i} className="mx-2.5 my-1.5 h-px bg-line" />;
        if ("header" in it) return <Header key={i} text={it.header} />;
        const hasSub = !!it.items?.length;
        return (
          <Row
            key={i}
            it={it}
            active={sub === i}
            ref={(el) => {
              refs.current[i] = el;
            }}
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
            onKeyDown={(e) => {
              if (hasSub && e.key === "ArrowRight") {
                e.preventDefault();
                e.stopPropagation();
                setSub(i);
              }
            }}
          >
            {hasSub && sub === i && refs.current[i] && (
              <SubMenu anchor={refs.current[i]!} items={it.items!} width={width - 20} onClose={onClose} onBack={() => (setSub(null), refs.current[i]?.focus())} onEnter={() => timer.current && clearTimeout(timer.current)} />
            )}
          </Row>
        );
      })}
    </div>
  );
}

/** Fly-out submenu, portaled and placed right of its row (left when there's no room), clamped to the viewport. */
function SubMenu({ anchor, items, width, onClose, onBack, onEnter }: { anchor: HTMLElement; items: MenuItem[]; width: number; onClose: () => void; onBack: () => void; onEnter: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ left: number; top: number; maxH: number } | null>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const a = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxH = vh - PAD * 2;
    const h = Math.min(el.scrollHeight, maxH);
    let left = a.right + 2;
    if (left + width > vw - PAD) left = a.left - width - 2 >= PAD ? a.left - width - 2 : Math.max(PAD, vw - PAD - width);
    const top = Math.max(PAD, Math.min(a.top - 5, vh - PAD - h));
    setPos({ left, top, maxH });
  }, [anchor, width, items]);
  return createPortal(
    <div
      {...LAYER}
      ref={ref}
      className="t-scroll fixed z-[81] overflow-y-auto overscroll-contain rounded-[12px] shadow-[var(--t-shadow-pop)]"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? 0, maxHeight: pos?.maxH, visibility: pos ? "visible" : "hidden" }}
      onMouseEnter={onEnter}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onBack();
        }
      }}
    >
      <PopMenu items={items} onClose={onClose} width={width} />
    </div>,
    document.body,
  );
}

/** Bottom-sheet menu: large rows, submenus drill down with a back row. */
function SheetMenu({ items, onClose, className }: { items: MenuItem[]; onClose: () => void; className?: string }) {
  const [stack, setStack] = React.useState<{ title: React.ReactNode; items: MenuItem[] }[]>([]);
  const level = stack[stack.length - 1];
  const list = level?.items ?? items;
  return (
    <div role="menu" className={cn("py-1 text-[13.5px]", className)} onContextMenu={(e) => e.preventDefault()}>
      {level && (
        <button type="button" onClick={() => setStack((s) => s.slice(0, -1))} className="mx-1 flex h-10 w-[calc(100%-8px)] items-center gap-2 rounded-[5px] px-2 text-left text-fg-2 hover:bg-surface-3">
          <ChevronLeft className="size-4" />
          <span className="truncate font-medium text-fg">{level.title}</span>
        </button>
      )}
      {list.map((it, i) => {
        if (it === "sep") return <div key={i} className="mx-2.5 my-1.5 h-px bg-line" />;
        if ("header" in it) return <Header key={i} text={it.header} />;
        const hasSub = !!it.items?.length;
        return (
          <Row
            key={i}
            it={it}
            onClick={(e) => {
              e.stopPropagation();
              if (it.disabled) return;
              if (hasSub) return setStack((s) => [...s, { title: it.label, items: it.items! }]);
              it.onSelect?.();
              if (!it.keepOpen) onClose();
            }}
          />
        );
      })}
    </div>
  );
}

export interface Anchor {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Positioned floating layer with outside-click + Escape dismissal.
 * `x/y` is the preferred top-left corner. With `anchor` (the trigger's rect) the layer opens below it and
 * flips above when there's more room there; without one (context menus) it opens up/left from the point.
 * It is clamped 12px inside the viewport and scrolls when taller than the room available.
 * `sheet` (default: auto on narrow screens) shows it as a bottom sheet instead.
 */
export function Floating({ x, y, onClose, children, anchor, sheet, flipX = true }: { x: number; y: number; onClose: () => void; children: React.ReactNode; anchor?: Anchor; sheet?: boolean; flipX?: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [asSheet] = React.useState(() => sheet ?? isSheetViewport());
  const [pos, setPos] = React.useState<{ x: number; y: number; maxH: number } | null>(null);

  const place = React.useCallback(() => {
    const el = ref.current;
    if (!el || asSheet) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = el.offsetWidth;
    const natural = el.scrollHeight;
    let nx = x;
    if (flipX && nx + w > vw - PAD) nx = anchor ? anchor.right - w : x - w;
    nx = Math.max(PAD, Math.min(nx, vw - PAD - w));
    let ny = y;
    let maxH = vh - PAD - y;
    if (natural > maxH) {
      // not enough room below: open upwards when that side has more space
      const above = (anchor ? anchor.top - 4 : y) - PAD;
      if (above > maxH) {
        const h = Math.min(natural, above);
        ny = (anchor ? anchor.top - 4 : y) - h;
        maxH = above;
      } else if (!anchor) {
        ny = Math.max(PAD, vh - PAD - natural);
        maxH = vh - PAD - ny;
      }
    }
    setPos({ x: nx, y: Math.max(PAD, ny), maxH: Math.max(120, maxH) });
  }, [x, y, anchor, flipX, asSheet]);

  React.useLayoutEffect(place, [place]);
  React.useEffect(() => {
    if (asSheet) return;
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [place, asSheet]);

  React.useEffect(() => {
    const down = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (ref.current?.contains(t as Node) || t?.closest?.("[data-kmenu]")) return;
      onClose();
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

  if (asSheet)
    return createPortal(
      <div className="fixed inset-0 z-[80] flex flex-col justify-end" role="presentation">
        <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
        <div
          {...LAYER}
          ref={ref}
          className="t-sheet t-scroll relative max-h-[72dvh] overflow-y-auto overscroll-contain rounded-t-[14px] border border-b-0 border-line-top bg-panel-2 pb-[max(8px,env(safe-area-inset-bottom))] shadow-[0_-18px_48px_-12px_rgba(0,0,0,0.6)] [&_.t-menu]:w-full [&_.t-menu]:rounded-none [&_.t-menu]:border-0 [&_.t-menu]:shadow-none [&>div]:!w-full"
        >
          <span className="mx-auto mb-1 mt-2 block h-1 w-9 rounded-full bg-fg-3/40" aria-hidden />
          <SheetCtx.Provider value>{children}</SheetCtx.Provider>
        </div>
      </div>,
      document.body,
    );

  return createPortal(
    <div
      {...LAYER}
      ref={ref}
      className="t-scroll fixed z-[80] overflow-y-auto overscroll-contain rounded-[12px] shadow-[var(--t-shadow-pop)]"
      style={{ left: pos?.x ?? x, top: pos?.y ?? y, maxHeight: pos?.maxH, visibility: pos ? "visible" : "hidden" }}
    >
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
export function useContextMenu(width = 248) {
  const [st, setSt] = React.useState<CtxState | null>(null);
  const close = React.useCallback(() => setSt(null), []);
  const open = React.useCallback((e: React.MouseEvent | { clientX: number; clientY: number; preventDefault?: () => void }, items: MenuItem[], title?: React.ReactNode) => {
    e.preventDefault?.();
    setSt({ x: e.clientX, y: e.clientY, items, title });
  }, []);
  const node = st ? (
    <Floating x={st.x} y={st.y} onClose={close}>
      {st.title ? (
        <div className="t-glass-strong rounded-[12px] border border-line-top shadow-[var(--t-shadow-pop)]" style={{ width }}>
          <div className="border-b border-line px-3 py-1.5 font-mono text-[12px] text-fg-2">{st.title}</div>
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
  width = 248,
  align = "start",
  children,
}: {
  trigger: (p: { open: boolean; toggle: (e: React.MouseEvent) => void }) => React.ReactNode;
  items?: MenuItem[];
  width?: number;
  align?: "start" | "end";
  children?: (close: () => void) => React.ReactNode;
}) {
  const [at, setAt] = React.useState<{ x: number; y: number; anchor: Anchor } | null>(null);
  const close = React.useCallback(() => setAt(null), []);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (at) return setAt(null);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAt({ x: align === "end" ? r.right - width : r.left, y: r.bottom + 4, anchor: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } });
  };
  return (
    <>
      {trigger({ open: !!at, toggle })}
      {at && (
        <Floating x={at.x} y={at.y} anchor={at.anchor} onClose={close}>
          {children ? (
            <div className="t-glass-strong rounded-[14px] border border-line-top shadow-[var(--t-shadow-pop)]" style={{ width }}>
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
