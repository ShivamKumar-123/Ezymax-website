// Short confirmations ("New code sent", "Order filled"): one at a time at the top, gone after 2.6 s.
// Call toast.show({ title, body?, tone? }) from anywhere; <Toaster /> is mounted once in the root layout.
import * as React from "react";
import { View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createStore, useStore } from "@/lib/store";
import { colors, radius, space } from "@/theme/tokens";
import { Text } from "./Text";

type ToastItem = { id: number; title: string; body?: string; tone?: "neutral" | "success" | "error" };
const store = createStore<ToastItem | null>(null);
let seq = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

export const toast = {
  show(t: Omit<ToastItem, "id">, ms = 2600) {
    if (timer) clearTimeout(timer);
    store.set({ ...t, id: ++seq });
    timer = setTimeout(() => store.set(null), ms);
  },
  hide() {
    store.set(null);
  },
};

export function Toaster() {
  const item = useStore(store);
  const insets = useSafeAreaInsets();
  if (!item) return null;
  const accent = item.tone === "success" ? colors.up : item.tone === "error" ? colors.down : colors.ember;
  return (
    <Animated.View key={item.id} entering={FadeInUp.duration(180)} exiting={FadeOutUp.duration(160)} pointerEvents="none" style={{ position: "absolute", top: insets.top + space[2], start: space[4], end: space[4], alignItems: "center" }}>
      <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ maxWidth: 420, width: "100%", flexDirection: "row", gap: space[3], alignItems: "center", paddingHorizontal: space[4], paddingVertical: space[3], borderRadius: radius.lg, backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.lineStrong }}>
        <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: accent }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="callout" weight="700">
            {item.title}
          </Text>
          {item.body ? (
            <Text variant="caption" tone="secondary">
              {item.body}
            </Text>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}
