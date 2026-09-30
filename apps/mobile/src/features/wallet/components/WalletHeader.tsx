// Stack-screen header of the wallet screens: back button (mirrored in RTL), optional actions, then the
// editorial eyebrow + tall display title.
import * as React from "react";
import { View } from "react-native";
import { BackButton as KitBackButton, Display, Text } from "@/ui";
import { GUTTER, space, type DisplaySize } from "@/theme/tokens";

/** Display size that keeps a one-line title inside the screen width (RN web ignores adjustsFontSizeToFit). */
export function titleSize(title: string, base: DisplaySize = "xl"): DisplaySize {
  const n = title.length;
  if (base === "xl") return n > 18 ? "md" : n > 13 ? "lg" : "xl";
  return base;
}

/** The kit's back button (the same bare chevron as every other module's screens). */
export function BackButton({ onPress }: { onPress?: () => void }) {
  return <KitBackButton onPress={onPress} fallback="/" />;
}

export function WalletHeader({ eyebrow, title, right, onBack, subtitle }: { eyebrow?: string; title: string; right?: React.ReactNode; onBack?: () => void; subtitle?: string }) {
  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      <View style={{ height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {/* the bare chevron lines up with the title below, like the other modules' bars */}
        <View style={{ marginStart: -6 }}>
          <BackButton onPress={onBack} />
        </View>
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
