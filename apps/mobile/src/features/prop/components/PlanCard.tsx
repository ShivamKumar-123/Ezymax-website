// A challenge plan as a bold colour block: model, name, account sizes (the fee follows the size), the key rules
// and the start button. The size choice is local to the card; only the card re-renders when it changes.
import * as React from "react";
import { ScrollView, View } from "react-native";
import { ArrowLeft, ArrowRight } from "lucide-react-native";
import { useLocale, useT } from "@/i18n";
import { ColorBlock, Display, Mono, PressableScale, Text } from "@/ui";
import { colors, radius, space, type BlockColor } from "@/theme/tokens";
import { defaultSize, prefetchWallet } from "../api";
import { feeLabel, sizeLabel, usd } from "../format";
import { targetsText, typeLabel, typeText } from "../rules";
import type { Plan, PlanSize } from "../types";
import { alpha, Tag } from "./bits";

function SizeChip({ s, on, onPress }: { s: PlanSize; on: boolean; onPress: (n: number) => void }) {
  return (
    <PressableScale
      onPress={() => onPress(s.size)}
      haptics="select"
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${sizeLabel(s.size)} · ${feeLabel(s.fee)}`}
      style={{ height: 40, minWidth: 64, paddingHorizontal: space[3], borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.ink : "transparent", borderWidth: 1.5, borderColor: on ? colors.ink : alpha(colors.ink, 0.22) }}
    >
      <Mono size={14} weight="bold" color={on ? colors.cream : colors.ink}>
        {sizeLabel(s.size)}
      </Mono>
    </PressableScale>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ width: "50%", paddingVertical: space[2], paddingEnd: space[3], gap: 2 }}>
      <Text variant="label" color={colors.ink2} numberOfLines={1}>
        {label}
      </Text>
      <Mono size={15} weight="bold" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Mono>
    </View>
  );
}

export const PlanCard = React.memo(function PlanCard({ plan, color, onBuy }: { plan: Plan; color: BlockColor; onBuy: (plan: Plan, size: number) => void }) {
  const t = useT();
  const { rtl } = useLocale();
  const [sizeN, setSizeN] = React.useState(() => defaultSize(plan));
  const size = plan.sizes.find((s) => s.size === sizeN) ?? plan.sizes[0]!;

  return (
    <ColorBlock color={color} style={{ marginHorizontal: space[5], gap: space[4] }} accessibilityLabel={plan.name}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
        <Tag label={typeLabel(t, plan.type)} tone="ink" />
        {plan.refundFee ? <Tag label={t("mobileProp.plan.refundable")} tone="ink" /> : null}
      </View>

      <View style={{ gap: space[2] }}>
        <Display size="lg" color={colors.ink} numberOfLines={2}>
          {plan.name}
        </Display>
        <Text variant="callout" color={colors.ink2}>
          {typeText(t, plan.type)}
        </Text>
      </View>

      <View style={{ gap: space[2] }}>
        <Text variant="label" color={colors.ink2}>
          {t("mobileProp.accountSize")}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space[6] }} contentContainerStyle={{ paddingHorizontal: space[6], gap: space[2] }} accessibilityRole="radiogroup">
          {plan.sizes.map((s) => (
            <SizeChip key={s.size} s={s} on={s.size === size.size} onPress={setSizeN} />
          ))}
        </ScrollView>
      </View>

      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space[3] }}>
        <View style={{ flexShrink: 1 }}>
          <Text variant="label" color={colors.ink2}>
            {t("mobileProp.plan.fee")}
          </Text>
          <Display size="hero" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit>
            {feeLabel(size.fee)}
          </Display>
        </View>
        <View style={{ alignItems: "flex-end", paddingBottom: 6 }}>
          <Text variant="label" color={colors.ink2}>
            {t("mobileProp.plan.account")}
          </Text>
          <Mono size={18} weight="bold" color={colors.ink}>
            {usd(size.size, 0)}
          </Mono>
          <Text variant="caption" color={colors.ink2}>
            {t("mobileProp.plan.leverage", { n: size.leverage })}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderTopColor: alpha(colors.ink, 0.14), paddingTop: space[2] }}>
        <Term label={t("mobileProp.plan.target")} value={targetsText(t, plan)} />
        <Term label={t("mobileProp.plan.dailyLoss")} value={`${plan.dailyLoss}% · ${usd((size.size * plan.dailyLoss) / 100, 0)}`} />
        <Term label={t("mobileProp.plan.maxDD")} value={`${plan.maxDD}% · ${t(plan.ddType === "trailing" ? "mobileProp.plan.trailing" : "mobileProp.plan.static")}`} />
        <Term label={t("mobileProp.profitSplit")} value={plan.splitMax > plan.split ? `${plan.split}% → ${plan.splitMax}%` : `${plan.split}%`} />
      </View>

      <PressableScale
        onPress={() => onBuy(plan, size.size)}
        onPressIn={prefetchWallet}
        haptics="tap"
        accessibilityLabel={t("mobileProp.plan.start", { fee: feeLabel(size.fee) })}
        style={{ height: 54, borderRadius: radius.pill, backgroundColor: colors.ink, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2] }}
      >
        <Text variant="headline" weight="700" color={colors.cream}>
          {t("mobileProp.plan.start", { fee: feeLabel(size.fee) })}
        </Text>
        {rtl ? <ArrowLeft size={18} color={colors.cream} /> : <ArrowRight size={18} color={colors.cream} />}
      </PressableScale>
    </ColorBlock>
  );
});
