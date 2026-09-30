// Buttons: pill-shaped, 52 pt tall by default. `buy` / `sell` are the only green / red buttons (money actions).
import * as React from "react";
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, space } from "@/theme/tokens";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "cream" | "buy" | "sell" | "danger";
const BG: Record<ButtonVariant, string> = { primary: colors.ember, secondary: colors.surface2, ghost: "transparent", cream: colors.cream, buy: colors.up, sell: colors.down, danger: colors.surface2 };
// ink on the sell red too: light text on the web palette's red is under 4.5:1
const FG: Record<ButtonVariant, string> = { primary: colors.ink, secondary: colors.text, ghost: colors.text, cream: colors.ink, buy: colors.ink, sell: colors.ink, danger: colors.down };

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: "lg" | "md" | "sm";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

export function Button({ label, onPress, variant = "primary", size = "lg", loading, disabled, icon, trailing, full = true, style, accessibilityLabel, testID }: ButtonProps) {
  const h = size === "lg" ? 54 : size === "md" ? 46 : 38;
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      haptics="tap"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        {
          height: h,
          minWidth: 44,
          paddingHorizontal: size === "sm" ? space[4] : space[6],
          borderRadius: radius.pill,
          backgroundColor: BG[variant],
          borderWidth: variant === "ghost" || variant === "secondary" || variant === "danger" ? 1 : 0,
          borderColor: colors.lineStrong,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: space[2],
          alignSelf: full ? "stretch" : "flex-start",
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={FG[variant]} />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text variant={size === "sm" ? "callout" : "headline"} color={FG[variant]} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>
            {label}
          </Text>
          {trailing ? <View>{trailing}</View> : null}
        </>
      )}
    </PressableScale>
  );
}

/** Round icon button (44 pt). */
export function IconButton({ icon, onPress, accessibilityLabel, tone = "surface", size = 44, badge }: { icon: React.ReactNode; onPress?: () => void; accessibilityLabel: string; tone?: "surface" | "ghost" | "cream"; size?: number; badge?: number }) {
  return (
    <PressableScale
      onPress={onPress}
      haptics="select"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: tone === "cream" ? colors.cream : tone === "surface" ? colors.surface : "transparent", borderWidth: tone === "surface" ? 1 : 0, borderColor: colors.line }}
    >
      {icon}
      {badge ? (
        <View style={{ position: "absolute", top: 6, end: 6, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: colors.ember, alignItems: "center", justifyContent: "center" }}>
          <Text variant="label" color={colors.ink} style={{ fontSize: 9, lineHeight: 11, letterSpacing: 0 }}>
            {badge > 99 ? "99+" : String(badge)}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  );
}
