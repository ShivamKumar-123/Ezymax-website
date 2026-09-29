// The top of the AI Trader conversation: a tall editorial title with the mascot, one line on what it does, the
// three steps on a periwinkle block and the risk note. It scrolls away as the conversation grows.
import * as React from "react";
import { View } from "react-native";
import { useT, type MessageKey } from "@/i18n";
import { ColorBlock, Display, Illustration, Mono, Text } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { RiskNote } from "./parts";

const STEPS: { n: string; title: MessageKey; body: MessageKey }[] = [
  { n: "01", title: "mobileAi.steps.describe.title", body: "mobileAi.steps.describe.body" },
  { n: "02", title: "mobileAi.steps.review.title", body: "mobileAi.steps.review.body" },
  { n: "03", title: "mobileAi.steps.deploy.title", body: "mobileAi.steps.deploy.body" },
];

export const Intro = React.memo(function Intro() {
  const t = useT();
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space[4], paddingBottom: space[5], gap: space[5] }} testID="ai-intro">
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space[3] }}>
        <View style={{ flex: 1, gap: space[2], paddingBottom: space[2] }}>
          <Text variant="label" tone="tertiary">
            {t("mobileAi.eyebrow")}
          </Text>
          <Display size="xl" accessibilityRole="header">
            {t("mobileAi.hero")}
          </Display>
        </View>
        <Illustration name="mascot" width={104} height={172} />
      </View>
      <Text tone="secondary">{t("mobileAi.heroBody")}</Text>
      <ColorBlock color="periwinkle" padded={false} style={{ padding: space[5], gap: space[4] }}>
        {STEPS.map((s) => (
          <View key={s.n} style={{ flexDirection: "row", gap: space[4], alignItems: "flex-start" }}>
            <Mono size={15} weight="bold" color={colors.ink2}>
              {s.n}
            </Mono>
            <View style={{ flex: 1, gap: 2 }}>
              <Display size="xs" color={colors.ink}>
                {t(s.title)}
              </Display>
              <Text variant="callout" color={colors.ink2}>
                {t(s.body)}
              </Text>
            </View>
          </View>
        ))}
      </ColorBlock>
      <RiskNote />
    </View>
  );
});
