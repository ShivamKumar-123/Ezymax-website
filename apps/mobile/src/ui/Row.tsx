// Settings-style list row (label, value / chevron) and a hairline divider.
import * as React from "react";
import { View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { colors, space } from "@/theme/tokens";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={{ height: 1, backgroundColor: colors.line, marginStart: inset }} />;
}

export function ListRow({ icon, title, subtitle, value, onPress, chevron = !!onPress, destructive }: { icon?: React.ReactNode; title: string; subtitle?: string; value?: React.ReactNode; onPress?: () => void; chevron?: boolean; destructive?: boolean }) {
  const body = (
    <View style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[3] }}>
      {icon ? <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>{icon}</View> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline" weight="600" tone={destructive ? "ember" : "primary"}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="tertiary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {typeof value === "string" ? (
        <Text variant="callout" tone="secondary">
          {value}
        </Text>
      ) : (
        value
      )}
      {chevron ? <ChevronRight size={18} color={colors.text3} style={{ transform: [{ scaleX: 1 }] }} /> : null}
    </View>
  );
  return onPress ? (
    <PressableScale onPress={onPress} scaleTo={0.985}>
      {body}
    </PressableScale>
  ) : (
    body
  );
}
