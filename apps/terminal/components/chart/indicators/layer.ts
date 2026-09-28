import {
  HistogramSeries,
  LineSeries,
  LineStyle,
  LineType,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type PriceFormat,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  INDICATOR_DEFS,
  IndicatorComputation,
  indicatorLabel,
  normalizeParams,
  type Bar,
  type ColorToken,
  type IndicatorDef,
  type IndicatorInstance,
  type IndicatorType,
  type OutputDef,
  type ValueFormat,
} from "@/lib/indicators";
import type { Palette } from "../engine";
import { BandFill } from "./band-fill";

/* ------------------------------------------------------------------ */
/* Colours & formatting                                                */
/* ------------------------------------------------------------------ */

export type TokenMap = Record<ColorToken, string>;

export function tokenMap(p: Palette): TokenMap {
  let info = "#38bdf8";
  if (typeof document !== "undefined") info = getComputedStyle(document.documentElement).getPropertyValue("--k-info").trim() || info;
  return { ember: p.ember, gold: p.gold, up: p.up, down: p.down, warn: p.warn, info, fg: p.fg, fg2: p.fg2, fg3: p.fg3 };
}

export const resolveColor = (c: string, t: TokenMap) => (c in t ? t[c as ColorToken] : c);

/** Any #rgb/#rrggbb/rgb()/rgba() colour with a new alpha. */
export function withAlpha(c: string, a: number): string {
  if (c.startsWith("#")) {
    let h = c.slice(1);
    if (h.length === 3) h = [...h].map((x) => x + x).join("");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b] = m[1]!.split(",").map((x) => x.trim());
    return `rgba(${r},${g},${b},${a})`;
  }
  return c;
}

export function fmtValue(v: number, f: ValueFormat | undefined, digits: number): string {
  if (!Number.isFinite(v)) return "—";
  if (f === "vol") {
    const a = Math.abs(v);
    if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
    if (a >= 1e4) return `${(v / 1e3).toFixed(1)}K`;
    return v.toFixed(0);
  }
  if (typeof f === "number") return v.toFixed(f);
  return v.toFixed(Math.min(8, f === "price+" ? digits + 1 : digits));
}

function priceFormat(f: ValueFormat | undefined, digits: number): PriceFormat {
  if (f === "vol") return { type: "volume", precision: 0, minMove: 1 };
  const p = typeof f === "number" ? f : Math.min(8, f === "price+" ? digits + 1 : digits);
  return { type: "price", precision: p, minMove: 1 / 10 ** p };
}

/* ------------------------------------------------------------------ */
/* Layer                                                               */
/* ------------------------------------------------------------------ */

export interface IndLegendValue {
  label: string;
  text: string;
  color: string;
}

export interface IndLegendRow {
  uid: string;
  type: IndicatorType;
  label: string;
  /** Pane index the instance lives in, or -1 when hidden. */
  pane: number;
  visible: boolean;
  color: string;
  values: IndLegendValue[];
}

type AnySeries = ISeriesApi<"Line"> | ISeriesApi<"Histogram">;

interface OutRT {
  def: OutputDef;
  series: AnySeries;
  shift: number;
  color: string;
  visible: boolean;
  markers?: ISeriesMarkersPluginApi<Time>;
  markerSig?: string;
  /** Last plotted point (skip no-op updates). */
  lastJ: number;
  lastV: number;
}

interface Mat {
  inst: IndicatorInstance;
  def: IndicatorDef;
  comp: IndicatorComputation;
  outs: OutRT[];
  levels: IPriceLine[];
  fills: BandFill[];
  pk: string;
  sk: string;
  lk: string;
  len: number;
  /** Computed but not yet drawn range. */
  pend: { from: number; full: boolean; grew: boolean } | null;
}

export interface IndicatorLayer {
  /** Diff the instance list against what is on the chart (add / remove / restyle / recompute). */
  sync: (list: IndicatorInstance[]) => void;
  /** Bars changed: incremental when only the tail moved, full pass after history changes. */
  update: () => void;
  /** Force a full recompute (e.g. after scroll-back replaced history). */
  reset: () => void;
  legend: (i: number) => IndLegendRow[];
  setPalette: (p: Palette) => void;
  count: () => number;
}

const T = (x: number) => x as UTCTimestamp;

/**
 * Values are recomputed synchronously on every tick (cheap: ~15 µs for all 35 types), but series writes are coalesced
 * to one flush per FLUSH_MS. Every series.update() makes lightweight-charts re-run its crosshair hit-test, which rebuilds
 * that series' points; with 30+ indicator series and the cursor over the chart, per-tick writes would cost O(series · n).
 */
const FLUSH_MS = 80;

