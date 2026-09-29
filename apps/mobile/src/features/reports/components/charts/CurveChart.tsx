// Equity, balance and drawdown on Skia. Two panes share one x axis: equity (gold line over a soft fill) with the
// balance (dashed cream) on top, the drawdown from peak (red, money) below. Scrubbing runs on the UI thread: a
// horizontal drag, or touch and hold, moves a crosshair with dots and a value tooltip from shared values, so the
// finger is followed 1:1 and React never re-renders. A tap pins the tooltip; another tap on it clears it.
// The tooltip holds only digits, a Latin-script date and colour markers matching the legend (Skia text has no font
// fallback, so words in other scripts stay in React Native text: legend, labels).
import * as React from "react";
import { View } from "react-native";
import { Canvas, Circle, DashPathEffect, Group, Line, LinearGradient, Path, RoundedRect, Skia, Text as SkText, useFont, vec } from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { haptic } from "@/lib/haptics";
import { Mono, Text } from "@/ui";
import { colors } from "@/theme/tokens";
import { CURVE, CURVE_H } from "./layout";

const MONO = require("@expo-google-fonts/jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf");

/** Precomputed on the JS side (downsampled to at most ~one point per 1.5 px). */
export type CurveSeries = {
  eq: number[];
  bal: number[];
  dd: number[];
  /** tooltip texts per point: date (Latin script), equity, balance, drawdown */
  tipDate: string[];
  tipEq: string[];
  tipBal: string[];
  tipDd: string[];
  hiLabel: string;
  loLabel: string;
  /** "DRAWDOWN" and the period's maximum, over the lower pane */
  ddTitle: string;
  ddLabel: string;
  a11y: string;
};

const PAD_X = 6;
const TIP_PAD = 10;
const DOT_GAP = 9; // marker + space before a value
const SEP = 12; // space between values
/** Axis values sit on a card-coloured chip, so the curve can pass behind them. */
const AXIS = { position: "absolute", end: 0, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, backgroundColor: colors.surface } as const;

