"use client";

// Payoff of a set of legs: P&L at expiry (piecewise linear, computed here) and today (model value with each leg's
// vol, the same GBSM as the pricer), across a range of underlying prices around spot. Profit / loss areas, spot,
// strikes and breakevens marked; hover shows the P&L at that price.
import * as React from "react";
import { cn } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { payoffAt, payoffNow, type PayLeg } from "@/lib/options/math";
import { px, usdSigned } from "./format";

interface Props {
  legs: PayLeg[];
  usdPerUnit: number;
  spot: number;
  u: string;
  cutAtMs: number;
  digits: number;
  breakevens: number[];
  /** typical move: ATM vol × √t (sets the price range) */
  sigmaT?: number;
  height?: number;
  className?: string;
}

const PAD = { l: 8, r: 58, t: 12, b: 22 };

export function PayoffChart({ legs, usdPerUnit, spot, u, cutAtMs, digits, breakevens, sigmaT = 0.03, height = 230, className }: Props) {
  const t = useT();
  const wrap = React.useRef<HTMLDivElement>(null);
  const [w, setW] = React.useState(520);
  const [hover, setHover] = React.useState<number | null>(null);
  const id = `pf${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [el, setEl] = React.useState<HTMLDivElement | null>(null);
  React.useLayoutEffect(() => {
    if (wrap.current !== el) setEl(wrap.current);
  });
  React.useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(240, el.clientWidth)));
    ro.observe(el);
    setW(Math.max(240, el.clientWidth));
    return () => ro.disconnect();
  }, [el]);

  const data = React.useMemo(() => {
    if (!legs.length || !(spot > 0) || !(usdPerUnit > 0)) return null;
    const ks = legs.map((l) => l.strike);
    const span = Math.max(spot * sigmaT * 2.6, ...ks.map((k) => Math.abs(k - spot) * 1.5), spot * 0.004);
    const lo = Math.max(spot * 0.2, spot - span);
    const hi = spot + span;
    const N = 160;
    const xs = Array.from({ length: N + 1 }, (_, i) => lo + ((hi - lo) * i) / N);
    // the strikes themselves, so the kinks are exact
    for (const k of ks) if (k > lo && k < hi) xs.push(k);
    xs.sort((a, b) => a - b);
    const now = Date.now();
    const exp = xs.map((x) => payoffAt(legs, x, usdPerUnit));
    const today = cutAtMs > now ? xs.map((x) => payoffNow(legs, x, usdPerUnit, u, cutAtMs, now)) : null;
    const all = [...exp, ...(today ?? []), 0];
    let ymin = Math.min(...all);
    let ymax = Math.max(...all);
    const pad = Math.max(1, (ymax - ymin) * 0.12);
    ymin -= pad;
    ymax += pad;
    return { xs, exp, today, lo, hi, ymin, ymax };
  }, [legs, usdPerUnit, spot, sigmaT, u, cutAtMs]);

  if (!data)
    return (
      <div ref={wrap} className={cn("grid place-items-center text-[12px] text-fg-3", className)} style={{ height }}>
        {t("trader.opt.payoff.empty")}
      </div>
    );

  const iw = w - PAD.l - PAD.r;
  const ih = height - PAD.t - PAD.b;
  const X = (v: number) => PAD.l + ((v - data.lo) / (data.hi - data.lo)) * iw;
  const Y = (v: number) => PAD.t + (1 - (v - data.ymin) / (data.ymax - data.ymin)) * ih;
  const y0 = Y(0);
  const line = (ys: number[]) => ys.map((y, i) => `${i ? "L" : "M"}${X(data.xs[i]!).toFixed(1)},${Y(y).toFixed(1)}`).join("");
  const area = `${line(data.exp)}L${X(data.xs[data.xs.length - 1]!).toFixed(1)},${y0.toFixed(1)}L${X(data.xs[0]!).toFixed(1)},${y0.toFixed(1)}Z`;
  const ticksY = [data.ymax - (data.ymax - data.ymin) * 0.06, 0, data.ymin + (data.ymax - data.ymin) * 0.06];
  const ticksX = [data.lo, (data.lo + spot) / 2, spot, (spot + data.hi) / 2, data.hi];

  const hx = hover === null ? null : data.xs[hover]!;
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const v = data.lo + ((e.clientX - r.left - PAD.l) / iw) * (data.hi - data.lo);
    let best = 0;
    for (let i = 1; i < data.xs.length; i++) if (Math.abs(data.xs[i]! - v) < Math.abs(data.xs[best]! - v)) best = i;
    setHover(best);
  };

  return (
    <div ref={wrap} className={cn("relative select-none", className)}>
      <svg width={w} height={height} className="block touch-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label={t("trader.opt.payoff.aria")}>
        <defs>
          <clipPath id={`${id}-up`}>
            <rect x={0} y={0} width={w} height={Math.max(0, y0)} />
          </clipPath>
          <clipPath id={`${id}-dn`}>
            <rect x={0} y={y0} width={w} height={Math.max(0, height - y0)} />
          </clipPath>
        </defs>
        {/* recessive grid */}
        {ticksY.map((v, i) => (
          <line key={i} x1={PAD.l} x2={PAD.l + iw} y1={Y(v)} y2={Y(v)} stroke="var(--t-grid)" strokeWidth={1} />
        ))}
        {/* profit / loss areas at expiry */}
        <path d={area} fill="var(--k-up)" fillOpacity={0.14} clipPath={`url(#${id}-up)`} />
        <path d={area} fill="var(--k-down)" fillOpacity={0.14} clipPath={`url(#${id}-dn)`} />
        <line x1={PAD.l} x2={PAD.l + iw} y1={y0} y2={y0} stroke="var(--k-fg-3)" strokeOpacity={0.6} strokeDasharray="3 3" />
        {/* strikes */}
        {[...new Set(legs.map((l) => l.strike))].map((k) => (
          <line key={k} x1={X(k)} x2={X(k)} y1={PAD.t + ih} y2={PAD.t + ih - 5} stroke="var(--k-fg-3)" strokeWidth={1.5} />
        ))}
        {/* breakevens */}
        {breakevens
          .filter((b) => b > data.lo && b < data.hi)
          .map((b) => (
            <g key={b}>
              <line x1={X(b)} x2={X(b)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--k-gold)" strokeOpacity={0.55} strokeDasharray="2 3" />
              <text x={X(b)} y={PAD.t + 8} textAnchor="middle" className="fill-fg-2 font-mono text-[9.5px]">
                {px(b, digits)}
              </text>
            </g>
          ))}
        {/* spot */}
        <line x1={X(spot)} x2={X(spot)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--k-ember)" strokeOpacity={0.7} />
        {/* today (model) and at expiry */}
        {data.today && <path d={line(data.today)} fill="none" stroke="var(--k-fg-2)" strokeWidth={1.5} strokeDasharray="5 4" strokeLinejoin="round" />}
        <path d={line(data.exp)} fill="none" stroke="var(--k-gold)" strokeWidth={2} strokeLinejoin="round" />
        {/* axes labels */}
        {ticksY.map((v, i) => (
          <text key={i} x={PAD.l + iw + 6} y={Y(v) + 3} className="fill-fg-3 font-mono text-[9.5px]">
            {usdSigned(v, Math.abs(v) >= 1000 ? 0 : 2)}
          </text>
        ))}
        {ticksX.map((v, i) => (
          <text key={i} x={X(v)} y={height - 6} textAnchor={i === 0 ? "start" : i === ticksX.length - 1 ? "end" : "middle"} className={cn("font-mono text-[9.5px]", i === 2 ? "fill-ember" : "fill-fg-3")}>
            {px(v, digits)}
          </text>
        ))}
        {/* hover */}
        {hx !== null && hover !== null && (
          <g pointerEvents="none">
            <line x1={X(hx)} x2={X(hx)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--k-fg-3)" strokeDasharray="2 2" />
            <circle cx={X(hx)} cy={Y(data.exp[hover]!)} r={4} fill="var(--k-gold)" stroke="var(--t-panel)" strokeWidth={2} />
            {data.today && <circle cx={X(hx)} cy={Y(data.today[hover]!)} r={3.5} fill="var(--k-fg-2)" stroke="var(--t-panel)" strokeWidth={2} />}
          </g>
        )}
      </svg>
      {/* legend */}
      <div className="pointer-events-none absolute left-2 top-1 flex items-center gap-3 text-[10px] text-fg-3">
        <span className="flex items-center gap-1">
          <span className="h-[2px] w-3 rounded-full bg-gold" /> {t("trader.opt.payoff.atExpiry")}
        </span>
        {data.today && (
          <span className="flex items-center gap-1">
            <span className="h-0 w-3 border-t-[1.5px] border-dashed border-fg-2" /> {t("trader.opt.payoff.today")}
          </span>
        )}
      </div>
      {hx !== null && hover !== null && (
        <div className="pointer-events-none absolute z-10 rounded-[6px] border border-line-top bg-panel-2 px-2 py-1.5 font-mono text-[10.5px] shadow-[0_12px_30px_-12px_rgba(0,0,0,0.6)]" style={{ left: Math.min(Math.max(0, X(hx) + 10), w - 150), top: 18 }}>
          <div className="text-fg">{px(hx, digits)}</div>
          <div className="flex justify-between gap-3">
            <span className="font-sans text-fg-3">{t("trader.opt.payoff.atExpiry")}</span>
            <span className={data.exp[hover]! >= 0 ? "text-up" : "text-down"}>{usdSigned(data.exp[hover]!)}</span>
          </div>
          {data.today && (
            <div className="flex justify-between gap-3">
              <span className="font-sans text-fg-3">{t("trader.opt.payoff.today")}</span>
              <span className={data.today[hover]! >= 0 ? "text-up" : "text-down"}>{usdSigned(data.today[hover]!)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
