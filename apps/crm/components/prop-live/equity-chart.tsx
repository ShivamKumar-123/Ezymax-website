"use client";

import * as React from "react";
import { cn } from "@/components/kit";
import { intlTag } from "@ezymex/i18n";
import { useT } from "@ezymex/i18n/react";
import { usd } from "./api";

export interface ChartLine {
  value: number;
  label: string;
  tone: "down" | "gold" | "muted" | "warn";
}

const TONE: Record<ChartLine["tone"], string> = {
  down: "var(--k-down)",
  gold: "var(--k-gold)",
  warn: "var(--k-warn)",
  muted: "var(--k-fg-3)",
};

const short = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(v >= 100_000 ? 0 : 1)}k` : v.toFixed(0));

/**
 * Static equity line with labelled rule levels (drawdown floor, start balance, profit target). No looping motion,
 * no glow: a plain line, a faint area and a hover read-out.
 */
export function PropEquityLine({ data, lines, height = 300, className }: { data: { t: number; v: number }[]; lines: ChartLine[]; height?: number; className?: string }) {
  const t = useT();
  const tag = intlTag(t.locale);
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

  if (data.length < 2) {
    return (
      <div ref={wrap} className={cn("grid place-items-center rounded-[14px] border border-dashed border-line text-[13px] text-fg-3", className)} style={{ height }}>
        {t("prop.chart.empty")}
      </div>
    );
  }

  const padL = 8;
  const padR = 64;
  const padT = 16;
  const padB = 26;
  const values = [...data.map((d) => d.v), ...lines.map((l) => l.value)];
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || Math.max(1, rawMax * 0.01);
  const min = rawMin - span * 0.08;
  const max = rawMax + span * 0.08;
  const t0 = data[0]!.t;
  const t1 = data[data.length - 1]!.t;
  const x = (t: number) => padL + ((t - t0) / (t1 - t0 || 1)) * (w - padL - padR);
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (height - padT - padB);

  const d = data.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const area = `${d} L${x(t1).toFixed(1)},${height - padB} L${x(t0).toFixed(1)},${height - padB} Z`;

  // day ticks (local dates)
  const ticks: { t: number; label: string }[] = [];
  let lastDay = "";
  for (const p of data) {
    const dt = new Date(p.t);
    const day = dt.toDateString();
    if (day === lastDay) continue;
    lastDay = day;
    const prev = ticks[ticks.length - 1];
    if (prev && x(p.t) - x(prev.t) < 64) continue;
    ticks.push({ t: p.t, label: dt.toLocaleDateString(tag, { day: "2-digit", month: "short" }) });
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const tt = t0 + ((e.clientX - r.left - padL) / (w - padL - padR)) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < data.length; i++) if (Math.abs(data[i]!.t - tt) < Math.abs(data[best]!.t - tt)) best = i;
    setHover(best);
  };

  const hp = hover !== null ? data[hover]! : null;
  const last = data[data.length - 1]!;

  return (
    <div ref={wrap} dir="ltr" className={cn("relative w-full", className)} style={{ height }}>
      <svg width={w} height={height} className="relative block touch-none select-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`a${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--k-ember)" stopOpacity="0.14" />
            <stop offset="1" stopColor="var(--k-ember)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t.t}>
            <line x1={x(t.t)} x2={x(t.t)} y1={padT} y2={height - padB} stroke="var(--k-border)" />
            <text x={x(t.t) + 4} y={height - 8} fontSize="10.5" fill="var(--k-fg-3)" fontFamily="var(--font-geist-mono), monospace">
              {t.label}
            </text>
          </g>
        ))}

        <path d={area} fill={`url(#a${id})`} />
        <path d={d} fill="none" stroke="var(--k-ember)" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />

        {lines.map((l) => {
          const yy = y(l.value);
          const c = TONE[l.tone];
          return (
            <g key={l.label}>
              <line x1={padL} x2={w - padR} y1={yy} y2={yy} stroke={c} strokeWidth={1.2} strokeDasharray="5 5" opacity={l.tone === "muted" ? 0.6 : 0.9} />
              <rect x={w - padR + 4} y={yy - 10} width={padR - 6} height={20} rx={10} fill="var(--k-surface-2)" stroke={c} strokeOpacity={0.5} />
              <text x={w - padR / 2 + 1} y={yy + 3.5} textAnchor="middle" fontSize="10" fontWeight={600} fill={c} fontFamily="var(--font-geist-mono), monospace">
                {short(l.value)}
              </text>
              <text x={padL + 8} y={yy - 6} fontSize="10.5" fontWeight={500} fill={c}>
                {l.label}
              </text>
            </g>
          );
        })}

        <circle cx={x(last.t)} cy={y(last.v)} r={3.5} fill="var(--k-ember)" stroke="var(--k-bg)" strokeWidth={1.5} />

        {hp && (
          <g>
            <line x1={x(hp.t)} x2={x(hp.t)} y1={padT} y2={height - padB} stroke="var(--k-fg-3)" strokeDasharray="3 4" />
            <circle cx={x(hp.t)} cy={y(hp.v)} r={4.5} fill="var(--k-ember)" stroke="var(--k-bg)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hp && (
        <div className="pointer-events-none absolute top-2 z-10 rounded-xl border border-line bg-surface-3 px-3 py-2 text-[11.5px] shadow-xl" style={{ left: Math.min(Math.max(x(hp.t) - 70, 0), w - padR - 150) }}>
          <div className="text-fg-3">{new Date(hp.t).toLocaleString(tag, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })}</div>
          <div className="k-num mt-0.5 text-[13px] font-semibold">{usd(hp.v)}</div>
        </div>
      )}
    </div>
  );
}
