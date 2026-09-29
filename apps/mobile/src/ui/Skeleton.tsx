// Loading placeholders shaped like the real content. Static on purpose (no shimmer loop): the founder's rule is
// functional motion only.
import * as React from "react";
import { View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, space } from "@/theme/tokens";

export function Skeleton({ w = "100%", h = 14, r = radius.xs, style }: { w?: DimensionValue; h?: number; r?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.surface2 }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

/** N list rows: symbol + name on the start side, two price blocks on the end side. */
export function SkeletonRows({ rows = 8, height = 64 }: { rows?: number; height?: number }) {
  return (
    <View accessibilityLabel="Loading" accessible>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ height, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <Skeleton w={36} h={36} r={18} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton w={84} h={13} />
            <Skeleton w={120} h={10} />
          </View>
          <Skeleton w={76} h={30} r={10} />
          <Skeleton w={76} h={30} r={10} />
        </View>
      ))}
    </View>
  );
}
