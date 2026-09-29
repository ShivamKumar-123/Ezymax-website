// Pill chips (segments, filters, timeframes). Selected = cream fill with ink text.
import * as React from "react";
import { ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, space } from "@/theme/tokens";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

export function Pill({ label, selected, onPress, compact, style, accessibilityLabel }: { label: string; selected?: boolean; onPress?: () => void; compact?: boolean; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }) {
  return (
    <PressableScale
      onPress={onPress}
      haptics="select"
      accessibilityRole="tab"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        {
          height: compact ? 34 : 40,
          paddingHorizontal: compact ? space[3] : space[4],
          borderRadius: radius.pill,
          justifyContent: "center",
          backgroundColor: selected ? colors.cream : colors.surface,
          borderWidth: 1,
          borderColor: selected ? colors.cream : colors.line,
        },
        style,
      ]}
    >
      <Text variant="callout" color={selected ? colors.ink : colors.text2} weight="600">
        {label}
      </Text>
    </PressableScale>
  );
}

/** A horizontally scrolling row of pills. */
export function PillRow<K extends string>({ items, value, onChange, compact, style, contentPadding = 20 }: { items: { key: K; label: string }[]; value: K; onChange: (k: K) => void; compact?: boolean; style?: StyleProp<ViewStyle>; contentPadding?: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={{ paddingHorizontal: contentPadding, gap: space[2] }} accessibilityRole="tablist">
      {items.map((it) => (
        <Pill key={it.key} label={it.label} selected={it.key === value} onPress={() => onChange(it.key)} compact={compact} />
      ))}
      <View style={{ width: 1 }} />
    </ScrollView>
  );
}
