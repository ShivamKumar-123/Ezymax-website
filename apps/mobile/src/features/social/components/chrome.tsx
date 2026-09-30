// Screen chrome for the social stack: the back bar of pushed screens, the header of modal forms, and the
// sticky bottom action bar (above the home indicator, never under the keyboard).
import * as React from "react";
import { Platform, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { BackButton, IconButton, Text } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";

/** Back to the previous screen, or to the social hub when this screen was opened directly (deep link). */
export function useBack(fallback = "/social") {
  const router = useRouter();
  return React.useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback as never);
  }, [router, fallback]);
}

/** Disclosure chevron (points to the reading direction's end). */
export function ForwardIcon({ color = colors.text3, size = 18 }: { color?: string; size?: number }) {
  const { rtl } = useLocale();
  const Icon = rtl ? ChevronLeft : ChevronRight;
  return <Icon size={size} color={color} strokeWidth={2} />;
}

/** 56 pt bar: back button, optional title (shown once the big title scrolled away) and end-side actions. */
export function TopBar({ title, right, onBack, fallback }: { title?: string; right?: React.ReactNode; onBack?: () => void; fallback?: string }) {
  const back = useBack(fallback);
  return (
    <View style={{ height: 56, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: GUTTER - 6 }}>
      {/* the kit's back button: the same bare chevron as the other modules' bars */}
      <BackButton onPress={onBack ?? back} />
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

/** Modal form header: close button, step / eyebrow, and an optional progress bar of `steps` segments. */
export function ModalHeader({ eyebrow, onClose, steps, step }: { eyebrow?: string; onClose: () => void; steps?: number; step?: number }) {
  const t = useT();
  return (
    <View style={{ paddingHorizontal: GUTTER - 4, paddingTop: space[2], gap: space[2] }}>
      <View style={{ height: 48, flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <IconButton accessibilityLabel={t("mobile.a11y.close")} icon={<X size={20} color={colors.text} strokeWidth={2} />} onPress={onClose} />
        <View style={{ flex: 1 }}>
          {eyebrow ? (
            <Text variant="label" tone="tertiary" numberOfLines={1}>
              {eyebrow}
            </Text>
          ) : null}
        </View>
      </View>
      {steps ? (
        <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 4 }} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: steps, now: (step ?? 0) + 1 }}>
          {Array.from({ length: steps }, (_, i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= (step ?? 0) ? colors.ember : colors.surface3 }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// iOS: the footer follows the keyboard frame on the UI thread. Android resizes the window for the keyboard
// (adjustResize, like the rest of the app) and a browser resizes the page, so nothing to add there.
const useKeyboard: () => ReturnType<typeof useAnimatedKeyboard> | null = Platform.OS === "ios" ? useAnimatedKeyboard : () => null;

/**
 * Scaffold of a modal form (follow, invest, redeem, connect, settings): header, scrolling body and a footer that
 * rides on top of the keyboard frame by frame (UI thread), in a card sheet on iOS or a full screen on Android.
 */
export function FormScreen({ header, children, footer, scrollRef }: { header: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; scrollRef?: React.Ref<ScrollView> }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboard();
  const bottom = insets.bottom;
  const pad = useAnimatedStyle(() => ({ paddingBottom: kb ? Math.max(0, kb.height.value - bottom) : 0 }));
  // an iOS page sheet starts below the status bar; Android and web modals are full screen
  const top = Platform.OS === "ios" ? 0 : insets.top;
  return (
    <Animated.View style={[{ flex: 1, backgroundColor: colors.bg, paddingTop: top }, pad]}>
      {header}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: space[3], paddingBottom: space[8] }}
      >
        {children}
      </ScrollView>
      {footer}
    </Animated.View>
  );
}

/** Sticky bottom bar for the primary actions of a screen. */
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
