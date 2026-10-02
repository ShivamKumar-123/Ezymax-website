"use client";

// "What happens" card of the ticket, the guided flow and the strategy builder: what you pay or receive, where you
// make money at expiry and when that is, the most you can lose and make, a small payoff picture, and, when selling,
// a clear warning that the risk isn't limited to the premium and margin is held. Numbers come from the engine's
// preview when there is one (commission included like the engine), else from the legs' fill prices.
import * as React from "react";
import { CalendarClock, CircleCheck, ShieldAlert, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { useTerminal } from "@/lib/store";
import { accMoney } from "@/lib/trading";
import { payoffAt, type PayLeg } from "@/lib/options/math";
import { plainNumbers, shapeOf, type PlainNumbers } from "@/lib/options/plain";
import type { OptionChain, Preview } from "@/lib/options/types";
import { useNow } from "./bits";
import { Explain } from "./explain";
import { countdown, cutWhen, iso, money, px, strikeLabelOf } from "./format";

/** Commission estimate before the engine answers: per contract, capped at a % of the premium (the chain's terms; on
 *  the order book the taker fee). USD. */
export function commissionOf(chain: Pick<OptionChain, "commission" | "book"> | null | undefined, legs: PayLeg[], usdU: number, book: boolean): number {
  if (!chain) return 0;
  let c = 0;
  for (const l of legs) {
    const prem = l.premium * usdU * l.contracts;
    if (book) {
      const fee = Math.abs(chain.book?.takerFeePerContract ?? 0);
      const cap = chain.book?.feeCapPct;
      c += cap !== undefined ? Math.min(fee * l.contracts, (cap / 100) * prem) : fee * l.contracts;
    } else c += Math.min(chain.commission.perContract * l.contracts, (chain.commission.capPct / 100) * prem);
  }
  return c;
}

/* ------------------------------------------------------------------ */
/* Mini payoff                                                         */
/* ------------------------------------------------------------------ */

/** A small picture of the P&L at expiry across prices: green above zero, red below, today's price as a dot. */
export function MiniPayoff({ legs, usdPerUnit, spot, breakevens, height = 56, className }: { legs: PayLeg[]; usdPerUnit: number; spot: number; breakevens: number[]; height?: number; className?: string }) {
  const t = useT();
  const id = `mp${React.useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const W = 160;
  const data = React.useMemo(() => {
    if (!legs.length || !(spot > 0) || !(usdPerUnit > 0)) return null;
    const ks = [...legs.map((l) => l.strike), ...breakevens];
    const span = Math.max(...ks.map((k) => Math.abs(k - spot) * 1.6), spot * 0.006);
    const lo = Math.max(spot * 0.2, spot - span);
    const hi = spot + span;
    const xs = Array.from({ length: 49 }, (_, i) => lo + ((hi - lo) * i) / 48);
    for (const k of ks) if (k > lo && k < hi) xs.push(k);
    xs.sort((a, b) => a - b);
    const ys = xs.map((x) => payoffAt(legs, x, usdPerUnit));
    let ymin = Math.min(0, ...ys);
    let ymax = Math.max(0, ...ys);
    const pad = Math.max(1e-9, (ymax - ymin) * 0.14);
    ymin -= pad;
    ymax += pad;
    return { xs, ys, lo, hi, ymin, ymax };
  }, [legs, usdPerUnit, spot, breakevens]);
  if (!data) return <div className={className} style={{ height }} />;
  const X = (v: number) => ((v - data.lo) / (data.hi - data.lo)) * W;
  const Y = (v: number) => (1 - (v - data.ymin) / (data.ymax - data.ymin)) * height;
  const y0 = Y(0);
  const line = data.ys.map((y, i) => `${i ? "L" : "M"}${X(data.xs[i]!).toFixed(1)},${Y(y).toFixed(1)}`).join("");
  const area = `${line}L${W},${y0.toFixed(1)}L0,${y0.toFixed(1)}Z`;
  const spotY = Y(payoffAt(legs, spot, usdPerUnit));
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className={cn("block w-full overflow-visible", className)} style={{ height }} role="img" aria-label={t("trader.opt.payoff.aria")}>
      <defs>
        <clipPath id={`${id}u`}>
          <rect x={0} y={0} width={W} height={Math.max(0, y0)} />
        </clipPath>
        <clipPath id={`${id}d`}>
          <rect x={0} y={y0} width={W} height={Math.max(0, height - y0)} />
        </clipPath>
      </defs>
      <path d={area} fill="var(--k-up)" fillOpacity={0.18} clipPath={`url(#${id}u)`} />
      <path d={area} fill="var(--k-down)" fillOpacity={0.16} clipPath={`url(#${id}d)`} />
      <line x1={0} x2={W} y1={y0} y2={y0} stroke="var(--k-fg-3)" strokeOpacity={0.5} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      <path d={line} fill="none" stroke="var(--k-up)" strokeWidth={1.75} clipPath={`url(#${id}u)`} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <path d={line} fill="none" stroke="var(--k-down)" strokeWidth={1.75} clipPath={`url(#${id}d)`} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <line x1={X(spot)} x2={X(spot)} y1={0} y2={height} stroke="var(--k-ember)" strokeOpacity={0.55} strokeDasharray="1.5 2.5" vectorEffect="non-scaling-stroke" />
      <circle cx={X(spot)} cy={spotY} r={3} fill="var(--k-ember)" stroke="var(--t-panel)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Sentences                                                           */
/* ------------------------------------------------------------------ */

/** The plain sentences of a set of legs (win / lose / gain), shared by the outcome card and the position cards. */
export function usePlainLines(args: { u: string; legs: PayLeg[]; n: PlainNumbers; digits: number }) {
  const t = useT();
  const { u, legs, n, digits } = args;
  const p = (v: number) => px(v, digits);
  const shape = shapeOf(legs);
  const z = n.zone;
  const be = n.breakevens[0];
  // what a seller keeps: the premium received less the commission (the card's "You receive")
  const received = money(Math.max(0, Math.abs(n.net) - n.commission));
  let win: string;
  if (shape === "short_call" && be !== undefined) win = t("trader.opt.plain.keep.call", iso({ amount: received, u, strike: strikeLabelOf(u, legs[0]!.strike) }));
  else if (shape === "short_put" && be !== undefined) win = t("trader.opt.plain.keep.put", iso({ amount: received, u, strike: strikeLabelOf(u, legs[0]!.strike) }));
  else if (z.kind === "above") win = t("trader.opt.plain.win.above", iso({ u, price: p(z.at) }));
  else if (z.kind === "below") win = t("trader.opt.plain.win.below", iso({ u, price: p(z.at) }));
  else if (z.kind === "between") win = t("trader.opt.plain.win.between", iso({ u, lo: p(z.lo), hi: p(z.hi) }));
  else if (z.kind === "outside") win = t("trader.opt.plain.win.outside", iso({ u, lo: p(z.lo), hi: p(z.hi) }));
  else if (z.kind === "always") win = t("trader.opt.plain.win.always");
  else if (z.kind === "never") win = t("trader.opt.plain.win.never");
  else win = t("trader.opt.plain.win.list", iso({ list: z.at.map(p).join(" · ") }));

  let lose: string;
  if (shape === "short_call" && be !== undefined) lose = t("trader.opt.plain.lose.shortCall", iso({ price: p(be), u }));
  else if (shape === "short_put" && be !== undefined && n.maxLoss !== null) lose = t("trader.opt.plain.lose.shortPut", iso({ price: p(be), amount: money(n.maxLoss) }));
  else if (n.maxLoss === null) lose = t("trader.opt.plain.lose.noLimit", iso({ u }));
  else if ((shape === "long_call" || shape === "long_put") && n.net > 0) lose = t("trader.opt.plain.lose.paid", iso({ amount: money(n.maxLoss) }));
  else lose = t("trader.opt.plain.lose.max", iso({ amount: money(Math.max(0, n.maxLoss)) }));

  const gain = n.maxProfit === null ? t("trader.opt.plain.gain.noLimit", iso({ u })) : t("trader.opt.plain.gain.max", iso({ amount: money(Math.max(0, n.maxProfit)) }));
  return { win, lose, gain, shape, received };
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export interface OutcomeProps {
  u: string;
  /** legs with their fill premium per unit (quote currency) */
  legs: PayLeg[];
  usdPerUnit: number;
  digits: number;
  cutAt: string | null | undefined;
  spot: number | undefined;
  /** the engine's (or the estimate's) preview: its numbers win over the legs' */
  preview?: Preview | null;
  /** commission when there is no preview (USD) */
  commission?: number;
  /** extra margin the order holds, USD (sellers) */
  margin?: number | null;
  loading?: boolean;
  className?: string;
  /** hide the payoff picture (narrow places) */
  noPicture?: boolean;
}

export function OutcomeCard({ u, legs, usdPerUnit, digits, cutAt, spot, preview, commission = 0, margin, loading, className, noPicture }: OutcomeProps) {
  const t = useT();
  const { locale } = useLocale();
  const T = useTerminal();
  const now = useNow();
  const ref = spot ?? legs[0]?.strike ?? 1;
  const n = React.useMemo(() => plainNumbers(legs, usdPerUnit, ref, preview ? { netPremium: preview.netPremium, commission: preview.commission, maxLoss: preview.maxLoss, maxProfit: preview.maxProfit, breakevens: preview.breakevens } : null, commission), [legs, usdPerUnit, ref, preview, commission]);
  const lines = usePlainLines({ u, legs, n, digits });
  if (!legs.length || !(usdPerUnit > 0)) return null;
  const debit = n.net >= 0;
  const total = Math.abs(n.net) + (debit ? n.commission : -n.commission);
  const cut = cutAt ? Date.parse(cutAt) : NaN;
  const sellMargin = margin !== null && margin !== undefined && margin > 0.005 ? margin : null;
  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn("overflow-hidden rounded-[12px] border border-line bg-surface-2/50 transition-opacity", loading && "opacity-75")}>
        <div className="flex items-stretch gap-2 px-3 pt-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[11px] font-medium text-fg-3">
              {debit ? t("trader.opt.preview.youPay") : t("trader.opt.preview.youReceive")}
              <Explain topic="premium" size={12} />
            </div>
            <div className={cn("k-num font-mono text-[22px] font-semibold leading-tight tracking-tight", debit ? "text-fg" : "text-up")}>{money(Math.max(0, total))}</div>
            <div className="mt-0.5 truncate text-[10.5px] text-fg-3">
              {n.commission > 0 ? t("trader.opt.plain.inclFee", iso({ amount: money(n.commission) })) : " "}
              {T.account.cent && !T.guest && <span className="ms-1">· {t("trader.opt.plain.inUsc", iso({ amount: accMoney(T.account, Math.max(0, total)) }))}</span>}
            </div>
          </div>
          {!noPicture && spot !== undefined && (
            <div className="w-[44%] max-w-[170px] shrink-0 self-center py-1">
              <MiniPayoff legs={legs} usdPerUnit={usdPerUnit} spot={spot} breakevens={n.breakevens} height={52} />
            </div>
          )}
        </div>
        <ul className="mt-2 space-y-1.5 border-t border-line/70 px-3 py-2.5 text-[12.5px] leading-snug" dir="auto">
          <li className="flex items-start gap-2 text-fg">
            <CircleCheck className="mt-[2px] size-3.5 shrink-0 text-up" />
            <span>{lines.win}</span>
          </li>
          <li className="flex items-start gap-2 text-fg-2">
            <TrendingDown className="mt-[2px] size-3.5 shrink-0 text-down" />
            <span>{lines.lose}</span>
          </li>
          {lines.shape !== "short_call" && lines.shape !== "short_put" && (
            <li className="flex items-start gap-2 text-fg-2">
              <TrendingUp className="mt-[2px] size-3.5 shrink-0 text-up" />
              <span>{lines.gain}</span>
            </li>
          )}
        </ul>
        <div className="grid grid-cols-3 border-t border-line/70 text-center">
          <Fig label={t("trader.opt.col.be")} help={<Explain topic="breakeven" size={11} />} value={n.breakevens.length ? n.breakevens.map((b) => px(b, digits)).join(" · ") : "—"} />
          <Fig label={t("trader.opt.preview.maxLoss")} value={n.maxLoss === null ? t("trader.opt.unlimited") : money(Math.max(0, n.maxLoss))} tone="down" />
          <Fig label={t("trader.opt.preview.maxProfit")} value={n.maxProfit === null ? t("trader.opt.unlimited") : money(Math.max(0, n.maxProfit))} tone="up" />
        </div>
        {Number.isFinite(cut) && (
          <div className="flex items-start gap-2 border-t border-line/70 bg-panel/40 px-3 py-2 text-[11.5px] leading-snug text-fg-2" dir="auto">
            <CalendarClock className="mt-[1px] size-3.5 shrink-0 text-fg-3" />
            <span className="min-w-0">
              <span className="font-medium text-fg">{t("trader.opt.plain.expires", iso({ when: cutWhen(cut, locale) }))}</span>
              {cut > now && <span className="text-fg-3"> · {t("trader.opt.plain.in", iso({ left: countdown(cut, now) }))}</span>}
              <span className="block text-fg-3">{t("trader.opt.plain.auto")}</span>
            </span>
          </div>
        )}
      </div>
      {n.selling && (
        <div role="note" className="flex items-start gap-2 rounded-[10px] border border-warn/35 bg-warn-soft px-3 py-2 text-[12px] leading-snug" dir="auto">
          <ShieldAlert className="mt-[1px] size-4 shrink-0 text-warn" />
          <div className="min-w-0">
            <div className="flex items-center gap-1 font-semibold text-fg">
              {t("trader.opt.plain.sell.title")} <Explain topic="selling" size={12} />
            </div>
            <p className="mt-0.5 text-fg-2">{t("trader.opt.plain.sell.text", iso({ amount: lines.received, u }))}</p>
            {sellMargin !== null && (
              <p className="mt-1 flex items-center gap-1 text-fg-2">
                <TriangleAlert className="size-3 shrink-0 text-warn" />
                {t("trader.opt.plain.sell.margin", iso({ amount: money(sellMargin) }))}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Fig({ label, value, tone, help }: { label: React.ReactNode; value: string; tone?: "up" | "down"; help?: React.ReactNode }) {
  return (
    <div className="min-w-0 border-e border-line/70 px-1.5 py-1.5 last:border-e-0">
      <div className="flex min-w-0 items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-[0.05em] text-fg-3">
        <span className="truncate">{label}</span>
        {help}
      </div>
      <div className={cn("k-num truncate font-mono text-[12px] font-semibold", tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-fg")}>{value}</div>
    </div>
  );
}

/** Skeleton of the card while the first numbers load. */
export function OutcomeSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2 rounded-[12px] border border-line bg-surface-2/40 p-3", className)} aria-busy>
      <div className="h-3 w-16 animate-pulse rounded bg-surface-3" />
      <div className="h-6 w-28 animate-pulse rounded bg-surface-3" />
      <div className="h-3 w-full animate-pulse rounded bg-surface-3/70" />
      <div className="h-3 w-4/5 animate-pulse rounded bg-surface-3/70" />
    </div>
  );
}
