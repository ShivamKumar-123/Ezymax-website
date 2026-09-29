// Account choice for the reports screens: a card showing the current account (or "All live accounts") that opens
// a sheet with the client's accounts. Rows warm the next screen's data on press-in.
import * as React from "react";
import { useWindowDimensions, View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronDown, Layers, Wallet } from "lucide-react-native";
import { useT } from "@/i18n";
import { fmtMoney } from "@/lib/format";
import { Display, Mono, PressableScale, Sheet, Text, type SheetRef } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import type { ReportAccount, Scope } from "../types";
import { KindTag, Tag } from "./Chrome";

const balanceOf = (a: ReportAccount) => fmtMoney(a.balance, { currency: a.cent || a.currency === "USC" ? "USC" : a.currency });
/** "Main · Standard"; the name is left out when it repeats the login or the group. */
const nameOf = (a: ReportAccount) => [a.name && a.name !== String(a.login) && a.name.toLowerCase() !== a.groupName.toLowerCase() ? a.name : null, a.groupName].filter(Boolean).join(" · ");

export function AccountCard({ scope, account, liveCount, onPress }: { scope: Scope; account?: ReportAccount; liveCount: number; onPress: () => void }) {
  const t = useT();
  const all = scope === "all";
  const title = all ? t("portfolio.an.allLive") : `#${scope}`;
  const sub = all ? t("mobileReports.account.allHint", { count: liveCount }) : account ? `${nameOf(account)} · ${balanceOf(account)}` : "";
  return (
    <PressableScale
      onPress={onPress}
      haptics="select"
      scaleTo={0.985}
      accessibilityLabel={`${t("mobileReports.account.title")}: ${title}. ${t("mobileReports.account.change")}`}
      style={{ marginHorizontal: GUTTER, minHeight: 64, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space[4], paddingVertical: space[3], flexDirection: "row", alignItems: "center", gap: space[3] }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
        {all ? <Layers size={18} color={colors.text2} strokeWidth={1.75} /> : <Wallet size={18} color={colors.text2} strokeWidth={1.75} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          {all ? (
            <Text variant="headline" numberOfLines={1}>
              {title}
            </Text>
          ) : (
            <Mono size={16} weight="bold" numberOfLines={1}>
              {title}
            </Mono>
          )}
          {!all && account ? <KindTag type={account.type} /> : null}
        </View>
        {sub ? (
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <ChevronDown size={20} color={colors.text3} />
    </PressableScale>
  );
}

type SheetProps = {
  accounts: ReportAccount[];
  value: Scope;
  /** offer "All live accounts" first */
  allowAll: boolean;
  onSelect: (s: Scope) => void;
  onPressIn?: (s: Scope) => void;
};

export const AccountSheet = React.forwardRef<SheetRef, SheetProps>(function AccountSheet({ accounts, value, allowAll, onSelect, onPressIn }, ref) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const live = accounts.filter((a) => a.type === "live").length;
  return (
    <Sheet ref={ref} scroll maxDynamicContentSize={Math.round(height * 0.78)}>
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: space[5], paddingBottom: Math.max(insets.bottom, space[4]) + space[2] }}>
        <Display size="md" style={{ marginTop: space[2], marginBottom: space[4] }} accessibilityRole="header">
          {t("mobileReports.account.choose")}
        </Display>
        {allowAll ? <Row selected={value === "all"} title={t("portfolio.an.allLive")} sub={t("mobileReports.account.allHint", { count: live })} onPress={() => onSelect("all")} onPressIn={() => onPressIn?.("all")} /> : null}
        {accounts.map((a) => (
          <Row key={a.login} selected={value === a.login} account={a} title={`#${a.login}`} sub={`${nameOf(a)} · ${balanceOf(a)}`} onPress={() => onSelect(a.login)} onPressIn={() => onPressIn?.(a.login)} />
        ))}
      </BottomSheetScrollView>
    </Sheet>
  );
});

function Row({ selected, account, title, sub, onPress, onPressIn }: { selected: boolean; account?: ReportAccount; title: string; sub: string; onPress: () => void; onPressIn: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      onPressIn={onPressIn}
      haptics="select"
      scaleTo={0.985}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${sub}`}
      style={{ minHeight: 64, flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: space[3], borderBottomWidth: 1, borderBottomColor: colors.line }}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          {account ? (
            <Mono size={16} weight="bold">
              {title}
            </Mono>
          ) : (
            <Text variant="headline">{title}</Text>
          )}
          {account ? <KindTag type={account.type} /> : <Tag label="USD" tone="outline" />}
        </View>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: selected ? colors.ember : "transparent", borderWidth: selected ? 0 : 1, borderColor: colors.lineStrong }}>
        {selected ? <Check size={16} color={colors.ink} strokeWidth={3} /> : null}
      </View>
    </PressableScale>
  );
}
