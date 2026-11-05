'use client';

import { useEffect, useRef } from 'react';

/**
 * Video backdrop for the home hero, passed to <HomeHero stage={...} /> in place of the robot artwork.
 *
 * The clip covers the hero at every width and the copy sits over it, on a phone as on a desktop.
 *
 * Which clip is CSS's decision, not this component's. Covering a tall phone screen with the 16:9 cut means scaling
 * it up by half again and throwing away three quarters of its width, so there is a 608x1080 crop of the same clip
 * for portrait. Both are in the markup and `.hero-video-wide` / `.hero-video-portrait` show exactly one; the still
 * frame behind them is a CSS background chosen by the same query. That is deliberate: picking a source in an effect
 * leaves the hero wrongly framed on any load where the effect does not run.
 *
 * Neither clip preloads, so the hidden one costs nothing. All this script does is press play on the visible one -
 * `muted` and `playsInline` are what make that allowed, on iOS and everywhere else. If it never runs, the hero is
 * still framed correctly; it simply holds the still frame.
 */
export function VideoStage() {
  const wide = useRef<HTMLVideoElement>(null);
  const tall = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const q = window.matchMedia('(orientation: portrait) and (max-width: 1023px)');

    const apply = () => {
      const on = q.matches ? tall.current : wide.current;
      const off = q.matches ? wide.current : tall.current;
      off?.pause();
      // a hidden <video> has no layout box, so this is also the check that it is the one on screen
      void on?.play().catch(() => {});
    };

    apply();
    q.addEventListener('change', apply);
    return () => q.removeEventListener('change', apply);
  }, []);

  const common = {
    muted: true,
    loop: true,
    playsInline: true,
    preload: 'none' as const,
    'aria-hidden': true,
  };

  return (
    <div className="hero-video">
      <video ref={wide} src="/videos/hero.mp4" className="hero-video-art hero-video-wide" {...common} />
      <video ref={tall} src="/videos/hero-portrait.mp4" className="hero-video-art hero-video-portrait" {...common} />
    </div>
  );
}
