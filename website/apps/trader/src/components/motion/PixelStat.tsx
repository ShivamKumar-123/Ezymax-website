'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Dot-matrix numeral that counts up when it scrolls into view. The server renders the final value, so crawlers,
 * no-JS visitors and reduced-motion users always see the real number.
 */
export function PixelStat({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  group = true,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  group?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const fmt = (v: number) =>
    v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: group });
  const [text, setText] = useState(fmt(value));

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let started = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || started) return;
        started = true;
        const t0 = performance.now();
        const dur = 1600;
        const step = (now: number) => {
          const p = Math.min(1, (now - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 4);
          setText(fmt(value * eased));
          if (p < 1) raf = requestAnimationFrame(step);
        };
        setText(fmt(0));
        raf = requestAnimationFrame(step);
        io.disconnect();
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span ref={ref} className={className} aria-label={`${prefix}${fmt(value)}${suffix}`}>
      <span aria-hidden>
        {prefix}
        {text}
        {suffix}
      </span>
    </span>
  );
}
