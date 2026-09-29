// Small pills and progress pieces shared by the Academy screens.
import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Check, Lock } from "lucide-react-native";
import { Text } from "@/ui";
import { colors, fonts, radius, space } from "@/theme/tokens";
import { tint } from "../tint";

/** A compact pill: `solid` fills with the colour (ink text), otherwise a tinted outline. */
export function Tag({ label, color = colors.text2, solid, fg, style, testID }: { label: string; color?: string; solid?: boolean; fg?: string; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View testID={testID} style={[{ height: 26, paddingHorizontal: space[3], borderRadius: radius.pill, justifyContent: "center", backgroundColor: solid ? color : tint(color, 0.1), borderWidth: solid ? 0 : 1, borderColor: solid ? color : tint(color, 0.3) }, style]}>
      <Text variant="label" color={fg ?? (solid ? colors.ink : color)} style={{ fontSize: 10, lineHeight: 13, letterSpacing: 0.8 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** A thin progress bar; `ink` for colour blocks. */
export function Bar({ value, ink, color, style, height = 6 }: { value: number; ink?: boolean; color?: string; style?: StyleProp<ViewStyle>; height?: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: ink ? "rgba(14,14,16,0.14)" : colors.surface3, overflow: "hidden", flexDirection: "row" }, style]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: v }}>
      <View style={{ width: `${v}%`, height, borderRadius: height / 2, backgroundColor: color ?? (ink ? colors.ink : colors.ember) }} />
    </View>
  );
}

/** One segment per chapter (the web's phase progress). */
export function Segments({ done, total, ink, style }: { done: number; total: number; ink?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", gap: 3 }, style]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: done }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < done ? (ink ? colors.ink : colors.ember) : ink ? "rgba(14,14,16,0.14)" : colors.surface3 }} />
      ))}
    </View>
  );
}

/** Chapter status circle: done (mint check), next (ember ring), locked, or its number. */
export function StatusDot({ state, n, size = 32 }: { state: "done" | "next" | "open" | "locked"; n?: number; size?: number }) {
  const done = state === "done";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: done ? colors.mint : state === "next" ? tint(colors.ember, 0.12) : colors.surface2,
        borderWidth: done ? 0 : 1,
        borderColor: state === "next" ? colors.ember : colors.line,
      }}
    >
      {done ? (
        <Check size={size * 0.47} color={colors.ink} strokeWidth={2.8} />
      ) : state === "locked" ? (
        <Lock size={size * 0.42} color={colors.text3} />
      ) : (
        <Text style={{ fontFamily: fonts.monoMedium, fontSize: 12, lineHeight: 15 }} color={state === "next" ? colors.ember : colors.text2}>
          {n ?? ""}
        </Text>
      )}
    </View>
  );
}
