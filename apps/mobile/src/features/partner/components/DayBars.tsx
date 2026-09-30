// Days or weeks as static bars (cashback's last 30 days, the partner's last 12 weeks); drag across (or tap) to read
// one — the finger's bar is highlighted and its value shown above, the last one otherwise. The chart only
// re-renders when the chosen bar changes; the drag itself runs on the UI thread.
import * as React from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import { useLocale } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { Mono, Text } from "@/ui";
import { colors, space } from "@/theme/tokens";

export function DayBars({ data, format, label, height = 120, color = colors.ember, a11y }: { data: { key: string; value: number }[]; format: (v: number) => string; label: (key: string) => string; height?: number; color?: string; a11y: string }) {
  const { rtl } = useLocale();
  const [sel, setSel] = React.useState<number | null>(null);
  const width = useSharedValue(0);
  const last = useSharedValue(-1);
  const n = data.length;
  const max = Math.max(0, ...data.map((d) => d.value));
  const shown = sel ?? n - 1;
  const cur = data[shown];

  const pick = React.useCallback((i: number) => {
    haptic.select();
    setSel(i);
  }, []);
  const at = (x: number) => {
    "worklet";
    if (width.value <= 0 || n === 0) return;
    const p = Math.min(0.9999, Math.max(0, x / width.value));
    const i = Math.floor((rtl ? 1 - p : p) * n);
    if (i !== last.value) {
      last.value = i;
      runOnJS(pick)(i);
    }
  };
  const pan = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .failOffsetY([-10, 10])
    .onStart((e) => at(e.x))
    .onUpdate((e) => at(e.x));
  const tap = Gesture.Tap().onEnd((e) => at(e.x));
  const gesture = Gesture.Exclusive(pan, tap);

  return (
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text variant="caption" tone="tertiary">
          {cur ? label(cur.key) : ""}
        </Text>
        <Mono size={14} weight="bold">
          {cur ? format(cur.value) : ""}
        </Mono>
      </View>
      <GestureDetector gesture={gesture}>
        <View
          onLayout={(e: LayoutChangeEvent) => {
            width.value = e.nativeEvent.layout.width;
          }}
          accessible
          accessibilityLabel={a11y}
          style={{ height, flexDirection: "row", alignItems: "flex-end", gap: 3 }}
        >
          {data.map((d, i) => {
            const h = max > 0 ? Math.max(d.value > 0 ? 4 : 2, (d.value / max) * height) : 2;
            return <View key={d.key} style={{ flex: 1, height: h, borderTopStartRadius: 3, borderTopEndRadius: 3, backgroundColor: i === shown ? color : d.value > 0 ? colors.surface3 : colors.surface2 }} />;
          })}
        </View>
      </GestureDetector>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text variant="caption" tone="tertiary">
          {data[0] ? label(data[0].key) : ""}
        </Text>
        <Text variant="caption" tone="tertiary">
          {data[n - 1] ? label(data[n - 1]!.key) : ""}
        </Text>
      </View>
    </View>
  );
}
