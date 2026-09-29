// "Running": the strategy was deployed after the client confirmed it. A mint block names the account in big
// type and links to the strategy in the Algo module, where it is paused, stopped or killed.
import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowUpRight } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { ColorBlock, Display, Text } from "@/ui";
import { colors, space } from "@/theme/tokens";
import { clock } from "@/features/chat/time";
import type { AiMessage } from "../thread";
import { BlockButton, InkTag } from "./parts";

type Deployed = Extract<AiMessage, { kind: "deployed" }>;

export const DeployedCard = React.memo(function DeployedCard({ m }: { m: Deployed }) {
  const t = useT();
  const fmt = useFormat();
  const router = useRouter();
  const kind = m.accountType === "live" ? t("common.live") : t("common.demo");
  return (
    <ColorBlock color="mint" padded={false} style={{ padding: space[5], gap: space[3] }} testID={`ai-deployed-${m.deploymentId}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Text variant="label" color={colors.ink2} style={{ flex: 1 }}>
          {t("mobileAi.deployed.label")}
        </Text>
        <InkTag label={kind} fill={m.accountType === "live" ? colors.ember : colors.periwinkle} />
      </View>
      <Display size="lg" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit>
        {`${kind} #${m.login}`}
      </Display>
      <Text variant="callout" weight="600" color={colors.ink}>
        {t("mobileAi.deployed.body", { version: m.version, name: m.name, symbol: m.symbol, tf: m.timeframe, time: clock(fmt, m.at) })}
      </Text>
      <BlockButton label={t("mobileAi.deployed.open")} tone="ink" icon={<ArrowUpRight size={16} color={colors.cream} />} onPress={() => router.push(`/algo/strategies/${m.strategyId}`)} testID="ai-open-strategy" />
      <Text variant="caption" color={colors.ink2}>
        {t("mobileAi.deployed.manage")}
      </Text>
    </ColorBlock>
  );
});
