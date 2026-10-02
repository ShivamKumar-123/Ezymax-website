"use client";

// Charts of the options workspace's Analytics tab, drawn in SVG like the payoff chart (same palette, recessive grid,
// right-hand value axis, hover tooltip): the volatility smile of the expiry on screen (model IV by strike, the bid /
// ask IV band, the mark IVs of the book, ATM and spot), the term structure (ATM IV of every open expiry, the vol
// surface's pillars and realized vol; a click opens that expiry) and open interest / volume by strike (calls above,
// puts below, spot and max pain marked). Every chart reads left to right (dir="ltr") in every locale.
import * as React from "react";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import type { OptionChain, OptionQuote, OptionRight } from "@/lib/options/types";
import { RightTag } from "./bits";
import { countdown, expiryLabel, pct, strikeText } from "./format";
import type { OiRow, SmileData, TermPillar, TermPoint } from "./analytics-data";

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

/** Width of a box, kept current by a ResizeObserver (charts draw at their real pixel width). */
export function useBoxWidth(initial = 480, min = 220) {
  const [el, setEl] = React.useState<HTMLDivElement | null>(null);
  const [w, setW] = React.useState(initial);
  React.useEffect(() => {
    if (!el) return;
    const measure = () => setW(Math.max(min, Math.floor(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, min]);
  return [setEl, w] as const;
}

/** "Nice" axis ticks between two values (about `n` of them). */
export function niceTicks(lo: number, hi: number, n = 4): number[] {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / Math.max(1, n);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(12));
  return out;
}

/** Contracts in a short form: 950, 1.2k, 34k, 1.5M. */
export const compact = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return a >= 10 || Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1);
};

