// The Kalks AI avatar: the founder's mascot robot (the "mascot" illustration) framed on its head. The art is the
// whole waving robot (portrait), so the image is drawn larger than the circle, centred on the helmet, and the
// circle clips the rest. Centring + a translate (not left / right offsets) keeps the crop identical in RTL, where
// the art itself is never mirrored.
import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Illustration, Text } from "@/ui";
import { colors } from "@/theme/tokens";

// The helmet inside the art (fractions of the art's width / height, measured on the @2x export): a square of
// 0.79 × the art's width around (0.58, 0.31).
const CROP = { side: 0.789, cx: 0.58, top: 0.074 };
const ASPECT = 0.605; // width / height of the mascot art (illustrations.generated.ts)

export const MascotAvatar = React.memo(function MascotAvatar({ size = 36, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const artW = size / CROP.side;
  const artH = artW / ASPECT;
  return (
    <View
      style={[{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", alignItems: "center", backgroundColor: colors.surface3 }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Illustration name="mascot" width={artW} height={artH} style={{ marginTop: -CROP.top * artH, transform: [{ translateX: (0.5 - CROP.cx) * artW }] }} />
    </View>
  );
});

/** Initials in a colour circle: support agents (the service sends a name, never a photo). */
export const InitialsAvatar = React.memo(function InitialsAvatar({ name, size = 36, tone = "cream" }: { name: string; size?: number; tone?: "cream" | "periwinkle" | "mint" }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "?";
  const bg = tone === "periwinkle" ? colors.periwinkle : tone === "mint" ? colors.mint : colors.cream;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text color={colors.ink} weight="800" style={{ fontSize: Math.round(size * 0.38), lineHeight: Math.round(size * 0.46) }}>
        {initials}
      </Text>
    </View>
  );
});
