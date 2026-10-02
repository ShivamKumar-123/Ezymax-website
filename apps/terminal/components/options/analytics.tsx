"use client";

// The Analytics tab of the options workspace (the centre panel's fourth tab; on phones a view of the Chart tab).
// "Volatility & OI": the volatility smile of the expiry on screen, the term structure of ATM vol across the open
// expiries, open interest and volume by strike with max pain, and the put / call ratios — real data from the options
// service in live builds (./analytics-data), the demo pricer in demo builds. "What-if": the P&L of the trader's book
// on the underlying under a price / date / vol scenario (./analytics-whatif).
import * as React from "react";
import { BookOpenText, Info } from "lucide-react";
import { cn } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { maxPain, putCallRatio, skewOf } from "@/lib/options/math";
import { opt, underlyingOf, useOpt } from "@/lib/options-store";
import { Seg } from "./bits";
import { pct, strikeText } from "./format";
import { OiChart, PcrRow, SmileChart, TermChart, volPts } from "./analytics-charts";
import { oiOf, useSmile, useTermStructure } from "./analytics-data";
import { WhatIfPanel } from "./analytics-whatif";

type View = "market" | "whatif";
const VIEW_KEY = "kalks.options.analytics.view";

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "whatif" ? "whatif" : "market";
  } catch {
    return "market";
  }
}

function Card({ title, hint, right, children, className }: { title: React.ReactNode; hint?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-[8px] border border-line bg-panel-2/40", className)}>
      <header className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line/70 px-2.5 py-1">
        <h3 className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-fg-2">
          <span className="truncate">{title}</span>
          {hint && (
            <span title={hint} aria-label={hint} className="grid shrink-0 cursor-help place-items-center text-fg-3 hover:text-fg-2">
              <Info className="size-3" />
            </span>
          )}
        </h3>
        {right && <div className="ms-auto flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-0.5">{right}</div>}
      </header>
      <div className="relative min-w-0 flex-1 p-1.5">{children}</div>
    </section>
  );
}

function Stat({ label, title, children }: { label: string; title?: string; children: React.ReactNode }) {
  return (
    <span className="flex shrink-0 items-baseline gap-1 whitespace-nowrap" title={title}>
      <span className="text-[9.5px] font-medium uppercase tracking-[0.07em] text-fg-3">{label}</span>
      <span className="k-num font-mono text-[11.5px] text-fg">{children}</span>
    </span>
  );
}

const Placeholder = ({ height, text }: { height: number; text: string }) => (
  <div className="grid place-items-center text-[11.5px] text-fg-3" style={{ height }}>
    {text}
  </div>
);

