// One network client (fixed height, memoised): initials, name, tier and where they came from, what they earned the
// partner and their state (active = traded this month, funded = first deposit made, registered).
import * as React from "react";
import { View } from "react-native";
import { useT } from "@/i18n";
import { Mono, PressableScale, Text } from "@/ui";
import { colors, space } from "@/theme/tokens";
import { clientStatusLabel, date, lots, usd } from "../format";
import type { NetworkClient } from "../types";
import { Initials, Tag, type TagTone } from "./Chrome";

export const CLIENT_ROW_HEIGHT = 76;

export const clientTone = (s: string): TagTone => (s === "active" ? "mint" : s === "funded" ? "gold" : "outline");

export const ClientRow = React.memo(function ClientRow({ c, via, onOpen, onWarm }: { c: NetworkClient; via: string | null; onOpen?: (id: number) => void; onWarm?: (id: number) => void }) {
  const t = useT();
  const source = c.tier > 1 ? (via ? t("mobilePartner.clients.via", { name: via }) : t("mobilePartner.clients.tierN", { n: c.tier })) : (c.campaign ?? t("mobilePartner.clients.defaultLink"));
  const sub = [`L${c.tier}`, c.lotsMonth > 0 ? t("mobilePartner.clients.lotsMonth", { lots: lots(c.lotsMonth) }) : source, date(c.joinedAt, false)].join(" · ");
  const body = (
    <View style={{ height: CLIENT_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[5] }}>
      <Initials name={c.name} size={40} color={c.tier === 1 ? colors.surface3 : colors.surface2} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text variant="callout" weight="700" numberOfLines={1}>
          {c.name}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 5 }}>
        <Mono size={14} weight="bold" color={c.earned > 0 ? colors.up : colors.text3} numberOfLines={1}>
          {c.earned > 0 ? usd(c.earned, true) : "—"}
        </Mono>
        <Tag label={clientStatusLabel(t, c.status)} tone={clientTone(c.status)} />
      </View>
    </View>
  );
  if (!onOpen) return <View accessible accessibilityLabel={`${c.name}, ${sub}, ${clientStatusLabel(t, c.status)}`}>{body}</View>;
  return (
    <PressableScale onPress={() => onOpen(c.id)} onPressIn={() => onWarm?.(c.id)} scaleTo={0.985} accessibilityLabel={`${c.name}, ${sub}, ${clientStatusLabel(t, c.status)}`}>
      {body}
    </PressableScale>
  );
});
