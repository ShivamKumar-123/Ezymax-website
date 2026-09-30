// /algo/strategies/[id]/deploy (modal) — running a strategy is always the client's explicit decision: this form names
// the exact version, asks for the account (demo first), offers optional safety limits (lot multiplier, open positions,
// a daily loss stop sized from the account's equity), warns about real money on a live account and needs a tick to go
// live. The service then runs that immutable version 24/7 until it is paused, stopped or killed. Never optimistic.
import * as React from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { TriangleAlert } from "lucide-react-native";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { useQuery } from "@/lib/query";
import { RestrictionBanner } from "@/shell/RestrictionBanner";
import { Banner, Button, Card, Checkbox, Display, FormError, Skeleton, Text, TextField } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { useAccounts } from "@/features/trading/accounts";
import { algoPost, fetchers, keys, refreshAlgo, validId, type RiskLimits } from "../api";
import { KV, Note } from "../components/bits";
import { ActionBar, FormScreen, ModalHeader } from "../components/chrome";
import { Chip, ChipRow, Field, RadioCard, WEB_NO_RING } from "../components/controls";
import { LoadError } from "../components/states";
import { ccyOf, kindLabel, money } from "../format";
import { useReadOnly, useTradingRestricted } from "../hooks";
import { distanceText, sizeText } from "../spec";

const MULTIPLIERS = [0.25, 0.5, 1, 2, 3];
const MAX_OPEN = [0, 1, 2, 3, 5];
const LOSS_PCT = [0, 1, 2, 5];

