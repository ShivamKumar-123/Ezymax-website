// The Kalks chart on Skia: candles or line, auto-scaled price axis, time axis, live bid / ask lines, position
// entry / SL / TP lines, SMA / EMA / Bollinger overlays and an RSI sub-pane, pinch zoom, pan with momentum and a
// crosshair on long-press. Everything is drawn from shared values on the UI thread: a tick, a pan or a zoom never
// re-renders React (60 fps; 120 on ProMotion).
import * as React from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { Canvas, DashPathEffect, Group, Line, Path, Rect, RoundedRect, Skia, Text as SkText, useFont, vec, type SkFont, type SkPath } from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { cancelAnimation, runOnJS, useAnimatedReaction, useDerivedValue, useSharedValue, withDecay, withTiming, type SharedValue } from "react-native-reanimated";
import { haptic } from "@/lib/haptics";
import { colors } from "@/theme/tokens";
import { tailValues, type IndicatorKey, type Series } from "./indicators";

export type ChartType = "candles" | "line";
/** Line kinds for positions / orders drawn on the chart. */
export const LINE = { buy: 0, sell: 1, sl: 2, tp: 3, pendingBuy: 4, pendingSell: 5 } as const;
const MAX_LINES = 12;
const AXIS_W = 62;
const TIME_H = 20;
const TOP = 26;
const RIGHT_PAD = 44;
const MIN_W = 2.5;
const MAX_W = 42;

const MONO = require("@expo-google-fonts/jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf");

export type ChartProps = {
  /** flattened [t, o, h, l, c] per bar (chart time) */
  bars: SharedValue<number[]>;
  /** the forming bar [t, o, h, l, c] (stream) */
  live: SharedValue<number[]>;
  closes: SharedValue<number[]>;
  series: SharedValue<Series>;
  bid: SharedValue<number>;
  ask: SharedValue<number>;
  /** flattened [price, kind] (LINE) */
  lines: SharedValue<number[]>;
  /** the viewport (shared so the data layer can keep the view steady when bars are added) */
  barW: SharedValue<number>;
  off: SharedValue<number>;
  digits: number;
  type: ChartType;
  indicators: IndicatorKey[];
  /** seconds per bar (time labels) */
  step: number;
  onNeedOlder: () => void;
};

type Viewport = { n: number; iMin: number; iMax: number; lo: number; hi: number; plotW: number; plotH: number; rsiTop: number; rsiH: number; w: number };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function barAt(bars: number[], live: number[], n: number, i: number, k: number): number {
  "worklet";
  if (i === n - 1 && live.length === 5 && live[0] === bars[(n - 1) * 5]) return live[k]!;
  return bars[i * 5 + k]!;
}

