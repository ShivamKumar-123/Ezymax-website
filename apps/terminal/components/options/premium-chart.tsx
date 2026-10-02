"use client";

// The Chart tab of the options workspace. By default it charts the SELECTED OPTION'S PREMIUM (USD per contract):
// candles from the options service (`GET /v1/options/candles`, demo builds price them from the underlying's bars),
// drawn with the terminal's chart setup (lightweight-charts, same palette, axes, server-time clock and watermark), the
// last bar moved tick by tick by the chain's mark so it follows the underlying and decays towards the cut; the cut is
// marked on the time axis and counted down in the legend with the strike and breakeven. "Premium | Underlying"
// switches to the underlying's chart with strike / breakeven / barrier lines. Without a selected option, or while
// the premium candles aren't served (404 before the service ships them), the underlying shows with a note.
import * as React from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type IPanePrimitive,
  type IPanePrimitivePaneView,
  type IPriceLine,
  type IPrimitivePaneRenderer,
  type ISeriesApi,
  type Logical,
  type PaneAttachedParameter,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { usdPerUnitOfQuote } from "@/lib/options/normalize";
import { Info, MousePointerClick, Table2 } from "lucide-react";
import { OPTION_SPEC, cutInstant, parseSeriesCode } from "@kalks/mock/options";
import { cn } from "@kalks/ui";
import { useLocale, useT } from "@kalks/i18n/react";
import { readPalette, toChartTime, fromChartTime, type Palette } from "@/components/chart/engine";
import { BrandWatermark } from "@/components/chart/brand-watermark";
import { useTerminal } from "@/lib/store";
import { TF_SECONDS, type Timeframe } from "@/lib/trading";
import { optionsApi } from "@/lib/options/api";
import { useOptionBook } from "@/lib/options/book";
import { OPTION_TFS, getOpt, onOptChange, opt, quoteOf, useOpt, useSeriesQuote, type ChartMode } from "@/lib/options-store";
import { Countdown, RightTag, Seg } from "./bits";
import { expiryLabel, px, usd } from "./format";
import { UnderlyingChart } from "./underlying-chart";

const TF_MIN: Partial<Record<Timeframe, number>> = { M1: 1, M5: 5, M15: 15, M30: 30, H1: 60, H4: 240, D1: 1440 };

interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** underlying close */
  u: number | null;
}

type Status = "loading" | "ready" | "unavailable";

/* ------------------------------------------------------------------ */
/* Legend store (values change every tick: read by small leaves)       */
/* ------------------------------------------------------------------ */

interface Legend {
  bar: Bar | null;
}
function createLegendStore() {
  let v: Legend = { bar: null };
  const subs = new Set<() => void>();
  return {
    get: () => v,
    set: (n: Legend) => {
      v = n;
      subs.forEach((f) => f());
    },
    subscribe: (f: () => void) => {
      subs.add(f);
      return () => void subs.delete(f);
    },
  };
}
type LegendStore = ReturnType<typeof createLegendStore>;

/* ------------------------------------------------------------------ */
/* Expiry marker: dashed line + label at the cut on the time axis       */
/* ------------------------------------------------------------------ */

type Target = Parameters<IPrimitivePaneRenderer["draw"]>[0];

interface MarkerOpts {
  x: () => number | null;
  label: string;
  color: string;
  font: string;
}

class ExpiryMarker implements IPanePrimitive<Time> {
  private req: (() => void) | null = null;
  private xNow: number | null = null;
  private view: IPanePrimitivePaneView;
  constructor(public o: MarkerOpts) {
    const self = this;
    const renderer: IPrimitivePaneRenderer = {
      draw(target: Target) {
        const x = self.xNow;
        if (x === null) return;
        target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
          const { width: w, height: h } = mediaSize;
          if (x < -2 || x > w + 2) return;
          const c = self.o.color;
          ctx.save();
          // after the cut: a faint wash
          ctx.globalAlpha = 0.07;
          ctx.fillStyle = c;
          ctx.fillRect(x, 0, Math.max(0, w - x), h);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = c;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(Math.round(x) + 0.5, 0);
          ctx.lineTo(Math.round(x) + 0.5, h);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = `600 10px ${self.o.font}`;
          // the label sits at the bottom of the pane (the legend takes the top-left)
          const tw = ctx.measureText(self.o.label).width + 10;
          const lx = Math.max(2, Math.min(x - tw / 2, w - tw - 2));
          const ly = Math.max(4, h - 22);
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.roundRect(lx, ly, tw, 16, 3);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.textBaseline = "middle";
          ctx.fillText(self.o.label, lx + 5, ly + 8.5);
          ctx.restore();
        });
      },
    };
    this.view = { zOrder: () => "top", renderer: () => renderer };
  }
  attached(p: PaneAttachedParameter<Time>) {
    this.req = p.requestUpdate;
  }
  detached() {
    this.req = null;
  }
  updateAllViews() {
    this.xNow = this.o.x();
  }
  paneViews() {
    return [this.view];
  }
  apply(o: Partial<MarkerOpts>) {
    Object.assign(this.o, o);
    this.req?.();
  }
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

