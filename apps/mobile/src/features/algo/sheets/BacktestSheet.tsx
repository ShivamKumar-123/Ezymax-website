// Run a new backtest of a saved strategy version: the period (only as long as the service allows for the
// timeframe), the starting balance and whose costs to simulate (an account type's spread, commission and swaps, or
// one of the client's own accounts). The server queues the job; the report screen follows its progress.
import * as React from "react";
import { View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFormat, useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { Button, Display, FormError, Pill, Sheet, Text, TextField, type SheetRef } from "@/ui";
import { GUTTER, space } from "@/theme/tokens";
import { useAccounts, useGroups } from "@/features/trading/accounts";
import { algoPost, refreshAlgo, type BacktestStatus } from "../api";
import { Chip, ChipRow, Field, WEB_NO_RING } from "../components/controls";
import { Note } from "../components/bits";
import { kindLabel, range, usd } from "../format";
import { defaultPeriod, periodRange, periodsFor, type PeriodKey } from "../spec";

export type BacktestTarget = { strategyId: number; versionId: number; version: number; name: string; symbol: string; timeframe: string; valid: boolean };
export type BacktestSheetRef = { open: (target: BacktestTarget) => void };

const BALANCES = [1_000, 10_000, 50_000, 100_000];
type GroupRow = { code: string; name?: string; enabled?: boolean; cent?: boolean };

export const BacktestSheet = React.forwardRef<BacktestSheetRef, { onStarted: (id: number) => void }>(function BacktestSheet({ onStarted }, ref) {
  const t = useT();
  const f = useFormat();
  const insets = useSafeAreaInsets();
  const sheet = React.useRef<SheetRef>(null);
  const [target, setTarget] = React.useState<BacktestTarget | null>(null);
  const [period, setPeriod] = React.useState<PeriodKey>("p1y");
  const [balance, setBalance] = React.useState<number | "other">(10_000);
  const [other, setOther] = React.useState("25000");
  const [costs, setCosts] = React.useState<"group" | "account">("group");
  const [group, setGroup] = React.useState("standard");
  const [login, setLogin] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  // closed while the server answers: a refusal comes back in the sheet
  const shown = React.useRef(false);

  const groupsQ = useGroups();
  const accountsQ = useAccounts();
  const groups = React.useMemo(() => ((groupsQ.data?.groups ?? []) as GroupRow[]).filter((g) => g.enabled !== false && !g.cent), [groupsQ.data]);
  const accounts = React.useMemo(() => (accountsQ.data?.accounts ?? []).filter((a) => a.status === "active"), [accountsQ.data]);

  React.useImperativeHandle(ref, () => ({
    open(tg) {
      setTarget(tg);
      setPeriod(defaultPeriod(tg.timeframe));
      setErr(null);
      setBusy(false);
      sheet.current?.present();
    },
  }));

  // a group that exists for this broker (standard when there is one)
  React.useEffect(() => {
    if (groups.length && !groups.some((g) => g.code === group)) setGroup((groups.find((g) => g.code === "standard") ?? groups[0]!).code);
  }, [groups, group]);
  React.useEffect(() => {
    if (login === null || !accounts.some((a) => a.login === login)) setLogin((accounts.find((a) => a.type === "demo") ?? accounts[0])?.login ?? null);
  }, [accounts, login]);

  const periods = target ? periodsFor(target.timeframe) : [];
  const [from, to] = periodRange(period);
  const amount = balance === "other" ? Number(other.replace(",", ".")) : balance;
  const amountOk = Number.isFinite(amount) && amount >= 100 && amount <= 10_000_000;
  const costsOk = costs === "group" ? !!group : login !== null;

  // one request at a time: a double tap never queues two backtests
  const inFlight = React.useRef(false);
  const start = async () => {
    if (!target || inFlight.current || !amountOk || !costsOk) return;
    inFlight.current = true;
    setBusy(true);
    setErr(null);
    const body: Record<string, unknown> = { strategyId: target.strategyId, versionId: target.versionId, from, to, initialBalance: amount };
    if (costs === "account" && login !== null) body.login = login;
    else body.group = group;
    const r = await algoPost<{ id: number; status: BacktestStatus }>("backtests", body);
    inFlight.current = false;
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      if (!shown.current) sheet.current?.present();
      return;
    }
    refreshAlgo();
    sheet.current?.dismiss();
    onStarted(r.data.id);
  };

  return (
    <Sheet
      ref={sheet}
      scroll
      enableDynamicSizing
      topInset={insets.top + space[2]}
      android_keyboardInputMode="adjustResize"
      onChange={(i) => {
        shown.current = i >= 0;
      }}
      onDismiss={() => {
        shown.current = false;
      }}
    >
      <BottomSheetScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: space[2], paddingBottom: Math.max(insets.bottom, space[4]) + space[4], gap: space[5] }}>
        {target ? (
          <>
            <View style={{ gap: space[1] }} testID="bt-sheet">
              <Display size="md">{t("mobileAlgo.btNew.title")}</Display>
              <Text variant="callout" tone="tertiary" numberOfLines={2}>
                {`${target.name} · v${target.version} · ${target.symbol} ${target.timeframe}`}
              </Text>
            </View>
            <Field label={t("mobileAlgo.btNew.period")} hint={range(f, from, to)}>
              <ChipRow>
                {periods.map((p) => (
                  <Chip key={p.key} testID={`bt-period-${p.key}`} label={t(p.label)} selected={period === p.key} onPress={() => setPeriod(p.key)} />
                ))}
              </ChipRow>
            </Field>
            <Field label={t("mobileAlgo.btNew.balance")}>
              <ChipRow>
                {BALANCES.map((b) => (
                  <Chip key={b} testID={`bt-balance-${b}`} label={usd(b, false, 0)} selected={balance === b} onPress={() => setBalance(b)} />
                ))}
                <Chip testID="bt-balance-other" label={t("mobileAlgo.btNew.other")} mono={false} selected={balance === "other"} onPress={() => setBalance("other")} />
              </ChipRow>
              {balance === "other" ? (
                <TextField
                  testID="bt-balance-amount"
                  style={WEB_NO_RING}
                  mono
                  label={t("mobileAlgo.btNew.amount")}
                  value={other}
                  onChangeText={(v) => setOther(v.replace(/[^\d.,]/g, "").slice(0, 10))}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  error={amountOk ? null : t("mobileAlgo.error.balanceRange")}
                  trailing={
                    <Text variant="callout" tone="tertiary">
                      USD
                    </Text>
                  }
                />
              ) : null}
            </Field>
            <Field label={t("mobileAlgo.btNew.costs")} hint={costs === "group" ? t("mobileAlgo.btNew.costsGroupHint") : t("mobileAlgo.btNew.costsAccountHint")}>
              <View style={{ flexDirection: "row", gap: space[2] }} accessibilityRole="tablist">
                <Pill compact label={t("mobileAlgo.btNew.accountType")} selected={costs === "group"} onPress={() => setCosts("group")} />
                <Pill compact label={t("mobileAlgo.btNew.myAccount")} selected={costs === "account"} onPress={() => setCosts("account")} />
              </View>
              {costs === "group" ? (
                <ChipRow>
                  {groups.map((g) => (
                    <Chip key={g.code} testID={`bt-group-${g.code}`} mono={false} label={g.name ?? g.code} selected={group === g.code} onPress={() => setGroup(g.code)} />
                  ))}
                </ChipRow>
              ) : accounts.length ? (
                <ChipRow>
                  {accounts.map((a) => (
                    <Chip key={a.login} testID={`bt-account-${a.login}`} label={`${kindLabel(t, a.type)} ${a.login}`} selected={login === a.login} onPress={() => setLogin(a.login)} />
                  ))}
                </ChipRow>
              ) : (
                <Text variant="caption" tone="tertiary">
                  {t("mobileAlgo.btNew.noAccounts")}
                </Text>
              )}
            </Field>
            {!target.valid ? <FormError message={t("mobileAlgo.error.invalidStrategy")} /> : null}
            <FormError message={err?.message} />
            <Button testID="bt-run" label={t("mobileAlgo.btNew.run")} loading={busy} disabled={!target.valid || !amountOk || !costsOk} onPress={() => void start()} />
            <Note>{t("mobileAlgo.btNew.note")}</Note>
          </>
        ) : (
          <View />
        )}
      </BottomSheetScrollView>
    </Sheet>
  );
});
