// A curve on Skia: the main line (equity / value) over a flat low-opacity fill, an optional dashed second line
// (balance), a dashed reference (the starting balance) and an optional drawdown pane underneath, sharing the x axis.
// Scrubbing runs on the UI thread: a horizontal drag, a touch-and-hold or a tap moves a crosshair with dots and a
// value tooltip from shared values, so the finger is followed 1:1 and React never re-renders; a second tap on the
// same place hides it. Paths are built once per data / width change. Always left to right (time), whatever the
// reading direction. Matte: flat lines and flat fills, no gradients or glows.
import * as React from "react";
import { View } from "react-native";
import { Canvas, Circle, DashPathEffect, Group, Line, Path, RoundedRect, Skia, Text as SkText, useFont, vec } from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { haptic } from "@/lib/haptics";
import { Mono, Text } from "@/ui";
import { alpha } from "@/theme/alpha";
import { colors } from "@/theme/tokens";
import { curveHeight, type CurveData, type CurveLayout } from "./types";

const MONO = require("@expo-google-fonts/jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf");

const PAD_X = 6;
const TIP_PAD = 10;
const DOT_GAP = 9;
const SEP = 12;

/** Axis values sit on a card-coloured chip, so the curve can pass behind them. */
const AXIS = { position: "absolute", end: 0, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, backgroundColor: colors.surface } as const;

