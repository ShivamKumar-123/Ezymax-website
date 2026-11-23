'use client';

import { useMemo } from 'react';

/**
 * Equity-curve sparkline — renders the EXISTING /portfolio/performance
 * equity_curve as a smooth inline-SVG wave (the reference's "wave chart"
 * card style). No chart library; consistent with the platform's other
 * hand-rolled SVG visuals.
 */
export function EquitySparkline({
  points,
  height = 56,
}: {
  points: Array<{ date: string; equity: number }>;
  height?: number;
}) {
  const path = useMemo(() => {
    const vals = points.map((p) => Number(p.equity)).filter(Number.isFinite);
    if (vals.length < 2) return null;
    const w = 100;
    const h = 100;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const step = w / (vals.length - 1);
    const pts = vals.map((v, i) => ({
      x: i * step,
      y: h - ((v - min) / span) * (h - 12) - 6,
    }));
    // Simple Catmull-Rom-ish smoothing via midpoint quadratics.
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      const mx = (prev.x + cur.x) / 2;
      d += ` Q ${prev.x.toFixed(2)} ${prev.y.toFixed(2)} ${mx.toFixed(2)} ${((prev.y + cur.y) / 2).toFixed(2)}`;
    }
    const last = pts[pts.length - 1];
    d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
    return d;
  }, [points]);

  if (!path) {
    return (
      <div
        className="flex items-center justify-center text-[11px] text-text-tertiary"
        style={{ height }}
      >
        Equity history appears after your first trades
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      aria-hidden
    >
      <path d={path} fill="none" stroke="#E12019" strokeWidth={2.4} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
