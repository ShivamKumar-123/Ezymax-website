// Chrome of the platform screens (inbox, app lock settings, Google profile step): a fixed top bar with the back button
// whose compact title fades in once the tall editorial title has scrolled under it. The fade runs on the UI thread
// from the scroll position (a shared value), so scrolling never re-renders the screen.
import * as React from "react";
import { View, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { Display, IconButton, Text } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";

export const BAR = 52;

export function BackButton({ onPress, fallback = "/more" }: { onPress?: () => void; fallback?: Href }) {
  const router = useRouter();
  const t = useT();
  const { rtl } = useLocale();
  return (
    <IconButton
      tone="ghost"
      accessibilityLabel={t("mobile.a11y.back")}
      icon={
        <View style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}>
          <ChevronLeft size={26} color={colors.text} strokeWidth={2} />
        </View>
      }
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace(fallback)))}
    />
  );
}

/** Scroll position for the bar (UI thread); `onScrollJs` for lists that take a plain handler (FlashList). */
export function useScrollY() {
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  const onScrollJs = React.useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      y.value = e.nativeEvent.contentOffset.y;
    },
    [y],
  );
  return { y, onScroll, onScrollJs };
}

export function TopBar({ title, right, y, onBack, back = true, fallback }: { title?: string; right?: React.ReactNode; y: SharedValue<number>; onBack?: () => void; back?: boolean; fallback?: Href }) {
  const insets = useSafeAreaInsets();
  const titleStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [36, 72], [0, 1], Extrapolation.CLAMP) }));
  const lineStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [50, 90], [0, 1], Extrapolation.CLAMP) }));
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.bg, zIndex: 2 }}>
      <View style={{ height: BAR, flexDirection: "row", alignItems: "center", paddingHorizontal: space[2] }}>
        <View style={{ width: 96, flexDirection: "row" }}>{back ? <BackButton onPress={onBack} fallback={fallback} /> : null}</View>
        <Animated.View style={[{ flex: 1, alignItems: "center" }, titleStyle]} pointerEvents="none">
          {title ? (
            <Display size="xs" numberOfLines={1}>
              {title}
            </Display>
          ) : null}
        </Animated.View>
        <View style={{ width: 96, flexDirection: "row", justifyContent: "flex-end", gap: space[1] }}>{right}</View>
      </View>
      <Animated.View style={[{ height: 1, backgroundColor: colors.line }, lineStyle]} />
    </View>
  );
}

export function LargeTitle({ eyebrow, title, subtitle, style }: { eyebrow?: string; title: string; subtitle?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ paddingHorizontal: GUTTER, paddingTop: space[1], paddingBottom: space[5], gap: space[1] }, style]}>
      {eyebrow ? (
        <Text variant="label" tone="ember">
          {eyebrow}
        </Text>
      ) : null}
      <Display size={title.length > 14 ? "lg" : "xl"} accessibilityRole="header" numberOfLines={2}>
        {title}
      </Display>
      {subtitle ? typeof subtitle === "string" ? <Text tone="secondary" style={{ marginTop: space[1] }}>{subtitle}</Text> : subtitle : null}
    </View>
  );
}

/** A rounded group of rows on the dark surface (hairlines between rows). */
export function Group({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ marginHorizontal: GUTTER, backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.line, overflow: "hidden" }, style]}>
      {items.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <View style={{ height: 1, backgroundColor: colors.line, marginStart: space[4] }} /> : null}
          {c}
        </React.Fragment>
      ))}
    </View>
  );
}

export function SectionLabel({ title, style }: { title: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ paddingHorizontal: GUTTER, marginTop: space[6], marginBottom: space[2] }, style]}>
      <Text variant="label" tone="tertiary">
        {title}
      </Text>
    </View>
  );
}
