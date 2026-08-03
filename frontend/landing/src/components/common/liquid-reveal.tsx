"use client";

import { useEffect, useRef } from "react";

const BRUSH_RADIUS = 143;
const DECAY = 0.016;
const FADE_FRAMES = 120;
const MAX_INTERP = 60;

export interface LiquidRevealProps {
  /** Always-visible base layer — this is the LCP image. */
  beforeSrc: string;
  /** Painted along the cursor trail. */
  afterSrc: string;
  alt: string;
  className?: string;
}

/**
 * Before/after image with a soft brush trail: moving the pointer paints the
 * `after` image over the `before` one, and the trail decays back when idle.
 *
 * The canvas is decorative and skipped entirely under `prefers-reduced-motion`,
 * leaving the static base image.
 */
export const LiquidReveal = ({
  beforeSrc,
  afterSrc,
  alt,
  className,
}: LiquidRevealProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    const radius = BRUSH_RADIUS * dpr;
    const diameter = Math.ceil(radius * 2);

    const cover = document.createElement("canvas");
    const coverCtx = cover.getContext("2d");
    const brush = document.createElement("canvas");
    brush.width = diameter;
    brush.height = diameter;
    const brushCtx = brush.getContext("2d");
    if (!coverCtx || !brushCtx) return;

    const image = new Image();
    image.crossOrigin = "anonymous";
    let loaded = false;
    image.onload = () => {
      loaded = true;
      paintCover();
    };
    image.src = afterSrc;

    /** Redraw the after-image into `cover` with object-fit: cover maths. */
    const paintCover = () => {
      if (!loaded || !cover.width || !cover.height) return;
      const scale = Math.max(
        cover.width / image.naturalWidth,
        cover.height / image.naturalHeight,
      );
      const w = image.naturalWidth * scale;
      const h = image.naturalHeight * scale;
      coverCtx.clearRect(0, 0, cover.width, cover.height);
      coverCtx.drawImage(image, (cover.width - w) / 2, (cover.height - h) / 2, w, h);
    };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      cover.width = canvas.width;
      cover.height = canvas.height;
      paintCover();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const points: { x: number; y: number }[] = [];
    let last: { x: number; y: number } | null = null;

    const onPointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      const x = (event.clientX - rect.left) * dpr;
      const y = (event.clientY - rect.top) * dpr;
      const outside =
        x < -radius ||
        y < -radius ||
        x > canvas.width + radius ||
        y > canvas.height + radius;
      if (outside) {
        last = null;
        return;
      }
      if (last) {
        const dx = x - last.x;
        const dy = y - last.y;
        const dist = Math.hypot(dx, dy);
        const step = Math.max(radius * 0.3, 1);
        const n = Math.min(Math.ceil(dist / step), MAX_INTERP);
        for (let i = 1; i <= n; i++) {
          points.push({ x: last.x + (dx * i) / n, y: last.y + (dy * i) / n });
        }
      } else {
        points.push({ x, y });
      }
      last = { x, y };
    };
    window.addEventListener("pointermove", onPointerMove);

    const stamp = (x: number, y: number) => {
      const c = radius;
      brushCtx.clearRect(0, 0, diameter, diameter);
      brushCtx.globalCompositeOperation = "source-over";
      const gradient = brushCtx.createRadialGradient(c, c, 0, c, c, radius);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.55, "rgba(255,255,255,0.82)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      brushCtx.fillStyle = gradient;
      brushCtx.fillRect(0, 0, diameter, diameter);
      brushCtx.globalCompositeOperation = "source-in";
      brushCtx.drawImage(cover, x - c, y - c, diameter, diameter, 0, 0, diameter, diameter);
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(brush, x - c, y - c);
    };

    let idle = 0;
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const drawing = points.length > 0;
      if (drawing) idle = 0;
      else {
        idle++;
        if (idle > FADE_FRAMES) return;
      }

      const fade = drawing ? DECAY : Math.min(DECAY + idle * 0.004, 0.5);
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (drawing) {
        for (const point of points) stamp(point.x, point.y);
        points.length = 0;
      } else if (idle === FADE_FRAMES) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [afterSrc]);

  return (
    // The caller owns positioning — it must pass a positioned class
    // (`relative`/`absolute`), since the image and canvas below are absolute.
    <div ref={hostRef} className={className}>
      {/* Plain <img>: the source is a remote bucket and this is the LCP element. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={beforeSrc}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </div>
  );
};
