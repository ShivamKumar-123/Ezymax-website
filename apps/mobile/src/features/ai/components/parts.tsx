// Small pieces of the AI Trader cards: buttons and tags that sit on colour blocks (ink on cream / mint), a label +
// value cell, the risk note and the thin progress bar. Built only on @/ui primitives and tokens.
import * as React from "react";
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from "react-native";
import { ShieldAlert } from "lucide-react-native";
import { useT } from "@/i18n";
import { Mono, PressableScale, Text } from "@/ui";
import { alpha } from "@/theme/alpha";
import { colors, radius, space } from "@/theme/tokens";

export type BlockButtonTone = "ink" | "outline" | "ember" | "cream" | "surface";

/** A pill button for colour blocks and cards (46 pt, never below the 44 pt target). */
export function BlockButton({ label, onPress, tone = "ink", icon, iconOnly, disabled, loading, testID, style, onPressIn }: { label: string; onPress: () => void; tone?: BlockButtonTone; icon?: React.ReactNode; iconOnly?: boolean; disabled?: boolean; loading?: boolean; testID?: string; style?: StyleProp<ViewStyle>; onPressIn?: () => void }) {
  const bg = tone === "ink" ? colors.ink : tone === "ember" ? colors.ember : tone === "cream" ? colors.cream : tone === "surface" ? colors.surface2 : "transparent";
  const fg = tone === "ink" ? colors.cream : tone === "surface" ? colors.text : colors.ink;
  const border = tone === "outline" ? alpha(colors.ink, 0.28) : tone === "surface" ? colors.lineStrong : "transparent";
  return (
    <PressableScale
      onPress={onPress}
      onPressIn={onPressIn}
      disabled={disabled || loading}
      accessibilityLabel={label}
      testID={testID}
      style={[{ height: 46, minWidth: 46, paddingHorizontal: iconOnly ? 0 : space[4], width: iconOnly ? 46 : undefined, borderRadius: radius.pill, backgroundColor: bg, borderWidth: 1, borderColor: border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2] }, style]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon}
          {iconOnly ? null : (
            <Text variant="callout" weight="700" color={fg} numberOfLines={1}>
              {label}
            </Text>
          )}
        </>
      )}
    </PressableScale>
  );
}

/** Tiny uppercase tag: filled (ink text) or ink outline, for colour blocks. */
export function InkTag({ label, fill, mono }: { label: string; fill?: string; mono?: boolean }) {
  return (
    <View style={{ height: 24, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: fill ?? "transparent", borderWidth: fill ? 0 : 1, borderColor: alpha(colors.ink, 0.3), justifyContent: "center" }}>
      {mono ? (
        <Mono size={12} weight="bold" color={colors.ink}>
          {label}
        </Mono>
      ) : (
        <Text variant="label" color={colors.ink} style={{ fontSize: 10.5, letterSpacing: 0.8 }} numberOfLines={1}>
          {label}
        </Text>
      )}
    </View>
  );
}

/** Ink chip with cream text (symbol, timeframe, size on the strategy card). */
export function InkChip({ label, mono = true }: { label: string; mono?: boolean }) {
  return (
    <View style={{ height: 30, paddingHorizontal: space[3], borderRadius: radius.pill, backgroundColor: colors.ink, justifyContent: "center" }}>
      {mono ? (
        <Mono size={13} weight="bold" color={colors.cream}>
          {label}
        </Mono>
      ) : (
        <Text variant="caption" weight="700" color={colors.cream}>
          {label}
        </Text>
      )}
    </View>
  );
}

/** Small uppercase label over a value (on a colour block: ink; on a dark card: cream). */
export function Cell({ label, value, onBlock, style, valueColor, mono }: { label: string; value: string; onBlock?: boolean; style?: StyleProp<ViewStyle>; valueColor?: string; mono?: boolean }) {
  return (
    <View style={[{ gap: 3, minWidth: 0 }, style]}>
      <Text variant="label" color={onBlock ? colors.ink2 : colors.text3} style={{ fontSize: 10.5 }} numberOfLines={1}>
        {label}
      </Text>
      {mono ? (
        <Mono size={15} weight="bold" color={valueColor ?? (onBlock ? colors.ink : colors.text)} numberOfLines={2}>
          {value}
        </Mono>
      ) : (
        <Text variant="callout" weight="700" color={valueColor ?? (onBlock ? colors.ink : colors.text)} numberOfLines={3}>
          {value}
        </Text>
      )}
    </View>
  );
}

/** The standing risk note: AI Trader is a tool, not advice. */
export function RiskNote({ compact, style }: { compact?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  return (
    <View style={[{ flexDirection: "row", gap: space[2], alignItems: "flex-start" }, style]} accessibilityRole="text">
      <ShieldAlert size={compact ? 13 : 16} color={colors.text3} strokeWidth={1.9} style={{ marginTop: compact ? 1 : 2 }} />
      <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
        {compact ? t("mobileAi.riskShort") : t("mobileAi.riskNote")}
      </Text>
    </View>
  );
}

/** A thin progress bar (backtest progress): it moves only when the server reports progress. */
export function ProgressBar({ value, color = colors.ember, track = colors.surface3 }: { value: number; color?: string; track?: string }) {
  const pct = Math.max(0.03, Math.min(1, value));
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: track, overflow: "hidden" }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      <View style={{ width: `${pct * 100}%`, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}
