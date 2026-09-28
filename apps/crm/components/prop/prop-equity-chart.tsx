"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn, formatMoney } from "@kalks/ui";

export interface PropLine {
  value: number;
  label: string;
  tone: "down" | "gold" | "muted" | "warn";
}

const TONE: Record<PropLine["tone"], string> = {
  down: "var(--k-down)",
  gold: "var(--k-gold)",
  warn: "var(--k-warn)",
  muted: "var(--k-fg-3)",
};

/**
 * Gold equity line over a dotted grid with labelled horizontal rule lines
 * (max-loss floor in red, profit target in gold, start balance muted).
 */
export function PropEquityChart({ data, lines, height = 300, className }: { data: { time: number; value: number }[]; lines: PropLine[]; height?: number; className?: string }) {
  const wrap = React.useRef<HTMLDivElement>(null);
  const [w, setW] = React.useState(800);
  const [hover, setHover] = React.useState<number | null>(null);
  const id = React.useId().replace(/:/g, "");

  React.useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const padL = 8;
  const padR = 64;
  const padT = 16;
  const padB = 26;
  const values = [...data.map((d) => d.value), ...lines.map((l) => l.value)];
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || 1;
  const min = rawMin - span * 0.08;
  const max = rawMax + span * 0.08;
  const x = (i: number) => padL + (i / (data.length - 1)) * (w - padL - padR);
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (height - padT - padB);

  const d = data.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${d} L${x(data.length - 1)},${height - padB} L${x(0)},${height - padB} Z`;

  // Day ticks
  const ticks: { i: number; label: string }[] = [];
  let lastDay = "";
  data.forEach((p, i) => {
    const day = new Date((p.time + 3 * 3600) * 1000).toISOString().slice(0, 10);
    if (day !== lastDay) {
      lastDay = day;
      const prev = ticks[ticks.length - 1];
      if (prev && x(i) - x(prev.i) < 64) return;
      ticks.push({ i, label: new Date(day).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }) });
    }
  });

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round(((px - padL) / (w - padL - padR)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  const hp = hover !== null ? data[hover]! : null;
  const last = data[data.length - 1]!;

  return (
    <div ref={wrap} className={cn("relative w-full", className)} style={{ height }}>
      <div className="k-dotgrid absolute inset-0 rounded-[14px] opacity-60" style={{ right: padR, bottom: padB }} />
      <svg width={w} height={height} className="relative block touch-none select-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`a${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--k-gold)" stopOpacity="0.26" />
            <stop offset="1" stopColor="var(--k-gold)" stopOpacity="0" />
          </linearGradient>
          <filter id={`g${id}`} x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <linearGradient id={`z${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--k-down)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--k-down)" stopOpacity="0.14" />
          </linearGradient>
        </defs>

        {/* danger zone below the max-loss floor */}
        {lines
          .filter((l) => l.tone === "down")
          .map((l) => (
            <rect key={`z${l.label}`} x={padL} y={y(l.value)} width={w - padL - padR} height={height - padB - y(l.value)} fill={`url(#z${id})`} />
          ))}

        {/* x ticks */}
        {ticks.map((t) => (
          <g key={t.i}>
            <line x1={x(t.i)} x2={x(t.i)} y1={padT} y2={height - padB} stroke="var(--k-border)" />
            <text x={x(t.i) + 4} y={height - 8} fontSize="10.5" fill="var(--k-fg-3)" fontFamily="var(--font-geist-mono), monospace">
              {t.label}
            </text>
          </g>
        ))}

        <motion.path d={area} fill={`url(#a${id})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }} />
        <motion.path d={d} fill="none" stroke="var(--k-gold)" strokeWidth={5} opacity={0.35} filter={`url(#g${id})`} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.3, ease: "easeInOut" }} />
        <motion.path d={d} fill="none" stroke="var(--k-gold)" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.3, ease: "easeInOut" }} />

        {/* rule lines */}
        {lines.map((l) => {
          const yy = y(l.value);
          const c = TONE[l.tone];
          return (
            <g key={l.label}>
              <line x1={padL} x2={w - padR} y1={yy} y2={yy} stroke={c} strokeWidth={1.2} strokeDasharray="5 5" opacity={l.tone === "muted" ? 0.6 : 0.9} />
              <rect x={w - padR + 4} y={yy - 10} width={padR - 6} height={20} rx={10} fill="var(--k-surface-2)" stroke={c} strokeOpacity={0.5} />
              <text x={w - padR / 2 + 1} y={yy + 3.5} textAnchor="middle" fontSize="10" fontWeight={600} fill={c} fontFamily="var(--font-geist-mono), monospace">
                {(l.value / 1000).toFixed(1)}k
              </text>
              <text x={padL + 8} y={yy - 6} fontSize="10.5" fontWeight={500} fill={c}>
                {l.label}
              </text>
            </g>
          );
        })}

        {/* last point */}
        <circle cx={x(data.length - 1)} cy={y(last.value)} r={7} fill="var(--k-gold)" opacity={0.2} className="animate-pulse" />
        <circle cx={x(data.length - 1)} cy={y(last.value)} r={3.5} fill="var(--k-gold)" stroke="var(--k-bg)" strokeWidth={1.5} />

        {hp && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={height - padB} stroke="var(--k-fg-3)" strokeDasharray="3 4" />
            <circle cx={x(hover)} cy={y(hp.value)} r={4.5} fill="var(--k-gold)" stroke="var(--k-bg)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hp && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-xl border border-line bg-surface-3/95 px-3 py-2 text-[11.5px] shadow-xl backdrop-blur"
          style={{ left: Math.min(Math.max(x(hover) - 70, 0), w - padR - 150) }}
        >
          <div className="text-fg-3">{new Date((hp.time + 3 * 3600) * 1000).toISOString().slice(5, 16).replace("T", " · ").replace("-", "/")} GMT+3</div>
          <div className="k-num mt-0.5 text-[13px] font-semibold">{formatMoney(hp.value)}</div>
        </div>
      )}
    </div>
  );
}