export function createIndicatorLayer(o: { chart: IChartApi; bars: () => Bar[]; step: number; digits: number; palette: Palette; alive?: () => boolean; onChange?: () => void }): IndicatorLayer {
  const { chart } = o;
  let tokens = tokenMap(o.palette);
  const mats = new Map<string, Mat>();
  let order: IndicatorInstance[] = [];

  const timeAt = (j: number) => {
    const b = o.bars();
    const n = b.length;
    return j < n ? b[j]!.time : b[n - 1]!.time + (j - (n - 1)) * o.step;
  };

  const outColor = (inst: IndicatorInstance, od: OutputDef) => resolveColor(inst.style?.[od.key]?.color ?? od.color, tokens);

  const histColor = (rt: OutRT, vals: number[], i: number) => {
    const v = vals[i]!;
    let up = true;
    if (rt.def.histColor === "sign") up = v >= 0;
    else if (rt.def.histColor === "trend") {
      const p = i > 0 ? vals[i - 1]! : NaN;
      up = Number.isNaN(p) || v >= p;
    } else return withAlpha(rt.color, 0.7);
    return withAlpha(up ? tokens.up : tokens.down, 0.7);
  };

  const point = (m: Mat, rt: OutRT, vals: number[], i: number) => {
    const time = T(timeAt(i + rt.shift));
    const v = vals[i]!;
    if (Number.isNaN(v)) return { time };
    if (rt.def.kind === "hist") return { time, value: v, color: histColor(rt, vals, i) };
    return { time, value: v };
  };

  const setMarkers = (m: Mat, rt: OutRT, vals: number[], force: boolean) => {
    const idx: number[] = [];
    for (let i = 0; i < vals.length; i++) if (!Number.isNaN(vals[i]!)) idx.push(i);
    const sig = idx.join(",");
    if (!force && sig === rt.markerSig) return;
    rt.markerSig = sig;
    const b = o.bars();
    (rt.series as ISeriesApi<"Line">).setData(idx.map((i) => ({ time: T(b[i]!.time), value: vals[i]! })));
    const up = rt.def.marker === "up";
    const mk: SeriesMarker<Time>[] = idx.map((i) => ({ time: T(b[i]!.time), position: up ? "aboveBar" : "belowBar", shape: up ? "arrowUp" : "arrowDown", color: rt.color, size: 0.6 }));
    rt.markers?.setMarkers(mk);
  };

  const setAll = (m: Mat, rt: OutRT) => {
    const vals = m.comp.outs[rt.def.key]!;
    if (rt.def.kind === "markers") return setMarkers(m, rt, vals, true);
    const pts = [];
    for (let i = Math.max(0, -rt.shift); i < vals.length; i++) pts.push(point(m, rt, vals, i));
    (rt.series as ISeriesApi<"Line">).setData(pts as never);
    rt.lastJ = vals.length - 1 + rt.shift;
    rt.lastV = vals[vals.length - 1] ?? NaN;
  };

  /** Run the maths (incremental unless forced) and remember what needs drawing. */
  const compute = (m: Mat, force: boolean) => {
    const bars = o.bars();
    if (!bars.length) return;
    if (force) m.comp.reset();
    const prevLen = m.len;
    const r = m.comp.run(bars);
    m.len = bars.length;
    const grew = bars.length !== prevLen;
    const p = m.pend;
    m.pend = p ? { from: Math.min(p.from, r.from), full: p.full || r.full, grew: p.grew || grew } : { from: r.from, full: r.full, grew };
  };

  /** Push the pending range to the chart series. */
  const draw = (m: Mat) => {
    const p = m.pend;
    if (!p) return;
    m.pend = null;
    for (const rt of m.outs) {
      const vals = m.comp.outs[rt.def.key]!;
      if (p.full || (rt.shift !== 0 && p.grew)) {
        setAll(m, rt);
        continue;
      }
      if (rt.def.kind === "markers") {
        setMarkers(m, rt, vals, false);
        continue;
      }
      const s = rt.series as ISeriesApi<"Line">;
      for (let i = Math.max(p.from, -rt.shift); i < vals.length; i++) {
        const j = i + rt.shift;
        const v = vals[i]!;
        if (j === rt.lastJ && Object.is(v, rt.lastV)) continue; // forming bar moved but this line did not
        s.update(point(m, rt, vals, i) as never, rt.shift < 0);
        if (j >= rt.lastJ) {
          rt.lastJ = j;
          rt.lastV = v;
        }
      }
    }
    for (const f of m.fills) f.redraw();
  };

  const recompute = (m: Mat, full: boolean) => {
    compute(m, full);
    draw(m);
  };

  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastFlush = 0;
  const flush = () => {
    timer = null;
    if (o.alive && !o.alive()) return;
    lastFlush = performance.now();
    for (const m of mats.values()) draw(m);
  };
  const schedule = () => {
    if (timer !== null) return;
    timer = setTimeout(flush, Math.max(0, FLUSH_MS - (performance.now() - lastFlush)));
  };

  const makeLevels = (m: Mat) => {
    for (const l of m.levels) m.outs[0]?.series.removePriceLine(l);
    m.levels = [];
    const host = m.outs[0]?.series;
    if (!host || m.def.pane !== "separate") return;
    const lv = m.inst.levels ?? m.def.levels?.(m.comp.params) ?? [];
    for (const price of lv) m.levels.push(host.createPriceLine({ price, color: withAlpha(tokens.fg3, 0.8), lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: "" }));
  };

  const applyStyle = (m: Mat) => {
    for (const rt of m.outs) {
      const st = m.inst.style?.[rt.def.key];
      rt.color = outColor(m.inst, rt.def);
      rt.visible = st?.visible !== false;
      if (rt.def.kind === "hist") (rt.series as ISeriesApi<"Histogram">).applyOptions({ color: withAlpha(rt.color, 0.7), visible: rt.visible });
      else
        (rt.series as ISeriesApi<"Line">).applyOptions({
          color: rt.color,
          visible: rt.visible,
          lineWidth: (st?.width ?? rt.def.width ?? 1) as 1 | 2 | 3 | 4,
          ...(rt.def.kind === "dots" ? { pointMarkersRadius: 1 + (st?.width ?? 1) * 0.7 } : {}),
        });
    }
  };

  const build = (inst: IndicatorInstance): Mat => {
    const def = INDICATOR_DEFS[inst.type];
    const params = normalizeParams(inst.type, inst.params);
    const pane = def.pane === "overlay" ? 0 : chart.panes().length;
    const range = def.range;
    const m: Mat = { inst, def, comp: new IndicatorComputation(inst.type, params), outs: [], levels: [], fills: [], pk: "", sk: "", lk: "", len: 0, pend: null };
    for (const od of def.outputs) {
      const st = inst.style?.[od.key];
      const color = outColor(inst, od);
      const visible = st?.visible !== false;
      const common = {
        priceLineVisible: false,
        lastValueVisible: def.pane === "separate" && od.kind !== "markers",
        visible,
        priceFormat: priceFormat(od.fmt, o.digits),
        ...(range ? { autoscaleInfoProvider: () => ({ priceRange: { minValue: range[0], maxValue: range[1] } }) } : od.autoscale === false ? { autoscaleInfoProvider: () => null } : {}),
      };
      let series: AnySeries;
      if (od.kind === "hist") series = chart.addSeries(HistogramSeries, { ...common, color: withAlpha(color, 0.7) }, pane);
      else
        series = chart.addSeries(
          LineSeries,
          {
            ...common,
            color,
            lineWidth: (st?.width ?? od.width ?? 1) as 1 | 2 | 3 | 4,
            lineStyle: od.dashed ? LineStyle.Dashed : LineStyle.Solid,
            lineType: od.stepped ? LineType.WithSteps : LineType.Simple,
            lineVisible: od.kind === "line",
            pointMarkersVisible: od.kind === "dots",
            ...(od.kind === "dots" ? { pointMarkersRadius: 1 + (st?.width ?? 1) * 0.7 } : {}),
            crosshairMarkerVisible: false,
          },
          pane,
        );
      const rt: OutRT = { def: od, series, shift: od.shift?.(params) ?? 0, color, visible, lastJ: -1, lastV: NaN };
      if (od.kind === "markers") rt.markers = createSeriesMarkers(series, [], { zOrder: "aboveSeries" });
      m.outs.push(rt);
    }
    for (const f of def.fills ?? []) {
      const a = m.outs.find((x) => x.def.key === f.upper);
      const b = m.outs.find((x) => x.def.key === f.lower);
      if (!a || !b) continue;
      const fill = new BandFill(() => {
        const up = withAlpha(f.downColor ? tokens[f.color] : a.color, f.alpha);
        return { a: m.comp.outs[f.upper] ?? [], b: m.comp.outs[f.lower] ?? [], shift: a.shift, up, down: f.downColor ? withAlpha(tokens[f.downColor], f.alpha) : up, visible: a.visible || b.visible };
      });
      a.series.attachPrimitive(fill);
      m.fills.push(fill);
    }
    // size a new oscillator pane like MT5: main window ≈ 3× a sub-window
    if (def.pane === "separate") {
      const ps = chart.panes();
      const np = ps[pane];
      if (np) {
        if (ps.length === 2) {
          ps[0]!.setStretchFactor(3.2);
          np.setStretchFactor(1);
        } else {
          const subs = ps.slice(1).filter((p) => p !== np);
          np.setStretchFactor(subs.reduce((s, p) => s + p.getStretchFactor(), 0) / Math.max(1, subs.length));
        }
      }
    }
    makeLevels(m);
    m.pk = JSON.stringify(inst.params);
    m.sk = JSON.stringify(inst.style ?? {});
    m.lk = JSON.stringify(inst.levels ?? null);
    recompute(m, true);
    return m;
  };

  const destroy = (m: Mat) => {
    for (const rt of m.outs) {
      try {
        rt.markers?.detach();
        chart.removeSeries(rt.series);
      } catch {
        /* chart already gone */
      }
    }
  };

  const sync = (list: IndicatorInstance[]) => {
    order = list;
    const byUid = new Map(list.map((x) => [x.uid, x]));
    for (const [uid, m] of mats) {
      const want = byUid.get(uid);
      if (!want || !want.visible || want.type !== m.inst.type) {
        destroy(m);
        mats.delete(uid);
      }
    }
    for (const inst of list) {
      if (!inst.visible) continue;
      const m = mats.get(inst.uid);
      if (!m) {
        mats.set(inst.uid, build(inst));
        continue;
      }
      const pk = JSON.stringify(inst.params);
      const sk = JSON.stringify(inst.style ?? {});
      const lk = JSON.stringify(inst.levels ?? null);
      m.inst = inst;
      if (pk !== m.pk) {
        const params = normalizeParams(inst.type, inst.params);
        m.comp = new IndicatorComputation(inst.type, params);
        for (const rt of m.outs) rt.shift = rt.def.shift?.(params) ?? 0;
        m.pk = pk;
        if (lk === m.lk) makeLevels(m);
        recompute(m, true);
      }
      if (sk !== m.sk) {
        m.sk = sk;
        applyStyle(m);
        for (const rt of m.outs) if (rt.def.kind === "hist" || rt.def.kind === "markers") setAll(m, rt);
        for (const f of m.fills) f.redraw();
      }
      if (lk !== m.lk) {
        m.lk = lk;
        makeLevels(m);
      }
    }
    o.onChange?.();
  };

  const update = () => {
    if (!mats.size) return;
    for (const m of mats.values()) compute(m, false);
    // history replaced (scroll-back, reload) draws at once so indicators never lag the candles; ticks are coalesced
    let full = false;
    for (const m of mats.values()) if (m.pend?.full) full = true;
    if (full) flush();
    else schedule();
  };

  const reset = () => {
    for (const m of mats.values()) recompute(m, true);
  };

  const legend = (i: number): IndLegendRow[] =>
    order.map((inst) => {
      const def = INDICATOR_DEFS[inst.type];
      const m = mats.get(inst.uid);
      const label = indicatorLabel(inst.type, normalizeParams(inst.type, inst.params));
      const first = def.outputs[0]!;
      if (!m) return { uid: inst.uid, type: inst.type, label, pane: -1, visible: false, color: outColor(inst, first), values: [] };
      const values: IndLegendValue[] = [];
      for (const rt of [...m.outs.filter((x) => x.def.kind !== "hist"), ...m.outs.filter((x) => x.def.kind === "hist")]) {
        if (!rt.visible || rt.def.kind === "markers") continue;
        const vals = m.comp.outs[rt.def.key]!;
        const k = i - rt.shift;
        const v = k >= 0 && k < vals.length ? vals[k]! : NaN;
        const color = rt.def.kind === "hist" && !Number.isNaN(v) ? histColor(rt, vals, k).replace(/,0\.7\)$/, ",1)") : rt.color;
        values.push({ label: rt.def.label, text: fmtValue(v, rt.def.fmt, o.digits), color });
      }
      let pane = 0;
      try {
        pane = m.outs[0]!.series.getPane().paneIndex();
      } catch {
        pane = 0;
      }
      return { uid: inst.uid, type: inst.type, label, pane, visible: true, color: m.outs.find((r) => r.def.kind !== "hist")?.color ?? m.outs[0]!.color, values };
    });

  const setPalette = (p: Palette) => {
    tokens = tokenMap(p);
    for (const m of mats.values()) {
      applyStyle(m);
      for (const rt of m.outs) if (rt.def.kind === "hist" || rt.def.kind === "markers") setAll(m, rt);
      makeLevels(m);
      for (const f of m.fills) f.redraw();
    }
  };

  return { sync, update, reset, legend, setPalette, count: () => mats.size };
}
