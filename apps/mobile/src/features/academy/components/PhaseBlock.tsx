// A phase of the learning path as a big saturated colour block: phase number and level, the title in tall display
// type, the huge phase number, a two-line summary and the chapter progress (ink on colour).
import * as React from "react";
import { View } from "react-native";
import { useT } from "@/i18n";
import { Display, PressableScale, Text } from "@/ui";
import { blockColors, colors, radius, space } from "@/theme/tokens";
import type { PhaseT } from "../api";
import { fmtMin, levelLabel, pct, phaseColor, phaseState, PHASE_STATE_LABEL, TONE, two } from "../format";
import { Bar } from "./Pills";

export const PhaseBlock = React.memo(function PhaseBlock({ p, onOpen }: { p: PhaseT; onOpen: (slug: string) => void }) {
  const t = useT();
  const state = phaseState(p);
  const done = p.progress.done === p.progress.total && p.progress.total > 0;
  return (
    <PressableScale
      onPress={() => onOpen(p.slug)}
      testID={`phase-card-${p.slug}`}
      accessibilityLabel={`${t("mobileAcademy.home.phaseA11y", { n: p.order, title: p.title })}. ${t(PHASE_STATE_LABEL[state])}. ${t("academy.stats.chapters", { done: p.progress.done, total: p.progress.total })}`}
      style={{ backgroundColor: blockColors[phaseColor(p.order)], borderRadius: radius.block, padding: space[5], gap: space[3], overflow: "hidden" }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
        <Text variant="label" color={colors.ink2} style={{ flex: 1 }} numberOfLines={1}>
          {`${t("academy.phaseN", { n: p.order })} · ${levelLabel(t, p.level)}`}
        </Text>
        {state !== "notStarted" ? (
          <View style={{ height: 24, paddingHorizontal: space[3], borderRadius: radius.pill, backgroundColor: colors.ink, justifyContent: "center" }}>
            <Text variant="label" color={state === "certified" ? TONE.award : colors.cream} style={{ fontSize: 10, lineHeight: 13 }}>
              {t(PHASE_STATE_LABEL[state])}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space[3] }}>
        <Display size="md" color={colors.ink} style={{ flex: 1 }} numberOfLines={3}>
          {p.title}
        </Display>
        <Display size="hero" color={colors.ink3} style={{ marginBottom: -8 }} accessible={false}>
          {two(p.order)}
        </Display>
      </View>
      <Text variant="callout" color={colors.ink2} numberOfLines={2} style={{ fontWeight: "500" }}>
        {p.summary}
      </Text>
      <View style={{ gap: space[2], marginTop: space[1] }}>
        <Bar value={pct(p.progress.done, p.progress.total)} ink />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text variant="caption" color={colors.ink} weight="700" style={{ fontVariant: ["tabular-nums"] }}>
            {t("academy.stats.chapters", { done: p.progress.done, total: p.progress.total })}
          </Text>
          <Text variant="caption" color={colors.ink2} style={{ fontVariant: ["tabular-nums"] }}>
            {done && p.exam && !p.certificate ? t("academy.phaseCard.finalExam", { count: p.exam.questions }) : fmtMin(t, p.minutes)}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
});
