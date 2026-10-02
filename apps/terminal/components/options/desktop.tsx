"use client";

// The Options workspace on desktop (Kalks Trader in Options mode) fills the SAME panels as CFD mode, so switching
// CFD ↔ Options never moves anything (components/shell/desktop.tsx keeps the panel group, sizes and collapse state):
//   left   (Market Watch's place)     the options instruments list: picking one sets the underlying
//   centre (the chart's place)        two tabs, "Chart" | "Option chain", under the expiry bar (Daily | Weekly |
//                                      Monthly + any listed date); the chart shows the selected option's premium;
//                                      while the order book is live a third tab, "Book": the selected option's
//                                      depth (10 levels) and trade tape; "Analytics": the volatility smile, term
//                                      structure, open interest and put / call ratios, and the what-if P&L
//   right  (the CFD order panel)      the option ticket: Sell at the bid / Buy at the ask, contracts, protection,
//                                      preview; "Simple" mode next to it
//   bottom                            the terminal's own toolbox (Options + Settlements tabs first)
// Loaded on demand (next/dynamic) the first time a trader switches to Options, so CFD-only traders never download it.
import * as React from "react";
import { BookOpenText, CandlestickChart, ChartSpline, ChevronsRight, ShoppingCart, Sigma, Table2, Wand2 } from "lucide-react";
import { parseSeriesCode } from "@kalks/mock/options";
import { cn } from "@kalks/ui";
import { useT } from "@kalks/i18n/react";
import { toast } from "@/lib/notify";
import { useTerminal } from "@/lib/store";
import { PanelHeader, PanelTabs } from "@/components/ui/panel";
import { TIcon } from "@/components/ui/primitives";
import { optionBook } from "@/lib/options/book";
import { bookOrders } from "@/lib/options/book-orders";
import { onDemoBookEvent, onDemoOrderEvent } from "@/lib/options/mock-engine";
import { optionErrorText } from "@/lib/options/errors";
import { opt, useBookLive, useOpt, useOptionsAttach, type CenterTab, type ChainView, type SidePanel } from "@/lib/options-store";
import { AnalyticsPane } from "./analytics";
import { OptionsUnavailable, RightTag, Seg } from "./bits";
import { BookBadge } from "./book-bits";
import { BookPane } from "./depth";
import { MmRulesLink } from "./mm-rules";
import { StrategyBuilder } from "./builder";
import { ChainHint, OptionChainTable } from "./chain";
import { ExpiryBar } from "./expiry-bar";
import { UnderlyingStats } from "./header";
import { OptionsInstruments } from "./instruments";
import { OptionChartPane } from "./premium-chart";
import { SimpleMode } from "./simple";
import { OptionTicket } from "./ticket";

/** Live / polling / reconnecting dot of the chain stream. */
export function StreamDot() {
  const t = useT();
  const s = useOpt((x) => x.stream);
  const tone = s === "open" ? "bg-up" : s === "polling" ? "bg-gold" : s === "unavailable" ? "bg-fg-3" : "bg-warn animate-pulse";
  const label = s === "open" ? t("trader.opt.stream.live") : s === "polling" ? t("trader.opt.stream.polling") : s === "unavailable" ? t("trader.opt.stream.off") : t("trader.opt.stream.connecting");
  return (
    <span className="flex shrink-0 items-center gap-1.5 pe-1.5 text-[10.5px] text-fg-3" title={label}>
      <span className={cn("size-1.5 rounded-full", tone)} />
      <span className="hidden xl:inline">{label}</span>
    </span>
  );
}

