// Surfaces. <Card> is the quiet dark surface; <ColorBlock> is the bold saturated editorial block (ink text on it).
import * as React from "react";
import { View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { blockColors, colors, radius, space, type BlockColor } from "@/theme/tokens";
import { PressableScale } from "./PressableScale";

type CardProps = ViewProps & { padded?: boolean; onPress?: () => void; /** warm the next screen's data (prefetch) */ onPressIn?: () => void; style?: StyleProp<ViewStyle>; tone?: "surface" | "raised" };

export function Card({ padded = true, onPress, onPressIn, style, tone = "surface", children, ...rest }: CardProps) {
  const s: StyleProp<ViewStyle> = [
    { backgroundColor: tone === "raised" ? colors.surface2 : colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: padded ? space[5] : 0, overflow: "hidden" },
    style,
  ];
  if (onPress)
    return (
      <PressableScale onPress={onPress} onPressIn={onPressIn} style={s} {...(rest as object)}>
        {children}
      </PressableScale>
    );
  return (
    <View style={s} {...rest}>
      {children}
    </View>
  );
}

type BlockProps = ViewProps & { color: BlockColor; padded?: boolean; onPress?: () => void; /** warm the next screen's data (prefetch) */ onPressIn?: () => void; style?: StyleProp<ViewStyle> };

export function ColorBlock({ color, padded = true, onPress, onPressIn, style, children, ...rest }: BlockProps) {
  const s: StyleProp<ViewStyle> = [{ backgroundColor: blockColors[color], borderRadius: radius.block, padding: padded ? space[6] : 0, overflow: "hidden" }, style];
  if (onPress)
    return (
      <PressableScale onPress={onPress} onPressIn={onPressIn} style={s} {...(rest as object)}>
        {children}
      </PressableScale>
    );
  return (
    <View style={s} {...rest}>
      {children}
    </View>
  );
}