export function DeployScreen() {
  const t = useT();
  const router = useRouter();
  const readOnly = useReadOnly();
  const restricted = useTradingRestricted();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = validId(raw) ? raw : null;
  const q = useQuery(id ? keys.strategy(id) : null, fetchers.strategy(id ?? "0"), { persist: true, staleMs: 10_000 });
  const accountsQ = useAccounts();
  const accounts = React.useMemo(() => (accountsQ.data?.accounts ?? []).filter((a) => a.status === "active"), [accountsQ.data]);

  const [login, setLogin] = React.useState<number | null>(null);
  const [mult, setMult] = React.useState(1);
  const [maxOpen, setMaxOpen] = React.useState(0);
  const [lossPct, setLossPct] = React.useState<number | "custom">(0);
  const [lossCustom, setLossCustom] = React.useState("");
  const [ack, setAck] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  // one request at a time, even for two taps before the button shows its spinner
  const inFlight = React.useRef(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const [done, setDone] = React.useState<{ id: number } | null>(null);

  // demo first: the safest default
  React.useEffect(() => {
    if (login === null || !accounts.some((a) => a.login === login)) setLogin((accounts.find((a) => a.type === "demo") ?? accounts[0])?.login ?? null);
  }, [accounts, login]);
  const acct = accounts.find((a) => a.login === login);
  const live = acct?.type === "live";
  React.useEffect(() => setAck(false), [login]);

  const s = q.data;
  const close = () => (router.canGoBack() ? router.back() : router.replace(id ? `/algo/strategies/${id}` : "/algo"));

  if (!id || (!s && q.error)) {
    return (
      <FormScreen header={<ModalHeader onClose={close} />}>
        <LoadError error={q.error ?? { code: "not_found", message: "", status: 404 }} onRetry={() => void q.refresh()} onBack={close} />
      </FormScreen>
    );
  }

  // the loss limit is in the account's own currency (the runtime compares it with the account's P&L): USC on a cent account
  const ccy = ccyOf(acct);
  const equity = acct?.equity ?? 0;
  const lossAmount = lossPct === "custom" ? Number(lossCustom.replace(",", ".")) : Math.round((equity * lossPct) / 100);
  const lossOk = lossPct === 0 || (Number.isFinite(lossAmount) && lossAmount > 0);
  const ready = !!s && !!acct && s.current.valid && !readOnly && !restricted && lossOk && (!live || ack) && s.status !== "archived";

  const deploy = async () => {
    if (!s || !acct || !ready || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setErr(null);
    const risk: RiskLimits = {};
    if (mult !== 1) risk.lotMultiplier = mult;
    if (maxOpen > 0) risk.maxOpenPositions = maxOpen;
    if (lossPct !== 0 && lossAmount > 0) risk.maxDailyLoss = lossAmount;
    const r = await algoPost<{ id: number; status: string }>("deployments", { strategyId: s.id, versionId: s.current.id, login: acct.login, risk });
    inFlight.current = false;
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    refreshAlgo();
    setDone({ id: r.data.id });
  };

  if (done && s && acct) {
    return (
      <FormScreen
        testID="deploy-done"
        header={<ModalHeader eyebrow={t("mobileAlgo.deploy.eyebrow", { version: s.current.version })} onClose={close} />}
        footer={
          <ActionBar>
            <Button label={t("common.done")} variant="ghost" full={false} style={{ flex: 1 }} onPress={close} />
            <Button
              testID="deploy-open"
              label={t("mobileAlgo.deploy.open")}
              full={false}
              style={{ flex: 1.8 }}
              onPress={() => {
                router.back();
                router.push(`/algo/deployments/${done.id}`);
              }}
            />
          </ActionBar>
        }
      >
        <View style={{ gap: space[3], paddingTop: space[6] }}>
          <Display size="hero" color={colors.ember}>
            {t("mobileAlgo.deploy.doneTitle")}
          </Display>
          <Text variant="headline" weight="700">
            {t("mobileAlgo.deploy.doneBody", { name: s.name, version: s.current.version, account: `${kindLabel(t, acct.type)} ${acct.login}` })}
          </Text>
          <Text tone="secondary">{t("mobileAlgo.deploy.warmup", { tf: s.timeframe })}</Text>
        </View>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      testID="deploy-screen"
      header={<ModalHeader eyebrow={s ? t("mobileAlgo.deploy.eyebrow", { version: s.current.version }) : undefined} onClose={close} />}
      footer={
        <ActionBar>
          <Button
            testID="deploy-confirm"
            label={acct ? t("mobileAlgo.deploy.confirm", { account: `${kindLabel(t, acct.type)} ${acct.login}` }) : t("mobileAlgo.deploy.title")}
            loading={busy}
            disabled={!ready}
            style={{ flex: 1 }}
            onPress={() => void deploy()}
          />
        </ActionBar>
      }
    >
      {!s ? (
        <View style={{ gap: space[3] }}>
          <Skeleton w="60%" h={40} r={10} />
          <Skeleton h={64} r={radius.lg} />
          <Skeleton h={64} r={radius.lg} />
        </View>
      ) : (
        <>
          <View style={{ gap: space[2] }}>
            <Display size="xl">{t("mobileAlgo.deploy.title")}</Display>
            <Text tone="secondary">{t("mobileAlgo.deploy.body", { name: s.name, version: s.current.version, symbol: s.symbol, tf: s.timeframe })}</Text>
          </View>
          <Card padded={false} style={{ paddingHorizontal: space[5], paddingVertical: space[1] }}>
            <KV label={t("mobileAlgo.rules.size")} value={sizeText(t, s.current.spec) ?? "—"} mono={false} />
            <KV label={t("mobileAlgo.rules.stop")} value={distanceText(t, s.current.spec.sl) ?? t("mobileAlgo.rules.none")} mono={false} />
            <KV label={t("mobileAlgo.rules.target")} value={distanceText(t, s.current.spec.tp) ?? t("mobileAlgo.rules.none")} mono={false} last />
          </Card>

          <Field label={t("mobileAlgo.deploy.account")}>
            {accountsQ.loading ? (
              <View style={{ gap: space[2] }}>
                <Skeleton h={64} r={radius.lg} />
                <Skeleton h={64} r={radius.lg} />
              </View>
            ) : accounts.length ? (
              <View style={{ gap: space[2] }} accessibilityRole="radiogroup">
                {accounts.map((a) => (
                  <RadioCard
                    key={a.login}
                    testID={`deploy-account-${a.login}`}
                    selected={a.login === login}
                    onPress={() => setLogin(a.login)}
                    title={`${kindLabel(t, a.type)} ${a.login}`}
                    text={`${a.groupName} · ${t("mobileAlgo.deploy.equity", { amount: money(a.equity, ccyOf(a)) })}`}
                  />
                ))}
              </View>
            ) : (
              <Card style={{ gap: space[3] }}>
                <Text tone="secondary">{t("mobileAlgo.deploy.noAccounts")}</Text>
                <Button label={t("mobileAlgo.deploy.openAccount")} variant="cream" size="md" full={false} onPress={() => router.push("/accounts/new")} />
              </Card>
            )}
          </Field>

          <Field label={t("mobileAlgo.deploy.multiplier")} hint={t("mobileAlgo.deploy.multiplierHint")}>
            <ChipRow>
              {MULTIPLIERS.map((m) => (
                <Chip key={m} testID={`deploy-mult-${m}`} label={`${m}×`} selected={mult === m} onPress={() => setMult(m)} />
              ))}
            </ChipRow>
          </Field>

          <Field label={t("mobileAlgo.deploy.maxOpen")} hint={t("mobileAlgo.deploy.maxOpenHint")}>
            <ChipRow>
              {MAX_OPEN.map((n) => (
                <Chip key={n} testID={`deploy-open-${n}`} mono={n > 0} label={n === 0 ? t("mobileAlgo.deploy.strategyDefault") : String(n)} selected={maxOpen === n} onPress={() => setMaxOpen(n)} />
              ))}
            </ChipRow>
          </Field>

          <Field label={t("mobileAlgo.deploy.dailyLoss")} hint={t("mobileAlgo.deploy.dailyLossHint")}>
            <ChipRow>
              {LOSS_PCT.map((p) => (
                <Chip
                  key={p}
                  testID={`deploy-loss-${p}`}
                  mono={p > 0}
                  label={p === 0 ? t("mobileAlgo.deploy.off") : equity > 0 ? `${money(Math.round((equity * p) / 100), ccy, false, 0)} · ${p}%` : `${p}%`}
                  selected={lossPct === p}
                  disabled={p > 0 && equity <= 0}
                  onPress={() => setLossPct(p)}
                />
              ))}
              <Chip testID="deploy-loss-custom" mono={false} label={t("mobileAlgo.deploy.custom")} selected={lossPct === "custom"} onPress={() => setLossPct("custom")} />
            </ChipRow>
            {lossPct === "custom" ? (
              <TextField
                testID="deploy-loss-amount"
                style={WEB_NO_RING}
                label={t("mobileAlgo.deploy.dailyLossAmount")}
                value={lossCustom}
                onChangeText={(v) => setLossCustom(v.replace(/[^\d.,]/g, "").slice(0, 10))}
                keyboardType="decimal-pad"
                inputMode="decimal"
                mono
                placeholder="200"
                // nothing typed yet is not an error (the button waits for an amount)
                error={lossOk || !lossCustom.trim() ? null : t("mobileAlgo.deploy.lossInvalid")}
                trailing={
                  <Text variant="callout" tone="tertiary">
                    {ccy}
                  </Text>
                }
              />
            ) : null}
          </Field>

          {readOnly ? <Banner tone="info" title={t("mobile.viewOnly")} body={t("mobileAlgo.readOnly")} /> : null}
          <RestrictionBanner kinds={["trading", "close_only"]} />
          {live ? (
            <View style={{ gap: space[3] }}>
              <Banner tone="warn" icon={<TriangleAlert size={18} color={colors.warn} />} title={t("mobileAlgo.deploy.liveTitle")} body={t("mobileAlgo.deploy.liveBody")} />
              <Checkbox checked={ack} onChange={setAck} accessibilityLabel={t("mobileAlgo.deploy.ack")}>
                <Text variant="callout" tone="secondary" testID="deploy-ack">
                  {t("mobileAlgo.deploy.ack")}
                </Text>
              </Checkbox>
            </View>
          ) : null}
          {!s.current.valid ? <FormError message={t("mobileAlgo.error.invalidStrategy")} /> : null}
          <FormError message={err?.message} />
          <Note>{t("mobileAlgo.deploy.note")}</Note>
        </>
      )}
    </FormScreen>
  );
}

export default DeployScreen;
