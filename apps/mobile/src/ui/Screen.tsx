// Screen scaffold: safe areas, editorial header (small eyebrow + tall display title), pull-to-refresh, bottom
// padding for the floating tab bar, keyboard avoidance for forms.
import * as React from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View, type ScrollViewProps, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptic } from "@/lib/haptics";
import { colors, GUTTER, space, TAB_BAR } from "@/theme/tokens";
import { Display, Text } from "./Text";

export function useBottomInset(tabBar = true) {
  const insets = useSafeAreaInsets();
  return (tabBar ? TAB_BAR.height + TAB_BAR.margin * 2 : 0) + Math.max(insets.bottom, space[3]);
}

export function ScreenHeader({ eyebrow, title, right, style }: { eyebrow?: string; title?: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ paddingHorizontal: GUTTER, paddingTop: space[2], paddingBottom: space[4], flexDirection: "row", alignItems: "flex-end", gap: space[3] }, style]}>
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Text variant="label" tone="tertiary" style={{ marginBottom: space[1] }}>
            {eyebrow}
          </Text>
        ) : null}
        {title ? (
          <Display size="xl" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
            {title}
          </Display>
        ) : null}
      </View>
      {right ? <View style={{ flexDirection: "row", gap: space[2] }}>{right}</View> : null}
    </View>
  );
}

type ScreenProps = {
  eyebrow?: string;
  title?: string;
  right?: React.ReactNode;
  /** scrollable body (default); false for lists that scroll themselves */
  scroll?: boolean;
  onRefresh?: () => Promise<unknown> | void;
  /** sits above the tab bar (tabs) or not (stack screens) */
  tabBar?: boolean;
  keyboard?: boolean;
  padded?: boolean;
  header?: React.ReactNode;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scrollProps?: ScrollViewProps;
  edges?: { top?: boolean };
};

export function Screen({ eyebrow, title, right, scroll = true, onRefresh, tabBar = true, keyboard, padded = false, header, children, contentStyle, scrollProps, edges }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottom = useBottomInset(tabBar);
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

  const head = header ?? (title || eyebrow || right ? <ScreenHeader eyebrow={eyebrow} title={title} right={right} /> : null);
  const body = scroll ? (
    <ScrollView
      {...scrollProps}
      contentContainerStyle={[{ paddingBottom: bottom, paddingHorizontal: padded ? GUTTER : 0 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text3} colors={[colors.ember]} progressBackgroundColor={colors.surface} /> : undefined}
    >
      {head}
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, paddingHorizontal: padded ? GUTTER : 0 }, contentStyle]}>
      {head}
      {children}
    </View>
  );
  const top = edges?.top === false ? 0 : insets.top;
  const content = <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: top }}>{body}</View>;
  if (!keyboard) return content;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {content}
    </KeyboardAvoidingView>
  );
}
