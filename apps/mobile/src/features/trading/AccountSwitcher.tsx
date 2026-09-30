// Account switcher: a chip showing the active account, and the sheet that lists the client's trading accounts
// (live first) with their equity. Picking one makes it the active account for Trade, Home and Portfolio.
import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Check, ChevronDown } from "lucide-react-native";
import { useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { setActiveLogin, useActiveLogin } from "@/session/activeAccount";
import { Button, Display, Money, PressableScale, Sheet, Text, type SheetRef } from "@/ui";
import { alpha } from "@/theme/alpha";
import { colors, radius, space } from "@/theme/tokens";

const CHIP_ON_BLOCK = alpha(colors.ink, 0.12);
import { useAccounts } from "./accounts";
import type { EngAccount } from "./types";

export function accountLabel(t: ReturnType<typeof useT>, a: Pick<EngAccount, "type" | "login">) {
  return t("mobileTrade.account.chip", { type: t(a.type === "live" ? "common.live" : "common.demo"), login: a.login });
}

/** The chip; `tone` = on a colour block (ink) or on the dark canvas. */
export function AccountChip({ onPress, tone = "dark" }: { onPress: () => void; tone?: "dark" | "ink" }) {
  const t = useT();
  const login = useActiveLogin();
  const accounts = useAccounts();
  const acc = accounts.data?.accounts.find((a) => a.login === login);
  const ink = tone === "ink";
  return (
    <PressableScale
      onPress={onPress}
      haptics="select"
      accessibilityLabel={acc ? accountLabel(t, acc) : t("mobileTrade.state.noAccount.title")}
      style={{ height: 36, paddingHorizontal: space[3], borderRadius: radius.pill, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: ink ? CHIP_ON_BLOCK : colors.surface, borderWidth: ink ? 0 : 1, borderColor: colors.line }}
    >
      {acc ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: acc.type === "live" ? colors.ember : colors.periwinkle }} /> : null}
      <Text variant="caption" weight="700" color={ink ? colors.ink : colors.text} numberOfLines={1}>
        {acc ? accountLabel(t, acc) : "—"}
      </Text>
      <ChevronDown size={14} color={ink ? colors.ink : colors.text3} />
    </PressableScale>
  );
}

export const AccountSheet = React.forwardRef<SheetRef>(function AccountSheet(_, ref) {
  const t = useT();
  const router = useRouter();
  const login = useActiveLogin();
  const accounts = useAccounts();
  const list = React.useMemo(() => [...(accounts.data?.accounts ?? [])].sort((a, b) => (a.type === b.type ? a.login - b.login : a.type === "live" ? -1 : 1)), [accounts.data]);
  const dismiss = () => (ref && typeof ref !== "function" ? ref.current?.dismiss() : undefined);
  return (
    <Sheet ref={ref} scrollable>
      <Display size="md" style={{ marginBottom: space[4] }}>
        {t("common.accounts")}
      </Display>
      <View style={{ gap: space[2] }}>
        {list.map((a) => {
          const on = a.login === login;
          return (
            <PressableScale
              key={a.login}
              onPress={() => {
                haptic.select();
                setActiveLogin(a.login);
                dismiss();
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              scaleTo={0.985}
              style={{ minHeight: 64, borderRadius: radius.lg, padding: space[4], flexDirection: "row", alignItems: "center", gap: space[3], backgroundColor: on ? colors.surface2 : colors.bg, borderWidth: 1, borderColor: on ? colors.lineStrong : colors.line }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: a.type === "live" ? colors.ember : colors.periwinkle }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text weight="700">{accountLabel(t, a)}</Text>
                <Text variant="caption" tone="tertiary">
                  {`${a.groupName ?? a.group} · 1:${a.leverage}`}
                </Text>
              </View>
              <Money value={a.equity} currency={a.currency} size={14} />
              {on ? <Check size={18} color={colors.ember} /> : <View style={{ width: 18 }} />}
            </PressableScale>
          );
        })}
      </View>
      <View style={{ gap: space[2], marginTop: space[5] }}>
        <Button
          label={t("mobileTrade.account.open")}
          variant="cream"
          size="md"
          onPress={() => {
            dismiss();
            router.push("/accounts/new");
          }}
        />
        <Button
          label={t("mobileTrade.account.manage")}
          variant="ghost"
          size="md"
          onPress={() => {
            dismiss();
            router.push("/accounts");
          }}
        />
      </View>
    </Sheet>
  );
});
