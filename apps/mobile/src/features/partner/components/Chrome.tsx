// Page chrome for the partner and rewards screens (the same anatomy as the other stack screens): a 56 pt bar with
// back and a small title that fades in once the big display title has scrolled away, the eyebrow + display title,
// section headings, tags and label-over-number stats. Built only on @/ui and tokens.
import * as React from "react";
import { RefreshControl, View, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { Display, IconButton, Mono, PressableScale, Text } from "@/ui";
import { blockColors, colors, GUTTER, radius, space, type BlockColor } from "@/theme/tokens";
import { tint } from "../tint";

/** Safe-area page with a fixed bar on top; the body scrolls under it. */
export function Page({ bar, children }: { bar: React.ReactNode; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {bar}
      {children}
    </View>
  );
}

/** Mirrors a directional icon in right-to-left languages (as a view: an SVG flips around its corner on the web). */
export function Flip({ children }: { children: React.ReactNode }) {
  const { rtl } = useLocale();
  return <View style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}>{children}</View>;
}

/** The scroll position as a shared value (drives the bar's title on the UI thread) and the scroll handler. */
export function useScrollY() {
  const scrollY = useSharedValue(0);
  const onScroll = React.useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = e.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );
  return { scrollY, onScroll };
}

/** 56 pt bar: back (flips in RTL), a small centred title shown once `scrollY` passes the big title, actions. */
export const StackBar = React.memo(function StackBar({ title, scrollY, right, onBack }: { title: string; scrollY: SharedValue<number>; right?: React.ReactNode; onBack?: () => void }) {
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
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/")))}
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
});

/** Display size that keeps a one-line title inside the phone's width (react-native-web ignores adjustsFontSizeToFit). */
function titleSize(title: string): "xl" | "lg" | "md" {
  const n = title.length;
  return n > 16 ? "md" : n > 12 ? "lg" : "xl";
}

export function PageTitle({ eyebrow, title, children, style }: { eyebrow?: string; title: string; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ paddingHorizontal: GUTTER, paddingTop: space[1], paddingBottom: space[5], gap: space[1] }, style]}>
      {eyebrow ? (
        <Text variant="label" tone="ember" numberOfLines={1}>
          {eyebrow}
        </Text>
      ) : null}
      <Display size={titleSize(title)} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
        {title}
      </Display>
      {children}
    </View>
  );
}

/** Section heading (Anton, uppercase), an optional line under it and a trailing element (e.g. "See all"). */
export function SectionTitle({ title, subtitle, right, style }: { title: string; subtitle?: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "flex-end", gap: space[3], marginBottom: space[3] }, style]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Display size="sm" accessibilityRole="header" numberOfLines={1}>
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

/** "See all" style trailing link of a section (44 pt target). */
export function SectionLink({ label, onPress, onPressIn }: { label: string; onPress: () => void; onPressIn?: () => void }) {
  return (
    <PressableScale onPress={onPress} onPressIn={onPressIn} scaleTo={1} accessibilityRole="link" style={{ minHeight: 44, justifyContent: "flex-end", paddingBottom: 2 }}>
      <Text variant="callout" tone="ember" weight="700">
        {label}
      </Text>
    </PressableScale>
  );
}

/** Small uppercase label. */
export function Label({ children, color, style, lines = 1 }: { children: React.ReactNode; color?: string; style?: StyleProp<TextStyle>; lines?: number }) {
  return (
    <Text variant="label" color={color ?? colors.text3} numberOfLines={lines} style={[{ fontSize: 10.5 }, style]}>
      {children}
    </Text>
  );
}

export type TagTone = BlockColor | "outline" | "muted" | "warn" | "risk" | "ok";

/**
 * Small pill: a colour fill (ink text), an outline, a gold warning, or a green / red money state (paid, clawback).
 * Green and red are for money only.
 */
