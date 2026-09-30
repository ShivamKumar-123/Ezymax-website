// Inline notices: restrictions, view-only, offline, form errors. Warn = gold tint (never red: red is money).
import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { alpha } from "@/theme/alpha";
import { colors, radius, space } from "@/theme/tokens";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

export function Banner({ tone = "warn", title, body, action, onAction, icon, style }: { tone?: "warn" | "info" | "error"; title: string; body?: string; action?: string; onAction?: () => void; icon?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const bg = tone === "warn" ? colors.warnSoft : tone === "error" ? colors.downSoft : colors.surface;
  const border = tone === "warn" ? alpha(colors.warn, 0.28) : tone === "error" ? alpha(colors.down, 0.3) : colors.line;
  return (
    <View accessibilityRole="alert" style={[{ backgroundColor: bg, borderColor: border, borderWidth: 1, borderRadius: radius.lg, padding: space[4], flexDirection: "row", gap: space[3], alignItems: "flex-start" }, style]}>
      {icon}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" weight="700">
          {title}
        </Text>
        {body ? (
          <Text variant="caption" tone="secondary">
            {body}
          </Text>
        ) : null}
      </View>
      {action && onAction ? (
        <PressableScale onPress={onAction} scaleTo={1} style={{ minHeight: 32, justifyContent: "center" }}>
          <Text variant="caption" tone="ember" weight="700">
            {action}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <Banner tone="error" title={message} />;
}
