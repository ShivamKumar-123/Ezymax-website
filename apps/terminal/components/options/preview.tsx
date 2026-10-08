"use client";

// Live order preview: the engine's answer (premium, commission, margin before → after, cash after, max profit /
// loss, breakevens, Greeks) for the legs in the ticket or the builder, re-asked 350 ms after any change and every
// few seconds while prices move. The browser's own estimate stands in for guests, demo builds and live builds
// whose engine doesn't take option orders yet.
import * as React from "react";
import { ChevronRight, Info } from "lucide-react";
import { IS_LIVE } from "@ezymex/mock";
import { cn } from "@ezymex/ui";
import { useT } from "@ezymex/i18n/react";
import { useMetrics, useTerminal } from "@/lib/store";
import { accMoney } from "@/lib/trading";
import type { EngineErr } from "@/lib/engine/map";
import { optionsApi } from "@/lib/options/api";
import { useOptionBook } from "@/lib/options/book";
import { estimatePreview, type EstimateLeg } from "@/lib/options/math";
import { getOpt, opt, quoteOf, useOpt } from "@/lib/options-store";
import { reasonCode, reasonText } from "@/lib/options/errors";
import type { BarrierSpec, LegInput, OptionChain, OptionRight, Preview, Side } from "@/lib/options/types";
import { ErrorNote } from "./bits";
import { greek, pips, px, usd, usdSigned } from "./format";
import { isMarketOpen } from "@ezymex/mock";

export interface PreviewLegSpec {
  series: string;
  u: string;
  right: OptionRight;
  strike: number;
  side: Side;
  contracts: number;
  barrier?: BarrierSpec;
}

export interface PreviewState {
  preview: Preview | null;
  loading: boolean;
  error: EngineErr | null;
}

