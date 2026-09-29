// Title row of a bottom sheet: tall display title and a close button (44 pt).
import * as React from "react";
import { View } from "react-native";
import { X } from "lucide-react-native";
import { useT } from "@/i18n";
import { Display, IconButton, Text } from "@/ui";
import { colors, space } from "@/theme/tokens";

export function SheetHeader({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  const t = useT();
  return (
    <View style={{ gap: space[1], marginBottom: space[2] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <Display size="md" style={{ flex: 1 }} numberOfLines={1} adjustsFontSizeToFit accessibilityRole="header">
          {title}
        </Display>
        <IconButton accessibilityLabel={t("mobile.a11y.close")} tone="surface" icon={<X size={20} color={colors.text2} />} onPress={onClose} />
      </View>
      {subtitle ? (
        <Text variant="callout" tone="secondary">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
