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

const WIDTH = 348;

export default function DraggableOrderModal({ onClose }: { onClose: () => void }) {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 200, y: 96 };
    // Default to the top-right, roughly where the old order column sat.
    return { x: Math.max(12, window.innerWidth - WIDTH - 24), y: 96 };
  });
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [pos.x, pos.y],
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

  // Keep the window on screen if the viewport shrinks under it.
  useEffect(() => {
    const onResize = () =>
      setPos((p) => ({
        x: Math.max(80 - WIDTH, Math.min(p.x, window.innerWidth - 80)),
        y: Math.max(8, Math.min(p.y, window.innerHeight - 48)),
      }));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div
      className="fixed z-[120] flex flex-col overflow-hidden rounded-xl border border-border-primary bg-bg-base shadow-2xl"
      style={{ left: pos.x, top: pos.y, width: WIDTH, height: 'min(620px, 85vh)' }}
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
          onClick={onClose}
          aria-label="Close order ticket"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <X size={14} />
        </button>
      </div>

      {/* The existing order panel fills the rest of the window. */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <OrderPanel />
      </div>
    </div>
  );
}
