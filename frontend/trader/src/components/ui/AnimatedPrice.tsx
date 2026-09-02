'use client';

/**
 * AnimatedPrice — DISPLAY-ONLY smooth price renderer.
 *
 * GLIDE: the SHOWN number rolls from the previous value to the new real
 * value over ~150ms via requestAnimationFrame; a new tick mid-glide
 * simply re-targets, so a fast feed is chased smoothly instead of
 * jumping. FLASH: on change the TEXT tints green/red and eases back to
 * its own colour (CSS keyframe with only `from` set — the browser
 * animates back to the inherited colour automatically). No background
 * box.
 *
 * Performance: the number is painted IMPERATIVELY via ref.textContent —
 * the span is childless in JSX so React NEVER re-renders per frame.
 * Dozens of instances cost one rAF loop each only while gliding, and
 * zero renders — smooth even on weak mobiles.
 *
 * ── HARD SAFETY RULE ────────────────────────────────────────────────
 * This component is purely visual. It never writes to any store or
 * state, and nothing may ever read a price back out of it. All trading
 * logic — execution price, P&L, margin, SL/TP — reads the REAL store /
 * server value. The fill a user gets is always the real quote, never an
 * animation frame.
 */

import { useEffect, useRef } from 'react';

interface AnimatedPriceProps {
  /** The REAL current value from the price store (never mutated here). */
  value: number | null | undefined;
  /** Decimal places to render. */
  digits: number;
  className?: string;
  /** Roll the displayed number toward the target (~150ms). Default on. */
  glide?: boolean;
  /** Tint the text green/red on change, easing back. Default on. */
  flash?: boolean;
  /** Rendered when value is null/undefined/NaN. */
  placeholder?: string;
  /** Lock the span to its widest-seen width (ch units) so the parent
   *  box NEVER resizes while digits roll — for coloured Buy/Sell
   *  buttons where any breathing is visible. Resets when the digit
   *  count changes materially (symbol switch). */
  lockWidth?: boolean;
}

const GLIDE_MS = 150;

export default function AnimatedPrice({
  value,
  digits,
  className,
  glide = true,
  flash = true,
  placeholder = '—',
  lockWidth = false,
}: AnimatedPriceProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  // Currently painted value (animation state — display only).
  const shownRef = useRef<number | null>(null);
  // Glide bookkeeping.
  const targetRef = useRef<number | null>(null);
  const fromRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  // Previous REAL value, for flash direction.
  const prevRealRef = useRef<number | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Width-lock ratchet (lockWidth mode): widest text length seen so far.
  const maxLenRef = useRef(0);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    const paint = (v: number) => {
      const text = v.toFixed(digits);
      if (lockWidth) {
        // A jump of 2+ characters means a different symbol/scale —
        // reset the ratchet instead of keeping a stale wide box.
        if (maxLenRef.current && Math.abs(text.length - maxLenRef.current) >= 2) {
          maxLenRef.current = 0;
        }
        if (text.length > maxLenRef.current) {
          maxLenRef.current = text.length;
          el.style.display = 'inline-block';
          el.style.minWidth = `${text.length}ch`;
          el.style.textAlign = 'center';
        }
      }
      el.textContent = text;
    };

    if (value == null || !Number.isFinite(value)) {
      cancelAnimationFrame(rafRef.current);
      shownRef.current = null;
      targetRef.current = null;
      prevRealRef.current = null;
      el.textContent = placeholder;
      return;
    }

    const prevReal = prevRealRef.current;
    prevRealRef.current = value;

    // Flash on any real change (direction from the REAL values, not the
    // interpolated display).
    if (flash && prevReal != null && value !== prevReal) {
      const cls = value > prevReal ? 'price-flash-up' : 'price-flash-down';
      el.classList.remove('price-flash-up', 'price-flash-down');
      // Force a reflow so re-adding the class restarts the animation.
      void el.offsetWidth;
      el.classList.add(cls);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => {
        el.classList.remove('price-flash-up', 'price-flash-down');
      }, 650);
    }

    if (!glide || shownRef.current == null) {
      // First paint (or glide disabled): show the real value directly.
      cancelAnimationFrame(rafRef.current);
      shownRef.current = value;
      targetRef.current = value;
      paint(value);
      return;
    }

    // Re-target the glide from wherever the display currently is.
    fromRef.current = shownRef.current;
    targetRef.current = value;
    startRef.current = performance.now();
    cancelAnimationFrame(rafRef.current);

    const step = (now: number) => {
      const target = targetRef.current;
      if (target == null) return;
      const t = Math.min(1, (now - startRef.current) / GLIDE_MS);
      // easeOutCubic — fast start, soft landing.
      const eased = 1 - Math.pow(1 - t, 3);
      const shown = fromRef.current + (target - fromRef.current) * eased;
      shownRef.current = shown;
      paint(t >= 1 ? target : shown);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        shownRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, digits, glide, flash, placeholder]);

  // Cleanup on unmount only.
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  // Childless span: React owns the node, we own its text. Initial text
  // is painted by the effect; suppressHydrationWarning covers SSR.
  return <span ref={spanRef} className={className} suppressHydrationWarning />;
}