/** Toasts for events the options book reports: expiry settlements, knock-outs, demo working-order fills. */
export function useOptionEvents(login: string | null) {
  const t = useT();
  React.useEffect(() => {
    if (!login) return;
    const off1 = optionBook.onClose((l, d) => {
      if (l !== login) return;
      const reason = String((d as { reason?: unknown }).reason ?? "");
      const sym = String((d as { symbol?: unknown }).symbol ?? "");
      const profit = Number((d as { profit?: unknown }).profit ?? 0);
      if (reason === "expiry" || reason === "settlement") toast(t("trader.opt.toast.settled"), { description: `${sym} · ${profit >= 0 ? "+" : ""}${profit.toFixed(2)} USD` });
      else if (reason === "knock_out" || reason === "knockout") toast.warning(t("trader.opt.toast.knockedOut"), { description: sym });
    });
    const off2 = onDemoOrderEvent((l, o, filled) => {
      if (l !== login) return;
      if (filled) toast.success(t("trader.opt.toast.workingFilled"), { description: `#${o.ticket} ${o.option.series}` });
      else toast.warning(t("trader.opt.toast.workingExpired"), { description: `#${o.ticket} ${o.option.series}` });
    });
    // demo order book: a resting order filled, a stop fired, a GTD order expired (live: the engine's notifications)
    const off3 = onDemoBookEvent((e) => {
      if (e.login !== login) return;
      void bookOrders.refresh(login);
      const what = e.order ? `#${e.order.id} ${e.order.series}` : (e.fill?.series ?? "");
      if (e.kind === "fill" && e.fill) toast.success(t("trader.opt.bt.toast.restingFilled", { count: e.fill.qty }), { description: what });
      else if (e.kind === "stop_triggered") toast(t("trader.opt.bt.toast.stopFired"), { description: what });
      else if (e.kind === "stop_rejected") toast.warning(t("trader.opt.bt.toast.stopRejected"), { description: `${what} · ${optionErrorText(e.order?.reason ?? "")}` });
      else if (e.kind === "expired") toast(t("trader.opt.bt.toast.expired"), { description: what });
    });
    return () => {
      off1();
      off2();
      off3();
    };
  }, [login, t]);
}

/** Keeps the options data live while a panel of the workspace is on screen (reference-counted in the store). */
function useAttach() {
  const T = useTerminal();
  useOptionsAttach({ login: T.account.login, guest: T.guest, engine: T.engine, readOnly: T.readOnly });
  return T;
}

/* ------------------------------------------------------------------ */
/* Left: instruments                                                   */
/* ------------------------------------------------------------------ */

export function OptionsLeft({ onCollapse }: { onCollapse?: () => void }) {
  useAttach();
  return <OptionsInstruments onCollapse={onCollapse} />;
}

/* ------------------------------------------------------------------ */
/* Centre: Chart | Option chain                                        */
/* ------------------------------------------------------------------ */

