'use client';

import { useEffect, useRef } from 'react';

/**
 * Neon cursor trail — the dashboard's take on the landing site's glowing
 * cursor. A 2D canvas draws a fading ribbon behind the pointer (gold in dark
 * mode, ink in light mode) instead of the site's WebGL tubes, so it stays
 * cheap over dense trading UI. Pointer-events-none, skipped entirely on
 * touch devices and under prefers-reduced-motion.
 */
export default function CursorGlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const points: { x: number; y: number; life: number }[] = [];

    const themeColor = () =>
      document.documentElement.dataset.theme === 'light'
        ? { r: 13, g: 18, b: 32 } // ink on the bright theme
        : { r: 214, g: 169, b: 61 }; // brand gold on the dark theme

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
      const { r, g, b } = themeColor();
      for (let i = 1; i < points.length; i++) {
        const p0 = points[i - 1];
        const p1 = points[i];
        const alpha = p1.life * (i / points.length) * 0.5;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.lineWidth = 2.5 * p1.life;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 12;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
      className="pointer-events-none fixed inset-0 z-[95] hidden lg:block"
    />
  );
}