export default function CurveCanvas({ d, width, layout, testID }: { d: CurveData; width: number; layout: CurveLayout; testID?: string }) {
  const n = d.main.length;
  const hasDd = !!d.dd && d.dd.length === n;
  const hasSecond = !!d.second && d.second.length === n;
  const H = curveHeight(layout, hasDd);
  const font = useFont(MONO, 11);
  const step = n > 1 ? (width - PAD_X * 2) / (n - 1) : 0;

  const g = React.useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < n; i++) {
      lo = Math.min(lo, d.main[i]!);
      hi = Math.max(hi, d.main[i]!);
      if (hasSecond) {
        lo = Math.min(lo, d.second![i]!);
        hi = Math.max(hi, d.second![i]!);
      }
    }
    if (d.baseline !== undefined && Number.isFinite(d.baseline)) {
      lo = Math.min(lo, d.baseline);
      hi = Math.max(hi, d.baseline);
    }
    if (!(hi > lo)) {
      const pad = Math.max(1, Math.abs(hi) * 0.01);
      lo -= pad;
      hi += pad;
    }
    const span = hi - lo;
    lo -= span * 0.08;
    hi += span * 0.08;
    const top = layout.tip + 4;
    const bottom = layout.tip + layout.main - 2;
    const y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * (bottom - top);
    let ddMin = 0;
    if (hasDd) for (const v of d.dd!) ddMin = Math.min(ddMin, v);
    const ddTop = layout.tip + layout.main + layout.gap;
    const ddBottom = ddTop + layout.dd - 3;
    const yd = (v: number) => (ddMin < 0 ? ddTop + (v / ddMin) * (ddBottom - ddTop) : ddTop);

    const mainLine = Skia.PathBuilder.Make();
    const mainFill = Skia.PathBuilder.Make();
    const secondLine = Skia.PathBuilder.Make();
    const ddLine = Skia.PathBuilder.Make();
    const ddFill = Skia.PathBuilder.Make();
    const mainY: number[] = [];
    const secondY: number[] = [];
    const ddY: number[] = [];
    for (let i = 0; i < n; i++) {
      const x = PAD_X + i * step;
      mainY.push(y(d.main[i]!));
      if (hasSecond) secondY.push(y(d.second![i]!));
      if (hasDd) ddY.push(yd(d.dd![i]!));
      if (i === 0) {
        mainLine.moveTo(x, mainY[i]!);
        mainFill.moveTo(x, bottom);
        if (hasSecond) secondLine.moveTo(x, secondY[i]!);
        if (hasDd) {
          ddLine.moveTo(x, ddY[i]!);
          ddFill.moveTo(x, ddTop);
        }
      } else {
        mainLine.lineTo(x, mainY[i]!);
        if (hasSecond) secondLine.lineTo(x, secondY[i]!);
        if (hasDd) ddLine.lineTo(x, ddY[i]!);
      }
      mainFill.lineTo(x, mainY[i]!);
      if (hasDd) ddFill.lineTo(x, ddY[i]!);
    }
    const lastX = PAD_X + (n - 1) * step;
    mainFill.lineTo(lastX, bottom).close();
    if (hasDd) ddFill.lineTo(lastX, ddTop).close();
    const baseY = d.baseline !== undefined && Number.isFinite(d.baseline) ? y(d.baseline) : null;
    return {
      mainLine: mainLine.detach(),
      mainFill: mainFill.detach(),
      secondLine: secondLine.detach(),
      ddLine: ddLine.detach(),
      ddFill: ddFill.detach(),
      mainY,
      secondY,
      ddY,
      top,
      bottom,
      ddTop,
      lastX,
      baseY,
    };
  }, [d, n, step, hasDd, hasSecond, layout]);

  // per-point data for the UI thread
  const mainY = useSharedValue<number[]>(g.mainY);
  const secondY = useSharedValue<number[]>(g.secondY);
  const ddY = useSharedValue<number[]>(g.ddY);
  const tipDate = useSharedValue<string[]>(d.tipDate);
  const tipMain = useSharedValue<string[]>(d.tipMain);
  const tipSecond = useSharedValue<string[]>(d.tipSecond ?? []);
  const tipDd = useSharedValue<string[]>(d.tipDd ?? []);
  React.useEffect(() => {
    mainY.value = g.mainY;
    secondY.value = g.secondY;
    ddY.value = g.ddY;
    tipDate.value = d.tipDate;
    tipMain.value = d.tipMain;
    tipSecond.value = d.tipSecond ?? [];
    tipDd.value = d.tipDd ?? [];
  }, [g, d, mainY, secondY, ddY, tipDate, tipMain, tipSecond, tipDd]);

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

  // monospace advance (glyph widths work on every platform; measureText does not on the web)
  const adv = useSharedValue(6.6);
  React.useEffect(() => {
    if (!font) return;
    const w = font.getGlyphWidths(font.getGlyphIDs("0"))[0];
    if (w && w > 0) adv.value = w;
  }, [font, adv]);

  const cx = useDerivedValue(() => PAD_X + idx.value * stepSv.value);
  const lineTop = useDerivedValue(() => vec(cx.value, layout.tip - 2));
  const lineBottom = useDerivedValue(() => vec(cx.value, H - 2));
  const mainDot = useDerivedValue(() => mainY.value[idx.value] ?? -20);
  const secondDot = useDerivedValue(() => secondY.value[idx.value] ?? -20);
  const ddDot = useDerivedValue(() => ddY.value[idx.value] ?? -20);

  const textDate = useDerivedValue(() => tipDate.value[idx.value] ?? "");
  const textMain = useDerivedValue(() => tipMain.value[idx.value] ?? "");
  const textSecond = useDerivedValue(() => tipSecond.value[idx.value] ?? "");
  const textDd = useDerivedValue(() => tipDd.value[idx.value] ?? "");
  // tooltip: [date] / [● main  ○ second  drawdown]
  const tipW = useDerivedValue(() => {
    const a = adv.value;
    let line2 = DOT_GAP + textMain.value.length * a;
    if (textSecond.value) line2 += SEP + DOT_GAP + textSecond.value.length * a;
    if (textDd.value) line2 += SEP + textDd.value.length * a;
    return Math.min(width, Math.ceil(Math.max(textDate.value.length * a, line2)) + TIP_PAD * 2);
  });
  const tipX = useDerivedValue(() => Math.max(0, Math.min(width - tipW.value, cx.value - tipW.value / 2)));
  const x0 = useDerivedValue(() => tipX.value + TIP_PAD);
  const mainMarkX = useDerivedValue(() => x0.value + 3);
  const mainTextX = useDerivedValue(() => x0.value + DOT_GAP);
  const secondMarkX = useDerivedValue(() => mainTextX.value + textMain.value.length * adv.value + SEP + 3);
  const secondTextX = useDerivedValue(() => secondMarkX.value - 3 + DOT_GAP);
  const ddTextX = useDerivedValue(() => (textSecond.value ? secondTextX.value + textSecond.value.length * adv.value + SEP : mainTextX.value + textMain.value.length * adv.value + SEP));

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
    // hide once a scrub ends, however it ends (lifted, or the page scroll took the touch over)
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

  if (n < 2 || width <= 0) return <View style={{ width, height: H }} />;
  const color = d.color;
  return (
    <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={d.a11y} style={{ width, height: H, direction: "ltr" }}>
      <GestureDetector gesture={gesture}>
        <Canvas style={{ width, height: H }}>
          <Line p1={vec(0, g.top)} p2={vec(width, g.top)} color={colors.line} strokeWidth={1} />
          <Line p1={vec(0, g.bottom)} p2={vec(width, g.bottom)} color={colors.line} strokeWidth={1} />
          {g.baseY !== null ? (
            <Line p1={vec(0, g.baseY)} p2={vec(width, g.baseY)} color={colors.lineStrong} strokeWidth={1}>
              <DashPathEffect intervals={[4, 5]} />
            </Line>
          ) : null}
          <Path path={g.mainFill} color={alpha(color, 0.12)} />
          {hasSecond ? (
            <Path path={g.secondLine} style="stroke" strokeWidth={1.2} color={alpha(colors.cream, 0.38)} strokeJoin="round">
              <DashPathEffect intervals={[5, 4]} />
            </Path>
          ) : null}
          <Path path={g.mainLine} style="stroke" strokeWidth={2.2} color={color} strokeJoin="round" strokeCap="round" />
          <Circle cx={g.lastX} cy={g.mainY[n - 1]!} r={3.5} color={color} />
          {hasDd ? (
            <>
              <Line p1={vec(0, g.ddTop)} p2={vec(width, g.ddTop)} color={colors.lineStrong} strokeWidth={1} />
              <Path path={g.ddFill} color={alpha(colors.down, 0.2)} />
              <Path path={g.ddLine} style="stroke" strokeWidth={1.4} color={alpha(colors.down, 0.9)} strokeJoin="round" />
            </>
          ) : null}

          <Group opacity={active}>
            <Line p1={lineTop} p2={lineBottom} color={alpha(colors.text, 0.4)} strokeWidth={1} />
            {hasSecond ? <Circle cx={cx} cy={secondDot} r={3.5} color={colors.cream} /> : null}
            <Circle cx={cx} cy={mainDot} r={5} color={colors.bg} />
            <Circle cx={cx} cy={mainDot} r={3.8} color={color} />
            {hasDd ? <Circle cx={cx} cy={ddDot} r={3.5} color={colors.down} /> : null}
            {font ? (
              <Group>
                <RoundedRect x={tipX} y={2} width={tipW} height={40} r={10} color={colors.surface3} />
                <SkText x={x0} y={17} text={textDate} font={font} color={colors.text2} />
                <Circle cx={mainMarkX} cy={29} r={3} color={color} />
                <SkText x={mainTextX} y={33} text={textMain} font={font} color={colors.text} />
                {hasSecond ? (
                  <>
                    <Circle cx={secondMarkX} cy={29} r={3} color={alpha(colors.cream, 0.6)} />
                    <SkText x={secondTextX} y={33} text={textSecond} font={font} color={colors.text} />
                  </>
                ) : null}
                {hasDd ? <SkText x={ddTextX} y={33} text={textDd} font={font} color={colors.down} /> : null}
              </Group>
            ) : null}
          </Group>
        </Canvas>
      </GestureDetector>
      {/* static labels (React Native text: crisp, any script, never re-rendered while scrubbing) */}
      <View pointerEvents="none" style={[AXIS, { top: g.top + 3 }]}>
        <Mono size={10} tone="tertiary">
          {d.hi}
        </Mono>
      </View>
      <View pointerEvents="none" style={[AXIS, { top: g.bottom - 18 }]}>
        <Mono size={10} tone="tertiary">
          {d.lo}
        </Mono>
      </View>
      {hasDd && d.ddTitle ? (
        <View pointerEvents="none" style={{ position: "absolute", start: 0, end: 0, top: g.ddTop - 19, flexDirection: "row", justifyContent: "space-between" }}>
          <Text variant="label" tone="tertiary" style={{ fontSize: 10 }}>
            {d.ddTitle}
          </Text>
          <Mono size={10} color={colors.down}>
            {d.ddLabel ?? ""}
          </Mono>
        </View>
      ) : null}
    </View>
  );
}
