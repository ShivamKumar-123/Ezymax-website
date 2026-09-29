// Typography. Body text uses the system font (SF Pro / Roboto) for a native feel; <Display> is the tall condensed
// uppercase editorial face (Anton); <Mono> is the tabular face for prices and money (JetBrains Mono).
import * as React from "react";
import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { colors, display, fonts, text, type DisplaySize, type TextVariant } from "@/theme/tokens";

export type Tone = "primary" | "secondary" | "tertiary" | "ink" | "ink2" | "up" | "down" | "ember" | "gold" | "mint" | "periwinkle";
const TONES: Record<Tone, string> = {
  primary: colors.text,
  secondary: colors.text2,
  tertiary: colors.text3,
  ink: colors.ink,
  ink2: colors.ink2,
  up: colors.up,
  down: colors.down,
  ember: colors.ember,
  gold: colors.gold,
  mint: colors.mint,
  periwinkle: colors.periwinkle,
};

type Common = TextProps & { tone?: Tone; color?: string; align?: TextStyle["textAlign"] };

export function Text({ variant = "body", tone = "primary", color, align, weight, style, ...rest }: Common & { variant?: TextVariant; weight?: TextStyle["fontWeight"] }) {
  return <RNText {...rest} style={[text[variant] as TextStyle, { color: color ?? TONES[tone], textAlign: align }, weight ? { fontWeight: weight } : null, style]} />;
}

export function Display({ size = "lg", tone = "primary", color, align, style, children, ...rest }: Common & { size?: DisplaySize }) {
  return (
    <RNText {...rest} style={[display[size], { fontFamily: fonts.display, color: color ?? TONES[tone], textAlign: align, textTransform: "uppercase", letterSpacing: 0.3 }, style]}>
      {children}
    </RNText>
  );
}

export function Mono({ size = 15, weight = "regular", tone = "primary", color, align, style, ...rest }: Common & { size?: number; weight?: "regular" | "medium" | "bold" }) {
  const family = weight === "bold" ? fonts.monoBold : weight === "medium" ? fonts.monoMedium : fonts.mono;
  return <RNText {...rest} style={[{ fontFamily: family, fontSize: size, lineHeight: Math.round(size * 1.25), color: color ?? TONES[tone], textAlign: align, fontVariant: ["tabular-nums"] }, style]} />;
}

export const toneColor = (t: Tone) => TONES[t];
