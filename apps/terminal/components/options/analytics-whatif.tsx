"use client";

// What-if P&L of the trader's book on the underlying on screen: the open option positions, the CFD positions on the
// same symbol (linear, so a delta-hedged book reads flat) and the ticket's legs once Buy or Sell is chosen. Three
// sliders move the underlying (± a range sized by the vol to the last expiry), the date (now → the last cut) and
// every implied vol (± 10 vol points); the curve shows the P&L across prices today and at that date (at expiry for
// reference), with the P&L, delta, vega and theta at the scenario and a table at key prices. Computed in the browser
// with the demo pricer's maths (generalized BSM: GK / BS / Black-76 by the carry, the same business-time vol clock),
// each option at its own implied vol, against each entry price, before commissions and swaps. Barrier options are
// left out (their value isn't a vanilla's).
import * as React from "react";
import { Calculator, RotateCcw, Table2 } from "lucide-react";
import { INSTRUMENT_MAP, getInstrument, priceFeed } from "@ezymex/mock";
import { OPTION_SPEC, carryOf, cutInstant, pricingContext, volAtStrike } from "@ezymex/mock/options";
import { cn } from "@ezymex/ui";
import { useT } from "@ezymex/i18n/react";
import { useTerminal } from "@/lib/store";
import { fmtServer, quoteToUsd } from "@/lib/trading";
import { Check } from "@/components/ui/primitives";
import { useOptionBook } from "@/lib/options/book";
import { usdPerUnitOfQuote } from "@/lib/options/normalize";
import { fillOf, niceRangePct, usdPerUnitOf, whatIfClock, whatIfPnl, type WhatIfBook, type WhatIfLeg, type WhatIfLinear } from "@/lib/options/math";
import { useOpt } from "@/lib/options-store";
import type { OptionQuote } from "@/lib/options/types";
import { useNow } from "./bits";
import { countdown, px, usdSigned } from "./format";
import { ChartTip, LegendLine, TipRow, niceTicks, useBoxWidth } from "./analytics-charts";

/* ------------------------------------------------------------------ */
/* Inputs: the book on the underlying                                  */
/* ------------------------------------------------------------------ */

const DAY = 86_400_000;

/** The IV a position is valued at: the book's mark IV, else the quote's IV. */
const ivOfQuote = (q: OptionQuote | null | undefined): number | null => {
  const v = q ? (q.book ? (q.markIv ?? q.iv) : q.iv) : null;
  return v !== null && v !== undefined && v > 0 ? v : null;
};

interface Inputs {
  book: WhatIfBook;
  counts: { options: number; cfd: number; ticket: number; barriers: number };
  /** the ticket holds legs on this underlying without a side chosen yet */
  ticketUnarmed: boolean;
  sig: string;
  digits: number;
}

