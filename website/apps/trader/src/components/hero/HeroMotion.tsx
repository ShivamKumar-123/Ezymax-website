'use client';

import { useEffect } from 'react';

/** Pauses the hero's CSS loops while the hero is off screen or the tab is hidden (saves CPU and battery). */
export default function HeroMotion({ target = '.hero-robot' }: { target?: string }) {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(target);
    if (!el) return;
    let visible = true;
    const apply = () => {
      if (visible && !document.hidden) delete el.dataset.paused;
      else el.dataset.paused = '';
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      apply();
    });
    io.observe(el);
    document.addEventListener('visibilitychange', apply);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', apply);
    };
  }, [target]);
  return null;
}
