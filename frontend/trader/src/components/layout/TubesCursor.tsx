'use client';

import { useEffect, useRef } from 'react';
import type { TubesCursorApp } from 'threejs-components/build/cursors/tubes1.min.js';

/**
 * The landing site's cursor, verbatim: WebGL neon tubes following the
 * pointer, in the same void-black "knight / black hole" palette. Unlike the
 * landing (where the canvas sits behind translucent sections), the dashboard
 * surfaces are opaque — so the canvas overlays the UI (pointer-events-none)
 * and the white rim lights carry the effect over both themes.
 */
const TUBE_COLORS = ['#050505', '#0d0d0d', '#161616'];
const LIGHT_COLORS = ['#6b6b6b', '#3d3d3d', '#ffffff', '#242424'];

/** A void-black at a random depth — keeps re-rolls inside the dark look. */
const randomVoid = () => {
  const light = 2 + Math.random() * 14;
  return `hsl(0 0% ${light.toFixed(0)}%)`;
};

export default function TubesCursor({
  enableClickInteraction = true,
}: {
  enableClickInteraction?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<TubesCursorApp | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let disposed = false;

    import('threejs-components/build/cursors/tubes1.min.js')
      .then((module) => {
        if (disposed) return;
        appRef.current = module.default(canvas, {
          tubes: {
            colors: TUBE_COLORS,
            lights: { intensity: 200, colors: LIGHT_COLORS },
          },
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
      // Ignore clicks meant for the UI — re-rolling on every button press
      // would read as a bug, not an easter egg.
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

  // The library sizes its buffer from the canvas's PARENT — give it a
  // viewport-sized wrapper. Overlay: above content, below modals/panels.
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] hidden h-lvh w-screen overflow-hidden lg:block"
    >
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />
    </div>
  );
}
