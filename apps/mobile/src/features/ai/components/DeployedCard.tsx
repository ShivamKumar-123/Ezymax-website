// A strategy deployed from the conversation after the client confirmed it: the account in big type, the version,
// and a link to the strategy in the Algo module, where it is paused, stopped or killed. The status is the service's
// (the Algo module's shared deployments list), so a strategy stopped since shows "Stopped", not "Running": a gold
// block while it runs, a quiet card once it doesn't.
import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowUpRight } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { useQuery } from "@/lib/query";
import { Card, ColorBlock, Display, Text } from "@/ui";
import { colors, space } from "@/theme/tokens";
import { clock, dayLabel } from "@/features/chat/time";
import { fetchers as algoFetchers, keys as algoKeys, prefetchStrategy } from "@/features/algo/api";
import type { AiMessage } from "../thread";
import { BlockButton, InkTag } from "./parts";

type Deployed = Extract<AiMessage, { kind: "deployed" }>;

export const DeployedCard = React.memo(function DeployedCard({ m }: { m: Deployed }) {
  const t = useT();
  const fmt = useFormat();
  const router = useRouter();
  const list = useQuery(algoKeys.deployments, algoFetchers.deployments, { persist: true, staleMs: 5_000 });
  // until the list answers (or when it doesn't list it), the service's own answer to the Deploy: running
  const status = list.data?.items.find((d) => d.id === m.deploymentId)?.status ?? "running";
  const active = status === "running" || status === "paused";
  const kind = m.accountType === "live" ? t("common.live") : t("common.demo");
  const when = `${dayLabel(t, fmt, m.at)} ${clock(fmt, m.at)}`;
  const ink = active ? colors.ink : colors.text;
  const ink2 = active ? colors.ink2 : colors.text2;

  const body = (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Text variant="label" color={ink2} style={{ flex: 1 }} testID="ai-deployment-status">
          {t.dyn(`mobileAlgo.dep.status.${status}`, status)}
        </Text>
        {active ? <InkTag label={kind} fill={m.accountType === "live" ? colors.ember : undefined} /> : null}
      </View>
      <Display size="lg" color={ink} numberOfLines={1} adjustsFontSizeToFit>
        {`${kind} #${m.login}`}
      </Display>
      <Text variant="callout" weight="600" color={ink}>
        {t("mobileAi.deployed.body", { version: m.version, name: m.name, symbol: m.symbol, tf: m.timeframe, time: when })}
      </Text>
      <BlockButton
        label={t("mobileAi.deployed.open")}
        tone={active ? "ink" : "surface"}
        icon={<ArrowUpRight size={16} color={active ? colors.cream : colors.text} />}
        onPressIn={() => prefetchStrategy(m.strategyId)}
        onPress={() => router.push(`/algo/strategies/${m.strategyId}`)}
        testID="ai-open-strategy"
      />
      {active ? (
        <Text variant="caption" color={ink2}>
          {t("mobileAi.deployed.manage")}
        </Text>
      ) : null}
    </>
  );

  return active ? (
    <ColorBlock color="gold" padded={false} style={{ padding: space[5], gap: space[3] }} testID={`ai-deployed-${m.deploymentId}`}>
      {body}
    </ColorBlock>
  ) : (
    <Card padded={false} style={{ padding: space[5], gap: space[3] }} testID={`ai-deployed-${m.deploymentId}`}>
      {body}
    </Card>
  );
});
