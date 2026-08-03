'use client';

import { useEffect, useRef, useState } from 'react';
import type { TubesCursorApp } from 'threejs-components/build/cursors/tubes1.min.js';

/**
 * The landing site's cursor: WebGL neon tubes following the pointer. Theme-
 * aware palettes — DARK mode runs the site's void-black tubes on a screen
 * blend (black dissolves, rims glow); BRIGHT mode runs GOLDEN tubes on a
 * multiply blend (white dissolves, gold ink shows on the light UI). The
 * dashboard surfaces are opaque, so the canvas overlays the UI
 * (pointer-events-none) with the blend carrying the transparency.
 */
const PALETTES = {
  dark: {
    tubes: ['#050505', '#0d0d0d', '#161616'],
    lights: ['#6b6b6b', '#3d3d3d', '#ffffff', '#242424'],
    /** Random re-roll stays inside the void-black look. */
    random: () => `hsl(0 0% ${(2 + Math.random() * 14).toFixed(0)}%)`,
  },
  light: {
    tubes: ['#d6a93d', '#b9902f', '#8a6a1f'],
    lights: ['#f0d27a', '#d6a93d', '#ffffff', '#a87f26'],
    /** Random re-roll stays inside the golds. */
    random: () =>
      `hsl(${(43 + Math.random() * 6).toFixed(0)} 68% ${(35 + Math.random() * 25).toFixed(0)}%)`,
  },
} as const;

const currentTheme = (): 'dark' | 'light' =>
  document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

export default function TubesCursor({
  enableClickInteraction = true,
}: {
  enableClickInteraction?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<TubesCursorApp | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let disposed = false;
    setTheme(currentTheme());

    import('threejs-components/build/cursors/tubes1.min.js')
      .then((module) => {
        if (disposed) return;
        const palette = PALETTES[currentTheme()];
        appRef.current = module.default(canvas, {
          tubes: {
            colors: [...palette.tubes],
            lights: { intensity: 200, colors: [...palette.lights] },
          },
        });
      })
      .catch(() => {
        /* a missing flourish must never take the dashboard down */
      });

    // Follow the dashboard theme toggle live.
    const observer = new MutationObserver(() => {
      const next = currentTheme();
      setTheme(next);
      const palette = PALETTES[next];
      appRef.current?.tubes.setColors([...palette.tubes]);
      appRef.current?.tubes.setLightsColors([...palette.lights]);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      disposed = true;
      observer.disconnect();
      appRef.current?.dispose();
      appRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!enableClickInteraction) return;
    const onClick = (event: MouseEvent) => {
      const app = appRef.current;
      if (!app) return;
      // Ignore clicks meant for the UI — re-rolling on every button press
      // would read as a bug, not an easter egg.
      if (
        event.target instanceof Element &&
        event.target.closest('a,button,input,textarea,select,label,[role=dialog]')
      ) {
        return;
      }
      const { random } = PALETTES[currentTheme()];
      app.tubes.setColors([random(), random(), random()]);
      app.tubes.setLightsColors([random(), random(), '#ffffff', random()]);
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [enableClickInteraction]);

  // The library sizes its buffer from the canvas's PARENT — give it a
  // viewport-sized wrapper. The tubes scene paints an OPAQUE black
  // background, so the overlay must screen-blend: black dissolves to
  // transparent and only the lit tube rims show over the UI. Without the
  // blend the canvas covers the whole dashboard.
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-[60] hidden h-lvh w-screen overflow-hidden lg:block ${
        theme === 'light' ? 'mix-blend-multiply' : 'mix-blend-screen'
      }`}
    >
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />
    </div>
  );
}