/** Debounced live preview of a set of legs (all on one underlying and expiry). */
export function usePreview(legs: PreviewLegSpec[], type: "market" | "limit", limitPremium: number | undefined, enabled = true): PreviewState {
  const T = useTerminal();
  const m = useMetrics();
  const login = T.account.login;
  const guest = T.guest;
  const book = useOptionBook(guest ? null : login);
  const [state, setState] = React.useState<PreviewState>({ preview: null, loading: false, error: null });
  const req = React.useMemo(
    () => ({ legs: legs.map((l): LegInput => ({ series: l.series, side: l.side, contracts: l.contracts, ...(l.barrier ? { barrier: l.barrier } : {}) })), type, limitPremium: type === "limit" ? limitPremium : undefined }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(legs), type, limitPremium],
  );
  const metrics = React.useRef(m);
  metrics.current = m;
  const bookRef = React.useRef(book);
  bookRef.current = book;
  const legsRef = React.useRef(legs);
  legsRef.current = legs;

  React.useEffect(() => {
    if (!enabled || !req.legs.length) {
      setState({ preview: null, loading: false, error: null });
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const local = (): Preview => {
      const s = getOpt();
      const ls = legsRef.current;
      const u = ls[0]!.u;
      const chain = (s.chain && s.chain.underlying === u ? s.chain : null) as OptionChain | null;
      const mm = metrics.current;
      const existing = bookRef.current.positions
        .filter((p) => p.option.underlying === u)
        .map((p) => ({ right: p.option.right, strike: p.option.strike, qty: (p.side === "buy" ? 1 : -1) * p.contracts, iv: quoteOf(p.option.series)?.iv ?? 0.1 }));
      const est: EstimateLeg[] = ls.map((l) => ({ series: l.series, right: l.right, strike: l.strike, side: l.side, contracts: l.contracts, quote: quoteOf(l.series) }));
      const fallbackChain = { rows: chain?.rows ?? [], contractSize: chain?.contractSize ?? 0, quoteCcy: chain?.quoteCcy ?? "USD", commission: chain?.commission ?? { perContract: 0.25, capPct: 10 }, spot: chain?.spot ?? null, cutAt: chain?.cutAt ?? new Date(Date.now() + 86_400_000).toISOString(), state: chain?.state ?? "open" };
      // usdPerUnit is read off the chain; a leg of another chain carries its own quote
      if (!fallbackChain.rows.length) {
        const q = est.find((e) => e.quote)?.quote;
        if (q) fallbackChain.rows = [{ strike: 0, strikeLabel: "", call: q, put: null }];
      }
      return estimatePreview({
        underlying: u,
        legs: est,
        type: req.type,
        limitPremium: req.limitPremium,
        chain: fallbackChain,
        account: { cash: mm.balance, margin: mm.margin, free: mm.free },
        existing,
        marketOpen: isMarketOpenSafe(u),
      });
    };
    const run = async () => {
      setState((p) => ({ ...p, loading: true }));
      const r = guest ? { ok: true as const, data: local() } : await optionsApi.preview(login, req, local);
      if (!alive) return;
      if (r.ok) {
        if (IS_LIVE && !guest) opt.setTradingSoon(!!r.data.estimate);
        setState({ preview: r.data, loading: false, error: null });
      } else setState({ preview: null, loading: false, error: r.err });
      // prices move: ask again every few seconds while the page is visible
      timer = setTimeout(() => void run(), document.visibilityState === "visible" ? 2500 : 10_000);
    };
    timer = setTimeout(() => void run(), 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [req, enabled, guest, login]);
  return state;
}

function isMarketOpenSafe(u: string) {
  try {
    return isMarketOpen(u);
  } catch {
    return true;
  }
}

function Line({ k, v, tone, sub, strong }: { k: React.ReactNode; v: React.ReactNode; tone?: "up" | "down" | "warn"; sub?: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-[3px]">
      <span className="font-sans text-fg-3">{k}</span>
      <span className={cn("k-num min-w-0 text-end", strong ? "font-semibold text-fg" : "text-fg-2", tone === "up" && "text-up", tone === "down" && "text-down", tone === "warn" && "text-warn")}>
        {v}
        {sub && <span className="block text-[9.5px] font-normal text-fg-3">{sub}</span>}
      </span>
    </div>
  );
}

/**
 * The preview's numbers for experienced traders: premium (with pips), commission, max profit / loss, breakevens,
 * margin before → after, free margin and cash after, and the Greeks. In the ticket it sits behind "Details" under the
 * plain-language card (`collapsible`); the strategy builder shows it open. Rejection reasons always show.
 */
export function PreviewSummary({ state, digits, pipsOf, className, showGreeks = true, collapsible = false }: { state: PreviewState; digits: number; pipsOf?: (usdAmount: number) => number | null; className?: string; showGreeks?: boolean; collapsible?: boolean }) {
  const t = useT();
  const T = useTerminal();
  const acc = T.account;
  const p = state.preview;
  const tradingSoon = useOpt((s) => s.tradingSoon);
  const [open, setOpen] = React.useState(!collapsible);
  if (!p && !state.error) return null;
  if (!p) return <ErrorNote code={state.error!.code} message={state.error!.message} className={className} />;
  const debit = p.netPremium >= 0;
  const premiumPips = pipsOf ? pipsOf(Math.abs(p.netPremium)) : null;
  const unlimited = t("trader.opt.unlimited");
  const reasons = (p.reasons ?? []).filter((r) => reasonCode(r) || typeof r !== "string");
  const body = (
    <div className={cn("font-mono text-[11px]", collapsible ? "border-t border-line/70 px-3 pb-2 pt-1.5" : "")}>
      <Line k={debit ? t("trader.opt.preview.youPay") : t("trader.opt.preview.youReceive")} v={`${usd(Math.abs(p.netPremium))} USD`} sub={premiumPips !== null && premiumPips !== undefined ? `${pips(premiumPips)} ${t("trader.opt.pips")}` : undefined} strong />
      <Line k={t("trader.opt.preview.commission")} v={usd(p.commission)} />
      <Line k={t("trader.opt.preview.maxProfit")} v={p.maxProfit === null ? unlimited : usd(p.maxProfit)} tone="up" />
      <Line k={t("trader.opt.preview.maxLoss")} v={p.maxLoss === null ? unlimited : usd(p.maxLoss)} tone="down" />
      <Line k={t("trader.opt.preview.breakeven", { count: p.breakevens.length })} v={p.breakevens.length ? p.breakevens.map((b) => px(b, digits)).join(" · ") : "—"} />
      <div className="my-1 border-t border-line/70" />
      <Line k={t("trader.opt.preview.margin")} v={`${accMoney(acc, p.marginBefore)} → ${accMoney(acc, p.marginAfter)}`} tone={p.marginAfter > p.marginBefore ? "warn" : undefined} />
      <Line k={t("trader.opt.preview.freeMarginAfter")} v={accMoney(acc, p.freeMarginAfter)} tone={p.freeMarginAfter < 0 ? "down" : undefined} />
      <Line k={t("trader.opt.preview.cashAfter")} v={accMoney(acc, p.cashAfter)} tone={p.cashAfter < 0 ? "down" : undefined} />
      {showGreeks && (
        <div className="mt-1.5 grid grid-cols-4 gap-1 text-center">
          {([
            ["Δ", greek(p.greeks.delta, 2), t("trader.opt.col.deltaHint")],
            ["Γ", greek(p.greeks.gamma, 3), t("trader.opt.col.gammaHint")],
            ["Θ", p.greeks.theta === undefined ? "—" : usdSigned(p.greeks.theta), t("trader.opt.col.thetaHint")],
            ["Vega", p.greeks.vega === undefined ? "—" : usd(p.greeks.vega), t("trader.opt.col.vegaHint")],
          ] as const).map(([k, v, title]) => (
            <div key={k} title={title} className="rounded-[6px] bg-panel/70 px-1 py-1">
              <div className="font-sans text-[9px] uppercase tracking-[0.06em] text-fg-3">{k}</div>
              <div className="text-[10.5px] text-fg">{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className={cn("rounded-[10px] border border-line bg-surface-2/40 transition-opacity", !collapsible && "px-3 py-2", state.loading && "opacity-80")}>
        {collapsible ? (
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex h-8 w-full items-center gap-1.5 px-3 text-start text-[11.5px] font-medium text-fg-2 hover:text-fg">
            <ChevronRight className={cn("size-3.5 text-fg-3 transition-transform", open && "rotate-90")} />
            <span className="flex-1">{t("trader.opt.plain.details")}</span>
            {p.estimate && (
              <span className="inline-flex items-center gap-1 rounded-[4px] bg-surface-3 px-1.5 text-[9.5px] font-medium text-fg-3" title={t("trader.opt.preview.estimateHint")}>
                <Info className="size-2.5" /> {t("trader.opt.preview.estimate")}
              </span>
            )}
            {!open && <span className="truncate text-[10.5px] text-fg-3">{t("trader.opt.plain.detailsHint")}</span>}
          </button>
        ) : (
          <div className="mb-0.5 flex items-center justify-between">
            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-3">{t("trader.opt.preview.title")}</span>
            {p.estimate && (
              <span className="inline-flex items-center gap-1 rounded-[4px] bg-surface-3 px-1.5 font-sans text-[9.5px] font-medium text-fg-3" title={t("trader.opt.preview.estimateHint")}>
                <Info className="size-2.5" /> {t("trader.opt.preview.estimate")}
              </span>
            )}
          </div>
        )}
        {open && body}
      </div>
      {reasons.map((r, i) => (
        <ErrorNote key={i} code={reasonCode(r)} message={typeof r === "string" ? undefined : r.message ?? reasonText(r)} />
      ))}
      {p.estimate && IS_LIVE && tradingSoon && !T.guest && <div className="rounded-[8px] border border-ember/25 bg-ember-soft/40 px-2.5 py-1.5 text-[11px] leading-snug text-fg-2">{t("trader.opt.tradingSoon")}</div>}
    </div>
  );
}
