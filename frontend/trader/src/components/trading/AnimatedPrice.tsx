'use client';

import { useLayoutEffect, useRef } from 'react';

/**
 * Display-only animated price.
 *
 * Renders a numeric price with (a) a smooth "glide" of the shown number between
 * two real ticks and (b) a green/red flash on change — so an 8 ticks/s feed
 * looks fluid/live like a pro terminal, instead of snapping in steps.
 *
 * IMPORTANT — this is PURELY visual. It NEVER writes back to the price store.
 * The intermediate glide numbers are painted straight to the DOM and are never
 * read by any trading logic: order execution, P&L, margin and SL/TP all keep
 * using the real store value. So the fill price a user gets is always the real
 * quote, never an animation frame. `value` is the real target it animates TO.
 *
 * The text is written imperatively (textContent) with the span kept childless in
 * JSX, so React never fights the per-frame updates and there is no re-render
 * storm even with dozens of instances (watchlist, mobile) on a weak device.
 */
interface AnimatedPriceProps {
  value: number;
  digits: number;
  className?: string;
  /** Smooth number roll between ticks. Off = snap to the real value (use for an
   *  exact "execution price" field where the shown value must equal the quote). */
  glide?: boolean;
  /** Green/red background flash on change. */
  flash?: boolean;
  /** Glide duration in ms. */
  duration?: number;
}

export function AnimatedPrice({
  value,
  digits,
  className = '',
  glide = true,
  flash = true,
  duration = 150,
}: AnimatedPriceProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const shownRef = useRef<number>(value);       // last number painted
  const rafRef = useRef<number | null>(null);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);

  useLayoutEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    // First paint: just show the value, no flash/glide.
    if (!mounted.current) {
      mounted.current = true;
      shownRef.current = Number.isFinite(value) ? value : 0;
      el.textContent = shownRef.current.toFixed(digits);
      return;
    }

    const from = shownRef.current;
    const to = Number.isFinite(value) ? value : from;
    if (to === from) return;

    // Flash (background tint — never touches text color, so it can't fight an
    // active red/blue "selected side" colour on the same element).
    if (flash) {
      el.classList.remove('price-flash-up', 'price-flash-down');
      void el.offsetWidth; // restart the CSS animation
      el.classList.add(to > from ? 'price-flash-up' : 'price-flash-down');
      if (flashRef.current) clearTimeout(flashRef.current);
      flashRef.current = setTimeout(() => {
        el.classList.remove('price-flash-up', 'price-flash-down');
      }, 450);
    }

    if (!glide) {
      shownRef.current = to;
      el.textContent = to.toFixed(digits);
      return;
    }

    // Glide the SHOWN number from → to (display-only). A new tick mid-glide just
    // re-targets, so a fast feed chases smoothly and never stalls.
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const startVal = from;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const cur = startVal + (to - startVal) * t;
      shownRef.current = cur;
      const node = spanRef.current;
      if (node) node.textContent = cur.toFixed(digits);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        shownRef.current = to;
        if (node) node.textContent = to.toFixed(digits);
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [value, digits, glide, flash, duration]);

  useLayoutEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (flashRef.current) clearTimeout(flashRef.current);
  }, []);

  // Childless span: text is managed imperatively above. suppressHydrationWarning
  // because the server renders it empty and the client fills it before paint.
  return <span ref={spanRef} className={className} suppressHydrationWarning />;
}