function CenterTabs() {
  const t = useT();
  const bookLive = useBookLive();
  const tab = useCenterTab();
  const sel = useOpt((s) => (s.sel && parseSeriesCode(s.sel)?.underlying === s.u ? s.sel : null));
  const publicView = useOpt((s) => s.publicView);
  const sp = sel ? parseSeriesCode(sel) : null;
  const items: { id: CenterTab; icon: React.ReactNode; label: string; extra?: React.ReactNode }[] = [
    {
      id: "chart",
      icon: <CandlestickChart />,
      label: t("trader.opt.chart"),
      extra: sp ? (
        <span className="flex items-center gap-1 rounded-[4px] bg-surface-3 px-1 py-px font-mono text-[10px] text-fg-2">
          <RightTag right={sp.right} className="h-[14px] min-w-[14px] text-[9px]" />
          {sp.strikeLabel}
        </span>
      ) : undefined,
    },
    { id: "chain", icon: <Table2 />, label: t("trader.opt.chainTitle") },
    ...(bookLive ? [{ id: "book" as const, icon: <BookOpenText />, label: t("trader.opt.book.tab") }] : []),
    { id: "analytics", icon: <ChartSpline />, label: t("trader.opt.an.tab") },
  ];
  return (
    <div className="flex h-8 shrink-0 items-stretch border-b border-line bg-panel-2">
      <div role="tablist" className="flex shrink-0 items-stretch">
        {items.map((x) => {
          const on = x.id === tab;
          return (
            <button
              key={x.id}
              role="tab"
              aria-selected={on}
              onClick={() => opt.setCenter(x.id)}
              className={cn("relative flex shrink-0 items-center gap-1.5 border-r border-line px-3 text-[11.5px] font-medium transition-colors [&>svg]:size-3.5", on ? "bg-panel text-fg" : "text-fg-3 hover:bg-panel hover:text-fg-2")}
            >
              {on && <span className="absolute inset-x-0 top-0 h-[2px] bg-ember" />}
              {x.icon}
              {x.label}
              {x.extra}
            </button>
          );
        })}
      </div>
      <UnderlyingStats className="min-w-0 flex-1 px-2.5" />
      <div className="flex shrink-0 items-center gap-1 pe-1">
        <StreamDot />
        {!publicView && (
          <button onClick={() => opt.openBuilder(true)} className="flex h-6 items-center gap-1.5 rounded-[6px] bg-ember px-2 text-[11px] font-semibold text-white shadow-[0_6px_18px_-10px_rgba(255,90,31,0.9)] transition hover:brightness-110">
            <Wand2 className="size-3.5" /> <span className="hidden min-[1280px]:inline">{t("trader.opt.builder.open")}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/** The centre tab on screen: "book" falls back to the chain while the order book isn't live. */
function useCenterTab(): CenterTab {
  const bookLive = useBookLive();
  const tab = useOpt((s) => s.prefs.center);
  return tab === "book" && !bookLive ? "chain" : tab;
}

/** The Option chain tab: view (calls / both / puts), Greeks, the how-to, then the chain. */
export function ChainPane() {
  const t = useT();
  const prefs = useOpt((s) => s.prefs);
  const bookLive = useBookLive();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-line px-1.5">
        <Seg<ChainView>
          size="sm"
          className="w-[168px] shrink-0"
          value={prefs.view}
          onChange={(v) => opt.setPrefs({ view: v })}
          options={[
            { value: "calls", label: t("trader.opt.calls") },
            { value: "both", label: t("trader.opt.both") },
            { value: "puts", label: t("trader.opt.puts") },
          ]}
        />
        <button onClick={() => opt.setPrefs({ greeks: !prefs.greeks })} aria-pressed={prefs.greeks} title={t("trader.opt.greeksToggle")} className={cn("flex h-6 shrink-0 items-center gap-1 rounded-[6px] border px-2 text-[11px] font-medium transition-colors", prefs.greeks ? "border-ember/40 bg-ember-soft text-ember" : "border-line text-fg-3 hover:text-fg-2")}>
          <Sigma className="size-3.5" /> {t("trader.opt.greeks")}
        </button>
        {bookLive && <BookBadge />}
        <ChainHint className="ms-1 flex-1" />
        {bookLive && <MmRulesLink className="hidden shrink-0 pe-1 lg:inline-flex" />}
      </div>
      <div className="min-h-0 flex-1">
        <OptionChainTable />
      </div>
    </div>
  );
}

export function OptionsCenter() {
  const T = useAttach();
  useOptionEvents(T.guest ? null : T.account.login);
  const avail = useOpt((s) => s.avail);
  const tab = useCenterTab();
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[8px] border border-line bg-panel">
      {avail === "soon" || avail === "error" ? (
        <OptionsUnavailable kind={avail} onRetry={() => opt.retry()} />
      ) : (
        <>
          <CenterTabs />
          <ExpiryBar />
          <div className="min-h-0 flex-1">{tab === "chart" ? <OptionChartPane /> : tab === "book" ? <BookPane /> : tab === "analytics" ? <AnalyticsPane /> : <ChainPane />}</div>
        </>
      )}
      <StrategyBuilder />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Right: the ticket (the CFD order panel's place)                     */
/* ------------------------------------------------------------------ */

export function OptionsRight({ onCollapse }: { onCollapse?: () => void }) {
  const t = useT();
  useAttach();
  const panel = useOpt((s) => s.prefs.panel);
  const legs = useOpt((s) => s.ticket.legs);
  const u = useOpt((s) => s.u);
  const one = legs.length === 1 ? legs[0]! : null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        icon={<ShoppingCart />}
        title={
          <span className="flex items-center gap-1.5">
            {t("trader.opt.ticket.title")}
            <span className="font-normal normal-case tracking-normal text-fg-3">· {one ? `${one.u} ${one.strikeLabel} ${one.right === "call" ? "C" : "P"}` : (legs[0]?.u ?? u)}</span>
          </span>
        }
      >
        {onCollapse && (
          <TIcon label={t("order.panel.collapse")} onClick={onCollapse}>
            <ChevronsRight className="rtl:-scale-x-100" />
          </TIcon>
        )}
      </PanelHeader>
      <div className="flex h-8 shrink-0 items-stretch border-b border-line px-1">
        <PanelTabs<SidePanel>
          value={panel}
          onChange={(v) => opt.setPrefs({ panel: v })}
          tabs={[
            { value: "ticket", label: t("trader.opt.ticket.tab"), count: legs.length > 1 ? legs.length : undefined },
            { value: "simple", label: t("trader.opt.simple.tab") },
          ]}
        />
      </div>
      <div className="t-scroll min-h-0 flex-1 overflow-y-auto">{panel === "simple" ? <SimpleMode /> : <OptionTicket />}</div>
    </div>
  );
}
