'use client';

import { createElement, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

type Tag = 'div' | 'section' | 'article' | 'li' | 'p' | 'h1' | 'h2' | 'h3' | 'span' | 'ul' | 'footer';

interface RevealProps {
  children: ReactNode;
  /** Element to render. Defaults to div. */
  as?: Tag;
  className?: string;
  style?: CSSProperties;
  /** Delay in ms, used for staggering cards and hero lines. */
  delay?: number;
  /** Direction the element travels from. */
  from?: 'up' | 'left' | 'right' | 'scale';
  /** Animate again every time it scrolls back into view. */
  repeat?: boolean;
}

/**
 * Scroll-reveal wrapper. Starts hidden (see .kx-reveal in homepage.css)
 * and gets `.is-visible` when it enters the viewport, which triggers a
 * CSS transition. No React state: the class is toggled directly on the
 * node, so revealing never re-renders the tree. Falls back to visible
 * when IntersectionObserver is unavailable.
 */
export function Reveal({
  children,
  as = 'div',
  className = '',
  style,
  delay = 0,
  from = 'up',
  repeat = false,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible');
      return;
    }

    // Once the transition finishes, drop the will-change hint (see .is-settled).
    const onEnd = (e: TransitionEvent) => {
      if (e.target === el && e.propertyName === 'transform') el.classList.add('is-settled');
    };
    el.addEventListener('transitionend', onEnd);

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // Double rAF: lets the browser paint the hidden state first so
            // the transition always runs from its start instead of snapping.
            requestAnimationFrame(() =>
              requestAnimationFrame(() => el.classList.add('is-visible')),
            );
            if (!repeat) io.disconnect();
          } else if (repeat) {
            el.classList.remove('is-visible', 'is-settled');
          }
        }
      },
      // Start a little before the element reaches the viewport edge so the
      // motion is already under way as it scrolls into view.
      { threshold: 0.05, rootMargin: '0px 0px 4% 0px' },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      el.removeEventListener('transitionend', onEnd);
    };
  }, [repeat]);

  return createElement(
    as,
    {
      ref,
      className: `kx-reveal kx-reveal--${from} ${className}`.trim(),
      style: { ...style, transitionDelay: delay ? `${delay}ms` : undefined },
    },
    children,
  );
}
