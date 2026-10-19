"use client";

// A chart slot on TradingView Advanced Charts (docs/TERMINAL-DESIGN.md Part 7). The library brings its header (symbol,
// resolutions, chart type, indicators, templates, undo / redo, settings, screenshot), its drawing toolbar and its bottom
// bar (date ranges, the server clock, %, log, auto) in Ezymex colours; New order, alerts, layout and Full chart are our
// buttons in its header. Our trading sits on top (trade-overlay.tsx): chips with TP / SL handles, the one-click box,
// trade lines drawn as locked library shapes (so screenshots carry them), Buy / Sell Limit / Stop and alerts in the
// library's context menu. One widget per slot stays alive while the slot's tab, symbol or timeframe change.
import * as React from "react";
import { useTheme } from "next-themes";
import { priceFeed } from "@ezymex/mock";
import { cn, useBrand } from "@ezymex/ui";
import { useLocale, useT } from "@ezymex/i18n/react";
import { toast } from "@/lib/notify";
import { openRegister } from "@/lib/guest";
import { useTerminal, type ChartTab } from "@/lib/store";
import { fmtPrice, fmtVol, roundPrice, serverZone } from "@/lib/trading";
import { TF_RES, createDatafeed, resToTf, tvSymbol } from "@/lib/tv/datafeed";
import { TV_LIBRARY_PATH, loadTradingView } from "@/lib/tv/loader";
import { readTvState, templateStore, writeTvState } from "@/lib/tv/storage";
import { chartFont, chartOverrides, features, loadingScreen, shareFonts, studyOverrides, uiColors, type TvVariant } from "@/lib/tv/style";
import type { TvChartApi, TvWidget } from "@/lib/tv/types";
import { useContextMenu, type MenuItem } from "@/components/ui/menu";
import { segmentLabel } from "@/components/market/segments";
import { openActivity, showSide, toggleFullChart, useLayoutItems } from "@/components/shell/commands";
import { chartRegistry, readPalette, type ChartHandle, type Palette } from "./engine";
import { TradeOverlay, lineColor, type ChartCoords, type DrawnLine, type PlotFrame } from "./trade-overlay";

export interface TvChartProps {
  tab: ChartTab;
  active: boolean;
  onActivate: () => void;
  /** narrow chart (four on screen): the smaller one-click box */
  compact?: boolean;
  /** phones: the library's mobile set, and the Sell / Buy bar under the chart instead of the box */
  variant?: TvVariant;
  hideOneClick?: boolean;
  /** draw the accent frame of the active chart (default: when active); off with a single chart on screen */
  highlight?: boolean;
}

/** The library's languages; ours without one fall back to English. */
const TV_LOCALES: Record<string, string> = { en: "en", ar: "ar", es: "es", pt: "pt", fr: "fr", de: "de", it: "it", ru: "ru", tr: "tr", id: "id_ID", ms: "ms_MY", vi: "vi", th: "th", zh: "zh", ja: "ja", ko: "ko" };

/** Our indicator types as the library's studies (Navigator, commands). */
const TV_STUDIES: Record<string, string> = {
  sma: "Moving Average", ema: "Moving Average Exponential", wma: "Moving Average Weighted", smma: "Smoothed Moving Average", dema: "Double EMA", tema: "Triple EMA", hma: "Hull Moving Average",
  vwap: "VWAP", ichimoku: "Ichimoku Cloud", psar: "Parabolic SAR", supertrend: "SuperTrend", envelopes: "Envelopes", pivots: "Pivot Points Standard", bb: "Bollinger Bands", keltner: "Keltner Channels",
  donchian: "Donchian Channels", atr: "Average True Range", stddev: "Standard Deviation", rsi: "Relative Strength Index", stoch: "Stochastic", stochrsi: "Stochastic RSI", macd: "MACD",
  cci: "Commodity Channel Index", willr: "Williams %R", momentum: "Momentum", roc: "Rate Of Change", adx: "Average Directional Index", aroon: "Aroon", ao: "Awesome Oscillator",
  ac: "Accelerator Oscillator", alligator: "Williams Alligator", fractals: "Williams Fractal", volumes: "Volume", obv: "On Balance Volume", mfi: "Money Flow Index",
};

/** The date ranges of the library's bottom bar: the same presets and timeframes as our own chart's. */
const RANGES = [
  { text: "5y", title: "5Y", resolution: "1W", tip: "chart.range.5y" },
  { text: "1y", title: "1Y", resolution: "1D", tip: "chart.range.1y" },
  { text: "6m", title: "6M", resolution: "240", tip: "chart.range.6m" },
  { text: "3m", title: "3M", resolution: "60", tip: "chart.range.3m" },
  { text: "1m", title: "1M", resolution: "30", tip: "chart.range.1m" },
  { text: "5d", title: "5D", resolution: "5", tip: "chart.range.5d" },
  { text: "1d", title: "1D", resolution: "1", tip: "chart.range.1d" },
] as const;