interface PremiumEngine {
  chart: IChartApi;
  main: ISeriesApi<"Candlestick">;
  palette: Palette;
  alive: { current: boolean };
  usdPerUnit: number;
}

/** if the service doesn't serve premium candles (404 before it ships them), don't ask again for a few minutes */
let premiumOffAt = 0;
const premiumOff = () => Date.now() - premiumOffAt < 5 * 60_000;

function usePremiumChart(
  el: React.RefObject<HTMLDivElement | null>,
  o: { code: string; tf: Timeframe; login: string; cutMs: number; markerLabel: string; title: string; name: string; legend: LegendStore; onStatus: (s: Status) => void },
) {
  const [engine, setEngine] = React.useState<PremiumEngine | null>(null);
  const opts = React.useRef(o);
  opts.current = o;
  React.useEffect(() => {
    const host = el.current;
    if (!host) return;
    const { code, tf, login, cutMs } = opts.current;
    const step = TF_SECONDS[tf];
    const alive = { current: true };
    let dispose = () => {};
    opts.current.onStatus("loading");
    void optionsApi.candles(login, code, TF_MIN[tf] ?? 15, { limit: 600 }).then((r) => {
      if (!alive.current) return;
      if (!r.ok) {
        // not served yet (404 before the service ships premium candles): don't ask again for a while
        if (r.err.status === 404) premiumOffAt = Date.now();
        return opts.current.onStatus("unavailable");
      }
      const seen = new Set<number>();
      const data: Bar[] = r.data.candles
        .map((c) => ({ time: toChartTime(c.t), open: c.o, high: c.h, low: c.l, close: c.c, u: Number.isFinite(c.u) ? c.u : null }))
        .filter((b) => Number.isFinite(b.close) && !seen.has(b.time) && (seen.add(b.time), true))
        .sort((a, b) => a.time - b.time);
      // USD per contract for one unit of premium (usdPerUnit = USD per unit of the quote currency)
      dispose = build(host, data, (r.data.contractSize || 0) * (r.data.usdPerUnit || 0));
      opts.current.onStatus("ready");
    });

    function build(host: HTMLDivElement, data: Bar[], usdPerUnit: number) {
      let c = readPalette(host);
      const sans = getComputedStyle(document.body).getPropertyValue("--font-geist-sans").trim().replace(/"/g, "'") || "system-ui";
      const line = () => (c.dark ? "rgba(255,255,255,0.07)" : "rgba(15,15,20,0.1)");
      // a cut within ~60 bars stays in view: room on the right up to it
      const cutChart = toChartTime(Math.floor(cutMs / 1000));
      const ahead = data.length ? (cutChart - data[data.length - 1]!.time) / step : Infinity;
      const rightOffset = ahead > 0 && ahead <= 60 ? Math.ceil(ahead) + 4 : 12;
      const chart = createChart(host, {
        autoSize: true,
        layout: { background: { type: ColorType.Solid, color: c.bg }, textColor: c.fg3, fontFamily: c.mono, fontSize: 10.5, attributionLogo: false },
        grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
        rightPriceScale: { borderVisible: true, borderColor: line(), scaleMargins: { top: 0.16, bottom: 0.1 }, minimumWidth: 68 },
        timeScale: { borderVisible: true, borderColor: line(), timeVisible: step < 86400, secondsVisible: false, rightOffset, barSpacing: 7, minBarSpacing: 1.5 },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: c.fg3, width: 1, style: LineStyle.Dashed, labelBackgroundColor: c.label },
          horzLine: { color: c.fg3, width: 1, style: LineStyle.Dashed, labelBackgroundColor: c.label },
        },
        localization: { priceFormatter: (p: number) => p.toFixed(2) },
      });
      const main = chart.addSeries(CandlestickSeries, { upColor: c.up, downColor: c.down, borderVisible: false, wickUpColor: c.up, wickDownColor: c.down, priceFormat: { type: "price", precision: 2, minMove: 0.01 }, priceLineVisible: false, lastValueVisible: false });
      const point = (b: Bar) => ({ time: b.time as UTCTimestamp, open: b.open, high: b.high, low: b.low, close: b.close });
      main.setData(data.map(point));
      // a premium is never negative: keep the scale's floor at zero
      main.applyOptions({
        autoscaleInfoProvider: (orig: () => { priceRange: { minValue: number; maxValue: number } | null } | null) => {
          const r = orig();
          if (r?.priceRange) r.priceRange.minValue = Math.max(0, r.priceRange.minValue);
          return r;
        },
      });

      const watermark = new BrandWatermark({ symbol: opts.current.title, tf, name: opts.current.name, dark: c.dark, font: `${sans}, system-ui, sans-serif` });
      chart.panes()[0]!.attachPrimitive(watermark);

      // the cut on the time axis (projected past the last bar at one bar per timeframe step)
      const marker = new ExpiryMarker({
        x: () => {
          const n = data.length;
          if (!n) return null;
          const ahead = (cutChart - data[n - 1]!.time) / step;
          return chart.timeScale().logicalToCoordinate((n - 1 + ahead) as Logical);
        },
        label: opts.current.markerLabel,
        color: c.warn,
        font: `${sans}, system-ui, sans-serif`,
      });
      chart.panes()[0]!.attachPrimitive(marker);
      chart.timeScale().scrollToRealTime();
      const raf = requestAnimationFrame(() => {
        chart.timeScale().applyOptions({ barSpacing: 7, rightOffset });
        chart.timeScale().scrollToRealTime();
      });

      // the option's bid / ask per contract, like the bid / ask lines of the CFD charts
      const q0 = quoteOf(code);
      // an empty side of the order book (0) has no line
      const bidLine = main.createPriceLine({ price: q0?.bidUsd || q0?.markUsd || 0, color: c.fg2, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: !!q0 && q0.bidUsd > 0, lineVisible: !!q0 && q0.bidUsd > 0, title: "", axisLabelColor: c.fg2, axisLabelTextColor: c.dark ? "#0a0a0d" : "#fff" });
      const askLine = main.createPriceLine({ price: q0?.askUsd || q0?.markUsd || 0, color: c.down, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: !!q0 && q0.askUsd > 0, lineVisible: !!q0 && q0.askUsd > 0, title: "", axisLabelColor: c.down, axisLabelTextColor: "#fff" });

      /* legend: hovered bar, else the forming one */
      let hovering = -1;
      const legendAt = (i: number) => opts.current.legend.set({ bar: data[i] ?? null });
      legendAt(data.length - 1);
      chart.subscribeCrosshairMove((p) => {
        if (p.logical === undefined || p.logical === null || !p.time) {
          hovering = -1;
          return legendAt(data.length - 1);
        }
        hovering = Math.max(0, Math.min(data.length - 1, Math.round(p.logical)));
        legendAt(hovering);
      });

      /* live: the chain's mark moves the forming bar (new bars on the history's own time grid) */
      let lastMark = NaN;
      const tick = () => {
        if (!alive.current) return;
        const q = quoteOf(code);
        if (!q) return;
        bidLine.applyOptions({ price: q.bidUsd || q.markUsd, axisLabelVisible: q.bidUsd > 0, lineVisible: q.bidUsd > 0 });
        askLine.applyOptions({ price: q.askUsd || q.markUsd, axisLabelVisible: q.askUsd > 0, lineVisible: q.askUsd > 0 });
        const mark = q.markUsd;
        if (!(mark >= 0) || mark === lastMark) return;
        lastMark = mark;
        const s = getOpt();
        const spot = s.chain && s.chain.underlying === parseSeriesCode(code)?.underlying ? (s.chain.spot?.mid ?? null) : null;
        const now = toChartTime(Math.floor(Math.min(Date.now(), cutMs) / 1000));
        const last = data[data.length - 1];
        let bar: Bar;
        if (!last) {
          bar = { time: Math.floor(now / step) * step, open: mark, high: mark, low: mark, close: mark, u: spot };
          data.push(bar);
        } else if (now >= last.time + step) {
          bar = { time: last.time + Math.floor((now - last.time) / step) * step, open: last.close, high: Math.max(last.close, mark), low: Math.min(last.close, mark), close: mark, u: spot };
          data.push(bar);
        } else {
          bar = { ...last, high: Math.max(last.high, mark), low: Math.min(last.low, mark), close: mark, u: spot ?? last.u };
          data[data.length - 1] = bar;
        }
        main.update(point(bar));
        if (hovering < 0) legendAt(data.length - 1);
      };
      tick();
      const unsub = onOptChange(tick);

      /* scroll back: older candles when the left edge comes into view */
      let loadingOlder = false;
      let exhausted = data.length < 50;
      const onRange = (rg: { from: number; to: number } | null) => {
        if (!rg || exhausted || loadingOlder || rg.from > 30 || !data.length) return;
        loadingOlder = true;
        const first = data[0]!.time;
        void optionsApi.candles(login, code, TF_MIN[tf] ?? 15, { limit: 600, to: fromChartTime(first) - 1 }).then((r) => {
          loadingOlder = false;
          if (!alive.current) return;
          const add = r.ok ? r.data.candles.map((x) => ({ time: toChartTime(x.t), open: x.o, high: x.h, low: x.l, close: x.c, u: x.u })).filter((b) => b.time < first) : [];
          if (!add.length) {
            exhausted = true;
            return;
          }
          data.unshift(...add.sort((a, b) => a.time - b.time));
          main.setData(data.map(point));
        });
      };
      chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);

      /* theme: recolour in place */
      const applyTheme = () => {
        c = readPalette(host);
        chart.applyOptions({
          layout: { background: { type: ColorType.Solid, color: c.bg }, textColor: c.fg3 },
          grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
          rightPriceScale: { borderColor: line() },
          timeScale: { borderColor: line() },
          crosshair: { vertLine: { color: c.fg3, labelBackgroundColor: c.label }, horzLine: { color: c.fg3, labelBackgroundColor: c.label } },
        });
        main.applyOptions({ upColor: c.up, downColor: c.down, wickUpColor: c.up, wickDownColor: c.down });
        askLine.applyOptions({ color: c.down, axisLabelColor: c.down });
        bidLine.applyOptions({ color: c.fg2, axisLabelColor: c.fg2, axisLabelTextColor: c.dark ? "#0a0a0d" : "#fff" });
        watermark.applyOptions({ dark: c.dark });
        marker.apply({ color: c.warn });
        setEngine((e) => (e && e.chart === chart ? { ...e, palette: c } : e));
      };
      let themeRaf = 0;
      const themeObs = new MutationObserver(() => {
        cancelAnimationFrame(themeRaf);
        themeRaf = requestAnimationFrame(applyTheme);
      });
      themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });

      setEngine({ chart, main, palette: c, alive, usdPerUnit });
      return () => {
        themeObs.disconnect();
        cancelAnimationFrame(themeRaf);
        cancelAnimationFrame(raf);
        unsub();
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
        chart.remove();
      };
    }

    return () => {
      alive.current = false;
      dispose();
      setEngine(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.code, o.tf, o.login]);
  return engine;
}

