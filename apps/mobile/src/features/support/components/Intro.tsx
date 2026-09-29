// The top of the support chat: a tall title with the mascot, what the chat does, and who is there right now
// (Kalks AI instantly; the team online, or replying here and by email). It scrolls away as the chat grows.
import * as React from "react";
import { View } from "react-native";
import { useT } from "@/i18n";
import { Display, Illustration, Text } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";

function Chip({ dot, label }: { dot: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], height: 32, paddingHorizontal: space[3], borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export const SupportIntro = React.memo(function SupportIntro({ agentsOnline, ai }: { agentsOnline: number; ai: boolean }) {
  const t = useT();
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[4], paddingBottom: space[2], gap: space[4] }} testID="support-intro">
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space[3] }}>
        <View style={{ flex: 1, gap: space[2], paddingBottom: space[1] }}>
          <Text variant="label" tone="tertiary">
            {t("support.page.title")}
          </Text>
          <Display size="xl" accessibilityRole="header">
            {t("mobileAi.support.hero")}
          </Display>
        </View>
        <Illustration name="mascot" width={76} height={126} />
      </View>
      <Text tone="secondary">{t("support.page.subtitle")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {ai ? <Chip dot={colors.periwinkle} label={t("mobileAi.support.instant")} /> : null}
        <Chip dot={agentsOnline > 0 ? colors.mint : colors.gold} label={agentsOnline > 0 ? t("mobileAi.support.teamOnline") : t("mobileAi.support.teamAway")} />
      </View>
    </View>
  );
});
