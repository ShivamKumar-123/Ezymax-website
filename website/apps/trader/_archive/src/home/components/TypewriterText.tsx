'use client';

import { useEffect, useRef, useState, type ElementType } from 'react';
import { motion } from 'motion/react';

type Props = {
  text: string;
  duration?: number;
  startDelay?: number;
  holdDuration?: number;
  eraseDuration?: number;
  pauseDuration?: number;
  className?: string;
  as?: ElementType;
};

export function TypewriterText({
  text,
  duration = 5,
  startDelay = 0,
  holdDuration = 1.5,
  eraseDuration = 1.5,
  pauseDuration = 0.6,
  className = '',
  as: Tag = 'p',
}: Props) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const Component = Tag as ElementType;

  useEffect(() => {
    let raf: number | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const total = text.length;

    const wait = (seconds: number) =>
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, seconds * 1000);
      });

    const tween = (from: number, to: number, secs: number) =>
      new Promise<void>((resolve) => {
        const startedAt = performance.now();
        const tick = (now: number) => {
          if (cancelled) return resolve();
          const elapsed = (now - startedAt) / 1000;
          const progress = Math.min(1, elapsed / secs);
          const next = Math.round(from + (to - from) * progress);
          setCount(next);
          if (progress < 1) {
            raf = requestAnimationFrame(tick);
          } else {
            resolve();
          }
        };
        raf = requestAnimationFrame(tick);
      });

    let started = false;
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || started) return;
        started = true;
        observer.disconnect();

        await wait(startDelay);
        while (!cancelled) {
          await tween(0, total, duration);
          if (cancelled) break;
          await wait(holdDuration);
          if (cancelled) break;
          await tween(total, 0, eraseDuration);
          if (cancelled) break;
          await wait(pauseDuration);
        }
      },
      { threshold: 0.4 },
    );

    if (ref.current) observer.observe(ref.current);

    return () => {
      cancelled = true;
      observer.disconnect();
      if (raf !== undefined) cancelAnimationFrame(raf);
      if (timeout !== undefined) clearTimeout(timeout);
    };
  }, [text, duration, startDelay, holdDuration, eraseDuration, pauseDuration]);

  const visible = text.slice(0, count);

  return (
    <Component ref={ref} className={className}>
      <span>{visible}</span>
      <motion.span
        aria-hidden
        className="inline-block ml-0.5 align-baseline"
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{
          width: '0.08em',
          height: '0.95em',
          background: 'currentColor',
          transform: 'translateY(0.1em)',
        }}
      />
    </Component>
  );
}
