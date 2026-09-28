"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@kalks/ui";

type Pt = { label: string; csat: number; ai: number; volume: number };

/** Dual-line trend (CSAT gold, AI resolution ember) over a dotted grid with hatched volume bars. */
export function CsatTrend({ data, height = 280, className }: { data: Pt[]; height?: number; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [W, setW] = React.useState(800);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = height;
  const padL = 36;
  const padR = 12;
  const top = 14;
  const volH = 54;
  const chartB = H - volH - 22;
  const [hover, setHover] = React.useState<number | null>(null);
  const min = 55;
  const max = 100;
  const x = (i: number) => padL + (i / (data.length - 1)) * (W - padL - padR);
  const y = (v: number) => top + ((max - v) / (max - min)) * (chartB - top);
  const path = (k: "csat" | "ai") => data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(" ");
  const vmax = Math.max(...data.map((d) => d.volume));
  const bw = ((W - padL - padR) / data.length) * 0.45;
  const h = hover !== null ? data[hover]! : null;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: H }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - padL) / (W - padL - padR)) * (data.length - 1));
          setHover(Math.max(0, Math.min(data.length - 1, i)));
        }}
      >
        <defs>
          <pattern id="csat-dots" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--k-fg-3)" opacity="0.28" />
          </pattern>
          <pattern id="csat-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="2" height="4" fill="var(--k-fg-3)" opacity="0.45" />
          </pattern>
          <linearGradient id="csat-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--k-gold)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--k-gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x={padL} y={top} width={W - padL - padR} height={chartB - top} fill="url(#csat-dots)" />
        {[60, 70, 80, 90, 100].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--k-border)" strokeWidth={1} />
            <text x={padL - 8} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--k-fg-3)" fontFamily="var(--font-geist-mono), monospace">
              {v}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <rect key={i} x={x(i) - bw / 2} y={H - 22 - (d.volume / vmax) * volH} width={bw} height={(d.volume / vmax) * volH} rx={1.5} fill={hover === i ? "var(--k-ember)" : "url(#csat-hatch)"} opacity={hover === i ? 0.8 : 1} />
        ))}
        <path d={`${path("csat")} L${x(data.length - 1)},${chartB} L${x(0)},${chartB} Z`} fill="url(#csat-fill)" />
        <motion.path d={path("ai")} fill="none" stroke="var(--k-ember)" strokeWidth={2} strokeDasharray="0" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: "easeOut" }} />
        <motion.path d={path("csat")} fill="none" stroke="var(--k-gold)" strokeWidth={2.2} strokeLinecap="round" style={{ filter: "drop-shadow(0 0 6px rgba(233,185,73,0.45))" }} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: "easeOut" }} />
        {data.map((d, i) =>
          (i % (W < 600 ? 7 : 4) === 0 && data.length - 1 - i >= 3) || i === data.length - 1 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--k-fg-3)" fontFamily="var(--font-geist-mono), monospace">
              {d.label}
            </text>
          ) : null,
        )}
        {h && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={top} y2={H - 22} stroke="var(--k-fg-3)" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(h.csat)} r={4.5} fill="var(--k-gold)" stroke="var(--k-surface)" strokeWidth={2} />
            <circle cx={x(hover)} cy={y(h.ai)} r={4.5} fill="var(--k-ember)" stroke="var(--k-surface)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-xl border border-line bg-surface-2/95 px-3 py-2 text-[11.5px] shadow-xl backdrop-blur"
          style={{ left: `calc(${(x(hover) / W) * 100}% + ${hover > data.length / 2 ? -150 : 12}px)` }}
        >
          <div className="font-mono text-fg-3">{h.label}</div>
          <div className="mt-1 flex items-center gap-2"><span className="size-2 rounded-full bg-gold" /> CSAT <span className="k-num ml-auto font-medium">{h.csat}%</span></div>
          <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-ember" /> AI resolved <span className="k-num ml-auto font-medium">{h.ai}%</span></div>
          <div className="flex items-center gap-2 text-fg-3"><span className="size-2 rounded-sm bg-fg-3/60" /> Rated chats <span className="k-num ml-auto">{h.volume}</span></div>
        </div>
      )}
    </div>
  );
}
