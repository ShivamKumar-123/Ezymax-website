// Account types (engine groups) as editorial colour blocks: the list's "Account types" strip and the wizard's
// type picker. Only commercial terms are shown (the server strips dealing details).
import * as React from "react";
import { View } from "react-native";
import { Check } from "lucide-react-native";
import { useT, type T } from "@/i18n";
import { fmtMoney } from "@/lib/format";
import { ColorBlock, Display, Mono, PressableScale, Text } from "@/ui";
import { blockColors, colors, radius, space } from "@/theme/tokens";
import { lev, maxLeverage, type GroupColor } from "../format";
import type { AccountKind, Group } from "../types";

export const pricingText = (g: Pick<Group, "commissionPerLot">, t: T) => (g.commissionPerLot > 0 ? t("mobileAccounts.pricing.raw") : t("mobileAccounts.pricing.allIn"));
export const commissionText = (g: Pick<Group, "commissionPerLot">, t: T) =>
  g.commissionPerLot > 0 ? t("mobileAccounts.pricing.perLot", { amount: fmtMoney(g.commissionPerLot, { currency: "USD" }).replace(/\.00$/, "") }) : t("common.none");
export const minDepositText = (g: Pick<Group, "minDeposit">, t: T) => (g.minDeposit > 0 ? fmtMoney(g.minDeposit, { currency: "USD", decimals: 0 }) : t("common.none"));
export const modeText = (mode: Group["mode"], t: T) => t.dyn(`mobileAccounts.mode.${mode}`, mode);

/** Spec pair on a colour block (ink) or on a dark card (cream). */
function Spec({ label, value, ink }: { label: string; value: string; ink: boolean }) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <Text variant="label" color={ink ? colors.ink2 : colors.text3} numberOfLines={1} style={{ fontSize: 10 }}>
        {label}
      </Text>
      <Mono size={14} weight="bold" color={ink ? colors.ink : colors.text} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {value}
      </Mono>
    </View>
  );
}

/** The list's strip: one saturated block per account type, opening the wizard on it. */
export const GroupBlock = React.memo(function GroupBlock({ g, color, onPress }: { g: Group; color: GroupColor; onPress: (code: string) => void }) {
  const t = useT();
  return (
    <ColorBlock color={color} onPress={() => onPress(g.code)} padded={false} style={{ width: 232, height: 214, padding: space[5], justifyContent: "space-between" }} accessibilityLabel={`${g.name}, ${modeText(g.mode, t)}`}>
      <View style={{ gap: 2 }}>
        <Text variant="label" color={colors.ink2} numberOfLines={1}>
          {modeText(g.mode, t)}
          {g.cent ? " · USC" : ""}
        </Text>
        <Display size="md" color={colors.ink} numberOfLines={1} adjustsFontSizeToFit>
          {g.name}
        </Display>
        <Text variant="caption" color={colors.ink2} numberOfLines={2}>
          {pricingText(g, t)}
        </Text>
      </View>
      <View style={{ gap: space[2] }}>
        {[
          [t("mobileAccounts.spec.maxLeverage"), lev(maxLeverage(g))],
          [t("mobileAccounts.spec.minDeposit"), minDepositText(g, t)],
        ].map(([label, value]) => (
          <View key={label} style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space[2], borderTopWidth: 1, borderTopColor: "rgba(14,14,16,0.14)", paddingTop: space[2] }}>
            <Text variant="label" color={colors.ink2} numberOfLines={1} style={{ fontSize: 10, flexShrink: 1 }}>
              {label}
            </Text>
            <Mono size={14} weight="bold" color={colors.ink} numberOfLines={1}>
              {value}
            </Mono>
          </View>
        ))}
      </View>
    </ColorBlock>
  );
});

/**
 * The wizard's choice: a dark card that becomes its saturated colour block when selected (the selection reads at a
 * glance). `used` / `max`: the client's accounts of this kind in the type; at the limit the card can't be picked.
 */
export const GroupOption = React.memo(function GroupOption({ g, color, kind, used, selected, onSelect }: { g: Group; color: GroupColor; kind: AccountKind; used: number; selected: boolean; onSelect: (code: string) => void }) {
  const t = useT();
  const full = used >= g.maxAccountsPerUser;
  const ink = selected;
  const fg2 = ink ? colors.ink2 : colors.text3;
  return (
    <PressableScale
      onPress={() => onSelect(g.code)}
      disabled={full}
      haptics="select"
      scaleTo={0.98}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: full }}
      accessibilityLabel={`${g.name}, ${modeText(g.mode, t)}, ${pricingText(g, t)}`}
      style={{ borderRadius: radius.card, padding: space[5], gap: space[4], backgroundColor: selected ? blockColors[color] : colors.surface, borderWidth: 1, borderColor: selected ? blockColors[color] : colors.line }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" color={fg2} numberOfLines={1}>
            {modeText(g.mode, t)}
            {g.cent ? ` · ${t("mobileAccounts.currency.uscShort")}` : ""}
            {g.swapFree ? ` · ${t("mobileAccounts.spec.swapFree")}` : ""}
          </Text>
          <Display size="md" color={selected ? colors.ink : blockColors[color]} numberOfLines={1} adjustsFontSizeToFit>
            {g.name}
          </Display>
          <Text variant="callout" color={ink ? colors.ink2 : colors.text2}>
            {pricingText(g, t)}
          </Text>
        </View>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            borderWidth: selected ? 0 : 1.5,
            borderColor: colors.lineStrong,
            backgroundColor: selected ? colors.ink : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selected ? <Check size={16} color={blockColors[color]} strokeWidth={3} /> : null}
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <Spec ink={ink} label={t("mobileAccounts.spec.commission")} value={commissionText(g, t)} />
        <Spec ink={ink} label={t("mobileAccounts.spec.minDeposit")} value={minDepositText(g, t)} />
      </View>
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <Spec ink={ink} label={t("mobileAccounts.spec.maxLeverage")} value={lev(maxLeverage(g))} />
        <Spec ink={ink} label={t("mobileAccounts.spec.stopOut")} value={`${g.stopOutPct}%`} />
      </View>
      <Text variant="caption" weight="700" color={full ? (ink ? colors.ink : colors.gold) : fg2}>
        {full ? t.dyn(`mobileAccounts.group.limit.${kind}`, undefined, { max: g.maxAccountsPerUser }) : t.dyn(`mobileAccounts.group.used.${kind}`, undefined, { used, max: g.maxAccountsPerUser })}
      </Text>
    </PressableScale>
  );
});