/** Vol points, signed: +0.35%. */
export const volPts = (v: number | null | undefined, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(d)}%`);

export function ChartTip({ x, w, top = 16, width = 168, children }: { x: number; w: number; top?: number; width?: number; children: React.ReactNode }) {
  const left = x + 12 + width > w ? Math.max(0, x - 12 - width) : x + 12;
  return (
    <div className="pointer-events-none absolute z-10 rounded-[6px] border border-line-top bg-panel-2 px-2 py-1.5 font-mono text-[10.5px] shadow-[0_12px_30px_-12px_rgba(0,0,0,0.6)]" style={{ left, top, width }}>
      {children}
    </div>
  );
}

export function TipRow({ k, v, className }: { k: React.ReactNode; v: React.ReactNode; className?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 leading-[16px]">
      <span className="font-sans text-fg-3">{k}</span>
      <span className={cn("text-fg", className)}>{v}</span>
    </div>
  );
}

export function LegendLine({ kind, label }: { kind: "solid" | "dashed" | "dotted" | "band" | "dot" | "ember" | "info"; label: React.ReactNode }) {
  const mark =
    kind === "solid" ? (
      <span className="h-[2px] w-3 rounded-full bg-gold" />
    ) : kind === "dashed" ? (
      <span className="w-3 border-t-[1.5px] border-dashed border-fg-2" />
    ) : kind === "dotted" ? (
      <span className="w-3 border-t-[1.5px] border-dotted border-fg-3" />
    ) : kind === "band" ? (
      <span className="h-2 w-3 rounded-[2px] bg-gold/25" />
    ) : kind === "dot" ? (
      <span className="size-[7px] rounded-full bg-fg-2 ring-[1.5px] ring-panel" />
    ) : kind === "ember" ? (
      <span className="h-3 w-px bg-ember" />
    ) : (
      <span className="w-3 border-t-[1.5px] border-dotted border-info" />
    );
  return (
    <span className="flex shrink-0 items-center gap-1">
      {mark}
      {label}
    </span>
  );
}

const linePath = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");

/* ------------------------------------------------------------------ */
/* Volatility smile                                                    */
/* ------------------------------------------------------------------ */

interface SmileRow {
  strike: number;
  label: string;
  right: OptionRight;
  model: number | null;
  bid: number | null;
  ask: number | null;
  mark: number | null;
}

const pos = (v: number | null | undefined) => (v !== null && v !== undefined && Number.isFinite(v) && v > 0 ? v : null);

/** The bid / ask IV of a quote: the book's best bid / offer IVs, else the house spread's. */
const ivBand = (q: OptionQuote | null | undefined) => (q ? (q.book ? { bid: pos(q.bidIv), ask: pos(q.askIv), mark: pos(q.markIv) } : { bid: pos(q.ivBid), ask: pos(q.ivAsk), mark: null }) : { bid: null, ask: null, mark: null });

function interp(pts: { strike: number; vol: number }[], k: number): number | null {
  if (!pts.length) return null;
  if (k <= pts[0]!.strike) return Math.abs(k - pts[0]!.strike) < 1e-9 ? pts[0]!.vol : null;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (k <= b.strike + 1e-12) return a.vol + ((b.vol - a.vol) * (k - a.strike)) / (b.strike - a.strike || 1);
  }
  return Math.abs(k - pts[pts.length - 1]!.strike) < 1e-9 ? pts[pts.length - 1]!.vol : null;
}

const SPAD = { l: 8, r: 50, t: 30, b: 22 };

export function SmileChart({ smile, chain, height = 210 }: { smile: SmileData | null; chain: OptionChain; height?: number }) {
  const t = useT();
  const [box, w] = useBoxWidth();
  const [hover, setHover] = React.useState<number | null>(null);
  const digits = chain.digits;

  const data = React.useMemo(() => {
    const ref = chain.atmStrike ?? chain.spot?.mid ?? null;
    const model = smile && smile.expiry === chain.expiry ? smile.points : [];
    const rows: SmileRow[] = chain.rows.map((r) => {
      const usePut = ref !== null && r.strike < ref;
      const q = (usePut ? r.put : r.call) ?? (usePut ? r.call : r.put);
      const right: OptionRight = q === r.put ? "put" : "call";
      const b = ivBand(q);
      return { strike: r.strike, label: r.strikeLabel, right, model: interp(model, r.strike), ...b };
    });
    const strikes = [...new Set([...rows.map((r) => r.strike), ...model.map((p) => p.strike)])].sort((a, b) => a - b);
    const vols: number[] = [];
    for (const r of rows) for (const v of [r.model, r.bid, r.ask, r.mark]) if (v !== null) vols.push(v);
    for (const p of model) vols.push(p.vol);
    if (strikes.length < 2 || !vols.length) return null;
    const step = strikes.length > 1 ? (strikes[strikes.length - 1]! - strikes[0]!) / (strikes.length - 1) : 1;
    const lo = strikes[0]! - step * 0.5;
    const hi = strikes[strikes.length - 1]! + step * 0.5;
    let ymin = Math.min(...vols);
    let ymax = Math.max(...vols);
    const span = Math.max(0.004, ymax - ymin);
    ymin = Math.max(0, ymin - span * 0.14);
    ymax = ymax + span * 0.2;
    return { rows, model, lo, hi, ymin, ymax, ref };
  }, [smile, chain]);

  if (!data)
    return (
      <div ref={box} className="grid place-items-center px-4 text-center text-[11.5px] text-fg-3" style={{ height }}>
        {t("trader.opt.an.smile.empty")}
      </div>
    );

  const iw = w - SPAD.l - SPAD.r;
  const ih = height - SPAD.t - SPAD.b;
  const X = (k: number) => SPAD.l + ((k - data.lo) / (data.hi - data.lo)) * iw;
  const Y = (v: number) => SPAD.t + (1 - (v - data.ymin) / (data.ymax - data.ymin)) * ih;
  const ticksY = niceTicks(data.ymin, data.ymax, 4).filter((v) => v > data.ymin && v < data.ymax);
  const nX = Math.max(2, Math.min(6, Math.floor(iw / 90)));
  const ticksX = Array.from({ length: nX }, (_, i) => data.rows[Math.round((i * (data.rows.length - 1)) / (nX - 1))]!).filter(Boolean);

  // the bid / ask band in contiguous pieces (an empty book side breaks it)
  const bands: string[] = [];
  let seg: SmileRow[] = [];
  const flush = () => {
    if (seg.length > 1) bands.push(`${linePath(seg.map((r) => [X(r.strike), Y(r.ask!)]))}${seg
      .slice()
      .reverse()
      .map((r) => `L${X(r.strike).toFixed(1)},${Y(r.bid!).toFixed(1)}`)
      .join("")}Z`);
    seg = [];
  };
  for (const r of data.rows) {
    if (r.bid !== null && r.ask !== null && r.ask >= r.bid) seg.push(r);
    else flush();
  }
  flush();
  const modelPts: [number, number][] = data.model.length ? data.model.filter((p) => p.strike >= data.lo && p.strike <= data.hi).map((p) => [X(p.strike), Y(p.vol)]) : [];
  const marks = data.rows.filter((r) => r.mark !== null);
  const pillars = (smile?.expiry === chain.expiry ? smile.pillars : []).filter((p) => (Math.abs(p.callDelta - 0.25) < 0.02 || Math.abs(p.callDelta - 0.75) < 0.02) && p.strike > data.lo && p.strike < data.hi);
  const atmK = chain.atmStrike ?? null;
  const spot = chain.spot?.mid ?? null;
  const hr = hover !== null ? data.rows[hover] : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const k = data.lo + ((e.clientX - r.left - SPAD.l) / iw) * (data.hi - data.lo);
    let best = -1;
    for (let i = 0; i < data.rows.length; i++) {
      const x = data.rows[i]!;
      if (x.model === null && x.bid === null && x.ask === null && x.mark === null) continue;
      if (best < 0 || Math.abs(x.strike - k) < Math.abs(data.rows[best]!.strike - k)) best = i;
    }
    setHover(best < 0 ? null : best);
  };

  return (
    <div ref={box} className="relative select-none" dir="ltr">
      <svg width={w} height={height} className="block touch-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label={t("trader.opt.an.smile.aria")}>
        {ticksY.map((v) => (
          <line key={v} x1={SPAD.l} x2={SPAD.l + iw} y1={Y(v)} y2={Y(v)} stroke="var(--t-grid)" strokeWidth={1} />
        ))}
        {bands.map((d, i) => (
          <path key={i} d={d} fill="var(--k-gold)" fillOpacity={0.16} />
        ))}
        {atmK !== null && atmK > data.lo && atmK < data.hi && (
          <g>
            <line x1={X(atmK)} x2={X(atmK)} y1={SPAD.t} y2={SPAD.t + ih} stroke="var(--k-fg-3)" strokeOpacity={0.7} strokeDasharray="3 3" />
            <text x={X(atmK)} y={SPAD.t - 4} textAnchor="middle" className="fill-fg-3 font-sans text-[9.5px] font-semibold uppercase tracking-[0.06em]">
              {t("trader.opt.an.smile.atm")}
            </text>
          </g>
        )}
        {spot !== null && spot > data.lo && spot < data.hi && <line x1={X(spot)} x2={X(spot)} y1={SPAD.t} y2={SPAD.t + ih} stroke="var(--k-ember)" strokeOpacity={0.75} />}
        {modelPts.length > 1 && <path d={linePath(modelPts)} fill="none" stroke="var(--k-gold)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {marks.map((r) => (
          <circle key={r.strike} cx={X(r.strike)} cy={Y(r.mark!)} r={2.6} fill="var(--k-fg-2)" stroke="var(--t-panel)" strokeWidth={1.5} />
        ))}
        {pillars.map((p) => {
          const put = p.callDelta > 0.5;
          return (
            <g key={p.callDelta}>
              <circle cx={X(p.strike)} cy={Y(p.vol)} r={3.2} fill="var(--t-panel)" stroke="var(--k-gold)" strokeWidth={1.5} />
              <text x={X(p.strike) + (put ? -5 : 5)} y={Y(p.vol) - 6} textAnchor={put ? "end" : "start"} className="fill-fg-3 font-mono text-[9px]">
                {`25Δ ${put ? "P" : "C"}`}
              </text>
            </g>
          );
        })}
        {ticksY.map((v) => (
          <text key={v} x={SPAD.l + iw + 6} y={Y(v) + 3} className="fill-fg-3 font-mono text-[9.5px]">
            {pct(v, v < 0.1 && data.ymax - data.ymin < 0.02 ? 2 : 1)}
          </text>
        ))}
        {ticksX.map((r, i) => (
          <text key={r.strike} x={X(r.strike)} y={height - 6} textAnchor={i === 0 ? "start" : i === ticksX.length - 1 ? "end" : "middle"} className="fill-fg-3 font-mono text-[9.5px]">
            {r.label}
          </text>
        ))}
        {hr && (
          <g pointerEvents="none">
            <line x1={X(hr.strike)} x2={X(hr.strike)} y1={SPAD.t} y2={SPAD.t + ih} stroke="var(--k-fg-3)" strokeDasharray="2 2" />
            {hr.model !== null && <circle cx={X(hr.strike)} cy={Y(hr.model)} r={4} fill="var(--k-gold)" stroke="var(--t-panel)" strokeWidth={2} />}
          </g>
        )}
      </svg>
      <div className="pointer-events-none absolute left-2 top-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-fg-3">
        {modelPts.length > 1 && <LegendLine kind="solid" label={t("trader.opt.an.smile.model")} />}
        {bands.length > 0 && <LegendLine kind="band" label={t("trader.opt.an.smile.band")} />}
        {marks.length > 0 && <LegendLine kind="dot" label={t("trader.opt.an.smile.mark")} />}
        {spot !== null && <LegendLine kind="ember" label={t("trader.opt.an.smile.spot")} />}
      </div>
      {hr && (
        <ChartTip x={X(hr.strike)} w={w} top={20}>
          <div className="mb-0.5 flex items-center gap-1.5 text-fg">
            <RightTag right={hr.right} className="h-[14px] min-w-[14px] text-[9px]" />
            {hr.label}
          </div>
          {hr.model !== null && <TipRow k={t("trader.opt.an.smile.model")} v={pct(hr.model, 2)} />}
          {(hr.bid !== null || hr.ask !== null) && <TipRow k={t("trader.opt.an.smile.band")} v={`${pct(hr.bid, 2)} / ${pct(hr.ask, 2)}`} />}
          {hr.mark !== null && <TipRow k={t("trader.opt.an.smile.mark")} v={pct(hr.mark, 2)} />}
        </ChartTip>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Term structure                                                      */
/* ------------------------------------------------------------------ */

const TPAD = { l: 10, r: 50, t: 26, b: 22 };
const GENERIC_TENORS: TermPillar[] = [
  { tenor: "1D", days: 1, atm: 0 },
  { tenor: "1W", days: 7, atm: 0 },
  { tenor: "2W", days: 14, atm: 0 },
  { tenor: "1M", days: 30, atm: 0 },
  { tenor: "2M", days: 61, atm: 0 },
  { tenor: "3M", days: 91, atm: 0 },
  { tenor: "6M", days: 182, atm: 0 },
  { tenor: "1Y", days: 365, atm: 0 },
];

export function TermChart({ points, surface, rv, selected, onPick, height = 210 }: { points: TermPoint[]; surface: TermPillar[]; rv: number | null; selected: string | null; onPick?: (date: string) => void; height?: number }) {
  const t = useT();
  const { locale } = useLocale();
  const [box, w] = useBoxWidth(360);
  const [hover, setHover] = React.useState<number | null>(null);

  const data = React.useMemo(() => {
    if (!points.length && surface.length < 2) return null;
    const maxListed = points.length ? Math.max(...points.map((p) => p.days)) : 0;
    const cap = maxListed > 0 ? Math.max(maxListed * 1.6, 8) : Infinity;
    const surf = surface.filter((p) => p.days <= cap);
    const maxDays = Math.max(maxListed, ...surf.map((p) => p.days), 1) * 1.06;
    const vols = [...points.map((p) => p.atm), ...surf.map((p) => p.atm), ...(rv ? [rv] : [])];
    let ymin = Math.min(...vols);
    let ymax = Math.max(...vols);
    const span = Math.max(0.006, ymax - ymin);
    ymin = Math.max(0, ymin - span * 0.18);
    ymax = ymax + span * 0.22;
    return { surf, maxDays, ymin, ymax };
  }, [points, surface, rv]);

  if (!data)
    return (
      <div ref={box} className="grid place-items-center px-4 text-center text-[11.5px] text-fg-3" style={{ height }}>
        {t("trader.opt.an.term.empty")}
      </div>
    );

  const iw = w - TPAD.l - TPAD.r;
  const ih = height - TPAD.t - TPAD.b;
  // √days spreads the dailies and the monthlies alike
  const X = (d: number) => TPAD.l + (Math.sqrt(Math.max(0, d)) / Math.sqrt(data.maxDays)) * iw;
  const Y = (v: number) => TPAD.t + (1 - (v - data.ymin) / (data.ymax - data.ymin)) * ih;
  const ticksY = niceTicks(data.ymin, data.ymax, 4).filter((v) => v > data.ymin && v < data.ymax);
  const tenorTicks = (data.surf.length >= 2 ? data.surf : GENERIC_TENORS).filter((p) => p.days <= data.maxDays);
  // drop tick labels that would touch
  const ticksX: TermPillar[] = [];
  for (const p of tenorTicks) if (!ticksX.length || X(p.days) - X(ticksX[ticksX.length - 1]!.days) > 26) ticksX.push(p);
  const hp = hover !== null ? points[hover] : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!points.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(X(points[i]!.days) - x) < Math.abs(X(points[best]!.days) - x)) best = i;
    setHover(best);
  };

  return (
    <div ref={box} className="relative select-none" dir="ltr">
      <svg
        width={w}
        height={height}
        className={cn("block touch-none", onPick && points.length > 0 && "cursor-pointer")}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onClick={() => hp && onPick?.(hp.date)}
        role="img"
        aria-label={t("trader.opt.an.term.aria")}
      >
        {ticksY.map((v) => (
          <line key={v} x1={TPAD.l} x2={TPAD.l + iw} y1={Y(v)} y2={Y(v)} stroke="var(--t-grid)" strokeWidth={1} />
        ))}
        {rv !== null && rv > data.ymin && rv < data.ymax && <line x1={TPAD.l} x2={TPAD.l + iw} y1={Y(rv)} y2={Y(rv)} stroke="var(--k-info)" strokeOpacity={0.8} strokeDasharray="1.5 3" strokeWidth={1.5} />}
        {data.surf.length >= 2 && (
          <>
            <path d={linePath(data.surf.map((p) => [X(p.days), Y(p.atm)]))} fill="none" stroke="var(--k-fg-3)" strokeWidth={1.5} strokeDasharray="4 4" />
            {data.surf.map((p) => (
              <circle key={p.tenor} cx={X(p.days)} cy={Y(p.atm)} r={2.5} fill="var(--t-panel)" stroke="var(--k-fg-3)" strokeWidth={1.25} />
            ))}
          </>
        )}
        {points.length > 1 && <path d={linePath(points.map((p) => [X(p.days), Y(p.atm)]))} fill="none" stroke="var(--k-gold)" strokeWidth={2} strokeLinejoin="round" />}
        {points.map((p, i) => {
          const on = p.date === selected;
          return <circle key={p.date} cx={X(p.days)} cy={Y(p.atm)} r={on ? 5 : hover === i ? 4.5 : 3.5} fill={on ? "var(--k-ember)" : "var(--k-gold)"} stroke="var(--t-panel)" strokeWidth={2} />;
        })}
        {ticksY.map((v) => (
          <text key={v} x={TPAD.l + iw + 6} y={Y(v) + 3} className="fill-fg-3 font-mono text-[9.5px]">
            {pct(v, 1)}
          </text>
        ))}
        {ticksX.map((p) => (
          <text key={p.tenor} x={X(p.days)} y={height - 6} textAnchor="middle" className="fill-fg-3 font-mono text-[9.5px]">
            {p.tenor}
          </text>
        ))}
        {hp && <line x1={X(hp.days)} x2={X(hp.days)} y1={TPAD.t} y2={TPAD.t + ih} stroke="var(--k-fg-3)" strokeDasharray="2 2" pointerEvents="none" />}
      </svg>
      <div className="pointer-events-none absolute left-2.5 top-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-fg-3">
        {points.length > 0 && <LegendLine kind="solid" label={t("trader.opt.an.term.listed")} />}
        {data.surf.length >= 2 && <LegendLine kind="dashed" label={t("trader.opt.an.term.surface")} />}
        {rv !== null && <LegendLine kind="info" label={t("trader.opt.rv")} />}
      </div>
      {hp && (
        <ChartTip x={X(hp.days)} w={w} top={20} width={160}>
          <div className="mb-0.5 text-fg">
            {expiryLabel(hp.date, locale)}
            {hp.date === selected && <span className="ms-1.5 font-sans text-[9.5px] text-ember">{t("trader.opt.an.term.onScreen")}</span>}
          </div>
          <TipRow k={t("trader.opt.atmIv")} v={pct(hp.atm, 2)} />
          <TipRow k={t("trader.opt.an.term.cutIn")} v={countdown(Date.parse(hp.cutAt))} />
          {rv !== null && <TipRow k={t("trader.opt.rv")} v={pct(rv, 2)} />}
        </ChartTip>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Open interest / volume by strike                                    */
/* ------------------------------------------------------------------ */

const OPAD = { l: 8, r: 46, t: 18, b: 22 };

export function OiChart({ rows, metric, spot, maxPain, digits, height = 210 }: { rows: OiRow[]; metric: "oi" | "volume"; spot: number | null; maxPain: number | null; digits: number; height?: number }) {
  const t = useT();
  const [box, w] = useBoxWidth();
  const [hover, setHover] = React.useState<number | null>(null);

  const data = React.useMemo(() => {
    const v = (r: OiRow) => (metric === "oi" ? [r.callOi, r.putOi] : [r.callVol, r.putVol]) as [number, number];
    // trim the empty wings, keeping a few strikes either side of spot
    let a = rows.findIndex((r) => v(r)[0] > 0 || v(r)[1] > 0);
    let b = rows.length - 1 - [...rows].reverse().findIndex((r) => v(r)[0] > 0 || v(r)[1] > 0);
    if (a < 0) return null;
    if (spot !== null) {
      let i0 = 0;
      for (let i = 1; i < rows.length; i++) if (Math.abs(rows[i]!.strike - spot) < Math.abs(rows[i0]!.strike - spot)) i0 = i;
      a = Math.min(a, Math.max(0, i0 - 3));
      b = Math.max(b, Math.min(rows.length - 1, i0 + 3));
    }
    a = Math.max(0, a - 1);
    b = Math.min(rows.length - 1, b + 1);
    const shown = rows.slice(a, b + 1).map((r) => ({ r, c: v(r)[0], p: v(r)[1] }));
    const max = Math.max(1, ...shown.map((x) => Math.max(x.c, x.p)));
    const step = shown.length > 1 ? (shown[shown.length - 1]!.r.strike - shown[0]!.r.strike) / (shown.length - 1) : 1;
    return { shown, max, lo: shown[0]!.r.strike - step / 2, hi: shown[shown.length - 1]!.r.strike + step / 2, step };
  }, [rows, metric, spot]);

  if (!data)
    return (
      <div ref={box} className="grid place-items-center px-4 text-center text-[11.5px] text-fg-3" style={{ height }}>
        {metric === "oi" ? t("trader.opt.an.oi.emptyOi") : t("trader.opt.an.oi.emptyVolume")}
      </div>
    );

  const iw = w - OPAD.l - OPAD.r;
  const ih = height - OPAD.t - OPAD.b;
  const half = ih / 2;
  const y0 = OPAD.t + half;
  const X = (k: number) => OPAD.l + ((k - data.lo) / (data.hi - data.lo)) * iw;
  const H = (v: number) => (v / data.max) * (half - 2);
  const bw = Math.max(2, Math.min(18, (iw / data.shown.length) * 0.64));
  const nX = Math.max(2, Math.min(7, Math.floor(iw / 80)));
  const ticksX = Array.from({ length: nX }, (_, i) => data.shown[Math.round((i * (data.shown.length - 1)) / (nX - 1))]!).filter(Boolean);
  const hs = hover !== null ? data.shown[hover] : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const k = data.lo + ((e.clientX - r.left - OPAD.l) / iw) * (data.hi - data.lo);
    let best = 0;
    for (let i = 1; i < data.shown.length; i++) if (Math.abs(data.shown[i]!.r.strike - k) < Math.abs(data.shown[best]!.r.strike - k)) best = i;
    setHover(best);
  };

  return (
    <div ref={box} className="relative select-none" dir="ltr">
      <svg width={w} height={height} className="block touch-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label={t("trader.opt.an.oi.aria")}>
        {[0.5, 1].map((f) => (
          <g key={f}>
            <line x1={OPAD.l} x2={OPAD.l + iw} y1={y0 - (half - 2) * f} y2={y0 - (half - 2) * f} stroke="var(--t-grid)" />
            <line x1={OPAD.l} x2={OPAD.l + iw} y1={y0 + (half - 2) * f} y2={y0 + (half - 2) * f} stroke="var(--t-grid)" />
          </g>
        ))}
        {hs && <rect x={X(hs.r.strike) - (iw / data.shown.length) / 2} y={OPAD.t} width={iw / data.shown.length} height={ih} fill="var(--k-surface-3)" fillOpacity={0.55} />}
        {data.shown.map(({ r, c, p }) => (
          <g key={r.strike}>
            {c > 0 && <rect x={X(r.strike) - bw / 2} y={y0 - 1 - H(c)} width={bw} height={Math.max(1, H(c))} rx={Math.min(2, bw / 3)} fill="var(--k-up)" fillOpacity={0.85} />}
            {p > 0 && <rect x={X(r.strike) - bw / 2} y={y0 + 1} width={bw} height={Math.max(1, H(p))} rx={Math.min(2, bw / 3)} fill="var(--k-down)" fillOpacity={0.85} />}
          </g>
        ))}
        <line x1={OPAD.l} x2={OPAD.l + iw} y1={y0} y2={y0} stroke="var(--k-fg-3)" strokeOpacity={0.5} />
        {maxPain !== null && maxPain > data.lo && maxPain < data.hi && (
          <g>
            <line x1={X(maxPain)} x2={X(maxPain)} y1={OPAD.t} y2={OPAD.t + ih} stroke="var(--k-gold)" strokeOpacity={0.8} strokeDasharray="3 3" />
            <text x={X(maxPain) + 4} y={OPAD.t + 8} className="fill-gold font-sans text-[9.5px] font-medium">
              {t("trader.opt.an.oi.maxPain")}
            </text>
          </g>
        )}
        {spot !== null && spot > data.lo && spot < data.hi && <line x1={X(spot)} x2={X(spot)} y1={OPAD.t} y2={OPAD.t + ih} stroke="var(--k-ember)" strokeOpacity={0.8} />}
        <text x={OPAD.l + iw + 6} y={OPAD.t + 6} className="fill-fg-3 font-mono text-[9.5px]">
          {compact(data.max)}
        </text>
        <text x={OPAD.l + iw + 6} y={y0 + 3} className="fill-fg-3 font-mono text-[9.5px]">
          0
        </text>
        <text x={OPAD.l + iw + 6} y={OPAD.t + ih} className="fill-fg-3 font-mono text-[9.5px]">
          {compact(data.max)}
        </text>
        {ticksX.map(({ r }, i) => (
          <text key={r.strike} x={X(r.strike)} y={height - 6} textAnchor={i === 0 ? "start" : i === ticksX.length - 1 ? "end" : "middle"} className="fill-fg-3 font-mono text-[9.5px]">
            {r.strikeLabel}
          </text>
        ))}
      </svg>
      <div className="pointer-events-none absolute left-2 top-0 flex items-center gap-1.5 text-[10px] text-fg-3">
        <span className="size-2 rounded-[2px] bg-up" /> {t("trader.opt.calls")}
      </div>
      <div className="pointer-events-none absolute bottom-6 left-2 flex items-center gap-1.5 text-[10px] text-fg-3">
        <span className="size-2 rounded-[2px] bg-down" /> {t("trader.opt.puts")}
      </div>
      {hs && (
        <ChartTip x={X(hs.r.strike)} w={w} top={16} width={176}>
          <div className="mb-0.5 text-fg">{strikeText(hs.r.strike, digits)}</div>
          <div className="mb-0.5 grid grid-cols-[1fr_auto_auto] gap-x-3 font-sans text-[9.5px] uppercase tracking-[0.05em] text-fg-3">
            <span />
            <span className="text-end">{t("trader.opt.an.oi.oiShort")}</span>
            <span className="text-end">{t("trader.opt.an.oi.volShort")}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 leading-[16px]">
            <span className="flex items-center gap-1 font-sans text-fg-3">
              <RightTag right="call" className="h-[13px] min-w-[13px] text-[8.5px]" /> {t("trader.opt.calls")}
            </span>
            <span className="text-end text-fg">{hs.r.callOi.toLocaleString("en-US")}</span>
            <span className="text-end text-fg-2">{hs.r.callVol.toLocaleString("en-US")}</span>
            <span className="flex items-center gap-1 font-sans text-fg-3">
              <RightTag right="put" className="h-[13px] min-w-[13px] text-[8.5px]" /> {t("trader.opt.puts")}
            </span>
            <span className="text-end text-fg">{hs.r.putOi.toLocaleString("en-US")}</span>
            <span className="text-end text-fg-2">{hs.r.putVol.toLocaleString("en-US")}</span>
          </div>
        </ChartTip>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Put / call split                                                    */
/* ------------------------------------------------------------------ */

/** One put/call ratio: the number, and calls vs puts as a split bar. */
export function PcrRow({ label, calls, puts, ratio }: { label: string; calls: number; puts: number; ratio: number | null }) {
  const t = useT();
  const total = calls + puts;
  const cShare = total > 0 ? calls / total : 0.5;
  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-fg-2">{label}</span>
        <span className="k-num font-mono text-[18px] font-semibold leading-none text-fg">{ratio === null ? "—" : ratio.toFixed(2)}</span>
      </div>
      <div className="mt-1.5 flex h-2 gap-[2px] overflow-hidden rounded-full" dir="ltr" aria-hidden>
        {total > 0 ? (
          <>
            <span className="h-full rounded-s-full bg-up/85" style={{ width: `${cShare * 100}%` }} />
            <span className="h-full flex-1 rounded-e-full bg-down/85" />
          </>
        ) : (
          <span className="h-full flex-1 rounded-full bg-surface-3" />
        )}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10.5px] text-fg-3" dir="ltr">
        <span>
          <span className="font-sans">{t("trader.opt.calls")}</span> <span className="text-fg-2">{calls.toLocaleString("en-US")}</span>
        </span>
        <span>
          <span className="font-sans">{t("trader.opt.puts")}</span> <span className="text-fg-2">{puts.toLocaleString("en-US")}</span>
        </span>
      </div>
    </div>
  );
}
