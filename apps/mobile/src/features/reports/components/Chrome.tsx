// Page chrome for the reports screens (same anatomy as the other stack screens): a 56 pt bar with back and a
// small title that fades in once the big display title has scrolled away, the eyebrow + display title, section
// headings and small tags. Built only on @/ui and tokens.
import * as React from "react";
import { RefreshControl, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { Display, IconButton, Mono, Text } from "@/ui";
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

/** Mirrors a directional icon in right-to-left languages (flipped as a view: an SVG would flip around its corner on the web). */
export function Flip({ children }: { children: React.ReactNode }) {
  const { rtl } = useLocale();
  return <View style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}>{children}</View>;
}

export function StackBar({ title, scrollY, right }: { title: string; scrollY: SharedValue<number>; right?: React.ReactNode }) {
  const router = useRouter();
  const t = useT();
  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [44, 76], [0, 1], "clamp"),
    transform: [{ translateY: interpolate(scrollY.value, [44, 76], [6, 0], "clamp") }],
  }));
  const lineStyle = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, 24], [0, 1], "clamp") }));
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
        <Text variant="headline" numberOfLines={1}>
          {title}
        </Text>
      </Animated.View>
      <View style={{ minWidth: 44, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: space[2] }}>{right}</View>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", start: 0, end: 0, bottom: 0, height: 1, backgroundColor: colors.line }, lineStyle]} />
    </View>
  );
}

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

/** Section heading (Anton, uppercase), an optional line under it and a trailing element. */
export function SectionTitle({ title, subtitle, right, style }: { title: string; subtitle?: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "flex-end", gap: space[3], marginBottom: space[3] }, style]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Display size="sm" accessibilityRole="header">
          {title}
        </Display>
        {subtitle ? (
          <Text variant="caption" tone="tertiary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/** Small uppercase label. */
export function Label({ children, color, style }: { children: React.ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  return (
    <Text variant="label" color={color ?? colors.text3} numberOfLines={1} style={[{ fontSize: 10.5 }, style]}>
      {children}
    </Text>
  );
}

export type TagTone = BlockColor | "outline" | "muted";

export function Tag({ label, tone = "outline", mono, style }: { label: string; tone?: TagTone; mono?: boolean; style?: StyleProp<ViewStyle> }) {
  const filled = tone in blockColors;
  const fg = filled ? colors.ink : tone === "muted" ? colors.text3 : colors.text2;
  return (
    <View style={[{ height: 22, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: filled ? blockColors[tone as BlockColor] : "transparent", borderWidth: filled ? 0 : 1, borderColor: colors.lineStrong, justifyContent: "center", alignSelf: "flex-start" }, style]}>
      {mono ? (
        <Mono size={11.5} weight="bold" color={fg} numberOfLines={1}>
          {label}
        </Mono>
      ) : (
        <Text variant="label" color={fg} numberOfLines={1} style={{ fontSize: 10, letterSpacing: 0.8 }}>
          {label}
        </Text>
      )}
    </View>
  );
}

/** LIVE (ember) / DEMO (gold), as on the Accounts screens. */
export function KindTag({ type }: { type: "live" | "demo" }) {
  const t = useT();
  return <Tag label={type === "live" ? t("common.live") : t("common.demo")} tone={type === "live" ? "ember" : "gold"} />;
}

/** Pull to refresh with the haptic tick (same behaviour as <Screen onRefresh>). */
export function useRefresh(fn: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = React.useState(false);
  const fnRef = React.useRef(fn);
  fnRef.current = fn;
  const onRefresh = React.useCallback(async () => {
    haptic.select();
    setRefreshing(true);
    try {
      await fnRef.current();
    } finally {
      setRefreshing(false);
    }
  }, []);
  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />;
}
