// Stack-screen header of the wallet screens: back button (mirrored in RTL), optional actions, then the
// editorial eyebrow + tall display title.
import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { Display, IconButton, Text } from "@/ui";
import { colors, GUTTER, space, type DisplaySize } from "@/theme/tokens";

/** Display size that keeps a one-line title inside the screen width (RN web ignores adjustsFontSizeToFit). */
export function titleSize(title: string, base: DisplaySize = "xl"): DisplaySize {
  const n = title.length;
  if (base === "xl") return n > 18 ? "md" : n > 13 ? "lg" : "xl";
  return base;
}

export function BackButton({ onPress }: { onPress?: () => void }) {
  const router = useRouter();
  const t = useT();
  const { rtl } = useLocale();
  return (
    <IconButton
      accessibilityLabel={t("mobile.a11y.back")}
      icon={rtl ? <ChevronRight size={22} color={colors.text} /> : <ChevronLeft size={22} color={colors.text} />}
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace("/")))}
    />
  );
}

export function WalletHeader({ eyebrow, title, right, onBack, subtitle }: { eyebrow?: string; title: string; right?: React.ReactNode; onBack?: () => void; subtitle?: string }) {
  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      <View style={{ height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <BackButton onPress={onBack} />
        {right ? <View style={{ flexDirection: "row", gap: space[2] }}>{right}</View> : null}
      </View>
      <View style={{ marginTop: space[3], marginBottom: space[5], gap: space[1] }}>
        {eyebrow ? (
          <Text variant="label" tone="ember">
            {eyebrow}
          </Text>
        ) : null}
        <Display size={titleSize(title)} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Display>
        {subtitle ? (
          <Text tone="secondary" style={{ marginTop: space[1] }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
