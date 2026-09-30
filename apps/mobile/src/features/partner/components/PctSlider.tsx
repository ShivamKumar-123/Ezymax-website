// A 0–max % slider (whole percent). The thumb follows the finger 1:1 on the UI thread (Gesture Handler +
// Reanimated), settles on the nearest whole percent with a spring from the tokens, and reports each whole-percent
// change; a light haptic marks every 5 %. Screen readers adjust it in 1 % steps. Right-to-left: it fills from the
// start (right) edge and a drag to the start lowers it.
import * as React from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useLocale } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { colors, motion } from "@/theme/tokens";

const THUMB = 28;
const TRACK = 8;

export function PctSlider({ value, max, onChange, color = colors.ember, label, disabled }: { value: number; max: number; onChange: (v: number) => void; color?: string; label: string; disabled?: boolean }) {
  const { rtl } = useLocale();
  const width = useSharedValue(0);
  const pos = useSharedValue(max > 0 ? value / max : 0);
  const last = useSharedValue(Math.round(value));
  const dragging = useSharedValue(false);

  // follow the value from outside (reset, the server's answer) when the finger isn't on it
  React.useEffect(() => {
    if (dragging.value) return;
    last.value = Math.round(value);
    pos.value = withSpring(max > 0 ? Math.min(1, Math.max(0, value / max)) : 0, motion.spring);
  }, [value, max, pos, last, dragging]);

  const emit = React.useCallback(
    (v: number) => {
      if (v % 5 === 0) haptic.select();
      onChange(v);
    },
    [onChange],
  );

  const setFromX = (x: number) => {
    "worklet";
    const w = width.value - THUMB;
    if (w <= 0) return;
    const raw = Math.min(1, Math.max(0, (x - THUMB / 2) / w));
    const p = rtl ? 1 - raw : raw;
    pos.value = p;
    const v = Math.round(p * max);
    if (v !== last.value) {
      last.value = v;
      runOnJS(emit)(v);
    }
  };

  const settle = () => {
    "worklet";
    pos.value = withSpring(max > 0 ? last.value / max : 0, motion.spring);
  };
  // horizontal drags only: a vertical swipe that starts on the slider still scrolls the page
  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-3, 3])
    .failOffsetY([-10, 10])
    .hitSlop({ top: 12, bottom: 12 })
    .onStart((e) => {
      dragging.value = true;
      setFromX(e.x);
    })
    .onUpdate((e) => setFromX(e.x))
    .onFinalize(() => {
      if (!dragging.value) return;
      dragging.value = false;
      settle();
    });
  const tap = Gesture.Tap()
    .enabled(!disabled)
    .hitSlop({ top: 12, bottom: 12 })
    .onEnd((e) => {
      setFromX(e.x);
      settle();
    });
  const gesture = Gesture.Exclusive(pan, tap);

  // the fill and the thumb sit in rows, which follow the layout direction on every platform (no absolute start
  // offsets, which react-native-web doesn't mirror): the fill grows from the start edge, a spacer moves the thumb
  const fill = useAnimatedStyle(() => ({ width: TRACK / 2 + pos.value * Math.max(0, width.value - THUMB) }));
  const spacer = useAnimatedStyle(() => ({ width: pos.value * Math.max(0, width.value - THUMB) }));

  const onLayout = (e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
  };

  return (
    <GestureDetector gesture={gesture}>
      <View
        onLayout={onLayout}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max, now: Math.round(value), text: `${Math.round(value)}%` }}
        accessibilityState={{ disabled: !!disabled }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => {
          if (disabled) return;
          const v = Math.round(value) + (e.nativeEvent.actionName === "increment" ? 1 : -1);
          if (v >= 0 && v <= max) onChange(v);
        }}
        style={{ height: 44, justifyContent: "center", opacity: disabled ? 0.5 : 1 }}
      >
        <View style={{ height: TRACK, borderRadius: TRACK / 2, backgroundColor: colors.surface3, marginHorizontal: THUMB / 2 - TRACK / 2 }} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { flexDirection: "row", alignItems: "center", paddingHorizontal: THUMB / 2 - TRACK / 2 }]}>
          <Animated.View style={[{ height: TRACK, borderRadius: TRACK / 2, backgroundColor: color }, fill]} />
        </View>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { flexDirection: "row", alignItems: "center" }]}>
          <Animated.View style={spacer} />
          <View style={{ width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: colors.cream, borderWidth: 3, borderColor: color }} />
        </View>
      </View>
    </GestureDetector>
  );
}
