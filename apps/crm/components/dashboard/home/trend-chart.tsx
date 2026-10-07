"use client";

// Smooth line chart of the dashboard's Statistics card: the period's line in the brand colour, the previous period
// as a dashed grey comparison line, a hover crosshair with a value bubble. Plain SVG sized to its container.

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/components/kit";

export type TrendPoint = { t: number; v: number };

/** Monotone cubic (Fritsch–Carlson) path through the points: smooth, never overshooting. */
function smoothPath(pts: [number, number][]) {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0]![0]},${pts[0]![1]}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1]![0] - pts[i]![0]);
    m.push((pts[i + 1]![1] - pts[i]![1]) / (dx[i] || 1));
  }
  const tan: number[] = [m[0]!];
  for (let i = 1; i < n - 1; i++) tan.push(m[i - 1]! * m[i]! <= 0 ? 0 : (m[i - 1]! + m[i]!) / 2);
  tan.push(m[n - 2]!);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      tan[i] = 0;
      tan[i + 1] = 0;
      continue;
    }
    const a = tan[i]! / m[i]!;
    const b = tan[i + 1]! / m[i]!;
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      tan[i] = k * a * m[i]!;
      tan[i + 1] = k * b * m[i]!;
    }
  }
  let d = `M${pts[0]![0].toFixed(1)},${pts[0]![1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const h = dx[i]! / 3;
    d += ` C${(x0 + h).toFixed(1)},${(y0 + tan[i]! * h).toFixed(1)} ${(x1 - h).toFixed(1)},${(y1 - tan[i + 1]! * h).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}

function niceTicks(min: number, max: number, count = 4) {
  if (min === max) {
    const p = Math.abs(min) * 0.05 || 1;
    min -= p;
    max += p;
  }
  const span = max - min;
  const raw = span / count;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * pow).find((s) => span / s <= count) ?? 10 * pow;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(10));
  return out;
}

export function TrendChart({
  points,
  compare,
  height = 260,
  formatValue,
  formatAxis,
  formatTime,
  className,
  label,
}: {
  points: TrendPoint[];
  /** Previous period, drawn dashed (aligned by position). */
  compare?: number[] | null;
  height?: number;
  formatValue: (v: number) => string;
  formatAxis?: (v: number) => string;
  formatTime: (t: number) => string;
  className?: string;
  label?: string;
}) {
  const wrap = React.useRef<HTMLDivElement>(null);
  const [w, setW] = React.useState(0);
  const [hover, setHover] = React.useState<number | null>(null);
  React.useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const n = points.length;
  const cmp = compare && compare.length > 1 ? compare.slice(-n) : null;
  const all = [...points.map((p) => p.v), ...(cmp ?? [])];
  const ticks = niceTicks(Math.min(...all), Math.max(...all));
  const lo = ticks[0]!;
  const hi = ticks[ticks.length - 1]!;
  const axisW = 58;
  const padT = 34;
  const padB = 30;
  const plotW = Math.max(10, w - axisW - 8);
  const plotH = height - padT - padB;
  const x = (i: number, len = n) => axisW + (len <= 1 ? plotW / 2 : (i / (len - 1)) * plotW);
  const y = (v: number) => padT + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
  const main = points.map((p, i) => [x(i), y(p.v)] as [number, number]);
  const prev = cmp ? cmp.map((v, i) => [x(i + (n - cmp.length)), y(v)] as [number, number]) : null;
  const d = smoothPath(main);
  const area = main.length > 1 ? `${d} L${main[main.length - 1]![0]},${padT + plotH} L${main[0]![0]},${padT + plotH} Z` : "";
  // as many date labels as fit (about one per 78px), never more than 7
  const nx = Math.max(2, Math.min(7, n, Math.floor(plotW / 78) + 1));
  const xLabels = n <= 1 ? [0] : Array.from(new Set(Array.from({ length: nx }, (_, k) => Math.round((k / (nx - 1)) * (n - 1)))));
  const id = React.useId().replace(/:/g, "");
  const hp = hover !== null ? points[hover] : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (n === 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round(((px - axisW) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div ref={wrap} dir="ltr" className={cn("relative w-full select-none", className)} style={{ height }}>
      {w > 0 && n > 0 && (
        <svg width={w} height={height} className="absolute inset-0 touch-pan-y overflow-visible" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label={label}>
          <defs>
            <linearGradient id={`a${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" style={{ stopColor: "var(--k-ember)", stopOpacity: 0.16 }} />
              <stop offset="1" style={{ stopColor: "var(--k-ember)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={axisW} x2={axisW + plotW} y1={y(v)} y2={y(v)} stroke="var(--k-border)" strokeDasharray="3 5" />
              <text x={axisW - 12} y={y(v)} dy="0.35em" textAnchor="end" className="k-num fill-[var(--k-fg-3)] text-[11.5px]">
                {(formatAxis ?? formatValue)(v)}
              </text>
            </g>
          ))}
          {xLabels.map((i) => (
            <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className={cn("text-[11.5px]", hover === i ? "fill-[var(--k-fg)] font-semibold" : "fill-[var(--k-fg-3)]")}>
              {formatTime(points[i]!.t)}
            </text>
          ))}
          {prev && <path d={smoothPath(prev)} fill="none" stroke="var(--k-fg-3)" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="4 5" strokeLinecap="round" />}
          {area && <path d={area} fill={`url(#a${id})`} />}
          <motion.path key={d.length + ":" + n} d={d} fill="none" stroke="var(--k-ember)" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
          {hp && hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={padT - 6} y2={padT + plotH} stroke="var(--k-fg-2)" strokeOpacity={0.6} strokeDasharray="3 4" />
              <circle cx={x(hover)} cy={y(hp.v)} r={9} style={{ fill: "color-mix(in oklab, var(--k-ember) 22%, transparent)" }} />
              <circle cx={x(hover)} cy={y(hp.v)} r={5} fill="var(--k-ember)" stroke="var(--k-surface)" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
      {hp && hover !== null && w > 0 && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-[10px] bg-[var(--k-ink)] px-2.5 py-1.5 text-center text-[var(--k-ink-fg)] shadow-[var(--k-shadow-pop)]"
          style={{ left: Math.min(Math.max(x(hover), axisW + 40), w - 44), top: Math.max(0, y(hp.v) - 14) }}
        >
          <div className="k-num whitespace-nowrap text-[12px] font-bold leading-tight">{formatValue(hp.v)}</div>
          <div className="whitespace-nowrap text-[10px] leading-tight opacity-70">{formatTime(hp.t)}</div>
        </div>
      )}
    </div>
  );
}
