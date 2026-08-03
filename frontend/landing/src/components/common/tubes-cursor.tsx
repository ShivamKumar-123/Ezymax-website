"use client";

import { useEffect, useRef } from "react";
import type { TubesCursorApp } from "threejs-components/build/cursors/tubes1.min.js";

/**
 * Void palette — "black knight / black hole": near-black tubes whose gloss
 * comes entirely from grey-to-white rim light, so they read as dark glossy
 * bodies coiling over the obsidian page rather than neon.
 */
const TUBE_COLORS = ["#050505", "#0d0d0d", "#161616"];
const LIGHT_COLORS = ["#6b6b6b", "#3d3d3d", "#ffffff", "#242424"];

export interface TubesCursorProps {
  /** Click anywhere non-interactive to re-roll the palette. */
  enableClickInteraction?: boolean;
}

/** A void-black at a random depth — keeps re-rolls inside the dark look. */
const randomVoid = () => {
  const light = 2 + Math.random() * 14;
  return `hsl(0 0% ${light.toFixed(0)}%)`;
};

/**
 * Site-wide neon tubes that follow the cursor in 3D.
 *
 * Mounted once, fixed behind every section — page content sits above it on a
 * `z-10` stacking layer, and the canvas is `pointer-events-none` so it never
 * eats a click. Sections are translucent so it shows through.
 *
 * The 805 KB `tubes1` build inlines its own three.js, so it is imported
 * dynamically inside the effect: out of the first-load bundle and off the
 * server entirely. Loaded from node_modules, never a CDN — a remote `import()`
 * would be an uncacheable third-party runtime dependency.
 */
export const TubesCursor = ({
  enableClickInteraction = true,
}: TubesCursorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<TubesCursorApp | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let disposed = false;

    import("threejs-components/build/cursors/tubes1.min.js")
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
        // A missing backdrop must never take the page down with it.
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
      // The canvas is behind everything, so clicks arrive via the document.
      // Ignore the ones meant for the UI — re-rolling on every button press
      // would read as a bug, not an easter egg.
      if (
        event.target instanceof Element &&
        event.target.closest("a,button,input,textarea,select,label,[role=dialog]")
      ) {
        return;
      }
      app.tubes.setColors([randomVoid(), randomVoid(), randomVoid()]);
      app.tubes.setLightsColors([
        randomVoid(),
        randomVoid(),
        "#ffffff",
        randomVoid(),
      ]);
    };

    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [enableClickInteraction]);

  // The library sizes the drawing buffer from the canvas's PARENT, so the
  // canvas needs a viewport-sized wrapper. Left as a bare fixed canvas it
  // measured the full-page scroll wrapper and rendered an 8.8k-px-tall buffer
  // with the tubes far below the fold.
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 h-lvh w-screen overflow-hidden"
    >
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />
    </div>
  );
};
