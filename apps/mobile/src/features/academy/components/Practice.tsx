// "Practise on demo": the chapter's exercise on the learner's demo account in the app's own Trade tab (the web opens
// Kalks Trader on the demo account). No demo account yet: open one first (the accounts wizard, demo preselected).
import * as React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { MonitorPlay } from "lucide-react-native";
import { useT } from "@/i18n";
import { instruments } from "@/market/instruments";
import { setActiveLogin } from "@/session/activeAccount";
import { Button, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { setTradeSymbol } from "@/features/trade/symbol";
import { useAccounts } from "@/features/trading/accounts";
import { tint } from "../tint";
import type { Practice } from "../api";

/** The learner's usable demo account (null: none yet; undefined: accounts not loaded). */
export function useDemoAccount() {
  const q = useAccounts();
  if (!q.data) return undefined;
  return q.data.accounts.find((a) => a.type === "demo" && (a.status === "active" || !a.status)) ?? null;
}

/** Opens the Trade tab on the demo account (and the exercise's symbol when the app lists it). */
export function usePractise() {
  const router = useRouter();
  const demo = useDemoAccount();
  return React.useCallback(
    (symbol?: string | null) => {
      if (demo === null) return router.push("/accounts/new?type=demo");
      if (demo) setActiveLogin(demo.login);
      if (symbol && instruments().some((i) => i.symbol === symbol)) setTradeSymbol(symbol);
      router.navigate("/trade");
    },
    [demo, router],
  );
}

export function PracticeCard({ practice }: { practice: NonNullable<Practice> }) {
  const t = useT();
  const demo = useDemoAccount();
  const practise = usePractise();
  const label = demo === null ? t("academy.practice.openFreeDemo") : demo ? t("mobileAcademy.practice.onDemo", { login: demo.login }) : t("academy.practice.demo");
  return (
    <View testID="practice" style={{ borderRadius: radius.card, borderWidth: 1, borderColor: tint(colors.ember, 0.3), backgroundColor: tint(colors.ember, 0.08), padding: space[5], gap: space[4] }}>
      <View style={{ flexDirection: "row", gap: space[3], alignItems: "flex-start" }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ember, alignItems: "center", justifyContent: "center" }}>
          <MonitorPlay size={19} color={colors.ink} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, gap: space[1] }}>
          <Text variant="label" tone="ember">
            {practice.symbol ? `${t("mobileAcademy.practice.title")} · ${practice.symbol}` : t("mobileAcademy.practice.title")}
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 22 }} tone="secondary">
            {practice.label}
          </Text>
        </View>
      </View>
      <Button label={label} variant="secondary" size="md" full={false} onPress={() => practise(practice.symbol)} testID="practice-open" />
    </View>
  );
}
