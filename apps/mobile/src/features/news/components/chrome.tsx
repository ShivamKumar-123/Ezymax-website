// Page chrome of the news and calendar screens: the stack bar (back + actions), a filter button with its count,
// section headings. Built only on @/ui and tokens; direction icons flip in right-to-left languages.
import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { Display, IconButton, PressableScale, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";

/** Back to the previous screen, or to `fallback` when this screen was opened directly (deep link, notification). */
export function useBack(fallback: string) {
  const router = useRouter();
  return React.useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback as never);
  }, [router, fallback]);
}

export function BackIcon({ color = colors.text, size = 24 }: { color?: string; size?: number }) {
  const { rtl } = useLocale();
  const Icon = rtl ? ChevronRight : ChevronLeft;
  return <Icon size={size} color={color} strokeWidth={2} />;
}

/** Disclosure chevron pointing to the reading direction's end. */
export function ForwardIcon({ color = colors.text3, size = 18 }: { color?: string; size?: number }) {
  const { rtl } = useLocale();
  const Icon = rtl ? ChevronLeft : ChevronRight;
  return <Icon size={size} color={color} strokeWidth={2} />;
}

/** 56 pt bar: back, an optional display title, end-side actions. */
export const TopBar = React.memo(function TopBar({ title, right, fallback }: { title?: string; right?: React.ReactNode; fallback: string }) {
  const t = useT();
  const back = useBack(fallback);
  return (
    <View style={{ height: 56, flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: GUTTER - 6, backgroundColor: colors.bg }}>
      <IconButton accessibilityLabel={t("mobile.a11y.back")} tone="ghost" icon={<BackIcon />} onPress={back} />
      <View style={{ flex: 1, minWidth: 0 }}>
        {title ? (
          <Display size="sm" numberOfLines={1} accessibilityRole="header">
            {title}
          </Display>
        ) : null}
      </View>
      {right ? <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>{right}</View> : null}
    </View>
  );
});

/** Pill button that opens a filter sheet; filled cream while filters are on. */
export function FilterButton({ count, onPress, label, testID }: { count: number; onPress: () => void; label: string; testID?: string }) {
  const on = count > 0;
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      haptics="select"
      accessibilityLabel={label}
      style={{ height: 44, paddingHorizontal: space[4], borderRadius: radius.pill, flexDirection: "row", alignItems: "center", gap: space[2], backgroundColor: on ? colors.cream : colors.surface, borderWidth: 1, borderColor: on ? colors.cream : colors.line }}
    >
      <SlidersHorizontal size={16} color={on ? colors.ink : colors.text2} />
      {on ? (
        <Text variant="callout" weight="700" color={colors.ink}>
          {String(count)}
        </Text>
      ) : null}
    </PressableScale>
  );
}

/** Section heading (Anton, uppercase) with an optional trailing element. */
export function SectionTitle({ title, right, style }: { title: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ paddingHorizontal: GUTTER, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space[3], marginBottom: space[3] }, style]}>
      <Display size="sm" accessibilityRole="header" style={{ flexShrink: 1 }}>
        {title}
      </Display>
      {right}
    </View>
  );
}