function niceStep(x: number): number {
  "worklet";
  if (!(x > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const m = x / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}

function pad2(v: number) {
  "worklet";
  return v < 10 ? `0${v}` : `${v}`;
}

function timeText(t: number, step: number): string {
  "worklet";
  const d = new Date(t * 1000);
  if (step >= 86400) return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${step >= 2592000 ? ` ${d.getUTCFullYear()}` : ""}`;
  const hm = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  // hourly bars span days: show the day too (the same hour repeats every day)
  return step >= 3600 ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${hm}` : hm;
}

export function SkiaChart(p: ChartProps) {
  const font = useFont(MONO, 10);
  const small = useFont(MONO, 9);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const W = useSharedValue(0);
  const H = useSharedValue(0);
  const rsiOn = useSharedValue(p.indicators.includes("rsi") ? 1 : 0);
  const lineMode = useSharedValue(p.type === "line" ? 1 : 0);
  const show = useSharedValue({ ma: p.indicators.includes("ma"), ema: p.indicators.includes("ema"), bb: p.indicators.includes("bb") });
  React.useEffect(() => {
    rsiOn.value = p.indicators.includes("rsi") ? 1 : 0;
    show.value = { ma: p.indicators.includes("ma"), ema: p.indicators.includes("ema"), bb: p.indicators.includes("bb") };
  }, [p.indicators, rsiOn, show]);
  React.useEffect(() => {
    lineMode.value = p.type === "line" ? 1 : 0;
  }, [p.type, lineMode]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    W.value = width;
    H.value = height;
    setSize({ w: width, h: height });
  };

  const { bars, live, closes, series, bid, ask, lines, barW, off, digits, step } = p;

  /* ---- viewport ---- */
  const vp = useDerivedValue<Viewport>(() => {
    const n = Math.floor(bars.value.length / 5);
    const w = barW.value;
    const plotW = Math.max(1, W.value - AXIS_W);
    const rsiH = rsiOn.value ? Math.round((H.value - TIME_H) * 0.22) : 0;
    const plotH = Math.max(1, H.value - TIME_H - TOP - rsiH - (rsiH ? 10 : 0));
    const xRight = plotW - RIGHT_PAD;
    const last = n - 1 - off.value;
    const iMax = Math.min(n - 1, Math.ceil(last + (plotW - xRight) / w));
    const iMin = Math.max(0, Math.floor(last - xRight / w) - 1);
    let lo = Infinity;
    let hi = -Infinity;
    const b = bars.value;
    const lv = live.value;
    for (let i = iMin; i <= iMax; i++) {
      const h = barAt(b, lv, n, i, 2);
      const l = barAt(b, lv, n, i, 3);
      if (h > hi) hi = h;
      if (l < lo) lo = l;
    }
    if (!(hi > lo)) {
      const c = n ? barAt(b, lv, n, n - 1, 4) : 1;
      lo = c * 0.999;
      hi = c * 1.001;
    }
    const pad = (hi - lo) * 0.08;
    return { n, iMin, iMax, lo: lo - pad, hi: hi + pad, plotW, plotH, rsiTop: TOP + plotH + 10, rsiH, w };
  });

  const xOf = (i: number, v: Viewport) => {
    "worklet";
    return v.plotW - RIGHT_PAD - (v.n - 1 - i - off.value) * v.w;
  };
  const yOf = (price: number, v: Viewport) => {
    "worklet";
    return TOP + ((v.hi - price) / (v.hi - v.lo)) * v.plotH;
  };

  /* ---- candles / line ---- */
  const shapes = useDerivedValue(() => {
    const v = vp.value;
    const upBody = Skia.PathBuilder.Make();
    const downBody = Skia.PathBuilder.Make();
    const upWick = Skia.PathBuilder.Make();
    const downWick = Skia.PathBuilder.Make();
    const line = Skia.PathBuilder.Make();
    const b = bars.value;
    const lv = live.value;
    const bw = Math.max(1, v.w * 0.68);
    for (let i = v.iMin; i <= v.iMax; i++) {
      const x = xOf(i, v);
      const o = barAt(b, lv, v.n, i, 1);
      const h = barAt(b, lv, v.n, i, 2);
      const l = barAt(b, lv, v.n, i, 3);
      const c = barAt(b, lv, v.n, i, 4);
      if (lineMode.value) {
        if (i === v.iMin) line.moveTo(x, yOf(c, v));
        else line.lineTo(x, yOf(c, v));
        continue;
      }
      const up = c >= o;
      const yo = yOf(o, v);
      const yc = yOf(c, v);
      const top = Math.min(yo, yc);
      const hgt = Math.max(1, Math.abs(yc - yo));
      (up ? upBody : downBody).addRect(Skia.XYWHRect(x - bw / 2, top, bw, hgt));
      const wick = up ? upWick : downWick;
      wick.moveTo(x, yOf(h, v));
      wick.lineTo(x, yOf(l, v));
    }
    return { upBody: upBody.detach(), downBody: downBody.detach(), upWick: upWick.detach(), downWick: downWick.detach(), line: line.detach() };
  });
  const upBody = useDerivedValue(() => shapes.value.upBody);
  const downBody = useDerivedValue(() => shapes.value.downBody);
  const upWick = useDerivedValue(() => shapes.value.upWick);
  const downWick = useDerivedValue(() => shapes.value.downWick);
  const linePath = useDerivedValue(() => shapes.value.line);

  /* ---- indicators ---- */
  const overlays = useDerivedValue(() => {
    const v = vp.value;
    const s = series.value;
    const cl = closes.value;
    const lv = live.value;
    const tail = v.n > 0 && lv.length === 5 ? tailValues(cl, s, lv[4]!) : null;
    const make = (arr: number[], key: "ma" | "ema" | "bbU" | "bbM" | "bbL", on: boolean): SkPath => {
      const path = Skia.PathBuilder.Make();
      if (!on) return path.detach();
      let started = false;
      for (let i = v.iMin; i <= v.iMax; i++) {
        const val = i === v.n - 1 && tail ? tail[key] : arr[i];
        if (val === undefined || val !== val) {
          started = false;
          continue;
        }
        const x = xOf(i, v);
        const y = yOf(val, v);
        if (!started) path.moveTo(x, y);
        else path.lineTo(x, y);
        started = true;
      }
      return path.detach();
    };
    const sh = show.value;
    const rsi = Skia.PathBuilder.Make();
    if (v.rsiH > 0) {
      let started = false;
      for (let i = v.iMin; i <= v.iMax; i++) {
        const val = i === v.n - 1 && tail ? tail.rsi : s.rsi[i];
        if (val === undefined || val !== val) {
          started = false;
          continue;
        }
        const x = xOf(i, v);
        const y = v.rsiTop + ((100 - val) / 100) * v.rsiH;
        if (!started) rsi.moveTo(x, y);
        else rsi.lineTo(x, y);
        started = true;
      }
    }
    return { ma: make(s.ma, "ma", sh.ma), ema: make(s.ema, "ema", sh.ema), bbU: make(s.bbU, "bbU", sh.bb), bbM: make(s.bbM, "bbM", sh.bb), bbL: make(s.bbL, "bbL", sh.bb), rsi: rsi.detach() };
  });
  const maPath = useDerivedValue(() => overlays.value.ma);
  const emaPath = useDerivedValue(() => overlays.value.ema);
  const bbUPath = useDerivedValue(() => overlays.value.bbU);
  const bbMPath = useDerivedValue(() => overlays.value.bbM);
  const bbLPath = useDerivedValue(() => overlays.value.bbL);
  const rsiPath = useDerivedValue(() => overlays.value.rsi);

  /* ---- grid + axes ---- */
  const grid = useDerivedValue(() => {
    const v = vp.value;
    const path = Skia.PathBuilder.Make();
    const stepP = niceStep((v.hi - v.lo) / 5);
    for (let pr = Math.ceil(v.lo / stepP) * stepP; pr <= v.hi; pr += stepP) {
      const y = yOf(pr, v);
      path.moveTo(0, y);
      path.lineTo(v.plotW, y);
    }
    if (v.rsiH > 0) {
      for (const lvl of [30, 70]) {
        const y = v.rsiTop + ((100 - lvl) / 100) * v.rsiH;
        path.moveTo(0, y);
        path.lineTo(v.plotW, y);
      }
    }
    return path.detach();
  });
  const priceLevels = useDerivedValue(() => {
    const v = vp.value;
    const stepP = niceStep((v.hi - v.lo) / 5);
    const out: { y: number; text: string }[] = [];
    for (let pr = Math.ceil(v.lo / stepP) * stepP; pr <= v.hi && out.length < 8; pr += stepP) out.push({ y: yOf(pr, v), text: pr.toFixed(digits) });
    return out;
  });
  const timeLevels = useDerivedValue(() => {
    const v = vp.value;
    const out: { x: number; text: string }[] = [];
    if (v.n === 0) return out;
    const every = Math.max(1, Math.ceil((step >= 3600 && step < 86400 ? 120 : 96) / v.w));
    const b = bars.value;
    const start = Math.ceil(v.iMin / every) * every;
    for (let i = start; i <= v.iMax && out.length < 6; i += every) {
      const x = xOf(i, v);
      if (x < 20 || x > v.plotW - 20) continue;
      out.push({ x, text: timeText(b[i * 5]!, step) });
    }
    return out;
  });

  /* ---- live bid / ask ---- */
  const rsiLabelY = useDerivedValue(() => (vp.value.rsiH > 0 ? vp.value.rsiTop + 11 : -50));
  const rsi70Y = useDerivedValue(() => (vp.value.rsiH > 0 ? vp.value.rsiTop + vp.value.rsiH * 0.3 + 3.5 : -50));
  const rsi30Y = useDerivedValue(() => (vp.value.rsiH > 0 ? vp.value.rsiTop + vp.value.rsiH * 0.7 + 3.5 : -50));
  const rsiText = useDerivedValue(() => {
    const v = vp.value;
    if (v.rsiH <= 0 || v.n === 0) return "";
    const lv = live.value;
    const s = series.value;
    const tail = lv.length === 5 ? tailValues(closes.value, s, lv[4]!) : null;
    const r = tail ? tail.rsi : s.rsi[v.n - 1];
    return r === undefined || r !== r ? "RSI 14" : `RSI 14  ${r.toFixed(1)}`;
  });
  const bidY = useDerivedValue(() => yOf(bid.value, vp.value));
  const askY = useDerivedValue(() => yOf(ask.value, vp.value));
  const bidText = useDerivedValue(() => (bid.value > 0 ? bid.value.toFixed(digits) : ""));
  const bidP1 = useDerivedValue(() => vec(0, bidY.value));
  const bidP2 = useDerivedValue(() => vec(vp.value.plotW, bidY.value));
  const askP1 = useDerivedValue(() => vec(0, askY.value));
  const askP2 = useDerivedValue(() => vec(vp.value.plotW, askY.value));
  const bidTagY = useDerivedValue(() => bidY.value - 9);
  const bidTextY = useDerivedValue(() => bidY.value + 3.5);
  const axisX = useDerivedValue(() => vp.value.plotW + 4);
  const axisTextX = useDerivedValue(() => vp.value.plotW + 8);

  /* ---- crosshair ---- */
  const chOn = useSharedValue(0);
  const chX = useSharedValue(0);
  const chY = useSharedValue(0);
  const cross = useDerivedValue(() => {
    const v = vp.value;
    if (!chOn.value || v.n === 0) return { on: 0, x: 0, y: 0, price: "", time: "", legend: "", idx: -1 };
    const idxF = v.n - 1 - off.value - (v.plotW - RIGHT_PAD - chX.value) / v.w;
    const idx = Math.max(0, Math.min(v.n - 1, Math.round(idxF)));
    const x = xOf(idx, v);
    const y = Math.max(TOP, Math.min(TOP + v.plotH, chY.value));
    const price = v.hi - ((y - TOP) / v.plotH) * (v.hi - v.lo);
    const b = bars.value;
    const lv = live.value;
    const f = (k: number) => barAt(b, lv, v.n, idx, k).toFixed(digits);
    return { on: 1, x, y, price: price.toFixed(digits), time: timeText(b[idx * 5]!, step), legend: `O ${f(1)}  H ${f(2)}  L ${f(3)}  C ${f(4)}`, idx };
  });
  const chOpacity = useDerivedValue(() => cross.value.on);
  const chV1 = useDerivedValue(() => vec(cross.value.x, TOP));
  const chV2 = useDerivedValue(() => vec(cross.value.x, H.value - TIME_H));
  const chH1 = useDerivedValue(() => vec(0, cross.value.y));
  const chH2 = useDerivedValue(() => vec(vp.value.plotW, cross.value.y));
  const chPriceText = useDerivedValue(() => cross.value.price);
  const chPriceTagY = useDerivedValue(() => cross.value.y - 9);
  const chPriceTextY = useDerivedValue(() => cross.value.y + 3.5);
  const chTimeText = useDerivedValue(() => cross.value.time);
  const chTimeX = useDerivedValue(() => Math.max(2, Math.min(vp.value.plotW - 64, cross.value.x - 32)));
  const chTimeTextX = useDerivedValue(() => chTimeX.value + 6);
  const chTimeY = useDerivedValue(() => H.value - TIME_H + 1);
  const chTimeTextY = useDerivedValue(() => H.value - TIME_H + 13);
  const legendText = useDerivedValue(() => cross.value.legend);

  /* ---- gestures ---- */
  const startOff = useSharedValue(0);
  const startW = useSharedValue(0);
  const loadingOlder = useSharedValue(0);
  const bounds = () => {
    "worklet";
    const v = vp.value;
    const visible = v.plotW / v.w;
    return { min: -visible * 0.5, max: Math.max(0, v.n - visible * 0.25) };
  };
  const pan = Gesture.Pan()
    .minDistance(4)
    .averageTouches(true)
    .onStart(() => {
      cancelAnimation(off);
      startOff.value = off.value;
    })
    .onUpdate((e) => {
      const bnd = bounds();
      off.value = Math.max(bnd.min, Math.min(bnd.max, startOff.value + e.translationX / barW.value));
    })
    .onEnd((e) => {
      const bnd = bounds();
      off.value = withDecay({ velocity: e.velocityX / barW.value, deceleration: 0.996, clamp: [bnd.min, bnd.max] });
    });
  const pinch = Gesture.Pinch()
    .onStart(() => {
      cancelAnimation(off);
      startW.value = barW.value;
      startOff.value = off.value;
    })
    .onUpdate((e) => {
      const v = vp.value;
      const w0 = startW.value;
      const w1 = Math.max(MIN_W, Math.min(MAX_W, w0 * e.scale));
      const xr = v.plotW - RIGHT_PAD;
      const f = Math.min(e.focalX, v.plotW);
      barW.value = w1;
      const bnd = bounds();
      off.value = Math.max(bnd.min, Math.min(bnd.max, startOff.value + (xr - f) / w0 - (xr - f) / w1));
    });
  const crosshair = Gesture.Pan()
    .activateAfterLongPress(260)
    .onStart((e) => {
      chOn.value = 1;
      chX.value = e.x;
      chY.value = e.y;
      runOnJS(haptic.select)();
    })
    .onUpdate((e) => {
      chX.value = e.x;
      chY.value = e.y;
    })
    .onFinalize(() => {
      chOn.value = 0;
    });
  const reset = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      barW.value = withTiming(9, { duration: 220 });
      off.value = withTiming(0, { duration: 220 });
    });
  const gesture = Gesture.Race(crosshair, reset, Gesture.Simultaneous(pan, pinch));

  // scrolled near the oldest bar: ask for older history (once per page)
  const needOlder = p.onNeedOlder;
  useAnimatedReaction(
    () => vp.value.iMin <= 3 && vp.value.n > 20,
    (near, prev) => {
      if (near && !prev && !loadingOlder.value) {
        loadingOlder.value = 1;
        runOnJS(needOlder)();
      }
    },
    [needOlder],
  );
  useAnimatedReaction(
    () => vp.value.n,
    (n, prev) => {
      if (prev !== null && n !== prev) loadingOlder.value = 0;
    },
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ flex: 1 }} onLayout={onLayout} collapsable={false}>
        {size.w > 0 ? (
          <Canvas style={{ width: size.w, height: size.h }}>
            <Path path={grid} color={colors.line} style="stroke" strokeWidth={1} />
            {/* overlays under the candles */}
            <Path path={bbUPath} color="rgba(140,140,240,0.55)" style="stroke" strokeWidth={1} />
            <Path path={bbMPath} color="rgba(140,140,240,0.35)" style="stroke" strokeWidth={1}>
              <DashPathEffect intervals={[3, 3]} />
            </Path>
            <Path path={bbLPath} color="rgba(140,140,240,0.55)" style="stroke" strokeWidth={1} />
            {/* candles */}
            <Path path={upWick} color={colors.up} style="stroke" strokeWidth={1} />
            <Path path={downWick} color={colors.down} style="stroke" strokeWidth={1} />
            <Path path={upBody} color={colors.up} />
            <Path path={downBody} color={colors.down} />
            <Path path={linePath} color={colors.gold} style="stroke" strokeWidth={2} strokeJoin="round" strokeCap="round" />
            <Path path={maPath} color={colors.gold} style="stroke" strokeWidth={1.4} />
            <Path path={emaPath} color={colors.mint} style="stroke" strokeWidth={1.4} />
            {/* RSI sub-pane */}
            <Path path={rsiPath} color={colors.periwinkle} style="stroke" strokeWidth={1.4} />
            {small ? <SkText x={8} y={rsiLabelY} text={rsiText} font={small} color={colors.text3} /> : null}
            {/* position / order lines */}
            <PositionLines lines={lines} vp={vp} yOf={yOf} font={small} digits={digits} />
            {/* ask + bid */}
            <Line p1={askP1} p2={askP2} color="rgba(240,82,82,0.55)" strokeWidth={1}>
              <DashPathEffect intervals={[2, 3]} />
            </Line>
            <Line p1={bidP1} p2={bidP2} color={colors.text2} strokeWidth={1}>
              <DashPathEffect intervals={[4, 3]} />
            </Line>
            {/* axes */}
            <Rect x={axisX} y={0} width={AXIS_W} height={size.h} color={colors.bg} />
            {font ? <PriceAxis levels={priceLevels} font={font} x={axisTextX} /> : null}
            {small ? <SkText x={axisTextX} y={rsi70Y} text={p.indicators.includes("rsi") ? "70" : ""} font={small} color={colors.text3} /> : null}
            {small ? <SkText x={axisTextX} y={rsi30Y} text={p.indicators.includes("rsi") ? "30" : ""} font={small} color={colors.text3} /> : null}
            {font ? <TimeAxis levels={timeLevels} font={font} y={size.h - 6} /> : null}
            <RoundedRect x={axisX} y={bidTagY} width={AXIS_W - 6} height={18} r={4} color={colors.cream} />
            {font ? <SkText x={axisTextX} y={bidTextY} text={bidText} font={font} color={colors.ink} /> : null}
            {/* crosshair */}
            <Group opacity={chOpacity}>
              <Line p1={chV1} p2={chV2} color={colors.text3} strokeWidth={1}>
                <DashPathEffect intervals={[3, 3]} />
              </Line>
              <Line p1={chH1} p2={chH2} color={colors.text3} strokeWidth={1}>
                <DashPathEffect intervals={[3, 3]} />
              </Line>
              <RoundedRect x={axisX} y={chPriceTagY} width={AXIS_W - 6} height={18} r={4} color={colors.surface3} />
              {font ? <SkText x={axisTextX} y={chPriceTextY} text={chPriceText} font={font} color={colors.text} /> : null}
              <RoundedRect x={chTimeX} y={chTimeY} width={64} height={17} r={4} color={colors.surface3} />
              {font ? <SkText x={chTimeTextX} y={chTimeTextY} text={chTimeText} font={font} color={colors.text} /> : null}
              {font ? <SkText x={8} y={16} text={legendText} font={font} color={colors.text2} /> : null}
            </Group>
          </Canvas>
        ) : null}
      </View>
    </GestureDetector>
  );
}