function MarketView({ compact }: { compact?: boolean }) {
  const t = useT();
  const u = useOpt((s) => s.u);
  const expiry = useOpt((s) => s.expiry);
  const expiries = useOpt((s) => s.expiries);
  const under = useOpt((s) => underlyingOf(s));
  const chain = useOpt((s) => (s.chain && s.chain.underlying === s.u && s.chain.expiry === s.expiry ? s.chain : null));
  const smile = useSmile(chain);
  const term = useTermStructure(u, expiries);
  const oi = React.useMemo(() => oiOf(chain), [chain]);
  const [metric, setMetric] = React.useState<"oi" | "volume">("oi");
  const h = compact ? 190 : 214;

  if (!chain) return <Placeholder height={240} text={t("trader.opt.an.loading")} />;

  const atm = smile.data?.atmVol ?? null;
  const skew = smile.data ? skewOf(smile.data.pillars, atm) : { rr25: null, bf25: null };
  const surface = smile.data?.term ?? [];
  const rv = under?.realizedVol ?? null;
  const mp = oi.available ? maxPain(oi.rows) : null;
  const spot = chain.spot?.mid ?? null;

  return (
    <div className="@container t-scroll h-full overflow-y-auto">
      <div className="grid gap-2 p-2 @[720px]:grid-cols-5">
        <Card
          className="@[720px]:col-span-3"
          title={t("trader.opt.an.smile.title")}
          hint={t("trader.opt.an.smile.hint")}
          right={
            <>
              <Stat label={t("trader.opt.atmIv")} title={t("trader.opt.atmIvHint")}>
                {pct(atm, 2)}
              </Stat>
              {skew.rr25 !== null && (
                <Stat label={t("trader.opt.an.smile.rr")} title={t("trader.opt.an.smile.rrHint")}>
                  {volPts(skew.rr25)}
                </Stat>
              )}
              {skew.bf25 !== null && (
                <Stat label={t("trader.opt.an.smile.bf")} title={t("trader.opt.an.smile.bfHint")}>
                  {volPts(skew.bf25)}
                </Stat>
              )}
            </>
          }
        >
          {smile.loading && !smile.data ? <Placeholder height={h} text={t("trader.opt.an.loading")} /> : <SmileChart smile={smile.data} chain={chain} height={h} />}
        </Card>

        <Card
          className="@[720px]:col-span-2"
          title={t("trader.opt.an.term.title")}
          hint={t("trader.opt.an.term.hint")}
          right={
            rv !== null ? (
              <Stat label={t("trader.opt.rv")} title={t("trader.opt.rvHint")}>
                {pct(rv, 1)}
              </Stat>
            ) : undefined
          }
        >
          {term.loading && !term.points.length && surface.length < 2 ? <Placeholder height={h} text={t("trader.opt.an.loading")} /> : <TermChart points={term.points} surface={surface} rv={rv} selected={expiry} onPick={(d) => d !== expiry && opt.selectExpiry(d)} height={h} />}
        </Card>

        {oi.available ? (
          <>
            <Card
              className="@[720px]:col-span-3"
              title={t("trader.opt.an.oi.title")}
              hint={t("trader.opt.an.oi.hint")}
              right={
                <Seg<"oi" | "volume">
                  size="sm"
                  className="w-[176px]"
                  value={metric}
                  onChange={setMetric}
                  options={[
                    { value: "oi", label: t("trader.opt.an.oi.oi") },
                    { value: "volume", label: t("trader.opt.an.oi.volume") },
                  ]}
                />
              }
            >
              <OiChart rows={oi.rows} metric={metric} spot={spot} maxPain={mp} digits={chain.digits} height={h} />
            </Card>
            <Card className="@[720px]:col-span-2" title={t("trader.opt.an.pcr.title")} hint={t("trader.opt.an.pcr.hint")}>
              <div className="flex h-full flex-col px-1">
                <PcrRow label={t("trader.opt.an.pcr.oi")} calls={oi.calls.oi} puts={oi.puts.oi} ratio={putCallRatio(oi.puts.oi, oi.calls.oi)} />
                <div className="border-t border-line/60" />
                <PcrRow label={t("trader.opt.an.pcr.volume")} calls={oi.calls.volume} puts={oi.puts.volume} ratio={putCallRatio(oi.puts.volume, oi.calls.volume)} />
                <div className="mt-auto flex items-baseline justify-between gap-2 border-t border-line/60 pt-1.5 pb-0.5" title={t("trader.opt.an.oi.maxPainHint")}>
                  <span className="text-[11px] text-fg-2">{t("trader.opt.an.oi.maxPain")}</span>
                  <span className="k-num font-mono text-[12.5px] font-semibold text-gold">{mp === null ? "—" : strikeText(mp, chain.digits)}</span>
                </div>
              </div>
            </Card>
          </>
        ) : (
          <Card className="@[720px]:col-span-5" title={`${t("trader.opt.an.oi.title")} · ${t("trader.opt.an.pcr.title")}`}>
            <div className="flex items-start gap-3 px-1.5 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-info/30 bg-info-soft text-info">
                <BookOpenText className="size-4" />
              </span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium text-fg">{t("trader.opt.an.oi.none", { u })}</div>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-fg-3">{t("trader.opt.an.oi.noneSub")}</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/** The Analytics tab: "Volatility & OI" | "What-if". */
export function AnalyticsPane({ compact, onOpenChain }: { compact?: boolean; onOpenChain?: () => void }) {
  const t = useT();
  const [view, setViewState] = React.useState<View>("market");
  React.useEffect(() => setViewState(readView()), []);
  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* storage blocked */
    }
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("flex shrink-0 items-center gap-1.5 border-b border-line px-1.5", compact ? "h-10 bg-panel" : "h-8")}>
        <Seg<View>
          size={compact ? "md" : "sm"}
          className={compact ? "w-full" : "w-[220px] shrink-0"}
          value={view}
          onChange={setView}
          options={[
            { value: "market", label: t("trader.opt.an.market") },
            { value: "whatif", label: t("trader.opt.an.whatIf") },
          ]}
        />
        {!compact && <span className="ms-auto hidden min-w-0 truncate pe-1 text-[10.5px] text-fg-3 lg:block">{view === "market" ? t("trader.opt.an.marketHint") : t("trader.opt.an.whatIfHint")}</span>}
      </div>
      <div className="min-h-0 flex-1">{view === "market" ? <MarketView compact={compact} /> : <WhatIfPanel onOpenChain={onOpenChain ?? (() => opt.setCenter("chain"))} />}</div>
    </div>
  );
}