function useInputs(u: string, use: { options: boolean; cfd: boolean; ticket: boolean }): Inputs | null {
  const T = useTerminal();
  const login = T.guest ? null : T.account.login;
  const view = useOptionBook(login);
  const chain = useOpt((s) => (s.chain?.underlying === s.u ? s.chain : null));
  const index = useOpt((s) => s.index);
  const quotes = useOpt((s) => s.quotes);
  const ticket = useOpt((s) => s.ticket);
  const expiries = useOpt((s) => s.expiries);
  const spec = OPTION_SPEC[u];
  const feed = INSTRUMENT_MAP[u] ? priceFeed().snapshot(u) : undefined;
  const spot = chain?.spot?.mid ?? (feed && feed.bid > 0 ? (feed.bid + feed.ask) / 2 : 0);
  if (!(spot > 0)) return null;

  const digits = chain?.digits ?? spec?.digits ?? 5;
  const quoteCcy = spec?.quoteCcy ?? chain?.quoteCcy ?? "USD";
  const inverseUsd = spec?.baseCcy === "USD" && quoteCcy !== "USD";
  const chainK = usdPerUnitOf(chain);
  const contractSize = chain?.contractSize ?? spec?.contractSize ?? 1;
  const usdPerQuote = quoteCcy === "USD" ? 1 : inverseUsd ? 1 / spot : chainK > 0 ? chainK / contractSize : INSTRUMENT_MAP[u] ? quoteToUsd(u, spot) : 0;
  const mi = (chain as unknown as { modelInputs?: { r?: unknown; b?: unknown } } | null)?.modelInputs;
  const carry = spec ? carryOf(spec) : { r: 0.036, b: 0 };
  const r = typeof mi?.r === "number" && Number.isFinite(mi.r) ? mi.r : carry.r;
  const b = typeof mi?.b === "number" && Number.isFinite(mi.b) ? mi.b : carry.b;
  const now = Date.now();
  const modelVol = (k: number, cut: number) => (spec && cut > now ? volAtStrike(pricingContext(spec, spot, cut, now, usdPerQuote || 1), k) : (spec?.atm[1] ?? 0.1));
  const quote = (code: string) => index[code] ?? quotes[code] ?? null;
  const unitUsd = (q: OptionQuote | null, size?: number) => usdPerUnitOfQuote(q) || chainK || (size || contractSize) * usdPerQuote;

  const options: WhatIfLeg[] = [];
  const counts = { options: 0, cfd: 0, ticket: 0, barriers: 0 };
  for (const p of view.positions) {
    if (p.option.underlying !== u) continue;
    if (p.option.barrier) {
      counts.barriers++;
      continue;
    }
    counts.options++;
    if (!use.options) continue;
    const q = quote(p.option.series);
    const cut = Date.parse(p.option.expiryAt) || (/^\d{4}-\d{2}-\d{2}$/.test(p.option.expiry) ? cutInstant(p.option.expiry) : now);
    options.push({ right: p.option.right, strike: p.option.strike, side: p.side, contracts: p.contracts, premium: p.openPrice, iv: ivOfQuote(q) ?? modelVol(p.option.strike, cut), cutAtMs: cut, usdPerUnit: unitUsd(q, p.option.contractSize) });
  }

  const linear: WhatIfLinear[] = [];
  if (INSTRUMENT_MAP[u])
    for (const p of T.positions) {
      if (p.symbol !== u) continue;
      counts.cfd++;
      if (use.cfd) linear.push({ side: p.side, units: p.volume * getInstrument(u).contractSize, openPrice: p.openPrice });
    }

  const armed = ticket.armed || ticket.legs.length > 1;
  let ticketUnarmed = false;
  for (const l of ticket.legs) {
    if (l.u !== u) continue;
    if (!armed) {
      ticketUnarmed = true;
      continue;
    }
    const q = quote(l.series);
    const premium = q ? fillOf(q, l.side) : 0;
    if (!(premium > 0)) continue;
    counts.ticket++;
    if (!use.ticket) continue;
    const e = expiries.find((x) => x.date === l.expiry);
    const cut = (e && Date.parse(e.cutAt)) || (chain?.expiry === l.expiry ? Date.parse(chain.cutAt) : 0) || cutInstant(l.expiry);
    options.push({ right: l.right, strike: l.strike, side: l.side, contracts: l.contracts, premium, iv: ivOfQuote(q) ?? modelVol(l.strike, cut), cutAtMs: cut, usdPerUnit: unitUsd(q) });
  }

  const book: WhatIfBook = { spot, r, b, inverseUsd, usdPerQuote, options, linear };
  const sig = [
    spot.toFixed(digits + 1),
    r.toFixed(5),
    b.toFixed(5),
    usdPerQuote.toPrecision(6),
    ...options.map((o) => `${o.right}${o.strike}${o.side}${o.contracts}@${o.premium}~${o.iv.toFixed(4)}|${o.cutAtMs}|${o.usdPerUnit.toPrecision(6)}`),
    ...linear.map((l) => `${l.side}${l.units}@${l.openPrice}`),
  ].join(";");
  return { book, counts, ticketUnarmed, sig, digits };
}

/* ------------------------------------------------------------------ */
/* Slider                                                              */
/* ------------------------------------------------------------------ */

function Slider({ value, min, max, step, onChange, center, label, disabled, marks }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; center?: number; label: string; disabled?: boolean; marks?: { at: number; title: string }[] }) {
  const f = max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0;
  const c = center !== undefined && max > min ? (center - min) / (max - min) : 0;
  const a = Math.min(f, c) * 100;
  const b = Math.max(f, c) * 100;
  return (
    <div className="relative flex h-5 items-center" dir="ltr">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ background: `linear-gradient(to right, var(--k-surface-3) 0 ${a}%, var(--k-ember) ${a}% ${b}%, var(--k-surface-3) ${b}% 100%)` }}
        className={cn(
          "h-1 w-full cursor-pointer appearance-none rounded-full outline-none disabled:cursor-not-allowed disabled:opacity-40",
          "[&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-ember [&::-webkit-slider-thumb]:bg-panel [&::-webkit-slider-thumb]:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.6)]",
          "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-ember [&::-moz-range-thumb]:bg-panel",
          "focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-ember/25",
        )}
      />
      {marks?.map((m) => (
        <span key={m.at} title={m.title} className="pointer-events-none absolute top-[15px] h-1.5 w-px bg-fg-3" style={{ left: `calc(${m.at * 100}% + ${7 - m.at * 14}px)` }} />
      ))}
    </div>
  );
}