/* ---- axis labels: fixed slots bound to derived values (no React work per frame) ---- */

function PriceAxis({ levels, font, x }: { levels: SharedValue<{ y: number; text: string }[]>; font: SkFont; x: SharedValue<number> }) {
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <AxisSlot key={i} i={i} levels={levels} font={font} x={x} />
      ))}
    </>
  );
}

function AxisSlot({ i, levels, font, x }: { i: number; levels: SharedValue<{ y: number; text: string }[]>; font: SkFont; x: SharedValue<number> }) {
  const text = useDerivedValue(() => levels.value[i]?.text ?? "");
  const y = useDerivedValue(() => (levels.value[i]?.y ?? -20) + 3.5);
  return <SkText x={x} y={y} text={text} font={font} color={colors.text3} />;
}

function TimeAxis({ levels, font, y }: { levels: SharedValue<{ x: number; text: string }[]>; font: SkFont; y: number }) {
  return (
    <>
      {Array.from({ length: 6 }, (_, i) => (
        <TimeSlot key={i} i={i} levels={levels} font={font} y={y} />
      ))}
    </>
  );
}

function TimeSlot({ i, levels, font, y }: { i: number; levels: SharedValue<{ x: number; text: string }[]>; font: SkFont; y: number }) {
  const text = useDerivedValue(() => levels.value[i]?.text ?? "");
  const x = useDerivedValue(() => (levels.value[i]?.x ?? -100) - 16);
  return <SkText x={x} y={y} text={text} font={font} color={colors.text3} />;
}

