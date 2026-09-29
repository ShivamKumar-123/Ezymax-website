// Scaffold for screens pushed on the stack (Profile, Verification, Security…): a fixed top bar with the back button,
// the tall editorial title that scrolls away under it (the bar then shows a compact title, faded on the UI thread),
// pull-to-refresh, keyboard avoidance and an optional sticky footer for the primary action.
import * as React from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, View, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import Animated, { Extrapolation, interpolate, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { Display, IconButton, Text } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";

const BAR = 52;

export function BackButton({ onPress }: { onPress?: () => void }) {
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
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace("/more")))}
    />
  );
}

/** Scroll position shared by the bar and the content (UI thread). */
export function useBarScroll() {
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  /** for lists that can't take a worklet handler (FlashList): a plain JS onScroll */
  const onScrollJs = React.useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    y.value = e.nativeEvent.contentOffset.y;
  }, [y]);
  return { y, onScroll, onScrollJs };
}

export function TopBar({ title, right, y, onBack, back = true }: { title?: string; right?: React.ReactNode; y: SharedValue<number>; onBack?: () => void; back?: boolean }) {
  const insets = useSafeAreaInsets();
  const titleStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [36, 70], [0, 1], Extrapolation.CLAMP) }));
  const lineStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [50, 90], [0, 1], Extrapolation.CLAMP) }));
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.bg, zIndex: 2 }}>
      <View style={{ height: BAR, flexDirection: "row", alignItems: "center", paddingHorizontal: space[2] }}>
        <View style={{ width: 88, flexDirection: "row" }}>{back ? <BackButton onPress={onBack} /> : null}</View>
        <Animated.View style={[{ flex: 1, alignItems: "center" }, titleStyle]} pointerEvents="none">
          {title ? (
            <Display size="xs" numberOfLines={1}>
              {title}
            </Display>
          ) : null}
        </Animated.View>
        <View style={{ width: 88, flexDirection: "row", justifyContent: "flex-end", gap: space[1] }}>{right}</View>
      </View>
      <Animated.View style={[{ height: 1, backgroundColor: colors.line }, lineStyle]} />
    </View>
  );
}

export function LargeTitle({ eyebrow, title, subtitle, right, style }: { eyebrow?: string; title: string; subtitle?: React.ReactNode; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ paddingHorizontal: GUTTER, paddingTop: space[1], paddingBottom: space[5], gap: space[1] }, style]}>
      {eyebrow ? (
        <Text variant="label" tone="tertiary">
          {eyebrow}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space[3] }}>
        <Display size="xl" accessibilityRole="header" style={{ flex: 1 }}>
          {title}
        </Display>
        {right}
      </View>
      {subtitle ? typeof subtitle === "string" ? <Text tone="secondary" style={{ marginTop: space[1] }}>{subtitle}</Text> : subtitle : null}
    </View>
  );
}

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  /** actions in the top bar (end side) */
  right?: React.ReactNode;
  /** next to the large title */
  titleRight?: React.ReactNode;
  onRefresh?: () => Promise<unknown> | void;
  keyboard?: boolean;
  /** sticky bottom area (primary action) */
  footer?: React.ReactNode;
  onBack?: () => void;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
  /** e.g. to scroll back to the top when a wizard moves to its next step */
  scrollRef?: React.RefObject<ScrollHandle | null>;
};

export type ScrollHandle = { scrollTo: (o: { x?: number; y?: number; animated?: boolean }) => void };

export function StackScreen({ eyebrow, title, subtitle, right, titleRight, onRefresh, keyboard, footer, onBack, children, contentStyle, testID, scrollRef }: Props) {
  const insets = useSafeAreaInsets();
  const { y, onScroll } = useBarScroll();
  const aref = useAnimatedRef<Animated.ScrollView>();
  React.useEffect(() => {
    if (scrollRef) (scrollRef as React.MutableRefObject<ScrollHandle | null>).current = { scrollTo: (o) => aref.current?.scrollTo(o) };
  }, [scrollRef, aref]);
  const [refreshing, setRefreshing] = React.useState(false);
  const refresh = React.useCallback(async () => {
    if (!onRefresh) return;
    haptic.select();
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);
  const bottom = Math.max(insets.bottom, space[4]) + space[4];

  const body = (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID={testID}>
      <TopBar title={title} right={right} y={y} onBack={onBack} />
      <Animated.ScrollView
        ref={aref}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[{ paddingBottom: footer ? space[6] : bottom }, contentStyle]}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} /> : undefined}
      >
        <LargeTitle eyebrow={eyebrow} title={title} subtitle={subtitle} right={titleRight} />
        {children}
      </Animated.ScrollView>
      {footer ? <View style={{ paddingHorizontal: GUTTER, paddingTop: space[3], paddingBottom: bottom - space[2], borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg, gap: space[2] }}>{footer}</View> : null}
    </View>
  );
  if (!keyboard) return body;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {body}
    </KeyboardAvoidingView>
  );
}

/**
 * A pushed screen whose body is one long list (sign-in history, sessions): FlashList with the tall title as its
 * header, rows drawn as one rounded group (first / last rows get the corners), pull-to-refresh.
 */
export function ListScreen<T>({
  eyebrow,
  title,
  subtitle,
  data,
  renderRow,
  keyExtractor,
  onRefresh,
  empty,
  header,
  footer,
  testID,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  data: T[];
  renderRow: (item: T, index: number) => React.ReactElement;
  keyExtractor: (item: T) => string;
  onRefresh?: () => Promise<unknown> | void;
  empty?: React.ReactElement | null;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const { y, onScrollJs } = useBarScroll();
  const [refreshing, setRefreshing] = React.useState(false);
  const refresh = React.useCallback(async () => {
    if (!onRefresh) return;
    haptic.select();
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);
  const last = data.length - 1;
  const renderItem: ListRenderItem<T> = React.useCallback(
    ({ item, index }) => (
      <View
        style={{
          marginHorizontal: GUTTER,
          backgroundColor: colors.surface,
          borderColor: colors.line,
          borderStartWidth: 1,
          borderEndWidth: 1,
          borderTopWidth: index === 0 ? 1 : 0,
          borderBottomWidth: index === last ? 1 : 0,
          borderTopLeftRadius: index === 0 ? 22 : 0,
          borderTopRightRadius: index === 0 ? 22 : 0,
          borderBottomLeftRadius: index === last ? 22 : 0,
          borderBottomRightRadius: index === last ? 22 : 0,
          overflow: "hidden",
        }}
      >
        {index > 0 ? <View style={{ height: 1, backgroundColor: colors.line, marginStart: space[4] }} /> : null}
        {renderRow(item, index)}
      </View>
    ),
    [renderRow, last],
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} testID={testID}>
      <TopBar title={title} y={y} />
      <FlashList
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onScroll={onScrollJs}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <LargeTitle eyebrow={eyebrow} title={title} subtitle={subtitle} />
            {header}
          </View>
        }
        ListEmptyComponent={empty ?? null}
        ListFooterComponent={<View style={{ paddingBottom: Math.max(insets.bottom, space[4]) + space[6] }}>{footer}</View>}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} /> : undefined}
      />
    </View>
  );
}
