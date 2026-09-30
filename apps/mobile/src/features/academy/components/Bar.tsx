// Academy stack chrome: a fixed top bar (back button, end-side actions) whose compact title fades in once the tall
// editorial title has scrolled away, plus the large title block itself. The fade and the reader's progress line run
// on the UI thread from the scroll position, so scrolling never re-renders the screen.
import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { Display, IconButton, Text } from "@/ui";
import { colors, GUTTER, space, type DisplaySize } from "@/theme/tokens";

export const BAR_HEIGHT = 52;

const MIRROR = { transform: [{ scaleX: -1 }] } as const;

/** A direction icon (arrow, chevron) that points the reading way: mirrored right to left. The mirror is on a wrapping
 *  view, so it turns around the icon's centre everywhere (on the svg itself the web preview mirrors it off-screen). */
export function Directional({ children }: { children: React.ReactNode }) {
  const { rtl } = useLocale();
  return <View style={rtl ? MIRROR : undefined}>{children}</View>;
}

export function BackButton({ onPress }: { onPress?: () => void }) {
  const router = useRouter();
  const t = useT();
  return (
    <IconButton
      tone="ghost"
      accessibilityLabel={t("mobile.a11y.back")}
      icon={
        <Directional>
          <ChevronLeft size={26} color={colors.text} strokeWidth={2} />
        </Directional>
      }
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace("/academy")))}
    />
  );
}

/** Scroll offset on the UI thread: `onScroll` for Animated.ScrollView, `onScrollJs` for lists (FlashList). */
export function useScrollY() {
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  const onScrollJs = React.useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      y.value = e.nativeEvent.contentOffset.y;
    },
    [y],
  );
  return { y, onScroll, onScrollJs };
}

/** `progress`: 0..100 on the UI thread, drawn as a thin ember line under the bar (the chapter reader). */
export function TopBar({ title, right, y, progress, alwaysTitle, onBack }: { title?: string; right?: React.ReactNode; y?: SharedValue<number>; progress?: SharedValue<number>; alwaysTitle?: boolean; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  const { rtl } = useLocale();
  const titleStyle = useAnimatedStyle(() => ({ opacity: alwaysTitle || !y ? 1 : interpolate(y.value, [40, 84], [0, 1], Extrapolation.CLAMP) }));
  const lineStyle = useAnimatedStyle(() => ({ opacity: alwaysTitle || !y ? 1 : interpolate(y.value, [56, 96], [0, 1], Extrapolation.CLAMP) }));
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress ? Math.max(0, Math.min(100, progress.value)) / 100 : 0 }] }));
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.bg, zIndex: 2 }}>
      <View style={{ height: BAR_HEIGHT, flexDirection: "row", alignItems: "center", paddingHorizontal: space[2] }}>
        <View style={{ width: 96, flexDirection: "row" }}>
          <BackButton onPress={onBack} />
        </View>
        <Animated.View style={[{ flex: 1, alignItems: "center" }, titleStyle]} pointerEvents="none">
          {title ? (
            <Display size="xs" numberOfLines={1}>
              {title}
            </Display>
          ) : null}
        </Animated.View>
        <View style={{ width: 96, flexDirection: "row", justifyContent: "flex-end", gap: space[1] }}>{right}</View>
      </View>
      {progress ? (
        <View style={{ height: 2, backgroundColor: colors.line, overflow: "hidden" }}>
          {/* a transform (no layout per frame), growing from the reading start edge */}
          <Animated.View style={[{ height: 2, width: "100%", backgroundColor: colors.ember, transformOrigin: rtl ? "right" : "left" }, barStyle]} />
        </View>
      ) : (
        <Animated.View style={[{ height: 1, backgroundColor: colors.line }, lineStyle]} />
      )}
    </View>
  );
}

/** Display size that keeps a title inside the screen (RN web ignores adjustsFontSizeToFit). */
export function titleSize(title: string, base: DisplaySize = "xl"): DisplaySize {
  const n = title.length;
  if (base === "xl") return n > 22 ? "md" : n > 14 ? "lg" : "xl";
  if (base === "lg") return n > 28 ? "md" : "lg";
  return base;
}

export function LargeTitle({ eyebrow, title, subtitle, right, style, size }: { eyebrow?: string; title: string; subtitle?: string; right?: React.ReactNode; style?: StyleProp<ViewStyle>; size?: DisplaySize }) {
  return (
    <View style={[{ paddingHorizontal: GUTTER, paddingTop: space[1], paddingBottom: space[5], gap: space[1] }, style]}>
      {eyebrow ? (
        <Text variant="label" tone="ember">
          {eyebrow}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space[3] }}>
        <Display size={size ?? titleSize(title)} accessibilityRole="header" style={{ flex: 1 }}>
          {title}
        </Display>
        {right}
      </View>
      {subtitle ? (
        <Text tone="secondary" style={{ marginTop: space[1] }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** Small uppercase section heading with an optional end-side action. */
export function SectionTitle({ title, action, onAction, style }: { title: string; action?: React.ReactNode; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ paddingHorizontal: GUTTER, marginTop: space[8], marginBottom: space[3], flexDirection: "row", alignItems: "flex-end", gap: space[3] }, style]}>
      <Display size="sm" style={{ flex: 1 }} accessibilityRole="header">
        {title}
      </Display>
      {action}
    </View>
  );
}
