// Page chrome for the Depth and Price alerts screens (the same anatomy as the other stack screens): a 56 pt bar with
// back and a small title (optionally fading in once the big display title has scrolled away), the eyebrow + display
// title, small tags and a switch. Built only on @/ui and tokens.
import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { Display, IconButton, PressableScale, Text } from "@/ui";
import { blockColors, colors, GUTTER, radius, space, type BlockColor } from "@/theme/tokens";

export function Page({ bar, children }: { bar: React.ReactNode; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {bar}
      {children}
    </View>
  );
}

/** Mirrors a directional icon in right-to-left languages (flipped as a view: an SVG flips around its corner). */
export function Flip({ children }: { children: React.ReactNode }) {
  const { rtl } = useLocale();
  return <View style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}>{children}</View>;
}

/** 56 pt bar: back, a small centred title (always shown, or faded in with `scrollY`), actions. */
export const StackBar = React.memo(function StackBar({ title, scrollY, right }: { title?: string; scrollY?: SharedValue<number>; right?: React.ReactNode }) {
  const router = useRouter();
  const t = useT();
  const titleStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 1 };
    return { opacity: interpolate(scrollY.value, [44, 76], [0, 1], "clamp"), transform: [{ translateY: interpolate(scrollY.value, [44, 76], [6, 0], "clamp") }] };
  });
  const lineStyle = useAnimatedStyle(() => ({ opacity: scrollY ? interpolate(scrollY.value, [0, 24], [0, 1], "clamp") : 1 }));
  return (
    <View style={{ height: 56, paddingHorizontal: GUTTER - 6, flexDirection: "row", alignItems: "center", gap: space[2] }}>
      <IconButton
        accessibilityLabel={t("mobile.a11y.back")}
        tone="ghost"
        icon={
          <Flip>
            <ChevronLeft size={26} color={colors.text} strokeWidth={2} />
          </Flip>
        }
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      />
      <Animated.View style={[{ flex: 1, alignItems: "center" }, titleStyle]} pointerEvents="none">
        {title ? (
          <Text variant="headline" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </Animated.View>
      <View style={{ minWidth: 44, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: space[2] }}>{right}</View>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", start: 0, end: 0, bottom: 0, height: 1, backgroundColor: colors.line }, lineStyle]} />
    </View>
  );
});

export function PageTitle({ eyebrow, title, style }: { eyebrow?: string; title: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ paddingHorizontal: GUTTER, paddingTop: space[1], paddingBottom: space[5], gap: space[1] }, style]}>
      {eyebrow ? (
        <Text variant="label" tone="ember">
          {eyebrow}
        </Text>
      ) : null}
      <Display size="xl" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
        {title}
      </Display>
    </View>
  );
}

export type TagTone = BlockColor | "outline" | "muted" | "warn";

/** Small pill label: a colour fill (ink text), an outline, muted or a gold warning. */
export function Tag({ label, tone = "outline", style }: { label: string; tone?: TagTone; style?: StyleProp<ViewStyle> }) {
  const filled = tone in blockColors;
  const fg = filled ? colors.ink : tone === "muted" ? colors.text3 : tone === "warn" ? colors.gold : colors.text2;
  const border = filled ? "transparent" : tone === "warn" ? "rgba(242,184,75,0.35)" : colors.lineStrong;
  return (
    <View style={[{ height: 22, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: filled ? blockColors[tone as BlockColor] : "transparent", borderWidth: filled ? 0 : 1, borderColor: border, justifyContent: "center", alignSelf: "flex-start" }, style]}>
      <Text variant="label" color={fg} numberOfLines={1} style={{ fontSize: 10, letterSpacing: 0.8 }}>
        {label}
      </Text>
    </View>
  );
}

/** A 44 pt switch row target; the knob moves to the end when on. */
export function Switch({ value, onChange, label, disabled }: { value: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <PressableScale
      onPress={() => onChange(!value)}
      disabled={disabled}
      haptics="select"
      scaleTo={0.95}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={{ minWidth: 52, minHeight: 44, alignItems: "center", justifyContent: "center" }}
    >
      <View style={{ width: 46, height: 28, borderRadius: 14, backgroundColor: value ? colors.ember : colors.surface3, padding: 3, alignItems: value ? "flex-end" : "flex-start" }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.cream }} />
      </View>
    </PressableScale>
  );
}
