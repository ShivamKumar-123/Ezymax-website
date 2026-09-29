// Global connection notice: slides down from the top when the phone is offline, gone when it reconnects
// (streams reconnect on their own). Screens show the connection-lost illustration for empty content.
import * as React from "react";
import { View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WifiOff } from "lucide-react-native";
import { useT } from "@/i18n";
import { useOnline } from "@/lib/net";
import { Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";

export function OfflineBanner() {
  const online = useOnline();
  const t = useT();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <Animated.View entering={FadeInUp.duration(200)} exiting={FadeOutUp.duration(200)} pointerEvents="none" style={{ position: "absolute", top: insets.top + space[2], start: space[5], end: space[5], alignItems: "center" }}>
      <View accessibilityRole="alert" style={{ flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: space[4], height: 40, borderRadius: radius.pill, backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.lineStrong }}>
        <WifiOff size={16} color={colors.gold} />
        <Text variant="callout" weight="600">
          {t("mobile.state.offline.title")}
        </Text>
        <Text variant="caption" tone="tertiary">
          {t("mobile.state.reconnecting")}
        </Text>
      </View>
    </Animated.View>
  );
}
