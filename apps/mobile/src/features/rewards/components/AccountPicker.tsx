// Choose one of the client's live trading accounts (contest entry, a bonus claim, a trading-bonus reward). Reads
// the shared accounts list; a single eligible account is picked for the reader. No eligible account: a way to open
// one.
import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useT } from "@/i18n";
import { fmtMoney } from "@/lib/format";
import { useAccounts } from "@/features/trading/accounts";
import type { EngAccount } from "@/features/trading/types";
import { Button, Mono, PressableScale, Skeleton, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { Tag } from "../../partner/components/Chrome";
import { tint } from "../../partner/tint";

/** Equity in USD (cent accounts hold US cents). */
export const usdEquity = (a: Pick<EngAccount, "equity" | "cent" | "currency">) => (a.cent || a.currency === "USC" ? a.equity / 100 : a.equity);

export function AccountPicker({ value, onChange, filter, emptyHint, onNavigate }: { value: number | null; onChange: (login: number) => void; filter?: (a: EngAccount) => boolean; emptyHint?: string; onNavigate?: () => void }) {
  const t = useT();
  const router = useRouter();
  const q = useAccounts();
  const live = React.useMemo(() => (q.data?.accounts ?? []).filter((a) => a.type === "live" && (a.status === "active" || !a.status) && (!filter || filter(a))), [q.data, filter]);

  React.useEffect(() => {
    if (value === null && live.length === 1) onChange(live[0]!.login);
  }, [value, live, onChange]);

  if (!q.data)
    return q.error ? (
      <Text variant="caption" tone="tertiary">
        {t("mobileRewards.picker.unavailable")}
      </Text>
    ) : (
      <View style={{ gap: space[2] }}>
        <Skeleton h={62} r={radius.md} />
        <Skeleton h={62} r={radius.md} />
      </View>
    );

  if (live.length === 0)
    return (
      <View style={{ borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.lineStrong, padding: space[4], gap: space[3] }}>
        <View style={{ gap: 2 }}>
          <Text variant="callout" weight="700">
            {t("mobileRewards.picker.noneTitle")}
          </Text>
          <Text variant="caption" tone="tertiary">
            {emptyHint ?? t("mobileRewards.picker.noneBody")}
          </Text>
        </View>
        <Button
          label={t("mobileRewards.picker.open")}
          variant="secondary"
          size="sm"
          full={false}
          onPress={() => {
            onNavigate?.();
            router.push({ pathname: "/accounts/new", params: { type: "live" } });
          }}
        />
      </View>
    );

  return (
    <View style={{ gap: space[2] }} accessibilityRole="radiogroup" accessibilityLabel={t("mobileRewards.picker.label")}>
      {live.map((a) => {
        const on = a.login === value;
        return (
          <PressableScale
            key={a.login}
            onPress={() => onChange(a.login)}
            haptics="select"
            scaleTo={0.985}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${a.login}, ${a.groupName}, ${fmtMoney(usdEquity(a), { currency: "USD" })}`}
            testID={`account-option-${a.login}`}
            style={{ minHeight: 62, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], borderRadius: radius.md, borderWidth: 1.5, borderColor: on ? colors.ember : colors.line, backgroundColor: on ? tint.emberRow : colors.surface2 }}
          >
            <Tag label={t("common.live")} tone="ember" />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Mono size={14} weight="bold">
                #{a.login}
              </Mono>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {a.groupName || a.group}
              </Text>
            </View>
            <Mono size={13} tone="secondary">
              {fmtMoney(usdEquity(a), { currency: "USD" })}
            </Mono>
            <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? colors.ember : colors.lineStrong, alignItems: "center", justifyContent: "center" }}>{on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ember }} /> : null}</View>
          </PressableScale>
        );
      })}
    </View>
  );
}
