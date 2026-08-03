'use client';

import { useEffect, useRef, useState } from 'react';
import type { TubesCursorApp } from 'threejs-components/build/cursors/tubes1.min.js';

/**
 * Theme-aware cursor flourish.
 *
 * DARK mode — the landing site's WebGL neon tubes (void-black palette) on a
 * `screen` blend: the scene's opaque black background dissolves and only the
 * lit rims glow. `screen` only works over dark UI; over the light theme the
 * inverse (`multiply`) would multiply everything toward the scene's black
 * background and blacked out the whole dashboard (that bug shipped once).
 *
 * BRIGHT mode — a GOLDEN 2D canvas trail instead: transparent by nature, so
 * nothing can darken the page, and gold ink reads perfectly on white.
 *
 * Both skip touch devices and prefers-reduced-motion.
 */

const currentTheme = (): 'dark' | 'light' =>
  document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

const motionAllowed = () =>
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
  !window.matchMedia('(pointer: coarse)').matches;

/* ── dark: WebGL tubes, void-black, screen blend ── */
const TUBES = ['#050505', '#0d0d0d', '#161616'];
const TUBE_LIGHTS = ['#6b6b6b', '#3d3d3d', '#ffffff', '#242424'];
const randomVoid = () => `hsl(0 0% ${(2 + Math.random() * 14).toFixed(0)}%)`;

function DarkTubes({ enableClickInteraction }: { enableClickInteraction: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<TubesCursorApp | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !motionAllowed()) return;
    let disposed = false;

    import('threejs-components/build/cursors/tubes1.min.js')
      .then((module) => {
        if (disposed) return;
        appRef.current = module.default(canvas, {
          tubes: { colors: [...TUBES], lights: { intensity: 200, colors: [...TUBE_LIGHTS] } },
        });
      })
      .catch(() => {
        /* a missing flourish must never take the dashboard down */
      });

    return () => {
      disposed = true;
      appRef.current?.dispose();
      appRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!enableClickInteraction) return;
    const onClick = (event: MouseEvent) => {
      const app = appRef.current;
      if (!app) return;
      if (
        event.target instanceof Element &&
        event.target.closest('a,button,input,textarea,select,label,[role=dialog]')
      ) {
        return;
      }
      app.tubes.setColors([randomVoid(), randomVoid(), randomVoid()]);
      app.tubes.setLightsColors([randomVoid(), randomVoid(), '#ffffff', randomVoid()]);
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [enableClickInteraction]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] hidden h-lvh w-screen overflow-hidden mix-blend-screen lg:block"
    >
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />
    </div>
  );
}

/* ── bright: golden 2D trail (transparent canvas — cannot darken the UI) ── */
function GoldTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !motionAllowed()) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const points: { x: number; y: number; life: number }[] = [];

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e: MouseEvent) => {
      points.push({ x: e.clientX, y: e.clientY, life: 1 });
      if (points.length > 28) points.shift();
    };
    window.addEventListener('mousemove', onMove);

    const tick = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 1; i < points.length; i++) {
        const p0 = points[i - 1];
        const p1 = points[i];
        const alpha = p1.life * (i / points.length) * 0.55;
        ctx.strokeStyle = `rgba(214, 169, 61, ${alpha})`;
        ctx.lineWidth = 3 * p1.life;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 14;
        ctx.shadowColor = `rgba(214, 169, 61, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      for (const p of points) p.life *= 0.94;
      while (points.length && points[0].life < 0.03) points.shift();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] hidden lg:block"
    />
  );
}

export default function TubesCursor({
  enableClickInteraction = true,
}: {
  enableClickInteraction?: boolean;
}) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    setTheme(currentTheme());
    const observer = new MutationObserver(() => setTheme(currentTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return theme === 'light' ? (
    <GoldTrail />
  ) : (
    <DarkTubes enableClickInteraction={enableClickInteraction} />
  );
}
