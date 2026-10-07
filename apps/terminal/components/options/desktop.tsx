"use client";

// The Options workspace on desktop (Kalks Trader in Options mode), docs/TERMINAL-DESIGN.md §2.2. Same frame as CFD:
//   main card     one row (underlying ▾, spot, expiry, time to the cut, ATM IV, Quick trade, Strategy builder, Full
//                 chart), then ONE tab row: Option chain · Underlying · Option · Both · Analytics · Book (keys 1–6),
//                 each view at full size, with the expiries and the selected option kept on screen across views
//   right column  the underlyings and the order book (components/shell/side-column.tsx → ./side.tsx)
//   popup         Quick trade (Up or Down → date → amount → outcome) and Order (the full ticket): opened by the
//                 Quick trade button, a price in the chain, a level in the book or "Send to ticket"
//   below         the positions section (Positions, Orders, Closed, Settlements first)
// Loaded on demand (next/dynamic) the first time a trader switches to Options, so CFD-only traders never download it.
import * as React from "react";
import { BookOpen, BookOpenText, CandlestickChart, ChartSpline, ChevronDown, Columns2, Expand, LineChart, Maximize2, Minimize2, MousePointerClick, Rows2, Sparkles, Table2, Wand2 } from "lucide-react";
import { parseSeriesCode } from "@kalks/mock/options";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { toast } from "@/lib/notify";
import { useTerminal } from "@/lib/store";
import { PanelTabs } from "@/components/ui/panel";
import { Button, HelpTip, IconButton, Segmented, Stat, Tip } from "@/components/ui/kit";
import { TDialog } from "@/components/ui/primitives";
import { showSide, toggleFullChart, toggleFullscreen } from "@/components/shell/commands";
import { optionBook } from "@/lib/options/book";
import { bookOrders } from "@/lib/options/book-orders";
import { onDemoBookEvent, onDemoOrderEvent } from "@/lib/options/mock-engine";
import { optionErrorText } from "@/lib/options/errors";
import { engineUsd } from "@/lib/options/api";
import { COL_PRESETS, OPTION_TFS, getOpt, opt, underlyingOf, useBookLive, useOpt, useOptionsAttach, type ChainView, type SidePanel } from "@/lib/options-store";
import { atmIndex } from "@/lib/options/math";
import { AnalyticsPane } from "./analytics";
import { OptAvatar, OptionsUnavailable, RightTag, Seg, StateBadge } from "./bits";
import { BookBadge } from "./book-bits";
import { BookPane } from "./depth";
import { MmRulesLink } from "./mm-rules";
import { StrategyBuilder } from "./builder";
import { ChainHint, ColumnsMenu, OptionChainTable } from "./chain";
import { HowItWorks } from "./explain";
import { ExpiryBar } from "./expiry-bar";
import { countdown, cutWhen, expiryLabel, moneySigned, pct } from "./format";
import { FeedChange, SpotPrice } from "./header";
import { PremiumChart } from "./premium-chart";
import { UnderlyingChart } from "./underlying-chart";
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
export function useOptionEvents(login: string | null, cent = false) {
  const t = useT();
  React.useEffect(() => {
    if (!login) return;
    const off1 = optionBook.onClose((l, d) => {
      if (l !== login) return;
      const reason = String((d as { reason?: unknown }).reason ?? "");
      const sym = String((d as { symbol?: unknown }).symbol ?? "");
      // the engine's deal money is in the account's currency (USC on cent accounts)
      const profit = engineUsd(Number((d as { profit?: unknown }).profit ?? 0), cent) ?? 0;
      if (reason === "expiry" || reason === "settlement") toast(t("trader.opt.toast.settled"), { description: `${sym} · ${moneySigned(profit)}` });
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
  }, [login, t, cent]);
}

/** Keeps the options data live while a panel of the workspace is on screen (reference-counted in the store). */
function useAttach() {
  const T = useTerminal();
  useOptionsAttach({ login: T.account.login, guest: T.guest, engine: T.engine, readOnly: T.readOnly });
  return T;
}

/** The Option chain tab: view (calls / both / puts), the columns, the how-to, then the chain. */
export function ChainPane() {
  const t = useT();
  const prefs = useOpt((s) => s.prefs);
  const bookLive = useBookLive();
  return (
    <div className="@container flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-2.5">
        <Seg<ChainView>
          className="w-[186px] shrink-0"
          value={prefs.view}
          onChange={(v) => opt.setPrefs({ view: v })}
          options={[
            { value: "calls", label: t("trader.opt.calls") },
            { value: "both", label: t("trader.opt.both") },
            { value: "puts", label: t("trader.opt.puts") },
          ]}
        />
        <ColumnsMenu />
        {bookLive && <BookBadge />}
        <ChainHint className="ms-1 hidden flex-1 @[980px]:flex" />
        <span className="ms-auto flex shrink-0 items-center gap-2">
          {bookLive && <MmRulesLink className="hidden shrink-0 @[800px]:inline-flex" />}
          <HowItWorks />
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <OptionChainTable />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The chart-first options workspace                                   */
/* ------------------------------------------------------------------ */

/** One row: the underlying (▾ shows the instruments column), spot and change, the expiry facts with "(?)", then the
 *  actions (Quick trade, Strategy builder, Full chart, full screen). */
function OptionsBar() {
  const T = useAttach();
  const t = useT();
  const { locale } = useLocale();
  const u = useOpt((s) => s.u);
  const cur = useOpt((s) => underlyingOf(s));
  const chain = useOpt((s) => (s.chain?.underlying === s.u ? s.chain : null));
  const publicView = useOpt((s) => s.publicView);
  const atmRow = chain?.rows.length ? chain.rows[atmIndex(chain)] : undefined;
  const atmIv = atmRow?.call?.iv ?? cur?.atmVol ?? null;
  const full = T.ui.fullChart;
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const help = (k: "expiry" | "cut" | "iv") => <HelpTip title={t(`desk.og.${k}.t`)} text={t(`desk.og.${k}`)} side="bottom" className="size-3.5 [&>svg]:size-3" />;
  return (
    <div className="@container flex h-12 shrink-0 items-center gap-3 border-b border-line px-1.5">
      <Tip content={t("desk.sh.instruments")} shortcut="Ctrl+M" side="bottom">
        <button onClick={() => showSide(T, "instruments")} className="flex min-w-0 shrink-0 items-center gap-2 rounded-[9px] px-1.5 py-1 text-start transition-colors hover:bg-surface-3/60" data-tour="opt-underlying">
          <OptAvatar symbol={u} size={24} />
          <span className="min-w-0 leading-tight">
            <span className="flex items-center gap-1 text-[14px] font-semibold text-fg">
              {u}
              <ChevronDown className="size-3.5 text-fg-3" />
            </span>
            <span className="block max-w-[150px] truncate text-[11.5px] text-fg-3">{cur?.name ?? t("trader.opt.mode.options")}</span>
          </span>
        </button>
      </Tip>
      <span className="flex shrink-0 items-baseline gap-2">
        <SpotPrice symbol={u} className="text-[18px] font-semibold" fallback={chain?.spot?.mid} />
        <FeedChange symbol={u} className="text-[12px]" />
      </span>
      <span className="hidden h-6 w-px shrink-0 bg-line @[560px]:block" aria-hidden />
      <div className="flex min-w-0 flex-1 items-center gap-5 overflow-hidden">
        {chain && (
          <Stat label={<span className="flex items-center gap-0.5">{t("desk.sh.expiry")}{help("expiry")}</span>} className="hidden @[640px]:flex">
            {expiryLabel(chain.expiry, locale)}
          </Stat>
        )}
        {chain && (
          <Stat label={<span className="flex items-center gap-0.5">{t("desk.sh.cutIn")}{help("cut")}</span>} title={cutWhen(chain.cutAt, locale)} className="hidden @[560px]:flex">
            {countdown(Date.parse(chain.cutAt))}
          </Stat>
        )}
        <Stat label={<span className="flex items-center gap-0.5">{t("trader.opt.atmIv")}{help("iv")}</span>} className="hidden @[760px]:flex">
          {pct(atmIv)}
        </Stat>
        {chain && <StateBadge state={chain.state} className="hidden @[1100px]:inline-flex" />}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <StreamDot />
        {!publicView && (
          <>
            <Tip content={t("desk.opt.quickTip")} side="bottom">
              <button onClick={() => openOptionsTicket("simple")} data-tour="opt-quick" className="flex h-8 items-center gap-1.5 rounded-[8px] bg-accent-strong px-3 text-[12.5px] font-semibold text-white transition hover:brightness-110">
                <Sparkles className="size-3.5" /> {t("trader.opt.guide.tab")}
              </button>
            </Tip>
            <button onClick={() => opt.openBuilder(true)} title={t("trader.opt.builder.open")} className="flex h-8 items-center gap-1.5 rounded-[8px] border border-line px-2.5 text-[12.5px] font-medium text-fg-2 transition hover:border-ember/40 hover:text-fg">
              <Wand2 className="size-3.5" /> <span className="hidden @[900px]:inline">{t("trader.opt.builder.open")}</span>
            </button>
          </>
        )}
        <IconButton label={full ? t("desk.ch.exitFullChart") : t("desk.ch.fullChart")} shortcut="Shift+F" active={full} onClick={() => toggleFullChart(T)}>
          {full ? <Minimize2 /> : <Maximize2 />}
        </IconButton>
        <IconButton label={t("desk.set.fullScreen")} shortcut="F11" onClick={toggleFullscreen}>
          <Expand />
        </IconButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The centre card's views: one tab row, each view at full size         */
/* ------------------------------------------------------------------ */

export type DeskTab = "chain" | "underlying" | "option" | "both" | "analytics" | "book";
const DESK_TAB_KEY = "kalks.options.deskTab";
const BOTH_STACK_KEY = "kalks.options.bothStacked";

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* private mode */
  }
}

/** The view on screen: the chain on a first visit, then the last one chosen ("book" while the book is live). */
function useDeskTab(): [DeskTab, (v: DeskTab) => void] {
  const bookLive = useBookLive();
  const [tab, setTab] = React.useState<DeskTab>("chain");
  React.useEffect(() => {
    const v = readLocal(DESK_TAB_KEY) as DeskTab | null;
    if (v && ["chain", "underlying", "option", "both", "analytics", "book"].includes(v)) setTab(v);
  }, []);
  const set = React.useCallback((v: DeskTab) => {
    setTab(v);
    writeLocal(DESK_TAB_KEY, v);
  }, []);
  return [tab === "book" && !bookLive ? "chain" : tab, set];
}

/** Timeframes of the chart views (one setting, so Underlying, Option and Both stay in step). */
function TfRow() {
  const tf = useOpt((s) => s.prefs.tf);
  const t = useT();
  return (
    <div role="radiogroup" aria-label={t("trader.menu.timeframes")} className="flex shrink-0 items-center">
      {OPTION_TFS.map((x) => (
        <button key={x} role="radio" aria-checked={tf === x} onClick={() => opt.setPrefs({ tf: x })} className={cn("h-7 min-w-[30px] rounded-[6px] px-1 font-mono text-[12px] transition-colors", tf === x ? "bg-ember-soft font-semibold text-accent-text" : "text-fg-2 hover:bg-surface-3/60 hover:text-fg")}>
          {x}
        </button>
      ))}
    </div>
  );
}

/** The selected option, shown across every view: "EURUSD 1.1250 Call · Tomorrow". */
function SelectionChip() {
  const { locale } = useLocale();
  const t = useT();
  const sel = useOpt((s) => (s.sel && parseSeriesCode(s.sel)?.underlying === s.u ? s.sel : null));
  const p = sel ? parseSeriesCode(sel) : null;
  if (!p) return <span className="hidden truncate text-[12px] text-fg-3 @[760px]:block">{t("desk.ot.noSelection")}</span>;
  return (
    <span className="flex min-w-0 items-center gap-1.5 rounded-[8px] border border-line bg-panel-2/70 px-2 py-1 text-[12px]" title={sel!}>
      <RightTag right={p.right} className="h-[15px] min-w-[15px] text-[9px]" />
      <span className="truncate font-medium text-fg">
        {p.underlying} {p.strikeLabel} {p.right === "call" ? t("trader.opt.call") : t("trader.opt.put")}
      </span>
      <span className="hidden shrink-0 text-fg-3 @[900px]:inline">· {expiryLabel(p.date, locale)}</span>
    </span>
  );
}

function OptionEmpty({ onOpenChain }: { onOpenChain: () => void }) {
  const t = useT();
  return (
    <div className="grid h-full place-items-center p-6">
      <div className="max-w-[360px] text-center">
        <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-ember-soft text-accent-text">
          <MousePointerClick className="size-5" />
        </span>
        <p className="text-[13.5px] font-medium text-fg">{t("desk.ot.emptyTitle")}</p>
        <Button className="mt-3" variant="primary" onClick={onOpenChain}>
          <Table2 className="size-3.5" /> {t("desk.ot.openChain")}
        </Button>
      </div>
    </div>
  );
}

/** The selected option's premium chart (or the empty state / the "not served yet" note). */
function OptionChart({ onOpenChain }: { onOpenChain: () => void }) {
  const t = useT();
  const sel = useOpt((s) => (s.sel && parseSeriesCode(s.sel)?.underlying === s.u ? s.sel : null));
  const tf = useOpt((s) => s.prefs.tf);
  const [off, setOff] = React.useState(false);
  React.useEffect(() => setOff(false), [sel]);
  if (!sel) return <OptionEmpty onOpenChain={onOpenChain} />;
  if (off)
    return (
      <div className="grid h-full place-items-center p-6 text-center text-[12.5px] text-fg-3">
        <span className="max-w-[360px]">{t("trader.opt.chart.fallback")}</span>
      </div>
    );
  return <PremiumChart key={`${sel}|${tf}`} code={sel} tf={tf} onUnavailable={() => setOff(true)} />;
}

/** A labelled half of the "Both" view. */
function Half({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[10px] border border-line">
      <div className="flex h-7 shrink-0 items-center gap-1.5 border-b border-line px-2 text-[11.5px] font-medium text-fg-2">{label}</div>
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  );
}

export function OptionsMain() {
  const T = useAttach();
  useOptionEvents(T.guest ? null : T.account.login, !!T.account.cent);
  const t = useT();
  const avail = useOpt((s) => s.avail);
  const bookLive = useBookLive();
  const u = useOpt((s) => s.u);
  const sel = useOpt((s) => (s.sel && parseSeriesCode(s.sel)?.underlying === s.u ? s.sel : null));
  const selP = sel ? parseSeriesCode(sel) : null;
  const [tab, setTab] = useDeskTab();
  const [stacked, setStacked] = React.useState(false);
  React.useEffect(() => setStacked(readLocal(BOTH_STACK_KEY) === "1"), []);
  const toggleStack = () =>
    setStacked((v) => {
      writeLocal(BOTH_STACK_KEY, v ? "0" : "1");
      return !v;
    });
  const openChain = React.useCallback(() => setTab("chain"), [setTab]);
  // "Option chain" buttons elsewhere (an empty ticket, What-if, the chart hint on phones) ask for the chain
  const center = useOpt((s) => s.prefs.center);
  const seen = React.useRef(center);
  React.useEffect(() => {
    if (seen.current === center) return;
    seen.current = center;
    if (center === "chain" || center === "analytics" || center === "book") setTab(center);
  }, [center, setTab]);
  // a wide desktop chain shows Buy and Sell, chance and breakeven: Standard columns instead of Simple, once
  React.useEffect(() => {
    try {
      if (localStorage.getItem("kalks.options.deskStd")) return;
      localStorage.setItem("kalks.options.deskStd", "1");
      if (getOpt().prefs.colPreset === "simple") opt.setPrefs({ colPreset: "standard", cols: COL_PRESETS.standard });
    } catch {
      /* private mode */
    }
  }, []);
  const tabs: { value: DeskTab; label: string; icon: React.ReactNode }[] = [
    { value: "chain", label: t("trader.opt.chainTitle"), icon: <Table2 /> },
    { value: "underlying", label: t("trader.opt.col.underlying"), icon: <CandlestickChart /> },
    { value: "option", label: t("desk.ot.option"), icon: <LineChart /> },
    { value: "both", label: t("desk.ot.both"), icon: <Columns2 /> },
    { value: "analytics", label: t("trader.opt.an.tab"), icon: <ChartSpline /> },
    ...(bookLive ? [{ value: "book" as const, label: t("trader.opt.book.tab"), icon: <BookOpenText /> }] : []),
  ];
  // keys 1–6 switch the views (not while typing, not with modifiers)
  const tabsRef = React.useRef(tabs);
  tabsRef.current = tabs;
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || !/^[1-6]$/.test(e.key)) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (document.querySelector("[role=dialog]")) return;
      const next = tabsRef.current[Number(e.key) - 1];
      if (next) {
        e.preventDefault();
        setTab(next.value);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [setTab]);
  const chartTab = tab === "underlying" || tab === "option" || tab === "both";
  return (
    <section className="t-glass @container flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[14px] border border-line">
      {avail === "soon" || avail === "error" ? (
        <OptionsUnavailable kind={avail} onRetry={() => opt.retry()} />
      ) : (
        <>
          <OptionsBar />
          {/* one tab row: every view fills the card */}
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-1.5" data-tour="opt-tabs">
            <div role="tablist" aria-label={t("desk.ot.views")} className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
              {tabs.map((x, i) => (
                <Tip key={x.value} content={x.label} shortcut={String(i + 1)} side="bottom">
                  <button
                    role="tab"
                    aria-selected={tab === x.value}
                    onClick={() => setTab(x.value)}
                    className={cn("flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[8px] px-2.5 text-[13px] font-medium transition-colors [&>svg]:size-3.5", tab === x.value ? "bg-surface-3 text-fg" : "text-fg-2 hover:bg-surface-3/50 hover:text-fg")}
                  >
                    {x.icon}
                    {x.label}
                  </button>
                </Tip>
              ))}
            </div>
            <div className="ms-auto flex min-w-0 items-center gap-2">
              <SelectionChip />
              <button onClick={() => T.setUi({ glossary: true })} className="hidden h-7 shrink-0 items-center gap-1.5 rounded-[7px] px-2 text-[12.5px] font-medium text-fg-2 hover:bg-surface-3 hover:text-fg @[1000px]:flex">
                <BookOpen className="size-3.5" /> {t("desk.og.open")}
              </button>
            </div>
          </div>
          {/* the expiries stay on screen in every view */}
          <ExpiryBar />
          {chartTab && (
            <div className="flex h-9 shrink-0 items-center gap-2 border-b border-line px-1.5">
              <TfRow />
              {tab === "underlying" && (
                <span className="ms-auto hidden shrink-0 items-center gap-2.5 ps-2 text-[11px] text-fg-3 @[760px]:flex">
                  <span className="flex items-center gap-1">
                    <span className="w-3 border-t border-dashed border-gold" /> {t("trader.opt.line.strike")}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 border-t border-dotted border-fg-2" /> {t("trader.opt.line.be")}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 border-t border-fg-2" /> {t("trader.opt.line.position")}
                  </span>
                </span>
              )}
              {tab === "both" && (
                <Segmented
                  size="sm"
                  stretch={false}
                  className="ms-auto"
                  label={t("desk.ot.arrange")}
                  value={stacked ? "stack" : "side"}
                  onChange={(v) => v !== (stacked ? "stack" : "side") && toggleStack()}
                  options={[
                    { value: "side", label: <span className="sr-only">{t("desk.ot.sideBySide")}</span>, icon: <Columns2 />, tip: t("desk.ot.sideBySide") },
                    { value: "stack", label: <span className="sr-only">{t("desk.ot.stacked")}</span>, icon: <Rows2 />, tip: t("desk.ot.stacked") },
                  ]}
                />
              )}
            </div>
          )}
          <div className="relative min-h-0 flex-1" data-tour="chart">
            {tab === "chain" ? (
              <ChainPane />
            ) : tab === "underlying" ? (
              <UnderlyingChart bare />
            ) : tab === "option" ? (
              <OptionChart onOpenChain={openChain} />
            ) : tab === "both" ? (
              <div className={cn("grid h-full gap-1.5 p-1.5", stacked ? "grid-rows-2" : "grid-cols-2")}>
                <Half label={<>{t("trader.opt.col.underlying")} · <span className="text-fg">{u}</span></>}>
                  <UnderlyingChart bare />
                </Half>
                <Half label={<>{t("desk.ot.option")}{selP && <> · <span className="text-fg">{selP.underlying} {selP.strikeLabel} {selP.right === "call" ? t("trader.opt.call") : t("trader.opt.put")}</span></>}</>}>
                  <OptionChart onOpenChain={openChain} />
                </Half>
              </div>
            ) : tab === "analytics" ? (
              <AnalyticsPane onOpenChain={openChain} />
            ) : (
              <BookPane />
            )}
          </div>
        </>
      )}
      <StrategyBuilder />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Quick trade / Order popup                                           */
/* ------------------------------------------------------------------ */

let popupOpen = false;
const popupListeners = new Set<() => void>();
const setPopup = (v: boolean) => {
  if (popupOpen === v) return;
  popupOpen = v;
  popupListeners.forEach((f) => f());
};

/** Open the options order popup on Quick trade or the full ticket. */
export function openOptionsTicket(panel?: SidePanel) {
  if (panel) opt.setPrefs({ panel });
  setPopup(true);
}

/**
 * The options order form as a centred popup (the CFD order form's pattern). Opens from the Quick trade button, and by
 * itself whenever the ticket gets a new selection: a price clicked in the chain, a level in the book, "Send to ticket".
 */
export function OptionsTicketPopup() {
  const t = useT();
  useAttach();
  const open = React.useSyncExternalStore(
    (f) => (popupListeners.add(f), () => popupListeners.delete(f)),
    () => popupOpen,
    () => false,
  );
  const panel = useOpt((s) => s.prefs.panel);
  const legs = useOpt((s) => s.ticket.legs);
  const limit = useOpt((s) => s.ticket.limit);
  const u = useOpt((s) => s.u);
  const sig = legs.map((l) => `${l.series}:${l.side}`).join("|");
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) return void (first.current = false);
    if (sig) setPopup(true);
  }, [sig, limit]);
  // "Open the option chain" from inside the ticket: the panel opens (OptionsMain), the popup steps aside
  const center = useOpt((s) => s.prefs.center);
  const seenCenter = React.useRef(center);
  React.useEffect(() => {
    if (seenCenter.current === center) return;
    seenCenter.current = center;
    if (center !== "chart") setPopup(false);
  }, [center]);
  const one = legs.length === 1 ? legs[0]! : null;
  if (!open) return null;
  return (
    <TDialog open onClose={() => setPopup(false)} width={440} icon={<Sparkles />} title={t("trader.opt.ticket.title")} subtitle={one ? `${one.u} ${one.strikeLabel} ${one.right === "call" ? "Call" : "Put"}` : (legs[0]?.u ?? u)}>
      <div className="sticky top-0 z-[2] flex h-11 items-center border-b border-line bg-panel-2/95 px-2.5" data-tour="opt-popup">
        <PanelTabs<SidePanel>
          value={panel}
          onChange={(v) => opt.setPrefs({ panel: v })}
          tabs={[
            { value: "simple", label: t("trader.opt.guide.tab") },
            { value: "ticket", label: t("trader.opt.ticket.tab"), count: legs.length > 1 ? legs.length : undefined },
          ]}
        />
      </div>
      {panel === "simple" ? <SimpleMode /> : <OptionTicket />}
    </TDialog>
  );
}
