// The client's challenges on the Prop home: open ones as colour blocks with their progress (the prop evaluator's
// last numbers), finished ones as compact fixed-height rows. The dashboard (/prop/[id]) is warmed on press-in.
import * as React from "react";
import { View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { ColorBlock, Display, Mono, PressableScale, Text } from "@/ui";
import { colors, GUTTER, space } from "@/theme/tokens";
import { fmtDate, sizeLabel, usd, clamp01 } from "../format";
import { challengeColor, stageLabel, viewOf } from "../rules";
import type { Challenge } from "../types";
import { Tag } from "./bits";

function Meter({ share }: { share: number }) {
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(14,14,16,0.14)", overflow: "hidden" }}>
      <View style={{ width: `${Math.round(clamp01(share) * 1000) / 10}%`, height: 8, borderRadius: 4, backgroundColor: colors.ink }} />
    </View>
  );
}

export const OpenChallengeCard = React.memo(function OpenChallengeCard({ c, onOpen, onWarm }: { c: Challenge; onOpen: (id: number) => void; onWarm: (id: number) => void }) {
  const t = useT();
  const color = challengeColor(c) ?? "periwinkle";
  const a = c.current;
  const v = a ? viewOf(c, a) : null;
  const funded = !!a?.funded;
  const target = v?.targetAmount ?? 0;
  const profit = v ? v.balance - v.initial : 0;
  const dailyLeft = v ? Math.max(0, v.dailyLimit - v.dailyUsed) : 0;

  return (
    <PressableScale onPress={() => onOpen(c.id)} onPressIn={() => onWarm(c.id)} scaleTo={0.98} accessibilityLabel={`${sizeLabel(c.size)} ${c.planName}, ${stageLabel(t, c)}`} style={{ marginHorizontal: GUTTER }}>
      <ColorBlock color={color} style={{ gap: space[4] }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
          <Tag label={stageLabel(t, c)} tone="ink" />
          {a?.login ? (
            <Mono size={13} weight="medium" color={colors.ink2}>
              #{a.login}
            </Mono>
          ) : null}
        </View>
        <View>
          <Display size="xl" color={colors.ink}>
            {sizeLabel(c.size)}
          </Display>
          <Text variant="callout" color={colors.ink2} numberOfLines={1}>
            {c.planName}
          </Text>
        </View>
        {v && a ? (
          <View style={{ gap: space[2] }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <Text variant="label" color={colors.ink2}>
                {funded || !target ? t("mobileProp.card.profit") : t("mobileProp.card.target")}
              </Text>
              <Mono size={14} weight="bold" color={colors.ink}>
                {funded || !target ? usd(profit) : `${usd(profit, 0)} / ${usd(target, 0)}`}
              </Mono>
            </View>
            {!funded && target ? <Meter share={profit / target} /> : null}
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text variant="caption" color={colors.ink2}>
                {t("mobileProp.card.equity", { amount: usd(v.equity) })}
              </Text>
              <Text variant="caption" color={colors.ink2}>
                {t("mobileProp.card.dailyLeft", { amount: usd(dailyLeft, 0) })}
              </Text>
            </View>
          </View>
        ) : (
          <Text variant="callout" color={colors.ink2}>
            {t("mobileProp.card.opening")}
          </Text>
        )}
      </ColorBlock>
    </PressableScale>
  );
});

export const PAST_ROW_HEIGHT = 68;

export const PastChallengeRow = React.memo(function PastChallengeRow({ c, onOpen, onWarm }: { c: Challenge; onOpen: (id: number) => void; onWarm: (id: number) => void }) {
  const t = useT();
  const { rtl } = useLocale();
  const ended = c.current?.endedAt ?? c.createdAt;
  return (
    <PressableScale
      onPress={() => onOpen(c.id)}
      onPressIn={() => onWarm(c.id)}
      scaleTo={0.985}
      accessibilityLabel={`${sizeLabel(c.size)} ${c.planName}, ${stageLabel(t, c)}`}
      style={{ height: PAST_ROW_HEIGHT, marginHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
        <Mono size={11} weight="bold" tone="secondary">
          {sizeLabel(c.size)}
        </Mono>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" weight="600" numberOfLines={1}>
          {c.planName}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {stageLabel(t, c)} · {fmtDate(ended)}
        </Text>
      </View>
      {rtl ? <ChevronLeft size={18} color={colors.text3} /> : <ChevronRight size={18} color={colors.text3} />}
    </PressableScale>
  );
});