/* ---- position / order lines ---- */

const LINE_COLORS = [colors.up, colors.down, colors.down, colors.up, "rgba(52,199,123,0.6)", "rgba(240,82,82,0.6)"];
const LINE_LABELS = ["BUY", "SELL", "SL", "TP", "BUY LMT", "SELL LMT"];

function PositionLines({ lines, vp, yOf, font, digits }: { lines: SharedValue<number[]>; vp: SharedValue<Viewport>; yOf: (p: number, v: Viewport) => number; font: SkFont | null; digits: number }) {
  return (
    <>
      {Array.from({ length: MAX_LINES }, (_, i) => (
        <PositionLine key={i} i={i} lines={lines} vp={vp} yOf={yOf} font={font} digits={digits} />
      ))}
    </>
  );
}

function PositionLine({ i, lines, vp, yOf, font, digits }: { i: number; lines: SharedValue<number[]>; vp: SharedValue<Viewport>; yOf: (p: number, v: Viewport) => number; font: SkFont | null; digits: number }) {
  const d = useDerivedValue(() => {
    const l = lines.value;
    const price = l[i * 2];
    const kind = l[i * 2 + 1];
    const v = vp.value;
    if (price === undefined || kind === undefined || price < v.lo || price > v.hi) return { on: 0, y: -50, kind: 0, text: "" };
    return { on: 1, y: yOf(price, v), kind, text: `${LINE_LABELS[kind] ?? ""} ${price.toFixed(digits)}` };
  });
  const opacity = useDerivedValue(() => d.value.on);
  const p1 = useDerivedValue(() => vec(0, d.value.y));
  const p2 = useDerivedValue(() => vec(vp.value.plotW, d.value.y));
  const tagY = useDerivedValue(() => d.value.y - 8);
  const textY = useDerivedValue(() => d.value.y + 3);
  const color = useDerivedValue(() => LINE_COLORS[d.value.kind] ?? colors.text2);
  const text = useDerivedValue(() => d.value.text);
  const tagW = useDerivedValue(() => (font ? font.getTextWidth(d.value.text) + 10 : 60));
  return (
    <Group opacity={opacity}>
      <Line p1={p1} p2={p2} color={color} strokeWidth={1}>
        <DashPathEffect intervals={[6, 4]} />
      </Line>
      <RoundedRect x={4} y={tagY} width={tagW} height={16} r={4} color={color} />
      {font ? <SkText x={9} y={textY} text={text} font={font} color={colors.ink} /> : null}
    </Group>
  );
}