/* ------------------------------------------------------------------ */
/* Premium chart                                                       */
/* ------------------------------------------------------------------ */

function LegendOhlc({ store, digits }: { store: LegendStore; digits: number }) {
  const t = useT();
  const v = React.useSyncExternalStore(store.subscribe, store.get, store.get);
  const b = v.bar;
  if (!b) return null;
  const up = b.close >= b.open;
  return (
    <>
      {(["open", "high", "low", "close"] as const).map((k) => (
        <span key={k} className="k-num">
          {k[0]!.toUpperCase()}
          <span className={cn("ms-1", up ? "text-up" : "text-down")}>{usd(b[k])}</span>
        </span>
      ))}
      {b.u !== null && (
        <span className="k-num">
          {t("trader.opt.col.underlying")} <span className="text-fg-2">{b.u.toFixed(digits)}</span>
        </span>
      )}
    </>
  );
}

/** No candle yet (no history and no live price for this option). */
function EmptyNote({ store }: { store: LegendStore }) {
  const t = useT();
  const v = React.useSyncExternalStore(store.subscribe, store.get, store.get);
  if (v.bar) return null;
  return <div className="pointer-events-none absolute inset-x-0 top-1/2 z-[4] text-center text-[11.5px] text-fg-3">{t("trader.opt.chart.empty")}</div>;
}

