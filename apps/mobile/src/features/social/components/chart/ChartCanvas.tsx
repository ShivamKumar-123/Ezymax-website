// Skia line + area chart with a scrub crosshair (equity curve, NAV history). The path is built once per data
// change; the crosshair and dot are driven by a shared value on the UI thread, so scrubbing never re-renders this
// component: React only hears the index (onScrub) when it changes, and only the small header that shows it
// re-renders. Always left-to-right (time axis), whatever the reading direction.
import * as React from "react";
import { View } from "react-native";
import { Canvas, Circle, DashPathEffect, Line, LinearGradient, Path, Skia, vec } from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useDerivedValue, useSharedValue } from "react-native-reanimated";
import { colors } from "@/theme/tokens";
import type { ChartProps } from "./types";

const PAD_T = 14;
const PAD_B = 10;

function alpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export default function ChartCanvas({ values, height, color, baseline, onScrub, accessibilityLabel }: ChartProps) {
  const [width, setWidth] = React.useState(0);

  const geom = React.useMemo(() => {
    if (!width || values.length < 2) return null;
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of values) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (baseline !== undefined) {
      lo = Math.min(lo, baseline);
      hi = Math.max(hi, baseline);
    }
    if (hi - lo < 1e-9) {
      const pad = Math.abs(hi) * 0.01 || 1;
      hi += pad;
      lo -= pad;
    }
    const span = hi - lo;
    lo -= span * 0.06;
    hi += span * 0.06;
    const n = values.length;
    const inner = height - PAD_T - PAD_B;
    const xs = values.map((_, i) => (i / (n - 1)) * width);
    const ys = values.map((v) => PAD_T + (1 - (v - lo) / (hi - lo)) * inner);
    const lb = Skia.PathBuilder.Make().moveTo(xs[0]!, ys[0]!);
    const ab = Skia.PathBuilder.Make().moveTo(xs[0]!, ys[0]!);
    for (let i = 1; i < n; i++) {
      lb.lineTo(xs[i]!, ys[i]!);
      ab.lineTo(xs[i]!, ys[i]!);
    }
    const line = lb.build();
    const area = ab
      .lineTo(xs[n - 1]!, height)
      .lineTo(xs[0]!, height)
      .close()
      .build();
    const baseY = baseline !== undefined ? PAD_T + (1 - (baseline - lo) / (hi - lo)) * inner : null;
    return { line, area, xs, ys, baseY };
  }, [values, width, height, baseline]);

  const idx = useSharedValue(-1);
  const xsSv = useSharedValue<number[]>([]);
  const ysSv = useSharedValue<number[]>([]);
  React.useEffect(() => {
    xsSv.value = geom?.xs ?? [];
    ysSv.value = geom?.ys ?? [];
    idx.value = -1;
  }, [geom, xsSv, ysSv, idx]);

  const cx = useDerivedValue(() => (idx.value >= 0 ? (xsSv.value[idx.value] ?? -100) : -100));
  const cy = useDerivedValue(() => (idx.value >= 0 ? (ysSv.value[idx.value] ?? -100) : -100));
  const p1 = useDerivedValue(() => ({ x: cx.value, y: 0 }));
  const p2 = useDerivedValue(() => ({ x: cx.value, y: height }));
  const shown = useDerivedValue(() => (idx.value >= 0 ? 1 : 0));

  const report = React.useCallback((i: number) => onScrub?.(i < 0 ? null : i), [onScrub]);

  const gesture = React.useMemo(() => {
    const at = (x: number) => {
      "worklet";
      const xs = xsSv.value;
      const n = xs.length;
      if (n < 2) return -1;
      const w = xs[n - 1]!;
      return Math.round((Math.max(0, Math.min(w, x)) / Math.max(1, w)) * (n - 1));
    };
    return Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-14, 14])
      .onStart((e) => {
        const i = at(e.x);
        idx.value = i;
        runOnJS(report)(i);
      })
      .onUpdate((e) => {
        const i = at(e.x);
        if (i !== idx.value) {
          idx.value = i;
          runOnJS(report)(i);
        }
      })
      .onFinalize(() => {
        if (idx.value !== -1) {
          idx.value = -1;
          runOnJS(report)(-1);
        }
      });
  }, [xsSv, idx, report]);

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{ height, direction: "ltr" }}
        onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        collapsable={false}
      >
        {geom ? (
          <Canvas style={{ width, height }}>
            {geom.baseY !== null ? (
              <Line p1={vec(0, geom.baseY)} p2={vec(width, geom.baseY)} color={colors.lineStrong} strokeWidth={1}>
                <DashPathEffect intervals={[4, 5]} />
              </Line>
            ) : null}
            <Path path={geom.area}>
              <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={[alpha(color, 0.22), alpha(color, 0)]} />
            </Path>
            <Path path={geom.line} style="stroke" strokeWidth={2} strokeJoin="round" strokeCap="round" color={color} />
            <Line p1={p1} p2={p2} color={colors.text3} strokeWidth={1} opacity={shown} />
            <Circle cx={cx} cy={cy} r={9} color={alpha(color, 0.25)} opacity={shown} />
            <Circle cx={cx} cy={cy} r={4.5} color={color} opacity={shown} />
          </Canvas>
        ) : null}
      </View>
    </GestureDetector>
  );
}