/** public/tv/ezymex.css is loaded inside the library's iframe, where a reload of the page does not refetch it:
 *  the browser keeps serving the cached copy and new rules never arrive. **Bump this whenever that file changes.** */
const CSS_VERSION = "2";

/** Room left under the legend's symbol line for the one-click box (public/tv/ezymex.css). */
const BOX_GAP = 50;

const ICON = {
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  layout: '<rect width="7" height="18" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/>',
  max: '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/>',
  min: '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" x2="21" y1="10" y2="3"/><line x1="3" x2="10" y1="21" y2="14"/>',
};
const svg = (paths: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** A fresh chart's layout (the library's defaults), kept from the first chart that started without one: a new tab
 *  starts clean instead of inheriting the indicators of the tab the slot showed before. */
let blankState: object | null = null;

interface Ready {
  widget: TvWidget;
  iframe: HTMLIFrameElement;
  coords: ChartCoords & { calibrate: (price: number, offsetY: number) => void; dispose: () => void };
}

/** One horizontal line to draw: a trade line, or one of the two quote lines this file adds. */
interface Shape {
  id: string;
  price: number;
  color: string;
  style: number;
}

export function TvChart({ tab, active, onActivate, compact, variant = "desktop", hideOneClick, highlight = active }: TvChartProps) {
  const T = useTerminal();
  const t = useT();
  const { locale } = useLocale();
  const { resolvedTheme } = useTheme();
  const wrap = React.useRef<HTMLDivElement>(null);
  const host = React.useRef<HTMLDivElement>(null);
  const [ready, setReady] = React.useState<Ready | null>(null);
  const readyRef = React.useRef(ready);
  readyRef.current = ready;
  const cm = useContextMenu(248);
  const layoutItems = useLayoutItems();

  const broker = useBrand()?.name || "Ezymex";
  // the latest of everything the library's callbacks read (they are registered once per widget)
  const live = React.useRef({ T, t, tab, onActivate, layoutItems, cm, broker });
  live.current = { T, t, tab, onActivate, layoutItems, cm, broker };
  /** the tab whose layout the widget shows (the slot's tab can change under a living widget) */
  const shown = React.useRef(tab.id);
  /** > 0 while we move the widget (tab switch, symbol / timeframe from the terminal): its change events aren't the trader's */
  const syncing = React.useRef(0);
  const palette = React.useRef<Palette | null>(null);
  const shapes = React.useRef(new Map<string, { entity: string | null; price: number; key: string }>());
  /** every shape id this chart has created: the library can stop resolving a handle while the shape is still on the
   *  plot, and without this list such a line could never be removed again (see sweepOrphans) */
  const created = React.useRef(new Set<string>());
  const drawnRef = React.useRef<DrawnLine[]>([]);
  /** the account's executable prices, drawn as two lines of their own (see quoteLines) */
  const quoteRef = React.useRef<{ bid: number; ask: number }>({ bid: 0, ask: 0 });
  const [legendTop, setLegendTop] = React.useState<number | null>(null);
  const [popup, setPopup] = React.useState(false);
  // Sell / Buy live in the header now (headerButtons), so nothing floats over the candles
  const showBox = false;
  const showBoxRef = React.useRef(showBox);
  showBoxRef.current = showBox;

  /* ---------------- the widget ---------------- */
  React.useEffect(() => {
    let alive = true;
    let widget: TvWidget | null = null;
    let feed: ReturnType<typeof createDatafeed> | null = null;
    const offs: (() => void)[] = [];
    void loadTradingView().then((TV) => {
      if (!alive || !TV || !host.current || !wrap.current) return;
      const c = readPalette(wrap.current);
      palette.current = c;
      const { tab: tb, t: tr } = live.current;
      shown.current = tb.id;
      const saved = readTvState(tb.id);
      const f = features(variant);
      feed = createDatafeed({
        broker: live.current.broker,
        types: { all: segmentLabel("all", tr), forex: segmentLabel("forex", tr), metals: segmentLabel("metals", tr), indices: segmentLabel("indices", tr), energies: segmentLabel("energies", tr), crypto: segmentLabel("crypto", tr), stocks: segmentLabel("stocks", tr) },
        onReset: () => {
          try {
            widget?.activeChart().resetData();
          } catch {
            /* not ready yet: its first request is fresh anyway */
          }
        },
      });
      widget = new TV.widget({
        container: host.current,
        datafeed: feed,
        symbol: tb.symbol,
        interval: TF_RES[tb.tf],
        library_path: TV_LIBRARY_PATH,
        locale: TV_LOCALES[locale] ?? "en",
        autosize: true,
        theme: c.dark ? "dark" : "light",
        timezone: "Etc/UTC",
        saved_data: saved,
        auto_save_delay: 2,
        custom_css_url: `/tv/ezymex.css?v=${CSS_VERSION}`,
        custom_font_family: chartFont(),
        loading_screen: loadingScreen(c),
        overrides: chartOverrides(c),
        studies_overrides: studyOverrides(c),
        disabled_features: f.disabled,
        enabled_features: f.enabled,
        favorites: { intervals: ["1", "30", "60", "240", "1D"] },
        time_frames: RANGES.map((r) => ({ text: r.text, title: r.title, resolution: r.resolution, description: tr(r.tip) })),
        save_load_adapter: templateStore,
      });
      const w = widget;
      w.onChartReady(() => {
        const iframe = host.current?.querySelector("iframe");
        const doc = iframe?.contentDocument;
        const win = iframe?.contentWindow as (Window & typeof globalThis) | null | undefined;
        if (!alive || !iframe || !doc || !win) return;
        const chart = w.activeChart();
        if (!saved && !blankState) w.save((s) => (blankState = s));
        // The "Volume 14.91 K" row above the candles is the status line of the library's default Volume study, and
        // the histogram along the bottom is the same study's plot. There is no way to show one without the other,
        // and the override that would hide the row (showStudyTitles / showStudyValues) hides the status line of
        // every indicator, so an RSI added later would lose its name and reading too. So the study goes - on each
        // open, since a chart arranged earlier carries it in its saved state. The data stays (ohlcv), so VWAP, OBV,
        // Money Flow and Volume itself all still work from Indicators.
        for (const st of chart.getAllStudies()) if (st.name === "Volume") chart.removeEntity(st.id, { disableUndo: true });
        shareFonts(doc);
        applyColors(w, c, showBoxRef.current && variant === "desktop");

        // the trader's own symbol / timeframe changes in the library go to the tab
        const onSymbol = () => {
          // the trade lines of the new symbol are drawn on its series
          redrawShapes();
          if (syncing.current) return;
          const s = tvSymbol(chart.symbol());
          const { T: Tm, tab: tb2 } = live.current;
          if (s !== tb2.symbol) Tm.updateTab(tb2.id, { symbol: s });
        };
        const onInterval = (res: string) => {
          const tf = resToTf(res);
          const { T: Tm, tab: tb2 } = live.current;
          if (!syncing.current && tf && tf !== tb2.tf) Tm.updateTab(tb2.id, { tf });
        };
        chart.onSymbolChanged().subscribe(null, onSymbol);
        chart.onIntervalChanged().subscribe(null, onInterval);
        offs.push(() => {
          chart.onSymbolChanged().unsubscribe(null, onSymbol);
          chart.onIntervalChanged().unsubscribe(null, onInterval);
        });

        // the tab's layout is saved as the trader works (and when the slot shows another tab)
        const autosave = () => saveState(w, shown.current);
        w.subscribe("onAutoSaveNeeded", autosave);
        offs.push(() => w.unsubscribe("onAutoSaveNeeded", autosave));

        // our lines are library shapes: "Remove drawings" takes them too, so they come back
        const onDrawing = ((id: string, type: string) => {
          if (type !== "remove") return;
          for (const [k, r] of shapes.current) if (r.entity === id) shapes.current.delete(k);
          syncShapes(w);
        }) as (...a: never[]) => void;
        w.subscribe("drawing_event", onDrawing);
        offs.push(() => w.unsubscribe("drawing_event", onDrawing));

        // a click anywhere in the chart's frame activates the slot and closes our menus (the page never sees it)
        const down = () => {
          live.current.onActivate();
          live.current.cm.close();
        };
        win.addEventListener("pointerdown", down, true);
        offs.push(() => win.removeEventListener("pointerdown", down, true));

        // the terminal's keys work with the focus in the chart; the library keeps its own (undo, drawing keys, typing)
        const key = (e: KeyboardEvent) => {
          const el = doc.activeElement as HTMLElement | null;
          if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
          if (!forwardKey(e, doc)) return;
          const ev = new KeyboardEvent("keydown", { key: e.key, code: e.code, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, altKey: e.altKey, bubbles: true, cancelable: true });
          window.dispatchEvent(ev);
          if (ev.defaultPrevented) e.preventDefault();
        };
        win.addEventListener("keydown", key);
        offs.push(() => win.removeEventListener("keydown", key));

        // Buy / Sell Limit / Stop at the price under the pointer, New order and an alert in the library's menu
        w.onContextMenu((_time, price) => contextItems(price));

        // the clock in the bottom bar shows server time (the bars are shifted to it): its label says which
        offs.push(zoneLabel(doc));
        offs.push(watchPopups(doc, setPopup));

        const coords = tvCoords(w, iframe, (top) => setLegendTop((v) => (v === top ? v : top)));
        const onCross = (p: { price: number; offsetY?: number }) => p.offsetY !== undefined && coords.calibrate(p.price, p.offsetY);
        chart.crossHairMoved().subscribe(null, onCross);
        offs.push(() => chart.crossHairMoved().unsubscribe(null, onCross));
        offs.push(coords.dispose);

        if (variant === "desktop") void w.headerReady().then(() => alive && headerButtons(w));
        setReady({ widget: w, iframe, coords });
      });
    });
    return () => {
      alive = false;
      // the frame may already be out of the page (the slot was removed): the library's API then throws
      for (const f of offs) {
        try {
          f();
        } catch {
          /* gone with the frame */
        }
      }
      if (widget) {
        try {
          widget.remove();
        } catch {
          /* already gone */
        }
      }
      feed?.dispose();
      shapes.current.clear();
      setReady(null);
    };
    // the theme, colours, tab, symbol and timeframe follow below without a new widget; a language needs one
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, variant]);

  // the slot goes away (layout, language): save its tab's layout while the frame is still in the page
  React.useLayoutEffect(
    () => () => {
      const w = readyRef.current?.widget;
      try {
        if (w) saveState(w, shown.current);
      } catch {
        /* the frame is already gone: the last autosave stands */
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, variant],
  );

  /** Saves a tab's layout, unless the tab was closed meanwhile. */
  const saveState = (w: TvWidget, tabId: string) => {
    if (!live.current.T.ws.tabs.some((x) => x.id === tabId)) return;
    w.save((s) => writeTvState(tabId, s));
  };

  /* ---------------- the context menu ---------------- */
  const contextItems = (price: number) => {
    const { T: Tm, t: tr, tab: tb } = live.current;
    live.current.onActivate();
    const item = (text: string, click: () => void) => ({ position: "top" as const, text, click });
    const sep = { position: "top" as const, text: "-", click: () => {} };
    if (Tm.guest) return [item(tr("chart.menu.openAccount"), openRegister), sep];
    if (Tm.readOnly) return [];
    const q = priceFeed().quote(tb.symbol);
    const p = roundPrice(tb.symbol, price);
    const ps = fmtPrice(tb.symbol, p);
    const lot = fmtVol(Tm.ws.lot);
    const place = (side: "buy" | "sell", type: "limit" | "stop") => {
      if (Tm.ws.oneClick) Tm.placeOrder({ symbol: tb.symbol, side, type, volume: Tm.ws.lot, price: p });
      else Tm.openNewOrder({ symbol: tb.symbol, side, type, price: p });
    };
    // below the price: buy limit and sell stop; above it: sell limit and buy stop (the others would be rejected)
    const orders = p < q.bid
      ? [item(tr("chart.menu.buyLimitAt", { lot, price: ps }), () => place("buy", "limit")), item(tr("chart.menu.sellStopAt", { lot, price: ps }), () => place("sell", "stop"))]
      : [item(tr("chart.menu.sellLimitAt", { lot, price: ps }), () => place("sell", "limit")), item(tr("chart.menu.buyStopAt", { lot, price: ps }), () => place("buy", "stop"))];
    return [
      ...orders,
      item(tr("chart.menu.newOrder"), () => Tm.openNewOrder({ symbol: tb.symbol })),
      item(tr("chart.menu.alertAt", { price: ps }), () => {
        Tm.addAlert({ symbol: tb.symbol, cond: p >= q.bid ? "above" : "below", price: p });
      }),
      sep,
    ];
  };

  /* ---------------- our buttons in the library's header ---------------- */
  const buttons = React.useRef<{ full?: HTMLElement; sell?: HTMLElement; buy?: HTMLElement; spread?: HTMLElement }>({});
  const headerButtons = (w: TvWidget) => {
    const tr = live.current.t;
    const make = (align: "left" | "right", html: string, title: string, onClick: (b: HTMLElement) => void, tone?: "accent") => {
      const b = w.createButton({ align, useTradingViewStyle: false });
      b.className = "ezx-btn";
      b.innerHTML = html;
      b.title = title;
      b.setAttribute("role", "button");
      b.setAttribute("aria-label", title);
      if (tone) b.dataset.tone = tone;
      b.addEventListener("click", () => onClick(b));
      return b;
    };
    // New order is not here: the same ticket is docked in the column beside the chart, and F9 or the command
    // palette still opens it as a popup for anyone who wants it over the plot.
    make("right", svg(ICON.bell), tr("trader.menu.priceAlerts"), () => openActivity(live.current.T, "alerts"));
    make("right", svg(ICON.layout), tr("desk.ch.layout"), (b) => {
      // our layout menu, under the button (the button lives in the chart's frame)
      const r = b.getBoundingClientRect();
      const f = host.current?.querySelector("iframe")?.getBoundingClientRect();
      if (f) live.current.cm.open({ clientX: f.left + r.left, clientY: f.top + r.bottom + 4 }, live.current.layoutItems);
    });
    const full = make("right", svg(ICON.max), tr("desk.ch.fullChart"), () => toggleFullChart(live.current.T));

    // Sell · spread · Buy, where the reference terminal keeps them. A click only ever *opens* the Trade column:
    // these are prices to read and a way in, never the order itself. One-click trading governs the ticket's own
    // Sell / Buy, which the trader is looking at when they press them - a header button they may have aimed at
    // the chart behind it must not be able to open a position.
    const quick = () => showSide(live.current.T, "order");
    const sell = make("right", `<span>${esc(tr("common.sell"))}</span><span class="ezx-px">\u2014</span>`, tr("common.sell"), quick);
    sell.dataset.tone = "sell";
    const spread = make("right", `<span class="ezx-px">\u2014</span>`, tr("desk.op.spread"), () => showSide(live.current.T, "order"));
    spread.dataset.tone = "spread";
    const buy = make("right", `<span>${esc(tr("common.buy"))}</span><span class="ezx-px">\u2014</span>`, tr("common.buy"), quick);
    buy.dataset.tone = "buy";

    buttons.current = { full, sell, buy, spread };
    paintQuote();
    syncButtons();
  };

  /** Writes the live prices into the header pair (text nodes only: they are not React's to re-render). */
  const paintQuote = () => {
    const { sell, buy, spread } = buttons.current;
    if (!sell && !buy && !spread) return;
    const { bid, ask } = quoteRef.current;
    const sym = live.current.tab.symbol;
    const px = (el: HTMLElement | undefined, v: number) => {
      const n = el?.querySelector(".ezx-px");
      if (n) n.textContent = v > 0 ? fmtPrice(sym, v) : "\u2014";
    };
    px(sell, bid);
    px(buy, ask);
    const n = spread?.querySelector(".ezx-px");
    if (n) n.textContent = bid > 0 && ask > 0 ? fmtVol(ask - bid).replace(/0+$/, "").replace(/\.$/, "") : "\u2014";
  };

  const full = T.ui.fullChart;
  // The ticket in the column carries the same Sell and Buy, on the same market, a few hundred pixels away. While it
  // is on screen the header pair is the same button twice, so it steps aside; it comes back when the column is
  // closed, showing another tab, or hidden behind Full chart - the cases where nothing else offers a side.
  const ticketDocked = T.ws.panels.watch && T.ws.side === "order" && !T.ui.fullChart;
  const syncButtons = () => {
    const { full: fb, sell, buy, spread } = buttons.current;
    const tr = live.current.t;
    const on = live.current.T.ui.fullChart;
    const Tm = live.current.T;
    const hidePair = Tm.ws.panels.watch && Tm.ws.side === "order" && !Tm.ui.fullChart;
    for (const b of [sell, spread, buy]) if (b) b.style.display = hidePair ? "none" : "";
    if (fb) {
      fb.innerHTML = svg(on ? ICON.min : ICON.max);
      fb.title = on ? tr("desk.ch.exitFullChart") : `${tr("desk.ch.fullChart")} (Shift+F)`;
      fb.setAttribute("aria-label", fb.title);
      fb.setAttribute("aria-pressed", String(on));
    }
  };
  React.useEffect(syncButtons, [full, T.readOnly, ready, ticketDocked]);

  /* ---------------- colours: theme, broker brand ---------------- */
  const applyColors = (w: TvWidget, c: Palette, box: boolean) => {
    for (const [k, v] of Object.entries(uiColors(c))) w.setCSSCustomProperty(k, v);
    w.setCSSCustomProperty("--ezx-legend-gap", box ? `${BOX_GAP}px` : "0px");
    w.applyOverrides(chartOverrides(c));
    w.applyStudiesOverrides(studyOverrides(c));
  };
  React.useEffect(() => {
    if (!ready || !wrap.current) return;
    const { widget: w } = ready;
    let raf = 0;
    const recolor = (theme: boolean) => {
      cancelAnimationFrame(raf);
      // one frame later: the new CSS variables are computed
      raf = requestAnimationFrame(() => {
        if (!wrap.current) return;
        const c = readPalette(wrap.current);
        palette.current = c;
        const apply = () => {
          applyColors(w, c, showBoxRef.current && variant === "desktop");
          for (const r of shapes.current.values()) r.key = "";
          syncShapes(w);
        };
        const want = c.dark ? "dark" : "light";
        if (theme && w.getTheme() !== want) void Promise.resolve(w.changeTheme(want, { disableUndo: true })).then(apply);
        else apply();
      });
    };
    recolor(true);
    // a broker's colours arrive as inline variables on <html>
    const obs = new MutationObserver(() => recolor(false));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, resolvedTheme]);
  React.useEffect(() => {
    ready?.widget.setCSSCustomProperty("--ezx-legend-gap", showBox && variant === "desktop" ? `${BOX_GAP}px` : "0px");
  }, [ready, showBox, variant]);

  /* ---------------- the slot's tab, symbol and timeframe ---------------- */
  React.useEffect(() => {
    if (!ready) return;
    const { widget: w } = ready;
    const chart = w.activeChart();
    const follow = () => {
      const { tab: tb } = live.current;
      const jobs: Promise<unknown>[] = [];
      if (tvSymbol(chart.symbol()) !== tb.symbol) jobs.push(chart.setSymbol(tb.symbol));
      if (resToTf(chart.resolution()) !== tb.tf) jobs.push(chart.setResolution(TF_RES[tb.tf]));
      return Promise.all(jobs);
    };
    if (shown.current !== tab.id) {
      // another tab in this slot: keep the old tab's layout, show the new one's (or a clean chart)
      const prev = shown.current;
      saveState(w, prev);
      shown.current = tab.id;
      const state = readTvState(tab.id) ?? blankState;
      syncing.current++;
      void Promise.resolve(state ? w.load(state) : undefined)
        .then(follow)
        .catch(() => undefined)
        .finally(() => {
          syncing.current--;
          redrawShapes();
        });
      return;
    }
    syncing.current++;
    void follow()
      .catch(() => undefined)
      .finally(() => syncing.current--);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tab.id, tab.symbol, tab.tf]);

  /* ---------------- trade lines as library shapes ---------------- */
  const syncShapes = (w: TvWidget) => {
    const c = palette.current;
    if (!c) return;
    let chart: TvChartApi;
    try {
      chart = w.activeChart();
    } catch {
      return;
    }
    const drop = (id: string) => {
      created.current.delete(id);
      try {
        chart.removeEntity(id, { disableUndo: true });
      } catch {
        /* already gone with a layout or symbol change */
      }
    };
    /** Removes shapes this chart drew that no record points at any more. Without it a handle lost on any path - a
     *  lookup that throws, a removal that throws while the map is cleared - leaves a line on the plot for good, and
     *  the next reconcile draws another in its place. */
    const sweepOrphans = () => {
      if (!created.current.size) return;
      const live = new Set<string>();
      for (const r of shapes.current.values()) if (r.entity) live.add(r.entity);
      for (const id of [...created.current]) if (!live.has(id)) drop(id);
    };
    // Bid and Ask: the two prices this account can trade at, each in the colour of the button that fills it.
    // Dashed, behind the trade lines, and never selectable - they are a readout, not something to drag.
    const c0 = palette.current;
    const q = quoteRef.current;
    const quoteLines: Shape[] =
      !c0 || !(q.bid > 0) || !(q.ask > 0)
        ? []
        : [
            { id: "q:bid", price: q.bid, color: c0.down, style: 1 },
            { id: "q:ask", price: q.ask, color: c0.buy, style: 1 },
          ];
    const all: Shape[] = [...drawnRef.current.map((l) => ({ id: l.id, price: l.price, color: lineColor(l.line, c, l.bad), style: l.line.kind === "pos" ? 0 : l.line.kind === "alert" ? 1 : 2 })), ...quoteLines];
    const want = new Map(all.map((l) => [l.id, l]));
    for (const [id, r] of shapes.current) {
      if (want.has(id)) continue;
      if (r.entity) drop(r.entity);
      shapes.current.delete(id);
    }
    for (const l of all) {
      const { color, style } = l;
      const key = `${color}|${style}`;
      const r = shapes.current.get(l.id);
      if (r) {
        if (!r.entity) continue; // being created: picks the latest up when it's there
        try {
          const s = chart.getShapeById(r.entity);
          if (r.price !== l.price) s.setPoints([{ price: l.price, time: s.getPoints()[0]?.time }]);
          if (r.key !== key) s.setProperties({ linecolor: color, linestyle: style, textcolor: color });
          r.price = l.price;
          r.key = key;
          continue;
        } catch {
          // the library will not resolve the handle (another symbol's layout loaded). It may still be drawing the
          // shape, so ask for it to go before forgetting it - otherwise the line below replaces a line that stays.
          drop(r.entity);
          shapes.current.delete(l.id);
        }
      }
      const rec = { entity: null as string | null, price: l.price, key };
      shapes.current.set(l.id, rec);
      const time = Math.floor(chart.getVisibleRange().to);
      void chart
        .createShape({ price: l.price, time }, { shape: "horizontal_line", lock: true, disableSelection: true, disableSave: true, disableUndo: true, showInObjectsTree: false, zOrder: "top", overrides: { linecolor: color, linestyle: style, linewidth: 1, showPrice: true, showLabel: false } })
        .then((id) => {
          created.current.add(id);
          if (shapes.current.get(l.id) !== rec) return drop(id);
          rec.entity = id;
          const now = all.find((x) => x.id === l.id);
          if (now && now.price !== rec.price) {
            rec.price = NaN;
            syncShapes(w);
          }
        })
        .catch(() => shapes.current.get(l.id) === rec && shapes.current.delete(l.id));
    }
    sweepOrphans();
  };
  /** Draws every line again (a new symbol or layout in the library drops shapes). */
  const redrawShapes = () => {
    const w = readyRef.current?.widget;
    if (!w) return;
    const chart = w.activeChart();
    for (const r of shapes.current.values()) {
      try {
        if (r.entity) chart.removeEntity(r.entity, { disableUndo: true });
      } catch {
        /* the layout already dropped it */
      }
    }
    shapes.current.clear();
    syncShapes(w);
  };
  // The quote the ticket shows, at most twice a second: enough for a line to look live, far less work than a
  // shape update per tick. `syncShapes` skips a shape whose price has not moved, so a quiet market costs nothing.
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    // a chart moved to another market has no executable price yet: drawing the last one would put gold's Bid on a
    // bitcoin chart until its first tick arrives
    quoteRef.current = { bid: 0, ask: 0 };
    const off = priceFeed().subscribe([tab.symbol], (x) => {
      quoteRef.current = { bid: x.bid, ask: x.ask };
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        paintQuote();
        const w = readyRef.current?.widget;
        if (w) syncShapes(w);
      }, 500);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.symbol]);

  const onLines = React.useCallback((lines: DrawnLine[]) => {
    drawnRef.current = lines;
    const w = readyRef.current?.widget;
    if (w) syncShapes(w);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => {
    if (ready) syncShapes(ready.widget);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  /* ---------------- toolbar, keys and commands reach the library ---------------- */
  React.useEffect(() => {
    if (!ready) return;
    const { widget: w } = ready;
    const chart = () => w.activeChart();
    const handle: ChartHandle = {
      zoom: (d) => {
        const r = chart().getVisibleRange();
        const span = (r.to - r.from) * (d > 0 ? 1 / 1.3 : 1.3);
        void chart().setVisibleRange({ from: r.to - span, to: r.to });
      },
      fit: () => chart().executeActionById("chartReset"),
      screenshot: () =>
        void w.takeClientScreenshot().then((canvas) => {
          canvas.toBlob((b) => {
            if (!b) return;
            const a = document.createElement("a");
            a.href = URL.createObjectURL(b);
            a.download = `${tab.symbol}_${tab.tf}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}.png`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 2000);
          });
          toast.success(t("chart.screenshot.saved"), { description: `${tab.symbol}, ${tab.tf} · ${canvas.width}×${canvas.height} PNG` });
        }),
      setRange: (seconds) => {
        const r = chart().getVisibleRange();
        void chart().setVisibleRange({ from: r.to - seconds, to: r.to });
      },
      tv: {
        indicators: () => chart().executeActionById("insertIndicator"),
        undo: () => chart().executeActionById("undo"),
        redo: () => chart().executeActionById("redo"),
        tool: (name) => void w.selectLineTool(name),
        removeDrawings: () => chart().getAllShapes().forEach((s) => ![...shapes.current.values()].some((r) => r.entity === s.id) && chart().removeEntity(s.id)),
        toggle: (what) => {
          const v = what === "magnet" ? w.magnetEnabled() : what === "lock" ? w.lockAllDrawingTools() : w.hideAllDrawingTools();
          v.setValue(!v.value());
        },
        addStudy: (type) => {
          const name = TV_STUDIES[type];
          if (!name) return chart().executeActionById("insertIndicator");
          void chart()
            .createStudy(name, false)
            .catch(() => chart().executeActionById("insertIndicator"));
        },
        chartType: (type) => chart().setChartType(({ bars: 0, candles: 1, line: 2, area: 3 } as const)[type]),
        settings: () => chart().executeActionById("chartProperties"),
      },
    };
    chartRegistry.set(tab.id, handle);
    return () => {
      if (chartRegistry.get(tab.id) === handle) chartRegistry.delete(tab.id);
    };
  }, [ready, tab.id, tab.symbol, tab.tf, t]);

  const boxTop = legendTop ?? (ready?.coords.frame()?.top ?? 38) + 30;
  return (
    <div
      ref={wrap}
      onPointerDown={onActivate}
      className={cn("relative h-full min-h-0 w-full select-none overflow-hidden rounded-[8px] border bg-[var(--t-chart-bg)]", highlight ? "border-ember/70 shadow-[0_0_0_1px_color-mix(in_oklab,var(--k-ember)_25%,transparent)]" : "border-line")}
      data-chart={tab.id}
      data-tv-chart
    >
      <div ref={host} className="absolute inset-0" />
      {ready && <TradeOverlay symbol={tab.symbol} coords={ready.coords} onActivate={onActivate} onLines={onLines} oneClick={showBox ? { top: boxTop, compact } : null} hidden={popup} />}
      {cm.node}
    </div>
  );
}

/** Keys of the terminal (shell/hotkeys.ts) that still work with the focus in the chart. The library keeps the rest:
 *  undo / redo, Delete, its Alt drawing keys, typing a resolution, Esc in its own menus. */
function forwardKey(e: KeyboardEvent, doc: Document): boolean {
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (e.key === "F1" || e.key === "F9" || e.key === "F10" || e.key === "F11") return true;
  if (mod && !e.altKey && k.length === 1 && "kimtbd".includes(k)) return true;
  if (e.altKey && /^Digit[1-4]$/.test(e.code)) return true;
  if (!mod && !e.altKey && e.shiftKey && (k === "f" || k === "h")) return true;
  if (!mod && !e.altKey && (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_")) return true;
  // Esc: ours (leave Full chart) unless one of the library's menus or dialogs is open
  if (e.key === "Escape") return !doc.querySelector("#overlap-manager-root > *, [data-dialog-name], [role=dialog]");
  return false;
}

/** Calls `on(true)` while one of the library's menus or dialogs is open (they render into its overlap root, created on
 *  first use): our chips and box sit above the frame and would cover them. Returns the cleanup. */
function watchPopups(doc: Document, on: (open: boolean) => void): () => void {
  let obs: MutationObserver | null = null;
  const find = () => {
    const root = doc.getElementById("overlap-manager-root");
    if (!root) return false;
    const check = () => on(root.childElementCount > 0);
    obs = new MutationObserver(check);
    obs.observe(root, { childList: true });
    check();
    return true;
  };
  const id = setInterval(() => find() && clearInterval(id), 400);
  return () => {
    clearInterval(id);
    obs?.disconnect();
  };
}

/** The bottom bar's clock reads server time; its label says "UTC" (the library's zone for the shifted bars): it gets
 *  the server's offset instead. Returns the cleanup. */
function zoneLabel(doc: Document): () => void {
  let obs: MutationObserver | null = null;
  const fix = (el: Element) => {
    const s = el.textContent ?? "";
    if (s.endsWith(" UTC")) el.textContent = `${s.slice(0, -3)}${serverZone()}`;
  };
  const find = () => {
    const el = doc.querySelector('[data-name="time-zone-menu"] .js-button-text');
    if (!el) return false;
    fix(el);
    obs = new MutationObserver(() => fix(el));
    obs.observe(el, { childList: true, characterData: true, subtree: true });
    return true;
  };
  const id = setInterval(() => find() && clearInterval(id), 500);
  return () => {
    clearInterval(id);
    obs?.disconnect();
  };
}

/**
 * The library's main pane in the overlay's pixels: its rect from the frame's DOM (same origin; re-measured on resize),
 * prices from the main price scale's visible range (normal, log, inverted; percentage and indexed scales hide the
 * lines), calibrated against the crosshair's reported position.
 */
function tvCoords(w: TvWidget, iframe: HTMLIFrameElement, onLegend: (bottom: number | null) => void) {
  const doc = iframe.contentDocument!;
  const win = iframe.contentWindow as Window & typeof globalThis;
  let rect: { top: number; left: number; width: number; height: number; scaleWidth: number } | null = null;
  let cal = 0;
  let observed: Element | null = null;
  const ro = new win.ResizeObserver(() => measure());
  const mainPane = () => {
    const panes = w.activeChart().getPanes();
    const i = panes.findIndex((p) => p.hasMainSeries());
    return { api: panes[i] ?? null, el: doc.querySelectorAll<HTMLElement>(".chart-markup-table.pane")[i] ?? null };
  };
  const measure = () => {
    let el: HTMLElement | null = null;
    try {
      el = mainPane().el;
    } catch {
      el = null;
    }
    if (!el) {
      rect = null;
      return;
    }
    if (observed !== el) {
      ro.disconnect();
      ro.observe(el);
      ro.observe(doc.body);
      observed = el;
    }
    const r = el.getBoundingClientRect();
    rect = { top: r.top, left: r.left, width: r.width, height: r.height, scaleWidth: doc.documentElement.clientWidth - (r.left + r.width) };
    const lg = doc.querySelector('[class*="legendMainSourceWrapper-"]');
    onLegend(lg ? Math.round(lg.getBoundingClientRect().bottom + 4) : null);
  };
  measure();
  // panes added or moved, the legend appearing, toolbars shown or hidden: a cheap re-measure every half second
  const poll = setInterval(measure, 500);

  const scale = () => {
    if (!rect) return null;
    try {
      const pane = mainPane().api;
      const s = pane?.getMainSourcePriceScale();
      const range = s?.getVisiblePriceRange();
      if (!pane || !s || !range) return null;
      const mode = s.getMode();
      if (mode >= 2) return null; // percentage / indexed to 100: prices aren't on the axis
      return { range, log: mode === 1, inverted: s.isInverted(), h: pane.getHeight() || rect.height, top: rect.top };
    } catch {
      return null;
    }
  };
  const toY = (sc: NonNullable<ReturnType<typeof scale>>, price: number) => {
    const v = (x: number) => (sc.log ? Math.log(x) : x);
    if (sc.log && price <= 0) return null;
    const hi = v(sc.range.to);
    const lo = v(sc.range.from);
    if (hi === lo) return null;
    const k = (hi - v(price)) / (hi - lo);
    return sc.top + (sc.inverted ? 1 - k : k) * sc.h;
  };

  return {
    frame(): PlotFrame | null {
      const sc = scale();
      if (!sc || !rect) return null;
      const r = rect;
      return {
        ...r,
        priceToY: (p) => {
          const y = toY(sc, p);
          return y === null ? null : y + cal;
        },
        yToPrice: (y) => {
          const hi = sc.log ? Math.log(sc.range.to) : sc.range.to;
          const lo = sc.log ? Math.log(sc.range.from) : sc.range.from;
          let k = (y - cal - sc.top) / sc.h;
          if (sc.inverted) k = 1 - k;
          const a = hi - k * (hi - lo);
          return sc.log ? Math.exp(a) : a;
        },
      };
    },
    /** the crosshair says where `price` is drawn: keep the small offset between our mapping and the library's */
    calibrate(price: number, offsetY: number) {
      const sc = scale();
      const y = sc && toY(sc, price);
      if (y == null) return;
      const err = offsetY - y;
      if (Math.abs(err) < 3) cal = cal * 0.7 + err * 0.3;
    },
    dispose() {
      clearInterval(poll);
      ro.disconnect();
    },
  };
}
