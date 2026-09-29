// The bar on top of a chat: back (mirrored in RTL), who you're talking to (avatar, name, a status line with a
// coloured dot) and actions. 60 pt tall under the status bar; a hairline separates it from the messages.
import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { IconButton, PressableScale, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";

export type HeaderDot = "ember" | "gold" | "mint" | "periwinkle" | "muted";
const DOT: Record<HeaderDot, string> = { ember: colors.ember, gold: colors.gold, mint: colors.mint, periwinkle: colors.periwinkle, muted: colors.text3 };

export function BackButton({ onPress }: { onPress?: () => void }) {
  const router = useRouter();
  const t = useT();
  const { rtl } = useLocale();
  return (
    <IconButton
      accessibilityLabel={t("mobile.a11y.back")}
      tone="ghost"
      icon={
        <View style={rtl ? { transform: [{ scaleX: -1 }] } : undefined}>
          <ChevronLeft size={26} color={colors.text} strokeWidth={2} />
        </View>
      }
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace("/")))}
    />
  );
}

/** A short text action in the bar (36 pt tall, 44 pt hit area). */
export function HeaderPill({ label, onPress, onPressIn, testID }: { label: string; onPress: () => void; onPressIn?: () => void; testID?: string }) {
  return (
    <PressableScale
      onPress={onPress}
      onPressIn={onPressIn}
      accessibilityLabel={label}
      testID={testID}
      hitSlop={8}
      style={{ height: 36, paddingHorizontal: space[3], borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineStrong, justifyContent: "center" }}
    >
      <Text variant="callout" weight="700">
        {label}
      </Text>
    </PressableScale>
  );
}

export const ChatHeader = React.memo(function ChatHeader({ avatar, title, subtitle, dot, right, testID }: { avatar?: React.ReactNode; title: string; subtitle?: string; dot?: HeaderDot; right?: React.ReactNode; testID?: string }) {
  return (
    <View testID={testID} style={{ height: 60, paddingHorizontal: GUTTER - 8, flexDirection: "row", alignItems: "center", gap: space[2], borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <BackButton />
      {avatar}
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text variant="headline" weight="700" numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {dot ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: DOT[dot] }} /> : null}
            <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
              {subtitle}
            </Text>
          </View>
        ) : null}
      </View>
      {right ? <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>{right}</View> : null}
    </View>
  );
});