export function PremiumChart({ code, tf, onUnavailable, className }: { code: string; tf: Timeframe; onUnavailable: () => void; className?: string }) {
  const t = useT();
  const T = useTerminal();
  const { locale } = useLocale();
  const el = React.useRef<HTMLDivElement>(null);
  const p = parseSeriesCode(code);
  const digits = OPTION_SPEC[p?.underlying ?? ""]?.digits ?? 5;
  const q = useSeriesQuote(code);
  const cutTime = useOpt((s) => s.chain?.cut.time ?? "10:00");
  const cutMs = useOpt((s) => {
    const e = s.expiries.find((x) => x.date === p?.date && s.u === p?.underlying);
    return e ? Date.parse(e.cutAt) : 0;
  });
  const cut = cutMs || (p ? cutInstant(p.date) : Date.now());
  const legend = React.useMemo(createLegendStore, []);
  const [status, setStatus] = React.useState<Status>("loading");
  const onStatus = React.useCallback(
    (s: Status) => {
      setStatus(s);
      if (s === "unavailable") onUnavailable();
    },
    [onUnavailable],
  );
  const rightWord = p?.right === "put" ? t("trader.opt.put") : t("trader.opt.call");
  const title = p ? `${p.underlying} ${p.strikeLabel} ${p.right === "put" ? "P" : "C"}` : code;
  const engine = usePremiumChart(el, {
    code,
    tf,
    login: T.guest ? "" : T.account.login,
    cutMs: cut,
    markerLabel: `${t("trader.opt.col.expiry")} · ${cutTime} NY`,
    title,
    name: t("trader.opt.chart.unit"),
    legend,
    onStatus,
  });
  // open premium of this account's positions in the series (USD per contract)
  const book = useOptionBook(T.guest ? null : T.account.login);
  const lines = React.useRef<{ owner: unknown; map: Map<string, IPriceLine> }>({ owner: null, map: new Map() });
  React.useEffect(() => {
    if (!engine || !engine.alive.current) return;
    if (lines.current.owner !== engine.chart) lines.current = { owner: engine.chart, map: new Map() };
    const map = lines.current.map;
    const usdU = engine.usdPerUnit || usdPerUnitOfQuote(q);
    const want = new Map(book.positions.filter((x) => x.option.series === code && usdU > 0).map((x) => [x.ticket, x]));
    for (const [id, pl] of map) {
      if (want.has(id)) continue;
      try {
        engine.main.removePriceLine(pl);
      } catch {
        /* chart rebuilt */
      }
      map.delete(id);
    }
    const c = engine.palette;
    for (const [id, x] of want) {
      const opts = { price: x.openPrice * usdU, color: c.fg, lineWidth: 1 as const, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: `#${x.ticket} ${x.side === "buy" ? "B" : "S"} ${x.contracts}`, axisLabelColor: c.fg2, axisLabelTextColor: c.dark ? "#0a0a0d" : "#fff" };
      const ex = map.get(id);
      if (ex) ex.applyOptions(opts);
      else map.set(id, engine.main.createPriceLine(opts));
    }
  }, [engine, book.positions, code, q]);

  return (
    <div className={cn("relative h-full min-h-0", className)}>
      <div ref={el} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-2 top-1.5 z-[5] max-w-[calc(100%-90px)]">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono text-[10.5px] leading-4 text-fg-3">
          <span className="flex items-center gap-1.5 font-sans text-[11.5px] font-semibold text-fg">
            {p && <RightTag right={p.right} />}
            {p ? `${p.underlying} ${p.strikeLabel} ${rightWord}` : code}
            <span className="font-normal text-fg-3">· {p ? expiryLabel(p.date, locale) : ""}, {tf}</span>
          </span>
          <span className="font-sans text-fg-3">{t("trader.opt.chart.unit")}</span>
          <LegendOhlc store={legend} digits={digits} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1 font-mono text-[10px]">
          {p && (
            <span className="rounded-[4px] border border-gold/30 bg-gold-soft/40 px-1.5 py-px text-fg-2">
              <span className="font-sans text-fg-3">{t("trader.opt.line.strike")}</span> {p.strikeLabel}
            </span>
          )}
          {q && (
            <span className="rounded-[4px] border border-ember/30 bg-ember-soft/40 px-1.5 py-px text-fg-2" title={t("trader.opt.col.beHint")}>
              <span className="font-sans text-fg-3">{t("trader.opt.line.be")}</span> {px(q.breakeven, digits)}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-[4px] border border-warn/30 bg-warn-soft/50 px-1.5 py-px text-fg-2" title={t("trader.opt.cutHint", { time: cutTime })}>
            <span className="font-sans text-fg-3">{t("trader.opt.cutIn")}</span>
            <Countdown to={cut} className="text-[10px]" />
          </span>
        </div>
      </div>
      {status === "loading" && <div className="absolute inset-0 z-[4] grid place-items-center text-[11.5px] text-fg-3">{t("trader.opt.chart.loading")}</div>}
      {status === "ready" && <EmptyNote store={legend} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The Chart tab                                                       */
/* ------------------------------------------------------------------ */

/** Header (Premium | Underlying, timeframes) + the premium or underlying chart, with the hint / fallback notes. */
export function OptionChartPane({ compact }: { compact?: boolean }) {
  const t = useT();
  const sel = useOpt((s) => s.sel);
  const u = useOpt((s) => s.u);
  const tf = useOpt((s) => s.prefs.tf);
  const mode = useOpt((s) => s.prefs.chartMode);
  const selQ = parseSeriesCode(sel ?? "");
  const own = !!selQ && selQ.underlying === u;
  const [off, setOff] = React.useState(premiumOff);
  const premium = mode === "premium" && own && !off;
  const onUnavailable = React.useCallback(() => setOff(true), []);
  const setMode = (m: ChartMode) => {
    if (m === "premium" && off) {
      premiumOffAt = 0;
      setOff(false);
    }
    opt.setPrefs({ chartMode: m });
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-1 overflow-x-auto border-b border-line px-1.5 [scrollbar-width:none]">
        <Seg<ChartMode>
          size="sm"
          className={compact ? "w-[156px] shrink-0" : "w-[176px] shrink-0"}
          value={mode === "premium" && !off ? "premium" : "underlying"}
          onChange={setMode}
          options={[
            { value: "premium", label: t("trader.opt.chart.premium"), title: t("trader.opt.chart.premiumHint") },
            { value: "underlying", label: t("trader.opt.col.underlying") },
          ]}
        />
        <span className="mx-1 h-4 w-px shrink-0 bg-line" />
        {OPTION_TFS.map((x) => (
          <button key={x} onClick={() => opt.setPrefs({ tf: x })} className={cn("h-6 shrink-0 rounded-[5px] px-[7px] font-mono text-[11px] font-medium transition-colors", tf === x ? "bg-ember-soft text-ember" : "text-fg-3 hover:bg-surface-3 hover:text-fg")}>
            {x}
          </button>
        ))}
        {!premium && !compact && (
          <span className="ms-auto hidden shrink-0 items-center gap-2.5 ps-2 text-[10px] text-fg-3 min-[1500px]:flex">
            <span className="flex items-center gap-1">
              <span className="w-3 border-t border-dashed border-gold" /> {t("trader.opt.line.strike")}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 border-t border-dotted border-ember" /> {t("trader.opt.line.be")}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 border-t border-fg-2" /> {t("trader.opt.line.position")}
            </span>
          </span>
        )}
      </div>
      <div className="relative min-h-0 flex-1">
        {premium && sel ? (
          <PremiumChart key={`${sel}|${tf}`} code={sel} tf={tf} onUnavailable={onUnavailable} />
        ) : (
          <>
            <UnderlyingChart bare />
            {mode === "premium" && (!own || off) && (
              <div className="pointer-events-none absolute inset-x-0 top-10 z-[6] flex justify-center px-3">
                <div className="pointer-events-auto flex max-w-[460px] items-center gap-2 rounded-[8px] border border-line-top bg-panel-2/95 px-3 py-2 text-[11.5px] text-fg-2 shadow-[0_10px_30px_-14px_rgba(0,0,0,0.6)] backdrop-blur">
                  {off && own ? <Info className="size-4 shrink-0 text-fg-3" /> : <MousePointerClick className="size-4 shrink-0 text-ember" />}
                  <span className="min-w-0">{off && own ? t("trader.opt.chart.fallback") : t("trader.opt.chart.selectHint")}</span>
                  {!(off && own) && (
                    <button onClick={() => opt.setCenter("chain")} className="ms-1 inline-flex h-6 shrink-0 items-center gap-1 rounded-[6px] bg-ember px-2 text-[11px] font-semibold text-white hover:brightness-110">
                      <Table2 className="size-3" /> {t("trader.opt.chainTitle")}
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