export function CurveChart({ s, width }: { s: CurveSeries; width: number }) {
  const n = s.eq.length;
  const font = useFont(MONO, 11);
  const step = n > 1 ? (width - PAD_X * 2) / (n - 1) : 0;

  const g = React.useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < n; i++) {
      lo = Math.min(lo, s.eq[i]!, s.bal[i]!);
      hi = Math.max(hi, s.eq[i]!, s.bal[i]!);
    }
    if (!(hi > lo)) {
      const pad = Math.max(1, Math.abs(hi) * 0.01);
      lo -= pad;
      hi += pad;
    }
    const span = hi - lo;
    lo -= span * 0.08;
    hi += span * 0.08;
    const top = CURVE.tip + 4;
    const bottom = CURVE.tip + CURVE.main - 2;
    const y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * (bottom - top);
    let ddMin = 0;
    for (const v of s.dd) ddMin = Math.min(ddMin, v);
    const ddTop = CURVE.tip + CURVE.main + CURVE.gap;
    const ddBottom = ddTop + CURVE.dd - 3;
    const yd = (v: number) => (ddMin < 0 ? ddTop + (v / ddMin) * (ddBottom - ddTop) : ddTop);
    const eqLine = Skia.PathBuilder.Make();
    const eqFill = Skia.PathBuilder.Make();
    const balLine = Skia.PathBuilder.Make();
    const ddLine = Skia.PathBuilder.Make();
    const ddFill = Skia.PathBuilder.Make();
    const eqY: number[] = [];
    const balY: number[] = [];
    const ddY: number[] = [];
    for (let i = 0; i < n; i++) {
      const x = PAD_X + i * step;
      eqY.push(y(s.eq[i]!));
      balY.push(y(s.bal[i]!));
      ddY.push(yd(s.dd[i]!));
      if (i === 0) {
        eqLine.moveTo(x, eqY[i]!);
        balLine.moveTo(x, balY[i]!);
        ddLine.moveTo(x, ddY[i]!);
        eqFill.moveTo(x, bottom);
        ddFill.moveTo(x, ddTop);
      } else {
        eqLine.lineTo(x, eqY[i]!);
        balLine.lineTo(x, balY[i]!);
        ddLine.lineTo(x, ddY[i]!);
      }
      eqFill.lineTo(x, eqY[i]!);
      ddFill.lineTo(x, ddY[i]!);
    }
    const lastX = PAD_X + (n - 1) * step;
    eqFill.lineTo(lastX, bottom).close();
    ddFill.lineTo(lastX, ddTop).close();
    return { eqLine: eqLine.detach(), eqFill: eqFill.detach(), balLine: balLine.detach(), ddLine: ddLine.detach(), ddFill: ddFill.detach(), eqY, balY, ddY, top, bottom, ddTop, ddBottom, lastX };
  }, [s, n, step]);

  // per-point data for the UI thread
  const eqY = useSharedValue<number[]>(g.eqY);
  const balY = useSharedValue<number[]>(g.balY);
  const ddY = useSharedValue<number[]>(g.ddY);
  const tipDate = useSharedValue<string[]>(s.tipDate);
  const tipEq = useSharedValue<string[]>(s.tipEq);
  const tipBal = useSharedValue<string[]>(s.tipBal);
  const tipDd = useSharedValue<string[]>(s.tipDd);
  React.useEffect(() => {
    eqY.value = g.eqY;
    balY.value = g.balY;
    ddY.value = g.ddY;
    tipDate.value = s.tipDate;
    tipEq.value = s.tipEq;
    tipBal.value = s.tipBal;
    tipDd.value = s.tipDd;
  }, [g, s, eqY, balY, ddY, tipDate, tipEq, tipBal, tipDd]);

  const idx = useSharedValue(Math.max(0, n - 1));
  const active = useSharedValue(0);
  const count = useSharedValue(n);
  const stepSv = useSharedValue(step);
  React.useEffect(() => {
    count.value = n;
    stepSv.value = step;
    idx.value = Math.max(0, n - 1);
    active.value = 0;
  }, [n, step, count, stepSv, idx, active]);

  // monospace advance (glyph widths work on every platform, measureText does not on the web)
  const adv = useSharedValue(6.6);
  React.useEffect(() => {
    if (!font) return;
    const w = font.getGlyphWidths(font.getGlyphIDs("0"))[0];
    if (w && w > 0) adv.value = w;
  }, [font, adv]);

  const cx = useDerivedValue(() => PAD_X + idx.value * stepSv.value);
  const lineTop = useDerivedValue(() => vec(cx.value, CURVE.tip - 2));
  const lineBottom = useDerivedValue(() => vec(cx.value, CURVE_H - 2));
  const eqDot = useDerivedValue(() => eqY.value[idx.value] ?? 0);
  const balDot = useDerivedValue(() => balY.value[idx.value] ?? 0);
  const ddDot = useDerivedValue(() => ddY.value[idx.value] ?? 0);

  const textDate = useDerivedValue(() => tipDate.value[idx.value] ?? "");
  const textEq = useDerivedValue(() => tipEq.value[idx.value] ?? "");
  const textBal = useDerivedValue(() => tipBal.value[idx.value] ?? "");
  const textDd = useDerivedValue(() => tipDd.value[idx.value] ?? "");
  // tooltip layout: [date] / [● equity  ○ balance  drawdown]
  const tipW = useDerivedValue(() => {
    const a = adv.value;
    const line2 = DOT_GAP + textEq.value.length * a + SEP + DOT_GAP + textBal.value.length * a + SEP + textDd.value.length * a;
    return Math.min(width, Math.ceil(Math.max(textDate.value.length * a, line2)) + TIP_PAD * 2);
  });
  const tipX = useDerivedValue(() => Math.max(0, Math.min(width - tipW.value, cx.value - tipW.value / 2)));
  const x0 = useDerivedValue(() => tipX.value + TIP_PAD);
  const eqMarkX = useDerivedValue(() => x0.value + 3);
  const eqTextX = useDerivedValue(() => x0.value + DOT_GAP);
  const balMarkX = useDerivedValue(() => eqTextX.value + textEq.value.length * adv.value + SEP + 3);
  const balTextX = useDerivedValue(() => balMarkX.value - 3 + DOT_GAP);
  const ddTextX = useDerivedValue(() => balTextX.value + textBal.value.length * adv.value + SEP);

  const scrubbing = useSharedValue(false);
  const gesture = React.useMemo(() => {
    const at = (x: number) => {
      "worklet";
      const i = Math.round((x - PAD_X) / Math.max(stepSv.value, 0.0001));
      return Math.max(0, Math.min(count.value - 1, i));
    };
    const start = (x: number) => {
      "worklet";
      scrubbing.value = true;
      idx.value = at(x);
      active.value = withTiming(1, { duration: 90 });
      scheduleOnRN(haptic.select);
    };
    const move = (x: number) => {
      "worklet";
      idx.value = at(x);
    };
    // hide once a scrub ends, however it ends (lifted, or cancelled by the list taking over the touch)
    const end = () => {
      "worklet";
      if (!scrubbing.value) return;
      scrubbing.value = false;
      active.value = withTiming(0, { duration: 180 });
    };
    const drag = Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-12, 12])
      .onStart((e) => start(e.x))
      .onUpdate((e) => move(e.x))
      .onFinalize(() => end());
    const hold = Gesture.Pan()
      .activateAfterLongPress(180)
      .onStart((e) => start(e.x))
      .onUpdate((e) => move(e.x))
      .onFinalize(() => end());
    const tap = Gesture.Tap()
      .maxDuration(260)
      .onEnd((e) => {
        const i = at(e.x);
        if (active.value > 0.5 && Math.abs(i - idx.value) <= 1) {
          active.value = withTiming(0, { duration: 160 });
          return;
        }
        idx.value = i;
        active.value = withTiming(1, { duration: 90 });
        scheduleOnRN(haptic.select);
      });
    return Gesture.Race(hold, drag, tap);
  }, [idx, active, count, stepSv, scrubbing]);

  if (n < 2) return null;
  const lastEqY = g.eqY[n - 1]!;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={s.a11y} style={{ width, height: CURVE_H }}>
      <GestureDetector gesture={gesture}>
        <Canvas style={{ width, height: CURVE_H }}>
          {/* grid: top / bottom of the equity range, drawdown zero line */}
          <Line p1={vec(0, g.top)} p2={vec(width, g.top)} color={colors.line} strokeWidth={1} />
          <Line p1={vec(0, g.bottom)} p2={vec(width, g.bottom)} color={colors.line} strokeWidth={1} />
          <Line p1={vec(0, g.ddTop)} p2={vec(width, g.ddTop)} color={colors.lineStrong} strokeWidth={1} />

          <Path path={g.eqFill}>
            <LinearGradient start={vec(0, g.top)} end={vec(0, g.bottom)} colors={["rgba(242,184,75,0.26)", "rgba(242,184,75,0)"]} />
          </Path>
          <Path path={g.balLine} style="stroke" strokeWidth={1.4} color="rgba(245,239,227,0.55)" strokeJoin="round">
            <DashPathEffect intervals={[5, 4]} />
          </Path>
          <Path path={g.eqLine} style="stroke" strokeWidth={2.2} color={colors.gold} strokeJoin="round" strokeCap="round" />
          <Circle cx={g.lastX} cy={lastEqY} r={3.5} color={colors.gold} />

          <Path path={g.ddFill} color="rgba(240,82,82,0.22)" />
          <Path path={g.ddLine} style="stroke" strokeWidth={1.4} color="rgba(240,82,82,0.9)" strokeJoin="round" />

          <Group opacity={active}>
            <Line p1={lineTop} p2={lineBottom} color="rgba(245,239,227,0.45)" strokeWidth={1} />
            <Circle cx={cx} cy={balDot} r={3.5} color={colors.cream} />
            <Circle cx={cx} cy={eqDot} r={5} color={colors.bg} />
            <Circle cx={cx} cy={eqDot} r={3.8} color={colors.gold} />
            <Circle cx={cx} cy={ddDot} r={3.5} color={colors.down} />
            {font ? (
              <Group>
                <RoundedRect x={tipX} y={2} width={tipW} height={40} r={10} color={colors.surface3} />
                <SkText x={x0} y={17} text={textDate} font={font} color={colors.text2} />
                <Circle cx={eqMarkX} cy={29} r={3} color={colors.gold} />
                <SkText x={eqTextX} y={33} text={textEq} font={font} color={colors.text} />
                <Circle cx={balMarkX} cy={29} r={3} color="rgba(245,239,227,0.6)" />
                <SkText x={balTextX} y={33} text={textBal} font={font} color={colors.text} />
                <SkText x={ddTextX} y={33} text={textDd} font={font} color={colors.down} />
              </Group>
            ) : null}
          </Group>
        </Canvas>
      </GestureDetector>
      {/* static labels (React Native text: crisp, any script, never re-rendered while scrubbing) */}
      <View pointerEvents="none" style={[AXIS, { top: g.top + 3 }]}>
        <Mono size={10} tone="tertiary">
          {s.hiLabel}
        </Mono>
      </View>
      <View pointerEvents="none" style={[AXIS, { top: g.bottom - 18 }]}>
        <Mono size={10} tone="tertiary">
          {s.loLabel}
        </Mono>
      </View>
      <View pointerEvents="none" style={{ position: "absolute", start: 0, end: 0, top: g.ddTop - 19, flexDirection: "row", justifyContent: "space-between" }}>
        <Text variant="label" tone="tertiary" style={{ fontSize: 10 }}>
          {s.ddTitle}
        </Text>
        <Mono size={10} color={colors.down}>
          {s.ddLabel}
        </Mono>
      </View>
    </View>
  );
}
