// The assistant at work: a static bubble ("Drafting the rules…") with the seconds counting, and a note once it
// takes a while. No looping animation: only the counter changes, once a second, in this leaf.
import * as React from "react";
import { View } from "react-native";
import { useT } from "@/i18n";
import { Mono, Text } from "@/ui";
import { space } from "@/theme/tokens";
import { Bubble } from "@/features/chat/Bubble";

export const Drafting = React.memo(function Drafting({ startedAt }: { startedAt: number }) {
  const t = useT();
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
  return (
    <Bubble tone="bot">
      <View style={{ gap: space[1] }} accessibilityLiveRegion="polite" testID="ai-drafting">
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2] }}>
          <Text weight="600">{t("mobileAi.drafting")}</Text>
          <Mono size={13} tone="tertiary">
            {t("mobileAi.elapsed", { s: secs })}
          </Mono>
        </View>
        {secs >= 15 ? (
          <Text variant="caption" tone="tertiary">
            {t("mobileAi.draftingSlow")}
          </Text>
        ) : null}
      </View>
    </Bubble>
  );
});