/** `caps: false` for sentences (a broker's reason) instead of a one-word state. */
export function Tag({ label, tone = "outline", mono, caps = true, style }: { label: string; tone?: TagTone; mono?: boolean; caps?: boolean; style?: StyleProp<ViewStyle> }) {
  const filled = tone in blockColors;
  const bg = filled ? blockColors[tone as BlockColor] : tone === "warn" ? colors.warnSoft : tone === "risk" ? colors.downSoft : tone === "ok" ? colors.upSoft : "transparent";
  const border = filled ? "transparent" : tone === "warn" ? tint.warnBorder : tone === "risk" ? tint.riskBorder : tone === "ok" ? tint.okBorder : colors.lineStrong;
  const fg = filled ? colors.ink : tone === "warn" ? colors.warn : tone === "risk" ? colors.down : tone === "ok" ? colors.up : tone === "muted" ? colors.text3 : colors.text2;
  return (
    <View style={[{ height: 22, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: bg, borderWidth: 1, borderColor: border, justifyContent: "center", alignSelf: "flex-start", maxWidth: "100%" }, style]}>
      {mono ? (
        <Mono size={11.5} weight="bold" color={fg} numberOfLines={1}>
          {label}
        </Mono>
      ) : caps ? (
        <Text variant="label" color={fg} numberOfLines={1} style={{ fontSize: 10, letterSpacing: 0.8 }}>
          {label}
        </Text>
      ) : (
        <Text variant="caption" color={fg} weight="600" numberOfLines={1} style={{ fontSize: 12, lineHeight: 15 }}>
          {label}
        </Text>
      )}
    </View>
  );
}

/** Label over a value (tabular). `ink` for use on colour blocks. */
export function Stat({ label, value, ink, size = 17, tone, align = "start", style }: { label: string; value: string; ink?: boolean; size?: number; tone?: "up" | "down" | null; align?: "start" | "end"; style?: StyleProp<ViewStyle> }) {
  const color = ink ? colors.ink : tone === "up" ? colors.up : tone === "down" ? colors.down : colors.text;
  return (
    <View style={[{ gap: 3, minWidth: 0, alignItems: align === "end" ? "flex-end" : "flex-start" }, style]}>
      <Label color={ink ? colors.ink2 : undefined}>{label}</Label>
      <Mono size={size} weight="bold" color={color} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Mono>
    </View>
  );
}

/** A thin progress bar (static: it only moves when the data does). */
export function Bar({ pct, color = colors.ember, track = colors.surface3, height = 6, style }: { pct: number; color?: string; track?: string; height?: number; style?: StyleProp<ViewStyle> }) {
  const w = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: track, overflow: "hidden" }, style]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(w) }}>
      <View style={{ width: `${w}%`, height: "100%", borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

/** A navigation row inside a card: icon, title, subtitle, trailing value and a chevron (44 pt+ target). */
export const NavRow = React.memo(function NavRow({ icon, title, subtitle, value, onPress, onPressIn, first }: { icon?: React.ReactNode; title: string; subtitle?: string; value?: string; onPress: () => void; onPressIn?: () => void; first?: boolean }) {
  return (
    <PressableScale onPress={onPress} onPressIn={onPressIn} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title} style={{ minHeight: 64, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[5], paddingVertical: space[3], borderTopWidth: first ? 0 : 1, borderTopColor: colors.line }}>
      {icon ? <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>{icon}</View> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline" weight="600" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Mono size={14} weight="medium" tone="secondary" numberOfLines={1}>
          {value}
        </Mono>
      ) : null}
      <Flip>
        <ChevronRight size={18} color={colors.text3} />
      </Flip>
    </PressableScale>
  );
});

/** Initials in a round chip (the partner programme never shows client photos; masked names are "P. S."). */
export const Initials = React.memo(function Initials({ name, size = 36, color = colors.surface2, ink }: { name: string; size?: number; color?: string; ink?: boolean }) {
  const letters = name
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: "center", justifyContent: "center" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text variant="caption" weight="700" color={ink ? colors.ink : colors.text2} style={{ fontSize: size > 40 ? 15 : 12.5 }}>
        {letters || "·"}
      </Text>
    </View>
  );
});

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
  return React.useMemo(() => <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} />, [refreshing, onRefresh]);
}
