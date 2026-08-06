'use client';

/**
 * DraggableOrderModal — floating, movable window that hosts the existing
 * <OrderPanel/> (Sell/Buy, SL/TP, volume, margin, place-order button).
 *
 * The terminal used to pin the order panel to a fixed right-hand column;
 * it now lives in this window instead so the chart can go full-width.
 * The window is dragged by its title bar (pointer capture, so the drag
 * survives the cursor leaving the bar) and clamped to stay grabbable
 * on screen. No order LOGIC lives here — it just relocates OrderPanel.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GripHorizontal, X } from 'lucide-react';
import OrderPanel from './OrderPanel';

const WIDTH = 400;

export default function DraggableOrderModal({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // null → not yet moved: render EXACTLY centered via a CSS transform (works
  // regardless of the panel's content height). On first drag we switch to
  // absolute px so it stays wherever the user leaves it.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const rect = ref.current?.getBoundingClientRect();
      const startX = pos?.x ?? rect?.left ?? 0;
      const startY = pos?.y ?? rect?.top ?? 0;
      drag.current = { dx: e.clientX - startX, dy: e.clientY - startY };
      if (!pos && rect) setPos({ x: rect.left, y: rect.top });
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [pos],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = e.clientX - drag.current.dx;
    let y = e.clientY - drag.current.dy;
    // Keep at least a grabbable strip of the window on screen.
    x = Math.max(80 - WIDTH, Math.min(x, vw - 80));
    y = Math.max(8, Math.min(y, vh - 48));
    setPos({ x, y });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    drag.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, []);

  // Once moved, keep the window on screen if the viewport shrinks under it.
  useEffect(() => {
    const onResize = () =>
      setPos((p) =>
        p
          ? {
              x: Math.max(80 - WIDTH, Math.min(p.x, window.innerWidth - 80)),
              y: Math.max(8, Math.min(p.y, window.innerHeight - 48)),
            }
          : p,
      );
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, width: WIDTH, maxHeight: '90vh' }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: WIDTH, maxHeight: '90vh' };

  return (
    <div
      ref={ref}
      className="fixed z-[120] flex flex-col overflow-hidden rounded-xl border border-border-primary bg-bg-base shadow-2xl"
      // Height follows the order panel's content (no fixed height => no empty
      // gap), capped so it never runs off a short viewport.
      style={style}
      role="dialog"
      aria-label="Order ticket"
    >
      {/* Drag handle / title bar */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="flex shrink-0 cursor-move touch-none select-none items-center justify-between gap-2 border-b border-border-primary bg-bg-secondary px-2.5 py-1.5"
      >
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
          <GripHorizontal size={14} aria-hidden />
          Order
        </span>
        <button
          type="button"
          // Stop the drag bar's pointer-capture from swallowing this click —
          // without this, pressing X started a drag and the close never fired.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          aria-label="Close order ticket"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <X size={14} />
        </button>
      </div>

      {/* The order panel sizes the window to its content (scrolls only if it
          would exceed the 88vh cap), so there's no empty gap below it. */}
      <div className="min-h-0 overflow-y-auto">
        {/* Close the window as soon as the order is dispatched — leaving it
            open hid the chart the user wants to watch after buying. */}
        <OrderPanel onOrderPlaced={onClose} />
      </div>
    </div>
  );
}