function Control({ label, readout, children, ends, className }: { className?: string; label: string; readout: React.ReactNode; children: React.ReactNode; ends?: [React.ReactNode, React.ReactNode] | [React.ReactNode, React.ReactNode, React.ReactNode] }) {
  return (
    <div className={className}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.05em] text-fg-3">{label}</span>
        <span className="k-num min-w-0 truncate text-end font-mono text-[11.5px] text-fg">{readout}</span>
      </div>
      {children}
      {ends && (
        <div className="mt-0.5 flex justify-between gap-2 font-mono text-[9.5px] text-fg-3" dir="ltr">
          <span className="shrink-0">{ends[0]}</span>
          {ends.length === 3 && <span className="min-w-0 truncate text-fg-2">{ends[2]}</span>}
          <span className="shrink-0">{ends[1]}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chart                                                               */
/* ------------------------------------------------------------------ */

interface Curves {
  xs: number[];
  today: number[];
  at: number[] | null;
  exp: number[] | null;
  lo: number;
  hi: number;
}

const PAD = { l: 8, r: 60, t: 32, b: 22 };

function WhatIfChart({ c, spot, scen, scenPnl, strikes, digits, atLabel, height = 250 }: { c: Curves; spot: number; scen: number; scenPnl: number; strikes: number[]; digits: number; atLabel: string; height?: number }) {
  const t = useT();
  const [box, w] = useBoxWidth(560);
  const [hover, setHover] = React.useState<number | null>(null);
  const id = `wi${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const main = c.at ?? c.today;
  const all = [...main, ...(c.at ? c.today : []), ...(c.exp ?? []), 0, scenPnl].filter(Number.isFinite);
  let ymin = Math.min(...all);
  let ymax = Math.max(...all);
  const pad = Math.max(1, (ymax - ymin) * 0.12);
  ymin -= pad;
  ymax += pad;
  const iw = w - PAD.l - PAD.r;
  const ih = height - PAD.t - PAD.b;
  const X = (v: number) => PAD.l + ((v - c.lo) / (c.hi - c.lo)) * iw;
  const Y = (v: number) => PAD.t + (1 - (v - ymin) / (ymax - ymin)) * ih;
  const y0 = Y(0);
  const line = (ys: number[]) => ys.map((y, i) => `${i ? "L" : "M"}${X(c.xs[i]!).toFixed(1)},${Y(y).toFixed(1)}`).join("");
  const area = `${line(main)}L${X(c.xs[c.xs.length - 1]!).toFixed(1)},${y0.toFixed(1)}L${X(c.xs[0]!).toFixed(1)},${y0.toFixed(1)}Z`;
  const ticksY = niceTicks(ymin, ymax, 4).filter((v) => v > ymin && v < ymax);
  const yDec = Math.max(...ticksY.map(Math.abs), 0) >= 100 ? 0 : 2;
  const ticksX = [c.lo, (c.lo + spot) / 2, spot, (spot + c.hi) / 2, c.hi];
  const hx = hover === null ? null : c.xs[hover]!;
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const v = c.lo + ((e.clientX - r.left - PAD.l) / iw) * (c.hi - c.lo);
    let best = 0;
    for (let i = 1; i < c.xs.length; i++) if (Math.abs(c.xs[i]! - v) < Math.abs(c.xs[best]! - v)) best = i;
    setHover(best);
  };
  const tone = (v: number) => (v > 0 ? "text-up" : v < 0 ? "text-down" : "text-fg-2");

  return (
    <div ref={box} className="relative select-none" dir="ltr">
      <svg width={w} height={height} className="block touch-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label={t("trader.opt.wi.aria")}>
        <defs>
          <clipPath id={`${id}-up`}>
            <rect x={0} y={0} width={w} height={Math.max(0, y0)} />
          </clipPath>
          <clipPath id={`${id}-dn`}>
            <rect x={0} y={y0} width={w} height={Math.max(0, height - y0)} />
          </clipPath>
        </defs>
        {ticksY.map((v) => (
          <line key={v} x1={PAD.l} x2={PAD.l + iw} y1={Y(v)} y2={Y(v)} stroke="var(--t-grid)" strokeWidth={1} />
        ))}
        <path d={area} fill="var(--k-up)" fillOpacity={0.13} clipPath={`url(#${id}-up)`} />
        <path d={area} fill="var(--k-down)" fillOpacity={0.13} clipPath={`url(#${id}-dn)`} />
        <line x1={PAD.l} x2={PAD.l + iw} y1={y0} y2={y0} stroke="var(--k-fg-3)" strokeOpacity={0.6} strokeDasharray="3 3" />
        {strikes
          .filter((k) => k > c.lo && k < c.hi)
          .map((k) => (
            <line key={k} x1={X(k)} x2={X(k)} y1={PAD.t + ih} y2={PAD.t + ih - 5} stroke="var(--k-fg-3)" strokeWidth={1.5} />
          ))}
        <line x1={X(spot)} x2={X(spot)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--k-ember)" strokeOpacity={0.7} />
        {c.exp && <path d={line(c.exp)} fill="none" stroke="var(--k-fg-3)" strokeWidth={1.5} strokeDasharray="1.5 3" strokeLinecap="round" />}
        {c.at && <path d={line(c.today)} fill="none" stroke="var(--k-fg-2)" strokeWidth={1.5} strokeDasharray="5 4" strokeLinejoin="round" />}
        <path d={line(main)} fill="none" stroke="var(--k-gold)" strokeWidth={2} strokeLinejoin="round" />
        {/* the scenario */}
        <line x1={X(scen)} x2={X(scen)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--k-fg-2)" strokeOpacity={0.7} strokeDasharray="1 2" />
        <circle cx={X(scen)} cy={Y(scenPnl)} r={4.5} fill="var(--k-gold)" stroke="var(--t-panel)" strokeWidth={2} />
        <text x={Math.min(Math.max(X(scen), PAD.l + 30), PAD.l + iw - 30)} y={PAD.t - 5} textAnchor="middle" className="fill-fg-2 font-mono text-[9.5px]">
          {px(scen, digits)}
        </text>
        {ticksY.map((v) => (
          <text key={v} x={PAD.l + iw + 6} y={Y(v) + 3} className="fill-fg-3 font-mono text-[9.5px]">
            {usdSigned(v, yDec)}
          </text>
        ))}
        {ticksX.map((v, i) => (
          <text key={i} x={X(v)} y={height - 6} textAnchor={i === 0 ? "start" : i === ticksX.length - 1 ? "end" : "middle"} className={cn("font-mono text-[9.5px]", i === 2 ? "fill-ember" : "fill-fg-3")}>
            {px(v, digits)}
          </text>
        ))}
        {hx !== null && hover !== null && (
          <g pointerEvents="none">
            <line x1={X(hx)} x2={X(hx)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--k-fg-3)" strokeDasharray="2 2" />
            <circle cx={X(hx)} cy={Y(main[hover]!)} r={4} fill="var(--k-gold)" stroke="var(--t-panel)" strokeWidth={2} />
            {c.at && <circle cx={X(hx)} cy={Y(c.today[hover]!)} r={3.5} fill="var(--k-fg-2)" stroke="var(--t-panel)" strokeWidth={2} />}
          </g>
        )}
      </svg>
      <div className="pointer-events-none absolute left-2 top-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-fg-3">
        <LegendLine kind="solid" label={atLabel} />
        {c.at && <LegendLine kind="dashed" label={t("trader.opt.payoff.today")} />}
        {c.exp && <LegendLine kind="dotted" label={t("trader.opt.payoff.atExpiry")} />}
      </div>
      {hx !== null && hover !== null && (
        <ChartTip x={X(hx)} w={w} top={22} width={170}>
          <div className="text-fg">
            {px(hx, digits)} <span className="text-fg-3">{`${hx >= spot ? "+" : "−"}${Math.abs((hx / spot - 1) * 100).toFixed(2)}%`}</span>
          </div>
          <TipRow k={atLabel} v={usdSigned(main[hover]!)} className={tone(main[hover]!)} />
          {c.at && <TipRow k={t("trader.opt.payoff.today")} v={usdSigned(c.today[hover]!)} className={tone(c.today[hover]!)} />}
          {c.exp && <TipRow k={t("trader.opt.payoff.atExpiry")} v={usdSigned(c.exp[hover]!)} className={tone(c.exp[hover]!)} />}
        </ChartTip>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

function Tile({ label, title, children, sub, className }: { label: string; title?: string; children: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div title={title} className={cn("min-w-0 rounded-[7px] border border-line bg-surface-2/40 px-2 py-1.5", className)}>
      <div className="truncate text-[9.5px] font-medium uppercase tracking-[0.06em] text-fg-3">{label}</div>
      <div className="k-num mt-0.5 truncate font-mono text-[13px] font-semibold">{children}</div>
      {sub && <div className="k-num truncate font-mono text-[10px] text-fg-3">{sub}</div>}
    </div>
  );
}

const signedTone = (v: number | null) => (v === null || !Number.isFinite(v) ? "text-fg-3" : v > 0.005 ? "text-up" : v < -0.005 ? "text-down" : "text-fg-2");

export function WhatIfPanel({ onOpenChain }: { onOpenChain?: () => void }) {
  const t = useT();
  const u = useOpt((s) => s.u);
  const [use, setUse] = React.useState({ options: true, cfd: true, ticket: true });
  const [pricePct, setPricePct] = React.useState(0);
  const [dayFrac, setDayFrac] = React.useState(0);
  const [ivPts, setIvPts] = React.useState(0);
  const reset = React.useCallback(() => {
    setPricePct(0);
    setDayFrac(0);
    setIvPts(0);
  }, []);
  React.useEffect(reset, [u, reset]);

  const inp = useInputs(u, use);
  const minute = Math.floor(useNow() / 60_000);
  const sig = inp?.sig ?? "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const book = React.useMemo(() => inp?.book ?? null, [sig]);

  const frame = React.useMemo(() => {
    if (!book) return null;
    const now = Date.now();
    const cuts = book.options.map((o) => o.cutAtMs);
    const lastCut = cuts.length ? Math.max(...cuts) : now;
    const horizon = Math.max(0, lastCut - now);
    const years = Math.max(1 / 365, horizon / (365 * DAY));
    const ivs = book.options.map((o) => o.iv).sort((a, b) => a - b);
    const vol = ivs.length ? ivs[Math.floor(ivs.length / 2)]! : (OPTION_SPEC[u]?.atm[3] ?? 0.1);
    const reach = Math.max(2.5 * vol * Math.sqrt(years), ...book.options.map((o) => Math.abs(o.strike / book.spot - 1) * 1.15), ...book.linear.map((l) => Math.abs(l.openPrice / book.spot - 1) * 1.1), 0.004);
    const range = niceRangePct(reach);
    const marks = [...new Set(cuts.filter((x) => x > now))].map((x) => ({ at: horizon > 0 ? (x - now) / horizon : 1, cut: x }));
    return { now, lastCut, horizon, range, marks, strikes: [...new Set(book.options.map((o) => o.strike))] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, minute, u]);

  const range = frame?.range ?? 1;
  const pp = Math.max(-range, Math.min(range, pricePct));
  const shift = ivPts / 100;
  const hasOptions = !!book?.options.length;
  const atMs = frame ? frame.now + dayFrac * frame.horizon : Date.now();

  const curves = React.useMemo(() => {
    if (!book || !frame) return null;
    const lo = book.spot * (1 - frame.range / 100);
    const hi = book.spot * (1 + frame.range / 100);
    const N = 160;
    const xs = Array.from({ length: N + 1 }, (_, i) => lo + ((hi - lo) * i) / N);
    for (const k of frame.strikes) if (k > lo && k < hi) xs.push(k);
    xs.sort((a, b) => a - b);
    const clkNow = whatIfClock(book, frame.now);
    const clkAt = whatIfClock(book, frame.now + dayFrac * frame.horizon);
    const clkEnd = whatIfClock(book, frame.lastCut);
    const today = xs.map((x) => whatIfPnl(book, x, clkNow, shift));
    const at = hasOptions && dayFrac > 0 ? xs.map((x) => whatIfPnl(book, x, clkAt, shift)) : null;
    const exp = hasOptions && dayFrac < 1 && frame.horizon > 0 ? xs.map((x) => whatIfPnl(book, x, clkEnd, 0)) : null;
    return { c: { xs, today, at, exp, lo, hi } as Curves, clkNow, clkAt, clkEnd };
  }, [book, frame, dayFrac, shift, hasOptions]);

  if (!inp || !book || !frame || !curves) return <div className="grid h-full place-items-center p-6 text-[12px] text-fg-3">{t("trader.opt.an.loading")}</div>;

  const { counts, digits } = inp;
  const nothing = counts.options + counts.cfd + counts.ticket === 0;
  const P = (s: number, clk: { tCal: number; tVol: number }[], sh = shift) => whatIfPnl(book, s, clk, sh);
  const scen = book.spot * (1 + pp / 100);
  const pAt = P(scen, curves.clkAt);
  const pToday = P(scen, curves.clkNow);
  const pNow = P(book.spot, curves.clkNow, 0);
  const pExp = P(scen, curves.clkEnd, 0);
  const delta = (P(scen * 1.005, curves.clkAt) - P(scen * 0.995, curves.clkAt)) / 1;
  const vega = hasOptions && atMs < frame.lastCut ? P(scen, curves.clkAt, shift + 0.005) - P(scen, curves.clkAt, shift - 0.005) : null;
  const theta = hasOptions && atMs < frame.lastCut ? P(scen, whatIfClock(book, Math.min(frame.lastCut, atMs + DAY))) - pAt : null;
  const atLabel = !hasOptions || dayFrac === 0 ? t("trader.opt.payoff.today") : dayFrac >= 1 ? t("trader.opt.payoff.atExpiry") : t("trader.opt.wi.atDate");
  const dateText = frame.horizon > 0 ? (dayFrac > 0 ? `+${countdown(atMs, frame.now)}` : t("trader.opt.wi.now")) : "—";

  // P&L at key prices: the range in quarters, plus the scenario
  const moves = [-range, -range / 2, -range / 4, 0, range / 4, range / 2, range];
  if (!moves.some((m) => Math.abs(m - pp) < 1e-9)) moves.push(pp);
  moves.sort((a, b) => a - b);
  const showAt = hasOptions && dayFrac > 0 && dayFrac < 1;
  const showExp = hasOptions && frame.horizon > 0;

  const anyIncluded = book.options.length + book.linear.length > 0;
  const noteBits: string[] = [];
  if (counts.barriers) noteBits.push(t("trader.opt.wi.barriers", { count: counts.barriers }));

  return (
    <div className="@container t-scroll h-full overflow-y-auto">
      {/* wide: the controls on the left, the results and the table on the right; narrow: results, controls, table */}
      <div className="grid gap-2 p-2 @[780px]:grid-cols-[minmax(240px,290px)_minmax(0,1fr)]">
        {/* controls */}
        <section className="order-2 flex flex-col gap-3 rounded-[8px] border border-line bg-panel-2/40 p-2.5 @[780px]:order-none @[780px]:row-span-2">
          <div className="order-1 flex items-center gap-2">
            <Calculator className="size-3.5 text-ember" />
            <h3 className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.07em] text-fg-2">
              {t("trader.opt.wi.title")} <span className="font-normal normal-case tracking-normal text-fg-3">· {u}</span>
            </h3>
            <button onClick={reset} disabled={pp === 0 && dayFrac === 0 && ivPts === 0} className="flex h-6 items-center gap-1 rounded-[5px] px-1.5 text-[11px] text-fg-3 hover:bg-surface-3 hover:text-fg disabled:opacity-40">
              <RotateCcw className="size-3" /> {t("trader.opt.wi.reset")}
            </button>
          </div>
          {/* phones: the sliders first, right under the chart */}
          <div className="order-5 @[780px]:order-2">
            <div className="mb-1 text-[10.5px] font-medium uppercase tracking-[0.05em] text-fg-3">{t("trader.opt.wi.include")}</div>
            <div className="grid gap-1.5">
              <Check checked={use.options && counts.options > 0} onChange={(v) => setUse((x) => ({ ...x, options: v }))} label={<IncLabel text={t("trader.opt.wi.positions")} n={counts.options} />} className={cn(!counts.options && "pointer-events-none opacity-45")} />
              <Check checked={use.cfd && counts.cfd > 0} onChange={(v) => setUse((x) => ({ ...x, cfd: v }))} label={<IncLabel text={t("trader.opt.wi.cfd")} n={counts.cfd} />} className={cn(!counts.cfd && "pointer-events-none opacity-45")} />
              <Check checked={use.ticket && counts.ticket > 0} onChange={(v) => setUse((x) => ({ ...x, ticket: v }))} label={<IncLabel text={t("trader.opt.wi.ticket")} n={counts.ticket} />} className={cn(!counts.ticket && "pointer-events-none opacity-45")} />
              {inp.ticketUnarmed && <p className="ps-[22px] text-[10.5px] leading-snug text-fg-3">{t("trader.opt.wi.ticketHint")}</p>}
            </div>
          </div>
          <Control className="order-3" label={t("trader.opt.wi.price")} readout={<>{px(scen, digits)} <span className={cn("text-[10.5px]", pp > 0 ? "text-up" : pp < 0 ? "text-down" : "text-fg-3")}>{`${pp > 0 ? "+" : pp < 0 ? "−" : "±"}${Math.abs(pp).toFixed(2)}%`}</span></>} ends={[`−${range}%`, `+${range}%`]}>
            <Slider label={t("trader.opt.wi.price")} value={pp} min={-range} max={range} step={range / 200} center={0} onChange={setPricePct} />
          </Control>
          <Control className="order-3" label={t("trader.opt.wi.days")} readout={dateText} ends={frame.horizon > 0 ? [t("trader.opt.wi.now"), `+${countdown(frame.lastCut, frame.now)}`, fmtServer(atMs, false)] : undefined}>
            <Slider
              label={t("trader.opt.wi.days")}
              value={dayFrac}
              min={0}
              max={1}
              step={0.001}
              onChange={setDayFrac}
              disabled={!hasOptions || frame.horizon <= 0}
              marks={frame.marks.filter((m) => m.at < 0.999).map((m) => ({ at: m.at, title: fmtServer(m.cut, false) }))}
            />
          </Control>
          <Control className="order-3" label={t("trader.opt.wi.iv")} readout={<span className={ivPts > 0 ? "text-up" : ivPts < 0 ? "text-down" : undefined}>{t("trader.opt.wi.volPts", { n: `${ivPts > 0 ? "+" : ivPts < 0 ? "−" : "±"}${Math.abs(ivPts).toFixed(1)}` })}</span>} ends={["−10", "+10"]}>
            <Slider label={t("trader.opt.wi.iv")} value={ivPts} min={-10} max={10} step={0.5} center={0} onChange={setIvPts} disabled={!hasOptions} />
          </Control>
          <p className="order-6 text-[10.5px] leading-relaxed text-fg-3">
            {t("trader.opt.wi.note")}
            {noteBits.length > 0 && <span className="mt-1 block text-warn">{noteBits.join(" · ")}</span>}
          </p>
        </section>

        {/* results */}
        <div className="order-1 min-w-0 space-y-2 @[780px]:order-none">
          {nothing || !anyIncluded ? (
            <div className="grid min-h-[260px] place-items-center rounded-[8px] border border-line bg-panel-2/40 p-6 text-center">
              <div className="max-w-[380px]">
                <div className="mx-auto mb-2 grid size-9 place-items-center rounded-full border border-line text-fg-3">
                  <Calculator className="size-4" />
                </div>
                <div className="text-[12.5px] font-medium text-fg-2">{nothing ? t("trader.opt.wi.empty", { u }) : t("trader.opt.wi.noneIncluded")}</div>
                {nothing && <p className="mt-1 text-[11.5px] leading-relaxed text-fg-3">{t("trader.opt.wi.emptySub")}</p>}
                {nothing && onOpenChain && (
                  <button onClick={onOpenChain} className="mt-3 inline-flex h-7 items-center gap-1.5 rounded-[7px] bg-ember px-3 text-[12px] font-semibold text-white hover:brightness-110">
                    <Table2 className="size-3.5" /> {t("trader.opt.chainTitle")}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-6 gap-1.5 @[560px]:grid-cols-5">
                <Tile label={atLabel} title={t("trader.opt.wi.pnlHint")} sub={`${usdSigned(pAt - pNow)} ${t("trader.opt.wi.vsNow")}`} className="col-span-3 @[560px]:col-span-1">
                  <span className={signedTone(pAt)}>{usdSigned(pAt)}</span>
                </Tile>
                {showAt || dayFrac >= 1 ? (
                  <Tile label={t("trader.opt.payoff.today")} title={t("trader.opt.wi.todayHint")} className="col-span-3 @[560px]:col-span-1">
                    <span className={signedTone(pToday)}>{usdSigned(pToday)}</span>
                  </Tile>
                ) : showExp ? (
                  <Tile label={t("trader.opt.payoff.atExpiry")} className="col-span-3 @[560px]:col-span-1">
                    <span className={signedTone(pExp)}>{usdSigned(pExp)}</span>
                  </Tile>
                ) : (
                  <Tile label={t("trader.opt.wi.now")} title={t("trader.opt.wi.nowHint")} className="col-span-3 @[560px]:col-span-1">
                    <span className={signedTone(pNow)}>{usdSigned(pNow)}</span>
                  </Tile>
                )}
                <Tile className="col-span-2 @[560px]:col-span-1" label={t("trader.opt.wi.delta")} title={t("trader.opt.wi.deltaHint")} sub={t("trader.opt.wi.perPct")}>
                  <span className={signedTone(delta)}>{usdSigned(delta)}</span>
                </Tile>
                <Tile className="col-span-2 @[560px]:col-span-1" label={t("trader.opt.wi.vega")} title={t("trader.opt.wi.vegaHint")} sub={t("trader.opt.wi.perVol")}>
                  <span className={signedTone(vega)}>{vega === null ? "—" : usdSigned(vega)}</span>
                </Tile>
                <Tile className="col-span-2 @[560px]:col-span-1" label={t("trader.opt.wi.theta")} title={t("trader.opt.wi.thetaHint")} sub={t("trader.opt.wi.perDay")}>
                  <span className={signedTone(theta)}>{theta === null ? "—" : usdSigned(theta)}</span>
                </Tile>
              </div>
              <div className="rounded-[8px] border border-line bg-panel-2/40 p-1.5">
                <WhatIfChart c={curves.c} spot={book.spot} scen={scen} scenPnl={pAt} strikes={frame.strikes} digits={digits} atLabel={atLabel} />
              </div>
            </>
          )}
        </div>
        {!nothing && anyIncluded && (
              <div className="order-3 min-w-0 self-start overflow-hidden rounded-[8px] border border-line @[780px]:order-none @[780px]:col-start-2">
                <div className="border-b border-line bg-panel-2 px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-fg-3">{t("trader.opt.wi.table")}</div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[360px] text-[11.5px]" dir="ltr">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-[0.05em] text-fg-3">
                        <th className="h-7 px-2.5 text-start font-medium">{t("trader.opt.wi.move")}</th>
                        <th className="px-2.5 text-end font-medium">{t("trader.opt.wi.priceCol")}</th>
                        <th className="px-2.5 text-end font-medium">{hasOptions ? t("trader.opt.payoff.today") : t("trader.opt.wi.pnl")}</th>
                        {showAt && <th className="px-2.5 text-end font-medium">{t("trader.opt.wi.atDate")}</th>}
                        {showExp && <th className="px-2.5 text-end font-medium">{t("trader.opt.payoff.atExpiry")}</th>}
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {moves.map((m) => {
                        const s = book.spot * (1 + m / 100);
                        const isScen = Math.abs(m - pp) < 1e-9;
                        const vT = P(s, curves.clkNow);
                        const vA = showAt ? P(s, curves.clkAt) : null;
                        const vE = showExp ? P(s, curves.clkEnd, 0) : null;
                        return (
                          <tr key={m} className={cn("border-t border-line/60", isScen ? "bg-ember-soft/50" : m === 0 && "bg-surface-2/50")}>
                            <td className="h-[26px] px-2.5 text-start">
                              <span className={cn(m > 0 ? "text-up" : m < 0 ? "text-down" : "text-fg-2")}>{m === 0 ? t("trader.opt.an.smile.spot") : `${m > 0 ? "+" : "−"}${Math.abs(m).toFixed(m % 1 ? 2 : 0)}%`}</span>
                              {isScen && m !== 0 && <span className="ms-1.5 font-sans text-[9.5px] font-semibold uppercase tracking-[0.05em] text-ember">{t("trader.opt.wi.scenario")}</span>}
                            </td>
                            <td className="px-2.5 text-end text-fg-2">{px(s, digits)}</td>
                            <td className={cn("px-2.5 text-end", signedTone(vT))}>{usdSigned(vT)}</td>
                            {showAt && <td className={cn("px-2.5 text-end", signedTone(vA))}>{usdSigned(vA!)}</td>}
                            {showExp && <td className={cn("px-2.5 text-end", signedTone(vE))}>{usdSigned(vE!)}</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
        )}
      </div>
    </div>
  );
}

function IncLabel({ text, n }: { text: string; n: number }) {
  return (
    <span className="flex items-center gap-1.5">
      {text}
      <span className="k-num rounded-[4px] bg-surface-3 px-1 font-mono text-[10px] text-fg-3">{n}</span>
    </span>
  );
}
