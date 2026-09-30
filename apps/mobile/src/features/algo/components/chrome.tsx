// Screen chrome of the Algo stack: the back bar of pushed screens, the editorial title (eyebrow + tall display
// title), the header of modal forms, the scaffold whose footer rides the keyboard, and the sticky action bar.
import * as React from "react";
import { Platform, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { BackButton, Display, IconButton, PressableScale, Text } from "@/ui";
import { colors, GUTTER, radius, space, type DisplaySize } from "@/theme/tokens";

/** Disclosure chevron: points to the reading direction's end. */
export function ForwardIcon({ color = colors.text3, size = 18 }: { color?: string; size?: number }) {
  const { rtl } = useLocale();
  const Icon = rtl ? ChevronLeft : ChevronRight;
  return <Icon size={size} color={color} strokeWidth={2} />;
}

/** A round 44 pt icon button for the top bar (the kit's IconButton look, with a test id). */
export function BarButton({ icon, onPress, accessibilityLabel, testID }: { icon: React.ReactNode; onPress: () => void; accessibilityLabel: string; testID?: string }) {
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      haptics="select"
      accessibilityLabel={accessibilityLabel}
      style={{ width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}
    >
      {icon}
    </PressableScale>
  );
}

/** 56 pt bar: back button and end-side actions. */
export function TopBar({ onBack, right, title }: { onBack: () => void; right?: React.ReactNode; title?: string }) {
  return (
    <View style={{ height: 56, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: GUTTER - 6 }}>
      {/* the kit's back button: the same bare chevron as the other modules' bars */}
      <BackButton onPress={onBack} />
      <View style={{ flex: 1 }}>
        {title ? (
          <Text variant="headline" weight="700" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>
      {right ? <View style={{ flexDirection: "row", gap: space[2] }}>{right}</View> : null}
    </View>
  );
}

/** Small ember eyebrow over a tall uppercase title, then optional content (tags, meta). */
export function Title({ eyebrow, title, size = "xl", children, style }: { eyebrow?: string; title: string; size?: DisplaySize; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ paddingHorizontal: GUTTER, gap: space[1] }, style]}>
      {eyebrow ? (
        <Text variant="label" tone="ember" numberOfLines={1}>
          {eyebrow}
        </Text>
      ) : null}
      <Display size={size} accessibilityRole="header" numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.6}>
        {title}
      </Display>
      {children}
    </View>
  );
}

/** Modal form header: close button, then the eyebrow. */
export function ModalHeader({ eyebrow, onClose }: { eyebrow?: string; onClose: () => void }) {
  const t = useT();
  return (
    <View style={{ height: 56, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: GUTTER - 4, marginTop: space[2] }}>
      <IconButton accessibilityLabel={t("mobile.a11y.close")} icon={<X size={20} color={colors.text} strokeWidth={2} />} onPress={onClose} />
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Text variant="label" tone="tertiary" numberOfLines={1}>
            {eyebrow}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// iOS: the footer follows the keyboard frame on the UI thread. Android resizes the window for the keyboard and a
// browser resizes the page, so there is nothing to add there.
const useKeyboard: () => ReturnType<typeof useAnimatedKeyboard> | null = Platform.OS === "ios" ? useAnimatedKeyboard : () => null;

/** Scaffold of a modal form (deploy, subscribe): header, scrolling body, footer riding on top of the keyboard. */
export function FormScreen({ header, children, footer, testID }: { header: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; testID?: string }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboard();
  const bottom = insets.bottom;
  const pad = useAnimatedStyle(() => ({ paddingBottom: kb ? Math.max(0, kb.height.value - bottom) : 0 }));
  // an iOS page sheet starts below the status bar; Android and web modals are full screen
  const top = Platform.OS === "ios" ? 0 : insets.top;
  return (
    <Animated.View testID={testID} style={[{ flex: 1, backgroundColor: colors.bg, paddingTop: top }, pad]}>
      {header}
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: space[2], paddingBottom: space[8], gap: space[5] }}
      >
        {children}
      </ScrollView>
      {footer}
    </Animated.View>
  );
}

/** Sticky bottom bar for the primary actions of a screen (above the home indicator). */
export function ActionBar({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        {
          paddingHorizontal: GUTTER,
          paddingTop: space[3],
          paddingBottom: Math.max(insets.bottom, space[3]) + space[1],
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          flexDirection: "row",
          gap: space[3],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
