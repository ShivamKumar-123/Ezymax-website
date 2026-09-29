// One leaderboard row (fixed height, memoised): rank, initials block, nickname and the period return, the house
// label (in full, like the web) or strategy, then drawdown / AUM / followers / age and the risk meter.
import * as React from "react";
import { View } from "react-native";
import { CalendarClock, Users } from "lucide-react-native";
import { useFormat, useT } from "@/i18n";
import { Mono, PressableScale, Text } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import type { LbPeriod, MasterView } from "../api";
import { compactUsd, ddText, formatAge, pct, periodReturn } from "../format";
import { Avatar, HouseBadge, RiskMeter } from "./identity";
import { Tag } from "./primitives";

export const LEADER_ROW_HEIGHT = 108;

const PERIOD_KEY = { "1m": "mobileSocial.lb.period.1m", "3m": "mobileSocial.lb.period.3m", "1y": "mobileSocial.lb.period.1y", all: "mobileSocial.lb.period.all" } as const;

export const LeaderRow = React.memo(function LeaderRow({
  m,
  rank,
  period,
  highlight,
  onOpen,
  onPressIn,
}: {
  m: MasterView;
  rank: number;
  period: LbPeriod;
  highlight: boolean;
  onOpen: (id: number) => void;
  onPressIn: (id: number) => void;
}) {
  const t = useT();
  const fmt = useFormat();
  const r = periodReturn(m, period);
  const top = highlight && rank <= 3;
  const age = formatAge(m.ageDays, t);
  return (
    <PressableScale
      testID={`lb-row-${m.id}`}
      onPress={() => onOpen(m.id)}
      onPressIn={() => onPressIn(m.id)}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={[
        `${rank}. ${m.nickname}`,
        m.house ? t("mobileSocial.house.badge") : m.strategy,
        `${t("mobileSocial.lb.returnLabel", { period: t(PERIOD_KEY[period]) })} ${pct(r, 1)}`,
        t("mobileSocial.lb.dd", { value: ddText(m.stats.maxDd) }),
        `${t("mobileSocial.aum")} ${compactUsd(m.stats.aum)}`,
        t("mobileSocial.lb.followersCount", { count: m.stats.followers, n: fmt.number(m.stats.followers, 0) }),
        age,
      ].join(", ")}
      style={{ height: LEADER_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: GUTTER, borderBottomWidth: 1, borderBottomColor: colors.line }}
    >
      <View style={{ width: 18, alignItems: "center" }}>
        <Mono size={13} weight="bold" color={top ? colors.gold : colors.text3}>
          {String(rank)}
        </Mono>
      </View>
      <Avatar name={m.nickname} size={44} house={m.house} />
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Text variant="headline" weight="700" numberOfLines={1} style={{ flex: 1 }}>
            {m.nickname}
          </Text>
          <Mono size={17} weight="bold" tone={r > 0 ? "up" : r < 0 ? "down" : "secondary"}>
            {pct(r, 1)}
          </Mono>
        </View>
        {m.house ? (
          <HouseBadge compact />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[1], minWidth: 0, height: 24 }}>
            {m.program === "pamm" ? <Tag tone="gold" label={t("mobileSocial.lb.pammOnly")} /> : m.program === "both" && m.fund ? <Tag tone="gold" label={t("mobileSocial.program.pamm")} /> : null}
            <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
              {m.strategy}
            </Text>
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, overflow: "hidden" }}>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {t("mobileSocial.lb.dd", { value: ddText(m.stats.maxDd) })}
            </Text>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {`${t("mobileSocial.aum")} ${compactUsd(m.stats.aum)}`}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Users size={12} color={colors.text3} />
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {fmt.number(m.stats.followers, 0)}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 1 }}>
              <CalendarClock size={12} color={colors.text3} />
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {age}
              </Text>
            </View>
          </View>
          <RiskMeter risk={m.stats.riskScore} />
        </View>
      </View>
    </PressableScale>
  );
});
