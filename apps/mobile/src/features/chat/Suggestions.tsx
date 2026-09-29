// Suggestion pills above the composer: one tap sends the suggestion (or runs an action). Horizontally scrolling,
// 40 pt tall with a 44 pt hit area, outline style so they read as offers, not as selected tabs.
import * as React from "react";
import { ScrollView, View } from "react-native";
import { PressableScale, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";

export type Suggestion = { key: string; label: string; icon?: React.ReactNode; tone?: "outline" | "cream" };

export const Suggestions = React.memo(function Suggestions({ items, onPick, disabled, testID }: { items: Suggestion[]; onPick: (key: string) => void; disabled?: boolean; testID?: string }) {
  if (!items.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      contentContainerStyle={{ paddingHorizontal: GUTTER, gap: space[2], paddingBottom: space[2] }}
      testID={testID}
    >
      {items.map((s) => (
        <PressableScale
          key={s.key}
          onPress={() => onPick(s.key)}
          disabled={disabled}
          accessibilityLabel={s.label}
          testID={testID ? `${testID}-${s.key}` : undefined}
          style={{
            height: 40,
            maxWidth: 300,
            paddingHorizontal: space[4],
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: s.tone === "cream" ? colors.cream : colors.lineStrong,
            backgroundColor: s.tone === "cream" ? colors.cream : colors.surface,
            flexDirection: "row",
            alignItems: "center",
            gap: space[2],
          }}
        >
          {s.icon ? <View>{s.icon}</View> : null}
          <Text variant="callout" weight="600" color={s.tone === "cream" ? colors.ink : colors.text} numberOfLines={1} style={{ flexShrink: 1 }}>
            {s.label}
          </Text>
        </PressableScale>
      ))}
    </ScrollView>
  );
});
