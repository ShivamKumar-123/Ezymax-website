// Backtest settings before a run: the period (limited per timeframe like the service), the starting balance and
// whose costs to use (an account's spreads, commission and swaps, or the standard ones). Running saves the draft
// first (a new strategy, or a new version of this conversation's strategy), then queues the job on the server.
import * as React from "react";
import { View } from "react-native";
import { useT } from "@/i18n";
import { useActiveLogin } from "@/session/activeAccount";
import { Button, FormError, Pill, Sheet, Text, type SheetRef } from "@/ui";
import { space } from "@/theme/tokens";
import { SheetTextField } from "@/features/accounts/components/SheetInputs";
import { SheetHeader } from "@/features/chat/SheetHeader";
import { useAccounts } from "@/features/trading/accounts";
import { defaultPeriod, periodsFor, type Period } from "../spec";
import { draftById, runBacktest } from "../thread";
import { RiskNote } from "./parts";

const BALANCES = [1_000, 10_000, 100_000];

export const BacktestSheet = React.forwardRef<SheetRef, { draftId: string | null; onStarted: () => void }>(function BacktestSheet({ draftId, onStarted }, ref) {
  const t = useT();
  const sheet = React.useRef<SheetRef>(null);
  React.useImperativeHandle(ref, () => sheet.current as SheetRef, []);
  const accounts = useAccounts();
  const active = useActiveLogin();
  const d = draftId ? draftById(draftId) : null;
  const tf = d?.built.spec.timeframe ?? "H1";
  const periods = periodsFor(tf);
  const [period, setPeriod] = React.useState<Period["key"]>(defaultPeriod(tf));
  const [balance, setBalance] = React.useState("10000");
  const [login, setLogin] = React.useState<number | null>(active);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const usable = (accounts.data?.accounts ?? []).filter((a) => a.status === "active");
  const reset = React.useCallback(() => {
    setPeriod(defaultPeriod(tf));
    setError(null);
    setBusy(false);
    setLogin(active);
  }, [tf, active]);
  React.useEffect(reset, [reset]);

  const amount = Number(balance.replace(/[, ]/g, ""));
  const amountOk = Number.isFinite(amount) && amount >= 100 && amount <= 10_000_000;
  const days = (periods.find((p) => p.key === period) ?? periods[periods.length - 1])?.days ?? 30;

  const run = async () => {
    if (!draftId || busy || !amountOk) return;
    setBusy(true);
    setError(null);
    const r = await runBacktest(draftId, { days, initialBalance: amount, login: login ?? undefined });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    sheet.current?.dismiss();
    onStarted();
  };

  return (
    <Sheet ref={sheet} onDismiss={reset} scrollable>
      <View style={{ gap: space[5] }}>
        <SheetHeader title={t("mobileAi.bt.title")} subtitle={d ? t("mobileAi.bt.body", { symbol: d.built.spec.symbol, tf }) : undefined} onClose={() => sheet.current?.dismiss()} />
        <View style={{ gap: space[3] }}>
          <Text variant="label" tone="tertiary">
            {t("mobileAi.bt.period")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }} accessibilityRole="radiogroup">
            {periods.map((p) => (
              <Pill key={p.key} compact label={t(`mobileAi.bt.${p.key}`)} selected={period === p.key} onPress={() => setPeriod(p.key)} />
            ))}
          </View>
        </View>
        <View style={{ gap: space[3] }}>
          <SheetTextField mono label={t("mobileAi.bt.balance")} value={balance} onChangeText={setBalance} keyboardType="number-pad" error={balance && !amountOk ? t("mobileAi.bt.balanceRange") : null} testID="ai-bt-balance" />
          <View style={{ flexDirection: "row", gap: space[2] }}>
            {BALANCES.map((b) => (
              <Pill key={b} compact label={b.toLocaleString("en-US")} selected={amount === b} onPress={() => setBalance(String(b))} />
            ))}
          </View>
        </View>
        {usable.length ? (
          <View style={{ gap: space[3] }}>
            <Text variant="label" tone="tertiary">
              {t("mobileAi.bt.costs")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }} accessibilityRole="radiogroup">
              <Pill compact label={t("mobileAi.bt.costsStandard")} selected={login === null} onPress={() => setLogin(null)} />
              {usable.slice(0, 6).map((a) => (
                <Pill key={a.login} compact label={`${a.type === "live" ? t("common.live") : t("common.demo")} #${a.login}`} selected={login === a.login} onPress={() => setLogin(a.login)} />
              ))}
            </View>
          </View>
        ) : null}
        <RiskNote compact />
        <Text variant="caption" tone="tertiary">
          {t("mobileAi.bt.simNote")}
        </Text>
        <FormError message={error} />
        <Button label={t("mobileAi.bt.run")} loading={busy} disabled={!amountOk || !d?.built.valid} onPress={() => void run()} testID="ai-bt-run" />
      </View>
    </Sheet>
  );
});
